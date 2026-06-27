'use strict';

import { approxEqual } from '../../data/answers.js';
import { createDataset, DATASET_KEYS } from '../../data/datasets.js';
import { getLevelProblem } from '../../data/problems.js';
import { DataFrame } from '../../pandas/dataframe.js';
import { ChartWidget } from '../../widgets/charts.js';
import { DataTable } from '../../widgets/datatable.js';
import { CodeEditorWidget } from '../../widgets/editor.js?v=20260614b';

const PROBLEM = getLevelProblem(3, 6);
const LEVEL_TITLE = PROBLEM?.title ?? 'Code Fix - Outliers';
const LEVEL_OBJECTIVE = PROBLEM?.objective ?? 'Inspect a dataset and cap or remove outliers with pandas-like commands.';

function createFallbackDataset() {
  return DataFrame.fromRows([
    { Customer_ID: 1,  Age: 23, Salary: 32000 },
    { Customer_ID: 2,  Age: 25, Salary: 34000 },
    { Customer_ID: 3,  Age: 27, Salary: 35500 },
    { Customer_ID: 4,  Age: 29, Salary: 36800 },
    { Customer_ID: 5,  Age: 31, Salary: 38200 },
    { Customer_ID: 6,  Age: 33, Salary: 39600 },
    { Customer_ID: 7,  Age: 35, Salary: 41000 },
    { Customer_ID: 8,  Age: 36, Salary: 42500 },
    { Customer_ID: 9,  Age: 37, Salary: 43800 },
    { Customer_ID: 10, Age: 38, Salary: 45200 },
    { Customer_ID: 11, Age: 39, Salary: 46600 },
    { Customer_ID: 12, Age: 40, Salary: 48000 },
    { Customer_ID: 13, Age: 41, Salary: 49500 },
    { Customer_ID: 14, Age: 42, Salary: 51000 },
    { Customer_ID: 15, Age: 43, Salary: 52800 },
    { Customer_ID: 16, Age: 44, Salary: 54600 },
    { Customer_ID: 17, Age: 28, Salary: 56500 },
    { Customer_ID: 18, Age: 32, Salary: 198000 },
    { Customer_ID: 19, Age: 79, Salary: 61200 },
    { Customer_ID: 20, Age: 34, Salary: 58900 },
  ]);
}

function createLevelDataset() {
  try {
    return createDataset(PROBLEM?.datasetKey ?? DATASET_KEYS.OUTLIER_CODE_FIX);
  } catch {
    return createFallbackDataset();
  }
}

const ORIGINAL_DF = createLevelDataset();
const ID_COLUMN = ORIGINAL_DF.columns[0] ?? 'Customer_ID';
const AGE_COLUMN = ORIGINAL_DF.columns.includes('Age') ? 'Age' : ORIGINAL_DF.columns[1];
const SALARY_COLUMN = ORIGINAL_DF.columns.includes('Salary') ? 'Salary' : ORIGINAL_DF.columns[ORIGINAL_DF.columns.length - 1];
const ORIGINAL_ROWS = ORIGINAL_DF.toRows();
const ORIGINAL_ROWS_BY_ID = new Map(ORIGINAL_ROWS.map(row => [row[ID_COLUMN], row]));
const AGE_FENCES = ORIGINAL_DF.iqrFences(AGE_COLUMN);
const SALARY_FENCES = ORIGINAL_DF.iqrFences(SALARY_COLUMN);
const AGE_OUTLIER_ROW = ORIGINAL_ROWS.find(row => {
  const value = row[AGE_COLUMN];
  return typeof value === 'number' && Number.isFinite(value) && (value < AGE_FENCES.lower || value > AGE_FENCES.upper);
}) ?? ORIGINAL_ROWS[ORIGINAL_ROWS.length - 1];
const SALARY_OUTLIER_ROW = ORIGINAL_ROWS.find(row => {
  const value = row[SALARY_COLUMN];
  return typeof value === 'number' && Number.isFinite(value) && (value < SALARY_FENCES.lower || value > SALARY_FENCES.upper);
}) ?? ORIGINAL_ROWS[ORIGINAL_ROWS.length - 1];
const AGE_OUTLIER_ID = AGE_OUTLIER_ROW?.[ID_COLUMN];
const SALARY_OUTLIER_ID = SALARY_OUTLIER_ROW?.[ID_COLUMN];
const AGE_OUTLIER_VALUE = AGE_OUTLIER_ROW?.[AGE_COLUMN];
const SALARY_OUTLIER_VALUE = SALARY_OUTLIER_ROW?.[SALARY_COLUMN];
const AGE_REMOVED_DF = ORIGINAL_DF.filter(row => row[ID_COLUMN] !== AGE_OUTLIER_ID);
const AGE_REMOVED_SALARY_FENCES = AGE_REMOVED_DF.iqrFences(SALARY_COLUMN);
const ACCEPTED_SALARY_CAPS = Object.freeze([
  SALARY_FENCES.upper,
  AGE_REMOVED_SALARY_FENCES.upper,
]);

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const DECIMAL = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const WHOLE = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const REFERENCE = Object.freeze([
  "df.describe()  # Inspect each column's range and maximum.",
  "df['Column'].quantile(percentage)  # Use a decimal percentage, such as 0.xx.",
  'Q_low = ...  # Store the lower quartile for your chosen column.',
  'Q_high = ...  # Store the upper quartile for the same column.',
  'IQR = Q_high - Q_low  # Measure the spread between the quartiles.',
  'lower_fence = Q_low - multiplier * IQR  # Build the lower boundary.',
  'upper_fence = Q_high + multiplier * IQR  # Build the upper boundary.',
  "df = df[df['Column'] condition fence]  # Keep rows that satisfy your rule.",
  "df['Column'] = df['Column'].clip(lower, upper)  # Cap values without deleting rows.",
  '# Recalculate quartiles after a row-removal step if the dataset changed.',
]);

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM?.hints ?? []),
  'Start with df.describe(). The suspicious max values reveal which feature needs row removal and which one needs capping.',
  `Age is the bad row here, so suppress it after you compute the ${AGE_COLUMN} upper fence.`,
  `${SALARY_COLUMN} is the real but dangerous spike, so keep the row and clip the value at the upper fence instead of deleting it.`,
]);

