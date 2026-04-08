# haodown

类似自动化获取社交媒体下载链接的统一提取工具，基于 Next.js App Router 构建，可直接部署到 Vercel。

## 当前能力

- `POST /api/extract`
- `GET /api/platforms`
- Supabase Auth 登录 / 注册
- 首页登录态展示专属 token
- 游客模式最多解析 5 条

## 环境变量

复制 [.env.example](/Volumes/Data/CodexProjects/VideoDl/.env.example) 到 `.env.local`：

```bash
cp .env.example .env.local
```

然后填入：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

如果暂时不填 Supabase，提取功能仍然可以跑，但登录、token 和数据库记录会自动降级关闭。

## Supabase SQL

在 Supabase SQL Editor 里执行：

- [supabase/migrations/20260408_auth_and_usage.sql](/Volumes/Data/CodexProjects/VideoDl/supabase/migrations/20260408_auth_and_usage.sql)

这会创建：

- `profiles`
- `request_logs`
- 注册后自动补 profile 的 trigger
- `api_token` 生成函数
- 基础 RLS policy

## Auth 流程

- 首页未登录时显示游客额度和登录 / 注册入口
- `/auth` 提供邮箱密码登录 / 注册
- 登录后首页展示当前账号邮箱、token 和累计请求数
- Stripe 次数包字段已经在 `profiles` 表里预留，但还没接支付

## Request

```json
{
  "text": "分享文案、短链或长链",
  "options": {
    "preferUnwatermarked": true,
    "preferHighestQuality": true
  }
}
```

## Development

```bash
npm install
npm run dev
```

## Tests

```bash
npm test
```

Optional live tests:

```bash
LIVE_TOUTIAO_TESTS=1 npm test
```
