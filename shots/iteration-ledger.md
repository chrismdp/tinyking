# Preserved test iterations

Every Jest invocation used the shared gate lock and an explicit file list. Skipped cases below came only from focused diagnostic `--testNamePattern` runs. The logs retain literal Jest output and selected files/patterns; adjacent `.status` files record actual exits. Times are Jest seconds, not shell wall time. No failed run was deleted.

| Run / literal output | Exit | Suites | Tests | Jest seconds |
|---|---:|---|---|---:|
| [red-feedback](red-feedback.log) | 1 | 1 failed, 1 total | 5 failed, 5 total | 1.688 |
| [red-routines](red-routines.log) | 1 | 1 failed, 1 total | 3 failed, 3 total | 0.622 |
| [green-first](green-first.log) | 1 | 1 failed, 1 passed, 2 total | 1 failed, 7 passed, 8 total | 1.31 |
| [affected-first](affected-first.log) | 1 | 7 failed, 15 passed, 22 total | 24 failed, 255 passed, 279 total | 263.914 |
| [affected-fixes](affected-fixes.log) | 1 | 3 failed, 8 passed, 11 total | 3 failed, 121 passed, 124 total | 2.863 |
| [regression-trace](regression-trace.log) | 1 | 2 failed, 2 total | 2 failed, 26 skipped, 28 total | 1.381 |
| [regression-fixes](regression-fixes.log) | 1 | 1 failed, 4 passed, 5 total | 1 failed, 39 passed, 40 total | 2.238 |
| [day21-trace](day21-trace.log) | 1 | 1 failed, 1 total | 1 failed, 14 skipped, 15 total | 2.219 |
| [regression-final](regression-final.log) | 1 | 1 failed, 4 passed, 5 total | 1 failed, 39 passed, 40 total | 1.944 |
| [needs-routines](needs-routines.log) | 1 | 1 failed, 3 passed, 4 total | 1 failed, 54 passed, 55 total | 3.67 |
| [courtship-fix](courtship-fix.log) | 1 | 1 failed, 1 total | 1 failed, 14 passed, 15 total | 1.736 |
| [day21-trace-2](day21-trace-2.log) | 1 | 1 failed, 1 total | 1 failed, 14 skipped, 15 total | 1.716 |
| [social-final](social-final.log) | 1 | 1 failed, 1 total | 1 failed, 14 passed, 15 total | 1.539 |
| [focused-green](focused-green.log) | 1 | 1 failed, 10 passed, 11 total | 1 failed, 124 passed, 125 total | 2.854 |
| [season-trace](season-trace.log) | 1 | 1 failed, 1 total | 1 failed, 14 skipped, 15 total | 2.01 |
| [social-behaviour-green](social-behaviour-green.log) | 0 | 3 passed, 3 total | 32 passed, 32 total | 1.525 |
| [red-interruption](red-interruption.log) | 1 | 1 failed, 1 total | 1 failed, 5 skipped, 6 total | 0.647 |
| [new-final-green](new-final-green.log) | 0 | 4 passed, 4 total | 24 passed, 24 total | 1.059 |
| [red-idle-needs](red-idle-needs.log) | 1 | 1 failed, 1 total | 3 failed, 6 skipped, 9 total | 0.895 |
| [stationary-green](stationary-green.log) | 1 | 2 failed, 3 passed, 5 total | 3 failed, 44 passed, 47 total | 2.165 |
| [stationary-routines-green](stationary-routines-green.log) | 1 | 1 failed, 2 passed, 3 total | 1 failed, 27 passed, 28 total | 2.425 |
| [contact-trace](contact-trace.log) | 1 | 1 failed, 1 total | 1 failed, 14 skipped, 15 total | 1.628 |
| [people-rules-green](people-rules-green.log) | 0 | 4 passed, 4 total | 32 passed, 32 total | 2.216 |
| [red-cancel-care](red-cancel-care.log) | 1 | 1 failed, 1 total | 1 failed, 10 skipped, 11 total | 0.679 |
| [last-focused-green](last-focused-green.log) | 0 | 8 passed, 8 total | 91 passed, 91 total | 4.481 |
| [affected-final](affected-final.log) | 1 | 1 failed, 29 passed, 30 total | 2 failed, 316 passed, 318 total | 286.998 |
| [red-bio-custody](red-bio-custody.log) | 1 | 1 failed, 1 total | 2 failed, 2 passed, 4 total | 0.632 |
| [final-corrections](final-corrections.log) | 0 | 4 passed, 4 total | 70 passed, 70 total | 2.121 |
| [red-remote-inheritance](red-remote-inheritance.log) | 1 | 1 failed, 1 total | 1 failed, 4 passed, 5 total | 1.288 |
| [corrections-green](corrections-green.log) | 0 | 4 passed, 4 total | 71 passed, 71 total | 1.934 |
| [affected-accepted](affected-accepted.log) | 0 | 30 passed, 30 total | 319 passed, 319 total | 284.79 |
| [red-pronoun](red-pronoun.log) | 1 | 1 failed, 1 total | 1 failed, 18 passed, 19 total | 1.082 |
| [copy-accepted](copy-accepted.log) | 0 | 5 passed, 5 total | 52 passed, 52 total | 2.229 |
| [red-journey-label](red-journey-label.log) | 1 | 1 failed, 1 total | 1 failed, 10 skipped, 11 total | 0.615 |
| [activity-accepted](activity-accepted.log) | 0 | 6 passed, 6 total | 51 passed, 51 total | 1.819 |
| [red-child-availability](red-child-availability.log) | 1 | 1 failed, 1 total | 2 failed, 4 skipped, 6 total | 0.665 |
| [child-availability-green](child-availability-green.log) | 1 | 1 failed, 1 total | 1 failed, 6 passed, 7 total | 0.965 |
| [child-routines-final](child-routines-final.log) | 0 | 1 passed, 1 total | 7 passed, 7 total | 0.662 |
| [child-affected](child-affected.log) | 0 | 11 passed, 11 total | 160 passed, 160 total | 178.306 |
| [red-help-priority](red-help-priority.log) | 1 | 1 failed, 1 total | 1 failed, 13 skipped, 14 total | 0.674 |
| [help-priority-accepted](help-priority-accepted.log) | 0 | 6 passed, 6 total | 100 passed, 100 total | 3.648 |
| [continuation-coarse-child](continuation-coarse-child.log) | 0 | 1 passed, 1 total | 7 skipped, 1 passed, 8 total | 0.721 |
| [continuation-red-care-boundary](continuation-red-care-boundary.log) | 1 | 1 failed, 1 total | 1 failed, 7 skipped, 8 total | 2.028 |
| [continuation-care-boundary-green](continuation-care-boundary-green.log) | 1 | 1 failed, 1 total | 1 failed, 7 passed, 8 total | 0.777 |
| [continuation-care-boundary-green-2](continuation-care-boundary-green-2.log) | 0 | 1 passed, 1 total | 8 passed, 8 total | 0.967 |
| [continuation-child-final](continuation-child-final.log) | 1 | 1 failed, 10 passed, 11 total | 1 failed, 161 passed, 162 total | 244.53 |
| [continuation-care-regressions-final](continuation-care-regressions-final.log) | 0 | 1 passed, 1 total | 9 passed, 9 total | 0.846 |
