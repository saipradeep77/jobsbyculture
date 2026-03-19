import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Load companies
const ats = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/ats-companies.json'), 'utf8'));
const companies = ats.companies;

// Simple sentiment scoring based on keywords
const POSITIVE_WORDS = ['love', 'great', 'amazing', 'excellent', 'awesome', 'best', 'fantastic', 'happy', 'enjoy', 'recommend', 'supportive', 'brilliant', 'strong', 'impressed', 'thriving', 'innovative', 'kind', 'transparent', 'generous', 'flexible', 'autonomy', 'growth', 'opportunity', 'rewarding'];
const NEGATIVE_WORDS = ['toxic', 'terrible', 'awful', 'worst', 'hate', 'burnout', 'overwork', 'layoff', 'fired', 'chaotic', 'disorganized', 'micromanage', 'politics', 'bureaucratic', 'stressful', 'underpaid', 'broken', 'disappointing', 'frustrating', 'hostile', 'exhausting', 'turnover', 'dysfunction'];

function scoreSentiment(text) {
    const lower = text.toLowerCase();
    let pos = 0, neg = 0;
    for (const w of POSITIVE_WORDS) { if (lower.includes(w)) pos++; }
    for (const w of NEGATIVE_WORDS) { if (lower.includes(w)) neg++; }
    const total = pos + neg;
    if (total === 0) return 'neutral';
    const ratio = pos / total;
    if (ratio >= 0.65) return 'positive';
    if (ratio <= 0.35) return 'negative';
    return 'mixed';
}

function extractQuote(text, maxLen = 200) {
    // Clean HTML tags and newlines
    let clean = text.replace(/<[^>]+>/g, '').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean.length <= maxLen) return clean;
    // Find a sentence break near maxLen
    const truncated = clean.substring(0, maxLen);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastQuestion = truncated.lastIndexOf('?');
    const lastExclaim = truncated.lastIndexOf('!');
    const breakPoint = Math.max(lastPeriod, lastQuestion, lastExclaim);
    if (breakPoint > maxLen * 0.5) return clean.substring(0, breakPoint + 1);
    return truncated.substring(0, truncated.lastIndexOf(' ')) + '...';
}

async function fetchHN(companyName, slug) {
    const queries = [
        `"${companyName}" culture`,
        `"${companyName}" work`,
        `"${companyName}" engineering`,
    ];

    const allHits = [];
    for (const q of queries) {
        try {
            const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=comment&hitsPerPage=5&numericFilters=created_at_i>${Math.floor(Date.now()/1000) - 365*24*60*60}`;
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();
            for (const hit of (data.hits || [])) {
                if (hit.comment_text && hit.comment_text.length > 50) {
                    allHits.push({
                        source: 'hackernews',
                        text: hit.comment_text,
                        author: hit.author,
                        date: hit.created_at,
                        url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
                        storyTitle: hit.story_title || '',
                    });
                }
            }
        } catch (e) { /* skip */ }
    }

    // Deduplicate by objectID
    const seen = new Set();
    const unique = [];
    for (const h of allHits) {
        const key = h.url;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(h);
    }

    return unique.slice(0, 8); // Max 8 HN comments per company
}

async function fetchReddit(companyName, slug) {
    const queries = [
        `${companyName} culture work`,
        `${companyName} jobs hiring`,
    ];

    const allPosts = [];
    for (const q of queries) {
        try {
            const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=relevance&limit=5&t=year`;
            const res = await fetch(url, {
                headers: { 'User-Agent': 'JobsByCulture/1.0 (https://jobsbyculture.com)' }
            });
            if (!res.ok) continue;
            const data = await res.json();
            for (const child of (data.data?.children || [])) {
                const post = child.data;
                if (!post.title) continue;
                // Skip posts with very low engagement
                if (post.score < 2 && post.num_comments < 2) continue;
                allPosts.push({
                    source: 'reddit',
                    title: post.title,
                    text: post.selftext || '',
                    subreddit: post.subreddit,
                    score: post.score,
                    comments: post.num_comments,
                    date: new Date(post.created_utc * 1000).toISOString(),
                    url: `https://reddit.com${post.permalink}`,
                });
            }
        } catch (e) { /* skip */ }
        // Rate limit: wait 1 second between Reddit requests
        await new Promise(r => setTimeout(r, 1000));
    }

    // Deduplicate
    const seen = new Set();
    const unique = [];
    for (const p of allPosts) {
        if (seen.has(p.url)) continue;
        seen.add(p.url);
        unique.push(p);
    }

    return unique.slice(0, 5); // Max 5 Reddit posts per company
}

async function buildSentiment() {
    const result = {};

    for (const co of companies) {
        console.log(`Fetching sentiment for ${co.name} (${co.slug})...`);

        const [hnHits, redditPosts] = await Promise.all([
            fetchHN(co.name, co.slug),
            fetchReddit(co.name, co.slug),
        ]);

        // Process HN comments
        const hnQuotes = hnHits.map(h => ({
            source: 'hackernews',
            quote: extractQuote(h.text),
            author: h.author,
            date: h.date?.split('T')[0] || '',
            url: h.url,
            sentiment: scoreSentiment(h.text),
        })).filter(q => q.quote.length > 30);

        // Process Reddit posts
        const redditQuotes = redditPosts.map(p => ({
            source: 'reddit',
            title: p.title,
            quote: p.text ? extractQuote(p.text) : p.title,
            subreddit: p.subreddit,
            score: p.score,
            comments: p.comments,
            date: p.date?.split('T')[0] || '',
            url: p.url,
            sentiment: scoreSentiment(p.title + ' ' + p.text),
        }));

        // Overall sentiment
        const allSentiments = [...hnQuotes, ...redditQuotes].map(q => q.sentiment);
        const posCount = allSentiments.filter(s => s === 'positive').length;
        const negCount = allSentiments.filter(s => s === 'negative').length;
        const total = allSentiments.length;

        let overallSentiment = 'neutral';
        if (total > 0) {
            const posRatio = posCount / total;
            const negRatio = negCount / total;
            if (posRatio >= 0.5) overallSentiment = 'positive';
            else if (negRatio >= 0.5) overallSentiment = 'negative';
            else overallSentiment = 'mixed';
        }

        result[co.slug] = {
            name: co.name,
            overallSentiment,
            totalMentions: total,
            positive: posCount,
            negative: negCount,
            mixed: total - posCount - negCount,
            lastUpdated: new Date().toISOString().split('T')[0],
            hackernews: hnQuotes.slice(0, 5),
            reddit: redditQuotes.slice(0, 3),
        };

        console.log(`  → ${co.name}: ${total} mentions (${posCount}+ ${negCount}- ${total - posCount - negCount}~) = ${overallSentiment}`);

        // Small delay between companies to be respectful to APIs
        await new Promise(r => setTimeout(r, 500));
    }

    const outputPath = path.join(ROOT, 'data/community-sentiment.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`\n✓ Generated community-sentiment.json for ${Object.keys(result).length} companies`);
}

buildSentiment().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
