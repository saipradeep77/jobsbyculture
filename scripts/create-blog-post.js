#!/usr/bin/env node
/**
 * create-blog-post.js
 *
 * Generates a "Working at [Company]" blog post from data/blog-draft.json.
 * Also updates blog/index.html, sitemap.xml, and llms.txt.
 *
 * Usage:  node scripts/create-blog-post.js
 *
 * For "optimize" type drafts, reads the target page and applies changes.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Helpers ─────────────────────────────────────────────────────────────────

function readJSON(path) {
    return JSON.parse(readFileSync(path, 'utf-8'));
}

function readFile(path) {
    return readFileSync(path, 'utf-8');
}

function writeFileSafe(path, content) {
    writeFileSync(path, content, 'utf-8');
    console.log(`  ✓ Wrote ${path.replace(ROOT + '/', '')}`);
}

/** Escape HTML entities */
function esc(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Escape for JSON-LD (no HTML escaping, but escape quotes) */
function escJsonLd(str) {
    return str.replace(/"/g, '\\"').replace(/\n/g, ' ');
}

/** URL-encode for ScreenshotOne OG image URL */
function screenshotOneUrl(pagePath) {
    const encoded = encodeURIComponent(`https://jobsbyculture.com${pagePath}`);
    return `https://api.screenshotone.com/take?access_key=1Z7jgqp5isxeVw&amp;url=${encoded}&amp;format=jpg&amp;block_ads=true&amp;block_cookie_banners=true&amp;block_trackers=true&amp;delay=0&amp;timeout=60&amp;response_type=by_format&amp;image_quality=80&amp;viewport_width=1200&amp;viewport_height=630&amp;cache=true&amp;cache_ttl=2592000`;
}

/** Pick a color class for a culture value pill */
function valuePillColor(value) {
    const map = {
        'remote': 'violet',
        'async': 'sky',
        'flat': 'teal',
        'open-source': 'orange',
        'ship-fast': 'rose',
        'eng-driven': 'sky',
        'wlb': 'teal',
        'flex-hours': 'teal',
        'deep-work': 'violet',
        'transparent': 'teal',
        'diverse': 'violet',
        'psych-safety': 'teal',
        'learning': 'sky',
        'equity': 'orange',
        'product-impact': 'rose',
        'many-hats': 'orange',
        'ethical-ai': 'teal',
        'social-impact': 'teal',
    };
    return map[value] || 'sky';
}

/** Human-readable label for a culture value */
function valueLabel(value) {
    const map = {
        'wlb': 'Work-Life Balance',
        'remote': 'Remote',
        'flex-hours': 'Flex Hours',
        'async': 'Async',
        'deep-work': 'Deep Work',
        'transparent': 'Transparent',
        'flat': 'Flat Hierarchy',
        'diverse': 'Diverse',
        'psych-safety': 'Psych Safety',
        'eng-driven': 'Eng-Driven',
        'ship-fast': 'Ship Fast',
        'open-source': 'Open Source',
        'learning': 'Learning',
        'equity': 'Equity',
        'product-impact': 'Product Impact',
        'many-hats': 'Many Hats',
        'ethical-ai': 'Ethical AI',
        'social-impact': 'Social Impact',
    };
    return map[value] || value;
}

/** Rating bar color class based on score (out of 5) */
function ratingColor(score) {
    if (score >= 4.0) return 'teal';
    if (score >= 3.0) return 'amber';
    return 'red';
}

/** Format today's date as YYYY-MM-DD */
function today() {
    return new Date().toISOString().slice(0, 10);
}

/** Format a date string like "Mar 29, 2026" */
function formatDatePretty(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Format month + year like "March 2026" */
function formatMonthYear(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** Short month like "Mar 2026" */
function formatShortMonthYear(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Value pill colors rotation for variety ──────────────────────────────────
const PILL_COLORS = ['violet', 'sky', 'teal', 'orange', 'rose'];

// ── Template extraction ─────────────────────────────────────────────────────

/**
 * Extracts the full CSS <style> block, nav, and footer from the Supabase
 * template so we reuse them exactly.
 */
function extractTemplateParts(template) {
    // Extract everything from <style> to </style>
    const styleMatch = template.match(/<style>([\s\S]*?)<\/style>/);
    const style = styleMatch ? styleMatch[1] : '';

    // Extract nav
    const navMatch = template.match(/(<!-- Nav -->[\s\S]*?<\/nav>)/);
    const nav = navMatch ? navMatch[1] : '';

    // Extract footer
    const footerMatch = template.match(/(<!-- Footer -->[\s\S]*?<\/footer>)/);
    const footer = footerMatch ? footerMatch[1] : '';

    // Extract related section structure
    const relatedMatch = template.match(/(<!-- Related Posts -->[\s\S]*?<\/section>)/);
    const related = relatedMatch ? relatedMatch[1] : '';

    return { style, nav, footer, related };
}

// ── New Article Generator ───────────────────────────────────────────────────

function generateNewArticle(draft, template) {
    const parts = extractTemplateParts(template);

    const slug = draft.slug;
    const company = draft.company;
    const name = draft.companyName;
    const pageUrl = `/blog/${slug}`;
    const canonicalUrl = `https://jobsbyculture.com${pageUrl}`;
    const ogImage = screenshotOneUrl(pageUrl);
    const publishDate = draft.researchedAt || today();
    const prettyDate = formatDatePretty(publishDate);
    const monthYear = formatMonthYear(publishDate);
    const shortMonth = formatShortMonthYear(publishDate);

    // Build title and description
    const title = `Working at ${name} in ${new Date(publishDate + 'T00:00:00').getFullYear()}: Glassdoor, Salary &amp; Culture | JobsByCulture`;
    const titleClean = `Working at ${name} in ${new Date(publishDate + 'T00:00:00').getFullYear()}: Glassdoor, Salary & Culture`;
    const year = new Date(publishDate + 'T00:00:00').getFullYear();

    const description = `${name} Glassdoor rating: ${draft.glassdoor}/5. ${draft.size}, ${draft.salaryRange?.company_median_total || 'competitive'} median TC, ${draft.wlb} WLB score. Honest breakdown of culture, salary, work-life balance &amp; open careers.`;
    const descClean = `${name} Glassdoor rating: ${draft.glassdoor}/5. ${draft.size}, ${draft.salaryRange?.company_median_total || 'competitive'} median TC, ${draft.wlb} WLB score. Honest breakdown of culture, salary, work-life balance & open careers.`;

    // Build FAQ schema
    let faqSchemaBlock = '';
    let faqHtmlBlock = '';
    if (draft.faqs && draft.faqs.length > 0) {
        const faqEntries = draft.faqs.map(f => `            {
                "@type": "Question",
                "name": "${escJsonLd(f.q)}",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "${escJsonLd(f.a)}"
                }
            }`).join(',\n');

        faqSchemaBlock = `
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
${faqEntries}
        ]
    }
    </script>`;

        const faqItems = draft.faqs.map(f =>
            `                <div class="faq-item" onclick="this.classList.toggle('open')">
                    <div class="faq-q">${esc(f.q)}<span class="faq-toggle">+</span></div>
                    <div class="faq-a">${esc(f.a)}</div>
                </div>`
        ).join('\n\n');

        faqHtmlBlock = `
        <!-- FAQ Section -->
        <div class="faq-section">
            <h2>Frequently Asked Questions About Working at ${esc(name)}</h2>

            <div class="faq-list">
${faqItems}
            </div>
        </div>`;
    }

    // Build rating bars
    const ratings = [
        { label: 'Overall Rating', score: draft.glassdoor },
        { label: 'Culture &amp; Values', score: draft.cultureValues },
        { label: 'Compensation &amp; Benefits', score: draft.compensation },
        { label: 'Career Opportunities', score: draft.careerOpportunities },
        { label: 'Senior Leadership', score: draft.seniorLeadership },
        { label: 'Work-Life Balance', score: draft.wlb },
    ].filter(r => r.score != null);

    const ratingBarsHtml = ratings.map(r => {
        const pct = Math.round((r.score / 5) * 100);
        const color = ratingColor(r.score);
        return `            <div class="rating-item">
                <span class="rating-label">${r.label}</span>
                <div class="rating-bar-track"><div class="rating-bar-fill ${color}" style="width: ${pct}%"></div></div>
                <span class="rating-score ${color}">${r.score}</span>
            </div>`;
    }).join('\n');

    // Build value pills
    const valuePillsHtml = (draft.values || []).map(v =>
        `            <a href="/values/${v}" class="value-pill ${valuePillColor(v)}">${valueLabel(v)}</a>`
    ).join('\n');

    // Build pros cards
    const prosHtml = (draft.pros || []).map(p =>
        `            <div class="procon-card pro">
                <span class="card-icon">+</span> ${esc(p)}
            </div>`
    ).join('\n');

    // Build cons cards
    const consHtml = (draft.cons || []).map(c =>
        `            <div class="procon-card con">
                <span class="card-icon">&minus;</span> ${esc(c)}
            </div>`
    ).join('\n');

    // Build community quotes
    let quotesHtml = '';
    if (draft.communityQuotes && draft.communityQuotes.length > 0) {
        const quotes = draft.communityQuotes.map(q => {
            const cls = q.sentiment === 'positive' ? 'pro' : 'con';
            const label = q.sentiment === 'positive' ? 'Pro' : 'Con';
            return `        <div class="review-quote ${cls}">
            <span class="quote-label">${label} &mdash; ${esc(q.source)}</span>
            "${esc(q.quote)}"
        </div>`;
        }).join('\n\n');
        quotesHtml = `
        <h2>What Employees Are Saying</h2>

${quotes}`;
    }

    // Build jobs by department list if available
    let jobsByDeptHtml = '';
    if (draft.jobsByDept && Object.keys(draft.jobsByDept).length > 0) {
        const items = Object.entries(draft.jobsByDept)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([dept, count]) => `            <li><strong>${esc(dept)}</strong> &mdash; ${count} open roles</li>`)
            .join('\n');
        jobsByDeptHtml = `
        <h3>Hiring by Department</h3>

        <ul>
${items}
        </ul>`;
    }

    // Build salary section
    let salaryHtml = '';
    if (draft.salaryRange) {
        const sr = draft.salaryRange;
        let salaryDetails = '';
        if (sr.swe_l1_total) salaryDetails += `            <li><strong>Entry-level SWE</strong> &mdash; ${esc(sr.swe_l1_total)} total compensation</li>\n`;
        if (sr.swe_senior_l3_total) salaryDetails += `            <li><strong>Senior SWE</strong> &mdash; ${esc(sr.swe_senior_l3_total)} total compensation</li>\n`;
        if (sr.company_median_total) salaryDetails += `            <li><strong>Company Median</strong> &mdash; ${esc(sr.company_median_total)} total compensation</li>\n`;
        if (sr.source) salaryDetails += `            <li><em>Source: ${esc(sr.source)}</em></li>\n`;

        if (salaryDetails) {
            salaryHtml = `
        <h2>Compensation &amp; Salary</h2>

        <div class="stat-callout">
            <div class="stat-number">${esc(sr.company_median_total || sr.swe_senior_l3_total || 'Competitive')}</div>
            <div class="stat-label">Median Total Compensation</div>
        </div>

        <ul>
${salaryDetails}        </ul>`;
        }
    }

    // Add FAQ CSS if needed
    let faqCss = '';
    if (draft.faqs && draft.faqs.length > 0) {
        faqCss = `
        /* ══ FAQ Section ══ */
        .faq-section { margin: 48px 0; }
        .faq-section h2 { margin-bottom: 24px; }
        .faq-list { display: flex; flex-direction: column; gap: 0; }
        .faq-item {
            border: 1px solid var(--border); border-bottom: none;
            padding: 20px 24px; background: var(--bg-card);
        }
        .faq-item:first-child { border-radius: var(--radius) var(--radius) 0 0; }
        .faq-item:last-child { border-bottom: 1px solid var(--border); border-radius: 0 0 var(--radius) var(--radius); }
        .faq-q {
            font-size: 16px; font-weight: 600; color: var(--text);
            cursor: pointer; display: flex; justify-content: space-between;
            align-items: center; gap: 16px;
        }
        .faq-q:hover { color: var(--accent); }
        .faq-q .faq-toggle { font-size: 20px; color: var(--text-3); transition: transform 0.2s; flex-shrink: 0; }
        .faq-item.open .faq-toggle { transform: rotate(45deg); }
        .faq-a {
            display: none; margin-top: 12px; font-size: 15px;
            color: var(--text-2); line-height: 1.8;
        }
        .faq-item.open .faq-a { display: block; }`;
    }

    // Build the at-a-glance table
    const glanceRows = [];
    if (draft.founded) glanceRows.push(['Founded', String(draft.founded)]);
    if (draft.location) glanceRows.push(['Headquarters', draft.location]);
    if (draft.size) glanceRows.push(['Company Size', draft.size]);
    glanceRows.push(['Glassdoor Rating', `${draft.glassdoor} / 5.0${draft.glassdoorReviews ? ` (${draft.glassdoorReviews} reviews)` : ''}`]);
    glanceRows.push(['Work-Life Balance', `${draft.wlb} / 5.0`]);
    if (draft.recommendToFriend != null) glanceRows.push(['Recommend to Friend', `${draft.recommendToFriend}%`]);
    if (draft.jobCount) glanceRows.push(['Open Roles', String(draft.jobCount)]);

    const glanceTableHtml = glanceRows.map(([label, val]) =>
        `            <tr>
                <td>${esc(label)}</td>
                <td>${esc(val)}</td>
            </tr>`
    ).join('\n');

    // Recommend percentage stat
    const recommendPct = draft.recommendToFriend || Math.round(draft.glassdoor * 20);

    // ── Assemble the full HTML ──────────────────────────────────────────────

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${description}">
    <meta name="author" content="JobsByCulture">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${canonicalUrl}">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="icon" type="image/png" sizes="512x512" href="/logo.png">
    <link rel="apple-touch-icon" href="/logo.png">

    <!-- Open Graph -->
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:image" content="${ogImage}">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content="JobsByCulture">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${ogImage}">

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Satoshi:wght@400;500;600;700;900&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">

    <!-- JSON-LD Article Schema -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "${escJsonLd(titleClean)}",
        "description": "${escJsonLd(descClean)}",
        "datePublished": "${publishDate}",
        "dateModified": "${publishDate}",
        "author": { "@type": "Organization", "name": "JobsByCulture", "url": "https://jobsbyculture.com" },
        "publisher": { "@type": "Organization", "name": "JobsByCulture", "url": "https://jobsbyculture.com", "logo": { "@type": "ImageObject", "url": "https://jobsbyculture.com/logo.png" } },
        "mainEntityOfPage": "${canonicalUrl}",
        "image": "https://jobsbyculture.com/og-image.png"
    }
    </script>${faqSchemaBlock}

    <!-- Plausible Analytics -->
    <script async src="https://plausible.io/js/pa-qa3pjs5eZbsfBQJMk4hVW.js"></script>
    <script>
      window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
      plausible.init()
    </script>

    <style>
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }

        :root {
            --bg: #fafaf8;
            --bg-raised: #ffffff;
            --bg-card: #ffffff;
            --bg-hover: #f4f3ef;
            --text: #1a1a1f;
            --text-2: #52525b;
            --text-3: #9ca3af;
            --accent: #e8590c;
            --accent-hover: #c2410c;
            --accent-bg: rgba(232,89,12,0.06);
            --accent-border: rgba(232,89,12,0.2);
            --teal: #0d9488;
            --teal-bg: rgba(13,148,136,0.06);
            --violet: #7c3aed;
            --border: rgba(0,0,0,0.07);
            --border-2: rgba(0,0,0,0.12);
            --radius: 12px;
            --radius-sm: 8px;
            --radius-lg: 20px;
            --radius-full: 100px;
            --shadow: 0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04);
            --font-display: 'Instrument Serif', Georgia, serif;
            --font-body: 'Satoshi', -apple-system, sans-serif;
            --font-mono: 'IBM Plex Mono', monospace;
            --green: #16a34a;
            --green-bg: rgba(22,163,74,0.08);
            --amber: #d97706;
            --amber-bg: rgba(217,119,6,0.08);
            --red: #dc2626;
            --red-bg: rgba(220,38,38,0.08);
        }

        body {
            font-family: var(--font-body);
            background: var(--bg);
            color: var(--text);
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        a { color: inherit; }
        .container { max-width: 1140px; margin: 0 auto; padding: 0 24px; }

        /* ══ Nav ══ */
        nav {
            position: fixed;
            top: 0; left: 0; right: 0;
            z-index: 100;
            background: rgba(250,250,248,0.85);
            backdrop-filter: blur(24px) saturate(1.4);
            -webkit-backdrop-filter: blur(24px) saturate(1.4);
            border-bottom: 1px solid var(--border);
        }
        .nav-inner {
            max-width: 1140px; margin: 0 auto; padding: 14px 24px;
            display: flex; align-items: center; justify-content: space-between;
        }
        .nav-logo {
            display: flex; align-items: center; gap: 10px;
            text-decoration: none; color: var(--text);
        }
        .nav-mark {
            width: 30px; height: 30px; position: relative;
            display: flex; align-items: center; justify-content: center;
        }
        .nav-mark .ring {
            position: absolute; border: 1.5px solid var(--accent);
            border-radius: 50%; animation: logoPing 2.5s ease-out infinite;
        }
        .nav-mark .ring-1 { width: 100%; height: 100%; opacity: 0.2; }
        .nav-mark .ring-2 { width: 65%; height: 65%; opacity: 0.4; animation-delay: 0.3s; }
        .nav-mark .nav-dot {
            width: 7px; height: 7px; background: var(--accent);
            border-radius: 50%; position: relative; z-index: 1;
        }
        @keyframes logoPing {
            0% { transform: scale(1); opacity: 0.4; }
            100% { transform: scale(1.5); opacity: 0; }
        }
        .nav-wordmark { font-weight: 700; font-size: 16px; letter-spacing: -0.03em; }
        .nav-wordmark span { color: var(--accent); }
        .nav-links { display: flex; align-items: center; gap: 28px; }
        .nav-links a {
            color: var(--text-2); text-decoration: none;
            font-size: 14px; font-weight: 500; transition: color 0.15s;
        }
        .nav-links a:hover { color: var(--text); }
        .nav-links .nav-cta {
            background: var(--accent); color: #fff !important; padding: 7px 16px;
            border-radius: var(--radius-sm); font-size: 13px; font-weight: 600;
            transition: all 0.2s;
        }
        .nav-links .nav-cta:hover { background: var(--accent-hover); transform: translateY(-1px); }
        .nav-links a.active { color: var(--accent); font-weight: 600; }
        .hamburger {
            display: none; background: none; border: none;
            cursor: pointer; padding: 4px; flex-direction: column; gap: 5px;
        }
        .hamburger span {
            display: block; width: 22px; height: 2px;
            background: var(--text); border-radius: 1px; transition: all 0.3s;
        }
        .hamburger.active span:nth-child(1) { transform: rotate(45deg) translate(5px, 5px); }
        .hamburger.active span:nth-child(2) { opacity: 0; }
        .hamburger.active span:nth-child(3) { transform: rotate(-45deg) translate(5px, -5px); }

        @media (max-width: 768px) {
            .hamburger { display: flex; }
            .nav-links {
                display: none; position: absolute; top: 100%; left: 0; right: 0;
                background: rgba(250,250,248,0.98);
                backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
                border-bottom: 1px solid var(--border);
                padding: 20px 24px; flex-direction: column; gap: 16px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.06);
            }
            .nav-links.open { display: flex; }
        }

        /* ══ Hero ══ */
        .article-hero {
            padding: 140px 0 60px;
            max-width: 720px;
            margin: 0 auto;
            text-align: center;
        }
        .hero-pill {
            display: inline-flex; align-items: center; gap: 8px;
            padding: 5px 14px 5px 10px;
            border-radius: var(--radius-full);
            font-size: 13px; font-weight: 600;
            margin-bottom: 28px;
        }
        .hero-pill .dot {
            width: 6px; height: 6px;
            border-radius: 50%;
        }
        .hero-pill.deep-dive {
            background: rgba(14,165,233,0.08);
            border: 1px solid rgba(14,165,233,0.2);
            color: #0ea5e9;
        }
        .hero-pill.deep-dive .dot {
            background: #0ea5e9;
        }
        .article-hero h1 {
            font-family: var(--font-display);
            font-size: clamp(32px, 4vw, 48px);
            font-weight: 400;
            line-height: 1.12;
            letter-spacing: -0.02em;
            color: var(--text);
            margin-bottom: 20px;
        }
        .article-hero h1 em {
            color: var(--accent);
            font-style: italic;
        }
        .article-hero .subtitle {
            font-size: 16px;
            color: var(--text-2);
            line-height: 1.7;
            max-width: 600px;
            margin: 0 auto 16px;
        }
        .article-hero .meta-line {
            font-family: var(--font-mono);
            font-size: 13px;
            color: var(--text-3);
        }

        /* ══ Article Body ══ */
        .article-body {
            max-width: 720px;
            margin: 0 auto;
            padding: 0 24px 80px;
        }
        .article-body p {
            font-size: 17px;
            line-height: 1.8;
            color: var(--text);
            margin-bottom: 24px;
        }
        .article-body h2 {
            font-family: var(--font-display);
            font-size: 28px;
            font-weight: 400;
            line-height: 1.2;
            color: var(--text);
            margin: 48px 0 16px;
            letter-spacing: -0.01em;
        }
        .article-body h3 {
            font-size: 18px;
            font-weight: 600;
            color: var(--text);
            margin: 32px 0 12px;
        }
        .article-body a {
            color: var(--accent);
            text-decoration: underline;
            text-decoration-color: var(--accent-border);
            text-underline-offset: 3px;
            transition: text-decoration-color 0.15s;
        }
        .article-body a:hover {
            text-decoration-color: var(--accent);
        }
        .article-body ul, .article-body ol {
            margin-bottom: 24px;
            padding-left: 24px;
        }
        .article-body li {
            font-size: 17px;
            line-height: 1.8;
            margin-bottom: 8px;
        }

        /* ══ At-a-Glance Table ══ */
        .glance-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 15px;
            margin: 24px 0 32px;
        }
        .glance-table th {
            text-align: left;
            font-size: 13px;
            font-weight: 600;
            color: var(--text-3);
            text-transform: uppercase;
            letter-spacing: 0.04em;
            padding: 12px 16px;
            border-bottom: 2px solid var(--border-2);
            width: 40%;
        }
        .glance-table td {
            padding: 14px 16px;
            border-bottom: 1px solid var(--border);
            font-weight: 500;
            color: var(--text);
        }
        .glance-table tr:hover {
            background: var(--accent-bg);
        }

        /* ══ Stat Callout ══ */
        .stat-callout {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 28px 32px;
            margin: 36px 0;
            text-align: center;
        }
        .stat-callout .stat-number {
            font-family: var(--font-display);
            font-size: 42px;
            font-weight: 400;
            color: var(--accent);
            line-height: 1.1;
            margin-bottom: 6px;
        }
        .stat-callout .stat-label {
            font-size: 14px;
            color: var(--text-2);
            font-weight: 500;
        }

        /* ══ Rating Bars ══ */
        .rating-item {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 14px 0;
            border-bottom: 1px solid var(--border);
        }
        .rating-item:last-child {
            border-bottom: none;
        }
        .rating-label {
            font-size: 15px;
            font-weight: 500;
            color: var(--text);
            min-width: 180px;
        }
        .rating-bar-track {
            flex: 1;
            height: 8px;
            background: rgba(0,0,0,0.04);
            border-radius: 4px;
            overflow: hidden;
        }
        .rating-bar-fill {
            height: 100%;
            border-radius: 4px;
            transition: width 0.6s ease;
        }
        .rating-bar-fill.teal { background: var(--teal); }
        .rating-bar-fill.amber { background: var(--amber); }
        .rating-bar-fill.red { background: var(--red); }
        .rating-score {
            font-family: var(--font-mono);
            font-size: 15px;
            font-weight: 600;
            min-width: 32px;
            text-align: right;
        }
        .rating-score.teal { color: var(--teal); }
        .rating-score.amber { color: var(--amber); }
        .rating-score.red { color: var(--red); }

        /* ══ Review Quotes ══ */
        .review-quote {
            font-size: 14.5px;
            line-height: 1.6;
            padding: 12px 16px;
            border-left: 3px solid var(--border-2);
            margin: 10px 0;
            color: var(--text-2);
            background: rgba(0,0,0,0.015);
            border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
        }
        .review-quote.pro {
            border-left-color: var(--green);
            background: var(--green-bg);
        }
        .review-quote.con {
            border-left-color: var(--red);
            background: var(--red-bg);
        }
        .review-quote .quote-label {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            margin-bottom: 4px;
            display: block;
        }
        .review-quote.pro .quote-label { color: var(--green); }
        .review-quote.con .quote-label { color: var(--red); }

        /* ══ Value Pills ══ */
        .value-pills {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin: 16px 0 24px;
        }
        .value-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            border-radius: var(--radius-full);
            font-size: 13px;
            font-weight: 600;
            text-decoration: none;
            transition: transform 0.15s;
        }
        .value-pill:hover {
            transform: translateY(-1px);
        }
        .value-pill.rose {
            color: #e11d48;
            background: rgba(225,29,72,0.06);
            border: 1px solid rgba(225,29,72,0.2);
        }
        .value-pill.orange {
            color: var(--accent);
            background: var(--accent-bg);
            border: 1px solid var(--accent-border);
        }
        .value-pill.sky {
            color: #0284c7;
            background: rgba(2,132,199,0.06);
            border: 1px solid rgba(2,132,199,0.2);
        }
        .value-pill.violet {
            color: var(--violet);
            background: rgba(124,58,237,0.06);
            border: 1px solid rgba(124,58,237,0.2);
        }
        .value-pill.teal {
            color: var(--teal);
            background: var(--teal-bg);
            border: 1px solid rgba(13,148,136,0.2);
        }

        /* ══ Pro/Con Cards Grid ══ */
        .procon-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 12px;
            margin: 16px 0 24px;
        }
        .procon-card {
            padding: 16px 20px;
            border-radius: var(--radius-sm);
            font-size: 15px;
            line-height: 1.6;
            font-weight: 500;
        }
        .procon-card.pro {
            background: var(--green-bg);
            border: 1px solid rgba(22,163,74,0.15);
            color: var(--text);
        }
        .procon-card.con {
            background: var(--red-bg);
            border: 1px solid rgba(220,38,38,0.15);
            color: var(--text);
        }
        .procon-card .card-icon {
            font-weight: 700;
            margin-right: 8px;
        }
        .procon-card.pro .card-icon { color: var(--green); }
        .procon-card.con .card-icon { color: var(--red); }

        /* ══ Verdict Box ══ */
        .verdict-box {
            background: var(--teal-bg);
            border: 1px solid rgba(13,148,136,0.2);
            border-radius: var(--radius);
            padding: 28px 32px;
            margin: 36px 0;
        }
        .verdict-box h3 {
            font-family: var(--font-display);
            font-size: 22px;
            font-weight: 400;
            color: var(--teal);
            margin: 0 0 12px;
        }
        .verdict-box p {
            font-size: 16px;
            line-height: 1.7;
            color: var(--text-2);
            margin-bottom: 0;
        }

        /* ══ CTA Box ══ */
        .cta-box {
            background: var(--accent-bg);
            border: 1px solid var(--accent-border);
            border-radius: var(--radius);
            padding: 32px;
            text-align: center;
            margin: 48px 0 40px;
        }
        .cta-box h3 {
            font-family: var(--font-display);
            font-size: 24px;
            font-weight: 400;
            color: var(--text);
            margin: 0 0 8px;
        }
        .cta-box p {
            font-size: 15px;
            color: var(--text-2);
            margin-bottom: 20px;
        }
        .cta-box .btn-primary {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: var(--accent);
            color: #fff;
            padding: 12px 28px;
            border-radius: var(--radius-sm);
            font-size: 15px;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.2s;
            margin-right: 12px;
        }
        .cta-box .btn-primary:hover {
            background: var(--accent-hover);
            transform: translateY(-1px);
        }
        .cta-box .btn-secondary {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            color: var(--accent);
            font-size: 14px;
            font-weight: 600;
            text-decoration: none;
            transition: gap 0.15s;
        }
        .cta-box .btn-secondary:hover { gap: 10px; }

        /* ══ Related Posts ══ */
        .related-section {
            max-width: 720px;
            margin: 0 auto;
            padding: 0 24px 80px;
        }
        .related-section h2 {
            font-family: var(--font-display);
            font-size: 28px;
            font-weight: 400;
            margin-bottom: 24px;
            color: var(--text);
        }
        .related-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
        }
        .related-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 24px;
            text-decoration: none;
            display: flex;
            flex-direction: column;
            gap: 12px;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .related-card:hover {
            transform: translateY(-2px);
            box-shadow: var(--shadow);
        }
        .related-card .card-category {
            display: inline-flex;
            align-items: center;
            padding: 4px 10px;
            border-radius: var(--radius-full);
            font-size: 11px;
            font-weight: 600;
            width: fit-content;
            letter-spacing: 0.02em;
        }
        .related-card .card-category.comparison {
            background: rgba(13,148,136,0.08);
            color: var(--teal);
        }
        .related-card .card-category.remote {
            background: rgba(124,58,237,0.08);
            color: var(--violet);
        }
        .related-card .card-category.deep-dive {
            background: rgba(14,165,233,0.08);
            color: #0ea5e9;
        }
        .related-card .card-category.rankings {
            background: var(--accent-bg);
            color: var(--accent);
        }
        .related-card .card-title {
            font-family: var(--font-display);
            font-size: 18px;
            font-weight: 400;
            line-height: 1.3;
            color: var(--text);
        }
        .related-card .card-meta {
            font-family: var(--font-mono);
            font-size: 12px;
            color: var(--text-3);
            margin-top: auto;
        }
