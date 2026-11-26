"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { resizeImage } from "@/lib/image";
import { putWithProgress, requestUploadSlot } from "@/lib/storage";
import {
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
} from "@/lib/validation/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DRAFT_KEY = "cosmosc:draft";
const CATEGORIES = [
  "Music",
  "Comedy",
  "Fashion",
  "Sports",
  "News",
  "Culture & Lifestyle",
  "Podcasts",
  "Movies",
  "Other",
];

type FormValues = {
  body: string;
  teaser: string;
  visibility: "public" | "subscribers" | "paid";
  priceNaira: string;
  category: string;
};

const DEFAULTS: FormValues = {
  body: "",
  teaser: "",
  visibility: "public",
  priceNaira: "",
  category: "",
};

type Item = {
  id: string;
  kind: "image" | "video";
  blob: Blob;
  contentType: string;
  previewUrl: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  progress: number;
  status: "ready" | "uploading" | "done" | "error";
  uploaded?: { bucket: "public" | "private"; path: string };
  error?: string;
};

function readVideo(file: File) {
  return new Promise<{ duration: number; width: number; height: number }>(
    (resolve, reject) => {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        resolve({
          duration: v.duration,
          width: v.videoWidth,
          height: v.videoHeight,
        });
        URL.revokeObjectURL(url);
      };
      v.onerror = () => {
        reject(new Error("Could not read this video"));
        URL.revokeObjectURL(url);
      };
      v.src = url;
    },
  );
}

