#!/usr/bin/env node
/**
 * Submit all site URLs to IndexNow (Bing, Yandex, Naver, Seznam)
 * Usage: node scripts/indexnow.js
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const KEY = '1e92a6c89b31471786df024393c4a944';
const HOST = 'jobsbyculture.com';

const ENDPOINTS = [
    { name: 'IndexNow (Bing)', url: 'https://api.indexnow.org/IndexNow' },
    { name: 'Yandex',          url: 'https://yandex.com/indexnow' },
    { name: 'Naver',           url: 'https://searchadvisor.naver.com/indexnow' },
];

// Parse sitemap.xml to extract all URLs
const sitemap = readFileSync(resolve(ROOT, 'sitemap.xml'), 'utf-8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

console.log(`Found ${urls.length} URLs in sitemap.xml\n`);

const BATCH_SIZE = 100;

for (const endpoint of ENDPOINTS) {
    console.log(`Submitting to ${endpoint.name}...`);
    let ok = 0, fail = 0;

    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        const batch = urls.slice(i, i + BATCH_SIZE);
        const body = {
            host: HOST,
            key: KEY,
            keyLocation: `https://${HOST}/${KEY}.txt`,
            urlList: batch
        };

        try {
            const res = await fetch(endpoint.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body: JSON.stringify(body)
            });

            if (res.ok || res.status === 202) {
                ok += batch.length;
            } else {
                const text = await res.text().catch(() => '');
                console.error(`  Batch failed (${res.status}): ${text.slice(0, 100)}`);
                fail += batch.length;
            }
        } catch (err) {
            console.error(`  Network error: ${err.message}`);
            fail += batch.length;
        }
    }

    console.log(`  ${ok} submitted${fail ? `, ${fail} failed` : ''}\n`);
}

console.log('Done! Search engines will process submitted URLs within minutes.');
