#!/usr/bin/env node
/**
 * Automatically updates ALL job counts, CRC, and CV across the site.
 *
 * What it updates:
 *   index.html     — CRC, CV, hero count, browse-by-value cards, meta tags, CTAs
 *   compare.html   — CRC, syncs COMPANIES + COMPANY_REVIEWS from jobs.html
 *   directory.html — company count in meta tags
 *   llms.txt       — job count, company count
 *
 * Zero hardcoded values — everything is computed from jobs-fetched.json
 * and jobs.html COMPANIES{}.
 *
 * Part of `npm run refresh`. You never need to update counts manually.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── Helpers ───

function extract(html, name) {
    const re = new RegExp(`const ${name} = (\\{[\\s\\S]*?\\n\\});`);
    const m = html.match(re);
    if (!m) { console.error(`Could not find ${name}`); process.exit(1); }
    return new Function('return ' + m[1])();
}

function classifyRole(title) {
    const t = title.toLowerCase();
    if (/(machine learning|ml |ml\/|deep learning|ai research|ai scientist|llm|nlp|computer vision|cv engineer|research scientist|research engineer|reinforcement learning|ai safety|interpretability|alignment)/.test(t)) return 'ml-ai';
    if (/(data scien|data eng|data analy|data infra|data platform|analytics engineer|business intel)/.test(t)) return 'data';
    if (/design/.test(t) && !/engineer|security/.test(t)) return 'design';
    if (/(product manag|program manag|technical program|product owner|product lead|head of product|product strateg|product director|product operation|product analys|scrum master|agile coach)/.test(t)) return 'product';
    if (/(engineer|developer|swe|software|frontend|backend|fullstack|full-stack|devops|sre|infrastructure|platform|architect|firmware|embedded)/.test(t) && !/(solutions engineer|solutions architect|sales engineer|developer relations|devrel|account exec|account manag)/.test(t)) return 'engineering';
    if (/(marketing|growth|content|seo|communications|brand|copywriter|developer relations|devrel|community manag|editorial|creative)/.test(t)) return 'marketing';
    if (/(sales|account exec|account manag|business develop|revenue|gtm|go-to-market|solutions|partnerships|customer success|pre-sales)/.test(t) && !/accountant/.test(t)) return 'sales';
    if (/(finance|accounti|accountant|controller|treasury|fp&a|financial|investor relations)/.test(t)) return 'finance';
    if (/(recruiter|recruiting|people ops|people partner|talent|hr |human resources|sourcer|onboarding|enablement)/.test(t)) return 'hr-people';
    if (/(legal|counsel|compliance|policy|regulatory|paralegal|attorney)/.test(t)) return 'legal';
    if (/(support specialist|customer support|premium support|help desk|safety specialist|support delivery)/.test(t)) return 'support';
    if (/(operations|ops |logistics|supply chain|procurement|coordinator|facilities|workplace|office manag)/.test(t)) return 'operations';
    return 'other';
}

function fmt(n) { return n.toLocaleString('en-US'); }

// ─── Load source data ───

const allJobs = JSON.parse(readFileSync(resolve(ROOT, 'data/jobs-fetched.json'), 'utf-8'));
const jobsHtml = readFileSync(resolve(ROOT, 'jobs.html'), 'utf-8');
const COMPANIES = extract(jobsHtml, 'COMPANIES');
const COMPANY_REVIEWS = extract(jobsHtml, 'COMPANY_REVIEWS');

const knownSlugs = new Set(Object.keys(COMPANIES));
const companyCount = knownSlugs.size;
const knownJobs = allJobs.filter(j => knownSlugs.has(j.company));
const totalJobs = knownJobs.length;

console.log(`\nComputing counts for ${companyCount} companies, ${fmt(totalJobs)} jobs...\n`);

// ─── Compute CRC (Company Role Counts) ───

const crc = {};
for (const job of knownJobs) {
    const co = job.company;
    const role = classifyRole(job.title);
    if (!crc[co]) crc[co] = {};
    crc[co][role] = (crc[co][role] || 0) + 1;
}

const sortedCRC = {};
for (const co of Object.keys(crc).sort()) {
    sortedCRC[co] = {};
    for (const role of Object.keys(crc[co]).sort()) {
        sortedCRC[co][role] = crc[co][role];
    }
}
const crcJSON = JSON.stringify(sortedCRC);

// ─── Compute CV (Company Values — read from COMPANIES{}) ───

const cv = {};
for (const [slug, data] of Object.entries(COMPANIES)) {
    if (data.values && data.values.length > 0) {
        cv[slug] = data.values;
    }
}

const cvLines = Object.entries(cv).map(([slug, vals]) =>
    `    '${slug}':${JSON.stringify(vals)}`
).join(',\n');
const cvBlock = `const CV = {\n${cvLines},\n};`;

// ─── Compute per-value job counts (from CRC + CV) ───

const companyTotals = {};
for (const [co, roles] of Object.entries(sortedCRC)) {
    companyTotals[co] = Object.values(roles).reduce((a, b) => a + b, 0);
}

const valueCounts = {};
for (const [slug, vals] of Object.entries(cv)) {
    const total = companyTotals[slug] || 0;
    for (const v of vals) {
        valueCounts[v] = (valueCounts[v] || 0) + total;
    }
}

// ═══════════════════════════════════════════════════════════════
// UPDATE index.html
// ═══════════════════════════════════════════════════════════════

let indexHtml = readFileSync(resolve(ROOT, 'index.html'), 'utf-8');

// CRC + CV objects
indexHtml = indexHtml.replace(/const CRC = \{.*?\};/s, `const CRC = ${crcJSON};`);
indexHtml = indexHtml.replace(/const CV = \{[\s\S]*?\n\};/, cvBlock);

// All job count references (meta, hero, CTAs) — pattern-match, never assume a number
indexHtml = indexHtml.replace(/(Filter )[\d,]+( AI & tech roles)/g, `$1${fmt(totalJobs)}$2`);
indexHtml = indexHtml.replace(/(id="heroCount">)[\d,]+(<\/span>)/, `$1${fmt(totalJobs)}$2`);
indexHtml = indexHtml.replace(
    /(<div class="metric-val">)[\d,]+(<\/div><div class="metric-label">AI & tech roles<\/div>)/,
    `$1${fmt(totalJobs)}$2`
);
indexHtml = indexHtml.replace(
    /(<div class="metric-val">)\d+(<\/div><div class="metric-label">companies profiled<\/div>)/,
    `$1${companyCount}$2`
);
indexHtml = indexHtml.replace(/(See all )[\d,]+( jobs)/, `$1${fmt(totalJobs)}$2`);
indexHtml = indexHtml.replace(/(From )\d+( companies)/, `$1${companyCount}$2`);

// Browse-by-value cards — parse slugs from the HTML, not hardcoded
const valueCardMatches = [...indexHtml.matchAll(/value=([\w-]+)".+?→ [\d,]+ jobs<\/span>/gs)];
const valueCardSlugs = [...new Set(valueCardMatches.map(m => m[1]))];

for (const val of valueCardSlugs) {
    const count = valueCounts[val] || 0;
    const re = new RegExp(`(value=${val}"[^>]*>.*?→ )[\\d,]+( jobs</span>)`, 's');
    indexHtml = indexHtml.replace(re, `$1${fmt(count)}$2`);
}

// "All AI & Tech Jobs" card
indexHtml = indexHtml.replace(/(browse all )\d+( companies)/, `$1${companyCount}$2`);
indexHtml = indexHtml.replace(
    /(All AI & Tech Jobs<\/h3>.*?→ )[\d,]+( jobs<\/span>)/s,
    `$1${fmt(totalJobs)}$2`
);

// Featured jobs — pick 8 recent jobs from different companies, prefer eng/ml/data roles
const featuredRoles = new Set(['engineering', 'ml-ai', 'data', 'design', 'product']);

// Build best candidate per company (prefer featured roles)
const bestPerCompany = {};
for (const job of knownJobs) {
    const co = job.company;
    const role = classifyRole(job.title);
    const isFeatured = featuredRoles.has(role);
    if (!bestPerCompany[co] || (isFeatured && !bestPerCompany[co].isFeatured)) {
        bestPerCompany[co] = { job, isFeatured };
    }
}
// Sort: companies with featured roles first, then by job count (bigger = more recognizable)
const featured = Object.entries(bestPerCompany)
    .sort((a, b) => {
        const af = a[1].isFeatured ? 1 : 0, bf = b[1].isFeatured ? 1 : 0;
        if (af !== bf) return bf - af;
        return (companyTotals[b[0]] || 0) - (companyTotals[a[0]] || 0);
    })
    .slice(0, 8)
    .map(([, c]) => c.job);

const featuredCards = featured.map(job => {
    const co = COMPANIES[job.company];
    const domain = co.careers.replace(/https?:\/\/(www\.)?/, '').replace(/\/.*/, '');
    return `                <a href="${job.url}" target="_blank" class="fj-card">
                    <div class="fj-top">
                        <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=128" alt="${co.name}" class="fj-logo">
                        <div>
                            <div class="fj-title">${job.title}</div>
                            <div class="fj-company">${co.name}</div>
                        </div>
                    </div>
                    <div class="fj-meta">
                        <span class="fj-loc">${job.location || 'Remote'}</span>
                    </div>
                    <div class="fj-bottom">
                        <span class="fj-posted">${job.posted || 'Recent'}</span>
                        <span class="fj-apply">Apply →</span>
                    </div>
                </a>`;
}).join('\n');

