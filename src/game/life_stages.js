// One life clock and one set of developmental boundaries for every person.
export const LIFE_YEARS_PER_SEASON = 2;
export const LIFE_YEARS_PER_GAME_YEAR = LIFE_YEARS_PER_SEASON * 4;
export const LIFE_STAGES = {
  child: { label: "Child", from: 0 },
  teenager: { label: "Teenager", from: 8 },
  youngAdult: { label: "Young adult", from: 16 },
  adult: { label: "Adult", from: 24 },
  middleAged: { label: "Middle-aged", from: 40 },
  old: { label: "Old", from: 56 }
};
const stages = Object.values(LIFE_STAGES).reverse();
export const lifeStage = age => stages.find(stage => age >= stage.from) || LIFE_STAGES.child;
export const lifeStageLabel = age => lifeStage(age).label;
export const isAdult = age => age >= LIFE_STAGES.youngAdult.from;
export const isDependent = age => age < LIFE_STAGES.youngAdult.from;
export const canBearChild = age => isAdult(age) && age < LIFE_STAGES.middleAged.from;
export const canFatherChild = age => isAdult(age) && age < LIFE_STAGES.old.from;
export function canParentTogether(a, b) {
  const mother = a.male === false ? a : b.male === false ? b : null;
  const father = a.male === true ? a : b.male === true ? b : null;
  return !!mother && !!father && canBearChild(mother.age) && canFatherChild(father.age);
}
// Automatic courtship keeps its former upper window for either sex.
export const canSeekPartner = canFatherChild;
export const canHelpAtHome = age => age >= LIFE_STAGES.teenager.from;
export const personSize = age => isDependent(age) ? 12 : 20;
export const oldAgeDeathChance = age => age < LIFE_STAGES.old.from ? 0 : Math.min(1, .02 * 2 ** ((age - LIFE_STAGES.old.from) / LIFE_YEARS_PER_GAME_YEAR));
