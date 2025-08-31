const { CartModel } = require("../models/cart.model.js");

// Get All Cart Items
exports.getAllCartItems = async (req, res) => {
  const token = req.headers.authorization;
  try {
    const product = await CartModel.find({ userId: req.userid });
    return res.json({ data: product });
  } catch (error) {
    res.json({ msg: "Error", Error: error.message });
  }
}

// Get Cart Item by ID
exports.getCartItemById = async (req, res) => {
  try {
    const userId = req.userid;
    const cartId = req.params.id;
    const cartItem = await CartModel.findOne({ _id: cartId, userId });
    if (!cartItem) {
      return res.status(404).json({ msg: 'Cart item not found' });
    }
    res.json({ data: cartItem });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to fetch cart item', error: err.message });
  }
}

// Add to Cart
exports.addToCart = async (req, res) => {
  let payload = req.body;
  const productId = req.body.productId;
  const userId = req.userid;

  try {
    const product = await CartModel.findOne({ productId, userId, "variation": { size: payload.variation.size, color: payload.variation.color }  }); 
    if (product) {
      return res.json({ msg: "Product already in cart" });
    }

    payload.userId = userId;
    const newproduct = new CartModel(payload);
    await newproduct.save();
    return res.json({ msg: "Product added to cart successfully", ok: true, data: newproduct });
  } catch (error) {
    res.status(500).json({ msg: "Error", ok: false, error: error.message });
  }
}

// Remove from Cart
exports.removeFromCart = async (req, res) => {
  try {
    const id = req.params.id;
    await CartModel.findByIdAndDelete({ _id: id });
    return res.json({ msg: "Product Removed" });
  } catch (error) {
    res.json({ msg: "Error", Error: error.message });
  }
}

// Update Cart Item Quantity
exports.updateCartItemQty = async (req, res) => {
  try {
    const id = req.params.id;
    const { Qty } = req.body;
    if (typeof Qty !== 'number' || Qty < 1) {
      return res.status(400).json({ msg: 'Invalid quantity' });
    }

    // Update Qty and keep other fields unchanged
    const updated = await CartModel.findByIdAndUpdate(
      { _id: id },
      { $set: { Qty: Qty, 'variation.quantity': Qty } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ msg: 'Cart item not found' });
    }

    return res.json({ msg: 'Cart updated', data: updated });
  } catch (error) {
    res.status(500).json({ msg: 'Error', Error: error.message });
  }
}
