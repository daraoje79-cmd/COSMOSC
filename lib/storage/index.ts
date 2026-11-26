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

export type UploadSlot = {
  bucket: "public" | "private";
  path: string;
  token: string;
  signedUrl: string;
};

export async function requestUploadSlot(input: {
  kind: "image" | "video";
  contentType: string;
  size: number;
  visibility: "public" | "subscribers" | "paid";
}): Promise<UploadSlot> {
  const res = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error?.message ?? "Could not prepare the upload");
  }
  return data;
}

export function putWithProgress(
  signedUrl: string,
  blob: Blob,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () =>
      reject(new Error("Network error. Check your connection and retry."));
    const form = new FormData();
    form.append("cacheControl", "31536000");
    form.append("", blob);
    xhr.send(form);
  });
}