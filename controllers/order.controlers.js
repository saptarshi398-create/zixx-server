const { CartModel } = require("../models/cart.model");
const { OrderModel } = require("../models/order.model");
const { UserModel } = require("../models/users.model");
const { Transaction } = require("../models/transaction.model");
const { sendOrderReceipt } = require("../utils/mailer");
const axios = require('axios');


// Get user orders (latest first)
exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.userid;
    const orders = await OrderModel.find({ userId, isDeleted: { $ne: true } }).sort({ createdAt: -1 });
    res.json({ orders, ok: true });
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch orders", ok: false, error: err.message });
  }
}

// Admin: mark order as packed (sets packedAt and status)
exports.adminMarkPacked = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, msg: 'Access denied' });
    }
    const { id } = req.params;
    const { adminNotes } = req.body || {};
    const order = await OrderModel.findById(id);
    if (!order) return res.status(404).json({ ok: false, msg: 'Order not found' });
    if (order.isDeleted) return res.status(400).json({ ok: false, msg: 'Order is deleted' });
    if (!order.isVerified) {
      return res.status(400).json({ ok: false, msg: 'Order must be verified before packing' });
    }
    if (order.packedAt) {
      return res.json({ ok: true, msg: 'Order already packed', order });
    }
    order.packedAt = new Date();
    if (adminNotes) order.adminNotes = adminNotes;
    order.updatedAt = new Date();
    // Audit trail
    try {
      order.auditTrail = Array.isArray(order.auditTrail) ? order.auditTrail : [];
      order.auditTrail.push({ action: 'packed', by: req.userid || req.user?._id || null, at: new Date(), meta: { adminNotes: adminNotes || null } });
    } catch (_) {}
    await order.save();
    return res.json({ ok: true, msg: 'Order marked as packed', order });
  } catch (err) {
    return res.status(500).json({ ok: false, msg: 'Failed to mark packed', error: err.message });
  }
}

// Admin: update courier info (carrier, urls, phone, logo)
exports.adminUpdateCourier = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, msg: 'Access denied' });
    }
    const { id } = req.params;
    const { carrier, carrierUrl, courierPhone, courierLogoUrl, adminNotes } = req.body || {};
    const order = await OrderModel.findById(id);
    if (!order) return res.status(404).json({ ok: false, msg: 'Order not found' });
    if (order.isDeleted) return res.status(400).json({ ok: false, msg: 'Order is deleted' });

    // Basic validation helpers
    const isHttpUrl = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);
    const normStr = (v) => (typeof v === 'string' ? v.trim() : undefined);
    const validPhone = (p) => {
      if (typeof p !== 'string') return false;
      const digits = p.replace(/\D/g, '');
      return digits.length >= 6 && digits.length <= 15;
    };

    if (carrier !== undefined) order.carrier = normStr(carrier) || null;
    if (carrierUrl !== undefined) {
      if (carrierUrl && !isHttpUrl(carrierUrl)) {
        return res.status(400).json({ ok: false, msg: 'carrierUrl must start with http or https' });
      }
      order.carrierUrl = normStr(carrierUrl) || null;
    }
    if (courierLogoUrl !== undefined) {
      if (courierLogoUrl && !isHttpUrl(courierLogoUrl)) {
        return res.status(400).json({ ok: false, msg: 'courierLogoUrl must start with http or https' });
      }
      order.courierLogoUrl = normStr(courierLogoUrl) || null;
    }
    if (courierPhone !== undefined) {
      if (courierPhone && !validPhone(courierPhone)) {
        return res.status(400).json({ ok: false, msg: 'courierPhone must be 6-15 digits (you may include separators)' });
      }
      order.courierPhone = normStr(courierPhone) || null;
    }
    if (adminNotes) order.adminNotes = adminNotes;
    order.updatedAt = new Date();
    // Audit trail for courier update
    try {
      order.auditTrail = Array.isArray(order.auditTrail) ? order.auditTrail : [];
      const meta = {};
      if (carrier !== undefined) meta.carrier = order.carrier || null;
      if (carrierUrl !== undefined) meta.carrierUrl = order.carrierUrl || null;
      if (courierPhone !== undefined) meta.courierPhone = order.courierPhone || null;
      if (courierLogoUrl !== undefined) meta.courierLogoUrl = order.courierLogoUrl || null;
      if (adminNotes) meta.adminNotes = adminNotes;
      order.auditTrail.push({ action: 'courier_updated', by: req.userid || req.user?._id || null, at: new Date(), meta });
    } catch (_) {}
    await order.save();
    return res.json({ ok: true, msg: 'Courier info updated', order });
  } catch (err) {
    return res.status(500).json({ ok: false, msg: 'Failed to update courier info', error: err.message });
  }
}

