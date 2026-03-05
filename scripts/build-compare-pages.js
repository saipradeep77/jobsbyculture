#!/usr/bin/env node
/**
 * Build script for static SEO compare pages.
 * Reads pairs from /data/compare-pairs.json, generates /compare/{a}-vs-{b}.html
 * and updates sitemap.xml.
 *
 * Usage: ANTHROPIC_API_KEY=sk-... node scripts/build-compare-pages.js
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── Load data ───
const pairs = JSON.parse(readFileSync(resolve(ROOT, 'data/compare-pairs.json'), 'utf-8'));
const cachePath = resolve(ROOT, 'data/company-cache.json');
let cache = {};
try { cache = JSON.parse(readFileSync(cachePath, 'utf-8')); } catch { cache = {}; }

// ─── Read compare.html to extract COMPANIES and COMPANY_REVIEWS data ───
const compareHtml = readFileSync(resolve(ROOT, 'compare.html'), 'utf-8');

// Extract the COMPANIES object
function extractJSObject(src, varName) {
    const regex = new RegExp('const ' + varName + ' = (\\{[\\s\\S]*?\\});', 'm');
    const m = src.match(regex);
    if (!m) return {};
    try {
        return new Function('return ' + m[1])();
    } catch {
        return {};
    }
}

const COMPANIES = extractJSObject(compareHtml, 'COMPANIES');
const COMPANY_REVIEWS = extractJSObject(compareHtml, 'COMPANY_REVIEWS');
const CRC = extractJSObject(compareHtml, 'CRC');

const VALID_VALUES = [
    'wlb','remote','flex-hours','async','deep-work','transparent','flat',
    'diverse','psych-safety','eng-driven','ship-fast','open-source',
    'learning','equity','product-impact','many-hats','ethical-ai','social-impact'
];

const VALUES_META = {
    'wlb': { ico: '\u2696\uFE0F', name: 'Work-Life Balance', color: 'teal' },
    'remote': { ico: '\uD83C\uDF10', name: 'Remote-Friendly', color: 'teal' },
    'flex-hours': { ico: '\uD83D\uDD50', name: 'Flexible Hours', color: 'teal' },
    'async': { ico: '\uD83D\uDCE1', name: 'Async-First', color: 'teal' },
    'deep-work': { ico: '\uD83C\uDFA7', name: 'Deep Work / Low Meetings', color: 'teal' },
    'transparent': { ico: '\uD83E\uDE9F', name: 'Transparent Culture', color: 'violet' },
    'flat': { ico: '\uD83E\uDD1D', name: 'Flat Hierarchy', color: 'violet' },
    'diverse': { ico: '\uD83C\uDF08', name: 'Diverse & Inclusive', color: 'violet' },
    'psych-safety': { ico: '\uD83D\uDEE1\uFE0F', name: 'Safe to Fail', color: 'violet' },
    'eng-driven': { ico: '\u2699\uFE0F', name: 'Engineering-Driven', color: 'sky' },
    'ship-fast': { ico: '\uD83D\uDE80', name: 'Ship Fast & Iterate', color: 'sky' },
    'open-source': { ico: '\uD83D\uDD13', name: 'Open Source Culture', color: 'sky' },
    'learning': { ico: '\uD83C\uDF31', name: 'Learning & Growth', color: 'orange' },
    'equity': { ico: '\uD83D\uDC8E', name: 'Strong Comp & Equity', color: 'orange' },
    'product-impact': { ico: '\uD83C\uDFAF', name: 'Direct Product Impact', color: 'orange' },
    'many-hats': { ico: '\uD83E\uDDE9', name: 'Wears Many Hats', color: 'orange' },
    'ethical-ai': { ico: '\uD83E\uDD16', name: 'Ethical AI / Safety', color: 'rose' },
    'social-impact': { ico: '\uD83D\uDC9C', name: 'Mission-Driven', color: 'rose' },
};

const ROLES = {
    'ml-ai': { name: 'ML / AI', ico: '\uD83E\uDDE0' },
    'data': { name: 'Data', ico: '\uD83D\uDCCA' },
    'design': { name: 'Design', ico: '\uD83C\uDFA8' },
    'engineering': { name: 'Engineering', ico: '\uD83D\uDCBB' },
    'product': { name: 'Product', ico: '\uD83D\uDCCB' },
    'marketing': { name: 'Marketing', ico: '\uD83D\uDCE3' },
    'sales': { name: 'Sales / GTM', ico: '\uD83D\uDCBC' },
    'finance': { name: 'Finance', ico: '\uD83D\uDCB0' },
    'hr-people': { name: 'HR / People', ico: '\uD83D\uDC64' },
    'legal': { name: 'Legal', ico: '\u2696\uFE0F' },
    'support': { name: 'Support', ico: '\uD83C\uDFA7' },
    'operations': { name: 'Operations', ico: '\u2699\uFE0F' },
};

// ─── Get company data (hardcoded or cached or API) ───
function getOnsiteData(slug) {
    const c = COMPANIES[slug];
    if (!c) return null;
    const r = COMPANY_REVIEWS[slug] || { pros: [], cons: [] };
    return {
        name: c.name, slug, logo: c.logo, size: c.size,
        glassdoor: c.glassdoor, wlb_score: c.wlb_score,
        culture_values: c.culture_values, comp_benefits: c.comp_benefits,
        senior_mgmt: c.senior_mgmt, career_opps: c.career_opps,
        recommend: c.recommend, ceo_approval: c.ceo_approval,
        ceo_name: c.ceo_name, bestFor: c.bestFor, verdict: c.verdict,
        values: c.values, pros: r.pros, cons: r.cons,
        careers: c.careers, roleCounts: CRC[slug] || {}, onsite: true
    };
}

async function getCompanyData(slug, client) {
    // 1. Check hardcoded
    const onsite = getOnsiteData(slug);
    if (onsite) return onsite;

    // 2. Check cache
    if (cache[slug]) {
        console.log(`  [cache] ${slug}`);
        return cache[slug];
    }

    // 3. Call Claude API
    const name = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    console.log(`  [api] Fetching ${name}...`);

    const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
            role: 'user',
            content: `You are a company culture analyst. Given the company "${name}", return a JSON object with your best knowledge of their culture. Use ONLY these exact value slugs for the "values" array (pick 3-6 that fit best):
wlb, remote, flex-hours, async, deep-work, transparent, flat, diverse, psych-safety, eng-driven, ship-fast, open-source, learning, equity, product-impact, many-hats, ethical-ai, social-impact

Return ONLY valid JSON, no markdown, no explanation:
{
  "name": "Official Company Name",
  "size": "Small (~50)" or "Mid (~500)" or "Large (~5,000)" etc,
  "glassdoor": 4.0,
  "wlb_score": 3.5,
  "culture_values": 4.0,
  "comp_benefits": 3.8,
  "senior_mgmt": 3.5,
  "career_opps": 3.5,
  "recommend": 75,
  "ceo_approval": 80,
  "ceo_name": "CEO Full Name",
  "bestFor": "One sentence describing who this company is best for",
  "verdict": "Choose [Company] if you want X — but expect Y.",
  "values": ["eng-driven", "learning", ...],
  "pros": ["One sentence pro", "Another sentence pro"],
  "cons": ["One sentence con", "Another sentence con"],
  "careers": "https://company.com/careers"
}`
        }]
    });

    let text = response.content[0].text.trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const data = JSON.parse(text);

    // Validate
    data.values = (data.values || []).filter(v => VALID_VALUES.includes(v)).slice(0, 6);
    data.pros = (data.pros || []).slice(0, 2);
    data.cons = (data.cons || []).slice(0, 2);
    data.glassdoor = Math.max(1, Math.min(5, Number(data.glassdoor) || 3.5));
    data.wlb_score = Math.max(1, Math.min(5, Number(data.wlb_score) || 3.5));
    data.culture_values = Math.max(1, Math.min(5, Number(data.culture_values) || 3.5));
    data.comp_benefits = Math.max(1, Math.min(5, Number(data.comp_benefits) || 3.5));
    data.senior_mgmt = Math.max(1, Math.min(5, Number(data.senior_mgmt) || 3.5));
    data.career_opps = Math.max(1, Math.min(5, Number(data.career_opps) || 3.5));
    data.recommend = Math.max(0, Math.min(100, Math.round(Number(data.recommend) || 70)));
    data.ceo_approval = Math.max(0, Math.min(100, Math.round(Number(data.ceo_approval) || 70)));
    data.ai_generated = true;
    data.slug = slug;
    data.logo = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(data.careers?.replace(/https?:\/\/([^/]+).*/, '$1') || slug.replace(/-/g, '') + '.com')}&sz=128`;

    // Cache
    cache[slug] = data;
    return data;
}

// ─── Escape HTML ───
function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Generate static HTML for a compare page ───
function generatePage(a, b) {
    const slugA = a.slug || a.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const slugB = b.slug || b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const pageSlug = `${slugA}-vs-${slugB}`;
    const title = `${a.name} vs ${b.name} Culture Comparison | JobsByCulture`;
    const desc = `Compare ${a.name} and ${b.name} company cultures side-by-side. See Glassdoor ratings, work-life balance, values, pros & cons, and career opportunities.`;
    const url = `https://jobsbyculture.com/compare/${pageSlug}`;
    const today = new Date().toISOString().split('T')[0];

    // Build score bars HTML
    const metrics = [
        { label: 'Overall', a: a.glassdoor, b: b.glassdoor },
        { label: 'Work-Life Balance', a: a.wlb_score, b: b.wlb_score },
        { label: 'Culture & Values', a: a.culture_values, b: b.culture_values },
        { label: 'Comp & Benefits', a: a.comp_benefits, b: b.comp_benefits },
        { label: 'Senior Mgmt', a: a.senior_mgmt, b: b.senior_mgmt },
        { label: 'Career Opps', a: a.career_opps, b: b.career_opps },
    ];

    let scoresHtml = `<div class="cmp-score-names"><span class="a-name">${esc(a.name)}</span><span class="b-name">${esc(b.name)}</span></div>`;
    for (const m of metrics) {
        const valA = Number(m.a) || 0;
        const valB = Number(m.b) || 0;
        const pctA = (valA / 5) * 50;
        const pctB = (valB / 5) * 50;
        scoresHtml += `<div class="cmp-score-row">
            <span class="cmp-score-val a">${valA.toFixed(1)}</span>
            <div class="cmp-bar-track">
                <div class="cmp-bar-a" style="width:${pctA}%"></div>
                <div class="cmp-bar-b" style="width:${pctB}%"></div>
                <div class="cmp-bar-mid"></div>
            </div>
            <span class="cmp-score-val b">${valB.toFixed(1)}</span>
        </div>
        <div style="text-align:center;font-size:13px;font-weight:600;color:var(--text-2);margin:-12px 0 16px">${m.label}</div>`;
    }

    // Approval row
    if (a.recommend || b.recommend) {
        scoresHtml += `<div class="cmp-approval-row">
            <div class="cmp-approval-side">
                ${a.recommend ? `<span class="cmp-approval-badge a">\uD83D\uDC4D ${a.recommend}% Recommend</span>` : ''}
                ${a.ceo_approval ? `<span class="cmp-approval-badge a">\uD83D\uDC64 ${a.ceo_approval}% CEO Approval${a.ceo_name ? ` (${esc(a.ceo_name)})` : ''}</span>` : ''}
            </div>
            <div class="cmp-approval-side right">
                ${b.recommend ? `<span class="cmp-approval-badge b">\uD83D\uDC4D ${b.recommend}% Recommend</span>` : ''}
                ${b.ceo_approval ? `<span class="cmp-approval-badge b">\uD83D\uDC64 ${b.ceo_approval}% CEO Approval${b.ceo_name ? ` (${esc(b.ceo_name)})` : ''}</span>` : ''}
            </div>
        </div>`;
    }

    // Values
    const setA = new Set(a.values || []);
    const setB = new Set(b.values || []);
    const shared = [...setA].filter(v => setB.has(v));
    const uniqueA = [...setA].filter(v => !setB.has(v));
    const uniqueB = [...setB].filter(v => !setA.has(v));

    function valuePill(slug, cls) {
        const v = VALUES_META[slug];
        if (!v) return '';
        return `<span class="value-pill ${cls || v.color}">${v.ico} ${v.name}</span>`;
    }

    let valuesHtml = `<div class="cmp-values-row">
        <div><div style="font-size:12px;font-weight:600;color:var(--accent);margin-bottom:8px">${esc(a.name)} only</div><div class="cmp-values-col left">
            ${uniqueA.length ? uniqueA.map(v => valuePill(v)).join('') : '<span style="font-size:13px;color:var(--text-3);font-style:italic">No unique values</span>'}
        </div></div>
        <div><div style="font-size:12px;font-weight:600;color:var(--teal);margin-bottom:8px">${esc(b.name)} only</div><div class="cmp-values-col right">
            ${uniqueB.length ? uniqueB.map(v => valuePill(v)).join('') : '<span style="font-size:13px;color:var(--text-3);font-style:italic">No unique values</span>'}
        </div></div>
    </div>
    <div class="cmp-values-shared">
        <div class="cmp-values-shared-label">Shared</div>
        ${shared.length ? shared.map(v => valuePill(v, 'shared')).join('') : '<span style="font-size:13px;color:var(--text-3);font-style:italic">None</span>'}
    </div>`;

    // Pros & Cons
    function pcCard(co) {
        return `<div class="cmp-pc-card">
            <h3>${esc(co.name)}</h3>
            <ul class="cmp-pc-list">
                ${(co.pros || []).map(p => `<li><span class="cmp-pc-icon pro">\u2713</span><span>${esc(p)}</span></li>`).join('')}
                ${(co.cons || []).map(c => `<li><span class="cmp-pc-icon con">\u2717</span><span>${esc(c)}</span></li>`).join('')}
            </ul>
        </div>`;
    }

    // Job roles
    function jobCard(co, side) {
        const rc = co.roleCounts || {};
        const keys = Object.keys(rc);
        if (!keys.length) return `<div class="cmp-jobs-card"><h3>${esc(co.name)}</h3><div class="cmp-na-msg">No open roles currently listed</div></div>`;
        const total = Object.values(rc).reduce((s, n) => s + n, 0);
        const sorted = keys.sort((x, y) => rc[y] - rc[x]);
        const max = rc[sorted[0]] || 1;
        return `<div class="cmp-jobs-card">
            <h3>${esc(co.name)} \u2014 ${total} jobs</h3>
            ${sorted.map(r => {
                const role = ROLES[r];
                if (!role) return '';
                const pct = (rc[r] / max * 100);
                return `<div class="cmp-role-row">
                    <span class="cmp-role-label">${role.ico} ${role.name}</span>
                    <div class="cmp-role-bar-track"><div class="cmp-role-bar ${side}" style="width:${pct}%"></div></div>
                    <span class="cmp-role-count">${rc[r]}</span>
                </div>`;
            }).join('')}
        </div>`;
    }

    const hideJobs = a.ai_generated && b.ai_generated;

    // CTA
    function ctaCol(co, isRight) {
        const cls = isRight ? 'cmp-cta-col right' : 'cmp-cta-col';
        if (co.onsite && co.slug) {
            return `<div class="${cls}">
                <a class="cmp-btn cmp-btn-primary" href="/jobs?company=${co.slug}">See ${esc(co.name)} jobs \u2192</a>
                <a class="cmp-btn cmp-btn-outline" href="/companies/${co.slug}">Full profile \u2192</a>
            </div>`;
        }
        return `<div class="${cls}">
            <a class="cmp-btn cmp-btn-primary" href="${esc(co.careers || '#')}" target="_blank">Visit ${esc(co.name)} careers \u2192</a>
        </div>`;
    }

    // JSON-LD
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": title,
        "description": desc,
        "url": url,
        "publisher": {
            "@type": "Organization",
            "name": "JobsByCulture",
            "url": "https://jobsbyculture.com"
        }
    };

    // Read the CSS from compare.html (everything inside <style>...</style>)
    const cssMatch = compareHtml.match(/<style>([\s\S]*?)<\/style>/);
    const css = cssMatch ? cssMatch[1] : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}">
    <meta name="robots" content="index, follow">
    <meta name="author" content="JobsByCulture">
    <meta property="og:title" content="${esc(a.name)} vs ${esc(b.name)} Culture Comparison | JobsByCulture">
    <meta property="og:description" content="${esc(desc)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${url}">
    <meta property="og:image" content="https://jobsbyculture.com/og-image.png?v=4">
    <meta property="og:image:width" content="2616">
    <meta property="og:image:height" content="1190">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(a.name)} vs ${esc(b.name)} Culture Comparison">
    <meta name="twitter:description" content="${esc(desc)}">
    <meta name="twitter:image" content="https://jobsbyculture.com/og-image.png?v=4">
    <link rel="canonical" href="${url}">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="icon" type="image/png" sizes="512x512" href="/logo.png">
    <link rel="apple-touch-icon" href="/logo.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Satoshi:wght@400;500;600;700;900&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    <style>${css}</style>
