import { ImageResponse } from '@vercel/og';
import ogData from '../data/og-data.json';

export const config = { runtime: 'edge' };

// Fonts — bundled into the edge function at deploy time
const interBoldData = fetch(
  new URL('./fonts/Inter-Bold.woff', import.meta.url)
).then(res => res.arrayBuffer());

const interRegularData = fetch(
  new URL('./fonts/Inter-Regular.woff', import.meta.url)
).then(res => res.arrayBuffer());

// --- Helpers ---
function h(type, props, ...children) {
  const flat = children.flat(Infinity).filter(c => c != null && c !== false && c !== '');
  return {
    type,
    props: { ...props, children: flat.length === 0 ? undefined : flat.length === 1 ? flat[0] : flat },
  };
}

function hexToRgba(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// --- Design Tokens (matching site) ---
const BG = '#fafaf8';
const WHITE = '#ffffff';
const TEXT = '#1a1a1f';
const TEXT_SEC = '#52525b';
const TEXT_MUTED = '#9ca3af';
const ORANGE = '#e8590c';
const TEAL = '#0d9488';
const ROSE = '#e11d48';
const SKY = '#0284c7';
const VIOLET = '#7c3aed';
const LIME = '#4d7c0f';
const AMBER = '#d97706';

const VALUE_NAMES = {
  'wlb': 'Work-Life Balance', 'remote': 'Remote-Friendly', 'flex-hours': 'Flexible Hours',
  'async': 'Async-First', 'deep-work': 'Deep Work', 'transparent': 'Transparent',
  'flat': 'Flat Hierarchy', 'diverse': 'Diverse & Inclusive', 'psych-safety': 'Psychological Safety',
  'eng-driven': 'Engineering-Driven', 'ship-fast': 'Ship Fast', 'open-source': 'Open Source',
  'learning': 'Learning & Growth', 'equity': 'Strong Comp & Equity', 'product-impact': 'Product Impact',
  'many-hats': 'Wears Many Hats', 'ethical-ai': 'Ethical AI', 'social-impact': 'Mission-Driven',
};

const VALUE_COLORS = {
  'wlb': TEAL, 'remote': SKY, 'flex-hours': VIOLET, 'async': LIME, 'deep-work': VIOLET,
  'transparent': TEAL, 'flat': LIME, 'diverse': ROSE, 'psych-safety': TEAL,
  'eng-driven': ORANGE, 'ship-fast': ORANGE, 'open-source': LIME,
  'learning': SKY, 'equity': TEAL, 'product-impact': ORANGE,
  'many-hats': VIOLET, 'ethical-ai': TEAL, 'social-impact': ROSE,
};

function ratingColor(r) {
  return r >= 4.0 ? TEAL : r >= 3.0 ? AMBER : ROSE;
}

// --- Shared Components ---

function wrapper(...children) {
  return h('div', {
    style: {
      display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
      background: BG, position: 'relative', overflow: 'hidden', fontFamily: 'Inter',
    }
  },
    // Top gradient bar
    h('div', { style: {
      width: '100%', height: 5, flexShrink: 0,
      background: 'linear-gradient(90deg, #e8590c, #0d9488)',
    }}),
    // Background glow — warm orange, top-right
    h('div', { style: {
      position: 'absolute', top: -180, right: -120,
      width: 550, height: 550, borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(232,89,12,0.07) 0%, transparent 70%)',
    }}),
    // Background glow — teal, bottom-left
    h('div', { style: {
      position: 'absolute', bottom: -200, left: -80,
      width: 420, height: 420, borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(13,148,136,0.05) 0%, transparent 70%)',
    }}),
    // Content
    h('div', { style: {
      display: 'flex', flexDirection: 'column', flex: 1,
      padding: '36px 60px 32px', position: 'relative',
    }}, ...children)
  );
}