const INITIAL_CODE = `# Inspect the suspicious maximums first.
# Age hides the broken row to suppress.
# Salary hides the real row to cap.

# df.describe()

# Write your pandas-like commands below:
`;

const TRACKER_STEPS = Object.freeze([
  Object.freeze({
    id: 'inspect',
    label: 'Inspect the max values',
    chapter: 'Read the stats',
    recap: 'Use df.describe() or quantiles first so you know which column needs row removal and which one needs capping.',
  }),
  Object.freeze({
    id: 'age-remove',
    label: 'Suppress the Age outlier',
    chapter: 'Row-level fix',
    recap: 'The Age spike is a broken row problem. Remove the row once the Age upper fence is ready.',
  }),
  Object.freeze({
    id: 'salary-cap',
    label: 'Cap the Salary outlier',
    chapter: 'Value-level fix',
    recap: 'The Salary spike is real but too influential, so keep the row and clip only the value.',
  }),
]);

const DEFAULT_FEEDBACK = 'Inspect first, then remove the impossible Age row and cap the real Salary spike at the IQR fence.';
const DEFAULT_STATUS = 'Recommended flow: describe -> suppress the Age outlier -> cap the Salary outlier.';
const SUMMARY_COPY = 'The clean repair removes the impossible Age row, preserves the verified Salary row, and clips only the Salary leverage that would dominate the model.';
const TOTAL_LOCKS = TRACKER_STEPS.length;
const NON_MUTATING_DF_TYPES = new Set(['head', 'tail', 'select']);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return String(value);
  return MONEY.format(value);
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  return DECIMAL.format(value);
}

function formatWhole(value) {
  if (!Number.isFinite(value)) return String(value);
  return WHOLE.format(value);
}

function rowMap(df) {
  return new Map(df.toRows().map(row => [row[ID_COLUMN], row]));
}

function validateAgeRemoval(df) {
  if (!(df instanceof DataFrame)) return false;
  if (df.length !== ORIGINAL_DF.length - 1) return false;
  if (rowMap(df).has(AGE_OUTLIER_ID)) return false;

  return df.toRows().every(row => {
    const original = ORIGINAL_ROWS_BY_ID.get(row[ID_COLUMN]);
    return Boolean(original) && row[AGE_COLUMN] === original[AGE_COLUMN];
  });
}

function validateSalaryCap(df) {
  if (!(df instanceof DataFrame)) return false;
  const rows = rowMap(df);
  const salaryRow = rows.get(SALARY_OUTLIER_ID);
  if (!salaryRow) return false;

  const cappedValue = salaryRow[SALARY_COLUMN];
  const capOk = ACCEPTED_SALARY_CAPS.some(value => approxEqual(cappedValue, value, 0.01));
  if (!capOk) return false;

  return df.toRows().every(row => {
    const original = ORIGINAL_ROWS_BY_ID.get(row[ID_COLUMN]);
    if (!original) return false;
    if (row[ID_COLUMN] === SALARY_OUTLIER_ID) return true;
    return row[SALARY_COLUMN] === original[SALARY_COLUMN];
  });
}

const TASKS = Object.freeze([
  Object.freeze({
    id: 'age-remove',
    label: `Remove the ${AGE_COLUMN} outlier row with the IQR fence`,
    validate: validateAgeRemoval,
  }),
  Object.freeze({
    id: 'salary-cap',
    label: `Cap the ${SALARY_COLUMN} outlier at the upper fence`,
    validate: validateSalaryCap,
  }),
]);

function taskIdsFromSummary(summary) {
  return TASKS
    .filter((task, index) => summary.tasks[index]?.passed)
    .map(task => task.id);
}

function labelForTask(taskId) {
  return TASKS.find(task => task.id === taskId)?.label ?? taskId;
}

function inspectionUnlocked(summary) {
  return summary.results.some(result => {
    const type = result.sideEffect?.type;
    return type === 'describe' || type === 'quantile' || type === 'iqr_fences';
  });
}

