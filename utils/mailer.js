const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
});

async function sendEmail(to, subject, text, html) {
  if (!to) return;
  const from = process.env.SMTP_FROM || 'no-reply@zixx.app';
  try {
    await transporter.sendMail({ from, to, subject, text, html });
    return true;
  } catch (e) {
    console.error('Email send failed:', e?.message || e);
    return false;
  }
}

async function sendOrderReceipt(to, order) {
  if (!to) return;
  const from = process.env.SMTP_FROM || 'no-reply@zixx.app';
  const subject = `Your Zixx order ${order._id} receipt`;
  const amount = order?.paymentDetails?.paymentAmount || order.totalAmount;
  const items = (order.orderItems || []).map(it => `${it.productName} x${it.quantity} - ₹${it.totalPrice}`).join('\n');
  const text = `Thank you for your purchase!\n\nOrder ID: ${order._id}\nAmount: ₹${amount}\nStatus: ${order.paymentStatus}\n\nItems:\n${items}\n\nWe appreciate your business.`;
  const html = `
    <div>
      <h2>Thank you for your purchase!</h2>
      <p><strong>Order ID:</strong> ${order._id}</p>
      <p><strong>Amount:</strong> ₹${amount}</p>
      <p><strong>Status:</strong> ${order.paymentStatus}</p>
      <h3>Items</h3>
      <ul>${(order.orderItems || []).map(it => `<li>${it.productName} x${it.quantity} - ₹${it.totalPrice}</li>`).join('')}</ul>
    </div>
  `;
  try {
    await transporter.sendMail({ from, to, subject, text, html });
  } catch (e) {
    console.error('Email send failed:', e?.message || e);
  }
}

module.exports = { sendOrderReceipt, sendEmail };
