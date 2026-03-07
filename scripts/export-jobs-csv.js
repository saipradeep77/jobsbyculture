#!/usr/bin/env node
/**
 * Exports all jobs from jobs.html into a CSV for Google Sheets / Zapier.
 * Usage: node scripts/export-jobs-csv.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const jobsHtml = readFileSync(resolve(ROOT, 'jobs.html'), 'utf-8');

// Extract JOBS array
const jobsMatch = jobsHtml.match(/const JOBS = (\[[\s\S]*?\]);/);
if (!jobsMatch) { console.error('Could not find JOBS array'); process.exit(1); }
const JOBS = new Function('return ' + jobsMatch[1])();

// Extract COMPANIES data from jobs.html for culture values + glassdoor
const companiesMatch = jobsHtml.match(/const COMPANIES = (\{[\s\S]*?\});/);
const COMPANIES = companiesMatch ? new Function('return ' + companiesMatch[1])() : {};

// Extract VALUES for readable names
const valuesMatch = jobsHtml.match(/const VALUES = (\{[\s\S]*?\});/);
const VALUES = valuesMatch ? new Function('return ' + valuesMatch[1])() : {};

// Classify role from title
function classifyRole(title) {
    const t = title.toLowerCase();
    if (/\b(machine learning|ml |ml\/|deep learning|ai research|ai scientist|llm|nlp|computer vision|cv engineer)\b/.test(t)) return 'ML / AI';
    if (/\b(data scien|data eng|data analy|analytics|business intel)\b/.test(t)) return 'Data';
    if (/\b(design|ux|ui |visual|brand design|graphic)\b/.test(t)) return 'Design';
    if (/\b(engineer|developer|swe|software|frontend|backend|fullstack|full-stack|devops|sre|infrastructure|platform)\b/.test(t)) return 'Engineering';
    if (/\b(product manage|product lead|pm |head of product)\b/.test(t)) return 'Product';
    if (/\b(marketing|growth|content|seo|communications|brand)\b/.test(t)) return 'Marketing';
    if (/\b(sales|account exec|business develop|revenue|gtm|go-to-market|solutions)\b/.test(t)) return 'Sales';
    if (/\b(finance|accounting|controller|treasury|fp&a)\b/.test(t)) return 'Finance';
    if (/\b(recruiter|people|hr |talent|human resources)\b/.test(t)) return 'HR / People';
    if (/\b(legal|counsel|compliance|policy)\b/.test(t)) return 'Legal';
    if (/\b(support|customer success|helpdesk)\b/.test(t)) return 'Support';
    if (/\b(operations|ops |logistics|supply chain|procurement)\b/.test(t)) return 'Operations';
    return 'Other';
}

// Classify seniority
function classifySeniority(title) {
    const t = title.toLowerCase();
    if (/\b(director|vp |vice president|head of|chief)\b/.test(t)) return 'Director+';
    if (/\b(lead|manager|engineering manager)\b/.test(t)) return 'Lead / Manager';
    if (/\b(staff|principal|distinguished)\b/.test(t)) return 'Staff / Principal';
    if (/\b(senior|sr\.?)\b/.test(t)) return 'Senior';
    if (/\b(junior|jr\.?|intern|entry|associate|new grad)\b/.test(t)) return 'Entry / Junior';
    return 'Mid-Level';
}

// Get company display name
function companyName(slug) {
    const c = COMPANIES[slug];
    return c ? c.name : slug.charAt(0).toUpperCase() + slug.slice(1);
}

// Get culture values as readable string
function cultureValues(slug) {
    const c = COMPANIES[slug];
    if (!c || !c.values) return '';
    return c.values.map(v => {
        const val = VALUES[v];
        return val ? val.name : v;
    }).join(', ');
}

// Get glassdoor rating
function glassdoor(slug) {
    const c = COMPANIES[slug];
    return c ? c.glassdoor : '';
}

// Escape CSV field
function csvField(val) {
    const s = String(val || '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

// Build CSV
const headers = [
    'id', 'title', 'company', 'company_slug', 'location', 'type', 'posted',
    'role_category', 'seniority', 'culture_values', 'glassdoor_rating',
    'apply_url', 'profile_url', 'jobs_filter_url',
    'post_count', 'last_posted'
];

let csv = headers.join(',') + '\n';

for (const job of JOBS) {
    const name = companyName(job.company);
    const row = [
        job.id,
        job.title,
        name,
        job.company,
        job.location,
        job.type || 'Full-time',
        job.posted || '',
        classifyRole(job.title),
        classifySeniority(job.title),
        cultureValues(job.company),
        glassdoor(job.company),
        job.url,
        'https://jobsbyculture.com/companies/' + job.company,
        'https://jobsbyculture.com/jobs?company=' + job.company,
        0,
        ''
    ];
    csv += row.map(csvField).join(',') + '\n';
}

const outPath = resolve(ROOT, 'data/jobs-export.csv');
writeFileSync(outPath, csv);
console.log(`Exported ${JOBS.length} jobs to data/jobs-export.csv`);