// Admin: upload courier logo to Cloudinary and save URL on order
exports.adminUploadCourierLogo = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, msg: 'Access denied' });
    }
    const { id } = req.params;
    const order = await OrderModel.findById(id);
    if (!order) return res.status(404).json({ ok: false, msg: 'Order not found' });
    if (order.isDeleted) return res.status(400).json({ ok: false, msg: 'Order is deleted' });

    // cloudinary middleware places URL at req.body.profile_pic
    const url = req.body && req.body.profile_pic;
    if (!url) {
      return res.status(400).json({ ok: false, msg: 'No file uploaded' });
    }
    order.courierLogoUrl = url;
    order.updatedAt = new Date();
    try {
      order.auditTrail = Array.isArray(order.auditTrail) ? order.auditTrail : [];
      order.auditTrail.push({ action: 'courier_logo_uploaded', by: req.userid || req.user?._id || null, at: new Date(), meta: { courierLogoUrl: url } });
    } catch (_) {}
    await order.save();
    return res.json({ ok: true, msg: 'Courier logo uploaded', url, orderId: order._id });
  } catch (err) {
    return res.status(500).json({ ok: false, msg: 'Failed to upload courier logo', error: err.message });
  }
}

// Public: track order by order number (full ID or short code) + email verification
exports.trackOrderPublic = async (req, res) => {
  try {
    let { orderNumber, email } = req.body || {};
    if (!orderNumber || !email) {
      return res.status(400).json({ ok: false, msg: 'orderNumber and email are required' });
    }
    orderNumber = String(orderNumber).trim();
    email = String(email).trim().toLowerCase();
    const user = await UserModel.findOne({ email });
    if (!user) return res.status(404).json({ ok: false, msg: 'No user found for provided email' });

    let order = null;
    // Direct ID
    if (/^[a-f0-9]{24}$/i.test(orderNumber)) {
      order = await OrderModel.findOne({ _id: orderNumber, userId: user._id, isDeleted: { $ne: true } });
    } else {
      // Resolve by short code suffix or tracking number
      const orders = await OrderModel.find({ userId: user._id, isDeleted: { $ne: true } }).sort({ createdAt: -1 });
      const needle = String(orderNumber).toLowerCase();
      order = orders.find(o =>
        String(o._id).toLowerCase().endsWith(needle) ||
        (o.trackingNumber && String(o.trackingNumber).toLowerCase() === needle)
      );
    }

    if (!order) return res.status(404).json({ ok: false, msg: 'Order not found' });

    // Limit fields for public response
    const response = {
      _id: order._id,
      createdAt: order.createdAt || order.orderDate,
      status: order.status || 'pending',
      deliveryStatus: order.deliveryStatus || 'pending',
      trackingNumber: order.trackingNumber || null,
      carrier: order.carrier || null,
      carrierUrl: order.carrierUrl || null,
      courierPhone: order.courierPhone || null,
      courierLogoUrl: order.courierLogoUrl || null,
      deliveryDate: order.deliveryDate || null,
      // Optional per-step timestamps if your schema supports them
      confirmedAt: order.confirmedAt || order.verifiedAt || null,
      packedAt: order.packedAt || null,
      shippedAt: order.shippedAt || null,
      outForDeliveryAt: order.outForDeliveryAt || null,
      cancelledAt: order.cancelledAt || order.deletedAt || null,
      returnedAt: order.returnedAt || null,
      totalAmount: order.totalAmount || 0,
      shippingAddress: order.shippingAddress || null,
      paymentStatus: order.paymentStatus || 'unknown',
      orderItems: (order.orderItems || []).map(it => ({
        productId: it.productId,
        productName: it.productName,
        quantity: it.quantity,
        price: it.price,
        totalPrice: it.totalPrice,
        image: Array.isArray(it.images) && it.images.length > 0 ? it.images[0] : (Array.isArray(it.image) ? it.image[0] : it.image)
      })),
      // Optional per-shipment splits if your schema supports them
      shipments: Array.isArray(order.shipments) ? order.shipments.map(sh => ({
        id: sh.id || sh._id || null,
        carrier: sh.carrier || order.carrier || null,
        carrierUrl: sh.carrierUrl || null,
        trackingNumber: sh.trackingNumber || null,
        status: sh.status || null,
        shippedAt: sh.shippedAt || null,
        deliveredAt: sh.deliveredAt || null,
        items: Array.isArray(sh.items) ? sh.items.map(it => ({
          productId: it.productId,
          productName: it.productName,
          quantity: it.quantity,
          image: Array.isArray(it.images) && it.images.length > 0 ? it.images[0] : (Array.isArray(it.image) ? it.image[0] : it.image)
        })) : []
      })) : []
    };

    return res.json({ ok: true, order: response });
  } catch (err) {
    return res.status(500).json({ ok: false, msg: 'Failed to track order', error: err.message });
  }
}

