const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = mongoose.Schema({
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: Number, required: true },
  dob: { type: String, required: true },
  gender: { type: String, required: true },
  address: {
    personal_address: { type: String, default: "" },
    shoping_address: { type: String, default: "" },
    billing_address: { type: String, default: "" },
    address_village: { type: String, default: "" },
    landmark: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    country: { type: String, default: "" },
    zip: { type: String, default: "" },
  },
  profile_pic: { type: String, default: "https://example.com/default-profile-pic.png" },
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "product" }],
  orders: [{ type: mongoose.Schema.Types.ObjectId, ref: "order" }],
  emailVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  role: { type: String, enum: ["admin", "customer"], default: "customer" }
});

userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = bcrypt.hashSync(this.password, 10);
  }
  next();
});

const UserModel = mongoose.model("user", userSchema);
module.exports = { UserModel };
