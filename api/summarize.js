// api/summarize.js - Vercel Serverless Function for summarizing a single repo's README
import fetch from 'node-fetch';
import { OpenAI } from 'openai'; // Correct import

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

// --- DeepSeek/OpenAI Client Initialization ---
let openai;
if (process.env.DEEPSEEK_API_KEY) {
    openai = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: "https://api.deepseek.com/v1", // DeepSeek API endpoint
    });
} else {
    console.warn("DEEPSEEK_API_KEY environment variable not set.");
}

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
    if (!openai) {
        return "AI summarization is not configured.";
    }
    if (!readmeContent || readmeContent.trim() === '') {
        return "README is empty or could not be fetched.";
    }

    // Simple truncation to avoid overly long prompts (adjust length as needed)
    const maxLength = 4000; // Character limit (approximate)
    const truncatedContent = readmeContent.length > maxLength
        ? readmeContent.substring(0, maxLength) + "..."
        : readmeContent;

    const prompt = `Please provide a concise, one-sentence summary of the following GitHub project based on its README:\n\n---\n\n${truncatedContent}\n\n---\n\nSummary:`;

    try {
        console.log(`Requesting summary from DeepSeek for README (length: ${truncatedContent.length})...`);
        const completion = await openai.chat.completions.create({
            model: "deepseek-chat", // Use the appropriate DeepSeek model
            messages: [{ role: "user", content: prompt }],
            max_tokens: 60, // Limit summary length
            temperature: 0.5, // Adjust creativity
            stream: false, // We want the full response
        });

        const summary = completion.choices[0]?.message?.content?.trim();
        console.log("Received summary:", summary);
        return summary || "Could not generate summary.";

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