// Admin: mark order as delivered (complete the flow)
exports.adminDeliverOrder = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, msg: 'Access denied' });
    }
    const { id } = req.params;
    const { adminNotes } = req.body || {};
    const order = await OrderModel.findById(id);
    if (!order) return res.status(404).json({ ok: false, msg: 'Order not found' });
    if (order.isDeleted) return res.status(400).json({ ok: false, msg: 'Order is deleted' });
    if (order.deliveryStatus === 'delivered' || order.status === 'completed') {
      return res.json({ ok: true, msg: 'Order already delivered', order });
    }
    // Allow delivering from shipped or verified
    order.deliveryStatus = 'delivered';
    order.status = 'completed';
    order.deliveryDate = new Date();
    if (adminNotes) order.adminNotes = adminNotes;
    order.updatedAt = new Date();
    await order.save();
    return res.json({ ok: true, msg: 'Order marked as delivered', order });
  } catch (err) {
    return res.status(500).json({ ok: false, msg: 'Failed to mark delivered', error: err.message });
  }
}
// Get a single user order by ID
exports.getUserOrderById = async (req, res) => {
  try {
    const userId = req.userid;
    const { id } = req.params;
    const order = await OrderModel.findOne({ _id: id, userId, isDeleted: { $ne: true } });
    if (!order) return res.status(404).json({ ok: false, msg: 'Order not found' });
    return res.json({ ok: true, order });
  } catch (err) {
    return res.status(500).json({ ok: false, msg: 'Failed to fetch order', error: err.message });
  }
}

