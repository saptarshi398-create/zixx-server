const mongoose = require("mongoose");

const cartSchema = mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "product", required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  brand: { type: String, required: true },
  color: { type: String, required: true },
  gender: { type: String, required: true },
  // Pricing fields
  basePrice: { type: Number }, // Original product price
  tax: {
    type: { type: String, enum: ['free', 'percentage'] },
    value: { type: Number, default: 0 }
  },
  shippingCost: {
    type: { type: String, enum: ['free', 'fixed'] },
    value: { type: Number, default: 0 }
  },
  discount: {
    type: { type: String, enum: ['percentage', 'fixed', 'coupon'] },
    value: { type: Number, default: 0 }
  },
  price: { type: Number, required: true }, // Final calculated price
  rating: { type: String, required: true },
  category: { type: String, required: true },
  theme: { type: String, required: true },
  size: { type: String, required: true },
  image: { type: [String], required: true },
  Qty: { type: Number, required: true },
  afterQtyprice: { type: Number, required: true }, // price * Qty
  variation: {
    size: { type: String, required: true },
    color: { type: String, required: true },
    quantity: { type: Number, required: true },
  },
  total: { type: Number, required: true }, // Same as afterQtyprice
});

const CartModel = mongoose.model("cartproduct", cartSchema);

module.exports = { CartModel };
