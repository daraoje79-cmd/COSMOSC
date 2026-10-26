"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  resetRequestSchema,
  type ResetRequestInput,
} from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<ResetRequestInput>({ resolver: zodResolver(resetRequestSchema) });

  async function onSubmit({ email }: ResetRequestInput) {
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset/update`,
    });
    if (error) toast.error(error.message);
  }

  if (isSubmitSuccessful) {
    return (
      <div className="space-y-4 rounded-xl border border-border bg-card p-6 text-center">
        <p>If that email has an account, a reset link is on its way.</p>
        <Link href="/login" className="text-sm text-brand">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 rounded-xl border border-border bg-card p-6"
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" {...register("email")} />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Send reset link"}
      </Button>
      <Link href="/login" className="block text-center text-sm text-brand">
        Back to login
      </Link>
    </form>
  );
}