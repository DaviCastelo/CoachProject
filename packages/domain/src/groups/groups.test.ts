import { describe, it, expect } from 'vitest';
import {
  buildGroupTree,
  flattenGroupTree,
  collectDescendantIds,
  canReparent,
  type GroupNodeInput,
} from './tree';
import { tallyRsvp, isRsvpStatus, canRespondToSession } from './rsvp';

const U12: GroupNodeInput = { id: 'u12', name: 'U12', parentGroupId: null };
const BOYS: GroupNodeInput = { id: 'boys', name: 'U12 Boys', parentGroupId: 'u12' };
const GIRLS: GroupNodeInput = { id: 'girls', name: 'U12 Girls', parentGroupId: 'u12' };
const ADV: GroupNodeInput = { id: 'adv', name: 'U12 Advanced', parentGroupId: 'boys' };
const CAMP: GroupNodeInput = { id: 'camp', name: 'Summer Camp', parentGroupId: null };

const SAMPLE = [BOYS, U12, ADV, GIRLS, CAMP];

describe('buildGroupTree', () => {
  it('nests subgroups under their parent', () => {
    const tree = buildGroupTree(SAMPLE);
    expect(tree.map((n) => n.id)).toEqual(['camp', 'u12']); // ordenado por nome
    const u12 = tree.find((n) => n.id === 'u12');
    expect(u12?.children.map((c) => c.id)).toEqual(['boys', 'girls']);
    expect(u12?.children[0].children.map((c) => c.id)).toEqual(['adv']);
  });

  it('assigns depth by level', () => {
    const flat = flattenGroupTree(buildGroupTree(SAMPLE));
    const byId = Object.fromEntries(flat.map((n) => [n.id, n.depth]));
    expect(byId.u12).toBe(0);
    expect(byId.boys).toBe(1);
    expect(byId.adv).toBe(2);
  });

  it('promotes orphans to root instead of dropping them', () => {
    const orphan: GroupNodeInput = { id: 'x', name: 'Orphan', parentGroupId: 'does-not-exist' };
    const tree = buildGroupTree([U12, orphan]);
    expect(tree.map((n) => n.id).sort()).toEqual(['u12', 'x']);
  });

  it('does not hang on a cyclic parent reference', () => {
    const a: GroupNodeInput = { id: 'a', name: 'A', parentGroupId: 'b' };
    const b: GroupNodeInput = { id: 'b', name: 'B', parentGroupId: 'a' };
    const tree = buildGroupTree([a, b]);
    expect(flattenGroupTree(tree)).toHaveLength(2);
  });

  it('respects sortOrder before name', () => {
    const tree = buildGroupTree([
      { id: 'z', name: 'Zebra', parentGroupId: null, sortOrder: 1 },
      { id: 'a', name: 'Alpha', parentGroupId: null, sortOrder: 2 },
    ]);
    expect(tree.map((n) => n.id)).toEqual(['z', 'a']);
  });
});

describe('collectDescendantIds', () => {
  it('includes the root and every descendant', () => {
    expect(collectDescendantIds(SAMPLE, 'u12').sort()).toEqual(['adv', 'boys', 'girls', 'u12']);
  });

  it('returns only the group itself when it is a leaf', () => {
    expect(collectDescendantIds(SAMPLE, 'adv')).toEqual(['adv']);
  });
});

describe('canReparent', () => {
  it('allows moving to root', () => {
    expect(canReparent(SAMPLE, 'boys', null)).toBe(true);
  });

  it('rejects self-parenting', () => {
    expect(canReparent(SAMPLE, 'u12', 'u12')).toBe(false);
  });

  it('rejects becoming a child of its own descendant', () => {
    expect(canReparent(SAMPLE, 'u12', 'adv')).toBe(false);
  });

  it('allows a valid move', () => {
    expect(canReparent(SAMPLE, 'girls', 'camp')).toBe(true);
  });

  // Espelha o trigger `check_group_cycle`: a cadeia de ancestrais pode ter até
  // MAX_GROUP_DEPTH (5) níveis; acima disso o banco levanta 'group_depth'.
  const chain = (n: number): GroupNodeInput[] => [
    ...Array.from({ length: n }, (_, i) => ({
      id: `g${i + 1}`,
      name: `G${i + 1}`,
      parentGroupId: i === 0 ? null : `g${i}`,
    })),
    { id: 'loose', name: 'Loose', parentGroupId: null },
  ];

  it('allows a parent chain exactly at the limit', () => {
    expect(canReparent(chain(5), 'loose', 'g5')).toBe(true);
  });

  it('rejects a parent chain past the limit', () => {
    expect(canReparent(chain(6), 'loose', 'g6')).toBe(false);
  });
});

describe('tallyRsvp', () => {
  it('counts the three family-facing buckets', () => {
    expect(tallyRsvp(['confirmed', 'confirmed', 'declined', 'invited'])).toEqual({
      going: 2,
      notGoing: 1,
      noReply: 1,
      total: 4,
    });
  });

  it('treats coach-marked attendance as going/not going', () => {
    expect(tallyRsvp(['present', 'late', 'absent', 'no_show'])).toEqual({
      going: 2,
      notGoing: 2,
      noReply: 0,
      total: 4,
    });
  });

  it('defaults unknown values to no reply', () => {
    expect(tallyRsvp(['invited']).noReply).toBe(1);
  });
});

describe('isRsvpStatus', () => {
  it('accepts only the three family states', () => {
    expect(isRsvpStatus('confirmed')).toBe(true);
    expect(isRsvpStatus('declined')).toBe(true);
    expect(isRsvpStatus('invited')).toBe(true);
    // a família não pode marcar presença — isso é da chamada do coach
    expect(isRsvpStatus('present')).toBe(false);
    expect(isRsvpStatus('nope')).toBe(false);
  });
});

describe('canRespondToSession', () => {
  const now = new Date('2026-09-10T12:00:00Z');

  it('allows responding to a future scheduled session', () => {
    expect(canRespondToSession({ status: 'scheduled', endsAt: '2026-09-10T18:00:00Z' }, now)).toBe(
      true,
    );
  });

  it('blocks a canceled session', () => {
    expect(canRespondToSession({ status: 'canceled', endsAt: '2026-09-10T18:00:00Z' }, now)).toBe(
      false,
    );
  });

  it('blocks a session that already ended', () => {
    expect(canRespondToSession({ status: 'scheduled', endsAt: '2026-09-10T09:00:00Z' }, now)).toBe(
      false,
    );
  });
});
