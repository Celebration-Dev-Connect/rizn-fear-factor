import { EntryLabel } from "./EntryLabel";
import styles from "./YourCostume.module.css";
import { PLACE_LABELS, type Me } from "@/shared/types";

/**
 * A contestant's own costume on their Night Pass (spec 002 FR-121–FR-122). It never shows vote
 * counts; after the reveal reaches their place it says how they placed.
 */
export function YourCostume({ entry, place }: { entry: NonNullable<Me["ownEntry"]>; place: Me["ownPlace"] }) {
  return (
    <section className={`${styles.card} ${place ? styles.placed : ""}`} aria-labelledby="your-costume">
      <h2 id="your-costume" className={styles.heading}>Your costume</h2>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={entry.photo.thumb} alt={entry.alt} width={480} height={480} loading="lazy" decoding="async" className={styles.photo} />
      <EntryLabel entry={entry} size="md" />
      {place ? (
        <p className={styles.place} role="status">
          <span aria-hidden="true">{place.place === 1 ? "🏆" : place.place === 2 ? "🥈" : "🥉"} </span>
          {place.tied ? `Tied for ${PLACE_LABELS[place.place]}!` : `You placed ${PLACE_LABELS[place.place]}!`}
        </p>
      ) : (
        <p className={styles.note}>You&apos;re in the costume contest!</p>
      )}
    </section>
  );
}
