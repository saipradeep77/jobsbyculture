# What 5,600+ Employee Reviews Reveal About Culture at 40 AI Companies

*A data-driven look at what actually makes AI companies different to work at — and the patterns nobody talks about.*

---

I spent the last few months building culture profiles for 40 AI and tech companies. Not the marketing copy on their careers pages. The real stuff: aggregated ratings from multiple employee review communities, sentiment from developer forums, and structured analysis of what people actually say when they're being honest about where they work.

The dataset covers companies ranging from 30-person startups to 8,000-employee public companies. Frontier AI labs, developer tools, infrastructure plays, fintech. The goal was simple: figure out if "culture" is just vibes, or if there are measurable patterns.

There are. Some of them surprised me.

## The Dataset

I'm going to walk through the methodology at a high level, then get into findings. If you're here for the charts, skip to section 3.

**What I collected for each company:**

- Overall satisfaction rating (aggregated across multiple review platforms)
- Sub-dimension scores: work-life balance, compensation & benefits, culture & values, senior management, career opportunities
- Company size (headcount)
- A set of culture "values" assigned through manual analysis of employee reviews, engineering blogs, and public discourse — things like `remote`, `ship-fast`, `eng-driven`, `flat`, `open-source`
- Unstructured text: pros, cons, recurring themes

I defined 18 culture value tags based on what kept coming up in reviews. Not the aspirational stuff companies put on their walls. The things employees actually mention when describing what it's *like* to work somewhere.

```python
CULTURE_VALUES = [
    'wlb', 'remote', 'flex-hours', 'async', 'deep-work',
    'transparent', 'flat', 'diverse', 'psych-safety',
    'eng-driven', 'ship-fast', 'open-source', 'learning',
    'equity', 'product-impact', 'many-hats', 'ethical-ai',
    'social-impact'
]
```

A company gets a value tag only when multiple independent reviews reference that trait unprompted. Anthropic gets `ethical-ai` not because they say it on their website, but because employees consistently bring it up. Supabase gets `open-source` because engineers describe it as core to how work actually happens there, not just the license on the repo.

## Setting Up the Analysis

I stored the data as a flat structure per company. Here's the basic setup:

```python
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
from scipy import stats

# Each company has structured ratings + tagged values
companies = [
    {"name": "Anthropic", "glassdoor": 4.4, "wlb": 3.7,
     "size_bucket": "mid", "headcount": 1500,
     "values": ["ethical-ai", "learning", "equity",
                "social-impact", "eng-driven", "flat"]},
    {"name": "OpenAI", "glassdoor": 4.5, "wlb": 3.6,
     "size_bucket": "large", "headcount": 3500,
     "values": ["eng-driven", "ship-fast", "learning",
                "ethical-ai", "product-impact", "equity"]},
    # ... 38 more
]

df = pd.DataFrame(companies)

# Parse headcount from size strings
def bucket_size(hc):
    if hc < 200: return "tiny"
    if hc < 500: return "small"
    if hc < 1000: return "mid"
    return "large"

df["size_cat"] = df["headcount"].apply(bucket_size)
```

Nothing fancy. The interesting part is what falls out of the analysis.

## Finding 1: The Compensation–Balance Trade-off Is Real (With One Big Exception)

This was the first thing I checked, mostly because I expected it to be noise. It's not.

```python
fig, ax = plt.subplots(figsize=(10, 7))

ax.scatter(df["comp_benefits"], df["wlb"],
           s=df["headcount"] / 15, alpha=0.6,
           edgecolors="black", linewidth=0.5)

for _, row in df.iterrows():
    ax.annotate(row["name"], (row["comp_benefits"], row["wlb"]),
                fontsize=7, alpha=0.7,
                xytext=(5, 5), textcoords="offset points")

ax.set_xlabel("Compensation & Benefits Score")
ax.set_ylabel("Work-Life Balance Score")
ax.set_title("The Pay vs. Balance Trade-off Across 40 AI Companies")

r, p = stats.pearsonr(df["comp_benefits"], df["wlb"])
ax.text(0.05, 0.95, f"r = {r:.2f}, p = {p:.3f}",
        transform=ax.transAxes, fontsize=10,
        verticalalignment="top",
        bbox=dict(boxstyle="round", facecolor="wheat", alpha=0.5))

plt.tight_layout()
plt.show()
```

