const submitContactMessage = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body || {};

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }

    const emailOk = /.+@.+\..+/.test(email);
    if (!emailOk) {
      return res.status(400).json({ ok: false, error: 'Invalid email' });
    }

    // Twilio SMS removed
    let emailSent = false;
    let emailMessageId = undefined;
    let emailError = undefined;

    // SMS sending removed

    // SMTP Email via nodemailer (optional)
    try {
      const SMTP_HOST = process.env.SMTP_HOST;
      const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
      const SMTP_SECURE = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
      const SMTP_USER = process.env.SMTP_USER;
      const SMTP_PASS = process.env.SMTP_PASS;
      const SMTP_FROM = process.env.SMTP_FROM || (SMTP_USER ? `${SMTP_USER}` : undefined);
      const CONTACT_RECEIVER_EMAIL = process.env.CONTACT_RECEIVER_EMAIL || process.env.SMTP_TO;

      if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && SMTP_FROM && CONTACT_RECEIVER_EMAIL) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: SMTP_HOST,
          port: SMTP_PORT,
          secure: SMTP_SECURE, // true for 465, false for others
          auth: { user: SMTP_USER, pass: SMTP_PASS },
        });

        try {
          // Preflight verify for clearer error messages
          await transporter.verify();
        } catch (verr) {
          emailError = verr && (verr.response || verr.message || String(verr));
          console.warn('[contact.controller] SMTP verify failed:', emailError);
          // fallthrough to still try sendMail, as some servers fail verify but allow send
        }

        const mailOptions = {
          from: SMTP_FROM,
          to: CONTACT_RECEIVER_EMAIL,
          replyTo: email, // so you can reply directly to the sender
          subject: `[Contact] ${subject}`,
          text: `New contact message\n\nFrom: ${name} <${email}>\nSubject: ${subject}\n\n${message}`,
          html: `
            <div style="font-family:Arial,Helvetica,sans-serif; line-height:1.6; color:#111;">
              <div style="padding:16px; border:1px solid #eee; border-radius:8px; max-width:640px; margin:auto;">
                <h2 style="margin:0 0 12px 0; color:#222;">New contact message</h2>
                <table style="width:100%; border-collapse:collapse; margin-bottom:16px;">
                  <tr>
                    <td style="padding:8px; background:#f7f7f7; width:140px; font-weight:bold;">Name</td>
                    <td style="padding:8px;">${name}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px; background:#f7f7f7; width:140px; font-weight:bold;">Email</td>
                    <td style="padding:8px;">${email}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px; background:#f7f7f7; width:140px; font-weight:bold;">Subject</td>
                    <td style="padding:8px;">${subject}</td>
                  </tr>
                </table>
                <div style="white-space:pre-wrap; padding:12px; border:1px solid #eee; border-radius:6px; background:#fafafa;">
                  ${message}
                </div>
              </div>
              <p style="text-align:center; color:#888; font-size:12px; margin-top:12px;">Sent automatically from Zixx contact form</p>
            </div>
          `,
        };

        const info = await transporter.sendMail(mailOptions);
        emailSent = Boolean(info?.messageId);
        emailMessageId = info?.messageId;
      } else {
        console.warn('[contact.controller] SMTP not fully configured. Skipping email send.');
      }
    } catch (e) {
      emailError = e?.response || e?.message || String(e);
      console.warn('[contact.controller] SMTP send failed:', emailError);
    }

    return res.status(200).json({ ok: true, emailSent, emailMessageId, emailError });
  } catch (error) {
    console.error('[contact.controller] unexpected error', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

module.exports = { submitContactMessage };
