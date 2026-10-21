"use client";
import { usePublicState } from "./StateProvider";
import styles from "./RehearsalBanner.module.css";

/** FR-037: visible on every screen while rehearsal mode is on. Text + icon, not color alone. */
export function RehearsalBanner() {
  const { state } = usePublicState();
  if (!state?.rehearsal) return null;
  return (
    <div className={styles.banner} role="status">
      <span aria-hidden="true">🎬</span> REHEARSAL — practice data, will be wiped
    </div>
  );
}
