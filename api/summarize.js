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

// --- Helper to get AI Summary ---
async function getAiSummary(readmeContent) {
    if (!readmeContent || readmeContent.trim() === '') {
        return "README is empty or could not be fetched.";
    }
    if (!process.env.GROK_API_KEY) {
        return "Grok API key not configured.";
    }

    // Simple truncation to avoid overly long prompts (adjust length as needed)
    const maxLength = 4000; // Character limit (approximate)
    const truncatedContent = readmeContent.length > maxLength
        ? readmeContent.substring(0, maxLength) + "..."
        : readmeContent;

    const prompt = `请根据以下 GitHub 项目的 README 内容，用简体中文提供一个简洁的一句话总结:\n\n---\n\n${truncatedContent}\n\n---\n\n中文总结:`;

    try {
        console.log(`Requesting summary from Grok for README (length: ${truncatedContent.length})...`);
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROK_API_KEY}`
            },
            body: JSON.stringify({
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful assistant."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                model: "grok-3-mini-beta",
                stream: false,
                temperature: 0.5
            })
        });

        const data = await response.json();
        const summary = data.choices[0]?.message?.content?.trim();
        console.log("Received summary:", summary);
        return summary || "Failed to generate summary.";
    } catch (error) {
        console.error("Error calling Grok API:", error);
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