function resultMutatesData(result) {
  if (!(result?.df instanceof DataFrame)) return false;
  return !NON_MUTATING_DF_TYPES.has(result.sideEffect?.type ?? '');
}

function ageRepairState(df) {
  const rows = rowMap(df);
  if (!rows.has(AGE_OUTLIER_ID)) {
    return { label: 'Removed', tone: 'correct' };
  }

  const value = rows.get(AGE_OUTLIER_ID)[AGE_COLUMN];
  if (typeof value === 'number' && Number.isFinite(value) && value > AGE_FENCES.upper) {
    return { label: 'Present', tone: 'warning' };
  }

  return { label: 'Clipped', tone: 'present' };
}

function salaryRepairState(df) {
  const rows = rowMap(df);
  if (!rows.has(SALARY_OUTLIER_ID)) {
    return { label: 'Removed', tone: 'warning' };
  }

  const value = rows.get(SALARY_OUTLIER_ID)[SALARY_COLUMN];
  if (ACCEPTED_SALARY_CAPS.some(cap => approxEqual(value, cap, 0.01))) {
    return { label: 'Capped', tone: 'correct' };
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > SALARY_FENCES.upper) {
    return { label: 'Present', tone: 'warning' };
  }

  return { label: 'Changed', tone: 'present' };
}

function buildMask(df, colName, rowId, threshold) {
  return df.toRows().map(row => row[ID_COLUMN] === rowId && row[colName] > threshold);
}

function chartEntries(df, colName, rowId, threshold, originalValue, formatter) {
  return df.toRows().map(row => {
    const value = row[colName];
    const isFocus = row[ID_COLUMN] === rowId;
    const unresolved = isFocus && typeof value === 'number' && Number.isFinite(value) && value > threshold;
    const repaired = isFocus && !unresolved && !approxEqual(value, originalValue, 0.01);

    return {
      value,
      color: unresolved
        ? 'var(--color-danger)'
        : repaired
          ? 'var(--color-warning)'
          : 'var(--color-world-1)',
      state: unresolved ? 'selected' : repaired ? 'active' : 'default',
      tooltip: `${ID_COLUMN} ${row[ID_COLUMN]} - ${colName}: ${formatter(value)}`,
      ariaLabel: `Row ${row[ID_COLUMN]} ${colName} ${formatter(value)}`,
    };
  });
}

function chartConfig(df, options) {
  return {
    type: 'dotplot',
    title: options.title,
    data: chartEntries(df, options.colName, options.rowId, options.threshold, options.originalValue, options.formatter),
    worldColor: 'var(--color-world-3)',
    height: 220,
    minWidth: 320,
    showGrid: true,
    scaleMode: 'distribution',
    valueFormatter: options.formatter,
    band: {
      from: Math.min(...df.col(options.colName).values),
      to: options.threshold,
      label: 'Safe zone',
      tone: 'var(--color-world-1)',
      opacity: 0.12,
    },
    markers: [
      {
        value: options.threshold,
        label: `${options.markerLabel} ${options.formatter(options.threshold)}`,
        tone: 'var(--color-warning)',
      },
    ],
    ariaLabel: options.ariaLabel,
  };
}

function resultTone(summary) {
  if (!summary) return DEFAULT_FEEDBACK;
  if (summary.mistakeRuns === 0) {
    return 'Clean lab. You diagnosed the spikes, removed the broken Age row, and capped the real Salary outlier without any wrong turns.';
  }
  if (summary.mistakeRuns <= 2) {
    return 'Strong finish. The repairs are correct, and you recovered from a couple of detours without losing the outlier logic.';
  }
  return 'Mission complete. Use the recap below to lock the difference between row suppression and value capping before World 4 begins.';
}

function trackerState(stepId, inspected, passedTaskIds) {
  if (stepId === 'inspect') {
    return inspected ? 'solved' : 'active';
  }
  if (stepId === 'age-remove') {
    if (passedTaskIds.has('age-remove')) return 'solved';
    return inspected || passedTaskIds.has('salary-cap') ? 'active' : 'pending';
  }
  if (passedTaskIds.has('salary-cap')) return 'solved';
  return inspected && passedTaskIds.has('age-remove') ? 'active' : 'pending';
}

