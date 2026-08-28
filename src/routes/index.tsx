import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/control" });
  },
  head: () => ({
    meta: [
      { title: "עצור בצד · מערכת משחק" },
      { name: "description", content: "אב טיפוס מערכת המשחק לתוכנית עצור בצד / PULL OVER." },
      { property: "og:title", content: "עצור בצד · מערכת משחק" },
      {
        property: "og:description",
        content: "אב טיפוס מערכת המשחק לתוכנית עצור בצד / PULL OVER.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => null,
});
