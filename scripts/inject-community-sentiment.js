import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const COMPANIES_DIR = path.join(ROOT, 'companies');

const sentiment = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/community-sentiment.json'), 'utf8'));

const SENTIMENT_CSS = `
        /* ═══ COMMUNITY SENTIMENT ═══ */
        .cs-section { padding: 56px 0; border-top: 1px solid var(--border); }
        .cs-overall { display: flex; align-items: center; gap: 16px; margin-bottom: 28px; }
        .cs-badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 18px; border-radius: var(--radius-full); font-size: 14px; font-weight: 700; }
        .cs-badge.positive { background: rgba(22,163,74,0.08); color: #16a34a; border: 1.5px solid rgba(22,163,74,0.2); }
        .cs-badge.negative { background: rgba(220,38,38,0.08); color: #dc2626; border: 1.5px solid rgba(220,38,38,0.2); }
        .cs-badge.mixed { background: rgba(217,119,6,0.08); color: #d97706; border: 1.5px solid rgba(217,119,6,0.2); }
        .cs-badge.neutral { background: rgba(156,163,175,0.08); color: #6b7280; border: 1.5px solid rgba(156,163,175,0.2); }
        .cs-stats { font-size: 13px; color: var(--text-3); }
        .cs-quotes { display: flex; flex-direction: column; gap: 16px; }
        .cs-quote { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px 22px; }
        .cs-quote-text { font-size: 15px; color: var(--text-2); line-height: 1.7; margin-bottom: 10px; font-style: italic; }
        .cs-quote-meta { display: flex; align-items: center; gap: 12px; font-size: 12px; color: var(--text-3); }
        .cs-quote-source { font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
        .cs-quote-source.hn { color: #ff6600; }
        .cs-quote-source.reddit { color: #ff4500; }
        .cs-quote-link { color: var(--accent); text-decoration: none; font-size: 12px; font-weight: 500; }
        .cs-quote-link:hover { text-decoration: underline; }
        .cs-updated { font-size: 12px; color: var(--text-3); margin-top: 20px; font-style: italic; }
        .cs-tabs { display: flex; gap: 8px; margin-bottom: 20px; }
        .cs-tab { padding: 6px 16px; border-radius: var(--radius-full); font-size: 13px; font-weight: 600; cursor: pointer; border: 1.5px solid var(--border); background: transparent; color: var(--text-2); font-family: var(--font-body); }
        .cs-tab.active { border-color: var(--accent); color: var(--accent); background: var(--accent-bg); }
        .cs-tab:hover { border-color: var(--accent); }
        @media (max-width: 768px) { .cs-quotes { gap: 12px; } .cs-quote { padding: 14px 16px; } }
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

    const data = sentiment[slug];
    if (!data || data.totalMentions === 0) {
        console.log(`SKIP (no data): ${file}`);
        continue;
    }

    // Remove existing sentiment section
    html = html.replace(/<!-- ═══ COMMUNITY SENTIMENT ═══ -->[\s\S]*?<!-- ═══ \/COMMUNITY SENTIMENT ═══ -->/, '');

    // Build the section
    const allQuotes = [...(data.hackernews || []), ...(data.reddit || [])];
    if (allQuotes.length === 0) {
        console.log(`SKIP (no quotes): ${file}`);
        continue;
    }

    let sectionHtml = '<!-- ═══ COMMUNITY SENTIMENT ═══ -->\n';
    sectionHtml += '<section class="cs-section">\n';
    sectionHtml += '    <div class="container">\n';
    sectionHtml += '        <span class="s-label">Community Sentiment</span>\n';
    sectionHtml += `        <h2 class="s-title">What the <em>community</em> says about ${escHtml(data.name)}</h2>\n`;
    sectionHtml += `        <div class="cs-overall">\n`;
    sectionHtml += `            <span class="cs-badge ${data.overallSentiment}">${data.overallSentiment === 'positive' ? 'Mostly Positive' : data.overallSentiment === 'negative' ? 'Mostly Negative' : data.overallSentiment === 'mixed' ? 'Mixed Sentiment' : 'Neutral'}</span>\n`;
    sectionHtml += `            <span class="cs-stats">${data.totalMentions} mentions from Hacker News &amp; Reddit &middot; Updated ${data.lastUpdated}</span>\n`;
    sectionHtml += `        </div>\n`;

    // Tabs
    const hasHN = data.hackernews && data.hackernews.length > 0;
    const hasReddit = data.reddit && data.reddit.length > 0;

    if (hasHN && hasReddit) {
        sectionHtml += `        <div class="cs-tabs">\n`;
        sectionHtml += `            <button class="cs-tab active" onclick="showSentiment('all',this)">All</button>\n`;
        sectionHtml += `            <button class="cs-tab" onclick="showSentiment('hn',this)">Hacker News</button>\n`;
        sectionHtml += `            <button class="cs-tab" onclick="showSentiment('reddit',this)">Reddit</button>\n`;
        sectionHtml += `        </div>\n`;
    }

    sectionHtml += `        <div class="cs-quotes" id="csQuotes">\n`;

    // HN quotes
    for (const q of (data.hackernews || []).slice(0, 4)) {
        sectionHtml += `            <div class="cs-quote" data-source="hn">\n`;
        sectionHtml += `                <div class="cs-quote-text">&ldquo;${escHtml(q.quote)}&rdquo;</div>\n`;
        sectionHtml += `                <div class="cs-quote-meta">\n`;
        sectionHtml += `                    <span class="cs-quote-source hn">Hacker News</span>\n`;
        sectionHtml += `                    <span>${q.author || 'anonymous'} &middot; ${q.date || ''}</span>\n`;
        sectionHtml += `                    <a href="${escHtml(q.url)}" target="_blank" rel="noopener" class="cs-quote-link">View thread &rarr;</a>\n`;
        sectionHtml += `                </div>\n`;
        sectionHtml += `            </div>\n`;
    }

    // Reddit quotes
    for (const q of (data.reddit || []).slice(0, 3)) {
        sectionHtml += `            <div class="cs-quote" data-source="reddit">\n`;
        sectionHtml += `                <div class="cs-quote-text">&ldquo;${escHtml(q.quote)}&rdquo;</div>\n`;
        sectionHtml += `                <div class="cs-quote-meta">\n`;
        sectionHtml += `                    <span class="cs-quote-source reddit">Reddit</span>\n`;
        sectionHtml += `                    <span>r/${escHtml(q.subreddit || '')} &middot; ${q.score || 0} upvotes &middot; ${q.date || ''}</span>\n`;
        sectionHtml += `                    <a href="${escHtml(q.url)}" target="_blank" rel="noopener" class="cs-quote-link">View thread &rarr;</a>\n`;
        sectionHtml += `                </div>\n`;
        sectionHtml += `            </div>\n`;
    }

    sectionHtml += `        </div>\n`;
    sectionHtml += `        <p class="cs-updated">Sentiment data refreshed daily from public Hacker News and Reddit discussions. <a href="/directory" style="color:var(--accent);text-decoration:none;">See all company profiles &rarr;</a></p>\n`;
    sectionHtml += `    </div>\n`;
    sectionHtml += '</section>\n';
    sectionHtml += '<!-- ═══ /COMMUNITY SENTIMENT ═══ -->\n\n';

    // Add tab switching script
    const tabScript = `
