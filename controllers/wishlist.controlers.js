import { WishlistModel } from "../models/wishlist.model.js";
// Get Wishlist
export const getWishlist = async (req, res) => {
  try {
    const wishlist = await WishlistModel.findOne({ userId: req.userid }).populate("productIds");
    res.json({ wishlist: wishlist?.productIds, ok: true });
  } catch (error) {
    res.status(500).json({ msg: "Error", ok: false, error: error.message });
  }
}

// Add to Wishlist
export const addToWishlist = async (req, res) => {
  const { productId } = req.body;
  try {
    let wishlist = await WishlistModel.findOne({ userId: req.userid });

    if (!wishlist) {
      wishlist = new WishlistModel({ userId: req.userid, productIds: [productId] });
    } else if (!wishlist.productIds.includes(productId)) {
      wishlist.productIds.push(productId);
    }

    await wishlist.save();
    res.json({ msg: "Product added to wishlist", ok: true, data: wishlist });
  } catch (error) {
    res.status(500).json({ msg: "Error", ok: false, error: error.message });
  }
}

// Remove from Wishlist
export const removeFromWishlist = async (req, res) => {
  const { productId } = req.body;
  try {
    const wishlist = await WishlistModel.findOne({ userId: req.userid });
    if (wishlist) {
      wishlist.productIds = wishlist.productIds.filter(p => p.toString() !== productId);
      await wishlist.save();
    }
    res.json({ msg: "Product removed from wishlist", ok: true });
  } catch (error) {
    res.status(500).json({ msg: "Error", ok: false, error: error.message });
  }
}