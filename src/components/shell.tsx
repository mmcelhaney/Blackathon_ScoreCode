import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";

export function HeaderBar({ rightSlot }: { rightSlot?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 flex w-full items-center justify-between gap-4 border-b border-line bg-ink/80 px-5 py-3 backdrop-blur">
      <Link
        href="/"
        className="group flex items-center gap-3 text-bone transition hover:opacity-90"
        aria-label="BlackWPT — Home"
      >
        <Image
          src="/bwpt-map.png"
          alt=""
          width={1151}
          height={1383}
          priority
          className="h-8 w-auto drop-shadow-[0_0_10px_rgba(245,197,24,.25)] md:h-9"
        />
        <Image
          src="/blackwpt_text_final.png"
          alt="BlackWPT"
          width={700}
          height={83}
          priority
          className="h-3 w-auto md:h-4"
        />
      </Link>
      <nav className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-wider">
        {rightSlot}
      </nav>
    </header>
  );
}

export function PageShell({
  children,
  maxWidth = "max-w-5xl",
}: {
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className={`mx-auto w-full ${maxWidth} px-5 py-8 md:py-12`}>
      {children}
    </div>
  );
}

export function Breadcrumbs({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-5 flex flex-wrap items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-dust"
    >
      {items.map((it, i) => {
        const isLast = i === items.length - 1;
        return (
          <div key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-line">›</span>}
            {it.href && !isLast ? (
              <Link
                href={it.href}
                className="transition hover:text-gold"
              >
                {it.label}
              </Link>
            ) : (
              <span className={isLast ? "text-bone" : ""}>{it.label}</span>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6 animate-fade-up">
      {eyebrow && (
        <div className="mb-2 font-cond text-[0.7rem] uppercase tracking-[0.3em] text-gold">
          {eyebrow}
        </div>
      )}
      <h1 className="hex-title text-4xl md:text-5xl">{title}</h1>
      {subtitle && <p className="mt-3 max-w-2xl text-dust">{subtitle}</p>}
      <div className="mt-4 h-[2px] w-28 rounded bg-gradient-to-r from-blood via-gold to-jade opacity-70" />
    </div>
  );
}
