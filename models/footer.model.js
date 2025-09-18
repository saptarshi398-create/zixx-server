const mongoose = require("mongoose");

const footerSchema = new mongoose.Schema(
  {
    logo: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    contactInfo: {
      address: {
        type: String,
        default: "",
      },
      phone: {
        type: String,
        default: "",
      },
      email: {
        type: String,
        default: "",
      },
    },
    socialLinks: {
      facebook: {
        type: String,
        default: "",
      },
      twitter: {
        type: String,
        default: "",
      },
      instagram: {
        type: String,
        default: "",
      },
      linkedin: {
        type: String,
        default: "",
      },
    },
    quickLinks: [{
      title: String,
      url: String,
    }],
    accountLinks: [{
      title: { type: String },
      url: { type: String }
    }],
    exclusive: {
      title: { type: String, default: 'Exclusive' },
      subtitle: { type: String, default: 'Subscribe' },
      note: { type: String, default: 'Get 10% off your first order' }
    },
    socialLinksExtra: [{
      label: { type: String },
      url: { type: String }
    }],
    copyrightText: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

const Footer = mongoose.model("Footer", footerSchema);
module.exports = Footer;