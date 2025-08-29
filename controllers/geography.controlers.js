const countries = require('i18n-iso-countries');
const { UserModel } = require("../models/users.model");

exports.getGeography = async (req, res) => {
  try {
    const users = await UserModel.find();
    const mappedLocations = users.reduce((acc, user) => {
      // address is stored as an object in schema; but be defensive if stored as JSON string
      let address = user && user.address ? user.address : {};
      if (typeof address === 'string') {
        try { address = JSON.parse(address); } catch { address = {}; }
      }
      const country = (address && address.country) ? address.country : '';
      if (!country) return acc;
      const countryISO3 = countries.getAlpha3Code(country, 'en');
      if (!countryISO3) {
        return acc;
      }
      if (!acc[countryISO3]) acc[countryISO3] = 0;
      acc[countryISO3] += 1;
      return acc;
    }, {});
    const formattedLocations = Object.entries(mappedLocations).map(([country, count]) => ({ id: country, value: count }));
    res.status(200).json(formattedLocations);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to compute geography' });
  }
};