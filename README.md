# GitTok 🚀

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**像刷 TikTok 一样浏览 GitHub Trending！**

GitTok 提供了一种全新的、沉浸式的方式来浏览 GitHub 上的热门项目。厌倦了传统的列表视图？试试 GitTok，享受全屏、自动播放（未来功能）的 GitHub Trending 体验！

![GitTok Screenshot](screenshot.png)  <!-- 稍后可以替换为真实的截图 -->

## ✨ 特性

*   **TikTok 风格界面**: 全屏、垂直滚动浏览 GitHub Trending 项目。
*   **沉浸式体验**: 每个项目卡片都包含关键信息和作者头像背景。
*   **毛玻璃效果**: 现代化的视觉效果，突出项目信息。
*   **分享功能**: 轻松将 GitTok 项目分享给朋友或同事。
*   **本地后端代理**: 稳定可靠地获取 GitHub Trending 数据。

## 🛠️ 技术栈

*   **前端**: HTML, CSS, JavaScript (无框架)
*   **后端 (代理)**: Node.js, Express, Cheerio (用于抓取), node-fetch
*   **数据源**: GitHub Trending 页面 (通过后端代理抓取)

## 🚀 如何运行

1.  **克隆仓库**:
    ```bash
    git clone https://github.com/LeaderOnePro/GitTok.git
    cd GitTok
    ```

2.  **设置后端代理**:
    ```bash
    cd backend
    npm install  # 安装后端依赖
    node server.js # 启动后端代理服务器 (需要保持运行)
    ```
    服务器将监听在 `http://localhost:3000`。

3.  **打开前端**:
    在你的浏览器中直接打开项目根目录下的 `index.html` 文件。

    *确保后端服务器正在运行，否则前端无法加载数据。*

## 📝 未来计划

*   [ ] **自动播放/滚动**: 实现更接近 TikTok 的自动滚动体验。
*   [ ] **筛选器**: 按语言、日期范围等筛选 Trending 项目。
*   [ ] **用户偏好设置**: 保存用户喜欢的语言或主题。
*   [ ] **更丰富的项目信息**: 尝试提取贡献者、更详细的活动数据等。
*   [ ] **部署**: 将应用部署到网络上，方便公开访问。
*   [ ] **PWA 支持**: 使其成为可安装的渐进式 Web 应用。

## 🤝 贡献

欢迎各种形式的贡献！如果你有任何想法、建议或发现 Bug，请随时提出 Issue 或提交 Pull Request。

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)。
