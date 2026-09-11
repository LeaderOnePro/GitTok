# GitTok 🚀

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**像刷 TikTok 一样浏览 GitHub Trending！**

全屏、沉浸式地浏览 GitHub 热门项目：每张卡片聚焦一个仓库，配 AI 中文一句话总结、语言、Star/Fork 与周期增星数。垂直滚动切换，键盘 ↑/↓ / j / k 也能翻。

![GitTok Screenshot](screenshot.png)

## ✨ 特性

- **TikTok 风格全屏卡片**：垂直滚动浏览，每个仓库一张卡片，作者头像作为模糊背景。
- **AI 中文总结**：基于仓库 README 的一句话总结，懒加载 + 边缘缓存，快速了解项目核心。
- **时间范围**：今日 / 本周 / 本月 Trending，周期 Star 数随之切换。
- **分享**：Web Share API（不支持时回退到复制链接）。
- **键盘导航**：↑/↓ 或 j/k 翻页，滚动进度指示。
- **DeepWiki / Zread 集成**：卡片上直达该仓库的 AI 文档与深度分析。

## 🛠️ 技术栈

- **前端**：HTML / CSS / JavaScript，无框架；卡片渲染、懒加载观察器、键盘导航与分享。
- **后端**：Vercel Serverless Functions（Node 22，内置 `fetch` + `cheerio`）
  - `/api/trending` — 抓取并解析 GitHub Trending 页面；解析为 0 条时返回 502（熔断，页面结构变更可被日志立即发现）；成功响应带 1h CDN 缓存（仅合法 `since`）。
  - `/api/summarize` — 抓取 README（`raw.githubusercontent.com` 快路径 + GitHub API `readme` 端点回退）→ 调 OrcaRouter 生成中文一句话总结；成功缓存 1 天 + 7 天 stale，上游失败返回 502 并透传具体原因。
- **AI 网关**：[OrcaRouter](https://www.orcarouter.ai)（OpenAI 兼容）。
- **部署**：[Vercel](https://vercel.com)，静态资源 + `api/` 目录自动识别。

## 🔧 环境变量

| 变量 | 必填 | 说明 |
| --- | :-: | --- |
| `ORCAROUTER_API_KEY` | ✅ | `sk-orca-...`，未配置时 AI 总结显示「未配置」。 |
| `SUMMARY_MODEL` | ❌ | 覆盖默认模型 `orcarouter/free`；改 Vercel 环境变量即可生效，无需发版。 |
| `GITHUB_TOKEN` / `GH_TOKEN` | ❌ | README 抓取回退到 GitHub API 时使用；配置后配额 60/h → 5000/h，否则匿名 60/h（回退只触发于快路径 miss 的少数仓库，不配也够用）。 |

## 🚀 本地运行

```bash
git clone https://github.com/LeaderOnePro/GitTok.git
cd GitTok
npm install -g vercel   # 仅本地开发需要
npm install
vercel dev              # 前端 + Serverless Functions
```

访问 `http://localhost:3000`。

> 只想看前端界面（不跑 API）时，直接打开根目录 `index.html` 即可。

## 📦 部署

1. 代码推送到 GitHub。
2. 在 Vercel 导入该仓库，静态资源与 `api/` 会被自动识别并部署。
3. 在 Vercel 项目环境变量中配置上表中的 `ORCAROUTER_API_KEY`（以及可选的 `SUMMARY_MODEL`、`GITHUB_TOKEN`）。

## 🤝 贡献

欢迎提 Issue 或 Pull Request：想法、建议、Bug 都可以。

## 📄 许可证

[MIT](LICENSE)。
