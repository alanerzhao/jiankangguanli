# 个人健康管理工具

这是一个零依赖的静态网页应用，直接打开 `index.html` 就能使用，也可以发布到 GitHub Pages。

## 功能

- 记录每日饮水、睡眠、步数、饮食热量、体重、心情和备注
- 自定义健康目标
- 自动生成最近一周摘要、趋势图和简单健康提示
- 支持 `7天 / 30天 / 本月 / 今年` 的复盘视角
- 预留 Supabase 云同步能力，默认不在主界面暴露配置面板
- 使用浏览器 `localStorage` 本地保存数据
- 支持导出和导入 JSON 数据

## 使用方式

1. 打开 `index.html`
2. 在“目标设置”里调整自己的健康目标
3. 每天在“每日打卡”里填写数据并保存
4. 在“健康记录”里查看最近记录，或导出备份

## 云同步说明

如果你想把数据从本地浏览器升级为云端存储，可以使用 Supabase：

1. 创建一个 Supabase 项目
2. 打开 SQL Editor，运行仓库里的 `supabase-setup.sql`
3. 在 `config.js` 里填写 `supabaseUrl`、`supabaseAnonKey` 和 `supabaseAuthEmail`
4. 打开页面后，系统会自动向 `supabaseAuthEmail` 发送一次登录链接
5. 完成首次授权后，后续记录会自动写入 Supabase，页面加载时也会自动拉取云端数据

这个方案适合继续保留 GitHub Pages 静态前端，同时让数据支持长期管理和多设备同步。Supabase 作为底层基础设施存在，不再作为完整业务模块展示在页面上。

## 发布到 GitHub Pages

这个项目已经适配 GitHub Pages 自动部署。

1. 把当前项目推送到 GitHub 仓库的 `main` 分支
2. 打开 GitHub 仓库的 `Settings -> Pages`
3. 在 `Build and deployment` 里把 `Source` 设为 `GitHub Actions`
4. 等待仓库里的 `Deploy Static Site to GitHub Pages` 工作流执行完成
5. 发布地址通常会是 `https://<你的用户名>.github.io/<仓库名>/`

如果仓库名不是用户主页仓库，访问时请确保带上仓库路径。

## 文件说明

- `index.html`: 页面结构
- `config.js`: Supabase 运行时配置
- `styles.css`: 界面样式
- `app.js`: 数据存储与交互逻辑
- `supabase-setup.sql`: Supabase 数据表和 RLS 初始化 SQL
- `AGENTS.md`: 给 Codex / 智能体阅读的仓库地图
- `docs/`: 产品、架构、验收和运维文档
- `scripts/`: 零依赖检查脚本

## Harness Engineering 实践

这个仓库现在已经补上了一套轻量的 harness，目标是让智能体和人都能更稳定地改这个项目：

- `AGENTS.md` 只做地图，避免变成又大又旧的说明书
- `docs/` 把产品目标、架构边界、验收标准和运维流程分开记录
- `npm run check` 会统一跑语法检查、文档完整性检查和静态站点冒烟检查
- GitHub Actions 会在部署前先跑检查，避免明显回归直接上线

本地执行：

```bash
npm run check
```
