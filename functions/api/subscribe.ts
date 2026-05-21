interface Env {
  DB: D1Database;
  RESEND_API_KEY: string;
}

const NOTIFY_EMAIL = 'erikov@hey.com';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const formData = await request.formData();
    const email = formData.get('email')?.toString().trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        html('Invalid email address.', false),
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      );
    }

    const result = await env.DB.prepare(
      'INSERT OR IGNORE INTO subscribers (email) VALUES (?)'
    ).bind(email).run();

    // Notify on new subscriber (not duplicates)
    if (result.meta.changes > 0 && env.RESEND_API_KEY) {
      const count = await env.DB.prepare(
        'SELECT COUNT(*) as total FROM subscribers'
      ).first<{ total: number }>();

      context.waitUntil(
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'by.erikov.me <onboarding@resend.dev>',
            to: NOTIFY_EMAIL,
            subject: `New subscriber: ${email}`,
            text: `${email} just subscribed to by.erikov.me\n\nTotal subscribers: ${count?.total ?? '?'}`,
          }),
        })
      );
    }

    return new Response(
      html('You\'re in. Thanks for subscribing.', true),
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  } catch {
    return new Response(
      html('Something went wrong. Try again.', false),
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
};

function html(message: string, success: boolean): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${success ? 'Subscribed' : 'Error'} — by.erikov.me</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root { --surface: #f4f3f0; --ink: #2f2e2b; --ink-3: #908d87; --accent: #ffb424; --grid-dot: #d8d7d4; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--surface); min-height: 100vh; }
  body { font-family: "Inter Tight", sans-serif; color: var(--ink); -webkit-font-smoothing: antialiased; }
  body::before { content: ''; position: fixed; inset: 0; background-image: radial-gradient(circle, var(--grid-dot) .8px, transparent .8px); background-size: 20px 20px; pointer-events: none; z-index: -1; }
  .wrap { max-width: 480px; margin: 0 auto; padding: 6rem 24px; text-align: center; }
  .dot { width: 12px; height: 12px; border-radius: 50%; background: ${success ? 'var(--accent)' : 'var(--ink-3)'}; display: inline-block; margin-bottom: 1rem; }
  p { font-size: 1.1rem; line-height: 1.6; margin: 0 0 1.5rem; }
  a { color: var(--ink); text-decoration-color: var(--accent); text-underline-offset: 3px; text-decoration-thickness: 2px; }
</style>
</head>
<body>
<div class="wrap">
  <span class="dot"></span>
  <p>${message}</p>
  <a href="/">← back to blog</a>
</div>
</body>
</html>`;
}
