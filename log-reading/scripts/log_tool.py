"""log-reading 的只读专用工具；不自动修改产物、不承担业务语义验证。"""
import argparse
import datetime as dt
import json
import re
import sys
from collections import deque
from pathlib import Path
from urllib.parse import unquote
def output(value):
    print(json.dumps(value, ensure_ascii=False, indent=2, default=str))

def logs(args):
    patterns = [re.compile('(?:^|[\\s,{])' + re.escape(k) + '\\s*[:=]\\s*"?' + re.escape(v) + '"?(?=[\\s,}]|$)') for k, v in (item.split('=', 1) for item in args.match)]
    result, total = ([], 0)
    for file_name in args.files:
        path = Path(file_name)
        before = deque(maxlen=args.context)
        remaining, last_emitted = (0, 0)
        with path.open(encoding=args.encoding, errors='strict') as stream:
            for number, line in enumerate(stream, 1):
                line = line.rstrip('\r\n')
                matched = all((p.search(line) for p in patterns)) and (not args.contains or args.contains in line)
                if matched and total < args.limit:
                    total += 1
                    for n, text in before:
                        if n > last_emitted:
                            result.append({'file': str(path), 'line': n, 'text': text, 'match': False})
                            last_emitted = n
                    if number > last_emitted:
                        result.append({'file': str(path), 'line': number, 'text': line, 'match': True})
                        last_emitted = number
                    remaining = args.context
                elif remaining:
                    if number > last_emitted:
                        result.append({'file': str(path), 'line': number, 'text': line, 'match': False})
                        last_emitted = number
                    remaining -= 1
                before.append((number, line))
                if total >= args.limit and (not remaining):
                    break
    output({'matches': total, 'limit_reached': total >= args.limit, 'evidence': result, 'limits': ['does not infer session identity, timezone order or root cause', 'raw evidence; redact sensitive values before sharing']})
    return 0

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 sub=parser.add_subparsers(dest='command',required=True)
 read=sub.add_parser('read')
 read.add_argument('files',nargs='+')
 read.add_argument('--match',action='append',default=[])
 read.add_argument('--contains')
 read.add_argument('--context',type=int,default=4)
 read.add_argument('--limit',type=int,default=20)
 read.add_argument('--encoding',default='utf-8-sig')
 args=parser.parse_args()
 try:
  if args.limit<1:raise ValueError('--limit must be positive')
  if not 0<=args.context<=1000:raise ValueError('--context must be between 0 and 1000')
  return logs(args)
 except Exception as exc:
  output({'ok':False,'error':str(exc),'exception':type(exc).__name__})
  return 2
if __name__=='__main__':
 raise SystemExit(main())
