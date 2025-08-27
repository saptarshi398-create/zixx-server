const express = require('express');
const { getBanners } = require('../../controllers/banners.controller');

const BannersRouter = express.Router();

// GET /clients/banners?page=home&position=hero
BannersRouter.get('/banners', getBanners);

module.exports = { BannersRouter };
