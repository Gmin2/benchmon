import type { ReactNode } from "react";

// just enough markdown for model answers: code fences, inline code, bold, and line breaks. no html is
// ever injected, everything becomes react text nodes
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const t = m[0];
    out.push(
      t.startsWith("`") ? (
        <code key={`${key}-${i++}`} className="rounded bg-black/30 px-1 py-0.5 font-mono text-[0.92em]">
          {t.slice(1, -1)}
        </code>
      ) : (
        <strong key={`${key}-${i++}`} className="font-semibold text-ink">
          {t.slice(2, -2)}
        </strong>
      ),
    );
    last = m.index! + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Md({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(/```[a-zA-Z0-9]*\n?/);
  return (
    <div className={`min-w-0 max-w-full space-y-2 break-words ${className}`}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <pre key={i} className="max-w-full overflow-x-auto rounded-xl bg-black/35 p-3 font-mono text-[13px] leading-5 whitespace-pre">
            {p.replace(/\n$/, "")}
          </pre>
        ) : (
          p
            .split(/\n{2,}/)
            .filter((para) => para.trim())
            .map((para, j) => (
              <p key={`${i}-${j}`} className="whitespace-pre-wrap">
                {inline(para.replace(/^#+\s*/gm, ""), `${i}-${j}`)}
              </p>
            ))
        ),
      )}
    </div>
  );
}
