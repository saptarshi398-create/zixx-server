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
    
    // Validate status transitions
    if (!order.isVerified) {
      return res.status(400).json({ ok: false, msg: 'Order must be verified before packing' });
    }
    if (order.status === 'cancelled') {
      return res.status(400).json({ ok: false, msg: 'Cannot pack cancelled order' });
    }
    if (order.status === 'completed') {
      return res.status(400).json({ ok: false, msg: 'Cannot pack completed order' });
    }
    if (order.deliveryStatus === 'shipped' || order.deliveryStatus === 'delivered') {
      return res.status(400).json({ ok: false, msg: 'Cannot pack shipped/delivered order' });
    }
    if (order.packedAt) {
      return res.json({ ok: true, msg: 'Order already packed', order });
    }

    // Update order status
    order.packedAt = new Date();
    order.status = 'packed';
    order.deliveryStatus = 'packing_complete';
    order.trackingStatus = 'Packed and Ready';
    if (adminNotes) order.adminNotes = adminNotes;
    order.updatedAt = new Date();
    
    // Audit trail
    try {
      order.auditTrail = Array.isArray(order.auditTrail) ? order.auditTrail : [];
      order.auditTrail.push({ 
        action: 'packed', 
        by: req.userid || req.user?._id || null, 
        at: new Date(), 
        meta: { 
          adminNotes: adminNotes || null,
          status: 'packed',
          deliveryStatus: 'packing_complete'
        } 
      });
    } catch (_) {}

    await order.save();
    return res.json({ 
      ok: true, 
      msg: 'Order packed successfully. Ready for shipping.', 
      order,
      nextAction: 'ship'  // Hint for frontend about next possible action
    });
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
      shippingAddress: order.shippingAddress || 'Address not provided',
      formattedAddress: (() => {
        let addr = order.shippingAddress;
        if (typeof addr === 'string') {
          try {
            // Try to parse if it's a stringified JSON
            const parsed = JSON.parse(addr);
            if (typeof parsed === 'object') {
              addr = parsed;
            }
          } catch (e) {
            // If not JSON, return as is
            return addr;
          }
        }
        if (typeof addr === 'object') {
          return [
            addr.name,
            addr.street || addr.address,
            addr.apartment && `Apt/Suite: ${addr.apartment}`,
            addr.landmark && `Landmark: ${addr.landmark}`,
            addr.city,
            addr.state,
            addr.pinCode || addr.zip || addr.postalCode,
            addr.phone && `Phone: ${addr.phone}`
          ]
            .filter(Boolean)
            .join('\n');
        }
        return addr || 'Address not provided';
      })(),
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
    const { adminNotes, deliveryProof } = req.body || {};
    const order = await OrderModel.findById(id);
    if (!order) return res.status(404).json({ ok: false, msg: 'Order not found' });
    if (order.isDeleted) return res.status(400).json({ ok: false, msg: 'Order is deleted' });

    // Validate status transitions
    if (!order.isVerified) {
      return res.status(400).json({ ok: false, msg: 'Order must be verified before marking as delivered' });
    }
    if (!order.packedAt) {
      return res.status(400).json({ ok: false, msg: 'Order must be packed before marking as delivered' });
    }
    if (order.status === 'cancelled') {
      return res.status(400).json({ ok: false, msg: 'Cannot deliver cancelled order' });
    }
    if (order.deliveryStatus === 'delivered' || order.status === 'completed') {
      return res.json({ ok: true, msg: 'Order is already delivered', order });
    }
    if (order.deliveryStatus !== 'shipped') {
      return res.status(400).json({ ok: false, msg: 'Order must be shipped before marking as delivered' });
    }

    // Update order status
    order.deliveryStatus = 'delivered';
    order.status = 'completed';
    order.trackingStatus = 'Delivered';
    order.deliveryDate = new Date();
    order.deliveredAt = new Date();
    if (adminNotes) order.adminNotes = adminNotes;
    if (deliveryProof) order.deliveryProof = deliveryProof;
    order.updatedAt = new Date();

    // Add to audit trail
    try {
      order.auditTrail = Array.isArray(order.auditTrail) ? order.auditTrail : [];
      order.auditTrail.push({
        action: 'delivered',
        by: req.userid || req.user?._id || null,
        at: new Date(),
        meta: {
          deliveryProof,
          adminNotes: adminNotes || null,
          status: 'completed',
          deliveryStatus: 'delivered'
        }
      });
    } catch (_) {}

    await order.save();

    // Try to send delivery confirmation to customer
    try {
      const user = await UserModel.findById(order.userId);
      if (user?.email) {
        // You can implement sendDeliveryConfirmation in mailer.js
        // await sendDeliveryConfirmation(user.email, order);
      }
    } catch (e) {}

    return res.json({
      ok: true,
      msg: 'Order marked as delivered successfully',
      order,
      nextAction: 'complete' // Indicates this is the final state
    });
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
      price: item.price, // Final calculated price per unit
      basePrice: item.basePrice || item.price,
      tax: item.tax,
      shippingCost: item.shippingCost,
      discount: item.discount,
      totalPrice: item.total
    }));

    const totalAmount = cartItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const shippingAddress = req.body.shippingAddress || 'Default Shipping Address';

    // Optional payment details from Razorpay verification
    const paymentDetails = req.body.paymentDetails || {};


    // Idempotency: allow client to provide a batchId so retries don't create duplicate orders
    const batchId = req.body.batchId || (paymentDetails && paymentDetails.razorpay_order_id) || null;

    // If an order already exists for this user with the same batchId or payment transaction id, return it
    if (batchId) {
      const existing = await OrderModel.findOne({ userId: req.userid, $or: [{ batchId }, { 'paymentDetails.transactionId': batchId }] });
      if (existing) {
        return res.json({ msg: 'Order already exists', ok: true, orderId: existing._id });
      }
    }

    // If multiple cart items are being purchased together, create separate orders per item
    if (Array.isArray(cartItems) && cartItems.length > 1) {
      const createdOrderIds = [];
      const baseBatch = batchId || null;
      for (const item of cartItems) {
        const singleOrderItems = [{
          productId: item.productId,
          productName: item.title,
          description: item.description,
          image: Array.isArray(item.image) ? item.image[0] : item.image,
          quantity: item.Qty,
          price: item.price, // Final calculated price per unit
      basePrice: item.basePrice || item.price,
      tax: item.tax,
      shippingCost: item.shippingCost,
      discount: item.discount,
          totalPrice: item.total || (item.price * item.Qty)
        }];

        const singleTotal = singleOrderItems[0].totalPrice || 0;
        const itemBatchId = baseBatch ? `${baseBatch}-${String(item._id)}` : null;

        // idempotency per-item
        if (itemBatchId) {
          const existing = await OrderModel.findOne({ userId: req.userid, $or: [{ batchId: itemBatchId }, { 'paymentDetails.transactionId': itemBatchId }] });
          if (existing) {
            createdOrderIds.push(existing._id);
            continue;
          }
        }

        const singleOrder = new OrderModel({
          userId: req.userid,
          products: [item.productId],
          orderItems: singleOrderItems,
          totalAmount: singleTotal,
          shippingAddress,
          batchId: itemBatchId,
          paymentStatus: paymentDetails.provider === 'razorpay' ? 'paid' : (paymentDetails.provider === 'cod' ? 'pending' : 'unpaid'),
          paymentDetails: {
            provider: paymentDetails.provider || null,
            transactionId: paymentDetails.razorpay_payment_id || null,
            razorpay_order_id: paymentDetails.razorpay_order_id || null,
            paymentDate: paymentDetails.provider === 'razorpay' ? new Date() : null,
            paymentAmount: paymentDetails.provider === 'razorpay' ? singleTotal : (paymentDetails.provider === 'cod' ? singleTotal : 0),
            paymentStatus: paymentDetails.provider === 'razorpay' ? 'completed' : (paymentDetails.provider === 'cod' ? 'pending' : 'pending')
          }
        });

        await singleOrder.save();
        try {
          await Transaction.create({ userId: req.userid, orderId: singleOrder._id, cost: String(singleTotal), products: [item.productId] });
        } catch (e) {}
        if (singleOrder.paymentStatus === 'paid') {
          try { const u = await UserModel.findById(req.userid); await sendOrderReceipt(u?.email, singleOrder); } catch (e) {}
        }
        createdOrderIds.push(singleOrder._id);
      }

      // Remove bought cart items
      if (req.body.singleCartId) {
        await CartModel.deleteOne({ _id: req.body.singleCartId, userid: req.userid });
      } else {
        await CartModel.deleteMany({ userid: req.userid });
      }

      return res.json({ msg: 'Orders placed successfully', ok: true, orderIds: createdOrderIds });
    }

    // Single item purchase - create one order as before
    const order = new OrderModel({
      userId: req.userid,
      products: cartItems.map((item) => item.productId),
      orderItems,
      totalAmount,
      shippingAddress,
      batchId,
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
    try {
      await Transaction.create({
        userId: req.userid,
        orderId: order._id,
        cost: String(totalAmount),
        products: cartItems.map((item) => item.productId),
      });
    } catch (e) {}
    if (order.paymentStatus === 'paid') {
      try { const user = await UserModel.findById(req.userid); await sendOrderReceipt(user?.email, order); } catch (e) {}
    }
    if (req.body.singleCartId) {
      await CartModel.deleteOne({ _id: req.body.singleCartId, userid: req.userid });
    } else {
      await CartModel.deleteMany({ userid: req.userid });
    }

    return res.json({ msg: 'Order placed successfully', ok: true, orderId: order._id });
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
      price: item.price, // Final calculated price per unit
      basePrice: item.basePrice || item.price,
      tax: item.tax,
      shippingCost: item.shippingCost,
      discount: item.discount,
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

    // Idempotency: allow client to provide a batchId so retries don't create duplicate orders
    const batchId = req.body.batchId || (paymentDetails && paymentDetails.razorpay_order_id) || null;
    if (batchId) {
      const existing = await OrderModel.findOne({ userId: req.userid, $or: [{ batchId }, { 'paymentDetails.transactionId': batchId }] });
      if (existing) {
        return res.json({ ok: true, msg: 'Order already exists', orderId: existing._id });
      }
    }

    // Create separate orders for each cart item
    const createdOrderIds = [];
    const baseBatch = batchId || null;

    for (const item of cartItems) {
      const singleOrderItems = [{
        productId: item.productId,
        productName: item.title,
        description: item.description,
        image: Array.isArray(item.image) ? item.image[0] : item.image,
        quantity: item.Qty,
        price: item.price, // Final calculated price per unit
      basePrice: item.basePrice || item.price,
      tax: item.tax,
      shippingCost: item.shippingCost,
      discount: item.discount,
        totalPrice: item.total || (item.price * item.Qty)
      }];

      const singleTotal = singleOrderItems[0].totalPrice || 0;
      const itemBatchId = baseBatch ? `${baseBatch}-${String(item._id)}` : null;

      // idempotency per-item
      if (itemBatchId) {
        const existing = await OrderModel.findOne({ userId: req.userid, $or: [{ batchId: itemBatchId }, { 'paymentDetails.transactionId': itemBatchId }] });
        if (existing) {
          createdOrderIds.push(existing._id);
          continue;
        }
      }

      // Format shipping address
      let formattedAddress = 'Default Shipping Address';
      if (shippingAddress) {
        if (typeof shippingAddress === 'string') {
          formattedAddress = shippingAddress;
        } else if (typeof shippingAddress === 'object') {
          // Format address object into readable string
          const addr = shippingAddress;
          formattedAddress = [
            addr.name,
            addr.street || addr.address,
            addr.apartment,
            addr.landmark,
            addr.city,
            addr.state,
            addr.pinCode || addr.zip || addr.postalCode,
            addr.phone
          ]
            .filter(Boolean) // Remove empty/undefined values
            .join(', ');
        }
      }

      const singleOrder = new OrderModel({
        userId: req.userid,
        products: [item.productId],
        orderItems: singleOrderItems,
        totalAmount: singleTotal,
        shippingAddress: formattedAddress,
        batchId: itemBatchId,
        paymentStatus: paymentDetails?.provider === 'razorpay' ? 'paid' : (paymentDetails?.provider === 'cod' ? 'pending' : 'unpaid'),
        paymentMethod: paymentDetails?.provider === 'razorpay' ? 'razorpay' : (paymentDetails?.provider === 'cod' ? 'cod' : 'credit_card'),
        paymentDetails: {
          provider: paymentDetails?.provider || null,
          transactionId: paymentDetails?.razorpay_payment_id || null,
          razorpay_order_id: paymentDetails?.razorpay_order_id || null,
          paymentDate: paymentDetails?.provider === 'razorpay' ? new Date() : null,
          paymentAmount: singleTotal,
          paymentStatus: paymentDetails?.provider === 'razorpay' ? 'completed' : (paymentDetails?.provider === 'cod' ? 'pending' : 'pending')
        }
      });

      await singleOrder.save();
      
      // Record admin-facing transaction
      try {
        await Transaction.create({
          userId: req.userid,
          orderId: singleOrder._id,
          cost: String(singleTotal),
          products: [item.productId]
        });
      } catch (e) {}

      // Send receipt email if paid
      if (singleOrder.paymentStatus === 'paid') {
        try {
          const user = await UserModel.findById(req.userid);
          await sendOrderReceipt(user?.email, singleOrder);
        } catch (e) {}
      }

      createdOrderIds.push(singleOrder._id);
    }

    // Remove bought cart items
    await CartModel.deleteMany({ _id: { $in: cartIds }, userid: req.userid });

    return res.json({ ok: true, msg: 'Orders placed successfully', orderIds: createdOrderIds });
  } catch (err) {
    return res.status(500).json({ ok: false, msg: 'Error placing consolidated order', error: err.message });
  }
}

