const express = require("express");

const { authenticator } = require("../../middlewares/authenticator.middleware");
const { 
    getAllReviewsForProduct, 
    getAllReviews, 
    addReview,
    updateReview,
    deleteReview
} = require("../../controllers/reviews.controlers");
const { adminMiddleware } = require("../../middlewares/admin.middleware");

const ReviewRouter = express.Router();

// GET all reviews
ReviewRouter.get("/reviews", getAllReviews);

// GET all reviews for product
ReviewRouter.get("/reviews/product/:productId", getAllReviewsForProduct);

// POST a review, update product rating & count
ReviewRouter.post("/reviews/product/:productId", authenticator, addReview);

// UPDATE a review
ReviewRouter.put("/reviews/:reviewId", authenticator, updateReview);

// DELETE a review
ReviewRouter.delete("/reviews/:reviewId", authenticator, deleteReview);

module.exports = { ReviewRouter };
