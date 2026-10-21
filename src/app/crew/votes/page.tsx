"use client";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { api } from "@/lib/api";
import { formatEdmontonDateTime } from "@/lib/time";
import { CREW_POLL, usePoll } from "@/lib/usePoll";
import { formatPassNumber } from "@/shared/types";

type VoteRow = {
  id: string;
  castAt: string;
  status: "counted" | "voided" | "released";
  assisted: boolean;
  pass: { number: number; nickname: string; createdAt: string; origin: "self" | "crew" };
  entry: { id: string; displayName: string };
};

const STATUS: Record<VoteRow["status"], string> = { counted: "✔ Counted", voided: "✖ Voided", released: "↺ Released" };

export default function VoteLogPage() {
  const [sort, setSort] = useState<"cast_at" | "pass_created_at">("cast_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [status, setStatus] = useState<string>("");
  const [acting, setActing] = useState<{ vote: VoteRow; action: "void" | "restore" }>();
  const url = `/api/crew/votes?sort=${sort}&order=${order}${status ? `&status=${status}` : ""}`;
  const { data, refresh } = usePoll<{ votes: VoteRow[] }>(url, { ...CREW_POLL, intervalMs: 5000 });

  return (
    <>
      <h1>Vote log</h1>
      <p>
        Sort by <strong>pass created</strong> to spot many passes made seconds apart that all voted for the same costume. Nothing
        is flagged automatically — use your judgment.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "16px 0" }}>
        <label style={{ display: "grid", gap: 4 }}>Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="cast_at">Vote time</option>
            <option value="pass_created_at">Pass created</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>Order
          <select value={order} onChange={(e) => setOrder(e.target.value as typeof order)}>
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="counted">Counted</option>
            <option value="voided">Voided</option>
            <option value="released">Released</option>
          </select>
        </label>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th scope="col">Voted</th>
              <th scope="col">Pass</th>
              <th scope="col">Pass created</th>
              <th scope="col">Costume</th>
              <th scope="col">Status</th>
              <th scope="col"><span className="visually-hidden">Action</span></th>
            </tr>
          </thead>
          <tbody>
            {data?.votes.map((v) => (
              <tr key={v.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td>{formatEdmontonDateTime(v.castAt)}</td>
                <td>
                  {formatPassNumber(v.pass.number)} {v.pass.nickname}
                  {v.pass.origin === "crew" && " · crew pass"}
                  {v.assisted && " · assisted"}
                </td>
                <td>{formatEdmontonDateTime(v.pass.createdAt)}</td>
                <td>{v.entry.displayName}</td>
                <td>{STATUS[v.status]}</td>
                <td>
                  {v.status === "counted" && <button type="button" className="danger" onClick={() => setActing({ vote: v, action: "void" })}>Void</button>}
                  {v.status === "voided" && <button type="button" className="secondary" onClick={() => setActing({ vote: v, action: "restore" })}>Restore</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.votes.length === 0 && <p>No votes yet.</p>}
      </div>
      {acting && (
        <ConfirmDialog
          title={acting.action === "void" ? "Void this vote?" : "Restore this vote?"}
          body={<p>{formatPassNumber(acting.vote.pass.number)} {acting.vote.pass.nickname} → {acting.vote.entry.displayName}. {acting.action === "void" ? "It stops counting, and this pass can't vote again." : "It counts again."}</p>}
          confirmLabel={acting.action === "void" ? "Void" : "Restore"}
          danger={acting.action === "void"}
          onConfirm={async () => {
            await api(`/api/crew/votes/${acting.vote.id}/${acting.action}`, { method: "POST" }).catch(() => {});
            setActing(undefined);
            refresh();
          }}
          onCancel={() => setActing(undefined)}
        />
      )}
    </>
  );
}
