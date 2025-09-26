const express = require('express');
const { adminMiddleware } = require('../../middlewares/admin.middleware');
const { upload, cloudinaryUploadMiddleware } = require('../../middlewares/cloudinaryUpload');
const {
  getAuthPage,
  adminListAuthPages,
  adminCreateAuthPage,
  adminUpdateAuthPage,
  adminDeleteAuthPage,
} = require('../../controllers/authpage.controller');

const AuthAdminRouter = express.Router();

// Admin CRUD
AuthAdminRouter.get('/auth-pages', adminMiddleware, adminListAuthPages);
AuthAdminRouter.post('/auth-pages', adminMiddleware, adminCreateAuthPage);
AuthAdminRouter.patch('/auth-pages/:id', adminMiddleware, adminUpdateAuthPage);
AuthAdminRouter.delete('/auth-pages/:id', adminMiddleware, adminDeleteAuthPage);

// Upload banner/image for auth page: field name 'image'
AuthAdminRouter.post(
  '/auth-pages/upload',
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

// Client route (public): get by page
const AuthClientRouter = express.Router();
AuthClientRouter.get('/auth-pages/:page', getAuthPage);

module.exports = { AuthAdminRouter, AuthClientRouter };
