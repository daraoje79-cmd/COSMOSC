import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { EditProfileForm } from "@/components/profile/edit-profile-form";
import { LogoutButton } from "@/components/layout/logout-button";

export default async function EditProfilePage() {
  const { profile: me } = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, category, avatar_url, banner_url, links")
    .eq("id", me.id)
    .single();

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edit profile</h1>
        <Link href={`/@${data.username}`} className="text-sm text-brand">
          View public profile
        </Link>
      </div>
      <EditProfileForm
        profile={{
          ...data,
          links: Array.isArray(data.links) ? data.links : [],
        }}
      />
      <div className="md:hidden">
        <LogoutButton />
      </div>
    </div>
  );
}