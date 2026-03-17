#!/usr/bin/env node
/**
 * Submit URLs to Google's Indexing API for priority crawling.
 *
 * Usage:
 *   node scripts/google-indexing.js            # submit next 200 unsubmitted URLs
 *   node scripts/google-indexing.js --dry-run  # preview what would be submitted
 *   node scripts/google-indexing.js --force    # re-submit all (ignore log)
 *   node scripts/google-indexing.js https://jobsbyculture.com/jobs  # specific URLs
 *
 * Prerequisites:
 *   1. Enable "Indexing API" in Google Cloud Console
 *   2. Create a service account & download JSON key → data/google-service-account.json
 *   3. Add the service account email as Owner in Google Search Console
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoogleAuth } from 'google-auth-library';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const CREDENTIALS_PATH = resolve(ROOT, 'data/google-service-account.json');
const LOG_PATH = resolve(ROOT, 'data/google-indexing-log.json');
const SITEMAP_PATH = resolve(ROOT, 'sitemap.xml');
const API_ENDPOINT = 'https://indexing.googleapis.com/v3/urlNotifications:publish';
const DAILY_QUOTA = 200;
const DELAY_MS = 100;

// ---------------------------------------------------------------------------
// Priority tiers — lower number = higher priority
// ---------------------------------------------------------------------------
function getPriority(url) {
    const path = url.replace('https://jobsbyculture.com', '');
    if (['/', '/jobs', '/directory', '/compare'].includes(path)) return 1;
    if (path.startsWith('/blog')) return 2;
    if (path.startsWith('/companies/')) return 3;
    if (path.startsWith('/jobs?')) return 4;
    if (path.startsWith('/locations/') || path.startsWith('/values/') ||
        path.startsWith('/roles/') || path.startsWith('/seniority/')) return 5;
    if (path.startsWith('/compare/')) return 6;
    return 7;
}

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const specificUrls = args.filter(a => a.startsWith('http'));

// ---------------------------------------------------------------------------
// Load sitemap URLs & sort by priority
// ---------------------------------------------------------------------------
const sitemap = readFileSync(SITEMAP_PATH, 'utf-8');
const allUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map(m => m[1])
    .sort((a, b) => getPriority(a) - getPriority(b));

console.log(`Found ${allUrls.length} URLs in sitemap.xml\n`);

// ---------------------------------------------------------------------------
// Load submission log
// ---------------------------------------------------------------------------
let log = {};
if (existsSync(LOG_PATH) && !force) {
    try {
        log = JSON.parse(readFileSync(LOG_PATH, 'utf-8'));
    } catch {
        log = {};
    }
}

// ---------------------------------------------------------------------------
// Determine which URLs to submit
// ---------------------------------------------------------------------------
let urlsToSubmit;
if (specificUrls.length > 0) {
    urlsToSubmit = specificUrls;
} else if (force) {
    urlsToSubmit = allUrls.slice(0, DAILY_QUOTA);
} else {
    urlsToSubmit = allUrls
        .filter(url => !log[url])
        .slice(0, DAILY_QUOTA);
}

if (urlsToSubmit.length === 0) {
    console.log('All URLs have already been submitted. Use --force to re-submit.');
    process.exit(0);
}

// ---------------------------------------------------------------------------
// Show priority breakdown
// ---------------------------------------------------------------------------
const tierNames = {
    1: 'Core pages', 2: 'Blog posts', 3: 'Company profiles',
    4: 'Job filters', 5: 'Location/value/role/seniority pages',
    6: 'Compare pages', 7: 'Other'
};
const breakdown = {};
for (const url of urlsToSubmit) {
    const tier = getPriority(url);
    breakdown[tier] = (breakdown[tier] || 0) + 1;
}
console.log('Submission plan:');
for (const [tier, count] of Object.entries(breakdown).sort((a, b) => a[0] - b[0])) {
    console.log(`  ${tierNames[tier]}: ${count}`);
}
console.log(`  Total: ${urlsToSubmit.length} / ${DAILY_QUOTA} daily quota\n`);

if (dryRun) {
    console.log('URLs that would be submitted:\n');
    for (const url of urlsToSubmit) {
        console.log(`  ${url}`);
    }
    console.log('\nDry run complete. No requests sent.');
    process.exit(0);
}

// ---------------------------------------------------------------------------
// Check credentials (only needed for actual submissions)
// ---------------------------------------------------------------------------
if (!existsSync(CREDENTIALS_PATH)) {
    console.error('Missing service account credentials.\n');
    console.error('Setup steps:');
    console.error('  1. Go to Google Cloud Console → APIs & Services → Enable "Indexing API"');
    console.error('  2. Create a service account → Keys → Add Key → JSON');
    console.error('  3. Save the JSON file as: data/google-service-account.json');
    console.error('  4. In Google Search Console → Settings → Users → add the service');
    console.error('     account email (from the JSON) as "Owner"');
    console.error('  5. Run: npm run google-indexing');
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Authenticate
// ---------------------------------------------------------------------------
const auth = new GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/indexing'],
});
const client = await auth.getClient();

// ---------------------------------------------------------------------------
// Submit URLs one at a time
// ---------------------------------------------------------------------------
let submitted = 0;
let failed = 0;
let quotaHit = false;

for (const url of urlsToSubmit) {
    if (quotaHit) break;

    try {
        const res = await client.request({
            url: API_ENDPOINT,
            method: 'POST',
            data: {
                url,
                type: 'URL_UPDATED',
            },
        });

        if (res.status === 200) {
            submitted++;
            log[url] = new Date().toISOString();
            if (submitted % 50 === 0) {
                console.log(`  ...${submitted} submitted`);
            }
        }
    } catch (err) {
        const status = err?.response?.status;
        if (status === 429) {
            console.error(`\nQuota exceeded after ${submitted} submissions. Stopping.`);
            quotaHit = true;
        } else {
            const msg = err?.response?.data?.error?.message || err.message;
            console.error(`  Failed (${status || 'network'}): ${url} — ${msg}`);
            failed++;
        }
    }

    // Be polite
    if (!quotaHit) {
        await new Promise(r => setTimeout(r, DELAY_MS));
    }
}

// ---------------------------------------------------------------------------
// Save log
// ---------------------------------------------------------------------------
writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const remaining = allUrls.filter(u => !log[u]).length;
console.log(`\nDone!`);
console.log(`  Submitted: ${submitted}`);
if (failed) console.log(`  Failed: ${failed}`);
console.log(`  Previously submitted: ${Object.keys(log).length - submitted}`);
console.log(`  Remaining: ${remaining}`);
if (remaining > 0) {
    console.log(`\nRun again tomorrow to submit the next batch.`);
}
