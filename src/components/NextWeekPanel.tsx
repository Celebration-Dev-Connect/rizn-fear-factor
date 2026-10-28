import { RIZN_INFO } from "@/content/rizn";
import styles from "./NextWeekPanel.module.css";

/** Big screen, after 1st place is revealed (spec 003 FR-213): next week's event and a QR to /rizn. */
export function NextWeekPanel() {
  const { nextWeek, weekly } = RIZN_INFO;
  return (
    <aside className={styles.panel} aria-label="Next week at RIZN">
      <div className={styles.text}>
        <p className={styles.kicker}>{nextWeek.kicker}</p>
        <p className={styles.heading}>{nextWeek.heading}</p>
        <p className={styles.line}>{weekly.when} · scan for more</p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/api/qr.svg?to=rizn" alt="QR code for more about RIZN Youth" className={styles.qr} />
    </aside>
  );
}
