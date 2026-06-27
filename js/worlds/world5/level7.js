'use strict';

import {
  valuesApproxEqual,
  validateScaledRange,
  validateStandardizedColumn,
} from '../../data/answers.js';
import { createDataset, DATASET_KEYS } from '../../data/datasets.js';
import { getLevelProblem } from '../../data/problems.js';
import { DataFrame } from '../../pandas/dataframe.js';
import { DataTable } from '../../widgets/datatable.js';
import { CodeEditorWidget } from '../../widgets/editor.js?v=20260614b';
import { ChartWidget } from '../../widgets/charts.js';

const PROBLEM = getLevelProblem(5, 7);
const LEVEL_TITLE = PROBLEM?.title ?? 'Code Fix - Scaling';
const LEVEL_OBJECTIVE = PROBLEM?.objective ?? 'Normalize, standardize, and log-transform the right features in the same dataset.';

function createFallbackDataset() {
  return DataFrame.fromRows([
    { Age: 18, Salary: 28000, Purchase_Count: 1 },
    { Age: 25, Salary: 34000, Purchase_Count: 2 },
    { Age: 30, Salary: 39000, Purchase_Count: 3 },
    { Age: 45, Salary: 52000, Purchase_Count: 7 },
    { Age: 60, Salary: 79000, Purchase_Count: 18 },
  ]);
}

function createLevelDataset() {
  try {
    return createDataset(PROBLEM?.datasetKey ?? DATASET_KEYS.SCALING_PRACTICE);
  } catch {
    return createFallbackDataset();
  }
}

const ORIGINAL_DF = createLevelDataset();
const AGE_COL = 'Age';
const SALARY_COL = 'Salary';
const PURCHASE_COL = 'Purchase_Count';
const ORIGINAL_COLUMNS = Object.freeze([...ORIGINAL_DF.columns]);
const ORIGINAL_AGE_VALUES = Object.freeze([...ORIGINAL_DF.col(AGE_COL).values]);
const ORIGINAL_SALARY_VALUES = Object.freeze([...ORIGINAL_DF.col(SALARY_COL).values]);
const ORIGINAL_PURCHASE_VALUES = Object.freeze([...ORIGINAL_DF.col(PURCHASE_COL).values]);

const EXPECTED_AGE_DF = ORIGINAL_DF.minMaxScale(AGE_COL, '');
const EXPECTED_SALARY_DF = ORIGINAL_DF.standardize(SALARY_COL, '');
const EXPECTED_PURCHASE_DF = ORIGINAL_DF.log1p(PURCHASE_COL);
const EXPECTED_AGE_VALUES = Object.freeze([...EXPECTED_AGE_DF.col(AGE_COL).values]);
const EXPECTED_SALARY_VALUES = Object.freeze([...EXPECTED_SALARY_DF.col(SALARY_COL).values]);
const EXPECTED_PURCHASE_VALUES = Object.freeze([...EXPECTED_PURCHASE_DF.col(PURCHASE_COL).values]);

const AGE_MIN = ORIGINAL_DF.col(AGE_COL).min();
const AGE_MAX = ORIGINAL_DF.col(AGE_COL).max();
const SALARY_MEAN = ORIGINAL_DF.col(SALARY_COL).mean();
const SALARY_STD = ORIGINAL_DF.col(SALARY_COL).std();
const PURCHASE_SKEW = ORIGINAL_DF.col(PURCHASE_COL).skew();
const LOG_PURCHASE_SKEW = EXPECTED_PURCHASE_DF.col(PURCHASE_COL).skew();
const RAW_PURCHASE_MAX = Math.max(...ORIGINAL_PURCHASE_VALUES);

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const REFERENCE = Object.freeze([
  'df.describe()  # Compare ranges, centers, and spread before transforming.',
  "df['Column'].skew()  # Measure whether a feature has an asymmetric tail.",
  "df['BoundedColumn'] = MinMaxScaler().fit_transform(df[['BoundedColumn']])  # Map a chosen feature to 0-1.",
  "df['CenteredColumn'] = StandardScaler().fit_transform(df[['CenteredColumn']])  # Center and variance-scale a feature.",
  "df['SkewedColumn'] = np.log1p(df['SkewedColumn'])  # Compress a right tail while remaining safe at zero.",
  '# Decide which dataset column fits each transformation from its distribution.',
]);

const PROBLEM_TASKS = new Map((PROBLEM?.tasks ?? []).map(task => [task.id, task.label]));

const TASKS = Object.freeze([
  Object.freeze({
    id: 'minmax-age',
    label: PROBLEM_TASKS.get('minmax-age') ?? 'MinMax scale Age into the 0-1 interval',
    validate: validateAgeScaled,
  }),
  Object.freeze({
    id: 'standardize-salary',
    label: PROBLEM_TASKS.get('standardize-salary') ?? 'Standardize Salary so it centers near 0 with sigma near 1',
    validate: validateSalaryStandardized,
  }),
  Object.freeze({
    id: 'log-purchase',
    label: PROBLEM_TASKS.get('log-purchase') ?? 'Apply log1p to Purchase_Count to compress the right tail',
    validate: validatePurchaseLogged,
  }),
]);

