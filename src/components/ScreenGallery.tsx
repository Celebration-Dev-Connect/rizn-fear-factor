"use client";
import { useEffect, useState } from "react";
import styles from "@/app/screen/screen.module.css";
import type { EntryCard } from "@/shared/types";

const ROTATE_MS = 6000;

/** Rotating costume photo with a large caption. Reduced motion → plain swap (no crossfade). */
export function ScreenGallery({ entries }: { entries: EntryCard[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (entries.length < 2) return;
    const t = setInterval(() => setI((n) => n + 1), ROTATE_MS);
    return () => clearInterval(t);
  }, [entries.length]);
  if (entries.length === 0) return <div className={styles.empty}>Costumes appear here as crew add them</div>;
  const e = entries[i % entries.length]!;
  return (
    <figure className={styles.figure} key={e.id}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={e.photo.full} alt={e.alt} className={styles.photo} />
      <figcaption className={styles.caption}>{e.displayName}</figcaption>
    </figure>
  );
}
