// src/lib/useCurrentUserName.ts

import { authClient } from "@/lib/auth-client";

export function useCurrentUserName() {
  const { data: session } = authClient.useSession();
  const user = session?.user;

  return user?.name || user?.email?.split("@")[0] || "User";
}
