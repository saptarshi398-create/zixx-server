const mongoose = require("mongoose");   

const TransactionSchema = new mongoose.Schema(
    {
        userId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "user", 
            required: true 
        },
        cost: { type: String, required: true },
        products: {
            type: [mongoose.Types.ObjectId],
            of: Number,
        },
    },
    { timestamps: true }
);

const Transaction = mongoose.model("Transaction", TransactionSchema);
module.exports = { Transaction };