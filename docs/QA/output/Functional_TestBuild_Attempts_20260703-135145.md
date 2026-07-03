# Functional Test Build Attempts - RUN_ID 20260703-135145

## Attempt 1
- Command: cmd /c npm install
- Result: success
- Notes: installed Playwright dependency.

## Attempt 2
- Command: cmd /c npx playwright install chromium
- Result: success
- Notes: no errors in terminal output.

## Attempt 3
- Command: cmd /c npx playwright test tests/playwright/s1-player-list.spec.js --reporter=line,json=...
- Result: failed
- Blocker: reporter syntax interpreted json path as module.
- Next action: split reporting into separate line and json runs.

## Attempt 4
- Command: cmd /c "npx playwright test tests/playwright/s1-player-list.spec.js --reporter=line > docs/QA/test-results/playwright-run-20260703-135145.txt 2>&1"
- Result: success
- Evidence: 3 passed (22.0s)

## Attempt 5
- Command: cmd /c "npx playwright test tests/playwright/s1-player-list.spec.js --reporter=json > docs/QA/test-results/playwright-results-20260703-135145.json"
- Result: success
- Evidence: JSON stats show expected=3, unexpected=0.

## Final status
- Playwright functional test scripts created and executed successfully.
