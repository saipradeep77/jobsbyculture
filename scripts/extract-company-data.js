#!/usr/bin/env node
/**
 * One-time extraction script: pulls company data from index.html cards + jobs.html
 * into a single data/companies.json file.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── Parse COMPANIES and COMPANY_REVIEWS from jobs.html ───
const jobsHtml = readFileSync(resolve(ROOT, 'jobs.html'), 'utf-8');

function extractJsObject(html, varName) {
    const regex = new RegExp(`const ${varName} = \\{`, 'm');
    const match = html.match(regex);
    if (!match) throw new Error(`Could not find ${varName}`);

    let start = match.index + match[0].length - 1;
    let depth = 1;
    let i = start + 1;
    while (depth > 0 && i < html.length) {
        if (html[i] === '{') depth++;
        if (html[i] === '}') depth--;
        i++;
    }
    const jsCode = html.slice(start, i);
    // Evaluate using Function constructor (safe - we control the input)
    return new Function(`return ${jsCode}`)();
}

const COMPANIES = extractJsObject(jobsHtml, 'COMPANIES');
const COMPANY_REVIEWS = extractJsObject(jobsHtml, 'COMPANY_REVIEWS');

console.log(`Extracted ${Object.keys(COMPANIES).length} companies from jobs.html`);
console.log(`Extracted ${Object.keys(COMPANY_REVIEWS).length} reviews from jobs.html`);

// ─── Parse card data from index.html ───
const indexHtml = readFileSync(resolve(ROOT, 'index.html'), 'utf-8');

// Value label mapping (the canonical labels for each value slug)
const VALUE_LABELS = {
    'wlb': '⚖️ Work-Life Balance',
    'remote': '🌐 Remote',
    'flex-hours': '🕐 Flex Hours',
    'async': '📡 Async',
    'deep-work': '🎧 Deep Work',
    'transparent': '🪟 Transparent',
    'flat': '🤝 Flat Hierarchy',
    'diverse': '🌈 Diverse',
    'psych-safety': '🛡️ Safe to Fail',
    'eng-driven': '⚙️ Engineering-Driven',
    'ship-fast': '🚀 Ship Fast',
    'open-source': '🔓 Open Source',
    'learning': '📚 Learning & Growth',
    'equity': '💰 Strong Equity',
    'product-impact': '🎯 Product Impact',
    'many-hats': '🧩 Many Hats',
    'ethical-ai': '🛡️ Ethical AI',
    'social-impact': '💜 Mission-Driven'
};

// Extract cards using regex patterns
const cardRegex = /<div class="co-card" data-company="([^"]+)" data-values="([^"]+)">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/g;

const cards = {};
let match;
const cardBlocks = indexHtml.split(/(?=<div class="co-card" data-company=")/);

for (const block of cardBlocks) {
    const slugMatch = block.match(/data-company="([^"]+)"/);
    if (!slugMatch) continue;
    const slug = slugMatch[1];

    // Extract meta
    const metaMatch = block.match(/<div class="co-meta">([^<]+)<\/div>/);
    const meta = metaMatch ? metaMatch[1].trim() : '';

    // Extract quote
    const quoteMatch = block.match(/<div class="co-quote">"([^"]*)"<\/div>/);
    const quote = quoteMatch ? quoteMatch[1].trim() : '';

    // Extract location
    const locMatch = block.match(/<span class="co-loc">([^<]+)<\/span>/);
    const location = locMatch ? locMatch[1].trim() : '';

    // Extract detail items
    const details = {};
    const detailRegex = /<span class="co-detail-label">([^<]+)<\/span>\s*<span class="co-detail-value">([^<]+)<\/span>/g;
    let dm;
    while ((dm = detailRegex.exec(block)) !== null) {
        details[dm[1].trim()] = dm[2].trim();
    }

    // Extract pros
    const prosMatch = block.match(/co-pros.*?<ul>([\s\S]*?)<\/ul>/);
    const pros = [];
    if (prosMatch) {
        const liRegex = /<li>([^<]+)<\/li>/g;
        let lm;
        while ((lm = liRegex.exec(prosMatch[1])) !== null) {
            pros.push(lm[1].trim());
        }
    }

    // Extract cons
    const consMatch = block.match(/co-cons.*?<ul>([\s\S]*?)<\/ul>/);
    const cons = [];
    if (consMatch) {
        const liRegex = /<li>([^<]+)<\/li>/g;
        let lm;
        while ((lm = liRegex.exec(consMatch[1])) !== null) {
            cons.push(lm[1].trim());
        }
    }

    // Extract source
    const sourceMatch = block.match(/<div class="co-source">([^<]+)<\/div>/);
    const source = sourceMatch ? sourceMatch[1].trim() : 'Based on Glassdoor reviews';

    // Extract tags (preserve exact labels from the HTML)
    const tags = [];
    const tagRegex = /<span class="co-tag" data-v="([^"]+)">([^<]+)<\/span>/g;
    let tm;
    while ((tm = tagRegex.exec(block)) !== null) {
        tags.push({ slug: tm[1], label: tm[2].trim() });
    }

    cards[slug] = { meta, quote, location, details, pros, cons, source, tags };
}

console.log(`Extracted ${Object.keys(cards).length} cards from index.html`);

// ─── Merge into companies.json ───
const output = {
    valueLabels: VALUE_LABELS,
    companies: {}
};

for (const [slug, co] of Object.entries(COMPANIES)) {
    const review = COMPANY_REVIEWS[slug] || { pros: [], cons: [] };
    const card = cards[slug] || {};

    output.companies[slug] = {
        name: co.name,
        logo: co.logo,
        meta: card.meta || '',
        size: co.size,
        glassdoor: co.glassdoor,
        wlb_score: co.wlb_score,
        values: co.values,
        careers: co.careers,
        quote: card.quote || (review.pros[0] || ''),
        location: card.location || '',
        details: card.details || { Size: co.size.replace(/^(Small|Mid|Large)\s*/, '').replace(/[()]/g, '').trim() + ' employees', 'Work-Life Balance': co.wlb_score + '/5' },
        tags: card.tags && card.tags.length > 0 ? card.tags : co.values.map(v => ({ slug: v, label: VALUE_LABELS[v] || v })),
        pros: card.pros && card.pros.length > 0 ? card.pros : review.pros,
        cons: card.cons && card.cons.length > 0 ? card.cons : review.cons,
        source: card.source || 'Based on Glassdoor reviews',
        reviewPros: review.pros,
        reviewCons: review.cons
    };
}

const jsonPath = resolve(ROOT, 'data/companies.json');
writeFileSync(jsonPath, JSON.stringify(output, null, 2));
console.log(`\n✓ Written ${Object.keys(output.companies).length} companies to data/companies.json`);

// Validate: check for missing data
let warnings = 0;
for (const [slug, co] of Object.entries(output.companies)) {
    if (!co.meta) { console.warn(`  ⚠ ${slug}: missing meta`); warnings++; }
    if (!co.quote) { console.warn(`  ⚠ ${slug}: missing quote`); warnings++; }
    if (!co.location) { console.warn(`  ⚠ ${slug}: missing location`); warnings++; }
    if (co.pros.length === 0) { console.warn(`  ⚠ ${slug}: missing pros`); warnings++; }
    if (co.cons.length === 0) { console.warn(`  ⚠ ${slug}: missing cons`); warnings++; }
}
if (warnings === 0) console.log('  ✓ All companies have complete data');
else console.log(`  ${warnings} warnings — fill in missing data manually`);
