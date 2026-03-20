# AGENTS.md

这个仓库是一个面向个人使用的静态健康管理工具，部署到 GitHub Pages，运行时依赖浏览器、`localStorage` 和可选的 Supabase。

## 先看哪里

开始任何改动前，先按下面顺序阅读：

1. `docs/index.md`
2. `docs/product-spec.md`
3. `docs/acceptance.md`
4. 涉及的数据或部署改动，再看 `docs/architecture.md` 和 `docs/operations.md`

## 仓库地图

- `index.html`
  页面结构、主要区域、挂载点和外部脚本引用。
- `styles.css`
  全站视觉样式和响应式布局。
- `app.js`
  本地数据读写、页面渲染、趋势图、复盘逻辑、Supabase 自动同步。
- `config.js`
  运行时配置。这里只允许放前端可公开的 Supabase URL / publishable key / 登录邮箱。
- `supabase-setup.sql`
  云端数据表、索引和 RLS 初始化脚本。
- `docs/`
  结构化知识库，是这个项目的记录系统。
- `scripts/`
  零依赖检查脚本，供本地和 CI 复用。

## 工作方式

- 保持项目是“无构建步骤”的静态站点。
- 不要把 Supabase 配置面板重新做成主界面业务模块。
- 优先保留简单、低摩擦的日常记录体验。
- 新功能先更新 `docs/`，再改代码。
- 提交前运行 `npm run check`。

## 关键约束

- GitHub Pages 必须能直接部署根目录静态文件。
- 页面在没有 Supabase 配置或没有登录成功时也必须可用。
- 本地记录、导入导出、复盘和趋势图是核心能力，不能因为新功能回归。
- 文档必须短、具体、可执行，避免写成长篇说明书。

## 改动完成的最低验收

- `npm run check` 通过
- 手动确认核心路径没有明显回归：
  - 新增一条今日记录
  - 切换趋势指标
  - 切换复盘周期
  - 刷新后数据仍可见
