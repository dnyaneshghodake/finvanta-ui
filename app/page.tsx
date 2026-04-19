/**
 * FINVANTA CBS -- root entry point.
 *
 * A Tier-1 core banking portal (Finacle, Temenos T24, Oracle Flexcube,
 * TCS BaNCS, BNP Paribas Core) has no public marketing landing and no
 * self-registration. Operator accounts (teller, maker, checker, admin,
 * auditor) are provisioned by the Admin -> User Management module
 * under maker-checker governance, per RBI Master Direction on IT
 * Governance 2023 s8. Letting an anonymous browser reach a feature
 * grid or a `Create Account` button would be a dark pattern and a
 * regulatory violation.
 *
 * The root URL therefore behaves exactly like Finacle / T24 / Flexcube
 * on cold entry: if the operator already holds a valid server-side
 * session (`fv_sid` cookie), forward to `/dashboard`; otherwise send
 * them to `/login`. This file renders no UI.
 */
import { redirect } from "next/navigation";
import { readSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export default async function Root(): Promise<never> {
  const session = await readSession();
  if (session) {
    redirect("/dashboard");
  }
  redirect("/login");
}
