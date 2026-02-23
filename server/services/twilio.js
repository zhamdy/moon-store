let twilioClient = null;

function getClient() {
  if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && !process.env.TWILIO_ACCOUNT_SID.startsWith('ACxx')) {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

async function sendSMS(phone, message) {
  const client = getClient();
  if (!client) {
    console.log(`[Twilio SMS skipped - not configured] To: ${phone} | ${message}`);
    return null;
  }
  try {
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE,
      to: phone,
    });
    console.log(`SMS sent to ${phone}: ${result.sid}`);
    return result;
  } catch (err) {
    console.error('SMS send failed:', err.message);
    return null;
  }
}

async function sendWhatsApp(phone, message) {
  const client = getClient();
  if (!client) {
    console.log(`[Twilio WhatsApp skipped - not configured] To: ${phone} | ${message}`);
    return null;
  }
  try {
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${phone}`,
    });
    console.log(`WhatsApp sent to ${phone}: ${result.sid}`);
    return result;
  } catch (err) {
    console.error('WhatsApp send failed:', err.message);
    return null;
  }
}

module.exports = { sendSMS, sendWhatsApp };