const TRACKER_STEPS = Object.freeze([
  Object.freeze({
    id: 'inspect',
    label: 'Inspect the numeric profile before you touch the columns',
    chapter: 'Diagnosis',
    recap: `Age is bounded, Salary carries the broad linear scale, and ${PURCHASE_COL} has the heavy right tail that needs compression rather than deletion.`,
  }),
  Object.freeze({
    id: 'minmax-age',
    label: 'Move Age onto a shared 0-1 range',
    chapter: 'MinMax Fit',
    recap: `Age should keep its row order, but collapse from ${formatWhole(AGE_MIN)}-${formatWhole(AGE_MAX)} into the shared 0-1 interval.`,
  }),
  Object.freeze({
    id: 'standardize-salary',
    label: 'Center Salary and scale it by sigma',
    chapter: 'Z-Score Fit',
    recap: `Salary should move from raw dollars into standardized units with mean near 0 and sample standard deviation near 1.`,
  }),
  Object.freeze({
    id: 'log-purchase',
    label: `Compress the ${PURCHASE_COL} tail with log1p`,
    chapter: 'Skew Control',
    recap: `${PURCHASE_COL} should keep every row, but its skew should drop from about ${formatNumber(PURCHASE_SKEW)} to about ${formatNumber(LOG_PURCHASE_SKEW)} after log1p.`,
  }),
]);

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM?.hints ?? []),
  `Age is the bounded feature: min ${formatWhole(AGE_MIN)}, max ${formatWhole(AGE_MAX)}. That is the MinMax target.`,
  `Salary should center around 0 after scaling because the raw mean is ${formatMoney(SALARY_MEAN)} and sigma is about ${formatNumber(SALARY_STD)}.`,
  `${PURCHASE_COL} is the skewed count feature. Use np.log1p so the right tail compresses without deleting rows or breaking zero-safe counts.`,
  'The finished dataset keeps the same 5 rows and the same 3 columns. Every repair overwrites the original column instead of creating a wider table.',
]);

const INITIAL_CODE = `# Inspect the profile before you transform anything.
# Age -> MinMax
# Salary -> StandardScaler
# Purchase_Count -> np.log1p

# Write your pandas-like commands below:
`;

const DEFAULT_FEEDBACK = `Inspect the feature profile first. ${AGE_COL} wants a shared 0-1 range, ${SALARY_COL} wants mean-zero variance balance, and ${PURCHASE_COL} wants tail compression.`;
const DEFAULT_STATUS = `Recommended flow: inspect -> MinMax ${AGE_COL} -> standardize ${SALARY_COL} -> log-transform ${PURCHASE_COL}.`;
const SUMMARY_COPY = `${AGE_COL} now lives on a shared 0-1 range, ${SALARY_COL} is centered and sigma-scaled, and ${PURCHASE_COL} keeps every row while its right tail becomes calmer.`;
const TOTAL_LOCKS = TRACKER_STEPS.length;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(value) {
  return MONEY.format(value);
}

function formatNumber(value, digits = 4) {
  if (!Number.isFinite(value)) return String(value);
  return Number(value.toFixed(digits)).toString();
}

function formatWhole(value) {
  if (!Number.isFinite(value)) return String(value);
  return Number(value.toFixed(0)).toString();
}

function formatSigned(value, digits = 4) {
  if (!Number.isFinite(value)) return String(value);
  const rounded = Number(value.toFixed(digits));
  return `${rounded >= 0 ? '+' : ''}${rounded.toString()}`;
}

function arraysEqual(actual, expected) {
  if (!Array.isArray(actual) || !Array.isArray(expected) || actual.length !== expected.length) {
    return false;
  }

  return actual.every((value, index) => value === expected[index]);
}

function hasBaseShape(df) {
  return (
    df instanceof DataFrame &&
    df.length === ORIGINAL_DF.length &&
    arraysEqual(df.columns, ORIGINAL_COLUMNS)
  );
}

function columnPresent(df, colName) {
  return df instanceof DataFrame && df.columns.includes(colName);
}

function columnValuesApprox(df, colName, expectedValues, tolerance = 1e-6) {
  if (!columnPresent(df, colName)) return false;
  return valuesApproxEqual(df.col(colName).values, expectedValues, tolerance);
}

function isColumnChanged(df, colName, originalValues) {
  return columnPresent(df, colName) && !valuesApproxEqual(df.col(colName).values, originalValues, 1e-9);
}

function safeMin(df, colName) {
  return columnPresent(df, colName) ? df.col(colName).min() : NaN;
}

function safeMax(df, colName) {
  return columnPresent(df, colName) ? df.col(colName).max() : NaN;
}

function safeMean(df, colName) {
  return columnPresent(df, colName) ? df.col(colName).mean() : NaN;
}

function safeStd(df, colName) {
  return columnPresent(df, colName) ? df.col(colName).std() : NaN;
}

function safeSkew(df, colName) {
  return columnPresent(df, colName) ? df.col(colName).skew() : NaN;
}

function validateAgeScaled(df) {
  return (
    hasBaseShape(df) &&
    columnPresent(df, AGE_COL) &&
    validateScaledRange(df, AGE_COL, 0, 1, 1e-6) &&
    columnValuesApprox(df, AGE_COL, EXPECTED_AGE_VALUES, 1e-6)
  );
}

function validateSalaryStandardized(df) {
  return (
    hasBaseShape(df) &&
    columnPresent(df, SALARY_COL) &&
    validateStandardizedColumn(df, SALARY_COL, 1e-6, 1e-6) &&
    columnValuesApprox(df, SALARY_COL, EXPECTED_SALARY_VALUES, 1e-6)
  );
}

function validatePurchaseLogged(df) {
  return (
    hasBaseShape(df) &&
    columnPresent(df, PURCHASE_COL) &&
    columnValuesApprox(df, PURCHASE_COL, EXPECTED_PURCHASE_VALUES, 1e-6)
  );
}

function validateFinalSolution(df) {
  return validateAgeScaled(df) && validateSalaryStandardized(df) && validatePurchaseLogged(df);
}

function inspectionUnlocked(summary) {
  return summary.results.some(result => {
    const type = result.sideEffect?.type;
    if (type === 'describe') return true;
    if (type === 'dtypes') return true;
    if (type === 'skew' && result.sideEffect?.col === PURCHASE_COL) return true;
    return result.raw === 'df.info()';
  });
}

