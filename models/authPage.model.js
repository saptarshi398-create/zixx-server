const mongoose = require('mongoose');

const AuthPageSchema = new mongoose.Schema(
  {
    page: { type: String, required: true, enum: ['login', 'signup'] },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    bannerImage: { type: String, default: '' },
    active: { type: Boolean, default: true },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

AuthPageSchema.index({ page: 1, active: 1 });

const AuthPage = mongoose.model('AuthPage', AuthPageSchema);
module.exports = { AuthPage };
