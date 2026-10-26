export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <h1 className="mb-6 text-center text-3xl font-bold tracking-tight text-brand">
        COSMOSC
      </h1>
      {children}
    </main>
  );
}