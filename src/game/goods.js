// Every meal path and every timber construction uses these same commodities.
export const FOOD_ENERGY = {gruel:35, bread:40, roots:25, berries:15, flour:30, grain:35, forage:35};
// Forage remains edible in older saves. New finds keep their actual identity.
export const FOODS = Object.keys(FOOD_ENERGY);
export const FOOD_TASTES = {bread:"cheerful", roots:"hard-working", berries:"generous", gruel:"humble", grain:"hard-working", flour:"hard-working", forage:"generous"};
export const TIMBER = ["wood", "planks"];
export const amountOf = (amounts, types) => types.reduce((sum, type) => sum + (amounts?.[type] || 0), 0);
