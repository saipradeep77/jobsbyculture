#!/usr/bin/env node
/**
 * Fetches Google Search Console performance data for jobsbyculture.com.
 *
 * Saves to data/gsc-performance.json with:
 *   - Top queries by impressions (with clicks, CTR, position)
 *   - Top pages by impressions
 *   - Opportunities: high-impression/low-CTR pages, striking-distance keywords
 *
 * Used by:
 *   - Blog agent: prioritize topics people are searching for
 *   - Daily QA: flag pages where title/meta tweaks could improve CTR
 *
 * Prerequisites:
 *   - Google Search Console API enabled in GCP
 *   - Service account at data/google-service-account.json
 *   - Service account added as Owner in GSC
 *
 * Usage: node scripts/fetch-gsc-data.js
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoogleAuth } from 'google-auth-library';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const CREDENTIALS_PATH = resolve(ROOT, 'data/google-service-account.json');
const OUTPUT_PATH = resolve(ROOT, 'data/gsc-performance.json');
const SITE_URL = 'sc-domain:jobsbyculture.com';
const DAYS = 28; // Last 28 days of data

async function fetchGSC() {
    const auth = new GoogleAuth({
        keyFile: CREDENTIALS_PATH,
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });
    const client = await auth.getClient();

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - DAYS);

    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];

    console.log(`Fetching GSC data: ${start} to ${end}\n`);

    // ─── Query-level data (top 1000 queries) ───
    console.log('Fetching top queries...');
    const queryRes = await client.request({
        url: `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`,
        method: 'POST',
        data: {
            startDate: start,
            endDate: end,
            dimensions: ['query'],
            rowLimit: 1000,
        },
    });
    const queries = (queryRes.data.rows || []).map(r => ({
        query: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: Math.round(r.ctr * 10000) / 100, // percentage with 2 decimals
        position: Math.round(r.position * 10) / 10,
    }));
    console.log(`  ${queries.length} queries`);

    // ─── Page-level data (top 1000 pages) ───
    console.log('Fetching top pages...');
    const pageRes = await client.request({
        url: `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`,
        method: 'POST',
        data: {
            startDate: start,
            endDate: end,
            dimensions: ['page'],
            rowLimit: 1000,
        },
    });
    const pages = (pageRes.data.rows || []).map(r => ({
        page: r.keys[0],
        path: r.keys[0].replace('https://jobsbyculture.com', ''),
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: Math.round(r.ctr * 10000) / 100,
        position: Math.round(r.position * 10) / 10,
    }));
    console.log(`  ${pages.length} pages`);

    // ─── Query + Page combined (top 5000 rows — which queries land on which pages) ───
    console.log('Fetching query × page data...');
    const queryPageRes = await client.request({
        url: `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`,
        method: 'POST',
        data: {
            startDate: start,
            endDate: end,
            dimensions: ['query', 'page'],
            rowLimit: 5000,
        },
    });
    const queryPages = (queryPageRes.data.rows || []).map(r => ({
        query: r.keys[0],
        page: r.keys[1],
        path: r.keys[1].replace('https://jobsbyculture.com', ''),
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: Math.round(r.ctr * 10000) / 100,
        position: Math.round(r.position * 10) / 10,
    }));
    console.log(`  ${queryPages.length} query×page rows`);

    // ─── Compute opportunities ───
    console.log('\nComputing opportunities...');

    // 1. High impressions, low CTR (> 50 impressions, < 3% CTR)
    const lowCTR = pages
        .filter(p => p.impressions >= 50 && p.ctr < 3)
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 20);

    // 2. Striking distance keywords (position 4-15, > 10 impressions)
    const strikingDistance = queries
        .filter(q => q.position >= 4 && q.position <= 15 && q.impressions >= 10)
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 30);

    // 3. Top performing pages (highest clicks)
    const topPages = pages
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 20);

    // 4. Trending queries (high impressions, could be blog topics)
    const blogOpportunities = queries
        .filter(q => q.impressions >= 20 && q.clicks < 5)
        .filter(q => {
            // Filter for queries that suggest blog-worthy content
            const q_lower = q.query.toLowerCase();
            return /(working at|culture|review|salary|compensation|vs |comparison|best|interview|remote|hiring|layoff)/.test(q_lower);
        })
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 20);

    // 5. Pages with no clicks despite impressions
    const zeroClickPages = pages
        .filter(p => p.clicks === 0 && p.impressions >= 20)
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 15);

    // ─── Summary stats ───
    const totalClicks = pages.reduce((s, p) => s + p.clicks, 0);
    const totalImpressions = pages.reduce((s, p) => s + p.impressions, 0);
    const avgCTR = totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0;
    const avgPosition = pages.length > 0
        ? Math.round(pages.reduce((s, p) => s + p.position * p.impressions, 0) / totalImpressions * 10) / 10
        : 0;

    console.log(`\n  Total clicks: ${totalClicks}`);
    console.log(`  Total impressions: ${totalImpressions}`);
    console.log(`  Average CTR: ${avgCTR}%`);
    console.log(`  Average position: ${avgPosition}`);

    // ─── Build output ───
    const output = {
        fetchedAt: new Date().toISOString(),
        dateRange: { start, end },
        summary: {
            totalClicks,
            totalImpressions,
            avgCTR,
            avgPosition,
            totalQueries: queries.length,
            totalPages: pages.length,
        },
        opportunities: {
            lowCTR,
            strikingDistance,
            blogOpportunities,
            zeroClickPages,
        },
        topPages,
        topQueries: queries.slice(0, 50),
        // Full data for agents to analyze
        allQueries: queries,
        allPages: pages,
        queryPageMap: queryPages,
    };

    writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
    console.log(`\n✓ Saved to ${OUTPUT_PATH}`);

    // ─── Print opportunities ───
    if (lowCTR.length > 0) {
        console.log(`\n🔴 Low CTR pages (${lowCTR.length}):`);
        for (const p of lowCTR.slice(0, 5)) {
            console.log(`  ${p.impressions} imp, ${p.ctr}% CTR, pos ${p.position} — ${p.path}`);
        }
    }

    if (strikingDistance.length > 0) {
        console.log(`\n🟡 Striking distance keywords (${strikingDistance.length}):`);
        for (const q of strikingDistance.slice(0, 5)) {
            console.log(`  ${q.impressions} imp, pos ${q.position} — "${q.query}"`);
        }
    }

    if (blogOpportunities.length > 0) {
        console.log(`\n📝 Blog opportunities (${blogOpportunities.length}):`);
        for (const q of blogOpportunities.slice(0, 5)) {
            console.log(`  ${q.impressions} imp, ${q.clicks} clicks — "${q.query}"`);
        }
    }
}

fetchGSC().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
