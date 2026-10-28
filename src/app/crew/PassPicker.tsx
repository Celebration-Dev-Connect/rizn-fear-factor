"use client";
import { useEffect, useState } from "react";
import { ScanPassButton } from "@/components/ScanPassButton";
import { api } from "@/lib/api";
import { formatPassNumber } from "@/shared/types";

export type PassHit = { id: string; number: number; nickname: string; origin: "self" | "crew"; entryId: string | null };

/** Find a pass by nickname or number, or create a crew pass for a student without a phone. */
export function PassPicker({ onPick, allowEntered = false }: { onPick: (p: PassHit) => void; allowEntered?: boolean }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PassHit[]>([]);
  const [created, setCreated] = useState<PassHit>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (q.trim() === "") return;
    const t = setTimeout(() => {
      api<{ passes: PassHit[] }>(`/api/crew/passes?q=${encodeURIComponent(q)}`, { retries: 1 })
        .then((r) => setHits(r.passes))
        .catch(() => setHits([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  async function createPass() {
    setError(undefined);
    try {
      const r = await api<{ pass: Omit<PassHit, "entryId"> }>("/api/crew/passes", { method: "POST" });
      const p = { ...r.pass, entryId: null };
      setCreated(p);
      onPick(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <ScanPassButton onPick={onPick} check={(p) => (p.entryId && !allowEntered ? "already entered in a costume" : null)} />
      <label style={{ display: "grid", gap: 6 }}>
        Or search by nickname or pass number
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Midnight Gremlin or 42" inputMode="search" autoComplete="off" />
      </label>
      {q.trim() !== "" && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {hits.length === 0 && <li style={{ color: "var(--text-muted)" }}>No matching pass</li>}
          {hits.map((h) => {
            const entered = Boolean(h.entryId) && !allowEntered;
            return (
              <li key={h.id}>
                <button type="button" className="secondary" style={{ width: "100%", justifyContent: "space-between" }} disabled={entered} onClick={() => onPick(h)}>
                  <span>{h.nickname}</span>
                  <span>{formatPassNumber(h.number)}{entered ? " · already entered" : h.origin === "crew" ? " · crew pass" : ""}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" className="secondary" onClick={createPass}>Student has no phone → create a pass</button>
      {created && (
        <p className="notice" role="status">
          New pass: <strong>{created.nickname}</strong> {formatPassNumber(created.number)}. Tell the student their nickname.
        </p>
      )}
      {error && <p className="notice error" role="alert">{error}</p>}
    </div>
  );
}