${faqCss}

        @media (max-width: 768px) {
            .article-hero { padding: 120px 24px 40px; }
            .article-body { padding: 0 24px 60px; }
            .related-grid { grid-template-columns: 1fr; }
            .related-section { padding: 0 24px 60px; }
            .stat-callout { padding: 24px 20px; }
            .stat-callout .stat-number { font-size: 36px; }
            .cta-box { padding: 24px 20px; }
            .cta-box .btn-primary { margin-right: 0; margin-bottom: 12px; display: flex; justify-content: center; }
            .rating-label { min-width: 120px; font-size: 13px; }
            .glance-table th, .glance-table td { padding: 10px 12px; font-size: 14px; }
            .verdict-box { padding: 24px 20px; }${faqCss ? '\n            .faq-item { padding: 16px 20px; }' : ''}
        }

        /* ══ Footer ══ */
        footer {
            padding: 56px 0 36px;
            border-top: 1px solid var(--border);
        }
        .ft-links {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 24px;
            margin-bottom: 24px;
        }
        .ft-links a {
            color: var(--text-2);
            text-decoration: none;
            font-size: 14px;
        }
        .ft-links a:hover { color: var(--text); }
        .ft-bar {
            text-align: center;
            font-size: 13px;
            color: var(--text-3);
        }

        /* ══ Animations ══ */
        @keyframes fadeUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .fade-up {
            opacity: 0;
            animation: fadeUp 0.6s ease forwards;
        }
        .fade-up-d1 { animation-delay: 0.05s; }
        .fade-up-d2 { animation-delay: 0.1s; }
        .fade-up-d3 { animation-delay: 0.15s; }
        .fade-up-d4 { animation-delay: 0.2s; }
    </style>
