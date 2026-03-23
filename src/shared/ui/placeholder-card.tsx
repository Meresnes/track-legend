import { ReactNode } from "react";

type PlaceholderCardProps = {
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
};

export function PlaceholderCard({
  title,
  description,
  children,
  className = "",
}: PlaceholderCardProps) {
  return (
    <section
      className={`rounded-xl border border-[var(--tl-border-subtle)] bg-[var(--tl-bg-elev-2)] p-4 ${className}`}
    >
      <h2 className="text-sm font-semibold text-[var(--tl-text-primary)]">{title}</h2>
      <p className="mt-1 text-xs text-[var(--tl-text-secondary)]">{description}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
