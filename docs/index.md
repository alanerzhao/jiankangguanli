# Docs Index

这个目录是健康管理工具的结构化知识库，不是长篇手册。

## 文档导航

- `product-spec.md`
  说明产品目标、核心用户路径和非目标。
- `architecture.md`
  说明静态站点、数据流、本地存储和 Supabase 同步的边界。
- `acceptance.md`
  定义当前版本必须满足的行为验收标准。
- `operations.md`
  记录本地预览、云同步初始化、发布和回滚流程。
- `tech-debt.md`
  跟踪还未解决但已知的重要缺口。
- `harness-engineering-practice.md`
  记录这次从回滚、补文档、接检查到加入 Playwright 的完整实践。
- `harness-engineering-article.md`
  一篇面向他人的说明文章，解释什么是 harness engineering，以及它和 spec coding 的关系。

## 推荐阅读顺序

1. 产品目标
2. 验收标准
3. 架构边界
4. 运维流程

## 变更原则

- 先改文档，再改代码。
- 复杂需求优先补到 `acceptance.md`，让目标可验证。
- 新增隐性约束时，更新 `AGENTS.md` 或对应专题文档，不要只留在聊天记录里。
