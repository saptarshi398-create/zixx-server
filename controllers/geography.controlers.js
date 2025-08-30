const countries = require('i18n-iso-countries');
const { UserModel } = require("../models/users.model");

exports.getGeography = async (req, res) => {
  try {
    const users = await UserModel.find().select('-password');
    console.log(`Found ${users.length} users`);

    // Add some test data if no users have proper address data
    const testLocations = [
      {
        country: 'USA',
        state: 'California', 
        city: 'San Francisco',
        zip: '94102',
        count: 5,
        users: [
          { id: 'test1', name: 'John Doe', email: 'john@test.com' },
          { id: 'test2', name: 'Jane Smith', email: 'jane@test.com' }
        ]
      },
      {
        country: 'IND',
        state: 'West Bengal',
        city: 'Kolkata', 
        zip: '700001',
        count: 3,
        users: [
          { id: 'test3', name: 'Raj Kumar', email: 'raj@test.com' }
        ]
      }
    ];

    const mappedLocations = users.reduce((acc, user) => {
      // Address is an object in the user model, not a string
      const address = user?.address || {};

      const country = address.country || '';
      const state = address.state || '';
      const city = address.city || '';
      const zip = address.zip || '';

      console.log(`User ${user.email}: ${city}, ${state}, ${country}`);

      // Skip users without city or country data
      if (!country || !city) return acc;

      // Convert to ISO3 code - try different approaches
      let countryISO3 = countries.getAlpha3Code(country, 'en');
      if (!countryISO3) {
        // Try with different language or direct lookup
        countryISO3 = countries.getAlpha3Code(country.toLowerCase(), 'en') || 
                      countries.getAlpha3Code(country.toUpperCase(), 'en') ||
                      country; // fallback to original country name
      }

      // Build unique key
      const key = `${countryISO3}|${state}|${city}|${zip}`;

      if (!acc[key]) {
        acc[key] = { 
          country: countryISO3, 
          state, 
          city, 
          zip, 
          count: 0,
          users: []
        };
      }

      // Add user info to this location
      const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Unknown User';
      acc[key].users.push({
        id: user._id,
        name: userName,
        email: user.email,
        profile_pic: user.profile_pic
      });
      acc[key].count += 1;
      return acc;
    }, {});

    // Convert object → array
    let formattedLocations = Object.values(mappedLocations);
    
    // If no real data, add test data for demonstration
    if (formattedLocations.length === 0) {
      console.log('No user location data found, adding test data');
      formattedLocations = testLocations;
    }

    console.log(`Returning ${formattedLocations.length} locations`);
    res.status(200).json(formattedLocations);
  } catch (error) {
    console.error('Geography API error:', error);
    res.status(500).json({ message: error.message || 'Failed to compute geography' });
  }
};
