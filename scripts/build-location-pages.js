#!/usr/bin/env node
/**
 * Generates static Location cluster pages for programmatic SEO.
 *
 * Output:
 *   /locations/{slug}.html — one page per location bucket (e.g., san-francisco, london, remote)
 *
 * Usage: node scripts/build-location-pages.js
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── Extract data from jobs.html ───
const jobsHtml = readFileSync(resolve(ROOT, 'jobs.html'), 'utf-8');

function extract(name) {
    const re = new RegExp(`const ${name} = (\\{[\\s\\S]*?\\});`);
    const m = jobsHtml.match(re);
    if (!m) { console.error(`Could not find ${name}`); process.exit(1); }
    return new Function('return ' + m[1])();
}

function extractArray(name) {
    const re = new RegExp(`const ${name} = (\\[[\\s\\S]*?\\]);`);
    const m = jobsHtml.match(re);
    if (!m) { console.error(`Could not find ${name}`); process.exit(1); }
    return new Function('return ' + m[1])();
}

const VALUES = extract('VALUES');
const ROLES = extract('ROLES');
const COMPANIES = extract('COMPANIES');
const JOBS = extractArray('JOBS');

// ─── Location definitions ───
const LOCATIONS = {
    'san-francisco': {
        name: 'San Francisco Bay Area',
        emoji: '🌉',
        pattern: /san francisco|sf\b|sunnyvale|mountain view|palo alto|menlo park|foster city|south san francisco|bay area|san jose|santa clara|cupertino|fremont|redwood city/i,
        region: 'US West Coast',
        description: 'The heart of Silicon Valley and AI innovation. San Francisco and the Bay Area host more AI companies per square mile than anywhere else — from frontier labs like OpenAI and Anthropic to fast-growing startups. Most roles are hybrid with 2-3 days in-office.',
    },
    'new-york': {
        name: 'New York City',
        emoji: '🗽',
        pattern: /new york|nyc|\bny\b|brooklyn|manhattan/i,
        region: 'US East Coast',
        description: 'New York\'s AI scene is booming, with major labs and startups establishing engineering hubs in Manhattan and Brooklyn. Strong presence of fintech-AI crossover (Stripe, Ramp) alongside pure AI companies. Expect a mix of hybrid and in-office roles.',
    },
    'seattle': {
        name: 'Seattle',
        emoji: '🌲',
        pattern: /seattle|bellevue|redmond/i,
        region: 'US West Coast',
        description: 'Seattle\'s tech ecosystem extends well beyond the big cloud providers. AI companies value the deep engineering talent pool, lower cost of living versus SF, and no state income tax. Many roles offer hybrid flexibility.',
    },
    'london': {
        name: 'London',
        emoji: '🇬🇧',
        pattern: /london/i,
        region: 'Europe',
        description: 'London is Europe\'s largest AI hub, home to Google DeepMind and growing offices for Anthropic, Mistral, and others. Strong research culture, world-class universities feeding talent, and a vibrant startup ecosystem.',
    },
    'remote': {
        name: 'Remote',
        emoji: '🌍',
        pattern: /remote/i,
        region: 'Worldwide',
        description: 'Fully remote roles at AI and tech companies. Work from anywhere — these companies have distributed-first cultures with async communication, flexible hours, and no mandatory office days. Filter by culture values to find remote roles that match how you work.',
    },
    'paris': {
        name: 'Paris',
        emoji: '🇫🇷',
        pattern: /paris/i,
        region: 'Europe',
        description: 'Paris has emerged as a major AI research hub, anchored by Mistral AI and growing offices from Hugging Face, Anthropic, and others. France\'s strong math and engineering tradition produces world-class ML talent.',
    },
    'dublin': {
        name: 'Dublin',
        emoji: '🇮🇪',
        pattern: /dublin/i,
        region: 'Europe',
        description: 'Dublin is the European headquarters for many major tech companies, offering competitive compensation and a thriving tech community. Strong presence of enterprise AI and SaaS companies.',
    },
    'bengaluru': {
        name: 'Bengaluru',
        emoji: '🇮🇳',
        pattern: /bengaluru|bangalore/i,
        region: 'Asia Pacific',
        description: 'India\'s tech capital is a growing hub for AI engineering teams. Major companies are building substantial engineering offices here, with competitive local compensation and opportunities to work on global-scale AI products.',
    },
    'singapore': {
        name: 'Singapore',
        emoji: '🇸🇬',
        pattern: /singapore/i,
        region: 'Asia Pacific',
        description: 'Singapore is Southeast Asia\'s AI hub, with government investment in AI research and a strategic location bridging East and West. Growing presence of AI labs and startups, plus regional offices of major tech companies.',
    },
    'tokyo': {
        name: 'Tokyo',
        emoji: '🇯🇵',
        pattern: /tokyo/i,
        region: 'Asia Pacific',
        description: 'Tokyo\'s AI market is rapidly expanding, with global companies establishing dedicated Japan offices and local AI startups flourishing. Strong demand for bilingual (English/Japanese) technical talent.',
    },
    'toronto': {
        name: 'Toronto',
        emoji: '🇨🇦',
        pattern: /toronto/i,
        region: 'North America',
        description: 'Toronto is a global AI research powerhouse, home to the Vector Institute and a deep talent pool from top universities. Companies like Cohere are headquartered here, and many US companies have Toronto engineering offices.',
    },
    'chicago': {
        name: 'Chicago',
        emoji: '🏙️',
        pattern: /chicago/i,
        region: 'US Midwest',
        description: 'Chicago\'s tech scene is growing rapidly with strong AI/ML teams at established companies and startups. Lower cost of living than coastal cities, with a deep talent pool and growing venture ecosystem.',
    },
    'berlin': {
        name: 'Berlin',
        emoji: '🇩🇪',
        pattern: /berlin/i,
        region: 'Europe',
        description: 'Berlin is one of Europe\'s most dynamic tech hubs, known for its startup culture and international talent. Growing AI presence with competitive compensation and a strong quality of life.',
    },
    'sydney': {
        name: 'Sydney',
        emoji: '🇦🇺',
        pattern: /sydney/i,
        region: 'Asia Pacific',
        description: 'Sydney leads Australia\'s AI scene with regional offices for major global companies and a growing local startup ecosystem. Strong talent from top universities and competitive compensation.',
    },
    'munich': {
        name: 'Munich',
        emoji: '🇩🇪',
        pattern: /munich|m[uü]nchen/i,
        region: 'Europe',
        description: 'Munich combines world-class engineering culture with a thriving AI research scene. Home to major company R&D centers and a strong pipeline of technical talent from TU Munich and other top institutions.',
    },
    'austin': {
        name: 'Austin',
        emoji: '🤠',
        pattern: /austin/i,
        region: 'US South',
        description: 'Austin has become a magnet for tech companies relocating or expanding, with no state income tax, a strong quality of life, and a growing AI/ML community. Several AI companies have established offices here.',
    },
};

// ─── Classify helpers (same as build-cluster-pages.js) ───
function classifyRole(title) {
    const t = title.toLowerCase();
    if (/(machine learning|ml |ml\/|deep learning|ai research|ai scientist|llm|nlp|computer vision|cv engineer|research scientist|research engineer|reinforcement learning|ai safety|interpretability|alignment)/.test(t)) return 'ml-ai';
    if (/(data scien|data eng|data analy|data infra|data platform|analytics engineer|business intel)/.test(t)) return 'data';
    if (/design/.test(t) && !/engineer|security/.test(t)) return 'design';
    if (/(product manag|program manag|technical program|product owner|product lead|head of product|product strateg|product director|product operation|product analys|scrum master|agile coach)/.test(t)) return 'product';
    if (/(engineer|developer|swe|software|frontend|backend|fullstack|full-stack|devops|sre|infrastructure|platform|architect|firmware|embedded)/.test(t) && !/(solutions engineer|solutions architect|sales engineer|developer relations|devrel)/.test(t)) return 'engineering';
    if (/(marketing|growth|content|seo|communications|brand|copywriter|developer relations|devrel|community manag|editorial|creative)/.test(t)) return 'marketing';
    if (/(sales|account exec|account manag|business develop|revenue|gtm|go-to-market|solutions|partnerships|customer success|pre-sales)/.test(t) && !/accountant/.test(t)) return 'sales';
    if (/(finance|accounti|accountant|controller|treasury|fp&a|financial|investor relations)/.test(t)) return 'finance';
    if (/(recruiter|recruiting|people ops|people partner|talent|hr |human resources|sourcer|onboarding|enablement)/.test(t)) return 'hr-people';
    if (/(legal|counsel|compliance|policy|regulatory|paralegal|attorney)/.test(t)) return 'legal';
    if (/(support specialist|customer support|premium support|help desk|safety specialist|support delivery)/.test(t)) return 'support';
    if (/(operations|ops |logistics|supply chain|procurement|coordinator|facilities|workplace|office manag)/.test(t)) return 'operations';
    return 'other';
}

// ─── Enrich jobs ───
const enrichedJobs = JOBS.map(j => ({
    ...j,
    role: classifyRole(j.title),
    companyData: COMPANIES[j.company],
    companyValues: COMPANIES[j.company]?.values || [],
}));

// ─── Classify job into location buckets ───
function getLocationBuckets(location) {
    const buckets = [];
    for (const [slug, loc] of Object.entries(LOCATIONS)) {
        if (loc.pattern.test(location)) {
            buckets.push(slug);
        }
    }
    return buckets;
}

// ─── HTML escape ───
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ─── Shared HTML components (identical to build-cluster-pages.js) ───
function navHtml() {
    return `<nav>
    <div class="nav-inner">
        <a href="/" class="nav-logo">
            <div class="nav-mark"><div class="ring ring-1"></div><div class="ring ring-2"></div><div class="nav-dot"></div></div>
            <div class="nav-wordmark">Jobs<span>By</span>Culture</div>
        </a>
        <div class="nav-links">
            <a href="/">Home</a>
            <a href="/jobs">Jobs</a>
            <a href="/compare">Compare</a>
            <a href="/directory">Culture Directory</a>
        </div>
        <button class="hamburger" onclick="this.classList.toggle('active');this.closest('.nav-inner').querySelector('.nav-links').classList.toggle('open')" aria-label="Menu">
            <span></span><span></span><span></span>
        </button>
    </div>
</nav>`;
}

function footerHtml() {
    return `<footer>
    <div class="container">
        <div class="ft-links">
            <a href="/">Home</a>
            <a href="/jobs">Browse Jobs</a>
            <a href="/compare">Compare Cultures</a>
            <a href="/directory">Culture Directory</a>
            <a href="/values/remote">By Culture</a>
            <a href="/roles/engineering">By Role</a>
            <a href="/seniority/senior">By Seniority</a>
            <a href="/locations/san-francisco">By Location</a>
        </div>
        <div class="ft-bar">
            <p>&copy; 2026 JobsByCulture</p>
            <p>Made by <a href="https://x.com/itspradz" target="_blank">@itspradz</a></p>
        </div>
    </div>
</footer>`;
}

function headHtml(title, description, canonical, ogImageUrl) {
    const ogImg = ogImageUrl || 'https://jobsbyculture.com/og-image.png';
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}">
    <meta name="robots" content="index, follow">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${esc(canonical)}">
    <meta property="og:image" content="${esc(ogImg)}">
    <meta property="og:image:type" content="image/png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(title)}">
    <meta name="twitter:description" content="${esc(description)}">
    <meta name="twitter:image" content="${esc(ogImg)}">
    <link rel="canonical" href="${esc(canonical)}">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="icon" type="image/png" sizes="512x512" href="/logo.png">
    <link rel="apple-touch-icon" href="/logo.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Satoshi:wght@400;500;600;700;900&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">`;
}

// ─── CSS (same as cluster pages) ───
const sharedCSS = `
    <style>
        :root {
            --bg: #fafaf8; --bg-card: #ffffff; --bg-hover: #f4f3ef;
            --text: #1a1a1f; --text-2: #52525b; --text-3: #9ca3af;
            --accent: #e8590c; --accent-hover: #c2410c;
            --accent-bg: rgba(232,89,12,0.06); --accent-border: rgba(232,89,12,0.2);
            --teal: #0d9488; --teal-bg: rgba(13,148,136,0.06); --teal-border: rgba(13,148,136,0.2);
            --violet: #7c3aed; --violet-bg: rgba(124,58,237,0.06); --violet-border: rgba(124,58,237,0.2);
            --rose: #e11d48; --rose-bg: rgba(225,29,72,0.06); --rose-border: rgba(225,29,72,0.2);
            --sky: #0284c7; --sky-bg: rgba(2,132,199,0.06); --sky-border: rgba(2,132,199,0.2);
            --orange: #e8590c; --orange-bg: rgba(232,89,12,0.06); --orange-border: rgba(232,89,12,0.2);
            --lime: #4d7c0f; --lime-bg: rgba(77,124,15,0.06); --lime-border: rgba(77,124,15,0.2);
            --border: rgba(0,0,0,0.07); --border-2: rgba(0,0,0,0.12); --border-3: rgba(0,0,0,0.18);
            --radius: 12px; --radius-sm: 8px; --radius-lg: 20px; --radius-full: 100px;
            --font-display: 'Instrument Serif', Georgia, serif;
            --font-body: 'Satoshi', -apple-system, sans-serif;
            --font-mono: 'IBM Plex Mono', monospace;
            --shadow: 0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04);
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { font-family: var(--font-body); background: var(--bg); color: var(--text); line-height: 1.6; -webkit-font-smoothing: antialiased; }
        .container { max-width: 1140px; margin: 0 auto; padding: 0 24px; }

        /* NAV */
        nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: rgba(250,250,248,0.85); backdrop-filter: blur(24px) saturate(1.4); border-bottom: 1px solid var(--border); }
        .nav-inner { max-width: 1140px; margin: 0 auto; padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; }
        .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--text); }
        .nav-mark { width: 30px; height: 30px; position: relative; display: flex; align-items: center; justify-content: center; }
        .nav-mark .ring { position: absolute; border: 1.5px solid var(--accent); border-radius: 50%; animation: logoPing 2.5s ease-out infinite; }
        .nav-mark .ring-1 { width: 100%; height: 100%; opacity: 0.2; }
        .nav-mark .ring-2 { width: 65%; height: 65%; opacity: 0.4; animation-delay: 0.3s; }
        .nav-mark .nav-dot { width: 7px; height: 7px; background: var(--accent); border-radius: 50%; position: relative; z-index: 1; }
        @keyframes logoPing { 0% { transform: scale(1); opacity: 0.4; } 100% { transform: scale(1.5); opacity: 0; } }
        .nav-wordmark { font-weight: 700; font-size: 16px; letter-spacing: -0.03em; }
        .nav-wordmark span { color: var(--accent); }
        .nav-links { display: flex; align-items: center; gap: 28px; }
        .nav-links a { color: var(--text-2); text-decoration: none; font-size: 14px; font-weight: 500; transition: color 0.15s; }
        .nav-links a:hover { color: var(--text); }
        .nav-links a.active { color: var(--accent); font-weight: 600; }
        .hamburger { display: none; background: none; border: none; cursor: pointer; padding: 4px; flex-direction: column; gap: 5px; }
        .hamburger span { display: block; width: 22px; height: 2px; background: var(--text); border-radius: 1px; transition: all 0.3s; }

        /* HERO */
        .cl-hero { padding: 120px 0 50px; text-align: center; position: relative; }
        .cl-hero::before {
            content: ''; position: absolute; top: -100px; left: 50%; transform: translateX(-50%);
            width: 900px; height: 600px;
            background: radial-gradient(ellipse, rgba(232,89,12,0.06) 0%, transparent 70%);
            pointer-events: none;
        }
        .cl-hero-pill {
            display: inline-flex; align-items: center; gap: 8px;
            background: var(--accent-bg); border: 1px solid var(--accent-border);
            padding: 5px 14px 5px 8px; border-radius: var(--radius-full);
            font-size: 13px; font-weight: 500; color: var(--accent);
            margin-bottom: 20px;
        }
        .cl-hero-pill-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); animation: blink 2s infinite; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .cl-hero h1 {
            font-family: var(--font-display); font-weight: 400;
            font-size: clamp(32px, 4.5vw, 52px); line-height: 1.15;
            letter-spacing: -0.025em; margin-bottom: 16px;
        }
        .cl-hero h1 em { font-style: italic; color: var(--accent); }
        .cl-hero-sub {
            font-size: 16px; color: var(--text-2); max-width: 640px; margin: 0 auto;
            line-height: 1.7;
        }

        /* STATS BAR */
        .cl-stats { display: flex; justify-content: center; gap: 32px; margin-top: 28px; flex-wrap: wrap; }
        .cl-stat { text-align: center; }
        .cl-stat-val { font-family: var(--font-mono); font-size: 24px; font-weight: 700; color: var(--accent); }
        .cl-stat-label { font-size: 12px; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.08em; }

        /* COMPANIES SECTION */
        .cl-companies { padding: 40px 0; }
        .cl-section-title {
            font-family: var(--font-display); font-size: 28px; font-weight: 400;
            margin-bottom: 20px; letter-spacing: -0.02em;
        }
        .cl-company-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; margin-bottom: 40px; }
        .cl-company-card {
            background: var(--bg-card); border: 1px solid var(--border);
            border-radius: var(--radius); padding: 20px;
            text-decoration: none; color: var(--text);
            transition: box-shadow 0.2s, transform 0.2s;
            display: flex; flex-direction: column; gap: 12px;
        }
        .cl-company-card:hover { box-shadow: var(--shadow); transform: translateY(-2px); }
        .cl-company-top { display: flex; align-items: center; gap: 12px; }
        .cl-company-top img { width: 36px; height: 36px; border-radius: 8px; border: 1px solid var(--border); }
        .cl-company-name { font-weight: 600; font-size: 16px; }
        .cl-company-meta { font-size: 13px; color: var(--text-3); }
        .cl-company-values { display: flex; flex-wrap: wrap; gap: 6px; }
        .cl-value-tag {
            font-size: 11px; font-weight: 600; padding: 3px 10px;
            border-radius: var(--radius-full); border: 1px solid;
        }
        .cl-value-tag.teal { color: var(--teal); background: var(--teal-bg); border-color: var(--teal-border); }
        .cl-value-tag.violet { color: var(--violet); background: var(--violet-bg); border-color: var(--violet-border); }
        .cl-value-tag.sky { color: var(--sky); background: var(--sky-bg); border-color: var(--sky-border); }
        .cl-value-tag.orange { color: var(--orange); background: var(--orange-bg); border-color: var(--orange-border); }
        .cl-value-tag.rose { color: var(--rose); background: var(--rose-bg); border-color: var(--rose-border); }

        /* JOBS LIST */
        .cl-jobs { padding: 0 0 40px; }
        .cl-job-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
        .cl-job {
            display: flex; align-items: center; gap: 14px;
            background: var(--bg-card); border: 1px solid var(--border);
            border-radius: var(--radius-sm); padding: 14px 18px;
            text-decoration: none; color: var(--text);
            transition: border-color 0.15s;
        }
        .cl-job:hover { border-color: var(--accent-border); }
        .cl-job img { width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--border); flex-shrink: 0; }
        .cl-job-info { flex: 1; min-width: 0; }
        .cl-job-title { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cl-job-meta { font-size: 12px; color: var(--text-3); margin-top: 2px; }
        .cl-job-arrow { color: var(--text-3); font-size: 18px; flex-shrink: 0; }
        .cl-show-more {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 10px 24px; border-radius: var(--radius);
            background: var(--accent); color: #fff; text-decoration: none;
            font-size: 14px; font-weight: 600; transition: background 0.2s;
        }
        .cl-show-more:hover { background: var(--accent-hover); }

        /* ROLE BREAKDOWN */
        .cl-breakdown { padding: 0 0 40px; }
        .cl-breakdown-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
        .cl-breakdown-item {
            display: flex; align-items: center; justify-content: space-between;
            padding: 12px 16px; border-radius: var(--radius-sm);
            background: var(--bg-card); border: 1px solid var(--border);
            font-size: 14px; font-weight: 500; color: var(--text);
        }
        .cl-breakdown-count { font-family: var(--font-mono); font-size: 13px; color: var(--accent); font-weight: 600; }

        /* RELATED / CROSS LINKS */
        .cl-related { padding: 0 0 60px; }
        .cl-related-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
        .cl-related-link {
            display: flex; align-items: center; gap: 8px;
            padding: 14px 18px; border-radius: var(--radius-sm);
            background: var(--bg-card); border: 1px solid var(--border);
            text-decoration: none; color: var(--text); font-size: 14px; font-weight: 500;
            transition: border-color 0.15s;
        }
        .cl-related-link:hover { border-color: var(--accent); color: var(--accent); }
        .cl-related-link .count { margin-left: auto; font-family: var(--font-mono); font-size: 12px; color: var(--text-3); }

        /* CONTENT */
        .cl-content { padding: 0 0 40px; }
        .cl-content h2 { font-family: var(--font-display); font-size: 24px; font-weight: 400; margin-bottom: 12px; }
        .cl-content p { font-size: 15px; color: var(--text-2); line-height: 1.7; margin-bottom: 16px; max-width: 720px; }

        /* FOOTER */
        footer { padding: 56px 0 36px; border-top: 1px solid var(--border); }
        .ft-bar { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-3); }
        .ft-bar a { color: var(--accent); text-decoration: none; }
        .ft-links { display: flex; gap: 24px; margin-bottom: 20px; flex-wrap: wrap; }
        .ft-links a { font-size: 13px; color: var(--text-2); text-decoration: none; }
        .ft-links a:hover { color: var(--text); }

        @media (max-width: 768px) {
            .hamburger { display: flex; }
            .nav-links { display: none; position: absolute; top: 100%; left: 0; right: 0; background: rgba(250,250,248,0.98); backdrop-filter: blur(20px); border-bottom: 1px solid var(--border); padding: 20px 24px; flex-direction: column; gap: 16px; }
            .nav-links.open { display: flex; }
            .cl-hero { padding: 100px 0 36px; }
            .cl-company-grid { grid-template-columns: 1fr; }
            .cl-stats { gap: 20px; }
            .cl-related-grid { grid-template-columns: 1fr 1fr; }
            .cl-breakdown-grid { grid-template-columns: 1fr 1fr; }
        }
    </style>`;

// ─── Build job card HTML ───
function jobCardHtml(job) {
    const co = COMPANIES[job.company];
    const logo = co ? co.logo : `https://www.google.com/s2/favicons?domain=${job.company}.com&sz=128`;
    const name = co ? co.name : job.company;
    return `        <a href="${esc(job.url)}" target="_blank" rel="noopener" class="cl-job">
            <img src="${esc(logo)}" alt="${esc(name)}" width="28" height="28" loading="lazy">
            <div class="cl-job-info">
                <div class="cl-job-title">${esc(job.title)}</div>
                <div class="cl-job-meta">${esc(name)} &middot; ${esc(job.location)}</div>
            </div>
            <span class="cl-job-arrow">&rsaquo;</span>
        </a>`;
}

