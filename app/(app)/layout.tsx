import { AppNav } from "@/components/layout/app-nav";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen md:pl-60">
      <AppNav />
      <main className="mx-auto max-w-2xl px-4 py-6 pb-24 md:pb-6">
        {children}
      </main>
    </div>
  );
}