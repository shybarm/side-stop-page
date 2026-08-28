import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "עצור בצד" },
      { name: "description", content: "דף פשוט עם ההודעה: עצור בצד" },
      { property: "og:title", content: "עצור בצד" },
      { property: "og:description", content: "דף פשוט עם ההודעה: עצור בצד" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-background px-6"
    >
      <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-7xl">
        עצור בצד
      </h1>
    </main>
  );
}
