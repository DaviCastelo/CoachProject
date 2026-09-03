/**
 * Hierarquia de grupos (brief §1/§6).
 * Um grupo pode ter subgrupos; a árvore é usada para exibição e para endereçar
 * eventos/anúncios em lote. Membros NÃO são herdados pelo grupo pai.
 */

export type GroupNodeInput = {
  id: string;
  name: string;
  parentGroupId: string | null;
  sortOrder?: number;
};

export type GroupNode<T extends GroupNodeInput = GroupNodeInput> = T & {
  children: GroupNode<T>[];
  depth: number;
};

/**
 * Monta a árvore a partir de uma lista plana.
 * Grupos cujo pai não está na lista (ou que formariam ciclo) sobem para a raiz,
 * garantindo que nenhum grupo desapareça da tela.
 */
export function buildGroupTree<T extends GroupNodeInput>(groups: readonly T[]): GroupNode<T>[] {
  const byId = new Map<string, GroupNode<T>>();
  for (const g of groups) {
    byId.set(g.id, { ...g, children: [], depth: 0 });
  }

  const roots: GroupNode<T>[] = [];

  for (const node of byId.values()) {
    const parentId = node.parentGroupId;
    const parent = parentId ? byId.get(parentId) : undefined;

    if (!parent || parent.id === node.id || createsCycle(node.id, parent, byId)) {
      roots.push(node);
    } else {
      parent.children.push(node);
    }
  }

  const sortNodes = (nodes: GroupNode<T>[], depth: number): void => {
    nodes.sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name),
    );
    for (const n of nodes) {
      n.depth = depth;
      sortNodes(n.children, depth + 1);
    }
  };
  sortNodes(roots, 0);

  return roots;
}

function createsCycle<T extends GroupNodeInput>(
  nodeId: string,
  parent: GroupNode<T>,
  byId: Map<string, GroupNode<T>>,
): boolean {
  let cursor: GroupNode<T> | undefined = parent;
  let guard = 0;
  while (cursor && guard < 100) {
    if (cursor.id === nodeId) return true;
    cursor = cursor.parentGroupId ? byId.get(cursor.parentGroupId) : undefined;
    guard += 1;
  }
  return false;
}

/** Achata a árvore preservando a ordem visual (pai antes dos filhos). */
export function flattenGroupTree<T extends GroupNodeInput>(
  nodes: readonly GroupNode<T>[],
): GroupNode<T>[] {
  const out: GroupNode<T>[] = [];
  const walk = (list: readonly GroupNode<T>[]): void => {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

/** Um grupo e todos os seus descendentes (espelha `group_descendants` no banco). */
export function collectDescendantIds<T extends GroupNodeInput>(
  groups: readonly T[],
  rootId: string,
): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const g of groups) {
    if (!g.parentGroupId) continue;
    const list = childrenOf.get(g.parentGroupId) ?? [];
    list.push(g.id);
    childrenOf.set(g.parentGroupId, list);
  }

  const out: string[] = [];
  const seen = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    stack.push(...(childrenOf.get(id) ?? []));
  }
  return out;
}

/**
 * O grupo pode receber `candidateParentId` como pai?
 * Espelha o trigger `check_group_cycle`: nada de auto-referência, ciclo ou
 * profundidade acima de MAX_GROUP_DEPTH.
 */
export const MAX_GROUP_DEPTH = 5;

export function canReparent<T extends GroupNodeInput>(
  groups: readonly T[],
  groupId: string,
  candidateParentId: string | null,
): boolean {
  if (candidateParentId === null) return true;
  if (candidateParentId === groupId) return false;

  // Não pode virar filho de um descendente seu.
  if (collectDescendantIds(groups, groupId).includes(candidateParentId)) return false;

  const byId = new Map(groups.map((g) => [g.id, g]));
  let cursor = byId.get(candidateParentId);
  let depth = 1;
  while (cursor?.parentGroupId) {
    depth += 1;
    if (depth > MAX_GROUP_DEPTH) return false;
    cursor = byId.get(cursor.parentGroupId);
  }
  return depth <= MAX_GROUP_DEPTH;
}
