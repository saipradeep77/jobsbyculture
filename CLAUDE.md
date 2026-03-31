# JobsByCulture — Agent Instructions

## Project Overview
A culture-first job board at jobsbyculture.com. Static site on Vercel. Jobs are fetched from public ATS APIs (Greenhouse, Ashby, Lever, Workable) and rendered in `jobs.html`.

## Daily Workflow: Add New Companies & Refresh Jobs

### Step 1: Research New Companies
Find 4-5 AI/tech companies worth adding. Good candidates:
- AI/ML startups (series A+) with 20+ open roles
- Developer tools companies with strong engineering culture
- Companies frequently discussed on Hacker News, TechCrunch, etc.
- Companies NOT already in `data/ats-companies.json`

### Step 2: Detect Their ATS
```bash
node scripts/detect-ats.js <slug1> <slug2> <slug3> ...
```
The slug is usually the company name in lowercase. Try variations if needed (e.g., `runwayml` not `runway`, `hubspotjobs` not `hubspot`). Only add companies that have jobs on a supported ATS (Greenhouse, Ashby, Lever, Workable).

### Step 3: Add to ATS Config
Add each new company to `data/ats-companies.json`:
```json
{ "slug": "companyname", "name": "Company Name", "ats": "ashby", "atsSlug": "companyname", "domain": "company.com" }
```

### Step 4: Add Company Data to jobs.html
This is the critical step. For each new company, add three things to `jobs.html`:

**A) Add to `COMPANIES` object** (after the last entry, before `};`):
```javascript
'companyname': {
    name: 'Company Name', logo: 'https://www.google.com/s2/favicons?domain=company.com&sz=128',
    size: 'Small (~100)',  // Small <200, Mid 200-1000, Large 1000+
    glassdoor: 4.0,        // Look up on Glassdoor
    wlb_score: 3.5,        // Work-life balance from Glassdoor
    values: ['eng-driven','ship-fast','flat'],  // Pick 3-6 from VALUES list below
    careers: 'https://company.com/careers?ref=jobsbyculture.com'
},
```

**Available culture values** — see **Culture Values Evidence Framework** section below for strict assignment criteria. Every value MUST have evidence. When in doubt, leave it out.

**B) Add to `COMPANY_REVIEWS` object** (after last entry, before `};`):
```javascript
'companyname': {
    pros: ['First genuine pro based on Glassdoor reviews', 'Second pro'],
    cons: ['First con based on Glassdoor reviews', 'Second con']
},
```

**C) Create company profile page** at `companies/companyname.html`:
- Copy an existing company page as template (e.g., `companies/anthropic.html`)
- Update: title, meta tags, company name, OG tags, ratings, culture overview, values, featured jobs
- Use canonical URL: `https://jobsbyculture.com/companies/companyname`

### Step 5: Add to Homepage Grid (AUTO-GENERATED)
Add the new company's data to `data/companies.json` (meta, quote, location, details, tags, pros, cons, source). Then run:
```bash
node scripts/build-homepage-grid.js
```
This regenerates all company cards in `index.html` from `companies.json`. No manual HTML editing needed.

**Verification:** `grep -c 'data-company=' index.html` — the count must equal the total number of companies + 1 (for the JS template string).

### Step 6: Update Directory
Add the new company card to `directory.html` in the appropriate position.

### Step 7: Update Sitemap
Add new entries to `sitemap.xml`:
```xml
<url>
  <loc>https://jobsbyculture.com/companies/companyname</loc>
  <lastmod>YYYY-MM-DD</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.8</priority>
</url>
```

### Step 8: Fetch & Update Jobs
```bash
npm run refresh
```
This runs 5 scripts in sequence:
1. `fetch-jobs.js` — Fetches live jobs from all ATS APIs → `data/jobs-fetched.json`
2. `update-jobs-html.js` — Replaces the JOBS array in `jobs.html` with fresh data
3. `build-cluster-pages.js` — Rebuilds 192+ programmatic SEO pages
4. `indexnow.js` — Submits all URLs to search engines (Bing, Yandex, Naver)
5. `export-social.js` — Generates `data/jobs-export.csv` for Google Sheets/Zapier

### Step 9: Update ALL Counts Site-Wide
After refresh, update job/company counts in **every** file that references them:

| File | What to update |
|------|---------------|
| `index.html` | Meta description, twitter description, hero count, hero metrics (jobs + companies profiled), **sticky CTA bar count (`#stickyCount` — must match hero count)**, "See all X jobs" CTA, "From N companies" note, ALL browse-by-value counts (eng-driven, flat, learning, ethical-ai, equity, many-hats, open-source, ship-fast), "All AI & Tech Jobs" card count + company count |
| `compare.html` | Profiled companies comment, AUTOCOMPLETE_LIST (add new companies) |
| `llms.txt` | Job count, company count, add new company profile entries |
| `directory.html` | Meta description, og:description, twitter:description, visible company count |

**Get the correct per-value job counts from the cluster page build output or from the generated `values/*.html` files.**

**This step is MANDATORY. Never skip it. Every number on the site must match reality.**

