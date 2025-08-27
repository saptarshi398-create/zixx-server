const crypto = require('crypto');
const axios = require('axios');
const { OrderModel } = require('../models/order.model');
const { UserModel } = require('../models/users.model');
const { sendOrderReceipt } = require('../utils/mailer');

// GET /clients/payments/razorpay/key
exports.getRazorpayKey = async (req, res) => {
  try {
    const key = process.env.RAZORPAY_KEY_ID;
    if (!key) return res.status(500).json({ ok: false, msg: 'Razorpay key not configured' });
    return res.json({ ok: true, key });
  } catch (err) {
    return res.status(500).json({ ok: false, msg: err.message || 'Server error' });
  }
};

// POST /admin/orders/:id/refund (admin only)
// body: { amount?: number }
exports.adminRefundOrder = async (req, res) => {
  try {
    // adminMiddleware should already guard this route
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_SECRET;
    if (!key_id || !key_secret) {
      return res.status(500).json({ ok: false, msg: 'Razorpay credentials not configured' });
    }

    const { id } = req.params;
    const { amount } = req.body || {};
    const order = await OrderModel.findById(id);
    if (!order) return res.status(404).json({ ok: false, msg: 'Order not found' });
    const paymentId = order?.paymentDetails?.transactionId;
    if (!paymentId) return res.status(400).json({ ok: false, msg: 'No payment found on order to refund' });

    const auth = Buffer.from(`${key_id}:${key_secret}`).toString('base64');
    const rpRes = await axios.post(
      `https://api.razorpay.com/v1/payments/${paymentId}/refund`,
      amount ? { amount: Math.round(amount * 100) } : {},
      { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' } }
    );

    // Mark order as refunded/cancelled for admin visibility (use enum-safe values)
    const refundId = rpRes?.data?.id || 'unknown';
    const refundAmountInInr = rpRes?.data?.amount ? rpRes.data.amount / 100 : undefined; // paise -> INR
    const adminNote = `Admin refund initiated (id=${refundId}${refundAmountInInr != null ? `, amount=${refundAmountInInr}` : ''})`;
    order.adminNotes = order.adminNotes ? `${order.adminNotes} | ${adminNote}` : adminNote;
    order.status = 'cancelled';
    // With updated schema enums, mark both top-level and nested payment statuses as 'refunded'
    order.paymentStatus = 'refunded';
    order.paymentDetails = order.paymentDetails || {};
    order.paymentDetails.paymentStatus = 'refunded';
    order.updatedAt = new Date();
    await order.save();

    return res.json({ ok: true, msg: 'Admin refund initiated', refund: rpRes.data, order });
  } catch (err) {
    // Treat fully-refunded case as idempotent success by updating local order state
    try {
      const alreadyRefundedMsg = (err?.response?.data?.error?.description || err?.message || '').toString();
      const isAlreadyRefunded = alreadyRefundedMsg.toLowerCase().includes('fully refunded already');
      if (isAlreadyRefunded) {
        const { id } = req.params;
        const order = await OrderModel.findById(id);
        if (order) {
          const adminNote = `Admin refund: already fully refunded at provider`;
          order.adminNotes = order.adminNotes ? `${order.adminNotes} | ${adminNote}` : adminNote;
          order.status = 'cancelled';
          order.paymentStatus = 'refunded';
          order.paymentDetails = order.paymentDetails || {};
          order.paymentDetails.paymentStatus = 'refunded';
          order.updatedAt = new Date();
          await order.save();
          return res.json({ ok: true, msg: 'Payment already fully refunded. Local order updated.', order });
        }
      }
    } catch (ignore) {}

    // Normalize error message to a human-readable string
    let msg = 'Admin refund failed';
    if (err?.response?.data) {
      const data = err.response.data;
      if (typeof data === 'string') msg = data;
      else if (data.error && (data.error.description || data.error.reason)) msg = data.error.description || data.error.reason;
      else msg = JSON.stringify(data);
    } else if (err?.message) {
      msg = err.message;
    }
    return res.status(500).json({ ok: false, msg });
  }
};

// POST /clients/payments/razorpay/webhook
// Raw body required. Validate 'x-razorpay-signature'. Update order by razorpay_order_id.
exports.handleRazorpayWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) return res.status(500).json({ ok: false, msg: 'Webhook secret not configured' });

    const signature = req.headers['x-razorpay-signature'];
    const payload = req.body; // raw parsed as Buffer by express.raw in route; convert to string for signature

    const body = req.rawBody || (Buffer.isBuffer(payload) ? payload : Buffer.from(JSON.stringify(payload)));
    const expected = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');
    if (expected !== signature) {
      console.warn(`[${new Date().toISOString()}] Razorpay webhook signature mismatch`, {
        path: req.originalUrl,
        providedSignature: signature,
        expectedSignature: expected,
        userAgent: req.headers['user-agent']
      });
      return res.status(400).json({ ok: false, msg: 'Invalid webhook signature' });
    }

    const event = JSON.parse(body.toString());
    const type = event?.event;
    const payment = event?.payload?.payment?.entity;
    const orderId = payment?.order_id;
    const paymentId = payment?.id;
    const amount = payment?.amount ? payment.amount / 100 : undefined;

    if (!orderId) {
      return res.json({ ok: true, msg: 'No order_id in webhook payload, ignored' });
    }

    const order = await OrderModel.findOne({ 'paymentDetails.razorpay_order_id': orderId });
    if (!order) {
      return res.json({ ok: true, msg: 'Order not found for webhook order_id, ignored' });
    }

    if (type === 'payment.authorized' || type === 'payment.captured') {
      order.paymentStatus = 'paid';
      order.paymentDetails.paymentStatus = 'completed';
      if (amount) order.paymentDetails.paymentAmount = amount;
      order.paymentDetails.transactionId = paymentId || order.paymentDetails.transactionId;
      order.paymentDetails.provider = 'razorpay';
      order.paymentDetails.razorpay_order_id = orderId;
      order.paymentDetails.paymentDate = new Date();
      await order.save();
      // Send receipt email (best-effort)
      try {
        const user = await UserModel.findById(order.userId);
        await sendOrderReceipt(user?.email, order);
      } catch (e) {
        console.error('Webhook: failed to send receipt email:', e?.message || e);
      }
      return res.json({ ok: true, msg: 'Order updated to paid via webhook' });
    }

    if (type === 'payment.failed') {
      order.paymentDetails.paymentStatus = 'failed';
      await order.save();
      return res.json({ ok: true, msg: 'Order marked payment failed via webhook' });
    }

    return res.json({ ok: true, msg: 'Webhook received (no action for this event)' });
  } catch (err) {
    return res.status(500).json({ ok: false, msg: err.message || 'Webhook handling failed' });
  }
};

