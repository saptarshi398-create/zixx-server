/*
 One-time script to normalize user.address to an object shape.
 - Parses legacy stringified address
 - Moves flat fields (personal_address, shoping_address, etc.) into nested address
 Usage:
   NODE_ENV=development node backend/scripts/normalize-addresses.js
*/

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Centralized env loader (same logic as backend/index.js)
(function loadEnv() {
  const baseDir = path.join(__dirname, '..', '..', 'env');
  const specific = process.env.NODE_ENV ? path.join(baseDir, `.env.${process.env.NODE_ENV}`) : null;
  const fallback = path.join(baseDir, '.env');
  const dotenv = require('dotenv');
  if (specific && fs.existsSync(specific)) {
    dotenv.config({ path: specific });
  } else {
    dotenv.config({ path: fallback });
  }
})();

const { UserModel } = require('../models/users.model');

(async () => {
  const mongoUrl = process.env.MONGO_URL || process.env.DBURL;
  if (!mongoUrl) {
    process.exit(1);
  }

  await mongoose.connect(mongoUrl, { autoIndex: true });

  const cursor = UserModel.find({}, { password: 0 }).cursor();
  let scanned = 0;
  let updated = 0;

  for await (const user of cursor) {
    scanned++;
    let needsSave = false;

    // Normalize address to object
    let addr = user.address;
    if (typeof addr === 'string') {
      try {
        addr = JSON.parse(addr || '{}') || {};
        user.address = addr;
        needsSave = true;
      } catch (e) {
        addr = {};
        user.address = addr;
        needsSave = true;
      }
    }

    if (!addr || typeof addr !== 'object') {
      addr = {};
      user.address = addr;
      needsSave = true;
    }

    // Move any flat fields into nested address
    const flatKeys = [
      'personal_address','shoping_address','billing_address',
      'address_village','landmark','city','state','country','zip',
    ];
    for (const k of flatKeys) {
      if (user[k] != null && user[k] !== '') {
        if (!user.address) user.address = {};
        if (!user.address[k]) {
          user.address[k] = user[k];
          needsSave = true;
        }
        // unset flat field
        user[k] = undefined;
      }
    }

    if (needsSave) {
      try {
        user.markModified('address');
        await user.save();
        updated++;
      } catch (e) {
      }
    }
  }

  await mongoose.disconnect();
  process.exit(0);
})();
