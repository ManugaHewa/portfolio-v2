import { Scramble } from "../motion";
import { useProjectsTiming } from "../lib/liveStats";

/**
 * Real numbers about the system the diagram above describes, measured on
 * this visit or stamped at build time; nothing here is typed in by hand.
 *
 * - How long this visit's GET /api/projects took, and how many projects it
 *   carried (lib/liveStats.ts, recorded by api.ts). The prerendered page
 *   cannot know either, so it shows a dash until the answer is in; a failed
 *   request says so in words.
 * - The commit the page was built from, with its date (vite.config.ts,
 *   buildStamp), left out when the build had no git.
 *
 * The measured values decode into place (Scramble), which under reduced
 * motion or "Pause motion" simply shows them.
 */
export function LiveReadout({ build = __BUILD__ }: { build?: typeof __BUILD__ }) {
  const timing = useProjectsTiming();

  return (
    <div className="live-readout container">
      <p className="live-readout-title mono" id="live-readout-title">
        Measured on this visit
      </p>
      <ul className="live-readout-list" aria-labelledby="live-readout-title">
        {timing && !timing.ok ? (
          <li className="live-item is-wide" aria-live="polite">
            <span className="live-value">API unreachable</span>
            <span className="live-label">GET /api/projects did not answer on this visit; the list above is the copy built into the page</span>
          </li>
        ) : (
          <>
            <li className="live-item" aria-live="polite">
              <span className="live-value">
                {timing ? (
                  <>
                    <Scramble text={String(timing.ms)} />
                    <span className="live-unit"> ms</span>
                  </>
                ) : (
                  <span aria-label="not measured yet">–</span>
                )}
              </span>
              <span className="live-label">for GET /api/projects to answer</span>
            </li>
            <li className="live-item">
              <span className="live-value">
                {timing ? <Scramble text={String(timing.count)} /> : <span aria-label="not measured yet">–</span>}
              </span>
              <span className="live-label">projects in that answer</span>
            </li>
          </>
        )}
        {build && (
          <li className="live-item">
            <span className="live-value">{build.commit}</span>
            <span className="live-label">the commit this page was built from, {build.date}</span>
          </li>
        )}
      </ul>
    </div>
  );
}
