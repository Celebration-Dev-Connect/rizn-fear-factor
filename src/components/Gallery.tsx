"use client";
import { EntryLabel } from "./EntryLabel";
import styles from "./Gallery.module.css";
import { entryLabelText, type EntryCard } from "@/shared/types";

type Props = {
  entries: EntryCard[];
  /** When set, cards are buttons. */
  onSelect?: (entry: EntryCard) => void;
  ownEntryId?: string | null;
  selectedId?: string | null;
  votedId?: string | null;
};

/** Costume grid. Labels never show vote counts (FR-013). */
export function Gallery({ entries, onSelect, ownEntryId, selectedId, votedId }: Props) {
  if (entries.length === 0) {
    return <p className="notice">No costumes yet. Crew are adding them now — check back soon.</p>;
  }
  return (
    <ul className={styles.grid}>
      {entries.map((e) => {
        const isOwn = e.id === ownEntryId;
        const label = entryLabelText(e);
        const content = (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={e.photo.thumb} alt={e.alt} width={480} height={480} loading="lazy" decoding="async" className={styles.photo} />
            <EntryLabel entry={e} size="md" className={styles.name} />
            {isOwn && <span className={styles.tag}><span aria-hidden="true">🙋</span> That&apos;s you!</span>}
            {votedId === e.id && <span className={styles.tag}><span aria-hidden="true">✔</span> Your vote</span>}
          </>
        );
        return (
          <li key={e.id} className={styles.item}>
            {onSelect ? (
              <button
                type="button"
                className={`${styles.card} ${selectedId === e.id ? styles.selected : ""}`}
                onClick={() => onSelect(e)}
                disabled={isOwn}
                aria-pressed={selectedId === e.id}
                aria-label={
                  isOwn
                    ? `${label} — your own costume, can't vote`
                    : votedId === e.id
                      ? `${label} — your current vote`
                      : `Vote for ${label}`
                }
              >
                {content}
              </button>
            ) : (
              <div className={styles.card}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
