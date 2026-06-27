# FEATURE ENGINEERING LEARNING GAME — FULL DESIGN PROMPT

---

## GLOBAL DESIGN SYSTEM

### Visual Identity
The game is called **"DataForge"** — a data science learning RPG where the player
is a junior data scientist working through increasingly complex datasets. The aesthetic
is a modern dark-mode data lab: sleek, technical, but warm enough to feel approachable.
Not childish, not corporate — think VSCode meets a video game HUD.

### Color Palette
- Background base: #0F1117 (near black)
- Surface cards: #1A1D27
- Surface elevated: #22263A
- Border subtle: #2E3250
- Border active: #4A5080
- Primary accent: #6C63FF (purple — "data energy")
- Secondary accent: #00D4AA (teal — "correct/success")
- Warning: #F5A623 (amber — "caution/hint")
- Danger: #FF4D6A (red — "error/outlier")
- Text primary: #E8EAF6
- Text secondary: #8B90B0
- Text muted: #4A4F6A
- Code background: #0D0F18
- Code text: #A8B5D8

### Typography
- UI font: "Inter" — clean, readable, modern
- Code/data font: "JetBrains Mono" — monospaced for all datasets, code editors, formulas
- Heading sizes: 32px (world title), 24px (level title), 18px (section), 14px (body), 12px (caption)
- All numbers in datasets use JetBrains Mono
- Formula blocks use a slightly larger mono size with extra letter spacing

### Spacing & Layout
- Base unit: 8px grid
- Card border radius: 12px
- Button border radius: 8px
- Max content width: 1200px centered
- Mobile breakpoint: 768px (game is primarily desktop but responsive)

### Global UI Components

**XP Bar**
Sits at the very top of the screen, full width, thin (6px height).
Left side shows current world icon + name. Right side shows XP count.
Bar fills left to right in primary accent color. Glows briefly on XP gain.

**Score Display**
Top right corner. Shows current score as a 6-digit number (000000 style).
Increments with a counting animation on correct actions.

**Lives / Attempts**
Three small hexagon icons top left. One dims on a mistake.
Refill between levels.

**Navigation Header**
Fixed top bar. Left: back arrow (goes to world map, asks confirmation).
Center: level name breadcrumb "World 2 › Level 3 — Median Imputation".
Right: score + XP.

**Hint Button**
Amber colored, small, with a lightbulb icon. Appears on every level.
Costs 50 points to use. Shows a one-line clue in a tooltip-style popup.
Maximum 2 hints per level.

**Transition Animations**
Between levels: screen fades to black, new level title appears large in center
with world accent color, then fades in. Duration: 800ms total.
Between worlds: full cinematic transition — the world map zooms out,
the next world icon pulses and zooms in.

---

## WORLD MAP SCREEN

### Layout
Full screen. Dark background with a subtle animated particle field (small dots
drifting slowly — represents data points). In the center, a horizontal pipeline
connecting 6 world nodes. The pipeline is the visual metaphor: raw data enters
from the left, clean processed data exits right.

### World Nodes
Each world is a large hexagonal node on the pipeline. Unlocked worlds glow
with their accent color. Locked worlds are dark grey with a padlock icon.
Completed worlds have a checkmark and show the player's star rating (1-3 stars).
Hovering a world node expands a small tooltip showing: world name, chapter
reference, number of levels, and completion percentage.

### Pipeline Visual
The connecting line between nodes is a glowing tube. As worlds are completed,
that segment of the tube fills with flowing animated gradient — visualizing
data moving through the pipeline. By World 6, the full pipeline is lit up.

### World Icons & Colors
- World 1 (Foundations): 📊 Soft blue #4A90D9 — clean, introductory feel
- World 2 (Missing Data): 🕳️ Deep navy #2D4A8A — dark, gaps, mystery
- World 3 (Outliers): ⚡ Orange-red #E85D26 — dangerous, explosive, alert
- World 4 (Encoding): 🔢 Gold #C9A84C — organized, structured, library feel
- World 5 (Scaling): ⚖️ Teal #00B4A0 — precision, balance, measurement
- World 6 (Pipeline): 🏭 Purple-grey #7B5EA7 — industrial, synthesis, mastery

### Bottom Strip
Shows total progress: "24 / 34 levels complete" with a global progress bar.
Also shows total XP and current rank (titles like "Data Intern", "Junior Analyst",
"Data Engineer", "ML Scientist").

---

## LEVEL STRUCTURE TEMPLATE

Every level follows this shell regardless of world:

```
[TOP BAR — fixed]
World name | Level name                    Score | XP bar | Lives

[MAIN AREA — scrollable]
┌─────────────────────────────────────────────────────┐
│  LEVEL HEADER                                        │
│  Large level number (faint, background)              │
│  Level title (bold, world accent color)              │
│  One-sentence objective                              │
└─────────────────────────────────────────────────────┘

[CONTENT AREA — varies per level type]

[BOTTOM ACTION BAR — fixed]
  Hint button (left)        Submit / Continue (right)
```

---

## WORLD 1 — FOUNDATIONS
**Theme:** Clean white-on-dark, introductory, feels like orientation day.
Accent color: Soft blue #4A90D9. No heavy interactions — this world builds
vocabulary and intuition, not calculation skills.

---

### W1 — Level 1: "What Are We Working With?"
**Concept:** Variable types — numerical continuous, numerical discrete,
categorical nominal, categorical ordinal, temporal.

