const { UserModel } = require("../models/users.model.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();
const isDebug = process.env.DEBUG_LOGS === 'true';

// =====================
// ✅ Register New User
// =====================
exports.userRegister = async (req, res) => {
  try {
    const {
      first_name,
      middle_name,
      last_name,
      email,
      password,
      phone,
      gender,
      dob,
      role,
      address = {},
      profile_pic,
      wishlist = [],
      orders = [],
      emailVerified = false,
      isActive = true,
    } = req.body;

    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: "User already exists", ok: false });
    }

    const newUser = new UserModel({
      first_name,
      middle_name: middle_name || "",
      last_name,
      email,
      password,
      phone: phone || "N/A",
      gender: gender || "N/A",
      dob: dob || "N/A",
      // schema enum expects 'admin' or 'customer' — default to 'customer' when not provided
      role: role || "customer",
      address: address || {},
      profile_pic: profile_pic || "https://imgs.search.brave.com/RVlCqw3p0uoiaetgT8E5nbaIalanB95GbXOOaURZMrA/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9jZG4t/aWNvbnMtcG5nLmZy/ZWVwaWsuY29tLzI1/Ni84MDA3LzgwMDc5/NTMucG5nP3NlbXQ9/YWlzX3doaXRlX2xh/YmVs",
      wishlist: wishlist || [],
      orders: orders || [],
      emailVerified: emailVerified || false,
      isActive: isActive || true,
    });

    await newUser.save();
    res.status(201).json({ msg: "User registered successfully", ok: true });
  } catch (error) {
    console.error(error);

    res.status(500).json({ msg: "Server error", error: error.message, ok: false });
  }
}

// =====================
// ✅ Login User
// =====================
exports.userLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await UserModel.findOne({ email });
    if (!user) return res.status(400).json({ msg: "User does not exist", ok: false });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ msg: "Invalid credentials", ok: false });

    const token = jwt.sign({ userid: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7h" });
    const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });

    // set access token as httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: 7 * 60 * 60 * 1000, // 7 hours
    });
    // set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({ msg: "Login successful", userid: user._id, role: user.role, token, ok: true });
  } catch (error) {
    res.status(500).json({ msg: "Server error", error: error.message, ok: false });
  }
}

// =====================
// Get All Users (Admin Only)
// =====================
exports.getAllUsers = async (req, res) => {
  try {
    // Optional: Only admin can access
    if (req.user && req.user.role !== "admin") {
      return res.status(403).json({ msg: "Access denied", ok: false });
    }

    // 1️⃣ Fetch all users from local DB
    const users = await UserModel.find().select("-password").lean(); 

    // 2️⃣ Map to UI-friendly shape
    // const mapped = users.map((u) => {
    //   const first = u.first_name || u.firstName || "N/A";
    //   const last = u.last_name || u.lastName || "N/A";
    //   return {
    //     _id: u._id,
    //     name: `${first} ${last}`.trim() || u.email || "Unknown",
    //     email: u.email,
    //     phoneNumber: String(u.phone || "N/A").replace(/[^0-9]/g, "N/A"),
    //     country: JSON.parse(u.address).country  || "N/A",
    //     occupation: u.occupation || u.role || "N/A",
    //     role: u.role || "customer",
    //   };
    // });

    // 3️⃣ Send response
    res.status(200).json({ users, msg: "Users fetched successfully", ok: true });

  } catch (error) {
    res.status(500).json({ msg: "Failed to fetch users", error: error.message, ok: false });
  }
};

// ==========================
// Get Single User by id
// ==========================
exports.getUserById = async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found", ok: false });
    res.json({ user, ok: true });
  } catch (error) {
    res.status(500).json({ msg: "Server error", error: error.message, ok: false });
  }
};

