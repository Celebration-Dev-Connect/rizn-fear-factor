"use client";
import { useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { api, ApiRequestError } from "@/lib/api";
import { DEVICE_LABELS } from "@/shared/deviceLabels";

export function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [passcode, setPasscode] = useState("");
  const [device, setDevice] = useState<string>(DEVICE_LABELS[0]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await api("/api/crew/session", { method: "POST", json: { passcode, deviceLabel: device }, retries: 1 });
      onSignedIn();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page" style={{ maxWidth: 420 }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}><BrandMark /></div>
      <h1>Crew sign-in</h1>
      <form onSubmit={submit} className="card" style={{ display: "grid", gap: 16 }}>
        <label style={{ display: "grid", gap: 6 }}>
          Crew passcode
          <input type="password" autoComplete="current-password" value={passcode} onChange={(e) => setPasscode(e.target.value)} required />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          This device
          <select value={device} onChange={(e) => setDevice(e.target.value)}>
            {DEVICE_LABELS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        {error && <p className="notice error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );
}
