// Game board: answers go up first (windshield wipe-in), then the question band.
import { visibleAnswerCount } from "@/lib/pullover/presentation";
import { AnswerLane } from "./AnswerLane";
import { useEffect,useState,useId,useRef } from "react";
import { ANSWER_KEYS,activeAnswerKeys,answerOf,normalizeTimerDuration,type AnswerKey,type GameState,type Question } from "@/lib/pullover/types";
interface GameDisplayProps{state:GameState;question:Question|undefined;total:number;compact?:boolean}
export function GameDisplay({ state, question, compact = false }: GameDisplayProps) {
  const { phase, wipeSeq, questionIndex } = state;
  if (phase === "transition") return <StopTransition compact={compact} />;
  if (phase === "progress") return <ProgressScreen completed={questionIndex + 1} compact={compact} />;
  const active = activeAnswerKeys(questionIndex);
  const showAnswers = Boolean(question) && phase !== "idle";
  const count = visibleAnswerCount(state);
  return <div dir="rtl" className={["po-stage po-tv-stage po-breathe po-concave-board relative h-full w-full overflow-hidden", phase === "locked" ? "po-whole-board-locked" : "", compact ? "is-compact" : ""].join(" ")}>
    <BroadcastLights />
    {phase === "locked" && <div className="po-lock-overlay pointer-events-none absolute inset-0 z-20" />}
    <div className="po-concave-grid">
      {ANSWER_KEYS.map((key, index) => <AnswerLane key={key} letter={key} text={question && active.includes(key) ? answerOf(question, key) : ""} phase={phase} isCorrect={question?.correctAnswer === key} wipeSeq={wipeSeq} index={index} compact={compact} concave empty={!showAnswers || !active.includes(key) || index >= count} />)}
    </div>
    <section key={phase === "idle" || phase === "intro" ? "empty" : `question-${state.airedAt ?? questionIndex}`} className={`po-concave-question ${phase === "idle" || phase === "intro" || !question ? "po-question-empty" : "po-question-bridge po-question-drive-in"}`} aria-label="שאלת המשחק">
      {phase === "timing" && <TimerDrive startedAt={state.timerStartedAt} duration={normalizeTimerDuration(state.timerDurationMs)} compact={compact} />}
      {phase === "idle" || phase === "intro" || !question
        ? null
        : <h1 className="po-question-type">{question.text}</h1>}
    </section>
  </div>;
}
function BroadcastLights(){return <div className="pointer-events-none absolute inset-0 overflow-hidden"><div className="po-blue-beam po-breathe-beam-a absolute -left-[12%] -top-[20%] h-[90%] w-[35%] rotate-[24deg]"/><div className="po-violet-beam po-breathe-beam-b absolute -right-[12%] -top-[20%] h-[90%] w-[35%] -rotate-[24deg]"/><div className="po-bulb-wall po-breathe-bulbs absolute inset-x-0 top-0 h-[16%]"/><div className="po-breathe-haze pointer-events-none absolute inset-0"/><div className="po-floor-glow po-breathe-floor absolute inset-x-[12%] bottom-0 h-[20%]"/></div>}
export function ShowMark({compact=false}:{compact?:boolean}){return <div className={compact?"po-original-logo is-small":"po-original-logo"}><img src="https://d2ol7oe51mr4n9.cloudfront.net/user_3K6YEupciLxKIiwN9kh23unuijM/b55a1f97-3d1f-41e5-9217-99c4afc08acf.png" alt="עצור בצד" draggable={false}/></div>}
function StopTransition({compact}:{compact:boolean}){
  const id=useId().replace(/:/g,"");
  const [elapsed,setElapsed]=useState(0);
  useEffect(()=>{let raf=0;const start=performance.now();const tick=(now:number)=>{const ms=Math.min(2100,now-start);setElapsed(ms);if(ms<2100)raf=requestAnimationFrame(tick)};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf)},[]);
  const angle=Math.max(0,Math.min(1,(elapsed-250)/1250))*210;
  const exit=Math.max(0,Math.min(1,(elapsed-1500)/550))*2400;
  // One angle drives both the actual blade cutout and the hard erase boundary.
  const rad=Math.min(angle,180)*Math.PI/180;
  const px=1485,py=835;
  const ex=px-2400*Math.cos(rad),ey=py-2400*Math.sin(rad);
  // Erase the entire swept half-plane, including pixels below the hinge.
  // A sector ending at the hinge left the lower trim and glow behind.
  const rx=px+2400*Math.cos(rad),ry=py+2400*Math.sin(rad);
  const nx=-4800*Math.sin(rad),ny=4800*Math.cos(rad);
  const src="https://d2ol7oe51mr4n9.cloudfront.net/user_3K6YEupciLxKIiwN9kh23unuijM/b55a1f97-3d1f-41e5-9217-99c4afc08acf.png";
  const blade="155,520 1510,680 1550,740 1540,803 155,803";
  return <div className="po-stop-transition relative h-full w-full overflow-hidden"><BroadcastLights/><div className="po-wiping-brand">
    <svg viewBox="0 0 1920 803" role="img" aria-label="עצור בצד" style={{width:"100%",height:"100%",overflow:"visible"}}>
      <defs>
        <clipPath id={id+"blade"}><polygon points={blade}/></clipPath>
        <mask id={id+"erase"} maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="803">
          <rect width="1920" height="803" fill="white"/>
          <polygon points={blade} fill="black"/>
          {angle>0&&<polygon points={`${ex},${ey} ${rx},${ry} ${rx+nx},${ry+ny} ${ex+nx},${ey+ny}`} fill="black"/>}
        </mask>
      </defs>
      <g>
        <image href={src} width="1920" height="803" mask={`url(#${id}erase)`}/>
        <g transform={`translate(${exit} 0) rotate(${angle} ${px} ${py}) translate(0 100)`}><image href={src} width="1920" height="803" clipPath={`url(#${id}blade)`}/></g>
      </g>
    </svg>
  </div></div>;
}
function ProgressScreen({completed,compact}:{completed:number;compact:boolean}){const safe=Math.max(0,Math.min(completed,7));const pct=safe/7*100;return <div dir="rtl" className="po-progress-show relative h-full w-full overflow-hidden "><div className="po-progress-rays absolute inset-0"/><div className="po-progress-floor absolute inset-x-0 bottom-0 h-[34%]"/><div className={["absolute inset-x-0 z-20 text-center",compact?"top-[11%]":"top-[9%]"].join(" ")}><div className="po-progress-brand"><ShowMark compact={compact}/></div><div className={["font-black text-white/70",compact?"mt-1 text-[5px]":"mt-3 text-lg tracking-[.5em]"].join(" ")}>הדרך אל הרכב</div></div><div className="absolute left-[8%] right-[8%] top-[57%] z-30"><div className="po-progress-track relative"><div className="po-progress-energy absolute inset-y-0 left-0" style={{width:`${pct}%`}}/>{Array.from({length:7},(_,i)=>{const done=i<safe,current=i===safe-1;return <div key={i} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{left:`${i/6*100}%`}}><div className={["po-progress-node flex items-center justify-center font-black",compact?"h-5 w-5 text-[7px]":"h-16 w-16 text-2xl",done?"done":"",current?"current":""].join(" ")}><span>{i+1}</span></div></div>})}</div></div>{!compact&&<div className="absolute inset-x-0 bottom-[8%] z-30 text-center"><div className="po-score-burst inline-flex items-center gap-5 px-10 py-4"><strong className="text-5xl">{safe}</strong><div className="text-right"><div className="text-xl font-black">מתוך 7</div><div className="text-sm font-bold tracking-[.16em] text-white/70">{safe>=7?"הרכב שלכם":`עוד ${7-safe} לרכב`}</div></div></div></div>}</div>}

