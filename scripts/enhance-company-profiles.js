#!/usr/bin/env node
/**
 * Enhance company profile HTML pages with:
 * 1. Enhanced JSON-LD schema (review + aggregateRating + sameAs)
 * 2. Consensus summary paragraph after hero tagline
 * 3. CSS for .cp-consensus
 *
 * Usage: node scripts/enhance-company-profiles.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── Company slugs ───
const SLUGS = [
    'anthropic', 'huggingface', 'databricks', 'cohere', 'mistral',
    'hubspot', 'vercel', 'stripe', 'perplexity', 'together',
    'cursor', 'linear', 'scale', 'coreweave', 'runway',
    'vast', 'apollo', 'airbnb', 'figma'
];

// ─── Read compare.html to extract COMPANIES, COMPANY_REVIEWS, and CRC data ───
const compareHtml = readFileSync(resolve(ROOT, 'compare.html'), 'utf-8');

function extractJSObject(src, varName) {
    const regex = new RegExp('const ' + varName + ' = (\\{[\\s\\S]*?\\});', 'm');
    const m = src.match(regex);
    if (!m) return {};
    try {
        return new Function('return ' + m[1])();
    } catch {
        return {};
    }
}

const COMPANIES = extractJSObject(compareHtml, 'COMPANIES');
const COMPANY_REVIEWS = extractJSObject(compareHtml, 'COMPANY_REVIEWS');
const CRC = extractJSObject(compareHtml, 'CRC');

// ─── CSS for .cp-consensus ───
const CONSENSUS_CSS_BLOCK = `.cp-consensus {
            font-size: 15px; color: var(--text-2); max-width: 620px;
            margin: -16px auto 32px; line-height: 1.7;
            padding: 16px 24px; background: var(--accent-bg);
            border: 1px solid var(--accent-border); border-radius: var(--radius);
            text-align: center; animation: fadeUp 0.5s ease 0.2s both;
        }`;

// ─── Process each company ───
let updatedCount = 0;

for (const slug of SLUGS) {
    const company = COMPANIES[slug];
    if (!company) {
        console.error(`  [skip] No COMPANIES data for slug: ${slug}`);
        continue;
    }

    const reviews = COMPANY_REVIEWS[slug] || { pros: [], cons: [] };
    const filePath = resolve(ROOT, 'companies', `${slug}.html`);

    let html;
    try {
        html = readFileSync(filePath, 'utf-8');
    } catch (err) {
        console.error(`  [error] Cannot read ${filePath}: ${err.message}`);
        continue;
    }

    // ─── 1. Replace existing JSON-LD schema ───

    // Extract the existing JSON-LD to preserve its data
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
    if (!jsonLdMatch) {
        console.error(`  [skip] No JSON-LD found in ${slug}.html`);
        continue;
    }

    let existingSchema;
    try {
        existingSchema = JSON.parse(jsonLdMatch[1]);
    } catch (err) {
        console.error(`  [error] Cannot parse JSON-LD in ${slug}.html: ${err.message}`);
        continue;
    }

    // Only rebuild JSON-LD if it doesn't already have a review property (idempotent)
    if (!existingSchema.review) {
        // Build the review body from bestFor + verdict
        const reviewBody = [company.bestFor, company.verdict].filter(Boolean).join('. ');

        // Build the enhanced schema
        const enhancedSchema = {
            ...existingSchema,
            "@context": "https://schema.org",
            "@type": "Organization",
            "review": {
                "@type": "Review",
                "author": {
                    "@type": "Organization",
                    "name": "JobsByCulture"
                },
                "reviewRating": {
                    "@type": "Rating",
                    "ratingValue": company.glassdoor,
                    "bestRating": 5,
                    "worstRating": 1
                },
                "reviewBody": reviewBody
            },
            "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": company.glassdoor,
                "bestRating": 5,
                "worstRating": 1,
                "ratingCount": existingSchema.aggregateRating?.ratingCount || 100
            },
            "sameAs": []
        };

        // Format the JSON-LD with nice indentation
        const newJsonLd = JSON.stringify(enhancedSchema, null, 8);

        // Replace the first JSON-LD block
        html = html.replace(
            /<script type="application\/ld\+json">\s*[\s\S]*?<\/script>/,
            `<script type="application/ld+json">\n    ${newJsonLd}\n    </script>`
        );
    }

    // ─── 2. Add consensus summary after cp-hero-tagline ───

    // Only add if not already present
    if (!html.includes('cp-consensus')) {
        // Find the cp-hero-tagline line and its closing </p>
        const taglineRegex = /(<p class="cp-hero-tagline">.*?<\/p>)/;
        const taglineMatch = html.match(taglineRegex);
        if (taglineMatch) {
            const consensusHtml = `\n        <p class="cp-consensus">The consensus on ${company.name}: ${company.verdict}</p>`;
            html = html.replace(taglineRegex, `$1${consensusHtml}`);
        } else {
            console.warn(`  [warn] No cp-hero-tagline found in ${slug}.html`);
        }
    }

    // ─── 3. Add CSS for .cp-consensus ───

    // Only add if not already present in the CSS
    if (!html.includes('.cp-consensus')) {
        // Try the decorated NAV comment first, then the plain NAV comment
        let inserted = false;

        if (html.includes('/* ═══ NAV ═══ */')) {
            html = html.replace(
                '/* ═══ NAV ═══ */',
                `${CONSENSUS_CSS_BLOCK}\n\n        /* ═══ NAV ═══ */`
            );
            inserted = true;
        } else if (html.includes('/* NAV */')) {
            html = html.replace(
                '/* NAV */',
                `${CONSENSUS_CSS_BLOCK}\n\n        /* NAV */`
            );
            inserted = true;
        }

        if (!inserted) {
            console.warn(`  [warn] No NAV CSS comment found in ${slug}.html — CSS not inserted`);
        }
    }

    // ─── Write the updated file ───
    writeFileSync(filePath, html);
    updatedCount++;
    console.log(`  [done] ${slug}.html`);
}

console.log(`\nDone! Updated ${updatedCount}/${SLUGS.length} company profile pages.`);
