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

// classifyRole: synced with update-counts.js — keep these identical
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
        (ROLES[classifyRole(job.title)]?.name || classifyRole(job.title)),
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
