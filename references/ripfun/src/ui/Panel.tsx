import type { ReactNode } from "react";

export default function Panel({ title, icon, children, className = "" }: { title?: string; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-[4px] border-t-2 border-primary bg-background ${className}`}>
      {title && (
        <div className="flex items-center gap-2 border-b border-line px-3 py-3 font-display text-base">
          {icon}
          {title}
        </div>
      )}
      {children}
    </section>
  );
}
