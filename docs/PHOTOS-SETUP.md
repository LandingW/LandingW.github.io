# 旅行影集：一次性接入清单

目标：原片试用额度 2,000,000,000 bytes；GitHub Pages 保留；新增照片不重新构建网站。

## 当前接入进度 · 2026-10-10

Cloudflare 授权已验证，账号 `63632d123ea631486d010392e5c17819`：

- 已创建 `landingw-photo-originals` 与 `landingw-photo-public`，Standard 存储，APAC 位置提示；原片桶公开访问关闭。
- 已创建 D1 `landingw-photos` 并应用数据库迁移，当前没有旅行或照片记录。
- 已设置两桶的 CORS；原片桶保留默认的 7 天终止未完成分片上传规则，不会自动删除已完成原片。
- Worker 已部署：`https://landingw-photos.landingw-homepage.workers.dev`。
- 试用展示地址：`https://pub-bf2df0b0406a43158f4287ca834603c7.r2.dev`。它是开发用途地址，不能当作正式自有域名 CDN 的性能保证。
- 已确认 Cloudflare 的 5 项应用 Secrets 与 GitHub 的 5 项 Actions Secrets 齐全，未读取或回显其值。旅行页、管理页已上线；独立图片工作流通过真实云端合成图验证。没有上传个人照片，未升级付费计划。

## 日常入口

- 旅行页：<https://landingw.github.io/travel/>
- 管理页：<https://landingw.github.io/travel/manage/>
- 输入自己设置的管理密码 → 创建旅行并确认公开地点 → 上传照片 → 点击“处理待办照片” → 等待“可以发布” → 发布当前旅行。
- 后续添加图片不需要改代码、Git 提交或重建网站。首次建议先试一张真实照片，再批量上传。
- 本次云端测试没有代替用户浏览器的真实分片上传、本人管理密码登录和手机手势验收；这些还需首次使用时核对。

## 一次性密钥配置（已完成；以后更换密钥时参考）

当前凭据已配置，不需要重复以下步骤。重跑会替换本影集的口令；日常上传直接使用 `/travel/manage/`。

### 1. R2 上传凭据

Cloudflare 控制台 → R2 Object Storage → Manage R2 API Tokens → Create API token。

- 权限选 **Object Read & Write**。
- 只授权 `landingw-photo-originals` 和 `landingw-photo-public` 两个桶，不选所有桶或 Admin。
- 保存生成的 **Access Key ID** 与 **Secret Access Key** 到密码管理器。不要把账号 ID、S3 地址或普通 API token 当成这两个值。

### 2. GitHub 处理调度凭据

