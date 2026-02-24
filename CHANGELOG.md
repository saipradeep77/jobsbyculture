# Changelog

## 2026-02-25 — Location Fixes, OG Image, Structured Data

### jobs.html
- **Fixed multi-location classification**: Jobs with multiple cities (e.g., "London, UK; New York City, NY") now classify by the first listed city instead of whichever regex matched first. Fixes 5 jobs that were in the wrong location bucket.
- **Fixed Google JobPosting structured data**: Added `applicantLocationRequirements` and `jobLocationType` for remote/hybrid jobs (critical GSC error). Added `parseAddress()` with proper `addressCountry`, `addressRegion`, `addressLocality` for all locations. Added `baseSalary` extraction when salary data available.
- **Added 16 missing country codes**: Spain (ES), Denmark (DK), South Korea (KR), Taiwan (TW), Brazil (BR), Argentina (AR), Uruguay (UY), Costa Rica (CR), UAE (AE), Morocco (MA), and generic US/Europe patterns.
- **Fixed hybrid job country codes**: Hybrid roles now use the actual office country instead of hardcoded US.

### index.html
- **Fixed hero metric**: "15 companies profiled" → "17 companies profiled"
- **Updated OG image**: Replaced og-image.png with new homepage screenshot

### All pages (19 files)
- Updated `og:image:width` (1200 → 2514) and `og:image:height` (630 → 1304) to match new image
- Added missing `twitter:image` meta tag on Cohere, HubSpot, and Mistral profile pages

## 2026-02-24 — New Companies, Newsletter, Location Redesign

### New: 5 Company Additions (979 → 1,044 jobs, 12 → 17 companies)
- **Scale AI** — 171 jobs, profile page, Glassdoor 3.5
- **CoreWeave** — 279 jobs, profile page, Glassdoor 3.6
- **Runway** — 30 jobs, profile page, Glassdoor 4.5
- **Vast AI** — 10 jobs, profile page, Glassdoor 5.0
- **Apollo.io** — 55 jobs, profile page, Glassdoor 4.0

### jobs.html
- **Redesigned location filters**: Replaced "US On-site / Hybrid / Other" with 8 clean regional categories: Remote, United States, Europe & UK, Canada, India, Asia Pacific, Latin America, Middle East
- **Dynamic SEO meta tags**: `updatePageMeta()` updates `<title>` and meta description based on active filters
- **Fixed Remote filter**: Was only showing 7 jobs; now correctly matches 82 Remote jobs using `/^Remote(\s|,|$)/` regex

### index.html
- **Newsletter form**: Wired up to Formspree (AJAX submission, inline success message, no redirect)
- Added company cards for Scale AI, CoreWeave, Runway, Vast AI, Apollo.io

### sitemap.xml
- Added 8 location filter URLs, 17 company filter URLs, 5 company profile URLs (total: 62 URLs)

## 2026-02-23 — Company Profile Pages

### New: 12 Company Profile Pages (`/companies/{slug}`)
- **Anthropic**, **Hugging Face**, **Databricks**, **Cohere**, **Mistral AI**, **HubSpot**, **Vercel**, **Stripe**, **Perplexity AI**, **Together AI**, **Cursor**, **Linear**
- Each page includes: Glassdoor ratings grid (6 categories), employee review themes (pros/cons), engineering culture details (tech stack, open source), and live job listings with direct apply links
- JSON-LD Organization schema on every page for rich search results
- Full SEO meta tags (title, description, OG, Twitter card, canonical URL) unique per company
- Responsive design matching the existing site aesthetic

### index.html
- Added "Full Profile →" link on each company card linking to `/companies/{slug}`

### jobs.html
- Added "Companies" link to navigation

### sitemap.xml
- Added 12 new company profile URLs (priority 0.8, weekly changefreq)

## 2026-02-22 — Clickable Cards, Real ATS Data, Emoji Refresh

### jobs.html
- **Clickable cards**: Job cards are now `<a>` elements wrapping the entire card. The full card is clickable and opens the job posting in a new tab. The inner "Apply" button changed from `<a>` to `<span>`.
- **Removed broken manual entries**: Deleted 9 manual job entries with generic careers-page URLs:
  - Buffer id 21 (`buffer.com/journey`)
  - Databricks ids 160, 173, 203 (`databricks.com/company/careers/open-positions`)
  - OpenAI ids 291, 375, 423 (`openai.com/careers/search`)
  - Stripe ids 307, 373 (`stripe.com/jobs/search`)
- **Added 25 real Stripe jobs** from Greenhouse API (`gh_jid` direct links)
- **Added 25 real Databricks jobs** from Greenhouse API (`gh_jid` direct links)
- **Updated emoji map**: Refreshed value tag icons for clarity (e.g. Remote: globe, Async: satellite, Deep Work: headphones, Transparent: window, Engineering: gear, Learning: seedling, Comp: diamond, Impact: target, Many Hats: puzzle, Ethical AI: robot, Mission: purple heart)

### index.html
- **Fixed 3 broken featured job cards**:
  - Replaced OpenAI (generic careers link) with Anthropic — Staff + Senior SWE, AI Reliability (Greenhouse direct link)
  - Replaced Databricks (generic careers link) with Senior Staff SWE — Unity Catalog (Greenhouse direct link)
  - Replaced Stripe (generic careers link) with Backend Engineer, Payments and Risk (Greenhouse direct link)
- **Updated emoji map** in value picker tags to match jobs.html
- **Added category group headers** above value tags: "How You Work" (teal), "How The Team Operates" (violet), "How You Build" (sky), "How You Grow" (orange), "What They Stand For" (rose)

## 2026-02-21 — URL Param Filter Fix

- Fixed value filters from URL params (`?values=async,flat`) not syncing with sidebar UI on page load
