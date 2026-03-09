import { ImageResponse } from '@vercel/og';

// Bundled at deploy time
import ogData from '../data/og-data.json';

export const config = { runtime: 'edge' };

// Helper: create element objects for Satori (no JSX)
function h(type, props, ...children) {
  const flatChildren = children.flat().filter(c => c != null && c !== false);
  return { type, props: { ...props, children: flatChildren.length === 1 ? flatChildren[0] : flatChildren.length === 0 ? undefined : flatChildren } };
}

// Value slug → display name
const VALUE_NAMES = {
  'wlb': 'Work-Life Balance', 'remote': 'Remote-Friendly', 'flex-hours': 'Flexible Hours',
  'async': 'Async-First', 'deep-work': 'Deep Work', 'transparent': 'Transparent',
  'flat': 'Flat Hierarchy', 'diverse': 'Diverse & Inclusive', 'psych-safety': 'Psychological Safety',
  'eng-driven': 'Engineering-Driven', 'ship-fast': 'Ship Fast', 'open-source': 'Open Source',
  'learning': 'Learning & Growth', 'equity': 'Strong Comp & Equity', 'product-impact': 'Product Impact',
  'many-hats': 'Wears Many Hats', 'ethical-ai': 'Ethical AI', 'social-impact': 'Mission-Driven'
};

// Shared styles
const BG = '#0a0a0b';
const ORANGE = '#f97316';
const WHITE = '#ffffff';
const GRAY = '#a1a1aa';
const DARK_CARD = '#18181b';

function brandBar() {
  return h('div', { style: { display: 'flex', alignItems: 'center', marginBottom: 32 } },
    h('div', { style: { width: 12, height: 40, background: ORANGE, borderRadius: 4, marginRight: 16 } }),
    h('div', { style: { fontSize: 28, color: GRAY, fontWeight: 700 } }, 'JobsByCulture')
  );
}

function statsRow(text) {
  return h('div', { style: { display: 'flex', fontSize: 22, color: GRAY, marginTop: 'auto' } }, text);
}

// --- Page Renderers ---

function renderHome() {
  return h('div', { style: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: 60, background: BG, color: WHITE, fontFamily: 'Inter' } },
    brandBar(),
    h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' } },
      h('div', { style: { fontSize: 52, fontWeight: 700, lineHeight: 1.2, marginBottom: 20 } }, 'Find Tech Jobs That Match Your Culture'),
      h('div', { style: { fontSize: 28, color: GRAY, lineHeight: 1.4 } }, 'Jobs filtered by work-life balance, remote culture, engineering values & more')
    ),
    statsRow(`${ogData.totalJobs.toLocaleString()} jobs  •  ${ogData.companyCount} companies profiled`)
  );
}

function renderJobs() {
  return h('div', { style: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: 60, background: BG, color: WHITE, fontFamily: 'Inter' } },
    brandBar(),
    h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' } },
      h('div', { style: { fontSize: 52, fontWeight: 700, lineHeight: 1.2, marginBottom: 20 } }, `${ogData.totalJobs.toLocaleString()} AI & Tech Jobs`),
      h('div', { style: { fontSize: 28, color: GRAY, lineHeight: 1.4 } }, 'Filtered by culture, values, and work style')
    ),
    statsRow(`From ${ogData.companyCount} vetted companies  •  Updated daily`)
  );
}

function renderCompany(slug) {
  const co = ogData.companies[slug];
  if (!co) return renderHome();
  const valTags = (co.values || []).slice(0, 3).map(v => VALUE_NAMES[v] || v);
  return h('div', { style: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: 60, background: BG, color: WHITE, fontFamily: 'Inter' } },
    brandBar(),
    h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' } },
      h('div', { style: { fontSize: 52, fontWeight: 700, lineHeight: 1.2, marginBottom: 16 } }, co.name),
      h('div', { style: { display: 'flex', alignItems: 'center', marginBottom: 24 } },
        h('div', { style: { fontSize: 36, fontWeight: 700, color: ORANGE, marginRight: 12 } }, `${co.glassdoor}`),
        h('div', { style: { fontSize: 24, color: GRAY } }, `Glassdoor  •  ${co.jobCount} open jobs`)
      ),
      h('div', { style: { display: 'flex', gap: 12 } },
        ...valTags.map(tag =>
          h('div', { style: { background: DARK_CARD, color: WHITE, padding: '8px 20px', borderRadius: 20, fontSize: 20 } }, tag)
        )
      )
    ),
    statsRow('Culture Profile  •  jobsbyculture.com')
  );
}

