document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed'); // DEBUG LOG
    const feedContainer = document.querySelector('.gittok-feed');
    const baseApiUrl = '/api/trending'; // Base path for the trending API
    const timeRangeButtons = document.querySelectorAll('.time-range-btn');
    let currentSince = 'daily'; // Default time range
    // const localApiUrl = 'http://localhost:3000/api/trending'; // For local backend testing

    async function fetchTrendingRepos(since = 'daily') { // Accept 'since' parameter
        // Clear previous content and show loading indicator
        feedContainer.innerHTML = `
            <div class="gittok-item loading">
                <div class="loading-content">
                    <svg class="octocat-spinner" viewBox="0 0 16 16" version="1.1" width="64" height="64" aria-hidden="true">
                        <path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                    </svg>
                    <p>正在加载 Trending 项目...</p>
                </div>
            </div>
        `;
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

        // 项目名称 (Row 0)
        const title = document.createElement('h2');
        title.textContent = repo.name;
        infoLeft.appendChild(title);

        // 作者 (Row 1)
        const authorP = document.createElement('p');
        authorP.classList.add('info-author'); // Add class for potential styling
        authorP.textContent = `作者: ${repo.author}`;
        infoLeft.appendChild(authorP);

        // 语言、星星、Forks (Row 2)
        const statsP = document.createElement('p');
        statsP.classList.add('info-stats'); // Add class for potential styling
        let statsText = '';
        if (repo.language) {
            statsText += `语言: ${repo.language} | `;
        }
        statsText += `⭐ ${repo.stars} | Forks: ${repo.forks}`;
        statsP.textContent = statsText;
        infoLeft.appendChild(statsP);

        // 今日星星 和 DeepWiki 按钮 (Row 3)
        const todayInfoDiv = document.createElement('div'); // Container for Row 3
        todayInfoDiv.classList.add('today-info-container');

        const todayStarsSpan = document.createElement('span'); // Use span for inline display
        todayStarsSpan.classList.add('today-stars');
        todayStarsSpan.textContent = `今日 Star: ${repo.currentPeriodStars}`;
        // todayStarsSpan.style.fontWeight = 'bold'; // Style with CSS instead if needed
        todayInfoDiv.appendChild(todayStarsSpan);

        // DeepWiki Button
        const deepWikiButton = document.createElement('button');
        deepWikiButton.classList.add('deepwiki-btn');
        deepWikiButton.innerHTML = `<img src="deepwiki.png" alt="DeepWiki"> DeepWiki`;
        deepWikiButton.title = '在 DeepWiki 中打开';
        deepWikiButton.addEventListener('click', (e) => {
            e.stopPropagation();
            let deepWikiUrl = repo.url;
            if (deepWikiUrl && deepWikiUrl.includes('github.com')) {
                deepWikiUrl = deepWikiUrl.replace('github.com', 'deepwiki.com');
            } else {
                console.warn('Could not generate DeepWiki URL from:', repo.url);
                const repoNameForSearch = encodeURIComponent(repo.name.split('/').pop());
                deepWikiUrl = `https://deepwiki.com/search?q=${repoNameForSearch}`;
            }
            window.open(deepWikiUrl, '_blank');
        });
        todayInfoDiv.appendChild(deepWikiButton); // Append button to the Row 3 container

        // Zread Button
        const zreadButton = document.createElement('button');
        zreadButton.classList.add('zread-btn');
        zreadButton.innerHTML = `<img src="zread.png" alt="Zread"> Zread`;
        zreadButton.title = '在 Zread 中打开';
        zreadButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const zreadUrl = `https://zread.ai/${repo.author}/${repo.name.split('/').pop()}`;
            window.open(zreadUrl, '_blank');
        });
        todayInfoDiv.appendChild(zreadButton); // Append button to the Row 3 container

        infoLeft.appendChild(todayInfoDiv); // Append Row 3 container to infoLeft

        // REMOVE previous individual appends for todayStarsP and deepWikiButton
        // infoLeft.appendChild(todayStarsP);
        // infoLeft.appendChild(deepWikiButton);

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
        summaryDiv.innerHTML = '<p><i>AI 总结加载中...</i></p>'; // Restore placeholder text
        infoRight.appendChild(summaryDiv);

        // Store repo info on the item for the observer
        itemDiv.dataset.author = repo.author;
        itemDiv.dataset.repo = repo.name;

        // 4. 分享按钮
        const shareButton = document.createElement('button');
        shareButton.classList.add('share-button');
        // Use simple link emoji for consistency, or keep SVG if preferred
        shareButton.innerHTML = '🔗';
        shareButton.title = '分享 GitTok 项目'; // Updated title
        itemDiv.appendChild(shareButton);

        // 分享事件处理
        shareButton.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent triggering image click
            const shareUrl = 'https://github.com/LeaderOnePro/GitTok'; // URL of your GitTok project
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
                        // Optional: Show user feedback
                    }
                }
            } else {
                // Fallback for browsers without navigator.share
                try {
                    await navigator.clipboard.writeText(shareUrl);
                     // Optional: Show temporary confirmation message on the button
                    const originalText = shareButton.innerHTML;
                    shareButton.innerHTML = '✅';
                    setTimeout(() => { shareButton.innerHTML = originalText; }, 1500);
                } catch (err) {
                    console.error('无法复制链接:', err);
                    alert('复制链接失败，请手动复制:\n' + shareUrl); // Alert as fallback
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

            if (data.summary && data.summary !== "Failed to generate summary or summary was empty." && data.summary !== "README is empty or could not be fetched." && data.summary !== "LongCat API key not configured.") {
                 summaryPlaceholder.innerHTML = `<p><strong>AI 总结:</strong> ${data.summary}</p>`;
                 itemElement.classList.add('summary-loaded'); // Mark as loaded
            } else {
                 summaryPlaceholder.innerHTML = `<p><i>未能生成 AI 总结。 (${data.summary || '原因未知'})</i></p>`;
            }

        } catch (error) {
            console.error(`获取 AI 总结失败 (${author}/${repo}):`, error);
            summaryPlaceholder.innerHTML = `<p><i>加载 AI 总结出错。 (${error.message})</i></p>`;
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
    console.log('Calling fetchTrendingRepos...'); // DEBUG LOG
    fetchTrendingRepos(currentSince);
});
