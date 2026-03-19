import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const COMPANIES_DIR = path.join(ROOT, 'companies');
const COMPARE_DIR = path.join(ROOT, 'compare');
const BLOG_DIR = path.join(ROOT, 'blog');

// Load company names from ats-companies.json
const ats = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/ats-companies.json'), 'utf8'));
const companyNames = {};
ats.companies.forEach(c => { companyNames[c.slug] = c.name; });

// Find compare pages per company
const compareFiles = fs.readdirSync(COMPARE_DIR).filter(f => f.endsWith('.html'));
const compareByCompany = {};
for (const file of compareFiles) {
    const slug = file.replace('.html', '');
    const parts = slug.split('-vs-');
    if (parts.length !== 2) continue;
    const [a, b] = parts;
    for (const co of [a, b]) {
        if (!compareByCompany[co]) compareByCompany[co] = [];
        const other = co === a ? b : a;
        const otherName = companyNames[other] || other;
        compareByCompany[co].push({ slug: file.replace('.html', ''), otherSlug: other, otherName });
    }
}

// Find blog posts per company
const blogFiles = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.html') && f !== 'index.html');
const blogByCompany = {};
for (const file of blogFiles) {
    const html = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8');
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch
        ? titleMatch[1].replace(/\s*\|\s*JobsByCulture$/, '').replace(/&amp;/g, '&')
        : file.replace('.html', '');
    const blogSlug = file.replace('.html', '');

    for (const co of ats.companies) {
        if (html.includes('/companies/' + co.slug) || html.includes('company=' + co.slug)) {
            if (!blogByCompany[co.slug]) blogByCompany[co.slug] = [];
            // Avoid duplicates
            if (!blogByCompany[co.slug].some(b => b.slug === blogSlug)) {
                blogByCompany[co.slug].push({ slug: blogSlug, title });
            }
        }
    }
}

// CSS for the related section
const relatedCSS = `
        /* ═══ RELATED SECTION ═══ */
        .cp-related { padding: 56px 0; border-top: 1px solid var(--border); }
        .cp-related-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
        .cp-related-col h3 { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: var(--text); }
        .cp-related-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
        .cp-related-list li a {
            font-size: 14px; color: var(--text-2); text-decoration: none;
            display: flex; align-items: center; gap: 6px; padding: 8px 12px;
            border-radius: var(--radius-sm); transition: all 0.15s;
        }
        .cp-related-list li a:hover { background: var(--bg-hover); color: var(--accent); }
        .cp-related-list li a .arrow { color: var(--text-3); font-size: 12px; }
        .cp-related-more {
            display: inline-block; margin-top: 12px; font-size: 13px; font-weight: 600;
            color: var(--accent); text-decoration: none;
        }
        .cp-related-more:hover { text-decoration: underline; }
        @media (max-width: 768px) { .cp-related-grid { grid-template-columns: 1fr; } }
`;

function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Process each company page
const companyFiles = fs.readdirSync(COMPANIES_DIR).filter(f => f.endsWith('.html'));
let count = 0;

for (const file of companyFiles) {
    const slug = file.replace('.html', '');
    const fp = path.join(COMPANIES_DIR, file);
    let html = fs.readFileSync(fp, 'utf8');

    const allCompares = compareByCompany[slug] || [];
    const blogs = (blogByCompany[slug] || []).slice(0, 5); // Show max 5
    const compares = allCompares; // Show ALL compare links — no cap, to fix orphan pages

    if (compares.length === 0 && blogs.length === 0) {
        console.log('SKIP (no related content): ' + file);
        continue;
    }

    // Remove existing related section if present (for re-runs)
    html = html.replace(/<!-- ═══ RELATED ═══ -->[\s\S]*?<!-- ═══ \/RELATED ═══ -->/, '');

    // Build the related section HTML
    let relatedHtml = '<!-- ═══ RELATED ═══ -->\n<section class="cp-related">\n    <div class="container">\n';
    relatedHtml += '        <span class="s-label">Explore More</span>\n';
    relatedHtml += '        <h2 class="s-title">Related <em>content</em></h2>\n';
    relatedHtml += '        <div class="cp-related-grid">\n';

    // Blog posts column
    if (blogs.length > 0) {
        relatedHtml += '            <div class="cp-related-col">\n';
        relatedHtml += '                <h3>Blog Posts</h3>\n';
        relatedHtml += '                <ul class="cp-related-list">\n';
        for (const b of blogs) {
            relatedHtml += `                    <li><a href="/blog/${b.slug}"><span class="arrow">&rarr;</span> ${escHtml(b.title)}</a></li>\n`;
        }
        relatedHtml += '                </ul>\n';
        relatedHtml += '            </div>\n';
    }

    // Compare pages column
    if (compares.length > 0) {
        const coName = companyNames[slug] || slug;
        relatedHtml += '            <div class="cp-related-col">\n';
        relatedHtml += `                <h3>Compare ${escHtml(coName)}</h3>\n`;
        relatedHtml += '                <ul class="cp-related-list">\n';
        for (const c of compares) {
            relatedHtml += `                    <li><a href="/compare/${c.slug}"><span class="arrow">&rarr;</span> ${escHtml(coName)} vs ${escHtml(c.otherName)}</a></li>\n`;
        }
        relatedHtml += '                </ul>\n';
        // All compare links are shown — no "see all" needed
        relatedHtml += '            </div>\n';
    }

    relatedHtml += '        </div>\n';
    relatedHtml += '    </div>\n</section>\n<!-- ═══ /RELATED ═══ -->\n\n';

    // Inject CSS if not already present
    if (!html.includes('cp-related')) {
        html = html.replace('</style>', relatedCSS + '\n    </style>');
    }

    // Inject related section before the footer (handle different comment styles)
    if (html.includes('<!-- ═══ FOOTER ═══ -->')) {
        html = html.replace('<!-- ═══ FOOTER ═══ -->', relatedHtml + '<!-- ═══ FOOTER ═══ -->');
    } else if (html.includes('<!-- FOOTER -->')) {
        html = html.replace('<!-- FOOTER -->', relatedHtml + '<!-- FOOTER -->');
    } else {
        // Fallback: inject before <footer
        html = html.replace('<footer', relatedHtml + '<footer');
    }

    fs.writeFileSync(fp, html);
    count++;
    console.log(`Updated: ${file} (${blogs.length} blogs, ${compares.length} compares)`);
}

console.log(`\n✓ Added related sections to ${count} company pages`);