### Step 10: Commit (DO NOT PUSH)
```bash
git add -A
git commit -m "Add [company names] + refresh all jobs

- Added X new companies with profile pages
- Refreshed jobs: N total from M companies
- Updated all counts site-wide (index, compare, directory, llms.txt)
- Rebuilt cluster pages and submitted to IndexNow

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

**IMPORTANT: Do NOT run `git push`. The owner will review and push to production manually.**

## Culture Values Evidence Framework

**This is the most important section of this document.** Assigning wrong culture values undermines the entire site. Every value assigned to a company MUST have concrete evidence. The bar is: "Could I defend this assignment to a user who works there?"

### Assignment Process (MANDATORY for every new company)

1. **Check Glassdoor reviews** — read at least 10 recent reviews. Note specific quotes supporting each candidate value.
2. **Check the careers/culture page** — look for explicit policies, not marketing fluff. "We value flexibility" with no specifics is not evidence.
3. **Check engineering blog** (if exists) — real signal on `eng-driven`, `open-source`, `ship-fast`, `deep-work`.
4. **Cross-reference cons against values** — if Glassdoor cons directly contradict a value (e.g., "too many meetings" → don't assign `deep-work`), do NOT assign it.
5. **When in doubt, leave it out** — 3 accurate values are better than 6 aspirational ones.
6. **Minimum 3, maximum 6 values per company.** More than 6 dilutes signal. Fewer than 3 means we don't know enough (research more or don't add the company).

### Evidence Criteria Per Value

#### Work & Time (highest risk of getting wrong — be strict)

| Value | Assign ONLY if... | Reject if... |
|---|---|---|
| `remote` | >50% of open roles are listed as remote/distributed, OR company explicitly states "remote-first" on careers page | "Hybrid," "flexible," or "in-office with some remote" language. Mandatory office days = NOT remote. Having a few remote roles ≠ remote-friendly culture. |
| `wlb` | Glassdoor WLB score ≥ 4.0, AND multiple reviews specifically praise work-life balance | WLB < 3.5, or "long hours" / "always on" appears in 3+ reviews |
| `flex-hours` | Explicit flex-hours or async-schedule policy on careers page, OR consistent review mentions | "Core hours" with strict enforcement. Marketing-speak without specifics. |
| `async` | Company explicitly promotes async communication — must be documented (handbook, blog post, careers page), not assumed from being remote | Heavy Slack/meeting culture mentioned in reviews. Being remote does NOT automatically mean async. |
| `deep-work` | Reviews or blog posts emphasize low-meeting culture, maker schedules, focus time blocks | "Too many meetings" as a Glassdoor con. High-growth startups rarely qualify unless they actively protect focus time. |

#### Organizational Culture

| Value | Assign ONLY if... | Reject if... |
|---|---|---|
| `flat` | Company has <300 employees with demonstrably few management layers, OR explicitly documents flat structure (e.g., no managers, elected leads) | Company has >500 people (almost impossible to be truly flat at scale). Multiple VP/Director/SVP layers visible on LinkedIn. "Politics" mentioned in reviews. |
| `transparent` | Open salary bands published, OR public company metrics/dashboards, OR reviews consistently mention "transparent leadership" | "Lack of communication" or "decisions made behind closed doors" as Glassdoor cons |
| `diverse` | Published DEI data with specifics, diverse leadership team visible, concrete programs (ERGs, sponsorship) | No diversity page. A single diversity statement without data or programs is not enough. |
| `psych-safety` | Reviews mention blameless postmortems, safe to disagree with leadership, constructive failure culture | "Fear-based," "blame culture," "walking on eggshells" in reviews |

#### Product & Engineering

| Value | Assign ONLY if... | Reject if... |
|---|---|---|
| `eng-driven` | Engineers demonstrably influence product direction. Evidence: eng blog, technical founders still active, reviews say "engineers have real ownership" | "Product/sales driven" in reviews. Sales-led GTM with eng as a service org. |
| `ship-fast` | Frequent release cadence, CI/CD emphasis, "move fast" is genuine culture (not just a tagline). Reviews mention pace and iteration. | Slow, bureaucratic processes described in reviews. Heavy compliance/approval gates. |
| `open-source` | Company actively maintains significant OSS projects, OR core product is open-source | Merely using open-source tools does NOT count. Having a GitHub with minor repos is not enough. The company must be known for OSS contributions. |

#### Growth & Compensation

| Value | Assign ONLY if... | Reject if... |
|---|---|---|
| `equity` | Above-market total comp confirmed by reviews or Levels.fyi. Strong equity/RSU packages mentioned. | "Below market," "equity is worthless," "low pay" in reviews |
| `learning` | Dedicated L&D budget, conference sponsorship, internal tech talks, or reviews consistently cite growth opportunities | "No growth path," "stagnant," "no mentorship" as cons |
| `product-impact` | Individual contributors ship features to real users with visible outcomes. Small teams, direct user impact. | "Cog in the machine" sentiment. Layers of abstraction between IC work and user-facing product. |
| `many-hats` | Company has <300 people AND roles are genuinely cross-functional (not just understaffed). Reviews frame this positively. | Large company (>500) with specialized roles. Negative framing like "expected to do everything" or "no clear responsibilities" = understaffing, not culture. |

#### Mission & Impact

| Value | Assign ONLY if... | Reject if... |
|---|---|---|
| `ethical-ai` | Published safety/alignment research, responsible AI policy with substance, dedicated safety team, or the company's core mission involves AI safety | Just having a generic "AI ethics" page. Companies that have faced controversy around safety practices without meaningful response. |
| `social-impact` | Company's core product or mission directly addresses a social good (education, health, climate, equity) — not just CSR programs | Side philanthropic initiatives. "Tech for good" marketing without substance. Being a for-profit SaaS with a charity page is NOT social-impact. |

### Special Rules

- **Company size gates**: `flat` requires <300. `many-hats` requires <300. Large companies (1000+) rarely qualify for `async` or `deep-work` — require extra-strong evidence.
- **Glassdoor score gates**: If Glassdoor WLB < 3.5, do NOT assign `wlb`, `flex-hours`, or `deep-work`. If overall Glassdoor < 3.0, reconsider whether the company should be on the site at all.
- **"Remote" is the highest-risk value.** Users filter by it and make career decisions based on it. Triple-check. Look at actual job listings — if most say "San Francisco, CA" or "New York, NY" with no remote option, the company is NOT remote regardless of what the careers page implies.
- **Values must reflect current reality, not aspirations.** A company that was remote during COVID but returned to office is NOT remote. A company that used to be flat but added 3 management layers is NOT flat.

## Important Rules

1. **Never fake Glassdoor data.** If you can't find ratings, use reasonable estimates and note it.
2. **Culture values must pass the Evidence Framework.** Follow the full Culture Values Evidence Framework section above. Every value must have documented evidence. This is the core of the site — getting it wrong makes everything else pointless.
3. **Logo URL format**: Always use `https://www.google.com/s2/favicons?domain=DOMAIN&sz=128`
4. **OG image**: Use `https://jobsbyculture.com/og-image.png` (no query params)
5. **Add `og:image:type`**: Include `<meta property="og:image:type" content="image/png">` in all pages
6. **Canonical URLs**: Always set proper canonical. For jobs.html filtered pages, canonical is always `/jobs` (no query params).
7. **Navigation**: Use "Culture Directory" linking to `/directory` in nav. Footer should include Culture Directory, By Culture, and By Role links.
8. **H1 tags**: Every page must have exactly one `<h1>` tag.
9. **Ref tracking**: Append `?ref=jobsbyculture.com` to all external career/job URLs.
10. **All "View all jobs" CTAs must link with correct filters.** Never link to bare `/jobs`. Use the appropriate query params:
    - Location pages: `/jobs?search={city name}` (e.g., `/jobs?search=Dublin`)
    - Value pages: `/jobs?value={slug}` (e.g., `/jobs?value=remote`)
    - Role pages: `/jobs?role={slug}` (e.g., `/jobs?role=engineering`)
    - Seniority pages: `/jobs?seniority={slug}` (e.g., `/jobs?seniority=senior`)
    - Seniority×role pages: `/jobs?seniority={slug}&role={slug}`
    - Cross pages (value×role): `/jobs?value={slug}&role={slug}`
    - Company-specific: `/jobs?company={slug}`
    - Blog posts: use actual job counts from `data/jobs-fetched.json`, never hardcode or guess

