"use client";
import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { api, ApiRequestError } from "@/lib/api";
import { resizeImage } from "@/lib/resizeImage";
import { usePoll, CREW_POLL } from "@/lib/usePoll";
import { EntryLabel } from "@/components/EntryLabel";
import { entryLabelText, formatPassNumber, type EntryCard } from "@/shared/types";
import { PassPicker, type PassHit } from "../PassPicker";

export default function CrewEntriesPage() {
  const [passes, setPasses] = useState<PassHit[]>([]);
  const [photo, setPhoto] = useState<Blob>();
  const [consent, setConsent] = useState(false);
  /** Spec 002 FR-107: crew-typed costume, never a person's name. */
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string }>();
  const [pickerKey, setPickerKey] = useState(0);
  const [editing, setEditing] = useState<EntryCard>();
  const [removing, setRemoving] = useState<EntryCard>();
  const list = usePoll<{ entries: EntryCard[] }>("/api/crew/entries", { ...CREW_POLL, intervalMs: 5000 });

  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : undefined), [photo]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function reset() {
    setPasses([]);
    setPhoto(undefined);
    setConsent(false);
    setTitle("");
    setEditing(undefined);
    setPickerKey((k) => k + 1);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      setPhoto(await resizeImage(file));
    } catch {
      setMessage({ kind: "error", text: "Couldn't read that photo. Try again." });
    }
  }

  async function save() {
    setBusy(true);
    setMessage(undefined);
    const form = new FormData();
    if (photo) form.append("photo", photo, "costume.jpg");
    if (!editing || passes.length > 0) passes.forEach((p) => form.append("passIds[]", p.id));
    if (!editing) form.append("consent", consent ? "true" : "false");
    if (!editing || titleChanged) form.append("costumeTitle", title);
    try {
      if (editing) {
        await api(`/api/crew/entries/${editing.id}`, { method: "PATCH", form });
        setMessage({ kind: "ok", text: "Entry updated" });
      } else {
        const r = await api<{ warning?: string }>("/api/crew/entries", { method: "POST", form });
        setMessage({
          kind: "ok",
          text: r.warning === "added_during_voting" ? "Saved. Heads up: voting is open, so earlier voters didn't see this costume." : "Saved! Ready for the next costume.",
        });
      }
      reset();
      list.refresh();
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof ApiRequestError ? e.message : "Save failed — try again" });
    } finally {
      setBusy(false);
    }
  }

  const titleChanged = Boolean(editing) && title.trim() !== (editing?.costumeTitle ?? "");
  const canSave = editing ? Boolean(photo) || passes.length > 0 || titleChanged : passes.length > 0 && photo && consent;

  return (
    <>
      <h1>{editing ? `Edit ${entryLabelText(editing)}` : "Add a costume"}</h1>
      <section className="card" style={{ display: "grid", gap: 20 }}>
        <div>
          <h2>1. Find the student</h2>
          {passes.length > 0 && (
            <ul style={{ paddingLeft: 20 }}>
              {passes.map((p) => (
                <li key={p.id}>
                  <strong>{p.nickname}</strong> {formatPassNumber(p.number)}{" "}
                  <button type="button" className="secondary" onClick={() => setPasses((ps) => ps.filter((x) => x.id !== p.id))}>Remove</button>
                </li>
              ))}
            </ul>
          )}
          <PassPicker key={pickerKey} onPick={(p) => setPasses((ps) => (ps.some((x) => x.id === p.id) ? ps : [...ps, p]))} />
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Group costume? Add each student&apos;s pass.</p>
        </div>

        <div>
          <h2>2. Take the photo</h2>
          <label className="button secondary" style={{ width: "100%" }}>
            <span aria-hidden="true">📷</span> {photo ? "Retake photo" : "Open camera"}
            <input type="file" accept="image/*" capture="environment" className="visually-hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            Camera blocked? Allow camera access for this site in the browser settings, or pick a photo from the library.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview && <img src={preview} alt="Preview of the costume photo" style={{ width: "100%", borderRadius: 12 }} />}
        </div>

        <div>
          <h2>3. What are they dressed as?</h2>
          <label style={{ display: "grid", gap: 6 }}>
            Costume <span style={{ color: "var(--text-muted)", fontSize: 14 }}>(optional)</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={40}
              placeholder="e.g. Superman"
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="done"
              aria-describedby="costume-hint"
            />
          </label>
          <p id="costume-hint" style={{ color: "var(--text-muted)", fontSize: 14, display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span>Describe the costume — <strong>no real names</strong>. Shows as “nickname as costume”.</span>
            <span aria-live="polite">{title.length}/40</span>
          </p>
        </div>

        {!editing && (
          <div>
            <h2>4. Consent</h2>
            <label style={{ display: "flex", gap: 12, alignItems: "center", minHeight: 44 }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ width: 28, height: 28 }} />
              Student and parent agree this photo can be shown tonight
            </label>
          </div>
        )}

        <button type="button" onClick={save} disabled={!canSave || busy} style={{ minHeight: 56, fontSize: 18 }}>
          {busy ? "Saving…" : editing ? "Save changes" : "Save entry"}
        </button>
        {editing && <button type="button" className="secondary" onClick={reset}>Cancel edit</button>}
        {message && <p className={`notice ${message.kind === "error" ? "error" : ""}`} role={message.kind === "error" ? "alert" : "status"}>{message.text}</p>}
      </section>

      <h2 style={{ marginTop: 32 }}>Entries ({list.data?.entries.length ?? 0})</h2>
      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
        {list.data?.entries.map((e) => (
          <li key={e.id} className="card" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={e.photo.thumb} alt={e.alt} width={72} height={72} style={{ objectFit: "cover", borderRadius: 8 }} />
            <span style={{ flex: 1, minWidth: 0 }}><EntryLabel entry={e} size="sm" /></span>
            <button type="button" className="secondary" onClick={() => { reset(); setEditing(e); setTitle(e.costumeTitle ?? ""); window.scrollTo({ top: 0 }); }}>Edit</button>
            <button type="button" className="danger" onClick={() => setRemoving(e)}>Remove</button>
          </li>
        ))}
      </ul>

      {removing && (
        <ConfirmDialog
          title={`Remove ${entryLabelText(removing)}?`}
          body={<p>The photo is deleted. Any votes for this costume are released, so those students can vote again while voting is open.</p>}
          confirmLabel="Remove entry"
          danger
          onConfirm={async () => {
            try {
              const r = await api<{ releasedVotes: number }>(`/api/crew/entries/${removing.id}`, { method: "DELETE" });
              setMessage({ kind: "ok", text: `Removed. ${r.releasedVotes} vote(s) released.` });
            } catch (e) {
              setMessage({ kind: "error", text: e instanceof Error ? e.message : "Failed" });
            }
            setRemoving(undefined);
            list.refresh();
          }}
          onCancel={() => setRemoving(undefined)}
        />
      )}
    </>
  );
}