</head>
<body>

<!-- NAV -->
<nav>
    <div class="nav-inner">
        <a href="/" class="nav-logo">
            <div class="nav-mark"><div class="ring ring-1"></div><div class="ring ring-2"></div><div class="nav-dot"></div></div>
            <div class="nav-wordmark">Jobs<span>By</span>Culture</div>
        </a>
        <div class="nav-links">
            <a href="/">Home</a>
            <a href="/jobs">Jobs</a>
            <a href="/compare" class="active">Compare</a>
            <a href="/#companies">Companies</a>
        </div>
        <button class="hamburger" onclick="this.classList.toggle('active');this.closest('.nav-inner').querySelector('.nav-links').classList.toggle('open')" aria-label="Menu">
            <span></span><span></span><span></span>
        </button>
    </div>
</nav>

<!-- HERO -->
<section class="cmp-hero">
    <div class="container">
        <div class="cmp-hero-pill">
            <span class="cmp-hero-pill-dot"></span>
            ${esc(a.name)} vs ${esc(b.name)}
        </div>
        <h1>${esc(a.name)} vs ${esc(b.name)} <em>Culture</em></h1>
        <p class="cmp-hero-sub">Side-by-side culture comparison. See ratings, values, pros &amp; cons, and open roles to find your best fit.</p>

        <div class="cmp-selector">
            <a href="/compare" class="cmp-go" style="text-decoration:none">Compare Different Companies</a>
        </div>
    </div>