// Cancel order (both admin and user)
exports.cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { cancelReason, adminNotes, refundAmount } = req.body || {};
    
    // Find order - admin can cancel any order, user can only cancel their own
    const orderQuery = req.user?.role === 'admin' 
      ? { _id: orderId }
      : { _id: orderId, userId: req.userid };
    
    const order = await OrderModel.findOne(orderQuery);
    if (!order) {
      return res.status(404).json({ ok: false, msg: "Order not found." });
    }

    // Validate cancellation
    if (order.status === 'cancelled') {
      return res.status(400).json({ ok: false, msg: "Order already cancelled." });
    }
    if (order.status === 'completed' || order.deliveryStatus === 'delivered') {
      return res.status(400).json({ ok: false, msg: "Completed/Delivered order cannot be cancelled." });
    }
    if (!req.user?.role === 'admin' && order.deliveryStatus === 'shipped') {
      return res.status(400).json({ ok: false, msg: "Cannot cancel order after shipping. Please contact support." });
    }
    if (!cancelReason) {
      return res.status(400).json({ ok: false, msg: "Cancellation reason is required." });
    }

    // Handle refund for paid orders
    let refundId = null;
    if (order.paymentStatus === 'paid' && order.paymentDetails?.transactionId) {
      try {
        const key_id = process.env.RAZORPAY_KEY_ID;
        const key_secret = process.env.RAZORPAY_SECRET;
        if (!key_id || !key_secret) {
          return res.status(500).json({ ok: false, msg: 'Payment gateway credentials not configured' });
        }

        const auth = Buffer.from(`${key_id}:${key_secret}`).toString('base64');
        // Calculate refund amount - allow partial refunds for admin
        let amountInPaise;
        if (req.user?.role === 'admin' && refundAmount) {
          amountInPaise = Math.round(refundAmount * 100);
        } else {
          amountInPaise = Math.round(order.totalAmount * 100);
        }

        const rpRes = await axios.post(
          `https://api.razorpay.com/v1/payments/${order.paymentDetails.transactionId}/refund`,
          { amount: amountInPaise },
          { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' } }
        );
        refundId = rpRes.data?.id;
      } catch (e) {
        return res.status(500).json({ 
          ok: false, 
          msg: 'Failed to process refund. Please try again or contact support.',
          error: e.message 
        });
      }
    }

    // Update order status
    const previousStatus = order.status;
    const previousDeliveryStatus = order.deliveryStatus;

    order.status = 'cancelled';
    order.deliveryStatus = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelledBy = req.user?.role === 'admin' ? 'admin' : 'user';
    order.cancelReason = cancelReason;
    if (adminNotes) order.adminNotes = adminNotes;
    order.updatedAt = new Date();

    // Add to audit trail
    try {
      order.auditTrail = Array.isArray(order.auditTrail) ? order.auditTrail : [];
      order.auditTrail.push({
        action: 'cancelled',
        by: req.userid || req.user?._id || null,
        at: new Date(),
        meta: {
          previousStatus,
          previousDeliveryStatus,
          cancelReason,
          adminNotes: adminNotes || null,
          refundId,
          refundAmount: refundAmount || order.totalAmount,
          cancelledBy: req.user?.role === 'admin' ? 'admin' : 'user'
        }
      });
    } catch (_) {}

    await order.save();

    // Notify customer about cancellation
    try {
      const user = await UserModel.findById(order.userId);
      if (user?.email) {
        // You can implement sendCancellationEmail in mailer.js
        // await sendCancellationEmail(user.email, order);
      }
    } catch (e) {}

    res.json({ 
      ok: true, 
      msg: "Order cancelled successfully.", 
      refundInitiated: !!refundId,
      refundId,
      order 
    });
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

        // Format addresses for admin panel
        const formattedOrders = orders.map(order => {
          const orderObj = order.toObject();
          let addr = orderObj.shippingAddress;
          
          try {
            // If address is stored as string but contains JSON
            if (typeof addr === 'string') {
              const parsed = JSON.parse(addr);
              if (typeof parsed === 'object') {
                addr = parsed;
              }
            }
          } catch (e) {
            // If not JSON string, keep as is
          }
          if (typeof addr === 'object') {
            orderObj.formattedAddress = [
              addr.name,
              addr.street || addr.address,
              addr.apartment && `Apt/Suite: ${addr.apartment}`,
              addr.landmark && `Landmark: ${addr.landmark}`,
              addr.city,
              addr.state,
              addr.pinCode || addr.zip || addr.postalCode,
              addr.phone && `Phone: ${addr.phone}`
            ]
              .filter(Boolean)
              .join('\n');
          } else {
            orderObj.formattedAddress = addr || 'Address not provided';
          }
          
          return orderObj;
        });

        res.json({ orders: formattedOrders, ok: true });
    } catch (err) {
        res.status(500).json({ msg: "Failed to fetch orders", ok: false, error: err.message });
    }
}

