import { personComponent } from "game/residents";

// Seasonal encounters read kinship; weddings and births run after this scope.
const familyIndexes = new WeakMap();
export function withCloseFamilyIndex(state, encounter) {
  if (familyIndexes.has(state)) return encounter();
  familyIndexes.set(state, new Map());
  try { return encounter(); }
  finally { familyIndexes.delete(state); }
}

export function closeFamily(state, id) {
  const index = familyIndexes.get(state);
  if (index?.has(id)) return index.get(id);
  const kin = personComponent(state, "kinship", id);
  if (!kin) return [];
  const family = [...new Set([kin.spouse, ...kin.parents, ...kin.children,
    ...kin.parents.flatMap(p => personComponent(state, "kinship", p)?.children || [])])].filter(p => p && p != id);
  index?.set(id, family);
  return family;
}

export function relatedPeople(s, a, b, includeLineal = false, cache) {
  const parents=id=>(s.ecs.kinship?.[id] || s.peopleDirectory?.[id]?.kinship || s.travel?.people?.[id]?.kinship)?.parents || [];
  const ancestors = root => {
    if (cache?.has(root)) return cache.get(root);
    const result = new Set(),
      queue = [[root, 0]];
    for (const [id, depth] of queue) if (depth < 2) for (const p of parents(id)) {
      result.add(p);
      queue.push([p, depth + 1]);
    }
    cache?.set(root, result);
    return result;
  };
  const aa = ancestors(a),
    bb = ancestors(b);
  if (aa.has(b) || bb.has(a) || [...aa].some(id => bb.has(id))) return true;
  if (!includeLineal) return false;
  // Keep NPC cousin compatibility unchanged. A deliberate player proposal must
  // also reject direct ancestry beyond the two generations shown in the tree.
  const ancestor=(root,target)=>{
    const queue=[root],seen=new Set();
    for(const id of queue)if(!seen.has(id)) {
      seen.add(id);
      for(const parent of parents(id)){if(parent==target)return true;queue.push(parent);}
    }
    return false;
  };
  return ancestor(a,b) || ancestor(b,a);
}