export function Composer({ username }: { username: string }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  const { register, handleSubmit, reset, watch, control } =
    useForm<FormValues>({ defaultValues: DEFAULTS });
  const visibility = useWatch({ control, name: "visibility" });

  // Restore the saved draft once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) reset({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      // ignore broken drafts
    }
  }, [reset]);

  // Save the draft locally as the creator types
  useEffect(() => {
    const sub = watch((values) => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
      } catch {
        // storage may be unavailable
      }
    });
    return () => sub.unsubscribe();
  }, [watch]);

  function patch(id: string, changes: Partial<Item>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)));
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const next = [...items];

    for (const file of files) {
      const isVideo = file.type === "video/mp4";
      const isImage = (IMAGE_TYPES as readonly string[]).includes(file.type);
      if (!isVideo && !isImage) {
        toast.error(`${file.name}: use JPEG, PNG, WebP or MP4`);
        continue;
      }
      const hasVideo = next.some((i) => i.kind === "video");

      try {
        if (isVideo) {
          if (next.length > 0) {
            toast.error("A video post can't have other media");
            continue;
          }
          if (file.size > MAX_VIDEO_BYTES) {
            toast.error("Video must be under 50 MB");
            continue;
          }
          const info = await readVideo(file);
          if (info.duration > 180) {
            toast.error("Video must be 3 minutes or shorter");
            continue;
          }
          next.push({
            id: crypto.randomUUID(),
            kind: "video",
            blob: file,
            contentType: "video/mp4",
            previewUrl: URL.createObjectURL(file),
            width: info.width,
            height: info.height,
            duration: info.duration,
            progress: 0,
            status: "ready",
          });
        } else {
          if (hasVideo) {
            toast.error("A video post can't have images");
            continue;
          }
          if (next.length >= 4) {
            toast.error("You can add up to 4 images");
            continue;
          }
          if (file.size > MAX_IMAGE_BYTES) {
            toast.error(`${file.name} is over 8 MB`);
            continue;
          }
          const blob = await resizeImage(file);
          const bmp = await createImageBitmap(blob);
          next.push({
            id: crypto.randomUUID(),
            kind: "image",
            blob,
            contentType: "image/webp",
            previewUrl: URL.createObjectURL(blob),
            width: bmp.width,
            height: bmp.height,
            duration: null,
            progress: 0,
            status: "ready",
          });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not add file");
      }
    }
    setItems(next);
  }

  async function onSubmit(v: FormValues) {
    if (publishing) return;
    const body = v.body.trim();
    if (!body && items.length === 0) {
      toast.error("Write something or add media");
      return;
    }

    let priceKobo: number | null = null;
    if (v.visibility === "paid") {
      const naira = Number(v.priceNaira);
      if (!Number.isInteger(naira) || naira < 100) {
        toast.error("Price must be a whole number of at least ₦100");
        return;
      }
      priceKobo = naira * 100;
    }

    setPublishing(true);
    setHasFailed(false);
    const bucket = v.visibility === "public" ? "public" : "private";

    try {
      const media = [];
      for (const item of items) {
        let up = item.uploaded;
        // Upload new files, and re-upload if the visibility (bucket) changed
        if (!up || up.bucket !== bucket) {
          patch(item.id, { status: "uploading", progress: 0, error: undefined });
          try {
            const slot = await requestUploadSlot({
              kind: item.kind,
              contentType: item.contentType,
              size: item.blob.size,
              visibility: v.visibility,
            });
            await putWithProgress(slot.signedUrl, item.blob, (p) =>
              patch(item.id, { progress: p }),
            );
            up = { bucket: slot.bucket, path: slot.path };
            patch(item.id, { status: "done", progress: 100, uploaded: up });
          } catch (err) {
            patch(item.id, {
              status: "error",
              error: err instanceof Error ? err.message : "Upload failed",
            });
            setHasFailed(true);
            toast.error("An upload failed. Press Retry to try again.");
            return;
          }
        }
        media.push({
          kind: item.kind,
          bucket: up.bucket,
          path: up.path,
          width: item.width,
          height: item.height,
          durationS: item.duration ? Math.max(1, Math.round(item.duration)) : null,
          sizeBytes: item.blob.size,
        });
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          teaser: v.teaser,
          visibility: v.visibility,
          priceKobo,
          category: v.category || null,
          media,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Could not publish");
        return;
      }

      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }
      toast.success("Post published");
      router.push(`/@${username}`);
      router.refresh();
    } finally {
      setPublishing(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 rounded-xl border border-border bg-card p-6"
    >
      <div className="space-y-2">
        <Label htmlFor="body">What do you want to share?</Label>
        <textarea
          id="body"
          rows={6}
          maxLength={2000}
          disabled={publishing}
          {...register("body")}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label>Photos or video</Label>
        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={publishing}
            onClick={() => fileInput.current?.click()}
          >
            Add media
          </Button>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,video/mp4"
            className="hidden"
            onChange={onPickFiles}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Up to 4 images (8 MB each) or 1 MP4 video (50 MB, 3 minutes).
          </p>
        </div>

        {items.length > 0 && (
          <ul className="grid grid-cols-2 gap-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="overflow-hidden rounded-lg border border-border"
              >
                {item.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.previewUrl}
                    alt="Selected media preview"
                    className="h-32 w-full object-cover"
                  />
                ) : (
                  <video
                    src={item.previewUrl}
                    muted
                    preload="metadata"
                    className="h-32 w-full object-cover"
                  />
                )}
                <div className="space-y-1 p-2 text-xs">
                  {item.status === "uploading" && (
                    <div className="h-1.5 overflow-hidden rounded bg-muted">
                      <div
                        className="h-full bg-brand transition-all"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                  {item.status === "done" && (
                    <p className="text-success">Uploaded</p>
                  )}
                  {item.status === "error" && (
                    <p className="text-destructive">{item.error}</p>
                  )}
                  <button
                    type="button"
                    disabled={publishing}
                    onClick={() => removeItem(item.id)}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="visibility">Who can see this?</Label>
        <select
          id="visibility"
          disabled={publishing}
          {...register("visibility")}
          className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
        >
          <option value="public">Public</option>
          <option value="subscribers">Subscribers only</option>
          <option value="paid">Paid (one-off price)</option>
        </select>
      </div>

      {visibility === "paid" && (
        <div className="space-y-2">
          <Label htmlFor="priceNaira">Price (₦, minimum 100)</Label>
          <Input
            id="priceNaira"
            type="number"
            inputMode="numeric"
            min={100}
            step={1}
            disabled={publishing}
            {...register("priceNaira")}
          />
        </div>
      )}

      {visibility !== "public" && (
        <div className="space-y-2">
          <Label htmlFor="teaser">Public preview (shown to people who can&apos;t unlock it)</Label>
          <textarea
            id="teaser"
            rows={2}
            maxLength={200}
            disabled={publishing}
            {...register("teaser")}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          disabled={publishing}
          {...register("category")}
          className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
        >
          <option value="">None</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" className="w-full" disabled={publishing}>
        {publishing ? "Publishing..." : hasFailed ? "Retry" : "Publish"}
      </Button>
    </form>
  );
}