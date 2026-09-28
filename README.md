# landingw的主页

Next.js 16 / React 19 / TypeScript，静态导出到 GitHub Pages。
瑞士海报式排版、经典图形学装饰、响应式经历与文章阅读页。
不依赖外部字体服务或图床封面。茶壶使用按需加载的 WebGL 渲染，页面正文与文章阅读不依赖 WebGL，无法初始化时使用同一模型的静态预览。
访问 `/?graphics=static` 可主动使用静态图，不加载 3D 渲染模块。文章阅读页不加载茶壶模块。

首页启动时，只有大标题的各个字母以独立节奏短暂点亮。主页文字通过多尺度程序噪声驱动的字形位移和颗粒遮罩逐步还原，不使用高斯模糊，也不运行扩散模型。茶壶只做光源从暗到亮，不添加噪声或闪烁。约 2.6 秒后全部稳定，恢复按需渲染；交互和“减少动态效果”偏好可跳过演出。

置顶文章自动选择最新发布时间；工作历史显示公司图标和公开技术职责。联系方式在 `src/lib/resume.ts` 中集中维护，QQ / 微信支持点击复制。

THINK IN PIXELS 首屏背景轮流绘制递归分枝、Sierpiński 三角形、Koch 雪花和 Heighway 龙曲线。每种为 2 秒生长、1 秒保持、2 秒消退，四种一轮约 20 秒；离屏和后台暂停，静态模式或减少动态效果偏好下显示静态图。算法、顺序与时长集中在 `src/lib/fractal-growth.ts`，播放控制位于 `src/components/GrowingFractal.tsx`。

## 本地运行

需要 Node.js 22.12+（建议 Node 24）和 npm。知乎同步另需 Python 3.12+。

```sh
npm ci
npm run dev
```

构建和检查：

```sh
npm run lint
npm test
npm run build
npm run preview
```

静态预览默认地址为 `http://127.0.0.1:3000`，也可以用 `PORT` 环境变量指定端口。
`npm start` 同样预览 `out/`，因此需要先构建；不使用与静态导出不兼容的 `next start`。

## 内容入口

- `src/lib/resume.ts`：个人资料、工作经历、公开技术栈。不披露内部项目缩写、实现细节和性能指标。
- `src/app/globals.css`：统一的色彩、字体、版宽、间距和响应式规则。
- `src/components/TeapotStudy.tsx`：经典犹他茶壶，支持拖动、方向键、材质/线框切换；空闲时停止渲染，离屏/隐藏时暂停，尊重减弱动态效果设置。
- `src/components/FractalMark.tsx` 与 `SplineStudy.tsx`：递归三角形标识与 Catmull–Rom 管状曲面线稿。
- `scripts/generate-studies.mjs`：独立生成茶壶静态预览和 Cornell Box 光照图；运行 `npm run studies` 可重建，无需每次构建都运行。
- `data/articles.json`：知乎文章本地缓存，保留原始文章 ID 的字符串精度。
- `content/writing/*.md`：自有 Markdown 原稿，可以替换已有知乎摘要而不改变文章 URL。
- `src/lib/articles.ts`：统一读取、分类、HTML 白名单清洗及阅读时间计算。

## 文章发布与同步

推荐 **Markdown 原稿作为唯一内容来源，个人主页主发布，其他平台分发**。
这样不依赖 Cookie 和抓取服务。已有知乎文章可以使用授权 JSON 导出或有效的本人访问凭据同步。

支持：站内文章页、正文与摘要的明确区分、分类搜索、分批加载、RSS、sitemap、原文链接。
正文中的代码块、图片、公式图片、表格保留；脚本、iframe、事件属性、不安全链接被移除。
Markdown 中的 LaTeX 源码目前不自动排版为数学公式；可使用公式图片。

完整说明与样例见 [文章工作流](docs/CONTENT.md)。

### 可选的知乎同步

```sh
pip install -r requirements.txt
python scripts/scrape_zhihu.py
```

只访问配置作者的已发布文章。`ZHIHU_COOKIE` 如有设置，仅发送到知乎请求头，绝不能写进仓库。
知乎可能返回 403 或需要登录；脚本不会绕过验证。此时使用自己的导出，或直接维护 Markdown。
全文模式下遇到缺正文、分页中断、空结果、异常响应会失败退出，保留旧数据，不更新同步时间。
成功后按 ID 合并、原子写入，未变化时不制造新提交。不会因源列表缺一篇就删除站内存档；如需撤下文章，需手动删除对应条目和匹配的 Markdown 原稿。

同步脚本验证：

```sh
python -m unittest discover -s scripts -p "test_*.py"
```

## GitHub Pages

仓库 Settings → Pages → Source 使用 **GitHub Actions**。
推送 `main` 后自动检查、构建和部署；手动触发也支持。
已有每日北京时间 10:00 的知乎同步保留，并增加分页失败保护与成功后部署校验。
定时工作流只运行在默认分支；若使用分支保护，需按仓库权限策略允许自动同步提交，或改为 PR 审核流。

如需要 Cookie，请由仓库所有者在 Settings → Secrets and variables → Actions 设置 `ZHIHU_COOKIE`。
不需要在浏览器前端放 Cookie，不读取用户本机浏览器凭据。

发布通过上述 GitHub Actions 工作流完成。不要将 Cookie、Token 或其他凭据写入仓库；远程 Secrets 由仓库所有者管理。
