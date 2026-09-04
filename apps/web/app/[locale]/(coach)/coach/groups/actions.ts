'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

export type GroupListItem = {
  id: string;
  name: string;
  parentGroupId: string | null;
  sortOrder: number;
  status: string;
  ageGroup: string | null;
  capacity: number;
  memberCount: number;
  coachCount: number;
  /** O usuário logado treina este grupo? (destaca "meus grupos" na lista) */
  isMine: boolean;
};

export type RosterMember = {
  id: string;
  athleteId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  status: string;
  joinedAt: string;
  allergies: string | null;
  medicalNotes: string | null;
  otherGroups: string[];
  /** O atleta já tem login próprio? */
  hasAccount: boolean;
  accountEmail: string | null;
};

export type GroupCoach = {
  id: string;
  coachId: string;
  fullName: string;
  email: string | null;
  isLead: boolean;
};

export type GroupDetail = {
  id: string;
  name: string;
  parentGroupId: string | null;
  parentName: string | null;
  status: string;
  ageGroup: string | null;
  capacity: number;
  notes: string | null;
  members: RosterMember[];
  coaches: GroupCoach[];
};

async function getDb(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

const STAFF = ['owner', 'admin', 'coach', 'staff'] as const;
const ADMIN = ['owner', 'admin'] as const;

/** Lista todos os grupos da org com contagens, para montar a árvore. */
export async function listGroups(): Promise<GroupListItem[]> {
  const ctx = await requireRole([...STAFF]);
  const db = await getDb();

  const { data } = await db
    .from('groups')
    .select('id, name, parent_group_id, sort_order, status, age_group, capacity')
    .eq('organization_id', ctx.orgId)
    .order('sort_order', { ascending: true });

  const groups = (data ?? []) as {
    id: string;
    name: string;
    parent_group_id: string | null;
    sort_order: number;
    status: string;
    age_group: string | null;
    capacity: number;
  }[];

  if (groups.length === 0) return [];

  const ids = groups.map((g) => g.id);

  const [{ data: memberRows }, { data: coachRows }] = await Promise.all([
    db.from('group_members').select('group_id').in('group_id', ids).is('left_at', null),
    db.from('group_coaches').select('group_id, coach_id').in('group_id', ids),
  ]);

  const memberCount = new Map<string, number>();
  for (const r of (memberRows ?? []) as { group_id: string }[]) {
    memberCount.set(r.group_id, (memberCount.get(r.group_id) ?? 0) + 1);
  }
  const coachCount = new Map<string, number>();
  const mine = new Set<string>();
  for (const r of (coachRows ?? []) as { group_id: string; coach_id: string }[]) {
    coachCount.set(r.group_id, (coachCount.get(r.group_id) ?? 0) + 1);
    if (r.coach_id === ctx.userId) mine.add(r.group_id);
  }

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    parentGroupId: g.parent_group_id,
    sortOrder: g.sort_order ?? 0,
    status: g.status,
    ageGroup: g.age_group,
    capacity: g.capacity,
    memberCount: memberCount.get(g.id) ?? 0,
    coachCount: coachCount.get(g.id) ?? 0,
    isMine: mine.has(g.id),
  }));
}