export default class World3Level6 {
  meta = {
    title: LEVEL_TITLE,
    subtitle: LEVEL_OBJECTIVE,
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._events = null;
    this._table = null;
    this._editor = null;
    this._ageChart = null;
    this._salaryChart = null;
    this._inspected = false;
    this._inspectionAwarded = false;
    this._passedTaskIds = new Set();
    this._awardedTaskIds = new Set();
    this._mistakeRuns = 0;
    this._completed = false;
    this._summary = null;
    this._ui = {};
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w3-level w3-level--codefix screen-section" aria-label="World 3 Level 6">
        <div class="level-hero w3-level__hero" style="--world-color: var(--color-world-3);">
          <p class="eyebrow">World 3 - Outliers</p>
          <h1 class="level-hero__title">${escapeHtml(LEVEL_TITLE)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(LEVEL_OBJECTIVE)}
            One spike in ${escapeHtml(AGE_COLUMN)} is a broken row to suppress. The spike in ${escapeHtml(SALARY_COLUMN)} is real, so it should stay in the table but lose leverage at the fence.
          </p>
          <div class="action-row">
            <span class="status-box" id="w3-l6-progress">0 / ${TOTAL_LOCKS} mission locks</span>
            <span class="status-box" id="w3-l6-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w3-l6-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w3-l6-reset-btn" type="button">Reset Lab</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">06</span>
        </div>

        <div class="w3-codefix-layout">
          <article class="panel w3-codefix-data-panel">
            <div class="w3-level__panel-head">
              <div>
                <p class="eyebrow">Dataset Console</p>
                <h2 class="panel-title">20 rows, two suspicious maximums, two different repairs</h2>
              </div>
              <p class="w3-level__microcopy">
                The Age spike is impossible data, so the row should disappear. The Salary spike is verified revenue, so the row should stay while the value gets clipped.
              </p>
            </div>

            <div class="w3-codefix-snapshot" aria-label="Repair Snapshot">
              <article class="w3-codefix-snapshot__card">
                <span class="w3-codefix-snapshot__label">Rows Remaining</span>
                <strong class="w3-codefix-snapshot__value" id="w3-l6-row-count">${ORIGINAL_DF.length}</strong>
              </article>
              <article class="w3-codefix-snapshot__card">
                <span class="w3-codefix-snapshot__label">${escapeHtml(AGE_COLUMN)} Repair</span>
                <strong class="w3-codefix-snapshot__value" id="w3-l6-age-state" data-state="warning">Present</strong>
              </article>
              <article class="w3-codefix-snapshot__card">
                <span class="w3-codefix-snapshot__label">${escapeHtml(SALARY_COLUMN)} Repair</span>
                <strong class="w3-codefix-snapshot__value" id="w3-l6-salary-state" data-state="warning">Present</strong>
              </article>
            </div>

            <div class="w3-codefix-table-shell" id="w3-l6-table"></div>
          </article>

          <div class="w3-codefix-mission-stack">
            <section class="panel w3-codefix-tracker" aria-label="Mission Tracker">
              <div class="w3-level__panel-head">
                <div>
                  <p class="eyebrow">Mission Tracker</p>
                  <h2 class="panel-title">Lock the diagnosis, then apply the two different outlier fixes</h2>
                </div>
                <p class="w3-level__microcopy">
                  This lab is about recognizing that one outlier deserves row suppression while the other deserves value capping.
                </p>
              </div>

              <div class="w3-codefix-tracker__list">
                ${TRACKER_STEPS.map((step, index) => `
                  <article class="w3-codefix-card" data-step-id="${step.id}" data-step-state="${index === 0 ? 'active' : 'pending'}">
                    <div class="w3-codefix-card__meta">
                      <span class="w3-codefix-card__status" data-step-status="${step.id}">${index === 0 ? 'Active' : 'Pending'}</span>
                      <span class="w3-codefix-card__index">Step ${index + 1}</span>
                    </div>
                    <h3 class="w3-codefix-card__title">${escapeHtml(step.label)}</h3>
                    <p class="w3-codefix-card__chapter">${escapeHtml(step.chapter)}</p>
                    <p class="w3-codefix-card__copy">${escapeHtml(step.recap)}</p>
                  </article>
                `).join('')}
              </div>
            </section>

            <section class="panel w3-codefix-chart-panel" aria-label="Distribution Monitor">
              <div class="w3-level__panel-head">
                <div>
                  <p class="eyebrow">Distribution Monitor</p>
                  <h2 class="panel-title">Watch one point disappear and the other settle at the fence</h2>
                </div>
                <p class="w3-level__microcopy">
                  Red means the outlier still breaks the starting fence. Amber means the focal row changed but now sits inside the safe zone.
                </p>
              </div>

              <div class="w3-codefix-chart-grid">
                <article class="w3-codefix-chart-card">
                  <div class="w3-codefix-chart-shell" id="w3-l6-age-chart"></div>
                </article>
                <article class="w3-codefix-chart-card">
                  <div class="w3-codefix-chart-shell" id="w3-l6-salary-chart"></div>
                </article>
              </div>
            </section>

            <section class="card card--elevated w3-level__feedback" aria-live="polite">
              <p class="eyebrow">Coach Feed</p>
              <p id="w3-l6-feedback-text" class="w3-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
            </section>

            <section class="card w3-level__hint-box" id="w3-l6-hint-box" hidden>
              <p class="eyebrow">Hint</p>
              <p id="w3-l6-hint-text" class="w3-level__hint-copy"></p>
            </section>

            <section class="card w3-codefix-guide">
              <p class="eyebrow">Repair Brief</p>
              <div class="w3-codefix-guide__steps">
                <article class="w3-codefix-guide__step">
                  <span class="w3-codefix-guide__badge">1</span>
                  <p>Use <code>df.describe()</code> or quantiles to confirm that ${escapeHtml(AGE_COLUMN)} and ${escapeHtml(SALARY_COLUMN)} have very different kinds of spikes.</p>
                </article>
                <article class="w3-codefix-guide__step">
                  <span class="w3-codefix-guide__badge">2</span>
                  <p>Suppress the ${escapeHtml(AGE_COLUMN)} row after the fence is ready, but keep the ${escapeHtml(SALARY_COLUMN)} row and clip only its value.</p>
                </article>
                <article class="w3-codefix-guide__step">
                  <span class="w3-codefix-guide__badge">3</span>
                  <p><code>np.log1p(...)</code> is available, but this mission wants targeted IQR repair rather than a full-feature transform.</p>
                </article>
              </div>
            </section>
          </div>

          <article class="panel w3-codefix-editor-panel">
            <div class="w3-level__panel-head">
              <div>
                <p class="eyebrow">Code Arena</p>
                <h2 class="panel-title">Write the pandas-like commands that repair both columns correctly</h2>
              </div>
              <p class="w3-level__microcopy">
                The reference explains available operations but does not assemble the solution. Decide which column to inspect, filter, or clip, and reset if a wrong mutation changes the evidence needed later.
              </p>
            </div>

            <div class="w3-codefix-editor-shell" id="w3-l6-editor"></div>
          </article>
        </div>

        <section class="panel w3-codefix-summary" id="w3-l6-summary" hidden aria-label="Code Fix Recap">
          <div class="w3-level__panel-head">
            <div>
              <p class="eyebrow">Code Lab Recap</p>
              <h2 class="panel-title">Two outliers, two different repairs, one IQR workflow</h2>
            </div>
            <p class="w3-level__microcopy">${escapeHtml(SUMMARY_COPY)}</p>
          </div>

          <div class="w3-codefix-summary__grid">
            <article class="w3-codefix-summary__card">
              <p class="w3-codefix-summary__kicker">Age</p>
              <h3 class="w3-codefix-summary__title">Suppress the impossible row</h3>
              <p class="w3-codefix-summary__copy">The ${escapeHtml(AGE_COLUMN)} spike at ${escapeHtml(formatWhole(AGE_OUTLIER_VALUE))} was a row-level data-quality problem, so removing the row protected the dataset instead of flattening a bad record.</p>
            </article>
            <article class="w3-codefix-summary__card">
              <p class="w3-codefix-summary__kicker">Salary</p>
              <h3 class="w3-codefix-summary__title">Cap the real but dangerous spike</h3>
              <p class="w3-codefix-summary__copy">The ${escapeHtml(SALARY_COLUMN)} spike at ${escapeHtml(formatMoney(SALARY_OUTLIER_VALUE))} was preserved as a row but clipped at the fence so one whale deal could not dominate the model.</p>
            </article>
            <article class="w3-codefix-summary__card">
              <p class="w3-codefix-summary__kicker">Workflow</p>
              <h3 class="w3-codefix-summary__title">Inspect, fence, then repair</h3>
              <p class="w3-codefix-summary__copy">The durable pattern is the same every time: inspect the distribution, compute the IQR fence, then choose the repair that fits whether the spike is broken evidence or real leverage.</p>
            </article>
          </div>

          <div class="action-row">
            <span class="status-box" id="w3-l6-summary-score">Waiting for the full repair sequence</span>
            <button class="btn btn--primary" id="w3-l6-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w3-l6-progress');
    this._ui.status = container.querySelector('#w3-l6-status');
    this._ui.feedback = container.querySelector('#w3-l6-feedback-text');
    this._ui.hintBox = container.querySelector('#w3-l6-hint-box');
    this._ui.hintText = container.querySelector('#w3-l6-hint-text');
    this._ui.tableHost = container.querySelector('#w3-l6-table');
    this._ui.editorHost = container.querySelector('#w3-l6-editor');
    this._ui.ageChartHost = container.querySelector('#w3-l6-age-chart');
    this._ui.salaryChartHost = container.querySelector('#w3-l6-salary-chart');
    this._ui.rowCount = container.querySelector('#w3-l6-row-count');
    this._ui.ageState = container.querySelector('#w3-l6-age-state');
    this._ui.salaryState = container.querySelector('#w3-l6-salary-state');
    this._ui.summary = container.querySelector('#w3-l6-summary');
    this._ui.summaryScore = container.querySelector('#w3-l6-summary-score');
    this._ui.finishButton = container.querySelector('#w3-l6-finish-btn');
    this._ui.trackerCards = Array.from(container.querySelectorAll('[data-step-id]'));

    this._mountTable();
    this._mountCharts();
    this._mountEditor();
    this._syncSnapshot(ORIGINAL_DF);
    this._syncTracker();
    this._syncVisuals(ORIGINAL_DF);
    this._syncProgress();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w3-l6-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w3-l6-reset-btn') || event.target.closest('.editor-reset')) {
        this._resetLab();
        return;
      }

