// api/summarize.js - Vercel Serverless Function for summarizing a single repo's README
import fetch from 'node-fetch';

// --- CORS Helper ---
const allowCors = fn => async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); // Adjust in production
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    return await fn(req, res);
};

// --- Helper to fetch README ---
// Fast path: raw README.md on the two most common default branches (no rate limit).
// Fallback: the GitHub API `repos/{owner}/{repo}/readme` endpoint auto-resolves the real
// default branch and the actual readme file (README.md, README.rst, ...), so repos on
// unusual branches (e.g. vercel/next.js -> canary) or non-.md readmes still work.
// Auth: uses GITHUB_TOKEN / GH_TOKEN when present (5000 req/h); unauthenticated is capped
// at 60 req/h per IP — the fallback only fires for the minority of repos the fast path
// misses, so it is safe on shared Vercel egress IPs.
async function fetchReadmeContent(author, repo) {
    const branches = ['main', 'master']; // Common default branches
    for (const branch of branches) {
        const url = `https://raw.githubusercontent.com/${author}/${repo}/${branch}/README.md`;
        try {
            const response = await fetch(url);
            if (response.ok) {
                console.log(`Successfully fetched README from branch: ${branch}`);
                return await response.text();
            }
            if (response.status !== 404) {
                // Log non-404 errors, but continue trying other branches
                console.warn(`Failed to fetch README from ${url} with status: ${response.status}`);
            }
        } catch (error) {
            console.error(`Error fetching README from ${url}:`, error.message);
        }
    }

    // Fallback: GitHub API readme endpoint (auto-detects branch + filename).
    const apiUrl = `https://api.github.com/repos/${author}/${repo}/readme`;
    const headers = {
        'User-Agent': 'GitTok',
        'Accept': 'application/vnd.github.raw+json',
    };
    const ghToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (ghToken) headers['Authorization'] = `Bearer ${ghToken}`;
    try {
        console.log(`Fast path missed; trying GitHub API readme fallback: ${apiUrl}`);
        const response = await fetch(apiUrl, { headers });
        if (response.ok) {
            const text = (await response.text()).trim();
            console.log(`Fetched README via GitHub API (${text.length} chars).`);
            return text.length > 0 ? text : null;
        }
        console.warn(`GitHub API readme fallback for ${author}/${repo} returned ${response.status}`);
    } catch (error) {
        console.error(`Error fetching README via GitHub API for ${author}/${repo}:`, error.message);
    }
    console.log(`Could not find README for ${author}/${repo}.`);
    return null;
}

// --- OrcaRouter config (OpenAI-compatible gateway) ---
// Docs: https://docs.orcarouter.ai — model naming: provider/model or orcarouter/free.
// Override the model at runtime via the SUMMARY_MODEL env var (no redeploy needed).
const ORCAROUTER_BASE = 'https://api.orcarouter.ai/v1';
const SUMMARY_MODEL = process.env.SUMMARY_MODEL || 'orcarouter/free';

// --- Helper to get AI Summary using OrcaRouter ---
async function getAiSummary(readmeContent) {
    if (!readmeContent || readmeContent.trim() === '') {
        return { ok: false, summary: "README is empty or could not be fetched." };
    }
    if (!process.env.ORCAROUTER_API_KEY) { // OrcaRouter API key (sk-orca-...)
        return { ok: false, summary: "OrcaRouter API key not configured." };
    }

    // Simple truncation to avoid overly long prompts (adjust length as needed)
    const maxLength = 4000; // Character limit (approximate)
    const truncatedContent = readmeContent.length > maxLength
        ? readmeContent.substring(0, maxLength) + "..."
        : readmeContent;

    const prompt = `请根据以下 GitHub 项目的 README 内容，用简体中文提供一个简洁的一句话总结:\n\n---\n\n${truncatedContent}\n\n---\n\n中文总结:`;

    try {
        console.log(`Requesting summary from OrcaRouter (${SUMMARY_MODEL}) for README (length: ${truncatedContent.length})...`);
        const response = await fetch(`${ORCAROUTER_BASE}/chat/completions`, { // OrcaRouter endpoint
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.ORCAROUTER_API_KEY}`
            },
            body: JSON.stringify({
                model: SUMMARY_MODEL,
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful assistant that provides concise one-sentence summaries in Chinese."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                stream: false,
                temperature: 0.5
            })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            // OrcaRouter / OpenAI-compatible error: { error: { message, code, type } }
            const errMsg = data?.error?.message || data?.error?.code || `HTTP ${response.status}`;
            console.error(`OrcaRouter error (HTTP ${response.status}):`, errMsg);
            // Upstream failure -> surface as 502 Bad Gateway (our server->OrcaRouter link is broken,
            // not a client error). The specific reason stays in `summary`.
            return { ok: false, summary: `Summary service error: ${errMsg}`, status: 502 };
        }
        let summary = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content ? data.choices[0].message.content.trim() : null;
        
        // 过滤 LLM 的 CoT（思考链）内容
        if (summary) {
            // 移除 <think>...</think> 标签及其内容
            summary = summary.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        }
        
        console.log("Received summary:", summary);

        if (summary) {
            return { ok: true, summary };
        }
        return { ok: false, summary: "Failed to generate summary or summary was empty." };
    } catch (error) {
        console.error("Error calling OrcaRouter API:", error);
        // Network/exception while calling upstream -> 502 Bad Gateway.
        return { ok: false, summary: `Error generating summary: ${error.message}`, status: 502 };
    }
}



// --- Main Serverless Function Handler ---
async function handler(req, res) {
    const { author, repo } = req.query; // Get author and repo from query params

    if (!author || !repo) {
        return res.status(400).json({ error: 'Missing required query parameters: author, repo' });
    }

    try {
        const readmeContent = await fetchReadmeContent(author, repo);
        const { ok, summary, status } = await getAiSummary(readmeContent);

        // 只缓存成功的总结：让 Vercel CDN 按 URL(?author&repo) 缓存响应，跨实例/用户共享、抗冷启动。
        // 边缘缓存 1 天，之后 7 天内可先返回旧结果再后台刷新；上游出错时也继续用旧结果。
        // 失败结果不缓存，以便下次重试（如上游限流、README 暂时抓取失败）。
        if (ok) {
            res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800');
        } else {
            res.setHeader('Cache-Control', 'no-store');
        }

        // 200 on success and on "logical" failures (empty README / no key / empty summary);
        // 502 when the upstream OrcaRouter call itself failed.
        const httpStatus = ok ? 200 : (status || 200);
        res.status(httpStatus).json({ ok, summary });

    } catch (error) {
        console.error(`Error processing summary request for ${author}/${repo}:`, error);
        res.status(500).json({ error: 'Failed to process summary request.', details: error.message });
    }
}

export default allowCors(handler);
