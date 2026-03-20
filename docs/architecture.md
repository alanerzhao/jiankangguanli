# Architecture

## 运行形态

- 纯静态前端
- 直接由 GitHub Pages 提供页面
- 无打包步骤、无后端服务

## 关键文件职责

- `index.html`
  定义页面结构和脚本装配顺序。
- `styles.css`
  定义布局、主题和图表样式。
- `app.js`
  负责状态管理、渲染、事件绑定、导入导出和云同步。
- `config.js`
  注入运行时配置。
- `supabase-setup.sql`
  初始化 `health_records` 与 `health_goals`。

## 数据分层

### 本地

- `health-manager-records`
- `health-manager-goals`
- `health-manager-sync-meta`
- `health-manager-magic-link-meta`

这些 key 存在浏览器 `localStorage` 中，页面不依赖服务器即可运行。

### 云端

当 `config.js` 提供 `supabaseUrl` 和 `supabaseAnonKey` 后：

- 页面创建 Supabase client
- 尝试恢复登录会话
- 拉取当前用户的记录与目标
- 保存记录或目标时自动 upsert 到云端

## 重要约束

- 同一天记录使用 `date` 做本地唯一键，保存时覆盖旧值。
- 云端记录使用 `(user_id, record_date)` 做唯一冲突键。
- 没有云端会话时，页面必须继续本地可用。
- 清空本地数据不会自动删除云端数据。

## 渲染路径

入口初始化顺序：

1. `setToday()`
2. `fillGoalsForm()`
3. `createSupabaseClient()`
4. `restoreCloudSession()`
5. `renderAll()`

任何记录或目标变更后，最终都应回到 `renderAll()` 这一统一刷新路径。
