import fs from 'fs';
import path from 'path';

const COMPANIES_DIR = 'companies';
const files = fs.readdirSync(COMPANIES_DIR).filter(f => f.endsWith('.html'));

// CSS for highlight card
const highlightCSS = `
        .cp-job-highlight { border: 2px solid #e8590c !important; background: rgba(232,89,12,0.03) !important; position: relative; }
        .cp-job-highlight:hover { border-color: #c2410c !important; }
        .cp-job-badge { display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #e8590c; background: rgba(232,89,12,0.08); border: 1px solid rgba(232,89,12,0.2); padding: 3px 10px; border-radius: 100px; margin-bottom: 8px; }
`;

let count = 0;
for (const file of files) {
    const slug = file.replace('.html', '');
    const fp = path.join(COMPANIES_DIR, file);
    let html = fs.readFileSync(fp, 'utf8');

    // Check if this file has the job script (old or new format)
    if (!html.includes('COMPANY_JOBS') && !html.includes('COMPANY_SLUG')) {
        console.log('SKIP (no job script): ' + file);
        continue;
    }

    // 1. Add highlight CSS before </style>
    if (!html.includes('cp-job-highlight')) {
        html = html.replace('</style>', highlightCSS + '\n    </style>');
    }

    // 2. Replace the jobs section description with search box
    // Handle the previous format with expandJobsBtn
    html = html.replace(
        /<p class="s-desc"><span id="jobCount">[^<]*<\/span> open positions\.<\/p>[\s\S]*?<div id="jobSearchWrap"[^>]*><input id="jobSearch"[^>]*><\/div>/,
        '<p class="s-desc"><span id="jobCount">...</span> open positions.</p>\n\n        <div id="jobSearchWrap" style="margin-bottom:20px;"><input id="jobSearch" type="text" placeholder="Search by job title, location, or department..." style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid rgba(0,0,0,0.12);font-size:14px;font-family:inherit;outline:none;background:#fff;" onfocus="this.style.borderColor=\'#e8590c\';this.style.boxShadow=\'0 0 0 3px rgba(232,89,12,0.06)\'" onblur="this.style.borderColor=\'rgba(0,0,0,0.12)\';this.style.boxShadow=\'none\'"></div>'
    );

    // Also handle pages that still have the original "Explore featured roles" text
    html = html.replace(
        /<p class="s-desc">Explore featured roles below[^<]*<\/p>/,
        '<p class="s-desc"><span id="jobCount">...</span> open positions.</p>\n\n        <div id="jobSearchWrap" style="margin-bottom:20px;"><input id="jobSearch" type="text" placeholder="Search by job title, location, or department..." style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid rgba(0,0,0,0.12);font-size:14px;font-family:inherit;outline:none;background:#fff;" onfocus="this.style.borderColor=\'#e8590c\';this.style.boxShadow=\'0 0 0 3px rgba(232,89,12,0.06)\'" onblur="this.style.borderColor=\'rgba(0,0,0,0.12)\';this.style.boxShadow=\'none\'"></div>'
    );

    // 3. Add id to CTA div and update text
    html = html.replace(
        /<div class="cp-cta-center">/,
        '<div class="cp-cta-center" id="jobsCta">'
    );

    // 4. Replace the entire script block
    const newScript = `<script>
var COMPANY_SLUG = '${slug}';
var COMPANY_NAME = document.querySelector('.cp-hero h1') ? document.querySelector('.cp-hero h1').textContent : '${slug}';
var ALL_JOBS = [];
var HIGHLIGHT_JOB_ID = new URLSearchParams(window.location.search).get('job') || '';

fetch('/data/company-jobs.json')
  .then(function(r) { return r.json(); })
  .then(function(data) {
    ALL_JOBS = data[COMPANY_SLUG] || [];
    renderJobs('');
  })
  .catch(function() {
    document.getElementById('jobsGrid').innerHTML = '<p style="color:#9ca3af;font-size:14px;">Unable to load jobs. <a href="/jobs?company=' + COMPANY_SLUG + '" style="color:#e8590c;">Browse all jobs \\u2192</a></p>';
  });

function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function jobCard(job, isHighlight) {
    return '<a class="cp-job-card' + (isHighlight ? ' cp-job-highlight' : '') + '" href="' + job.url + '" target="_blank" rel="noopener">' +
        '<div>' +
            '<div class="cp-job-title">' + escHtml(job.title) + '</div>' +
            '<div class="cp-job-location">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
                escHtml(job.location) +
            '</div>' +
        '</div>' +
        '<div class="cp-job-apply">Apply \\u2192</div>' +
    '</a>';
}

function renderJobs(query) {
    var grid = document.getElementById('jobsGrid');
    var q = (query || '').toLowerCase().trim();
    var searchBox = document.getElementById('jobSearchWrap');
    var jobCount = document.getElementById('jobCount');
    var ctaCenter = document.getElementById('jobsCta');

    var filtered = ALL_JOBS;
    if (q) {
        filtered = ALL_JOBS.filter(function(job) {
            return job.title.toLowerCase().indexOf(q) !== -1 ||
                   job.location.toLowerCase().indexOf(q) !== -1 ||
                   (job.department && job.department.toLowerCase().indexOf(q) !== -1);
        });
    }

    // Find the highlighted job
    var highlighted = null;
    var rest = [];
    for (var i = 0; i < filtered.length; i++) {
        if (HIGHLIGHT_JOB_ID && filtered[i].id === HIGHLIGHT_JOB_ID) {
            highlighted = filtered[i];
        } else {
            rest.push(filtered[i]);
        }
    }

    var html = '';

    // Mode 1: Highlight mode — highlighted job + 10 more + browse all CTA
    if (HIGHLIGHT_JOB_ID && highlighted) {
        if (jobCount) jobCount.textContent = ALL_JOBS.length;
        if (searchBox) searchBox.style.display = 'none';

        html = jobCard(highlighted, true);
        var showCount = Math.min(rest.length, 10);
        for (var k = 0; k < showCount; k++) {
            html += jobCard(rest[k], false);
        }
        grid.innerHTML = html;

        if (ctaCenter) {
            ctaCenter.innerHTML = '<a href="/jobs?company=' + COMPANY_SLUG + '" class="btn-primary">Browse all ' + ALL_JOBS.length + ' ' + COMPANY_NAME + ' jobs \\u2192</a>';
        }
        return;
    }

    // Mode 2: Normal mode — all jobs with search
    if (jobCount) jobCount.textContent = filtered.length;
    if (searchBox) searchBox.style.display = 'block';

    for (var j = 0; j < filtered.length; j++) {
        html += jobCard(filtered[j], false);
    }

    if (filtered.length === 0) {
        html = '<p style="color:#9ca3af;font-size:14px;text-align:center;padding:20px 0;">No jobs match your search.</p>';
    }

    grid.innerHTML = html;

    if (ctaCenter) {
        ctaCenter.innerHTML = '<a href="/jobs?company=' + COMPANY_SLUG + '" class="btn-primary">Browse all ' + ALL_JOBS.length + ' ' + COMPANY_NAME + ' jobs \\u2192</a>';
    }
}

var searchInput = document.getElementById('jobSearch');
if (searchInput) {
    var debounceTimer;
    searchInput.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        var val = searchInput.value;
        debounceTimer = setTimeout(function() { renderJobs(val); }, 200);
    });
}
</script>`;

    // Replace old script block (either COMPANY_JOBS or COMPANY_SLUG format)
    html = html.replace(/<script>\s*\n?\s*(?:const COMPANY_JOBS|var COMPANY_SLUG)[\s\S]*?<\/script>/, newScript);

    fs.writeFileSync(fp, html);
    count++;
    console.log('Updated: ' + file + ' (' + slug + ')');
}

console.log('\n✓ Updated ' + count + ' company pages');
