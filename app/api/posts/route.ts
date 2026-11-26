import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPostSchema } from "@/lib/validation/post";
import { allow, postLimit } from "@/lib/ratelimit";

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(401, "unauthorized", "Please log in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_suspended")
    .eq("id", user.id)
    .single();
  if (!profile || profile.is_suspended || profile.role !== "creator") {
    return fail(403, "forbidden", "Only creators can post");
  }

  if (!(await allow(postLimit, user.id))) {
    return fail(429, "rate_limited", "Too many posts. Try again shortly.");
  }

  const body = await request.json().catch(() => null);
  const parsed = createPostSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, "invalid_post", parsed.error.issues[0]?.message ?? "Invalid post");
  }
  const v = parsed.data;

  // Media must live in the creator's own folder
  if (v.media.some((m) => !m.path.startsWith(`${user.id}/`))) {
    return fail(400, "invalid_media", "Invalid media");
  }

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      author_id: user.id,
      teaser: v.visibility === "public" ? "" : v.teaser,
      visibility: v.visibility,
      price_kobo: v.visibility === "paid" ? v.priceKobo : null,
      category: v.category || null,
    })
    .select("id")
    .single();
  if (error || !post) return fail(500, "create_failed", "Could not create the post");

  const { error: contentError } = await supabase
    .from("post_content")
    .insert({ post_id: post.id, body: v.body });

  const { error: mediaError } = v.media.length
    ? await supabase.from("post_media").insert(
        v.media.map((m, i) => ({
          post_id: post.id,
          kind: m.kind,
          bucket: m.bucket,
          storage_key: m.path,
          width: m.width,
          height: m.height,
          duration_s: m.durationS,
          size_bytes: m.sizeBytes,
          position: i,
        })),
      )
    : { error: null };

  if (contentError || mediaError) {
    await supabase.from("posts").update({ status: "deleted" }).eq("id", post.id);
    return fail(500, "create_failed", "Could not save the post");
  }

  return NextResponse.json({ id: post.id }, { status: 201 });
}
