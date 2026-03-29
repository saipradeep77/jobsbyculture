#!/usr/bin/env node
/**
 * Generates static Value + Role cluster pages for programmatic SEO.
 *
 * Output:
 *   /values/{slug}.html        — 18 value pages
 *   /roles/{slug}.html         — 12 role pages
 *   /roles/{value}/{role}.html — cross pages (only where ≥3 jobs exist)
 *
 * Usage: node scripts/build-cluster-pages.js
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
const SENIORITIES = extract('SENIORITIES');
const COMPANIES = extract('COMPANIES');
const COMPANY_REVIEWS = extract('COMPANY_REVIEWS');
const JOBS = extractArray('JOBS');

// ─── Classify helpers (synced with update-counts.js — keep these identical) ───
function classifyRole(title) {
    const t = title.toLowerCase();
    // ML/AI
    const mlPatterns = ['machine learning', 'research scientist', 'research engineer', 'reinforcement learning', 'ai safety', 'interpretability', 'alignment', 'computer vision', 'nlp engineer', 'natural language', 'deep learning', 'ai researcher', 'ai research', 'ml engineer', 'ml infrastructure', 'ml platform', 'ml acceleration', 'ml networking'];
    if (mlPatterns.some(p => t.includes(p)) || / ml /i.test(t) || /\bllm\b/i.test(t)) return 'ml-ai';
    // Data
    const dataPatterns = ['data scien', 'data engineer', 'data analy', 'data infra', 'data platform', 'advanced analytics', 'business intelligence', 'bi engineer', 'bi analyst', 'analytics engineer'];
    if (dataPatterns.some(p => t.includes(p))) return 'data';
    // Design
    if (t.includes('design') && !t.includes('engineer') && !t.includes('security')) return 'design';
    // Product
    const productPatterns = ['product manag', 'program manag', 'technical program', 'product owner', 'product lead', 'scrum master', 'agile coach', 'product strateg', 'product director', 'head of product', 'product operation', 'product analys'];
    if (productPatterns.some(p => t.includes(p))) return 'product';
    // Engineering
    const engPatterns = ['engineer', 'developer', 'architect', 'platform', 'sre ', 'site reliability', 'devops', 'qa ', 'quality assurance', 'security', 'systems', 'infrastructure', 'frontend', 'backend', 'fullstack', 'full stack', 'firmware', 'embedded'];
    const engExclusions = ['developer relations', 'developer education', 'devrel', 'solutions engineer', 'solutions architect', 'sales engineer', 'business systems', 'customer support engineer', 'gtm'];
    if (engPatterns.some(p => t.includes(p)) && !engExclusions.some(p => t.includes(p))) return 'engineering';
    // Marketing
    const marketingPatterns = ['marketing', 'communications', 'developer relations', 'developer education', 'devrel', 'brand', 'social media', 'public relations', 'copywriter', 'growth marketing', 'community manag', 'influencer', 'creative', 'editorial', 'content'];
    if (marketingPatterns.some(p => t.includes(p))) return 'marketing';
    // Sales
    const salesPatterns = ['account exec', 'account manag', 'sales', 'solutions engineer', 'solutions architect', 'sales engineer', 'gtm', 'business develop', 'partnerships', 'deal desk', 'revenue', 'engagement manag', 'customer success', 'pre-sales'];
    if (salesPatterns.some(p => t.includes(p)) && !t.includes('accountant')) return 'sales';
    // Finance
    const financePatterns = ['accountant', 'accounting', 'financial', 'fp&a', 'treasury', 'controller', 'actuary', 'actuarial', 'investor relations', 'bookkeeper'];
    if (financePatterns.some(p => t.includes(p))) return 'finance';
    // HR/People
    if (/(recruiter|recruiting|people ops|people partner|talent|hr |human resources|sourcer|onboarding|enablement)/.test(t)) return 'hr-people';
    // Legal
    if (/(legal|counsel|compliance|policy|regulatory|paralegal|attorney)/.test(t)) return 'legal';
    // Support
    if (/(support specialist|customer support|premium support|help desk|safety specialist|support delivery)/.test(t)) return 'support';
    // Operations
    if (/(operations|ops |logistics|supply chain|procurement|coordinator|facilities|workplace|office manag)/.test(t)) return 'operations';
    return 'other';
}

function classifySeniority(title) {
    const t = title.toLowerCase();
    if (/\b(director|vp |vice president|head of|chief)\b/.test(t)) return 'director';
    if (/\b(lead|manager|engineering manager)\b/.test(t)) return 'lead';
    if (/\b(staff|principal|distinguished)\b/.test(t)) return 'staff';
    if (/\b(senior|sr\.?)\b/.test(t)) return 'senior';
    if (/\b(junior|jr\.?|intern|entry|associate|new grad)\b/.test(t)) return 'entry';
    return 'mid';
}

// Determine remote status from location
function isRemote(location) {
    return /remote/i.test(location);
}

// ─── Enrich jobs ───
const enrichedJobs = JOBS.map(j => ({
    ...j,
    role: classifyRole(j.title),
    seniority: classifySeniority(j.title),
    companyData: COMPANIES[j.company],
    companyValues: COMPANIES[j.company]?.values || [],
    isRemote: isRemote(j.location),
}));

// ─── HTML escape ───
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ─── Value descriptions for SEO content ───
const VALUE_DESCRIPTIONS = {
    'wlb': 'Companies that genuinely respect boundaries between work and personal life. Employees report sustainable hours, generous PTO, and managers who discourage overtime.',
    'remote': 'Companies with true remote-first or remote-friendly cultures. Work from anywhere policies, async communication, and no penalties for not being in an office.',
    'flex-hours': 'Companies that let you set your own schedule. No mandatory 9-5 — work when you\'re most productive, whether that\'s early morning or late night.',
    'async': 'Companies that default to asynchronous communication. Fewer meetings, more written documentation, and respect for deep focus time across time zones.',
    'deep-work': 'Companies that protect your focus time. Minimal meetings, no-meeting days, and a culture that values sustained concentration over constant collaboration.',
    'transparent': 'Companies that share information openly. All-hands updates, open financials, clear decision-making processes, and genuine psychological safety to speak up.',
    'flat': 'Companies with minimal management layers. Direct access to leadership, autonomy in decision-making, and a culture where good ideas win regardless of title.',
    'diverse': 'Companies with genuine commitments to diversity, equity, and inclusion. Diverse leadership teams, inclusive hiring practices, and employee resource groups.',
    'psych-safety': 'Companies where it\'s genuinely safe to take risks, make mistakes, and speak up. Blameless post-mortems, experimentation culture, and supportive management.',
    'eng-driven': 'Companies where engineers have real influence on product direction. Technical excellence is valued, engineers participate in roadmap decisions, and code quality matters.',
    'ship-fast': 'Companies that prioritize velocity and iteration. Short release cycles, minimal bureaucracy, and a bias toward action over perfect planning.',
    'open-source': 'Companies that contribute to and value open source. Engineers get time for OSS work, the company open-sources internal tools, and community contribution is respected.',
    'learning': 'Companies that invest in employee growth. Learning stipends, conference budgets, internal tech talks, mentorship programs, and time for skill development.',
    'equity': 'Companies known for strong total compensation. Competitive base salary, meaningful equity grants, top-tier benefits, and transparent compensation bands.',
    'product-impact': 'Companies where individual contributors can see the direct impact of their work. Small teams shipping to millions of users, with clear metrics and ownership.',
    'many-hats': 'Companies where you\'ll wear multiple hats. Ideal for generalists who want breadth — you might build features, talk to customers, and shape product strategy all in one week.',
    'ethical-ai': 'Companies with genuine commitments to AI safety and responsible development. Research into alignment, interpretability, and the societal impact of AI systems.',
    'social-impact': 'Companies driven by a mission beyond profit. Whether it\'s climate, education, health, or AI safety — the work connects to something larger.',
};

// ─── Role descriptions for SEO content ───
const ROLE_DESCRIPTIONS = {
    'ml-ai': 'Machine learning and AI roles: research scientists, ML engineers, NLP specialists, computer vision engineers, and AI researchers working on cutting-edge models.',
    'data': 'Data roles: data scientists, data engineers, analytics engineers, and business intelligence professionals building data infrastructure and extracting insights.',
    'design': 'Design roles: product designers, UX researchers, visual designers, and design system engineers creating beautiful, intuitive user experiences.',
    'engineering': 'Software engineering roles: frontend, backend, full-stack, DevOps, SRE, infrastructure, and platform engineers building scalable systems.',
    'product': 'Product management roles: product managers, product leads, and heads of product driving strategy, roadmaps, and cross-functional execution.',
    'marketing': 'Marketing roles: growth marketers, content strategists, SEO specialists, brand marketers, and communications professionals driving awareness and acquisition.',
    'sales': 'Sales and go-to-market roles: account executives, business development representatives, solutions engineers, and revenue leaders driving growth.',
    'finance': 'Finance roles: financial analysts, accountants, controllers, FP&A specialists, and treasury professionals managing financial operations.',
    'hr-people': 'People and HR roles: recruiters, people partners, talent acquisition leads, and HR business partners building great teams and culture.',
    'legal': 'Legal roles: counsel, compliance officers, policy analysts, and legal operations professionals navigating regulatory and legal landscapes.',
    'support': 'Support roles: customer success managers, support engineers, helpdesk specialists, and customer experience professionals ensuring user satisfaction.',
    'operations': 'Operations roles: operations managers, logistics specialists, supply chain professionals, and procurement specialists keeping the business running smoothly.',
};

// ─── Seniority descriptions for SEO content ───
const SENIORITY_DESCRIPTIONS = {
    'entry': { emoji: '🌱', tagline: 'Start your career at culture-first AI & tech companies', description: 'Entry-level and junior roles perfect for new graduates and early-career professionals. These companies invest in mentorship, onboarding, and growth — ideal for launching your tech career at a place that values culture.' },
    'mid': { emoji: '👤', tagline: 'Mid-level roles at companies that value culture', description: 'Mid-level roles for professionals with 2-5 years of experience. These positions offer the sweet spot of autonomy and mentorship at companies known for strong culture and values.' },
    'senior': { emoji: '⭐', tagline: 'Senior roles at top-rated AI & tech companies', description: 'Senior individual contributor roles at culture-first companies. Lead technical projects, mentor junior engineers, and shape product direction at companies that value your expertise and experience.' },
    'staff': { emoji: '🔷', tagline: 'Staff & principal roles at culture-driven companies', description: 'Staff and principal-level roles for deep technical experts. These positions offer org-wide technical influence at companies that respect senior IC career paths and culture.' },
    'lead': { emoji: '👥', tagline: 'Leadership roles at companies with strong culture scores', description: 'Team lead and engineering manager roles at culture-first companies. Build and manage high-performing teams while working at companies known for strong leadership practices.' },
    'director': { emoji: '🏛️', tagline: 'Director+ roles at culture-first companies', description: 'Director, VP, and executive-level roles at top-rated AI & tech companies. Shape strategy and culture at companies where leadership truly drives the mission.' },
};

// ─── Shared HTML template components ───
function navHtml(activeLabel) {
    return `<nav>
    <div class="nav-inner">
        <a href="/" class="nav-logo">
            <div class="nav-mark"><div class="ring ring-1"></div><div class="ring ring-2"></div><div class="nav-dot"></div></div>
            <div class="nav-wordmark">Jobs<span>By</span>Culture</div>
        </a>
        <div class="nav-links">
            <a href="/">Home</a>
            <a href="/jobs"${activeLabel==='jobs'?' class="active"':''}>Jobs</a>
            <a href="/compare">Compare</a>
            <a href="/directory">Culture Directory</a>
            <a href="/blog">Blog</a>
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
            <a href="/blog">Blog</a>
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

// ─── CSS (shared across all cluster pages) ───
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

        /* FOOTER */
        footer { padding: 56px 0 36px; border-top: 1px solid var(--border); }
        .ft-bar { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-3); }
        .ft-bar a { color: var(--accent); text-decoration: none; }
        .ft-links { display: flex; gap: 24px; margin-bottom: 20px; }
        .ft-links a { font-size: 13px; color: var(--text-2); text-decoration: none; }
        .ft-links a:hover { color: var(--text); }

        /* SEO CONTENT */
        .cl-content { padding: 0 0 40px; }
        .cl-content h2 { font-family: var(--font-display); font-size: 24px; font-weight: 400; margin-bottom: 12px; }
        .cl-content p { font-size: 15px; color: var(--text-2); line-height: 1.7; margin-bottom: 16px; max-width: 720px; }

        @media (max-width: 768px) {
            .hamburger { display: flex; }
            .nav-links { display: none; position: absolute; top: 100%; left: 0; right: 0; background: rgba(250,250,248,0.98); backdrop-filter: blur(20px); border-bottom: 1px solid var(--border); padding: 20px 24px; flex-direction: column; gap: 16px; }
            .nav-links.open { display: flex; }
            .cl-hero { padding: 100px 0 36px; }
            .cl-company-grid { grid-template-columns: 1fr; }
            .cl-stats { gap: 20px; }
            .cl-related-grid { grid-template-columns: 1fr 1fr; }
        }
    </style>`;

// ─── Build job card HTML ───

// ─── Spread jobs so same company doesn't appear consecutively ───
function spreadByCompany(jobs) {
    const companies = new Set(jobs.map(j => j.company));
    if (companies.size <= 1) return jobs;
    const groups = {};
    jobs.forEach(j => { if (!groups[j.company]) groups[j.company] = []; groups[j.company].push(j); });
    const buckets = Object.values(groups).sort((a, b) => b.length - a.length);
    const result = [];
    let idx = 0;
    while (result.length < jobs.length) {
        for (const g of buckets) { if (idx < g.length) result.push(g[idx]); }
        idx++;
    }
    return result;
}
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

// ─── Generate a VALUE page ───
function generateValuePage(valueSlug) {
    const val = VALUES[valueSlug];
    if (!val) return null;

    // Find companies with this value
    const matchingCompanies = Object.keys(COMPANIES).filter(slug =>
        COMPANIES[slug].values && COMPANIES[slug].values.includes(valueSlug)
    );

    // Find jobs at those companies
    const matchingJobs = enrichedJobs.filter(j => matchingCompanies.includes(j.company));
    if (matchingJobs.length === 0) return null;

    // Group by role
    const byRole = {};
    matchingJobs.forEach(j => {
        if (!byRole[j.role]) byRole[j.role] = [];
        byRole[j.role].push(j);
    });

    const title = `${val.name} Jobs at AI & Tech Companies | JobsByCulture`;
    const desc = `Browse ${matchingJobs.length} jobs at ${matchingCompanies.length} companies that value ${val.name.toLowerCase()}. ${VALUE_DESCRIPTIONS[valueSlug] || ''}`.slice(0, 160);
    const canonical = `https://jobsbyculture.com/values/${valueSlug}`;
    const showJobs = spreadByCompany(matchingJobs).slice(0, 20);

    // Related: roles that have jobs with this value
    const relatedRoles = Object.entries(byRole)
        .filter(([r]) => r !== 'other' && ROLES[r])
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 8);

    // Related values
    const relatedValues = Object.keys(VALUES).filter(v => v !== valueSlug);

    const ogUrl = `https://jobsbyculture.com/api/og?type=value&slug=${valueSlug}`;
    let html = headHtml(title, desc, canonical, ogUrl) + sharedCSS + `
</head>
<body>
${navHtml('jobs')}

<section class="cl-hero">
    <div class="container">
        <div class="cl-hero-pill"><span class="cl-hero-pill-dot"></span>${esc(val.name)}</div>
        <h1>${esc(val.ico)} <em>${esc(val.name)}</em> Jobs</h1>
        <p class="cl-hero-sub">${esc(VALUE_DESCRIPTIONS[valueSlug] || `Jobs at companies known for ${val.name.toLowerCase()}.`)}</p>
        <div class="cl-stats">
            <div class="cl-stat"><div class="cl-stat-val">${matchingJobs.length}</div><div class="cl-stat-label">Open Roles</div></div>
            <div class="cl-stat"><div class="cl-stat-val">${matchingCompanies.length}</div><div class="cl-stat-label">Companies</div></div>
        </div>
    </div>
</section>

<section class="cl-companies">
    <div class="container">
        <h2 class="cl-section-title">Companies that value <em>${esc(val.name.toLowerCase())}</em></h2>
        <div class="cl-company-grid">
${matchingCompanies.map(s => companyCardHtml(s)).filter(Boolean).join('\n')}
        </div>
    </div>
</section>

<section class="cl-jobs">
    <div class="container">
        <h2 class="cl-section-title">Latest ${esc(val.name)} jobs</h2>
        <div class="cl-job-list">
${showJobs.map(j => jobCardHtml(j)).join('\n')}
        </div>
        <a href="/jobs?value=${esc(valueSlug)}" class="cl-show-more">View all ${matchingJobs.length} jobs &rarr;</a>
    </div>
</section>`;

    // Related cross-links
    if (relatedRoles.length > 0) {
        html += `
<section class="cl-related">
    <div class="container">
        <h2 class="cl-section-title">Browse by role</h2>
        <div class="cl-related-grid">
${relatedRoles.map(([r, jobs]) => {
    const roleName = ROLES[r]?.name || r;
    return `            <a href="/roles/${esc(valueSlug)}/${esc(r)}" class="cl-related-link">${esc(val.name)} ${esc(roleName)} Jobs <span class="count">${jobs.length}</span></a>`;
}).join('\n')}
        </div>
    </div>
</section>`;
    }

    // Related values
    html += `
<section class="cl-related">
    <div class="container">
        <h2 class="cl-section-title">Other culture values</h2>
        <div class="cl-related-grid">
${relatedValues.slice(0, 8).map(v => {
    const vData = VALUES[v];
    const count = enrichedJobs.filter(j => (COMPANIES[j.company]?.values || []).includes(v)).length;
    return `            <a href="/values/${esc(v)}" class="cl-related-link">${esc(vData.ico)} ${esc(vData.name)} <span class="count">${count}</span></a>`;
}).join('\n')}
        </div>
    </div>
</section>

${footerHtml()}
</body>
</html>`;

    return { slug: valueSlug, html, path: `values/${valueSlug}.html`, jobs: matchingJobs.length };
}

