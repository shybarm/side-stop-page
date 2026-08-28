import { createFileRoute } from "@tanstack/react-router";
import { OperatorConsole } from "@/components/pullover/OperatorConsole";

export const Route = createFileRoute("/control")({
  head: () => ({
    meta: [
      { title: "חדר בקרה · עצור בצד" },
      { name: "description", content: "פאנל הבקרה של Q להפעלת המשחק והמגבים בתוכנית עצור בצד." },
      { property: "og:title", content: "חדר בקרה · עצור בצד" },
      {
        property: "og:description",
        content: "פאנל הבקרה של Q להפעלת המשחק והמגבים בתוכנית עצור בצד.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OperatorConsole,
});
