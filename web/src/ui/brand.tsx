export function Logo({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <span className={`grid place-items-center rounded-full bg-neon text-bg ${className}`}>
      <span className="font-display text-[22px] leading-none">B</span>
    </span>
  );
}