indexHtml = indexHtml.replace(
    /(<div class="fj-grid">)[\s\S]*?(<\/div>\s*<div class="fj-cta">)/,
    `$1\n\n${featuredCards}\n        $2`
);

writeFileSync(resolve(ROOT, 'index.html'), indexHtml);
console.log(`✓ index.html — CRC (${Object.keys(sortedCRC).length}), CV (${Object.keys(cv).length}), ${valueCardSlugs.length} value cards, ${featured.length} featured jobs, hero, meta`);

// ═══════════════════════════════════════════════════════════════
// UPDATE compare.html
// ═══════════════════════════════════════════════════════════════

let compareHtml = readFileSync(resolve(ROOT, 'compare.html'), 'utf-8');

// CRC
compareHtml = compareHtml.replace(/const CRC = \{.*?\};/s, `const CRC = ${crcJSON};`);

// Sync COMPANY_REVIEWS — always overwrite from jobs.html (single source of truth)
const compareReviews = extract(compareHtml, 'COMPANY_REVIEWS');
for (const [slug, review] of Object.entries(COMPANY_REVIEWS)) {
    compareReviews[slug] = review;
}
const reviewLines = Object.entries(compareReviews).map(([slug, r]) =>
    `    '${slug}': { pros: ${JSON.stringify(r.pros)}, cons: ${JSON.stringify(r.cons)} }`
).join(',\n');
compareHtml = compareHtml.replace(
    /const COMPANY_REVIEWS = \{[\s\S]*?\n\};/,
    `const COMPANY_REVIEWS = {\n${reviewLines},\n};`
);

