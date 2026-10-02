// the mon's head, for the rail, small headers and loaders
export function Logo({ className = "h-12 w-12" }: { className?: string }) {
  return <img src="/brand/mon.svg" alt="benchmon" className={`pixel object-contain ${className}`} draggable={false} />;
}

// the full logo: the word with the mon peeking over it
export function Wordmark({ className = "h-12" }: { className?: string }) {
  return <img src="/brand/logo.svg" alt="benchmon" className={`w-auto ${className}`} draggable={false} />;
}
