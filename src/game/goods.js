// Every meal path and every timber construction uses these same commodities.
export const FOODS = ["gruel", "bread", "flour", "grain", "forage"];
export const TIMBER = ["wood", "planks"];
export const amountOf = (amounts, types) => types.reduce((sum, type) => sum + (amounts?.[type] || 0), 0);
