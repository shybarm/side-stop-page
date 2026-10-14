import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { IsoOutputView } from "@/components/iso/IsoOutputView";
import { readCreds, useIsoSession } from "@/lib/iso/useIsoSession";

export const Route = createFileRoute("/iso-output")({
  head: () => ({
    meta: [
      { title: "ISO OUTPUT · עצור בצד" },
      { name: "description", content: "יציאת גרפיקת ISO נקייה עם רקע שקוף לתוכנית עצור בצד." },
      { property: "og:title", content: "ISO OUTPUT · עצור בצד" },
      { property: "og:description", content: "יציאת גרפיקת ISO נקייה עם רקע שקוף לתוכנית עצור בצד." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IsoOutput,
});

function IsoOutput() {
  const [creds, setCreds] = useState<{ code: string; key: string } | null>(null);
  useEffect(() => {
    setCreds(readCreds("pullover:iso:output"));
    const els = [document.documentElement, document.body];
    els.forEach((e) => { e.style.background = "transparent"; e.style.cursor = "none"; });
    document.body.classList.add("po-iso-transparent");
  }, []);
  const { snap, serverNow } = useIsoSession(creds?.code ?? null, creds?.key ?? null);
  return <main className="po-iso-capture po-iso-transparent fixed inset-0 cursor-none overflow-hidden"><IsoOutputView snap={snap} serverNow={serverNow} /></main>;
}