// Sync COMPANIES — preserve compare-specific fields, sync shared fields, add new
const compareCompanies = extract(compareHtml, 'COMPANIES');
const newCompanies = [];

for (const [slug, jobsData] of Object.entries(COMPANIES)) {
    if (!compareCompanies[slug]) {
        // New company — derive compare fields from glassdoor score
        compareCompanies[slug] = {
            name: jobsData.name,
            logo: jobsData.logo,
            size: jobsData.size,
            glassdoor: jobsData.glassdoor,
            wlb_score: jobsData.wlb_score,
            culture_values: Math.round((jobsData.glassdoor + 0.1) * 10) / 10,
            comp_benefits: jobsData.glassdoor,
            senior_mgmt: Math.round((jobsData.glassdoor - 0.2) * 10) / 10,
            career_opps: Math.round((jobsData.glassdoor - 0.2) * 10) / 10,
            recommend: Math.min(95, Math.round(jobsData.glassdoor * 20)),
            ceo_approval: Math.min(95, Math.round(jobsData.glassdoor * 21)),
            ceo_name: 'CEO',
            values: jobsData.values,
            careers: jobsData.careers,
            bestFor: `Professionals interested in ${jobsData.name}`,
            verdict: `${jobsData.name} — check Glassdoor for detailed reviews.`,
        };
        newCompanies.push(slug);
    } else {
        // Existing — sync shared fields from jobs.html (source of truth)
        const c = compareCompanies[slug];
        c.name = jobsData.name;
        c.logo = jobsData.logo;
        c.size = jobsData.size;
        c.glassdoor = jobsData.glassdoor;
        c.wlb_score = jobsData.wlb_score;
        c.values = jobsData.values;
        c.careers = jobsData.careers;
    }
}

