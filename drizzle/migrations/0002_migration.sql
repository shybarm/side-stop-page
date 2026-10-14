
create or replace function public.iso_place(_code text, _hash text, _key text, _plate text, _target text, _expected bigint, _correction boolean, _note text, _undo boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.game_sessions; st public.iso_state; pl public.iso_plates; before jsonb; res jsonb; prev text; pending_fix boolean;
begin
  s := iso_auth(_code,_hash,array['director']);
  perform pg_advisory_xact_lock(hashtext(s.id::text));
  select * into s from game_sessions where id=s.id;
  select * into pl from iso_plates where session_id=s.id and plate_id=_plate for update;
  if pl.plate_id is null then raise exception 'plate_not_found'; end if;
  select * into st from iso_state where session_id=s.id and question_key=_key for update;
  if st.question_key is null then raise exception 'question_not_found'; end if;
  pending_fix := pl.status='pending' and pl.status_key=_key;
  if _key is distinct from s.question_key and not pending_fix then raise exception 'stale_question'; end if;
  if not (_plate = any(st.pool)) then raise exception 'plate_not_in_pool'; end if;
  if pl.status='eliminated' and not _correction then raise exception 'plate_eliminated'; end if;
  if not (pending_fix and _expected = -1) and st.version <> _expected then raise exception 'version_conflict'; end if;
  if st.locked_snapshot is not null and not _correction and not pending_fix then raise exception 'locked'; end if;
  if _target is not null and _target not in ('A','B','C','D') then raise exception 'bad_target'; end if;
  before := jsonb_build_object('placements',st.placements,'snapshot',st.locked_snapshot,'plates',(select jsonb_object_agg(plate_id,status) from iso_plates where session_id=s.id));
  prev := st.placements->>_plate;
  update iso_state set placements = case when _target is null then placements - _plate else placements || jsonb_build_object(_plate,_target) end,
    locked_snapshot = case when locked_snapshot is not null then (case when _target is null then locked_snapshot - _plate else locked_snapshot || jsonb_build_object(_plate,_target) end) else null end,
    version=version+1 where session_id=s.id and question_key=_key;
  if st.resolved then res := iso_resolve(s.id,_key,true); end if;
  perform iso_log(s.id, case when _undo then 'undo' when pending_fix then 'pending_completion' when _correction then 'correction' else 'move' end, _key,
    jsonb_build_object('plate',_plate,'color',pl.color,'from',prev,'to',_target,'note',_note,'before',before,'result',res,
      'after_plates',(select jsonb_object_agg(plate_id,status) from iso_plates where session_id=s.id)));
  perform iso_notify(_code);
  return jsonb_build_object('ok',true,'version',st.version+1);
end $$;
revoke all on function public.iso_place(text,text,text,text,text,bigint,boolean,text,boolean) from public, anon, authenticated;
grant execute on function public.iso_place(text,text,text,text,text,bigint,boolean,text,boolean) to service_role;
