"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { CREW_POLL, usePoll } from "@/lib/usePoll";
import { CrewContext, type Dashboard } from "./CrewContext";
import { SignIn } from "./SignIn";
import styles from "./crew.module.css";

const NAV = [
  { href: "/crew", label: "Dashboard" },
  { href: "/crew/entries", label: "Entries" },
  { href: "/crew/assist", label: "Assist" },
  { href: "/crew/votes", label: "Votes" },
  { href: "/crew/results", label: "Results" },
];

export default function CrewLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { data, error, refresh } = usePoll<Dashboard>("/api/crew/dashboard", CREW_POLL);

  if (error?.status === 401) return <SignIn onSignedIn={refresh} />;
  if (!data) return <main className="page"><p role="status">Loading crew tools…</p></main>;

  return (
    <CrewContext.Provider value={{ dashboard: data, refresh }}>
      <header className={styles.header}>
        <BrandMark size="sm" />
        <span className={styles.device}>{data.deviceLabel}</span>
      </header>
      <nav className={styles.nav} aria-label="Crew">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={path === n.href ? "page" : undefined}>
            {n.label}
          </Link>
        ))}
      </nav>
      <main className="page">{children}</main>
    </CrewContext.Provider>
  );
}
