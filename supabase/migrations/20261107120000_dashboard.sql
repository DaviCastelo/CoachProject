-- Painel principal: os números do negócio numa ida só ao banco.
--
-- O volume é de centenas de linhas, então somar na hora é barato e nunca fica
-- defasado. Duas funções, porque a separação é de quem pode ver:
--
--   dashboard_finance     owner e admin: dinheiro
--   dashboard_operations  toda a equipe: inscrições, presença, grupos
--
-- Datas e dias sempre no fuso da organização. Em UTC, um pagamento das 22h em
-- Nova York cairia no dia seguinte, e o fechamento do mês não bateria com o
-- extrato do Venmo.
--
-- `p_from`/`p_to` é o período escolhido e `p_prev_*` o período de comparação.
-- Quem decide o que é "este mês" é o domínio (resolvePeriod): aqui só se soma.

create or replace function dashboard_finance(
  p_org       uuid,
  p_from      date,
  p_to        date,
  p_prev_from date,
  p_prev_to   date
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_tz     text;
  v_today  date;
  v_result jsonb;
begin
  if not has_org_role(p_org, array['owner','admin']::org_role[]) then
    raise exception 'forbidden';
  end if;

  select timezone into v_tz from organizations where id = p_org;
  v_today := (now() at time zone v_tz)::date;

  with received as (
    -- `refunded` entra aqui e sai no desconto abaixo: filtrar pelo status e
    -- ainda subtrair o reembolso contaria o mesmo dinheiro duas vezes para menos.
    --
    -- O webhook grava o total acumulado reembolsado em cada linha, então o
    -- valor certo é o MAIOR por pagamento, não a soma.
    select
      p.id,
      p.invoice_id,
      p.method,
      p.amount_cents - coalesce(r.refunded_cents, 0) as net_cents,
      coalesce(r.refunded_cents, 0)                  as refunded_cents,
      coalesce(p.fee_cents, 0)                       as fee_cents,
      coalesce(p.paid_at, p.created_at)              as paid_at,
      (coalesce(p.paid_at, p.created_at) at time zone v_tz)::date as day
    from payments p
    left join lateral (
      select max(rf.amount_cents) as refunded_cents
        from refunds rf
       where rf.payment_id = p.id
         and rf.status in ('succeeded', 'refunded')
    ) r on true
    where p.organization_id = p_org
      and p.status in ('succeeded', 'partially_refunded', 'refunded')
  ),
  issued as (
    select i.id, i.total_cents, i.discount_cents, b.paid_cents,
           (i.created_at at time zone v_tz)::date as day
      from invoices i
      join invoice_balances b on b.invoice_id = i.id
     where i.organization_id = p_org
       and i.status not in ('draft', 'void')
  ),
  unpaid as (
    select i.id, i.number, i.due_on, i.created_at, b.balance_cents, b.pending_cents,
           btrim(concat(a.first_name, ' ', a.last_name)) as athlete_name
      from invoices i
      join invoice_balances b on b.invoice_id = i.id
      left join athletes a on a.id = i.athlete_id
     where i.organization_id = p_org
       and i.status = 'open'
       and b.balance_cents > 0
  )
  select jsonb_build_object(
    'received_cents', (select coalesce(sum(net_cents), 0) from received where day between p_from and p_to),
    'prev_received_cents', (select coalesce(sum(net_cents), 0) from received where day between p_prev_from and p_prev_to),
    'payment_count', (select count(*) from received where day between p_from and p_to),
    'prev_payment_count', (select count(*) from received where day between p_prev_from and p_prev_to),
    'refunded_cents', (select coalesce(sum(refunded_cents), 0) from received where day between p_from and p_to),
    'fee_cents', (select coalesce(sum(fee_cents), 0) from received where day between p_from and p_to),
    'invoiced_cents', (select coalesce(sum(total_cents), 0) from issued where day between p_from and p_to),
    'prev_invoiced_cents', (select coalesce(sum(total_cents), 0) from issued where day between p_prev_from and p_prev_to),
    'invoice_count', (select count(*) from issued where day between p_from and p_to),
    'collected_of_invoiced_cents', (
      select coalesce(sum(least(paid_cents, total_cents)), 0) from issued where day between p_from and p_to
    ),
    'discount_cents', (select coalesce(sum(discount_cents), 0) from issued where day between p_from and p_to),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', day, 'value', cents) order by day), '[]'::jsonb)
        from (
          select day, sum(net_cents) as cents
            from received
           where day between least(p_from, p_prev_from) and greatest(p_to, p_prev_to)
           group by day
        ) d
    ),
    'by_method', (
      select coalesce(jsonb_agg(jsonb_build_object('key', method, 'value', cents) order by cents desc), '[]'::jsonb)
        from (
          select method::text as method, sum(net_cents) as cents
            from received where day between p_from and p_to
           group by method
        ) m
    ),
    'by_program', (
      select coalesce(jsonb_agg(jsonb_build_object('key', name, 'value', cents) order by cents desc), '[]'::jsonb)
        from (
          select pr.name, sum(rc.net_cents) as cents
            from received rc
            left join lateral (
              select r.program_id from registrations r where r.invoice_id = rc.invoice_id limit 1
            ) reg on true
            left join programs pr on pr.id = reg.program_id
           where rc.day between p_from and p_to
           group by pr.name
        ) m
    ),
    'monthly', (
      select jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'), 'value', coalesce(s.cents, 0)) order by m)
        from generate_series(
          date_trunc('month', v_today::timestamp) - interval '11 months',
          date_trunc('month', v_today::timestamp),
          interval '1 month'
        ) m
        left join (
          select date_trunc('month', day::timestamp) as month, sum(net_cents) as cents
            from received group by 1
        ) s on s.month = m
    ),
    'open_invoices', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'number', number, 'athlete', athlete_name, 'due_on', due_on,
        'created_at', created_at, 'balance_cents', balance_cents, 'pending_cents', pending_cents
      ) order by coalesce(due_on, created_at::date)), '[]'::jsonb)
        from (select * from unpaid order by coalesce(due_on, created_at::date) limit 500) u
    ),
    'recent_payments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'athlete', athlete_name, 'cents', net_cents, 'method', method, 'paid_at', paid_at
      ) order by paid_at desc), '[]'::jsonb)
        from (
          select rc.id, rc.net_cents, rc.method::text as method, rc.paid_at,
                 btrim(concat(a.first_name, ' ', a.last_name)) as athlete_name
            from received rc
            join invoices i on i.id = rc.invoice_id
            left join athletes a on a.id = i.athlete_id
           order by rc.paid_at desc
           limit 6
        ) recent
    ),
    'uninvoiced_count', (
      select count(*) from registrations r
       where r.organization_id = p_org
         and r.status = 'approved'
         and r.invoice_id is null
         and r.program_option_id is not null
    ),
    'expiring_holds', (
      select count(*) from registrations r
        join invoices i on i.id = r.invoice_id
       where r.organization_id = p_org
         and i.status = 'open'
         and r.reserved_until between now() and now() + interval '48 hours'
    ),
    'failed_emails', (
      select count(*) from notifications n
       where n.organization_id = p_org and n.status = 'failed'
    ),
    'paid_forms_closed', (
      select count(*) from forms f
       where f.organization_id = p_org
         and f.status = 'published'
         and f.requires_payment
         and not exists (
           select 1 from programs pr
             join program_options po on po.program_id = pr.id and po.is_active
            where pr.status = 'published'
              and (pr.id = f.program_id or pr.form_id = f.id)
         )
    )
  ) into v_result;

  return v_result;
