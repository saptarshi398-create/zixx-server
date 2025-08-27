const { ProductModel } = require("../models/products.model");

// GET all unique brands
exports.getAllBrands = async (req, res) => {
  try {
    const brands = await ProductModel.aggregate([
      { $group: { _id: "$brand", logo: { $first: "$image" } } },
      { $project: { name: "$_id", logo: { $arrayElemAt: ["$logo", 0] }, _id: 0 } },
      { $sort: { name: 1 } }
    ]);
    res.json({ data: brands, ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Error fetching brands", error: error.message });
  }
};