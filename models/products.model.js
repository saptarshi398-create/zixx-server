const mongoose = require("mongoose");

const productSchema = mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  brand: { type: String, required: true },
  gender: { type: String, required: true },
  category: { type: String, required: true },
  subcategory: { type: String, required: true },
  price: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  theme: { type: String, required: true },
  size: { type: [String], default: [] },
  color: { type: [String], default: [] },
  image: { type: [String], default: [] },
  supply: { type: Number, default: 0 },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: false },
  featured: { type: Boolean, default: false },
}, { timestamps: true });

const ProductModel = mongoose.model("product", productSchema);
module.exports = {ProductModel};
