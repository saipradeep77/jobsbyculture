/**
 * Injects a "Claim This Profile" banner on all company pages.
 * Appears below the hero section, above culture overview.
 * Links to a mailto with pre-filled subject for the specific company.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const COMPANIES_DIR = path.join(ROOT, 'companies');

// Load company names
const ats = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/ats-companies.json'), 'utf8'));
const companyNames = {};
ats.companies.forEach(c => { companyNames[c.slug] = c.name; });

const CLAIM_CSS = `
        /* ═══ CLAIM PROFILE BANNER ═══ */
        .claim-banner {
            background: linear-gradient(135deg, rgba(13,148,136,0.06) 0%, rgba(232,89,12,0.06) 100%);
            border: 1.5px solid rgba(13,148,136,0.2);
            border-radius: var(--radius);
            padding: 20px 28px;
            display: flex; align-items: center; justify-content: space-between;
            gap: 20px; max-width: 800px; margin: -20px auto 40px;
            animation: fadeUp 0.5s ease 0.3s both;
        }
        .claim-banner-text {
            display: flex; flex-direction: column; gap: 4px;
        }
        .claim-banner-title {
            font-size: 15px; font-weight: 700; color: var(--text);
            display: flex; align-items: center; gap: 8px;
        }
        .claim-banner-title .badge {
            font-size: 10px; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.08em; color: #fff; background: var(--teal);
            padding: 2px 8px; border-radius: var(--radius-full);
        }
        .claim-banner-desc {
            font-size: 13px; color: var(--text-2); line-height: 1.5;
        }
        .claim-banner-btn {
            flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px;
            background: var(--teal); color: #fff;
            padding: 10px 22px; border-radius: var(--radius-full);
            font-size: 14px; font-weight: 700; text-decoration: none;
            font-family: var(--font-body); transition: all 0.2s;
            white-space: nowrap;
        }
        .claim-banner-btn:hover {
            background: #0b8278; transform: translateY(-1px);
            box-shadow: 0 4px 16px rgba(13,148,136,0.2);
        }
        @media (max-width: 768px) {
            .claim-banner { flex-direction: column; text-align: center; padding: 16px 20px; }
            .claim-banner-btn { width: 100%; justify-content: center; }
        }
`;

function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const companyFiles = fs.readdirSync(COMPANIES_DIR).filter(f => f.endsWith('.html'));
let count = 0;

for (const file of companyFiles) {
    const slug = file.replace('.html', '');
    const fp = path.join(COMPANIES_DIR, file);
    let html = fs.readFileSync(fp, 'utf8');

    const name = companyNames[slug] || slug;

    // Remove existing claim banner (for re-runs)
    html = html.replace(/<!-- ═══ CLAIM BANNER ═══ -->[\s\S]*?<!-- ═══ \/CLAIM BANNER ═══ -->\n*/g, '');

    // Build mailto link
    const subject = encodeURIComponent(`Claim ${name}'s profile on JobsByCulture`);
    const body = encodeURIComponent(`Hi JobsByCulture team,\n\nI work at ${name} and would like to claim our company profile on jobsbyculture.com/companies/${slug}.\n\nPlease let me know the next steps.\n\nThanks`);
    const mailto = `mailto:hello@jobsbyculture.com?subject=${subject}&body=${body}`;

    const bannerHtml = `<!-- ═══ CLAIM BANNER ═══ -->
<div class="claim-banner">
    <div class="claim-banner-text">
        <div class="claim-banner-title"><span class="badge">Free</span> Work at ${escHtml(name)}? Claim this profile</div>
        <div class="claim-banner-desc">Update your company's culture data, respond to reviews, and feature your open roles prominently.</div>
    </div>
    <a href="${mailto}" class="claim-banner-btn">Claim Profile &rarr;</a>
</div>
<!-- ═══ /CLAIM BANNER ═══ -->

`;

    // Inject CSS
    if (!html.includes('claim-banner')) {
        html = html.replace('</style>', CLAIM_CSS + '\n    </style>');
    }

    // Inject banner after hero section, before culture overview
    if (html.includes('<!-- ═══ CULTURE OVERVIEW ═══ -->')) {
        html = html.replace('<!-- ═══ CULTURE OVERVIEW ═══ -->', bannerHtml + '<!-- ═══ CULTURE OVERVIEW ═══ -->');
    } else if (html.includes('<!-- ═══ GLASSDOOR RATINGS ═══ -->')) {
        html = html.replace('<!-- ═══ GLASSDOOR RATINGS ═══ -->', bannerHtml + '<!-- ═══ GLASSDOOR RATINGS ═══ -->');
    } else {
        // Fallback: after </section> of hero
        const heroEnd = html.indexOf('</section>');
        if (heroEnd !== -1) {
            const insertPoint = heroEnd + '</section>'.length;
            html = html.slice(0, insertPoint) + '\n\n' + bannerHtml + html.slice(insertPoint);
        }
    }

    fs.writeFileSync(fp, html);
    count++;
    console.log(`Updated: ${file} (${name})`);
}

console.log(`\n✓ Added Claim Profile banner to ${count} company pages`);
