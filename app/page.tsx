import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-4xl font-bold tracking-tight text-brand">COSMOSC</h1>
      <p className="text-center text-muted-foreground">
        Get paid directly by your followers.
      </p>
      <Button>Get started</Button>
      <p className="text-success">Success</p>
      <p className="text-warning">Warning</p>
    </main>
  );
}