const mongoose = require("mongoose");

const productSchema = mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  brand: { type: String, required: true },
  gender: { type: String, required: true },
  category: { type: String, required: true },
  subcategory: { type: String, required: true },
  // Pricing breakdown fields
  basePrice: { type: Number, required: true }, // Original product price set by admin
  tax: {
    type: { type: String, enum: ['free', 'percentage'], default: 'free' },
    value: { type: Number, default: 0 } // Percentage value if type is 'percentage'
  },
  shippingCost: {
    type: { type: String, enum: ['free', 'fixed'], default: 'free' },
    value: { type: Number, default: 0 } // Fixed amount in Rs if type is 'fixed'
  },
  discount: {
    type: { type: String, enum: ['percentage', 'fixed', 'coupon'], default: 'percentage' },
    value: { type: Number, default: 0 } // Percentage or fixed amount
  },
  price: { type: Number, required: true }, // Final calculated price
  rating: { type: Number, default: 0 },
  theme: { type: String, required: true },
  // New: list of key product features
  features: { type: [String], default: [] },
  size: { type: [String], default: [] },
  color: { type: [String], default: [] },
  // Legacy flat URL list for compatibility with existing consumers
  image: { type: [String], default: [] },
  // New structured images with metadata and ordering
  images: {
    type: [
      new mongoose.Schema(
        {
          url: { type: String, required: true },
          caption: { type: String, default: "" },
          alt: { type: String, default: "" },
          order: { type: Number, default: 0 },
        },
        { _id: false }
      ),
    ],
    default: [],
  },
  supply: { type: Number, default: 0 },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: false },
  featured: { type: Boolean, default: false },
}, { timestamps: true });

const ProductModel = mongoose.model("product", productSchema);
module.exports = {ProductModel};

