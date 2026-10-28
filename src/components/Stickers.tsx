import styles from "./Stickers.module.css";

type Layout = "pass" | "contest" | "screen";

// Collage stickers from the RIZN artwork (spec 002 FR-117). Purely decorative: hidden from screen
// readers, never clickable, and they only float when the viewer hasn't asked for reduced motion.
// The pass layout uses three stickers to keep the first load small (SC-107).
const LAYOUTS: Record<Layout, string[]> = {
  pass: ["stars", "horse", "clock"],
  contest: ["beetle", "spiral"],
  screen: ["stars", "horse", "beetle", "spiral", "phone", "cube"],
};

export function Stickers({ layout }: { layout: Layout }) {
  return (
    <div className={`${styles.layer} ${styles[layout]}`} aria-hidden="true">
      {LAYOUTS[layout].map((name, i) => (
        <span key={name} className={`${styles.sticker} ${styles[name]} ${styles[`slot${i}`]}`} />
      ))}
    </div>
  );
}
