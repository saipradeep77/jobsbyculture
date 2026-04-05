export const config = { runtime: 'edge' };

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function generateManageKey(slug, email) {
  var data = new TextEncoder().encode(slug + email + 'culture-cards-secret');
  var hash = await crypto.subtle.digest('SHA-256', data);
  var hex = Array.from(new Uint8Array(hash)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  return hex.substring(0, 16);
}

function buildWelcomeEmailHtml({ name, cardTitle, manageUrl, email, password }) {
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
              <p style="margin:0 0 8px 0;font-size:14px;font-weight:600;color:#0d9488;text-transform:uppercase;letter-spacing:0.5px;">Your card is ready!</p>
              <h1 style="margin:0 0 16px 0;font-size:28px;font-weight:700;color:#1a1a1f;line-height:1.25;">Hi ${escapeHtml(name)},</h1>
              <p style="margin:0 0 28px 0;font-size:16px;color:#52525b;line-height:1.6;">Your card <strong>&ldquo;${escapeHtml(cardTitle)}&rdquo;</strong> is ready! Share the link with your team to start collecting messages.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 28px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#e8590c,#d64f09);border-radius:12px;padding:16px 36px;">
                    <a href="${manageUrl}" target="_blank" style="color:#ffffff;font-size:18px;font-weight:700;text-decoration:none;display:inline-block;">Manage Your Card &rarr;</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${password ? `<tr>
            <td style="padding:0 40px 28px 40px;">
              <div style="background-color:#f5f5f0;border-radius:12px;padding:20px 24px;border:1px solid #e5e5e5;">
                <p style="margin:0 0 12px 0;font-size:14px;font-weight:600;color:#1a1a1f;">Your account details</p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;color:#52525b;">
                  <tr>
                    <td style="padding:4px 0;"><strong>Email:</strong></td>
                    <td style="padding:4px 0 4px 12px;">${escapeHtml(email)}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;"><strong>Password:</strong></td>
                    <td style="padding:4px 0 4px 12px;font-family:monospace;background:#fff;padding:4px 8px;border-radius:4px;border:1px solid #e5e5e5;">${escapeHtml(password)}</td>
                  </tr>
                </table>
                <p style="margin:12px 0 0 0;font-size:13px;color:#9ca3af;line-height:1.5;">Use these to log in at <a href="https://jobsbyculture.com/culture-cards/dashboard" style="color:#0d9488;text-decoration:none;">jobsbyculture.com/culture-cards/dashboard</a></p>
              </div>
            </td>
          </tr>` : ''}
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
              <p style="margin:0;font-size:12px;color:#9ca3af;">You received this because you created a Culture Card.</p>
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
    const body = await request.json();
    const { email, name, password, cardSlug, cardTitle, creatorEmail } = body;

    if (!email || !cardSlug || !cardTitle) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generate signed manage URL
    const manageKey = await generateManageKey(cardSlug, creatorEmail || email);
    const manageUrl = `https://jobsbyculture.com/culture-cards/c/${cardSlug}?key=${manageKey}`;

    // Send welcome email via Resend
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Culture Cards <hello@jobsbyculture.com>',
        to: email,
        subject: `Your Culture Card "${cardTitle}" has been created!`,
        html: buildWelcomeEmailHtml({
          name: name || 'there',
          cardTitle,
          manageUrl,
          email,
          password,
        }),
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error('Resend error:', errText);
      return new Response(JSON.stringify({ error: 'Failed to send email' }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, manageUrl }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Welcome email error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
