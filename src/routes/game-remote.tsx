import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Maximize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GameDisplay } from '@/components/pullover/GameDisplay';
import { readCreds, useIsoSession } from '@/lib/iso/useIsoSession';
import { remoteGame } from '@/lib/iso/remoteGame';

export const Route = createFileRoute('/game-remote')({
  head: () => ({ meta: [
    { title: 'מסך משחק מרוחק · עצור בצד' },
    { name: 'description', content: 'מסך המשחק המלא של עצור בצד, מסונכרן למחשב השליטה.' },
    { property: 'og:title', content: 'מסך משחק מרוחק · עצור בצד' },
    { property: 'og:description', content: 'מסך המשחק המלא של עצור בצד, מסונכרן למחשב השליטה.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'robots', content: 'noindex' },
  ] }),
  component: RemoteGame,
});

function RemoteGame() {
  const [creds, setCreds] = useState<{ code: string; key: string } | null>(null);
  const [controls, setControls] = useState(true);
  useEffect(() => { setCreds(readCreds('pullover:remote-game')); }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const move = () => { setControls(true); clearTimeout(timer); timer = setTimeout(() => setControls(false), 2500); };
    window.addEventListener('mousemove', move); move();
    return () => { clearTimeout(timer); window.removeEventListener('mousemove', move); };
  }, []);
  const { snap, conn, serverNow } = useIsoSession(creds?.code ?? null, creds?.key ?? null);
  const game = snap ? remoteGame(snap, serverNow() - Date.now()) : null;
  const fullscreen = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.().catch(() => {}); };
  return <main dir="rtl" className={`relative h-screen w-screen overflow-hidden bg-po-asphalt-deep text-po-white ${controls ? '' : 'cursor-none'}`} onDoubleClick={fullscreen}>
    {game ? <GameDisplay state={game.state} question={game.question} total={7} /> : <div className="flex h-full items-center justify-center text-xl">{creds ? (conn.error ? 'לא ניתן להתחבר למסך המשחק' : 'מתחבר למשחק…') : 'נדרש קישור ממחשב השליטה'}</div>}
    {game && (!conn.online || (conn.gameHeartbeatAgeMs ?? 0) > 10000) && <div role="status" className="absolute left-4 top-4 z-50 rounded border border-border bg-background/90 px-3 py-2 text-sm text-foreground">החיבור למחשב השליטה נותק — ממתין לחיבור מחדש</div>}
    <Button variant="outline" size="icon" title="מסך מלא" aria-label="מסך מלא" onClick={fullscreen} className={`absolute bottom-4 left-4 z-50 ${controls ? '' : 'pointer-events-none opacity-0'}`}><Maximize /></Button>
  </main>;
}