</head>
<body>

    <!-- Nav -->
    <nav>
        <div class="nav-inner">
            <a href="/" class="nav-logo">
                <div class="nav-mark"><div class="ring ring-1"></div><div class="ring ring-2"></div><div class="nav-dot"></div></div>
                <div class="nav-wordmark">Jobs<span>By</span>Culture</div>
            </a>
            <div class="nav-links">
                <a href="/jobs">Jobs</a>
                <a href="/directory">Companies</a>
                <a href="/blog" class="active">Blog</a>
                <a href="/for-employers" class="nav-cta">For Employers</a>
            </div>
            <button class="hamburger" onclick="this.classList.toggle('active');this.closest('.nav-inner').querySelector('.nav-links').classList.toggle('open')" aria-label="Menu">
                <span></span><span></span><span></span>
            </button>
        </div>
    </nav>

    <!-- Hero -->
    <header class="article-hero">
        <div class="hero-pill deep-dive fade-up fade-up-d1"><span class="dot"></span> Deep Dive</div>
        <h1 class="fade-up fade-up-d2">Working at <em>${esc(name)}</em> in ${year}</h1>
        <p class="subtitle fade-up fade-up-d3">${esc(name)} has a ${draft.glassdoor}/5 Glassdoor rating and ${draft.wlb}/5 work-life balance. ${draft.size}, ${draft.recommendToFriend ? draft.recommendToFriend + '% recommend' : 'competitive compensation'}. Here's the full picture.</p>
        <p class="meta-line fade-up fade-up-d4">Updated ${monthYear} &middot; Based on ${draft.glassdoorReviews || 'multiple'} Glassdoor reviews and employee feedback</p>
    </header>

    <!-- Article -->
    <article class="article-body">

        <p>${esc(draft.cultureOverview)}</p>

        <p>We dug into Glassdoor data, employee feedback, and compensation signals to give you the complete picture of working at ${esc(name)} in ${year}. Whether you're weighing an offer, prepping for an interview, or comparing cultures, this is the honest breakdown.</p>

        <!-- Section: The Numbers at a Glance -->
        <h2>The Numbers at a Glance</h2>

        <table class="glance-table">
            <tr>
                <th>Metric</th>
                <th>Detail</th>
            </tr>
