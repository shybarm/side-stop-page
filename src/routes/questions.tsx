import { createFileRoute } from "@tanstack/react-router";
import { QuestionManager } from "@/components/pullover/QuestionManager";

export const Route = createFileRoute("/questions")({
  head: () => ({
    meta: [
      { title: "מחסן שאלות · עצור בצד" },
      { name: "description", content: "ניהול, ייבוא וייצוא מחסן השאלות של התוכנית עצור בצד." },
      { property: "og:title", content: "מחסן שאלות · עצור בצד" },
      {
        property: "og:description",
        content: "ניהול, ייבוא וייצוא מחסן השאלות של התוכנית עצור בצד.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: QuestionManager,
});