function resultMutatesData(result) {
  return result?.df instanceof DataFrame;
}

function taskIdsFromSummary(summary) {
  return TASKS
    .filter((task, index) => summary.tasks[index]?.passed)
    .map(task => task.id);
}

function labelForTask(taskId) {
  return TASKS.find(task => task.id === taskId)?.label ?? taskId;
}

function trackerState(stepId, inspected, passedTaskIds) {
  if (stepId === 'inspect') {
    return inspected ? 'solved' : 'active';
  }

  if (!inspected) return 'pending';
  if (passedTaskIds.has(stepId)) return 'solved';
  return 'active';
}

function stateLabel(state) {
  if (state === 'solved') return 'Locked';
  if (state === 'active') return 'Active';
  return 'Pending';
}

function ageState(df) {
  if (!hasBaseShape(df) || !columnPresent(df, AGE_COL)) {
    return { label: 'Missing', tone: 'warning' };
  }

  if (validateAgeScaled(df)) {
    return { label: '0-1 Ready', tone: 'correct' };
  }

  if (validateScaledRange(df, AGE_COL, 0, 1, 0.02)) {
    return { label: 'Near Range', tone: 'present' };
  }

  if (isColumnChanged(df, AGE_COL, ORIGINAL_AGE_VALUES)) {
    return { label: 'Wrong Scale', tone: 'warning' };
  }

  return { label: 'Raw', tone: 'missing' };
}

function salaryState(df) {
  if (!hasBaseShape(df) || !columnPresent(df, SALARY_COL)) {
    return { label: 'Missing', tone: 'warning' };
  }

  if (validateSalaryStandardized(df)) {
    return { label: 'Z-Scored', tone: 'correct' };
  }

  if (validateStandardizedColumn(df, SALARY_COL, 0.15, 0.15)) {
    return { label: 'Near Z', tone: 'present' };
  }

  if (isColumnChanged(df, SALARY_COL, ORIGINAL_SALARY_VALUES)) {
    return { label: 'Wrong Scale', tone: 'warning' };
  }

  return { label: 'Raw', tone: 'missing' };
}

function purchaseState(df) {
  if (!hasBaseShape(df) || !columnPresent(df, PURCHASE_COL)) {
    return { label: 'Missing', tone: 'warning' };
  }

  if (validatePurchaseLogged(df)) {
    return { label: 'Log1p Ready', tone: 'correct' };
  }

  if (isColumnChanged(df, PURCHASE_COL, ORIGINAL_PURCHASE_VALUES) && safeSkew(df, PURCHASE_COL) < PURCHASE_SKEW) {
    return { label: 'Compressed', tone: 'present' };
  }

  if (isColumnChanged(df, PURCHASE_COL, ORIGINAL_PURCHASE_VALUES)) {
    return { label: 'Wrong Transform', tone: 'warning' };
  }

  return { label: 'Raw Tail', tone: 'missing' };
}

function ageChartConfig(df) {
  const isScaled = validateAgeScaled(df) || validateScaledRange(df, AGE_COL, 0, 1, 0.02);
  const values = columnPresent(df, AGE_COL) ? df.col(AGE_COL).values : [];

  return {
    type: 'dotplot',
    title: 'Age Positions',
    worldColor: 'var(--color-world-5)',
    minWidth: 360,
    height: 210,
    showGrid: true,
    valueFormatter: value => (isScaled ? formatNumber(value, 3) : formatWhole(value)),
    band: isScaled
      ? {
        from: 0,
        to: 1,
        label: 'Target 0-1 range',
        tone: 'var(--color-world-5)',
        opacity: 0.12,
      }
      : null,
    markers: isScaled
      ? [
        { value: 0, label: '0', tone: 'var(--color-world-5)' },
        { value: 1, label: '1', tone: 'var(--color-success)' },
      ]
      : [
        { value: AGE_MIN, label: `min ${formatWhole(AGE_MIN)}`, tone: 'var(--color-world-5)' },
        { value: AGE_MAX, label: `max ${formatWhole(AGE_MAX)}`, tone: 'var(--color-warning)' },
      ],
    data: values.map((value, index) => ({
      value,
      label: `R${index + 1}`,
      color: isScaled ? 'var(--color-success)' : 'var(--color-world-5)',
      tooltip: `Row ${index + 1}: Age ${isScaled ? formatNumber(value, 4) : formatWhole(value)}`,
      ariaLabel: `Row ${index + 1} age ${formatNumber(value, 4)}`,
    })),
    ariaLabel: 'Dot plot showing the current Age positions.',
  };
}

function salaryChartConfig(df) {
  const standardized = validateSalaryStandardized(df) || validateStandardizedColumn(df, SALARY_COL, 0.15, 0.15);
  const values = columnPresent(df, SALARY_COL) ? df.col(SALARY_COL).values : [];

  return {
    type: 'dotplot',
    title: 'Salary Positions',
    worldColor: 'var(--color-world-5)',
    minWidth: 360,
    height: 210,
    showGrid: true,
    valueFormatter: value => (standardized ? formatSigned(value, 3) : formatMoney(value)),
    band: standardized
      ? {
        from: -1,
        to: 1,
        label: 'Within 1 sigma',
        tone: 'var(--color-world-5)',
        opacity: 0.12,
      }
      : null,
    markers: standardized
      ? [{ value: 0, label: 'mean 0', tone: 'var(--color-warning)' }]
      : [{ value: SALARY_MEAN, label: 'raw mean', tone: 'var(--color-warning)' }],
    data: values.map((value, index) => ({
      value,
      label: `R${index + 1}`,
      color: standardized ? 'var(--color-warning)' : 'var(--color-world-5)',
      tooltip: `Row ${index + 1}: Salary ${standardized ? formatSigned(value, 4) : formatMoney(value)}`,
      ariaLabel: `Row ${index + 1} salary ${formatNumber(value, 4)}`,
    })),
    ariaLabel: 'Dot plot showing the current Salary positions.',
  };
}

