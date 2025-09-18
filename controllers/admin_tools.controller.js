const mongoose = require('mongoose');

// WARNING: destructive operation. This endpoint should only be enabled intentionally.
const emptyDatabase = async (req, res) => {
  try {
    // Safety: require explicit ENV var to enable endpoint
    if (process.env.ALLOW_EMPTY_DATABASE !== '1') {
      return res.status(403).json({ msg: 'Empty database endpoint not enabled' });
    }

    // Require a confirm token in the body to avoid accidental calls
    const { confirmToken } = req.body || {};
    if (!confirmToken || confirmToken !== process.env.EMPTY_DB_CONFIRM_TOKEN) {
      return res.status(400).json({ msg: 'Invalid or missing confirm token' });
    }

    // Collect all collection names except system ones
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const names = collections.map(c => c.name).filter(n => !n.startsWith('system.'));

    // Drop each collection
    for (const name of names) {
      try {
        await db.dropCollection(name);
      } catch (e) {
        // ignore errors for already dropped
      }
    }

    return res.json({ msg: 'Database emptied', dropped: names });
  } catch (e) {
    console.error('emptyDatabase failed', e);
    return res.status(500).json({ msg: 'Failed to empty database', error: String(e) });
  }
};

module.exports = { emptyDatabase };
