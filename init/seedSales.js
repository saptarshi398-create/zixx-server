const mongoose = require('mongoose');
require('dotenv').config();
const { OverallStatModel } = require('../models/overallStat.model');

async function main() {
  const mongo = process.env.MONGO_URL;
  if (!mongo) {
    process.exit(1);
  }
  // set mongoose strictQuery to avoid deprecation warning
  mongoose.set('strictQuery', true);
  await mongoose.connect(mongo);

  // sample monthly data for one year
  const monthlyData = [
    { month: 'Jan', totalSales: 12000, totalUnits: 240 },
    { month: 'Feb', totalSales: 15000, totalUnits: 300 },
    { month: 'Mar', totalSales: 18000, totalUnits: 360 },
    { month: 'Apr', totalSales: 13000, totalUnits: 260 },
    { month: 'May', totalSales: 17000, totalUnits: 340 },
    { month: 'Jun', totalSales: 16000, totalUnits: 320 },
    { month: 'Jul', totalSales: 19000, totalUnits: 380 },
    { month: 'Aug', totalSales: 20000, totalUnits: 400 },
    { month: 'Sep', totalSales: 21000, totalUnits: 420 },
    { month: 'Oct', totalSales: 22000, totalUnits: 440 },
    { month: 'Nov', totalSales: 23000, totalUnits: 460 },
    { month: 'Dec', totalSales: 24000, totalUnits: 480 },
  ];

  // generate daily data for the last 30 days
  const days = 30;
  const dailyData = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10); // YYYY-MM-DD
    // deterministic sample values based on day index
    const totalUnits = 50 + (i % 10) * 3;
    const totalSales = Math.round(totalUnits * (100 + (i % 7) * 5));
    dailyData.push({ date: dateStr, totalSales, totalUnits });
  }

  const doc = new OverallStatModel({
    totalCustomers: 5000,
    yearlySalesTotal: monthlyData.reduce((s, m) => s + m.totalSales, 0),
    yearlyTotalSoldUnits: monthlyData.reduce((s, m) => s + m.totalUnits, 0),
    year: new Date().getFullYear(),
    monthlyData,
  dailyData,
    // sample category breakdown (sums to yearlySalesTotal)
    salesByCategory: (() => {
      const total = monthlyData.reduce((s, m) => s + m.totalSales, 0);
      return {
        Clothing: Math.round(total * 0.35),
        Electronics: Math.round(total * 0.25),
        Home: Math.round(total * 0.2),
        Accessories: Math.round(total * 0.2),
      };
    })(),
  });

  await doc.save();
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  process.exit(1);
});