end $$;

create or replace function dashboard_operations(
  p_org       uuid,
  p_from      date,
  p_to        date,
  p_prev_from date,
  p_prev_to   date
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_tz     text;
  v_today  date;
  v_result jsonb;
begin
  if not is_staff(p_org) then
    raise exception 'forbidden';
  end if;

  select timezone into v_tz from organizations where id = p_org;
  v_today := (now() at time zone v_tz)::date;

  with regs as (
    select r.id, r.status, r.invoice_id, r.program_id, r.athlete_id, r.created_at,
           (r.created_at at time zone v_tz)::date as day
      from registrations r
     where r.organization_id = p_org
  ),
  -- Rascunho não aconteceu, e treino futuro ainda não pode ter faltado ninguém.
  held as (
    select s.id, s.starts_at, s.ends_at, (s.starts_at at time zone v_tz)::date as day
      from sessions s
     where s.organization_id = p_org
       and s.status <> 'canceled'
       and s.published_at is not null
       and s.starts_at <= now()
  ),
  marks as (
    select a.athlete_id, a.session_id, a.status, a.responded_at, h.day, h.starts_at
      from session_attendance a
      join held h on h.id = a.session_id
     where a.organization_id = p_org
  ),
  members as (
    select gm.group_id, gm.athlete_id, gm.status
      from group_members gm
     where gm.organization_id = p_org
  ),
  active_athletes as (
    select a.id, a.first_name, a.last_name, a.date_of_birth, a.household_id, a.created_at
      from athletes a
     where a.organization_id = p_org
       and a.status = 'active'
       and a.deleted_at is null
  )
  select jsonb_build_object(
    'registrations', (select count(*) from regs where day between p_from and p_to),
    'prev_registrations', (select count(*) from regs where day between p_prev_from and p_prev_to),
    'pending_registrations', (select count(*) from regs where status = 'pending'),
    'waitlisted', (select count(*) from regs where status = 'waitlisted'),
    'funnel', jsonb_build_object(
      'received', (select count(*) from regs where day between p_from and p_to),
      'approved', (
        select count(*) from regs
         where day between p_from and p_to and status in ('approved', 'completed')
      ),
      'invoiced', (
        select count(*) from regs
         where day between p_from and p_to and invoice_id is not null
      ),
      'paid', (
        select count(*) from regs r join invoices i on i.id = r.invoice_id
         where r.day between p_from and p_to and i.status = 'paid'
      )
    ),
    'registrations_daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', day, 'value', n) order by day), '[]'::jsonb)
        from (
          select day, count(*) as n from regs
           where day between least(p_from, p_prev_from) and greatest(p_to, p_prev_to)
           group by day
        ) d
    ),
    'by_program', (
      select coalesce(jsonb_agg(jsonb_build_object('key', name, 'value', n) order by n desc), '[]'::jsonb)
        from (
          select pr.name, count(*) as n
            from regs r left join programs pr on pr.id = r.program_id
           where r.day between p_from and p_to
             and r.status not in ('canceled', 'rejected')
           group by pr.name
        ) m
    ),
    'active_athletes', (select count(*) from active_athletes),
    'families', (select count(distinct household_id) from active_athletes),
    'new_athletes', (
      select count(*) from active_athletes
       where (created_at at time zone v_tz)::date between p_from and p_to
    ),
    'prev_new_athletes', (
      select count(*) from active_athletes
       where (created_at at time zone v_tz)::date between p_prev_from and p_prev_to
    ),
    'birth_years', (
      select coalesce(jsonb_agg(jsonb_build_object('year', y, 'value', n) order by y desc), '[]'::jsonb)
        from (
          select extract(year from date_of_birth)::int as y, count(*) as n
            from active_athletes group by 1
        ) b
    ),
    'sessions_held', (select count(*) from held where day between p_from and p_to),
    'prev_sessions_held', (select count(*) from held where day between p_prev_from and p_prev_to),
    'minutes_trained', (
      select coalesce(round(sum(extract(epoch from (ends_at - starts_at)) / 60)), 0)
        from held where day between p_from and p_to
    ),
    'sessions_canceled', (
      select count(*) from sessions s
       where s.organization_id = p_org
         and s.status = 'canceled'
         and (s.starts_at at time zone v_tz)::date between p_from and p_to
    ),
    -- Excused fica fora das duas contas: avisou, não é falta nem presença.
    'attended', (
      select count(*) from marks where day between p_from and p_to and status in ('present', 'late')
    ),
    'missed', (
      select count(*) from marks where day between p_from and p_to and status in ('absent', 'no_show')
    ),
    'prev_attended', (
      select count(*) from marks where day between p_prev_from and p_prev_to and status in ('present', 'late')
    ),
    'prev_missed', (
      select count(*) from marks where day between p_prev_from and p_prev_to and status in ('absent', 'no_show')
    ),
    'rsvp_answered', (
      select count(*) from marks where day between p_from and p_to and responded_at is not null
    ),
    'rsvp_total', (select count(*) from marks where day between p_from and p_to),
    'attendance_daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', day, 'value', n) order by day), '[]'::jsonb)
        from (
          select day, count(*) as n from marks
           where day between p_from and p_to and status in ('present', 'late')
           group by day
        ) d
    ),
    'weekdays', (
      select coalesce(jsonb_agg(jsonb_build_object('dow', dow, 'value', n) order by dow), '[]'::jsonb)
        from (
          select extract(isodow from day)::int as dow, count(*) as n
            from held where day between p_from and p_to group by 1
        ) w
    ),
    'activity', (
      select coalesce(jsonb_agg(jsonb_build_object('day', day, 'value', n) order by day), '[]'::jsonb)
        from (
          select day, count(*) as n from held where day > v_today - 84 group by day
        ) a
    ),
    -- Só conta como sumido quem foi chamado para um treino com presença tomada
    -- e não veio. Sem isso, a semana em que ninguém marca presença faria o
    -- clube inteiro aparecer como desaparecido.
    'missing_athletes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'last_seen', last_seen, 'days', days
      ) order by days desc), '[]'::jsonb)
        from (
          select a.id,
                 btrim(concat(a.first_name, ' ', a.last_name)) as name,
                 ls.last_seen,
                 v_today - (ls.last_seen at time zone v_tz)::date as days
            from active_athletes a
            join lateral (
              select max(m.starts_at) as last_seen
                from marks m
               where m.athlete_id = a.id and m.status in ('present', 'late')
            ) ls on ls.last_seen is not null
           where ls.last_seen < now() - interval '21 days'
             and exists (
               select 1 from marks m
                where m.athlete_id = a.id
                  and m.starts_at >= now() - interval '21 days'
                  and exists (
                    select 1 from marks other
                     where other.session_id = m.session_id
                       and other.status in ('present', 'late')
                  )
             )
           order by ls.last_seen
           limit 6
        ) missing
    ),
    'birthdays', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'date', d, 'age', age
      ) order by d), '[]'::jsonb)
        from (
          select a.id,
                 btrim(concat(a.first_name, ' ', a.last_name)) as name,
                 d::date as d,
                 extract(year from d)::int - extract(year from a.date_of_birth)::int as age
            from active_athletes a
            join generate_series(v_today::timestamp, (v_today + 7)::timestamp, interval '1 day') d
              on to_char(a.date_of_birth, 'MM-DD') = to_char(d, 'MM-DD')
           limit 8
        ) b
    ),
    'groups', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'members', members, 'capacity', capacity, 'waitlist', waitlist
      ) order by fill desc, name), '[]'::jsonb)
        from (
          select g.id, g.name, g.capacity,
                 count(m.athlete_id) filter (where m.status in ('active', 'trial')) as members,
                 count(m.athlete_id) filter (where m.status = 'waitlist') as waitlist,
                 count(m.athlete_id) filter (where m.status in ('active', 'trial'))::numeric
                   / nullif(g.capacity, 0) as fill
            from groups g
            left join members m on m.group_id = g.id
           where g.organization_id = p_org
             and g.status = 'active'
             and g.capacity > 0
           group by g.id
           order by fill desc nulls last
           limit 8
        ) g
    ),
    'programs', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'taken', taken, 'capacity', capacity
      ) order by taken::numeric / capacity desc), '[]'::jsonb)
        from (
          select p.id, p.name, p.capacity,
                 count(r.id) filter (where r.status not in ('canceled', 'rejected')) as taken
            from programs p
            left join regs r on r.program_id = p.id
           where p.organization_id = p_org
             and p.status = 'published'
             and p.capacity > 0
           group by p.id
           limit 6
        ) p
    ),
    'recent_registrations', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'athlete', athlete, 'program', program, 'status', status, 'created_at', created_at
      ) order by created_at desc), '[]'::jsonb)
        from (
          select r.id, r.status, r.created_at,
                 btrim(concat(a.first_name, ' ', a.last_name)) as athlete,
                 pr.name as program
            from regs r
            join athletes a on a.id = r.athlete_id
            left join programs pr on pr.id = r.program_id
           order by r.created_at desc
           limit 6
        ) recent
    )
  ) into v_result;

  return v_result;
end $$;

revoke all on function dashboard_finance(uuid, date, date, date, date) from public, anon;
revoke all on function dashboard_operations(uuid, date, date, date, date) from public, anon;
grant execute on function dashboard_finance(uuid, date, date, date, date) to authenticated;
grant execute on function dashboard_operations(uuid, date, date, date, date) to authenticated;
