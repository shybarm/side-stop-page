import { createFileRoute } from "@tanstack/react-router";
import { GameDisplay } from "@/components/pullover/GameDisplay";
import { useGameState } from "@/lib/pullover/gameStore";
import { useQuestions } from "@/lib/pullover/questionStore";

export const Route = createFileRoute("/game")({
  head: () => ({
    meta: [
      { title: "PROGRAM · עצור בצד" },
      { name: "description", content: "פלט המשחק לשולחן המשתתפים בתוכנית עצור בצד." },
      { property: "og:title", content: "PROGRAM · עצור בצד" },
      { property: "og:description", content: "פלט המשחק לשולחן המשתתפים בתוכנית עצור בצד." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GameOutput,
});

function GameOutput() {
  const state = useGameState();
  const [questions] = useQuestions();

  return (
    <main className="h-screen w-screen overflow-hidden bg-po-asphalt-deep">
      <GameDisplay
        state={state}
        question={questions[state.questionIndex]}
        total={questions.length}
      />
    </main>
  );
}
