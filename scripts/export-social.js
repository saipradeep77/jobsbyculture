#!/usr/bin/env node
/**
 * Generates a social media CSV for Google Sheets / Zapier.
 *
 * Workflow:
 * 1. Reads fresh jobs from data/jobs-fetched.json
 * 2. Reads COMPANIES from jobs.html for culture values & ratings
 * 3. Reads previous CSV (data/jobs-export.csv) to preserve statuses
 * 4. Merges:
 *    - New jobs → status "pending" (Zapier will post these)
 *    - Still-live jobs → keep previous status ("posted" / "pending")
 *    - Removed jobs → status "expired"
 * 5. Writes merged CSV to data/jobs-export.csv
 *
 * Usage: node scripts/export-social.js
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Value code → human-readable mapping ──
const VALUE_LABELS = {
    'wlb': 'Work-Life Balance',
    'remote': 'Remote-Friendly',
    'flex-hours': 'Flexible Hours',
    'async': 'Async Communication',
    'deep-work': 'Deep Work / Low Meetings',
    'transparent': 'Transparency',
    'flat': 'Flat Hierarchy',
    'diverse': 'Diverse & Inclusive',
    'psych-safety': 'Psychological Safety',
    'eng-driven': 'Engineering-Driven',
    'ship-fast': 'Ship Fast & Iterate',
    'open-source': 'Open Source Culture',
    'learning': 'Learning & Growth',
    'equity': 'Strong Comp & Equity',
    'product-impact': 'Direct Product Impact',
    'many-hats': 'Wears Many Hats',
    'ethical-ai': 'Ethical AI / Safety',
    'social-impact': 'Mission-Driven'
};

// ── Role categorization by keywords ──
function categorizeRole(title) {
    const t = title.toLowerCase();

    if (/\b(machine learning|ml engineer|ai scientist|ai research|deep learning|nlp|computer vision|llm)\b/.test(t))
        return 'ML / AI';
    if (/\b(data scientist|data analyst|data engineer|analytics engineer|business intelligence)\b/.test(t))
        return 'Data';
    if (/\b(design|ux|ui|brand design|graphic design|visual design|content design)\b/.test(t))
        return 'Design';
    if (/\b(engineer|developer|sre|devops|infrastructure|backend|frontend|fullstack|full.stack|platform|security engineer|software)\b/.test(t))
        return 'Engineering';
    if (/\b(product manager|product lead|product director)\b/.test(t))
        return 'Product';
    if (/\b(marketing|growth|content strat|seo|communications|copywriter|brand manager|social media)\b/.test(t))
        return 'Marketing';
    if (/\b(sales|account executive|account manager|business develop|solutions architect|solutions engineer|customer success|revenue|partnerships)\b/.test(t))
        return 'Sales';
    if (/\b(finance|accounting|controller|treasury|tax|payroll|billing|financial analyst)\b/.test(t))
        return 'Finance';
    if (/\b(recruiter|recruiting|people ops|people partner|talent|hr |human resources|compensation|benefits admin)\b/.test(t))
        return 'HR / People';
    if (/\b(legal|counsel|compliance|regulatory|policy|privacy|paralegal)\b/.test(t))
        return 'Legal';
    if (/\b(support|customer service|help desk|technical support|customer experience)\b/.test(t))
        return 'Support';
    if (/\b(operations|program manager|project manager|chief of staff|office manager|facilities|workplace|supply chain|logistics)\b/.test(t))
        return 'Operations';

    return 'Other';
}

// ── Seniority detection ──
function detectSeniority(title) {
    const t = title.toLowerCase();

    if (/\b(vp|vice president|head of|chief|cto|cfo|coo|ceo|evp|svp)\b/.test(t))
        return 'VP / Executive';
    if (/\b(director)\b/.test(t))
        return 'Director';
    if (/\b(staff|principal|distinguished|fellow|member of technical staff)\b/.test(t))
        return 'Staff / Principal';
    if (/\b(manager|lead|team lead|tech lead|engineering manager)\b/.test(t))
        return 'Lead / Manager';
    if (/\b(senior|sr\.?|iii)\b/.test(t))
        return 'Senior';
    if (/\b(junior|jr\.?|associate|intern|entry.level|new grad|i\b)\b/.test(t))
        return 'Junior / Entry';

    return 'Mid-Level';
}

// ── CSV helpers ──
function escapeCSV(val) {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

function parseCSVLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') {
                current += '"';
                i++;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                fields.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
    }
    fields.push(current);
    return fields;
}

// ── Main ──

// 1. Read COMPANIES from jobs.html
const htmlPath = resolve(ROOT, 'jobs.html');
const html = readFileSync(htmlPath, 'utf-8');

const companiesMatch = html.match(/const COMPANIES = \{[\s\S]*?\n\};/);
if (!companiesMatch) {
    console.error('Could not find COMPANIES in jobs.html');
    process.exit(1);
}

// Extract company data using regex (name, values, glassdoor)
const companyData = {};
const companyRegex = /'([a-z0-9-]+)'\s*:\s*\{[^}]*name:\s*'([^']+)'[^}]*glassdoor:\s*([\d.]+)[^}]*values:\s*\[([^\]]+)\][^}]*\}/g;
let m;
while ((m = companyRegex.exec(companiesMatch[0])) !== null) {
    const [, slug, name, glassdoor, valuesStr] = m;
    const values = valuesStr.match(/'([^']+)'/g)?.map(v => v.replace(/'/g, '')) || [];
    companyData[slug] = {
        name,
        glassdoor: parseFloat(glassdoor),
        values: values.map(v => VALUE_LABELS[v] || v).join(', ')
    };
}

console.log(`Loaded ${Object.keys(companyData).length} companies from jobs.html`);

// 2. Read fresh jobs
const jobsPath = resolve(ROOT, 'data/jobs-fetched.json');
const freshJobs = JSON.parse(readFileSync(jobsPath, 'utf-8'));

// Filter to known companies only
const knownJobs = freshJobs.filter(j => companyData[j.company]);
console.log(`${knownJobs.length} jobs from known companies (${freshJobs.length - knownJobs.length} skipped)`);

// 3. Read previous CSV for status preservation
const csvPath = resolve(ROOT, 'data/jobs-export.csv');
const prevStatuses = new Map(); // url → { status, post_count, last_posted }

if (existsSync(csvPath)) {
    const lines = readFileSync(csvPath, 'utf-8').split('\n').filter(l => l.trim());
    const header = lines[0];
    const headerFields = parseCSVLine(header);
    const statusIdx = headerFields.indexOf('status');
    const urlIdx = headerFields.indexOf('apply_url');
    const postCountIdx = headerFields.indexOf('post_count');
    const lastPostedIdx = headerFields.indexOf('last_posted');

    for (let i = 1; i < lines.length; i++) {
        const fields = parseCSVLine(lines[i]);
        const url = fields[urlIdx];
        if (url) {
            prevStatuses.set(url, {
                status: statusIdx >= 0 ? fields[statusIdx] : '',
                post_count: postCountIdx >= 0 ? fields[postCountIdx] : '',
                last_posted: lastPostedIdx >= 0 ? fields[lastPostedIdx] : ''
            });
        }
    }
    console.log(`Loaded ${prevStatuses.size} previous jobs for status merge`);
}

// 4. Build fresh job URLs set for expired detection
const freshUrls = new Set(knownJobs.map(j => j.url));

// 5. Build rows for active jobs
const HEADER = 'id,title,company,company_slug,location,type,posted,role_category,seniority,culture_values,glassdoor_rating,apply_url,profile_url,jobs_filter_url,post_count,last_posted,status';

const rows = [];
let newCount = 0;
let keptCount = 0;

for (const j of knownJobs) {
    const co = companyData[j.company];
    const prev = prevStatuses.get(j.url);
    let status, postCount, lastPosted;

    if (prev) {
        status = prev.status || 'pending';
        postCount = prev.post_count;
        lastPosted = prev.last_posted;
        keptCount++;
    } else {
        status = 'pending';
        postCount = '';
        lastPosted = '';
        newCount++;
    }

    rows.push([
        j.id,
        escapeCSV(j.title),
        escapeCSV(co.name),
        j.company,
        escapeCSV(j.location),
        escapeCSV(j.type || 'Full-time'),
        escapeCSV(j.posted || '1w ago'),
        categorizeRole(j.title),
        detectSeniority(j.title),
        escapeCSV(co.values),
        co.glassdoor,
        escapeCSV(j.url),
        `https://jobsbyculture.com/companies/${j.company}`,
        `https://jobsbyculture.com/jobs?company=${j.company}`,
        escapeCSV(postCount),
        escapeCSV(lastPosted),
        status
    ].join(','));
}

// 6. Add expired jobs (were in previous CSV but no longer live)
let expiredCount = 0;
if (prevStatuses.size > 0) {
    // Re-read previous CSV to get full row data for expired jobs
    const lines = readFileSync(csvPath, 'utf-8').split('\n').filter(l => l.trim());
    const headerFields = parseCSVLine(lines[0]);
    const urlIdx = headerFields.indexOf('apply_url');

    for (let i = 1; i < lines.length; i++) {
        const fields = parseCSVLine(lines[i]);
        const url = fields[urlIdx];

        if (url && !freshUrls.has(url)) {
            // This job no longer exists — mark as expired
            const statusIdx = headerFields.indexOf('status');
            const prevStatus = statusIdx >= 0 ? fields[statusIdx] : '';

            // Only add if not already expired (avoid duplicating)
            if (prevStatus !== 'expired') {
                expiredCount++;
            }

            // Rebuild the row with updated status and adjusted column order
            const postCountIdx = headerFields.indexOf('post_count');
            const lastPostedIdx = headerFields.indexOf('last_posted');

            rows.push([
                fields[headerFields.indexOf('id')],
                escapeCSV(fields[headerFields.indexOf('title')]),
                escapeCSV(fields[headerFields.indexOf('company')]),
                fields[headerFields.indexOf('company_slug')],
                escapeCSV(fields[headerFields.indexOf('location')]),
                escapeCSV(fields[headerFields.indexOf('type')]),
                escapeCSV(fields[headerFields.indexOf('posted')]),
                fields[headerFields.indexOf('role_category')],
                fields[headerFields.indexOf('seniority')],
                escapeCSV(fields[headerFields.indexOf('culture_values')]),
                fields[headerFields.indexOf('glassdoor_rating')],
                escapeCSV(url),
                fields[headerFields.indexOf('profile_url')],
                fields[headerFields.indexOf('jobs_filter_url')],
                escapeCSV(postCountIdx >= 0 ? fields[postCountIdx] : ''),
                escapeCSV(lastPostedIdx >= 0 ? fields[lastPostedIdx] : ''),
                'expired'
            ].join(','));
        }
    }
}

// 7. Write output
const output = HEADER + '\n' + rows.join('\n') + '\n';
writeFileSync(csvPath, output);

console.log(`\n✓ Exported ${rows.length} total rows to ${csvPath}`);
console.log(`  ${newCount} new (status: pending)`);
console.log(`  ${keptCount} existing (status preserved)`);
console.log(`  ${expiredCount} newly expired (status: expired)`);
console.log(`\nUpload data/jobs-export.csv to Google Sheets. Zapier will pick up "pending" jobs.`);
