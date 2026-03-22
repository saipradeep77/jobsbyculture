/**
 * Injects a "Claim This Profile" banner + modal popup form on all company pages.
 * Banner is simple one-liner. Clicking opens a beautiful centered modal with Formspree form.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const COMPANIES_DIR = path.join(ROOT, 'companies');
const FORMSPREE_ID = 'xbdapzke';

const ats = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/ats-companies.json'), 'utf8'));
const companyNames = {};
ats.companies.forEach(c => { companyNames[c.slug] = c.name; });

const CLAIM_CSS = `
        /* ═══ CLAIM PROFILE BANNER ═══ */
        .claim-banner {
            background: linear-gradient(135deg, rgba(13,148,136,0.06) 0%, rgba(232,89,12,0.06) 100%);
            border: 1.5px solid rgba(13,148,136,0.2);
            border-radius: var(--radius);
            padding: 16px 24px;
            display: flex; align-items: center; justify-content: space-between;
            gap: 16px; max-width: 800px; margin: -20px auto 40px;
            animation: fadeUp 0.5s ease 0.3s both;
        }
        .claim-banner-text { display: flex; flex-direction: column; gap: 4px; }
        .claim-banner-title {
            font-size: 15px; font-weight: 700; color: var(--text);
            display: flex; align-items: center; gap: 8px;
        }
        .claim-banner-title .badge {
            font-size: 10px; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.08em; color: #fff; background: var(--teal);
            padding: 2px 8px; border-radius: var(--radius-full); flex-shrink: 0;
        }
        .claim-banner-desc {
            font-size: 13px; color: var(--text-2); line-height: 1.5;
        }
        .claim-banner-btn {
            flex-shrink: 0; background: var(--teal); color: #fff;
            padding: 9px 20px; border-radius: var(--radius-full);
            font-size: 13px; font-weight: 700; border: none; cursor: pointer;
            font-family: var(--font-body); transition: all 0.2s; white-space: nowrap;
        }
        .claim-banner-btn:hover {
            background: #0b8278; transform: translateY(-1px);
            box-shadow: 0 4px 16px rgba(13,148,136,0.2);
        }

        /* ═══ CLAIM MODAL ═══ */
        .claim-overlay {
            display: none; position: fixed; inset: 0; z-index: 9999;
            background: rgba(0,0,0,0.5); backdrop-filter: blur(6px);
            align-items: center; justify-content: center; padding: 24px;
        }
        .claim-overlay.open { display: flex; }
        .claim-modal {
            background: #fff; border-radius: 20px; padding: 40px;
            max-width: 480px; width: 100%; position: relative;
            box-shadow: 0 24px 80px rgba(0,0,0,0.15);
            animation: claimSlideUp 0.3s ease both;
        }
        @keyframes claimSlideUp {
            from { opacity: 0; transform: translateY(24px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .claim-modal-close {
            position: absolute; top: 16px; right: 16px;
            background: none; border: none; font-size: 20px;
            color: var(--text-3); cursor: pointer; padding: 4px 8px;
            border-radius: 8px; transition: all 0.15s;
        }
        .claim-modal-close:hover { background: var(--bg-hover); color: var(--text); }
        .claim-modal-icon {
            width: 48px; height: 48px; border-radius: 14px;
            background: rgba(13,148,136,0.1); display: flex;
            align-items: center; justify-content: center;
            font-size: 24px; margin-bottom: 20px;
        }
        .claim-modal h3 {
            font-family: var(--font-display); font-size: 24px;
            font-weight: 400; margin-bottom: 6px; color: var(--text);
        }
        .claim-modal h3 em { color: var(--teal); font-style: italic; }
        .claim-modal-sub {
            font-size: 14px; color: var(--text-2); margin-bottom: 24px; line-height: 1.6;
        }
        .claim-modal-form { display: flex; flex-direction: column; gap: 14px; }
        .claim-modal-form input, .claim-modal-form select {
            width: 100%; padding: 12px 16px; border-radius: 10px;
            border: 1.5px solid var(--border-2); font-size: 14px;
            font-family: var(--font-body); background: var(--bg);
            color: var(--text); outline: none; transition: all 0.2s;
            box-sizing: border-box;
        }
        .claim-modal-form input:focus, .claim-modal-form select:focus {
            border-color: var(--teal); box-shadow: 0 0 0 3px rgba(13,148,136,0.08);
            background: #fff;
        }
        .claim-modal-form input::placeholder { color: var(--text-3); }
        .claim-modal-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .claim-modal-submit {
            width: 100%; padding: 13px; border-radius: 10px;
            background: var(--teal); color: #fff; font-size: 15px;
            font-weight: 700; border: none; cursor: pointer;
            font-family: var(--font-body); transition: all 0.2s;
            margin-top: 4px;
        }
        .claim-modal-submit:hover { background: #0b8278; }
        .claim-modal-footer {
            font-size: 12px; color: var(--text-3); text-align: center;
            margin-top: 16px;
        }
        .claim-modal-success {
            display: none; text-align: center; padding: 20px 0;
        }
        .claim-modal-success .check {
            width: 56px; height: 56px; border-radius: 50%;
            background: rgba(13,148,136,0.1); display: flex;
            align-items: center; justify-content: center;
            font-size: 28px; margin: 0 auto 16px;
        }
        .claim-modal-success h3 { margin-bottom: 8px; }
        .claim-modal-success p { font-size: 14px; color: var(--text-2); }
        @media (max-width: 768px) {
            .claim-banner { flex-direction: column; text-align: center; padding: 14px 18px; }
            .claim-banner-btn { width: 100%; }
            .claim-modal { padding: 28px 24px; }
            .claim-modal-row { grid-template-columns: 1fr; }
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
    const fid = slug.replace(/-/g, '');

    // Remove existing claim banner + modal (for re-runs)
    html = html.replace(/<!-- ═══ CLAIM BANNER ═══ -->[\s\S]*?<!-- ═══ \/CLAIM BANNER ═══ -->\n*/g, '');
    html = html.replace(/<!-- ═══ CLAIM MODAL ═══ -->[\s\S]*?<!-- ═══ \/CLAIM MODAL ═══ -->\n*/g, '');

    // Remove old CSS — match everything from CLAIM PROFILE BANNER comment to its closing @media block
    html = html.replace(/\n\s*\/\* ═══ CLAIM PROFILE BANNER ═══ \*\/[\s\S]*?\.claim-modal-row \{ grid-template-columns: 1fr; \}\s*\}/g, '');
    // Also remove CLAIM MODAL CSS block
    html = html.replace(/\n\s*\/\* ═══ CLAIM MODAL ═══ \*\/[\s\S]*?\.claim-modal-row \{ grid-template-columns: 1fr; \}\s*\}/g, '');
    // Clean any orphaned claim-modal lines between CS and Claim sections
    html = html.replace(/(\.cs-quote \{ padding: 14px 16px; \} \})\s+\.claim-modal \{[^}]+\}\s+\.claim-modal-row \{[^}]+\}\s+\}/g, '$1');

    const bannerHtml = `<!-- ═══ CLAIM BANNER ═══ -->
<div class="claim-banner">
    <div class="claim-banner-text">
        <div class="claim-banner-title"><span class="badge">Free</span> Work at ${escHtml(name)}? Claim this profile</div>
        <div class="claim-banner-desc">Update your company's culture data, respond to reviews, and feature your open roles prominently.</div>
    </div>
    <button class="claim-banner-btn" onclick="document.getElementById('claimOverlay${fid}').classList.add('open')">Claim Profile &rarr;</button>
</div>
<!-- ═══ /CLAIM BANNER ═══ -->

`;

    const modalHtml = `<!-- ═══ CLAIM MODAL ═══ -->
<div class="claim-overlay" id="claimOverlay${fid}" onclick="if(event.target===this)this.classList.remove('open')">
    <div class="claim-modal">
        <button class="claim-modal-close" onclick="this.closest('.claim-overlay').classList.remove('open')">&times;</button>
        <div id="claimFormWrap${fid}">
            <div class="claim-modal-icon">🏢</div>
            <h3>Claim <em>${escHtml(name)}</em></h3>
            <p class="claim-modal-sub">Take ownership of your company's culture profile. Update your data, respond to community sentiment, and feature your open roles to candidates who care about culture.</p>
            <form class="claim-modal-form" onsubmit="event.preventDefault();var f=this;var w=document.getElementById('claimFormWrap${fid}');var s=document.getElementById('claimSuccess${fid}');fetch('https://formspree.io/f/${FORMSPREE_ID}',{method:'POST',body:new FormData(f),headers:{'Accept':'application/json'}}).then(function(){w.style.display='none';s.style.display='block';}).catch(function(){w.style.display='none';s.style.display='block';});">
                <input type="hidden" name="_subject" value="Profile Claim: ${escHtml(name)}">
                <input type="hidden" name="company" value="${escHtml(name)}">
                <input type="hidden" name="profile_url" value="https://jobsbyculture.com/companies/${slug}">
                <div class="claim-modal-row">
                    <input type="text" name="name" placeholder="Your name" required>
                    <input type="email" name="email" placeholder="Work email" required>
                </div>
                <input type="text" name="role" placeholder="Your role (e.g., Head of Talent, HR Director)">
                <select name="interest" required>
                    <option value="" disabled selected>What are you interested in?</option>
                    <option value="claim">Claim &amp; update our profile</option>
                    <option value="feature-jobs">Feature our open roles</option>
                    <option value="respond-reviews">Respond to community sentiment</option>
                    <option value="employer-brand">Employer branding partnership</option>
                    <option value="other">Something else</option>
                </select>
                <button type="submit" class="claim-modal-submit">Submit Request &rarr;</button>
            </form>
            <p class="claim-modal-footer">We'll respond within 24 hours. No spam, ever.</p>
        </div>
        <div class="claim-modal-success" id="claimSuccess${fid}">
            <div class="check">&#10003;</div>
            <h3>Request received!</h3>
            <p>We'll review your request and get back to you within 24 hours at the email you provided.</p>
        </div>
    </div>
</div>
<!-- ═══ /CLAIM MODAL ═══ -->
`;

    // Inject CSS
    if (!html.includes('claim-banner {')) {
        html = html.replace('</style>', CLAIM_CSS + '\n    </style>');
    }

    // Inject banner after hero
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

    // Inject modal before </body>
    html = html.replace('</body>', modalHtml + '\n</body>');

    fs.writeFileSync(fp, html);
    count++;
    console.log(`Updated: ${file} (${name})`);
}

console.log(`\n✓ Added Claim Profile banner + modal to ${count} company pages`);
