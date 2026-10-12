---
name: docs-git
description: docs 独立版本库的建立边界与维护方式。
metadata:
  kind: skill-reference
  schema-version: "1"
---
# 独立文档 Git
`docs/` 必须由单独 Git 仓库维护，与代码仓库分别检查、分别暂存、分别提交。工作树可以是独立嵌套仓库，或项目既有 Git submodule；继承已经选定的方式。

## 写入前检查
使用已查阅的 Git 命令检查代码根和 docs 的 `rev-parse --show-toplevel`、`status --short`，检查 docs/.git 是目录还是 worktree/submodule 指向文件，同时检查 `.gitmodules` 和主仓库 `ls-files -- docs`。仅 `git -C docs status` 成功不证明独立，因为 Git 会向上寻找父仓库。
主仓库不能把 docs 普通文件和独立文档仓库双重跟踪；submodule 的 gitlink 属于正常跟踪。

## 建立与迁移
用户明确授权建立文档仓库且 docs 尚未被主仓库跟踪时，可在本地 `git init docs`，为独立嵌套模式维护主仓库 `/docs/` 忽略规则；保留原有文件。若 docs 已有文件被主仓库跟踪，先完成文档草稿和可审查的迁移方案，说明涉及路径、历史保留与恢复方式，再请求迁移授权。不要直接执行 `git rm --cached`、移动历史、覆盖 .git 或自动改 submodule。
用户未指定远程时不猜远程、不创建外部仓库、不 push。仅编写规划/文档不等于授权改造仓库。

## 维护
- 各仓库只暂存本任务的明确路径，不用覆盖用户改动的全量 add/reset/clean。
- 已授权提交时，记录关联代码提交和文档提交；工作树未提交则诚实标记 working-tree、受影响路径和验证范围。
- docs 自己的 commit SHA 不写入同一提交形成自引用；交付时报告最终文档提交。
- 代码和 docs 无跨仓库原子提交：记录提交顺序、对应关系和未完成步骤。submodule 按仓库约定更新代码仓库指针。
- 只写文档时验证 meta、引用和源码契约；改变编译输入或生产代码时执行项目要求的构建/测试。
