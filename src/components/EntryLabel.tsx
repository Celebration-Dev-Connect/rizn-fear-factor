import styles from "./EntryLabel.module.css";
import type { EntryCard } from "@/shared/types";

type Props = {
  entry: Pick<EntryCard, "displayName" | "costumeTitle">;
  size?: "sm" | "md" | "xl";
  className?: string;
};

/**
 * "Midnight Gremlin as SUPERMAN": nickname(s) small, costume title large (spec 002 FR-108).
 * Without a title it is just the nickname(s). Long titles wrap rather than truncate.
 */
export function EntryLabel({ entry, size = "md", className = "" }: Props) {
  if (!entry.costumeTitle) {
    return <span className={`${styles.label} ${styles[size]} ${styles.solo} ${className}`}>{entry.displayName}</span>;
  }
  return (
    <span className={`${styles.label} ${styles[size]} ${className}`}>
      <span className={styles.who}>
        {entry.displayName} <span className={styles.as}>as</span>
      </span>
      <span className={styles.title}>{entry.costumeTitle}</span>
    </span>
  );
}
