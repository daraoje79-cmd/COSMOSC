import { requireCreator } from "@/lib/auth/guards";

export default async function DashboardPage() {
  await requireCreator();
  return <h1 className="text-2xl font-bold">Creator dashboard</h1>;
}