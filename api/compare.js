import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// In-memory rate limiting: 10 requests/min per IP
const rateLimitMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000;

// In-memory cache: 24hr TTL, keyed by sorted company pair
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;

const VALID_VALUES = [
  'wlb','remote','flex-hours','async','deep-work','transparent','flat',
  'diverse','psych-safety','eng-driven','ship-fast','open-source',
  'learning','equity','product-impact','many-hats','ethical-ai','social-impact'
];

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.socket?.remoteAddress ||
         'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }
  const timestamps = rateLimitMap.get(ip).filter(t => now - t < RATE_WINDOW);
  rateLimitMap.set(ip, timestamps);
  if (timestamps.length >= RATE_LIMIT) {
    return false;
  }
  timestamps.push(now);
  return true;
}

function getCacheKey(a, b) {
  return [a, b].sort().join('::');
}

function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

async function fetchCompanyData(name) {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are a company culture analyst. Given the company "${name}", return a JSON object with your best knowledge of their culture. Use ONLY these exact value slugs for the "values" array (pick 3-6 that fit best):
wlb, remote, flex-hours, async, deep-work, transparent, flat, diverse, psych-safety, eng-driven, ship-fast, open-source, learning, equity, product-impact, many-hats, ethical-ai, social-impact

Return ONLY valid JSON, no markdown, no explanation:
{
  "name": "Official Company Name",
  "size": "Small (~50)" or "Mid (~500)" or "Large (~5,000)" etc,
  "glassdoor": 4.0,
  "wlb_score": 3.5,
  "values": ["eng-driven", "learning", ...],
  "pros": ["One sentence pro", "Another sentence pro"],
  "cons": ["One sentence con", "Another sentence con"],
  "careers": "https://company.com/careers"
}`
    }]
  });

  const text = response.content[0].text.trim();
  const data = JSON.parse(text);

  // Validate and sanitize
  data.values = (data.values || []).filter(v => VALID_VALUES.includes(v)).slice(0, 6);
  data.pros = (data.pros || []).slice(0, 2);
  data.cons = (data.cons || []).slice(0, 2);
  data.glassdoor = Math.max(1, Math.min(5, Number(data.glassdoor) || 3.5));
  data.wlb_score = Math.max(1, Math.min(5, Number(data.wlb_score) || 3.5));
  data.ai_generated = true;
  data.logo = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(data.careers?.replace(/https?:\/\/([^/]+).*/, '$1') || name.toLowerCase().replace(/\s+/g, '') + '.com')}&sz=128`;

  return data;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit
  const ip = getClientIP(req);
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a minute before trying again.' });
  }

  const { companyA, companyB } = req.body || {};

  if (!companyA?.name && !companyA?.data) {
    return res.status(400).json({ error: 'companyA is required' });
  }
  if (!companyB?.name && !companyB?.data) {
    return res.status(400).json({ error: 'companyB is required' });
  }

  // Check cache
  const keyA = companyA.data ? companyA.data.name : companyA.name;
  const keyB = companyB.data ? companyB.data.name : companyB.name;
  const cacheKey = getCacheKey(keyA, keyB);
  const cached = getFromCache(cacheKey);
  if (cached) {
    return res.status(200).json(cached);
  }

  try {
    // Resolve both companies in parallel
    const [dataA, dataB] = await Promise.all([
      companyA.data ? Promise.resolve(companyA.data) : fetchCompanyData(companyA.name),
      companyB.data ? Promise.resolve(companyB.data) : fetchCompanyData(companyB.name),
    ]);

    const result = { companyA: dataA, companyB: dataB };

    // Cache result
    cache.set(cacheKey, { data: result, ts: Date.now() });

    return res.status(200).json(result);
  } catch (err) {
    console.error('Compare API error:', err);
    return res.status(500).json({ error: 'Failed to analyze company cultures. Please try again.' });
  }
}
