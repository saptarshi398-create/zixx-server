const express = require("express");
const { authenticator } = require("../../middlewares/authenticator.middleware");
const { getGeography } = require("../../controllers/geography.controlers");
const { adminMiddleware } = require("../../middlewares/admin.middleware");

const GeographyRouter = express.Router();

GeographyRouter.get("/geography", authenticator, adminMiddleware, getGeography);

module.exports = { GeographyRouter };