// ─── Build company card HTML ───
function companyCardHtml(slug) {
    const co = COMPANIES[slug];
    if (!co) return '';
    const valuesTags = (co.values || []).slice(0, 4).map(v => {
        const val = VALUES[v];
        if (!val) return '';
        return `<span class="cl-value-tag ${val.color}">${esc(val.name)}</span>`;
    }).join('\n                    ');

    return `        <a href="/companies/${esc(slug)}" class="cl-company-card">
            <div class="cl-company-top">
                <img src="${esc(co.logo)}" alt="${esc(co.name)}" width="36" height="36" loading="lazy">
                <div>
                    <div class="cl-company-name">${esc(co.name)}</div>
                    <div class="cl-company-meta">${esc(co.size)} &middot; Glassdoor ${co.glassdoor}/5</div>
                </div>
            </div>
            <div class="cl-company-values">
                ${valuesTags}
            </div>
        </a>`;
}

// ─── Generate a LOCATION page ───
function generateLocationPage(locSlug) {
    const loc = LOCATIONS[locSlug];
    if (!loc) return null;

    // Find jobs matching this location
    const matchingJobs = enrichedJobs.filter(j => loc.pattern.test(j.location));
    if (matchingJobs.length === 0) return null;

    // Companies with jobs here
    const companySet = new Set(matchingJobs.map(j => j.company));
    const matchingCompanies = [...companySet].filter(s => COMPANIES[s]);

    // Role breakdown
    const byRole = {};
    matchingJobs.forEach(j => {
        if (!byRole[j.role]) byRole[j.role] = [];
        byRole[j.role].push(j);
    });
    const roleBreakdown = Object.entries(byRole)
        .filter(([r]) => r !== 'other' && ROLES[r])
        .sort((a, b) => b[1].length - a[1].length);

    const title = `AI & Tech Jobs in ${loc.name} | JobsByCulture`;
    const desc = `Browse ${matchingJobs.length.toLocaleString()} AI & tech jobs in ${loc.name} at ${matchingCompanies.length} culture-rated companies. Filter by culture values like remote, work-life balance, and more.`.slice(0, 160);
    const canonical = `https://jobsbyculture.com/locations/${locSlug}`;
    const showJobs = matchingJobs.slice(0, 25);

    const ogUrl = `https://jobsbyculture.com/api/og?type=location&slug=${locSlug}`;
    let html = headHtml(title, desc, canonical, ogUrl) + sharedCSS + `
</head>
<body>
${navHtml()}

<section class="cl-hero">
    <div class="container">
        <div class="cl-hero-pill"><span class="cl-hero-pill-dot"></span>${esc(loc.region)}</div>
        <h1>${loc.emoji} <em>${esc(loc.name)}</em> Jobs</h1>
        <p class="cl-hero-sub">${esc(loc.description)}</p>
        <div class="cl-stats">
            <div class="cl-stat"><div class="cl-stat-val">${matchingJobs.length.toLocaleString()}</div><div class="cl-stat-label">Open Roles</div></div>
            <div class="cl-stat"><div class="cl-stat-val">${matchingCompanies.length}</div><div class="cl-stat-label">Companies</div></div>
            <div class="cl-stat"><div class="cl-stat-val">${roleBreakdown.length}</div><div class="cl-stat-label">Role Types</div></div>
        </div>
    </div>
</section>

<section class="cl-companies">
    <div class="container">
        <h2 class="cl-section-title">Companies hiring in <em>${esc(loc.name)}</em></h2>
        <div class="cl-company-grid">
${matchingCompanies.map(s => companyCardHtml(s)).filter(Boolean).join('\n')}
        </div>
    </div>
</section>`;

    // Role breakdown section
    if (roleBreakdown.length > 0) {
        html += `

<section class="cl-breakdown">
    <div class="container">
        <h2 class="cl-section-title">Jobs by role in ${esc(loc.name)}</h2>
        <div class="cl-breakdown-grid">
${roleBreakdown.map(([r, jobs]) => {
    const roleName = ROLES[r]?.name || r;
    return `            <div class="cl-breakdown-item"><span>${esc(roleName)}</span><span class="cl-breakdown-count">${jobs.length}</span></div>`;
}).join('\n')}
        </div>
    </div>
</section>`;
    }

    // Job listings
    html += `

<section class="cl-jobs">
    <div class="container">
        <h2 class="cl-section-title">Latest jobs in ${esc(loc.name)}</h2>
        <div class="cl-job-list">
${showJobs.map(j => jobCardHtml(j)).join('\n')}
        </div>
        <a href="/jobs" class="cl-show-more">View all ${matchingJobs.length.toLocaleString()} jobs &rarr;</a>
    </div>
</section>`;

    // SEO content
    html += `

<section class="cl-content">
    <div class="container">
        <h2>Working in AI & tech in ${esc(loc.name)}</h2>
        <p>${esc(loc.description)}</p>
        <p>JobsByCulture tracks ${matchingJobs.length.toLocaleString()} open positions across ${matchingCompanies.length} companies in ${esc(loc.name)}. Every company is rated on 18 culture values from real employee reviews, so you can find roles that match both your skills and how you like to work.</p>
    </div>
</section>`;

    // Related: other locations
    const otherLocations = Object.keys(LOCATIONS).filter(l => l !== locSlug);
    html += `

<section class="cl-related">
    <div class="container">
        <h2 class="cl-section-title">Browse other locations</h2>
        <div class="cl-related-grid">
${otherLocations.map(l => {
    const lData = LOCATIONS[l];
    const count = enrichedJobs.filter(j => lData.pattern.test(j.location)).length;
    if (count === 0) return '';
    return `            <a href="/locations/${esc(l)}" class="cl-related-link">${lData.emoji} ${esc(lData.name)} <span class="count">${count.toLocaleString()}</span></a>`;
}).filter(Boolean).join('\n')}
        </div>
    </div>
</section>

<section class="cl-related">
    <div class="container">
        <h2 class="cl-section-title">Browse by culture value</h2>
        <div class="cl-related-grid">
${Object.entries(VALUES).slice(0, 8).map(([v, vData]) => {
    const count = enrichedJobs.filter(j => (COMPANIES[j.company]?.values || []).includes(v)).length;
    return `            <a href="/values/${esc(v)}" class="cl-related-link">${esc(vData.ico)} ${esc(vData.name)} <span class="count">${count.toLocaleString()}</span></a>`;
}).join('\n')}
        </div>
    </div>
</section>

${footerHtml()}

<script type="application/ld+json">
{
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "${esc(title)}",
    "description": "${esc(desc)}",
    "url": "${esc(canonical)}",
    "numberOfItems": ${matchingJobs.length},
    "provider": {
        "@type": "Organization",
        "name": "JobsByCulture",
        "url": "https://jobsbyculture.com"
    }
}
</script>
</body>
</html>`;

    return { slug: locSlug, html, path: `locations/${locSlug}.html`, jobs: matchingJobs.length, companies: matchingCompanies.length };
}

