const { AuthPage } = require('../models/authPage.model');

// sensible defaults used when no auth page docs exist
const DEFAULT_BANNER = 'https://wintrackinc.com/cdn/shop/articles/pexels-olly-853151_2223d0ec-5853-4769-91e3-b38e2d748494.jpg?v=1738776038&width=2080';
const DEFAULT_DESCRIPTION = "Join us now to be a part of Zixx's family.";

function makeDefaultFor(page) {
  if (String(page).toLowerCase().trim() === 'signup') {
    return { page: 'signup', title: 'Welcome', description: DEFAULT_DESCRIPTION, bannerImage: DEFAULT_BANNER, active: true };
  }
  return { page: 'login', title: 'Welcome Back', description: DEFAULT_DESCRIPTION, bannerImage: DEFAULT_BANNER, active: true };
}

// Public: get auth page content by page (login or signup)
exports.getAuthPage = async (req, res) => {
  try {
    const { page } = req.params;
    if (!page) return res.status(400).json({ ok: false, message: 'Page is required' });
    const key = String(page).toLowerCase().trim();
    // Return the most recently updated active document for the page
    let doc = await AuthPage.findOne({ page: key, active: true }).sort({ updatedAt: -1 }).lean();

    // If not found, create a default doc so frontend and admin both see content
    if (!doc) {
      const created = await AuthPage.create(makeDefaultFor(key));
      doc = created.toObject ? created.toObject() : created;
    }

    res.json({ ok: true, data: doc });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

// Admin: list (optionally filter by page/active)
exports.adminListAuthPages = async (req, res) => {
  try {
    const { page, active } = req.query;
    const filter = {};
    if (page) filter.page = String(page).toLowerCase().trim();
    if (active !== undefined) filter.active = active === 'true';

    let list = await AuthPage.find(filter).sort({ createdAt: -1 }).lean();

    // If there are no entries at all (unfiltered), create defaults for both login and signup.
    if (!page && (!Array.isArray(list) || list.length === 0)) {
      const existingLogin = await AuthPage.findOne({ page: 'login' }).lean();
      const existingSignup = await AuthPage.findOne({ page: 'signup' }).lean();
      const toCreate = [];
      if (!existingLogin) toCreate.push(makeDefaultFor('login'));
      if (!existingSignup) toCreate.push(makeDefaultFor('signup'));
      if (toCreate.length > 0) await AuthPage.insertMany(toCreate);
      list = await AuthPage.find(filter).sort({ createdAt: -1 }).lean();
    }

    res.json({ ok: true, data: list });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

// Admin: create
exports.adminCreateAuthPage = async (req, res) => {
  try {
    let { page, title, description, bannerImage, active, meta } = req.body;
    if (!page) return res.status(400).json({ ok: false, message: 'page is required (login|signup)' });
    page = String(page).toLowerCase().trim();
    // If this new entry is being created as active, deactivate other entries for the same page
    if (active === true) {
      try { await AuthPage.updateMany({ page }, { $set: { active: false } }); } catch (e) { /* non-fatal */ }
    }
    const created = await AuthPage.create({ page, title, description, bannerImage, active, meta });
    res.status(201).json({ ok: true, data: created });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
};

// Admin: update
exports.adminUpdateAuthPage = async (req, res) => {
  try {
    const { id } = req.params;
    const body = { ...req.body };
    if (typeof body.page !== 'undefined') body.page = String(body.page).toLowerCase().trim();
    // If update sets active true for this page, deactivate other entries for that page first
    if (typeof body.active !== 'undefined' && body.active === true) {
      // Need to know current page value (either in body or fetch existing)
      const current = body.page ? body.page : null;
      let pageForOthers = current;
      if (!pageForOthers) {
        try {
          const existing = await AuthPage.findById(id).lean();
          pageForOthers = existing ? existing.page : null;
        } catch (e) { pageForOthers = null; }
      }
      if (pageForOthers) {
        try { await AuthPage.updateMany({ page: pageForOthers, _id: { $ne: id } }, { $set: { active: false } }); } catch (e) { /* non-fatal */ }
      }
    }
    const updated = await AuthPage.findByIdAndUpdate(id, body, { new: true }).lean();
    if (!updated) return res.status(404).json({ ok: false, message: 'Auth page not found' });
    res.json({ ok: true, data: updated });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
};

// Admin: delete
exports.adminDeleteAuthPage = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await AuthPage.findByIdAndDelete(id).lean();
    if (!deleted) return res.status(404).json({ ok: false, message: 'Auth page not found' });
    res.json({ ok: true, data: deleted });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
};
