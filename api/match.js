// Vercel serverless: ten sam matcher co w server.js, tylko bez własnego HTTP.
import { handleMatch } from '../server.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    // Vercel parsuje JSON sam, ale przy innym content-type dostajemy string
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};
    return res.status(200).json(await handleMatch(body));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
}
