import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ username: string }> };

const getProfile = cache(async (username: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, bio, avatar_url, banner_url, category, links, role, is_suspended, follower_count, following_count",
    )
    .eq("username", username.toLowerCase())
    .maybeSingle();
  if (!data || data.is_suspended) return null;
  return data;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) return { title: "Not found | COSMOSC" };

  const title = `${profile.display_name} (@${profile.username}) | COSMOSC`;
  const description =
    profile.bio || `Follow and support ${profile.display_name} on COSMOSC.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/@${profile.username}`,
      type: "profile",
      images: profile.avatar_url ? [profile.avatar_url] : [],
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function CreatorProfilePage({ params }: Props) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) notFound();

  const links: { label: string; url: string }[] = Array.isArray(profile.links)
    ? profile.links
    : [];

  return (
    <div className="-mx-4 -mt-6 md:mx-0 md:mt-0">
      <div
        className="h-32 bg-muted bg-cover bg-center md:rounded-xl"
        style={
          profile.banner_url
            ? { backgroundImage: `url(${profile.banner_url})` }
            : undefined
        }
      />

      <div className="px-4 md:px-0">
        <div
          className="-mt-10 flex size-20 items-center justify-center rounded-full border-4 border-background bg-card bg-cover bg-center text-2xl font-bold text-brand"
          style={
            profile.avatar_url
              ? { backgroundImage: `url(${profile.avatar_url})` }
              : undefined
          }
        >
          {!profile.avatar_url && profile.display_name.charAt(0).toUpperCase()}
        </div>

        <h1 className="mt-3 text-2xl font-bold">{profile.display_name}</h1>
        <p className="text-muted-foreground">@{profile.username}</p>

        {profile.category && (
          <span className="mt-2 inline-block rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            {profile.category}
          </span>
        )}

        {profile.bio && <p className="mt-3 whitespace-pre-line">{profile.bio}</p>}

        {links.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-3 text-sm">
            {links.map((l) => (
              <li key={l.url}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-brand hover:underline"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex gap-6 text-sm">
          <span>
            <strong>{profile.follower_count}</strong>{" "}
            <span className="text-muted-foreground">Followers</span>
          </span>
          <span>
            <strong>{profile.following_count}</strong>{" "}
            <span className="text-muted-foreground">Following</span>
          </span>
        </div>

        <div className="mt-8 rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          Posts will appear here.
        </div>
      </div>
    </div>
  );
}