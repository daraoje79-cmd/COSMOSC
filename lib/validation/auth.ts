import { z } from "zod";

export const signupSchema = z.object({
  displayName: z.string().trim().min(2, "Enter your name").max(60),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9_]{3,30}$/,
      "3 to 30 characters: letters, numbers, underscore",
    ),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
  role: z.enum(["fan", "creator"]),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export const resetRequestSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
});

export const newPasswordSchema = z.object({
  password: z.string().min(8, "At least 8 characters"),
});

export type ResetRequestInput = z.infer<typeof resetRequestSchema>;
export type NewPasswordInput = z.infer<typeof newPasswordSchema>;