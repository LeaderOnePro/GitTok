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

// --- Simple In-Memory Cache ---
const summaryCache = new Map();

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

// --- Helper to get AI Summary using DeepSeek ---
async function getAiSummary(readmeContent) {

    // Check the cache first
    if (summaryCache.has(readmeContent)) {
        console.log("Cache hit! Returning cached summary.");
        return summaryCache.get(readmeContent);
    }

    console.log("Cache miss. Fetching new summary from DeepSeek API");

    if (!readmeContent || readmeContent.trim() === '') {
        return "README is empty or could not be fetched.";
    }
    if (!process.env.DEEPSEEK_API_KEY) { // Use DeepSeek API Key
        return "DeepSeek API key not configured.";
    }

    // Simple truncation to avoid overly long prompts (adjust length as needed)
    const maxLength = 4000; // Character limit (approximate)
    const truncatedContent = readmeContent.length > maxLength
        ? readmeContent.substring(0, maxLength) + "..."
        : readmeContent;

    const prompt = `请根据以下 GitHub 项目的 README 内容，用简体中文提供一个简洁的一句话总结:\n\n---\n\n${truncatedContent}\n\n---\n\n中文总结:`;

    try {
        console.log(`Requesting summary from DeepSeek for README (length: ${truncatedContent.length})...`);
        const response = await fetch('https://api.deepseek.com/chat/completions', { // DeepSeek API endpoint
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` // Use DeepSeek API Key
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
                model: "deepseek-chat", // Recommended model for general tasks
                stream: false,
                temperature: 0.5
            })
        });

        const data = await response.json();
        // DeepSeek API might have a slightly different response structure for errors or empty content.
        // Adjust based on actual API response if needed.
        const summary = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content ? data.choices[0].message.content.trim() : null;
        console.log("Received summary:", summary);

        // Store the new summary in the cache
        if (summary) {
            summaryCache.set(readmeContent, summary);
        }

        return summary || "Failed to generate summary or summary was empty.";
    } catch (error) {
        console.error("Error calling DeepSeek API:", error);
        return `Error generating summary: ${error.message}`;
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
        const summary = await getAiSummary(readmeContent); // Pass null if no README

        res.status(200).json({ summary });

    } catch (error) {
        console.error(`Error processing summary request for ${author}/${repo}:`, error);
        res.status(500).json({ error: 'Failed to process summary request.', details: error.message });
    }
}

export default allowCors(handler);