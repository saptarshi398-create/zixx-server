const express = require('express');
const {
  adminListTestimonials,
  adminApproveTestimonial,
  adminUpdateTestimonial,
  adminDeleteTestimonial,
} = require('../../controllers/testimonials.controller');
const { adminMiddleware } = require('../../middlewares/admin.middleware');

const TestimonialsAdminRouter = express.Router();

// Guard all testimonial admin routes
TestimonialsAdminRouter.use(adminMiddleware);

// GET /admin/testimonials?status=pending|approved|all
TestimonialsAdminRouter.get('/testimonials', adminListTestimonials);

// PATCH /admin/testimonials/:id/approve
TestimonialsAdminRouter.patch('/testimonials/:id/approve', adminApproveTestimonial);

// PUT /admin/testimonials/:id
TestimonialsAdminRouter.put('/testimonials/:id', adminUpdateTestimonial);

// DELETE /admin/testimonials/:id
TestimonialsAdminRouter.delete('/testimonials/:id', adminDeleteTestimonial);

module.exports = { TestimonialsAdminRouter };