/** Detalhe de um grupo com roster e coaches. */
export async function getGroup(groupId: string): Promise<GroupDetail | null> {
  const ctx = await requireRole([...STAFF]);
  const db = await getDb();

  const { data: group } = await db
    .from('groups')
    .select('id, name, parent_group_id, status, age_group, capacity, notes')
    .eq('id', groupId)
    .eq('organization_id', ctx.orgId)
    .maybeSingle();

  if (!group) return null;
  const g = group as {
    id: string;
    name: string;
    parent_group_id: string | null;
    status: string;
    age_group: string | null;
    capacity: number;
    notes: string | null;
  };

  let parentName: string | null = null;
  if (g.parent_group_id) {
    const { data: parent } = await db
      .from('groups')
      .select('name')
      .eq('id', g.parent_group_id)
      .maybeSingle();
    parentName = (parent as { name: string } | null)?.name ?? null;
  }

  const { data: memberRows } = await db
    .from('group_members')
    .select(
      'id, athlete_id, status, joined_at, athletes(first_name, last_name, date_of_birth, allergies, medical_notes, user_id)',
    )
    .eq('group_id', groupId)
    .is('left_at', null)
    .order('joined_at', { ascending: true });

  const members = (memberRows ?? []) as unknown as {
    id: string;
    athlete_id: string;
    status: string;
    joined_at: string;
    athletes: {
      first_name: string;
      last_name: string;
      date_of_birth: string;
      allergies: string | null;
      medical_notes: string | null;
      user_id: string | null;
    } | null;
  }[];

  // E-mail de acesso dos atletas que já têm login.
  const accountIds = members.map((m) => m.athletes?.user_id).filter((id): id is string => !!id);
  const emailByUser = new Map<string, string>();
  if (accountIds.length > 0) {
    const { data: profileRows } = await db
      .from('profiles')
      .select('id, email')
      .in('id', accountIds);
    for (const p of (profileRows ?? []) as { id: string; email: string }[]) {
      emailByUser.set(p.id, p.email);
    }
  }

  // Outras participações dos mesmos atletas (brief §4: player em vários grupos).
  const athleteIds = members.map((m) => m.athlete_id);
  const otherGroupsByAthlete = new Map<string, string[]>();
  if (athleteIds.length > 0) {
    const { data: others } = await db
      .from('group_members')
      .select('athlete_id, groups(name)')
      .in('athlete_id', athleteIds)
      .neq('group_id', groupId)
      .is('left_at', null);

    for (const row of (others ?? []) as unknown as {
      athlete_id: string;
      groups: { name: string } | null;
    }[]) {
      if (!row.groups) continue;
      const list = otherGroupsByAthlete.get(row.athlete_id) ?? [];
      list.push(row.groups.name);
      otherGroupsByAthlete.set(row.athlete_id, list);
    }
  }

  const { data: coachRows } = await db
    .from('group_coaches')
    .select('id, coach_id, is_lead, profiles(full_name, email)')
    .eq('group_id', groupId);

  const coaches = (coachRows ?? []) as unknown as {
    id: string;
    coach_id: string;
    is_lead: boolean;
    profiles: { full_name: string | null; email: string | null } | null;
  }[];

  return {
    id: g.id,
    name: g.name,
    parentGroupId: g.parent_group_id,
    parentName,
    status: g.status,
    ageGroup: g.age_group,
    capacity: g.capacity,
    notes: g.notes,
    members: members.map((m) => ({
      id: m.id,
      athleteId: m.athlete_id,
      firstName: m.athletes?.first_name ?? '—',
      lastName: m.athletes?.last_name ?? '',
      dateOfBirth: m.athletes?.date_of_birth ?? '',
      status: m.status,
      joinedAt: m.joined_at,
      allergies: m.athletes?.allergies ?? null,
      medicalNotes: m.athletes?.medical_notes ?? null,
      otherGroups: otherGroupsByAthlete.get(m.athlete_id) ?? [],
      hasAccount: Boolean(m.athletes?.user_id),
      accountEmail: m.athletes?.user_id ? (emailByUser.get(m.athletes.user_id) ?? null) : null,
    })),
    coaches: coaches.map((c) => ({
      id: c.id,
      coachId: c.coach_id,
      fullName: c.profiles?.full_name ?? '—',
      email: c.profiles?.email ?? null,
      isLead: c.is_lead,
    })),
  };
}

export async function createGroup(input: {
  name: string;
  parentGroupId?: string | null;
  ageGroup?: string | null;
  capacity?: number;
}): Promise<CreateResult> {
  const ctx = await requireRole([...ADMIN]);
  const db = await getDb();

  const name = input.name.trim();
  if (!name) return { ok: false, error: 'name_required' };

  const { data, error } = await db
    .from('groups')
    .insert({
      organization_id: ctx.orgId,
      name,
      parent_group_id: input.parentGroupId || null,
      age_group: input.ageGroup?.trim() || null,
      capacity: input.capacity ?? 8,
    })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? 'create_failed' };

  revalidatePath('/coach/groups');
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateGroup(
  groupId: string,
  patch: {
    name?: string;
    parentGroupId?: string | null;
    ageGroup?: string | null;
    capacity?: number;
    status?: string;
    notes?: string | null;
  },
): Promise<ActionResult> {
  const ctx = await requireRole([...ADMIN]);
  const db = await getDb();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.parentGroupId !== undefined) update.parent_group_id = patch.parentGroupId || null;
  if (patch.ageGroup !== undefined) update.age_group = patch.ageGroup?.trim() || null;
  if (patch.capacity !== undefined) update.capacity = patch.capacity;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.notes !== undefined) update.notes = patch.notes;

  const { error } = await db
    .from('groups')
    .update(update)
    .eq('id', groupId)
    .eq('organization_id', ctx.orgId);

  if (error) {
    // Mensagens do trigger check_group_cycle.
    if (error.message.includes('group_cycle')) return { ok: false, error: 'group_cycle' };
    if (error.message.includes('group_depth')) return { ok: false, error: 'group_depth' };
    return { ok: false, error: error.message };
  }

  revalidatePath('/coach/groups');
  revalidatePath(`/coach/groups/${groupId}`);
  return { ok: true };
}

