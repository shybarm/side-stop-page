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
      if kind='new_game' then
        -- New game: every plate returns to play; the new airing's pool holds all plates.
        update iso_plates set status='active', status_key=null where session_id=s.id;
        perform iso_ensure_state(s.id, _event->>'question_key');
        update iso_state set pool=(select array_agg(plate_id order by ord) from iso_plates where session_id=s.id),
          placements='{}'::jsonb, locked_snapshot=null, correct_answer=null, resolved=false, version=version+1
          where session_id=s.id and question_key=_event->>'question_key';
      else
        perform iso_ensure_state(s.id, _event->>'question_key');
      end if;
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
revoke execute on function public.iso_game_publish(text,text,bigint,jsonb,jsonb,text,jsonb) from public, anon, authenticated;
grant execute on function public.iso_game_publish(text,text,bigint,jsonb,jsonb,text,jsonb) to service_role;