// Admin: verify an order
exports.verifyOrder = async (req, res) => {
  try {
    // Validate admin role and get user info
    if (!req.user || !req.userid || req.user.role !== 'admin') {
      console.error('Admin access denied', { user: req.user, userid: req.userid });
      return res.status(403).json({ ok: false, msg: 'Access denied: Admin privileges required' });
    }

    // Get and validate order ID
    const { id } = req.params;
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ ok: false, msg: 'Invalid order ID format' });
    }

    const { adminNotes } = req.body || {};
    const order = await OrderModel.findById(id);
    
    // Validate order exists
    if (!order) {
      console.error('Order not found', { orderId: id });
      return res.status(404).json({ ok: false, msg: 'Order not found' });
    }
    
    if (order.isDeleted) {
      console.error('Cannot verify deleted order', { orderId: id });
      return res.status(400).json({ ok: false, msg: 'Order is deleted' });
    }
    
    // Check valid status transitions
    if (order.status === 'cancelled') {
      return res.status(400).json({ ok: false, msg: 'Cannot verify cancelled order' });
    }
    
    if (order.status === 'completed') {
      return res.status(400).json({ ok: false, msg: 'Cannot verify completed order' });
    }
    
    if (order.isVerified) {
      console.log('Order already verified', { orderId: id });
      return res.json({ ok: true, msg: 'Order already verified', order });
    }

    // Update order status
    order.isVerified = true;
    order.verifiedAt = new Date();
    order.verifiedBy = req.userid;
    order.status = 'verified';
    order.trackingStatus = 'Verified';
    order.deliveryStatus = 'confirmed';
    if (adminNotes) order.adminNotes = adminNotes;
    order.updatedAt = new Date();

    // Add to audit trail
    try {
      order.auditTrail = Array.isArray(order.auditTrail) ? order.auditTrail : [];
      order.auditTrail.push({
        action: 'verified',
        by: req.userid || req.user?._id || null,
        at: new Date(),
        meta: { adminNotes: adminNotes || null }
      });
    } catch (_) {}

    await order.save();
    console.log('Order verified successfully', { 
      orderId: order._id,
      verifiedBy: req.userid,
      adminNotes: adminNotes || null 
    });
    return res.json({ 
      ok: true, 
      msg: 'Order verified successfully',
      order,
      nextAction: 'pack' // Hint for frontend about next possible action
    });
  } catch (err) {
    console.error('Failed to verify order', { 
      error: err.message,
      orderId: req.params.id,
      userId: req.userid
    });
    return res.status(500).json({ 
      ok: false, 
      msg: 'Failed to verify order. Please try again.',
      error: err.message
    });
  }
}

