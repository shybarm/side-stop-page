import { createFileRoute } from "@tanstack/react-router";
import { IsoControl } from "@/components/iso/IsoControl";

export const Route = createFileRoute("/iso-control")({
  head: () => ({
    meta: [
      { title: "ISO CONTROL · עצור בצד" },
      { name: "description", content: "מסך שליטה לעוזר הבמאי לגרפיקת ISO של עצור בצד." },
      { property: "og:title", content: "ISO CONTROL · עצור בצד" },
      { property: "og:description", content: "מסך שליטה לעוזר הבמאי לגרפיקת ISO של עצור בצד." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IsoControl,
});
