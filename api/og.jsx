import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

// ─── Data (bundled at deploy time) ───

const OG_DATA_URL = 'https://jobsbyculture.com/data/og-data.json';
let ogData = null;

async function getData() {
    if (ogData) return ogData;
    try {
        const res = await fetch(OG_DATA_URL);
        ogData = await res.json();
    } catch {
        ogData = { totalJobs: 0, companyCount: 0, companies: {}, values: {}, roles: {} };
    }
    return ogData;
}

// ─── Font ───

let fontData = null;
async function getFont() {
    if (fontData) return fontData;
    const res = await fetch('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
    const css = await res.text();
    const url = css.match(/src: url\((.+?)\)/)?.[1];
    if (url) {
        const fontRes = await fetch(url);
        fontData = await fontRes.arrayBuffer();
    }
    return fontData;
}

// ─── Shared styles ───

const BG = '#0a0a0b';
const ORANGE = '#e8590c';
const WHITE = '#ffffff';
const GRAY = '#9ca3af';
const DARK_CARD = '#1a1a1e';

function fmt(n) { return n.toLocaleString('en-US'); }

// ─── Shared layout wrapper ───

function Layout({ children, subtitle }) {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
            background: BG, padding: '50px 60px', fontFamily: 'Inter',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: ORANGE, display: 'flex',
                }} />
                <div style={{ display: 'flex', fontSize: '28px', color: WHITE }}>
                    <span>Jobs</span>
                    <span style={{ color: ORANGE }}>By</span>
                    <span>Culture</span>
                </div>
                {subtitle && (
                    <div style={{
                        display: 'flex', marginLeft: '16px', fontSize: '18px',
                        color: GRAY, borderLeft: `1px solid ${GRAY}`, paddingLeft: '16px',
                    }}>
                        {subtitle}
                    </div>
                )}
            </div>
            {/* Content */}
            <div style={{
                display: 'flex', flexDirection: 'column', flex: 1,
                justifyContent: 'center', gap: '16px',
            }}>
                {children}
            </div>
            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', color: GRAY, fontSize: '18px' }}>
                <span>jobsbyculture.com</span>
                <span>Culture-first job search for AI & tech</span>
            </div>
        </div>
    );
}

function StatPill({ label, value }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: DARK_CARD, borderRadius: '12px', padding: '12px 24px',
        }}>
            <span style={{ color: ORANGE, fontSize: '28px', fontWeight: 700 }}>{value}</span>
            <span style={{ color: GRAY, fontSize: '20px' }}>{label}</span>
        </div>
    );
}

function ValuePill({ name }) {
    return (
        <div style={{
            display: 'flex', padding: '6px 16px', borderRadius: '20px',
            background: DARK_CARD, color: GRAY, fontSize: '18px',
        }}>
            {name}
        </div>
    );
}

// ─── Page renderers ───

function renderHome(data) {
    return (
        <Layout>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '56px', fontWeight: 700, color: WHITE, lineHeight: 1.15 }}>
                    Find jobs that fit how you
                </div>
                <div style={{ display: 'flex', fontSize: '56px', fontWeight: 700, lineHeight: 1.15 }}>
                    <span style={{ color: ORANGE, fontStyle: 'italic' }}>actually</span>
                    <span style={{ color: WHITE, marginLeft: '16px' }}>work.</span>
                </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                <StatPill value={fmt(data.totalJobs)} label="live jobs" />
                <StatPill value={String(data.companyCount)} label="companies" />
                <StatPill value="18" label="culture values" />
            </div>
        </Layout>
    );
}

function renderJobs(data) {
    return (
        <Layout subtitle="Browse Jobs">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontSize: '64px', fontWeight: 700, color: WHITE, lineHeight: 1.1 }}>
                    {fmt(data.totalJobs)} AI & Tech Jobs
                </div>
                <div style={{ fontSize: '28px', color: GRAY }}>
                    Filtered by culture values like async-first, work-life balance, and ethical AI
                </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                <StatPill value={String(data.companyCount)} label="companies" />
                <StatPill value="18" label="culture values" />
                <StatPill value="12" label="role categories" />
            </div>
        </Layout>
    );
}

function renderCompany(data, slug) {
    const co = data.companies[slug];
    if (!co) return renderHome(data);

    const valueNames = (co.values || []).map(v => data.values[v]?.name || v);

    return (
        <Layout subtitle="Company Profile">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <img
                        src={`https://www.google.com/s2/favicons?domain=${slug}.com&sz=128`}
                        width="64" height="64"
                        style={{ borderRadius: '12px' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: '52px', fontWeight: 700, color: WHITE }}>
                            {co.name}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                    <StatPill value={`${co.glassdoor}★`} label="Glassdoor" />
                    <StatPill value={fmt(co.jobCount)} label="open roles" />
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {valueNames.map(name => <ValuePill key={name} name={name} />)}
                </div>
            </div>
        </Layout>
    );
}

