export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://quyxzwouqlrfvpsexwbh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7g5dGcIUkN4OxJJ2gnlYEA_XkyDtN8p';

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildEmailHtml({ title, teamName, messageCount, slug }) {
  const cardUrl = `https://jobsbyculture.com/culture-cards/c/${slug}`;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f5f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f0;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr><td style="height:5px;background:linear-gradient(90deg,#e8590c,#0d9488);font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:32px 40px 0 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:14px;height:14px;border-radius:50%;background-color:#e8590c;" width="14" height="14">&nbsp;</td>
                  <td style="padding-left:10px;font-size:18px;font-weight:700;color:#52525b;">Culture Cards</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px 16px 40px;">
              <p style="margin:0 0 8px 0;font-size:14px;font-weight:600;color:#e8590c;text-transform:uppercase;letter-spacing:0.5px;">You received a Culture Card</p>
              <h1 style="margin:0 0 16px 0;font-size:28px;font-weight:700;color:#1a1a1f;line-height:1.25;">${escapeHtml(title)}</h1>
              ${teamName ? `<p style="margin:0 0 8px 0;font-size:16px;color:#52525b;line-height:1.5;">From <strong>${escapeHtml(teamName)}</strong></p>` : ''}
              <p style="margin:0 0 28px 0;font-size:16px;color:#52525b;line-height:1.5;">${messageCount} message${messageCount === 1 ? '' : 's'} from your team</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 36px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#e8590c,#d64f09);border-radius:12px;padding:16px 36px;">
                    <a href="${cardUrl}" target="_blank" style="color:#ffffff;font-size:18px;font-weight:700;text-decoration:none;display:inline-block;">Open Your Card &rarr;</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="padding:0 40px;"><div style="height:1px;background-color:#e5e5e5;"></div></td></tr>
          <tr>
            <td style="padding:24px 40px 32px 40px;">
              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;">Sent with <a href="https://jobsbyculture.com/culture-cards?ref=email" style="color:#0d9488;text-decoration:none;">Culture Cards</a> by JobsByCulture</p>
            </td>
          </tr>
        </table>
        <table role="presentation" width="560" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:20px 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">You received this because someone on your team sent you a Culture Card.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { cardId, cardSlug, recipientEmail, recipientName } = await request.json();

    if (!cardId || !cardSlug || !recipientEmail) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch card from Supabase via REST API
    const cardRes = await fetch(
      `${SUPABASE_URL}/rest/v1/cards?id=eq.${cardId}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    const cards = await cardRes.json();
    const card = cards[0];

    if (!card) {
      return new Response(JSON.stringify({ error: 'Card not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!card.is_paid) {
      return new Response(JSON.stringify({ error: 'Card payment not completed' }), {
        status: 402, headers: { 'Content-Type': 'application/json' },
      });
    }

    // If scheduled for the future, don't send yet
    if (card.scheduled_at && new Date(card.scheduled_at) > new Date()) {
      return new Response(JSON.stringify({ scheduled: true, scheduled_at: card.scheduled_at }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Count messages via REST API
    const msgRes = await fetch(
      `${SUPABASE_URL}/rest/v1/messages?card_id=eq.${cardId}&select=id`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'count=exact',
        },
      }
    );
    const messageCount = parseInt(msgRes.headers.get('content-range')?.split('/')[1] || '0');

    // Send email via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Culture Cards <hello@jobsbyculture.com>',
        to: recipientEmail,
        subject: `🎉 You received a Culture Card: ${card.title}`,
        html: buildEmailHtml({
          title: card.title,
          teamName: card.team_name || 'Your Team',
          messageCount: messageCount,
          slug: cardSlug,
        }),
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error('Resend error:', err);
      return new Response(JSON.stringify({ error: 'Failed to send email' }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Mark card as sent
    await fetch(
      `${SUPABASE_URL}/rest/v1/cards?id=eq.${cardId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ is_sent: true }),
      }
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Send error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