进入 [创建 fine-grained token](https://github.com/settings/personal-access-tokens/new)：

- Resource owner：`LandingW`。
- Repository access：只选 `LandingW.github.io`。
- Repository permissions：**Actions → Read and write**；Metadata 自动只读即可。
- 设置合理的到期时间。过期后新照片处理会停止，需要更新此 token；已发布图片不受影响。
- 保存这个 token，不要发到聊天。不使用 classic token，不需要授予 Contents 写权限。

### 3. 运行一次安全配置

自己设置并保存一个至少 **12 个字符**的相册管理密码，不含空格；不强制使用密码管理器生成，也不要复用密码管理器主密码、GitHub 或 Cloudflare 登录密码。然后在自己的 PowerShell 运行：

```powershell
Set-Location -LiteralPath "C:\Users\ruomiao.wang\Desktop\LandingW.github.io"
npm.cmd run photos:configure
```

程序会依次询问 R2 Access Key ID、R2 Secret Access Key、GitHub fine-grained token、管理口令。输入不回显，也不会把值写到文件、日志或代码。

程序会验证 R2 桶访问，将本影集的 5 个 Worker Secrets 和 5 个 GitHub Actions Secrets 配好；自动生成单独的机器处理口令并写到两边。其他 Secrets 不改动。

它使用本机已有的 LandingW Git 登录将密封加密后的 Secrets 写入 GitHub；这份 Git 登录凭据只发给 GitHub，**不复制到 Cloudflare**。Cloudflare 收到的只是你新建的、仅此仓库 Actions 读写的调度 token。

如果中途失败，部分 Secrets 可能已写入。排除问题后可重新运行；重跑会替换本影集口令，请先停止正在运行的图片处理任务。

成功后只回复助手“密钥配置完成”，再提供 2–3 张样片的本地路径。不要发送凭据或包含凭据的截图。提供路径先用于本地检查，不代表自动公开。

## 首次开通步骤（已完成，仅作记录）

1. 登录 [Cloudflare](https://dash.cloudflare.com/)，开通 R2。保持 **Standard 存储 / Workers Free**，不要购买 Workers Paid、Images 或 Containers。R2 开通可能要求绑定支付方式；免费额度不是消费硬上限，请在账单页开启可用的用量/费用提醒。
2. 在本仓库目录运行 `npx.cmd wrangler login`，在浏览器完成 Cloudflare 授权。不要把账号密码或授权内容发到聊天。
3. 准备 2–3 张代表性照片，告诉助手本地路径。第一版支持静态 JPEG、PNG、WebP，单张不超过 64MiB、2 亿像素；RAW、HEIC 暂不直接处理，请先导出 JPEG。提供路径只用于本地检查，不代表自动公开照片。

存储桶、数据库、跨域和部署配置由助手在你确认账号准备好后继续处理。下面是完整的接入记录，供复核，不需要你自己改代码。

## 服务职责

- `landingw-photo-originals`：私有原片。禁止启用公共域名或 r2.dev。
- `landingw-photo-public`：公开缩略图、预览图、DZI 切片与 `manifest.json`，不保存原文件、上传记录、密钥。
- `landingw-photos` D1：旅行、照片状态、上传额度预留、任务租约。只保存少量元数据，需纳入 D1 免费额度监控。
- `landingw-photos` Worker：鉴权、分片上传授权、处理任务调度与发布。前端不持有 R2/GitHub 密钥。
- `Process Travel Photos` Actions：标准 Linux runner，按需调用 Sharp 内置 libvips；不构建 Pages、不提交文件、不上传图片 artifacts。

管理口令只保留在页面内存中。续传信息在当前标签页的 sessionStorage 中保存文件指纹、照片 ID 和 ETag，不保存口令或签名 URL；刷新需重新登录并选择同一文件。关闭标签页或更换设备不承诺自动恢复。

## 创建资源（账号开通之后）

以下命令在仓库目录执行，Windows 用 `npx.cmd`。本次资源已经创建，不需要再次运行这些创建命令。

```powershell
npx.cmd wrangler r2 bucket create landingw-photo-originals
npx.cmd wrangler r2 bucket create landingw-photo-public
npx.cmd wrangler d1 create landingw-photos
```

数据库 ID、`R2_ACCOUNT_ID` 与 `PUBLIC_MEDIA_URL` 已填入 `workers/photos/wrangler.jsonc`。

```powershell
npx.cmd wrangler d1 migrations apply landingw-photos --remote --config workers/photos/wrangler.jsonc
npx.cmd wrangler r2 bucket cors set landingw-photo-originals --file workers/photos/cors-originals.json
npx.cmd wrangler r2 bucket cors set landingw-photo-public --file workers/photos/cors-public.json
```

原片桶 CORS 必须允许上传页来源的 PUT，并暴露 `ETag`。展示桶允许同来源的 GET/HEAD。正式域名变化时需要同步修改 CORS 与 Worker 的 `ALLOWED_ORIGINS`。上线后可移除 localhost 来源。

已确认默认 multipart upload 生命周期规则会在 7 天后终止未完成上传。数据库里遗留的上传额度可在管理页“取消未完成上传”释放。

## 图片域名

R2 正式公共分发建议绑定自有域名，例如 `photos.example.com`；该域名需要在 Cloudflare 中管理。把它写入 `PUBLIC_MEDIA_URL`。没有域名时可先对展示桶使用 r2.dev 做小范围开发验证，但其速率限制与缓存能力不等于正式 CDN。

对带版本的 `photos/*` 使用长缓存；`manifest.json` 保持 60 秒缓存，不应被“缓存一切”规则覆盖为长缓存。不要公开原片桶。

## 凭据：只填到各服务的安全输入框

相册管理密码由你自己设置，至少 12 个字符；后台处理口令由安全配置命令自动生成 64 位随机值，不需要你设置或记忆。两者不能复用。同一来源连续 5 次认证失败后，暂时限制登录，窗口为 15 分钟；成功认证会清除此前失败计数。

在 Cloudflare 的 R2 API token 页面创建 **Object Read & Write** 凭据，只授权上面两个桶；保存 `Access Key ID` 和 `Secret Access Key`。不要使用能管理所有桶的管理员 token。

在 GitHub 创建 fine-grained token，只选择 `LandingW/LandingW.github.io`，授予 **Actions: Read and write**。它用于触发 `photos.yml`，不需要 Contents 写权限。不要把已有的通用 Git 登录凭据复制到 Worker。

Worker Secrets：通过 Cloudflare 控制台或 `npx.cmd wrangler secret put NAME --config workers/photos/wrangler.jsonc` 的安全提示输入。

| Worker Secret          | 内容                                           |
| ---------------------- | ---------------------------------------------- |
| `ADMIN_TOKEN`          | 仅自己使用的管理口令                           |
| `PROCESSOR_TOKEN`      | 后台处理口令，与管理口令不同                   |
| `R2_ACCESS_KEY_ID`     | 指定两桶的 Access Key ID                       |
| `R2_SECRET_ACCESS_KEY` | 对应 Secret Access Key                         |
| `GITHUB_TOKEN`         | 只允许此仓库 Actions 调度的 fine-grained token |

GitHub 仓库 **Settings → Secrets and variables → Actions**：

| GitHub Secret           | 内容                                   |
| ----------------------- | -------------------------------------- |
| `PHOTO_WORKER_URL`      | 部署后 Worker HTTPS 地址，不带尾部斜杠 |
| `PHOTO_PROCESSOR_TOKEN` | 与 Worker `PROCESSOR_TOKEN` 相同       |
| `R2_ACCOUNT_ID`         | Cloudflare 账号 ID                     |
| `R2_ACCESS_KEY_ID`      | 指定两桶的 Access Key ID               |
| `R2_SECRET_ACCESS_KEY`  | 对应 Secret Access Key                 |

密钥不要发给助手、写入 `travel-config.json`、提交到 Git，或放到浏览器 URL。`.dev.vars` 和 `.wrangler` 已忽略。

## 部署与首次验证

1. 部署 Worker：`npm.cmd run photos:deploy`。
2. `public/travel-config.json` 只填写公开的 `apiUrl` 与 `mediaUrl`，不填任何密钥。
3. 在确认后提交、推送一次代码，发布旅行页和 `photos.yml`；工作流必须存在于默认分支，Worker 才能触发它。
4. 打开 `/travel/manage/`，输入管理口令，创建一条测试旅行，上传测试照片。
5. 点击“处理待办照片”，观察 Actions 和管理页状态；原片不会出现在仓库或公开任务 artifacts。
6. 状态变为“可以发布”后，确认地点和照片，再点“发布当前旅行”。公开页面约 60 秒内刷新清单，无需再次部署。
7. 实测桌面缩放、iOS/Android 双指缩放、弱网、过期签名重试和私有原片不可匿名访问。没有完成这些云端检查前，不称为生产可用。

## 日常使用与边界

- 管理页批量上传；每张按 8MiB 分片，失败最多自动重试两次。先上传，后台处理好后再明确发布。
- 照片处理时自动读取 EXIF：机身、镜头、焦距、光圈、快门、ISO、拍摄时间及 GPS。只有文件实际包含的字段才显示，缺失 GPS 不猜测；拍摄时间缺失时区时标为相机时间。
- 按所有者明确选择，已发布照片默认公开精确 GPS；旅行地图优先用照片 GPS，原有手动旅行参考点仍保留作后备。单张可在管理页“拍摄信息”中隐藏 GPS；这不自动删除单独设置的旅行参考点。
- 旧照片可点击“重新读取 EXIF”，只读原文件和更新信息，不重新生成预览与切片。新照片生成切片后自动提取；普通处理任务也会处理 EXIF 补读队列。
- 地图直接按 GPS 定位，不自动反查地名，不需要新增地图密钥。地点搜索仍可打开 OpenStreetMap；世界概览使用随网站打包的 Natural Earth 数据。
- 详情地图仅在用户点开时请求 OSM 官方瓦片，保留署名、不批量预取、不支持离线下载。它适合小规模试用，不是有 SLA 的商业地图服务；流量增长时应换有配额的服务。
- 展示图转 sRGB，去掉 EXIF/GPS，并移除 libvips 的 `vips-properties.xml` 诊断侧文件；原文件不改动。
- “草稿”指不进入网站的公开相册清单。处理后的展示文件已经在公开桶中，路径使用随机照片 ID 和版本 ID；知道完整直链的人仍可能访问。它不是机密文件库；真正需要保密的照片不要上传到这套展示流程。原文件与管理数据始终在私有桶/数据库中。
- 从列表撤下不代表删除：已公开的切片直链、浏览器和 CDN 缓存仍可能可用。需要彻底撤回时，应另外删除展示对象并处理 CDN 缓存。高清切片可被重组，不能承诺防下载。
- 2GB 是原片预留额度，不包括切片与预览，也不是 Cloudflare 全账号费用上限。失败后的少量孤立切片可能需要清理；不自动删除原文件。
- `npm.cmd run photos:sample -- "绝对照片路径"` 可仅在本机试切，输出到 Git 忽略的 `photo-output/`，不访问云端。
- 尚未做跨设备上传接续、照片排序/单独封面选择、自动地名反查和 RAW 显影。默认按上传顺序展示，第一张作为初始封面素材。

## 费用范围

目标是 R2 Standard、Worker、D1 免费额度内试用；Actions 依赖公开仓库的标准 runner 免费规则，不使用 larger runner。不使用收费 Containers。
域名、超出免费额度的用量、其他账号资源和第三方地图服务不包含在“图片试用约零月费”估算中。
