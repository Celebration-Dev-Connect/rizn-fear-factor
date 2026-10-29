import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark, RiznYouthMark } from "@/components/BrandMark";
import { RIZN_INFO } from "@/content/rizn";
import van from "@/content/van.json";
import styles from "./page.module.css";

// Spec 003 US2: public page, no pass or event window needed, and no student data.
export const metadata: Metadata = {
  title: `${RIZN_INFO.title} · RIZN Fear Factor`,
  description: RIZN_INFO.description,
  openGraph: { title: RIZN_INFO.title, description: RIZN_INFO.description, url: "/rizn" },
  twitter: { title: RIZN_INFO.title, description: RIZN_INFO.description },
};

export default function RiznInfoPage() {
  const { thanks, weekly, nextWeek, instagram, signOff } = RIZN_INFO;
  return (
    <main className="page">
      <p><Link href="/">← My Night Pass</Link></p>
      <BrandMark size="md" />

      <section className={styles.intro}>
        <h1>{thanks.heading}</h1>
        <p>{thanks.body}</p>
      </section>

      <section className={styles.next} aria-labelledby="next-week">
        <p className={`kicker ${styles.nextKicker}`}>{nextWeek.kicker}</p>
        <h2 id="next-week" className={styles.vanageddon}>{nextWeek.heading}</h2>
        {van.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/brand/van.webp" alt={nextWeek.photoAlt} className={styles.vanPhoto} loading="lazy" decoding="async" />
        )}
        {nextWeek.body.map((p) => <p key={p}>{p}</p>)}
      </section>

      <section className={`card ${styles.weekly}`} aria-labelledby="weekly">
        <h2 id="weekly">{weekly.heading}</h2>
        <p className={styles.when}>
          <strong>{weekly.when}</strong>
          <br />
          {weekly.where} · {weekly.grades}
        </p>
        {weekly.body.map((p) => <p key={p}>{p}</p>)}
      </section>

      {/* A plain link, not an embed: Instagram embeds load Meta scripts and trackers (Constitution I). */}
      <section className={styles.instagram} aria-labelledby="instagram">
        <h2 id="instagram">{instagram.heading}</h2>
        <p>{instagram.body}</p>
        <a href={instagram.url} className="button" target="_blank" rel="noopener noreferrer">
          Follow {instagram.handle} on Instagram
        </a>
      </section>

      <p className={styles.signOff}>{signOff}</p>
      <footer style={{ marginTop: 24 }}><RiznYouthMark /></footer>
    </main>
  );
}