      if (event.target.closest('#w3-l6-finish-btn')) {
        if (this._completed && this._summary) {
          if (typeof this._engine.completeCodeLevel === 'function') {
            void this._engine.completeCodeLevel(this._summary);
          } else if (typeof this._engine.complete === 'function') {
            void this._engine.complete();
          }
        }
      }
    }, { signal });
  }

  getHint(hintsUsed) {
    return LEVEL_HINTS[hintsUsed - 1] ?? null;
  }

  pause() {}

  resume() {}

  teardown() {
    this._events?.abort();
    this._table?.destroy();
    this._editor?.destroy();
    this._ageChart?.destroy();
    this._salaryChart?.destroy();
    this._table = null;
    this._editor = null;
    this._ageChart = null;
    this._salaryChart = null;
    this._passedTaskIds.clear();
    this._awardedTaskIds.clear();
    this._ui = {};
  }

  _mountTable() {
    this._table?.destroy();
    this._table = new DataTable(this._ui.tableHost, ORIGINAL_DF, {
      showIndex: false,
      showStatsButtons: false,
      sortable: false,
      worldColor: 'var(--color-world-3)',
    });
    this._applyTableHighlights(ORIGINAL_DF);
  }

  _mountCharts() {
    this._ageChart?.destroy();
    this._salaryChart?.destroy();

    this._ageChart = new ChartWidget(this._ui.ageChartHost, chartConfig(ORIGINAL_DF, {
      title: `${AGE_COLUMN} distribution`,
      colName: AGE_COLUMN,
      rowId: AGE_OUTLIER_ID,
      threshold: AGE_FENCES.upper,
      originalValue: AGE_OUTLIER_VALUE,
      formatter: formatNumber,
      markerLabel: 'Upper fence',
      ariaLabel: `Dot plot for ${AGE_COLUMN} with one unresolved outlier beyond the upper fence.`,
    }));

    this._salaryChart = new ChartWidget(this._ui.salaryChartHost, chartConfig(ORIGINAL_DF, {
      title: `${SALARY_COLUMN} distribution`,
      colName: SALARY_COLUMN,
      rowId: SALARY_OUTLIER_ID,
      threshold: SALARY_FENCES.upper,
      originalValue: SALARY_OUTLIER_VALUE,
      formatter: formatMoney,
      markerLabel: 'Upper fence',
      ariaLabel: `Dot plot for ${SALARY_COLUMN} with one unresolved outlier beyond the upper fence.`,
    }));
  }

  _mountEditor() {
    this._editor?.destroy();
    this._ui.editorHost.innerHTML = '';
    this._editor = new CodeEditorWidget(this._ui.editorHost, {
      df: ORIGINAL_DF,
      initialCode: INITIAL_CODE,
      reference: REFERENCE,
      tasks: TASKS.map(task => ({ label: task.label, validate: task.validate })),
      table: this._table,
      worldColor: 'var(--color-world-3)',
      onRun: summary => this._handleRun(summary),
    });
  }

  _handleRun(summary) {
    const hasError = summary.results.some(result => result.status === 'error');
    const changedData = summary.results.some(resultMutatesData);
    const unlockedInspection = inspectionUnlocked(summary) && !this._inspected;
    const nextPassedIds = new Set(taskIdsFromSummary(summary));
    const newlyPassedIds = [...nextPassedIds].filter(taskId => !this._awardedTaskIds.has(taskId));

    if (unlockedInspection) {
      this._inspected = true;
      if (!this._inspectionAwarded) {
        this._inspectionAwarded = true;
        this._engine.correct();
      }
    }

    this._passedTaskIds = nextPassedIds;
    this._syncSnapshot(summary.df);
    this._syncTracker();
    this._syncVisuals(summary.df);

    if (hasError) {
      this._mistakeRuns += 1;
      this._engine.mistake({ costsLife: false, countsMistake: true });
      this._setFeedback('The interpreter hit an error. Stay close to the reference card and make sure the fence variables exist before you use them in a filter or clip command.');
      this._setStatus('Execution error. Reset if the failed run already changed the wrong column or removed the wrong row.');
      this._syncProgress();
      return;
    }

    if (newlyPassedIds.length) {
      newlyPassedIds.forEach(taskId => {
        this._awardedTaskIds.add(taskId);
        this._engine.correct();
      });
    }

    if (unlockedInspection || newlyPassedIds.length) {
      this._handleMilestone(unlockedInspection, newlyPassedIds, summary.df);
      this._syncProgress();

      if (this._inspected && nextPassedIds.size === TASKS.length) {
        this._completeRun();
      }
      return;
    }

    if (changedData) {
      this._mistakeRuns += 1;
      this._engine.mistake({ costsLife: false, countsMistake: true });
      this._handleNonPassingMutation(summary);
      this._syncProgress();
      return;
    }

    this._handleInspectionRun(summary);
    this._syncProgress();
  }

  _handleMilestone(unlockedInspection, taskIds, df) {
    taskIds.forEach(taskId => {
      if (taskId === 'age-remove') {
        this._table?.flashColumn(AGE_COLUMN, 'green');
      }
      if (taskId === 'salary-cap') {
        this._table?.flashColumn(SALARY_COLUMN, 'green');
      }
    });

    if (this._inspected && this._passedTaskIds.size === TASKS.length) {
      this._setFeedback('All three mission locks are in place. The broken Age row is gone, and the verified Salary spike now sits safely at the fence.');
      this._setStatus('Mission complete. Review the recap below, then continue to the encoding world.');
      return;
    }

    if (unlockedInspection && !taskIds.length) {
      this._setFeedback(`Inspection locked. ${AGE_COLUMN} shows the impossible row problem, while ${SALARY_COLUMN} shows the real but overpowered whale deal.`);
      if (!this._passedTaskIds.has('age-remove')) {
        this._setStatus(`Diagnosis complete. Next: compute the ${AGE_COLUMN} fence and suppress the broken row.`);
      } else {
        this._setStatus(`Diagnosis complete. The ${AGE_COLUMN} fix is already locked, so cap the ${SALARY_COLUMN} spike next.`);
      }
      return;
    }

    if (taskIds.length === 1) {
      this._setFeedback(`${labelForTask(taskIds[0])} is now locked in.`);
    } else if (taskIds.length > 1) {
      this._setFeedback(`${taskIds.map(labelForTask).join(' + ')} locked in on the same run.`);
    }

    if (!this._inspected) {
      this._setStatus('Repair progress landed, but inspection is still missing. Run df.describe() once to lock the diagnostic step.');
      return;
    }

    if (!this._passedTaskIds.has('age-remove')) {
      this._setStatus(`Inspection is done. Next repair: remove the ${AGE_COLUMN} outlier row with the upper fence.`);
      return;
    }

    if (!this._passedTaskIds.has('salary-cap')) {
      this._setStatus(`${AGE_COLUMN} is clean. Finish the lab by clipping the ${SALARY_COLUMN} outlier at the fence instead of deleting it.`);
    }
  }

  _handleInspectionRun(summary) {
    const types = new Set(summary.results.map(result => result.sideEffect?.type));
    if (types.has('describe')) {
      this._setFeedback(`Good inspection run. ${AGE_COLUMN} has the impossible maximum, and ${SALARY_COLUMN} has the real but overpowered spike you should cap rather than delete.`);
      this._setStatus(`Inspection complete. Next: remove the ${AGE_COLUMN} row with the IQR fence, then cap ${SALARY_COLUMN}.`);
      return;
    }

    if (types.has('quantile')) {
      this._setFeedback('Good. The fence math is live. Keep going until lower and upper are ready, then apply the matching repair to the right column.');
      this._setStatus('Quantiles computed. Turn Q1 and Q3 into IQR, lower, and upper before you filter or clip.');
      return;
    }

    this._setFeedback('No repair landed yet, but the run was safe. Use describe or quantiles to confirm which outlier deserves row removal and which one deserves capping.');
    this._setStatus(DEFAULT_STATUS);
  }

  _handleNonPassingMutation(summary) {
    const results = summary.results;
    const df = summary.df;
    const ageState = ageRepairState(df);
    const salaryState = salaryRepairState(df);
    const usedAgeFilter = results.some(result => result.sideEffect?.type === 'filter' && result.sideEffect?.col === AGE_COLUMN);
    const usedSalaryFilter = results.some(result => result.sideEffect?.type === 'filter' && result.sideEffect?.col === SALARY_COLUMN);
    const usedAgeClip = results.some(result => result.sideEffect?.type === 'clip' && result.sideEffect?.col === AGE_COLUMN);
    const usedSalaryClip = results.some(result => result.sideEffect?.type === 'clip' && result.sideEffect?.col === SALARY_COLUMN);
    const usedSalaryLog = results.some(result => result.sideEffect?.type === 'log1p' && result.sideEffect?.col === SALARY_COLUMN);

    if (usedAgeClip || ageState.label === 'Clipped') {
      this._setFeedback(`${AGE_COLUMN} was clipped instead of suppressed. This mission treats that row as broken evidence, so the row should disappear entirely.`);
      this._setStatus(`Reset recommended. The ${AGE_COLUMN} task wants row removal after the fence is computed.`);
      return;
    }

    if (usedSalaryFilter || salaryState.label === 'Removed') {
      this._setFeedback(`${SALARY_COLUMN} was removed, but that whale deal is real. Keep the row and clip only the value at the upper fence.`);
      this._setStatus(`Reset recommended. The ${SALARY_COLUMN} task wants capping, not row deletion.`);
      return;
    }

    if (usedSalaryLog) {
      this._setFeedback(`${SALARY_COLUMN} was log-transformed, but this lab wants targeted IQR capping rather than a full-feature compression.`);
      this._setStatus(`Reset recommended. Save log transforms for skew-wide problems, not this focused ${SALARY_COLUMN} repair.`);
      return;
    }

    if (usedAgeFilter && !this._passedTaskIds.has('age-remove')) {
      this._setFeedback(`The ${AGE_COLUMN} row count changed, but the wrong row moved or more than one row disappeared. Filter only the impossible Age outlier past the upper fence.`);
      this._setStatus('Check the Age fence and the comparison operator before you run the filter again.');
      return;
    }

    if (usedSalaryClip || salaryState.label === 'Changed') {
      this._setFeedback(`${SALARY_COLUMN} changed, but not with the expected fence cap. Recompute the Salary lower and upper values before you clip.`);
      this._setStatus(`No ${SALARY_COLUMN} mission lock yet. Use the current fence variables instead of guessing the cap value.`);
      return;
    }

    this._setFeedback('That run changed the data, but none of the mission locks advanced. Compare the current table against the three tracker cards before you run again.');
    this._setStatus('No mission card advanced. Reset if the wrong repair already consumed the evidence you needed.');
  }

  _completeRun() {
    this._completed = true;
    this._summary = {
      stepsCompleted: TOTAL_LOCKS,
      totalSteps: TOTAL_LOCKS,
      mistakeRuns: this._mistakeRuns,
    };

    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = `${TOTAL_LOCKS} / ${TOTAL_LOCKS} mission locks`;
    }

    if (this._ui.summary) {
      this._ui.summary.hidden = false;
      requestAnimationFrame(() => {
        this._ui.summary.classList.add('is-revealed');
      });
      this._ui.summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    this._setFeedback(resultTone(this._summary));
    this._setStatus('Code lab complete. World 4 is ready to unlock.');
    this._syncProgress();
  }

  _resetLab() {
    this._inspected = false;
    this._inspectionAwarded = false;
    this._passedTaskIds.clear();
    this._awardedTaskIds.clear();
    this._mistakeRuns = 0;
    this._completed = false;
    this._summary = null;

    this._editor?.reset(ORIGINAL_DF);
    this._syncSnapshot(ORIGINAL_DF);
    this._syncTracker();
    this._syncVisuals(ORIGINAL_DF);

    if (this._ui.summary) {
      this._ui.summary.hidden = true;
      this._ui.summary.classList.remove('is-revealed');
    }

    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = 'Waiting for the full repair sequence';
    }

    this._setFeedback(DEFAULT_FEEDBACK);
    this._setStatus(DEFAULT_STATUS);
    this._syncProgress();
  }

  _showHint() {
    const { allowed, text } = this._engine.requestHint();
    if (!allowed || !text) return;

    this._ui.hintBox?.removeAttribute('hidden');
    if (this._ui.hintText) {
      this._ui.hintText.textContent = text;
    }
  }

  _applyTableHighlights(df) {
    this._table?.setOutlierMask(AGE_COLUMN, buildMask(df, AGE_COLUMN, AGE_OUTLIER_ID, AGE_FENCES.upper));
    this._table?.setOutlierMask(SALARY_COLUMN, buildMask(df, SALARY_COLUMN, SALARY_OUTLIER_ID, SALARY_FENCES.upper));
  }

  _syncVisuals(df) {
    this._applyTableHighlights(df);

    this._ageChart?.update(chartConfig(df, {
      title: `${AGE_COLUMN} distribution`,
      colName: AGE_COLUMN,
      rowId: AGE_OUTLIER_ID,
      threshold: AGE_FENCES.upper,
      originalValue: AGE_OUTLIER_VALUE,
      formatter: formatNumber,
      markerLabel: 'Upper fence',
      ariaLabel: `Dot plot for ${AGE_COLUMN} with the current outlier state.`,
    }));

    this._salaryChart?.update(chartConfig(df, {
      title: `${SALARY_COLUMN} distribution`,
      colName: SALARY_COLUMN,
      rowId: SALARY_OUTLIER_ID,
      threshold: SALARY_FENCES.upper,
      originalValue: SALARY_OUTLIER_VALUE,
      formatter: formatMoney,
      markerLabel: 'Upper fence',
      ariaLabel: `Dot plot for ${SALARY_COLUMN} with the current outlier state.`,
    }));
  }

  _syncSnapshot(df) {
    const ageState = ageRepairState(df);
    const salaryState = salaryRepairState(df);

    if (this._ui.rowCount) {
      this._ui.rowCount.textContent = String(df.length);
    }

    if (this._ui.ageState) {
      this._ui.ageState.textContent = ageState.label;
      this._ui.ageState.dataset.state = ageState.tone;
    }

    if (this._ui.salaryState) {
      this._ui.salaryState.textContent = salaryState.label;
      this._ui.salaryState.dataset.state = salaryState.tone;
    }
  }

  _syncProgress() {
    const locks = Number(this._inspected) + this._passedTaskIds.size;

    if (this._ui.progress) {
      this._ui.progress.textContent = `${locks} / ${TOTAL_LOCKS} mission locks`;
    }

    if (this._ui.finishButton) {
      this._ui.finishButton.disabled = !this._completed;
    }
  }

  _syncTracker() {
    this._ui.trackerCards.forEach(card => {
      const stepId = card.getAttribute('data-step-id');
      const state = trackerState(stepId, this._inspected, this._passedTaskIds);
      const status = card.querySelector(`[data-step-status="${stepId}"]`);

      card.setAttribute('data-step-state', state);
      if (status) {
        status.textContent = state === 'solved' ? 'Solved' : state === 'active' ? 'Active' : 'Pending';
      }
    });
  }

  _setFeedback(message) {
    if (this._ui.feedback) {
      this._ui.feedback.textContent = message;
    }
  }

  _setStatus(message) {
    if (this._ui.status) {
      this._ui.status.textContent = message;
    }
  }
}
