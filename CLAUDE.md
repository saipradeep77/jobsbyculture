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

**Available culture values** (pick the ones that genuinely apply):
`wlb`, `remote`, `flex-hours`, `async`, `deep-work`, `transparent`, `flat`, `diverse`, `psych-safety`, `eng-driven`, `ship-fast`, `open-source`, `learning`, `equity`, `product-impact`, `many-hats`, `ethical-ai`, `social-impact`

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

### Step 5: Update Directory
Add the new company card to `directory.html` in the appropriate position.

### Step 6: Update Sitemap
Add new entries to `sitemap.xml`:
```xml
<url>
  <loc>https://jobsbyculture.com/companies/companyname</loc>
  <lastmod>YYYY-MM-DD</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.8</priority>
</url>
```

### Step 7: Fetch & Update Jobs
```bash
npm run refresh
```
This runs 4 scripts in sequence:
1. `fetch-jobs.js` — Fetches live jobs from all ATS APIs → `data/jobs-fetched.json`
2. `update-jobs-html.js` — Replaces the JOBS array in `jobs.html` with fresh data
3. `build-cluster-pages.js` — Rebuilds 162+ programmatic SEO pages
4. `indexnow.js` — Submits all URLs to search engines (Bing, Yandex, Naver)

### Step 8: Commit & Push
```bash
git add -A
git commit -m "Add [company names] + refresh all jobs

- Added X new companies with profile pages
- Refreshed jobs: N total from M companies
- Rebuilt cluster pages and submitted to IndexNow

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push
```

## Important Rules

1. **Never fake Glassdoor data.** If you can't find ratings, use reasonable estimates and note it.
2. **Culture values must be genuine.** Research the company before assigning values. Check Glassdoor reviews, engineering blogs, and careers pages.
3. **Logo URL format**: Always use `https://www.google.com/s2/favicons?domain=DOMAIN&sz=128`
4. **OG image**: Use `https://jobsbyculture.com/og-image.png` (no query params)
5. **Add `og:image:type`**: Include `<meta property="og:image:type" content="image/png">` in all pages
6. **Canonical URLs**: Always set proper canonical. For jobs.html filtered pages, canonical is always `/jobs` (no query params).
7. **Navigation**: Use "Culture Directory" linking to `/directory` in nav. Footer should include Culture Directory, By Culture, and By Role links.
8. **H1 tags**: Every page must have exactly one `<h1>` tag.
9. **Ref tracking**: Append `?ref=jobsbyculture.com` to all external career/job URLs.

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
| `sitemap.xml` | Lists all pages for search engines |
| `robots.txt` | Crawl directives including LLM bot rules |
| `llms.txt` | LLM-readable site description |
