# Operations

## 本地预览

在项目根目录运行：

```bash
python3 -m http.server 4173
```

然后访问 [http://localhost:4173](http://localhost:4173)。

## 本地检查

```bash
npm run check
```

这个命令会做：

- JavaScript 语法检查
- 文档完整性检查
- 静态站点冒烟检查
- Playwright 端到端测试

首次在本地运行 Playwright 前，需要先安装依赖和浏览器：

```bash
npm install
npx playwright install chromium
```

## Supabase 初始化

1. 在 Supabase 项目中打开 `SQL Editor`
2. 运行根目录的 `supabase-setup.sql`
3. 在 `Authentication -> URL Configuration` 中配置站点 URL
4. 在 `config.js` 中填写：
   - `supabaseUrl`
   - `supabaseAnonKey`
   - `supabaseAuthEmail`

## GitHub Pages 发布

1. 提交并推送到 `main`
2. GitHub Actions 会先跑检查，再部署静态文件
3. 线上地址为：
   - `https://alanerzhao.github.io/jiankangguanli/`

## 回滚

如果最新版本体验明显变差，优先使用 `git revert <commit>` 回滚单次改动，再推送触发 Pages 重发。
