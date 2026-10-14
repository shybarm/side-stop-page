import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GameDisplay } from "@/components/pullover/GameDisplay";
import { questionForSlot, useGameState } from "@/lib/pullover/gameStore";
import { useQuestions } from "@/lib/pullover/questionStore";
export const Route = createFileRoute("/game")({head:()=>({meta:[{title:"PROGRAM · עצור בצד"},{name:"description",content:"פלט המשחק לשולחן המשתתפים בתוכנית עצור בצד."},{property:"og:title",content:"PROGRAM · עצור בצד"},{property:"og:description",content:"פלט המשחק לשולחן המשתתפים בתוכנית עצור בצד."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"},{name:"robots",content:"noindex"}]}),component:GameOutput});

function GameOutput(){
  const state=useGameState();const[questions]=useQuestions();const question=questionForSlot(state);
  const[isFull,setIsFull]=useState(false);const[showBtn,setShowBtn]=useState(true);
  useEffect(()=>{
    const onFs=()=>setIsFull(!!document.fullscreenElement);
    let t:ReturnType<typeof setTimeout>;
    const onMove=()=>{setShowBtn(true);clearTimeout(t);t=setTimeout(()=>setShowBtn(false),2500)};
    const onKey=(e:KeyboardEvent)=>{if(e.key==="f"||e.key==="F"||e.key==="כ")toggle()};
    document.addEventListener("fullscreenchange",onFs);window.addEventListener("mousemove",onMove);window.addEventListener("keydown",onKey);onMove();
    return()=>{document.removeEventListener("fullscreenchange",onFs);window.removeEventListener("mousemove",onMove);window.removeEventListener("keydown",onKey);clearTimeout(t)};
  },[]);
  const toggle=()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen?.().catch(()=>{})};
  return <main className={`relative h-screen w-screen overflow-hidden bg-po-asphalt-deep ${showBtn?"":"cursor-none"}`} onDoubleClick={toggle}>
    <GameDisplay state={state} question={question} total={questions.length}/>
    <button type="button" onClick={toggle} aria-label={isFull?"יציאה ממסך מלא":"מסך מלא"}
      className={`absolute bottom-4 left-4 z-50 rounded-md border border-border bg-background/70 px-4 py-2 text-sm text-foreground backdrop-blur transition-opacity duration-500 ${showBtn?"opacity-100":"pointer-events-none opacity-0"}`}>
      {isFull?"יציאה ממסך מלא":"⛶ מסך מלא"}
    </button>
  </main>;
}
