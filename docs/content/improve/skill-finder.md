---
title: "Skill Finder"
weight: 20
description: "Discover repeated prompts and matching configured skills"
---

# Skill Finder

The Skill Finder analyzes your prompt history to identify repeated patterns that waste time and matches them against a community-maintained skill catalog.

![Skill Finder](/screenshots/screen-skill-finder.png)

## Custom Skill Opportunities

AI Engineer Coach groups similar prompts across your sessions. When the same type of request appears multiple times in different sessions, it surfaces as a **Custom Skill Opportunity**. For example, if you repeatedly ask to "package the extension", the Skill Finder detects this pattern and suggests creating a reusable skill for it.

Each opportunity shows:

- The number of repetitions and sessions
- Example prompts that triggered the detection
- An **Install Skill** button that helps you create a reusable instruction file

## Company Skills Catalog

Below the custom opportunities, AI Engineer Coach queries configured company catalogs and displays matching entries from the selected area and skill group.

Each company catalog match shows:

- **Skill name** and category (e.g., VS CODE, TESTING, OTHER)
- **Description** of what the skill does
- **Why it matches** your usage pattern
- An **Install** button to add it to your workspace

## Configuration

You can select the workspace, look-back period, catalog area, and skill group to control the scope of the analysis. Company catalogs are configured under `customization/sensitive/settings.json`. Click **Analyze** to refresh the findings.
