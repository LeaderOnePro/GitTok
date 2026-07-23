document.addEventListener('DOMContentLoaded', () => {
    const feedContainer = document.querySelector('.gittok-feed');
    const progressEl = document.querySelector('.scroll-progress');
    const timeRangeButtons = document.querySelectorAll('.time-range-btn');
    const baseApiUrl = '/api/trending';

    let currentSince = 'daily';
    let summaryObserver = null;    // lazy AI summaries
    let positionObserver = null;   // tracks the current card (progress + keyboard nav)
    let currentIndex = 0;
    let itemCount = 0;
    let inFlightController = null;  // AbortController for the trending fetch
    const trendingCache = new Map(); // since -> repos[]

    // ============================================================
    // Helpers
    // ============================================================

    // HTML-escape all interpolated text (data is scraped from GitHub, so
    // descriptions can contain arbitrary characters).
    function esc(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Only accept a fully-validated CSS color before injecting it into a style
    // attribute (prevents any breakout via languageColor).
    function isSafeColor(c) {
        if (typeof c !== 'string') return false;
        const s = c.trim();
        return /^#[0-9a-fA-F]{3,8}$/.test(s) ||
               /^rgba?\([\d\s.,%]+\)$/.test(s) ||
               /^hsla?\([\d\s.,%]+\)$/.test(s);
    }

    // 12345 -> "12.3k", 1200000 -> "1.2M"
    function formatCount(n) {
        const num = Number(n);
        if (!isFinite(num)) return '0';
        if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
        return String(num);
    }

    // ============================================================
    // Card rendering (template literal + one innerHTML)
    // ============================================================

    function repoCardHtml(repo) {
        const avatarUrl = `${repo.avatar}?s=600`;
        const bg = `background-image:url('${esc(avatarUrl)}')`;

        const langDot = isSafeColor(repo.languageColor)
            ? `<span class="lang-dot" style="background-color:${repo.languageColor}"></span>`
            : '';
        const langPart = repo.language ? `语言: ${langDot}${esc(repo.language)} | ` : '';
        const stats = `${langPart}⭐ ${formatCount(repo.stars)} | Forks: ${formatCount(repo.forks)}`;

        return `
            <div class="blurred-background" style="${bg}"></div>

            <a class="content-image" style="${bg}"
               href="${esc(repo.url)}" target="_blank" rel="noopener noreferrer"
               title="点击查看 ${esc(repo.name)} 项目"
               aria-label="打开 ${esc(repo.name)} 的 GitHub 仓库"></a>

            <div class="info-left">
                <h2>${esc(repo.name)}</h2>
                <p class="info-author">作者: ${esc(repo.author)}</p>
                <p class="info-stats">${stats}</p>
                <div class="today-info-container">
                    <span class="today-stars">今日 Star: ${formatCount(repo.currentPeriodStars)}</span>
                    <button type="button" class="deepwiki-btn" data-action="deepwiki" title="在 DeepWiki 中打开">
                        <img src="deepwiki.png" alt=""> DeepWiki
                    </button>
                    <button type="button" class="zread-btn" data-action="zread" title="在 Zread 中打开">
                        <img src="zread.png" alt=""> Zread
                    </button>
                </div>
            </div>

            <div class="info-right">
                <p class="repo-description">${esc(repo.description) || '暂无描述'}</p>
                <div class="ai-summary"><p><i>AI 总结加载中...</i></p></div>
            </div>

            <button type="button" class="share-button" data-action="share"
                    title="分享 GitTok 项目" aria-label="分享 GitTok">🔗</button>
        `;
    }

    function createRepoElement(repo) {
        const item = document.createElement('div');
        item.className = 'gittok-item';
        item.dataset.author = repo.author;
        item.dataset.repo = repo.name;
        item.dataset.url = repo.url;
        item.innerHTML = repoCardHtml(repo);
        return item;
    }

    // ============================================================
    // Feed states: skeleton / repos / empty / error
    // ============================================================

    function showSkeleton() {
        teardownObservers();
        updateProgress(0, 0);
        feedContainer.innerHTML = `
            <div class="gittok-item skeleton">
                <div class="skeleton-box skeleton-image"></div>
                <div class="skeleton-lines">
                    <div class="skeleton-line medium"></div>
                    <div class="skeleton-line short"></div>
                    <div class="skeleton-line medium"></div>
                </div>
            </div>`;
    }

    function showError(error) {
        teardownObservers();
        updateProgress(0, 0);
        feedContainer.innerHTML = `
            <div class="gittok-item error-message">
                <div style="text-align:center;padding:0 20px;">
                    <p>加载 GitHub Trending 数据失败：${esc(error.message)}</p>
                    <p>请检查网络连接或 API 状态。</p>
                    <button type="button" class="time-range-btn active" data-retry="1" style="margin-top:12px;">重试</button>
                </div>
            </div>`;
    }

    function renderRepos(repos) {
        teardownObservers();
        feedContainer.innerHTML = '';

        if (!repos || repos.length === 0) {
            feedContainer.innerHTML = '<div class="gittok-item"><p>未能加载 Trending 项目，或者今天没有项目。</p></div>';
            updateProgress(0, 0);
            return;
        }

        const frag = document.createDocumentFragment();
        repos.forEach((repo, i) => {
            const el = createRepoElement(repo);
            el.dataset.index = i;
            frag.appendChild(el);
        });
        feedContainer.appendChild(frag);

        itemCount = repos.length;
        currentIndex = 0;
        setupObservers();
        updateProgress(1, itemCount);
    }

    // ============================================================
    // Data fetching (client cache + cancel in-flight)
    // ============================================================

    async function fetchTrendingRepos(since = 'daily') {
        // Cancel any in-flight request so a stale response can't overwrite the new view.
        if (inFlightController) {
            inFlightController.abort();
            inFlightController = null;
        }

        // Cache hit -> render instantly.
        if (trendingCache.has(since)) {
            renderRepos(trendingCache.get(since));
            return;
        }

        const controller = new AbortController();
        inFlightController = controller;
        const { signal } = controller;

        showSkeleton();

        try {
            const response = await fetch(`${baseApiUrl}?since=${since}`, { signal });
            if (!response.ok) throw new Error(`HTTP 错误! 状态: ${response.status}`);
            const repos = await response.json();
            if (signal.aborted) return;         // superseded by a newer request
            trendingCache.set(since, repos);
            renderRepos(repos);
        } catch (error) {
            if (error.name === 'AbortError') return; // intentionally cancelled
            console.error('获取 GitHub Trending 数据时出错:', error);
            showError(error);
        } finally {
            if (inFlightController === controller) inFlightController = null;
        }
    }

    // ============================================================
    // Observers: lazy summaries + current-card tracking
    // ============================================================

    function setupObservers() {
        summaryObserver = new IntersectionObserver(handleSummaryIntersect, {
            root: feedContainer,
            rootMargin: '0px 0px 200px 0px', // start loading ~200px before the card enters
            threshold: 0.01
        });
        positionObserver = new IntersectionObserver(handlePositionIntersect, {
            root: feedContainer,
            threshold: 0.6                   // the card that occupies most of the viewport
        });

        feedContainer.querySelectorAll('.gittok-item').forEach(item => {
            summaryObserver.observe(item);
            positionObserver.observe(item);
        });
    }

    function teardownObservers() {
        if (summaryObserver) { summaryObserver.disconnect(); summaryObserver = null; }
        if (positionObserver) { positionObserver.disconnect(); positionObserver = null; }
    }

    function handlePositionIntersect(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                currentIndex = Number(entry.target.dataset.index) || 0;
                updateProgress(currentIndex + 1, itemCount);
            }
        });
    }

    function handleSummaryIntersect(entries, observer) {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const item = entry.target;
            if (item.classList.contains('summary-loading') || item.classList.contains('summary-loaded')) return;
            const { author, repo } = item.dataset;
            if (author && repo) {
                item.classList.add('summary-loading');
                fetchAndDisplaySummary(item, author, repo);
            }
            observer.unobserve(item);
        });
    }

    async function fetchAndDisplaySummary(itemElement, author, repo) {
        const summaryPlaceholder = itemElement.querySelector('.ai-summary');
        const summarizeApiUrl = `/api/summarize?author=${encodeURIComponent(author)}&repo=${encodeURIComponent(repo)}`;

        try {
            const response = await fetch(summarizeApiUrl);
            itemElement.classList.remove('summary-loading');

            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            const data = await response.json();

            const failures = [
                'Failed to generate summary or summary was empty.',
                'README is empty or could not be fetched.',
                'LongCat API key not configured.'
            ];
            if (data.summary && !failures.includes(data.summary)) {
                summaryPlaceholder.innerHTML = `<p><strong>AI 总结:</strong> ${esc(data.summary)}</p>`;
                itemElement.classList.add('summary-loaded');
            } else {
                summaryPlaceholder.innerHTML = `<p><i>未能生成 AI 总结。 (${esc(data.summary || '原因未知')})</i></p>`;
            }
        } catch (error) {
            console.error(`获取 AI 总结失败 (${author}/${repo}):`, error);
            summaryPlaceholder.innerHTML = `<p><i>加载 AI 总结出错。 (${esc(error.message)})</i></p>`;
            itemElement.classList.remove('summary-loading');
        }
    }

    // ============================================================
    // Progress pill
    // ============================================================

    function updateProgress(current, total) {
        if (!progressEl) return;
        if (!total) {
            progressEl.classList.remove('visible');
            progressEl.textContent = '';
            return;
        }
        progressEl.textContent = `${current} / ${total}`;
        progressEl.classList.add('visible');
    }

    // ============================================================
    // Keyboard navigation (↑/↓ and k/j)
    // ============================================================

    function goToIndex(idx) {
        const items = feedContainer.querySelectorAll('.gittok-item');
        if (idx < 0 || idx >= items.length) return;
        currentIndex = idx;                       // optimistic: keeps rapid presses in sync
        updateProgress(idx + 1, items.length);
        items[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    document.addEventListener('keydown', (e) => {
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        if (e.key === 'ArrowDown' || e.key === 'j') {
            e.preventDefault();
            goToIndex(currentIndex + 1);
        } else if (e.key === 'ArrowUp' || e.key === 'k') {
            e.preventDefault();
            goToIndex(currentIndex - 1);
        }
    });

    // ============================================================
    // Delegated clicks (DeepWiki / Zread / share / retry)
    // ============================================================

    feedContainer.addEventListener('click', (e) => {
        const retry = e.target.closest('[data-retry]');
        if (retry) {
            fetchTrendingRepos(currentSince);
            return;
        }

        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const item = btn.closest('.gittok-item');
        if (!item) return;

        const { author, repo, url } = item.dataset;
        switch (btn.dataset.action) {
            case 'deepwiki': openDeepWiki(url, repo); break;
            case 'zread':    openZread(author, repo); break;
            case 'share':    shareGitTok(btn); break;
        }
    });

    function openDeepWiki(url, repoName) {
        let deepWikiUrl = url;
        if (deepWikiUrl && deepWikiUrl.includes('github.com')) {
            deepWikiUrl = deepWikiUrl.replace('github.com', 'deepwiki.com');
        } else {
            const q = encodeURIComponent((repoName || '').split('/').pop());
            deepWikiUrl = `https://deepwiki.com/search?q=${q}`;
        }
        window.open(deepWikiUrl, '_blank', 'noopener');
    }

    function openZread(author, repoName) {
        const zreadUrl = `https://zread.ai/${author}/${(repoName || '').split('/').pop()}`;
        window.open(zreadUrl, '_blank', 'noopener');
    }

    async function shareGitTok(button) {
        const shareUrl = 'https://github.com/LeaderOnePro/GitTok';
        const shareTitle = 'GitTok - 像刷 TikTok 一样刷 GitHub Trending';
        const shareText = `快来看看这个项目 GitTok，用 TikTok 的方式浏览 GitHub Trending！ ${shareUrl}`;

        if (navigator.share) {
            try {
                await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
            } catch (err) {
                if (err.name !== 'AbortError') console.error('分享时出错:', err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(shareUrl);
                const original = button.innerHTML;
                button.innerHTML = '✅';
                setTimeout(() => { button.innerHTML = original; }, 1500);
            } catch (err) {
                console.error('无法复制链接:', err);
                alert('复制链接失败，请手动复制:\n' + shareUrl);
            }
        }
    }

    // ============================================================
    // Time-range switching + initial load
    // ============================================================

    timeRangeButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (button.classList.contains('active')) return; // already showing this range
            timeRangeButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentSince = button.dataset.since;
            fetchTrendingRepos(currentSince);
        });
    });

    fetchTrendingRepos(currentSince);
});
