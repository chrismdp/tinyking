/* global it, expect */
const { shouldDeploy } = require("../scripts/london-midnight");

it.each([
  ["2026-11-29T23:00:00Z", false],
  ["2026-11-30T00:00:00Z", true],
  ["2026-11-30T00:59:59Z", true],
  ["2026-11-30T01:00:00Z", false],
  ["2026-07-05T23:00:00Z", true],
  ["2026-07-05T23:59:59Z", true],
  ["2026-07-06T00:00:00Z", false],
  ["2026-03-29T23:00:00Z", true],
  ["2026-10-25T23:00:00Z", false],
  ["2026-10-26T00:00:00Z", true],
  ["2026-11-24T00:00:00Z", false]
])("gates scheduled runs at %s to London's Monday midnight hour", (date, expected) => {
  expect(shouldDeploy("schedule", new Date(date))).toBe(expected);
});

it.each(["push", "workflow_dispatch"])("always allows %s runs", event => {
  expect(shouldDeploy(event, new Date("2026-11-26T14:00:00Z"))).toBe(true);
});