/**
 * Ajusta somente a quantidade de vagas. Liberado para admin E para o coach do
 * grupo — via RPC dedicada, para o coach não ganhar escrita livre em `groups`.
 */
export async function setGroupCapacity(
  groupId: string,
  capacity: number,
): Promise<ActionResult> {
  await requireRole([...STAFF]);
  const db = await getDb();

  if (!Number.isInteger(capacity) || capacity < 1) {
    return { ok: false, error: 'invalid_capacity' };
  }

  const { error } = await db.rpc('set_group_capacity', {
    p_group_id: groupId,
    p_capacity: capacity,
  });

  if (error) {
    if (error.message.includes('forbidden')) return { ok: false, error: 'forbidden' };
    return { ok: false, error: error.message };
  }

  revalidatePath('/coach/groups');
  revalidatePath(`/coach/groups/${groupId}`);
  return { ok: true };
}

/** Apaga o grupo. Bloqueado se houver subgrupos (FK restrict) ou membros. */
export async function deleteGroup(groupId: string): Promise<ActionResult> {
  const ctx = await requireRole([...ADMIN]);
  const db = await getDb();

  const { count: childCount } = await db
    .from('groups')
    .select('id', { count: 'exact', head: true })
    .eq('parent_group_id', groupId);
  if ((childCount ?? 0) > 0) return { ok: false, error: 'has_subgroups' };

  const { count: memberCount } = await db
    .from('group_members')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId);
  if ((memberCount ?? 0) > 0) return { ok: false, error: 'has_members' };

  const { error } = await db
    .from('groups')
    .delete()
    .eq('id', groupId)
    .eq('organization_id', ctx.orgId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/coach/groups');
  return { ok: true };
}

/** Atletas que ainda não estão no grupo (para o seletor "adicionar ao roster"). */
export async function listAssignableAthletes(
  groupId: string,
  search?: string,
): Promise<{ id: string; name: string; dateOfBirth: string }[]> {
  const ctx = await requireRole([...STAFF]);
  const db = await getDb();

  const { data: existing } = await db
    .from('group_members')
    .select('athlete_id')
    .eq('group_id', groupId)
    .is('left_at', null);
  const taken = new Set(((existing ?? []) as { athlete_id: string }[]).map((r) => r.athlete_id));

  let query = db
    .from('athletes')
    .select('id, first_name, last_name, date_of_birth')
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .order('first_name', { ascending: true })
    .limit(100);

  const term = search?.trim();
  if (term) {
    query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`);
  }

  const { data } = await query;

  return ((data ?? []) as {
    id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string;
  }[])
    .filter((a) => !taken.has(a.id))
    .map((a) => ({
      id: a.id,
      name: `${a.first_name} ${a.last_name}`,
      dateOfBirth: a.date_of_birth,
    }));
}

export async function addGroupMembers(
  groupId: string,
  athleteIds: string[],
): Promise<ActionResult> {
  const ctx = await requireRole([...STAFF]);
  const db = await getDb();
  if (athleteIds.length === 0) return { ok: true };

  const rows = athleteIds.map((athleteId) => ({
    organization_id: ctx.orgId,
    group_id: groupId,
    athlete_id: athleteId,
    added_by: ctx.userId,
    status: 'active',
    left_at: null,
  }));

  const { error } = await db
    .from('group_members')
    .upsert(rows, { onConflict: 'group_id,athlete_id' });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/coach/groups/${groupId}`);
  revalidatePath('/coach/groups');
  return { ok: true };
}

