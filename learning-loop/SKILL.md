---
name: learning-loop
description: Use when you learn from sources, reuse earlier knowledge, review due knowledge units, or analyze your own mistake. Builds knowledge units with sources, tests retrieval without notes, grades against the sources, and turns mistakes into rules.
---

# Learning loop

This is project memory and practice. It does not train model weights. It does not prove expertise.

Limits that always apply:

- If the user or the task limits your sources (for example "no notes" or "no files"), obey that limit. Do not load the knowledge base into that work.
- Old model names, versions and prices are not current facts. Check the current source.
- A note that conflicts with a new source gets an uncertainty mark and a fix. Fix your own note. Do not rewrite the archive.

Default layout (all paths relative to the working directory):

- `knowledge/README.md` — index of units.
- `knowledge/<unit-id>.md` — one file per unit.
- `knowledge/mistakes.md` — one entry per recurring mistake.
- `knowledge/progress.json` — review schedule.
- `knowledge/reviews/YYYY-MM-DD.md` — review reports.

The script path below assumes the skill sits in `learning-loop/`. Adjust it to where you installed the skill.

## 1. Before work: recover the relevant knowledge

Read `knowledge/README.md` and the relevant entries in `knowledge/mistakes.md`. Check due reviews:

```sh
node learning-loop/scripts/review.mjs due
```

Pick the units that matter for the task. Go back to the sources they cite. Do not load the whole base without need. Memory helps you find the evidence. It does not replace the evidence.

Before you act, apply any rule or check from the mistake log that fits the task. Note what it changed in your decision and what result confirmed it. If nothing fits, write nothing. Do not invent a use.

## 2. After a full reading: build a unit

Read the source in full first. Then write `knowledge/<unit-id>.md` with:

- Sources (links or paths to the originals).
- A map of the main topics.
- Practical decisions.
- Counterexamples and limits.
- Confirmed use (real cases only).
- 3 scenario questions about new uses, limits and spotting errors.

Mark each statement as a claim of the source, your own conclusion, or something you actually did. Point to the source for detail. Do not compress the condition that decides a case.

Register the unit in the index and in `knowledge/progress.json` with `level: 0`, `lastReview: null`, `nextReview` set to today's real date, `lastResult: null`, `evidence: null` and the `file` path. Registration is not a pass. Updating a unit does not raise its level.

## 3. After the work: retrieval practice

Time-box it. Use at most 10 minutes for the new unit and up to two other overdue units, in the order `due` prints them (oldest date first, then lowest level). Do not delay the real task. Skipped units stay overdue. Do not mark them as passed.

Prepare 2-3 questions about new uses, limits and spotting errors. Then write the first answers without notes:

- Use a fresh session that has no memory files, no skills and no tools. Your current session already holds the answers in context, so it cannot test you.
- Give that session only the questions and the answer format. Collect its answer yourself.
- Give the scenario the data it needs. A missing private name in an empty context is not a knowledge error.
- Ask the session to describe the idea in general terms. Allow ONE concrete example command only if the answer can verify it. Otherwise it describes the idea without a command.
- Reading an instruction that contains hints voids the "no notes" claim. Record such a try as a source-assisted answer, not as a retrieval.
- Keep the first answer unedited. Do not correct it afterwards.

Then read the sources and grade each first answer: decision, reason, the key limit and how to check it.

- `pass`: every critical condition of the unit is correct.
- `partial`: there is a gap.
- `fail`: the decision is wrong, or the answer invents a proof.

The grade must cite a source, not your confidence. An honest refusal to guess is correct when the data is missing.

A no-notes answer tests reasoning without hints. It does not show that the model's memory changed. To test the knowledge base, check in a new session that it finds the right unit and applies it.

After a mistake, explain the difference, fix your unit or procedure, and test another example. A second answer to the same question after seeing the solution is not a new pass.

Write a report to `knowledge/reviews/YYYY-MM-DD.md`: the question, the first answer, the grade with the source, the fix, the use or limit, and where the raw evidence is. Do not store hidden reasoning or secrets. Keep apart the no-notes try, the source-assisted answer and the observation from real work.

## 4. Record the result

Only after you grade from the sources, run:

```sh
node learning-loop/scripts/review.mjs record <unit-id> pass --evidence knowledge/reviews/YYYY-MM-DD.md
```

Use `partial` or `fail` when there are gaps. The script schedules reviews at 1, 3, 7 and 14 days. It does not grade.

- An early pass, or a second pass on the same day, does not advance the level.
- `partial` and `fail` reset the unit to level 0, due the next day. A new mistake may reset it on the same day.
- Do not raise a level by reading.
- Do not change a result afterwards to improve a statistic.
- Do not call a review level an expert level.
- For real learning use today's date. Use `--on` and a separate `--state` file only to test the script.
- Keep one process that writes the state file.

Options: `--state FILE` (default `./knowledge/progress.json`), `--on YYYY-MM-DD`, `--timezone ZONE` (or `LEARNING_LOOP_TZ`, default `UTC`).

## 5. Mistakes must change future behavior

After a refusal, a significant user correction or a wrong claim of your own, update `knowledge/mistakes.md`. Keep one entry per recurring mistake with:

- Fact: what happened.
- Cause: from evidence, not a guess.
- Effect.
- Trigger: when the guard applies.
- Rule: a concrete rule.
- Check: how to verify the rule was followed.

A repeat mistake updates the same entry. Do not add a similar instruction.

Then fix the entry point or the skill that failed, with a small change that removes the cause. Run a local smoke test of the fixed path. A written reflection alone does not close a mistake. Do not turn a mistake into an unrequested install, a permission change or a change to global settings. The user approves that scope.
