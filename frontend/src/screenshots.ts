/**
 * Screenshots for the case studies, by project slug. Empty until you supply
 * them; a case study without one shows a labelled slot instead.
 *
 * To add one: save it as frontend/public/work/<slug>/<slug>-1.webp (1600px
 * wide, under 200 kB), then add an entry here. The alt text says what the
 * screenshot shows, for someone who cannot see it; the caption says why it
 * is there.
 *
 *   exercise: [
 *     {
 *       src: "/work/exercise/exercise-1.webp",
 *       alt: "RxFlow's patient screen: today's three exercises with a video and set checkboxes",
 *       caption: "The patient's day in RxFlow, on an iPhone.",
 *     },
 *   ],
 */
export interface Screenshot {
  src: string;
  alt: string;
  caption: string;
}

export const SCREENSHOTS: Record<string, Screenshot[]> = {};
