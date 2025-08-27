const express = require("express");
const { searchProducts } = require("../../controllers/search.controlers");

const SearchRouter = express.Router();

// GET /api/search?q=keyword
SearchRouter.get("/search", searchProducts);

module.exports = { SearchRouter };
