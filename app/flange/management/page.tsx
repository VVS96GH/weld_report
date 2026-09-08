import { redirect } from "next/navigation";

/** The management matrix lives on the flange dashboard itself (owner ruling 2026-09-08). */
export default async function FlangeManagementAlias(props: PageProps<"/flange/management">) {
  const params = await props.searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (value) qs.set(k, value);
  }
  const query = qs.toString();
  redirect(`/flange${query ? `?${query}` : ""}#management`);
}
