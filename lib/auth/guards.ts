import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";


export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, role, is_suspended")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  return { user, profile };
}

export async function requireUser() {
  const ctx = await getCurrentProfile();
  if (!ctx) redirect("/login");
  if (ctx.profile.is_suspended) redirect("/login");
  return ctx;
}

export async function requireCreator() {
  const ctx = await requireUser();
  if (ctx.profile.role !== "creator" && ctx.profile.role !== "admin") {
    redirect("/feed");
  }
  return ctx;
}

export async function requireAdmin() {
  const ctx = await requireUser();
  if (ctx.profile.role !== "admin") redirect("/feed");
  return ctx;
}