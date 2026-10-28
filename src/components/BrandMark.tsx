import styles from "./BrandMark.module.css";

/**
 * RIZN Fear Factor logo (spec 002 FR-117), from public/brand/ (made by `npm run brand:assets`).
 * Width and height are set so nothing shifts while it loads, and it never blocks the page.
 */
export function BrandMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/fear-factor-logo.webp"
      srcSet="/brand/fear-factor-logo.webp 1x, /brand/fear-factor-logo@2x.webp 2x"
      alt="RIZN Fear Factor"
      width={360}
      height={412}
      decoding="async"
      className={`${styles.logo} ${styles[size]}`}
    />
  );
}

/** RIZN Youth sign-off (FR-117). White on the dark background. */
export function RiznYouthMark({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/rizn-youth-white.webp"
      alt="RIZN Youth"
      width={480}
      height={111}
      loading="lazy"
      decoding="async"
      className={`${styles.youth} ${className}`}
    />
  );
}
