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

async function sendOtp(target, channel, includeLink = true) {
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
  const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/verify-email?email=${encodeURIComponent(target)}&requestId=${requestId}`;
  
  let message, html;
  
  if (includeLink) {
    // For account verification - include both OTP and link
    message = `${brand} verification code: ${code}. It expires in ${OTP_EXP_MIN} minutes.\n\nOr click this link to verify: ${verificationLink}`;
    html = `
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
            <td style="padding:0 24px 24px 24px;text-align:center;">
              <a href="${verificationLink}" 
                 style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; 
                        text-decoration: none; border-radius: 4px; margin: 10px 0 20px 0;">
                Verify Email Now
              </a>
              <p style="color: #666; font-size: 14px; margin-top: 10px;">
                Or copy and paste this link in your browser:<br>
                <span style="color: #4F46E5; word-break: break-all;">${verificationLink}</span>
              </p>
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
  } else {
    // For signup - only OTP, no link
    message = `${brand} verification code: ${code}. It expires in ${OTP_EXP_MIN} minutes.`;
    html = `
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
              <p style="margin:0;color:#4b5563;font-size:14px;">Use this code to complete your registration. This code expires in ${OTP_EXP_MIN} minutes.</p>
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
  }

  let sent = false;
  if (channel === 'email') {
    sent = await sendEmail(target, `${brand} Verification Code`, message, html);
  } else {
    sent = await sendSMS(target, message);
  }
  if (!sent) return { ok: false, status: 500, msg: 'Failed to send OTP. Try again later.' };

  return { ok: true, data: { requestId, cooldownSec: RESEND_COOLDOWN_SEC } };
}

async function verifyOtp(requestId, code, channel, email = null) {
  // Try to find the OTP record by requestId first
  let rec = await OTPModel.findOne({ requestId, channel });
  
  // If no record found by requestId but we have email, try to find the latest unused OTP for this email
  if (!rec && email) {
    rec = await OTPModel.findOne({ 
      target: email.toLowerCase().trim(),
      channel,
      used: false,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });
  }
  
  if (!rec) return { ok: false, status: 400, msg: 'Invalid or expired verification request. Please request a new OTP.' };
  
  // If OTP is already used, check if it was used recently (within 5 minutes)
  if (rec.used) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (new Date(rec.updatedAt) > fiveMinutesAgo) {
      // If OTP was used recently, it might be a duplicate request, so we can still proceed
      // But we'll check if the code matches first
      const match = await bcrypt.compare(code, rec.codeHash);
      if (match) {
        // If the code matches, we can consider this a success (idempotent operation)
        const user = await UserModel.findOne({ email: rec.target }).select('-password -refreshToken').lean();
        return { 
          ok: true, 
          data: { 
            requestId: rec.requestId,
            email: rec.target,
            user: user ? { ...user, emailVerified: true } : null,
            wasAlreadyUsed: true
          } 
        };
      }
    }
    return { ok: false, status: 400, msg: 'This verification code has already been used. Please request a new one.' };
  }
  
  if (new Date() > new Date(rec.expiresAt)) {
    return { 
      ok: false, 
      status: 400, 
      msg: 'Verification code has expired. Please request a new one.' 
    };
  }
  
  if (rec.attempts >= MAX_ATTEMPTS) {
    return { 
      ok: false, 
      status: 429, 
      msg: 'Too many incorrect attempts. Please request a new verification code.' 
    };
  }

  const match = await bcrypt.compare(code, rec.codeHash);
  if (!match) {
    rec.attempts += 1;
    await rec.save();
    return { ok: false, status: 400, msg: 'Invalid code.' };
  }

  rec.used = true;
  await rec.save();
  
  // Generate JWT token for registration verification
  const verifyToken = jwt.sign(
    {
      kind: 'otp-verify',
      channel: channel,
      target: rec.target,
      requestId: rec.requestId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (30 * 60) // 30 minutes
    },
    process.env.JWT_SECRET
  );
  
  // Find the user by email to include in the response
  const user = await UserModel.findOne({ email: rec.target }).select('-password -refreshToken').lean();
  
  return { 
    ok: true, 
    data: { 
      requestId: rec.requestId,
      email: rec.target,
      token: verifyToken,
      user: user ? { ...user, emailVerified: true } : null
    } 
  };
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
    const out = await sendOtp(normalized, 'email', false); // false = no link for signup
    return res.status(out.status || (out.ok ? 200 : 400)).json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, msg: 'Server error', error: e.message });
  }
};

exports.verifyEmailOtp = async (req, res) => {
  try {
    const { requestId, code, email } = req.body || {};
    
    if (!code) {
      return res.status(400).json({ 
        ok: false, 
        msg: 'Verification code is required' 
      });
    }
    
    if (!requestId && !email) {
      return res.status(400).json({ 
        ok: false, 
        msg: 'Either requestId or email is required' 
      });
    }
    
    // Call verifyOtp with both requestId and email
    const out = await verifyOtp(
      requestId || null,
      String(code).trim(),
      'email',
      email || null
    );
    
    return res.status(out.status || (out.ok ? 200 : 400)).json(out);
    
  } catch (e) {
    console.error('Error in verifyEmailOtp:', e);
    return res.status(500).json({ 
      ok: false, 
      msg: 'An error occurred while verifying your code. Please try again.',
      error: process.env.NODE_ENV === 'development' ? e.message : undefined
    });
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
    console.log('Resend verification request received. User:', req.user);
    
    // Get user from request (set by authenticator middleware)
    const user = req.user;
    if (!user) {
      console.error('No user found in request');
      return res.status(401).json({ ok: false, msg: 'Unauthorized: No user session' });
    }

    // Get user email from token or fetch from DB
    let email = user.email;
    let userId = user.userid || user._id;
    
    // If email is not in the token, try to get it from the database
    if (!email && userId) {
      try {
        const found = await UserModel.findById(userId).lean();
        if (!found) {
          return res.status(404).json({ ok: false, msg: 'User not found' });
        }
        email = found.email;
      } catch (dbError) {
        console.error('Database error:', dbError);
        return res.status(500).json({ ok: false, msg: 'Error fetching user data' });
      }
    }

    if (!email) {
      return res.status(400).json({ ok: false, msg: 'No email associated with this account' });
    }

    // Check if email is already verified
    try {
      const found = await UserModel.findOne({ email }).lean();
      if (found && found.emailVerified) {
        return res.status(400).json({ ok: false, msg: 'Email already verified' });
      }
    } catch (dbError) {
      console.error('Error checking email verification status:', dbError);
      // Continue anyway - better to send a duplicate email than to fail
    }

    console.log(`Sending verification email to ${email}`);
    const normalized = email.toLowerCase().trim();
    
    // Use the existing sendOtp function which will handle OTP generation and email sending
    // For account verification, include the verification link
    const out = await sendOtp(normalized, 'email', true); // true = include link for account verification
    
    // If OTP was sent successfully, include the verification link in the response
    if (out.ok) {
      const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/verify-email?email=${encodeURIComponent(normalized)}`;
      out.verificationLink = verificationLink;
    }
    
    if (!out.ok) {
      console.error('Failed to send OTP:', out.msg);
      return res.status(400).json({
        ok: false,
        msg: out.msg || 'Failed to send verification email'
      });
    }
    
    console.log('Verification email sent successfully');
    return res.json({
      ok: true,
      msg: 'Verification email sent successfully',
      requestId: out.requestId
    });
  } catch (e) {
    return res.status(500).json({ ok: false, msg: 'Server error', error: e.message });
  }
};
