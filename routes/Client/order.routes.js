const express = require("express");
const { 
    buyCartProducts, 
    buySelectedCartProducts,
    getUserOrders, 
    getUserOrderById,
    cancelOrder,
    getAllOrders,
    trackOrderPublic
} = require("../../controllers/order.controlers");
const { authenticator } = require("../../middlewares/authenticator.middleware");
const { rateLimit } = require("../../middlewares/rateLimit");

const OrderRouter = express.Router();

// Buy cart products
OrderRouter.post("/order/buy", authenticator, buyCartProducts);

// Buy selected cart products as one consolidated order
OrderRouter.post("/order/buy-selected", authenticator, buySelectedCartProducts);

// Get user orders
OrderRouter.get("/user/orders", authenticator, getUserOrders);

// Get a specific user order by ID
OrderRouter.get("/user/orders/:id", authenticator, getUserOrderById);

// Cancel order
OrderRouter.patch("/order/cancel/:id", authenticator, cancelOrder);

// Public: track order (by order number or short code + email) with basic rate limit
OrderRouter.post(
  "/order/track",
  rateLimit({ windowMs: 60_000, max: 10, keyGenerator: (req) => {
    try {
      const email = (req.body?.email || '').toString().trim().toLowerCase();
      return email || req.ip;
    } catch { return req.ip; }
  }}),
  trackOrderPublic
);


module.exports = { OrderRouter };
