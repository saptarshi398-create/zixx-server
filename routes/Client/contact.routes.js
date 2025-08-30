const express = require('express');
const { submitContactMessage } = require('../../controllers/contact.controller');

const ContactRouter = express.Router();

// POST /api/clients/contact
ContactRouter.post('/contact', submitContactMessage);

module.exports = { ContactRouter };
