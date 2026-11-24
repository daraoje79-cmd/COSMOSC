import { requireAdmin } from "@/lib/auth/guards";

export default async function AdminUsersPage() {
  await requireAdmin();
  return <h1 className="text-2xl font-bold">Admin: users</h1>;
}