const mongoose = require('mongoose');

const BannerSchema = new mongoose.Schema(
  {
    page: { type: String, required: true }, // e.g., 'home', 'women', 'men'
    position: { type: String, required: true }, // e.g., 'hero', 'mid', 'section'
    imageUrl: { type: String, required: true },
    heading: { type: String, required: true },
    description: { type: String, default: '' },
    linkText: { type: String, default: 'Shop Now' },
    linkUrl: { type: String, default: '/' }, // Prefer /category/... but arbitrary allowed
    active: { type: Boolean, default: true },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

BannerSchema.index({ page: 1, position: 1, active: 1 });

const Banner = mongoose.model('Banner', BannerSchema);
module.exports = { Banner };
