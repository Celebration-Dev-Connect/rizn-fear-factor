import { describe, expect, it } from "vitest";
import { encodeScanCode, parseScanCode, verifyScanCode } from "@/server/services/scanCode";
import { SCAN_CODE_PATTERN } from "@/shared/schemas";

const secret = "test-secret-at-least-32-characters-long";
const pass = { realm: "live" as const, number: 42, id: "0b6f6a8e-6d7e-4c1e-9a55-7f3b1c2d4e5f" };

describe("pass scan codes (spec 002 FR-124)", () => {
  it("encodes a short, opaque, pattern-matching code", () => {
    const code = encodeScanCode(pass, secret);
    expect(code).toMatch(SCAN_CODE_PATTERN);
    expect(code.startsWith("NP1.L.42.")).toBe(true);
    expect(encodeScanCode({ ...pass, realm: "rehearsal" }, secret).startsWith("NP1.R.42.")).toBe(true);
  });

  it("round-trips and verifies", () => {
    const parsed = parseScanCode(encodeScanCode(pass, secret))!;
    expect(parsed).toMatchObject({ realm: "live", number: 42 });
    expect(verifyScanCode(pass.id, parsed.mac, secret)).toBe(true);
  });

  it("rejects a forged MAC, another pass's id, or another secret", () => {
    const { mac } = parseScanCode(encodeScanCode(pass, secret))!;
    const flipped = (mac[0] === "A" ? "B" : "A") + mac.slice(1);
    expect(verifyScanCode(pass.id, flipped, secret)).toBe(false);
    expect(verifyScanCode("1c7f7b9f-7e8f-4d2f-8b66-8a4c2d3e5f60", mac, secret)).toBe(false);
    expect(verifyScanCode(pass.id, mac, "another-secret-of-sufficient-length!!")).toBe(false);
    expect(verifyScanCode(pass.id, mac.slice(0, 11), secret)).toBe(false);
  });

  it("refuses anything that isn't a Night Pass code", () => {
    for (const bad of ["https://pass.riznfearfactor.ca", "NP1.X.42.ABCDEFGHIJKL", "NP1.L.42.abcdefghijkl", "NP1.L..ABCDEFGHIJKL", ""]) {
      expect(parseScanCode(bad)).toBeNull();
    }
  });
});
