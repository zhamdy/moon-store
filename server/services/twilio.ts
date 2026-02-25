import type { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message';
import logger from '../lib/logger';

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
    logger.debug('Twilio SMS skipped - not configured', { phone });
    return null;
  }
  try {
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE,
      to: phone,
    });
    logger.info('SMS sent', { phone, sid: result.sid });
    return result;
  } catch (err: unknown) {
    logger.error('SMS send failed', { phone, error: (err as Error).message });
    return null;
  }
}

async function sendWhatsApp(phone: string, message: string): Promise<MessageInstance | null> {
  const client = getClient();
  if (!client) {
    logger.debug('Twilio WhatsApp skipped - not configured', { phone });
    return null;
  }
  try {
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${phone}`,
    });
    logger.info('WhatsApp sent', { phone, sid: result.sid });
    return result;
  } catch (err: unknown) {
    logger.error('WhatsApp send failed', { phone, error: (err as Error).message });
    return null;
  }
}

export { sendSMS, sendWhatsApp };