// ─── Generate a ROLE page ───
function generateRolePage(roleSlug) {
    const role = ROLES[roleSlug];
    if (!role) return null;

    const matchingJobs = enrichedJobs.filter(j => j.role === roleSlug);
    if (matchingJobs.length === 0) return null;

    // Companies that have jobs in this role
    const companySet = new Set(matchingJobs.map(j => j.company));
    const matchingCompanies = [...companySet].filter(s => COMPANIES[s]);

    const title = `${role.name} Jobs at AI & Tech Companies | JobsByCulture`;
    const desc = `Browse ${matchingJobs.length} ${role.name.toLowerCase()} jobs at ${matchingCompanies.length} AI & tech companies. ${ROLE_DESCRIPTIONS[roleSlug] || ''}`.slice(0, 160);
    const canonical = `https://jobsbyculture.com/roles/${roleSlug}`;
    const showJobs = spreadByCompany(matchingJobs).slice(0, 20);

    // Related: values that these companies have
    const valueCounts = {};
    matchingJobs.forEach(j => {
        (j.companyValues || []).forEach(v => {
            valueCounts[v] = (valueCounts[v] || 0) + 1;
        });
    });
    const topValues = Object.entries(valueCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    const ogUrl = `https://jobsbyculture.com/api/og?type=role&slug=${roleSlug}`;
    let html = headHtml(title, desc, canonical, ogUrl) + sharedCSS + `
</head>
<body>
${navHtml('jobs')}

<section class="cl-hero">
    <div class="container">
        <div class="cl-hero-pill"><span class="cl-hero-pill-dot"></span>${esc(role.name)}</div>
        <h1>${esc(role.ico)} <em>${esc(role.name)}</em> Jobs</h1>
        <p class="cl-hero-sub">${esc(ROLE_DESCRIPTIONS[roleSlug] || `${role.name} jobs at top AI & tech companies.`)}</p>
        <div class="cl-stats">
            <div class="cl-stat"><div class="cl-stat-val">${matchingJobs.length}</div><div class="cl-stat-label">Open Roles</div></div>
            <div class="cl-stat"><div class="cl-stat-val">${matchingCompanies.length}</div><div class="cl-stat-label">Companies</div></div>
        </div>
    </div>
</section>

<section class="cl-companies">
    <div class="container">
        <h2 class="cl-section-title">Companies hiring for <em>${esc(role.name.toLowerCase())}</em></h2>
        <div class="cl-company-grid">
${matchingCompanies.map(s => companyCardHtml(s)).filter(Boolean).join('\n')}
        </div>
    </div>
</section>

<section class="cl-jobs">
    <div class="container">
        <h2 class="cl-section-title">Latest ${esc(role.name)} jobs</h2>
        <div class="cl-job-list">
${showJobs.map(j => jobCardHtml(j)).join('\n')}
        </div>
        <a href="/jobs?role=${esc(roleSlug)}" class="cl-show-more">View all ${matchingJobs.length} jobs &rarr;</a>
    </div>
</section>`;

    // Cross-links by value
    if (topValues.length > 0) {
        html += `
<section class="cl-related">
    <div class="container">
        <h2 class="cl-section-title">${esc(role.name)} jobs by culture</h2>
        <div class="cl-related-grid">
${topValues.map(([v, count]) => {
    const vData = VALUES[v];
    if (!vData) return '';
    return `            <a href="/roles/${esc(v)}/${esc(roleSlug)}" class="cl-related-link">${esc(vData.ico)} ${esc(vData.name)} ${esc(role.name)} <span class="count">${count}</span></a>`;
}).filter(Boolean).join('\n')}
        </div>
    </div>
</section>`;
    }

    // Browse by Seniority for this role
    const seniorityLinks = Object.keys(SENIORITIES).map(s => {
        const senData = SENIORITIES[s];
        const senDesc = SENIORITY_DESCRIPTIONS[s];
        const count = enrichedJobs.filter(j => j.seniority === s && j.role === roleSlug).length;
        if (count < 5) return '';
        return `            <a href="/seniority/${esc(s)}/${esc(roleSlug)}" class="cl-related-link">${senDesc?.emoji || ''} ${esc(senData.name)} ${esc(role.name)} <span class="count">${count}</span></a>`;
    }).filter(Boolean);

    if (seniorityLinks.length > 0) {
        html += `
<section class="cl-related">
    <div class="container">
        <h2 class="cl-section-title">${esc(role.name)} jobs by seniority</h2>
        <div class="cl-related-grid">
${seniorityLinks.join('\n')}
        </div>
    </div>
</section>`;
    }

    // Other roles
    const otherRoles = Object.keys(ROLES).filter(r => r !== roleSlug);
    html += `
<section class="cl-related">
    <div class="container">
        <h2 class="cl-section-title">Other role categories</h2>
        <div class="cl-related-grid">
${otherRoles.map(r => {
    const rData = ROLES[r];
    const count = enrichedJobs.filter(j => j.role === r).length;
    if (count === 0) return '';
    return `            <a href="/roles/${esc(r)}" class="cl-related-link">${esc(rData.ico)} ${esc(rData.name)} <span class="count">${count}</span></a>`;
}).filter(Boolean).join('\n')}
        </div>
    </div>
</section>

${footerHtml()}
</body>
</html>`;

    return { slug: roleSlug, html, path: `roles/${roleSlug}.html`, jobs: matchingJobs.length };
}

// ─── Generate a SENIORITY page ───
function generateSeniorityPage(senioritySlug) {
    const sen = SENIORITIES[senioritySlug];
    const desc_data = SENIORITY_DESCRIPTIONS[senioritySlug];
    if (!sen || !desc_data) return null;

    const matchingJobs = enrichedJobs.filter(j => j.seniority === senioritySlug);
    if (matchingJobs.length === 0) return null;

    const companySet = new Set(matchingJobs.map(j => j.company));
    const matchingCompanies = [...companySet].filter(s => COMPANIES[s]);

    // Group by role
    const byRole = {};
    matchingJobs.forEach(j => {
        if (!byRole[j.role]) byRole[j.role] = [];
        byRole[j.role].push(j);
    });

    const title = `${sen.name} Jobs at AI & Tech Companies | JobsByCulture`;
    const metaDesc = `Browse ${matchingJobs.length} ${sen.name.toLowerCase()} jobs at ${matchingCompanies.length} AI & tech companies. ${desc_data.tagline}.`.slice(0, 160);
    const canonical = `https://jobsbyculture.com/seniority/${senioritySlug}`;
    const showJobs = spreadByCompany(matchingJobs).slice(0, 20);

    const relatedRoles = Object.entries(byRole)
        .filter(([r]) => r !== 'other' && ROLES[r])
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 8);

    const ogUrl = `https://jobsbyculture.com/api/og?type=seniority&slug=${senioritySlug}`;
    let html = headHtml(title, metaDesc, canonical, ogUrl) + sharedCSS + `
</head>
<body>
${navHtml('jobs')}

<section class="cl-hero">
    <div class="container">
        <div class="cl-hero-pill"><span class="cl-hero-pill-dot"></span>${esc(sen.name)}</div>
        <h1>${desc_data.emoji} <em>${esc(sen.name)}</em> Jobs</h1>
        <p class="cl-hero-sub">${esc(desc_data.description)}</p>
        <div class="cl-stats">
            <div class="cl-stat"><div class="cl-stat-val">${matchingJobs.length}</div><div class="cl-stat-label">Open Roles</div></div>
            <div class="cl-stat"><div class="cl-stat-val">${matchingCompanies.length}</div><div class="cl-stat-label">Companies</div></div>
        </div>
    </div>
</section>

<section class="cl-companies">
    <div class="container">
        <h2 class="cl-section-title">Companies hiring <em>${esc(sen.name.toLowerCase())}</em> roles</h2>
        <div class="cl-company-grid">
${matchingCompanies.map(s => companyCardHtml(s)).filter(Boolean).join('\n')}
        </div>
    </div>
</section>

<section class="cl-jobs">
    <div class="container">
        <h2 class="cl-section-title">Latest ${esc(sen.name)} jobs</h2>
        <div class="cl-job-list">
${showJobs.map(j => jobCardHtml(j)).join('\n')}
        </div>
        <a href="/jobs?seniority=${esc(senioritySlug)}" class="cl-show-more">View all ${matchingJobs.length} jobs &rarr;</a>
    </div>
</section>`;

    // Cross-links: seniority × role
    if (relatedRoles.length > 0) {
        html += `
<section class="cl-related">
    <div class="container">
        <h2 class="cl-section-title">${esc(sen.name)} jobs by role</h2>
        <div class="cl-related-grid">
${relatedRoles.map(([r, jobs]) => {
    const roleName = ROLES[r]?.name || r;
    if (jobs.length < 5) return '';
    return `            <a href="/seniority/${esc(senioritySlug)}/${esc(r)}" class="cl-related-link">${desc_data.emoji} ${esc(sen.name)} ${esc(roleName)} <span class="count">${jobs.length}</span></a>`;
}).filter(Boolean).join('\n')}
        </div>
    </div>
</section>`;
    }

    // Other seniority levels
    const otherSeniorities = Object.keys(SENIORITIES).filter(s => s !== senioritySlug);
    html += `
<section class="cl-related">
    <div class="container">
        <h2 class="cl-section-title">Other seniority levels</h2>
        <div class="cl-related-grid">
${otherSeniorities.map(s => {
    const sData = SENIORITIES[s];
    const sDesc = SENIORITY_DESCRIPTIONS[s];
    const count = enrichedJobs.filter(j => j.seniority === s).length;
    if (count === 0) return '';
    return `            <a href="/seniority/${esc(s)}" class="cl-related-link">${sDesc?.emoji || ''} ${esc(sData.name)} <span class="count">${count}</span></a>`;
}).filter(Boolean).join('\n')}
        </div>
    </div>
</section>

${footerHtml()}
</body>
</html>`;

    return { slug: senioritySlug, html, path: `seniority/${senioritySlug}.html`, jobs: matchingJobs.length };
}

