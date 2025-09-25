const express = require("express");
const { getFooter, updateFooter } = require("../../controllers/footer.controller");
const { authenticator } = require("../../middlewares/authenticator.middleware");
const { adminMiddleware } = require("../../middlewares/admin.middleware");

const router = express.Router();

// Public route to get footer
router.get("/", getFooter);

// Admin route to update footer
router.put("/", authenticator, adminMiddleware, updateFooter);

// Upload icon/image for footer services (form field name: 'image')
const { upload, cloudinaryUploadMiddleware } = require("../../middlewares/cloudinaryUpload");
router.post(
	"/services/upload",
	authenticator,
	adminMiddleware,
	upload.single('image'),
	cloudinaryUploadMiddleware,
	(req, res) => {
		const url = req.body.imageUrl || req.body.profile_pic;
		const publicId = req.body.imagePublicId || req.body.public_id;
		if (!url) {
			return res.status(400).json({ ok: false, message: 'No image uploaded' });
		}
		return res.json({
			ok: true,
			url,
			publicId
		});
	}
);

module.exports = router;