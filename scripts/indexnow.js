#!/usr/bin/env node
/**
 * Submit all site URLs to IndexNow (Bing, Yandex, Seznam, Naver)
 * Usage: node scripts/indexnow.js
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const KEY = '1e92a6c89b31471786df024393c4a944';
const HOST = 'jobsbyculture.com';
const ENDPOINT = 'https://api.indexnow.org/IndexNow';

// Parse sitemap.xml to extract all URLs
const sitemap = readFileSync(resolve(ROOT, 'sitemap.xml'), 'utf-8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

console.log(`Found ${urls.length} URLs in sitemap.xml`);

// Submit in batches of 100 (IndexNow limit per request)
const BATCH_SIZE = 100;
let submitted = 0;

for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const body = {
        host: HOST,
        key: KEY,
        keyLocation: `https://${HOST}/${KEY}.txt`,
        urlList: batch
    };

    const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body)
    });

    submitted += batch.length;

    if (res.ok || res.status === 200 || res.status === 202) {
        console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: submitted ${batch.length} URLs (${res.status})`);
    } else {
        const text = await res.text().catch(() => '');
        console.error(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: FAILED (${res.status}) ${text}`);
    }
}

console.log(`\nDone! Submitted ${submitted} URLs to IndexNow.`);
console.log('Bing, Yandex, Seznam, and Naver will process these within minutes.');
