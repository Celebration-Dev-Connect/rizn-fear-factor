"use client";

// Crew-device QR scanning (spec 002 FR-126, research §5). Uses the browser's BarcodeDetector where
// it exists (Android Chrome) and otherwise jsQR, loaded only when a crew member opens the scanner.
// Frames are read from the live camera into memory and dropped; nothing is uploaded or stored.

type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

export class ScanError extends Error {
  constructor(public kind: "denied" | "unavailable", message: string) {
    super(message);
  }
}

const MAX_WIDTH = 640;
const FRAME_MS = 160; // ~6 fps is plenty for a pass held still in front of the camera

/** Starts the camera on `video` and calls `onCode` with each decoded QR text. Returns a stop function. */
export async function startScan(video: HTMLVideoElement, onCode: (text: string) => void): Promise<() => void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new ScanError("unavailable", "This browser can't use the camera here");
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
  } catch (err) {
    const name = (err as DOMException)?.name;
    if (name === "NotAllowedError" || name === "SecurityError") throw new ScanError("denied", "Camera access was blocked");
    throw new ScanError("unavailable", "No camera found");
  }
  video.srcObject = stream;
  video.setAttribute("playsinline", "true");
  video.muted = true;
  await video.play().catch(() => {});

  let stopped = false;
  const stop = () => {
    stopped = true;
    for (const t of stream.getTracks()) t.stop();
    video.srcObject = null;
  };

  const Native = (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  const detector = Native ? new Native({ formats: ["qr_code"] }) : null;
  const jsQR = detector ? null : (await import("jsqr")).default;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const tick = async () => {
    if (stopped) return;
    try {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        if (detector) {
          const found = await detector.detect(video);
          if (found[0]?.rawValue) onCode(found[0].rawValue);
        } else if (jsQR && ctx) {
          const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const found = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
          if (found?.data) onCode(found.data);
        }
      }
    } catch {
      // A bad frame isn't fatal; try the next one.
    }
    if (!stopped) setTimeout(tick, FRAME_MS);
  };
  void tick();
  return stop;
}
