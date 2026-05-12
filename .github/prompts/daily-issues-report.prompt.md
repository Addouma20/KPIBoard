---
name: "Daily Issues Report"
description: "Generates a daily summary of open issues and recent activity for the team"
mode: agent
tools: [search, read_file, semantic_search]
argument-hint: "Optional: project or filter focus (e.g. 'EPIC-02', 'bugs only')"
---

# Daily Issues Report

Generate a daily summary of open issues and recent activity for the **Jira KPI Dashboard** project.

## What to Include

### 1. New Issues (last 24h)
- Issues opened since yesterday — title, type, priority, assignee

### 2. Closed / Resolved
- Issues closed since yesterday — brief resolution note if available

### 3. Stale Issues
- Issues open > 5 days with no update — flag for attention

### 4. Blockers
- Any issue labelled `blocker` or `critical` that is still open

## Format

Output a clean Markdown report with sections for each category above.
Use tables where there are multiple items. Keep it concise — one line per issue.
Add a short **Summary** paragraph at the top with totals.

## Rules
- Exclude `Sub-task` issue types from totals
- Group by EPIC when possible (EPIC-01 through EPIC-06)
- If no issues in a category, write "None today."
