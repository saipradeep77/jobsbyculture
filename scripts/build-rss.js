import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BLOG_DIR = path.join(__dirname, '..', 'blog');
const OUTPUT = path.join(__dirname, '..', 'feed.xml');
const SITE = 'https://jobsbyculture.com';

const files = fs.readdirSync(BLOG_DIR)
  .filter(f => f.endsWith('.html') && f !== 'index.html');

function escXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function decodeHtmlEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&mdash;/g, '—').replace(/&ndash;/g, '–');
}

function toRfc822(d) {
  return new Date(d).toUTCString();
}

const posts = files.map(file => {
  const html = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8');
  const stat = fs.statSync(path.join(BLOG_DIR, file));

  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/);

  const rawTitle = titleMatch ? decodeHtmlEntities(titleMatch[1]) : file.replace('.html', '');
  const title = rawTitle.replace(/\s*\|\s*JobsByCulture$/, '');
  const description = descMatch ? decodeHtmlEntities(descMatch[1]) : '';
  const slug = file.replace('.html', '');
  const link = `${SITE}/blog/${slug}`;
  const pubDate = stat.mtime;

  // ScreenshotOne API for blog post screenshot
  const screenshotParams = new URLSearchParams({
    access_key: '1Z7jgqp5isxeVw',
    url: link,
    format: 'jpg',
    block_ads: 'true',
    block_cookie_banners: 'true',
    block_trackers: 'true',
    delay: '0',
    timeout: '60',
    response_type: 'by_format',
    image_quality: '80',
    viewport_width: '1200',
    viewport_height: '630',
    cache: 'true',
    cache_ttl: '86400',
  });
  const ogImage = `https://api.screenshotone.com/take?${screenshotParams.toString()}`;

  return { title, description, link, pubDate, slug, ogImage };
}).sort((a, b) => b.pubDate - a.pubDate);

const items = posts.map(p => `    <item>
      <title>${escXml(p.title)}</title>
      <link>${p.link}</link>
      <description>${escXml(p.description)}</description>
      <enclosure url="${escXml(p.ogImage)}" type="image/jpeg" length="0"/>
      <media:content url="${escXml(p.ogImage)}" type="image/jpeg" medium="image" width="1200" height="630"/>
      <pubDate>${toRfc822(p.pubDate)}</pubDate>
      <guid isPermaLink="true">${p.link}</guid>
    </item>`).join('\n');

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>JobsByCulture — The Culture Report</title>
    <link>${SITE}/blog</link>
    <description>Data-driven insights on AI company culture, work-life balance, and what it's actually like to work at top tech companies.</description>
    <language>en-us</language>
    <lastBuildDate>${toRfc822(new Date())}</lastBuildDate>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;

fs.writeFileSync(OUTPUT, rss);
console.log(`✓ Generated RSS feed with ${posts.length} posts → feed.xml`);
