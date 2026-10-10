// Indian mobile numbers only (requirement 1): 10 digits, starting 6-9.
// Accepts with or without a +91/91/091 prefix and strips spaces/dashes,
// normalizing to E.164 (+91XXXXXXXXXX) — the format Phase 2's schema
// requires.
export function normalizeIndianMobile(input: string): string | null {
  const digits = input.replace(/\D/g, "");

  let core: string | null = null;
  if (digits.length === 10) {
    core = digits;
  } else if (digits.length === 12 && digits.startsWith("91")) {
    core = digits.slice(2);
  } else if (digits.length === 13 && digits.startsWith("091")) {
    core = digits.slice(3);
  }

  if (!core || !/^[6-9]\d{9}$/.test(core)) {
    return null;
  }

  return `+91${core}`;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export function isValidOtp(otp: string): boolean {
  return /^\d{6}$/.test(otp);
}
