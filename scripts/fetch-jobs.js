#!/usr/bin/env node
/**
 * Fetch jobs from all companies with known ATS APIs (Greenhouse, Ashby, Lever, Workable)
 * Outputs normalized JSON to data/jobs-fetched.json
 *
 * Usage: node scripts/fetch-jobs.js
 *
 * Supports: Greenhouse, Ashby, Lever, Workable
 * No API keys needed — all use public job board APIs.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const config = JSON.parse(readFileSync(resolve(ROOT, 'data/ats-companies.json'), 'utf-8'));
const REF = '?ref=jobsbyculture.com';

// ---------- ATS Fetchers ----------

async function fetchGreenhouse(atsSlug) {
    const url = `https://boards-api.greenhouse.io/v1/boards/${atsSlug}/jobs?content=true`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Greenhouse ${atsSlug}: ${res.status}`);
    const data = await res.json();
    return (data.jobs || []).map(j => ({
        title: j.title,
        location: j.location?.name || '',
        type: j.employment_type || 'Full-time',
        url: j.absolute_url + REF,
        posted: j.updated_at || j.created_at || '',
        department: j.departments?.[0]?.name || ''
    }));
}

async function fetchAshby(atsSlug) {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${atsSlug}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Ashby ${atsSlug}: ${res.status}`);
    const data = await res.json();
    return (data.jobs || []).map(j => ({
        title: j.title,
        location: j.location || j.locationName || '',
        type: j.employmentType || 'Full-time',
        url: `https://jobs.ashbyhq.com/${atsSlug}/${j.id}${REF}`,
        posted: j.publishedDate || j.updatedAt || '',
        department: j.departmentName || j.department || ''
    }));
}

async function fetchLever(atsSlug) {
    const url = `https://api.lever.co/v0/postings/${atsSlug}?mode=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Lever ${atsSlug}: ${res.status}`);
    const data = await res.json();
    return (data || []).map(j => ({
        title: j.text,
        location: j.categories?.location || '',
        type: j.categories?.commitment || 'Full-time',
        url: j.hostedUrl + REF,
        posted: j.createdAt ? new Date(j.createdAt).toISOString() : '',
        department: j.categories?.department || j.categories?.team || ''
    }));
}

async function fetchWorkable(atsSlug) {
    const url = `https://apply.workable.com/api/v1/widget/accounts/${atsSlug}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Workable ${atsSlug}: ${res.status}`);
    const data = await res.json();
    return (data.jobs || []).map(j => ({
        title: j.title,
        location: [j.city, j.state, j.country].filter(Boolean).join(', ') || j.location || '',
        type: j.employment_type || j.type || 'Full-time',
        url: j.url + REF,
        posted: j.published || j.created_at || '',
        department: j.department || ''
    }));
}

const FETCHERS = {
    greenhouse: fetchGreenhouse,
    ashby: fetchAshby,
    lever: fetchLever,
    workable: fetchWorkable
};

// ---------- Relative time helper ----------

function toRelativeTime(dateStr) {
    if (!dateStr) return '3w+ ago';
    const ms = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(ms / 86400000);
    if (days < 1) return '1d ago';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 90) return `${Math.floor(days / 30)}mo ago`;
    return '3w+ ago';
}

// ---------- Main ----------

console.log('Fetching jobs from ATS APIs...\n');

const allJobs = [];
let id = 1;

for (const company of config.companies) {
    const fetcher = FETCHERS[company.ats];
    if (!fetcher) {
        console.log(`  ⚠ ${company.name}: unknown ATS "${company.ats}", skipping`);
        continue;
    }

    try {
        const jobs = await fetcher(company.atsSlug);
        for (const j of jobs) {
            allJobs.push({
                id: id++,
                title: j.title,
                company: company.slug,
                location: j.location,
                type: j.type || 'Full-time',
                posted: toRelativeTime(j.posted),
                source: 'API',
                url: j.url,
                department: j.department
            });
        }
        console.log(`  ✓ ${company.name}: ${jobs.length} jobs`);
    } catch (err) {
        console.error(`  ✗ ${company.name}: ${err.message}`);
    }
}

console.log(`\nTotal: ${allJobs.length} jobs from ${config.companies.length} companies`);

const outPath = resolve(ROOT, 'data/jobs-fetched.json');
writeFileSync(outPath, JSON.stringify(allJobs, null, 2));
console.log(`Saved to ${outPath}`);
