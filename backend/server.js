// backend/server.js
import express from 'express';
import fetch from 'node-fetch'; // 使用 node-fetch v3+ 需要 import
import * as cheerio from 'cheerio'; // 使用 cheerio v1+ 需要 import * as

const app = express();
const port = 3000; // 服务器监听的端口

// 允许跨域请求 (CORS) - 简单设置，允许所有来源
// 在生产环境中，应配置更严格的 CORS 策略
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); // 允许任何来源
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// API 端点，用于获取 Trending 数据
app.get('/api/trending', async (req, res) => {
    const trendingUrl = 'https://github.com/trending'; // GitHub Trending 页面 URL

    try {
        console.log(`Fetching data from ${trendingUrl}...`);
        const response = await fetch(trendingUrl, {
            headers: {
                // 模拟浏览器请求头，有时有助于避免被阻止
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch GitHub Trending page. Status: ${response.status}`);
        }

        const html = await response.text();
        console.log('Successfully fetched HTML.');

        const $ = cheerio.load(html);
        const repos = [];

        // GitHub Trending 页面的 HTML 结构可能会变化，这里的选择器需要根据实际情况调整
        $('article.Box-row').each((index, element) => {
            const repoElement = $(element);

            // 提取仓库名称和链接
            const titleElement = repoElement.find('h2 > a');
            // Corrected regex to handle spaces between author and repo name
            const repoPath = titleElement.attr('href').trim();
            const pathParts = repoPath.split('/').filter(part => part.length > 0); // Filter empty parts
            const author = pathParts[0];
            const name = pathParts[1];
            const url = `https://github.com${repoPath}`;


            // 提取描述
            const descriptionElement = repoElement.find('p.col-9');
            const description = descriptionElement.text().trim();

            // 提取语言
            const langElement = repoElement.find('span[itemprop="programmingLanguage"]');
            const language = langElement.text().trim();

            // 提取星星总数
            const starsElement = repoElement.find('a[href$="/stargazers"]');
            const stars = parseInt(starsElement.text().trim().replace(/,/g, ''), 10) || 0;

            // 提取 Forks 总数
            const forksElement = repoElement.find('a[href$="/forks"]');
            const forks = parseInt(forksElement.text().trim().replace(/,/g, ''), 10) || 0;

            // 提取今日星星数
            const todayStarsElement = repoElement.find('span.d-inline-block.float-sm-right');
            const todayStarsText = todayStarsElement.text().trim();
            const todayStarsMatch = todayStarsText.match(/([\d,]+)\s+stars today/);
            const currentPeriodStars = todayStarsMatch ? parseInt(todayStarsMatch[1].replace(/,/g, ''), 10) : 0;


            if (name && url && author) { // 确保提取到基本信息
                 repos.push({
                    author: author,
                    name: name,
                    avatar: `https://github.com/${author}.png`, // 尝试获取头像
                    url: url,
                    description: description,
                    language: language,
                    languageColor: langElement.prev('.repo-language-color').css('background-color'), // 尝试获取语言颜色
                    stars: stars,
                    forks: forks,
                    currentPeriodStars: currentPeriodStars,
                    // builtBy: [] // 贡献者信息较难从此页面提取
                });
            }
        });

        console.log(`Parsed ${repos.length} repositories.`);
        res.json(repos); // 发送 JSON 响应

    } catch (error) {
        console.error('Error fetching or parsing GitHub Trending:', error);
        res.status(500).json({ error: 'Failed to fetch or parse GitHub Trending data.', details: error.message });
    }
});

// 启动服务器
app.listen(port, () => {
    console.log(`GitTok backend server listening at http://localhost:${port}`);
});