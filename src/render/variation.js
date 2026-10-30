import { hashUnit } from "game/math";

// Numeric legacy IDs retain their appearance. Namespaced IDs need a stable
// visual sample; their actual identity is never parsed or rewritten.
export const visualNumber = id => Number.isFinite(+id) ? +id : Math.floor(hashUnit(String(id)) * 0x1000000);