// Buy cart products
exports.buyCartProducts = async (req, res) => {
  try {
    let cartItems;
    if (req.body.singleCartId) {
      // Buy single cart product
      cartItems = await CartModel.find({ _id: req.body.singleCartId, userid: req.userid });
      if (!cartItems.length) return res.status(400).json({ msg: "Cart item not found", ok: false });
    } else {
      // Buy all cart products
      cartItems = await CartModel.find({ userid: req.userid });
      if (!cartItems.length) return res.status(400).json({ msg: "Cart is empty", ok: false });
    }

    const orderItems = cartItems.map((item) => ({
      productId: item.productId,
      productName: item.title,
      description: item.description,
      image: Array.isArray(item.image) ? item.image[0] : item.image,
      quantity: item.Qty,
      price: item.afterQtyprice || item.price,
      totalPrice: item.total
    }));

    const totalAmount = cartItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const shippingAddress = req.body.shippingAddress || 'Default Shipping Address';

    // Optional payment details from Razorpay verification
    const paymentDetails = req.body.paymentDetails || {};


    const order = new OrderModel({
      userId: req.userid,
      products: cartItems.map((item) => item.productId),
      orderItems,
      totalAmount,
      shippingAddress,
      paymentStatus: paymentDetails.provider === 'razorpay' ? 'paid' : (paymentDetails.provider === 'cod' ? 'pending' : 'unpaid'),
      paymentDetails: {
        provider: paymentDetails.provider || null,
        transactionId: paymentDetails.razorpay_payment_id || null,
        razorpay_order_id: paymentDetails.razorpay_order_id || null,
        paymentDate: paymentDetails.provider === 'razorpay' ? new Date() : null,
        paymentAmount: paymentDetails.provider === 'razorpay' ? totalAmount : (paymentDetails.provider === 'cod' ? totalAmount : 0),
        paymentStatus: paymentDetails.provider === 'razorpay' ? 'completed' : (paymentDetails.provider === 'cod' ? 'pending' : 'pending')
      }
    });

    await order.save();
    // Record admin-facing transaction
    try {
      await Transaction.create({
        userId: req.userid,
        orderId: order._id,
        cost: String(totalAmount),
        products: cartItems.map((item) => item.productId),
      });
    } catch (e) {
    }
    // Send receipt email if paid
    if (order.paymentStatus === 'paid') {
      try {
        const user = await UserModel.findById(req.userid);
        await sendOrderReceipt(user?.email, order);
      } catch (e) {
      }
    }
    // Remove only the bought cart item if single, else all
    if (req.body.singleCartId) {
      await CartModel.deleteOne({ _id: req.body.singleCartId, userid: req.userid });
    } else {
      await CartModel.deleteMany({ userid: req.userid });
    }

    res.json({ msg: "Order placed successfully", ok: true });
  } catch (err) {
    res.status(500).json({ msg: "Error placing order", ok: false, error: err.message });
  }
}

