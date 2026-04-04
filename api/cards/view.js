import { readFileSync } from 'fs';
import { join } from 'path';

export default function handler(req, res) {
    const html = readFileSync(join(process.cwd(), 'culture-cards', 'view.html'), 'utf-8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
}
