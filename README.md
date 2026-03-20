# 个人健康管理工具

这是一个零依赖的静态网页应用，直接打开 `index.html` 就能使用。

## 功能

- 记录每日饮水、睡眠、步数、体重、血压、心情和备注
- 自定义健康目标
- 自动生成最近一周摘要和简单健康提示
- 使用浏览器 `localStorage` 本地保存数据
- 支持导出和导入 JSON 数据

## 使用方式

1. 打开 `index.html`
2. 在“目标设置”里调整自己的健康目标
3. 每天在“每日打卡”里填写数据并保存
4. 在“健康记录”里查看最近记录，或导出备份

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
- `styles.css`: 界面样式
- `app.js`: 数据存储与交互逻辑
