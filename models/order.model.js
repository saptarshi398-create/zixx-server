const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({

  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },

  products: [{ type: mongoose.Schema.Types.ObjectId, ref: "product" }],
  status: { type: String, enum: ["pending", "verified", "packed", "in_transit", "completed", "cancelled"], default: "pending" },
  trackingStatus: { type: String, default: "Pending" }, // Human-readable status message
  totalAmount: { type: Number, required: true },
  shippingAddress: { type: String, required: true },
  paymentMethod: { type: String, enum: ["credit_card", "paypal", "bank_transfer", "cod", "razorpay"], default: "credit_card" },
  paymentStatus: { type: String, enum: ["paid", "unpaid", "pending", "refunded"], default: "unpaid" },
  deliveryDate: { type: Date, default: null }, 
  trackingNumber: { type: String, default: null },
  // Courier/channel info
  carrier: { type: String, default: null },
  carrierUrl: { type: String, default: null },
  courierPhone: { type: String, default: null },
  courierLogoUrl: { type: String, default: null },
  trackingStatus: { type: String, default: "Pending" },
  orderDate: { type: Date, default: Date.now },
  deliveryStatus: { type: String, enum: ["pending", "confirmed", "packing_complete", "shipped", "delivered", "cancelled", "returned"], default: "pending" }, // Shipping status
  customerNotes: { type: String, default: null },
  adminNotes: { type: String, default: null },
  // Admin verification flow
  isVerified: { type: Boolean, default: false },
  verifiedAt: { type: Date, default: null },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
  // Operational timestamps for lifecycle steps
  packedAt: { type: Date, default: null },
  shippedAt: { type: Date, default: null },
  outForDeliveryAt: { type: Date, default: null },
  returnedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  isGift: { type: Boolean, default: false },
  giftMessage: { type: String, default: null },
  giftWrap: { type: Boolean, default: false },
  discountCode: { type: String, default: null },
  discountAmount: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  shippingCost: { type: Number, default: 0 },
  estimatedDelivery: { type: Date, default: null },
  returnPolicy: { type: String, default: "30 days return policy" },
  orderSource: { type: String, enum: ["web", "mobile", "in_store"], default: "web" },
  // Optional client-provided batch id to make order creation idempotent for bulk checkout
  batchId: { type: String, default: null },
  customerFeedback: { type: String, default: null },
  orderItems: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "product", required: true },
      productName: { type: String },
      description: { type: String },
      image: { type: String },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true }, // Final calculated price per unit
      basePrice: { type: Number }, // Original product price
      tax: {
        type: { type: String, enum: ['free', 'percentage'] },
        value: { type: Number, default: 0 }
      },
      shippingCost: {
        type: { type: String, enum: ['free', 'fixed'] },
        value: { type: Number, default: 0 }
      },
      discount: {
        type: { type: String, enum: ['percentage', 'fixed', 'coupon'] },
        value: { type: Number, default: 0 }
      },
      totalPrice: { type: Number, required: true }, // price * quantity
    }
  ],
  paymentDetails: {
    provider: { type: String, default: null },
    transactionId: { type: String, default: null },
    razorpay_order_id: { type: String, default: null },
    paymentDate: { type: Date, default: null },
    paymentAmount: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ["pending", "completed", "failed", "refunded"], default: "pending" },
  },
  orderHistory: [
    {
      status: { type: String, enum: ["pending", "verified", "packed", "in_transit", "completed", "cancelled"], required: true },
      deliveryStatus: { type: String, enum: ["pending", "confirmed", "packing_complete", "shipped", "delivered", "cancelled", "returned"] },
      updatedAt: { type: Date, default: Date.now },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
      notes: { type: String, default: null },
      meta: {
        trackingNumber: String,
        carrier: String,
        adminNotes: String,
        deliveryDate: Date
      }
    }
  ],
  // Lightweight audit trail for admin actions
  auditTrail: [
    {
      action: { type: String, required: true }, // e.g., 'packed', 'courier_updated'
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'user', default: null },
      at: { type: Date, default: Date.now },
      meta: { type: Object, default: {} },
    }
  ],
  timestamp: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isArchived: { type: Boolean, default: false },
  archivedAt: { type: Date, default: null },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  isRecommended: { type: Boolean, default: false },
  isOnSale: { type: Boolean, default: false },
  salePrice: { type: Number, default: null },
  isPreOrder: { type: Boolean, default: false },
  preOrderDate: { type: Date, default: null },
  isBackOrder: { type: Boolean, default: false },
  backOrderDate: { type: Date, default: null },
  isSubscription: { type: Boolean, default: false },
  subscriptionDetails: {  
    frequency: { type: String, enum: ["daily", "weekly", "monthly"], default: "monthly" },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
  },
});

const OrderModel = mongoose.model("order", orderSchema);
module.exports = { OrderModel };
