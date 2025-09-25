const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Footer = require('../models/footer.model');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Default services to ensure exist in the Footer document
const DEFAULT_SERVICES = [
  { icon: 'Truck', title: 'FREE AND FAST DELIVERY', description: 'Free delivery for all orders over ₹140' },
  { icon: 'Headset', title: '24/7 CUSTOMER SERVICE', description: 'Friendly 24/7 customer support' },
  { icon: 'ShieldCheckIcon', title: 'MONEY BACK GUARANTEE', description: 'We return money within 30 days' }
];

function loadServicesFromArg(arg) {
  if (!arg) return null;
  // If arg is a path to a file that exists, read it
  const maybePath = path.resolve(process.cwd(), arg);
  if (fs.existsSync(maybePath)) {
    const raw = fs.readFileSync(maybePath, 'utf8');
    return JSON.parse(raw);
  }
  // Else try to parse arg as JSON
  try {
    return JSON.parse(arg);
  } catch (e) {
    throw new Error('Provided argument is not a valid JSON string or file path');
  }
}

(async () => {
  try {
    const MONGO = process.env.MONGO_URL || process.env.MONGO;
    if (!MONGO) throw new Error('MONGO_URL not set in backend/.env');
    // connect (no deprecated options)
  await mongoose.connect(MONGO);
  if (process.env.DEBUG_LOGS === 'true') console.log('Connected to MongoDB');

    let footer = await Footer.findOne();
    if (!footer) {
      footer = await Footer.create({});
      if (process.env.DEBUG_LOGS === 'true') console.log('Created new footer document');
    }

    // Determine services to ensure: CLI arg (JSON or file) else default
    const cliArg = process.argv[2];
    let servicesToEnsure = null;
    if (cliArg) {
      servicesToEnsure = loadServicesFromArg(cliArg);
      if (!Array.isArray(servicesToEnsure)) throw new Error('Services data must be an array of {icon,title,description}');
    } else {
      servicesToEnsure = DEFAULT_SERVICES;
    }

    footer.services = footer.services || [];

    const added = [];
    for (const svc of servicesToEnsure) {
      const match = footer.services.some(existing => (
        (existing.title && svc.title && existing.title === svc.title) ||
        (existing.description && svc.description && existing.description === svc.description) ||
        (existing.icon && svc.icon && existing.icon === svc.icon)
      ));
      if (!match) {
        footer.services.push({ icon: svc.icon || '', title: svc.title || '', description: svc.description || '' });
        added.push(svc);
      }
    }

    if (added.length > 0) {
      await footer.save();
      if (process.env.DEBUG_LOGS === 'true') console.log(`Added ${added.length} service(s):`, added.map(s=>s.title || s.icon));
    } else {
      if (process.env.DEBUG_LOGS === 'true') console.log('No new services added; all services already present');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();