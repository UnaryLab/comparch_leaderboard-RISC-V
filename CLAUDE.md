# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static leaderboard for student-built 5-stage pipelined RISC-V (RV32I) processors, deployed to GitHub Pages at https://unarylab.github.io/comparch_leaderboard-RISC-V/. It only ranks and displays pre-computed metrics; there is no RISC-V toolchain, simulator, or grading code here.

## Commands

- Regenerate leaderboard artifacts: `python generate_leaderboard.py` (Python 3.11, stdlib only, no dependencies). Flags: `--output/-o` (default `README.md`), `--year/-y`, `--semester/-s`.
- No tests or linter are configured.

## Architecture / data flow

1. **Input data (hand-authored):** `database/year-semester-university.csv` (e.g. `2026-spring-ucf.csv`) with columns `team_name,ipc,cycle_count,frequency_mhz,area_mm2,power_mw`. Empty numeric cells are allowed. An optional matching `database/*.md` holds per-semester `### Processor Setup` and `### Workload Setup` notes.
2. **Generator:** `generate_leaderboard.py` loads all `database/*.csv`, ranks teams per metric (ties share ranks, medals for top 3), and writes `README.md` and `database/files.json`.
3. **Front-end:** `index.html` is a single self-contained page (inline CSS/JS; Chart.js from CDN). In the browser it fetches `database/files.json` (the only file-discovery mechanism; there is no directory-listing fallback), parses each CSV client-side (with cache-busting), and renders tables, charts, and the setup cards from the `.md` files.
4. **CI/CD:** `.github/workflows/update-leaderboard.yml` runs on pushes to `main` touching `database/*.csv|*.md`, `generate_leaderboard.py`, or `index.html`: it reruns the generator, commits changed artifacts as `github-actions[bot]` (`[skip ci]`), stages the site subset (`index.html`, `README.md`, `database/`) into `_site/`, and deploys `_site/` to GitHub Pages.

## Generated vs source files

- Source: `generate_leaderboard.py`, `index.html`, `database/*.csv`, `database/*.md`.
- Generated (don't hand-edit; CI overwrites): `database/files.json`, `README.md`.
- `README.md` is fully generated: its curated prose (project description, live-site link, usage instructions, contributor credit) lives inside `generate_full_readme()` in `generate_leaderboard.py`. To change that prose, edit the script, not `README.md`.

## Metrics

IPC (higher is better), cycle count (lower), frequency MHz (higher), area mm² (lower), power mW (lower). Defined in `METRICS` in `generate_leaderboard.py`; keep the script, `index.html`, and the CSV schema in sync when changing them.
