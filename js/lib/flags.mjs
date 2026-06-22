// Flag emoji for each pool team, derived from codepoints rather than pasted
// glyphs (safer to verify, and the only sane way to build the England/
// Scotland subdivision flags, which aren't representable as a literal
// regional-indicator pair).

// Our 3-letter pool code -> ISO 3166-1 alpha-2 country code. Most FIFA codes
// don't match ISO codes (e.g. ALG -> DZ, RSA -> ZA, SUI -> CH), so this is
// spelled out explicitly rather than derived.
const CODE_TO_ISO2 = {
  GHA: "GH", EGY: "EG", NZL: "NZ", ALG: "DZ", ARG: "AR",
  BIH: "BA", PAR: "PY", NED: "NL", IRQ: "IQ", PAN: "PA",
  ESP: "ES", USA: "US", SWE: "SE", HAI: "HT", NOR: "NO",
  BRA: "BR", CIV: "CI", JOR: "JO", AUS: "AU", CRO: "HR",
  CUW: "CW", AUT: "AT", MEX: "MX", RSA: "ZA", ECU: "EC",
  CAN: "CA", KSA: "SA", POR: "PT", TUR: "TR", IRN: "IR",
  MAR: "MA", QAT: "QA", KOR: "KR", CPV: "CV", SEN: "SN",
  COL: "CO", TUN: "TN", JPN: "JP", FRA: "FR", CZE: "CZ",
  COD: "CD", SUI: "CH", BEL: "BE", UZB: "UZ", URU: "UY",
  GER: "DE",
};

// England and Scotland aren't ISO countries, so they use Unicode's
// "subdivision flag" tag-sequence mechanism instead of a regional-indicator
// pair (see https://en.wikipedia.org/wiki/Regional_indicator_symbol).
const SUBDIVISION_CODES = {
  ENG: "gbeng",
  SCO: "gbsct",
};

const REGIONAL_INDICATOR_BASE = 0x1f1e6; // codepoint for the flag-letter "A"

function regionalIndicatorFlag(iso2) {
  return [...iso2.toUpperCase()]
    .map((c) => String.fromCodePoint(REGIONAL_INDICATOR_BASE + (c.charCodeAt(0) - 65)))
    .join("");
}

const TAG_BASE = 0xe0000; // tag character for ASCII "NUL"; tag for 'a' is TAG_BASE + 0x61
const CANCEL_TAG = 0xe007f;

function subdivisionFlag(subdivisionCode) {
  const tags = [...subdivisionCode].map((c) => String.fromCodePoint(TAG_BASE + c.charCodeAt(0)));
  return "\u{1F3F4}" + tags.join("") + String.fromCodePoint(CANCEL_TAG);
}

export function flagEmoji(code) {
  if (SUBDIVISION_CODES[code]) return subdivisionFlag(SUBDIVISION_CODES[code]);
  if (CODE_TO_ISO2[code]) return regionalIndicatorFlag(CODE_TO_ISO2[code]);
  return "";
}
