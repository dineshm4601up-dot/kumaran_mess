import "server-only";

export type SendSmsResult = { ok: true } | { ok: false; error: string };

// Provider-agnostic by design: callers never see which provider is
// configured, so switching providers later (e.g. for cheaper/easier India
// DLT onboarding) is a change to this one file, not to any auth logic.
export async function sendSms(phone: string, message: string): Promise<SendSmsResult> {
  const provider = process.env.SMS_PROVIDER ?? "console";

  switch (provider) {
    case "console":
      // Deliberately not a real send — logs instead, so local dev/testing
      // never pretends an SMS went out. See the Phase 3 explanation for
      // why no provider is wired up by default.
      //
      // The logged message includes the raw OTP code, which is fine for
      // a local dev console but must never reach production logs (most
      // hosts, including Vercel, ship console output to a log viewer/
      // aggregator that other people — or a compromised account — could
      // read). If this is somehow still the configured provider in a
      // production deploy, refuse to leak the code rather than logging
      // it: fail the send instead, which surfaces as a clear "couldn't
      // send a verification code" error to the customer rather than a
      // silent credential leak.
      if (process.env.NODE_ENV === "production") {
        console.error(
          "[dev-sms] SMS_PROVIDER is \"console\" in a production environment — refusing to log an OTP code. Set SMS_PROVIDER to a real provider.",
        );
        return { ok: false, error: "SMS_PROVIDER is not configured for production." };
      }
      console.log(`[dev-sms] SMS_PROVIDER is "console" — not sending a real SMS.`);
      console.log(`[dev-sms] To: ${phone}  Message: ${message}`);
      return { ok: true };
    case "twilio":
      return sendViaTwilio(phone, message);
    default:
      return { ok: false, error: `Unknown SMS_PROVIDER: "${provider}"` };
  }
}

async function sendViaTwilio(phone: string, message: string): Promise<SendSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return {
      ok: false,
      error: "Twilio is not fully configured (need TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER).",
    };
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: phone, From: fromNumber, Body: message }).toString(),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      return { ok: false, error: `Twilio request failed (${response.status}): ${detail}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Twilio request failed" };
  }
}
