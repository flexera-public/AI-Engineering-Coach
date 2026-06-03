# Customization

Fork-specific files that should not live in shared core source belong here.

Keep this folder as the fork boundary:
- put fork-only code under `customization/src`
- put fork-only assets under `customization/assets`
- put real company-specific settings under `customization/sensitive`
- keep tracked shared files generic

When possible, mirror the project structure inside `customization/` so ownership stays obvious.

Files:
- `settings.template.json`: committed example schema for local company-specific overrides.
- `sensitive/settings.json`: local-only company settings, including sensitive catalog repositories; this file is git-ignored.
- `src/`: fork-only source files that mirror the shared project structure.
- `assets/`: fork-only assets and branding.

Catalog settings format:
- `sensitive/settings.json` may use `areas`
- each entry in `areas` may define its own `packages` for the Company Skill Finder selector
- repository values must be explicit `owner/repo` strings

Precedence:
1. `customization/sensitive/settings.json`
2. shared built-in defaults from `src/`

Current behavior:
- shared built-in catalog defaults are intentionally empty
- if no customization catalog areas are configured, the catalog falls back to an empty default set
- real company repository values should stay only in `customization/sensitive/settings.json`

## Install the Flexera customization

1. Install the Flexera VSIX by following `AI-Engineering-Coach-Flexera install/INSTALL_VSIX.txt`.
2. Create or update `customization/sensitive/settings.json` with the local Flexera catalog settings. Use `customization/settings.template.json` as the tracked schema example.
3. Reload VS Code after installing the VSIX or changing `customization/sensitive/settings.json` so the extension picks up the local customization.

Notes:
- keep real company-specific repository values only in `customization/sensitive/settings.json`
- keep `customization/settings.template.json` generic and safe to commit