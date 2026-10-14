CREATE OR REPLACE FUNCTION public.iso_game_publish(_code text, _hash text, _version bigint, _state jsonb, _question jsonb, _key text, _event jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare s public.game_sessions; seq bigint; kind text; applied boolean := false; state_applied boolean := false; res jsonb;
begin
  s := iso_auth(_code,_hash,array['game']);
  -- Ignore outdated game tabs whose airing keys lack the airing time (slot:question only).
  if (_key is not null and _key !~ '^\d+:[^:]+:\d+$') or (_event is not null and coalesce(_event->>'question_key','') <> '' and (_event->>'question_key') !~ '^\d+:[^:]+:\d+$') then
    return jsonb_build_object('ok',true,'event_applied',false,'state_applied',true,'game_version',_version,'ignored','legacy_client',
      'server_now',(extract(epoch from clock_timestamp())*1000)::bigint);
  end if;
  perform pg_advisory_xact_lock(hashtext(s.id::text));
  select * into s from game_sessions where id=s.id for update;
  if _event is not null then
    seq := coalesce((_event->>'seq')::bigint,0); kind := _event->>'kind';
    if not exists(select 1 from iso_events where session_id=s.id and client_event_id=_event->>'id') then
      if kind='new_game' then
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
end $function$;

-- Point PO-3723 back at the latest fresh airing and clear the old tab's leftover state.
update public.game_sessions s set question_key=(select question_key from public.iso_state where session_id=s.id and question_key ~ '^\d+:[^:]+:\d+$' order by created_at desc limit 1),
  game_state = jsonb_set(game_state,'{phase}','"idle"')
  where code='PO-3723';
delete from public.iso_state x using public.game_sessions s where s.id=x.session_id and x.question_key !~ '^\d+:[^:]+:\d+$';
update public.iso_plates set status='active', status_key=null where session_id in (select id from public.game_sessions where code='PO-3723');
select public.iso_notify('PO-3723');