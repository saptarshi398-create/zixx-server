const express = require("express");
const { 
    getProducts, 
    getProductByName,
    getProductsByUserId,
    getSingleProductById,
    getCategoriesByGender,
    addProduct,
    getProductsByGenderMen,
    getProductsByGenderWomen,
    getProductsByGenderKids,
    getProductsBySubcategory,
    updateProduct,
    deleteProduct
} = require("../../controllers/products.controler");
const { ReviewRouter } = require("./reviews.routes");
const { authenticator } = require("../../middlewares/authenticator.middleware");
const ProductRouter = express.Router();

ProductRouter.use(express.json());

// ✅ Get all products 
ProductRouter.get("/products", getProducts);

// Get product by name 
ProductRouter.get("/products/byname/:name", getProductByName);

// ✅ Get single product by ID
ProductRouter.get("/products/singleproduct/:id", getSingleProductById);

// ✅ Get categories By Gender
ProductRouter.get("/products/categories/:gender", getCategoriesByGender);

// ✅ Get products by gender men
ProductRouter.get("/products/men", getProductsByGenderMen);

// ✅ Get products by gender women
ProductRouter.get("/products/women", getProductsByGenderWomen);

// ✅ Get products by gender kids
ProductRouter.get("/products/kids", getProductsByGenderKids);

// ✅ Get products by subcategory
ProductRouter.get("/products/men/:subcategory", getProductsBySubcategory);


module.exports = { ProductRouter };
