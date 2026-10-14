
create or replace function public.iso_resolve(_sid uuid, _key text, _use_current boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
declare st public.iso_state; src jsonb; p text; tgt text; ns text; res jsonb := '{}'::jsonb; cur text;
begin
  select * into st from iso_state where session_id=_sid and question_key=_key for update;
  if st.correct_answer is null then return res; end if;
  select question_key into cur from game_sessions where id=_sid;
  src := case when _use_current or st.locked_snapshot is null then st.placements else st.locked_snapshot end;
  foreach p in array st.pool loop
    tgt := src->>p;
    ns := case when tgt is null then 'pending' when tgt=st.correct_answer then 'active' else 'eliminated' end;
    update iso_plates set status=ns, status_key=_key
      where session_id=_sid and plate_id=p and (not _use_current or status_key=_key or status_key is null);
    if found then
      res := res || jsonb_build_object(p, case ns when 'active' then 'survived' else ns end);
      if ns='active' and cur is distinct from _key then
        update iso_state set pool=array_append(pool,p) where session_id=_sid and question_key=cur and not (p=any(pool));
      end if;
    end if;
  end loop;
  update iso_state set resolved=true where session_id=_sid and question_key=_key;
  return res;
end $$;
revoke all on function public.iso_resolve(uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.iso_resolve(uuid,text,boolean) to service_role;
