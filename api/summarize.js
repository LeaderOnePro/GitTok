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
async function fetchReadmeContent(author, repo) {
    const branches = ['main', 'master']; // Common default branches
    for (const branch of branches) {
        const url = `https://raw.githubusercontent.com/${author}/${repo}/${branch}/README.md`;
        try {
            console.log(`Attempting to fetch README from: ${url}`);
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
            console.error(`Error fetching README from ${url}:`, error);
            // Continue to next branch on fetch error
        }
    }
    console.log(`Could not find README.md for ${author}/${repo} on branches: ${branches.join(', ')}`);
    return null; // README not found on common branches
}

// --- Helper to get AI Summary using LongCat ---
async function getAiSummary(readmeContent) {
    if (!readmeContent || readmeContent.trim() === '') {
        return { ok: false, summary: "README is empty or could not be fetched." };
    }
    if (!process.env.LONGCAT_API_KEY) { // Use LongCat API Key
        return { ok: false, summary: "LongCat API key not configured." };
    }

    // Simple truncation to avoid overly long prompts (adjust length as needed)
    const maxLength = 4000; // Character limit (approximate)
    const truncatedContent = readmeContent.length > maxLength
        ? readmeContent.substring(0, maxLength) + "..."
        : readmeContent;

    const prompt = `请根据以下 GitHub 项目的 README 内容，用简体中文提供一个简洁的一句话总结:\n\n---\n\n${truncatedContent}\n\n---\n\n中文总结:`;

    try {
        console.log(`Requesting summary from LongCat for README (length: ${truncatedContent.length})...`);
        const response = await fetch('https://api.longcat.chat/openai/v1/chat/completions', { // LongCat API endpoint
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.LONGCAT_API_KEY}` // Use LongCat API Key
            },
            body: JSON.stringify({
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
                model: "LongCat-2.0", // 主模型
                stream: false,
                temperature: 0.5
            })
        });

        const data = await response.json();
        // LongCat API might have a slightly different response structure for errors or empty content.
        // Adjust based on actual API response if needed.
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
        console.error("Error calling LongCat API:", error);
        return { ok: false, summary: `Error generating summary: ${error.message}` };
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
        const { ok, summary } = await getAiSummary(readmeContent);

        // 只缓存成功的总结：让 Vercel CDN 按 URL(?author&repo) 缓存响应，跨实例/用户共享、抗冷启动。
        // 边缘缓存 1 天，之后 7 天内可先返回旧结果再后台刷新；上游出错时也继续用旧结果。
        // 失败结果不缓存，以便下次重试（如上游限流、README 暂时抓取失败）。
        if (ok) {
            res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800');
        } else {
            res.setHeader('Cache-Control', 'no-store');
        }

        res.status(200).json({ summary });

    } catch (error) {
        console.error(`Error processing summary request for ${author}/${repo}:`, error);
        res.status(500).json({ error: 'Failed to process summary request.', details: error.message });
    }
}

export default allowCors(handler);
