#!/usr/bin/env node
/**
 * QA Validation Script — Daily integrity checker for JobsByCulture
 *
 * Validates ALL counts, stats, job shuffling, and lazy loading across the entire site.
 * Designed to run as part of a scheduled agent that auto-fixes and reports via GitHub issue.
 *
 * Usage:
 *   node scripts/qa-validate.js              # Print report to stdout
 *   node scripts/qa-validate.js --json       # Output JSON report
 *   node scripts/qa-validate.js --gh-issue   # Create GitHub issue with report
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── Helpers ───

function extract(html, name) {
    const re = new RegExp(`const ${name} = (\\{[\\s\\S]*?\\n\\});`);
    const m = html.match(re);
    if (!m) return null;
    try { return new Function('return ' + m[1])(); } catch { return null; }
}

function extractArray(html, name) {
    const re = new RegExp(`const ${name} = (\\[[\\s\\S]*?\\n\\]);`);
    const m = html.match(re);
    if (!m) return null;
    try { return new Function('return ' + m[1])(); } catch { return null; }
}

function fmt(n) { return n.toLocaleString('en-US'); }

function classifyRole(title) {
    const t = title.toLowerCase();
    const mlPatterns = ['machine learning', 'research scientist', 'research engineer', 'reinforcement learning', 'ai safety', 'interpretability', 'alignment', 'computer vision', 'nlp engineer', 'natural language', 'deep learning', 'ai researcher', 'ai research', 'ml engineer', 'ml infrastructure', 'ml platform', 'ml acceleration', 'ml networking'];
    if (mlPatterns.some(p => t.includes(p)) || / ml /i.test(t) || /\bllm\b/i.test(t)) return 'ml-ai';
    const dataPatterns = ['data scien', 'data engineer', 'data analy', 'data infra', 'data platform', 'advanced analytics', 'business intelligence', 'bi engineer', 'bi analyst', 'analytics engineer'];
    if (dataPatterns.some(p => t.includes(p))) return 'data';
    if (t.includes('design') && !t.includes('engineer') && !t.includes('security')) return 'design';
    const productPatterns = ['product manag', 'program manag', 'technical program', 'product owner', 'product lead', 'scrum master', 'agile coach', 'product strateg', 'product director', 'head of product', 'product operation', 'product analys'];
    if (productPatterns.some(p => t.includes(p))) return 'product';
    const engPatterns = ['engineer', 'developer', 'architect', 'platform', 'sre ', 'site reliability', 'devops', 'qa ', 'quality assurance', 'security', 'systems', 'infrastructure', 'frontend', 'backend', 'fullstack', 'full stack', 'firmware', 'embedded'];
    const engExclusions = ['developer relations', 'developer education', 'devrel', 'solutions engineer', 'solutions architect', 'sales engineer', 'business systems', 'customer support engineer', 'gtm'];
    if (engPatterns.some(p => t.includes(p)) && !engExclusions.some(p => t.includes(p))) return 'engineering';
    const marketingPatterns = ['marketing', 'communications', 'developer relations', 'developer education', 'devrel', 'brand', 'social media', 'public relations', 'copywriter', 'growth marketing', 'community manag', 'influencer', 'creative', 'editorial', 'content'];
    if (marketingPatterns.some(p => t.includes(p))) return 'marketing';
    const salesPatterns = ['account exec', 'account manag', 'sales', 'solutions engineer', 'solutions architect', 'sales engineer', 'gtm', 'business develop', 'partnerships', 'deal desk', 'revenue', 'engagement manag', 'customer success', 'pre-sales'];
    if (salesPatterns.some(p => t.includes(p)) && !t.includes('accountant')) return 'sales';
    const financePatterns = ['accountant', 'accounting', 'financial', 'fp&a', 'treasury', 'controller', 'actuary', 'actuarial', 'investor relations', 'bookkeeper'];
    if (financePatterns.some(p => t.includes(p))) return 'finance';
    if (/(recruiter|recruiting|people ops|people partner|talent|hr |human resources|sourcer|onboarding|enablement)/.test(t)) return 'hr-people';
    if (/(legal|counsel|compliance|policy|regulatory|paralegal|attorney)/.test(t)) return 'legal';
    if (/(support specialist|customer support|premium support|help desk|safety specialist|support delivery)/.test(t)) return 'support';
    if (/(operations|ops |logistics|supply chain|procurement|coordinator|facilities|workplace|office manag)/.test(t)) return 'operations';
    return 'other';
}

function classifySeniority(title) {
    const t = title.toLowerCase();
    if (/\b(director|vp |vice president|head of|chief)\b/.test(t)) return 'director';
    if (/\b(lead|manager|engineering manager)\b/.test(t)) return 'lead';
    if (/\b(staff|principal|distinguished)\b/.test(t)) return 'staff';
    if (/\b(senior|sr\.?)\b/.test(t)) return 'senior';
    if (/\b(junior|jr\.?|intern|entry|associate|new grad)\b/.test(t)) return 'entry';
    return 'mid';
}

const isEnglishTitle = (title) => !/[\u3000-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\u0600-\u06FF\u0400-\u04FF\u0E00-\u0E7F\u0900-\u097F\u1100-\u11FF]/.test(title);

// Location patterns (must match build-location-pages.js)
const LOCATIONS = {
    'san-francisco': /san francisco|sf\b|sunnyvale|mountain view|palo alto|menlo park|foster city|south san francisco|bay area|san jose|santa clara|cupertino|fremont|redwood city/i,
    'new-york': /new york|nyc|\bny\b|brooklyn|manhattan/i,
    'seattle': /seattle|bellevue|redmond/i,
    'london': /london/i,
    'remote': /remote/i,
    'paris': /paris/i,
    'dublin': /dublin/i,
    'bengaluru': /bengaluru|bangalore/i,
    'singapore': /singapore/i,
    'tokyo': /tokyo/i,
    'toronto': /toronto/i,
    'chicago': /chicago/i,
    'berlin': /berlin/i,
    'sydney': /sydney/i,
    'munich': /munich|m[uü]nchen/i,
    'austin': /austin/i,
    'boston': /boston|cambridge,?\s*ma/i,
    'denver': /denver|boulder/i,
    'washington-dc': /washington.*d\.?c|arlington.*va|mclean|bethesda|reston|tysons|northern virginia/i,
    'amsterdam': /amsterdam/i,
    'seoul': /seoul/i,
    'sao-paulo': /s[aã]o paulo/i,
    'madrid': /madrid/i,
};

// ─── Report structure ───

const issues = [];      // { severity: 'error'|'warning', category, page, message }
const stats = {};       // Summary stats

function error(category, page, message) {
    issues.push({ severity: 'error', category, page, message });
}
function warn(category, page, message) {
    issues.push({ severity: 'warning', category, page, message });
}

// ═══════════════════════════════════════════════════════════════
// LOAD SOURCE DATA
// ═══════════════════════════════════════════════════════════════

console.log('Loading source data...');

const allJobs = JSON.parse(readFileSync(resolve(ROOT, 'data/jobs-fetched.json'), 'utf-8'));
const jobsHtml = readFileSync(resolve(ROOT, 'jobs.html'), 'utf-8');
const COMPANIES = extract(jobsHtml, 'COMPANIES');
const COMPANY_REVIEWS = extract(jobsHtml, 'COMPANY_REVIEWS');
const VALUES = extract(jobsHtml, 'VALUES');
const ROLES = extract(jobsHtml, 'ROLES');

if (!COMPANIES) { console.error('FATAL: Could not extract COMPANIES from jobs.html'); process.exit(1); }
if (!VALUES) { console.error('FATAL: Could not extract VALUES from jobs.html'); process.exit(1); }
if (!ROLES) { console.error('FATAL: Could not extract ROLES from jobs.html'); process.exit(1); }

const knownSlugs = new Set(Object.keys(COMPANIES));
const knownJobs = allJobs.filter(j => knownSlugs.has(j.company) && isEnglishTitle(j.title));
const totalJobs = knownJobs.length;
const companyCount = knownSlugs.size;

stats.totalJobs = totalJobs;
stats.companyCount = companyCount;

// ─── Compute expected counts ───

const companyTotals = {};
const crc = {};
const seniorityCounts = {};
const roleCounts = {};

for (const job of knownJobs) {
    const co = job.company;
    const role = classifyRole(job.title);
    const sen = classifySeniority(job.title);

    companyTotals[co] = (companyTotals[co] || 0) + 1;
    if (!crc[co]) crc[co] = {};
    crc[co][role] = (crc[co][role] || 0) + 1;
    roleCounts[role] = (roleCounts[role] || 0) + 1;
    seniorityCounts[sen] = (seniorityCounts[sen] || 0) + 1;
}

const cv = {};
for (const [slug, data] of Object.entries(COMPANIES)) {
    if (data.values && data.values.length > 0) cv[slug] = data.values;
}

const valueCounts = {};
const valueCompanyCounts = {};
for (const [slug, vals] of Object.entries(cv)) {
    const total = companyTotals[slug] || 0;
    for (const v of vals) {
        valueCounts[v] = (valueCounts[v] || 0) + total;
        valueCompanyCounts[v] = (valueCompanyCounts[v] || 0) + 1;
    }
}

// Location counts
const locationCounts = {};
const locationCompanyCounts = {};
for (const [locSlug, pattern] of Object.entries(LOCATIONS)) {
    const matchingJobs = knownJobs.filter(j => j.location && pattern.test(j.location));
    locationCounts[locSlug] = matchingJobs.length;
    locationCompanyCounts[locSlug] = new Set(matchingJobs.map(j => j.company)).size;
}

console.log(`Source: ${fmt(totalJobs)} jobs across ${companyCount} companies\n`);

// ═══════════════════════════════════════════════════════════════
// CHECK 1: index.html
// ═══════════════════════════════════════════════════════════════

console.log('Checking index.html...');
const indexHtml = readFileSync(resolve(ROOT, 'index.html'), 'utf-8');

// Total job count in hero
const heroMatch = indexHtml.match(/id="heroCount">([\d,]+)<\/span>/);
if (heroMatch) {
    const heroCount = parseInt(heroMatch[1].replace(/,/g, ''));
    if (heroCount !== totalJobs) {
        error('count', 'index.html', `Hero count shows ${fmt(heroCount)} but should be ${fmt(totalJobs)}`);
    }
} else {
    error('count', 'index.html', 'Could not find heroCount element');
}

// Company count in metrics
const compMetricMatch = indexHtml.match(/<div class="metric-val">(\d+)<\/div><div class="metric-label">companies profiled<\/div>/);
if (compMetricMatch) {
    const shown = parseInt(compMetricMatch[1]);
    if (shown !== companyCount) {
        error('count', 'index.html', `Company metric shows ${shown} but should be ${companyCount}`);
    }
}

// Meta description job count
const metaDescMatch = indexHtml.match(/name="description" content="[^"]*?([\d,]+) AI & tech roles/);
if (metaDescMatch) {
    const metaCount = parseInt(metaDescMatch[1].replace(/,/g, ''));
    if (metaCount !== totalJobs) {
        error('count', 'index.html', `Meta description shows ${fmt(metaCount)} jobs but should be ${fmt(totalJobs)}`);
    }
}

// "See all X jobs" CTA
const seeAllMatch = indexHtml.match(/See all ([\d,]+) jobs/);
if (seeAllMatch) {
    const ctaCount = parseInt(seeAllMatch[1].replace(/,/g, ''));
    if (ctaCount !== totalJobs) {
        error('count', 'index.html', `"See all" CTA shows ${fmt(ctaCount)} but should be ${fmt(totalJobs)}`);
    }
}

// "From N companies"
const fromMatch = indexHtml.match(/From (\d+) companies/);
if (fromMatch) {
    const fromCount = parseInt(fromMatch[1]);
    if (fromCount !== companyCount) {
        error('count', 'index.html', `"From N companies" shows ${fromCount} but should be ${companyCount}`);
    }
}

// Browse-by-value card counts
const valueCardMatches = [...indexHtml.matchAll(/value=([\w-]+)"[^>]*>.*?→ ([\d,]+) jobs<\/span>/gs)];
for (const m of valueCardMatches) {
    const valSlug = m[1];
    const shown = parseInt(m[2].replace(/,/g, ''));
    const expected = valueCounts[valSlug] || 0;
    if (shown !== expected) {
        error('count', 'index.html', `Value card "${valSlug}": shows ${fmt(shown)} but should be ${fmt(expected)}`);
    }
}

// Location card counts
const locCardMatches = [...indexHtml.matchAll(/locations\/([\w-]+)"[^>]*>.*?→ ([\d,]+) jobs<\/span>/gs)];
for (const m of locCardMatches) {
    const locSlug = m[1];
    const shown = parseInt(m[2].replace(/,/g, ''));
    // Compare against the location page's numberOfItems (which is the authoritative count)
    const locPagePath = resolve(ROOT, 'locations', `${locSlug}.html`);
    if (existsSync(locPagePath)) {
        const locPageHtml = readFileSync(locPagePath, 'utf-8');
        const itemsMatch = locPageHtml.match(/"numberOfItems":\s*(\d+)/);
        if (itemsMatch) {
            const locPageCount = parseInt(itemsMatch[1]);
            if (shown !== locPageCount) {
                error('count', 'index.html', `Location card "${locSlug}": shows ${fmt(shown)} but location page has ${fmt(locPageCount)}`);
            }
        }
    }
}

// "browse all N companies"
const browseAllMatch = indexHtml.match(/browse all (\d+) companies/);
if (browseAllMatch) {
    const browseCount = parseInt(browseAllMatch[1]);
    if (browseCount !== companyCount) {
        error('count', 'index.html', `"browse all N companies" shows ${browseCount} but should be ${companyCount}`);
    }
}

console.log('  done');

// ═══════════════════════════════════════════════════════════════
// CHECK 2: directory.html
// ═══════════════════════════════════════════════════════════════

console.log('Checking directory.html...');
const dirHtml = readFileSync(resolve(ROOT, 'directory.html'), 'utf-8');

const dirCountMatches = [...dirHtml.matchAll(/(\d+) (?:profiled|companies profiled)/g)];
for (const m of dirCountMatches) {
    const shown = parseInt(m[1]);
    if (shown !== companyCount) {
        error('count', 'directory.html', `Shows "${m[0]}" but should be ${companyCount}`);
        break; // One error is enough
    }
}

// Check meta description
const dirMetaMatch = dirHtml.match(/name="description" content="[^"]*?(\d+)/);
if (dirMetaMatch) {
    const shown = parseInt(dirMetaMatch[1]);
    if (shown !== companyCount) {
        error('count', 'directory.html', `Meta description shows ${shown} but should be ${companyCount}`);
    }
}

console.log('  done');

// ═══════════════════════════════════════════════════════════════
// CHECK 3: compare.html
// ═══════════════════════════════════════════════════════════════

console.log('Checking compare.html...');
const compareHtml = readFileSync(resolve(ROOT, 'compare.html'), 'utf-8');

const compareCompCountMatches = [...compareHtml.matchAll(/(\d+) AI &amp; tech companies/g)];
for (const m of compareCompCountMatches) {
    const shown = parseInt(m[1]);
    if (shown !== companyCount) {
        error('count', 'compare.html', `Shows "${m[0]}" but should be ${companyCount}`);
        break;
    }
}

// Check that all companies exist in compare
const compareCompanies = extract(compareHtml, 'COMPANIES');
if (compareCompanies) {
    const compareSlugs = new Set(Object.keys(compareCompanies));
    for (const slug of knownSlugs) {
        if (!compareSlugs.has(slug)) {
            error('missing', 'compare.html', `Company "${slug}" exists in jobs.html but missing from compare.html COMPANIES`);
        }
    }
}

console.log('  done');

// ═══════════════════════════════════════════════════════════════
// CHECK 4: llms.txt
// ═══════════════════════════════════════════════════════════════

console.log('Checking llms.txt...');
const llms = readFileSync(resolve(ROOT, 'llms.txt'), 'utf-8');

const llmsJobMatch = llms.match(/Browse ([\d,]+)\+ jobs/);
if (llmsJobMatch) {
    const shown = parseInt(llmsJobMatch[1].replace(/,/g, ''));
    if (shown !== totalJobs) {
        error('count', 'llms.txt', `Shows ${fmt(shown)} jobs but should be ${fmt(totalJobs)}`);
    }
}

const llmsCompMatch = llms.match(/All (\d+) profiled/);
if (llmsCompMatch) {
    const shown = parseInt(llmsCompMatch[1]);
    if (shown !== companyCount) {
        error('count', 'llms.txt', `Shows ${shown} companies but should be ${companyCount}`);
    }
}

console.log('  done');

// ═══════════════════════════════════════════════════════════════
// CHECK 5: Company profile pages
// ═══════════════════════════════════════════════════════════════

console.log('Checking company profile pages...');
const companiesDir = resolve(ROOT, 'companies');
const companyFiles = readdirSync(companiesDir).filter(f => f.endsWith('.html'));

for (const file of companyFiles) {
    const slug = file.replace('.html', '');
    const expected = companyTotals[slug] || 0;
    const html = readFileSync(resolve(companiesDir, file), 'utf-8');

    // Check "See N open roles" in meta
    const metaMatch = html.match(/See (\d[\d,]*) open (?:roles|jobs)/);
    if (metaMatch) {
        const shown = parseInt(metaMatch[1].replace(/,/g, ''));
        if (shown !== expected) {
            error('count', `companies/${slug}.html`, `Meta shows ${fmt(shown)} jobs but should be ${fmt(expected)}`);
        }
    }

    // Check "See all N CompanyName jobs" CTA
    const ctaMatch = html.match(/See all (\d[\d,]*) /);
    if (ctaMatch) {
        const shown = parseInt(ctaMatch[1].replace(/,/g, ''));
        if (shown !== expected) {
            error('count', `companies/${slug}.html`, `CTA shows ${fmt(shown)} jobs but should be ${fmt(expected)}`);
        }
    }

    // Verify company exists in jobs.html COMPANIES
    if (!knownSlugs.has(slug)) {
        warn('orphan', `companies/${slug}.html`, `Company page exists but "${slug}" not in jobs.html COMPANIES`);
    }

    // Verify company has a COMPANY_REVIEWS entry
    if (COMPANY_REVIEWS && knownSlugs.has(slug) && !COMPANY_REVIEWS[slug]) {
        warn('missing', `companies/${slug}.html`, `Company "${slug}" has no COMPANY_REVIEWS entry in jobs.html`);
    }
}

// Check for missing company pages
for (const slug of knownSlugs) {
    if (!existsSync(resolve(companiesDir, `${slug}.html`))) {
        warn('missing', 'companies/', `No profile page for company "${slug}"`);
    }
}

console.log(`  checked ${companyFiles.length} pages`);

// ═══════════════════════════════════════════════════════════════
// CHECK 6: Value cluster pages
// ═══════════════════════════════════════════════════════════════

console.log('Checking value cluster pages...');
const valuesDir = resolve(ROOT, 'values');
const valueFiles = readdirSync(valuesDir).filter(f => f.endsWith('.html'));

for (const file of valueFiles) {
    const slug = file.replace('.html', '');
    const expectedJobs = valueCounts[slug] || 0;
    const expectedCompanies = valueCompanyCounts[slug] || 0;
    const html = readFileSync(resolve(valuesDir, file), 'utf-8');

    // Check meta description count: "Browse N jobs at M companies"
    const metaMatch = html.match(/Browse (\d[\d,]*) jobs at (\d+) compan/);
    if (metaMatch) {
        const shownJobs = parseInt(metaMatch[1].replace(/,/g, ''));
        const shownCompanies = parseInt(metaMatch[2]);
        if (shownJobs !== expectedJobs) {
            error('count', `values/${slug}.html`, `Meta shows ${fmt(shownJobs)} jobs but should be ${fmt(expectedJobs)}`);
        }
        if (shownCompanies !== expectedCompanies) {
            error('count', `values/${slug}.html`, `Meta shows ${shownCompanies} companies but should be ${expectedCompanies}`);
        }
    }

    // Check job shuffling: extract displayed job companies and verify interleaving
    const jobCompanyMatches = [...html.matchAll(/class="jc-company"[^>]*>([^<]+)</g)];
    if (jobCompanyMatches.length > 3) {
        const companies = jobCompanyMatches.map(m => m[1].trim());
        let maxConsecutive = 1;
        let currentRun = 1;
        for (let i = 1; i < companies.length; i++) {
            if (companies[i] === companies[i - 1]) {
                currentRun++;
                maxConsecutive = Math.max(maxConsecutive, currentRun);
            } else {
                currentRun = 1;
            }
        }
        if (maxConsecutive > 2) {
            warn('shuffle', `values/${slug}.html`, `Jobs not properly shuffled: ${maxConsecutive} consecutive jobs from same company`);
        }
    }
}

// Check all VALUES have a page
if (VALUES) {
    for (const slug of Object.keys(VALUES)) {
        if (!existsSync(resolve(valuesDir, `${slug}.html`))) {
            warn('missing', 'values/', `No cluster page for value "${slug}"`);
        }
    }
}

console.log(`  checked ${valueFiles.length} pages`);

// ═══════════════════════════════════════════════════════════════
// CHECK 7: Role cluster pages
// ═══════════════════════════════════════════════════════════════

console.log('Checking role cluster pages...');
const rolesDir = resolve(ROOT, 'roles');
const roleFiles = readdirSync(rolesDir).filter(f => f.endsWith('.html'));

for (const file of roleFiles) {
    const slug = file.replace('.html', '');
    const expected = roleCounts[slug] || 0;
    const html = readFileSync(resolve(rolesDir, file), 'utf-8');

    // Check meta description: "Browse N ... jobs at M ... companies"
    const metaMatch = html.match(/Browse ([\d,]+) /);
    if (metaMatch) {
        const shown = parseInt(metaMatch[1].replace(/,/g, ''));
        if (shown !== expected) {
            error('count', `roles/${slug}.html`, `Meta shows ${fmt(shown)} jobs but should be ${fmt(expected)}`);
        }
    }

    // Check job shuffling
    const jobCompanyMatches = [...html.matchAll(/class="jc-company"[^>]*>([^<]+)</g)];
    if (jobCompanyMatches.length > 3) {
        const companies = jobCompanyMatches.map(m => m[1].trim());
        let maxConsecutive = 1;
        let currentRun = 1;
        for (let i = 1; i < companies.length; i++) {
            if (companies[i] === companies[i - 1]) {
                currentRun++;
                maxConsecutive = Math.max(maxConsecutive, currentRun);
            } else {
                currentRun = 1;
            }
        }
        if (maxConsecutive > 2) {
            warn('shuffle', `roles/${slug}.html`, `Jobs not properly shuffled: ${maxConsecutive} consecutive jobs from same company`);
        }
    }
}

if (ROLES) {
    for (const slug of Object.keys(ROLES)) {
        if (!existsSync(resolve(rolesDir, `${slug}.html`))) {
            warn('missing', 'roles/', `No cluster page for role "${slug}"`);
        }
    }
}

console.log(`  checked ${roleFiles.length} pages`);

// ═══════════════════════════════════════════════════════════════
// CHECK 8: Seniority pages
// ═══════════════════════════════════════════════════════════════

console.log('Checking seniority pages...');
const seniorityDir = resolve(ROOT, 'seniority');
if (existsSync(seniorityDir)) {
    const senFiles = readdirSync(seniorityDir).filter(f => f.endsWith('.html'));
    for (const file of senFiles) {
        const slug = file.replace('.html', '');
        const expected = seniorityCounts[slug] || 0;
        const html = readFileSync(resolve(seniorityDir, file), 'utf-8');

        const metaMatch = html.match(/Browse ([\d,]+) /);
        if (metaMatch) {
            const shown = parseInt(metaMatch[1].replace(/,/g, ''));
            if (shown !== expected) {
                error('count', `seniority/${slug}.html`, `Meta shows ${fmt(shown)} jobs but should be ${fmt(expected)}`);
            }
        }

        // Check job shuffling
        const jobCompanyMatches = [...html.matchAll(/class="jc-company"[^>]*>([^<]+)</g)];
        if (jobCompanyMatches.length > 3) {
            const companies = jobCompanyMatches.map(m => m[1].trim());
            let maxConsecutive = 1;
            let currentRun = 1;
            for (let i = 1; i < companies.length; i++) {
                if (companies[i] === companies[i - 1]) {
                    currentRun++;
                    maxConsecutive = Math.max(maxConsecutive, currentRun);
                } else {
                    currentRun = 1;
                }
            }
            if (maxConsecutive > 2) {
                warn('shuffle', `seniority/${slug}.html`, `Jobs not properly shuffled: ${maxConsecutive} consecutive jobs from same company`);
            }
        }
    }
    console.log(`  checked ${senFiles.length} pages`);
} else {
    console.log('  seniority/ dir not found, skipping');
}

// ═══════════════════════════════════════════════════════════════
// CHECK 9: Location pages
// ═══════════════════════════════════════════════════════════════

console.log('Checking location pages...');
const locDir = resolve(ROOT, 'locations');
if (existsSync(locDir)) {
    const locFiles = readdirSync(locDir).filter(f => f.endsWith('.html'));

    for (const file of locFiles) {
        const slug = file.replace('.html', '');
        const html = readFileSync(resolve(locDir, file), 'utf-8');

        // Check numberOfItems in JSON-LD
        const itemsMatch = html.match(/"numberOfItems":\s*(\d+)/);
        if (itemsMatch) {
            const shownCount = parseInt(itemsMatch[1]);
            // Compare with our computed location count
            if (LOCATIONS[slug]) {
                const expected = locationCounts[slug];
                if (shownCount !== expected) {
                    error('count', `locations/${slug}.html`, `numberOfItems is ${shownCount} but computed count is ${expected}`);
                }
            }
        }

        // Check meta description count
        const metaMatch = html.match(/Browse (\d[\d,]*) AI/);
        if (metaMatch) {
            const shownMeta = parseInt(metaMatch[1].replace(/,/g, ''));
            if (itemsMatch) {
                const itemsCount = parseInt(itemsMatch[1]);
                if (shownMeta !== itemsCount) {
                    error('count', `locations/${slug}.html`, `Meta says ${fmt(shownMeta)} but numberOfItems is ${itemsCount}`);
                }
            }
        }

        // Check job shuffling on location pages
        const jobCompanyMatches = [...html.matchAll(/class="jc-company"[^>]*>([^<]+)</g)];
        if (jobCompanyMatches.length > 3) {
            const companies = jobCompanyMatches.map(m => m[1].trim());
            let maxConsecutive = 1;
            let currentRun = 1;
            for (let i = 1; i < companies.length; i++) {
                if (companies[i] === companies[i - 1]) {
                    currentRun++;
                    maxConsecutive = Math.max(maxConsecutive, currentRun);
                } else {
                    currentRun = 1;
                }
            }
            if (maxConsecutive > 2) {
                warn('shuffle', `locations/${slug}.html`, `Jobs not properly shuffled: ${maxConsecutive} consecutive jobs from same company`);
            }
        }
    }

    // Also check location-role cross pages
    const locSubdirs = readdirSync(locDir).filter(f => {
        const p = resolve(locDir, f);
        try { return !f.endsWith('.html') && readdirSync(p).length > 0; } catch { return false; }
    });

    let crossPageCount = 0;
    for (const locSlug of locSubdirs) {
        const subdir = resolve(locDir, locSlug);
        const crossFiles = readdirSync(subdir).filter(f => f.endsWith('.html'));
        for (const file of crossFiles) {
            const html = readFileSync(resolve(subdir, file), 'utf-8');
            const roleSlug = file.replace('.html', '');

            // Check numberOfItems consistency with meta
            const itemsMatch = html.match(/"numberOfItems":\s*(\d+)/);
            const metaMatch = html.match(/Browse (\d[\d,]*) /);
            if (itemsMatch && metaMatch) {
                const items = parseInt(itemsMatch[1]);
                const meta = parseInt(metaMatch[1].replace(/,/g, ''));
                if (items !== meta) {
                    error('count', `locations/${locSlug}/${roleSlug}.html`, `numberOfItems=${items} but meta says ${meta}`);
                }
            }

            // Check shuffling
            const jobCompanyMatches = [...html.matchAll(/class="jc-company"[^>]*>([^<]+)</g)];
            if (jobCompanyMatches.length > 3) {
                const companies = jobCompanyMatches.map(m => m[1].trim());
                let maxConsecutive = 1;
                let currentRun = 1;
                for (let i = 1; i < companies.length; i++) {
                    if (companies[i] === companies[i - 1]) {
                        currentRun++;
                        maxConsecutive = Math.max(maxConsecutive, currentRun);
                    } else {
                        currentRun = 1;
                    }
                }
                if (maxConsecutive > 2) {
                    warn('shuffle', `locations/${locSlug}/${roleSlug}.html`, `Jobs not properly shuffled: ${maxConsecutive} consecutive from same company`);
                }
            }
            crossPageCount++;
        }
    }

    console.log(`  checked ${locFiles.length} location pages + ${crossPageCount} cross pages`);
}

// ═══════════════════════════════════════════════════════════════
// CHECK 10: og-data.json consistency
// ═══════════════════════════════════════════════════════════════

console.log('Checking og-data.json...');
const ogDataPath = resolve(ROOT, 'data/og-data.json');
if (existsSync(ogDataPath)) {
    const ogData = JSON.parse(readFileSync(ogDataPath, 'utf-8'));

    if (ogData.totalJobs !== totalJobs) {
        error('count', 'data/og-data.json', `totalJobs is ${ogData.totalJobs} but should be ${totalJobs}`);
    }
    if (ogData.companyCount !== companyCount) {
        error('count', 'data/og-data.json', `companyCount is ${ogData.companyCount} but should be ${companyCount}`);
    }

    // Per-company job counts
    for (const [slug, data] of Object.entries(ogData.companies || {})) {
        const expected = companyTotals[slug] || 0;
        if (data.jobCount !== expected) {
            error('count', 'data/og-data.json', `Company "${slug}" jobCount is ${data.jobCount} but should be ${expected}`);
        }
    }

    // Per-value job counts
    for (const [slug, data] of Object.entries(ogData.values || {})) {
        const expected = valueCounts[slug] || 0;
        if (data.jobCount !== expected) {
            error('count', 'data/og-data.json', `Value "${slug}" jobCount is ${data.jobCount} but should be ${expected}`);
        }
    }

    // Per-role job counts
    for (const [slug, data] of Object.entries(ogData.roles || {})) {
        const expected = roleCounts[slug] || 0;
        if (data.jobCount !== expected) {
            error('count', 'data/og-data.json', `Role "${slug}" jobCount is ${data.jobCount} but should be ${expected}`);
        }
    }

    // Per-seniority job counts
    for (const [slug, data] of Object.entries(ogData.seniorities || {})) {
        const expected = seniorityCounts[slug] || 0;
        if (data.jobCount !== expected) {
            error('count', 'data/og-data.json', `Seniority "${slug}" jobCount is ${data.jobCount} but should be ${expected}`);
        }
    }
} else {
    error('missing', 'data/og-data.json', 'File does not exist');
}

console.log('  done');

// ═══════════════════════════════════════════════════════════════
// CHECK 11: jobs.html lazy loading
// ═══════════════════════════════════════════════════════════════

console.log('Checking lazy loading...');

// Check jobs.html has lazy loading
const hasLazySentinel = jobsHtml.includes('lazySentinel');
const hasIntersectionObserver = jobsHtml.includes('IntersectionObserver');
const hasBatchSize = jobsHtml.includes('_BATCH_SIZE');

if (!hasLazySentinel || !hasIntersectionObserver || !hasBatchSize) {
    error('lazy-load', 'jobs.html', 'Missing lazy loading implementation (sentinel/IntersectionObserver/batch)');
}

// Check cluster pages don't render excessive jobs without "View all" link
const checkPagesForExcessiveJobs = (dir, label) => {
    if (!existsSync(dir)) return;
    const files = readdirSync(dir).filter(f => f.endsWith('.html'));
    for (const file of files) {
        const html = readFileSync(resolve(dir, file), 'utf-8');
        const jobCards = (html.match(/class="jc-card/g) || []).length;
        if (jobCards > 50) {
            const hasViewAll = /View all|See all|Browse all/i.test(html);
            if (!hasViewAll) {
                warn('lazy-load', `${label}/${file}`, `Renders ${jobCards} job cards without a "View all" link`);
            }
        }
    }
};

checkPagesForExcessiveJobs(resolve(ROOT, 'values'), 'values');
checkPagesForExcessiveJobs(resolve(ROOT, 'roles'), 'roles');
checkPagesForExcessiveJobs(resolve(ROOT, 'seniority'), 'seniority');

console.log('  done');

// ═══════════════════════════════════════════════════════════════
// CHECK 12: Blog posts (stale counts)
// ═══════════════════════════════════════════════════════════════

console.log('Checking blog posts for stale counts...');
const blogDir = resolve(ROOT, 'blog');
if (existsSync(blogDir)) {
    const blogFiles = readdirSync(blogDir).filter(f => f.endsWith('.html'));

    for (const file of blogFiles) {
        const html = readFileSync(resolve(blogDir, file), 'utf-8');

        // Check "Browse all N jobs from M companies" footer CTAs
        const browseAllMatches = [...html.matchAll(/(?:Browse all|Browse) ([\d,]+) jobs from (\d+) companies/g)];
        for (const m of browseAllMatches) {
            const shownJobs = parseInt(m[1].replace(/,/g, ''));
            const shownCompanies = parseInt(m[2]);
            if (shownJobs !== totalJobs) {
                warn('stale-blog', `blog/${file}`, `"${m[0]}" — job count should be ${fmt(totalJobs)}`);
            }
            if (shownCompanies !== companyCount) {
                warn('stale-blog', `blog/${file}`, `"${m[0]}" — company count should be ${companyCount}`);
            }
        }

        // Check per-company job counts in blog posts
        // Pattern: "CompanyName ... (N open roles)" or "CompanyName has N open positions"
        // Only match within 150 chars and exclude site-wide totals
        for (const [slug, data] of Object.entries(COMPANIES)) {
            const companyName = data.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(`${companyName}.{0,150}?(?:\\(|has |with )(\\d[\\d,]*) open (?:roles|positions)`, 'gs');
            const matches = [...html.matchAll(re)];
            const seen = new Set();
            for (const m of matches) {
                const shown = parseInt(m[1].replace(/,/g, ''));
                const expected = companyTotals[slug] || 0;
                // Skip if this looks like the site-wide total
                if (shown === totalJobs) continue;
                const key = `${slug}-${shown}`;
                if (!seen.has(key) && shown !== expected && Math.abs(shown - expected) > 10) {
                    seen.add(key);
                    warn('stale-blog', `blog/${file}`, `${data.name}: "${shown} open roles" but current count is ${expected}`);
                }
            }
        }

        // Check "45 companies" references
        const compRefMatches = [...html.matchAll(/(\d+) companies/g)];
        for (const m of compRefMatches) {
            const shown = parseInt(m[1]);
            // Only flag if it's close to our count (not random numbers like "thousands of companies")
            if (shown >= 30 && shown <= 100 && shown !== companyCount) {
                warn('stale-blog', `blog/${file}`, `References "${shown} companies" but current count is ${companyCount}`);
            }
        }
    }

    console.log(`  checked ${blogFiles.length} blog posts`);
}

// ═══════════════════════════════════════════════════════════════
// CHECK 13: Sitemap completeness
// ═══════════════════════════════════════════════════════════════

console.log('Checking sitemap.xml...');
const sitemapPath = resolve(ROOT, 'sitemap.xml');
if (existsSync(sitemapPath)) {
    const sitemap = readFileSync(sitemapPath, 'utf-8');

    // Check all company pages are in sitemap
    for (const slug of knownSlugs) {
        if (!sitemap.includes(`/companies/${slug}`)) {
            warn('sitemap', 'sitemap.xml', `Missing company page: /companies/${slug}`);
        }
    }

    // Check value pages
    if (VALUES) {
        for (const slug of Object.keys(VALUES)) {
            if (!sitemap.includes(`/values/${slug}`)) {
                warn('sitemap', 'sitemap.xml', `Missing value page: /values/${slug}`);
            }
        }
    }

    // Check role pages
    if (ROLES) {
        for (const slug of Object.keys(ROLES)) {
            if (!sitemap.includes(`/roles/${slug}`)) {
                warn('sitemap', 'sitemap.xml', `Missing role page: /roles/${slug}`);
            }
        }
    }
} else {
    error('missing', 'sitemap.xml', 'Sitemap file does not exist');
}

console.log('  done');

// ═══════════════════════════════════════════════════════════════
// CHECK 14: Cross-page data consistency
// ═══════════════════════════════════════════════════════════════

console.log('Checking cross-page data consistency...');

// Verify COMPANIES in compare.html matches jobs.html
if (compareCompanies) {
    for (const [slug, data] of Object.entries(COMPANIES)) {
        const cmp = compareCompanies[slug];
        if (cmp) {
            if (cmp.glassdoor !== data.glassdoor) {
                error('sync', 'compare.html', `${slug} glassdoor: compare=${cmp.glassdoor}, jobs=${data.glassdoor}`);
            }
            if (JSON.stringify(cmp.values) !== JSON.stringify(data.values)) {
                warn('sync', 'compare.html', `${slug} values differ between compare.html and jobs.html`);
            }
        }
    }
}

console.log('  done');

// ═══════════════════════════════════════════════════════════════
// CHECK 15: Compare page placeholder data
// ═══════════════════════════════════════════════════════════════

console.log('Checking compare.html for placeholder data...');
if (compareCompanies) {
    for (const [slug, c] of Object.entries(compareCompanies)) {
        if (c.bestFor && c.bestFor.startsWith('Professionals interested in')) {
            error('placeholder', 'compare.html', `Company "${slug}" has placeholder bestFor: "${c.bestFor}"`);
        }
        if (c.verdict && c.verdict.includes('check Glassdoor for detailed reviews')) {
            error('placeholder', 'compare.html', `Company "${slug}" has placeholder verdict`);
        }
        if (c.ceo_name === 'CEO') {
            error('placeholder', 'compare.html', `Company "${slug}" has placeholder ceo_name: "CEO"`);
        }
    }
}
console.log('  done');

// ═══════════════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════════════

const errors = issues.filter(i => i.severity === 'error');
const warnings = issues.filter(i => i.severity === 'warning');

console.log('\n' + '═'.repeat(60));
console.log('QA VALIDATION REPORT');
console.log('═'.repeat(60));
console.log(`Date: ${new Date().toISOString().split('T')[0]}`);
console.log(`Source: ${fmt(totalJobs)} jobs across ${companyCount} companies`);
console.log(`Errors: ${errors.length}  |  Warnings: ${warnings.length}`);
console.log('═'.repeat(60));

if (errors.length > 0) {
    console.log('\n🔴 ERRORS (must fix):');
    for (const e of errors) {
        console.log(`  [${e.category}] ${e.page}: ${e.message}`);
    }
}

if (warnings.length > 0) {
    console.log('\n🟡 WARNINGS (should fix):');
    for (const w of warnings) {
        console.log(`  [${w.category}] ${w.page}: ${w.message}`);
    }
}

if (errors.length === 0 && warnings.length === 0) {
    console.log('\n✅ All checks passed! Site is fully consistent.');
}

// ═══════════════════════════════════════════════════════════════
// OUTPUT: --json or --gh-issue
// ═══════════════════════════════════════════════════════════════

const args = process.argv.slice(2);

if (args.includes('--json')) {
    const report = { date: new Date().toISOString(), stats, errors, warnings, issues };
    console.log('\n' + JSON.stringify(report, null, 2));
}

if (args.includes('--gh-issue')) {
    const date = new Date().toISOString().split('T')[0];
    const status = errors.length === 0 && warnings.length === 0 ? 'PASS' : errors.length > 0 ? 'FAIL' : 'WARN';
    const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '🔴' : '🟡';

    let body = `## ${emoji} Daily QA Report — ${date}\n\n`;
    body += `**Source:** ${fmt(totalJobs)} jobs across ${companyCount} companies\n`;
    body += `**Status:** ${status} — ${errors.length} errors, ${warnings.length} warnings\n\n`;

    if (errors.length > 0) {
        body += `### 🔴 Errors (${errors.length})\n\n`;
        body += '| Category | Page | Issue |\n|----------|------|-------|\n';
        for (const e of errors) {
            body += `| ${e.category} | \`${e.page}\` | ${e.message} |\n`;
        }
        body += '\n';
    }

    if (warnings.length > 0) {
        body += `### 🟡 Warnings (${warnings.length})\n\n`;
        body += '| Category | Page | Issue |\n|----------|------|-------|\n';
        for (const w of warnings) {
            body += `| ${w.category} | \`${w.page}\` | ${w.message} |\n`;
        }
        body += '\n';
    }

    if (errors.length === 0 && warnings.length === 0) {
        body += '### ✅ All checks passed!\n\nEvery count, stat, and consistency check is verified. The site is fully in sync.\n';
    }

    body += `\n---\n*Generated by \`scripts/qa-validate.js\` — automated daily QA*`;

    const title = `${emoji} Daily QA: ${date} — ${status} (${errors.length}E/${warnings.length}W)`;
    const label = 'qa-report';

    try {
        // Create label if it doesn't exist (ignore errors)
        try {
            execSync(`gh label create "${label}" --description "Automated QA reports" --color "0E8A16" 2>/dev/null`, { cwd: ROOT });
        } catch {}

        const result = execSync(
            `gh issue create --title "${title}" --body "$(cat <<'GHEOF'\n${body}\nGHEOF\n)" --label "${label}"`,
            { cwd: ROOT, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
        );
        console.log(`\n📋 GitHub issue created: ${result.trim()}`);
    } catch (e) {
        console.error(`\n❌ Failed to create GitHub issue: ${e.message}`);
    }
}

// Exit with error code if there are errors
process.exit(errors.length > 0 ? 1 : 0);
