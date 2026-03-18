import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const jobs = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/jobs-fetched.json'), 'utf8'));

function extractJobId(url) {
    let m = url.match(/gh_jid=(\d+)/);
    if (m) return m[1];
    m = url.match(/\/jobs\/(\d+)/);
    if (m) return m[1];
    m = url.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (m) return m[1];
    m = url.match(/lever\.co\/[^/]+\/([0-9a-f-]{36})/i);
    if (m) return m[1];
    m = url.match(/\/j\/([A-Za-z0-9]+)/);
    if (m) return m[1];
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
        hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
    }
    return 'h' + Math.abs(hash).toString(36);
}

const byCompany = {};
for (const j of jobs) {
    if (!byCompany[j.company]) byCompany[j.company] = [];
    byCompany[j.company].push({
        id: extractJobId(j.url),
        title: j.title,
        location: j.location || 'Remote',
        url: j.url,
        department: j.department || '',
    });
}

fs.writeFileSync(path.join(ROOT, 'data/company-jobs.json'), JSON.stringify(byCompany));
console.log(`✓ Generated company-jobs.json: ${Object.keys(byCompany).length} companies, ${jobs.length} jobs`);
