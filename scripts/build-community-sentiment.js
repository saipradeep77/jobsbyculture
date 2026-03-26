import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Load companies
const ats = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/ats-companies.json'), 'utf8'));
const companies = ats.companies;

// ─── Sentiment scoring ───
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

function extractQuote(text, maxLen = 280) {
    let clean = text.replace(/<[^>]+>/g, '').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean.length <= maxLen) return clean;
    const truncated = clean.substring(0, maxLen);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastQuestion = truncated.lastIndexOf('?');
    const lastExclaim = truncated.lastIndexOf('!');
    const breakPoint = Math.max(lastPeriod, lastQuestion, lastExclaim);
    if (breakPoint > maxLen * 0.5) return clean.substring(0, breakPoint + 1);
    return truncated.substring(0, truncated.lastIndexOf(' ')) + '...';
}

// ─── Relevance filtering ───

// Companies with common-word names need stricter matching
const COMMON_WORD_SLUGS = new Set([
    'cohere', 'scale', 'vast', 'modal', 'linear', 'ramp', 'notion',
    'runway', 'mercury', 'plaid', 'together', 'suno', 'pylon', 'brex',
]);

// Culture/work keywords that indicate the quote is about working at the company
const CULTURE_KEYWORDS = [
    'work at', 'working at', 'worked at', 'culture', 'work-life', 'wlb',
    'team', 'engineering', 'management', 'manager', 'coworker', 'colleague',
    'office', 'remote', 'hire', 'interview', 'onboarding', 'comp', 'salary',
    'equity', 'benefits', 'promotion', 'career', 'layoff', 'fire', 'pip',
    'burnout', 'hours', 'overtime', 'pace', 'ship', 'deploy', 'postmortem',
    'incident', 'on-call', 'oncall', 'values', 'transparent', 'autonomy',
    'employee', 'founder', 'ceo', 'leadership',
];

function isRelevantToCompanyCulture(text, companyName) {
    const lower = text.toLowerCase();
    const companyLower = companyName.toLowerCase();

    // Must actually mention the company name
    if (!lower.includes(companyLower)) return false;

    // Must include at least one culture/work keyword
    return CULTURE_KEYWORDS.some(kw => lower.includes(kw));
}

function isQuestionOnly(text) {
    // Skip posts that are just questions with no opinion
    const lower = text.toLowerCase().trim();
    if (lower.endsWith('?') && lower.length < 200) return true;
    const questionPatterns = [
        /^(anyone|has anyone|can anyone|does anyone|who here)/i,
        /^(how is|how's|what is|what's|what are|is it|would it)/i,
        /^(curious|wondering|looking for|need help|need advice)/i,
        /^(hi everyone|hey everyone|hello|posting here)/i,
    ];
    return questionPatterns.some(p => p.test(lower));
}

function isJobPosting(text) {
    return /\| (Full-time|Part-time|ONSITE|REMOTE|HYBRID) \|/i.test(text) ||
           /^Location:.*Remote:/m.test(text) ||
           /hiring.*engineer|engineer.*hiring/i.test(text) && text.length < 200;
}

// ─── HN fetcher ───

