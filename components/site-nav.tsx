"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/study", label: "Study" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/library", label: "Word Library" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" }
];

export function SiteNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <header className="topNav">
      <div className="brand">
        <Link href="/">SAT Vocab Online</Link>
      </div>
      <nav className="navLinks">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={pathname === item.href ? "active" : ""}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="authBox">
        {session?.user ? (
          <>
            <span className="muted">{session.user.email}</span>
            <button
              className="button ghost"
              type="button"
              onClick={() => void signOut({ callbackUrl: "/" })}
            >
              Sign out
            </button>
          </>
        ) : (
          <button
            className="button"
            type="button"
            onClick={() => void signIn("google", { callbackUrl: "/study" })}
          >
            Sign in with Google
          </button>
        )}
      </div>
    </header>
  );
}
