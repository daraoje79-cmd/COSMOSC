import { requireUser } from "@/lib/auth/guards";

export default async function FeedPage() {
  const { profile } = await requireUser();
  return (
    <div>
      <h1 className="text-2xl font-bold">Feed</h1>
      <p className="mt-2 text-muted-foreground">
        Signed in as @{profile.username} ({profile.role})
      </p>
    </div>
  );
}