const { Banner } = require('../models/banner.model');

// Client: list active banners with optional filters
exports.getBanners = async (req, res) => {
  try {
    const { page, position, active } = req.query;
    const filter = {};
    if (page) filter.page = String(page).toLowerCase().trim();
    if (position) filter.position = String(position).toLowerCase().trim();
    if (active !== undefined) filter.active = active === 'true'; else filter.active = true;

    const banners = await Banner.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ ok: true, data: banners });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message || 'Failed to fetch banners' });
  }
};

// Admin: CRUD
exports.adminListBanners = async (req, res) => {
  try {
    const { page, position, active } = req.query;
    const filter = {};
    if (page) filter.page = String(page).toLowerCase().trim();
    if (position) filter.position = String(position).toLowerCase().trim();
    if (active !== undefined) filter.active = active === 'true';

    const banners = await Banner.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ ok: true, data: banners });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message || 'Failed to list banners' });
  }
};

exports.adminCreateBanner = async (req, res) => {
  try {
    let { page, position, imageUrl, heading, description, linkText, linkUrl, active, meta } = req.body;
    page = page ? String(page).toLowerCase().trim() : undefined;
    position = position ? String(position).toLowerCase().trim() : undefined;
    if (typeof active === 'undefined') active = true;
    const created = await Banner.create({ page, position, imageUrl, heading, description, linkText, linkUrl, active, meta });
    res.status(201).json({ ok: true, data: created });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message || 'Failed to create banner' });
  }
};

exports.adminUpdateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const body = { ...req.body };
    if (typeof body.page !== 'undefined') body.page = String(body.page).toLowerCase().trim();
    if (typeof body.position !== 'undefined') body.position = String(body.position).toLowerCase().trim();
    const updated = await Banner.findByIdAndUpdate(id, body, { new: true }).lean();
    if (!updated) return res.status(404).json({ ok: false, message: 'Banner not found' });
    res.json({ ok: true, data: updated });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message || 'Failed to update banner' });
  }
};

exports.adminDeleteBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Banner.findByIdAndDelete(id).lean();
    if (!deleted) return res.status(404).json({ ok: false, message: 'Banner not found' });
    res.json({ ok: true, data: deleted });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message || 'Failed to delete banner' });
  }
};