// ==========================
// Get Current User Info
// ==========================
exports.getCurrentUserInfo = async (req, res) => {
  try {
    // Prefer userid extracted by authenticator middleware if present
    let userId = req.userid;

    // If authenticator didn't run or didn't populate req.userid, try header
    if (!userId) {
      let token = req.headers.authorization || req.cookies.token;
      if (!token) return res.status(401).json({ msg: "No token provided", ok: false });
      if (typeof token === 'string' && token.startsWith('Bearer ')) token = token.split(' ')[1];
      // verify and capture decoded payload for debugging
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (e) {
        console.error('[user.controler] token verify failed for getCurrentUserInfo:', e.message);
        return res.status(401).json({ msg: 'Invalid token', ok: false });
      }
      userId = decoded.userid || decoded.id;
    }
    if (isDebug) console.log('[user.controler] getCurrentUserInfo - resolved userId:', userId);
    if (isDebug) console.log('[user.controler] getCurrentUserInfo - incoming Authorization header:', req.headers.authorization);

    const user = await UserModel.findById(userId).select("-password");
    if (isDebug) console.log('[user.controler] getCurrentUserInfo - db user found:', !!user);

    if (!user) return res.status(404).json({ msg: "User not found", ok: false });
    res.json({ user, ok: true });
  } catch (err) {
    console.error('[user.controler] getCurrentUserInfo error:', err);

    res.status(401).json({ msg: "Invalid token", ok: false });
  }
}

// =====================
// Validate Token
// =====================
exports.validateToken = (req, res) => {
  let token = req.headers.authorization;
  try {
    if (!token) return res.status(401).json({ msg: "Token not provided", ok: false });
    if (typeof token === 'string' && token.startsWith('Bearer ')) token = token.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET);
    res.json({ msg: "Valid token", ok: true });
  } catch (error) {
    res.status(401).json({ msg: "Invalid token", ok: false });
  }
}

// =====================
// Refresh Access Token
// Accepts { refreshToken } in body and returns a new access token
// =====================
exports.refreshAccessToken = async (req, res) => {
  try {
    // accept refresh token in body or cookie
    let refreshToken = req.body?.refreshToken;
    if (!refreshToken && req.cookies) refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ msg: 'Refresh token not provided', ok: false });

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({ msg: 'Invalid refresh token', ok: false });
    }

    const userId = decoded.id || decoded.userid;
    if (!userId) return res.status(401).json({ msg: 'Invalid refresh token payload', ok: false });

    // fetch user to include role in new access token
    const user = await UserModel.findById(userId).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found', ok: false });

    const newToken = jwt.sign({ userid: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7h' });

    // rotate refresh token
    const newRefresh = jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
    res.cookie('refreshToken', newRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // also set fresh access token as httpOnly cookie so cookie-based flows work cross-site
    res.cookie('token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: 7 * 60 * 60 * 1000, // 7 hours
    });

    res.json({ token: newToken, ok: true });
  } catch (error) {
    res.status(500).json({ msg: 'Server error', error: error.message, ok: false });
  }
}

// add update users by admin 
exports.updateUsersByAdmin = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ msg: "Access denied", ok: false });
    }
    const userId = req.params.id;
    if (!userId) return res.status(400).json({ msg: 'User id is required', ok: false });

    const updates = { ...req.body };

    // Validate/cast phone if provided
    if (Object.prototype.hasOwnProperty.call(updates, 'phone')) {
      const raw = String(updates.phone).trim();
      if (raw === '') {
        delete updates.phone;
      } else if (/^\d+$/.test(raw)) {
        updates.phone = Number(raw);
      } else {
        return res.status(400).json({ msg: 'Invalid phone number', ok: false });
      }
    }

    // Merge flat address fields into nested address when provided
    if (
      updates.personal_address !== undefined ||
      updates.shoping_address !== undefined ||
      updates.billing_address !== undefined ||
      updates.address_village !== undefined ||
      updates.landmark !== undefined ||
      updates.city !== undefined ||
      updates.state !== undefined ||
      updates.country !== undefined ||
      updates.zip !== undefined
    ) {
      const userDoc = await UserModel.findById(userId);
      if (!userDoc) return res.status(404).json({ msg: 'User not found', ok: false });
      const currentAddress = userDoc.address || {};
      const isMeaningful = (v) => {
        if (v === undefined) return false;
        const s = String(v).trim();
        if (s === '') return false;
        if (s.toLowerCase() === 'n/a') return false;
        return true;
      };
      updates.address = {
        ...currentAddress,
        ...(isMeaningful(updates.personal_address) ? { personal_address: updates.personal_address } : {}),
        ...(isMeaningful(updates.shoping_address) ? { shoping_address: updates.shoping_address } : {}),
        ...(isMeaningful(updates.billing_address) ? { billing_address: updates.billing_address } : {}),
        ...(isMeaningful(updates.address_village) ? { address_village: updates.address_village } : {}),
        ...(isMeaningful(updates.landmark) ? { landmark: updates.landmark } : {}),
        ...(isMeaningful(updates.city) ? { city: updates.city } : {}),
        ...(isMeaningful(updates.state) ? { state: updates.state } : {}),
        ...(isMeaningful(updates.country) ? { country: updates.country } : {}),
        ...(isMeaningful(updates.zip) ? { zip: updates.zip } : {}),
      };
      // remove flat fields after nesting
      delete updates.personal_address;
      delete updates.shoping_address;
      delete updates.billing_address;
      delete updates.address_village;
      delete updates.landmark;
      delete updates.city;
      delete updates.state;
      delete updates.country;
      delete updates.zip;
    }

    updates.updatedAt = new Date();

    const user = await UserModel.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (!user) {
      return res.status(404).json({ msg: "User not found", ok: false });
    }
    res.json({ user, ok: true });
  } catch (error) {
    res
      .status(500)
      .json({ msg: "Server error", error: error.message, ok: false });
  }
};

