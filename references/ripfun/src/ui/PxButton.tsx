import type { ReactNode } from "react";

export default function PxButton({ children, dark, wide, onClick }: { children: ReactNode; dark?: boolean; wide?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`pxwrap ${dark ? "dark" : ""} flex cursor-pointer px-1 font-display whitespace-nowrap ${wide ? "w-full" : "w-min"}`}>
      <span className="pxbtn flex w-full items-center justify-center gap-2.5 px-5 text-base">
        <span className="text-shadow">{children}</span>
      </span>
    </button>
  );
}
