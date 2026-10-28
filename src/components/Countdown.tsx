"use client";
import { formatCountdown } from "@/lib/countdown";
import { useServerNow } from "@/lib/useServerClock";
import { formatEdmontonTime } from "@/lib/time";
import styles from "./Countdown.module.css";

/**
 * Big-screen countdown to the crew-set close time (spec 002 FR-112–FR-114). Uses server time, so
 * the device clock doesn't matter. Reaching zero only changes the words: crew still close voting.
 */
export function Countdown({ closesAt }: { closesAt: string }) {
  const now = useServerNow(250);
  const c = formatCountdown(new Date(closesAt).getTime() - now);
  return (
    <section className={styles.countdown} aria-label="Voting countdown">
      {c.kind === "closing" ? (
        <p className={styles.closing}>Voting closes any moment</p>
      ) : (
        <>
          <p className={styles.kicker}>Voting closes in</p>
          {/* aria-live off: a ticking clock would flood screen readers */}
          <p className={styles.digits} aria-live="off">{c.text}</p>
        </>
      )}
      <p className={styles.at}>Voting closes at {formatEdmontonTime(closesAt)}</p>
    </section>
  );
}
