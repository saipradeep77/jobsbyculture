/**
 * Adds ?ref=jobsbyculture.com to all external links in all HTML files.
 * Runs at build time — no runtime JS needed.
 *
 * Skips:
 * - Internal links (jobsbyculture.com)
 * - Links that already have ref= param
 * - Non-http links (mailto:, tel:, javascript:, #)
 * - Google Fonts, Plausible, ScreenshotOne (functional URLs)
 * - Links inside <script> JSON-LD blocks
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const SKIP_DOMAINS = [
    'jobsbyculture.com',
    'www.jobsbyculture.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'plausible.io',
    'api.screenshotone.com',
    'schema.org',
];

function findHtmlFiles(dir) {
    let results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (['node_modules', '.git', 'Ahrefs data'].includes(entry.name)) continue;
        if (entry.isDirectory()) results = results.concat(findHtmlFiles(full));
        else if (entry.name.endsWith('.html')) results.push(full);
    }
    return results;
}

function addRef(url) {
    try {
        const parsed = new URL(url);
        if (SKIP_DOMAINS.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d))) return url;
        if (parsed.searchParams.has('ref')) return url;
        if (decoded.includes('ref=jobsbyculture') || decoded.includes('ref%3Djobsbyculture')) return url;
        parsed.searchParams.set('ref', 'jobsbyculture.com');
        return parsed.toString();
    } catch {
        return url;
    }
}

const files = findHtmlFiles(ROOT);
let totalFixed = 0;
let filesChanged = 0;

for (const fp of files) {
    let html = fs.readFileSync(fp, 'utf8');
    let changed = false;

    // Match href="https://..." that are external
    // But skip URLs inside <script type="application/ld+json"> blocks
    // Strategy: process only outside of JSON-LD blocks

    // Split by JSON-LD blocks to avoid modifying them
    const parts = html.split(/(<script type="application\/ld\+json">[\s\S]*?<\/script>)/);

    for (let i = 0; i < parts.length; i++) {
        // Skip JSON-LD blocks (odd indices after split)
        if (i % 2 === 1) continue;

        const original = parts[i];
        parts[i] = parts[i].replace(/href="(https?:\/\/[^"]+)"/g, (match, url) => {
            // Decode &amp; for URL parsing
            const decoded = url.replace(/&amp;/g, '&');

            try {
                const parsed = new URL(decoded);
                if (SKIP_DOMAINS.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d))) return match;
                if (parsed.searchParams.has('ref')) return match;
                if (decoded.includes('ref=jobsbyculture') || decoded.includes('ref%3Djobsbyculture')) return match;

                parsed.searchParams.set('ref', 'jobsbyculture.com');
                // Re-encode & as &amp; for HTML attribute
                const newUrl = parsed.toString().replace(/&/g, '&amp;');
                totalFixed++;
                return 'href="' + newUrl + '"';
            } catch {
                return match;
            }
        });

        if (parts[i] !== original) changed = true;
    }

    if (changed) {
        fs.writeFileSync(fp, parts.join(''));
        filesChanged++;
    }
}

console.log(`✓ Added ref= to ${totalFixed} external links across ${filesChanged} files`);
