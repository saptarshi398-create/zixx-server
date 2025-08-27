const { OrderModel } = require("../models/order.model");
const { ProductModel } = require("../models/products.model");
const { UserModel } = require("../models/users.model");

exports.getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const currentMonth = monthNames[now.getMonth()];
    const currentYear = now.getFullYear();
    const currentDay = now.toISOString().split("T")[0];

    const usersRes = await UserModel.find();
    const productsRes = await ProductModel.find();
    const ordersRes = await OrderModel.find();

    // console.log("Customers:", usersRes);
    // console.log("Orders:", ordersRes);
    // console.log("Products:", productsRes);

    const customers = usersRes || [];
    const orders = ordersRes || [];
    const products = productsRes || [];

    // Calculate stats
    const totalCustomers = customers.length;
    let totalOrders = orders.length;
    let totalProducts = products.length;
    let salesToday = orders.reduce((acc, order) =>
       acc + order.paymentDetails.paymentAmount || 0, 0);
    let monthlySalesTotal = 0;
    let totalSales = orders.reduce((acc, order) => 
      acc + order.paymentDetails.paymentAmount || 0, 0);
    let monthlyTotalSoldUnits = 0;
    let yearlyTotalSoldUnits = 0;
    let yearlySalesTotal = 0;
    let monthlyData = [];
    let salesByCategory = {};
    let dailyData = [];
    let transactions = orders.slice(-50).reverse(); // last 50 orders as transactions

    // Aggregate sales data
  orders.forEach(order => {
    const orderDate = new Date(order.createdAt);
    const orderYear = orderDate.getFullYear();
    if (orderYear === currentYear) {
      yearlySalesTotal += order.paymentDetails.paymentAmount || 0;
      yearlyTotalSoldUnits += order.orderItems.reduce((acc, item) => acc + (item.quantity || 0), 0);

      // Calculate monthly sales total
      if (orderDate.getMonth() === now.getMonth()) {
        monthlySalesTotal += order.paymentDetails.paymentAmount || 0;
        monthlyTotalSoldUnits += order.orderItems.reduce((acc, item) => acc + (item.quantity || 0), 0);
      }

      // Calculate sales by category
      order.orderItems.forEach(item => {
        if (salesByCategory[item.category]) {
          salesByCategory[item.category] += item.quantity;
        } else {
          salesByCategory[item.category] = item.quantity;
        }
      });

      // Calculate sales today
      if (orderDate.toISOString().split("T")[0] === currentDay) {
        salesToday += order.paymentDetails.paymentAmount || 0;
      }

      // Calculate sales this year
      if (orderDate.getFullYear() === currentYear) {
        salesToday += order.paymentDetails.paymentAmount || 0;
      }

      // Calculate sales this month
      if (orderDate.getFullYear() === currentYear && orderDate.getMonth() === now.getMonth()) {
        salesToday += order.paymentDetails.paymentAmount || 0;
      }

      // calculate yearly total seales
      if (orderDate.getFullYear() === currentYear) {
        yearlySalesTotal += order.paymentDetails.paymentAmount || 0;
        yearlyTotalSoldUnits += order.orderItems.reduce((acc, item) => acc + (item.quantity || 0), 0);
      }

      // Monthly aggregation
      const month = monthNames[orderDate.getMonth()];
      let monthEntry = monthlyData.find(m => m.month === month);
      if (!monthEntry) {
        monthEntry = { month, totalSales: 0, totalUnits: 0 };
        monthlyData.push(monthEntry);
      }
      monthEntry.totalSales += order.paymentDetails.paymentAmount || 0;
      monthEntry.totalUnits += order.orderItems.reduce((acc, item) => acc + (item.quantity || 0), 0);

      // Daily aggregation
      const day = orderDate.toISOString().split("T")[0];
      let dayEntry = dailyData.find(d => d.date === day);
      if (!dayEntry) {
        dayEntry = { date: day, totalSales: 0, totalUnits: 0 };
        dailyData.push(dayEntry);
      }
      dayEntry.totalSales += order.paymentDetails.paymentAmount || 0;
      dayEntry.totalUnits += order.orderItems.reduce((acc, item) => acc + (item.quantity || 0), 0);

      // Category aggregation
      if (order.orderItems) {
        order.orderItems.forEach(item => {
          const cat = item.productName || "Other";
          if (!salesByCategory[cat]) salesByCategory[cat] = 0;
          salesByCategory[cat] += item.quantity || 0;
        });
      }
    }
  });

    // Find this month and today stats
    
    const thisMonthStats = monthlyData.find(m => m.month === currentMonth) || null;
    const todayStats = dailyData.find(d => d.date === currentDay) || null;

    res.status(200).json({
      totalCustomers,
      totalOrders,
      totalProducts,
      salesToday,
      yearlyTotalSoldUnits,
      yearlySalesTotal,
      monthlyData,
      dailyData,
      monthlyTotalSoldUnits,
      totalSales,
      monthlySalesTotal,
      salesByCategory,
      thisMonthStats,
      todayStats,
      transactions,
      customers,
      orders,
      products
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};