// ─── Main build ───
console.log('Building location pages...\n');

const locDir = resolve(ROOT, 'locations');
if (!existsSync(locDir)) mkdirSync(locDir, { recursive: true });

const generated = [];

for (const locSlug of Object.keys(LOCATIONS)) {
    const result = generateLocationPage(locSlug);
    if (result) {
        writeFileSync(resolve(ROOT, result.path), result.html);
        generated.push(result);
        console.log(`  [location] ${result.path} (${result.jobs} jobs, ${result.companies} companies)`);
    }
}

console.log(`\nGenerated ${generated.length} location pages.`);

// ─── Update sitemap.xml ───
const sitemapPath = resolve(ROOT, 'sitemap.xml');
let sitemap = readFileSync(sitemapPath, 'utf-8');

// Remove old location entries
sitemap = sitemap.replace(/\s*<!-- Location pages -->[\s\S]*?<!-- \/Location pages -->\n?/g, '\n');

// Add new entries before </urlset>
const today = new Date().toISOString().slice(0, 10);
let locationEntries = '\n  <!-- Location pages -->';
for (const page of generated) {
    const loc = `https://jobsbyculture.com/${page.path.replace('.html', '')}`;
    locationEntries += `
  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
}
locationEntries += '\n  <!-- /Location pages -->\n';

sitemap = sitemap.replace('</urlset>', locationEntries + '</urlset>');
writeFileSync(sitemapPath, sitemap);
console.log(`Updated sitemap.xml with ${generated.length} location page URLs.`);
