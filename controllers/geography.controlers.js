const countries = require('i18n-iso-countries');
const { UserModel } = require("../models/users.model");

exports.getGeography = async (req, res) => {
  try {
    const users = await UserModel.find();

    const mappedLocations = users.reduce((acc, user) => {
      let address = user?.address || {};
      if (typeof address === 'string') {
        try { address = JSON.parse(address); } catch { address = {}; }
      }

      const country = address.country || '';
      const state = address.state || '';
      const city = address.city || '';
      const zip = address.zip || '';

      if (!country) return acc;

      // Convert to ISO3 code
      const countryISO3 = countries.getAlpha3Code(country, 'en');
      if (!countryISO3) return acc;

      // Build unique key
      const key = `${countryISO3}|${state}|${city}|${zip}`;

      if (!acc[key]) {
        acc[key] = { 
          country: countryISO3, 
          state, 
          city, 
          zip, 
          count: 0 
        };
      }

      acc[key].count += 1;
      return acc;
    }, {});

    // Convert object → array
    const formattedLocations = Object.values(mappedLocations);

    res.status(200).json(formattedLocations);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to compute geography' });
  }
};
