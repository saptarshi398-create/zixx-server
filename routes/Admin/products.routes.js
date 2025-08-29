const express = require("express");
const { authenticator } = require("../../middlewares/authenticator.middleware");
const { 
    getProductsByUserId, 
    addProduct, 
    updateProduct, 
    deleteProduct
} = require("../../controllers/products.controler");
const { adminMiddleware } = require("../../middlewares/admin.middleware");
const { upload, cloudinaryUploadMiddleware } = require("../../middlewares/cloudinaryUpload");
const ProductAdminRouter = express.Router();

// ✅ Get products by uploader user ID (admin only)
ProductAdminRouter.get("/products/user/:userid", authenticator, adminMiddleware, getProductsByUserId);

// ✅ Add product
ProductAdminRouter.post("/products/add", authenticator, adminMiddleware, addProduct);

// ✅ Update product
ProductAdminRouter.patch("/products/update/:id", authenticator, adminMiddleware, updateProduct);

// ✅ Delete product
ProductAdminRouter.delete("/products/delete/:id", authenticator, adminMiddleware, deleteProduct);

// ✅ Image upload for products: form-data field name should be 'image'
ProductAdminRouter.post(
  "/products/upload",
  authenticator,
  adminMiddleware,
  upload.single("image"),
  cloudinaryUploadMiddleware,
  (req, res) => {
    if (!req.body.profile_pic) {
      return res.status(400).json({ ok: false, message: "No image uploaded" });
    }
    return res.json({ ok: true, url: req.body.profile_pic });
  }
);

module.exports = { ProductAdminRouter };