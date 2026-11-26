import { parseWorldWeek } from "./world_weeks";

export function weekChoices(weeks) {
  const available = [...new Set(weeks.map(week => week.id))].map(parseWorldWeek).filter(Boolean);
  if (available.length < 2) return [];
  const dateFormat = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC", day: "numeric", month: "long", year: "numeric"
  });
  return available.sort((a, b) => b.id.localeCompare(a.id)).map(week => ({
    id: week.id, label: "Week of " + dateFormat.format(new Date(week.monday + "T00:00:00Z"))
  }));
}

export async function loadWeekChoices(fetchWeeks = fetch) {
  const response = await fetchWeeks("/worlds", { cache: "no-cache" });
  if (!response.ok) throw new Error("Could not load earlier weeks. Please try again.");
  return weekChoices(await response.json());
}