${glanceTableHtml}
        </table>

        <!-- Stat Callout -->
        <div class="stat-callout">
            <div class="stat-number">${draft.glassdoor} / 5.0</div>
            <div class="stat-label">Glassdoor Overall Rating &mdash; ${draft.recommendToFriend ? draft.recommendToFriend + '% Recommend' : ''} &mdash; ${draft.wlb} WLB</div>
        </div>

        <!-- Section: Glassdoor Ratings Breakdown -->
        <h2>Glassdoor Ratings Breakdown</h2>

        <p>The ${draft.glassdoor} overall score tells part of the story. Here's how ${esc(name)} rates across key dimensions${draft.glassdoorReviews ? ` based on ${draft.glassdoorReviews} reviews` : ''}.</p>

        <div style="margin: 24px 0 32px;">
${ratingBarsHtml}
        </div>

        <!-- Section: Culture Values -->
        <h2>Culture &amp; Values</h2>

        <div class="value-pills">
${valuePillsHtml}
        </div>

        <!-- Section: What Employees Love -->
        <h2>What Employees Love</h2>

        <div class="procon-grid">
${prosHtml}
        </div>

        <!-- Section: What Employees Warn About -->
        <h2>What Employees Warn About</h2>

        <div class="procon-grid">
${consHtml}
        </div>
