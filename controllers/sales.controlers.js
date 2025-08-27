const {OverallStatModel } = require("../models/overallStat.model");
exports.getSales = async (req, res) => {
  try {
    // fetch all stats to compute aggregated totals
    const allStats = await OverallStatModel.find().lean();
    if (!allStats || allStats.length === 0) {
      return res.status(404).json({ message: "No sales data found" });
    }

    // Build a summarized salesStats object (totals) from all documents
    const salesStats = allStats.reduce(
      (acc, stat) => {
        acc.totalSales += Number(stat.yearlySalesTotal || stat.totalSales || 0);
        acc.totalOrders += Number(stat.yearlyTotalSoldUnits || stat.totalOrders || 0);
        acc.totalCustomers += Number(stat.totalCustomers || 0);
        return acc;
      },
      {
        totalSales: 0,
        totalOrders: 0,
        totalCustomers: 0,
      }
    );

    // Prefer the most recent OverallStat document which should contain monthlyData/dailyData
    const primary =
      (await OverallStatModel.findOne().sort({ createdAt: -1 }).lean()) || {};

    const response = {
      monthlyData: primary.monthlyData || [],
      dailyData: primary.dailyData || [],
      yearlySalesTotal: primary.yearlySalesTotal || 0,
      yearlyTotalSoldUnits: primary.yearlyTotalSoldUnits || 0,
      salesByCategory: primary.salesByCategory || {},
      salesStats,
      counts: {
        totalDocs: allStats.length,
        primaryHasMonthly: Array.isArray(primary.monthlyData) ? primary.monthlyData.length : 0,
      },
    };

    console.log(
      "getSales: total docs=",
      allStats.length,
      " primary.monthlyData=",
      response.counts.primaryHasMonthly
    );

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
