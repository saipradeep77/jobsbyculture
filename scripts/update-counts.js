#!/usr/bin/env node
/**
 * Automatically updates ALL job counts, CRC, and CV across the site.
 *
 * What it updates:
 *   index.html  — CRC, CV, hero count, browse-by-value cards, meta tags, CTAs
 *   compare.html — CRC, syncs COMPANIES + COMPANY_REVIEWS from jobs.html
 *   llms.txt     — job count, company count
 *
 * Run after fetch-jobs + update-jobs-html + build-cluster-pages:
 *   node scripts/update-counts.js
 *
 * This script is part of `npm run refresh` — you should never need to
 * update counts manually again.
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

function fmt(n) { return n.toLocaleString('en-US'); }

// ─── Load data ───

const jobsPath = resolve(ROOT, 'data/jobs-fetched.json');
const allJobs = JSON.parse(readFileSync(jobsPath, 'utf-8'));

const jobsHtml = readFileSync(resolve(ROOT, 'jobs.html'), 'utf-8');
const COMPANIES = extract(jobsHtml, 'COMPANIES');
const COMPANY_REVIEWS = extract(jobsHtml, 'COMPANY_REVIEWS');

const knownSlugs = new Set(Object.keys(COMPANIES));
const companyCount = knownSlugs.size;

// Only count jobs for companies in COMPANIES{}
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

// Sort alphabetically
const sortedCRC = {};
for (const co of Object.keys(crc).sort()) {
    sortedCRC[co] = {};
    for (const role of Object.keys(crc[co]).sort()) {
        sortedCRC[co][role] = crc[co][role];
    }
}

const crcJSON = JSON.stringify(sortedCRC);

// ─── Compute CV (Company Values) ───

const cv = {};
for (const [slug, data] of Object.entries(COMPANIES)) {
    if (data.values && data.values.length > 0) {
        cv[slug] = data.values;
    }
}

// Format CV as multi-line JS
const cvLines = Object.entries(cv).map(([slug, vals]) =>
    `    '${slug}':${JSON.stringify(vals)}`
).join(',\n');
const cvBlock = `const CV = {\n${cvLines},\n};`;

// ─── Compute browse-by-value counts ───

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

// ─── Update index.html ───

let indexHtml = readFileSync(resolve(ROOT, 'index.html'), 'utf-8');

// 1. Replace CRC
indexHtml = indexHtml.replace(
    /const CRC = \{.*?\};/s,
    `const CRC = ${crcJSON};`
);

// 2. Replace CV
indexHtml = indexHtml.replace(
    /const CV = \{[\s\S]*?\n\};/,
    cvBlock
);

// 3. Meta description job count
indexHtml = indexHtml.replace(
    /Filter [\d,]+ AI & tech roles/,
    `Filter ${fmt(totalJobs)} AI & tech roles`
);

// 4. Twitter description job count
indexHtml = indexHtml.replace(
    /Filter [\d,]+ AI & tech roles by culture/,
    `Filter ${fmt(totalJobs)} AI & tech roles by culture`
);

// 5. Hero button count
indexHtml = indexHtml.replace(
    /id="heroCount">[\d,]+<\/span>/,
    `id="heroCount">${fmt(totalJobs)}</span>`
);

// 6. Hero metric — jobs
indexHtml = indexHtml.replace(
    /<div class="metric-val">[\d,]+<\/div><div class="metric-label">AI & tech roles<\/div>/,
    `<div class="metric-val">${fmt(totalJobs)}</div><div class="metric-label">AI & tech roles</div>`
);

// 7. Hero metric — companies profiled
indexHtml = indexHtml.replace(
    /<div class="metric-val">\d+<\/div><div class="metric-label">companies profiled<\/div>/,
    `<div class="metric-val">${companyCount}</div><div class="metric-label">companies profiled</div>`
);

// 8. "See all X jobs" CTA
indexHtml = indexHtml.replace(
    /See all [\d,]+ jobs/,
    `See all ${fmt(totalJobs)} jobs`
);

// 9. "From X companies" note
indexHtml = indexHtml.replace(
    /From \d+ companies/,
    `From ${companyCount} companies`
);

// 10. Browse-by-value cards
const valueCards = ['eng-driven', 'flat', 'learning', 'ethical-ai', 'equity', 'many-hats', 'open-source', 'ship-fast'];
for (const val of valueCards) {
    const count = valueCounts[val] || 0;
    const re = new RegExp(`(value=${val}"[^>]*>.*?→ )[\\d,]+( jobs</span>)`, 's');
    indexHtml = indexHtml.replace(re, `$1${fmt(count)}$2`);
}

// 11. "All AI & Tech Jobs" card — total count + company count
indexHtml = indexHtml.replace(
    /(browse all )\d+( companies)/,
    `$1${companyCount}$2`
);
indexHtml = indexHtml.replace(
    /(All AI & Tech Jobs.*?→ )[\d,]+( jobs<\/span>)/s,
    `$1${fmt(totalJobs)}$2`
);

writeFileSync(resolve(ROOT, 'index.html'), indexHtml);
console.log(`✓ index.html — CRC (${Object.keys(sortedCRC).length} companies), CV, hero, browse cards, meta`);

// ─── Update compare.html ───

let compareHtml = readFileSync(resolve(ROOT, 'compare.html'), 'utf-8');

// 1. Replace CRC
compareHtml = compareHtml.replace(
    /const CRC = \{.*?\};/s,
    `const CRC = ${crcJSON};`
);

// 2. Sync COMPANY_REVIEWS from jobs.html
//    Extract existing compare COMPANY_REVIEWS, merge in any new ones from jobs.html
const compareReviews = extract(compareHtml, 'COMPANY_REVIEWS');
let reviewsChanged = false;
for (const [slug, review] of Object.entries(COMPANY_REVIEWS)) {
    if (!compareReviews[slug]) {
        compareReviews[slug] = review;
        reviewsChanged = true;
    }
}

if (reviewsChanged) {
    const reviewLines = Object.entries(compareReviews).map(([slug, r]) => {
        const pros = JSON.stringify(r.pros);
        const cons = JSON.stringify(r.cons);
        return `    '${slug}': { pros: ${pros}, cons: ${cons} }`;
    }).join(',\n');
    const reviewBlock = `const COMPANY_REVIEWS = {\n${reviewLines},\n};`;
    compareHtml = compareHtml.replace(/const COMPANY_REVIEWS = \{[\s\S]*?\n\};/, reviewBlock);
}

// 3. Sync COMPANIES from jobs.html → compare.html
//    Preserve compare-specific fields (culture_values, comp_benefits, etc.)
//    Add new companies with defaults
const compareCompanies = extract(compareHtml, 'COMPANIES');
let companiesChanged = false;

for (const [slug, jobsData] of Object.entries(COMPANIES)) {
    if (!compareCompanies[slug]) {
        // New company — add with defaults for compare-specific fields
        compareCompanies[slug] = {
            name: jobsData.name,
            logo: jobsData.logo,
            size: jobsData.size,
            glassdoor: jobsData.glassdoor,
            wlb_score: jobsData.wlb_score,
            culture_values: Math.round((jobsData.glassdoor + 0.1) * 10) / 10,
            comp_benefits: Math.round((jobsData.glassdoor) * 10) / 10,
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
        companiesChanged = true;
        console.log(`  + Added ${slug} to compare COMPANIES (review bestFor/verdict/ceo_name manually)`);
    } else {
        // Existing company — sync shared fields from jobs.html
        const existing = compareCompanies[slug];
        existing.name = jobsData.name;
        existing.logo = jobsData.logo;
        existing.size = jobsData.size;
        existing.glassdoor = jobsData.glassdoor;
        existing.wlb_score = jobsData.wlb_score;
        existing.values = jobsData.values;
        existing.careers = jobsData.careers;
    }
}

if (companiesChanged || true) {
    // Always rewrite to keep in sync
    const compLines = Object.entries(compareCompanies).map(([slug, c]) => {
        // Build the one-liner format matching compare.html style
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
    const compBlock = `const COMPANIES = {\n${compLines},\n};`;
    compareHtml = compareHtml.replace(/const COMPANIES = \{[\s\S]*?\n\};/, compBlock);
}

// 4. Update meta description company count
compareHtml = compareHtml.replace(
    /for \d+ AI &amp; tech companies/,
    `for ${companyCount} AI &amp; tech companies`
);

// 5. Update AUTOCOMPLETE_LIST comment
compareHtml = compareHtml.replace(
    /\/\/ Our \d+ profiled companies/,
    `// Our ${companyCount} profiled companies`
);

writeFileSync(resolve(ROOT, 'compare.html'), compareHtml);
console.log(`✓ compare.html — CRC, COMPANIES (${Object.keys(compareCompanies).length}), COMPANY_REVIEWS`);

// ─── Update llms.txt ───

let llms = readFileSync(resolve(ROOT, 'llms.txt'), 'utf-8');
llms = llms.replace(/Browse [\d,]+\+/g, `Browse ${fmt(totalJobs)}+`);
llms = llms.replace(/[\d,]+\+ AI & tech jobs/g, `${fmt(totalJobs)}+ AI & tech jobs`);
llms = llms.replace(/All \d+ profiled/g, `All ${companyCount} profiled`);
writeFileSync(resolve(ROOT, 'llms.txt'), llms);
console.log(`✓ llms.txt — ${fmt(totalJobs)} jobs, ${companyCount} companies`);

// ─── Summary ───

console.log(`\n✅ All counts updated: ${fmt(totalJobs)} jobs across ${companyCount} companies`);
console.log(`   Browse-by-value: eng-driven=${fmt(valueCounts['eng-driven']||0)}, learning=${fmt(valueCounts['learning']||0)}, ship-fast=${fmt(valueCounts['ship-fast']||0)}, equity=${fmt(valueCounts['equity']||0)}`);