## File Map

| File | Purpose |
|------|---------|
| `jobs.html` | Main jobs page — contains COMPANIES{}, COMPANY_REVIEWS{}, JOBS[], and JobPosting schema |
| `companies/*.html` | Individual company culture profile pages |
| `directory.html` | Company culture directory listing all companies |
| `compare.html` | Interactive company comparison tool |
| `compare/*.html` | Pre-rendered static comparison pages |
| `values/*.html` | Cluster pages by culture value (e.g., remote-friendly jobs) |
| `roles/*.html` | Cluster pages by role and/or value combination |
| `data/ats-companies.json` | Config mapping companies → ATS platforms |
| `data/jobs-fetched.json` | Latest fetched jobs (output of fetch-jobs.js) |
| `scripts/fetch-jobs.js` | Fetches jobs from Greenhouse/Ashby/Lever/Workable APIs |
| `scripts/update-jobs-html.js` | Updates JOBS[] in jobs.html from jobs-fetched.json |
| `scripts/detect-ats.js` | Detects which ATS a company uses |
| `scripts/build-cluster-pages.js` | Generates programmatic SEO cluster pages |
| `scripts/build-compare-pages.js` | Generates static compare pages |
| `scripts/indexnow.js` | Submits all sitemap URLs to IndexNow |
| `scripts/export-social.js` | Generates CSV for Google Sheets/Zapier with status tracking |
| `data/jobs-export.csv` | Social media export — pending/posted/expired status per job |
| `sitemap.xml` | Lists all pages for search engines |
| `robots.txt` | Crawl directives including LLM bot rules |
| `llms.txt` | LLM-readable site description |
