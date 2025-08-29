const mongoose = require("mongoose");   

const TransactionSchema = new mongoose.Schema(
    {
        userId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "user", 
            required: true 
        },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "order",
            required: false,
        },
        cost: { type: String, required: true },
        products: {
            type: [mongoose.Types.ObjectId],
            of: Number,
        },
    },
    { timestamps: true }
);

// Ensure at most one transaction per order when orderId present
try {
  TransactionSchema.index({ orderId: 1 }, { unique: true, sparse: true });
} catch (_) {}

const Transaction = mongoose.model("Transaction", TransactionSchema);
module.exports = { Transaction };