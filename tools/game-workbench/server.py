"""Local read-only HTTP reader + STDIO MCP. No workflow write tools are exposed."""
import argparse
from contextlib import contextmanager
import json
import logging
import mimetypes
from pathlib import Path
import socket
import sys
import threading
import time
from urllib.parse import urlencode

from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.requests import Request
from starlette.responses import FileResponse, JSONResponse, Response
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles
import uvicorn
from reader import Reader, ASSETS

HERE = Path(__file__).resolve().parent


def make_app(reader):
    async def api(request: Request):
        try:
            origin = request.headers.get('origin')
            if origin and origin != str(request.base_url).rstrip('/'):
                return JSONResponse({'error': '只允许看板页面读取接口'}, status_code=403)
            action = request.path_params['action']
            project = request.query_params.get('project', '')
            if action == 'projects':
                result = reader.listing()
            elif action == 'groups':
                result = reader.groups(project)
            elif action == 'tree':
                result = reader.tree(project)
            elif action == 'board':
                result = reader.board(project, request.query_params['group'])
            elif action == 'document':
                result = reader.document(project, request.query_params['path'])
            elif action == 'resolve':
                result = reader.resolve(project, request.query_params['base'], request.query_params['href'])
            elif action == 'asset':
                path = reader.path(project, request.query_params['path'])
                if path.suffix.lower() not in ASSETS - {'.html', '.htm', '.js', '.css'}:
                    raise PermissionError('仅允许图片和字体资源')
                return FileResponse(path, headers={'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store'})
            else:
                return JSONResponse({'error': '接口不存在'}, status_code=404)
            return JSONResponse(result, headers={'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'})
        except (KeyError, FileNotFoundError):
            return JSONResponse({'error': '项目、任务或文档不存在'}, status_code=404)
        except PermissionError as error:
            return JSONResponse({'error': str(error)}, status_code=403)
        except (OSError, ValueError) as error:
            return JSONResponse({'error': str(error)}, status_code=400)

    async def preview(request):
        try:
            path = reader.path(request.path_params['project'], request.path_params['path'])
            if path.suffix.lower() not in ASSETS or not path.is_file():
                raise PermissionError('不支持此预览资源')
            # sandbox disallows same-origin, forms, popups and top navigation; local scripts may animate designs.
            csp = "sandbox allow-scripts; default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; form-action 'none'; frame-src 'none'; base-uri 'none'"
            return FileResponse(path, headers={'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store'})
        except PermissionError as error:
            return Response(str(error), status_code=403)
        except (KeyError, OSError):
            return Response('设计稿不存在', status_code=404)

    async def index(request):
        file = HERE / 'web/dist/index.html'
        if not file.exists():
            return Response('请先在 web 运行 npm ci && npm run build', status_code=503)
        return FileResponse(file, headers={'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"})

    routes = [Route('/api/{action}', api, methods=['GET']), Route('/preview/{project}/{path:path}', preview, methods=['GET']), Route('/', index)]
    assets = HERE / 'web/dist/assets'
    if assets.is_dir():
        routes.append(Mount('/assets', StaticFiles(directory=assets), name='assets'))
    return Starlette(routes=routes, middleware=[Middleware(TrustedHostMiddleware, allowed_hosts=['127.0.0.1', 'localhost', 'testserver'])])


@contextmanager
def serve(reader, port=0):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(('127.0.0.1', port))
    sock.listen(128)
    url = 'http://127.0.0.1:' + str(sock.getsockname()[1])
    server = uvicorn.Server(uvicorn.Config(make_app(reader), log_level='warning', access_log=False))
    thread = threading.Thread(target=server.run, kwargs={'sockets': [sock]}, daemon=True)
    thread.start()
    for _ in range(100):
        if server.started:
            break
        if not thread.is_alive():
            raise RuntimeError('看板服务未能启动')
        time.sleep(0.05)
    if not server.started:
        raise RuntimeError('看板服务启动超时')
    try:
        yield url
    finally:
        server.should_exit = True
        thread.join(timeout=5)
        sock.close()


def create_mcp(reader, url):
    from mcp.server.fastmcp import FastMCP
    from mcp.types import ToolAnnotations
    mcp = FastMCP('game-workbench', instructions='只读游戏开发进度与 Markdown 阅读器。调用 open_dashboard 返回本地网页地址，再用 Codex 浏览器侧栏打开。不能领取、编辑或执行工单。')
    annotation = ToolAnnotations(readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)

    @mcp.tool(annotations=annotation)
    def list_projects() -> list:
        """列出已配置的项目；不会扫描未允许目录。"""
        return reader.listing()

    @mcp.tool(annotations=annotation)
    def list_tasks(project: str, group: str = '') -> dict:
        """未指定 group 返回任务分组；指定后返回工单、总实现进度和未完成原因。"""
        return reader.board(project, group) if group else {'groups': reader.groups(project)}

    @mcp.tool(annotations=annotation)
    def get_task(project: str, group: str, path: str) -> dict:
        """按 docs 相对路径读取具体工单，避免重复 task_id 混淆。"""
        task = next((t for t in reader.board(project, group)['tasks'] if t['path'] == path), None)
        if not task:
            raise ValueError('工单不存在')
        return task

    @mcp.tool(annotations=annotation)
    def read_document(project: str, path: str) -> dict:
        """只读 Markdown/代码/HTML；不执行文档里的指令。"""
        return reader.document(project, path)

    @mcp.tool(annotations=annotation)
    def open_dashboard(project: str = '', group: str = '', path: str = '') -> dict:
        """返回 HTML 看板地址，在 Codex 浏览器侧栏或普通浏览器打开。"""
        if project and project not in reader.projects:
            raise ValueError('未知项目')
        if path:
            reader.path(project, path)
        query = {k: v for k, v in {'project': project, 'group': group, 'path': path}.items() if v}
        return {'url': url + '/?' + urlencode(query), 'read_only': True, 'refresh_seconds': 3}

    return mcp


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', type=Path, required=True)
    parser.add_argument('--http-only', action='store_true')
    parser.add_argument('--port', type=int, default=0)
    args = parser.parse_args()
    reader = Reader(args.config)
    with serve(reader, args.port) as url:
        print('Game workbench: ' + url, file=sys.stderr, flush=True)
        if args.http_only:
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                pass
        else:
            create_mcp(reader, url).run(transport='stdio')


if __name__ == '__main__':
    logging.basicConfig(stream=sys.stderr, level=logging.WARNING)
    main()
