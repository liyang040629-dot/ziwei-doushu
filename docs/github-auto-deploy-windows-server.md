# GitHub Actions 自动部署到 Windows Server，并允许别人访问

这套部署用于 Windows Server。为了避免和 Vercel 公网部署互相干扰，默认只支持在 GitHub Actions 页面手动触发：

1. GitHub Actions 先运行 `npm ci` 和 `npm run build`。
2. 构建通过后，通过 SSH 登录 Windows Server。
3. 服务器拉取 GitHub 最新代码。
4. 服务器运行 `npm ci`、`npm run build`。
5. 使用 PM2 重启 `ziwei-doushu`。
6. 如果配置了 `PUBLIC_SITE_URL`，GitHub Actions 会从公网访问域名，确认别人也能打开。

## 服务器准备

在 Windows Server 上安装：

- Node.js LTS
- Git
- PM2：`npm install -g pm2`
- Caddy
- OpenSSH Server，并允许 GitHub Actions 使用 SSH 登录

开放防火墙端口：

- `22`：SSH，或你自定义的 SSH 端口
- `80`、`443`：Caddy 域名访问

## 首次服务器配置

创建部署目录和生产环境变量。首次部署时，目录里可以只有 `.env.local`，部署脚本会保留它并自动克隆代码：

```powershell
New-Item -ItemType Directory -Force C:\apps\ziwei-doushu
```

在 `C:\apps\ziwei-doushu\.env.local` 写入：

```env
AI_PROVIDER=mimo
MIMO_API_KEY=你的_mino_key
MIMO_BASE_URL=https://你的-mino地址/v1
MIMO_MODEL=你接入Claude的模型名
NEXT_PUBLIC_SITE_URL=https://你的域名
```

## GitHub Secrets

在 GitHub 仓库设置里进入 `Settings -> Secrets and variables -> Actions`，添加：

| Secret | 示例 | 说明 |
| --- | --- | --- |
| `WINDOWS_HOST` | `1.2.3.4` | Windows Server 公网 IP 或域名 |
| `WINDOWS_USER` | `deploy` | 可 SSH 登录服务器的用户 |
| `WINDOWS_SSH_KEY` | 私钥全文 | 对应服务器 `authorized_keys` 的私钥 |
| `WINDOWS_SSH_PORT` | `22` | 可选，不填默认 `22` |
| `WINDOWS_DEPLOY_PATH` | `C:\apps\ziwei-doushu` | 可选，不填使用此默认路径 |
| `PUBLIC_SITE_URL` | `https://your-domain.com` | 推荐填写，用来验证公网访问 |

## Caddy 配置

可以手动把 `deployment/Caddyfile.example` 复制为服务器上的 Caddyfile，并改成你的域名：

```caddyfile
your-domain.com {
  reverse_proxy 127.0.0.1:3000
}
```

确认域名 DNS 的 `A` 记录已经指向服务器公网 IP，然后启动或重载 Caddy。

也可以在服务器上运行脚本生成 Caddyfile 并打开 Windows 防火墙的 80/443 端口：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-public-access-windows.ps1 -Domain your-domain.com
```

公网能被别人打开，需要同时满足：

- 域名 DNS 的 `A` 记录指向 Windows Server 公网 IP。
- 云服务器安全组放行 `80` 和 `443`。
- Windows 防火墙放行 `80` 和 `443`。
- Caddy 正在运行，并反向代理到 `127.0.0.1:3000`。
- PM2 中 `ziwei-doushu` 为 `online`。

## 自动部署

推送到 `main` 后，GitHub Actions 会自动部署。

也可以在 GitHub 页面进入 `Actions -> Deploy to Windows Server -> Run workflow` 手动触发。

## 验证

服务器本机：

```powershell
pm2 list
Invoke-WebRequest http://127.0.0.1:3000
```

浏览器访问：

```text
https://你的域名
```

或在任意不在服务器内网的电脑上运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\check-public-access.ps1 -Url https://你的域名
```

如果 AI 解读失败，优先检查服务器上的 `.env.local`，尤其是 `MIMO_BASE_URL` 是否以 `/v1` 结尾，以及 `MIMO_MODEL` 是否和 Mino 中暴露的 Claude 模型名一致。