<script>
function showSentiment(src, btn) {
    var quotes = document.querySelectorAll('#csQuotes .cs-quote');
    quotes.forEach(function(q) {
        if (src === 'all') q.style.display = 'block';
        else if (src === 'hn') q.style.display = q.getAttribute('data-source') === 'hn' ? 'block' : 'none';
        else if (src === 'reddit') q.style.display = q.getAttribute('data-source') === 'reddit' ? 'block' : 'none';
    });
    document.querySelectorAll('.cs-tab').forEach(function(t) { t.classList.remove('active'); });
    btn.classList.add('active');
}
</script>`;

    // Inject CSS
    if (!html.includes('cs-section')) {
        html = html.replace('</style>', SENTIMENT_CSS + '\n    </style>');
    }

    // Inject before the Related section or Footer
    if (html.includes('<!-- ═══ RELATED ═══ -->')) {
        html = html.replace('<!-- ═══ RELATED ═══ -->', sectionHtml + '<!-- ═══ RELATED ═══ -->');
    } else if (html.includes('<!-- ═══ FOOTER ═══ -->')) {
        html = html.replace('<!-- ═══ FOOTER ═══ -->', sectionHtml + '<!-- ═══ FOOTER ═══ -->');
    } else if (html.includes('<!-- FOOTER -->')) {
        html = html.replace('<!-- FOOTER -->', sectionHtml + '<!-- FOOTER -->');
    } else {
        html = html.replace('<footer', sectionHtml + '<footer');
    }

    // Add tab script before </body>
    if (!html.includes('showSentiment')) {
        html = html.replace('</body>', tabScript + '\n</body>');
    }

    fs.writeFileSync(fp, html);
    count++;
    console.log(`Updated: ${file} (${data.hackernews?.length || 0} HN, ${data.reddit?.length || 0} Reddit, ${data.overallSentiment})`);
}

console.log(`\n✓ Added Community Sentiment to ${count} company pages`);
