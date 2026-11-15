import type { Peek } from "virtual:code-peeks";

interface CodePeekProps {
  id: string;
  peek: Peek;
}

/**
 * The real source lines behind a pipeline step, as of this build
 * (frontend/build/repoFacts.ts), with line numbers. A region labelled with
 * the file and lines.
 */
export function CodePeek({ id, peek }: CodePeekProps) {
  const end = peek.start + peek.lines.length - 1;
  return (
    <div className="code-peek" id={id} role="region" aria-label={`${peek.file}, lines ${peek.start} to ${end}`}>
      <p className="code-peek-head mono">
        <span className="code-peek-file">{peek.file}</span>
        <span className="code-peek-lines">
          {peek.start}–{end}
        </span>
      </p>
      <pre className="code-peek-body">
        <code>
          {peek.lines.map((line, i) => (
            <span className="code-line" key={i}>
              <span className="code-num" aria-hidden="true">
                {peek.start + i}
              </span>
              {line.map(([kind, text], k) =>
                kind === "txt" ? text : (
                  <span className={`tok-${kind}`} key={k}>
                    {text}
                  </span>
                ),
              )}
              {"\n"}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
