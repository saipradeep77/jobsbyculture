/**
 * Injects a "Claim This Profile" banner with inline Formspree form on all company pages.
 * Appears below the hero section, above culture overview.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const COMPANIES_DIR = path.join(ROOT, 'companies');
const FORMSPREE_ID = 'xbdapzke';

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
            padding: 24px 28px;
            max-width: 800px; margin: -20px auto 40px;
            animation: fadeUp 0.5s ease 0.3s both;
        }
        .claim-banner-header {
            display: flex; align-items: center; justify-content: space-between;
            gap: 16px; cursor: pointer;
        }
        .claim-banner-text { display: flex; flex-direction: column; gap: 4px; }
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
        .claim-banner-toggle {
            flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px;
            background: var(--teal); color: #fff;
            padding: 10px 22px; border-radius: var(--radius-full);
            font-size: 14px; font-weight: 700; text-decoration: none;
            font-family: var(--font-body); transition: all 0.2s;
            white-space: nowrap; border: none; cursor: pointer;
        }
        .claim-banner-toggle:hover {
            background: #0b8278; transform: translateY(-1px);
            box-shadow: 0 4px 16px rgba(13,148,136,0.2);
        }
        .claim-form {
            display: none; margin-top: 20px; padding-top: 20px;
            border-top: 1px solid rgba(13,148,136,0.15);
        }
        .claim-form.open { display: block; }
        .claim-form-row {
            display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
            margin-bottom: 12px;
        }
        .claim-form input, .claim-form select {
            width: 100%; padding: 10px 14px; border-radius: var(--radius-sm);
            border: 1.5px solid var(--border-2); font-size: 14px;
            font-family: var(--font-body); background: #fff; color: var(--text);
            outline: none; transition: border-color 0.2s;
        }
        .claim-form input:focus, .claim-form select:focus {
            border-color: var(--teal); box-shadow: 0 0 0 3px rgba(13,148,136,0.08);
        }
        .claim-form input::placeholder { color: var(--text-3); }
        .claim-form-submit {
            display: inline-flex; align-items: center; gap: 6px;
            background: var(--teal); color: #fff;
            padding: 11px 28px; border-radius: var(--radius-full);
            font-size: 14px; font-weight: 700; border: none; cursor: pointer;
            font-family: var(--font-body); transition: all 0.2s;
            margin-top: 4px;
        }
        .claim-form-submit:hover { background: #0b8278; }
        .claim-form-success {
            display: none; padding: 16px; text-align: center;
            color: var(--teal); font-weight: 600; font-size: 15px;
        }
        @media (max-width: 768px) {
            .claim-banner-header { flex-direction: column; text-align: center; }
            .claim-banner-toggle { width: 100%; justify-content: center; }
            .claim-form-row { grid-template-columns: 1fr; }
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

    const bannerHtml = `<!-- ═══ CLAIM BANNER ═══ -->
<div class="claim-banner" id="claimBanner">
    <div class="claim-banner-header" onclick="document.getElementById('claimForm${slug.replace(/-/g,'')}').classList.toggle('open')">
        <div class="claim-banner-text">
            <div class="claim-banner-title"><span class="badge">Free</span> Work at ${escHtml(name)}? Claim this profile</div>
            <div class="claim-banner-desc">Update your culture data, respond to reviews, and feature your open roles prominently.</div>
        </div>
        <button class="claim-banner-toggle" type="button">Claim Profile &darr;</button>
    </div>
    <div class="claim-form" id="claimForm${slug.replace(/-/g,'')}">
        <form action="https://formspree.io/f/${FORMSPREE_ID}" method="POST" onsubmit="this.style.display='none';this.nextElementSibling.style.display='block';return true;">
            <input type="hidden" name="_subject" value="Profile Claim: ${escHtml(name)}">
            <input type="hidden" name="company" value="${escHtml(name)}">
            <input type="hidden" name="profile_url" value="https://jobsbyculture.com/companies/${slug}">
            <div class="claim-form-row">
                <input type="text" name="name" placeholder="Your name" required>
                <input type="email" name="email" placeholder="Work email" required>
            </div>
            <div class="claim-form-row">
                <input type="text" name="role" placeholder="Your role (e.g., Head of Talent)">
                <select name="interest">
                    <option value="" disabled selected>What are you interested in?</option>
                    <option value="claim">Claim &amp; update our profile</option>
                    <option value="feature-jobs">Feature our open roles</option>
                    <option value="respond-reviews">Respond to reviews</option>
                    <option value="employer-brand">Employer branding partnership</option>
                    <option value="other">Something else</option>
                </select>
            </div>
            <button type="submit" class="claim-form-submit">Submit &rarr;</button>
        </form>
        <div class="claim-form-success">Thanks! We'll be in touch within 24 hours.</div>
    </div>
</div>
<!-- ═══ /CLAIM BANNER ═══ -->

`;

    // Inject CSS (remove old claim CSS first if present)
    if (html.includes('CLAIM PROFILE BANNER')) {
        html = html.replace(/\n\s*\/\* ═══ CLAIM PROFILE BANNER ═══ \*\/[\s\S]*?@media \(max-width: 768px\) \{[^}]*\.claim[^}]*\}\s*\}/g, '');
    }
    if (!html.includes('claim-banner')) {
        html = html.replace('</style>', CLAIM_CSS + '\n    </style>');
    }

    // Inject banner after hero section, before culture overview
    if (html.includes('<!-- ═══ CULTURE OVERVIEW ═══ -->')) {
        html = html.replace('<!-- ═══ CULTURE OVERVIEW ═══ -->', bannerHtml + '<!-- ═══ CULTURE OVERVIEW ═══ -->');
    } else if (html.includes('<!-- ═══ GLASSDOOR RATINGS ═══ -->')) {
        html = html.replace('<!-- ═══ GLASSDOOR RATINGS ═══ -->', bannerHtml + '<!-- ═══ GLASSDOOR RATINGS ═══ -->');
    } else {
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

console.log(`\n✓ Added Claim Profile form to ${count} company pages`);
