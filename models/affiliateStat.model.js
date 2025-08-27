const mongoose = require("mongoose");

const AffiliateStatSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Types.ObjectId,
            ref: "User",
            required: true,
        },
        affiliateSales: {
            type: [mongoose.Types.ObjectId],
            ref: "Transaction",
        },
        day: {
            type: Number,
            required: true,
        },
        month: {
            type: Number,
            required: true,
        },
        year: {
            type: Number,
            required: true,
        },
        totalSales: {
            type: Number,
            required: true,
        },
        sales: {
            type: Number,
            required: true,
        },
    },
    { timestamps: true }
);

const AffiliateStat = mongoose.model("AffiliateStat", AffiliateStatSchema);
module.exports = { AffiliateStat };