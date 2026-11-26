import { z } from "zod";

export const mediaItemSchema = z.object({
  kind: z.enum(["image", "video"]),
  bucket: z.enum(["public", "private"]),
  path: z.string().min(1).max(300),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  durationS: z.number().int().positive().max(180).nullable(),
  sizeBytes: z.number().int().positive(),
});

export const createPostSchema = z
  .object({
    body: z.string().trim().max(2000),
    teaser: z.string().trim().max(200),
    visibility: z.enum(["public", "subscribers", "paid"]),
    priceKobo: z.number().int().min(10000).max(100000000).nullable(),
    category: z.string().trim().max(40).nullable(),
    media: z.array(mediaItemSchema).max(4),
  })
  .superRefine((v, ctx) => {
    const videos = v.media.filter((m) => m.kind === "video").length;
    const images = v.media.length - videos;
    const bucket = v.visibility === "public" ? "public" : "private";

    if (!v.body && v.media.length === 0) {
      ctx.addIssue({ code: "custom", message: "Write something or add media" });
    }
    if (videos > 1 || (videos === 1 && images > 0)) {
      ctx.addIssue({ code: "custom", message: "Use up to 4 images or 1 video" });
    }
    if (v.visibility === "paid" && v.priceKobo === null) {
      ctx.addIssue({ code: "custom", message: "Set a price for a paid post" });
    }
    if (v.visibility !== "paid" && v.priceKobo !== null) {
      ctx.addIssue({ code: "custom", message: "Only paid posts have a price" });
    }
    if (v.media.some((m) => m.bucket !== bucket)) {
      ctx.addIssue({ code: "custom", message: "Media upload mismatch. Retry the upload." });
    }
  });

export type CreatePostInput = z.infer<typeof createPostSchema>;