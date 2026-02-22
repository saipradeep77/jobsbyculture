# Changelog

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
