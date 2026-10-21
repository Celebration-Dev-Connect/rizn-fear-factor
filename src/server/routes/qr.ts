import { Router } from "express";
import QRCode from "qrcode";
import { config } from "../config";

export const qrRouter = Router();

let cached: string | undefined;

// Rendered on our own server, so the big screen makes no third-party request.
qrRouter.get("/qr.svg", async (_req, res, next) => {
  try {
    cached ??= await QRCode.toString(config().PUBLIC_URL, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#1a0b2e", light: "#ffffff" },
    });
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.type("image/svg+xml").send(cached);
  } catch (err) {
    next(err);
  }
});