// ─── Generate a SENIORITY × ROLE page ───
function generateSeniorityRolePage(senioritySlug, roleSlug) {
    const sen = SENIORITIES[senioritySlug];
    const role = ROLES[roleSlug];
    const desc_data = SENIORITY_DESCRIPTIONS[senioritySlug];
    if (!sen || !role || !desc_data) return null;

    const matchingJobs = enrichedJobs.filter(j =>
        j.seniority === senioritySlug && j.role === roleSlug
    );

    if (matchingJobs.length < 5) return null;

    const companySet = new Set(matchingJobs.map(j => j.company));
    const matchingCompanies = [...companySet].filter(s => COMPANIES[s]);

    const title = `${sen.name} ${role.name} Jobs | AI & Tech Companies | JobsByCulture`;
    const metaDesc = `${matchingJobs.length} ${sen.name.toLowerCase()} ${role.name.toLowerCase()} jobs at ${matchingCompanies.length} companies. Find ${sen.name.toLowerCase()} ${role.name.toLowerCase()} roles at culture-first companies.`.slice(0, 160);
    const canonical = `https://jobsbyculture.com/seniority/${senioritySlug}/${roleSlug}`;
    const showJobs = spreadByCompany(matchingJobs).slice(0, 20);

    const ogUrl = `https://jobsbyculture.com/api/og?type=seniority&slug=${senioritySlug}&role=${roleSlug}`;
    let html = headHtml(title, metaDesc, canonical, ogUrl) + sharedCSS + `
</head>
<body>
${navHtml('jobs')}

<section class="cl-hero">
    <div class="container">
        <div class="cl-hero-pill"><span class="cl-hero-pill-dot"></span>${esc(sen.name)} + ${esc(role.name)}</div>
        <h1>${desc_data.emoji} <em>${esc(sen.name)}</em> ${esc(role.name)} Jobs</h1>
        <p class="cl-hero-sub">${esc(sen.name)} ${esc(role.name.toLowerCase())} roles at companies known for strong culture. ${esc(desc_data.tagline)}.</p>
        <div class="cl-stats">
            <div class="cl-stat"><div class="cl-stat-val">${matchingJobs.length}</div><div class="cl-stat-label">Open Roles</div></div>
            <div class="cl-stat"><div class="cl-stat-val">${matchingCompanies.length}</div><div class="cl-stat-label">Companies</div></div>
        </div>
    </div>
</section>

<section class="cl-companies">
    <div class="container">
        <h2 class="cl-section-title">Companies hiring</h2>
        <div class="cl-company-grid">
${matchingCompanies.map(s => companyCardHtml(s)).filter(Boolean).join('\n')}
        </div>
    </div>
</section>

<section class="cl-jobs">
    <div class="container">
        <h2 class="cl-section-title">Open ${esc(sen.name.toLowerCase())} ${esc(role.name.toLowerCase())} roles</h2>
        <div class="cl-job-list">
${showJobs.map(j => jobCardHtml(j)).join('\n')}
        </div>
        <a href="/jobs?seniority=${esc(senioritySlug)}&role=${esc(roleSlug)}" class="cl-show-more">View all ${matchingJobs.length} jobs &rarr;</a>
    </div>
</section>

<section class="cl-related">
    <div class="container">
        <h2 class="cl-section-title">Related pages</h2>
        <div class="cl-related-grid">
            <a href="/seniority/${esc(senioritySlug)}" class="cl-related-link">${desc_data.emoji} All ${esc(sen.name)} Jobs</a>
            <a href="/roles/${esc(roleSlug)}" class="cl-related-link">${esc(role.ico)} All ${esc(role.name)} Jobs</a>
${Object.keys(SENIORITIES).filter(s => s !== senioritySlug).map(s => {
    const otherSen = SENIORITIES[s];
    const otherDesc = SENIORITY_DESCRIPTIONS[s];
    const count = enrichedJobs.filter(j => j.seniority === s && j.role === roleSlug).length;
    if (count < 5) return '';
    return `            <a href="/seniority/${esc(s)}/${esc(roleSlug)}" class="cl-related-link">${otherDesc?.emoji || ''} ${esc(otherSen.name)} ${esc(role.name)} <span class="count">${count}</span></a>`;
}).filter(Boolean).join('\n')}
        </div>
    </div>
</section>

${footerHtml()}
</body>
</html>`;

    return { slug: `${senioritySlug}/${roleSlug}`, html, path: `seniority/${senioritySlug}/${roleSlug}.html`, jobs: matchingJobs.length };
}

