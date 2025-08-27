const express = require("express");
const { authenticator } = require("../../middlewares/authenticator.middleware");
const { 
    getProductsByUserId, 
    addProduct, 
    updateProduct, 
    deleteProduct
} = require("../../controllers/products.controler");
const { adminMiddleware } = require("../../middlewares/admin.middleware");
const ProductAdminRouter = express.Router();

// ✅ Get products by uploader user ID (admin only)
ProductAdminRouter.get("/products/user/:userid", authenticator, adminMiddleware, getProductsByUserId);

// ✅ Add product
ProductAdminRouter.post("/products/add", authenticator, adminMiddleware, addProduct);

// ✅ Update product
ProductAdminRouter.patch("/products/update/:id", authenticator, adminMiddleware, updateProduct);

// ✅ Delete product
ProductAdminRouter.delete("/products/delete/:id", authenticator, adminMiddleware, deleteProduct);

module.exports = { ProductAdminRouter };