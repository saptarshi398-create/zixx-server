const mongoose = require('mongoose');
const { UserModel } = require('../models/users.model');
const { ProductModel } = require('../models/products.model');
const { OverallStatModel } = require('../models/overallStat.model');
const { Transaction } = require('../models/transaction.model');

async function ensureAdminUser() {
  const adminExists = await UserModel.findOne({ role: 'admin' }).lean();
  if (adminExists) return { created: false, adminId: adminExists._id };

  const admin = new UserModel({
    first_name: 'Admin',
    last_name: 'User',
    email: 'admin@example.com',
    password: 'Admin@1234', // will be hashed by pre-save hook
    phone: 9999999999,
    dob: '1990-01-01',
    gender: 'other',
    address: { city: 'Metropolis', country: 'US' },
    role: 'admin',
    emailVerified: true,
  });
  await admin.save();
  return { created: true, adminId: admin._id };
}

async function ensureCustomerUser() {
  const userExists = await UserModel.findOne({ role: 'customer' }).lean();
  if (userExists) return { created: false, userId: userExists._id };

  const user = new UserModel({
    first_name: 'Demo',
    last_name: 'Customer',
    email: 'demo@example.com',
    password: 'Demo@1234',
    phone: 8888888888,
    dob: '1995-05-05',
    gender: 'other',
    address: { city: 'Gotham', country: 'US' },
    role: 'customer',
    emailVerified: true,
  });
  await user.save();
  return { created: true, userId: user._id };
}

async function ensureProducts() {
  const count = await ProductModel.countDocuments();
  if (count > 0) return { created: 0 };

  const now = Date.now();
  const docs = [
    // Clothes / Apparel
    { title: 'Classic Tee', description: 'Soft cotton t-shirt', brand: 'Zixx', gender: 'unisex', category: 'Clothes', subcategory: 'T-Shirts', price: 19.99, discount: 0, rating: 4.2, theme: 'casual', size: ['S','M','L','XL'], color: ['black','white','blue'], image: [], supply: 120, featured: true },
    { title: 'Athletic Tee', description: 'Breathable sports tee', brand: 'Zixx', gender: 'men', category: 'Clothes', subcategory: 'T-Shirts', price: 24.99, discount: 10, rating: 4.4, theme: 'sports', size: ['M','L'], color: ['red','black'], image: [], supply: 80 },
    { title: 'Oversized Hoodie', description: 'Cozy fleece hoodie', brand: 'Zixx', gender: 'women', category: 'Clothes', subcategory: 'Hoodies', price: 59.0, discount: 5, rating: 4.6, theme: 'winter', size: ['S','M','L'], color: ['navy','grey'], image: [], supply: 60, featured: true },
    { title: 'Denim Jacket', description: 'Classic denim layer', brand: 'Zixx', gender: 'unisex', category: 'Clothes', subcategory: 'Jackets', price: 79.99, discount: 0, rating: 4.5, theme: 'street', size: ['M','L','XL'], color: ['blue','black'], image: [], supply: 35 },
    { title: 'Summer Dress', description: 'Light floral dress', brand: 'Zixx', gender: 'women', category: 'Clothes', subcategory: 'Dresses', price: 45.0, discount: 0, rating: 4.3, theme: 'summer', size: ['S','M'], color: ['yellow','white'], image: [], supply: 50 },

    // Accessories
    { title: 'Adjustable Cap', description: 'Everyday cap', brand: 'Zixx', gender: 'unisex', category: 'Accessories', subcategory: 'Hats', price: 14.5, discount: 0, rating: 4.0, theme: 'sports', size: ['One Size'], color: ['red','black'], image: [], supply: 200 },
    { title: 'Leather Belt', description: 'Genuine leather belt', brand: 'Zixx', gender: 'men', category: 'Accessories', subcategory: 'Belts', price: 29.99, discount: 0, rating: 4.1, theme: 'formal', size: ['M','L'], color: ['brown','black'], image: [], supply: 150 },
    { title: 'Silk Scarf', description: 'Printed silk scarf', brand: 'Zixx', gender: 'women', category: 'Accessories', subcategory: 'Scarves', price: 25.0, discount: 0, rating: 4.3, theme: 'casual', size: ['One Size'], color: ['blue','green'], image: [], supply: 90 },
    { title: 'Aviator Sunglasses', description: 'UV-protected shades', brand: 'Zixx', gender: 'unisex', category: 'Accessories', subcategory: 'Sunglasses', price: 39.99, discount: 0, rating: 4.4, theme: 'summer', size: ['One Size'], color: ['gold','black'], image: [], supply: 110, featured: true },

    // Collections (treated via category + theme)
    { title: 'Winter Knit Set', description: 'Beanie and gloves set', brand: 'Zixx', gender: 'unisex', category: 'Collections', subcategory: 'Winter', price: 34.99, discount: 0, rating: 4.2, theme: 'winter', size: ['One Size'], color: ['grey','black'], image: [], supply: 75 },
    { title: 'Sport Essentials', description: 'Performance wear bundle', brand: 'Zixx', gender: 'unisex', category: 'Collections', subcategory: 'Sports', price: 89.0, discount: 15, rating: 4.5, theme: 'sports', size: ['M','L'], color: ['black','blue'], image: [], supply: 40 },
  ];
  const res = await ProductModel.insertMany(docs);
  return { created: res.length };
}

