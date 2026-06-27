# DataForge

DataForge is a browser-based educational game that teaches feature engineering through a playable, world-based progression system. Players move through interactive lessons on variable types, missing data, outliers, categorical encoding, feature scaling, and full end-to-end preprocessing pipelines.

## Live Demo

**Coming soon**

Replace this with your deployment URL when the project is live:

`https://your-live-demo-link-here`

## Overview

DataForge turns data-preprocessing concepts into hands-on challenges. Instead of reading static theory, players solve problems through mini-labs, quizzes, visual exercises, drag-and-drop activities, calculator tasks, and code-fix levels.

The game is organized into 6 worlds:

1. Foundations
2. Missing Data
3. Outliers
4. Encoding
5. Scaling
6. The Full Pipeline

Across the campaign, players unlock levels, earn stars, gain XP, and build a stronger understanding of practical machine-learning preprocessing workflows.

## Features

- 35 total levels across 6 connected worlds
- Interactive gameplay using drag-and-drop, quizzes, charts, tables, and code-style tasks
- Hash-based routing for world and level navigation
- Persistent progress with `localStorage`
- XP, rank, stars, lives, and hint systems
- Settings panel with language, audio, and accessibility preferences
- French/English translation support
- Static frontend architecture with no build step required

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript (ES modules)
- Browser `localStorage` for persistence

## Project Structure

```text
.
├── index.html
├── level.html
├── dev-level.html
├── css/
│   ├── base.css
│   ├── components.css
│   ├── layout.css
│   ├── widgets.css
│   └── worlds/
├── js/
│   ├── main.js
│   ├── i18n.js
│   ├── core/
│   ├── data/
│   ├── pandas/
│   ├── widgets/
│   └── worlds/
└── README.md
```

## Running Locally

Because this project uses ES modules, the safest option is to run it from a small local static server.

### Option 1: Python

```bash
python -m http.server 8000
```

Then open:

`http://localhost:8000`

### Option 2: VS Code Live Server

Open the project in VS Code and run the Live Server extension on `index.html`.

## Debug Helpers

The app includes optional debug progress seeds through the query string:

- `?debugProgress=campaign-clear`
- `?debugProgress=world6-final`

Example:

`http://localhost:8000/?debugProgress=campaign-clear`

## Gameplay Systems

- World map navigation
- Level unlocking and progression
- Session-based lives and hints
- Score, star rating, and XP rewards
- Rank progression from `Data Intern` to `ML Scientist`
- Persistent settings and campaign save data

## How to Play

1. Start on the world map and open the first available level.
2. Read the level objective and inspect the dataset, chart, or prompt on screen.
3. Solve the challenge using the interaction for that level:
   - drag and drop
   - multiple-choice questions
   - calculator steps
   - table inspection
   - code-fix style tasks
4. Avoid mistakes to preserve lives and reduce hint usage for a better score.
5. Complete levels to earn stars, XP, and unlock the next challenges.
6. Progress through all 6 worlds to build a full feature-engineering workflow from fundamentals to production-style pipelines.

## Educational Scope

DataForge focuses on practical feature-engineering topics such as:

- Variable type identification
- Missing-value mechanisms and imputation
- Outlier detection and treatment
- One-hot, label, and frequency encoding
- Min-max scaling, z-score standardization, and log transforms
- Leakage-safe preprocessing pipelines

## Publishing Notes

This project is well suited for static hosting platforms such as:

- GitHub Pages
- Netlify
- Vercel

If you publish it on GitHub Pages, you can place the final URL in the Live Demo section above.

## License

Add your preferred license here, for example:

`MIT`
