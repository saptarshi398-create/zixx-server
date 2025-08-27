const express = require("express");
const CartRouter = express.Router();
require("dotenv").config();
const { 
    getCartItemById, 
    getAllCartItems, 
    addToCart,
    removeFromCart,
    updateCartItemQty
} = require("../../controllers/carts.controlers");
const { authenticator } = require("../../middlewares/authenticator.middleware");


// Get Cart Item by ID
CartRouter.get('/user/getcart/:id', authenticator, getCartItemById);

// Get All Cart Items
CartRouter.get("/user/getcart", authenticator, getAllCartItems);

// Add to Cart
CartRouter.post("/user/addtocart", authenticator, addToCart);

// Remove from Cart
CartRouter.delete("/user/remove/:id", authenticator, removeFromCart);

// Update Cart Item Quantity
CartRouter.patch("/user/updatecart/:id", authenticator, updateCartItemQty);

module.exports = { CartRouter };