**Layout:**
Two-column layout. Left column: a sample dataset table (6 columns, 5 rows)
showing a mix of variable types. Columns: Age, Salary, City, Education_Level,
Purchase_Date, Num_Children. Data looks clean and friendly here — this is
the calm before the storm.

**Dataset Table Design:**
Each column header has a small colored badge showing "?" initially.
The table uses alternating row colors (#1A1D27 and #22263A).
Column headers are bold, white text on #2E3250 background.
Numbers are in mono font. Strings in regular font.

**Right Column: Drop Zones**
Five labeled buckets arranged vertically:
- "Numerical — Continuous" (blue icon: wave)
- "Numerical — Discrete" (blue icon: steps)
- "Categorical — Nominal" (gold icon: tag)
- "Categorical — Ordinal" (gold icon: ordered list)
- "Temporal" (teal icon: clock)

Each bucket is a rounded rectangle with a dashed border when empty,
solid border when it has items. Shows a count badge.

**Interaction:**
Player drags column header badges from the table into the correct bucket.
When a badge is picked up, the corresponding column in the table highlights.
On correct drop: bucket border turns accent color, plays soft chime,
badge snaps in with a satisfying pop animation.
On incorrect drop: badge bounces back, screen edge flashes red briefly.

**Completion:** All 5 columns correctly sorted. A summary card slides up
showing the definitions of each type with an example.

---

### W1 — Level 2: "Spot the Problems"
**Concept:** Identifying the four common data problems visually before
learning to fix them. Missing values, outliers, scale differences, high cardinality.

**Layout:**
Full width dataset table, 8 columns, 12 rows. This dataset is intentionally
messy — visible NaN cells, one obviously extreme value (e.g., salary of 999999),
a City column with 8 different values in 12 rows, Age in range 18-60 vs
Salary in range 1000-80000.

**Dataset Table Design:**
NaN cells appear as empty cells with a faint diagonal stripe pattern
(like a "missing tile"). The outlier value is in normal styling — player
must identify it themselves. Columns have visible value ranges shown
in small caption under each header (e.g., "Age: 18–60").

**Interaction:**
Player clicks on cells or columns to flag them. A small floating toolbar
appears on click with four options:
- 🕳️ "Missing Value"
- ⚡ "Outlier"
- 📏 "Scale Issue" (must click on a column header)
- 🏷️ "High Cardinality" (must click on a column header)

Flagging correctly turns that cell/column a subtle version of the
corresponding color. A problem counter in the corner tracks "X / 4 problems found."

**Bottom:** Once all four problem types are flagged, a panel slides up
with a brief explanation of each: what it is, why it matters, which chapter
will fix it. Each explanation card has the color of that problem type's world.

---

### W1 — Level 3: "Build the Pipeline"
**Concept:** Understanding the correct order of preprocessing steps.

**Layout:**
Center screen. Four large cards scattered in a disorganized pile layout
(slight random rotations, overlapping slightly). Each card shows a step name
and small icon:
- 🧹 "Cleaning & Imputation"
- ⚡ "Outlier Treatment"
- 🔢 "Encoding"
- ⚖️ "Scaling"

Below the pile: a horizontal "pipeline rail" — a glowing track with 4 numbered
slots labeled 1, 2, 3, 4.

**Interaction:**
Drag-and-drop cards onto the numbered slots. Cards snap into place.
Slots are slightly larger than cards with a pulsing border indicating
they're active drop targets.

On submission: if correct order, the pipeline rail animates — a glowing dot
travels from slot 1 through to slot 4, leaving a colored trail.
If incorrect: the wrong card slot shakes, player can try again.

**Completion card:** Shows the full pipeline formula from the course:
X' = f_scale(f_encode(f_outliers(f_impute(X))))
Rendered in a large mono font with each function in its world's accent color.

---

### W1 — Level 4: "Quick Check" (MCQ)
**Concept:** Review of all W1 concepts.

**Layout:**
Clean, card-based quiz. One question at a time, centered on screen.
Question number shown as a small progress indicator (1/5, 2/5...).
Each question card has a subtle world-1 blue border.

Questions cover:
1. Variable type identification from a description
2. Which problem does a NaN represent?
3. Which step comes before encoding?
4. True/False: arbres de décision need scaling
5. Match the problem to its treatment (mini matching exercise inline)

**Design:**
Answer options are large clickable cards (not radio buttons).
On selection: chosen card highlights in primary accent.
On confirm: correct turns teal with checkmark, wrong turns red with
explanation text appearing below the card.
No going back to previous questions.

**Completion:** Star rating (3 stars = all correct, 2 stars = 1 wrong, 1 star = 2+ wrong).
Brief world summary card before transitioning.

---

## WORLD 2 — MISSING DATA
**Theme:** Deep navy/dark blue palette. The visual metaphor is puzzle pieces —
missing data as missing pieces. Feels slightly mysterious, like detective work.
Accent color: #4A90D9 on a darker base.

---

### W2 — Level 1: "Why Is It Missing?"
**Concept:** MCAR, MAR, MNAR — understanding the three mechanisms.

**Layout:**
Three large scenario cards laid out horizontally. Each card presents a
real-world scenario in plain language. Player must drag a label onto each card:

Scenarios (examples):
- "A sensor randomly fails once every 100 readings, with no pattern."
  → MCAR
- "Higher-income people tend to skip the salary question in surveys."
  → MNAR
- "Older patients are less likely to have digital records entered."
  → MAR

**Card Design:**
Each scenario card is tall (400px), with a subtle illustrated background
(abstract shapes matching the scenario — sensor waves, survey form, hospital icon).
Text is centered, large, easy to read. At the bottom of each card,
an empty drop target with the label "Drop mechanism here."

**Label Tokens:**
Three pill-shaped draggable tokens at the top: MCAR (green), MAR (amber), MNAR (red).
Each token has a one-line definition visible on hover.

**Completion:** All three correctly placed. An accordion-style explanation panel
expands below each card showing the formal definition and why it matters for
choosing imputation strategy.

---

### W2 — Level 2: "Calculate the Imputation"
**Concept:** Mean and median imputation formulas, applied by hand.

**Layout:**
Split screen. Left: a simple 6-row dataset showing an Age column with
one missing value marked as "?". Right: an in-game calculator widget
plus a step-by-step formula guide.

**Dataset Display:**
Age column values visible: [25, 30, ?, 28, 35, 22].
The "?" cell is highlighted with a pulsing amber border.
A small toggle above the dataset: "Use Mean" | "Use Median" (switch between tasks).

**Calculator Widget Design:**
Sits in a card on the right. Looks like a minimal calculator:
- Display screen (shows current calculation in mono font)
- Number buttons (0-9)
- Operation buttons (+, -, ÷, ×, =)
- Special buttons: "Sum", "Count", "Sort" (for median workflow)
- Clear button

Below the calculator, a "Step Guide" accordion:
- Step 1: Sum all non-missing values (expands to show formula)
- Step 2: Count non-missing values
- Step 3: Divide (for mean) / Find middle (for median)
Each step has a small checkbox that auto-checks when player performs that operation.

**Answer Input:**
Below the dataset, an input field: "Replace ? with: [___]"
Player types their calculated value, hits confirm.
If correct within ±0.1: cell fills in with the value, green flash, XP gained.

**Both tasks must be completed** (once with mean, once with median).
A comparison panel then shows both results side by side with a note about
when to prefer each.

---

### W2 — Level 3: "Choose Your Weapon"
**Concept:** Matching the right imputation strategy to the right situation.

**Layout:**
A series of 5 scenario cards appear one by one (like a card deck).
Each card describes a column and its context. Player must choose from
4 strategy buttons at the bottom of each card.

Example scenario cards:
- "Column: Salary. Distribution: highly skewed (some very high earners).
   Missing: 8%. Mechanism: likely MCAR."
  → Correct: Median

- "Column: City. Type: categorical nominal. Missing: 5%."
  → Correct: Mode or "Missing" category

- "Column: Temperature (sensor). Missing: 15%. You suspect MNAR —
   sensor only fails at extreme temperatures."
  → Correct: "Missing" category / flag indicator

**Card Design:**
Each scenario card is a tall playing card (320px × 420px) centered on screen.
Background has a subtle data pattern. Strategy buttons sit below the card
as 4 equally-sized options in a row. Selecting one highlights it.
Confirm button appears after selection.

Correct answer: card flips (CSS 3D flip animation) to reveal explanation on back.
Wrong answer: card shakes, hint text appears, player can try again (costs a life).

---

### W2 — Level 4: "The Indicator Variable"
**Concept:** Adding a binary missing-indicator column alongside imputed values.

**Layout:**
A before/after split screen showing a dataset transformation.

Left panel ("Before"): Dataset with 3 rows, Age column has one "?" and one normal value.
Shows columns: Age | Salary | City

Right panel ("After"): Grayed out initially, reveals column by column.

**Interaction:**
Player is given 3 tasks via a small checklist on the side:
1. "Fill the missing Age value with median (27)" — player clicks the "?" cell,
   types 27, confirms
2. "Add a new column called Age_missing" — player clicks an "Add Column" button,
   names it via an input field
3. "Fill Age_missing correctly" — a mini table appears where player must click
   cells to toggle 0/1 correctly

As each task completes, the right "After" panel reveals the corresponding
column, building the final table visually.

**Completion:** Right panel is fully revealed with a side-by-side comparison.
A formula card slides up: m_i = 1{x_i missing} with explanation.

---

### W2 — Level 5: "MCQ — Missing Data"
Same MCQ format as W1 Level 4. 6 questions covering all W2 concepts.
Question types: definition matching, formula completion, strategy selection,
true/false, scenario judgment, ordering steps.
World 2 blue accent color throughout.

---

### W2 — Level 6: "Code Fix — Imputation"
**Concept:** First code level. Fix a dataset's missing values using pandas-like commands.

**Layout:**
Three-panel layout.
Left panel (40%): Dataset table, scrollable, 15 rows, 4 columns.
Some cells show NaN. Column headers show null counts in small badges.
Middle panel (40%): Code editor.
Right panel (20%): Command reference card (cheat sheet, always visible).

**Code Editor Design:**
Dark background (#0D0F18). Line numbers in muted color on left.
Syntax highlighting: keywords in purple, strings in teal, numbers in amber,
comments in grey. Cursor blinks. Accepts keyboard input naturally.
A "▶ Run" button at the top right of the editor panel (teal, prominent).
Below editor: small output console that shows success/error messages.

**Available Commands (shown in reference card):**
```
df.info()                    → show column info + null counts
df.isnull().sum()            → count nulls per column
df['col'].fillna(value)      → fill nulls with a value
df['col'].fillna(df['col'].mean())    → fill with mean
df['col'].fillna(df['col'].median())  → fill with median
df['col'].fillna('Missing')  → fill categoricals
df['col_missing'] = df['col'].isnull().astype(int)  → add indicator
```

**Task Sidebar (small, right side):**
Shows 3 specific tasks:
- "Fix missing Age values (skewed distribution)"
- "Fix missing City values (categorical)"
- "Add missing indicator for Age"

Each task has a small status dot (grey = pending, amber = in progress, teal = complete).
Tasks auto-detect when the player has written and run the correct command.

**Dataset Table Updates:**
When player runs a valid command, the affected cells animate — they briefly
highlight amber then settle to their new values. NaN badges on column headers
update in real time.

**Completion:** All 3 tasks complete. A summary card shows the final clean
dataset preview with a "Level Complete" overlay.

---

## WORLD 3 — OUTLIERS
**Theme:** Orange-red danger aesthetic. Visual metaphor is a scatter plot
with rogue data points. Feels like defusing something volatile.
Accent color: #E85D26. Dataset tables use subtle red-tinted rows for outlier cells.

---

### W3 — Level 1: "See the Outlier"
**Concept:** Visual intuition for outliers before any formula.

**Layout:**
Full-width horizontal dot plot (think: number line with data points as circles).
Data points are rendered as glowing circles on a horizontal axis.
Most cluster together in a range. One point is way off to the right.

**Dot Plot Design:**
Background: dark with subtle grid lines.
Normal points: small (12px), soft blue circles with slight glow.
The outlier: same size initially — player must spot it.
X-axis shows the value scale.
On hover over any dot: a tooltip shows the exact value.

**Interaction:**
Player clicks the dot they think is the outlier.
On correct click: that dot turns red-orange, grows slightly, a label appears:
"Value: 100,000 — this is 40× the average salary."
An annotation line appears showing the distance from the cluster.

Second interaction: player drags a bracket/range selector to show
"where normal data lives." Two handles on the axis — drag to set the range.
On confirm: everything outside the bracket highlights in danger red.

**No formulas yet** — this level is purely visual intuition.

---

### W3 — Level 2: "The IQR Method"
**Concept:** Computing Q1, Q3, IQR, and the outlier detection thresholds.

**Layout:**
Left side: a sorted data array shown vertically (like a column),
values highlighted to show Q1, median, Q3 positions.
Right side: step-by-step calculator workflow.

**Sorted Data Display:**
Values shown as a vertical list in mono font, each in a small pill.
A slider/bracket overlay on the side of the list lets player drag to
mark the Q1 and Q3 positions. The Q2 (median) position is pre-marked
with a small horizontal line.
When Q1 and Q3 are correctly marked, the IQR bracket appears between them
with a label "IQR = Q3 − Q1".

**Calculator Steps Panel:**
Step 1 — "Calculate Q1": Player uses calculator to find the value.
An input field waits for their answer.
Step 2 — "Calculate Q3": Same.
Step 3 — "Calculate IQR": Input: Q3 − Q1, calculator available.
Step 4 — "Lower fence": Input: Q1 − (1.5 × IQR)
Step 5 — "Upper fence": Input: Q3 + (1.5 × IQR)

Each step unlocks only after the previous is correctly answered.
Correct answers fill a "formula card" on the right that builds up step by step,
showing the complete IQR method at the end.

**Completion Visualization:**
The dot plot from Level 1 reappears, now with the fence lines drawn on it.
Points outside the fences turn red. A final stat card shows: "1 outlier detected."

---

### W3 — Level 3: "The Z-Score Method"
**Concept:** Standardizing data and detecting outliers at |z| > 3.

**Layout:**
Two-panel. Left: original data column. Right: transformed z-score column (revealed progressively).

**Left Panel:**
Data values shown as a vertical bar chart (small bars). Mean line drawn across.
A "σ" label shows the standard deviation visually as a bracket on the chart.

**Right Panel:**
Initially blank. As player completes each calculation step, z-score values
appear for each data point. Values |z| > 3 appear in red.

**Calculator Steps:**
Step 1: "Calculate the mean (μ)" — use calculator
Step 2: "Calculate the standard deviation (σ)" — formula shown, calculator assists
Step 3: "For the extreme value, calculate z = (x − μ) / σ" — typed answer

On correct z-score entry for the outlier: that bar on the left chart
turns red-orange with a label "|z| = 3.8 — OUTLIER."

**Toggle Comparison:**
A toggle button: "Switch to IQR View" — swaps between both methods applied
to the same dataset, letting player see that both detect the same outlier here.
A note: "When distributions are not normal, prefer IQR."

---

### W3 — Level 4: "What Do We Do With It?"
**Concept:** Three treatment methods — suppress, cap, log transform.

**Layout:**
Central dataset shown (small table, one obvious outlier). Three large method
cards below, each showing the method name, formula, and an animated preview.

**Method Cards:**
Card 1 — "Suppression":
Icon: trash/delete. Formula: remove rows where x ∉ [fence_low, fence_high].
Preview animation: the outlier row has a strikethrough effect, then fades out.
"Best for: noisy/erroneous data. Risk: data loss."

Card 2 — "Capping (Winsorization)":
Icon: clip/boundary. Formula: x' = fence_high if x > fence_high, else x.
Preview animation: the outlier value counts down to the upper fence value.
"Best for: rare but valid data. Preserves row count."

Card 3 — "Log Transform":
Icon: compression arrows. Formula: x' = log(x + 1).
Preview animation: a before/after bar chart shows the compressed distribution.
"Best for: financial/skewed data. Reduces scale dramatically."

**Interaction:**
Three scenarios are presented one at a time via scenario cards (same style as W2-L3).
Player must select and apply the best treatment for each scenario.
After selection, a before/after visualization plays for that treatment.

---

### W3 — Level 5: "MCQ — Outliers"
Same MCQ format. 6 questions. Covers IQR formula, Z-score formula, method
selection, impact on different model types (linear vs tree-based), and
reading a boxplot to identify outliers.

---

### W3 — Level 6: "Code Fix — Outliers"
Same 3-panel layout as W2 Level 6.

**Available Commands:**
```
df.describe()                        → show stats including min/max
df['col'].quantile(0.25)             → Q1
df['col'].quantile(0.75)             → Q3
Q1 = df['col'].quantile(0.25)        → store Q1
Q3 = df['col'].quantile(0.75)        → store Q3
IQR = Q3 - Q1                        → compute IQR
lower = Q1 - 1.5 * IQR              → lower fence
upper = Q3 + 1.5 * IQR              → upper fence
df = df[df['col'] <= upper]          → suppress outliers
df['col'] = df['col'].clip(lower, upper)  → cap outliers
df['col'] = np.log1p(df['col'])      → log transform
```

**Dataset:** 20 rows, 3 columns. Two outliers hidden in different columns.
Tasks:
- "Detect and remove the outlier in the Age column using IQR"
- "Cap the outliers in the Salary column at the IQR fences"

---

## WORLD 4 — ENCODING
**Theme:** Gold/amber palette. Visual metaphor is a transformation matrix —
messy categories becoming clean numbers. Feels organized, structured.
Accent color: #C9A84C. Data tables show categorical values in styled
colored pills/badges.

---

### W4 — Level 1: "The One-Hot Grid"
**Concept:** Understanding and manually building a One-Hot encoded matrix.

**Layout:**
Two tables side by side. Left: original single-column table (Ville column,
5 rows: Casa, Rabat, Fès, Casa, Rabat). Right: incomplete One-Hot matrix
with column headers already set (Casa | Rabat | Fès) but cells empty.

**Right Table Design:**
Each cell is a clickable square (48px × 48px). Clicking toggles between 0 and 1.
Current value shown large in center of cell.
Cells that should be 1 have a light background target indicator (very subtle).

**Interaction:**
Player fills in the matrix by clicking cells. Each click toggles 0→1→0.
A row validator checks each row: if a row has exactly one "1", it glows
green on the left row header. If a row has 0 or 2+ ones, it shows amber warning.

On completion (all cells correct): the two tables animate together —
the original category values transform into their vectors with a connecting
animation (lines draw from each category word to its corresponding column).

**Tip card:** After completion, a "Dummy Variable Trap" info card appears:
"In practice, we drop one column to avoid perfect multicollinearity."
A small interactive demo shows dropping the Fès column and explaining why.

---

### W4 — Level 2: "Label Encoding — The Hidden Danger"
**Concept:** Label encoding process and its order problem.

**Layout:**
Left: original categorical column (Education_Level: Bac, Licence, Master, Doctorat).
Center: a "Label Encoder" machine (visual — a box with input on top, output below).
Right: the encoded column appearing as the player works through it.

**Machine Visual:**
A stylized black box with a conveyor belt metaphor. Category labels
enter from the top (animated drop), a number exits the bottom.

**Part 1 — Apply Encoding:**
Player assigns numbers to each category by dragging number tokens
(0, 1, 2, 3) onto the category labels. Any order is accepted at first.

**Part 2 — The Danger Demo:**
After encoding, a linear model prediction widget appears.
Two sliders: "Education = Bac (0)" and "Education = Doctorat (3)".
The model treats the difference as 3 units. A simple bar chart shows
predicted salary changing linearly with the encoded number.
A warning card: "The model thinks Master (2) is twice as good as Licence (1)
— is that true?" Toggle to see the problem visually.

**Part 3 — When It's OK:**
A new scenario: the same column but this time with natural order
(Low, Medium, High). Player re-encodes. The model widget shows
this ordering actually makes sense — the relationship is valid.

---

### W4 — Level 3: "Frequency Encoding"
**Concept:** Computing and applying frequency encoding.

**Layout:**
Left: original column (Ville, 10 rows, 4 unique values with different frequencies).
Center: a frequency counter widget. Right: the encoded column to fill in.

**Counter Widget:**
Shows a tally-style counter for each unique city.
As player clicks "Count" button, it animates through the column
row by row, incrementing the counter for each city.
After counting: the frequency table appears showing ni and ni/N for each.

**Encoding Task:**
Player must fill in the encoded column by clicking each cell and selecting
from a dropdown showing the computed frequencies.
(e.g., Casa appears 5/10 times → 0.5)

**Completion Visualization:**
A bar chart renders showing frequency distribution.
Side note appears: "Two cities with same frequency get same encoding —
the model can't distinguish them. Trade-off of this method."

---

### W4 — Level 4: "Taming High Cardinality"
**Concept:** Identifying rare categories and grouping them into "Autres."

**Layout:**
Full-width bar chart at top showing all unique values in a Ville column
and their frequencies. 8 categories total, 3 with very low frequency (<5%).

**Chart Design:**
Horizontal bar chart. Each bar labeled with the city name.
High-frequency bars: gold/amber. Low-frequency bars: initially the same color.

**Interaction Part 1 — Set the threshold:**
A slider labeled "Rare threshold (%)" sits below the chart, range 0–20%.
As player drags the slider, bars below the threshold turn red-orange.
A "Categories to group: X" counter updates in real time.

**Interaction Part 2 — Apply grouping:**
"Apply Grouping" button. The rare bars animate — they merge together
with a collapsing animation into a single new bar labeled "Autres."
Chart re-renders with the grouped dataset. Cardinality counter:
"Reduced from 8 to 5 unique values."

**Interaction Part 3 — Impact preview:**
Toggle showing what the One-Hot matrix would look like before (8 columns)
vs after grouping (5 columns). Column count badge animates down.

---

### W4 — Level 5: "Which Encoding When?"
**Concept:** Matching encoding method to model and variable type.

**Layout:**
A decision-flow game. Player is shown a variable description card
and a model type badge, then must drag the variable to the correct
encoding method zone.

Example combinations:
- "Couleur (nominal, 3 values) + Linear Regression" → One-Hot
- "Niveau d'étude (ordinal: faible/moyen/élevé) + Random Forest" → Label
- "Code postal (500 unique values) + Neural Network" → Frequency
- "Taille de ville (ordinal) + Linear Regression" → Label (valid order)

**Layout:**
Three drop zones at bottom (One-Hot | Label | Frequency).
Variable cards fall from top of screen (gentle gravity animation).
Player catches/drags them to correct zone.
A streak counter rewards consecutive correct placements.

---

### W4 — Level 6: "MCQ — Encoding"
6 questions. Covers One-Hot formula, Label Encoding risks, Frequency
encoding computation, cardinality definition, rare category handling,
and model-encoding compatibility.

---

### W4 — Level 7: "Code Fix — Encoding"
3-panel layout. Dataset has one nominal column, one ordinal column,
one high-cardinality column with rare values.

**Available Commands:**
```
df['col'].value_counts()             → see frequency/cardinality
pd.get_dummies(df, columns=['col'])  → one-hot encode
df['col'].map({'a': 0, 'b': 1})     → label/ordinal encode
freq = df['col'].value_counts(normalize=True)  → compute frequencies
df['col'] = df['col'].map(freq)      → frequency encode
threshold = 0.05
rare = freq[freq < threshold].index
df['col'] = df['col'].replace(rare, 'Autres')  → group rare
```

**Tasks:**
- "Group rare categories in City column (threshold: 5%)"
- "One-Hot encode the City column after grouping"
- "Ordinal encode the Education_Level column (Bac=0, Licence=1, Master=2, Doctorat=3)"

---

## WORLD 5 — SCALING
**Theme:** Teal/green palette. Visual metaphor is a balance scale
and measurement instruments. Feels precise, scientific, laboratory.
Accent color: #00B4A0. Distribution curves and axis labels feature prominently.

---

### W5 — Level 1: "The Scale Problem"
**Concept:** Visualizing why unequal scales distort distance-based algorithms.

**Layout:**
Two scatter plots side by side showing same data.
Left plot ("Before Scaling"): X-axis is Age (18-60), Y-axis is Salary (1000-80000).
Data points cluster near the X-axis because Salary dominates.
Right plot ("After Scaling"): Same data after scaling — circular cluster, balanced.

**Interactive Element:**
A "KNN Distance Demo" widget. Two data points shown on the unscaled plot.
Player hovers over them to see the Euclidean distance calculated
with a tooltip showing the breakdown:
"Age diff: 5 → contributes 25 to distance²
 Salary diff: 20000 → contributes 400,000,000 to distance²"
A warning highlight shows salary completely dominates.

Then the same points on the scaled plot: both dimensions contribute equally.

**Toggle:** "Show me what KNN gets wrong without scaling" — a quick
animated demo of a misclassification caused by scale imbalance.

---

### W5 — Level 2: "Min-Max in Your Hands"
**Concept:** Computing Min-Max normalization manually.

**Layout:**
Left: a 5-value column (e.g., Age: [18, 25, 30, 45, 60]).
Center: min and max are highlighted in the column with labels.
Right: empty normalized column to fill in.

**Interaction:**
Player must compute each normalized value using the in-game calculator.
The formula is always visible: x' = (x − x_min) / (x_max − x_min)
Three input fields at bottom: x_min, x_max (player identifies and types these),
then for each row, the calculator assists.

Each correctly computed cell fills in the right column with a smooth
number-counting animation from 0 to the correct value.

**Range Visualization:**
Below both columns, a small bar chart shows the before (wide range) and
after (all values 0–1) distributions side by side.

**Sensitivity Demo:**
After completing, a new value appears: "Add an outlier: 500."
Player recalculates the normalized values — they see all other values
compress near 0. A warning card: "Min-Max is sensitive to outliers."

---

### W5 — Level 3: "Z-Score Standardization"
**Concept:** Computing Z-score scaling for centering and normalizing variance.

**Layout:**
Same structure as Level 2 but for standardization.
Left: original column. Center: bell curve visualization with μ marked.
Right: z-score column to fill.

**Bell Curve Widget:**
An animated bell curve drawn in teal. As player enters each z-score,
a dot appears on the curve at the corresponding position.
Values at z > 3 or z < −3 shown in red (connecting back to outlier detection).

**Calculator Steps shown:**
"Step 1: Calculate μ (mean)" → player computes
"Step 2: Calculate σ (std dev)" → formula shown, player computes with calculator
"Step 3: For each value, z = (x − μ) / σ" → player fills each cell

**Key Property Card at completion:**
"Result: Mean = 0, Variance = 1. Comparable to all other standardized features."
A side-by-side showing μ and σ before and after.

---

### W5 — Level 4: "Log Transform — Taming the Skew"
**Concept:** Log transformation for skewed distributions.

**Layout:**
Two histogram panels. Left: skewed distribution (Salary with long right tail).
Right: transformed distribution (log applied — more symmetric).

**Interaction:**
A large lever/slider labeled "Apply log(x+1)".
As player drags the slider from 0% to 100%:
- The histogram on the right animates from the original distribution
  toward the log-transformed one
- The long right tail compresses visually
- A skewness indicator below the chart updates in real time

Player locks in at 100%, confirming the transformation.

**Three Examples shown sequentially:**
1. Salary data → dramatic improvement
2. Age data → minimal change (already normal) — teaching when NOT to use log
3. Count data (purchases per customer) → moderate improvement

**Takeaway Card:**
"Use when: distribution is heavily right-skewed (skewness > 1).
 Avoid when: data already approximately normal."

---

### W5 — Level 5: "Which Scaling for Which Model?"
**Concept:** Matching scaling methods to algorithm types.

**Layout:**
Same drag-to-zone format as W4 Level 5.
Three zones: "MinMax Scaling" | "Standardization (Z-score)" | "No Scaling Needed"
Algorithm cards float down: KNN, Random Forest, SVM, Neural Network,
Decision Tree, Linear Regression, K-Means.

**Visual for each algorithm card:**
Small icon + name + a one-line hint visible on hover.
(e.g., "KNN — distance-based, sensitive to scale")

After all placed correctly, a summary matrix appears:
Algorithm × "Needs Scaling?" with a checkmark grid — useful study reference.

---

### W5 — Level 6: "MCQ — Scaling"
6 questions. Min-Max formula, Z-score formula, choosing between them,
log transform use case, impact on linear regression coefficients,
and a calculation question.

---

### W5 — Level 7: "Code Fix — Scaling"
Dataset: 20 rows, Age + Salary + Purchase_Count columns. Each needs a
different scaling treatment to demonstrate the choice.

**Available Commands:**
```
df.describe()                         → check ranges and distribution
from sklearn.preprocessing import MinMaxScaler, StandardScaler
scaler_mm = MinMaxScaler()
scaler_std = StandardScaler()
df['col_scaled'] = scaler_mm.fit_transform(df[['col']])
df['col_scaled'] = scaler_std.fit_transform(df[['col']])
df['col'] = np.log1p(df['col'])       → log transform
df['col'].skew()                      → check skewness
```

**Tasks:**
- "Normalize Age with Min-Max (bounded variable, known range)"
- "Standardize Salary with Z-score (approximately normal)"
- "Apply log transform to Purchase_Count (heavy right skew)"

---

## WORLD 6 — THE FULL PIPELINE
**Theme:** Dark industrial purple-grey. Visual metaphor is a factory floor
with conveyor belts connecting processing stations. This world synthesizes
everything. Accent color: #7B5EA7. All previous world accent colors appear
here as component colors — this world contains all of them.

---

### W6 — Level 1: "Assemble the Factory"
**Concept:** Understanding the full pipeline order and why it matters.

**Layout:**
A factory floor bird's-eye view. Five "processing stations" sit scattered
on the floor, unconnected. A conveyor belt track is drawn between start
(raw dataset bin, left) and end (clean dataset, right) with 4 empty station slots.

**Station Cards:**
Each station is a large industrial-looking card with:
- The station name
- Icon matching its world color
- A brief "what it does" caption

Player drags stations into the correct slot positions on the conveyor belt.
On correct placement: station locks in, conveyor belt segment between stations
lights up, a brief animation shows data "flowing" through.

On full completion: an animated demo runs — a small data packet icon
travels the entire belt from start to finish, passing through each station
which briefly highlights as it processes.

---

### W6 — Level 2: "The Data Leakage Trap"
**Concept:** Understanding and identifying data leakage in preprocessing.

**Layout:**
A timeline-style layout showing a ML workflow:
Data → Split train/test → [preprocessing steps] → Train model → Evaluate

**Scenario Cards (4 scenarios, player judges each):**
Each card shows a code snippet or workflow description. Player must click
"✓ Safe" or "⚠️ Leakage" for each.

Examples:
1. "Computed mean for imputation using only training data, then applied to test."
   → Safe
2. "Scaled the entire dataset with MinMax before splitting into train/test."
   → Leakage (test stats contaminate scaler)
3. "Fit the One-Hot encoder on training data only, used same mapping on test."
   → Safe
4. "Computed frequency encoding using all data including test set frequencies."
   → Leakage

On "Leakage" identified correctly: a dramatic animation — a red "leak"
graphic appears on the timeline, data flows backward from test to train,
the evaluation bar inflates artificially showing "optimistic" performance.

**Rule Card at completion:**
"Golden Rule: Fit on Train. Transform Both."
Visual showing the correct fit_transform(train) → transform(test) pattern.

---

### W6 — Level 3: "Pipeline Builder — Full Run"
**Concept:** Applying a complete pipeline to a small dataset manually,
step by step, tracking all transformations.

**Layout:**
Left panel: starting dataset (5 rows, 4 columns, multiple problems visible).
Center: active step panel (highlights current stage).
Right panel: transformation log (running list of what's been done).

**Step Sequence:**
Player is guided through each stage but must make decisions at each:
1. Imputation — two missing values. Player chooses method, applies.
2. Outlier treatment — one outlier. Player chooses method, applies.
3. Encoding — one categorical column. Player chooses encoding type.
4. Scaling — two numerical columns. Player chooses scaling method.

At each step, the dataset table on the left visually updates.
The right-side log adds an entry: "Step 3 — Encoded 'City' with One-Hot → +2 columns."

**Final State:**
After step 4, the dataset is fully clean. A "Pipeline Recipe" card appears
showing the complete pipeline as a Python-like pseudocode summary:
```
pipeline = [
  impute(Age, method='median'),
  impute(City, method='missing_category'),
  cap_outliers(Salary, method='IQR'),
  encode(City, method='one_hot'),
  scale(Age, method='minmax'),
  scale(Salary, method='zscore')
]
```

---

### W6 — Level 4: "Full MCQ — All Worlds"
**Concept:** Comprehensive review of all six chapters.

**Layout:**
Same MCQ card format but with a special visual — the background shows
all 6 world colors as a gentle gradient, signaling this covers everything.

15 questions drawing from all worlds. Mix of:
- Calculation questions (compute IQR, compute z-score, compute frequency)
- Conceptual (MCAR vs MAR, One-Hot vs Label, when to use log)
- Application (given a dataset description, choose full preprocessing strategy)
- Code reading (given a code snippet, what does it output?)
- Ordering (arrange steps correctly)

A world badge appears next to each question indicating which chapter it's from.
After all 15, a detailed breakdown shows performance per world
with a "weak spots" highlight.

---

### W6 — FINAL LEVEL: "The Real Dataset"
**Concept:** Apply the full end-to-end pipeline to a 100-row messy dataset
using code, starting from problem discovery through to a clean, model-ready dataset.

**Layout:**
Four-panel layout. The most complex screen in the game.

**Panel 1 (Top-left, 45%): Dataset Explorer**
Scrollable table showing the raw 100-row dataset.
Columns: Age | Salary | City | Education_Level | Purchase_Count | Join_Date
The table has a search/filter bar above it. Column headers are clickable
to sort. A small "column stats" icon on each header opens a mini stats
panel (min, max, mean, null count, unique count).
Visual indicators on problematic cells (subtle — not too obvious):
- NaN cells: slightly different background
- No special styling for outliers — player must find them

**Panel 2 (Top-right, 30%): Code Editor**
Full-featured editor with all previously introduced commands available.
Plus new exploration commands: df.hist(), df.boxplot() (outputs text-based
visualizations in the output console below).
▶ Run button. Output console below editor.

**Panel 3 (Bottom, 80%): Problem Checklist**
This is the star feature. Initially shows a row of blurred/unknown cards:

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│      ?       │ │      ?       │ │      ?       │ │      ?       │
│  Unidentified│ │  Unidentified│ │  Unidentified│ │  Unidentified│
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

Player count doesn't know how many problems exist initially.
More ? cards appear as they discover issues.

**Problem Discovery Flow:**
- Running df.isnull().sum() → reveals missing value task cards (named)
- Running df.describe() → reveals outlier + scale difference task cards
- Running df['City'].value_counts() → reveals high cardinality task card
- Running df.dtypes → reveals encoding task card

**Each revealed task card shows:**
- Problem title (e.g., "Missing values in Age — 12 nulls")
- Status: ● Identified | ● In Progress | ✓ Fixed
- Small "which world taught this" badge (colored dot)
- A collapse arrow to minimize the card

**Task Fix Detection:**
When player runs correct fix code and it runs without error:
- The affected task card animates to "Fixed" status
- Card border turns teal (success color)
- A checkmark animates in
- XP burst animation plays
- The dataset table updates live to reflect the fix

**Panel 4 (Bottom-right, 20%): Progress Summary**
A mini dashboard showing:
- Problems found: X / total
- Problems fixed: X / found
- A mini version of the pipeline showing which stages are "done" (colored)
  vs "pending" (grey)
- "Dataset Health" score: starts at 0%, reaches 100% when all fixed.
  A circular progress indicator in the world's purple accent color.

**The 6 Hidden Problems in the Dataset:**
1. Age column: 12 missing values (use median — right-skewed)
2. City column: 8 missing values (use "Missing" category)
3. Salary column: 3 extreme outliers (use IQR capping)
4. City column: high cardinality with 4 rare cities (group to "Autres")
5. City column needs One-Hot encoding after grouping
6. Age and Salary on completely different scales (standardize both)

**Win Condition:**
All task cards show ✓ Fixed. Dataset health = 100%.
A full-screen celebration overlay plays — the factory pipeline from W6-L1
lights up completely with flowing animations, all world colors cycling through.

**Final Screen:**
Shows the player's complete "Data Pipeline Report":
- The cleaned dataset preview (first 10 rows)
- The full sequence of commands they used, formatted as a Python script
- Stats: total time, hints used, mistakes made
- Star rating (1–3 stars based on mistakes and hints)
- Option to export their solution as a .py file (downloads as text)

---

## LEVEL COMPLETE SCREEN (shared template)

**Design:**
Full screen overlay, dark with world accent color particles.
Large world icon in center, animated (spinning slightly).
"LEVEL COMPLETE" in large bold text.
XP gained: animated counter.
Stars earned: 1/2/3 stars appearing one by one with pop animations.
Brief best fact: one key takeaway from the level in a styled quote card.
Two buttons: "Continue →" (prominent) and "Replay ↺" (subtle).

---

## GAME OVER / RETRY SCREEN

**Design:**
Red-tinted dark overlay. Simple layout.
"Out of attempts" message. Current score shown.
"Retry Level" button (prominent, amber) and "Return to Map" button (subtle).

---

## SETTINGS PANEL

Accessible from any level via gear icon.
Options: sound toggle, music volume slider, font size (accessibility),
color blind mode (replaces red/green with orange/blue), hint auto-show toggle.

---

## ACCESSIBILITY

- All drag-drop interactions have keyboard alternatives (Tab + Enter)
- Color is never the only indicator (always paired with icon/text)
- Calculator can be operated with keyboard
- All tooltips readable by screen readers
- Minimum contrast ratio 4.5:1 throughout

---
```