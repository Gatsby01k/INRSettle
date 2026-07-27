import { redirect } from "next/navigation";

export default function PilotReadinessRedirect() {
  redirect("/risk-review");
}
