const SUPABASE_URL = 'https://quyxzwouqlrfvpsexwbh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7g5dGcIUkN4OxJJ2gnlYEA_XkyDtN8p';

// Disable Vercel's default body parsing — Stripe needs the raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawBody = await getRawBody(req);
    const event = JSON.parse(rawBody.toString());

    // MVP: skip Stripe signature verification (add later with STRIPE_WEBHOOK_SECRET)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const cardId = session.metadata?.cardId;

      if (!cardId) {
        console.error('No cardId in session metadata');
        return res.status(400).json({ error: 'Missing cardId in metadata' });
      }

      // Update Supabase: mark card as paid
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/cards?id=eq.${cardId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ is_paid: true }),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        console.error('Supabase update failed:', response.status, text);
        return res.status(500).json({ error: 'Failed to update card status' });
      }

      console.log(`Card ${cardId} marked as paid`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
