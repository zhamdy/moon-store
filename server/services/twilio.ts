import type { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message';

type TwilioClient = any;

let twilioClient: TwilioClient | null = null;

function getClient(): TwilioClient | null {
  if (
    !twilioClient &&
    process.env.TWILIO_ACCOUNT_SID &&
    !process.env.TWILIO_ACCOUNT_SID.startsWith('ACxx')
  ) {
    const twilio = require('twilio');
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    ) as TwilioClient;
  }
  return twilioClient;
}

async function sendSMS(phone: string, message: string): Promise<MessageInstance | null> {
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
  } catch (err: unknown) {
    console.error('SMS send failed:', (err as Error).message);
    return null;
  }
}

async function sendWhatsApp(phone: string, message: string): Promise<MessageInstance | null> {
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
  } catch (err: unknown) {
    console.error('WhatsApp send failed:', (err as Error).message);
    return null;
  }
}

export { sendSMS, sendWhatsApp };