</section>

<!-- PRE-RENDERED RESULTS -->
<div class="cmp-results active">
    <div class="container">
        <!-- Company Headers -->
        <div class="cmp-headers">
            <div class="cmp-header-card">
                <img src="${a.logo || 'https://www.google.com/s2/favicons?domain=' + (slugA) + '.com&sz=128'}" alt="${esc(a.name)}">
                <h2>${esc(a.name)}</h2>
                <div class="cmp-header-size">${esc(a.size || 'Unknown size')}</div>
                ${a.ai_generated ? '<div class="cmp-ai-badge">\u2728 AI-generated</div>' : ''}
            </div>
            <div class="cmp-header-card">
                <img src="${b.logo || 'https://www.google.com/s2/favicons?domain=' + (slugB) + '.com&sz=128'}" alt="${esc(b.name)}">
                <h2>${esc(b.name)}</h2>
                <div class="cmp-header-size">${esc(b.size || 'Unknown size')}</div>
                ${b.ai_generated ? '<div class="cmp-ai-badge">\u2728 AI-generated</div>' : ''}
            </div>
        </div>

        <!-- Best For -->
        <div class="cmp-section">
            <div class="cmp-section-label">Best For</div>
            <div class="cmp-bestfor">
                <div class="cmp-bestfor-card a">
                    <div class="cmp-bestfor-label">${esc(a.name)}</div>
                    <div class="cmp-bestfor-text">Best for: ${esc(a.bestFor || 'Professionals seeking this company\'s unique culture')}</div>
                </div>
                <div class="cmp-bestfor-card b">
                    <div class="cmp-bestfor-label">${esc(b.name)}</div>
                    <div class="cmp-bestfor-text">Best for: ${esc(b.bestFor || 'Professionals seeking this company\'s unique culture')}</div>
                </div>
            </div>
        </div>

        <!-- Scores -->
        <div class="cmp-section">
            <div class="cmp-section-label">Ratings</div>
            <div class="cmp-scores">${scoresHtml}</div>
        </div>

        <!-- Values -->
        <div class="cmp-section">
            <div class="cmp-section-label">Culture Values</div>
            <div class="cmp-values-grid">${valuesHtml}</div>
        </div>

        <!-- Pros & Cons -->
        <div class="cmp-section">
            <div class="cmp-section-label">Pros &amp; Cons</div>
            <div class="cmp-proscons">${pcCard(a)}${pcCard(b)}</div>
        </div>

        <!-- Bottom Line -->
        <div class="cmp-section">
            <div class="cmp-section-label">Bottom Line</div>
            <div class="cmp-verdict">
                <div class="cmp-verdict-card a">
                    <div class="cmp-verdict-label">${esc(a.name)}</div>
                    <div class="cmp-verdict-text">${esc(a.verdict || 'Choose ' + a.name + ' if their culture aligns with your priorities.')}</div>
                </div>
                <div class="cmp-verdict-card b">
                    <div class="cmp-verdict-label">${esc(b.name)}</div>
                    <div class="cmp-verdict-text">${esc(b.verdict || 'Choose ' + b.name + ' if their culture aligns with your priorities.')}</div>
                </div>
            </div>
        </div>

        <!-- Job Counts -->
        ${hideJobs ? '' : `<div class="cmp-section cmp-jobs-section">
            <div class="cmp-section-label">Open Roles</div>
            <div class="cmp-jobs-grid">${jobCard(a, 'a')}${jobCard(b, 'b')}</div>
        </div>`}

        <!-- CTAs -->
        <div class="cmp-ctas">${ctaCol(a, false)}${ctaCol(b, true)}</div>
    </div>
