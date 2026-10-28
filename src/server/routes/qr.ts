import { Router } from "express";
import QRCode from "qrcode";
import { config } from "../config";

export const qrRouter = Router();

// Only these targets can be encoded, so the endpoint can't be used to make arbitrary QR codes.
const TARGETS = { join: "", rizn: "/rizn" } as const; // spec 003 FR-213: ?to=rizn
type Target = keyof typeof TARGETS;
const cache = new Map<Target, string>();

// Rendered on our own server, so the big screen makes no third-party request.
qrRouter.get("/qr.svg", async (req, res, next) => {
  try {
    const to: Target = req.query.to === "rizn" ? "rizn" : "join";
    let svg = cache.get(to);
    if (!svg) {
      svg = await QRCode.toString(`${config().PUBLIC_URL}${TARGETS[to]}`, {
        type: "svg",
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#0a0e1a", light: "#ffffff" },
      });
      cache.set(to, svg);
    }
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.type("image/svg+xml").send(svg);
  } catch (err) {
    next(err);
  }
});
