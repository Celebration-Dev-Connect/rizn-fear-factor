import { BrandMark, RiznYouthMark } from "@/components/BrandMark";
import { OFFSEASON } from "@/content/offseason";
import { NextEventGate } from "./NextEventGate";
import styles from "./page.module.css";

/** The one off-season page (spec 004). Also rendered for 404s, so every old link lands here. */
export function OffseasonPage() {
  const { thanks, weekly, instagram, backNextYear, nextEvent, signOff } = OFFSEASON;
  return (
    <main className="page">
      <BrandMark size="md" />

      <section className={styles.intro}>
        <h1>{thanks.heading}</h1>
        <p>{thanks.body}</p>
      </section>

      {nextEvent && (
        <NextEventGate endsAt={nextEvent.endsAt}>
          <section className={styles.next} aria-labelledby="next-event">
            <p className={`kicker ${styles.nextKicker}`}>{nextEvent.kicker}</p>
            <h2 id="next-event" className={styles.vanageddon}>{nextEvent.heading}</h2>
            {nextEvent.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={nextEvent.photo} alt={nextEvent.photoAlt} width={1200} height={614} className={styles.vanPhoto} decoding="async" />
            )}
            {nextEvent.body.map((p) => <p key={p}>{p}</p>)}
          </section>
        </NextEventGate>
      )}

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

      <section className={styles.back} aria-labelledby="back-next-year">
        <h2 id="back-next-year">{backNextYear.heading}</h2>
        <p>{backNextYear.body}</p>
      </section>

      <p className={styles.signOff}>{signOff}</p>
      <footer style={{ marginTop: 24 }}><RiznYouthMark /></footer>
    </main>
  );
}
