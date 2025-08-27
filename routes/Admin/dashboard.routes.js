const express = require("express");
const { authenticator } = require("../../middlewares/authenticator.middleware");
const { getDashboardStats } = require("../../controllers/dashboard.controlers");
const { adminMiddleware } = require("../../middlewares/admin.middleware");

const dashboardRouter = express.Router();

dashboardRouter.get("/dashboard", authenticator, adminMiddleware, getDashboardStats);

module.exports = { dashboardRouter };