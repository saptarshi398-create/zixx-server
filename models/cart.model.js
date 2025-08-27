const mongoose = require("mongoose");

const cartSchema = mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "product", required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  brand: { type: String, required: true },
  color: { type: String, required: true },
  gender: { type: String, required: true },
  price: { type: Number, required: true },
  discount: { type: Number, required: true },
  rating: { type: String, required: true },
  category: { type: String, required: true },
  theme: { type: String, required: true },
  size: { type: String, required: true },
  image: { type: [String], required: true },
  Qty: { type: Number, required: true },
  afterQtyprice: { type: Number, required: true },
  variation: {
    size: { type: String, required: true },
    color: { type: String, required: true },
    quantity: { type: Number, required: true },
  },
  total: { type: Number, required: true },
});

const CartModel = mongoose.model("cartproduct", cartSchema);

module.exports = { CartModel };