${quotesHtml}
${salaryHtml}

        <!-- Section: Open Roles -->
        <h2>Open Roles at ${esc(name)}</h2>

        <p>${esc(name)} currently has <strong>${draft.jobCount || 'multiple'} open positions</strong>. Browse all live openings on our <a href="/jobs?company=${company}">jobs page</a> or explore the <a href="/companies/${company}">${esc(name)} culture profile</a>.</p>
${jobsByDeptHtml}

        <!-- Section: The Bottom Line -->
        <h2>The Bottom Line</h2>

        <div class="verdict-box">
            <h3>The Verdict</h3>
            <p>${esc(name)} scores ${draft.glassdoor}/5 on Glassdoor with a ${draft.wlb}/5 work-life balance rating. ${draft.recommendToFriend ? `${draft.recommendToFriend}% of employees recommend it to a friend.` : ''} It's a strong fit for people who value ${(draft.values || []).slice(0, 3).map(v => valueLabel(v).toLowerCase()).join(', ')}. Check the <a href="/companies/${company}" style="color:var(--teal)">${esc(name)} culture profile</a> for more details, or browse their <a href="/jobs?company=${company}" style="color:var(--teal)">open roles</a>.</p>
        </div>
${faqHtmlBlock}

        <!-- CTA Box -->
        <div class="cta-box">
            <h3>Explore ${draft.jobCount ? `all ${draft.jobCount}` : ''} ${esc(name)} jobs</h3>
            <p>Find your next role at ${esc(name)} or any of the companies in our culture directory.</p>
            <a href="/jobs?company=${company}" class="btn-primary">See ${esc(name)} Jobs &rarr;</a>
            <a href="/jobs" class="btn-secondary">Browse All Jobs &rarr;</a>
        </div>

    </article>

    <!-- Related Posts -->
    <section class="related-section">
        <h2>More from The Culture Report</h2>
        <div class="related-grid">

            <a href="/blog/open-source-ai-companies-hiring-2026" class="related-card">
                <span class="card-category deep-dive">Open Source</span>
                <div class="card-title">Open Source AI Companies Hiring in 2026</div>
                <div class="card-meta">Mar 2026</div>
            </a>

            <a href="/blog/best-ai-companies-work-life-balance-2026" class="related-card">
                <span class="card-category rankings">Rankings</span>
                <div class="card-title">Best AI Companies for Work-Life Balance in 2026</div>
                <div class="card-meta">Mar 2026</div>
            </a>

            <a href="/blog/remote-friendly-ai-companies-hiring-2026" class="related-card">
                <span class="card-category remote">Remote Work</span>
                <div class="card-title">Remote-Friendly AI Companies Actually Hiring in 2026</div>
                <div class="card-meta">Mar 2026</div>
            </a>

        </div>
    </section>

    <!-- Footer -->
    <footer>
        <div class="container">
            <div class="ft-links">
                <a href="/">Home</a>
                <a href="/jobs">Browse Jobs</a>
                <a href="/directory">Companies</a>
                <a href="/compare">Compare Cultures</a>
                <a href="/culture-map">Culture Map</a>
                <a href="/quiz">Culture Quiz</a>
                <a href="/blog">Blog</a>
                <a href="/for-employers">For Employers</a>
                <a href="/values/remote">By Culture</a>
                <a href="/roles/engineering">By Role</a>
            </div>
            <div class="ft-bar">
                <p>&copy; 2026 JobsByCulture. Made by <a href="https://x.com/itspradz?ref=jobsbyculture.com" target="_blank" style="color:var(--accent);text-decoration:none">@itspradz</a></p>
            </div>
        </div>
    </footer>