function purchaseChartConfig(df) {
  const logged = validatePurchaseLogged(df);
  const values = columnPresent(df, PURCHASE_COL) ? df.col(PURCHASE_COL).values : [];
  const currentMax = values.length ? Math.max(...values) : NaN;

  return {
    type: 'dotplot',
    title: 'Purchase_Count Tail',
    worldColor: 'var(--color-world-5)',
    minWidth: 360,
    height: 210,
    showGrid: true,
    valueFormatter: value => (logged ? formatNumber(value, 3) : formatWhole(value)),
    markers: Number.isFinite(currentMax)
      ? [{
        value: currentMax,
        label: logged ? `max ${formatNumber(currentMax, 3)}` : `max ${formatWhole(currentMax)}`,
        tone: logged ? 'var(--color-success)' : 'var(--color-warning)',
      }]
      : [],
    data: values.map((value, index) => ({
      value,
      label: `R${index + 1}`,
      color: logged ? 'var(--color-success)' : 'var(--color-world-5)',
      tooltip: `Row ${index + 1}: ${PURCHASE_COL} ${logged ? formatNumber(value, 4) : formatWhole(value)}`,
      ariaLabel: `Row ${index + 1} purchase count ${formatNumber(value, 4)}`,
    })),
    ariaLabel: 'Dot plot showing the current Purchase_Count positions.',
  };
}

function resultTone(summary) {
  if (!summary) return DEFAULT_FEEDBACK;
  if (summary.mistakeRuns === 0) {
    return 'Clean lab. Each feature received the transformation that matched its job: bounded range for Age, z-score balance for Salary, and tail compression for Purchase_Count.';
  }
  if (summary.mistakeRuns <= 2) {
    return 'Strong finish. The final transform mix is correct, and the recap below should make the model-to-feature fit feel automatic.';
  }
  return 'Mission complete. Keep the recap nearby: scaling is not one move repeated three times, it is a feature-by-feature fit decision.';
}

export default class World5Level7 {
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
    this._purchaseChart = null;
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
      <section class="w5-level w5-level--codefix screen-section" aria-label="World 5 Level 7">
        <div class="level-hero w5-level__hero" style="--world-color: var(--color-world-5);">
          <p class="eyebrow">World 5 - Scaling</p>
          <h1 class="level-hero__title">${escapeHtml(LEVEL_TITLE)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(LEVEL_OBJECTIVE)}
            ${escapeHtml(AGE_COL)} is the bounded feature, ${escapeHtml(SALARY_COL)} is the broad linear feature, and ${escapeHtml(PURCHASE_COL)} is the skewed count tail. The fix only works when each column gets the right transform for its own shape.
          </p>
          <div class="action-row">
            <span class="status-box" id="w5-l7-progress">0 / ${TOTAL_LOCKS} mission locks</span>
            <span class="status-box" id="w5-l7-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w5-l7-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w5-l7-reset-btn" type="button">Reset Lab</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">07</span>
        </div>

        <article class="panel w5-codefix-data-panel">
          <div class="w5-level__panel-head">
            <div>
              <p class="eyebrow">Dataset Console</p>
              <h2 class="panel-title">Keep all 5 rows, keep the same 3 columns, change only the scale behavior</h2>
            </div>
            <p class="w5-level__microcopy">
              This is not a row-cleanup lab. Nothing should be deleted, exploded, or widened. The repair overwrites the original numeric columns in place so each feature becomes easier for the model to compare.
            </p>
          </div>

          <div class="w5-codefix-snapshot" aria-label="Scaling Snapshot">
            <article class="w5-codefix-snapshot__card">
              <span class="w5-codefix-snapshot__label">Rows</span>
              <strong class="w5-codefix-snapshot__value" id="w5-l7-row-count">${ORIGINAL_DF.length}</strong>
            </article>
            <article class="w5-codefix-snapshot__card">
              <span class="w5-codefix-snapshot__label">${escapeHtml(AGE_COL)} State</span>
              <strong class="w5-codefix-snapshot__value" id="w5-l7-age-state" data-state="missing">Raw</strong>
            </article>
            <article class="w5-codefix-snapshot__card">
              <span class="w5-codefix-snapshot__label">${escapeHtml(SALARY_COL)} State</span>
              <strong class="w5-codefix-snapshot__value" id="w5-l7-salary-state" data-state="missing">Raw</strong>
            </article>
            <article class="w5-codefix-snapshot__card">
              <span class="w5-codefix-snapshot__label">${escapeHtml(PURCHASE_COL)} State</span>
              <strong class="w5-codefix-snapshot__value" id="w5-l7-purchase-state" data-state="missing">Raw Tail</strong>
            </article>
          </div>

          <div class="w5-codefix-table-shell" id="w5-l7-table"></div>
        </article>

        <div class="w5-codefix-main">
          <article class="panel w5-codefix-editor-panel">
            <div class="w5-level__panel-head">
              <div>
                <p class="eyebrow">Code Arena</p>
                <h2 class="panel-title">Inspect first, then overwrite each feature with the transform it actually needs</h2>
              </div>
              <p class="w5-level__microcopy">
                Stay close to the reference card. The lab parser expects the compact one-line scaler syntax shown there, and each correct run should leave the dataset with the same shape it started with.
              </p>
            </div>

            <div class="w5-codefix-editor-shell" id="w5-l7-editor"></div>
          </article>

