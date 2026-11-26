/* eslint-disable no-undef */
function shouldDeploy(event, date = new Date()) {
  if (event !== "schedule") return true;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", weekday: "short", hour: "2-digit", hourCycle: "h23"
  }).formatToParts(date).map(part => [part.type, part.value]));
  return parts.weekday === "Mon" && parts.hour === "00";
}

module.exports = { shouldDeploy };
if (require.main === module) console.log("deploy=" + shouldDeploy(process.argv[2]));
