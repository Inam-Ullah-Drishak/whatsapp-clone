/**
 * OTP delivery.
 *
 * OTP_MODE=console  -> prints the code to the terminal (default, use in dev)
 * OTP_MODE=sms      -> sends a real SMS via Twilio
 *
 * The Twilio SDK is imported lazily so console mode works without the
 * package installed. Before switching to sms mode, run: npm i twilio
 */

let twilioClient = null;

const getTwilioClient = async () => {
  if (twilioClient) return twilioClient;

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error("OTP_MODE=sms but TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are missing");
  }

  const { default: twilio } = await import("twilio");
  twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  return twilioClient;
};

/**
 * Deliver an OTP to a phone number in E.164 format.
 * Throws on delivery failure so the controller can return a 5xx
 * instead of telling the user a code is on its way when it isn't.
 */
export const sendOtp = async (phone, code) => {
  const mode = process.env.OTP_MODE || "console";

  if (mode === "console") {
    console.log("\n──────────────────────────────");
    console.log(`  OTP for ${phone}: ${code}`);
    console.log("  (dev mode — no SMS was sent)");
    console.log("──────────────────────────────\n");
    return { delivered: true, mode };
  }

  if (mode === "sms") {
    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!from) {
      throw new Error("OTP_MODE=sms but TWILIO_PHONE_NUMBER is missing");
    }

    const client = await getTwilioClient();
    const message = await client.messages.create({
      body: `${code} is your verification code. It expires in 5 minutes.`,
      from,
      to: phone,
    });

    return { delivered: true, mode, sid: message.sid };
  }

  throw new Error(`Unknown OTP_MODE: "${mode}" (expected "console" or "sms")`);
};
