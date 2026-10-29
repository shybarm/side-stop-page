<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- The game timer car and trail share one measured perimeter path around the question; presentation derives progress from the existing timer timestamps and never triggers or changes authoritative lock timing.
- Answer entry visibility is optional presentation state in the authoritative local store; backward navigation is pre-lock only and never reverses ISO snapshots or elimination events. Shared ISO presentation fields travel with plain versioned state, not critical events.
- Pair imports use a separate persisted pack, never the test warehouse; retain all reserves with their round, allow partial packs (empty rounds stay -1, invalid questions are skipped, never repaired), and refresh merges in place without changing already-aired slots. Private bank reads require the existing ISO game-role key server-side before using the shared export secret.
- Bank export calls target the bank's final custom domain and follow redirects manually to known hosts only, because fetch drops the Authorization header on cross-origin redirects.
- Local game state (`src/lib/pullover/gameStore.ts`) stays authoritative and offline-capable; cross-computer ISO sync is a separate background layer (`src/lib/iso/publisher.ts`) that subscribes to it and must never block local controls.
- All ISO session reads/writes go through server functions in `src/lib/iso/iso.functions.ts`, which call SECURITY DEFINER SQL functions granted only to service_role; role (game/director/output) is enforced in SQL by per-role key hashes — tables have RLS with no client access.
- Elimination, lock snapshots, event dedupe and version checks happen atomically inside SQL functions (`iso_game_publish`, `iso_place`, `iso_resolve`) so retries and replays cannot double-apply.
- Realtime is used only as a "version changed" ping (`realtime.send` on topic `iso:<CODE>`); clients always refetch the latest full snapshot, with polling as fallback.
- Each airing of a question gets its own ISO key (`slot:questionId:airedAt`), so re-running a slot never reuses an old lock/reveal state; critical events are deduped by client event ID, not gated by sequence.
- ISO graphics position/scale lives in `game_sessions.layout` (director-only via `iso_set_layout`), separate from plates and timer; the director's test photo stays a local object URL and is never uploaded or logged.
- "New game" bumps `gameId` in local state; the publisher queues a durable `new_game` event that restores all plates server-side before the new airing pool is built. The password is only an accidental-click guard, not security.
- Every full reset (including legacy RESET) changes `gameId`; publisher startup reconciles the current game before recording its identity, so offline resets cannot silently skip plate restoration.
- ISO reveal effects are presentation-only, keyed to a live unrevealed-to-revealed transition of the same airing; refreshed/resumed revealed snapshots render the finished state without replaying eliminations.
- Director placement uses an optimistic, serial client queue with server-version conflict recovery; only acknowledged snapshots reach the clean output, preserving atomic lock/reveal authority while keeping local plate selection immediate.
- Clean ISO output keeps persistent text and plate layers outside animated CSS masks, because browser-based recording sources may freeze masked layers on their first frame.
- Concave window geometry is an opt-in presentation mode of AnswerLane shared by the game and control preview; ISO keeps its separate lower-third layout to preserve camera clearance.
- Broadcast identity is expressed through semantic material tokens in `src/styles.css` and a shared `ShowMark` presentation component; game text uses unmasked entry/clear transitions, while ISO masks are reserved for decorative glass to preserve recording compatibility.