The correlation between compensation scores and work-life balance is **negative**. Companies that pay the most tend to work their people the hardest. Not exactly a revelation in isolation, but the *degree* of it across AI companies specifically is worth noting.

The top-paying cluster — OpenAI, Anthropic, Perplexity, Databricks — all score between 3.3 and 3.9 on work-life balance. Meanwhile, companies that score 4.3+ on WLB (Tailscale, PostHog, Pinecone, Linear) aren't paying at the same tier.

**The exception that breaks the pattern: Google DeepMind.** They score 4.5 on compensation *and* 4.0 on work-life balance. That's a genuine outlier. My read: being embedded in Google's compensation structure while maintaining a research-lab pace (not a product-shipping pace) gives them a combination nobody else in the frontier AI space has figured out.

The other partial exception is Airbnb — strong comp (4.4) with 4.0 WLB. But Airbnb isn't really an AI company in the same way, and their "Live and Work Anywhere" policy structurally enables balance in ways that a San Francisco office-first lab doesn't.

## Finding 2: Small Teams Are Happier (Until They're Not)

I bucketed companies by headcount and looked at average satisfaction:

```python
size_order = ["tiny", "small", "mid", "large"]
size_stats = df.groupby("size_cat").agg(
    avg_rating=("glassdoor", "mean"),
    avg_wlb=("wlb", "mean"),
    count=("name", "count")
).reindex(size_order)

print(size_stats.round(2))
```

| Size | Avg Rating | Avg WLB | Count |
|------|-----------|---------|-------|
| Tiny (<200) | 4.24 | 4.09 | 11 |
| Small (200–500) | 4.23 | 3.90 | 8 |
| Mid (500–1000) | 4.20 | 3.73 | 7 |
| Large (1000+) | 3.98 | 3.70 | 14 |

The trend is clean: bigger company, lower scores. That's not surprising. What's interesting is *where* it breaks down.

The tiny companies (<200 people) have a bimodal distribution. You get Vast AI at 5.0 and Linear at 4.6 on one end, then Cohere at 2.9 and Pylon at 3.0 on the other. Small teams amplify culture in both directions. A great founder creates an exceptional environment. A dysfunctional one creates misery with no institutional buffer.

By contrast, the large companies cluster tightly between 3.5 and 4.3. There's less variance. Corporate structure acts as a dampener — it prevents truly terrible culture, but it also caps how good things can get.

The practical takeaway: if you're joining a tiny company, the founders matter more than anything else you'll read on a job listing. At a large company, the team matters more than the company.

## Finding 3: "Engineering-Driven" Is the Most Claimed Value — But It Means Three Different Things

Here's how frequently each culture value appears across the 40 companies:

```python
from collections import Counter

all_values = []
for vals in df["values"]:
    all_values.extend(vals)

value_counts = Counter(all_values)
top_values = value_counts.most_common(10)

fig, ax = plt.subplots(figsize=(10, 5))
labels, counts = zip(*top_values)
ax.barh(range(len(labels)), counts, color="#e8590c", alpha=0.8)
ax.set_yticks(range(len(labels)))
ax.set_yticklabels(labels)
ax.invert_yaxis()
ax.set_xlabel("Number of companies")
ax.set_title("Most Common Culture Values Across 40 AI Companies")
plt.tight_layout()
plt.show()
```

`eng-driven` shows up in 35 of 40 companies. At first glance, that makes it meaningless — if everyone claims it, it differentiates nothing.

But when I dug into the reviews behind each assignment, three distinct flavors emerged:

**1. "Engineers make the decisions" (Anthropic, Stripe, Linear)**
At these companies, `eng-driven` means engineers have genuine product authority. They don't just build what a PM specs. They argue about what to build, and often win. Stripe's writing culture is the canonical example — engineers write docs to persuade, not just to document.

