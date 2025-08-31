const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { OTPModel } = require('../models/otp.model');
const { UserModel } = require('../models/users.model.js');
const { sendEmail } = require('../utils/mailer');
const { sendSMS } = require('../utils/sms');

const OTP_EXP_MIN = Number(process.env.OTP_EXP_MIN || 5);
const RESEND_COOLDOWN_SEC = Number(process.env.OTP_RESEND_COOLDOWN_SEC || 60);
const MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOtp(target, channel) {
  const requestId = uuidv4();
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_EXP_MIN * 60 * 1000);

  // Optional: enforce cooldown per target by checking latest doc
  const last = await OTPModel.findOne({ target, channel }).sort({ createdAt: -1 }).lean();
  if (last && last.createdAt && Date.now() - new Date(last.createdAt).getTime() < RESEND_COOLDOWN_SEC * 1000) {
    const waitSec = Math.ceil((RESEND_COOLDOWN_SEC * 1000 - (Date.now() - new Date(last.createdAt).getTime())) / 1000);
    return { ok: false, status: 429, msg: `Please wait ${waitSec}s before requesting another OTP.` };
  }

  await OTPModel.create({ requestId, target, channel, codeHash, expiresAt });

  const brand = process.env.BRAND_NAME || 'Zixx';
  const message = `${brand} verification code: ${code}. It expires in ${OTP_EXP_MIN} minutes.`;

  let sent = false;
  if (channel === 'email') {
    const html = `
      <div style="background:#f6f7fb;padding:24px;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6e8ef;">
          <tr>
            <td style="padding:20px 24px;background:#111;color:#fff;font-weight:700;font-size:18px;">
              ${brand}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 24px 8px 24px;">
              <h1 style="margin:0 0 8px 0;font-size:20px;">Your verification code</h1>
              <p style="margin:0;color:#4b5563;font-size:14px;">Use this code to verify your email. This code expires in ${OTP_EXP_MIN} minutes.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 24px 24px;text-align:center;">
              <div style="display:inline-block;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 18px;letter-spacing:6px;font-weight:800;font-size:28px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">
                ${code}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 24px 24px;color:#6b7280;font-size:12px;">
              <p style="margin:0">If you did not request this, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background:#f9fafb;color:#6b7280;font-size:12px;border-top:1px solid #e6e8ef;">
              <p style="margin:0">© ${new Date().getFullYear()} ${brand}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </div>`;
    sent = await sendEmail(target, `${brand} Verification Code`, message, html);
  } else {
    sent = await sendSMS(target, message);
  }
  if (!sent) return { ok: false, status: 500, msg: 'Failed to send OTP. Try again later.' };

  return { ok: true, data: { requestId, cooldownSec: RESEND_COOLDOWN_SEC } };
}

async function verifyOtp(requestId, code, channel) {
  const rec = await OTPModel.findOne({ requestId, channel });
  if (!rec) return { ok: false, status: 400, msg: 'Invalid request.' };
  if (rec.used) return { ok: false, status: 400, msg: 'OTP already used.' };
  if (new Date() > new Date(rec.expiresAt)) return { ok: false, status: 400, msg: 'OTP expired.' };
  if (rec.attempts >= MAX_ATTEMPTS) return { ok: false, status: 429, msg: 'Too many attempts.' };

  const match = await bcrypt.compare(code, rec.codeHash);
  if (!match) {
    await OTPModel.updateOne({ _id: rec._id }, { $inc: { attempts: 1 } });
    return { ok: false, status: 400, msg: 'Incorrect OTP.' };
  }

  await OTPModel.updateOne({ _id: rec._id }, { $set: { used: true } });

  // Issue a short-lived verification token
  const token = jwt.sign({ kind: 'otp-verify', channel, target: rec.target }, process.env.JWT_SECRET, { expiresIn: '10m' });
  return { ok: true, data: { verified: true, token, target: rec.target } };
}

// Express handlers
exports.sendEmailOtp = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ ok: false, msg: 'Email required' });
    const normalized = String(email).toLowerCase().trim();
    // Prevent sending OTP for already registered emails
    try {
      const existing = await UserModel.findOne({ email: normalized }).lean();
      if (existing) {
        return res.status(409).json({ ok: false, msg: 'Email already registered. Please login instead.' });
      }
    } catch (e) {
      // if check fails, do not block; log and continue
      console.error('[sendEmailOtp] user existence check failed:', e?.message || e);
    }
    const out = await sendOtp(normalized, 'email');
    return res.status(out.status || (out.ok ? 200 : 400)).json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, msg: 'Server error', error: e.message });
  }
};

exports.verifyEmailOtp = async (req, res) => {
  try {
    const { requestId, code } = req.body || {};
    if (!requestId || !code) return res.status(400).json({ ok: false, msg: 'requestId and code required' });
    const out = await verifyOtp(requestId, String(code).trim(), 'email');
    return res.status(out.status || (out.ok ? 200 : 400)).json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, msg: 'Server error', error: e.message });
  }
};

exports.sendPhoneOtp = async (req, res) => {
  try {
    const { phone } = req.body || {};
    if (!phone) return res.status(400).json({ ok: false, msg: 'Phone required' });
    const normalized = String(phone).trim();
    const out = await sendOtp(normalized, 'phone');
    return res.status(out.status || (out.ok ? 200 : 400)).json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, msg: 'Server error', error: e.message });
  }
};

exports.verifyPhoneOtp = async (req, res) => {
  try {
    const { requestId, code } = req.body || {};
    if (!requestId || !code) return res.status(400).json({ ok: false, msg: 'requestId and code required' });
    const out = await verifyOtp(requestId, String(code).trim(), 'phone');
    return res.status(out.status || (out.ok ? 200 : 400)).json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, msg: 'Server error', error: e.message });
  }
};

// Resend email verification OTP for the currently authenticated user
// Requires authenticator middleware to populate req.user
exports.resendEmailVerificationForUser = async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.email) {
      return res.status(401).json({ ok: false, msg: 'Unauthorized' });
    }
    // Optionally block if already verified
    try {
      const found = await UserModel.findById(user.userid || user._id).lean();
      if (found && found.emailVerified) {
        return res.status(400).json({ ok: false, msg: 'Email already verified' });
      }
    } catch {}

    const normalized = String(user.email).toLowerCase().trim();
    const out = await sendOtp(normalized, 'email');
    return res.status(out.status || (out.ok ? 200 : 400)).json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, msg: 'Server error', error: e.message });
  }
};