function brand(subtitle) {
  return h('div', { style: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20,
  }},
    h('div', { style: { display: 'flex', alignItems: 'center' } },
      h('div', { style: {
        width: 14, height: 14, borderRadius: '50%', background: ORANGE, marginRight: 10,
      }}),
      h('div', { style: { fontSize: 22, fontWeight: 700, color: TEXT_SEC } }, 'JobsByCulture')
    ),
    subtitle
      ? h('div', { style: {
          fontSize: 15, color: TEXT_MUTED, fontWeight: 400,
          background: hexToRgba(ORANGE, 0.06), border: `1px solid ${hexToRgba(ORANGE, 0.15)}`,
          borderRadius: 100, padding: '5px 16px',
        }}, subtitle)
      : null
  );
}

function footer(text) {
  return h('div', { style: {
    display: 'flex', alignItems: 'center', marginTop: 'auto',
    paddingTop: 16,
  }},
    h('div', { style: {
      width: '100%', height: 1,
      background: 'linear-gradient(90deg, rgba(0,0,0,0.06), rgba(0,0,0,0.02))',
      position: 'absolute', left: 60, right: 60, bottom: 52,
    }}),
    h('div', { style: { fontSize: 15, color: TEXT_MUTED, fontWeight: 400 } },
      text || 'jobsbyculture.com'
    )
  );
}

function valuePill(slug) {
  const c = VALUE_COLORS[slug] || ORANGE;
  const name = VALUE_NAMES[slug] || slug;
  return h('div', { style: {
    display: 'flex', alignItems: 'center',
    background: hexToRgba(c, 0.08), border: `1.5px solid ${hexToRgba(c, 0.22)}`,
    color: c, borderRadius: 100, padding: '7px 18px', fontSize: 16, fontWeight: 700,
  }}, name);
}

function statBox(value, label, color) {
  return h('div', { style: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: WHITE, border: '1px solid rgba(0,0,0,0.07)',
    borderRadius: 16, padding: '20px 32px', minWidth: 140,
  }},
    h('div', { style: { fontSize: 38, fontWeight: 700, color: color || ORANGE } }, value),
    h('div', { style: { fontSize: 14, color: TEXT_MUTED, fontWeight: 400, marginTop: 2 } }, label)
  );
}

// --- Page Renderers ---

function renderHome() {
  const pills = ['remote', 'eng-driven', 'ship-fast', 'wlb', 'ethical-ai'];
  return wrapper(
    brand(),
    h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' } },
      h('div', { style: {
        fontSize: 54, fontWeight: 700, color: TEXT, lineHeight: 1.12, marginBottom: 20,
      }}, 'Find Tech Jobs That Match Your Culture'),
      h('div', { style: {
        fontSize: 22, color: TEXT_SEC, lineHeight: 1.5, marginBottom: 32, fontWeight: 400,
      }}, `${ogData.totalJobs.toLocaleString()} jobs at ${ogData.companyCount} culture-vetted companies`),
      h('div', { style: { display: 'flex', gap: 10, flexWrap: 'wrap' } },
        ...pills.map(v => valuePill(v))
      )
    ),
    footer()
  );
}

function renderJobs() {
  return wrapper(
    brand(),
    h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' } },
      h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 8 } },
        h('div', { style: { fontSize: 72, fontWeight: 700, color: ORANGE, lineHeight: 1 } },
          ogData.totalJobs.toLocaleString()
        ),
        h('div', { style: { fontSize: 36, fontWeight: 700, color: TEXT } }, 'Jobs')
      ),
      h('div', { style: {
        fontSize: 26, color: TEXT_SEC, fontWeight: 400, marginBottom: 32,
      }}, 'AI & tech roles filtered by culture, values & work style'),
      h('div', { style: { display: 'flex', gap: 16 } },
        statBox(ogData.companyCount.toString(), 'Companies', TEAL),
        statBox('18', 'Culture Values', VIOLET),
        statBox('12', 'Role Types', SKY)
      )
    ),
    footer()
  );
}

