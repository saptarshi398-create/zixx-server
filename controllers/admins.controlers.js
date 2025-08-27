const { UserModel } = require("../models/users.model");


exports.getAllAdmins = async (req, res) => {
  try {
    const admins = await UserModel.find({ role: "admin" }).select("-password");
    res.status(200).json(admins);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};
