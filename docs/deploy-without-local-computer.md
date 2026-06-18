# 不依赖本机开机的公网部署

临时隧道只能在这台电脑开机时访问。要做到电脑关机后别人也能打开，需要把项目部署到云端。

推荐路线：Render Web Service + Docker。

## 为什么选 Render

- 不需要 Vercel 账号。
- 可以直接连接 GitHub fork。
- 仓库已包含 `Dockerfile` 和 `render.yaml`。
- 云端会持续运行 Next.js 服务，电脑关机不影响访问。

免费实例可能会休眠，别人访问时会有冷启动等待。想长期稳定秒开，需要选择付费实例或自己的服务器。

## 部署步骤

1. 打开 Render 新建服务页面：

```text
https://dashboard.render.com/new/web
```

2. 连接 GitHub，选择仓库：

```text
liyang040629-dot/ziwei-doushu
```

3. 选择 Docker 部署。Render 会读取仓库里的 `Dockerfile`。

4. 环境变量填写：

```env
AI_PROVIDER=mimo
MIMO_API_KEY=你的_mino_key
MIMO_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
MIMO_MODEL=你接入Claude的模型名
MIMO_API_FORMAT=openai
NEXT_PUBLIC_SITE_URL=https://Render给你的域名
```

5. 部署完成后，Render 会给出公网地址，例如：

```text
https://ziwei-doushu.onrender.com
```

这个地址别人可以直接打开，且不依赖你的电脑是否开机。

## 部署后验证

在任意网络环境访问 Render 给出的地址。首页能打开后，再测试：

- 单盘排盘页面
- AI 解读接口
- `/heming` 合盘页面

如果页面能打开但 AI 解读失败，优先检查 `MIMO_API_KEY`、`MIMO_BASE_URL`、`MIMO_MODEL`、`MIMO_API_FORMAT` 是否正确。

## 其他可选路线

- Windows Server + Caddy + PM2：最稳定，但需要你有服务器。
- Railway/Fly.io：也可以用同一个 Dockerfile 部署。
- GitHub Pages：不适合当前项目，因为 AI 解读需要后端 API。
