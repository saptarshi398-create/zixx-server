const express = require("express");
const { UserModel } = require("../models/users.model");
const { OrderModel } = require("../models/order.model");
const { ReviewModel } = require("../models/reviews.model");
const { ProductModel } = require("../models/products.model");
exports.searchProducts = async (req, res) => {
  const q = req.query.q ? req.query.q.trim() : "";
  if (!q) return res.status(400).json({ ok: false, message: "Missing search query" });
  try {
    // Search products (title, description, brand, category, subcategory)
    const products = await ProductModel.find({
      $or: [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { brand: { $regex: q, $options: "i" } },
        { category: { $regex: q, $options: "i" } },
        { subcategory: { $regex: q, $options: "i" } }
      ]
    }).limit(10);

    // Search users (first_name, last_name, email)
    const users = await UserModel.find({
      $or: [
        { first_name: { $regex: q, $options: "i" } },
        { last_name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } }
      ]
    }).limit(5);

    // Search orders (by orderId or productName)
    const orders = await OrderModel.find({
      $or: [
        { _id: q.match(/^[0-9a-fA-F]{24}$/) ? q : undefined },
        { "orderItems.productName": { $regex: q, $options: "i" } }
      ]
    }).limit(5);

    // Search reviews (by comment)
    const reviews = await ReviewModel.find({
      comment: { $regex: q, $options: "i" }
    }).limit(5);

    res.json({ ok: true, data: { products, users, orders, reviews } });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Search error", error: error.message });
  }
}