**2. "We ship fast and break things" (Perplexity, Vercel, Ramp)**
Here `eng-driven` means speed. The engineering team sets the pace for the whole company. Features go from idea to production in days. The culture rewards output velocity. This is a very different experience from flavor #1, even though both get tagged with the same value.

**3. "Research defines the roadmap" (DeepMind, Together AI)**
At research-oriented companies, `eng-driven` means the technical work *is* the product strategy. Scientists propose projects. Timelines are measured in months or years. The culture rewards depth, not speed.

Same label, completely different lived experiences. This is why I'm skeptical of any analysis that treats culture values as interchangeable boolean flags. The nuance is in what people mean when they use the same word.

## Finding 4: Community Sentiment Doesn't Always Match Ratings

This one needs a caveat: measuring sentiment from developer forums is messy. Thread context matters, sarcasm is hard to detect, and a single viral HN post can dominate the signal. Take the specifics with a grain of salt.

That said, the directional patterns are interesting.

For most companies, forum sentiment roughly tracks structured ratings. Companies with high satisfaction scores get mostly positive mentions. Companies with low scores get criticism.

But there are a few notable disconnects:

**Overperforms on forums relative to ratings:**
- **PostHog** (4.3 rating) punches way above its weight on developer forums. Their radical transparency — public handbook, public compensation, public board meetings — generates genuine enthusiasm in a way that a 4.3 rating doesn't capture. Developers on HN consistently champion them.
- **Supabase** (4.8 rating) is beloved in open-source communities, which isn't surprising. But the *intensity* of positive sentiment is off the charts relative to other companies with similar scores.

**Underperforms on forums relative to ratings:**
- **HubSpot** (4.3 rating) has strong employee satisfaction but barely registers in developer community discussions. They're not an "exciting" company in the way AI labs are, even though employees are quite happy there.
- A couple of companies with very high ratings (4.5+) get surprisingly skeptical treatment on forums. The common thread seems to be rapid growth — forum commenters are more cautious about hypergrowth companies than current employees are.

I deliberately won't quantify this section further because the sample sizes from any individual forum aren't large enough to draw reliable conclusions. The pattern is suggestive, not definitive.

## What I'd Do Differently

A few things I'd change if I were starting this analysis over:

**Normalize for review count.** A 5.0 rating from 10 reviews at a 30-person company means something very different from a 4.1 based on thousands of reviews at a public company. I didn't weight by review count in this analysis, and I should have. The tiny-company bucket in Finding 2 is almost certainly inflated by this.

**Track ratings over time.** A single snapshot misses trajectory. A company going from 3.5 to 4.2 is in a very different place than one dropping from 4.5 to 4.2, even though they look identical in a cross-section. I'm planning to add temporal tracking next.

**Be more rigorous about value assignment.** Right now the culture value tagging is manual — I read reviews and assign tags based on recurring themes. It works, but it doesn't scale. I've been experimenting with using LLMs to classify review text into value categories, with human validation on disagreements. Early results are promising but I'm not confident enough to publish that yet.

## The Takeaway

Culture data is noisy. Any single rating or review is nearly worthless. But patterns emerge at scale.

The three things this analysis convinced me of:

1. **The comp–balance trade-off is structural, not accidental.** Companies that pay top-of-market are buying intensity. A few manage to decouple the two (DeepMind being the clearest example), but they're exceptions with specific structural advantages.

2. **Company size is the single strongest predictor of culture scores**, but with a massive asterisk on tiny companies where founder quality dominates everything.

3. **Labels lie.** Every company says "engineering-driven." Digging into what employees actually mean by that reveals completely different work environments. If you're evaluating job offers, don't compare labels. Compare the *behaviors* behind them.

---

*The data behind this analysis is available at [JobsByCulture](https://jobsbyculture.com), where we maintain culture profiles and live job data for 40 AI & tech companies. If you're researching companies or building something similar, the [culture directory](https://jobsbyculture.com/directory) is a good starting point.*

*All analysis code is available as a [Jupyter notebook](https://github.com/saipradeep77/jobsbyculture-analysis) (link will be added before publication).*