</div>

<!-- FOOTER -->
<footer>
    <div class="container">
        <div class="ft-links">
            <a href="/">Home</a>
            <a href="/jobs">Browse Jobs</a>
            <a href="/compare">Compare Cultures</a>
            <a href="/#companies">Companies</a>
        </div>
        <div class="ft-bar">
            <p>&copy; 2026 JobsByCulture</p>
            <p>Made by <a href="https://x.com/itspradz" target="_blank">@itspradz</a></p>
        </div>
    </div>
</footer>

</body>
</html>`;
}

// ─── Update sitemap.xml ───
function updateSitemap(generatedSlugs) {
    const sitemapPath = resolve(ROOT, 'sitemap.xml');
    let sitemap = readFileSync(sitemapPath, 'utf-8');
    const today = new Date().toISOString().split('T')[0];

    // Remove existing compare page entries
    sitemap = sitemap.replace(/\s*<!-- Compare pages -->[\s\S]*?(?=<\/urlset>)/, '\n');

    // Add compare main page + all generated pages
    let compareUrls = '\n  <!-- Compare pages -->\n';
    compareUrls += `  <url>\n    <loc>https://jobsbyculture.com/compare</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;

    for (const slug of generatedSlugs) {
        compareUrls += `  <url>\n    <loc>https://jobsbyculture.com/compare/${slug}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
    }

    sitemap = sitemap.replace('</urlset>', compareUrls + '</urlset>');
    writeFileSync(sitemapPath, sitemap);
    console.log(`\nUpdated sitemap.xml with ${generatedSlugs.length} compare pages`);
}

// ─── Main ───
async function main() {
    const client = new Anthropic();
    console.log(`Building ${pairs.length} compare pages...\n`);

    // Collect all unique slugs needed
    const allSlugs = new Set();
    for (const [a, b] of pairs) {
        allSlugs.add(a);
        allSlugs.add(b);
    }

    // Fetch all company data (in sequence to avoid rate limits)
    const companyData = {};
    for (const slug of allSlugs) {
        try {
            companyData[slug] = await getCompanyData(slug, client);
        } catch (err) {
            console.error(`  [error] Failed to get data for ${slug}:`, err.message);
        }
    }

    // Save cache after all API calls
    writeFileSync(cachePath, JSON.stringify(cache, null, 2));
    console.log(`\nSaved cache (${Object.keys(cache).length} entries)`);

    // Generate pages
    const generatedSlugs = [];
    for (const [slugA, slugB] of pairs) {
        const a = companyData[slugA];
        const b = companyData[slugB];
        if (!a || !b) {
            console.error(`  [skip] Missing data for ${slugA} or ${slugB}`);
            continue;
        }

        const pageSlug = `${slugA}-vs-${slugB}`;
        const html = generatePage(a, b);
        const outPath = resolve(ROOT, 'compare', `${pageSlug}.html`);
        writeFileSync(outPath, html);
        generatedSlugs.push(pageSlug);
        console.log(`  [done] /compare/${pageSlug}`);
    }

    // Update sitemap
    updateSitemap(generatedSlugs);

    console.log(`\nDone! Generated ${generatedSlugs.length} pages.`);
}

main().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
