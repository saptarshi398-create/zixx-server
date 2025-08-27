// models/wishlist.model.js
const mongoose = require("mongoose");

const wishlistSchema = mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "product" }]
});

const WishlistModel = mongoose.model("wishlist", wishlistSchema);
module.exports = { WishlistModel };
