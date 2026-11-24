import { createClient } from "@/lib/supabase/client";

export async function uploadPublicImage(
  userId: string,
  kind: "avatar" | "banner",
  blob: Blob,
) {
  const supabase = createClient();
  const path = `${userId}/${kind}-${Date.now()}.webp`;

  const { error } = await supabase.storage
    .from("public")
    .upload(path, blob, {
      contentType: "image/webp",
      cacheControl: "31536000",
    });
  if (error) throw error;

  return supabase.storage.from("public").getPublicUrl(path).data.publicUrl;
}