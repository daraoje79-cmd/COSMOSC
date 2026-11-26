import { requireCreator } from "@/lib/auth/guards";
import { Composer } from "@/components/post/composer";

export default async function ComposePage() {
  const { profile } = await requireCreator();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">New post</h1>
      <Composer username={profile.username} />
    </div>
  );
}