// src/components/MobileSidebar.tsx

"use client";

import { Dispatch, SetStateAction, useEffect } from "react";
import { X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { SideBarItem } from "@/components/SideBarItem";
import { UserItem } from "@/components/UserItem";
import { useCurrentUserName } from "@/lib/useCurrentUserName";
import { signOut } from "@/lib/auth-client";
import { navItems } from "@/components/nav";
import { NesteryMark } from "@/components/brand/NatureShapes";

export function MobileSidebar({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const username = useCurrentUserName();

  // Close after any navigation, including links inside the user menu
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => setOpen(false)}
      />

      <aside className="fixed inset-y-0 left-0 z-50 w-full max-w-xs bg-sidebar text-sidebar-foreground flex flex-col">

        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          <span className="flex items-center gap-2">
            <NesteryMark className="size-6" />
            <span className="text-xl font-bold">Nestery</span>
          </span>
          <button
            onClick={() => setOpen(false)}
            className="p-2 text-muted-foreground"
            aria-label="Close menu"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 overflow-auto space-y-1 p-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname.startsWith(href);
            return (
              <SideBarItem
                key={href}
                icon={Icon}
                label={label}
                href={href}
                collapsed={false}
                isActive={isActive}
                onClick={() => setOpen(false)}
              />
            );
          })}
        </nav>

        <div className="p-2 border-t space-y-1 border-sidebar-border">
          <UserItem
            name={username || "User"}
            collapsed={false}
            onLogout={async () => {
              await signOut();
              setOpen(false);
              router.push("/");
            }}
          />
        </div>
      </aside>
    </>
  );
}
