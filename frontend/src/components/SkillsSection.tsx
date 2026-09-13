import { useMemo, useState } from "react";
import { SkillsGraph } from "./SkillsGraph";
import { Reveal } from "./Reveal";
import { CATEGORIES, CATEGORY_BY_ID, SKILLS } from "../skills";
import type { Category, CategoryId, Skill } from "../skills";

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
      <p className="skill-detail-evidence">
        <span>Proven in</span>
        <code>{skill.evidence}</code>
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
function DomainCard({ category, selected, onSelect, onHover }: DomainCardProps) {
  const skills = useMemo(
    () => SKILLS.filter((s) => s.category === category.id),
    [category.id]
  );
  const average = skills.reduce((a, s) => a + s.level, 0) / skills.length;

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
        {skills.map((s) => (
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
    <section className="section skills-section" id="skills" aria-labelledby="skills-heading">
      <div className="container">
        <Reveal>
          <p className="kicker">The stack, as a system</p>
          <h2 className="section-title" id="skills-heading">
            {SKILLS.length} technologies, one nervous system
          </h2>
          <p className="section-subtitle section-subtitle-wide">
            A flat list tells you what someone has touched, not how it holds together. Drag the
            map. Click any node.
          </p>
        </Reveal>

        <Reveal delay={60}>
          <div className="skills-stats">
            <div className="skills-stat">
              <span className="skills-stat-value">{SKILLS.length}</span>
              <span className="skills-stat-label">technologies mapped</span>
            </div>
            <div className="skills-stat">
              <span className="skills-stat-value">{CATEGORIES.length}</span>
              <span className="skills-stat-label">connected domains</span>
            </div>
            <div className="skills-stat">
              <span className="skills-stat-value">{avgLevel}</span>
              <span className="skills-stat-label">average depth, out of 5</span>
            </div>
            <div className="skills-stat">
              <span className="skills-stat-value">2</span>
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

          <aside className="skills-aside">
            <SkillDetail skill={shownSkill} />
            {selected && (
              <button type="button" className="btn btn-ghost" onClick={() => setSelected(null)}>
                Clear selection
              </button>
            )}
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
