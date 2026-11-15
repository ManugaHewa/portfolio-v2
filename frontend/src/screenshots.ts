/**
 * Case study screenshots by slug; without one, the figure shows a plate.
 * Add frontend/public/work/<slug>/<slug>-1.webp (1600px wide, under 200 kB)
 * and an entry: alt says what it shows, caption why it is there.
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
