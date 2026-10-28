import { EntryLabel } from "./EntryLabel";
import styles from "./Reveal.module.css";
import { entryLabelText, PLACE_LABELS, type RevealedPlace } from "@/shared/types";

/**
 * Winners, lowest place first (FR-031/FR-032). Celebratory CSS-only animation that the global
 * reduced-motion rule turns into a static card. The newest place is announced politely.
 */
export function Reveal({ places, big = false }: { places: RevealedPlace[]; big?: boolean }) {
  if (places.length === 0) return null;
  const newest = places[places.length - 1]!;
  return (
    <section className={`${styles.wrap} ${big ? styles.big : ""}`} aria-label="Costume contest results">
      <p className="visually-hidden" aria-live="polite">
        {newest.tied ? `Tied for ${PLACE_LABELS[newest.place]}` : `${PLACE_LABELS[newest.place]} place`}:{" "}
        {newest.entries.map(entryLabelText).join(" and ")}
      </p>
      {[...places].reverse().map((p) => (
        <article key={p.place} className={`${styles.place} ${styles[`p${p.place}`]}`}>
          <div className={styles.confetti} aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => <i key={i} />)}
          </div>
          <h2 className={styles.label}>
            <span aria-hidden="true">{p.place === 1 ? "🏆" : p.place === 2 ? "🥈" : "🥉"}</span>{" "}
            {p.tied ? `Tied for ${PLACE_LABELS[p.place]}` : `${PLACE_LABELS[p.place]} Place`}
          </h2>
          <ul className={styles.winners}>
            {p.entries.map((e) => (
              <li key={e.id} className={styles.winner}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={e.photo.full} alt={e.alt} className={styles.photo} />
                <EntryLabel entry={e} size={big ? "xl" : "md"} className={styles.name} />
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
