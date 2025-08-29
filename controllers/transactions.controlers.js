const { Transaction } = require("../models/transaction.model");
const { OrderModel } = require("../models/order.model");

exports.Transactions = async (req, res) => {
  try {
    // DataGrid sends 0-based page index; use it directly
    const rawPage = Number(req.query.page ?? 0);
    const rawPageSize = Number(req.query.pageSize ?? 20);
    const page = Number.isFinite(rawPage) && rawPage >= 0 ? rawPage : 0; // 0-based
    const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0 ? rawPageSize : 20;
    const sort = req.query.sort ?? null;
    const search = req.query.search ?? "";

    // Safely parse sort if provided
    let sortFormatted = {};

    if (sort) {
      try {
        const sortParsed = JSON.parse(sort);
        if (sortParsed && sortParsed.field) {
          sortFormatted = { [sortParsed.field]: sortParsed.sort === 'asc' ? 1 : -1 };
        }
      } catch (e) {
        // ignore invalid sort and use default
        sortFormatted = {};
      }
    }
    // Default to newest first if no sort specified
    if (!sort || Object.keys(sortFormatted).length === 0) {
      sortFormatted = { createdAt: -1 };
    }

    const searchQuery = [];
    if (search) {
      // userId is ObjectId; regex on stringified id may not be efficient but allows simple contains
      searchQuery.push({ userId: { $regex: search, $options: 'i' } });
      // cost is stored as string; search via regex
      searchQuery.push({ cost: { $regex: search, $options: 'i' } });
    }

    const query = searchQuery.length > 0 ? { $or: searchQuery } : {};

    const transactions = await Transaction.find(query)
      .sort(sortFormatted)
      .skip(page * pageSize)
      .limit(Number(pageSize));

    const total = await Transaction.countDocuments(query);

    res.status(200).json({ transactions, total });
  } catch (error) {
    console.error('[Transactions] error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Admin-only: backfill transactions from orders that don't yet have a transaction
exports.adminBackfillTransactions = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, msg: 'Access denied' });
    }

    // fetch orders excluding soft-deleted
    const orders = await OrderModel.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 });
    let created = 0;
    let skipped = 0;

    for (const order of orders) {
      try {
        const exists = await Transaction.findOne({ orderId: order._id });
        if (exists) { skipped++; continue; }
        await Transaction.create({
          userId: order.userId,
          orderId: order._id,
          cost: String(order.totalAmount || 0),
          products: Array.isArray(order.products) ? order.products : [],
        });
        created++;
      } catch (e) {
        // continue with next order
      }
    }

    return res.json({ ok: true, created, skipped, totalOrders: orders.length });
  } catch (error) {
    console.error('[adminBackfillTransactions] error:', error);
    return res.status(500).json({ ok: false, msg: 'Backfill failed', error: error.message });
  }
};
