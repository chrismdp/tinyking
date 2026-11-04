#!/usr/bin/env bash
set -u
mkdir -p .cache/week-levers
failed=0
runner=${WEEK_LEVERS_RUNNER:-scripts/research/week-levers.cjs}
if [ "$#" -eq 0 ]; then set -- {1..10}; fi
for seed in "$@"; do
  tag=${WEEK_LEVERS_LABEL:+$WEEK_LEVERS_LABEL-}
  extra=()
  if [ -n "${WEEK_LEVERS_FRAME:-}" ]; then extra+=("--frame=$WEEK_LEVERS_FRAME" "--label=${WEEK_LEVERS_LABEL:-baseline}"); fi
  node "$runner" "$seed" "${extra[@]}" > ".cache/week-levers/survey-$tag$seed.log" 2>&1 &
  research_pid=$!
  echo "$research_pid" > ".cache/week-levers/survey-$tag$seed.pid"
  wait "$research_pid"
  result=$?
  echo "$result" > ".cache/week-levers/survey-$tag$seed.exit"
  tail -n 3 ".cache/week-levers/survey-$tag$seed.log"
  if [ "$result" -ne 0 ]; then failed=1; fi
done
exit "$failed"
