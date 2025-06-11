// src/lib/useCurrentUserName.ts

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function useCurrentUserName() {
  const [username, setUsername] = useState<string>("User");

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      const name =
        user?.user_metadata?.full_name ||
        user?.user_metadata?.username ||
        user?.email?.split("@")[0] ||
        "User";

      setUsername(name);
    };

    fetchUser();
  }, []);

  return username;
}
