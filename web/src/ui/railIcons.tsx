// filled, rounded nav icons drawn for benchmon. the body takes currentColor,
// the details are cut out in --cut so they read on any tile colour
export type RailIconName = "home" | "decks" | "play" | "watch" | "ranks" | "settings";

const cut = "var(--cut, #16171a)";

const ICONS: Record<RailIconName, React.ReactNode> = {
  home: (
    <>
      <path d="M10.6 2.9a2.2 2.2 0 0 1 2.8 0l7.9 6.6c1.1.9.5 2.7-.9 2.7H19v7.3a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 19.5v-7.3h-1.4c-1.4 0-2-1.8-.9-2.7l7.9-6.6Z" fill="currentColor" />
      <rect x="9.6" y="14.2" width="4.8" height="7.8" rx="2.4" fill={cut} />
      <circle cx="12" cy="9.4" r="1.5" fill={cut} />
    </>
  ),
  decks: (
    <>
      <rect x="3.2" y="4.6" width="11.5" height="15.5" rx="2.6" transform="rotate(-12 9 12.4)" fill="currentColor" opacity=".45" />
      <rect x="8.4" y="3.2" width="12.4" height="17.6" rx="2.8" fill="currentColor" />
      <path d="m14.6 7.6 1.3 2.7 2.9.4-2.1 2 .5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2 2.9-.4 1.3-2.7Z" fill={cut} />
    </>
  ),
  play: (
    <>
      <path d="M7.2 6.2h9.6c2.6 0 4.6 1.9 5 4.4l.9 6.2c.3 2.1-1.3 4-3.4 4-1.1 0-2.1-.6-2.7-1.5l-1.4-2.1H8.8l-1.4 2.1c-.6.9-1.6 1.5-2.7 1.5-2.1 0-3.7-1.9-3.4-4l.9-6.2c.4-2.5 2.4-4.4 5-4.4Z" fill="currentColor" />
      <rect x="6.6" y="9.4" width="1.9" height="5.6" rx=".95" fill={cut} />
      <rect x="4.75" y="11.25" width="5.6" height="1.9" rx=".95" fill={cut} />
      <circle cx="16.4" cy="10.6" r="1.25" fill={cut} />
      <circle cx="18.6" cy="12.8" r="1.25" fill={cut} />
      <circle cx="16.4" cy="14.9" r="1.25" fill={cut} />
    </>
  ),
  watch: (
    <>
      <path d="M8.2 2.6 12 6.2l3.8-3.6" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="2" y="5.6" width="20" height="14.6" rx="3.6" fill="currentColor" />
      <path d="M10.2 9.5c0-.8.9-1.3 1.6-.9l4 2.4c.7.4.7 1.4 0 1.8l-4 2.4c-.7.4-1.6-.1-1.6-.9V9.5Z" fill={cut} />
      <rect x="6.5" y="20.2" width="11" height="1.9" rx=".95" fill="currentColor" opacity=".55" />
    </>
  ),
  ranks: (
    <>
      <path d="M6.4 3h11.2c.6 0 1.1.5 1.1 1.1v1.2h1.6c1.2 0 2.1 1.1 1.8 2.3-.6 2.6-2.6 4.6-5 5.2-.9 1.5-2.4 2.6-4.1 2.9v2.1h2.3c1.1 0 2 .9 2 2V21H6.7v-1.2c0-1.1.9-2 2-2H11v-2.1c-1.7-.3-3.2-1.4-4.1-2.9-2.4-.6-4.4-2.6-5-5.2-.3-1.2.6-2.3 1.8-2.3h1.6V4.1c0-.6.5-1.1 1.1-1.1Z" fill="currentColor" />
      <path d="m12 5.9.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3.9-1.9Z" fill={cut} />
    </>
  ),
  settings: (
    <>
      <path d="M10.3 2.6c.4-.9 1.2-1.1 1.7-1.1s1.3.2 1.7 1.1l.6 1.3c.2.4.7.6 1.2.5l1.4-.4c1-.3 1.6.2 2 .6.4.4.9 1 .6 2l-.4 1.4c-.1.5.1 1 .5 1.2l1.3.6c.9.4 1.1 1.2 1.1 1.7s-.2 1.3-1.1 1.7l-1.3.6c-.4.2-.6.7-.5 1.2l.4 1.4c.3 1-.2 1.6-.6 2-.4.4-1 .9-2 .6l-1.4-.4c-.5-.1-1 .1-1.2.5l-.6 1.3c-.4.9-1.2 1.1-1.7 1.1s-1.3-.2-1.7-1.1l-.6-1.3c-.2-.4-.7-.6-1.2-.5l-1.4.4c-1 .3-1.6-.2-2-.6-.4-.4-.9-1-.6-2l.4-1.4c.1-.5-.1-1-.5-1.2l-1.3-.6c-.9-.4-1.1-1.2-1.1-1.7s.2-1.3 1.1-1.7l1.3-.6c.4-.2.6-.7.5-1.2l-.4-1.4c-.3-1 .2-1.6.6-2 .4-.4 1-.9 2-.6l1.4.4c.5.1 1-.1 1.2-.5l.6-1.3Z" fill="currentColor" />
      <circle cx="12" cy="12" r="3.4" fill={cut} />
    </>
  ),
};

export function RailIcon({ name, className = "h-6 w-6", cutColor }: { name: RailIconName; className?: string; cutColor?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={cutColor ? ({ "--cut": cutColor } as React.CSSProperties) : undefined} aria-hidden>
      {ICONS[name]}
    </svg>
  );
}
