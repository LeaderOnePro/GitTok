document.addEventListener('DOMContentLoaded', () => {
    const feedContainer = document.querySelector('.gittok-feed');
    const trendingApiUrl = 'http://localhost:3000/api/trending'; // 本地后端代理 API

    async function fetchTrendingRepos() {
        // 清除初始消息
        feedContainer.innerHTML = '<div class="gittok-item loading"><p>正在加载 GitHub Trending 项目...</p></div>';

        try {
            const response = await fetch(trendingApiUrl);
            if (!response.ok) {
                throw new Error(`HTTP 错误! 状态: ${response.status}`);
            }
            const repos = await response.json();

            // 清除加载指示器
            feedContainer.innerHTML = '';

            if (repos && repos.length > 0) {
                repos.forEach(repo => {
                    const item = createRepoElement(repo);
                    feedContainer.appendChild(item);
                });
            } else {
                feedContainer.innerHTML = '<div class="gittok-item"><p>未能加载 Trending 项目，或者今天没有项目。</p></div>';
            }

        } catch (error) {
            console.error('获取 GitHub Trending 数据时出错:', error);
            feedContainer.innerHTML = `<div class="gittok-item"><p>加载 GitHub Trending 数据失败: ${error.message}</p><p>无法连接到本地后端代理: ${trendingApiUrl}</p><p>请确保后端服务器正在运行，并检查控制台输出。</p></div>`;
        }
    }

    function createRepoElement(repo) {
        const div = document.createElement('div');
        div.classList.add('gittok-item');

        // 项目名称和链接
        const title = document.createElement('h2');
        const link = document.createElement('a');
        link.href = repo.url;
        link.textContent = repo.name;
        link.target = '_blank'; // 在新标签页打开
        title.appendChild(link);
        div.appendChild(title);

        // 作者
        const author = document.createElement('p');
        author.textContent = `作者: ${repo.author}`;
        div.appendChild(author);

        // 描述
        if (repo.description) {
            const description = document.createElement('p');
            description.textContent = repo.description;
            div.appendChild(description);
        }

        // 语言和星星
        const stats = document.createElement('p');
        let statsText = '';
        if (repo.language) {
            statsText += `语言: ${repo.language} | `;
        }
        statsText += `⭐ ${repo.stars} | Forks: ${repo.forks}`;
        stats.textContent = statsText;
        div.appendChild(stats);

         // 今日星星
         const todayStars = document.createElement('p');
         todayStars.textContent = `今日 Star: ${repo.currentPeriodStars}`;
         todayStars.style.fontWeight = 'bold'; // 突出显示
         div.appendChild(todayStars);


        return div;
    }

    // 页面加载时获取数据
    fetchTrendingRepos();
});