const countries = require('i18n-iso-countries');
const { UserModel } = require("../models/users.model");

exports.getGeography = async (req, res) => {
  try {
    const users = await UserModel.find();
    const mappedLocations = users.reduce((acc, user) => {
      const address = JSON.parse(user.address);
      const country = address.country;
      const countryISO3 = countries.getAlpha3Code(country, 'en');
      if (countryISO3 === undefined) {
        console.error(`Error: Unable to get ISO 3 code for country ${country}`);
        return acc;
      }
      if (!acc[countryISO3]) {
        acc[countryISO3] = 0;
      }
      acc[countryISO3]++;
      return acc;
    }, {});
    console.log("Mapped Locations:", mappedLocations);
    const formattedLocations = Object.entries(mappedLocations).map(
      ([country, count]) => {
        return { id: country, value: count };
      }
    );
    
    res.status(200).json(formattedLocations);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};