// Simple SMS utility with Twilio support. Falls back to console log if not configured.
const twilioSid = process.env.TWILIO_ACCOUNT_SID;
const twilioToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFrom = process.env.TWILIO_FROM_NUMBER;

let client = null;
if (twilioSid && twilioToken) {
  try { client = require('twilio')(twilioSid, twilioToken); } catch (e) { client = null; }
}

async function sendSMS(to, body) {
  if (!to) return false;
  try {
    if (client && twilioFrom) {
      await client.messages.create({ to, from: twilioFrom, body });
      return true;
    }
    console.log(`[SMS:DRYRUN] To:${to} -> ${body}`);
    return true;
  } catch (e) {
    console.error('SMS send failed:', e?.message || e);
    return false;
  }
}

module.exports = { sendSMS };
