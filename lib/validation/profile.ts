import { z } from "zod";

export const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Enter your name").max(60),
  bio: z.string().trim().max(300, "Max 300 characters"),
  category: z.string(),
  links: z
    .array(
      z.object({
        label: z.string().trim().max(30),
        url: z.string().trim().url("Enter a full link starting with https://").or(z.literal("")),
      }),
    )
    .max(3),
});

export type ProfileInput = z.infer<typeof profileSchema>;