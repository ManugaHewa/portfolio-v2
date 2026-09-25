import { useMemo, useState } from "react";
import { SkillsGraph } from "./SkillsGraph";
import { Reveal } from "./Reveal";
import { SectionHead } from "./SectionHead";

import { CountUp } from "./CountUp";
import { CATEGORIES, CATEGORY_BY_ID, SKILLS } from "../skills";
import type { Category, CategoryId, Skill } from "../skills";
import { Scene } from "./Scene";

const ALL_CATEGORIES = new Set<CategoryId>(CATEGORIES.map((c) => c.id));

function LevelMeter({ level }: { level: number }) {
  return (
    <span className="level-meter" role="img" aria-label={`Depth ${level} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`level-pip${i <= level ? " is-on" : ""}`} />
      ))}
    </span>
  );
}

/** The panel beside the graph: whatever is hovered, else whatever is selected. */
function SkillDetail({ skill }: { skill: Skill | null }) {
  if (!skill) {
    return (
      <div className="skill-detail is-empty">
        <h3>Inspect the map</h3>
        <p>Hover a node to preview it. Click to pin it.</p>
        <p className="skill-detail-hint">
          Dense lobes are deep domains. The faint lines between them are where those domains
          meet in the code.
        </p>
      </div>
    );
  }

  const cat = CATEGORY_BY_ID[skill.category];
  return (
    <div className="skill-detail" style={{ ["--cat" as string]: cat.color }}>
      <div className="skill-detail-top">
        <span className="skill-detail-cat">{cat.label}</span>
        <LevelMeter level={skill.level} />
      </div>
      <h3>{skill.name}</h3>
      <p>{skill.blurb}</p>
      {/* Was a <code> element back when this held a file path. A project
          name set in monospace reads as a filename, which is exactly the
          confusion this change was meant to remove. */}
      <p className="skill-detail-evidence">
        <span>Proven in</span>
        <strong>{skill.evidence}</strong>
      </p>
    </div>
  );
}

interface DomainCardProps {
  category: Category;
  selected: string | null;
  onSelect: (name: string | null) => void;
  onHover: (name: string | null) => void;
}

/**
 * Deliberately light on prose. The count, the depth bar and the pills carry
 * the comparison between one domain and the next, so the only sentence on the
 * card is the tagline.
 */
// Domains hold between 5 and 11 skills, so at full length the tallest card
// ran 2.2x the shortest and the row looked accidental. Six is the number that
// flattens the grid (every domain becomes 6, bar one at 5) while still showing
// most of a domain up front; the rest are one click away.
const VISIBLE_SKILLS = 6;

function DomainCard({ category, selected, onSelect, onHover }: DomainCardProps) {
  const [expanded, setExpanded] = useState(false);
  const skills = useMemo(
    () => SKILLS.filter((s) => s.category === category.id),
    [category.id]
  );
  const average = skills.reduce((a, s) => a + s.level, 0) / skills.length;
  const hidden = skills.length - VISIBLE_SKILLS;
  const shownSkills = expanded ? skills : skills.slice(0, VISIBLE_SKILLS);

  return (
    <article className="domain-card" style={{ ["--cat" as string]: category.color }}>
      <header className="domain-head">
        <span className="domain-dot" />
        <h4>{category.label}</h4>
        <span className="domain-count">{skills.length}</span>
      </header>

      <p className="domain-tagline">{category.tagline}</p>

      <div className="domain-meter-row">
        <div
          className="domain-meter"
          role="img"
          aria-label={`Average depth ${average.toFixed(1)} out of 5`}
        >
          <span className="domain-meter-fill" style={{ width: `${(average / 5) * 100}%` }} />
        </div>
        <span className="domain-meter-value">{average.toFixed(1)}</span>
      </div>

      <ul className="domain-skills">
        {shownSkills.map((s) => (
          <li key={s.name}>
            <button
              type="button"
              className={`skill-pill${selected === s.name ? " is-selected" : ""}`}
              aria-pressed={selected === s.name}
              onClick={() => onSelect(selected === s.name ? null : s.name)}
              onMouseEnter={() => onHover(s.name)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(s.name)}
              onBlur={() => onHover(null)}
            >
              {s.name}
              <LevelMeter level={s.level} />
            </button>
          </li>
        ))}
      </ul>

      {hidden > 0 && (
        <button
          type="button"
          className="domain-more"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show fewer" : `Show ${hidden} more`}
        </button>
      )}
    </article>
  );
}

export function SkillsSection() {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [active, setActive] = useState<Set<CategoryId>>(ALL_CATEGORIES);

  const shown = hovered ?? selected;
  const shownSkill = useMemo(() => SKILLS.find((s) => s.name === shown) ?? null, [shown]);

  const toggleCategory = (id: CategoryId) => {
    setActive((prev) => {
      // Clicking the only enabled category re-enables everything, so the
      // filter can't strand the user on an empty graph with no way back.
      if (prev.size === 1 && prev.has(id)) return new Set(ALL_CATEGORIES);
      // Clicking a category while everything is on isolates it, which is the
      // gesture people expect from a legend.
      if (prev.size === ALL_CATEGORIES.size) return new Set([id]);
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next.size === 0 ? new Set(ALL_CATEGORIES) : next;
    });
  };

  const avgLevel = useMemo(
    () => (SKILLS.reduce((a, s) => a + s.level, 0) / SKILLS.length).toFixed(1),
    []
  );

  return (
    <section className="section skills-section has-scene" id="skills" aria-labelledby="skills-heading">
      <Scene variant="globe" className="scene-globe" />
      <div className="container">
        <SectionHead
          index="02"
          kicker="The stack, as a system"
          title={`${SKILLS.length} technologies, one nervous system`}
          id="skills-heading"
          note="Angle is domain. Distance from the centre is depth."
        />

        <Reveal delay={60}>
          <div className="skills-stats">
            <div className="skills-stat">
              <CountUp className="skills-stat-value" value={SKILLS.length} />
              <span className="skills-stat-label">technologies mapped</span>
            </div>
            <div className="skills-stat">
              <CountUp className="skills-stat-value" value={CATEGORIES.length} />
              <span className="skills-stat-label">connected domains</span>
            </div>
            <div className="skills-stat">
              <CountUp className="skills-stat-value" value={Number(avgLevel)} decimals={1} />
              <span className="skills-stat-label">average depth, out of 5</span>
            </div>
            <div className="skills-stat">
              <CountUp className="skills-stat-value" value={2} />
              <span className="skills-stat-label">workspaces, one language</span>
            </div>
          </div>
        </Reveal>
      </div>

      <div className="skills-stage">
        <div className="skills-stage-grid">
          <div className="skills-canvas-wrap">
            <SkillsGraph
              selected={selected}
              onSelect={setSelected}
              onHover={setHovered}
              active={active}
            />

            {/* The hint used to float inside the scope at its top-left. Once
                the window was pulled in toward square the rim labels reached
                that corner, so it sat on top of them. It reads fine as a
                caption under the scope and leaves the display clean. */}
            <p className="skills-hint">
              <strong>Closer to the centre</strong> means deeper. Point at any dot.
            </p>

          </div>

          {/* The legend used to sit under the scope, where seven chips wrapped
              onto three rows and pushed the map up the page. In the aside it
              fills the column the detail panel was leaving half empty, and
              the scope gets the width back. */}
          <aside className="skills-aside">
            <SkillDetail skill={shownSkill} />
            {selected && (
              <button type="button" className="btn btn-ghost" onClick={() => setSelected(null)}>
                Clear selection
              </button>
            )}

            <div className="skills-filter">
              <h4 className="skills-filter-title">Filter by domain</h4>
              <div className="skills-legend" role="group" aria-label="Filter skills by domain">
                {CATEGORIES.map((c) => {
                  const on = active.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`legend-chip${on ? " is-on" : ""}`}
                      style={{ ["--cat" as string]: c.color }}
                      aria-pressed={on}
                      onClick={() => toggleCategory(c.id)}
                    >
                      <span className="legend-dot" />
                      {c.short}
                      <span className="legend-count">
                        {SKILLS.filter((s) => s.category === c.id).length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <div className="container">
        <Reveal delay={40}>
          <div className="skills-breakdown-head">
            <h3 className="skills-breakdown-title">All {CATEGORIES.length} domains</h3>
            <p className="skills-breakdown-note">Select any technology to light it up above.</p>
          </div>
        </Reveal>

        <div className="skills-breakdown">
          {CATEGORIES.map((c, i) => (
            <Reveal key={c.id} delay={i * 60}>
              <DomainCard
                category={c}
                selected={selected}
                onSelect={setSelected}
                onHover={setHovered}
              />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
