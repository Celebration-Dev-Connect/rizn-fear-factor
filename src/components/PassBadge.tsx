"use client";
import { useState } from "react";
import { BrandMark } from "./BrandMark";
import styles from "./PassBadge.module.css";
import { formatPassNumber, type Pass } from "@/shared/types";

/**
 * Conference-badge Night Pass. Display only: there is nothing to type or upload. Tapping it flips
 * the card to a QR code crew can scan to enter the student's costume (spec 002 FR-123). The code
 * image loads with the page, so the flip still works if the wifi drops.
 */
export function PassBadge({ pass }: { pass: Pass }) {
  const [flipped, setFlipped] = useState(false);
  const number = formatPassNumber(pass.number);
  return (
    <section className={styles.badge} aria-label={`Night Pass ${number}, ${pass.nickname}`}>
      <div className={`${styles.card} ${flipped ? styles.flipped : ""}`}>
        <div className={`${styles.face} ${styles.front}`} aria-hidden={flipped}>
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
            {number}
          </p>
          <p className={styles.footer}>Tap your pass to show your code</p>
        </div>
        <div className={`${styles.face} ${styles.back}`} aria-hidden={!flipped}>
          <div className={styles.lanyard} aria-hidden="true" />
          <div className={styles.qrPanel}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/api/pass/code.svg" alt="QR code for crew to scan" width={240} height={240} className={styles.qr} />
          </div>
          <p className={styles.backName}>{pass.nickname}</p>
          <p className={styles.backNumber}>
            <span className="visually-hidden">Pass number </span>
            {number}
          </p>
          <p className={styles.footer}>Show this to crew to enter the costume contest</p>
        </div>
      </div>
      <button
        type="button"
        className={styles.flip}
        aria-pressed={flipped}
        aria-label={flipped ? "Show my pass" : "Show my pass code"}
        onClick={() => setFlipped((f) => !f)}
      />
    </section>
  );
}
