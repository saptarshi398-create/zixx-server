const mongoose = require('mongoose');

const TestimonialSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: false },
    name: { type: String, default: '' },
    rating: { type: Number, min: 1, max: 5, required: true },
    text: { type: String, required: true, trim: true },
    approved: { type: Boolean, default: false },
    // metadata
    device: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    page: { type: String, default: '' },
    path: { type: String, default: '' },
    referrer: { type: String, default: '' },
    ip: { type: String, default: '' },
    locale: { type: String, default: '' },
  },
  { timestamps: true }
);

const TestimonialModel = mongoose.model('testimonial', TestimonialSchema);

module.exports = { TestimonialModel };