function TimerDrive({startedAt,duration}:{startedAt:number|null;duration:number;compact:boolean}){
  const container=useRef<HTMLDivElement>(null);
  const path=useRef<SVGPathElement>(null);
  const [size,setSize]=useState({width:0,height:0});
  const [frame,setFrame]=useState({progress:0,x:0,y:0,angle:90});
  useEffect(()=>{
    const el=container.current;if(!el)return;
    const observer=new ResizeObserver(([entry])=>{if(entry)setSize({width:entry.contentRect.width,height:entry.contentRect.height})});
    observer.observe(el);return()=>observer.disconnect();
  },[]);
  const {width:w,height:h}=size;
  const r=Math.min(22,h/4,w/8);
  const d=w&&h?`M ${w/2} 0 H ${w-r} Q ${w} 0 ${w} ${r} V ${h-r} Q ${w} ${h} ${w-r} ${h} H ${r} Q 0 ${h} 0 ${h-r} V ${r} Q 0 0 ${r} 0 Z`:'';
  useEffect(()=>{
    if(startedAt===null||!d)return;
    let raf=0;
    const tick=()=>{
      const el=path.current;if(!el)return;
      const progress=Math.max(0,Math.min(1,(Date.now()-startedAt)/duration));
      const length=el.getTotalLength();const distance=progress*length;
      const point=el.getPointAtLength(distance);
      const ahead=el.getPointAtLength((distance+1)%length);
      setFrame({progress,x:point.x,y:point.y,angle:Math.atan2(ahead.y-point.y,ahead.x-point.x)*180/Math.PI+90});
      raf=requestAnimationFrame(tick);
    };
    tick();return()=>cancelAnimationFrame(raf);
  },[startedAt,d,duration]);
  return <div ref={container} className="po-question-lap pointer-events-none" aria-hidden="true">
    {d&&<><svg width={w} height={h} className="po-lap-svg"><path ref={path} d={d} pathLength={1} className="po-lap-trail" strokeDasharray={`${frame.progress} 1`} /></svg>
    <div className="po-lap-car" style={{left:frame.x,top:frame.y,transform:`translate(-50%,-50%) rotate(${frame.angle}deg)`}}><div className="relative h-full w-full"><div className="po-car-body absolute inset-0"/><div className="po-car-glass absolute inset-x-[18%] top-[16%] h-[26%]"/><div className="po-car-glass absolute inset-x-[18%] bottom-[16%] h-[20%]"/></div></div></>}
  </div>;
}
