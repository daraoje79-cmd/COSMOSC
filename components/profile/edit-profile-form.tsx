"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { resizeImage } from "@/lib/image";
import { uploadPublicImage } from "@/lib/storage";
import { profileSchema, type ProfileInput } from "@/lib/validation/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

type Props = {
  profile: {
    id: string;
    display_name: string;
    bio: string | null;
    category: string | null;
    avatar_url: string | null;
    banner_url: string | null;
    links: { label: string; url: string }[];
  };
};

export function EditProfileForm({ profile }: Props) {
  const router = useRouter();
  const [avatar, setAvatar] = useState(profile.avatar_url);
  const [banner, setBanner] = useState(profile.banner_url);
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  const padded = [...profile.links];
  while (padded.length < 3) padded.push({ label: "", url: "" });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: profile.display_name,
      bio: profile.bio ?? "",
      category: profile.category ?? "",
      links: padded.slice(0, 3),
    },
  });

  async function onPickImage(
    kind: "avatar" | "banner",
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Use a JPEG, PNG or WebP image");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be under 8 MB");
      return;
    }

    setUploading(kind);
    try {
      const blob = await resizeImage(file);
      const url = await uploadPublicImage(profile.id, kind, blob);
      const { error } = await createClient()
        .from("profiles")
        .update(kind === "avatar" ? { avatar_url: url } : { banner_url: url })
        .eq("id", profile.id);
      if (error) throw error;

      if (kind === "avatar") setAvatar(url);
      else setBanner(url);
      toast.success(kind === "avatar" ? "Photo updated" : "Banner updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  async function onSubmit(values: ProfileInput) {
    const { error } = await createClient()
      .from("profiles")
      .update({
        display_name: values.displayName,
        bio: values.bio,
        category: values.category || null,
        links: values.links.filter((l) => l.url !== ""),
      })
      .eq("id", profile.id);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile saved");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Banner and avatar */}
      <div>
        <div
          className="h-32 rounded-xl bg-muted bg-cover bg-center"
          style={banner ? { backgroundImage: `url(${banner})` } : undefined}
        />
        <div className="-mt-10 flex items-end gap-4 px-4">
          <div
            className="flex size-20 items-center justify-center rounded-full border-4 border-background bg-card bg-cover bg-center text-2xl font-bold text-brand"
            style={avatar ? { backgroundImage: `url(${avatar})` } : undefined}
          >
            {!avatar && profile.display_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex gap-2 pb-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={uploading !== null}
              onClick={() => avatarInput.current?.click()}
            >
              {uploading === "avatar" ? "Uploading..." : "Change photo"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={uploading !== null}
              onClick={() => bannerInput.current?.click()}
            >
              {uploading === "banner" ? "Uploading..." : "Change banner"}
            </Button>
          </div>
        </div>
        <input
          ref={avatarInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => onPickImage("avatar", e)}
        />
        <input
          ref={bannerInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => onPickImage("banner", e)}
        />
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4 rounded-xl border border-border bg-card p-6"
      >
        <div className="space-y-2">
          <Label htmlFor="displayName">Name</Label>
          <Input id="displayName" {...register("displayName")} />
          {errors.displayName && (
            <p className="text-sm text-destructive">
              {errors.displayName.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <textarea
            id="bio"
            rows={4}
            {...register("bio")}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          />
          {errors.bio && (
            <p className="text-sm text-destructive">{errors.bio.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            {...register("category")}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">None</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Links (up to 3)</Label>
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1">
              <div className="flex gap-2">
                <Input
                  placeholder="Label"
                  className="w-1/3"
                  {...register(`links.${i}.label`)}
                />
                <Input
                  placeholder="https://..."
                  {...register(`links.${i}.url`)}
                />
              </div>
              {errors.links?.[i]?.url && (
                <p className="text-sm text-destructive">
                  {errors.links[i]?.url?.message}
                </p>
              )}
            </div>
          ))}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save changes"}
        </Button>
      </form>
    </div>
  );
}