// ─── Generate a CROSS page (value + role) ───
function generateCrossPage(valueSlug, roleSlug) {
    const val = VALUES[valueSlug];
    const role = ROLES[roleSlug];
    if (!val || !role) return null;

    // Find companies with this value
    const valueCompanies = Object.keys(COMPANIES).filter(slug =>
        COMPANIES[slug].values && COMPANIES[slug].values.includes(valueSlug)
    );

    // Find jobs at those companies with this role
    const matchingJobs = enrichedJobs.filter(j =>
        valueCompanies.includes(j.company) && j.role === roleSlug
    );

    if (matchingJobs.length < 3) return null;

    const companySet = new Set(matchingJobs.map(j => j.company));
    const matchingCompanies = [...companySet].filter(s => COMPANIES[s]);

    const title = `${val.name} ${role.name} Jobs | AI & Tech Companies | JobsByCulture`;
    const desc = `${matchingJobs.length} ${role.name.toLowerCase()} jobs at ${matchingCompanies.length} companies with ${val.name.toLowerCase()} culture. Find ${role.name.toLowerCase()} roles that match how you work.`.slice(0, 160);
    const canonical = `https://jobsbyculture.com/roles/${valueSlug}/${roleSlug}`;
    const showJobs = spreadByCompany(matchingJobs).slice(0, 20);

    const ogUrl = `https://jobsbyculture.com/api/og?type=value&slug=${valueSlug}`;
    let html = headHtml(title, desc, canonical, ogUrl) + sharedCSS + `
</head>
<body>
${navHtml('jobs')}

<section class="cl-hero">
    <div class="container">
        <div class="cl-hero-pill"><span class="cl-hero-pill-dot"></span>${esc(val.name)} + ${esc(role.name)}</div>
        <h1>${esc(val.ico)} <em>${esc(val.name)}</em> ${esc(role.name)} Jobs</h1>
        <p class="cl-hero-sub">${esc(role.name)} roles at companies known for ${esc(val.name.toLowerCase())}. ${esc(VALUE_DESCRIPTIONS[valueSlug] || '')}</p>
        <div class="cl-stats">
            <div class="cl-stat"><div class="cl-stat-val">${matchingJobs.length}</div><div class="cl-stat-label">Open Roles</div></div>
            <div class="cl-stat"><div class="cl-stat-val">${matchingCompanies.length}</div><div class="cl-stat-label">Companies</div></div>
        </div>
    </div>
</section>

<section class="cl-companies">
    <div class="container">
        <h2 class="cl-section-title">Companies hiring</h2>
        <div class="cl-company-grid">
${matchingCompanies.map(s => companyCardHtml(s)).filter(Boolean).join('\n')}
        </div>
    </div>
</section>

<section class="cl-jobs">
    <div class="container">
        <h2 class="cl-section-title">Open ${esc(role.name.toLowerCase())} roles</h2>
        <div class="cl-job-list">
${showJobs.map(j => jobCardHtml(j)).join('\n')}
        </div>
        <a href="/jobs?value=${esc(valueSlug)}&role=${esc(roleSlug)}" class="cl-show-more">View all ${matchingJobs.length} jobs &rarr;</a>
    </div>
</section>

<section class="cl-related">
    <div class="container">
        <h2 class="cl-section-title">Related pages</h2>
        <div class="cl-related-grid">
            <a href="/values/${esc(valueSlug)}" class="cl-related-link">${esc(val.ico)} All ${esc(val.name)} Jobs</a>
            <a href="/roles/${esc(roleSlug)}" class="cl-related-link">${esc(role.ico)} All ${esc(role.name)} Jobs</a>
        </div>
    </div>
</section>

${footerHtml()}
</body>
</html>`;

    return { slug: `${valueSlug}/${roleSlug}`, html, path: `roles/${valueSlug}/${roleSlug}.html`, jobs: matchingJobs.length };
}

