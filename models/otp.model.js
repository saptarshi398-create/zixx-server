const mongoose = require('mongoose');

const OTPSchema = new mongoose.Schema({
  requestId: { type: String, required: true, unique: true, index: true },
  target: { type: String, required: true }, // email or phone
  channel: { type: String, enum: ['email', 'phone'], required: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  used: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

// TTL via expiresAt index handled above

const OTPModel = mongoose.model('otp', OTPSchema);
module.exports = { OTPModel };
