"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type Props = {
  targetId: string;
  initialFollowing: boolean;
  initialCount: number;
};

export function FollowButton({ targetId, initialFollowing, initialCount }: Props) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    // Optimistic update
    const wasFollowing = following;
    setFollowing(!wasFollowing);
    setCount((c) => c + (wasFollowing ? -1 : 1));

    const { error } = wasFollowing
      ? await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", targetId)
      : await supabase
          .from("follows")
          .insert({ follower_id: user.id, following_id: targetId });

    // Ignore "already following" (code 23505) so the action stays idempotent
    if (error && error.code !== "23505") {
      setFollowing(wasFollowing);
      setCount((c) => c + (wasFollowing ? 1 : -1));
      toast.error("Something went wrong. Try again.");
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-4">
      <Button
        onClick={toggle}
        disabled={busy}
        variant={following ? "secondary" : "default"}
      >
        {following ? "Following" : "Follow"}
      </Button>
      <span className="text-sm">
        <strong>{count}</strong>{" "}
        <span className="text-muted-foreground">Followers</span>
      </span>
    </div>
  );
}