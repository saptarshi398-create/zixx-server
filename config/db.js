const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

mongoose.set("strictQuery", true);
const mongoUrl = process.env.MONGO_URL || process.env.DBURL;
const connection = mongoose.connect(mongoUrl);

module.exports = { connection };