</body>
</html>`;

    return html;
}

// ── Update blog/index.html ──────────────────────────────────────────────────

function updateBlogIndex(draft) {
    const indexPath = join(ROOT, 'blog', 'index.html');
    let html = readFile(indexPath);

    const name = draft.companyName;
    const slug = draft.slug;
    const publishDate = draft.researchedAt || today();
    const prettyDate = formatDatePretty(publishDate);

    // Build a new card
    const newCard = `
                <!-- Card: Working at ${name} -->
                <a href="/blog/${slug}" class="post-card fade-up fade-up-d4">
                    <span class="card-category deep-dive">Company Deep-Dive</span>
                    <h2 class="card-title">Working at ${esc(name)} in ${new Date(publishDate + 'T00:00:00').getFullYear()}: Glassdoor, Salary &amp; Culture</h2>
                    <p class="card-desc">${draft.glassdoor} Glassdoor, ${draft.recommendToFriend ? draft.recommendToFriend + '% recommend, ' : ''}${draft.wlb} WLB. ${draft.size}. Honest breakdown of culture, salary &amp; what employees say.</p>
                    <div class="card-meta">
                        <span>${prettyDate}</span>
                        <span class="separator"></span>
                        <span>10 min read</span>
                    </div>
                </a>
`;

    // Insert after the first <!-- Card: comment (at the top of the posts grid)
    const insertPoint = html.indexOf('<!-- Card:');
    if (insertPoint === -1) {
        console.error('  ! Could not find insertion point in blog/index.html');
        return;
    }

    html = html.slice(0, insertPoint) + newCard.trimStart() + '\n                ' + html.slice(insertPoint);
    writeFileSafe(indexPath, html);
}

// ── Update sitemap.xml ──────────────────────────────────────────────────────

function updateSitemap(draft) {
    const sitemapPath = join(ROOT, 'sitemap.xml');
    let xml = readFile(sitemapPath);

    const slug = draft.slug;
    const publishDate = draft.researchedAt || today();
    const pageUrl = `https://jobsbyculture.com/blog/${slug}`;

    // Check if already present
    if (xml.includes(pageUrl)) {
        console.log(`  - Sitemap already contains ${slug}`);
        return;
    }

    const newEntry = `  <url>
    <loc>${pageUrl}</loc>
    <lastmod>${publishDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;

    // Insert before </urlset>
    xml = xml.replace('</urlset>', newEntry + '\n</urlset>');
    writeFileSafe(sitemapPath, xml);
}

// ── Update llms.txt ─────────────────────────────────────────────────────────

function updateLlmsTxt(draft) {
    const llmsPath = join(ROOT, 'llms.txt');
    let txt = readFile(llmsPath);

    const slug = draft.slug;
    const name = draft.companyName;
    const pageUrl = `https://jobsbyculture.com/blog/${slug}`;
    const year = new Date((draft.researchedAt || today()) + 'T00:00:00').getFullYear();

    // Check if already present
    if (txt.includes(pageUrl)) {
        console.log(`  - llms.txt already contains ${slug}`);
        return;
    }

    const newEntry = `- [Working at ${name} in ${year}](${pageUrl}): ${draft.glassdoor} Glassdoor, ${draft.wlb} WLB, ${draft.size}, ${draft.salaryRange?.company_median_total || 'competitive comp'} median TC. Culture, salary, and what employees say`;

    // Find a good insertion point - after the last "Working at" entry
    const lines = txt.split('\n');
    let lastWorkingAtIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Working at') && lines[i].includes('/blog/')) {
            lastWorkingAtIdx = i;
        }
    }

    if (lastWorkingAtIdx >= 0) {
        lines.splice(lastWorkingAtIdx + 1, 0, newEntry);
    } else {
        // Fallback: append before the last line
        lines.splice(lines.length - 1, 0, newEntry);
    }

    writeFileSafe(llmsPath, lines.join('\n'));
}

