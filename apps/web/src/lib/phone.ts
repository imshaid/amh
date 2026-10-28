import { toLatinDigits } from "@/i18n/format";

/**
 * Bangladeshi mobile numbers, as members and clients type them. The database normalises with the
 * same rules (private.normalise_phone); this copy lets forms say at once whether a number is valid.
 */

const NORMALISED = /^01[3-9][0-9]{8}$/;

/** "০১৭১৫-২০৪২২৪", "+880 1715 204224" or "1715204224" -> "01715204224"; null if not a mobile number. */
export function normalisePhone(raw: string): string | null {
  let digits = toLatinDigits(raw.trim())
    .replace(/\.0+$/, "")
    .replace(/[^0-9]/g, "");
  if (/^8801[3-9][0-9]{8}$/.test(digits)) {
    digits = digits.slice(2);
  } else if (/^1[3-9][0-9]{8}$/.test(digits)) {
    digits = `0${digits}`;
  }
  return NORMALISED.test(digits) ? digits : null;
}

/** "01715204224" -> "01715-204224", the way the hotel writes numbers. Other text is returned as is. */
export function formatPhone(phone: string): string {
  return NORMALISED.test(phone) ? `${phone.slice(0, 5)}-${phone.slice(5)}` : phone;
}
