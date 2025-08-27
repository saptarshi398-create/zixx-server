const { WishlistRouter } = require("./wishlist.routes");
const { BrandRouter } = require("./brands.routes");
const { CartRouter } = require("./carts.routes");
const { OrderRouter } = require("./order.routes");
const { ProductRouter } = require("./products.routes");
const { SearchRouter } = require("./search.routes");
const { UserRouter } = require("./user.routes");
const { ReviewRouter } = require("./reviews.routes");
const { PaymentsRouter } = require("./payments.routes");
const { BannersRouter } = require("./banners.routes");

module.exports = {
  BrandRouter,
  OrderRouter,
  ProductRouter,
  SearchRouter,
  UserRouter,
  WishlistRouter,
  CartRouter,
  ReviewRouter,
  PaymentsRouter,
  BannersRouter
};