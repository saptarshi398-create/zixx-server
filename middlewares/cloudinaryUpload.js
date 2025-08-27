// console.log('Cloudinary ENV:', {
//   CLD_CLOUD_NAME: process.env.CLD_CLOUD_NAME,
//   CLD_API_KEY: process.env.CLD_API_KEY,
//   CLD_API_SECRET: process.env.CLD_API_SECRET
// });
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const streamifier = require('streamifier');

cloudinary.config({
  cloud_name: process.env.CLD_CLOUD_NAME,
  api_key: process.env.CLD_API_KEY,
  api_secret: process.env.CLD_API_SECRET,
});

exports.upload = multer();

exports.cloudinaryUploadMiddleware = async (req, res, next) => {
  if (!req.file) return next();
  try {
    const streamUpload = (req) => {
      return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream(
          { folder: 'profile_pics' },
          (error, result) => {
            if (result) {
              resolve(result);
            } else {
              reject(error);
            }
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
    };
    const result = await streamUpload(req);
    req.body.profile_pic = result.secure_url;
    next();
  } catch (err) {
    console.log("Cloudinary upload error:", err);
    return res.status(500).json({ msg: 'Image upload failed', error: err.message, ok: false });
  }
};

