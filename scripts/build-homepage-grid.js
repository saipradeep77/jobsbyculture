#!/usr/bin/env node
/**
 * Regenerates the static company grid cards in index.html from data/companies.json.
 * Cards are rendered at build time for SEO, then replaced by the dynamic JS renderer on page load.
 *
 * Run: node scripts/build-homepage-grid.js
 * Part of the refresh pipeline — run after companies.json is updated.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const data = JSON.parse(readFileSync(resolve(ROOT, 'data/companies.json'), 'utf-8'));
const companies = data.companies;

function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Build static HTML cards
let cardsHtml = '';
for (const [slug, co] of Object.entries(companies)) {
    const tagsHtml = (co.tags || []).map(t =>
        `                    <span class="co-tag" data-v="${t.slug}">${t.label}</span>`
    ).join('\n');

    const detailsHtml = Object.entries(co.details || {}).map(([label, value]) =>
        `                        <div class="co-detail-item"><span class="co-detail-label">${escHtml(label)}</span><span class="co-detail-value">${escHtml(value)}</span></div>`
    ).join('\n');

    const prosHtml = (co.pros || []).map(p => `<li>${escHtml(p)}</li>`).join('');
    const consHtml = (co.cons || []).map(c => `<li>${escHtml(c)}</li>`).join('');

    cardsHtml += `
            <div class="co-card" data-company="${slug}" data-values="${co.values.join(',')}">
                <div class="co-top">
                    <img class="co-avatar" src="${co.logo}" alt="${escHtml(co.name)}" width="40" height="40">
                    <div>
                        <div class="co-name">${escHtml(co.name)}</div>
                        <div class="co-meta">${escHtml(co.meta)}</div>
                    </div>
                    <div class="co-rating" title="Glassdoor rating">⭐ ${co.glassdoor}</div>
                </div>
                <div class="co-tags">
${tagsHtml}
                </div>
                <div class="co-quote">"${escHtml(co.quote)}"</div>
                <div class="co-details" style="display:none">
                    <div class="co-detail-grid">
${detailsHtml}
                    </div>
                    <div class="co-pros-cons">
                        <div class="co-pros"><strong>👍 Pros</strong><ul>${prosHtml}</ul></div>
                        <div class="co-cons"><strong>👎 Cons</strong><ul>${consHtml}</ul></div>
                    </div>
                    <div class="co-source">${escHtml(co.source || 'Based on Glassdoor reviews')}</div>
                </div>
                <div class="co-foot">
                    <span class="co-loc">${co.location}</span>
                    <div class="co-actions">
                        <button class="co-toggle" onclick="toggleProfile(this)">View Profile ↓</button>
                        <a href="/companies/${slug}" class="co-link">Full Profile →</a>
                        <a href="/jobs?company=${slug}" class="co-link">See Jobs →</a>
                    </div>
                </div>
            </div>
`;
}

// Replace in index.html between markers
const indexPath = resolve(ROOT, 'index.html');
let html = readFileSync(indexPath, 'utf-8');

const START_MARKER = '<!-- COMPANY-GRID-START -->';
const END_MARKER = '<!-- COMPANY-GRID-END -->';

if (!html.includes(START_MARKER)) {
    console.error('ERROR: Could not find COMPANY-GRID-START marker in index.html');
    console.log('Add these markers around the co-grid cards:');
    console.log('  <!-- COMPANY-GRID-START -->');
    console.log('  ... cards ...');
    console.log('  <!-- COMPANY-GRID-END -->');
    process.exit(1);
}

const startIdx = html.indexOf(START_MARKER) + START_MARKER.length;
const endIdx = html.indexOf(END_MARKER);
html = html.slice(0, startIdx) + '\n' + cardsHtml + '        ' + html.slice(endIdx);

writeFileSync(indexPath, html);
console.log(`✓ Regenerated ${Object.keys(companies).length} company cards in index.html`);