// add delete users route by admin 
exports.deleteUsersByAdmin = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ msg: "Access denied", ok: false });
    }
    const userId = req.params.id;
    const user = await UserModel.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found", ok: false });
    }
    if (isDebug) console.log("User deleted:", user);

    res.json({ msg: "User deleted", ok: true });
  } catch (error) {
    res
      .status(500)
      .json({ msg: "Server error", error: error.message, ok: false });
  }
};


// ==========================
// Update User Info & Profile Photo
// ==========================
exports.updateUser = async (req, res) => {
    try {
        const userId = req.userid;
        if (!userId) {
            return res.status(401).json({ msg: 'Unauthorized: missing user id', ok: false });
        }

        const updates = { ...req.body };

        // Debug incoming payload when enabled
        if (isDebug) {
            try { console.log('[updateUser] incoming updates:', { ...updates, profile_pic: updates.profile_pic ? '[set]' : undefined }); } catch {}
        }

        // If phone is present, validate and convert to number
        if (Object.prototype.hasOwnProperty.call(updates, 'phone')) {
            const raw = String(updates.phone).trim();
            if (raw === '') {
                // empty -> do not overwrite
                delete updates.phone;
            } else if (/^\d+$/.test(raw)) {
                updates.phone = Number(raw);
            } else {
                return res.status(400).json({ msg: 'Invalid phone number', ok: false });
            }
        }

        // If address fields are present, nest them (including personal/billing/shopping, city, state, country, zip)
        if (
            updates.personal_address !== undefined ||
            updates.shoping_address !== undefined ||
            updates.billing_address !== undefined ||
            updates.address_village !== undefined ||
            updates.landmark !== undefined ||
            updates.city !== undefined ||
            updates.state !== undefined ||
            updates.country !== undefined ||
            updates.zip !== undefined
        ) {
            // Fetch current user to merge address fields
            const userDoc = await UserModel.findById(userId);
            const currentAddress = userDoc?.address || {};
            const isMeaningful = (v) => {
                if (v === undefined) return false;
                const s = String(v).trim();
                if (s === '') return false;
                if (s.toLowerCase() === 'n/a') return false;
                return true;
            };
            updates.address = {
                ...currentAddress,
                ...(isMeaningful(updates.personal_address) ? { personal_address: updates.personal_address } : {}),
                ...(isMeaningful(updates.shoping_address) ? { shoping_address: updates.shoping_address } : {}),
                ...(isMeaningful(updates.billing_address) ? { billing_address: updates.billing_address } : {}),
                ...(isMeaningful(updates.address_village) ? { address_village: updates.address_village } : {}),
                ...(isMeaningful(updates.landmark) ? { landmark: updates.landmark } : {}),
                ...(isMeaningful(updates.city) ? { city: updates.city } : {}),
                ...(isMeaningful(updates.state) ? { state: updates.state } : {}),
                ...(isMeaningful(updates.country) ? { country: updates.country } : {}),
                ...(isMeaningful(updates.zip) ? { zip: updates.zip } : {}),
            };
            // remove flat fields after nesting
            delete updates.personal_address;
            delete updates.shoping_address;
            delete updates.billing_address;
            delete updates.address_village;
            delete updates.landmark;
            delete updates.city;
            delete updates.state;
            delete updates.country;
            delete updates.zip;
        }

        // maintain updatedAt timestamp
        updates.updatedAt = new Date();

        const updatedUser = await UserModel.findByIdAndUpdate(
            userId,
            updates,
            { new: true, runValidators: true }
        ).select("-password");

        if (!updatedUser) {
            return res.status(404).json({ msg: 'User not found', ok: false });
        }

        return res.json({ msg: "User updated successfully", user: updatedUser, ok: true });
    } catch (error) {
        console.error('[updateUser] error:', error);
        return res.status(500).json({ msg: "Failed to update user", error: error.message, ok: false });
    }
}