// Buy selected cart products as a single consolidated order
exports.buySelectedCartProducts = async (req, res) => {
  try {
    const { cartIds, shippingAddress, paymentDetails } = req.body || {};

    // Log incoming request for easier debugging when a 500 occurs
    try {
      console.log('[buySelectedCartProducts] incoming', { userId: req.userid, cartIds, shippingAddress, paymentDetails });
    } catch (_) {}

    if (!Array.isArray(cartIds) || cartIds.length === 0) {
      return res.status(400).json({ ok: false, msg: 'cartIds array is required' });
    }

    // Basic validation: ensure all cartIds are non-empty strings (avoid Mongoose CastError)
    const invalidId = cartIds.find(id => typeof id !== 'string' && typeof id !== 'number');
    if (invalidId !== undefined) {
      return res.status(400).json({ ok: false, msg: 'cartIds must be an array of id strings' });
    }

    let cartItems;
    try {
      cartItems = await CartModel.find({ _id: { $in: cartIds }, userid: req.userid });
    } catch (err) {
      // Handle Mongoose cast errors or other DB-level issues
      console.error('[buySelectedCartProducts] CartModel.find error:', err && err.stack ? err.stack : err);
      return res.status(400).json({ ok: false, msg: 'Invalid cartIds or database query failed', error: err && err.message });
    }

    if (!cartItems.length) {
      return res.status(400).json({ ok: false, msg: 'No cart items found for given IDs' });
    }

    const orderItems = cartItems.map((item) => ({
      productId: item.productId,
      productName: item.title,
      description: item.description,
      image: Array.isArray(item.image) ? item.image[0] : item.image,
      quantity: item.Qty,
      price: item.afterQtyprice || item.price,
      totalPrice: item.total
    }));

    const totalAmount = cartItems.reduce((sum, item) => sum + (item.total || 0), 0);

    // Validate paymentDetails shape minimally
    if (paymentDetails && typeof paymentDetails !== 'object') {
      return res.status(400).json({ ok: false, msg: 'paymentDetails must be an object when provided' });
    }

    // Validate shippingAddress type
    if (shippingAddress && typeof shippingAddress !== 'string') {
      try {
        // allow objects that can be stringified to a readable address
        if (typeof shippingAddress === 'object') {
          // keep it, the schema expects string so we'll stringify later if needed
        } else {
          return res.status(400).json({ ok: false, msg: 'shippingAddress must be a string or address object' });
        }
      } catch (_) {
        return res.status(400).json({ ok: false, msg: 'Invalid shippingAddress' });
      }
    }

    const order = new OrderModel({
      userId: req.userid,
      products: cartItems.map((item) => item.productId),
      orderItems,
      totalAmount,
      shippingAddress: typeof shippingAddress === 'string' ? shippingAddress : (shippingAddress ? JSON.stringify(shippingAddress) : 'Default Shipping Address'),
      paymentStatus: paymentDetails?.provider === 'razorpay' ? 'paid' : (paymentDetails?.provider === 'cod' ? 'pending' : 'unpaid'),
      paymentMethod: paymentDetails?.provider === 'razorpay' ? 'razorpay' : (paymentDetails?.provider === 'cod' ? 'cod' : 'credit_card'),
      paymentDetails: {
        provider: paymentDetails?.provider || null,
        transactionId: paymentDetails?.razorpay_payment_id || null,
        razorpay_order_id: paymentDetails?.razorpay_order_id || null,
        paymentDate: paymentDetails?.provider === 'razorpay' ? new Date() : null,
        paymentAmount: totalAmount,
        paymentStatus: paymentDetails?.provider === 'razorpay' ? 'completed' : (paymentDetails?.provider === 'cod' ? 'pending' : 'pending')
      }
    });

    await order.save();
    // Record admin-facing transaction
    try {
      await Transaction.create({
        userId: req.userid,
        orderId: order._id,
        cost: String(totalAmount),
        products: cartItems.map((item) => item.productId),
      });
    } catch (e) {
    }
    // Send receipt email if paid
    if (order.paymentStatus === 'paid') {
      try {
        const user = await UserModel.findById(req.userid);
        await sendOrderReceipt(user?.email, order);
      } catch (e) {
      }
    }
    await CartModel.deleteMany({ _id: { $in: cartIds }, userid: req.userid });

    return res.json({ ok: true, msg: 'Order placed successfully', orderId: order._id });
  } catch (err) {
    return res.status(500).json({ ok: false, msg: 'Error placing consolidated order', error: err.message });
  }
}

// Cancel order
exports.cancelOrder = async (req, res) => {
  try {
    const userId = req.userid;
    const orderId = req.params.id;
    const order = await OrderModel.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).json({ ok: false, msg: "Order not found." });
    }
    if (order.status === 'cancelled') {
      return res.status(400).json({ ok: false, msg: "Order already cancelled." });
    }
    if (order.status === 'completed') {
      return res.status(400).json({ ok: false, msg: "Completed order cannot be cancelled." });
    }

    // If order is paid via Razorpay, initiate refund first (supports optional partial amount in INR)
    if (order.paymentStatus === 'paid' && order.paymentDetails && order.paymentDetails.transactionId) {
      try {
        const key_id = process.env.RAZORPAY_KEY_ID;
        const key_secret = process.env.RAZORPAY_SECRET;
        if (!key_id || !key_secret) {
          return res.status(500).json({ ok: false, msg: 'Razorpay credentials not configured' });
        }
        const auth = Buffer.from(`${key_id}:${key_secret}`).toString('base64');
        const amountInPaise = req.body && typeof req.body.amount === 'number' && req.body.amount > 0 ? Math.round(req.body.amount * 100) : undefined;
        const rpRes = await axios.post(
          `https://api.razorpay.com/v1/payments/${order.paymentDetails.transactionId}/refund`,
          amountInPaise ? { amount: amountInPaise } : {},
          { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' } }
        );
        order.adminNotes = `Refund initiated: ${rpRes.data?.id || 'unknown'}`;
      } catch (e) {
        return res.status(500).json({ ok: false, msg: 'Failed to initiate refund. Please try again or contact support.' });
      }
    }

    order.status = 'cancelled';
    order.isDeleted = true;
    order.deletedAt = new Date();
    await order.save();
    res.json({ ok: true, msg: "Order cancelled successfully." });
  } catch (err) {
    res.status(500).json({ ok: false, msg: "Failed to cancel order.", error: err.message });
  }
}


