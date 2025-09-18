const mongoose = require('mongoose');

const AdminAuditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'users', // assuming your admin users are in 'users' collection
      required: true,
    },
    adminEmail: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: ['empty_database', 'init_dummy_data'], // extensible - add more admin actions as needed
    },
    ip: {
      type: String,
      required: true,
    },
    success: {
      type: Boolean,
      required: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed, // flexible field for action-specific data
      required: false,
    },
    error: {
      type: String,
      required: false,
    }
  },
  { timestamps: true } // adds createdAt, updatedAt
);

const AdminAuditLogModel = mongoose.model('admin_audit_logs', AdminAuditLogSchema);

module.exports = { AdminAuditLogModel };