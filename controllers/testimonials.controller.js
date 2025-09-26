const { TestimonialModel } = require('../models/testimonial.model');

// ==============================
// Public: list approved testimonials (with optional limit)
// ==============================
exports.listTestimonials = async (req, res) => {
  try {
    const limit = Math.max(0, Math.min(50, Number(req.query.limit) || 12));
    const includePending = String(process.env.TESTIMONIALS_PUBLIC_INCLUDE_PENDING || '').toLowerCase() === 'true';
    const filter = includePending ? {} : { approved: true };
    const docs = await TestimonialModel.find(filter)
      .populate('user', 'first_name last_name profile_pic email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return res.json({ ok: true, testimonials: docs });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, msg: 'Failed to fetch testimonials', error: e.message });
  }
};

// ==============================
// Public: submit a testimonial
// ==============================
exports.createTestimonial = async (req, res) => {
  try {
    const { rating, text, name, page, path, device, locale } = req.body || {};
    const r = Number(rating);

    if (!text || !r || r < 1 || r > 5) {
      return res
        .status(400)
        .json({ ok: false, msg: 'rating (1-5) and text are required' });
    }

    const userAgent = req.headers['user-agent'] || '';
    const referrer = req.headers['referer'] || req.headers['referrer'] || '';
    const ip =
      (req.headers['x-forwarded-for'] &&
        String(req.headers['x-forwarded-for']).split(',')[0].trim()) ||
      req.ip ||
      req.connection?.remoteAddress ||
      '';

    const autoApprove = String(process.env.TESTIMONIALS_AUTO_APPROVE || '').toLowerCase() === 'true';

    const doc = await TestimonialModel.create({
      user: req.userid || undefined,
      name:
        name ||
        (req.user && (req.user.first_name || req.user.name)) ||
        '',
      rating: r,
      text: String(text).trim(),
      page,
      path,
      device,
      locale,
      userAgent,
      referrer,
      ip,
      approved: autoApprove ? true : false,
    });

    // Fire-and-forget notifications
    notifyNewTestimonial(doc).catch(() => {});
    notifyEmailNewTestimonial(doc).catch(() => {});

    return res.status(201).json({ ok: true, testimonial: doc });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, msg: 'Failed to create testimonial', error: e.message });
  }
};

// ==============================
// Check if current user has submitted a testimonial
// ==============================
exports.userHasTestimonial = async (req, res) => {
  try {
    // Require authenticated user
    if (!req.userid) return res.status(401).json({ ok: false, msg: 'Unauthorized' });
    const count = await TestimonialModel.countDocuments({ user: req.userid });
    return res.json({ ok: true, hasTestimonial: count > 0, total: count });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, msg: 'Failed to check testimonial', error: e.message });
  }
};

// ==============================
// Admin: list testimonials (search/sort/pagination)
// ==============================
exports.adminListTestimonials = async (req, res) => {
  try {
    const {
      status = 'pending',
      page = 1,
      pageSize = 50,
      q = '',
      sortBy = 'createdAt',
      sortDir = 'desc',
    } = req.query || {};

    const filter = {};
    if (status === 'pending') filter.approved = false;
    else if (status === 'approved') filter.approved = true;

    if (q) {
      const rx = new RegExp(
        String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i'
      );
      filter.$or = [{ name: rx }, { text: rx }];
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const sizeNum = Math.max(1, Math.min(200, Number(pageSize) || 50));

    const sort = {
      [sortBy]: String(sortDir).toLowerCase() === 'asc' ? 1 : -1,
    };

    const [items, total] = await Promise.all([
      TestimonialModel.find(filter)
        .populate('user', 'first_name last_name profile_pic email')
        .sort(sort)
        .skip((pageNum - 1) * sizeNum)
        .limit(sizeNum)
        .lean(),
      TestimonialModel.countDocuments(filter),
    ]);

    return res.json({
      ok: true,
      testimonials: items,
      page: pageNum,
      pageSize: sizeNum,
      total,
    });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, msg: 'Failed to fetch testimonials', error: e.message });
  }
};

// ==============================
// Admin: approve testimonial
// ==============================
exports.adminApproveTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await TestimonialModel.findByIdAndUpdate(
      id,
      { $set: { approved: true } },
      { new: true }
    );
    if (!doc) return res.status(404).json({ ok: false, msg: 'Not found' });
    return res.json({ ok: true, testimonial: doc });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, msg: 'Failed to approve testimonial', error: e.message });
  }
};

// ==============================
// Admin: update testimonial
// ==============================
exports.adminUpdateTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, text, rating } = req.body;
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (text !== undefined) updateData.text = text;
    if (rating !== undefined) {
      const r = Number(rating);
      if (r >= 1 && r <= 5) updateData.rating = r;
    }
    
    const doc = await TestimonialModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    ).populate('user', 'first_name last_name profile_pic email');
    
    if (!doc) return res.status(404).json({ ok: false, msg: 'Not found' });
    return res.json({ ok: true, testimonial: doc });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, msg: 'Failed to update testimonial', error: e.message });
  }
};

// ==============================
// Admin: delete testimonial
// ==============================
exports.adminDeleteTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await TestimonialModel.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ ok: false, msg: 'Not found' });
    return res.json({ ok: true, deleted: true });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, msg: 'Failed to delete testimonial', error: e.message });
  }
};

// ==============================
// Slack notification helper
// ==============================
async function notifyNewTestimonial(doc) {
  try {
    const hook = process.env.SLACK_WEBHOOK_URL;
    if (!hook) return;

    const text = `New testimonial pending approval
Name: ${doc.name || 'Anonymous'}
Rating: ${doc.rating}
Text: ${doc.text}
Path: ${doc.path || '-'}
Device: ${doc.device || '-'}
Locale: ${doc.locale || '-'}`;

    await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
  } catch (_) {}
}

// ==============================
// Email notification helper
// ==============================
async function notifyEmailNewTestimonial(doc) {
  try {
    const to = process.env.NOTIFY_EMAIL_TO;
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!to || !host || !port || !user || !pass) return;

    let nodemailer;
    try {
      nodemailer = require('nodemailer');
    } catch (_) {
      return;
    }

    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: { user, pass },
    });

    const subject = `New testimonial pending approval (${doc.rating}⭐)`;
    const text = `New testimonial pending approval
Name: ${doc.name || 'Anonymous'}
Rating: ${doc.rating}
Text: ${doc.text}
Path: ${doc.path || '-'}
Device: ${doc.device || '-'}
Locale: ${doc.locale || '-'}`;

    await transporter.sendMail({ from: user, to, subject, text });
  } catch (_) {}
}