          <div class="w5-codefix-side">
            <section class="panel w5-codefix-tracker" aria-label="Scaling Tracker">
              <div class="w5-level__panel-head">
                <div>
                  <p class="eyebrow">Mission Tracker</p>
                  <h2 class="panel-title">Lock the diagnosis, the bounded scale, the z-score repair, and the skew repair</h2>
                </div>
                <p class="w5-level__microcopy">
                  The lab is complete only when the right transformation lands on all three columns and the diagnostic step has been locked first.
                </p>
              </div>

              <div class="w5-codefix-tracker__list">
                ${TRACKER_STEPS.map((step, index) => `
                  <article class="w5-codefix-tracker__card" data-step-id="${step.id}" data-step-state="${index === 0 ? 'active' : 'pending'}">
                    <div class="w5-codefix-tracker__meta">
                      <span class="w5-codefix-tracker__status" data-step-status="${step.id}">${index === 0 ? 'Active' : 'Pending'}</span>
                      <span class="w5-codefix-tracker__index">Lock ${index + 1}</span>
                    </div>
                    <h3 class="w5-codefix-tracker__title">${escapeHtml(step.label)}</h3>
                    <p class="w5-codefix-tracker__chapter">${escapeHtml(step.chapter)}</p>
                    <p class="w5-codefix-tracker__copy">${escapeHtml(step.recap)}</p>
                  </article>
                `).join('')}
              </div>
            </section>

            <section class="panel w5-codefix-chart-panel" aria-label="Transformation Monitor">
              <div class="w5-level__panel-head">
                <div>
                  <p class="eyebrow">Transformation Monitor</p>
                  <h2 class="panel-title">Watch the range, the mean-sigma pair, and the skew change live</h2>
                </div>
                <p class="w5-level__microcopy">
                  The table shows exact values. These charts show whether each column is moving toward the right scale behavior.
                </p>
              </div>

              <div class="w5-codefix-chart-grid">
                <article class="w5-codefix-chart-card">
                  <div class="w5-codefix-chart-card__stats">
                    <span class="w5-codefix-chart-chip" id="w5-l7-age-min-chip">Min ${formatWhole(AGE_MIN)}</span>
                    <span class="w5-codefix-chart-chip" id="w5-l7-age-max-chip">Max ${formatWhole(AGE_MAX)}</span>
                    <span class="w5-codefix-chart-chip" id="w5-l7-age-range-chip">Target 0 -> 1</span>
                  </div>
                  <div class="w5-codefix-chart-shell" id="w5-l7-age-chart"></div>
                </article>

                <article class="w5-codefix-chart-card">
                  <div class="w5-codefix-chart-card__stats">
                    <span class="w5-codefix-chart-chip" id="w5-l7-salary-mean-chip">Mean ${formatMoney(SALARY_MEAN)}</span>
                    <span class="w5-codefix-chart-chip" id="w5-l7-salary-std-chip">Sigma ${formatNumber(SALARY_STD)}</span>
                    <span class="w5-codefix-chart-chip" id="w5-l7-salary-goal-chip">Target mean 0, std 1</span>
                  </div>
                  <div class="w5-codefix-chart-shell" id="w5-l7-salary-chart"></div>
                </article>

                <article class="w5-codefix-chart-card">
                  <div class="w5-codefix-chart-card__stats">
                    <span class="w5-codefix-chart-chip" id="w5-l7-purchase-skew-chip">Skew ${formatNumber(PURCHASE_SKEW)}</span>
                    <span class="w5-codefix-chart-chip" id="w5-l7-purchase-max-chip">Max ${formatWhole(RAW_PURCHASE_MAX)}</span>
                    <span class="w5-codefix-chart-chip" id="w5-l7-purchase-goal-chip">Target log1p compression</span>
                  </div>
                  <div class="w5-codefix-chart-shell" id="w5-l7-purchase-chart"></div>
                </article>
              </div>
            </section>

            <section class="card card--elevated w5-level__feedback" aria-live="polite">
              <p class="eyebrow">Coach Feed</p>
              <p id="w5-l7-feedback-text" class="w5-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
            </section>

            <section class="card w5-level__hint-box" id="w5-l7-hint-box" hidden>
              <p class="eyebrow">Hint</p>
              <p id="w5-l7-hint-text" class="w5-level__hint-copy"></p>
            </section>

            <section class="card w5-codefix-guide">
              <p class="eyebrow">Recommended Sequence</p>
              <div class="w5-codefix-guide__steps">
                <article class="w5-codefix-guide__step">
                  <span class="w5-codefix-guide__badge">1</span>
                  <p>Run <code>df.describe()</code> or inspect <code>${escapeHtml(PURCHASE_COL)}.skew()</code> so the scale profile is explicit before you mutate any column.</p>
                </article>
                <article class="w5-codefix-guide__step">
                  <span class="w5-codefix-guide__badge">2</span>
                  <p>Overwrite <code>${escapeHtml(AGE_COL)}</code> with MinMax and <code>${escapeHtml(SALARY_COL)}</code> with StandardScaler. Both should stay as single numeric columns.</p>
                </article>
                <article class="w5-codefix-guide__step">
                  <span class="w5-codefix-guide__badge">3</span>
                  <p>Finish by applying <code>np.log1p</code> to <code>${escapeHtml(PURCHASE_COL)}</code> so the right tail compresses while all 5 rows stay intact.</p>
                </article>
              </div>
            </section>
          </div>
        </div>

        <section class="panel w5-codefix-summary" id="w5-l7-summary" hidden aria-label="Scaling Recap">
          <div class="w5-level__panel-head">
            <div>
              <p class="eyebrow">Code Lab Recap</p>
              <h2 class="panel-title">Each feature now lives on the scale that fits its job</h2>
            </div>
            <p class="w5-level__microcopy">${escapeHtml(SUMMARY_COPY)}</p>
          </div>