async function fetchHN(companyName, slug) {
    // For common-word companies, use stricter queries
    const isCommon = COMMON_WORD_SLUGS.has(slug);
    const queries = isCommon
        ? [`"${companyName}" "work at"`, `"${companyName}" culture`, `"${companyName}" "engineering"  `]
        : [`"${companyName}" culture`, `"${companyName}" work`, `"${companyName}" engineering`];

    const allHits = [];
    for (const q of queries) {
        try {
            const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=comment&hitsPerPage=10&numericFilters=created_at_i>${Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60}`;
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();
            for (const hit of (data.hits || [])) {
                if (!hit.comment_text || hit.comment_text.length < 50) continue;
                allHits.push({
                    source: 'hackernews',
                    text: hit.comment_text,
                    author: hit.author,
                    date: hit.created_at,
                    url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
                    storyTitle: hit.story_title || '',
                });
            }
        } catch (e) { /* skip */ }
    }

    // Deduplicate
    const seen = new Set();
    const unique = [];
    for (const h of allHits) {
        if (seen.has(h.url)) continue;
        seen.add(h.url);
        unique.push(h);
    }

    // Filter: must be relevant to company culture, not a job posting, not a question
    return unique.filter(h => {
        const text = h.text;
        if (isJobPosting(text)) return false;
        if (isQuestionOnly(text)) return false;
        if (!isRelevantToCompanyCulture(text, companyName)) return false;
        return true;
    }).slice(0, 5);
}

// ─── Reddit fetcher (now fetches top comments from threads!) ───

// Subreddits likely to have relevant discussions about working at tech companies
const RELEVANT_SUBREDDITS = new Set([
    'cscareerquestions', 'cscareerquestionseu', 'cscareerquestionsuk',
    'experienceddevs', 'softwareengineering', 'programming',
    'datascience', 'dataengineering', 'dataengineersindia',
    'machinelearning', 'developersIndia', 'startups', 'saas',
    'careerguidance', 'jobs', 'antiwork', 'overemployed',
    'techsales', 'cybersecurity', 'devops', 'sysadmin',
    'csMajors', 'leetcode', 'blind',
    // Company-specific subreddits
    'stripe', 'cloudflare', 'supabase', 'posthog', 'tailscale',
    'ramp', 'notion', 'figma', 'airtable', 'hubspot', 'datadog',
    'localllama', 'openai', 'anthropic', 'chatgpt',
]);

async function fetchRedditComments(permalink) {
    // Fetch the thread comments to get top replies
    try {
        const url = `https://www.reddit.com${permalink}.json?limit=10&sort=top`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'JobsByCulture/1.0 (https://jobsbyculture.com)' }
        });
        if (!res.ok) return [];
        const data = await res.json();

        // data[1] contains the comments tree
        const comments = data[1]?.data?.children || [];
        return comments
            .filter(c => c.kind === 't1' && c.data?.body)
            .map(c => ({
                body: c.data.body,
                score: c.data.score,
                author: c.data.author,
            }))
            .filter(c => c.body.length > 50 && c.score >= 2)
            .slice(0, 5); // Top 5 comments
    } catch (e) {
        return [];
    }
}

