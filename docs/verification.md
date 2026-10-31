# Verification and delivery

Chris approved this faster project policy on 30 October 2026. It replaces the older requirement to rerun the whole suite for every merge and to repeat a play review after merging an already reviewed candidate. His scope, model, worktree, resource and permission constraints still apply.

## Build

Use a narrow failing regression for the changed behaviour, then implement the complete feature. Run affected Jest files and relevant lint checks during development, not the whole suite after each edit. Provide a usable early visual preview for substantial visual changes so Chris can steer without stopping other work. Run one production build on the finished candidate. Report exact source, changed old tests, checks, screenshots and limits, then freeze it.

Do not duplicate the independent acceptance worker's full mechanical checks, standard storyboard and focused observation. A brief builder smoke check/preview is sufficient unless it reveals an actual problem. Reuse checks whose relevant source has not changed.

## Independent acceptance before merge

A separate Codex worker receives the same frozen candidate, in its own worktree and dependency install. It checks mechanical play once (`npm run playtest -- <url>`), runs the standard storyboard once, and uses the minimum additional feature observation needed to cover what those actions did not establish. It judges informative, immersive, intuitive and fun with real screenshots and provisional ratings. This is one coordinated acceptance pass on one candidate; use existing tools rather than building a new framework merely to share a browser process. Do not run the same scenarios again in the builder or after merge.

Keep source frozen. Label initial fixtures, use actual UI/actions/simulation for outcomes, and preserve failed attempts and actual process receipts. Distinguish a driver or environment error from an application defect. Do not extend calendars, hunt rare seeds or run optional audit batches to force success. An unproved observation remains unproved.

An explicitly authorised next build can run alongside independent review of an immutable candidate. Use separate worktrees and keep each browser on its frozen source. The coordinator carries demonstrated parent fixes into the dependent branch at a safe boundary. Fix those findings before acceptance or merge of the dependent result.

Return the worst demonstrated findings to the coordinator. Recheck the affected behaviour and anything genuinely invalidated; do not restart every check for an unrelated edit.

## Final integration gate

The coordinator reviews the implementation, every changed existing test, evidence and independent judgment. Fetch and rebase onto current `origin/main`. Run whole Jest once on the final reviewed gameplay candidate, under the shared gate lock.

A whole-suite run with failures retains its passing evidence. Fix the failures, then rerun only failed tests and tests exposed to actual risk from the fix. Runtime edits do not automatically invalidate the entire suite. Another whole run requires a concrete broad-risk reason, recorded before that run starts. A pure test/driver/documentation correction also retains valid unchanged-runtime evidence. Record the old failure and new affected result separately.

For documentation or test-script-only changes, relevant lint, affected tests or the changed script and code review are sufficient when runtime/package/build configuration is unchanged. Do not spend another whole-suite run proving unchanged gameplay. Never remove meaningful assertions to qualify for that exception.

Fast-forward main to the accepted candidate, push, build/deploy from main and verify the live commit. Do not repeat a browser review simply because the same source moved onto main. Preserve and verify complete evidence before removing each worktree.

## Resources and authority

Exactly two heavy slots: `/tmp/27agents-gate.lock` and `/tmp/27agents-gate-2.lock`. Builders and independent reviewers use explicit affected commands and actual exit receipts; the coordinator owns the whole gate. A killed tool session is not an invented child exit code. Keep dependency writes private, leave port 8080 alone, and stop only saved verified owned PIDs. No paid actions, outside-project work or private Sol Trader source without Chris's explicit permission.
