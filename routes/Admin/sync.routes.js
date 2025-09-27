const express = require('express');
const { adminSyncStatus } = require('../../controllers/sync.controller');
const { authenticator } = require('../../middlewares/authenticator.middleware');
const { adminMiddleware } = require('../../middlewares/admin.middleware');

const SyncRouter = express.Router();

// GET /admin/sync-status
SyncRouter.get('/sync-status', authenticator, adminMiddleware, adminSyncStatus);

module.exports = { SyncRouter };