async function fetchReddit(companyName, slug) {
    const isCommon = COMMON_WORD_SLUGS.has(slug);

    // Use more targeted queries
    const queries = isCommon
        ? [`"${companyName}" "work at" OR "culture" OR "interview"`, `"${companyName}" "engineering" OR "salary" OR "employee"`]
        : [`${companyName} culture work employee`, `"working at ${companyName}"`, `${companyName} interview culture`];

    const allPosts = [];
    for (const q of queries) {
        try {
            const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=relevance&limit=10&t=year`;
            const res = await fetch(url, {
                headers: { 'User-Agent': 'JobsByCulture/1.0 (https://jobsbyculture.com)' }
            });
            if (!res.ok) continue;
            const data = await res.json();
            for (const child of (data.data?.children || [])) {
                const post = child.data;
                if (!post.title) continue;
                if (post.score < 2 && post.num_comments < 2) continue;

                // Filter: must be from a relevant subreddit
                const sub = post.subreddit.toLowerCase();
                const isRelevantSub = RELEVANT_SUBREDDITS.has(sub) ||
                    sub.includes(slug) ||
                    sub.includes(companyName.toLowerCase().replace(/[^a-z]/g, ''));
                if (!isRelevantSub) continue;

                // Filter: title or text must mention the company
                const fullText = (post.title + ' ' + post.selftext).toLowerCase();
                if (!fullText.includes(companyName.toLowerCase())) continue;

                allPosts.push({
                    source: 'reddit',
                    title: post.title,
                    text: post.selftext || '',
                    subreddit: post.subreddit,
                    score: post.score,
                    comments: post.num_comments,
                    date: new Date(post.created_utc * 1000).toISOString(),
                    url: `https://reddit.com${post.permalink}`,
                    permalink: post.permalink,
                });
            }
        } catch (e) { /* skip */ }
        await new Promise(r => setTimeout(r, 1200)); // Reddit rate limit
    }

    // Deduplicate
    const seen = new Set();
    const unique = [];
    for (const p of allPosts) {
        if (seen.has(p.url)) continue;
        seen.add(p.url);
        unique.push(p);
    }

    // Sort by engagement (score + comments)
    unique.sort((a, b) => (b.score + b.comments) - (a.score + a.comments));

    // For top threads, fetch the actual reply comments
    const results = [];
    for (const post of unique.slice(0, 5)) {
        // Fetch top comments from the thread
        const topComments = await fetchRedditComments(post.permalink);
        await new Promise(r => setTimeout(r, 1200)); // Rate limit

        // Find the best comment that's an opinion/statement about the company
        const relevantComments = topComments.filter(c => {
            const text = c.body.toLowerCase();
            if (isQuestionOnly(c.body)) return false;
            // Must mention something culture/work related
            return CULTURE_KEYWORDS.some(kw => text.includes(kw));
        });

        if (relevantComments.length > 0) {
            // Use the top relevant comment as the quote
            const best = relevantComments[0];
            results.push({
                source: 'reddit',
                title: post.title,
                quote: extractQuote(best.body),
                subreddit: post.subreddit,
                score: post.score,
                comments: post.comments,
                commentAuthor: best.author,
                commentScore: best.score,
                date: post.date?.split('T')[0] || '',
                url: post.url,
                sentiment: scoreSentiment(best.body),
            });
        } else if (post.text && post.text.length > 100 && !isQuestionOnly(post.text)) {
            // Fallback: use the OP text if it's a statement (not a question)
            results.push({
                source: 'reddit',
                title: post.title,
                quote: extractQuote(post.text),
                subreddit: post.subreddit,
                score: post.score,
                comments: post.comments,
                date: post.date?.split('T')[0] || '',
                url: post.url,
                sentiment: scoreSentiment(post.text),
            });
        }
    }

    return results.slice(0, 3);
}

// ─── Main build ───

async function buildSentiment() {
    // Load existing data to preserve manually curated entries
    let existing = {};
    const outputPath = path.join(ROOT, 'data/community-sentiment.json');
    try { existing = JSON.parse(fs.readFileSync(outputPath, 'utf8')); } catch { /* fresh start */ }

    const result = {};

    for (const co of companies) {
        console.log(`Fetching sentiment for ${co.name} (${co.slug})...`);

        const [hnHits, redditQuotes] = await Promise.all([
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

        const allQuotes = [...hnQuotes, ...redditQuotes];

        // Overall sentiment
        const posCount = allQuotes.filter(q => q.sentiment === 'positive').length;
        const negCount = allQuotes.filter(q => q.sentiment === 'negative').length;
        const total = allQuotes.length;

        let overallSentiment = 'neutral';
        if (total > 0) {
            const posRatio = posCount / total;
            if (posRatio >= 0.5) overallSentiment = 'positive';
            else if (negCount / total >= 0.5) overallSentiment = 'negative';
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

        console.log(`  → ${co.name}: ${hnQuotes.length} HN + ${redditQuotes.length} Reddit = ${total} total (${overallSentiment})`);

        await new Promise(r => setTimeout(r, 500));
    }

    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`\n✓ Generated community-sentiment.json for ${Object.keys(result).length} companies`);

    // Summary
    const withData = Object.values(result).filter(c => c.totalMentions > 0).length;
    const totalQuotes = Object.values(result).reduce((s, c) => s + c.totalMentions, 0);
    console.log(`  ${withData} companies with data, ${totalQuotes} total quotes`);
}

buildSentiment().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
