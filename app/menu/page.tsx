import { requireUser } from "@/lib/auth/require-user";
import { MenuClient } from "./menu-client";

// Auth-gated server component. Redirect to /login if unauthenticated.
export default async function MenuPage() {
  await requireUser();
  return <MenuClient />;
}