function renderCompany(slug) {
  const co = ogData.companies[slug];
  if (!co) return renderHome();
  const rc = ratingColor(co.glassdoor);
  return wrapper(
    brand('Culture Profile'),
    h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' } },
      h('div', { style: {
        fontSize: 50, fontWeight: 700, color: TEXT, lineHeight: 1.12, marginBottom: 24,
      }}, co.name),
      // Rating + jobs row
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 } },
        // Rating badge
        h('div', { style: {
          display: 'flex', alignItems: 'center', gap: 12,
          background: hexToRgba(rc, 0.08), border: `1.5px solid ${hexToRgba(rc, 0.2)}`,
          borderRadius: 14, padding: '12px 22px',
        }},
          h('div', { style: { fontSize: 40, fontWeight: 700, color: rc, lineHeight: 1 } },
            co.glassdoor.toFixed(1)
          ),
          h('div', { style: { display: 'flex', flexDirection: 'column' } },
            h('div', { style: { fontSize: 14, color: TEXT_MUTED, fontWeight: 400 } }, 'Glassdoor'),
            h('div', { style: { fontSize: 14, color: TEXT_MUTED, fontWeight: 400 } }, 'Rating')
          )
        ),
        // Job count
        h('div', { style: {
          display: 'flex', alignItems: 'center', gap: 12,
          background: WHITE, border: '1px solid rgba(0,0,0,0.07)',
          borderRadius: 14, padding: '12px 22px',
        }},
          h('div', { style: { fontSize: 40, fontWeight: 700, color: TEXT, lineHeight: 1 } },
            co.jobCount.toString()
          ),
          h('div', { style: { display: 'flex', flexDirection: 'column' } },
            h('div', { style: { fontSize: 14, color: TEXT_MUTED, fontWeight: 400 } }, 'Open'),
            h('div', { style: { fontSize: 14, color: TEXT_MUTED, fontWeight: 400 } }, 'Jobs')
          )
        )
      ),
      // Value pills
      h('div', { style: { display: 'flex', gap: 10, flexWrap: 'wrap' } },
        ...(co.values || []).slice(0, 4).map(v => valuePill(v))
      )
    ),
    footer()
  );
}

function renderCompare(slugA, slugB) {
  const a = ogData.companies[slugA];
  const b = ogData.companies[slugB];
  if (!a || !b) return renderHome();

  function card(co) {
    const rc = ratingColor(co.glassdoor);
    return h('div', { style: {
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: WHITE, border: '1px solid rgba(0,0,0,0.07)',
      borderRadius: 20, padding: '32px 40px', flex: 1,
    }},
      h('div', { style: { fontSize: 28, fontWeight: 700, color: TEXT, marginBottom: 16 } }, co.name),
      h('div', { style: {
        fontSize: 52, fontWeight: 700, color: rc, lineHeight: 1, marginBottom: 8,
      }}, co.glassdoor.toFixed(1)),
      h('div', { style: { fontSize: 15, color: TEXT_MUTED, fontWeight: 400, marginBottom: 16 } },
        `${co.jobCount} open jobs`
      ),
      h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' } },
        ...(co.values || []).slice(0, 2).map(v => {
          const c = VALUE_COLORS[v] || ORANGE;
          return h('div', { style: {
            background: hexToRgba(c, 0.08), border: `1px solid ${hexToRgba(c, 0.2)}`,
            color: c, borderRadius: 100, padding: '4px 12px', fontSize: 13, fontWeight: 700,
          }}, VALUE_NAMES[v] || v);
        })
      )
    );
  }

  return wrapper(
    brand('Culture Comparison'),
    h('div', { style: {
      display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24,
    }},
      card(a),
      h('div', { style: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }},
        h('div', { style: {
          fontSize: 22, fontWeight: 700, color: WHITE,
          background: TEXT_MUTED, borderRadius: '50%',
          width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}, 'vs')
      ),
      card(b)
    ),
    footer()
  );
}

