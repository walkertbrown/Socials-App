import { redirect } from "next/navigation";

// The app's home is the board. The proxy bounces logged-out users to /login.
export default function Home() {
  redirect("/board");
}
