# learning-loop

An agent skill for a learning loop. The agent builds knowledge units from sources, retrieves them later without notes, grades its first answer against the sources, schedules reviews, and turns each mistake into one rule and one check.

## What it does

- Before work, recovers only the relevant units and mistakes, and checks which reviews are due.
- After a full reading, builds a unit file: sources, topic map, practical decisions, counterexamples and limits, confirmed use, and 3 scenario questions. Registration is not a pass.
- After the work, runs a time-boxed retrieval practice. The first answer is written without notes in a fresh session that has no memory files, skills or tools. The agent keeps it unedited and grades it against the sources: pass, partial or fail.
- Records the result with `review.mjs`, which schedules reviews at 1, 3, 7 and 14 days. The script never grades. Reading does not raise a level.
- Keeps one entry per recurring mistake (fact, cause, effect, trigger, rule, check) and fixes the entry point or skill that failed.

## Install

Copy the `learning-loop/` folder into your agent's skills directory (for example `.claude/skills/`, `.agents/skills/` or `.omp/skills/`). The script uses only built-in Node.js modules (`node:util` `parseArgs` needs Node 18.3 or newer). It was tested on Node 24 only. Adjust the script path in `SKILL.md` to where you put the folder.

## Usage

The agent follows `SKILL.md`. You can also run the script yourself. The state file defaults to `./knowledge/progress.json` in the current directory.

List the units due on a date (the example state is in this repo):

```sh
node learning-loop/scripts/review.mjs due --state examples/progress.json
```

Use `--on` to pin the date:

```sh
node learning-loop/scripts/review.mjs due --state examples/progress.json --on 2025-03-08
```

Record a graded result. Evidence is a report file that exists:

```sh
node learning-loop/scripts/review.mjs record sql-indexes pass --evidence knowledge/reviews/2025-03-05.md --on 2025-03-05
```

This moved `sql-indexes` to level 1 with the next review on 2025-03-06.

Dates use UTC by default. Set another zone with `--timezone` or `LEARNING_LOOP_TZ`. An unknown zone stops the command with an error:

```sh
node learning-loop/scripts/review.mjs due --state examples/progress.json --timezone Mars/X
```

Run the tests:

```sh
node --test
```

## What breaks or doesn't work

- It is project memory and practice. It does not train model weights and does not prove expertise.
- A no-notes answer tests reasoning without hints. It does not show that a model's memory changed.
- The script schedules. The agent grades. A wrong grade gives a wrong schedule.
- The script has no lock. Run one writer at a time.
- Retrieval practice needs a way to start a fresh session with no files, skills or tools. If your harness cannot do that, the skill cannot test without notes. Only the script is tested. The skill's practice routine has not been run on any harness.
- Old model names, versions and prices in your notes are not current facts.

## Files

- `learning-loop/SKILL.md` — the routine.
- `learning-loop/scripts/review.mjs` — the review scheduler.
- `test/review.test.mjs` — tests (`node:test`, no dependencies).
- `examples/progress.json` — example review state.

## License

Apache License 2.0.
