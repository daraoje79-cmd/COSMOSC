import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadSignSchema } from "@/lib/validation/upload";
import { allow, uploadBurstLimit, uploadDailyLimit } from "@/lib/ratelimit";

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
};

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
  if (
    !profile ||
    profile.is_suspended ||
    (profile.role !== "creator" && profile.role !== "admin")
  ) {
    return fail(403, "forbidden", "Only creators can upload");
  }

  if (
    !(await allow(uploadBurstLimit, user.id)) ||
    !(await allow(uploadDailyLimit, user.id))
  ) {
    return fail(429, "rate_limited", "Too many uploads. Try again later.");
  }

  const body = await request.json().catch(() => null);
  const parsed = uploadSignSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      400,
      "invalid_upload",
      parsed.error.issues[0]?.message ?? "Invalid upload",
    );
  }
  const { kind, contentType, visibility } = parsed.data;

  const bucket = visibility === "public" ? "public" : "private";
  const path = `${user.id}/${crypto.randomUUID()}.${EXT[contentType]}`;

  const { data, error } = await createAdminClient()
    .storage.from(bucket)
    .createSignedUploadUrl(path);
  if (error || !data) {
    return fail(500, "sign_failed", "Could not prepare the upload");
  }

  return NextResponse.json({ bucket, path, token: data.token, kind });
}