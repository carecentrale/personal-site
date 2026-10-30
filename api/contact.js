// Contact form endpoint: stores the message in Supabase and emails the owner.
// Required env vars (set in Vercel project settings):
//   SUPABASE_URL, SUPABASE_KEY (service role key, server-side only)
//   RESEND_API_KEY, CONTACT_TO (owner email), CONTACT_FROM (verified sender)

const MAX = { name: 100, email: 200, message: 3000 };

function clean(v, max) {
  return String(v || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // Honeypot: real visitors leave this blank.
  if (body.website) return res.status(200).json({ ok: true });

  const name = clean(body.name, MAX.name);
  const email = clean(body.email, MAX.email);
  const message = clean(body.message, MAX.message);

  if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Name, a valid email and a message are required.' });
  }

  const { SUPABASE_URL, SUPABASE_KEY, RESEND_API_KEY, CONTACT_TO, CONTACT_FROM } = process.env;

  try {
    const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/contact_messages`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ name, email, message }),
    });
    if (!dbRes.ok) throw new Error(`db ${dbRes.status}`);

    const mailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: CONTACT_FROM,
        to: [CONTACT_TO],
        reply_to: email,
        subject: `New message from ${name}`,
        text: `From: ${name} <${email}>\n\n${message}`,
      }),
    });
    if (!mailRes.ok) throw new Error(`mail ${mailRes.status}`);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('contact form error', err.message);
    return res.status(500).json({ error: 'Could not send right now.' });
  }
}
