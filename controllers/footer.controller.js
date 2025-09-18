const Footer = require("../models/footer.model");

// Get footer content
const getFooter = async (req, res) => {
  try {
    let footer = await Footer.findOne();
    
    // If no footer exists, create a default one
    if (!footer) {
      footer = await Footer.create({});
    }
    
    res.status(200).json(footer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update footer content
const updateFooter = async (req, res) => {
  try {
    const updatedData = req.body;
    let footer = await Footer.findOne();
    
    // If no footer exists, create one with the provided data
    if (!footer) {
      footer = await Footer.create(updatedData);
    } else {
      // Update existing footer
      Object.assign(footer, updatedData);
      await footer.save();
    }
    
    res.status(200).json(footer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getFooter,
  updateFooter,
};