// POST /clients/payments/razorpay/refund
// body: { orderId: string, amount?: number }
exports.createRazorpayRefund = async (req, res) => {
  try {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_SECRET;
    if (!key_id || !key_secret) {
      return res.status(500).json({ ok: false, msg: 'Razorpay credentials not configured' });
    }

    const { orderId, amount } = req.body || {};
    if (!orderId) return res.status(400).json({ ok: false, msg: 'orderId is required' });

    const order = await OrderModel.findOne({ _id: orderId, userId: req.userid });
    if (!order) return res.status(404).json({ ok: false, msg: 'Order not found' });
    const paymentId = order?.paymentDetails?.transactionId;
    if (!paymentId) return res.status(400).json({ ok: false, msg: 'No payment found on order to refund' });

    const auth = Buffer.from(`${key_id}:${key_secret}`).toString('base64');
    const rpRes = await axios.post(
      `https://api.razorpay.com/v1/payments/${paymentId}/refund`,
      amount ? { amount: Math.round(amount * 100) } : {},
      { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' } }
    );

    // Update local order status
    order.status = 'cancelled';
    order.paymentDetails.paymentStatus = 'completed'; // refund created; Razorpay refunds have their own status tracking
    order.adminNotes = `Refund initiated: ${rpRes.data?.id || 'unknown'}`;
    await order.save();

    return res.json({ ok: true, msg: 'Refund initiated', refund: rpRes.data });
  } catch (err) {
    const msg = err?.response?.data || err.message || 'Refund initiation failed';
    return res.status(500).json({ ok: false, msg });
  }
};

// POST /clients/payments/razorpay/order
// body: { amountInPaise: number, currency?: string, receipt?: string, notes?: object }
exports.createRazorpayOrder = async (req, res) => {
  try {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_SECRET;
    if (!key_id || !key_secret) {
      return res.status(500).json({ ok: false, msg: 'Razorpay credentials not configured' });
    }

    const { amountInPaise, currency = 'INR', receipt = `rcpt_${Date.now()}`, notes = {} } = req.body || {};
    if (!amountInPaise || amountInPaise <= 0) {
      return res.status(400).json({ ok: false, msg: 'Invalid amount' });
    }

    const auth = Buffer.from(`${key_id}:${key_secret}`).toString('base64');

    const rpRes = await axios.post(
      'https://api.razorpay.com/v1/orders',
      { amount: amountInPaise, currency, receipt, notes: { ...notes, userId: req.userid } },
      { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' } }
    );

    return res.json({ ok: true, order: rpRes.data });
  } catch (err) {
    const msg = err?.response?.data || err.message || 'Failed to create Razorpay order';
    return res.status(500).json({ ok: false, msg });
  }
};

// POST /clients/payments/razorpay/verify
// body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
exports.verifyRazorpaySignature = async (req, res) => {
  try {
    const key_secret = process.env.RAZORPAY_SECRET;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

    if (!key_secret) return res.status(500).json({ ok: false, msg: 'Razorpay secret not configured' });
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ ok: false, msg: 'Missing required fields' });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', key_secret)
      .update(body)
      .digest('hex');

    const isValid = expectedSignature === razorpay_signature;
    if (!isValid) return res.status(400).json({ ok: false, msg: 'Invalid signature' });

    return res.json({ ok: true, msg: 'Payment verified' });
  } catch (err) {
    return res.status(500).json({ ok: false, msg: err.message || 'Verification failed' });
  }
};
