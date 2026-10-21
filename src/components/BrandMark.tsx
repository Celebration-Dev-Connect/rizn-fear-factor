import styles from "./BrandMark.module.css";

/**
 * RIZN Fear Factor brand mark (FR-042). Until the organizers supply the official logo SVG in
 * public/brand/, this renders a text wordmark. To switch: set LOGO_SRC to "/brand/<file>.svg".
 */
const LOGO_SRC: string | null = null;

export function BrandMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  if (LOGO_SRC) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={LOGO_SRC} alt="RIZN Fear Factor" className={`${styles.logo} ${styles[size]}`} />;
  }
  return (
    <div className={`${styles.wordmark} ${styles[size]}`} role="img" aria-label="RIZN Fear Factor">
      <span className={styles.rizn} aria-hidden="true">RIZN</span>
      <span className={styles.ff} aria-hidden="true">FEAR FACTOR</span>
    </div>
  );
}
