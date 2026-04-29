# Task 1 Report: Star Wars Leaderboard

## What I built

A static, single-page replica of the internal company leaderboard, with all corporate data replaced by 10 Star Wars characters. The application replicates the original UI, filters, sorting, search, expand/collapse interaction, and mobile responsiveness.

Live: https://michalfromvention.github.io/ai-challenge-2/task-1/

## Tools used

- **Claude Desktop** with Claude Code (Anthropic) – primary tool for planning, dataset generation, master prompt drafting, code generation, and bug fixes
- **GitHub** – source code hosting and deployment via GitHub Pages
- **Chrome DevTools** – manual testing across desktop and mobile viewports

No frameworks, no build step, no external dependencies. The application is pure HTML, CSS, and vanilla JavaScript.

## Approach

I treated this as a planning-first, execution-second task. Before writing any code, I:

1. Captured the original leaderboard's structure through anonymized screenshots (faces and names blacked out before sharing with AI tools, in line with the responsible AI policy).
2. Mapped out every UI element: filter row, top-3 podium with stair-step layout, ranking list with category icons and counts, and the expandable Recent Activity panel.
3. Identified mobile-specific differences: vertical podium stack, secondary-row category icons, and a vertically-scaling activity table.

Only then did I move to building.

## Data substitution

All employee data was replaced with 10 Star Wars characters, chosen for tonal fit with the task name "The Clone Wars." For each character I generated:

- Name and a position formatted as "Role (Planet, Faction, Unit)" to match the original's "Position (country, unit, group)" pattern
- A faction-based avatar color (Jedi blue, Rebel orange, Republic navy, Smuggler green, Bounty Hunter khaki)
- One of 8 abstract SVG silhouettes – chosen over AI-generated portraits to avoid any IP risk associated with Star Wars-style imagery
- Between 5 and 18 themed activities, distributed across all four 2025 quarters and three categories (Combat Missions, Force Training, Diplomatic Relations – mapped from the original's Public Speaking, Education, University Partnership)

Total: 10 characters, ~120 activities. Spread is balanced enough that every filter combination returns meaningful results.

## Compliance with the responsible AI policy

- No real corporate data, names, photos, departments, or job titles were entered into any AI tool. Screenshots shared with AI for layout reference were manually anonymized first.
- Avatars are abstract SVG silhouettes, not AI-generated portraits in any recognizable franchise style – an intentional choice to avoid intellectual property concerns.
- Star Wars character names are used as fictional substitutes in a non-commercial educational context. No copyrighted imagery or branded assets were generated or reproduced.
- All AI tools used are personal subscriptions or company-approved tools per the AI Challenge 2 brief

## Process

1. Specification and dataset preparation were done in conversation with Claude
2. A single comprehensive master prompt was drafted, containing full design specs, layout rules, mobile breakpoints, icon definitions, and the embedded dataset
3. The master prompt was attached to a Claude Code session pointed at an empty working directory
4. Claude Code generated all four files from the prompt (data.js, index.html, style.css, script.js)
5. Two bugs were identified during testing:
   - Category counts under icons showed point sums instead of activity counts
   - Mobile podium showed 2-1-3 order instead of 1-2-3 stack
6. Both bugs were fixed in subsequent Claude Code iterations, with one regression on desktop podium that was diagnosed and resolved (a class was being applied to inner elements instead of the outer flex container, breaking the CSS `order` rules)
7. Functionality was tested manually across all filter combinations, search behavior, expand/collapse, and mobile viewport before deployment

## What I learned

- The "one submit, no resubmissions" rule rewarded careful planning over speed. Writing the comprehensive master prompt up front meant fewer iterations, and the iterations I did need were targeted bug fixes rather than rebuilds.
- Vibe coding works best when the human owns the spec and the AI owns the syntax. I never wrote code, but I read every change Claude Code made and verified it produced the right output.
- I had already built a few small apps with Claude before – a movie picker, a Wi-Fi QR code generator, and a custom team Randomizer – but those lived inside Claude's chat artifacts. This was different: a real working directory, real commit history, a real public URL. Going from "I have no IDE installed" to "my application is live" in one task feels like the actual win.
- Beyond the build itself, I picked up working familiarity with tools I had not used or barely used before – Claude Code as a hands-off coding partner, GitHub repos, and GitHub Pages deployment.
- Knowing that the submission will be reviewed by some of the strongest engineers on our global team made this both nerve-wracking and exciting. I wanted to put forward something I'd genuinely stand behind, not just something that "passes."

## A final note

May the Force be strong within the org team!