// ── Optimize mode ───────────────────────────────────────────────────────────

function handleOptimize(draft) {
    // For "optimize" type, the draft should contain:
    //   targetFile: path relative to ROOT
    //   title: new title (optional)
    //   description: new meta description (optional)
    //   changes: array of { find, replace } (optional)

    if (!draft.targetFile) {
        console.error('  ! Optimize draft must have a "targetFile" field');
        process.exit(1);
    }

    const targetPath = join(ROOT, draft.targetFile);
    if (!existsSync(targetPath)) {
        console.error(`  ! Target file not found: ${draft.targetFile}`);
        process.exit(1);
    }

    let html = readFile(targetPath);
    let changed = false;

    if (draft.title) {
        // Update <title>
        html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(draft.title)}</title>`);
        // Update og:title
        html = html.replace(
            /<meta property="og:title" content="[^"]*">/,
            `<meta property="og:title" content="${esc(draft.title)}">`
        );
        // Update twitter:title
        html = html.replace(
            /<meta name="twitter:title" content="[^"]*">/,
            `<meta name="twitter:title" content="${esc(draft.title)}">`
        );
        // Update JSON-LD headline
        html = html.replace(
            /"headline": "[^"]*"/,
            `"headline": "${escJsonLd(draft.title)}"`
        );
        changed = true;
        console.log(`  * Updated title to: ${draft.title}`);
    }

    if (draft.description) {
        // Update meta description
        html = html.replace(
            /<meta name="description" content="[^"]*">/,
            `<meta name="description" content="${esc(draft.description)}">`
        );
        // Update og:description
        html = html.replace(
            /<meta property="og:description" content="[^"]*">/,
            `<meta property="og:description" content="${esc(draft.description)}">`
        );
        // Update twitter:description
        html = html.replace(
            /<meta name="twitter:description" content="[^"]*">/,
            `<meta name="twitter:description" content="${esc(draft.description)}">`
        );
        changed = true;
        console.log(`  * Updated description`);
    }

    if (draft.changes && Array.isArray(draft.changes)) {
        for (const change of draft.changes) {
            if (change.find && change.replace) {
                if (html.includes(change.find)) {
                    html = html.replace(change.find, change.replace);
                    changed = true;
                    console.log(`  * Applied change: "${change.find.slice(0, 60)}..."`);
                } else {
                    console.warn(`  ! Could not find text to replace: "${change.find.slice(0, 60)}..."`);
                }
            }
        }
    }

    if (changed) {
        writeFileSafe(targetPath, html);
    } else {
        console.log('  - No changes applied to optimize target');
    }
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
    const draftPath = join(ROOT, 'data', 'blog-draft.json');
    const templatePath = join(ROOT, 'blog', 'working-at-supabase-2026.html');

    if (!existsSync(draftPath)) {
        console.error('Error: data/blog-draft.json not found');
        process.exit(1);
    }

    const draft = readJSON(draftPath);
    console.log(`\nBlog Post Generator`);
    console.log(`Type: ${draft.type || 'new-article'}`);
    console.log(`Slug: ${draft.slug}`);
    console.log('');

    // ── Handle optimize type ────────────────────────────────────────────────
    if (draft.type === 'optimize') {
        console.log('Mode: Optimize existing page');
        handleOptimize(draft);
        console.log('\nDone.');
        return;
    }

    // ── Handle new-article type ─────────────────────────────────────────────
    console.log('Mode: New article');

    if (!existsSync(templatePath)) {
        console.error('Error: Template file blog/working-at-supabase-2026.html not found');
        process.exit(1);
    }

    const template = readFile(templatePath);
    const outputPath = join(ROOT, 'blog', `${draft.slug}.html`);

    // 1. Generate the article HTML
    const html = generateNewArticle(draft, template);
    writeFileSafe(outputPath, html);

    // 2. Update blog/index.html
    console.log('');
    updateBlogIndex(draft);

    // 3. Update sitemap.xml
    updateSitemap(draft);

    // 4. Update llms.txt
    updateLlmsTxt(draft);

    console.log(`\nDone. Created blog/${draft.slug}.html`);
    console.log(`Remember to review the output and commit when ready.`);
}

main();
