import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { flagEmoji } from "../js/lib/flags.mjs";

describe("flagEmoji", () => {
  test("builds a regional-indicator flag from the mapped ISO code", () => {
    // Argentina = AR -> regional indicator pair U+1F1E6+0x11 (R) ... verify
    // by codepoints rather than eyeballing the glyph.
    const codepoints = [...flagEmoji("ARG")].map((c) => c.codePointAt(0));
    assert.deepEqual(codepoints, [0x1f1e6 + ("A".charCodeAt(0) - 65), 0x1f1e6 + ("R".charCodeAt(0) - 65)]);
  });

  test("Germany maps to the DE flag, not a literal GER flag", () => {
    const codepoints = [...flagEmoji("GER")].map((c) => c.codePointAt(0));
    assert.deepEqual(codepoints, [0x1f1e9, 0x1f1ea]); // D, E
  });

  test("builds the England subdivision flag as a tag sequence", () => {
    const flag = flagEmoji("ENG");
    const codepoints = [...flag].map((c) => c.codePointAt(0));
    // U+1F3F4 (black flag) + tags for g,b,e,n,g + cancel tag
    assert.deepEqual(codepoints, [
      0x1f3f4,
      0xe0067, // g
      0xe0062, // b
      0xe0065, // e
      0xe006e, // n
      0xe0067, // g
      0xe007f, // cancel
    ]);
  });

  test("builds the Scotland subdivision flag as a tag sequence", () => {
    const flag = flagEmoji("SCO");
    const codepoints = [...flag].map((c) => c.codePointAt(0));
    assert.deepEqual(codepoints, [0x1f3f4, 0xe0067, 0xe0062, 0xe0073, 0xe0063, 0xe0074, 0xe007f]);
  });

  test("returns an empty string for an unknown code instead of throwing", () => {
    assert.equal(flagEmoji("ZZZ"), "");
  });

  test("every real pool code produces a non-empty flag", () => {
    const codes = [
      "GHA", "EGY", "NZL", "ALG", "ARG", "BIH", "PAR", "NED", "IRQ", "PAN",
      "ESP", "USA", "SWE", "HAI", "NOR", "BRA", "CIV", "JOR", "AUS", "CRO",
      "CUW", "AUT", "MEX", "RSA", "ECU", "CAN", "KSA", "SCO", "POR", "TUR",
      "IRN", "MAR", "QAT", "KOR", "ENG", "CPV", "SEN", "COL", "TUN", "JPN",
      "FRA", "CZE", "COD", "SUI", "BEL", "UZB", "URU", "GER",
    ];
    for (const code of codes) {
      assert.notEqual(flagEmoji(code), "", `expected a flag for ${code}`);
    }
  });
});
