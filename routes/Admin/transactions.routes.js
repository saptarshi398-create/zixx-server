const express = require("express");
const { authenticator } = require("../../middlewares/authenticator.middleware.js");
const { Transactions} = require("../../controllers/transactions.controlers.js");
const { adminMiddleware } = require("../../middlewares/admin.middleware.js");

const TransactionRouter = express.Router();

TransactionRouter.get("/transactions", authenticator, adminMiddleware, Transactions);

module.exports = { TransactionRouter };