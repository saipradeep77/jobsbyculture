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
    'transparent': 'Transparent',
    'flat': 'Flat Hierarchy',
    'diverse': 'Diverse & Inclusive',
    'psych-safety': 'Psychological Safety',
    'eng-driven': 'Engineering-Driven',
    'ship-fast': 'Ship Fast & Iterate',
    'open-source': 'Open Source',
    'learning': 'Learning & Growth',
    'equity': 'Strong Comp & Equity',
    'product-impact': 'Direct Product Impact',
    'many-hats': 'Wears Many Hats',
    'ethical-ai': 'Ethical AI / Safety',
    'social-impact': 'Mission-Driven'
};

// ── Role categorization (synced with update-counts.js classifyRole) ──
// Returns human-readable labels for CSV, using the same matching logic as the site
const ROLE_LABELS = {
    'ml-ai': 'ML / AI', 'data': 'Data', 'design': 'Design', 'engineering': 'Engineering',
    'product': 'Product', 'marketing': 'Marketing', 'sales': 'Sales', 'finance': 'Finance',
    'hr-people': 'HR / People', 'legal': 'Legal', 'support': 'Support', 'operations': 'Operations',
    'other': 'Other',
};

function categorizeRole(title) {
    const t = title.toLowerCase();
    // ML/AI
    const mlPatterns = ['machine learning', 'research scientist', 'research engineer', 'reinforcement learning', 'ai safety', 'interpretability', 'alignment', 'computer vision', 'nlp engineer', 'natural language', 'deep learning', 'ai researcher', 'ai research', 'ml engineer', 'ml infrastructure', 'ml platform', 'ml acceleration', 'ml networking'];
    if (mlPatterns.some(p => t.includes(p)) || / ml /i.test(t) || /\bllm\b/i.test(t)) return ROLE_LABELS['ml-ai'];
    // Data
    const dataPatterns = ['data scien', 'data engineer', 'data analy', 'data infra', 'data platform', 'advanced analytics', 'business intelligence', 'bi engineer', 'bi analyst', 'analytics engineer'];
    if (dataPatterns.some(p => t.includes(p))) return ROLE_LABELS['data'];
    // Design
    if (t.includes('design') && !t.includes('engineer') && !t.includes('security')) return ROLE_LABELS['design'];
    // Product
    const productPatterns = ['product manag', 'program manag', 'technical program', 'product owner', 'product lead', 'scrum master', 'agile coach', 'product strateg', 'product director', 'head of product', 'product operation', 'product analys'];
    if (productPatterns.some(p => t.includes(p))) return ROLE_LABELS['product'];
    // Engineering
    const engPatterns = ['engineer', 'developer', 'architect', 'platform', 'sre ', 'site reliability', 'devops', 'qa ', 'quality assurance', 'security', 'systems', 'infrastructure', 'frontend', 'backend', 'fullstack', 'full stack', 'firmware', 'embedded'];
    const engExclusions = ['developer relations', 'developer education', 'devrel', 'solutions engineer', 'solutions architect', 'sales engineer', 'business systems', 'customer support engineer', 'gtm'];
    if (engPatterns.some(p => t.includes(p)) && !engExclusions.some(p => t.includes(p))) return ROLE_LABELS['engineering'];
    // Marketing
    const marketingPatterns = ['marketing', 'communications', 'developer relations', 'developer education', 'devrel', 'brand', 'social media', 'public relations', 'copywriter', 'growth marketing', 'community manag', 'influencer', 'creative', 'editorial', 'content'];
    if (marketingPatterns.some(p => t.includes(p))) return ROLE_LABELS['marketing'];
    // Sales
    const salesPatterns = ['account exec', 'account manag', 'sales', 'solutions engineer', 'solutions architect', 'sales engineer', 'gtm', 'business develop', 'partnerships', 'deal desk', 'revenue', 'engagement manag', 'customer success', 'pre-sales'];
    if (salesPatterns.some(p => t.includes(p)) && !t.includes('accountant')) return ROLE_LABELS['sales'];
    // Finance
    const financePatterns = ['accountant', 'accounting', 'financial', 'fp&a', 'treasury', 'controller', 'actuary', 'actuarial', 'investor relations', 'bookkeeper'];
    if (financePatterns.some(p => t.includes(p))) return ROLE_LABELS['finance'];
    // HR/People
    if (/(recruiter|recruiting|people ops|people partner|talent|hr |human resources|sourcer|onboarding|enablement)/.test(t)) return ROLE_LABELS['hr-people'];
    // Legal
    if (/(legal|counsel|compliance|policy|regulatory|paralegal|attorney)/.test(t)) return ROLE_LABELS['legal'];
    // Support
    if (/(support specialist|customer support|premium support|help desk|safety specialist|support delivery)/.test(t)) return ROLE_LABELS['support'];
    // Operations
    if (/(operations|ops |logistics|supply chain|procurement|coordinator|facilities|workplace|office manag)/.test(t)) return ROLE_LABELS['operations'];
    return ROLE_LABELS['other'];
}

