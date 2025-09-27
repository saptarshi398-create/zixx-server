const express = require("express");
const { 
    adminRouter, 
    dashboardRouter, 
    SalesRouter, 
    TransactionRouter, 
    GeographyRouter,
    ProductAdminRouter,
    OrdersRouter,
    BannersAdminRouter,
  AuthAdminRouter,
    TestimonialsAdminRouter,
    footerRouter
} = require("./Admin");


const { AdminToolsRouter } = require("./Admin/admin_tools.routes");

const AdminsRouters = express.Router();

AdminsRouters.use("/admin", adminRouter);
AdminsRouters.use("/admin", dashboardRouter);
AdminsRouters.use("/admin", SalesRouter);
AdminsRouters.use("/admin", TransactionRouter);
AdminsRouters.use("/admin", GeographyRouter);
AdminsRouters.use("/admin", ProductAdminRouter);
AdminsRouters.use("/admin", OrdersRouter);
AdminsRouters.use("/admin", BannersAdminRouter);
AdminsRouters.use('/admin', AuthAdminRouter);
AdminsRouters.use("/admin", AdminToolsRouter);
// Mount footer early so public GET /api/admin/footer isn't intercepted by routers that
// apply admin-only middleware at the '/admin' mount (some routers call router.use(adminMiddleware)).
AdminsRouters.use("/admin/footer", footerRouter);
AdminsRouters.use("/admin", TestimonialsAdminRouter);

// Public client route for auth pages
const { AuthClientRouter } = require('./Admin');
AdminsRouters.use('/api', AuthClientRouter);

// Re-mount it directly at /api for full frontend compatibility
AdminsRouters.use('/', AuthClientRouter);

AdminsRouters.get("/", (req, res) => {
  res.send("Welcome to the Admin API");
});

module.exports = AdminsRouters;