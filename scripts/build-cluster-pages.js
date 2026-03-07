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

// ─── Classify helpers (same logic as export script) ───
function classifyRole(title) {
    const t = title.toLowerCase();
    if (/\b(machine learning|ml |ml\/|deep learning|ai research|ai scientist|llm|nlp|computer vision|cv engineer)\b/.test(t)) return 'ml-ai';
    if (/\b(data scien|data eng|data analy|analytics|business intel)\b/.test(t)) return 'data';
    if (/\b(design|ux|ui |visual|brand design|graphic)\b/.test(t)) return 'design';
    if (/\b(engineer|developer|swe|software|frontend|backend|fullstack|full-stack|devops|sre|infrastructure|platform)\b/.test(t)) return 'engineering';
    if (/\b(product manage|product lead|pm |head of product)\b/.test(t)) return 'product';
    if (/\b(marketing|growth|content|seo|communications|brand)\b/.test(t)) return 'marketing';
    if (/\b(sales|account exec|business develop|revenue|gtm|go-to-market|solutions)\b/.test(t)) return 'sales';
    if (/\b(finance|accounting|controller|treasury|fp&a)\b/.test(t)) return 'finance';
    if (/\b(recruiter|people|hr |talent|human resources)\b/.test(t)) return 'hr-people';
    if (/\b(legal|counsel|compliance|policy)\b/.test(t)) return 'legal';
    if (/\b(support|customer success|helpdesk)\b/.test(t)) return 'support';
    if (/\b(operations|ops |logistics|supply chain|procurement)\b/.test(t)) return 'operations';
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
            <a href="/directory">Companies</a>
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
            <a href="/directory">Company Directory</a>
            <a href="/values/remote">By Culture</a>
            <a href="/roles/engineering">By Role</a>
        </div>
        <div class="ft-bar">
            <p>&copy; 2026 JobsByCulture</p>
            <p>Made by <a href="https://x.com/itspradz" target="_blank">@itspradz</a></p>
        </div>
    </div>
</footer>`;
}

function headHtml(title, description, canonical) {
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
    <meta property="og:image" content="https://jobsbyculture.com/og-image.png?v=5">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(title)}">
    <meta name="twitter:description" content="${esc(description)}">
    <meta name="twitter:image" content="https://jobsbyculture.com/og-image.png?v=5">
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
    const showJobs = matchingJobs.slice(0, 20);

    // Related: roles that have jobs with this value
    const relatedRoles = Object.entries(byRole)
        .filter(([r]) => r !== 'other' && ROLES[r])
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 8);

    // Related values
    const relatedValues = Object.keys(VALUES).filter(v => v !== valueSlug);

    let html = headHtml(title, desc, canonical) + sharedCSS + `
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
    const showJobs = matchingJobs.slice(0, 20);

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

    let html = headHtml(title, desc, canonical) + sharedCSS + `
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
    const showJobs = matchingJobs.slice(0, 20);

    let html = headHtml(title, desc, canonical) + sharedCSS + `
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

console.log(`\nGenerated ${generated.length} cluster pages.`);

// ─── Update sitemap.xml ───
const sitemapPath = resolve(ROOT, 'sitemap.xml');
let sitemap = readFileSync(sitemapPath, 'utf-8');

// Remove old cluster entries
sitemap = sitemap.replace(/\s*<!-- Cluster pages -->[\s\S]*?(?=<\/urlset>)/, '\n');

// Add new entries
const today = new Date().toISOString().slice(0, 10);
let clusterEntries = '\n  <!-- Cluster pages -->';
for (const page of generated) {
    const loc = `https://jobsbyculture.com/${page.path.replace('.html', '')}`;
    clusterEntries += `
  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
}
clusterEntries += '\n';

sitemap = sitemap.replace('</urlset>', clusterEntries + '</urlset>');
writeFileSync(sitemapPath, sitemap);
console.log(`Updated sitemap.xml with ${generated.length} cluster page URLs.`);
