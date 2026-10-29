import { createClient } from "@supabase/supabase-js";
import { api } from "@bangkago/shared";
export const configured = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "https://unconfigured.invalid",
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "unconfigured",
  { auth: { flowType: "pkce" } },
);
export const backend = api(supabase);