/** Remoção é SOFT (brief §5): o atleta continua existindo, sai apenas do grupo. */
export async function removeGroupMember(
  groupId: string,
  athleteId: string,
): Promise<ActionResult> {
  await requireRole([...STAFF]);
  const db = await getDb();

  const { error } = await db
    .from('group_members')
    .update({ status: 'removed', left_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('group_id', groupId)
    .eq('athlete_id', athleteId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/coach/groups/${groupId}`);
  revalidatePath('/coach/groups');
  return { ok: true };
}

/** Move o atleta de um grupo para outro (encerra a participação antiga e cria a nova). */
export async function moveGroupMember(
  athleteId: string,
  fromGroupId: string,
  toGroupId: string,
): Promise<ActionResult> {
  if (fromGroupId === toGroupId) return { ok: true };
  const removed = await removeGroupMember(fromGroupId, athleteId);
  if (!removed.ok) return removed;
  return addGroupMembers(toGroupId, [athleteId]);
}

/** Staff da organização que pode ser coach de um grupo. */
export async function listOrgCoaches(): Promise<{ id: string; name: string; email: string | null }[]> {
  const ctx = await requireRole([...STAFF]);
  const db = await getDb();

  // `memberships` tem DUAS FKs para profiles (user_id e invited_by); sem
  // nomear a constraint o embed fica ambíguo e o PostgREST devolve erro.
  const { data } = await db
    .from('memberships')
    .select('user_id, role, profiles!memberships_user_id_fkey(full_name, email)')
    .eq('organization_id', ctx.orgId)
    .eq('status', 'active')
    .in('role', ['owner', 'admin', 'coach', 'staff']);

  const seen = new Set<string>();
  const out: { id: string; name: string; email: string | null }[] = [];
  for (const row of (data ?? []) as unknown as {
    user_id: string;
    profiles: { full_name: string | null; email: string | null } | null;
  }[]) {
    if (seen.has(row.user_id)) continue;
    seen.add(row.user_id);
    out.push({
      id: row.user_id,
      name: row.profiles?.full_name ?? row.profiles?.email ?? '—',
      email: row.profiles?.email ?? null,
    });
  }
  return out;
}

export type CreateCoachInput = {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  role: 'coach' | 'staff' | 'admin';
  addToGroupId?: string;
  isLead?: boolean;
};

/**
 * Cria a conta de um novo membro da equipe (coach/staff/admin) e, opcionalmente,
 * já o atribui a um grupo. Usa a service role porque criar usuário no Auth exige
 * privilégio de admin — por isso a autorização é checada aqui, explicitamente.
 */
export async function createCoachAccount(input: CreateCoachInput): Promise<CreateResult> {
  const ctx = await requireRole([...ADMIN]);

  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!fullName) return { ok: false, error: 'name_required' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'invalid_email' };
  if (password.length < 8) return { ok: false, error: 'weak_password' };

  const svc = createServiceClient();

  // 1. Conta no Auth já confirmada — o coach entra com e-mail e senha na hora.
  const { data: created, error: createError } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created?.user) {
    const msg = createError?.message ?? 'create_failed';
    if (msg.toLowerCase().includes('already')) return { ok: false, error: 'email_taken' };
    return { ok: false, error: msg };
  }

  const userId = created.user.id;

  // 2. O trigger handle_new_user cria o profile; completamos o que ele não copia.
  await svc
    .from('profiles')
    .update({ full_name: fullName, phone: input.phone?.trim() || null })
    .eq('id', userId);

  // 3. Vínculo com a organização.
  const { error: membershipError } = await svc.from('memberships').insert({
    organization_id: ctx.orgId,
    user_id: userId,
    role: input.role,
    status: 'active',
    invited_by: ctx.userId,
    invited_at: new Date().toISOString(),
    accepted_at: new Date().toISOString(),
  });

  if (membershipError) {
    // Não deixa uma conta órfã (sem organização) para trás.
    await svc.auth.admin.deleteUser(userId);
    return { ok: false, error: membershipError.message };
  }

  // 4. Opcional: já entra como coach do grupo em que o admin estava.
  if (input.addToGroupId) {
    const { error: coachError } = await svc.from('group_coaches').insert({
      organization_id: ctx.orgId,
      group_id: input.addToGroupId,
      coach_id: userId,
      is_lead: input.isLead ?? false,
    });
    if (coachError) return { ok: false, error: coachError.message };
    revalidatePath(`/coach/groups/${input.addToGroupId}`);
  }

  revalidatePath('/coach/groups');
  return { ok: true, id: userId };
}

export async function addGroupCoach(groupId: string, coachId: string): Promise<ActionResult> {
  const ctx = await requireRole([...ADMIN]);
  const db = await getDb();

  const { error } = await db
    .from('group_coaches')
    .upsert(
      { organization_id: ctx.orgId, group_id: groupId, coach_id: coachId },
      { onConflict: 'group_id,coach_id' },
    );

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/coach/groups/${groupId}`);
  return { ok: true };
}

export async function removeGroupCoach(groupId: string, coachId: string): Promise<ActionResult> {
  await requireRole([...ADMIN]);
  const db = await getDb();

  const { error } = await db
    .from('group_coaches')
    .delete()
    .eq('group_id', groupId)
    .eq('coach_id', coachId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/coach/groups/${groupId}`);
  return { ok: true };
}
