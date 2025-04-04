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
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('gittok-item');

        // 1. 背景图片 (使用作者头像)
        const bgImage = document.createElement('div');
        bgImage.classList.add('background-image');
        // 使用 GitHub 头像 URL，可以指定尺寸 ?s=400
        bgImage.style.backgroundImage = `url(${repo.avatar}?s=400)`;
        itemDiv.appendChild(bgImage);

        // 2. 毛玻璃效果覆盖层 (左右) - CSS 中实现效果
        const overlayLeft = document.createElement('div');
        overlayLeft.classList.add('overlay-left');
        itemDiv.appendChild(overlayLeft);

        const overlayRight = document.createElement('div');
        overlayRight.classList.add('overlay-right');
        itemDiv.appendChild(overlayRight);

        // 3. 内容区域容器
        const contentArea = document.createElement('div');
        contentArea.classList.add('content-area');
        itemDiv.appendChild(contentArea);

        // 4. 左下角信息
        const infoLeft = document.createElement('div');
        infoLeft.classList.add('info-left');
        contentArea.appendChild(infoLeft);

        // 项目名称和链接
        const title = document.createElement('h2');
        const link = document.createElement('a');
        link.href = repo.url;
        link.textContent = repo.name;
        link.target = '_blank';
        title.appendChild(link);
        infoLeft.appendChild(title);

        // 作者
        const authorP = document.createElement('p');
        authorP.textContent = `作者: ${repo.author}`;
        infoLeft.appendChild(authorP);

        // 语言和星星
        const statsP = document.createElement('p');
        let statsText = '';
        if (repo.language) {
            statsText += `语言: ${repo.language} | `;
        }
        statsText += `⭐ ${repo.stars} | Forks: ${repo.forks}`;
        statsP.textContent = statsText;
        infoLeft.appendChild(statsP);

        // 今日星星
        const todayStarsP = document.createElement('p');
        todayStarsP.textContent = `今日 Star: ${repo.currentPeriodStars}`;
        todayStarsP.style.fontWeight = 'bold';
        infoLeft.appendChild(todayStarsP);

        // 5. 右下角描述
        const infoRight = document.createElement('div');
        infoRight.classList.add('info-right');
        contentArea.appendChild(infoRight);

        if (repo.description) {
            const descriptionP = document.createElement('p');
            descriptionP.textContent = repo.description;
            infoRight.appendChild(descriptionP);
        } else {
            const noDescriptionP = document.createElement('p');
            noDescriptionP.textContent = '暂无描述';
            infoRight.appendChild(noDescriptionP);
        }

        // 6. 分享按钮 (添加到 itemDiv 以便绝对定位)
        const shareButton = document.createElement('button');
        shareButton.classList.add('share-button');
        // 使用 SVG 图标代替文字
        shareButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.499 2.499 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5zm-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
            </svg>
        `;
        itemDiv.appendChild(shareButton);

        // 分享事件处理
        shareButton.addEventListener('click', async () => {
            const shareUrl = 'https://github.com/LeaderOnePro/GitTok';
            const shareTitle = 'GitTok - 像刷 TikTok 一样刷 GitHub Trending';
            const shareText = `快来看看这个项目 GitTok，用 TikTok 的方式浏览 GitHub Trending！ ${shareUrl}`;

            if (navigator.share) {
                try {
                    await navigator.share({
                        title: shareTitle,
                        text: shareText,
                        url: shareUrl,
                    });
                    console.log('内容成功分享');
                } catch (err) {
                    // 如果用户取消分享，通常会进入这里，可以忽略
                    if (err.name !== 'AbortError') {
                        console.error('分享时出错:', err);
                        alert(`分享失败: ${err.message}`);
                    }
                }
            } else {
                // 回退到复制链接
                try {
                    await navigator.clipboard.writeText(shareUrl);
                    alert('链接已复制到剪贴板！');
                } catch (err) {
                    console.error('无法复制链接:', err);
                    alert('复制链接失败，请手动复制:\n' + shareUrl);
                }
            }
        });


        return itemDiv;
    }

    // 页面加载时获取数据
    fetchTrendingRepos();
});