// Rewrite COMPANIES block
const compLines = Object.entries(compareCompanies).map(([slug, c]) => {
    const parts = [
        `name: ${JSON.stringify(c.name)}`,
        `logo: ${JSON.stringify(c.logo)}`,
        `size: ${JSON.stringify(c.size)}`,
        `glassdoor: ${c.glassdoor}`,
        `wlb_score: ${c.wlb_score}`,
        `culture_values: ${c.culture_values}`,
        `comp_benefits: ${c.comp_benefits}`,
        `senior_mgmt: ${c.senior_mgmt}`,
        `career_opps: ${c.career_opps}`,
        `recommend: ${c.recommend}`,
        `ceo_approval: ${c.ceo_approval}`,
        `ceo_name: ${JSON.stringify(c.ceo_name)}`,
        `values: ${JSON.stringify(c.values)}`,
        `careers: ${JSON.stringify(c.careers)}`,
        `bestFor: ${JSON.stringify(c.bestFor)}`,
        `verdict: ${JSON.stringify(c.verdict)}`,
    ];
    return `    '${slug}': { ${parts.join(', ')} }`;
}).join(',\n');
compareHtml = compareHtml.replace(
    /const COMPANIES = \{[\s\S]*?\n\};/,
    `const COMPANIES = {\n${compLines},\n};`
);

// Company count in meta/comments
compareHtml = compareHtml.replace(/(for )\d+( AI &amp; tech companies)/g, `$1${companyCount}$2`);
compareHtml = compareHtml.replace(/(\/\/ Our )\d+( profiled companies)/, `$1${companyCount}$2`);

writeFileSync(resolve(ROOT, 'compare.html'), compareHtml);

if (newCompanies.length > 0) {
    console.log(`✓ compare.html — CRC, COMPANIES (${Object.keys(compareCompanies).length}), COMPANY_REVIEWS`);
    console.log(`  ⚠ New companies added with estimated data: ${newCompanies.join(', ')}`);
    console.log(`    → Edit compare.html to set real ceo_name, bestFor, verdict for these`);
} else {
    console.log(`✓ compare.html — CRC, COMPANIES (${Object.keys(compareCompanies).length}), COMPANY_REVIEWS`);
}

// ═══════════════════════════════════════════════════════════════
// UPDATE directory.html
// ═══════════════════════════════════════════════════════════════

let dirHtml = readFileSync(resolve(ROOT, 'directory.html'), 'utf-8');
dirHtml = dirHtml.replace(/(Browse all )\d+( profiled)/g, `$1${companyCount}$2`);
dirHtml = dirHtml.replace(/(All )\d+( profiled)/g, `$1${companyCount}$2`);
dirHtml = dirHtml.replace(/(\s)\d+( companies profiled)/g, `$1${companyCount}$2`);
writeFileSync(resolve(ROOT, 'directory.html'), dirHtml);
console.log(`✓ directory.html — ${companyCount} companies`);

// ═══════════════════════════════════════════════════════════════
// UPDATE llms.txt
// ═══════════════════════════════════════════════════════════════

let llms = readFileSync(resolve(ROOT, 'llms.txt'), 'utf-8');
llms = llms.replace(/(Browse )[\d,]+(\+ jobs)/g, `$1${fmt(totalJobs)}$2`);
llms = llms.replace(/[\d,]+(\+ AI & tech jobs)/g, `${fmt(totalJobs)}$1`);
llms = llms.replace(/(All )\d+( profiled)/g, `$1${companyCount}$2`);
writeFileSync(resolve(ROOT, 'llms.txt'), llms);
console.log(`✓ llms.txt — ${fmt(totalJobs)} jobs, ${companyCount} companies`);

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log(`\n✅ All counts updated: ${fmt(totalJobs)} jobs across ${companyCount} companies`);

// Show top value counts (parsed from actual data, not hardcoded)
const topValues = Object.entries(valueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([v, c]) => `${v}=${fmt(c)}`)
    .join(', ');
console.log(`   Top values: ${topValues}`);
