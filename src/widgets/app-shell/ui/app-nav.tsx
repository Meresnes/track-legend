"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/upload", label: "Upload" },
  { href: "/sessions", label: "Sessions" },
  { href: "/compare", label: "Compare" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/sessions") return pathname.startsWith("/sessions");
  return pathname === href;
}

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-2">
      {navItems.map((item) => {
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md border px-3 py-1.5 text-sm transition ${
              active
                ? "border-[var(--tl-accent-secondary)] bg-[rgba(18,52,69,0.85)] text-[var(--tl-text-primary)]"
                : "border-[var(--tl-border-subtle)] bg-[var(--tl-bg-elev-2)] text-[var(--tl-text-secondary)] hover:border-[var(--tl-border-strong)] hover:text-[var(--tl-text-primary)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
