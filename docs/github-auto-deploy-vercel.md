# GitHub Actions 自动部署到 Vercel，并允许别人访问

这是最省心的公网部署方式：推送到 GitHub 后，GitHub Actions 会部署到 Vercel。Vercel 会提供公网 HTTPS 地址，别人可以直接访问。

## 准备 Vercel 项目

1. 登录 Vercel。
2. 新建项目并导入这个 GitHub 仓库。
3. 在 Vercel 项目环境变量中填写：

```env
AI_PROVIDER=mimo
MIMO_API_KEY=你的_mino_key
MIMO_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
MIMO_MODEL=你接入Claude的模型名
MIMO_API_FORMAT=openai
NEXT_PUBLIC_SITE_URL=https://你的-vercel域名或自定义域名
```

## GitHub Secrets

在 GitHub 仓库设置里进入 `Settings -> Secrets and variables -> Actions`，添加：

| Secret | 说明 |
| --- | --- |
| `VERCEL_TOKEN` | Vercel 账号令牌 |
| `VERCEL_ORG_ID` | Vercel 团队或个人 ID |
| `VERCEL_PROJECT_ID` | Vercel 项目 ID |
| `PUBLIC_SITE_URL` | 推荐填写，公网访问地址，例如 `https://your-domain.com` |

`VERCEL_ORG_ID` 和 `VERCEL_PROJECT_ID` 可以在本地执行 `vercel link` 后，从 `.vercel/project.json` 里查看；不要把 `.vercel/project.json` 提交到仓库。

## 自动部署

推送到 `main` 后，`Deploy to Vercel` 工作流会执行：

1. 安装依赖。
2. 拉取 Vercel 项目设置。
3. 构建生产输出。
4. 部署到 Vercel。
5. 从 GitHub Actions 外网环境访问 `PUBLIC_SITE_URL`，确认别人也能打开。

如果没有填写 `PUBLIC_SITE_URL`，工作流会检查 Vercel 本次部署返回的公网地址。

## 自定义域名

如果使用自定义域名：

1. 在 Vercel 项目里添加域名。
2. 按 Vercel 提示配置 DNS。
3. 把 GitHub Secret `PUBLIC_SITE_URL` 设置为你的正式域名。

这样每次自动部署后，GitHub Actions 会检查正式域名，而不是只检查临时部署地址。
