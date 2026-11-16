// Email is optional. Set SMTP_URL (e.g. smtps://user:pass@smtp.example.com) and MAIL_FROM
// to send real mail; otherwise messages are only written to the server log.
let transport;

export async function sendMail(to, subject, text) {
  if (!to) return;
  if (!process.env.SMTP_URL) {
    if (process.env.NODE_ENV !== 'test') console.log(`[mail not sent - SMTP_URL unset] to=${to} subject="${subject}"`);
    return;
  }
  try {
    if (!transport) {
      const { default: nodemailer } = await import('nodemailer');
      transport = nodemailer.createTransport(process.env.SMTP_URL);
    }
    await transport.sendMail({ from: process.env.MAIL_FROM || 'no-reply@teachconnect.local', to, subject, text });
  } catch (err) {
    console.error('Failed to send mail:', err.message);
  }
}
