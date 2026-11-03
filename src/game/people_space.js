// Compatibility entry points for the shared local population/spatial index.
// Witnesses, hearing and activity sites all query the same resident cells.
export { nearbyPeople, rebuildPopulationIndex as indexPeople, refreshPersonIndex as updatePersonCell } from "game/population_index";