// show all orders access only admin (exclude soft-deleted)
exports.getAllOrders = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
          return res.status(403).json({ msg: "Access denied", ok: false });
        }
        const orders = await OrderModel
          .find({ isDeleted: { $ne: true } })
          .populate("userId")
          .sort({ createdAt: -1 });
        res.json({ orders, ok: true });
    } catch (err) {
        res.status(500).json({ msg: "Failed to fetch orders", ok: false, error: err.message });
    }
}

// Admin: verify an order
exports.verifyOrder = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, msg: 'Access denied' });
    }
    const { id } = req.params;
    const { adminNotes } = req.body || {};
    const order = await OrderModel.findById(id);
    if (!order) return res.status(404).json({ ok: false, msg: 'Order not found' });
    if (order.isDeleted) return res.status(400).json({ ok: false, msg: 'Order is deleted' });
    if (order.isVerified) {
      return res.json({ ok: true, msg: 'Order already verified', order });
    }
    order.isVerified = true;
    order.verifiedAt = new Date();
    order.verifiedBy = req.userid;
    if (adminNotes) order.adminNotes = adminNotes;
    order.updatedAt = new Date();
    await order.save();
    return res.json({ ok: true, msg: 'Order verified', order });
  } catch (err) {
    return res.status(500).json({ ok: false, msg: 'Failed to verify order', error: err.message });
  }
}

// Admin: confirm order for delivery (mark as shipped)
exports.confirmOrderForDelivery = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, msg: 'Access denied' });
    }
    const { id } = req.params;
    const { trackingNumber, deliveryDate, adminNotes } = req.body || {};
    const order = await OrderModel.findById(id);
    if (!order) return res.status(404).json({ ok: false, msg: 'Order not found' });
    if (order.isDeleted) return res.status(400).json({ ok: false, msg: 'Order is deleted' });
    if (!order.isVerified) {
      return res.status(400).json({ ok: false, msg: 'Order must be verified before confirming delivery' });
    }
    if (order.deliveryStatus === 'shipped' || order.deliveryStatus === 'delivered') {
      return res.json({ ok: true, msg: 'Order already confirmed for delivery', order });
    }
    order.deliveryStatus = 'shipped';
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (deliveryDate) order.deliveryDate = new Date(deliveryDate);
    if (adminNotes) order.adminNotes = adminNotes;
    order.updatedAt = new Date();
    await order.save();
    return res.json({ ok: true, msg: 'Order confirmed for delivery', order });
  } catch (err) {
    return res.status(500).json({ ok: false, msg: 'Failed to confirm delivery', error: err.message });
  }
}

// Admin: delete (soft-delete) an order
exports.adminDeleteOrder = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, msg: 'Access denied' });
    }
    const { id } = req.params;
    const order = await OrderModel.findById(id);
    if (!order) return res.status(404).json({ ok: false, msg: 'Order not found' });
    if (order.isDeleted) return res.status(400).json({ ok: false, msg: 'Order already deleted' });
    order.isDeleted = true;
    order.deletedAt = new Date();
    order.updatedAt = new Date();
    await order.save();
    return res.json({ ok: true, msg: 'Order deleted', orderId: id });
  } catch (err) {
    return res.status(500).json({ ok: false, msg: 'Failed to delete order', error: err.message });
  }
}