/** Small curated list of dial codes for the phone-number picker. */
export interface CountryCode {
  code: string;
  dial: string;
  name: string;
}

export const COUNTRY_CODES: CountryCode[] = [
  { code: "IN", dial: "+91", name: "India" },
  { code: "US", dial: "+1", name: "United States" },
  { code: "GB", dial: "+44", name: "United Kingdom" },
  { code: "CA", dial: "+1", name: "Canada" },
  { code: "AU", dial: "+61", name: "Australia" },
  { code: "AE", dial: "+971", name: "United Arab Emirates" },
  { code: "SG", dial: "+65", name: "Singapore" },
  { code: "DE", dial: "+49", name: "Germany" },
  { code: "FR", dial: "+33", name: "France" },
  { code: "NL", dial: "+31", name: "Netherlands" },
  { code: "ZA", dial: "+27", name: "South Africa" },
  { code: "NZ", dial: "+64", name: "New Zealand" },
  { code: "JP", dial: "+81", name: "Japan" },
  { code: "CN", dial: "+86", name: "China" },
  { code: "BD", dial: "+880", name: "Bangladesh" },
  { code: "LK", dial: "+94", name: "Sri Lanka" },
  { code: "NP", dial: "+977", name: "Nepal" },
  { code: "PK", dial: "+92", name: "Pakistan" },
  { code: "MY", dial: "+60", name: "Malaysia" },
  { code: "SA", dial: "+966", name: "Saudi Arabia" },
];

/** Splits a stored E.164 number into the best-matching dial code and local part. */
export function splitPhone(phone: string | null | undefined): { dial: string; local: string } {
  if (!phone) return { dial: "+91", local: "" };
  const match = [...COUNTRY_CODES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((c) => phone.startsWith(c.dial));
  if (!match) return { dial: "+91", local: phone.replace(/^\+/, "") };
  return { dial: match.dial, local: phone.slice(match.dial.length) };
}

export function joinPhone(dial: string, local: string): string {
  const digits = local.replace(/\D/g, "");
  return digits ? `${dial}${digits}` : "";
}
