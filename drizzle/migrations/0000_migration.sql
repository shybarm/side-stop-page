
create table public.game_sessions(
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  game_hash text not null, director_hash text not null, output_hash text not null,
  game_state jsonb not null default '{}'::jsonb,
  question jsonb,
  question_key text,
  game_version bigint not null default 0,
  last_event_seq bigint not null default 0,
  heartbeat_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.iso_plates(
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  plate_id text not null, color text not null, ord int not null,
  status text not null default 'active', -- active | eliminated | pending
  status_key text,
  primary key(session_id, plate_id)
);
create table public.iso_state(
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  question_key text not null,
  pool text[] not null default '{}',
  placements jsonb not null default '{}'::jsonb,
  locked_snapshot jsonb,
  correct_answer text,
  resolved boolean not null default false,
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  primary key(session_id, question_key)
);
create table public.iso_events(
  id bigserial primary key,
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  ts timestamptz not null default clock_timestamp(),
  kind text not null, question_key text, client_event_id text, seq bigint,
  data jsonb not null default '{}'::jsonb
);
create unique index iso_events_client_uid on public.iso_events(session_id, client_event_id) where client_event_id is not null;
grant all on public.game_sessions, public.iso_plates, public.iso_state, public.iso_events to service_role;
grant usage, select on sequence public.iso_events_id_seq to service_role;
alter table public.game_sessions enable row level security;
alter table public.iso_plates enable row level security;
alter table public.iso_state enable row level security;
alter table public.iso_events enable row level security;

create or replace function public.iso_auth(_code text, _hash text, _roles text[]) returns public.game_sessions
language plpgsql security definer set search_path=public as $$
declare s public.game_sessions;
begin
  select * into s from game_sessions where code=upper(_code);
  if s.id is null then raise exception 'session_not_found'; end if;
  if not ((('game'=any(_roles)) and s.game_hash=_hash) or (('director'=any(_roles)) and s.director_hash=_hash) or (('output'=any(_roles)) and s.output_hash=_hash)) then
    raise exception 'forbidden'; end if;
  return s;
end $$;

create or replace function public.iso_notify(_code text) returns void language plpgsql security definer set search_path=public as $$
begin
  begin perform realtime.send(jsonb_build_object('t',extract(epoch from clock_timestamp())), 'v', 'iso:'||upper(_code), false);
  exception when others then null; end;
end $$;

create or replace function public.iso_snapshot(_sid uuid, _key text) returns jsonb language sql security definer set search_path=public as $$
  select jsonb_build_object(
    'game', (select jsonb_build_object('state',game_state,'question',question,'question_key',question_key) from game_sessions where id=_sid),
    'plates', (select coalesce(jsonb_agg(jsonb_build_object('id',plate_id,'color',color,'status',status,'status_key',status_key) order by ord),'[]') from iso_plates where session_id=_sid),
    'iso', (select to_jsonb(x) - 'session_id' from iso_state x where session_id=_sid and question_key=_key));
$$;

create or replace function public.iso_log(_sid uuid, _kind text, _key text, _data jsonb, _ceid text default null, _seq bigint default null) returns void
language plpgsql security definer set search_path=public as $$
begin
  insert into iso_events(session_id,kind,question_key,data,client_event_id,seq)
  values(_sid,_kind,_key,_data || jsonb_build_object('snapshot', iso_snapshot(_sid,_key)),_ceid,_seq);
end $$;

create or replace function public.iso_ensure_state(_sid uuid, _key text) returns void language plpgsql security definer set search_path=public as $$
begin
  if _key is null then return; end if;
  insert into iso_state(session_id,question_key,pool)
  select _sid,_key,coalesce(array_agg(plate_id order by ord),'{}') from iso_plates where session_id=_sid and status='active'
  on conflict do nothing;
end $$;

-- resolve eliminations for a question from snapshot (or placements on correction)
create or replace function public.iso_resolve(_sid uuid, _key text, _use_current boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
declare st public.iso_state; src jsonb; p text; tgt text; res jsonb := '{}'::jsonb;
begin
  select * into st from iso_state where session_id=_sid and question_key=_key for update;
  if st.correct_answer is null then return res; end if;
  src := case when _use_current or st.locked_snapshot is null then st.placements else st.locked_snapshot end;
  foreach p in array st.pool loop
    tgt := src->>p;
    if tgt is null then
      update iso_plates set status='pending', status_key=_key where session_id=_sid and plate_id=p; res := res || jsonb_build_object(p,'pending');
    elsif tgt = st.correct_answer then
      update iso_plates set status='active', status_key=_key where session_id=_sid and plate_id=p; res := res || jsonb_build_object(p,'survived');
    else
      update iso_plates set status='eliminated', status_key=_key where session_id=_sid and plate_id=p; res := res || jsonb_build_object(p,'eliminated');
    end if;
  end loop;
  update iso_state set resolved=true where session_id=_sid and question_key=_key;
  return res;
end $$;

create or replace function public.iso_create_session(_code text, _g text, _d text, _o text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare sid uuid; colors text[] := array['#e23b3b','#2f7df6','#f2b705','#22a861','#9b51e0','#f2780c','#14b8c4','#f0f0f0'];
begin
  insert into game_sessions(code,game_hash,director_hash,output_hash) values(upper(_code),_g,_d,_o) returning id into sid;
  insert into iso_plates(session_id,plate_id,color,ord) select sid,'P'||i,colors[i],i from generate_series(1,8) i;
  perform iso_log(sid,'session_created',null,'{}'::jsonb);
  return jsonb_build_object('code',upper(_code));
end $$;

create or replace function public.iso_game_publish(_code text, _hash text, _version bigint, _state jsonb, _question jsonb, _key text, _event jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.game_sessions; seq bigint; kind text; applied boolean := false; res jsonb;
begin
  s := iso_auth(_code,_hash,array['game']);
  perform pg_advisory_xact_lock(hashtext(s.id::text));
  select * into s from game_sessions where id=s.id for update;
  if _event is not null then
    seq := (_event->>'seq')::bigint; kind := _event->>'kind';
    if seq > s.last_event_seq and not exists(select 1 from iso_events where session_id=s.id and client_event_id=_event->>'id') then
      perform iso_ensure_state(s.id, _event->>'question_key');
      if kind='lock' then
        update iso_state set locked_snapshot=placements where session_id=s.id and question_key=_event->>'question_key' and locked_snapshot is null;
      elsif kind='reveal' then
        update iso_state set locked_snapshot=coalesce(locked_snapshot,placements), correct_answer=_event->>'correct'
          where session_id=s.id and question_key=_event->>'question_key';
        if not (select resolved from iso_state where session_id=s.id and question_key=_event->>'question_key') then
          res := iso_resolve(s.id,_event->>'question_key',false);
        end if;
      end if;
      update game_sessions set last_event_seq=seq where id=s.id;
      perform iso_log(s.id,kind,_event->>'question_key',jsonb_build_object('event',_event,'result',res),_event->>'id',seq);
      applied := true;
    end if;
  end if;
  if _version > s.game_version then
    update game_sessions set game_state=_state, question=_question, question_key=_key, game_version=_version, heartbeat_at=now() where id=s.id;
    perform iso_ensure_state(s.id,_key);
  else
    update game_sessions set heartbeat_at=now() where id=s.id;
  end if;
  perform iso_notify(_code);
  return jsonb_build_object('ok',true,'event_applied',applied,'server_now',(extract(epoch from clock_timestamp())*1000)::bigint);
end $$;

create or replace function public.iso_heartbeat(_code text, _hash text) returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.game_sessions;
begin
  s := iso_auth(_code,_hash,array['game']);
  update game_sessions set heartbeat_at=now() where id=s.id;
  return jsonb_build_object('server_now',(extract(epoch from clock_timestamp())*1000)::bigint);
end $$;

create or replace function public.iso_get(_code text, _hash text) returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.game_sessions; role text; snap jsonb;
begin
  s := iso_auth(_code,_hash,array['game','director','output']);
  role := case when s.director_hash=_hash then 'director' when s.game_hash=_hash then 'game' else 'output' end;
  snap := iso_snapshot(s.id, s.question_key);
  if role='output' and coalesce(s.game_state->>'phase','') not in ('wiping','revealed','transition','progress') then
    snap := jsonb_set(snap,'{game,question}', coalesce(s.question,'{}'::jsonb) - 'correctAnswer');
    snap := snap #- '{iso,correct_answer}';
  end if;
  return snap || jsonb_build_object('role',role,'game_version',s.game_version,
    'heartbeat_at',(extract(epoch from s.heartbeat_at)*1000)::bigint,
    'server_now',(extract(epoch from clock_timestamp())*1000)::bigint);
end $$;

create or replace function public.iso_place(_code text, _hash text, _key text, _plate text, _target text, _expected bigint, _correction boolean, _note text, _undo boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.game_sessions; st public.iso_state; pl public.iso_plates; before jsonb; res jsonb; prev text;
begin
  s := iso_auth(_code,_hash,array['director']);
  perform pg_advisory_xact_lock(hashtext(s.id::text));
  select * into pl from iso_plates where session_id=s.id and plate_id=_plate;
  if pl.plate_id is null then raise exception 'plate_not_found'; end if;
  select * into st from iso_state where session_id=s.id and question_key=_key for update;
  if st.question_key is null then raise exception 'question_not_found'; end if;
  -- pending completion for an older question is allowed only for that plate
  if _key is distinct from s.question_key and not (pl.status='pending' and pl.status_key=_key) then raise exception 'stale_question'; end if;
  if not (_plate = any(st.pool)) then raise exception 'plate_not_in_pool'; end if;
  if pl.status='eliminated' and not _correction then raise exception 'plate_eliminated'; end if;
  if st.version <> _expected then raise exception 'version_conflict'; end if;
  if st.locked_snapshot is not null and not _correction and not (pl.status='pending' and st.resolved) then raise exception 'locked'; end if;
  if _target is not null and _target not in ('A','B','C','D') then raise exception 'bad_target'; end if;
  before := jsonb_build_object('placements',st.placements,'snapshot',st.locked_snapshot);
  prev := st.placements->>_plate;
  update iso_state set placements = case when _target is null then placements - _plate else placements || jsonb_build_object(_plate,_target) end,
    locked_snapshot = case when locked_snapshot is not null then (case when _target is null then locked_snapshot - _plate else locked_snapshot || jsonb_build_object(_plate,_target) end) else null end,
    version=version+1 where session_id=s.id and question_key=_key;
  if st.resolved then res := iso_resolve(s.id,_key,true); end if;
  perform iso_log(s.id, case when _undo then 'undo' when _correction then 'correction' when pl.status='pending' then 'pending_completion' else 'move' end, _key,
    jsonb_build_object('plate',_plate,'color',pl.color,'from',prev,'to',_target,'note',_note,'before',before,'result',res));
  perform iso_notify(_code);
  return jsonb_build_object('ok',true,'version',st.version+1);
end $$;

create or replace function public.iso_set_plate_status(_code text, _hash text, _plate text, _status text, _note text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare s public.game_sessions; pl public.iso_plates;
begin
  s := iso_auth(_code,_hash,array['director']);
  if _status not in ('active','eliminated') then raise exception 'bad_status'; end if;
  select * into pl from iso_plates where session_id=s.id and plate_id=_plate for update;
  update iso_plates set status=_status, status_key=s.question_key where session_id=s.id and plate_id=_plate;
  if _status='active' and s.question_key is not null then
    update iso_state set pool = array_append(pool,_plate) where session_id=s.id and question_key=s.question_key and not (_plate=any(pool));
  end if;
  perform iso_log(s.id,'status_correction',s.question_key,jsonb_build_object('plate',_plate,'color',pl.color,'from',pl.status,'to',_status,'note',_note));
  perform iso_notify(_code);
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.iso_get_events(_code text, _hash text) returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.game_sessions;
begin
  s := iso_auth(_code,_hash,array['director','game']);
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'ts',ts,'kind',kind,'question_key',question_key,'seq',seq,'client_event_id',client_event_id,'data',data) order by id),'[]') from iso_events where session_id=s.id);
end $$;

do $$ declare f text; begin
  foreach f in array array['iso_auth(text,text,text[])','iso_notify(text)','iso_snapshot(uuid,text)','iso_log(uuid,text,text,jsonb,text,bigint)','iso_ensure_state(uuid,text)','iso_resolve(uuid,text,boolean)','iso_create_session(text,text,text,text)','iso_game_publish(text,text,bigint,jsonb,jsonb,text,jsonb)','iso_heartbeat(text,text)','iso_get(text,text)','iso_place(text,text,text,text,text,bigint,boolean,text,boolean)','iso_set_plate_status(text,text,text,text,text)','iso_get_events(text,text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
