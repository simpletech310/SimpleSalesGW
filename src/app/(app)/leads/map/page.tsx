import { redirect } from "next/navigation";

/**
 * v2.23.1 — Map merged onto /leads (top section). This route stays
 * as a redirect so old links / bookmarks / nav-history still land
 * somewhere useful.
 */
export default function LeadsMapRedirect() {
  redirect("/leads");
}
