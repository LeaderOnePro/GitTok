// api/trending.js - Vercel Serverless Function
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// Helper function to handle CORS (needed for Vercel)
const allowCors = fn => async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    // Allow requests from any origin. For production, you might want to restrict this
    // to your frontend's domain (e.g., your-gittok-url.vercel.app)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle OPTIONS request (pre-flight) for CORS
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    // Call the actual handler
    return await fn(req, res);
};

// The main handler function for the serverless endpoint
async function handler(req, res) {
    const trendingUrl = 'https://github.com/trending';

    try {
        console.log(`Fetching data from ${trendingUrl}...`);
        const response = await fetch(trendingUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch GitHub Trending page. Status: ${response.status}`);
        }

        const html = await response.text();
        console.log('Successfully fetched HTML.');

        const $ = cheerio.load(html);
        const repos = [];

        $('article.Box-row').each((index, element) => {
            const repoElement = $(element);
            const titleElement = repoElement.find('h2 > a');
            const repoPath = titleElement.attr('href')?.trim(); // Use optional chaining

            if (!repoPath) return; // Skip if no path found

            const pathParts = repoPath.split('/').filter(part => part.length > 0);
            if (pathParts.length < 2) return; // Skip if path is not like /author/repo

            const author = pathParts[0];
            const name = pathParts[1];
            const url = `https://github.com${repoPath}`;

            const descriptionElement = repoElement.find('p.col-9');
            const description = descriptionElement.text().trim();

            const langElement = repoElement.find('span[itemprop="programmingLanguage"]');
            const language = langElement.text().trim();

            const starsElement = repoElement.find(`a[href$="/stargazers"]`);
            const starsText = starsElement.text().trim().replace(/,/g, '');
            const stars = starsText ? parseInt(starsText, 10) : 0;


            const forksElement = repoElement.find(`a[href$="/forks"]`);
            const forksText = forksElement.text().trim().replace(/,/g, '');
            const forks = forksText ? parseInt(forksText, 10) : 0;


            const todayStarsElement = repoElement.find('span.d-inline-block.float-sm-right');
            const todayStarsText = todayStarsElement.text().trim();
            const todayStarsMatch = todayStarsText.match(/([\d,]+)\s+stars today/);
            const currentPeriodStars = todayStarsMatch ? parseInt(todayStarsMatch[1].replace(/,/g, ''), 10) : 0;

            repos.push({
                author: author,
                name: name,
                avatar: `https://github.com/${author}.png`,
                url: url,
                description: description,
                language: language,
                languageColor: langElement.prev('.repo-language-color').css('background-color'),
                stars: stars,
                forks: forks,
                currentPeriodStars: currentPeriodStars,
            });
        });

        console.log(`Parsed ${repos.length} repositories.`);
        // Send successful response
        res.status(200).json(repos);

    } catch (error) {
        console.error('Error fetching or parsing GitHub Trending:', error);
        // Send error response
        res.status(500).json({ error: 'Failed to fetch or parse GitHub Trending data.', details: error.message });
    }
}

// Export the handler wrapped with the CORS helper
export default allowCors(handler);