const express = require('express');
const { adminMiddleware } = require('../../middlewares/admin.middleware');
const { upload, cloudinaryUploadMiddleware } = require('../../middlewares/cloudinaryUpload');
const {
  adminListBanners,
  adminCreateBanner,
  adminUpdateBanner,
  adminDeleteBanner,
} = require('../../controllers/banners.controller');

const BannersAdminRouter = express.Router();

BannersAdminRouter.get('/banners', adminMiddleware, adminListBanners);
BannersAdminRouter.post('/banners', adminMiddleware, adminCreateBanner);
BannersAdminRouter.patch('/banners/:id', adminMiddleware, adminUpdateBanner);
BannersAdminRouter.delete('/banners/:id', adminMiddleware, adminDeleteBanner);

// Image upload for banner: form-data field name should be 'image'
BannersAdminRouter.post(
  '/banners/upload',
  adminMiddleware,
  upload.single('image'),
  cloudinaryUploadMiddleware,
  (req, res) => {
    if (!req.body.profile_pic) {
      return res.status(400).json({ ok: false, message: 'No image uploaded' });
    }
    return res.json({ ok: true, url: req.body.profile_pic });
  }
);

module.exports = { BannersAdminRouter };
