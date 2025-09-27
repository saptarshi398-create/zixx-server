// Controller for admin sync status
exports.adminSyncStatus = async (req, res) => {
  try {
    // Return current server time as last sync for now
    // In a real app, you would fetch the last sync time from your database
    const lastSync = new Date().toISOString();
    res.json({ 
      at: lastSync,
      status: 'success'
    });
  } catch (e) {
    console.error('Sync status error:', e);
    res.status(500).json({ 
      msg: 'Failed to get sync status', 
      error: String(e),
      status: 'error' 
    });
  }
};
