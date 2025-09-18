const mongoose = require('mongoose');
const { initializeDatabase } = require('../init/runInitProgrammatically');
const { AdminAuditLogModel } = require('../models/admin_audit_log.model');

// Helper: safely get client IP from request accounting for proxies
const getClientIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
    || req.socket?.remoteAddress
    || req.ip
    || 'unknown';
};

// Helper: create audit log entry
const createAuditLog = async ({ req, action, success, details, error }) => {
  try {
    const user = req.user;
    if (!user?._id || !user?.email) {
      console.warn('createAuditLog: Missing user info in request');
      return; // skip audit if no user info (shouldn't happen due to auth middleware)
    }

    await AdminAuditLogModel.create({
      adminId: user._id,
      adminEmail: user.email,
      action,
      ip: getClientIP(req),
      success,
      details,
      error: error?.toString()
    });
  } catch (e) {
    console.error('Failed to create audit log:', e);
    // don't throw - audit logging should not break the main flow
  }
};

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

    await createAuditLog({
      req,
      action: 'empty_database',
      success: true,
      details: { collections: names }
    });

    return res.json({ msg: 'Database emptied', dropped: names });
  } catch (e) {
    console.error('emptyDatabase failed', e);
    await createAuditLog({
      req,
      action: 'empty_database',
      success: false,
      error: e
    });
    return res.status(500).json({ msg: 'Failed to empty database', error: String(e) });
  }
};

// Returns basic DB status: whether any non-system collections exist
const dbStatus = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const names = collections.map(c => c.name).filter(n => !n.startsWith('system.'));
    return res.json({ empty: names.length === 0, collections: names, count: names.length });
  } catch (e) {
    console.error('dbStatus failed', e);
    return res.status(500).json({ msg: 'Failed to get db status', error: String(e) });
  }
};

// Initialize dummy dataset programmatically. Uses the current admin as owner when possible.
const initDummy = async (req, res) => {
  try {
    // Protect: require env guard for safety (reuse same guard)
    if (process.env.ALLOW_EMPTY_DATABASE !== '1') {
      return res.status(403).json({ msg: 'Init endpoint not enabled' });
    }

    // Use current admin info if available (authenticator middleware should attach req.user)
    const user = req.user || null;
    const adminOverride = {};
    if (user) {
      adminOverride.first_name = user.first_name || user.name || 'Admin';
      adminOverride.email = user.email || `admin+${Date.now()}@local`;
    }

    const result = await initializeDatabase(adminOverride);
    await createAuditLog({
      req,
      action: 'init_dummy_data',
      success: true,
      details: { adminId: result.adminId }
    });
    return res.json({ msg: 'Initialized dummy dataset', result });
  } catch (e) {
    console.error('initDummy failed', e);
    await createAuditLog({
      req,
      action: 'init_dummy_data',
      success: false,
      error: e
    });
    return res.status(500).json({ msg: 'Failed to initialize dummy data', error: String(e) });
  }
};

module.exports = { emptyDatabase, dbStatus, initDummy };
