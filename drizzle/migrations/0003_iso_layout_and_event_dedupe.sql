alter table public.game_sessions add column if not exists layout jsonb not null default '{}'::jsonb;

create or replace function public.iso_snapshot(_sid uuid, _key text) returns jsonb
language sql security definer set search_path=public as $$
  select jsonb_build_object(
    'game', (select jsonb_build_object('state',game_state,'question',question,'question_key',question_key) from game_sessions where id=_sid),
    'layout', (select layout from game_sessions where id=_sid),
    'plates', (select coalesce(jsonb_agg(jsonb_build_object('id',plate_id,'color',color,'status',status,'status_key',status_key) order by ord),'[]') from iso_plates where session_id=_sid),
    'iso', (select to_jsonb(x) - 'session_id' from iso_state x where session_id=_sid and question_key=_key));
$$;

-- Critical events are deduplicated by their deterministic client id (kind + question airing), not by a
-- per-tab sequence counter, so a second game tab or a reloaded tab can never silently drop a lock/reveal.
create or replace function public.iso_game_publish(_code text, _hash text, _version bigint, _state jsonb, _question jsonb, _key text, _event jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.game_sessions; seq bigint; kind text; applied boolean := false; state_applied boolean := false; res jsonb;
begin
  s := iso_auth(_code,_hash,array['game']);
  perform pg_advisory_xact_lock(hashtext(s.id::text));
  select * into s from game_sessions where id=s.id for update;
  if _event is not null then
    seq := coalesce((_event->>'seq')::bigint,0); kind := _event->>'kind';
    if not exists(select 1 from iso_events where session_id=s.id and client_event_id=_event->>'id') then
      perform iso_ensure_state(s.id, _event->>'question_key');
      if kind='lock' then
        update iso_state set locked_snapshot=placements where session_id=s.id and question_key=_event->>'question_key' and locked_snapshot is null;
      elsif kind='reveal' then
        update iso_state set locked_snapshot=coalesce(locked_snapshot,placements), correct_answer=_event->>'correct'
          where session_id=s.id and question_key=_event->>'question_key';
        if not coalesce((select resolved from iso_state where session_id=s.id and question_key=_event->>'question_key'),true) then
          res := iso_resolve(s.id,_event->>'question_key',false);
        end if;
      end if;
      update game_sessions set last_event_seq=greatest(last_event_seq,seq) where id=s.id;
      perform iso_log(s.id,kind,_event->>'question_key',jsonb_build_object('event',_event,'result',res),_event->>'id',seq);
      applied := true;
    end if;
  end if;
  if _version > s.game_version then
    update game_sessions set game_state=_state, question=_question, question_key=_key, game_version=_version, heartbeat_at=now() where id=s.id;
    perform iso_ensure_state(s.id,_key);
    state_applied := true;
  else
    update game_sessions set heartbeat_at=now() where id=s.id;
  end if;
  perform iso_notify(_code);
  return jsonb_build_object('ok',true,'event_applied',applied,'state_applied',state_applied,
    'game_version',greatest(s.game_version,_version),'server_now',(extract(epoch from clock_timestamp())*1000)::bigint);
end $$;

create or replace function public.iso_set_layout(_code text, _hash text, _layout jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare s public.game_sessions;
begin
  s := iso_auth(_code,_hash,array['director']);
  if jsonb_typeof(_layout) <> 'object' or length(_layout::text) > 4000 then raise exception 'bad_layout'; end if;
  update game_sessions set layout=_layout where id=s.id;
  perform iso_log(s.id,'layout',s.question_key,jsonb_build_object('layout',_layout));
  perform iso_notify(_code);
  return jsonb_build_object('ok',true);
end $$;

revoke all on function public.iso_snapshot(uuid,text) from public, anon, authenticated;
grant execute on function public.iso_snapshot(uuid,text) to service_role;
revoke all on function public.iso_game_publish(text,text,bigint,jsonb,jsonb,text,jsonb) from public, anon, authenticated;
grant execute on function public.iso_game_publish(text,text,bigint,jsonb,jsonb,text,jsonb) to service_role;
revoke all on function public.iso_set_layout(text,text,jsonb) from public, anon, authenticated;
grant execute on function public.iso_set_layout(text,text,jsonb) to service_role;