          <div class="w5-codefix-summary__grid">
            <article class="w5-codefix-summary__card">
              <p class="w5-codefix-summary__kicker">Age</p>
              <h3 class="w5-codefix-summary__title">Bounded range -> shared interval</h3>
              <p class="w5-codefix-summary__copy">${escapeHtml(AGE_COL)} moved from ${formatWhole(AGE_MIN)}-${formatWhole(AGE_MAX)} into the 0-1 interval, which makes it safe to compare beside other numeric features without raw range domination.</p>
            </article>
            <article class="w5-codefix-summary__card">
              <p class="w5-codefix-summary__kicker">Salary</p>
              <h3 class="w5-codefix-summary__title">Raw dollars -> sigma units</h3>
              <p class="w5-codefix-summary__copy">${escapeHtml(SALARY_COL)} started with mean ${formatMoney(SALARY_MEAN)} and sigma ${formatNumber(SALARY_STD)}. After standardization it centers near 0 with standard deviation near 1.</p>
            </article>
            <article class="w5-codefix-summary__card">
              <p class="w5-codefix-summary__kicker">Purchase Count</p>
              <h3 class="w5-codefix-summary__title">Heavy tail -> calmer log profile</h3>
              <p class="w5-codefix-summary__copy">${escapeHtml(PURCHASE_COL)} keeps every row, but its skew drops from about ${formatNumber(PURCHASE_SKEW)} to about ${formatNumber(LOG_PURCHASE_SKEW)} after log1p, which makes the right tail much calmer.</p>
            </article>
          </div>

          <div class="action-row">
            <span class="status-box" id="w5-l7-summary-score">Waiting for the full scaling repair</span>
            <button class="btn btn--primary" id="w5-l7-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w5-l7-progress');
    this._ui.status = container.querySelector('#w5-l7-status');
    this._ui.feedback = container.querySelector('#w5-l7-feedback-text');
    this._ui.hintBox = container.querySelector('#w5-l7-hint-box');
    this._ui.hintText = container.querySelector('#w5-l7-hint-text');
    this._ui.tableHost = container.querySelector('#w5-l7-table');
    this._ui.editorHost = container.querySelector('#w5-l7-editor');
    this._ui.ageChartHost = container.querySelector('#w5-l7-age-chart');
    this._ui.salaryChartHost = container.querySelector('#w5-l7-salary-chart');
    this._ui.purchaseChartHost = container.querySelector('#w5-l7-purchase-chart');
    this._ui.rowCount = container.querySelector('#w5-l7-row-count');
    this._ui.ageState = container.querySelector('#w5-l7-age-state');
    this._ui.salaryState = container.querySelector('#w5-l7-salary-state');
    this._ui.purchaseState = container.querySelector('#w5-l7-purchase-state');
    this._ui.ageMinChip = container.querySelector('#w5-l7-age-min-chip');
    this._ui.ageMaxChip = container.querySelector('#w5-l7-age-max-chip');
    this._ui.ageRangeChip = container.querySelector('#w5-l7-age-range-chip');
    this._ui.salaryMeanChip = container.querySelector('#w5-l7-salary-mean-chip');
    this._ui.salaryStdChip = container.querySelector('#w5-l7-salary-std-chip');
    this._ui.salaryGoalChip = container.querySelector('#w5-l7-salary-goal-chip');
    this._ui.purchaseSkewChip = container.querySelector('#w5-l7-purchase-skew-chip');
    this._ui.purchaseMaxChip = container.querySelector('#w5-l7-purchase-max-chip');
    this._ui.purchaseGoalChip = container.querySelector('#w5-l7-purchase-goal-chip');
    this._ui.summary = container.querySelector('#w5-l7-summary');
    this._ui.summaryScore = container.querySelector('#w5-l7-summary-score');
    this._ui.finishButton = container.querySelector('#w5-l7-finish-btn');
    this._ui.trackerCards = Array.from(container.querySelectorAll('[data-step-id]'));

