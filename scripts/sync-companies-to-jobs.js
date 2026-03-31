#!/usr/bin/env node
/**
 * Syncs data/companies.json → jobs.html (COMPANIES + COMPANY_REVIEWS objects)
 * and runs build-homepage-grid.js to update index.html.
 *
 * Single source of truth: data/companies.json
 * Run: node scripts/sync-companies-to-jobs.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const data = JSON.parse(readFileSync(resolve(ROOT, 'data/companies.json'), 'utf-8'));
const companies = data.companies;

function escapeJs(s) {
    return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

// ─── Build COMPANIES object ───
let companiesJs = `// ═══ COMPANY DATA — auto-synced from data/companies.json ═══\n`;
companiesJs += `// COMPANIES-START\nconst COMPANIES = {\n`;

for (const [slug, co] of Object.entries(companies)) {
    const valuesStr = co.values.map(v => `'${v}'`).join(',');
    companiesJs += `    '${slug}': {\n`;
    companiesJs += `        name: '${escapeJs(co.name)}', logo: '${co.logo}',\n`;
    companiesJs += `        size: '${escapeJs(co.size)}', glassdoor: ${co.glassdoor}, wlb_score: ${co.wlb_score},\n`;
    companiesJs += `        values: [${valuesStr}],\n`;
    companiesJs += `        careers: '${co.careers}'\n`;
    companiesJs += `    },\n`;
}

companiesJs += `};\n\n`;

// ─── Build COMPANY_REVIEWS object ───
companiesJs += `// COMPANY-REVIEWS-START\nconst COMPANY_REVIEWS = {\n`;

for (const [slug, co] of Object.entries(companies)) {
    const pros = co.reviewPros || co.pros || [];
    const cons = co.reviewCons || co.cons || [];
    const prosStr = pros.slice(0, 2).map(p => `'${escapeJs(p)}'`).join(', ');
    const consStr = cons.slice(0, 2).map(c => `'${escapeJs(c)}'`).join(', ');
    companiesJs += `    '${slug}': {\n`;
    companiesJs += `        pros: [${prosStr}],\n`;
    companiesJs += `        cons: [${consStr}]\n`;
    companiesJs += `    },\n`;
}

companiesJs += `};\n// COMPANIES-END`;

// ─── Replace in jobs.html ───
const jobsPath = resolve(ROOT, 'jobs.html');
let html = readFileSync(jobsPath, 'utf-8');

const START = '// COMPANIES-START';
const END = '// COMPANIES-END';

const startIdx = html.indexOf(START);
const endIdx = html.indexOf(END) + END.length;

if (startIdx === -1 || endIdx === -1) {
    console.error('ERROR: Could not find COMPANIES-START/END markers in jobs.html');
    process.exit(1);
}

// Find the line before COMPANIES-START (the comment line)
const lineBeforeStart = html.lastIndexOf('\n', startIdx);
html = html.slice(0, lineBeforeStart + 1) + companiesJs + html.slice(endIdx);

writeFileSync(jobsPath, html);
console.log(`✓ Synced ${Object.keys(companies).length} companies to jobs.html`);

// ─── Also rebuild homepage grid ───
console.log('Rebuilding homepage grid...');
execSync('node scripts/build-homepage-grid.js', { cwd: ROOT, stdio: 'inherit' });

console.log('\nDone! jobs.html and index.html are both synced from data/companies.json');
