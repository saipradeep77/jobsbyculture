#!/usr/bin/env node
/**
 * Updates jobs.html with fresh job data from data/jobs-fetched.json
 *
 * What it does:
 * 1. Reads jobs-fetched.json (from fetch-jobs.js)
 * 2. Replaces the JOBS array in jobs.html with fresh data
 * 3. Updates job counts in meta tags and UI
 *
 * What it does NOT do (requires manual/AI work):
 * - Add new entries to COMPANIES{} (needs culture values, glassdoor ratings)
 * - Add new entries to COMPANY_REVIEWS{} (needs pros/cons research)
 *
 * Usage: node scripts/update-jobs-html.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Read fetched jobs
const jobsPath = resolve(ROOT, 'data/jobs-fetched.json');
const jobs = JSON.parse(readFileSync(jobsPath, 'utf-8'));

// Read current jobs.html
const htmlPath = resolve(ROOT, 'jobs.html');
let html = readFileSync(htmlPath, 'utf-8');

// Extract existing COMPANIES keys to filter out jobs for unknown companies
const companiesMatch = html.match(/const COMPANIES = \{[\s\S]*?\n\};/);
if (!companiesMatch) {
    console.error('Could not find COMPANIES object in jobs.html');
    process.exit(1);
}
const companyKeys = [...companiesMatch[0].matchAll(/'([a-z0-9-]+)'\s*:\s*\{/g)].map(m => m[1]);
console.log(`Found ${companyKeys.length} companies in COMPANIES: ${companyKeys.join(', ')}`);

// Filter jobs to only include known companies
const knownJobs = jobs.filter(j => companyKeys.includes(j.company));
const unknownCompanies = [...new Set(jobs.filter(j => !companyKeys.includes(j.company)).map(j => j.company))];

if (unknownCompanies.length > 0) {
    console.log(`\n⚠ Skipping ${unknownCompanies.length} companies not in COMPANIES{}: ${unknownCompanies.join(', ')}`);
    console.log('  Add them to COMPANIES{} and COMPANY_REVIEWS{} in jobs.html first.\n');
}

// Format jobs as JS array entries
const jobLines = knownJobs.map(j => {
    const title = j.title.replace(/'/g, "\\'");
    const location = j.location.replace(/'/g, "\\'");
    const type = (j.type || 'Full-time').replace(/'/g, "\\'");
    const posted = j.posted || '1w ago';
    const url = j.url.replace(/'/g, "\\'");
    return `    { id: ${j.id}, title: '${title}', company: '${j.company}', location: '${location}', type: '${type}', posted: '${posted}', source: 'API', url: '${url}' }`;
}).join(',\n');

const newJobsBlock = `const JOBS = [\n${jobLines}\n];`;

// Replace JOBS array in HTML
const jobsRegex = /const JOBS = \[[\s\S]*?\n\];/;
if (!jobsRegex.test(html)) {
    console.error('Could not find JOBS array in jobs.html');
    process.exit(1);
}

html = html.replace(jobsRegex, newJobsBlock);

// Update job count in meta tags and visible text
const oldCount = html.match(/Browse ([\d,]+) AI/)?.[1] || '1,463';
const newCount = knownJobs.length.toLocaleString();
html = html.replace(new RegExp(oldCount.replace(/,/g, ',?'), 'g'), newCount);

// Also update any hardcoded "1,463" references
html = html.replace(/1,?463/g, newCount);

writeFileSync(htmlPath, html);

console.log(`✓ Updated JOBS array: ${knownJobs.length} jobs from ${companyKeys.length} companies`);
console.log(`✓ Updated job counts: ${oldCount} → ${newCount}`);
console.log(`✓ Saved to ${htmlPath}`);
