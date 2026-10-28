import { BrandMark } from "./BrandMark";
import styles from "./PassBadge.module.css";
import { formatPassNumber, type Pass } from "@/shared/types";

/** Conference-badge style Night Pass. Display only — there is nothing to type or upload. */
export function PassBadge({ pass }: { pass: Pass }) {
  return (
    <section className={styles.badge} aria-label={`Night Pass ${formatPassNumber(pass.number)}, ${pass.nickname}`}>
      <header className={styles.header}>
        <div className={styles.lanyard} aria-hidden="true" />
        <div className={styles.logo}><BrandMark size="md" /></div>
        <p className={styles.kicker}>NIGHT PASS · OCT 30, 2026</p>
      </header>
      <div className={styles.body}>
        <p className={styles.label}>Your nickname tonight</p>
        <p className={styles.nickname}>{pass.nickname}</p>
      </div>
      <p className={styles.number}>
        <span className="visually-hidden">Pass number </span>
        {formatPassNumber(pass.number)}
      </p>
      <footer className={styles.footer}>Show this to crew to enter the costume contest</footer>
    </section>
  );
}
