import { createHmac, timingSafeEqual } from "node:crypto";
import type { Realm } from "@/shared/types";

// The Night Pass QR code (spec 002 FR-124, research §4): "NP1.{L|R}.{number}.{mac}". It names the
// pass for crew only. It holds no cookie or token, so a photo of it can't be used as the pass, and
// the MAC (from the server secret and the pass id) stops anyone printing a code for another pass.

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const MAC_LENGTH = 12;

function base32(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function scanMac(passId: string, secret: string): string {
  return base32(createHmac("sha256", secret).update(`pass-scan:${passId}`).digest()).slice(0, MAC_LENGTH);
}

export function encodeScanCode(pass: { realm: Realm; number: number; id: string }, secret: string): string {
  return `NP1.${pass.realm === "live" ? "L" : "R"}.${pass.number}.${scanMac(pass.id, secret)}`;
}

export type ParsedScanCode = { realm: Realm; number: number; mac: string };

export function parseScanCode(code: string): ParsedScanCode | null {
  const m = /^NP1\.([LR])\.(\d{1,6})\.([A-Z2-7]{12})$/.exec(code.trim());
  if (!m) return null;
  return { realm: m[1] === "L" ? "live" : "rehearsal", number: Number(m[2]), mac: m[3]! };
}

/** Constant-time check that `mac` belongs to this pass. */
export function verifyScanCode(passId: string, mac: string, secret: string): boolean {
  const expected = Buffer.from(scanMac(passId, secret));
  const given = Buffer.from(mac);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
