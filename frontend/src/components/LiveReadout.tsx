import { Scramble } from "../motion";
import { useProjectsTiming } from "../lib/liveStats";

/**
 * Real numbers about the system above: this visit's GET /api/projects time
 * and project count (lib/liveStats.ts; a dash until known, words if it
 * failed), and the build's commit and date (vite.config.ts; omitted without
 * git). Measured values decode in (Scramble).
 */
export function LiveReadout({ build = __BUILD__ }: { build?: typeof __BUILD__ }) {
  const timing = useProjectsTiming();

  return (
    <div className="live-readout">
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
