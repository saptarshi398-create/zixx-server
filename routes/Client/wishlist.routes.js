const express = require("express");
const { authenticator } = require("../../middlewares/authenticator.middleware");
const { 
  getWishlist, 
  addToWishlist, 
  removeFromWishlist 
} = require("../../controllers/wishlist.controlers");

const WishlistRouter = express.Router();

// Get Wishlist
WishlistRouter.get("/user/wishlist", authenticator, getWishlist);

// Add to Wishlist
WishlistRouter.post("/user/wishlist/add", authenticator, addToWishlist);

// Remove from Wishlist
WishlistRouter.post("/user/wishlist/remove", authenticator, removeFromWishlist);

module.exports = { WishlistRouter };
