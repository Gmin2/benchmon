export default function Tag({ children, solid }: { children: string; solid?: boolean }) {
  return solid ? (
    <span className="w-min bg-primary px-2 text-sm whitespace-nowrap text-black uppercase">{children}</span>
  ) : (
    <span className="w-min border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs whitespace-nowrap text-primary uppercase">{children}</span>
  );
}