function renderCompare(slugA, slugB) {
  const a = ogData.companies[slugA];
  const b = ogData.companies[slugB];
  if (!a || !b) return renderHome();
  return h('div', { style: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: 60, background: BG, color: WHITE, fontFamily: 'Inter' } },
    brandBar(),
    h('div', { style: { display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', gap: 40 } },
      h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', background: DARK_CARD, borderRadius: 16, padding: '40px 48px' } },
        h('div', { style: { fontSize: 36, fontWeight: 700, marginBottom: 8 } }, a.name),
        h('div', { style: { fontSize: 48, fontWeight: 700, color: ORANGE } }, `${a.glassdoor}`)
      ),
      h('div', { style: { fontSize: 36, color: GRAY, fontWeight: 700 } }, 'vs'),
      h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', background: DARK_CARD, borderRadius: 16, padding: '40px 48px' } },
        h('div', { style: { fontSize: 36, fontWeight: 700, marginBottom: 8 } }, b.name),
        h('div', { style: { fontSize: 48, fontWeight: 700, color: ORANGE } }, `${b.glassdoor}`)
      )
    ),
    statsRow('Culture Comparison  •  jobsbyculture.com')
  );
}

function renderValue(slug) {
  const val = ogData.values[slug];
  if (!val) return renderHome();
  return h('div', { style: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: 60, background: BG, color: WHITE, fontFamily: 'Inter' } },
    brandBar(),
    h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' } },
      h('div', { style: { fontSize: 52, fontWeight: 700, lineHeight: 1.2, marginBottom: 16 } }, `${val.name} Jobs`),
      h('div', { style: { fontSize: 28, color: GRAY, lineHeight: 1.4 } }, `${val.jobCount.toLocaleString()} jobs from ${val.companyCount} companies with ${val.name.toLowerCase()} culture`)
    ),
    statsRow('Browse by culture value  •  jobsbyculture.com')
  );
}

function renderRole(slug) {
  const role = ogData.roles[slug];
  if (!role) return renderHome();
  return h('div', { style: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: 60, background: BG, color: WHITE, fontFamily: 'Inter' } },
    brandBar(),
    h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' } },
      h('div', { style: { fontSize: 52, fontWeight: 700, lineHeight: 1.2, marginBottom: 16 } }, `${role.name} Jobs`),
      h('div', { style: { fontSize: 28, color: GRAY, lineHeight: 1.4 } }, `${role.jobCount.toLocaleString()} ${role.name.toLowerCase()} jobs at culture-first companies`)
    ),
    statsRow(`From ${ogData.companyCount} companies  •  jobsbyculture.com`)
  );
}

function renderDirectory() {
  return h('div', { style: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: 60, background: BG, color: WHITE, fontFamily: 'Inter' } },
    brandBar(),
    h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' } },
      h('div', { style: { fontSize: 52, fontWeight: 700, lineHeight: 1.2, marginBottom: 16 } }, 'Culture Directory'),
      h('div', { style: { fontSize: 28, color: GRAY, lineHeight: 1.4 } }, `${ogData.companyCount} AI & tech companies profiled by culture, values, and Glassdoor ratings`)
    ),
    statsRow(`${ogData.totalJobs.toLocaleString()} total jobs  •  jobsbyculture.com`)
  );
}

function renderCompareTool() {
  return h('div', { style: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: 60, background: BG, color: WHITE, fontFamily: 'Inter' } },
    brandBar(),
    h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' } },
      h('div', { style: { fontSize: 52, fontWeight: 700, lineHeight: 1.2, marginBottom: 16 } }, 'Compare Company Cultures'),
      h('div', { style: { fontSize: 28, color: GRAY, lineHeight: 1.4 } }, 'Side-by-side comparison of Glassdoor ratings, values, and work culture')
    ),
    statsRow(`${ogData.companyCount} companies to compare  •  jobsbyculture.com`)
  );
}

// --- Main Handler ---

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'home';
  const slug = searchParams.get('slug') || '';
  const a = searchParams.get('a') || '';
  const b = searchParams.get('b') || '';

  let element;
  switch (type) {
    case 'jobs': element = renderJobs(); break;
    case 'company': element = renderCompany(slug); break;
    case 'compare': element = renderCompare(a, b); break;
    case 'value': element = renderValue(slug); break;
    case 'role': element = renderRole(slug); break;
    case 'directory': element = renderDirectory(); break;
    case 'compare-tool': element = renderCompareTool(); break;
    default: element = renderHome();
  }

  return new ImageResponse(element, {
    width: 1200,
    height: 630,
    headers: {
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
