const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { connection } = require("../config/db");

// Import all models
const { UserModel } = require("../models/users.model");
const { ProductModel } = require("../models/products.model");
const { OverallStatModel } = require("../models/overallStat.model");
const { ProductStatModel } = require("../models/productStat.model");
const { TransactionModel } = require("../models/transaction.model");
const { AffiliateStatModel } = require("../models/affiliateStat.model");
const { OrderModel } = require("../models/order.model");
const { Banner } = require("../models/banner.model");
const { CartModel } = require("../models/cart.model");
const { ReviewModel } = require("../models/reviews.model");
const { TestimonialModel } = require("../models/testimonial.model");
const { WishlistModel } = require("../models/wishlist.model");

// Import data from data.js
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
} = require("./data.js");

// Create default admin user
const createDefaultAdmin = async () => {
  const adminData = {
    first_name: "Admin",
    middle_name: "",
    last_name: "User",
    email: "admin@zixx.com",
    password: "admin123", // Will be hashed by pre-save hook
    phone: 1234567890,
    dob: "1990-01-01",
    gender: "other",
    address: {
      personal_address: "Admin Address",
      shoping_address: "Admin Address",
      billing_address: "Admin Address",
      address_village: "Admin Village",
      landmark: "Admin Landmark",
      city: "Admin City",
      state: "Admin State",
      country: "Bangladesh",
      zip: "1000"
    },
    profile_pic: "https://example.com/admin-profile-pic.png",
    wishlist: [],
    orders: [],
    emailVerified: true,
    isActive: true,
    role: "admin"
  };

  const admin = new UserModel(adminData);
  await admin.save();
  return admin._id;
};

// Clear all collections
const clearAllData = async () => {
  
  const collections = [
    { model: UserModel, name: "Users" },
    { model: ProductModel, name: "Products" },
    { model: ProductStatModel, name: "Product Stats" },
    { model: TransactionModel, name: "Transactions" },
    { model: OverallStatModel, name: "Overall Stats" },
    { model: AffiliateStatModel, name: "Affiliate Stats" },
    { model: OrderModel, name: "Orders" },
    { model: Banner, name: "Banners" },
    { model: CartModel, name: "Carts" },
    { model: ReviewModel, name: "Reviews" },
    { model: TestimonialModel, name: "Testimonials" },
    { model: WishlistModel, name: "Wishlists" }
  ];

  for (const collection of collections) {
    try {
      const result = await collection.model.deleteMany({});
    } catch (error) {
    }
  }
};

// Import fresh data
const importFreshData = async (adminId) => {

  try {
    // Import users (excluding admin as it's already created)
    if (dataUser && dataUser.length > 0) {
      await UserModel.insertMany(dataUser);
    }

    // Import products and associate with admin
    if (dataProduct && dataProduct.length > 0) {
      const productsWithAdmin = dataProduct.map(product => ({
        ...product,
        userId: adminId
      }));
      await ProductModel.insertMany(productsWithAdmin);
    }

    // Import other data
    const dataImports = [
      { data: dataProductStat, model: ProductStatModel, name: "Product Stats" },
      { data: dataTransaction, model: TransactionModel, name: "Transactions" },
      { data: dataOverallStat, model: OverallStatModel, name: "Overall Stats" },
      { data: dataAffiliateStat, model: AffiliateStatModel, name: "Affiliate Stats" },
      { data: dataBanner, model: Banner, name: "Banners" },
      { data: dataTestimonial, model: TestimonialModel, name: "Testimonials" },
      { data: dataReview, model: ReviewModel, name: "Reviews" }
    ];

    for (const importItem of dataImports) {
      if (importItem.data && importItem.data.length > 0) {
        await importItem.model.insertMany(importItem.data);
      }
    }

  } catch (error) {
    throw error;
  }
};

// Main initialization function
const initializeDatabase = async () => {
  try {
    
    // Connect to database
    await connection;
    console.log("Connected to MongoDB");
    // Clear all existing data
    await clearAllData();
    console.log("Cleared all existing data");
    // Create default admin
    const adminId = await createDefaultAdmin();
    console.log("Created default admin user");
    // Import fresh data
    await importFreshData(adminId);

    console.log("Imported fresh data");
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
};

// Run initialization
initializeDatabase();
