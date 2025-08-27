const express = require("express");
const passport = require("../../oauths/google.oauth");
require("dotenv").config();
const { 
  userRegister, 
  userLogin, 
  getAllUsers, 
  getUserById,
  updateUsersByAdmin,
  deleteUsersByAdmin,
  getCurrentUserInfo,
  validateToken,
  refreshAccessToken,
  logoutUser,
  logoutRedirect,
  updateUser
} = require("../../controllers/user.controler");
const { authenticator } = require("../../middlewares/authenticator.middleware");
const { cloudinaryUploadMiddleware, upload } = require("../../middlewares/cloudinaryUpload");

const UserRouter = express.Router();

UserRouter.use(passport.initialize());
UserRouter.use(passport.session());

UserRouter.post("/register", userRegister);

UserRouter.post("/login", userLogin);

UserRouter.get("/user/me", authenticator, getCurrentUserInfo);

UserRouter.get("/users/:id", authenticator, getUserById);

UserRouter.patch("/user/me", authenticator,
  upload.single("profile_pic"),
  cloudinaryUploadMiddleware,
  updateUser
);

UserRouter.get("/validatetoken", authenticator, validateToken);
// Allow refresh without access-token authenticator; it validates refresh token itself
UserRouter.post("/refresh", refreshAccessToken);
// Allow logout to be called without authentication so clients can force cookie removal.
UserRouter.post('/logout', logoutUser);
// also support GET /logout for top-level navigation logout which can clear httpOnly cookies via redirect
UserRouter.get('/logout', logoutRedirect);

// Debug: return cookies and headers (use from browser to see what cookies the browser sends)
UserRouter.get('/debug-cookies', (req, res) => {
  try {
    return res.json({ ok: true, cookies: req.cookies || {}, headers: req.headers });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});


module.exports = { UserRouter };
