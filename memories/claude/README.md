# UNITY Narrator — Agent Memory

This directory is UNITY's persistent memory. Claude uses the memory tool to read and write files here across runs. Files are plain markdown with YAML-ish frontmatter so they're grep-friendly.

## How memory gets used

- Before any analysis, UNITY `view`s `/memories` and reads the files most relevant to the scope (entity, industry, risk topic).
- When UNITY finds something worth remembering for future runs (a durable risk flag, a one-off to exclude from run-rate, a thesis check), it `create`s or `str_replace`s a file.
- Routine variances do not belong here. They're already in the cube.

## Conventions

- Filename format: `{entity_id_or_topic}.md` (e.g. `fortuna.md`, `atlas.md`, `linerboard-risk.md`).
- Top of file: `## TL;DR` — one-line summary of the observation.
- Body: prose + a `## Status` line that reads like "Open · flagged 2026-01-12" or "Resolved · confirmed 2026-03 close".
- Tags: a `## Tags` line with space-separated lowercase tags (risk, valuation, m&a, one-off, …).