// Admin: confirm order for delivery (mark as shipped)
exports.confirmOrderForDelivery = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, msg: 'Access denied' });
    }
    const { id } = req.params;
  const { trackingNumber, deliveryDate, adminNotes, courierName, carrier, carrierUrl, courierPhone, courierLogoUrl } = req.body || {};
  // Accept either courierName or carrier for backwards/forwards compatibility
  const resolvedCourierName = (courierName || carrier || null);
    const order = await OrderModel.findById(id);
    if (!order) return res.status(404).json({ ok: false, msg: 'Order not found' });
    if (order.isDeleted) return res.status(400).json({ ok: false, msg: 'Order is deleted' });
    
    // Validate status transitions
    if (!order.isVerified) {
      return res.status(400).json({ ok: false, msg: 'Order must be verified before shipping' });
    }
    if (!order.packedAt) {
      return res.status(400).json({ ok: false, msg: 'Order must be packed before shipping' });
    }
    if (order.status === 'cancelled') {
      return res.status(400).json({ ok: false, msg: 'Cannot ship cancelled order' });
    }
    if (order.status === 'completed') {
      return res.status(400).json({ ok: false, msg: 'Cannot ship completed order' });
    }
    if (order.deliveryStatus === 'delivered') {
      return res.status(400).json({ ok: false, msg: 'Order is already delivered' });
    }
    if (order.deliveryStatus === 'shipped') {
      return res.json({ ok: true, msg: 'Order is already shipped', order });
    }

    // Validate shipping details
    if (!trackingNumber) {
      return res.status(400).json({ ok: false, msg: 'Tracking number is required for shipping' });
    }
    if (!resolvedCourierName) {
      return res.status(400).json({ ok: false, msg: 'Courier name (carrier) is required for shipping' });
    }

    // Basic validation helpers (reuse logic similar to adminUpdateCourier)
    const isHttpUrl = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);
    const normStr = (v) => (typeof v === 'string' ? v.trim() : undefined);
    const validPhone = (p) => {
      if (typeof p !== 'string') return false;
      const digits = p.replace(/\D/g, '');
      return digits.length >= 6 && digits.length <= 15;
    };

    // Update order status and shipping details
    order.deliveryStatus = 'shipped';
    order.status = 'in_transit';
    order.trackingStatus = 'Out for Delivery';
    order.trackingNumber = trackingNumber;
    // store the resolved carrier/courier name
    order.carrier = resolvedCourierName;
    // optional courier details
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
    order.shippedAt = new Date();
    if (deliveryDate) order.expectedDeliveryDate = new Date(deliveryDate);
    if (adminNotes) order.adminNotes = adminNotes;
    order.updatedAt = new Date();

    // Add to audit trail
    try {
      order.auditTrail = Array.isArray(order.auditTrail) ? order.auditTrail : [];
      order.auditTrail.push({
        action: 'shipped',
        by: req.userid || req.user?._id || null,
        at: new Date(),
        meta: {
          trackingNumber,
          courierName: resolvedCourierName,
          expectedDeliveryDate: deliveryDate,
          adminNotes: adminNotes || null
        }
      });
    } catch (_) {}

    await order.save();

    // Try to send shipping notification to customer
    try {
      const user = await UserModel.findById(order.userId);
      if (user?.email) {
        // You can implement sendShippingNotification in mailer.js
        // await sendShippingNotification(user.email, order);
      }
    } catch (e) {}

    return res.json({
      ok: true,
      msg: 'Order shipped successfully',
      order,
      nextAction: 'deliver' // Hint for frontend about next possible action
    });
  } catch (err) {
    return res.status(500).json({ ok: false, msg: 'Failed to confirm delivery', error: err.message });
  }
}