function buildDailyData(days = 14) {
  const arr = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const date = d.toISOString().slice(0, 10);
    const totalSales = Math.round(100 + Math.random() * 500);
    const totalUnits = Math.round(5 + Math.random() * 40);
    arr.push({ date, totalSales, totalUnits });
  }
  return arr;
}

function buildMonthlyData(months = 6) {
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now = new Date();
  const arr = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = monthNames[d.getMonth()];
    const totalSales = Math.round(3000 + Math.random() * 8000);
    const totalUnits = Math.round(200 + Math.random() * 800);
    arr.push({ month, totalSales, totalUnits });
  }
  return arr;
}

async function ensureSalesStats() {
  const count = await OverallStatModel.countDocuments();
  if (count > 0) return { created: false };

  const dailyData = buildDailyData(21);
  const monthlyData = buildMonthlyData(12);
  const yearlySalesTotal = dailyData.reduce((s, d) => s + (d.totalSales || 0), 0);
  const yearlyTotalSoldUnits = dailyData.reduce((s, d) => s + (d.totalUnits || 0), 0);
  const salesByCategory = { Apparel: 0.5, Accessories: 0.3, Other: 0.2 };

  await OverallStatModel.create({
    totalCustomers: 10,
    yearlySalesTotal,
    yearlyTotalSoldUnits,
    year: new Date().getFullYear(),
    monthlyData,
    dailyData,
    salesByCategory,
  });
  return { created: true };
}

async function autoSeed() {
  try {
    const results = {};
    results.admin = await ensureAdminUser();
    results.customer = await ensureCustomerUser();
    results.products = await ensureProducts();
    results.sales = await ensureSalesStats();
    // seed a few transactions if none
    const txCount = await Transaction.countDocuments();
    if (txCount === 0) {
      const userId = results.customer.userId || results.admin.adminId;
      const prodIds = (await ProductModel.find().limit(5).select('_id')).map(p => p._id);
      const pickProducts = (n) => {
        const arr = [];
        for (let i = 0; i < n && i < prodIds.length; i++) arr.push(prodIds[i]);
        return arr;
      };
      await Transaction.insertMany([
        { userId, cost: '49.00', products: pickProducts(1) },
        { userId, cost: '89.50', products: pickProducts(2) },
        { userId, cost: '14.50', products: pickProducts(1) },
        { userId, cost: '119.99', products: pickProducts(3) },
        { userId, cost: '29.99', products: pickProducts(1) },
      ]);
      results.transactions = { created: 5 };
    } else {
      results.transactions = { created: 0 };
    }
    // console.log('[autoSeed] results:', results);
  } catch (e) {
    console.warn('[autoSeed] seeding failed:', e && e.message ? e.message : e);
  }
}

module.exports = { autoSeed };