function renderValue(slug) {
  const val = ogData.values[slug];
  if (!val) return renderHome();
  const c = VALUE_COLORS[slug] || ORANGE;
  return wrapper(
    brand('Browse by Culture'),
    h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' } },
      // Colored accent bar + title
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 } },
        h('div', { style: { width: 6, height: 52, borderRadius: 3, background: c, flexShrink: 0 } }),
        h('div', { style: { fontSize: 48, fontWeight: 700, color: TEXT, lineHeight: 1.12 } },
          `${val.name} Jobs`
        )
      ),
      // Stats row
      h('div', { style: { display: 'flex', gap: 20 } },
        h('div', { style: {
          display: 'flex', flexDirection: 'column',
          background: hexToRgba(c, 0.06), border: `1.5px solid ${hexToRgba(c, 0.15)}`,
          borderRadius: 14, padding: '16px 28px',
        }},
          h('div', { style: { fontSize: 38, fontWeight: 700, color: c, lineHeight: 1 } },
            val.jobCount.toLocaleString()
          ),
          h('div', { style: { fontSize: 14, color: TEXT_SEC, fontWeight: 400, marginTop: 4 } }, 'open jobs')
        ),
        h('div', { style: {
          display: 'flex', flexDirection: 'column',
          background: WHITE, border: '1px solid rgba(0,0,0,0.07)',
          borderRadius: 14, padding: '16px 28px',
        }},
          h('div', { style: { fontSize: 38, fontWeight: 700, color: TEXT, lineHeight: 1 } },
            val.companyCount.toString()
          ),
          h('div', { style: { fontSize: 14, color: TEXT_SEC, fontWeight: 400, marginTop: 4 } }, 'companies')
        )
      )
    ),
    footer()
  );
}

function renderRole(slug) {
  const role = ogData.roles[slug];
  if (!role) return renderHome();
  return wrapper(
    brand('Browse by Role'),
    h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' } },
      h('div', { style: {
        fontSize: 52, fontWeight: 700, color: TEXT, lineHeight: 1.12, marginBottom: 20,
      }}, `${role.name} Jobs`),
      h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 14 } },
        h('div', { style: { fontSize: 48, fontWeight: 700, color: ORANGE, lineHeight: 1 } },
          role.jobCount.toLocaleString()
        ),
        h('div', { style: { fontSize: 22, color: TEXT_SEC, fontWeight: 400 } },
          'jobs at culture-first companies'
        )
      )
    ),
    footer(`${ogData.companyCount} companies profiled  ·  jobsbyculture.com`)
  );
}

function renderDirectory() {
  // Show a few company names as a teaser
  const names = Object.values(ogData.companies).slice(0, 6).map(c => c.name);
  return wrapper(
    brand(),
    h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' } },
      h('div', { style: {
        fontSize: 50, fontWeight: 700, color: TEXT, lineHeight: 1.12, marginBottom: 16,
      }}, 'Culture Directory'),
      h('div', { style: {
        fontSize: 22, color: TEXT_SEC, lineHeight: 1.5, fontWeight: 400, marginBottom: 28,
      }}, `${ogData.companyCount} AI & tech companies profiled by culture, values & Glassdoor ratings`),
      h('div', { style: { display: 'flex', gap: 12 } },
        statBox(ogData.companyCount.toString(), 'Companies', TEAL),
        statBox(ogData.totalJobs.toLocaleString(), 'Total Jobs', ORANGE)
      )
    ),
    footer()
  );
}

function renderCompareTool() {
  return wrapper(
    brand(),
    h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' } },
      h('div', { style: {
        fontSize: 50, fontWeight: 700, color: TEXT, lineHeight: 1.12, marginBottom: 16,
      }}, 'Compare Company Cultures'),
      h('div', { style: {
        fontSize: 22, color: TEXT_SEC, lineHeight: 1.5, fontWeight: 400, marginBottom: 28,
      }}, 'Side-by-side comparison of Glassdoor ratings, culture values & work style'),
      h('div', { style: { display: 'flex', gap: 12 } },
        statBox(ogData.companyCount.toString(), 'Companies', TEAL),
        statBox('18', 'Culture Values', VIOLET)
      )
    ),
    footer()
  );
}

// --- Handler ---
export default async function handler(request) {
  const [boldFont, regularFont] = await Promise.all([interBoldData, interRegularData]);

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
    fonts: [
      { name: 'Inter', data: boldFont, weight: 700, style: 'normal' },
      { name: 'Inter', data: regularFont, weight: 400, style: 'normal' },
    ],
    headers: {
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
