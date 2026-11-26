import { z } from "zod";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const VIDEO_TYPES = ["video/mp4"] as const;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 100 MB once we move to R2

export const uploadSignSchema = z
  .object({
    kind: z.enum(["image", "video"]),
    contentType: z.string(),
    size: z.number().int().positive(),
    visibility: z.enum(["public", "subscribers", "paid"]),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "image") {
      if (!(IMAGE_TYPES as readonly string[]).includes(v.contentType)) {
        ctx.addIssue({ code: "custom", message: "Use a JPEG, PNG or WebP image" });
      }
      if (v.size > MAX_IMAGE_BYTES) {
        ctx.addIssue({ code: "custom", message: "Image must be under 8 MB" });
      }
    } else {
      if (!(VIDEO_TYPES as readonly string[]).includes(v.contentType)) {
        ctx.addIssue({ code: "custom", message: "Video must be an MP4 file" });
      }
      if (v.size > MAX_VIDEO_BYTES) {
        ctx.addIssue({ code: "custom", message: "Video must be under 50 MB" });
      }
    }
  });

export type UploadSignInput = z.infer<typeof uploadSignSchema>;