function renderCompare(data, slugA, slugB) {
    const a = data.companies[slugA];
    const b = data.companies[slugB];
    if (!a || !b) return renderHome(data);

    return (
        <Layout subtitle="Culture Comparison">
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '40px' }}>
                {/* Company A */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <img
                        src={`https://www.google.com/s2/favicons?domain=${slugA}.com&sz=128`}
                        width="56" height="56" style={{ borderRadius: '12px' }}
                    />
                    <div style={{ fontSize: '36px', fontWeight: 700, color: WHITE }}>{a.name}</div>
                    <div style={{ fontSize: '24px', color: ORANGE }}>{a.glassdoor}★ Glassdoor</div>
                    <div style={{ fontSize: '20px', color: GRAY }}>{fmt(a.jobCount)} jobs</div>
                </div>
                {/* VS */}
                <div style={{
                    display: 'flex', fontSize: '40px', fontWeight: 700, color: ORANGE,
                    padding: '16px 24px', background: DARK_CARD, borderRadius: '16px',
                }}>
                    vs
                </div>
                {/* Company B */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <img
                        src={`https://www.google.com/s2/favicons?domain=${slugB}.com&sz=128`}
                        width="56" height="56" style={{ borderRadius: '12px' }}
                    />
                    <div style={{ fontSize: '36px', fontWeight: 700, color: WHITE }}>{b.name}</div>
                    <div style={{ fontSize: '24px', color: ORANGE }}>{b.glassdoor}★ Glassdoor</div>
                    <div style={{ fontSize: '20px', color: GRAY }}>{fmt(b.jobCount)} jobs</div>
                </div>
            </div>
        </Layout>
    );
}

function renderValue(data, slug) {
    const val = data.values[slug];
    if (!val) return renderHome(data);

    return (
        <Layout subtitle="Jobs by Culture Value">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontSize: '56px', fontWeight: 700, color: WHITE, lineHeight: 1.1 }}>
                    {val.name}
                </div>
                <div style={{ fontSize: '28px', color: GRAY }}>
                    Jobs at companies that genuinely value {val.name.toLowerCase()}
                </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                <StatPill value={fmt(val.jobCount)} label="open roles" />
                <StatPill value={String(val.companyCount)} label="companies" />
            </div>
        </Layout>
    );
}

function renderRole(data, slug) {
    const role = data.roles[slug];
    if (!role) return renderHome(data);

    return (
        <Layout subtitle="Jobs by Role">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontSize: '56px', fontWeight: 700, color: WHITE, lineHeight: 1.1 }}>
                    {role.name} Jobs
                </div>
                <div style={{ fontSize: '28px', color: GRAY }}>
                    At {data.companyCount} AI & tech companies with strong culture scores
                </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                <StatPill value={fmt(role.jobCount)} label="open roles" />
                <StatPill value={String(data.companyCount)} label="companies" />
            </div>
        </Layout>
    );
}

function renderDirectory(data) {
    return (
        <Layout subtitle="Company Directory">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontSize: '56px', fontWeight: 700, color: WHITE, lineHeight: 1.1 }}>
                    Company Culture Directory
                </div>
                <div style={{ fontSize: '28px', color: GRAY }}>
                    Glassdoor ratings, culture values, pros & cons, and open roles
                </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                <StatPill value={String(data.companyCount)} label="companies profiled" />
                <StatPill value={fmt(data.totalJobs)} label="live jobs" />
                <StatPill value="18" label="culture values" />
            </div>
        </Layout>
    );
}

function renderCompareTool(data) {
    return (
        <Layout subtitle="Compare Tool">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontSize: '52px', fontWeight: 700, color: WHITE, lineHeight: 1.1 }}>
                    Compare Company Cultures
                </div>
                <div style={{ fontSize: '28px', color: GRAY }}>
                    Side-by-side Glassdoor ratings, values, pros & cons, and career opportunities
                </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                <StatPill value={String(data.companyCount)} label="companies" />
                <StatPill value="18" label="culture values tracked" />
            </div>
        </Layout>
    );
}

// ─── Handler ───

export default async function handler(req) {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'home';
    const slug = searchParams.get('slug');
    const a = searchParams.get('a');
    const b = searchParams.get('b');

    const data = await getData();
    const font = await getFont();

    let content;
    switch (type) {
        case 'home':         content = renderHome(data); break;
        case 'jobs':         content = renderJobs(data); break;
        case 'company':      content = renderCompany(data, slug); break;
        case 'compare':      content = renderCompare(data, a, b); break;
        case 'value':        content = renderValue(data, slug); break;
        case 'role':         content = renderRole(data, slug); break;
        case 'directory':    content = renderDirectory(data); break;
        case 'compare-tool': content = renderCompareTool(data); break;
        default:             content = renderHome(data);
    }

    const fonts = font ? [{ name: 'Inter', data: font, weight: 700, style: 'normal' }] : [];

    return new ImageResponse(content, {
        width: 1200,
        height: 630,
        fonts,
        headers: {
            'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
    });
}
