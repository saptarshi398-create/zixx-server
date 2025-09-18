const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, "../.env") });

const { connection } = require('../config/db');
const bcrypt = require('bcrypt');

// Import models lazily to avoid circular issues
const { UserModel } = require('../models/users.model');
const { ProductModel } = require('../models/products.model');
const { OverallStatModel } = require('../models/overallStat.model');
const { ProductStatModel } = require('../models/productStat.model');
const { TransactionModel } = require('../models/transaction.model');
const { AffiliateStatModel } = require('../models/affiliateStat.model');
const { OrderModel } = require('../models/order.model');
const { Banner } = require('../models/banner.model');
const { CartModel } = require('../models/cart.model');
const { ReviewModel } = require('../models/reviews.model');
const { TestimonialModel } = require('../models/testimonial.model');
const { WishlistModel } = require('../models/wishlist.model');

const {
  dataUser,
  dataProduct,
  dataProductStat,
  dataTransaction,
  dataOverallStat,
  dataAffiliateStat,
  dataBanner,
  dataTestimonial,
  dataReview
} = require('./data.js');

const clearAllData = async () => {
  const collections = [
    { model: UserModel, name: 'Users' },
    { model: ProductModel, name: 'Products' },
    { model: ProductStatModel, name: 'Product Stats' },
    { model: TransactionModel, name: 'Transactions' },
    { model: OverallStatModel, name: 'Overall Stats' },
    { model: AffiliateStatModel, name: 'Affiliate Stats' },
    { model: OrderModel, name: 'Orders' },
    { model: Banner, name: 'Banners' },
    { model: CartModel, name: 'Carts' },
    { model: ReviewModel, name: 'Reviews' },
    { model: TestimonialModel, name: 'Testimonials' },
    { model: WishlistModel, name: 'Wishlists' }
  ];

  for (const collection of collections) {
    try {
      await collection.model.deleteMany({});
    } catch (e) {
      // ignore
    }
  }
};

const createDefaultAdmin = async (adminOverride) => {
  const adminData = Object.assign({
    first_name: 'Admin',
    middle_name: '',
    last_name: 'User',
    email: 'admin@zixx.com',
    password: 'admin123',
    phone: 1234567890,
    dob: '1990-01-01',
    gender: 'other',
    address: {},
    profile_pic: 'https://example.com/admin-profile-pic.png',
    emailVerified: true,
    isActive: true,
    role: 'admin'
  }, adminOverride || {});

  const admin = new UserModel(adminData);
  await admin.save();
  return admin._id;
};

const importFreshData = async (adminId) => {
  if (dataUser && dataUser.length > 0) {
    await UserModel.insertMany(dataUser);
  }
  if (dataProduct && dataProduct.length > 0) {
    const productsWithAdmin = dataProduct.map(product => ({ ...product, userId: adminId }));
    await ProductModel.insertMany(productsWithAdmin);
  }

  const dataImports = [
    { data: dataProductStat, model: ProductStatModel },
    { data: dataTransaction, model: TransactionModel },
    { data: dataOverallStat, model: OverallStatModel },
    { data: dataAffiliateStat, model: AffiliateStatModel },
    { data: dataBanner, model: Banner },
    { data: dataTestimonial, model: TestimonialModel },
    { data: dataReview, model: ReviewModel }
  ];

  for (const importItem of dataImports) {
    if (importItem.data && importItem.data.length > 0) {
      await importItem.model.insertMany(importItem.data);
    }
  }
};

const initializeDatabase = async (adminOverride) => {
  await connection;
  await clearAllData();
  const adminId = await createDefaultAdmin(adminOverride);
  await importFreshData(adminId);
  return { adminId };
};

module.exports = { initializeDatabase, clearAllData };
