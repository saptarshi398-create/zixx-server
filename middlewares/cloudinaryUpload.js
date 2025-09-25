//   CLD_CLOUD_NAME: process.env.CLD_CLOUD_NAME,
//   CLD_API_KEY: process.env.CLD_API_KEY,
//   CLD_API_SECRET: process.env.CLD_API_SECRET
// });
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const streamifier = require('streamifier');
const axios = require('axios');

cloudinary.config({
  cloud_name: process.env.CLD_CLOUD_NAME,
  api_key: process.env.CLD_API_KEY,
  api_secret: process.env.CLD_API_SECRET,
});

const missingCloudCreds = !process.env.CLD_CLOUD_NAME || !process.env.CLD_API_KEY || !process.env.CLD_API_SECRET;

exports.upload = multer();

exports.cloudinaryUploadMiddleware = async (req, res, next) => {
  if (!req.file) return next();
  try {
    // Choose folder based on route for clearer organization (products vs footer vs generic)
    const folder = (req.originalUrl || '').includes('/products/')
      ? 'products'
      : (req.originalUrl || '').includes('/footer/')
        ? 'footer_services'
        : 'uploads';

    // If an unsigned upload preset is configured, try an unsigned multipart POST directly to Cloudinary's REST API.
    const unsignedUpload = async (fileBuffer, mimetype) => {
      if (!process.env.CLD_UPLOAD_PRESET) throw new Error('No CLD_UPLOAD_PRESET configured for unsigned upload');
      const cloudName = process.env.CLD_CLOUD_NAME;
      if (!cloudName) throw new Error('No CLD_CLOUD_NAME configured');

      const boundary = '----node-cloudinary-boundary-' + Date.now();
      const parts = [];

      const appendField = (name, value) => {
        parts.push(Buffer.from(`--${boundary}\r\n`));
        parts.push(Buffer.from(`Content-Disposition: form-data; name="${name}"\r\n\r\n`));
        parts.push(Buffer.from(String(value)));
        parts.push(Buffer.from('\r\n'));
      };

      // file field
      parts.push(Buffer.from(`--${boundary}\r\n`));
      parts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="upload"\r\n`));
      parts.push(Buffer.from(`Content-Type: ${mimetype || 'application/octet-stream'}\r\n\r\n`));
      parts.push(Buffer.from(fileBuffer));
      parts.push(Buffer.from('\r\n'));

      // upload_preset
      appendField('upload_preset', process.env.CLD_UPLOAD_PRESET);
      // folder (optional)
      if (folder) appendField('folder', folder);

      parts.push(Buffer.from(`--${boundary}--\r\n`));

      const body = Buffer.concat(parts.map(p => Buffer.isBuffer(p) ? p : Buffer.from(String(p))));

      const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

      const headers = {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      };

      const resp = await axios.post(url, body, { headers, maxContentLength: Infinity, maxBodyLength: Infinity });
      return resp.data;
    };

    const streamUpload = (fileBuffer) => {
      return new Promise((resolve, reject) => {
        const opts = { folder };
        if (process.env.CLD_UPLOAD_PRESET) opts.upload_preset = process.env.CLD_UPLOAD_PRESET;
        const stream = cloudinary.uploader.upload_stream(opts, (error, uploadResult) => {
          if (uploadResult) return resolve(uploadResult);
          return reject(error || new Error('No result from upload_stream'));
        });
        streamifier.createReadStream(fileBuffer).pipe(stream);
      });
    };

    // Preferred upload path: stream (previous working approach). If it fails, fall back to data-URI upload.
    let result;
    // If CLD_UPLOAD_PRESET is set, try unsigned multipart POST first (avoids signature/timestamp checks).
    try {
      if (process.env.CLD_UPLOAD_PRESET) {
        try {
          result = await unsignedUpload(req.file.buffer, req.file.mimetype);
        } catch (uErr) {
          console.warn('[Cloudinary] unsignedUpload failed, falling back to streamUpload. uErr:', uErr && (uErr.message || uErr));
          result = await streamUpload(req.file.buffer);
        }
      } else {
        // No preset: use stream upload (signed)
        result = await streamUpload(req.file.buffer);
      }
    } catch (streamErr) {
      console.warn('[Cloudinary] upload_stream failed and no unsigned option worked. Error:', streamErr && (streamErr.message || streamErr));
      // As a final fallback, try data-URI via SDK
      const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      const uploadOptions = { folder };
      if (process.env.CLD_UPLOAD_PRESET) uploadOptions.upload_preset = process.env.CLD_UPLOAD_PRESET;
      try {
        result = await cloudinary.uploader.upload(dataUri, uploadOptions);
      } catch (innerErr) {
        try { console.warn('[Cloudinary] uploader.upload failed:', innerErr && innerErr.stack ? innerErr.stack : innerErr); } catch (e) {}
        throw innerErr;
      }
    }

    if (result && result.secure_url) {
      // Backwards-compatible fields used elsewhere in the codebase
      req.body.profile_pic = result.secure_url;
      req.body.imageUrl = result.secure_url;
      req.body.imagePublicId = result.public_id;
      return next();
    }
    return res.status(500).json({ msg: 'Image upload failed', error: 'no-result-from-cloudinary', ok: false });
  } catch (err) {
    // Cloudinary may report signature/timestamp errors when server clock is skewed.
    const message = err && err.message ? err.message : String(err);
    const isTimestamp = (message || '').toLowerCase().includes('stale request') || (message || '').toLowerCase().includes('timestamp');
    const serverTime = new Date().toISOString();
    const hint = isTimestamp
      ? 'Cloudinary reported a timestamp/signature error. Either set CLD_UPLOAD_PRESET for unsigned uploads or fix the server/system clock.'
      : null;

    // concise error response
    const payload = { msg: 'Image upload failed', error: message, ok: false };
    if (err && err.http_code) payload.http_code = err.http_code;
    return res.status(500).json(payload);
  }
};