// ── Seniority detection (synced with update-counts.js classifySeniority) ──
// Returns human-readable labels for CSV
function detectSeniority(title) {
    const t = title.toLowerCase();
    if (/\b(director|vp |vice president|head of|chief)\b/.test(t)) return 'VP / Director';
    if (/\b(lead|manager|engineering manager)\b/.test(t)) return 'Lead / Manager';
    if (/\b(staff|principal|distinguished)\b/.test(t)) return 'Staff / Principal';
    if (/\b(senior|sr\.?)\b/.test(t)) return 'Senior';
    if (/\b(junior|jr\.?|intern|entry|associate|new grad)\b/.test(t)) return 'Junior / Entry';
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

// Filter out non-English job titles
const isEnglishTitle = (title) => !/[\u3000-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\u0600-\u06FF\u0400-\u04FF\u0E00-\u0E7F\u0900-\u097F\u1100-\u11FF]/.test(title);
const englishJobs = freshJobs.filter(j => isEnglishTitle(j.title));
const nonEnglishCount = freshJobs.length - englishJobs.length;
if (nonEnglishCount > 0) console.log(`⚠ Filtered out ${nonEnglishCount} non-English job titles`);

// Filter to known companies only
const knownJobs = englishJobs.filter(j => companyData[j.company]);
console.log(`${knownJobs.length} jobs from known companies (${freshJobs.length - knownJobs.length - nonEnglishCount} skipped)`);

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
// ── Extract unique job ID from ATS URL ──
function extractJobId(url) {
    // Greenhouse: gh_jid=8441867002 or /jobs/8441867002
    let m = url.match(/gh_jid=(\d+)/);
    if (m) return m[1];
    m = url.match(/\/jobs\/(\d+)/);
    if (m) return m[1];
    // Ashby: UUID in path like /openai/8fb1615c-34bf-47c4-a1d1-b7b2f836bbd3
    m = url.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (m) return m[1];
    // Lever: UUID-like at end of path
    m = url.match(/lever\.co\/[^/]+\/([0-9a-f-]{36})/i);
    if (m) return m[1];
    // Workable: /j/ followed by ID
    m = url.match(/\/j\/([A-Za-z0-9]+)/);
    if (m) return m[1];
    // Fallback: hash the URL for uniqueness
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
        hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
    }
    return 'h' + Math.abs(hash).toString(36);
}

const HEADER = 'id,title,company,company_slug,location,type,posted,role_category,seniority,culture_values,glassdoor_rating,apply_url,profile_url,jobs_filter_url,post_count,last_posted,status,og_image,job_id,highlight_url';

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

    const jobId = extractJobId(j.url);
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
        status,
        `https://jobsbyculture.com/api/og?type=company&slug=${j.company}`,
        jobId,
        `https://jobsbyculture.com/companies/${j.company}?job=${jobId}`
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

            const companySlug = fields[headerFields.indexOf('company_slug')];
            const expJobId = extractJobId(url);
            rows.push([
                fields[headerFields.indexOf('id')],
                escapeCSV(fields[headerFields.indexOf('title')]),
                escapeCSV(fields[headerFields.indexOf('company')]),
                companySlug,
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
                'expired',
                `https://jobsbyculture.com/api/og?type=company&slug=${companySlug}`,
                expJobId,
                `https://jobsbyculture.com/companies/${companySlug}?job=${expJobId}`
            ].join(','));
        }
    }
}

// 7. Interleave rows so consecutive jobs are from different companies
function interleaveByCompany(csvRows) {
    // Group by company_slug (column index 3)
    const buckets = new Map();
    for (const row of csvRows) {
        const slug = parseCSVLine(row)[3];
        if (!buckets.has(slug)) buckets.set(slug, []);
        buckets.get(slug).push(row);
    }
    // Sort buckets by size descending so largest companies spread evenly
    const sorted = [...buckets.values()].sort((a, b) => b.length - a.length);
    const result = [];
    let remaining = true;
    let idx = 0;
    while (remaining) {
        remaining = false;
        for (const bucket of sorted) {
            if (idx < bucket.length) {
                result.push(bucket[idx]);
                remaining = true;
            }
        }
        idx++;
    }
    return result;
}

const shuffled = interleaveByCompany(rows);

// 8. Re-number IDs sequentially after shuffle
const finalRows = shuffled.map((row, i) => {
    const fields = parseCSVLine(row);
    fields[0] = String(i + 1);
    return fields.map(f => escapeCSV(f)).join(',');
});

const output = HEADER + '\n' + finalRows.join('\n') + '\n';
writeFileSync(csvPath, output);

console.log(`\n✓ Exported ${rows.length} total rows to ${csvPath}`);
console.log(`  ${newCount} new (status: pending)`);
console.log(`  ${keptCount} existing (status preserved)`);
console.log(`  ${expiredCount} newly expired (status: expired)`);

console.log(`\nUpload data/jobs-export.csv to Google Sheets. Zapier should filter by status = "pending".`);
