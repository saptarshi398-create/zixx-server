const express = require("express");
const { getFooter, updateFooter } = require("../../controllers/footer.controller");
const { authenticator } = require("../../middlewares/authenticator.middleware");
const { adminMiddleware } = require("../../middlewares/admin.middleware");

const router = express.Router();

// Public route to get footer
router.get("/", getFooter);

// Admin route to update footer
router.put("/", authenticator, adminMiddleware, updateFooter);

module.exports = router;