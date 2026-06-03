---
name: fork-maintenance
description: >-
  Simple fork maintenance workflow. Use when deciding whether a change belongs in
  shared src/ or customization/, preserving the current fork structure,
  isolating sensitive company data, replacing company-specific tracked names with
  generic names, routing settings into customization/sensitive/settings.json,
  and keeping the diff against upstream main small. Triggers: fork-only UI,
  customization/, sensitive settings, company-specific fixtures, tracked naming,
  repo-specific configuration, src vs customization placement.
argument-hint: >-
  Describe the file, setting, asset, fixture, or naming you want to review or
  place correctly, for example: move fork-only UI into customization/src,
  move sensitive settings into customization/sensitive/settings.json, or
  replace tracked company-specific names with generic names
user-invocable: true
---

# Fork Maintenance

Use this skill when working on the fork and you need a simple rule for where changes should go.

Goal:
keep the diff against `microsoft/AI-Engineering-Coach` small, keep sensitive company data out of tracked shared files, and keep fork-only work under `customization/`.

Current baseline:
the repo structure already matches the intended split. Default to preserving the current layout and only move code when a new change lands in the wrong place.

## When to Use

- Moving fork-specific code, assets, or settings out of shared locations.
- Deciding between `src/` and `customization/`.
- Relocating sensitive company data.
- Replacing company-specific names in tracked files with neutral names.
- Verifying that a proposed change keeps the existing fork structure clean.

## Simple Rules

1. Put fork-specific additions in `customization/` whenever practical.
2. Mirror the original structure inside `customization/`.
3. Put sensitive company information in `customization/sensitive/`.
4. Keep tracked shared files generic.
5. Prefer a small compatibility layer over spreading fork logic through shared code.
6. If the current layout already satisfies these rules, leave it in place.

## Quick Mapping

- `src/webview/...` -> `customization/src/webview/...`
- `src/core/...` -> `customization/src/core/...`
- `assets/...` -> `customization/assets/...`
- non-sensitive fork config -> `customization/*.json`
- sensitive local config -> `customization/sensitive/settings.json`

If a file moves into `customization/`, keep the same relative path when possible.

If the current file already lives in the right place, prefer no structural change.

## Decision Flow

Ask these questions:

- Is it useful to upstream as-is?
- Is it fork-only?
- Does it contain company-specific or sensitive data?

Route it like this:

- Upstream-safe and broadly useful: keep it in shared `src/`.
- Fork-only but non-sensitive: move it to `customization/`.
- Sensitive or company-specific: move real values to `customization/sensitive/`, keep tracked files generic.

## Procedure

1. Find the file that owns the behavior.
2. Check whether the current location already matches the intended shared or customization split.
3. Decide: shared, fork-only, or sensitive.
4. Move fork-only code or config into the matching path under `customization/` only if it is currently misplaced.
5. Replace company-specific tracked names with generic ones.
6. Put real sensitive values under `customization/sensitive/`.
7. Update imports, config, docs, or asset references if needed.
8. Run the narrowest validation for the touched area.

## Quick Checks

- Does the change live in `customization/` when it should?
- Does `customization/` mirror the source structure?
- Are sensitive values outside tracked shared files?
- Are tracked names generic?
- Do imports and tests still work?

## Examples

- `/fork-maintenance move this helper out of src into customization/src`
- `/fork-maintenance move this config into customization/sensitive`
- `/fork-maintenance replace company-specific names in tracked files`
- `/fork-maintenance review whether this file should stay in src or move to customization/`
- `/fork-maintenance review whether this change preserves the current fork structure`