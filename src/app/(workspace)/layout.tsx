import { ReactNode } from "react";
import { AppProviders } from "@/app/providers";
import { AppShell } from "@/widgets/app-shell";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <AppShell>{children}</AppShell>
    </AppProviders>
  );
}
