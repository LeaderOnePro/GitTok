document.addEventListener('DOMContentLoaded', () => {
    const feedContainer = document.querySelector('.gittok-feed');
    const baseApiUrl = '/api/trending'; // Base path for the trending API
    const timeRangeButtons = document.querySelectorAll('.time-range-btn');
    let currentSince = 'daily'; // Default time range
    // const localApiUrl = 'http://localhost:3000/api/trending'; // For local backend testing

    async function fetchTrendingRepos(since = 'daily') { // Accept 'since' parameter
        // Clear previous content and show loading indicator
        feedContainer.innerHTML = '<div class="gittok-item loading"><div class="spinner"></div></div>'; // Use spinner instead of text
        // Reset observer if it exists
        if (observer) {
            observer.disconnect();
        }

        try {
            const apiUrlWithSince = `${baseApiUrl}?since=${since}`;
            const response = await fetch(apiUrlWithSince);
            if (!response.ok) {
                throw new Error(`HTTP 错误! 状态: ${response.status}`);
            }
            const repos = await response.json();

            // 清除加载指示器
            feedContainer.innerHTML = ''; // Clear loading indicator

            if (repos && repos.length > 0) {
                repos.forEach(repo => {
                    const item = createRepoElement(repo);
                    feedContainer.appendChild(item);
                });
                // Setup Intersection Observer after items are added
                setupSummaryObserver();
            } else {
                feedContainer.innerHTML = '<div class="gittok-item"><p>未能加载 Trending 项目，或者今天没有项目。</p></div>';
            }

        } catch (error) {
            console.error('获取 GitHub Trending 数据时出错:', error);
            feedContainer.innerHTML = `<div class="gittok-item error-message"><p>加载 GitHub Trending 数据失败: ${error.message}</p><p>无法连接到 API: ${apiUrlWithSince}</p><p>请检查网络连接或 API 状态。</p></div>`;
        }
    }

    function createRepoElement(repo) {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('gittok-item');

        // 0. 模糊背景层 (使用相同图片)
        const blurredBg = document.createElement('div');
        blurredBg.classList.add('blurred-background');
        blurredBg.style.backgroundImage = `url(${repo.avatar}?s=600)`; // Use the same image URL
        itemDiv.appendChild(blurredBg); // Add it first

        // 1. 主要内容图片 (居中显示，点击跳转)
        const contentImage = document.createElement('div');
        contentImage.classList.add('content-image'); // Renamed class for clarity
        contentImage.style.backgroundImage = `url(${repo.avatar}?s=600)`;
        contentImage.title = `点击查看 ${repo.name} 项目`;
        itemDiv.appendChild(contentImage);

        // 图片点击事件
        contentImage.addEventListener('click', () => {
            window.open(repo.url, '_blank');
        });

        // 2. 左下角信息
        const infoLeft = document.createElement('div');
        infoLeft.classList.add('info-left');
        itemDiv.appendChild(infoLeft); // 直接添加到 itemDiv

        // 项目名称 (不再是链接)
        const title = document.createElement('h2');
        title.textContent = repo.name;
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

        // 3. 右下角信息 (描述 + AI 总结占位符)
        const infoRight = document.createElement('div');
        infoRight.classList.add('info-right');
        itemDiv.appendChild(infoRight);

        // Description
        const descriptionP = document.createElement('p');
        descriptionP.classList.add('repo-description');
        descriptionP.textContent = repo.description || '暂无描述';
        infoRight.appendChild(descriptionP);

        // AI Summary Placeholder
        const summaryDiv = document.createElement('div');
        summaryDiv.classList.add('ai-summary');
        summaryDiv.innerHTML = '<p><i>AI 总结加载中...</i></p>'; // Initial placeholder text
        infoRight.appendChild(summaryDiv);

        // Store repo info on the item for the observer
        itemDiv.dataset.author = repo.author;
        itemDiv.dataset.repo = repo.name;

        // 4. 分享按钮 (保持不变)
        const shareButton = document.createElement('button');
        shareButton.classList.add('share-button');
        shareButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.499 2.499 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5zm-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
            </svg>
        `;
        itemDiv.appendChild(shareButton);

        // 分享事件处理 (保持不变)
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
                    if (err.name !== 'AbortError') {
                        console.error('分享时出错:', err);
                        alert(`分享失败: ${err.message}`);
                    }
                }
            } else {
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

    // --- Intersection Observer for Lazy Loading Summaries ---
    let observer;

    function setupSummaryObserver() {
        const options = {
            root: feedContainer, // Observe within the feed container
            rootMargin: '0px 0px 200px 0px', // Load summary when item is 200px from bottom edge
            threshold: 0.01 // Trigger when even a small part is visible
        };

        observer = new IntersectionObserver(handleIntersection, options);

        const items = feedContainer.querySelectorAll('.gittok-item:not(.summary-loaded):not(.summary-loading)');
        items.forEach(item => observer.observe(item));
    }

    async function handleIntersection(entries, observer) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const item = entry.target;
                // Check if already loading or loaded
                if (!item.classList.contains('summary-loading') && !item.classList.contains('summary-loaded')) {
                    const author = item.dataset.author;
                    const repo = item.dataset.repo;
                    if (author && repo) {
                        item.classList.add('summary-loading');
                        fetchAndDisplaySummary(item, author, repo);
                    }
                    // Stop observing this item once loading starts
                    observer.unobserve(item);
                }
            }
        });
    }

    async function fetchAndDisplaySummary(itemElement, author, repo) {
        const summaryPlaceholder = itemElement.querySelector('.ai-summary');
        const summarizeApiUrl = `/api/summarize?author=${encodeURIComponent(author)}&repo=${encodeURIComponent(repo)}`;

        try {
            console.log(`Fetching summary for ${author}/${repo}...`);
            const response = await fetch(summarizeApiUrl);
            itemElement.classList.remove('summary-loading'); // Remove loading class regardless of outcome

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }
            const data = await response.json();

            if (data.summary) {
                 summaryPlaceholder.innerHTML = `<p><strong>AI 总结:</strong> ${data.summary}</p>`;
                 itemElement.classList.add('summary-loaded'); // Mark as loaded
            } else {
                 summaryPlaceholder.innerHTML = `<p><i>未能生成 AI 总结。</i></p>`;
            }

        } catch (error) {
            console.error(`获取 AI 总结失败 (${author}/${repo}):`, error);
            summaryPlaceholder.innerHTML = `<p><i>加载 AI 总结出错。</i></p>`;
             itemElement.classList.remove('summary-loading'); // Ensure loading class is removed on error
        }
    }

    // --- Event Listeners for Time Range Buttons ---
    timeRangeButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            timeRangeButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to the clicked button
            button.classList.add('active');
            // Get the new time range
            currentSince = button.dataset.since;
            // Fetch data for the new time range
            fetchTrendingRepos(currentSince);
        });
    });

    // Initial data fetch on page load with default time range
    fetchTrendingRepos(currentSince);
});