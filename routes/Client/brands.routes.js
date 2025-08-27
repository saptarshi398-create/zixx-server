const express = require("express");
const { getAllBrands } = require("../../controllers/brands.controlers");

const BrandRouter = express.Router();

// GET all unique brands
BrandRouter.get("/brands", getAllBrands);

module.exports = { BrandRouter };
