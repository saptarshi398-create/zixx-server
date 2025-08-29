const { OrderModel } = require("../models/order.model");

// Compute live sales metrics from orders so admin charts show real-time data
exports.getSales = async (req, res) => {
  try {
    const now = new Date();
    const monthNames = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December"
    ];
    const currentYear = now.getFullYear();

    const orders = await OrderModel.find().lean();

    let yearlySalesTotal = 0;
    let yearlyTotalSoldUnits = 0;
    const monthlyData = [];
    const dailyData = [];
    const salesByCategory = {};

    // Helpers to upsert into arrays
    const upsertMonthly = (month, sales, units) => {
      let m = monthlyData.find((e) => e.month === month);
      if (!m) { m = { month, totalSales: 0, totalUnits: 0 }; monthlyData.push(m); }
      m.totalSales += sales;
      m.totalUnits += units;
    };
    const upsertDaily = (dateStr, sales, units) => {
      let d = dailyData.find((e) => e.date === dateStr);
      if (!d) { d = { date: dateStr, totalSales: 0, totalUnits: 0 }; dailyData.push(d); }
      d.totalSales += sales;
      d.totalUnits += units;
    };

    (orders || []).forEach((order) => {
      const amount = Number(order?.paymentDetails?.paymentAmount || 0) || 0;
      const items = Array.isArray(order?.orderItems) ? order.orderItems : [];
      const orderDate = new Date(order?.createdAt || Date.now());
      const year = orderDate.getFullYear();
      if (isNaN(orderDate)) return;

      const units = items.reduce((acc, it) => acc + Number(it?.quantity || 0), 0);
      const month = monthNames[orderDate.getMonth()];
      const day = orderDate.toISOString().split("T")[0];

      if (year === currentYear) {
        yearlySalesTotal += amount;
        yearlyTotalSoldUnits += units;
      }

      upsertMonthly(month, amount, units);
      upsertDaily(day, amount, units);

      // Aggregate by category (fallbacks for robustness)
      items.forEach((it) => {
        const cat = it.category || it.productCategory || it.productName || "Other";
        const qty = Number(it.quantity || 0) || 0;
        salesByCategory[cat] = (salesByCategory[cat] || 0) + qty;
      });
    });

    // Sort aggregations for consistent charts
    const monthIndex = (m) => monthNames.indexOf(m);
    monthlyData.sort((a, b) => monthIndex(a.month) - monthIndex(b.month));
    dailyData.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    // Keep admin response shape compatible
    const response = {
      monthlyData,
      dailyData,
      yearlySalesTotal,
      yearlyTotalSoldUnits,
      salesByCategory,
      salesStats: {
        totalSales: yearlySalesTotal,
        totalOrders: (orders || []).length,
        totalCustomers: undefined,
      },
      counts: { totalOrders: (orders || []).length },
    };

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
