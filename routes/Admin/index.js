const { adminRouter } = require("./admins.routes");
const { dashboardRouter } = require("./dashboard.routes");
const { GeographyRouter } = require("./geography.routes");
const { ProductAdminRouter } = require("./products.routes");
const { SalesRouter } = require("./sales.routes");
const { TransactionRouter } = require("./transactions.routes");
const { OrdersRouter } = require("./orders.routes");
const { BannersAdminRouter } = require("./banners.routes");
const { TestimonialsAdminRouter } = require("./testimonials.routes");
const footerRouter = require("./footer.routes");

module.exports = {
  adminRouter,
  dashboardRouter,
  SalesRouter,
  TransactionRouter,
  GeographyRouter,
  ProductAdminRouter,
  OrdersRouter,
  BannersAdminRouter,
  TestimonialsAdminRouter,
  footerRouter
};