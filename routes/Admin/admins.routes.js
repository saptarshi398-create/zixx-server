const express = require("express");
const { authenticator } = require("../../middlewares/authenticator.middleware");
const { getAllAdmins } = require("../../controllers/admins.controlers");
const { adminMiddleware } = require("../../middlewares/admin.middleware");
const { getAllOrders } = require("../../controllers/order.controlers");
const { getAllUsers, updateUsersByAdmin, deleteUsersByAdmin } = require("../../controllers/user.controler");

const adminRouter = express.Router();

adminRouter.get("/", (req, res) => {
  res.send("Admin Dashboard");
});

// get all users
adminRouter.get("/users", authenticator, adminMiddleware, getAllUsers);

// add update users by admin
adminRouter.patch("/users/:id", authenticator, adminMiddleware, updateUsersByAdmin);

// delete users by admin
adminRouter.delete("/users/:id", authenticator, adminMiddleware, deleteUsersByAdmin);

// get all admins
adminRouter.get("/allAdmins", authenticator, adminMiddleware, getAllAdmins);

// show all orders access only admin
adminRouter.get("/orders", authenticator, adminMiddleware, getAllOrders);

module.exports = { adminRouter };