"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Bell, PlusSquare, LayoutDashboard, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/feed", label: "Feed", icon: Home },
  { href: "/notifications", label: "Alerts", icon: Bell },
  { href: "/compose", label: "Create", icon: PlusSquare },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/settings/profile", label: "Profile", icon: User },
];

export function AppNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col gap-1 border-r border-border bg-card p-4 md:flex">
        <Link
          href="/"
          className="mb-6 px-3 text-xl font-bold tracking-tight text-brand"
        >
          COSMOSC
        </Link>
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
              isActive(href) ? "bg-muted text-brand" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
      </aside>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-xs",
              isActive(href) ? "text-brand" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}