// controllers/auth.controller.js (or wherever your logout controller resides)
exports.logoutUser = (req, res) => {
  try {
    // Cookie options to ensure cookies are properly expired
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // secure only in production
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      expires: new Date(0), // force expire
    };

    // Clear cookies using Express methods
    res.cookie('token', '', cookieOpts);
    res.cookie('refreshToken', '', cookieOpts);
    res.clearCookie('token', cookieOpts);
    res.clearCookie('refreshToken', cookieOpts);

    // Set-Cookie headers as a fallback for some browsers
    const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    const sameSite = process.env.NODE_ENV === 'production' ? 'None' : 'Lax';
    const cookieBase = `Path=/; Expires=${new Date(0).toUTCString()}; HttpOnly; SameSite=${sameSite}${secureFlag}`;
    res.setHeader('Set-Cookie', [
      `token=; ${cookieBase}`,
      `refreshToken=; ${cookieBase}`,
    ]);

    try {
      if (req.session) {
        req.session.destroy(() => {});
      }
    } catch (err) {
      console.error('[logoutUser] session destroy error:', err);
    }

    // Log incoming cookies for debugging
    try {
      if (isDebug) console.log('[logoutUser] Incoming cookies:', req.headers.cookie || 'none');
    } catch (err) {}

    // Send success response
    return res.json({ msg: 'Logged out', ok: true });
  } catch (err) {
    console.error('[logoutUser] Error:', err);

    return res.status(500).json({ msg: 'Logout failed', ok: false, error: err.message });
  }
};


// GET logout that redirects back to frontend - useful for top-level navigation to clear httpOnly cookies
exports.logoutRedirect = (req, res) => {
  try {
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      expires: new Date(0),
    };
    // Express helpers
    res.cookie('token', '', cookieOpts);
    res.cookie('refreshToken', '', cookieOpts);
    res.clearCookie('token', cookieOpts);
    res.clearCookie('refreshToken', cookieOpts);

    // Fallback: explicit Set-Cookie headers
    const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    const sameSite = process.env.NODE_ENV === 'production' ? 'None' : 'Lax';
    const cookieBase = `Path=/; Expires=${new Date(0).toUTCString()}; HttpOnly; SameSite=${sameSite}${secureFlag}`;
    res.setHeader('Set-Cookie', [
      `token=; ${cookieBase}`,
      `refreshToken=; ${cookieBase}`,
    ]);

    try { if (req.session) req.session.destroy(() => {}); } catch (e) {}
    // optional diagnostic log
    try { if (isDebug) console.log('[logoutRedirect] incoming cookies:', req.headers.cookie); } catch (e) {}

    // Redirect back to provided returnTo or frontend auth
    let frontend = process.env.FRONTEND_URL || `http://${req.hostname}:8080`;
    const returnTo = req.query.returnTo;
    if (returnTo) {
      try { return res.redirect(returnTo); } catch (e) {}
    }
    return res.redirect(`${frontend.replace(/\/$/, '')}/auth`);
  } catch (err) {
    return res.status(500).json({ msg: 'Logout redirect failed', ok: false, error: err.message });
  }
}