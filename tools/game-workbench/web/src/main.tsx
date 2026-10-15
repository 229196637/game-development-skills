import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { marked } from "marked";
import DOMPurify from "dompurify";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";
import "./style.css";

// Strip image fetch attributes before insertion; resolve only local docs assets afterwards.
DOMPurify.addHook("beforeSanitizeAttributes", (node) => {
  if (node.nodeName.toLowerCase() === "img") {
    node.setAttribute("data-workbench-src", node.getAttribute("src") || "");
    node.removeAttribute("src");
    node.removeAttribute("srcset");
  }
});

type Item = { done: boolean; text: string };
type Task = {
  links: {
    label: string;
    kind: string;
    path: string;
    anchor: string;
    url?: string;
  }[];
  id: string;
  class_name: string;
  path: string;
  status: string;
  goal: string;
  done: number;
  total: number;
  completed: boolean;
  depends_on: string[];
  blocked_by: string[];
  issues: string[];
  items: Item[];
  tests: { id: string; result: string }[];
  acceptance: { id: string; result: string }[];
  claim: { owner?: string } | null;
};
type Board = {
  name: string;
  entry: string | null;
  tasks: Task[];
  issues: string[];
  summary: {
    done: number;
    total: number;
    percent: number | null;
    completed: number;
    count: number;
    doing: number;
    blocked: number;
    unknown: number;
  };
};
type Doc = {
  path: string;
  text: string;
  kind: string;
  meta: Record<string, unknown>;
  warning: string | null;
};
type Group = { id: string; name: string; entry: string | null };
type Route = { project: string; group: string; path: string; anchor: string };
const labels: Record<string, string> = {
  todo: "待做",
  doing: "进行中",
  blocked: "阻塞",
  completed: "已标记完成",
  unknown: "状态未知",
};
const readRoute = (): Route => {
  const p = new URLSearchParams(location.search);
  return {
    project: p.get("project") || "",
    group: p.get("group") || "",
    path: p.get("path") || "",
    anchor: decodeURIComponent(location.hash.slice(1)),
  };
};
async function api<T>(
  action: string,
  values: Record<string, string> = {},
): Promise<T> {
  const response = await fetch(
    "/api/" + action + "?" + new URLSearchParams(values),
  );
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "读取失败");
  return data;
}
function ratio(values: Task["tests"]) {
  return values.length
    ? values.filter((x) => x.result === "passed").length + "/" + values.length
    : "未登记";
}
function App() {
  const [route, setRoute] = useState<Route>(readRoute),
    [projects, setProjects] = useState<
      { id: string; name: string; available: boolean }[]
    >([]),
    [groups, setGroups] = useState<Group[]>([]),
    [board, setBoard] = useState<Board | null>(null),
    [doc, setDoc] = useState<Doc | null>(null),
    [tree, setTree] = useState<{ path: string; name: string }[]>([]),
    [error, setError] = useState(""),
    [docError, setDocError] = useState(""),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [nav, setNav] = useState(false),
    [tick, setTick] = useState(0),
    [refreshed, setRefreshed] = useState(""),
    [zoom, setZoom] = useState<string | null>(null),
    [zoomScale, setZoomScale] = useState(1),
    [outline, setOutline] = useState(false);
  const content = useRef<HTMLDivElement>(null),
    current = useRef(route);
  current.current = route;
  const [headings, setHeadings] = useState<
    { id: string; text: string; level: number }[]
  >([]);
  function navigate(change: Partial<Route>, replace = false) {
    const next = { ...current.current, ...change };
    const url =
      "/?" +
      new URLSearchParams({
        project: next.project,
        group: next.group,
        ...(next.path ? { path: next.path } : {}),
      }) +
      (next.anchor ? "#" + encodeURIComponent(next.anchor) : "");
    history[replace ? "replaceState" : "pushState"]({}, "", url);
    setRoute(next);
    localStorage.setItem(
      "game-workbench-selection",
      JSON.stringify({ project: next.project, group: next.group }),
    );
    setDocError("");
  }
  useEffect(() => {
    const pop = () => setRoute(readRoute());
    addEventListener("popstate", pop);
    const timer = setInterval(() => setTick((n) => n + 1), 3000);
    return () => {
      removeEventListener("popstate", pop);
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    api<typeof projects>("projects")
      .then((values) => {
        setProjects(values);
        if (!current.current.project) {
          let saved: Partial<Route> = {};
          try {
            saved = JSON.parse(
              localStorage.getItem("game-workbench-selection") || "{}",
            );
          } catch {
            /* no selection */
          }
          const p =
            values.find((x) => x.id === saved.project && x.available) ||
            values.find((x) => x.available);
          if (p)
            navigate(
              {
                project: p.id,
                group: p.id === saved.project ? saved.group || "" : "",
                path: "",
              },
              true,
            );
        }
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!route.project) return;
    let active = true;
    Promise.all([
      api<Group[]>("groups", { project: route.project }),
      api<typeof tree>("tree", { project: route.project }),
    ])
      .then(([g, t]) => {
        if (!active) return;
        setGroups(g);
        setTree(t);
        if (
          !g.some((x) => x.id === current.current.group) &&
          (g.length || current.current.group)
        )
          navigate({ group: g[0]?.id || "" }, true);
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [route.project, tick]);
  useEffect(() => {
    setBoard(null);
    setTree([]);
    setGroups([]);
  }, [route.project]);
  useEffect(() => {
    if (!route.project || !route.group) {
      setBoard(null);
      return;
    }
    let active = true;
    api<Board>("board", { project: route.project, group: route.group })
      .then((b) => {
        if (active) {
          setBoard(b);
          setError("");
          setRefreshed(
            new Date().toLocaleTimeString("zh-CN", { hour12: false }),
          );
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [route.project, route.group, tick]);
  useEffect(() => {
    if (!route.project || !route.path) {
      setDoc(null);
      return;
    }
    let active = true;
    api<Doc>("document", { project: route.project, path: route.path })
      .then((d) => {
        if (active) {
          setDoc((old) =>
            old &&
            old.path === d.path &&
            old.text === d.text &&
            JSON.stringify(old.meta) === JSON.stringify(d.meta)
              ? old
              : d,
          );
          setDocError("");
        }
      })
      .catch((e) => {
        if (active) {
          setDoc(null);
          setDocError(e.message);
        }
      });
    return () => {
      active = false;
    };
  }, [route.project, route.path, tick]);
  async function follow(href: string) {
    if (href.startsWith("#")) {
      navigate({ anchor: decodeURIComponent(href.slice(1)) });
      return;
    }
    try {
      const result = await api<{
        kind: string;
        path: string;
        anchor: string;
        url?: string;
      }>("resolve", {
        project: current.current.project,
        base: current.current.path,
        href,
      });
      if (result.kind === "external") {
        window.open(result.url, "_blank", "noopener,noreferrer");
        return;
      }
      navigate({ path: result.path, anchor: result.anchor || "" });
      setNav(false);
    } catch (e) {
      setDocError((e as Error).message);
    }
  }
  useEffect(() => {
    if (!doc || doc.kind !== "markdown" || !content.current) {
      setHeadings([]);
      return;
    }
    let active = true;
    const element = content.current;
    (async () => {
      const html = await marked.parse(doc.text);
      if (!active) return;
      element.innerHTML = DOMPurify.sanitize(html);
      const used = new Map<string, number>();
      const hs = Array.from(
        element.querySelectorAll<HTMLElement>("h1,h2,h3,h4"),
      ).map((h) => {
        const base = (h.textContent || "")
          .trim()
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s_-]/gu, "")
          .replace(/\s/g, "-");
        const n = used.get(base) || 0;
        used.set(base, n + 1);
        h.id = base + (n ? "-" + n : "");
        return {
          id: h.id,
          text: h.textContent || "",
          level: Number(h.tagName[1]),
        };
      });
      setHeadings(hs);
      element
        .querySelectorAll<HTMLInputElement>("input")
        .forEach((x) => (x.disabled = true));
      element.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
        const src = img.getAttribute("data-workbench-src") || "";
        img.removeAttribute("src");
        if (src.startsWith("data:image/")) {
          img.src = src;
          return;
        }
        api<{ path: string; kind: string }>("resolve", {
          project: route.project,
          base: doc.path,
          href: src,
        })
          .then((result) => {
            if (active && result.kind !== "external")
              img.src =
                "/api/asset?" +
                new URLSearchParams({
                  project: route.project,
                  path: result.path,
                });
          })
          .catch(() => {
            img.alt = "图片不可访问：" + src;
          });
      });
      element
        .querySelectorAll<HTMLElement>("pre code:not(.language-mermaid)")
        .forEach((code) => hljs.highlightElement(code));
      const blocks = Array.from(
        element.querySelectorAll<HTMLElement>("pre code.language-mermaid"),
      );
      if (blocks.length) {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          htmlLabels: false,
          flowchart: { htmlLabels: false },
          theme: "base",
          themeVariables: {
            fontFamily: "Segoe UI, Microsoft YaHei, sans-serif",
            fontSize: "20px",
            primaryColor: "#edf5f0",
            primaryTextColor: "#193c35",
            lineColor: "#799087",
          },
        });
        for (let index = 0; index < blocks.length; index++) {
          if (!active) return;
          const block = blocks[index],
            graph = block.textContent || "";
          const links = Array.from(
            graph.matchAll(/click\s+([\w]+)\s+"([^"\n]+)"/g),
          );
          const code = graph.replace(/^\s*click\s+.*$/gm, "");
          try {
            const id = "diagram-" + Date.now() + "-" + index;
            const result = await mermaid.render(id, code);
            if (!active) return;
            const frame = document.createElement("div");
            frame.className = "diagram";
            const drawing = document.createElement("div");
            drawing.innerHTML = DOMPurify.sanitize(result.svg, {
              USE_PROFILES: { svg: true, svgFilters: true },
            });
            frame.appendChild(drawing);
            const button = document.createElement("button");
            button.textContent = "放大查看";
            button.className = "diagram-open";
            button.onclick = () => {
              setZoomScale(1);
              setZoom(drawing.innerHTML);
            };
            frame.appendChild(button);
            block.parentElement?.replaceWith(frame);
            for (const [, node, href] of links) {
              const target = Array.from(
                drawing.querySelectorAll<SVGElement>(".node"),
              ).find(
                (x) =>
                  x.id.startsWith("flowchart-" + node + "-") ||
                  x.id.includes("-flowchart-" + node + "-"),
              );
              if (target) {
                target.setAttribute("tabindex", "0");
                target.setAttribute("role", "link");
                target.setAttribute("aria-label", "打开 " + node);
                target.style.cursor = "pointer";
                target.dataset.href = href;
                target.addEventListener("click", () => void follow(href));
                target.addEventListener("keydown", (e) => {
                  if (e.key === "Enter") void follow(href);
                });
              }
            }
          } catch {
            if (active) {
              const warning = document.createElement("p");
              warning.className = "notice";
              warning.textContent = "此图无法渲染，保留下方 Mermaid 源码。";
              block.parentElement?.before(warning);
            }
          }
        }
      }
      if (active && current.current.anchor)
        document
          .getElementById(current.current.anchor)
          ?.scrollIntoView({ block: "start" });
    })().catch((e) => active && setDocError(String(e)));
    return () => {
      active = false;
    };
  }, [doc]);
  useEffect(() => {
    if (route.anchor)
      setTimeout(
        () =>
          document
            .getElementById(route.anchor)
            ?.scrollIntoView({ block: "start" }),
        50,
      );
  }, [route.anchor]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(null);
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  const summary = board?.summary;
  const selected = board?.tasks.find((t) => t.path === route.path);
  const remaining = board?.tasks.filter((t) => !t.completed) || [];
  const completed = board?.tasks.filter((t) => t.completed) || [];
  const shown = remaining.filter(
    (t) =>
      filter === "all" ||
      (filter === "blocked"
        ? t.status === "blocked" || t.blocked_by.length > 0
        : t.status === filter),
  );
  const visibleTree = tree
    .filter(
      (x) => !search || x.path.toLowerCase().includes(search.toLowerCase()),
    )
    .slice(0, 180);
  function taskRow(t: Task) {
    return (
      <button
        key={t.path}
        className={"task-row " + (route.path === t.path ? "selected" : "")}
        onClick={() => navigate({ path: t.path, anchor: "" })}
      >
        <div className="task-row-top">
          <strong>{t.class_name}</strong>
          <span className={"status " + (t.completed ? "completed" : t.status)}>
            {t.completed ? "已验收完成" : labels[t.status] || t.status}
          </span>
        </div>
        <p>{t.goal || "目标信息待补齐"}</p>
        <div className="mini-bar">
          <span
            style={{ width: (t.total ? (t.done / t.total) * 100 : 0) + "%" }}
          />
        </div>
        <div className="task-row-bottom">
          <span>
            {t.done} / {t.total} 工作项
          </span>
          <span>
            测试 {ratio(t.tests)} · 验收 {ratio(t.acceptance)}
          </span>
        </div>
        {!!t.blocked_by.length && (
          <small className="block-reason">
            前置未完成：{t.blocked_by.join("、")}
          </small>
        )}
        {t.status === "blocked" && !t.blocked_by.length && (
          <small className="block-reason">已记录阻塞，请查看工单底部原因</small>
        )}
        {!!t.issues.length && (
          <small className="warning-text">{t.issues[0]}</small>
        )}
      </button>
    );
  }
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">G</span>
          <div>
            <b>游戏开发工作台</b>
            <small>任务进度 / 文档阅读</small>
          </div>
        </div>
        <div className="header-tools">
          <span className="readonly">只读</span>
          <button
            className="quiet"
            onClick={() => setTick((n) => n + 1)}
            title="刷新"
          >
            刷新
          </button>
          <button className="mobile-nav quiet" onClick={() => setNav(!nav)}>
            目录
          </button>
        </div>
      </header>
      <div className="layout">
        <aside className={"sidebar " + (nav ? "visible" : "")}>
          <label>
            项目
            <select
              aria-label="选择项目"
              value={route.project}
              onChange={(e) =>
                navigate({
                  project: e.target.value,
                  group: "",
                  path: "",
                  anchor: "",
                })
              }
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.available ? "" : " · 不可访问"}
                </option>
              ))}
            </select>
          </label>
          <label>
            当前开发任务
            <select
              aria-label="选择任务"
              value={route.group}
              onChange={(e) =>
                navigate({ group: e.target.value, path: "", anchor: "" })
              }
            >
              {!groups.length && <option value="">暂无任务</option>}
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <div className="sidebar-line" />
          <div className="nav-title">文档与工单</div>
          <input
            aria-label="搜索文档路径"
            className="search"
            placeholder="搜索文件或模块…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <nav>
            {["策划", "文档", "规划", "测试"].map((folder) => (
              <details key={folder} open>
                <summary>
                  {folder}
                  <span>
                    {tree.filter((x) => x.path.startsWith(folder + "/")).length}
                  </span>
                </summary>
                {visibleTree
                  .filter((x) => x.path.startsWith(folder + "/"))
                  .map((x) => (
                    <button
                      key={x.path}
                      className={
                        "file " + (x.path === route.path ? "active" : "")
                      }
                      title={x.path}
                      onClick={() => {
                        navigate({ path: x.path, anchor: "" });
                        setNav(false);
                      }}
                    >
                      <span>{x.name.replace(/\.md$/, "")}</span>
                      <small>
                        {x.path.split("/").slice(1, -1).join(" / ")}
                      </small>
                    </button>
                  ))}
              </details>
            ))}
          </nav>
          {visibleTree.length === 180 && (
            <small>文件较多，请搜索缩小范围。</small>
          )}
          <div className="sidebar-footer">
            从 Markdown 实时读取
            <br />每 3 秒刷新 · 不修改项目
          </div>
        </aside>
        <main>
          <section className="overview">
            <div className="eyebrow">CURRENT DEVELOPMENT TASK</div>
            <div className="title-row">
              <h1>{route.group || "选择一个开发任务"}</h1>
              <span className="live">
                <i />
                {refreshed ? refreshed + " 更新" : "正在读取"}
              </span>
            </div>
            {error && (
              <div role="alert" className="notice">
                {error}
              </div>
            )}
            {summary && (
              <>
                <div className="progress-heading">
                  <div>
                    <span className="progress-label">实现进度</span>
                    <div className="work-count">
                      <b>{summary.done}</b>
                      <span> / {summary.total} 工作项</span>
                    </div>
                  </div>
                  <div className="percentage">
                    {summary.percent === null ? "—" : summary.percent}
                    <span>{summary.percent === null ? "" : "%"}</span>
                  </div>
                </div>
                <div
                  className="main-progress"
                  role="progressbar"
                  aria-label="任务实现进度"
                  aria-valuenow={summary.percent ?? 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: (summary.percent ?? 0) + "%" }} />
                </div>
                <div className="metrics">
                  <span>
                    验收完成{" "}
                    <b>
                      {summary.completed} / {summary.count}
                    </b>{" "}
                    工单
                  </span>
                  <span>
                    进行中 <b>{summary.doing}</b>
                  </span>
                  <span>
                    阻塞 <b>{summary.blocked}</b>
                  </span>
                  {summary.unknown > 0 && (
                    <span className="warning-text">
                      状态未知 <b>{summary.unknown}</b>
                    </span>
                  )}
                </div>
                {summary.total > 0 &&
                  summary.done === summary.total &&
                  summary.completed < summary.count && (
                    <div className="pending-note">
                      实现工作项已完成，待测试 / 验收
                    </div>
                  )}
                {!summary.count && (
                  <div className="empty-inline">
                    暂无工单{board?.entry ? "，仍可阅读此任务文档" : ""}
                  </div>
                )}
                {board?.issues.map((x, i) => (
                  <div key={i} className="inline-issue">
                    {x}
                  </div>
                ))}
                {board?.tasks.some((t) => t.issues.length > 0) && (
                  <div className="inline-issue">
                    部分工单数据不完整；进度仅汇总已识别工作项，详情中可查看问题。
                  </div>
                )}
              </>
            )}
            {board?.entry && (
              <button
                className="text-button"
                onClick={() => navigate({ path: board.entry!, anchor: "" })}
              >
                阅读任务入口 →
              </button>
            )}
          </section>
          <div className={"workspace " + (!route.path ? "no-document" : "")}>
            <section className="task-panel">
              <div className="panel-heading">
                <h2>
                  未完成工单 <span>{remaining.length}</span>
                </h2>
                <span className="subtle">按 TODO 顺序</span>
              </div>
              <div className="filters">
                {[
                  ["all", "全部"],
                  ["doing", "进行中"],
                  ["blocked", "阻塞"],
                  ["todo", "待做"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    className={filter === id ? "on" : ""}
                    onClick={() => setFilter(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="task-list">
                {shown.map(taskRow)}
                {!shown.length && (
                  <div className="empty">
                    {summary?.count && remaining.length === 0
                      ? "此任务工单已全部验收完成"
                      : "当前筛选下没有工单"}
                    <small>只读展示，不会自动开始下一阶段。</small>
                  </div>
                )}
              </div>
              {!!completed.length && (
                <details className="completed-list">
                  <summary>已完成工单 · {completed.length}</summary>
                  {completed.map(taskRow)}
                </details>
              )}
            </section>
            <section className="reader-panel">
              <div className="reader-toolbar">
                <div>
                  <button aria-label="阅读后退" onClick={() => history.back()}>
                    ←
                  </button>
                  <button
                    aria-label="阅读前进"
                    onClick={() => history.forward()}
                  >
                    →
                  </button>
                </div>
                <span title={route.path}>{route.path || "关联文档阅读器"}</span>
                {route.path && (
                  <button onClick={() => setOutline(!outline)}>大纲</button>
                )}
              </div>
              {docError && (
                <div role="alert" className="notice">
                  {docError}
                </div>
              )}
              {!route.path && (
                <div className="reader-placeholder">
                  <div className="reader-emblem">MD</div>
                  <h2>从一张工单开始阅读</h2>
                  <p>
                    查看具体目标与工作项，沿文档索引进入类职责、API、架构图与设计稿。
                  </p>
                  <small>任务进度始终来自原 Markdown 文件。</small>
                </div>
              )}
              {doc && (
                <>
                  {selected && (
                    <div className="related">
                      <b>{selected.class_name}</b>
                      <span>
                        测试 {ratio(selected.tests)} · 验收{" "}
                        {ratio(selected.acceptance)}
                      </span>
                      {selected.claim?.owner && (
                        <span>领取人：{selected.claim.owner}</span>
                      )}
                      <div>
                        {selected.links.map((link: any, i) => (
                          <button
                            key={i}
                            onClick={() =>
                              link.kind === "external"
                                ? window.open(
                                    link.url,
                                    "_blank",
                                    "noopener,noreferrer",
                                  )
                                : navigate({
                                    path: link.path,
                                    anchor: link.anchor || "",
                                  })
                            }
                          >
                            {link.label} ↗
                          </button>
                        ))}
                      </div>
                      {selected.issues.map((x, i) => (
                        <small key={i} className="warning-text">
                          {x}
                          <br />
                        </small>
                      ))}
                    </div>
                  )}
                  {doc.warning && (
                    <div className="notice">meta 解析问题：{doc.warning}</div>
                  )}
                  {Object.keys(doc.meta).length > 0 && (
                    <details className="meta">
                      <summary>文档信息 · meta</summary>
                      <pre>{JSON.stringify(doc.meta, null, 2)}</pre>
                    </details>
                  )}
                  {outline && (
                    <nav className="outline" aria-label="文档大纲">
                      {headings.map((h) => (
                        <button
                          key={h.id}
                          style={{ paddingLeft: h.level * 12 }}
                          onClick={() => navigate({ anchor: h.id })}
                        >
                          {h.text}
                        </button>
                      ))}
                    </nav>
                  )}
                  {doc.kind === "markdown" ? (
                    <div
                      key={doc.path}
                      className="prose"
                      ref={content}
                      onClick={(e) => {
                        const a = (e.target as Element).closest("a");
                        if (a) {
                          e.preventDefault();
                          void follow(
                            a.getAttribute("href") ||
                              a.getAttribute("xlink:href") ||
                              "",
                          );
                        }
                      }}
                    />
                  ) : doc.kind === "html" ? (
                    <div key={doc.path} className="html-preview">
                      <div className="preview-label">
                        HTML 设计稿 · 隔离交互预览
                      </div>
                      <iframe
                        title="HTML 设计稿预览"
                        sandbox="allow-scripts"
                        src={
                          "/preview/" +
                          encodeURIComponent(route.project) +
                          "/" +
                          doc.path.split("/").map(encodeURIComponent).join("/")
                        }
                      />
                    </div>
                  ) : (
                    <pre key={doc.path} className="code-view">
                      <code
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(
                            hljs.highlight(doc.text, {
                              language:
                                (
                                  {
                                    cs: "csharp",
                                    py: "python",
                                    pyi: "python",
                                    ts: "typescript",
                                    tsx: "typescript",
                                    js: "javascript",
                                    json: "json",
                                    yaml: "yaml",
                                    yml: "yaml",
                                    css: "css",
                                  } as Record<string, string>
                                )[doc.path.split(".").pop() || ""] ||
                                "plaintext",
                            }).value,
                          ),
                        }}
                      />
                    </pre>
                  )}
                </>
              )}
            </section>
          </div>
        </main>
      </div>
      {zoom && (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label="架构图放大查看"
        >
          <div className="modal-tools">
            <span>架构图 · 滚动查看</span>
            <div>
              <button
                aria-label="缩小架构图"
                onClick={() => setZoomScale((n) => Math.max(0.25, n - 0.25))}
              >
                −
              </button>
              <button
                aria-label="重置架构图缩放"
                onClick={() => setZoomScale(1)}
              >
                {Math.round(zoomScale * 100)}%
              </button>
              <button
                aria-label="放大架构图"
                onClick={() => setZoomScale((n) => Math.min(3, n + 0.25))}
              >
                +
              </button>
            </div>
            <button autoFocus onClick={() => setZoom(null)}>
              关闭 Esc
            </button>
          </div>
          <div
            className="modal-drawing"
            onClick={(e) => {
              const a = (e.target as Element).closest("a,[data-href]");
              if (a) {
                e.preventDefault();
                void follow(
                  a.getAttribute("data-href") || a.getAttribute("href") || "",
                );
                setZoom(null);
              }
            }}
            style={{ zoom: zoomScale }}
            dangerouslySetInnerHTML={{ __html: zoom }}
          />
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
