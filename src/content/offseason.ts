// Off-season page wording (fearfactor.riznyouth.com after Fear Factor 2026; spec 004).
//
// HOW TO UPDATE THE PAGE
// - Edit the text below, commit, and push to main. The "Publish site" workflow rebuilds and
//   uploads it; the live page updates in about 3 minutes. If the file has a mistake (for example a
//   missing quote), the build fails and the live page stays as it was.
// - The weekly details and Instagram link come from src/content/rizn.ts, so change them there.
// - nextEvent is shown until `endsAt`, then it hides itself in visitors' browsers. To remove it for
//   good, set `nextEvent: null`. To announce something new, fill it in with its own end time.
// - The page is served unchanged for months, so avoid "next week", "next Friday", or "tonight":
//   write the actual date instead.
// - Never put student names or photos here.
import { RIZN_INFO } from "./rizn";

export type NextEvent = {
  kicker: string;
  heading: string;
  body: readonly string[];
  photo: string | null;
  photoAlt: string;
  /** ISO time with offset; after this the section hides itself. */
  endsAt: string;
};

export const OFFSEASON = {
  title: "RIZN Youth",
  description: "RIZN Youth meets every Friday, 7:00–9:30pm at Celebration Church, Edmonton. Grades 7–12.",
  thanks: {
    heading: "Thanks for coming to Fear Factor 2026!",
    body: "Fear Factor was an event run by RIZN Youth, and we're so glad you were there.",
  },
  weekly: RIZN_INFO.weekly,
  instagram: RIZN_INFO.instagram,
  backNextYear: {
    heading: "Fear Factor will be back",
    body: "See you next October for another night of costumes, games, and chaos.",
  },
  nextEvent: {
    kicker: "Friday, November 6 · 7:00–9:30pm",
    heading: "VANAGEDDON",
    body: [
      "Remember the minivan from the Fear Factor halftime game? On Friday, November 6, we're going to DESTROY it.",
      "Spray paint, golf clubs, baseball bats: you'll get to help absolutely wreck the van. Bring a friend!",
    ],
    photo: "/brand/van.webp",
    photoAlt: RIZN_INFO.nextWeek.photoAlt,
    endsAt: "2026-11-06T21:30:00-07:00",
  } as NextEvent | null,
  signOff: "See you Friday!",
};
