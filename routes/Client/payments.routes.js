const express = require('express');
const { authenticator } = require('../../middlewares/authenticator.middleware');
const { 
  getRazorpayKey,
  createRazorpayOrder,
  verifyRazorpaySignature,
  handleRazorpayWebhook,
  createRazorpayRefund
} = require('../../controllers/payments.controller');

const PaymentsRouter = express.Router();

PaymentsRouter.get('/payments/razorpay/key', authenticator, getRazorpayKey);
PaymentsRouter.post('/payments/razorpay/order', authenticator, createRazorpayOrder);
PaymentsRouter.post('/payments/razorpay/verify', authenticator, verifyRazorpaySignature);
// Webhook must NOT require authenticator. Use raw body parser for signature verification.
PaymentsRouter.post(
  '/payments/razorpay/webhook',
  express.raw({ type: 'application/json' }),
  (req, _res, next) => { req.rawBody = req.body; next(); },
  handleRazorpayWebhook
);
// Refund endpoint (authenticated)
PaymentsRouter.post('/payments/razorpay/refund', authenticator, createRazorpayRefund);

// DEV-ONLY: send a sample order receipt email for verification
// Usage: GET /api/clients/payments/test-email?to=email@example.com
// Disabled in production.
try {
  const { sendOrderReceipt } = require('../../utils/mailer');
  if (process.env.NODE_ENV !== 'production') {
    // Simple HTML form to trigger test email (dev-only)
    PaymentsRouter.get('/payments/test-email-form', (req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Test Email Sender</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;padding:24px;background:#0b1020;color:#e8eaf2}
      .card{max-width:560px;margin:0 auto;background:#141a33;border:1px solid #232a4d;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.3);padding:20px}
      h1{font-size:20px;margin:0 0 12px}
      label{display:block;margin:12px 0 6px;color:#c2c8e5}
      input{width:100%;padding:10px 12px;border-radius:8px;border:1px solid #2a335f;background:#0f1430;color:#e8eaf2}
      button{margin-top:14px;padding:10px 14px;border-radius:8px;border:0;background:#4253ff;color:#fff;font-weight:600;cursor:pointer}
      .note{margin-top:12px;color:#9aa3cf;font-size:12px}
      .result{margin-top:16px;white-space:pre-wrap}
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Send Test Email (Dev)</h1>
      <form id="f">
        <label for="to">Recipient email</label>
        <input id="to" name="to" type="email" required placeholder="you@example.com" />
        <button type="submit">Send test receipt</button>
      </form>
      <div class="note">Requires SMTP env configured in backend/.env. Works only in non-production.</div>
      <pre class="result" id="out"></pre>
    </div>
    <script>
      const f = document.getElementById('f');
      const out = document.getElementById('out');
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        out.textContent = 'Sending...';
        const to = document.getElementById('to').value.trim();
        try {
          const res = await fetch('/api/clients/payments/test-email?to=' + encodeURIComponent(to));
          const data = await res.json();
          out.textContent = JSON.stringify(data, null, 2);
        } catch (err) {
          out.textContent = String(err);
        }
      });
    </script>
  </body>
</html>`);
    });
    PaymentsRouter.get('/payments/test-email', async (req, res) => {
      try {
        const to = (req.query.to || '').toString().trim();
        if (!to) return res.status(400).json({ ok: false, msg: 'Query param "to" is required' });
        const order = {
          _id: 'test_' + Date.now(),
          totalAmount: 999,
          paymentStatus: 'paid',
          paymentDetails: { paymentAmount: 999 },
          orderItems: [
            { productName: 'Test Product A', quantity: 1, totalPrice: 499 },
            { productName: 'Test Product B', quantity: 1, totalPrice: 500 },
          ],
        };
        await sendOrderReceipt(to, order);
        return res.json({ ok: true, msg: 'Test email queued (best-effort)', to });
      } catch (e) {
        return res.status(500).json({ ok: false, msg: e?.message || 'Failed to send test email' });
      }
    });
  }
} catch (e) {
  // ignore if mailer not available
}

module.exports = { PaymentsRouter };