    this._mountTable();
    this._mountEditor();
    this._mountCharts();
    this._syncSnapshot(ORIGINAL_DF);
    this._syncTracker();
    this._syncProgress();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w5-l7-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w5-l7-reset-btn') || event.target.closest('.editor-reset')) {
        this._resetLab();
        return;
      }

      if (event.target.closest('#w5-l7-finish-btn')) {
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
    this._purchaseChart?.destroy();
    this._table = null;
    this._editor = null;
    this._ageChart = null;
    this._salaryChart = null;
    this._purchaseChart = null;
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
      worldColor: 'var(--color-world-5)',
    });
    this._table.highlightColumn(AGE_COL, 'scale');
    this._table.highlightColumn(SALARY_COL, 'scale');
    this._table.highlightColumn(PURCHASE_COL, 'scale');
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
      worldColor: 'var(--color-world-5)',
      onRun: summary => this._handleRun(summary),
    });
  }

  _mountCharts() {
    this._ageChart?.destroy();
    this._salaryChart?.destroy();
    this._purchaseChart?.destroy();

    this._ageChart = new ChartWidget(this._ui.ageChartHost, ageChartConfig(ORIGINAL_DF));
    this._salaryChart = new ChartWidget(this._ui.salaryChartHost, salaryChartConfig(ORIGINAL_DF));
    this._purchaseChart = new ChartWidget(this._ui.purchaseChartHost, purchaseChartConfig(ORIGINAL_DF));
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

    if (hasError) {
      this._mistakeRuns += 1;
      this._engine.mistake({ costsLife: false, countsMistake: true });
      this._setFeedback('The interpreter hit an error. Stay close to the reference card, especially for the one-line scaler syntax and the np.log1p call.');
      this._setStatus('Execution error. Reset if the failed run changed the table into a shape that no longer matches the 5-row, 3-column target.');
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

      if (this._inspected && nextPassedIds.size === TASKS.length && validateFinalSolution(summary.df)) {
        this._completeRun();
      }
      return;
    }

    if (changedData) {
      this._mistakeRuns += 1;
      this._engine.mistake({ costsLife: false, countsMistake: true });
      this._handleNonPassingMutation(summary.df);
      this._syncProgress();
      return;
    }

    this._handleInspectionRun(summary);
    this._syncProgress();
  }

  _handleMilestone(unlockedInspection, taskIds, df) {
    taskIds.forEach(taskId => {
      if (taskId === 'minmax-age') {
        this._table?.flashColumn(AGE_COL, 'green');
      }
      if (taskId === 'standardize-salary') {
        this._table?.flashColumn(SALARY_COL, 'green');
      }
      if (taskId === 'log-purchase') {
        this._table?.flashColumn(PURCHASE_COL, 'green');
      }
    });

    if (this._inspected && this._passedTaskIds.size === TASKS.length && validateFinalSolution(df)) {
      this._setFeedback('All four mission locks are in place. Each feature now lives on the scale that fits its own modeling job.');
      this._setStatus('Mission complete. Review the recap below, then continue into the World 6 synthesis.');
      return;
    }

    if (unlockedInspection && !taskIds.length) {
      this._setFeedback(`Diagnosis locked. ${AGE_COL} is bounded, ${SALARY_COL} is the broad linear feature, and ${PURCHASE_COL} is the skewed tail that wants compression instead of deletion.`);
      this._setStatus(`Inspection complete. Start with ${AGE_COL} -> MinMax, then ${SALARY_COL} -> z-score, then ${PURCHASE_COL} -> log1p.`);
      return;
    }

    if (taskIds.length === 1) {
      this._setFeedback(`${labelForTask(taskIds[0])} is now locked in.`);
    } else if (taskIds.length > 1) {
      this._setFeedback(`${taskIds.map(labelForTask).join(' + ')} locked in on the same run.`);
    }

    if (!this._inspected) {
      this._setStatus('Repair progress landed, but inspection is still missing. Run describe() or inspect the Purchase_Count skew once to lock the diagnosis step.');
      return;
    }

    if (!this._passedTaskIds.has('minmax-age')) {
      this._setStatus(`Inspection is done. Move ${AGE_COL} onto the shared 0-1 range first.`);
      return;
    }

    if (!this._passedTaskIds.has('standardize-salary')) {
      this._setStatus(`${AGE_COL} is ready. Standardize ${SALARY_COL} next so mean 0 and sigma 1 become true together.`);
      return;
    }

    if (!this._passedTaskIds.has('log-purchase')) {
      this._setStatus(`Two transforms are locked. Finish by applying np.log1p to ${PURCHASE_COL}.`);
    }
  }

  _handleInspectionRun(summary) {
    const reviewedProfile = summary.results.some(result => {
      const type = result.sideEffect?.type;
      return type === 'describe' || (type === 'skew' && result.sideEffect?.col === PURCHASE_COL);
    });

    if (reviewedProfile) {
      this._setFeedback(`Good inspection run. ${AGE_COL} wants a shared range, ${SALARY_COL} wants comparable variance units, and ${PURCHASE_COL} is the column whose right tail clearly needs log compression.`);
      this._setStatus(`Inspection complete. Overwrite ${AGE_COL}, ${SALARY_COL}, and ${PURCHASE_COL} with the transform that matches each one.`);
      return;
    }

    this._setFeedback('No repair landed yet, but the run was safe. Use the reference card to move from inspection into the three column-specific transforms.');
    this._setStatus(DEFAULT_STATUS);
  }

  _handleNonPassingMutation(df) {
    if (!(df instanceof DataFrame)) {
      this._setFeedback('That run changed something, but the table state could not be verified. Use Reset and replay the scaling sequence from the top.');
      this._setStatus('Reset recommended. The final dataset should still have the same 5 rows and 3 columns.');
      return;
    }

    if (df.length !== ORIGINAL_DF.length) {
      this._setFeedback('Scaling should not delete rows in this lab. Use Reset and keep all 5 examples while you repair the feature scales.');
      this._setStatus('Reset recommended. This level changes numeric scale behavior, not row count.');
      return;
    }

    if (!arraysEqual(df.columns, ORIGINAL_COLUMNS)) {
      this._setFeedback('The final repair should keep the same 3 columns. Use Reset and overwrite the original feature columns instead of widening, dropping, or rebuilding the table.');
      this._setStatus('Reset recommended. Keep the dataset shape stable while you change only the numeric scaling.');
      return;
    }

    if (isColumnChanged(df, AGE_COL, ORIGINAL_AGE_VALUES) && !validateAgeScaled(df)) {
      this._setFeedback(`${AGE_COL} changed, but it is not on the target 0-1 scale yet. Use the MinMax pattern from the reference card so the bounded feature lands on a shared interval.`);
      this._setStatus(`No mission lock advanced. ${AGE_COL} should end with min 0 and max 1.`);
      return;
    }

    if (isColumnChanged(df, SALARY_COL, ORIGINAL_SALARY_VALUES) && !validateSalaryStandardized(df)) {
      this._setFeedback(`${SALARY_COL} changed, but it is not yet centered and sigma-scaled. Use the StandardScaler fit_transform pattern so the column lands near mean 0 and std 1.`);
      this._setStatus(`No mission lock advanced. ${SALARY_COL} should finish as a true z-score column.`);
      return;
    }

    if (isColumnChanged(df, PURCHASE_COL, ORIGINAL_PURCHASE_VALUES) && !validatePurchaseLogged(df)) {
      this._setFeedback(`${PURCHASE_COL} changed, but the tail repair is off. This column wants np.log1p so the right tail compresses without dropping rows or pretending the counts are bounded.`);
      this._setStatus(`No mission lock advanced. ${PURCHASE_COL} should end as the log1p-transformed count feature.`);
      return;
    }

    this._setFeedback('That run changed the table, but no mission card advanced. Compare each transformed column against the specific target behavior shown in the tracker and chart monitor.');
    this._setStatus('No mission lock advanced. Reset if one of the columns drifted away from the 5-row, 3-column target shape.');
  }

  _completeRun() {
    if (this._completed) return;

    this._completed = true;
    this._summary = {
      tasksCompleted: TASKS.length,
      totalTasks: TASKS.length,
      inspected: this._inspected,
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
    this._setStatus('Code lab complete. The full scaling toolkit is now ready for the final pipeline world.');
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

    if (this._ui.hintBox) {
      this._ui.hintBox.hidden = true;
    }

    if (this._ui.hintText) {
      this._ui.hintText.textContent = '';
    }

    if (this._ui.summary) {
      this._ui.summary.hidden = true;
      this._ui.summary.classList.remove('is-revealed');
    }

    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = 'Waiting for the full scaling repair';
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

  _syncSnapshot(df) {
    const age = ageState(df);
    const salary = salaryState(df);
    const purchase = purchaseState(df);
    const currentRowCount = df instanceof DataFrame ? df.length : ORIGINAL_DF.length;
    const currentAgeMin = safeMin(df, AGE_COL);
    const currentAgeMax = safeMax(df, AGE_COL);
    const currentSalaryMean = safeMean(df, SALARY_COL);
    const currentSalaryStd = safeStd(df, SALARY_COL);
    const currentPurchaseSkew = safeSkew(df, PURCHASE_COL);
    const currentPurchaseMax = safeMax(df, PURCHASE_COL);

    if (this._ui.rowCount) {
      this._ui.rowCount.textContent = String(currentRowCount);
    }

    if (this._ui.ageState) {
      this._ui.ageState.textContent = age.label;
      this._ui.ageState.dataset.state = age.tone;
    }

    if (this._ui.salaryState) {
      this._ui.salaryState.textContent = salary.label;
      this._ui.salaryState.dataset.state = salary.tone;
    }

    if (this._ui.purchaseState) {
      this._ui.purchaseState.textContent = purchase.label;
      this._ui.purchaseState.dataset.state = purchase.tone;
    }

    if (this._ui.ageMinChip) {
      this._ui.ageMinChip.textContent = `Min ${Number.isFinite(currentAgeMin) ? formatNumber(currentAgeMin, validateAgeScaled(df) ? 3 : 0) : '-'}`;
    }

    if (this._ui.ageMaxChip) {
      this._ui.ageMaxChip.textContent = `Max ${Number.isFinite(currentAgeMax) ? formatNumber(currentAgeMax, validateAgeScaled(df) ? 3 : 0) : '-'}`;
    }

    if (this._ui.ageRangeChip) {
      this._ui.ageRangeChip.textContent = validateAgeScaled(df)
        ? 'Range locked at 0 -> 1'
        : `Raw range ${formatWhole(AGE_MIN)} -> ${formatWhole(AGE_MAX)}`;
    }

    if (this._ui.salaryMeanChip) {
      this._ui.salaryMeanChip.textContent = validateSalaryStandardized(df)
        ? `Mean ${formatSigned(currentSalaryMean, 3)}`
        : `Mean ${Number.isFinite(currentSalaryMean) ? formatMoney(currentSalaryMean) : '-'}`;
    }

    if (this._ui.salaryStdChip) {
      this._ui.salaryStdChip.textContent = `Sigma ${Number.isFinite(currentSalaryStd) ? formatNumber(currentSalaryStd, 3) : '-'}`;
    }

    if (this._ui.salaryGoalChip) {
      this._ui.salaryGoalChip.textContent = validateSalaryStandardized(df)
        ? 'Target met: mean 0, std 1'
        : 'Target mean 0, std 1';
    }

    if (this._ui.purchaseSkewChip) {
      this._ui.purchaseSkewChip.textContent = `Skew ${Number.isFinite(currentPurchaseSkew) ? formatNumber(currentPurchaseSkew, 3) : '-'}`;
    }

    if (this._ui.purchaseMaxChip) {
      this._ui.purchaseMaxChip.textContent = `Max ${Number.isFinite(currentPurchaseMax) ? formatNumber(currentPurchaseMax, validatePurchaseLogged(df) ? 3 : 0) : '-'}`;
    }

    if (this._ui.purchaseGoalChip) {
      this._ui.purchaseGoalChip.textContent = validatePurchaseLogged(df)
        ? `Skew dropped to ${formatNumber(LOG_PURCHASE_SKEW, 3)}`
        : 'Target log1p compression';
    }

    this._ageChart?.update(ageChartConfig(df));
    this._salaryChart?.update(salaryChartConfig(df));
    this._purchaseChart?.update(purchaseChartConfig(df));
  }

  _syncTracker() {
    this._ui.trackerCards?.forEach(card => {
      const stepId = card.dataset.stepId;
      const state = trackerState(stepId, this._inspected, this._passedTaskIds);
      const statusEl = card.querySelector('[data-step-status]');

      card.dataset.stepState = state;
      if (statusEl) {
        statusEl.textContent = stateLabel(state);
      }
    });
  }

  _syncProgress() {
    const lockedCount = (this._inspected ? 1 : 0) + this._passedTaskIds.size;

    if (this._ui.progress) {
      this._ui.progress.textContent = `${lockedCount} / ${TOTAL_LOCKS} mission locks`;
    }

    if (this._ui.finishButton) {
      this._ui.finishButton.disabled = !this._completed;
    }
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
