import Engine from "json-rules-engine-simplified";
import rules from "data/jobs.json";

it("offers a forage order on a full plant, and no order on a picked plant", async () => {
  const payload = amount => ({ target: { id: "1", forageable: { amount } }, actor: {}, other: [], job_targets: [] });
  const jobs = result => result.flatMap(r => r.jobs).map(j => j.key);
  expect(jobs(await new Engine(rules).run(payload(1)))).toContain("forage");
  expect(jobs(await new Engine(rules).run(payload(0)))).not.toContain("forage");
});
