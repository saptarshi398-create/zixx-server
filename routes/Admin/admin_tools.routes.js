const express = require('express');
const { authenticator } = require('../../middlewares/authenticator.middleware');
const { adminMiddleware } = require('../../middlewares/admin.middleware');
const { emptyDatabase } = require('../../controllers/admin_tools.controller');

const AdminToolsRouter = express.Router();

// Destructive: empties all non-system collections. Requires env ALLOW_EMPTY_DATABASE=1 and matching confirm token.
AdminToolsRouter.delete('/empty-database', authenticator, adminMiddleware, emptyDatabase);

module.exports = { AdminToolsRouter };
