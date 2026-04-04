import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SK);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { cardId, cardSlug } = req.body;

    if (!cardId || !cardSlug) {
      return res.status(400).json({ error: 'Missing cardId or cardSlug' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: 599,
            product_data: {
              name: 'Culture Cards Premium — Unlock themes, PDF download, email delivery',
            },
          },
          quantity: 1,
        },
      ],
      success_url: `https://jobsbyculture.com/culture-cards/c/${cardSlug}?paid=true`,
      cancel_url: `https://jobsbyculture.com/culture-cards/c/${cardSlug}`,
      metadata: { cardId, cardSlug },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
