#!/usr/bin/env node
/**
 * Detect which ATS a company uses by trying public API endpoints.
 *
 * Usage:
 *   node scripts/detect-ats.js openai          # try "openai" as slug
 *   node scripts/detect-ats.js deepmind google  # try multiple
 *
 * Tries: Greenhouse, Ashby, Lever, Workable
 * Reports which ATS has jobs and how many.
 */

const slugs = process.argv.slice(2);

if (slugs.length === 0) {
    console.log('Usage: node scripts/detect-ats.js <company-slug> [slug2] [slug3] ...');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/detect-ats.js openai');
    console.log('  node scripts/detect-ats.js deepmind google meta');
    console.log('  node scripts/detect-ats.js notion canva figma');
    console.log('');
    console.log('The slug is usually the company name in lowercase, no spaces.');
    console.log('Sometimes it differs: "hubspotjobs" not "hubspot", "runwayml" not "runway".');
    console.log('Try variations if the first attempt fails.');
    process.exit(0);
}

const ATS_CHECKS = [
    {
        name: 'Greenhouse',
        ats: 'greenhouse',
        check: async (slug) => {
            const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`);
            if (!res.ok) return null;
            const data = await res.json();
            return data.jobs?.length || 0;
        }
    },
    {
        name: 'Ashby',
        ats: 'ashby',
        check: async (slug) => {
            const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
            if (!res.ok) return null;
            const data = await res.json();
            return data.jobs?.length || 0;
        }
    },
    {
        name: 'Lever',
        ats: 'lever',
        check: async (slug) => {
            const res = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`);
            if (!res.ok) return null;
            const data = await res.json();
            return Array.isArray(data) ? data.length : 0;
        }
    },
    {
        name: 'Workable',
        ats: 'workable',
        check: async (slug) => {
            const res = await fetch(`https://apply.workable.com/api/v1/widget/accounts/${slug}`);
            if (!res.ok) return null;
            const data = await res.json();
            return data.jobs?.length || 0;
        }
    }
];

for (const slug of slugs) {
    console.log(`\n🔍 Checking "${slug}"...`);
    let found = false;

    const results = await Promise.all(
        ATS_CHECKS.map(async (ats) => {
            try {
                const count = await ats.check(slug);
                return { ...ats, count };
            } catch {
                return { ...ats, count: null };
            }
        })
    );

    for (const r of results) {
        if (r.count !== null && r.count > 0) {
            console.log(`  ✓ ${r.name}: ${r.count} jobs`);
            console.log(`    Add to ats-companies.json:`);
            console.log(`    { "slug": "${slug}", "name": "${slug}", "ats": "${r.ats}", "atsSlug": "${slug}", "domain": "${slug}.com" }`);
            found = true;
        } else if (r.count === 0) {
            console.log(`  ○ ${r.name}: board exists but 0 jobs`);
        }
    }

    if (!found) {
        console.log(`  ✗ No ATS found. Try variations of the slug (e.g., "${slug}ai", "${slug}hq", "${slug}jobs")`);
    }
}