// Admin: revert order to previous status
exports.adminRevertOrderStatus = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, msg: 'Access denied' });
    }

    const { id } = req.params;
    const { adminNotes, reason } = req.body || {};
    
    const order = await OrderModel.findById(id);
    if (!order) return res.status(404).json({ ok: false, msg: 'Order not found' });
    if (order.isDeleted) return res.status(400).json({ ok: false, msg: 'Cannot revert deleted order' });
    
    // Get current status
    const currentStatus = order.status;
    const currentDeliveryStatus = order.deliveryStatus;
    
    // Define status flow and get previous status
    const statusFlow = ['pending', 'verified', 'packed', 'in_transit', 'completed'];
    const deliveryFlow = ['pending', 'packing_complete', 'shipped', 'delivered'];
    
    const currentStatusIndex = statusFlow.indexOf(currentStatus);
    const currentDeliveryIndex = deliveryFlow.indexOf(currentDeliveryStatus);
    
    if (currentStatusIndex <= 0) {
      return res.status(400).json({ ok: false, msg: 'Cannot revert order in pending status' });
    }

    // Revert to previous status
    const previousStatus = statusFlow[currentStatusIndex - 1];
    const previousDeliveryStatus = currentDeliveryIndex > 0 ? deliveryFlow[currentDeliveryIndex - 1] : 'pending';

    // Update order status
    order.status = previousStatus;
    order.deliveryStatus = previousDeliveryStatus;
    order.trackingStatus = previousStatus.charAt(0).toUpperCase() + previousStatus.slice(1);
    
    // Clear relevant timestamps based on reverted status
    if (previousStatus === 'pending') {
      order.verifiedAt = null;
      order.trackingStatus = 'Pending';
    }
    if (previousStatus === 'verified') {
      order.packedAt = null;
      order.trackingStatus = 'Verified';
    }
    if (previousStatus === 'packed') {
      order.shippedAt = null;
      order.trackingNumber = null;
      order.carrier = null;
    }
    if (previousStatus === 'in_transit') {
      order.deliveredAt = null;
      order.deliveryDate = null;
    }

    if (adminNotes) order.adminNotes = adminNotes;
    order.updatedAt = new Date();

    // Add to audit trail
    try {
      order.auditTrail = Array.isArray(order.auditTrail) ? order.auditTrail : [];
      order.auditTrail.push({
        action: 'status_reverted',
        by: req.userid || req.user?._id || null,
        at: new Date(),
        meta: {
          previousStatus: currentStatus,
          newStatus: previousStatus,
          previousDeliveryStatus: currentDeliveryStatus,
          newDeliveryStatus: previousDeliveryStatus,
          reason,
          adminNotes: adminNotes || null
        }
      });
    } catch (_) {}

    await order.save();

    return res.json({
      ok: true,
      msg: `Order reverted to ${previousStatus} status`,
      order,
      previousStatus: currentStatus,
      newStatus: previousStatus
    });

  } catch (err) {
    return res.status(500).json({ ok: false, msg: 'Failed to revert order status', error: err.message });
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