// ─── Main build ───
console.log('Building cluster pages...\n');

const generated = [];

// Ensure directories
for (const dir of ['values', 'roles']) {
    const p = resolve(ROOT, dir);
    if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

// 1. Value pages
for (const valueSlug of Object.keys(VALUES)) {
    const result = generateValuePage(valueSlug);
    if (result) {
        writeFileSync(resolve(ROOT, result.path), result.html);
        generated.push(result);
        console.log(`  [value] ${result.path} (${result.jobs} jobs)`);
    }
}

// 2. Role pages
for (const roleSlug of Object.keys(ROLES)) {
    const result = generateRolePage(roleSlug);
    if (result) {
        writeFileSync(resolve(ROOT, result.path), result.html);
        generated.push(result);
        console.log(`  [role]  ${result.path} (${result.jobs} jobs)`);
    }
}

// 3. Cross pages (value × role)
for (const valueSlug of Object.keys(VALUES)) {
    for (const roleSlug of Object.keys(ROLES)) {
        // Ensure subdirectory exists
        const subdir = resolve(ROOT, 'roles', valueSlug);
        if (!existsSync(subdir)) mkdirSync(subdir, { recursive: true });

        const result = generateCrossPage(valueSlug, roleSlug);
        if (result) {
            writeFileSync(resolve(ROOT, result.path), result.html);
            generated.push(result);
            console.log(`  [cross] ${result.path} (${result.jobs} jobs)`);
        }
    }
}

// 4. Seniority pages
const seniorityDir = resolve(ROOT, 'seniority');
if (!existsSync(seniorityDir)) mkdirSync(seniorityDir, { recursive: true });

for (const senioritySlug of Object.keys(SENIORITIES)) {
    const result = generateSeniorityPage(senioritySlug);
    if (result) {
        writeFileSync(resolve(ROOT, result.path), result.html);
        generated.push(result);
        console.log(`  [seniority] ${result.path} (${result.jobs} jobs)`);
    }

    // Seniority × Role cross pages
    const subdir = resolve(ROOT, 'seniority', senioritySlug);
    if (!existsSync(subdir)) mkdirSync(subdir, { recursive: true });

    for (const roleSlug of Object.keys(ROLES)) {
        const crossResult = generateSeniorityRolePage(senioritySlug, roleSlug);
        if (crossResult) {
            writeFileSync(resolve(ROOT, crossResult.path), crossResult.html);
            generated.push(crossResult);
            console.log(`  [sen×role] ${crossResult.path} (${crossResult.jobs} jobs)`);
        }
    }
}

console.log(`\nGenerated ${generated.length} cluster pages.`);

// ─── Update sitemap.xml ───
const sitemapPath = resolve(ROOT, 'sitemap.xml');
let sitemap = readFileSync(sitemapPath, 'utf-8');

// Remove old cluster entries (with or without end marker)
sitemap = sitemap.replace(/\s*<!-- Cluster pages -->[\s\S]*?(?:<!-- \/Cluster pages -->\n?|(?=\s*<!--\s|<\/urlset>))/, '\n');

// Add new entries
const today = new Date().toISOString().slice(0, 10);
let clusterEntries = '\n  <!-- Cluster pages -->';
for (const page of generated) {
    const loc = `https://jobsbyculture.com/${page.path.replace('.html', '')}`;
    // Seniority top-level pages get 0.6, seniority×role get 0.5, others get 0.6
    let priority = '0.6';
    if (page.path.startsWith('seniority/') && page.path.split('/').length > 2) {
        priority = '0.5';
    }
    clusterEntries += `
  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
}
clusterEntries += '  <!-- /Cluster pages -->\n';

sitemap = sitemap.replace('</urlset>', clusterEntries + '</urlset>');
writeFileSync(sitemapPath, sitemap);
console.log(`Updated sitemap.xml with ${generated.length} cluster page URLs.`);
