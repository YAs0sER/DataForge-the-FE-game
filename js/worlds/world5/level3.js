'use strict';

import { approxEqual } from '../../data/answers.js';
import { createDataset, DATASET_KEYS } from '../../data/datasets.js';
import { getLevelProblem } from '../../data/problems.js';
import { DataFrame } from '../../pandas/dataframe.js';
import { CalculatorWidget } from '../../widgets/calculator.js?v=20260616c';
import { ChartWidget } from '../../widgets/charts.js';

const PROBLEM = getLevelProblem(5, 3);

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

const DATASET = createLevelDataset();
const FEATURE_COL = 'Salary';
const FEATURE_LABEL = 'Salary';
const FEATURE_VALUES = DATASET.col(FEATURE_COL).values
  .filter(value => typeof value === 'number' && Number.isFinite(value));
const SORTED_VALUES = [...FEATURE_VALUES].sort((a, b) => a - b);
const ROW_COUNT = FEATURE_VALUES.length;
const SUM_VALUE = FEATURE_VALUES.reduce((sum, value) => sum + value, 0);
const MEAN_VALUE = DATASET.col(FEATURE_COL).mean();
const STD_VALUE = DATASET.col(FEATURE_COL).std();
const Z_VALUES = FEATURE_VALUES.map(value => (value - MEAN_VALUE) / STD_VALUE);
const ZERO_ANCHOR_INDEX = Z_VALUES.reduce((bestIndex, value, index) =>
  Math.abs(value) < Math.abs(Z_VALUES[bestIndex]) ? index : bestIndex
, 0);
const TARGET_ROW_INDEX = ZERO_ANCHOR_INDEX;
const TARGET_ROW_NUMBER = TARGET_ROW_INDEX + 1;
const TARGET_RAW_VALUE = FEATURE_VALUES[TARGET_ROW_INDEX];
const TARGET_CENTERED_VALUE = TARGET_RAW_VALUE - MEAN_VALUE;
const TARGET_Z_SCORE = Z_VALUES[TARGET_ROW_INDEX];
const MIN_Z = Math.min(...Z_VALUES);
const MAX_Z = Math.max(...Z_VALUES);
const ROWS = Object.freeze(
  DATASET.toRows().map((row, index) => Object.freeze({
    index,
    rowNumber: index + 1,
    age: row.Age,
    salary: row[FEATURE_COL],
    purchaseCount: row.Purchase_Count,
    centeredValue: row[FEATURE_COL] - MEAN_VALUE,
    zScore: (row[FEATURE_COL] - MEAN_VALUE) / STD_VALUE,
  }))
);

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

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

function formatSignedMoney(value) {
  return `${value >= 0 ? '+' : '-'}${formatMoney(Math.abs(value))}`;
}

function formatNumber(value, digits = 4) {
  if (!Number.isFinite(value)) return String(value);
  return Number(value.toFixed(digits)).toString();
}

function formatSigned(value, digits = 4) {
  if (!Number.isFinite(value)) return String(value);
  const rounded = Number(value.toFixed(digits));
  return `${rounded >= 0 ? '+' : ''}${rounded.toString()}`;
}

function rowByIndex(index) {
  return ROWS.find(row => row.index === index) ?? null;
}

const DEFAULT_FEEDBACK = 'Use Sum and Count to find the column center first. Standardization only makes sense after you know the mean you are centering around.';
const DEFAULT_STATUS = 'Lock the mean first. The centered gap, standard deviation, and z-score unlock in sequence.';
const SUMMARY_COPY = 'Standardization centers the feature at zero and then measures every row in standard deviation units. That keeps the model focused on relative distance instead of raw currency scale.';

const TASKS = Object.freeze([
  Object.freeze({
    id: 'mean',
    label: 'Mean Salary',
    buttonLabel: 'Lock Mean',
    cue: 'mu',
    prompt: `Average all ${ROW_COUNT} salaries so the column has a center before any z score is computed.`,
    formula: 'mu = sum(x) / n',
    expected: MEAN_VALUE,
    tolerance: 0.01,
    success: `Mean salary = ${formatMoney(MEAN_VALUE)}. That value becomes the zero-center once the column is standardized.`,
    retry: 'That mean is off. Apply mu = sum(x) / n to the complete feature column.',
    lockedCopy: 'Ready to solve.',
  }),
  Object.freeze({
    id: 'centered',
    label: `Row ${TARGET_ROW_NUMBER} Centered Gap`,
    buttonLabel: 'Lock Centered Gap',
    cue: 'x - mu',
    prompt: `Center row ${TARGET_ROW_NUMBER} using its value from the dataset and your locked mean.`,
    formula: 'centered x = x - mu',
    expected: TARGET_CENTERED_VALUE,
    tolerance: 0.01,
    success: `Row ${TARGET_ROW_NUMBER} sits ${formatSignedMoney(TARGET_CENTERED_VALUE)} away from the mean before we divide by sigma.`,
    retry: 'That centered gap is off. Apply centered x = x - mu.',
    lockedCopy: 'Unlock the mean first.',
    requires: ['mean'],
  }),
  Object.freeze({
    id: 'std',
    label: 'Standard Deviation',
    buttonLabel: 'Lock Sigma',
    cue: 'sigma',
    prompt: 'Now compute the sample standard deviation so the centered gaps can be converted into standardized units.',
    formula: 'sqrt(sum((x - mu)^2) / (n - 1))',
    expected: STD_VALUE,
    tolerance: 1,
    success: `Sigma = ${formatNumber(STD_VALUE)}. Every centered gap can now be judged in comparable standard deviation units.`,
    retry: 'That spread is off. Reuse the sample standard deviation rule: subtract the mean, square the gaps, divide by n - 1, then take the square root.',
    lockedCopy: 'Unlock the centered gap first.',
    requires: ['centered'],
  }),
  Object.freeze({
    id: 'z',
    label: `Row ${TARGET_ROW_NUMBER} Z Score`,
    buttonLabel: 'Lock Z Score',
    cue: '(x - mu) / sigma',
    prompt: `Standardize row ${TARGET_ROW_NUMBER} by dividing its centered gap by sigma.`,
    formula: 'z = (x - mu) / sigma',
    expected: TARGET_Z_SCORE,
    tolerance: 0.02,
    success: `Row ${TARGET_ROW_NUMBER} standardizes to z = ${formatSigned(TARGET_Z_SCORE)}. That means it sits just a small fraction of one sigma above the mean.`,
    retry: 'That z score is off. Divide the centered value by sigma.',
    lockedCopy: 'Unlock sigma first.',
    requires: ['std'],
  }),
]);

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM?.hints ?? []),
  `The helper buttons reveal ${formatMoney(SUM_VALUE)} total salary across ${ROW_COUNT} rows, so the mean is ${formatMoney(MEAN_VALUE)}.`,
  `Row ${TARGET_ROW_NUMBER} centers to ${formatSignedMoney(TARGET_CENTERED_VALUE)} because ${formatMoney(TARGET_RAW_VALUE)} - ${formatMoney(MEAN_VALUE)} = ${formatSignedMoney(TARGET_CENTERED_VALUE)}.`,
  `Use the sample standard deviation from the project code layer: sigma ≈ ${formatNumber(STD_VALUE)}.`,
  `Row ${TARGET_ROW_NUMBER} standardizes to z = ${formatSigned(TARGET_Z_SCORE)}, which is why it ends up closest to the zero-centered mean line.`,
]);

const CONCEPT_HINTS = Object.freeze([
  'Find the center with mu = sum(x) / n.',
  'Center the target row with centered x = x - mu.',
  'Use the sample spread formula sigma = sqrt(sum((x - mu)^2) / (n - 1)).',
  'Finish with z = (x - mu) / sigma, then look for the row whose result is closest to zero.',
]);

function taskById(taskId) {
  return TASKS.find(task => task.id === taskId) ?? null;
}

function totalProgress(solvedTaskCount, anchorLocked) {
  return solvedTaskCount + Number(anchorLocked);
}

export default class World5Level3 {
  meta = {
    title: PROBLEM?.title ?? 'Z-Score Standardization',
    subtitle: PROBLEM?.objective ?? 'Center a feature on its mean and scale it by standard deviation.',
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._events = null;
    this._calculator = null;
    this._rawChart = null;
    this._standardChart = null;
    this._solved = new Set();
    this._anchorLocked = false;
    this._completed = false;
    this._ui = {};
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w5-level w5-level--standard-lab screen-section" aria-label="World 5 Level 3">
        <div class="level-hero w5-level__hero" style="--world-color: var(--color-world-5);">
          <p class="eyebrow">World 5 - Scaling</p>
          <h1 class="level-hero__title">${escapeHtml(PROBLEM.title)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(PROBLEM.objective)}
            This lab shifts a salary feature onto a mean-zero, sigma-scaled axis so distance-sensitive models read relative position instead of raw currency size.
          </p>
          <div class="action-row">
            <span class="status-box" id="w5-l3-progress">0 / ${TASKS.length + 1} standardization locks</span>
            <span class="status-box" id="w5-l3-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w5-l3-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w5-l3-reset-btn" type="button">Reset Lab</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">03</span>
        </div>

        <div class="w5-standard-layout">
          <article class="panel w5-standard-visual-panel">
            <div class="w5-level__panel-head">
              <div>
                <p class="eyebrow">Standardization Lab</p>
                <h2 class="panel-title">Center the salary column, then convert every gap into sigma units</h2>
              </div>
              <p class="w5-level__microcopy">
                Standardization happens in two moves: subtract the mean so the feature centers on zero, then divide by sigma so the remaining distances become comparable.
              </p>
            </div>

            <div class="w5-standard-snapshot" aria-label="Standardization Snapshot">
              <article class="w5-standard-snapshot__card">
                <span class="w5-standard-snapshot__label">Mean</span>
                <strong class="w5-standard-snapshot__value" id="w5-l3-mean-state" data-state="missing">Pending</strong>
              </article>
              <article class="w5-standard-snapshot__card">
                <span class="w5-standard-snapshot__label">Row ${TARGET_ROW_NUMBER} Centered</span>
                <strong class="w5-standard-snapshot__value" id="w5-l3-centered-state" data-state="missing">Pending</strong>
              </article>
              <article class="w5-standard-snapshot__card">
                <span class="w5-standard-snapshot__label">Sigma</span>
                <strong class="w5-standard-snapshot__value" id="w5-l3-std-state" data-state="missing">Pending</strong>
              </article>
              <article class="w5-standard-snapshot__card">
                <span class="w5-standard-snapshot__label">Row ${TARGET_ROW_NUMBER} Z</span>
                <strong class="w5-standard-snapshot__value" id="w5-l3-z-state" data-state="missing">Pending</strong>
              </article>
            </div>

            <section class="w5-standard-row-panel">
              <div class="w5-standard-row-panel__head">
                <div>
                  <p class="eyebrow">Dataset Rows</p>
                  <h3 class="panel-title">${FEATURE_LABEL} is the feature we standardize here</h3>
                </div>
                <p class="w5-standard-row-panel__copy" id="w5-l3-row-note">
                  After the numeric checkpoints, click the row whose standardized salary lands closest to zero. That is the observation nearest the column mean.
                </p>
              </div>

              <div class="w5-standard-rows" id="w5-l3-row-grid">
                ${ROWS.map(row => `
                  <button
                    class="w5-standard-row"
                    type="button"
                    data-row-index="${row.index}"
                    data-row-state="locked"
                    aria-label="Row ${row.rowNumber}, salary ${formatMoney(row.salary)}"
                  >
                    <div class="w5-standard-row__meta">
                      <span class="w5-standard-row__slot">Row ${row.rowNumber}</span>
                      <span class="w5-standard-row__salary">${escapeHtml(formatMoney(row.salary))}</span>
                    </div>
                    <div class="w5-standard-row__stats">
                      <span>Age ${escapeHtml(formatNumber(row.age, 0))}</span>
                      <span>Purchases ${escapeHtml(formatNumber(row.purchaseCount, 0))}</span>
                    </div>
                    <p class="w5-standard-row__scaled" data-row-z="${row.index}">Z value hidden</p>
                  </button>
                `).join('')}
              </div>
            </section>

            <div class="w5-standard-formulas" aria-label="Standardization Formula Board">
              <article class="w5-standard-formula">
                <span class="w5-standard-formula__badge">Center</span>
                <p class="w5-standard-formula__title">x - mean</p>
                <p class="w5-standard-formula__copy">Every salary first loses the column mean so the new zero line represents the average profile instead of raw dollars.</p>
              </article>
              <article class="w5-standard-formula">
                <span class="w5-standard-formula__badge">Scale</span>
                <p class="w5-standard-formula__title">(x - mean) / sigma</p>
                <p class="w5-standard-formula__copy">Dividing by sigma expresses distance in standard deviation units, which makes the column easier to compare with other numeric features later.</p>
              </article>
              <article class="w5-standard-formula">
                <span class="w5-standard-formula__badge">Target</span>
                <p class="w5-standard-formula__title">Apply the formula to row ${TARGET_ROW_NUMBER}</p>
                <p class="w5-standard-formula__copy">Read x from the dataset and use the mean and sigma you calculated yourself.</p>
              </article>
            </div>

            <div class="w5-standard-chart-grid">
              <article class="w5-standard-chart-panel">
                <div class="w5-standard-chart-panel__head">
                  <div>
                    <p class="eyebrow">Raw Axis</p>
                    <h3 class="panel-title">Original ${FEATURE_LABEL} bars</h3>
                  </div>
                  <p class="w5-standard-chart-panel__copy">
                    The raw chart preserves the large currency scale, which is exactly what standardization is about taming.
                  </p>
                </div>
                <div class="w5-standard-chart-shell" id="w5-l3-raw-chart"></div>
              </article>

              <article class="w5-standard-chart-panel" id="w5-l3-standard-panel" hidden>
                <div class="w5-standard-chart-panel__head">
                  <div>
                    <p class="eyebrow">Standardized Axis</p>
                    <h3 class="panel-title">Z-score dot plot</h3>
                  </div>
                  <p class="w5-standard-chart-panel__copy" id="w5-l3-standard-note">
                    The standardized chart appears after you compute row ${TARGET_ROW_NUMBER}'s z score. Then the final step is identifying which row lives closest to zero.
                  </p>
                </div>
                <div class="w5-standard-chart-shell" id="w5-l3-standard-chart"></div>
              </article>
            </div>
          </article>

          <div class="w5-standard-side">
            <article class="panel w5-standard-calc-panel">
              <div class="w5-level__panel-head">
                <div>
                  <p class="eyebrow">Standardization Console</p>
                  <h2 class="panel-title">Use the helpers for the center, then lock the four staged checkpoints</h2>
                </div>
                <p class="w5-level__microcopy">
                  Sum and Count expose the mean fast. After that, the centered gap and sigma show how standardization turns raw salary distance into a balanced relative signal.
                </p>
              </div>

              <div class="w5-standard-calc-host" id="w5-l3-calculator"></div>
            </article>

            <article class="panel w5-standard-tracker" aria-label="Standardization Tracker">
              <div class="w5-level__panel-head">
                <div>
                  <p class="eyebrow">Checkpoint Tracker</p>
                  <h2 class="panel-title">Find the center, isolate one row's gap, scale it, then identify the row nearest zero</h2>
                </div>
                <p class="w5-level__microcopy">
                  The tracker keeps the standardization formula visible as a story: center first, scale second, interpretation last.
                </p>
              </div>

              <div class="w5-standard-tasklist">
                ${TASKS.map(task => `
                  <form class="w5-standard-task" data-task-id="${task.id}" data-task-state="pending" novalidate>
                    <div class="w5-standard-task__meta">
                      <span class="w5-standard-task__status" data-task-status="${task.id}">Pending</span>
                      <span class="w5-standard-task__cue">${escapeHtml(task.cue)}</span>
                    </div>
                    <h3 class="w5-standard-task__title">${escapeHtml(task.label)}</h3>
                    <p class="w5-standard-task__prompt">${escapeHtml(task.prompt)}</p>
                    <p class="w5-standard-task__formula">${escapeHtml(task.formula)}</p>

                    <div class="w5-standard-task__entry">
                      <label class="w5-standard-task__field">
                        <span class="sr-only">${escapeHtml(task.label)} answer</span>
                        <input
                          class="w5-standard-input"
                          data-task-input="${task.id}"
                          inputmode="decimal"
                          autocomplete="off"
                          placeholder="Enter value"
                          type="text"
                        >
                      </label>
                      <button class="btn btn--primary" data-task-submit="${task.id}" type="submit">${escapeHtml(task.buttonLabel)}</button>
                    </div>

                    <p class="w5-standard-task__result" data-task-result="${task.id}">${escapeHtml(task.lockedCopy)}</p>
                  </form>
                `).join('')}

                <article class="w5-standard-task w5-standard-task--anchor" id="w5-l3-anchor-task" data-task-state="locked">
                  <div class="w5-standard-task__meta">
                    <span class="w5-standard-task__status" id="w5-l3-anchor-status">Locked</span>
                    <span class="w5-standard-task__cue">Zero Anchor</span>
                  </div>
                  <h3 class="w5-standard-task__title">Click the row whose standardized salary lands closest to zero</h3>
                  <p class="w5-standard-task__prompt" id="w5-l3-anchor-copy">
                    Solve the four numeric checkpoints first. Then click the observation whose z score hugs the zero-centered mean line most tightly.
                  </p>
                  <p class="w5-standard-task__formula">closest z -> 0</p>
                </article>
              </div>
            </article>

            <div class="w5-standard-support">
              <section class="card card--elevated w5-level__feedback" aria-live="polite">
                <p class="eyebrow">Coach Feed</p>
                <p id="w5-l3-feedback-text" class="w5-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
              </section>

              <section class="card w5-level__hint-box" id="w5-l3-hint-box" hidden>
                <p class="eyebrow">Hint</p>
                <p id="w5-l3-hint-text" class="w5-level__hint-copy"></p>
              </section>

              <section class="card w5-standard-guide">
                <p class="eyebrow">Why Standardization Helps</p>
                <div class="w5-standard-guide__steps">
                  <article class="w5-standard-guide__step">
                    <span class="w5-standard-guide__badge">1</span>
                    <p>Subtracting the mean redefines zero as the feature center instead of the raw origin.</p>
                  </article>
                  <article class="w5-standard-guide__step">
                    <span class="w5-standard-guide__badge">2</span>
                    <p>Dividing by sigma turns each row into a relative distance, so the model can compare this feature beside others without raw unit dominance.</p>
                  </article>
                  <article class="w5-standard-guide__step">
                    <span class="w5-standard-guide__badge">3</span>
                    <p>Rows with z scores near 0 are near average. Large positive or negative z scores signal unusual observations on either side of the mean.</p>
                  </article>
                </div>
              </section>
            </div>
          </div>
        </div>

        <section class="panel w5-standard-summary" id="w5-l3-summary" hidden aria-label="Standardization Summary">
          <div class="w5-level__panel-head">
            <div>
              <p class="eyebrow">Standardization Recap</p>
              <h2 class="panel-title">The salary column is now centered on zero and measured in sigma-sized steps</h2>
            </div>
            <p class="w5-level__microcopy">${escapeHtml(SUMMARY_COPY)}</p>
          </div>

          <div class="w5-standard-summary__grid">
            <article class="w5-standard-summary__card">
              <p class="w5-standard-summary__kicker">Center</p>
              <h3 class="w5-standard-summary__title">Mean = ${formatMoney(MEAN_VALUE)}</h3>
              <p class="w5-standard-summary__copy">Subtracting the mean shifts the column so zero becomes the average salary instead of an arbitrary raw-dollar origin.</p>
            </article>
            <article class="w5-standard-summary__card">
              <p class="w5-standard-summary__kicker">Scale</p>
              <h3 class="w5-standard-summary__title">Sigma = ${formatNumber(STD_VALUE)}</h3>
              <p class="w5-standard-summary__copy">Sigma becomes the unit size for every remaining gap, which is what makes z scores comparable across numeric features.</p>
            </article>
            <article class="w5-standard-summary__card">
              <p class="w5-standard-summary__kicker">Zero Anchor</p>
              <h3 class="w5-standard-summary__title">Row ${TARGET_ROW_NUMBER} -> z ${formatSigned(TARGET_Z_SCORE)}</h3>
              <p class="w5-standard-summary__copy">Row ${TARGET_ROW_NUMBER} ends up closest to zero because its salary is the nearest to the overall mean once all rows are standardized.</p>
            </article>
          </div>

          <div class="action-row">
            <span class="status-box" id="w5-l3-summary-score">Waiting for the full standardization reveal</span>
            <button class="btn btn--primary" id="w5-l3-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w5-l3-progress');
    this._ui.status = container.querySelector('#w5-l3-status');
    this._ui.feedback = container.querySelector('#w5-l3-feedback-text');
    this._ui.hintBox = container.querySelector('#w5-l3-hint-box');
    this._ui.hintText = container.querySelector('#w5-l3-hint-text');
    this._ui.calculatorHost = container.querySelector('#w5-l3-calculator');
    this._ui.rawChartHost = container.querySelector('#w5-l3-raw-chart');
    this._ui.standardChartHost = container.querySelector('#w5-l3-standard-chart');
    this._ui.standardPanel = container.querySelector('#w5-l3-standard-panel');
    this._ui.standardNote = container.querySelector('#w5-l3-standard-note');
    this._ui.rowNote = container.querySelector('#w5-l3-row-note');
    this._ui.meanState = container.querySelector('#w5-l3-mean-state');
    this._ui.centeredState = container.querySelector('#w5-l3-centered-state');
    this._ui.stdState = container.querySelector('#w5-l3-std-state');
    this._ui.zState = container.querySelector('#w5-l3-z-state');
    this._ui.summary = container.querySelector('#w5-l3-summary');
    this._ui.summaryScore = container.querySelector('#w5-l3-summary-score');
    this._ui.finishButton = container.querySelector('#w5-l3-finish-btn');
    this._ui.rowButtons = Array.from(container.querySelectorAll('[data-row-index]'));
    this._ui.anchorTask = container.querySelector('#w5-l3-anchor-task');
    this._ui.anchorStatus = container.querySelector('#w5-l3-anchor-status');
    this._ui.anchorCopy = container.querySelector('#w5-l3-anchor-copy');

    this._mountCalculator();
    this._mountCharts();
    this._syncTaskUi();
    this._syncProgress();
    this._syncRowUi();
    this._syncSnapshot();
    this._syncStandardReveal();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w5-l3-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w5-l3-reset-btn')) {
        this._resetLab();
        return;
      }

      if (event.target.closest('#w5-l3-finish-btn')) {
        if (this._completed) {
          void this._engine.complete();
        }
        return;
      }

      const rowButton = event.target.closest('[data-row-index]');
      if (rowButton) {
        this._handleRowPick(rowButton);
      }
    }, { signal });

    this._container?.addEventListener('submit', event => {
      const form = event.target.closest('[data-task-id]');
      if (!form) return;
      event.preventDefault();
      this._gradeTask(form.getAttribute('data-task-id'));
    }, { signal });
  }

  getHint(hintsUsed) {
    return CONCEPT_HINTS[hintsUsed - 1] ?? null;
  }

  pause() {}

  resume() {}

  teardown() {
    this._events?.abort();
    this._calculator?.destroy();
    this._rawChart?.destroy();
    this._standardChart?.destroy();
    this._calculator = null;
    this._rawChart = null;
    this._standardChart = null;
    this._solved.clear();
    this._ui = {};
  }

  _mountCalculator() {
    this._calculator?.destroy();
    this._calculator = new CalculatorWidget(this._ui.calculatorHost, {
      title: `${FEATURE_LABEL} Console`,
      dataset: FEATURE_VALUES,
      worldColor: 'var(--color-world-5)',
      onSpecial: payload => this._handleSpecialAction(payload),
      onResult: payload => this._handleCalculation(payload),
    });
  }

  _mountCharts() {
    this._rawChart?.destroy();
    this._standardChart?.destroy();

    this._rawChart = new ChartWidget(this._ui.rawChartHost, {
      type: 'bar',
      title: `Raw ${FEATURE_LABEL} values`,
      worldColor: 'var(--color-world-5)',
      minWidth: 520,
      height: 250,
      data: ROWS.map(row => ({
        label: `R${row.rowNumber}`,
        value: row.salary,
        color: row.index === TARGET_ROW_INDEX
          ? 'var(--color-warning)'
          : 'var(--color-world-5)',
      })),
      valueFormatter: value => formatMoney(value),
      tooltipFormatter: item => {
        const row = rowByIndex(Number(item.label.replace('R', '')) - 1);
        return row
          ? `Row ${row.rowNumber}: ${formatMoney(row.salary)}`
          : `${item.label}: ${formatMoney(item.value)}`;
      },
      ariaLabel: `Bar chart showing the raw ${FEATURE_LABEL.toLowerCase()} values for rows 1 through ${ROW_COUNT}.`,
    });

    this._standardChart = new ChartWidget(this._ui.standardChartHost, {
      type: 'dotplot',
      title: `Standardized ${FEATURE_LABEL} positions`,
      worldColor: 'var(--color-world-5)',
      minWidth: 720,
      height: 270,
      showGrid: true,
      scaleMode: 'linear',
      tickValues: [MIN_Z, -1, 0, 1, MAX_Z],
      valueFormatter: value => formatSigned(value),
      band: {
        from: -1,
        to: 1,
        label: 'Within 1 sigma',
        tone: 'var(--color-world-5)',
        opacity: 0.14,
      },
      markers: [
        {
          value: 0,
          label: 'Mean -> 0',
          tone: 'var(--color-world-5)',
        },
        {
          value: TARGET_Z_SCORE,
          label: `Row ${TARGET_ROW_NUMBER}`,
          tone: 'var(--color-warning)',
        },
      ],
      connectors: [{
        from: 0,
        to: TARGET_Z_SCORE,
        label: `Row ${TARGET_ROW_NUMBER} = ${formatSigned(TARGET_Z_SCORE)}`,
        tone: 'var(--color-warning)',
      }],
      data: ROWS.map(row => ({
        value: row.zScore,
        label: `R${row.rowNumber}`,
        color: row.index === TARGET_ROW_INDEX ? 'var(--color-warning)' : 'var(--color-world-5)',
        state: row.index === TARGET_ROW_INDEX ? 'active' : 'default',
        tooltip: `Row ${row.rowNumber}: z ${formatSigned(row.zScore)} from ${formatMoney(row.salary)}`,
        ariaLabel: `Row ${row.rowNumber} z score ${formatSigned(row.zScore)}`,
      })),
      ariaLabel: `Dot plot showing the standardized ${FEATURE_LABEL.toLowerCase()} z scores for rows 1 through ${ROW_COUNT}.`,
    });
  }

  _handleSpecialAction(payload) {
    if (!payload) return;

    if (payload.action === 'Sum') {
      this._setFeedback(`The salary total is ${formatMoney(SUM_VALUE)}. Pair that with the row count ${ROW_COUNT} to compute the mean center.`);
      this._setStatus('Great. Divide the total by the row count so the column gets a mean before you standardize any row.');
      return;
    }

    if (payload.action === 'Count') {
      this._setFeedback(`There are ${ROW_COUNT} salary rows. Count matters because the mean is total divided by ${ROW_COUNT}.`);
      this._setStatus('Use Count with Sum to lock the mean, then move into centered and standardized distance.');
      return;
    }

    if (payload.action === 'Sort') {
      this._setFeedback(`Sorted salaries: ${SORTED_VALUES.map(value => formatMoney(value)).join(', ')}. The mean will land between row 3 and row 4, which helps you reason about which row should finish nearest to zero.`);
      this._setStatus('Sorting helps you picture the center, but standardization still depends on the exact mean and sigma.');
    }
  }

  _handleCalculation(payload) {
    if (!payload || typeof payload.result !== 'number' || Number.isNaN(payload.result)) return;

    const signals = [
      ['mean', MEAN_VALUE, `That calculator result matches the mean center: ${formatMoney(MEAN_VALUE)}.`],
      ['centered', TARGET_CENTERED_VALUE, `That result matches row ${TARGET_ROW_NUMBER}'s centered gap: ${formatSignedMoney(TARGET_CENTERED_VALUE)}.`],
      ['std', STD_VALUE, `That result matches sigma: ${formatNumber(STD_VALUE)}.`],
      ['z', TARGET_Z_SCORE, `That result matches row ${TARGET_ROW_NUMBER}'s z score: ${formatSigned(TARGET_Z_SCORE)}.`],
    ];

    const match = signals.find(([taskId, expected]) =>
      !this._solved.has(taskId) && approxEqual(payload.result, expected, taskById(taskId)?.tolerance ?? 0.02)
    );

    if (!match) return;

    const [taskId, , message] = match;
    const nextTask = TASKS.find(task => !this._solved.has(task.id) && task.id !== taskId);

    this._setFeedback(`${message} Lock it into the ${taskById(taskId)?.label ?? 'checkpoint'} card when you are ready.`);
    if (nextTask) {
      this._setStatus(`${taskById(taskId)?.label ?? 'That checkpoint'} is numerically ready. Next up: ${nextTask.label}.`);
    }
  }

  _gradeTask(taskId) {
    const task = taskById(taskId);
    if (!task || this._solved.has(taskId)) return;

    if (task.requires?.some(requiredId => !this._solved.has(requiredId))) {
      const requiredLabels = task.requires
        .map(requiredId => taskById(requiredId)?.label?.toLowerCase() ?? requiredId)
        .join(' and ');
      this._setFeedback(`Finish ${requiredLabels} before you try to lock ${task.label.toLowerCase()}.`);
      this._setStatus(DEFAULT_STATUS);
      return;
    }

    const input = this._container?.querySelector(`[data-task-input="${taskId}"]`);
    const rawValue = input?.value?.trim() ?? '';
    const numericValue = Number(rawValue);

    if (!rawValue || Number.isNaN(numericValue)) {
      this._setFeedback(`Enter a numeric answer for ${task.label.toLowerCase()} before you check it.`);
      this._flashInput(input, true);
      return;
    }

    if (!approxEqual(numericValue, task.expected, task.tolerance ?? 0.02)) {
      this._setFeedback(task.retry);
      this._flashInput(input, true);
      this._engine.mistake({ costsLife: false, countsMistake: true });
      return;
    }

    this._solved.add(taskId);
    this._engine.correct();
    this._setFeedback(task.success);
    this._flashInput(input, false);
    this._syncTaskUi();
    this._syncProgress();
    this._syncRowUi();
    this._syncSnapshot();
    this._syncStandardReveal();

    if (this._solved.has('z') && !this._anchorLocked) {
      this._setStatus('All numeric checkpoints are locked. Click the row whose z score sits closest to zero so you identify the observation nearest the mean.');
      return;
    }

    const remainingTask = TASKS.find(taskDef => !this._solved.has(taskDef.id));
    if (remainingTask) {
      this._setStatus(`${task.label} is solved. Next up: ${remainingTask.label}.`);
    }
  }

  _handleRowPick(button) {
    const rowIndex = Number(button?.dataset?.rowIndex);
    if (!Number.isFinite(rowIndex) || this._anchorLocked) return;

    if (!this._solved.has('z')) {
      this._setFeedback('The row deck becomes gradeable only after the numeric checkpoints are finished. Lock the mean, centered gap, sigma, and z score first.');
      this._setStatus('Finish the four numeric checkpoints before you select the zero-anchor row.');
      return;
    }

    if (rowIndex !== ZERO_ANCHOR_INDEX) {
      this._engine.mistake({ costsLife: false, countsMistake: true });
      const row = rowByIndex(rowIndex);
      this._setFeedback(`Row ${row?.rowNumber ?? '?'} is not the closest to zero. Its z score is ${formatSigned(row?.zScore ?? 0)}, so it sits farther from the mean than row ${TARGET_ROW_NUMBER}.`);
      this._flashRow(button, true);
      return;
    }

    this._anchorLocked = true;
    this._completed = true;
    this._engine.correct();
    this._setFeedback(`Correct. Row ${TARGET_ROW_NUMBER} sits closest to the mean, so its standardized salary lands nearest to zero at z = ${formatSigned(TARGET_Z_SCORE)}.`);
    this._setStatus('All five checkpoints are complete. Review the recap, then continue.');
    this._syncTaskUi();
    this._syncProgress();
    this._syncRowUi();
    this._syncSnapshot();
    this._revealSummary();
  }

  _syncTaskUi() {
    TASKS.forEach(task => {
      const form = this._container?.querySelector(`[data-task-id="${task.id}"]`);
      const input = this._container?.querySelector(`[data-task-input="${task.id}"]`);
      const result = this._container?.querySelector(`[data-task-result="${task.id}"]`);
      const status = this._container?.querySelector(`[data-task-status="${task.id}"]`);
      const button = this._container?.querySelector(`[data-task-submit="${task.id}"]`);
      const solved = this._solved.has(task.id);
      const locked = !solved && task.requires?.some(requiredId => !this._solved.has(requiredId));

      if (!form || !input || !result || !status || !button) return;

      form.dataset.taskState = solved ? 'solved' : locked ? 'locked' : 'pending';
      status.textContent = solved ? 'Solved' : locked ? 'Locked' : 'Pending';
      result.textContent = solved ? task.success : locked ? task.lockedCopy : 'Ready to solve.';
      input.disabled = solved || Boolean(locked);
      button.disabled = solved || Boolean(locked);
      input.classList.toggle('is-solved', solved);
      input.classList.remove('is-error');

      if (solved) {
        input.value = task.id === 'z' ? formatNumber(task.expected) : formatNumber(task.expected);
      } else if (locked) {
        input.value = '';
      }
    });

    if (this._ui.anchorTask && this._ui.anchorStatus && this._ui.anchorCopy) {
      const unlocked = this._solved.has('z');
      this._ui.anchorTask.dataset.taskState = this._anchorLocked ? 'solved' : unlocked ? 'pending' : 'locked';
      this._ui.anchorStatus.textContent = this._anchorLocked ? 'Solved' : unlocked ? 'Active' : 'Locked';
      this._ui.anchorCopy.textContent = this._anchorLocked
        ? `Row ${TARGET_ROW_NUMBER} stays closest to zero because its salary sits nearest the mean ${formatMoney(MEAN_VALUE)}.`
        : unlocked
          ? `Click the row whose z score hugs zero most tightly. That is the observation nearest the mean ${formatMoney(MEAN_VALUE)}.`
          : 'Solve the four numeric checkpoints first. Then use the row deck to identify the observation whose standardized salary lands closest to zero.';
    }
  }

  _syncProgress() {
    const progress = totalProgress(this._solved.size, this._anchorLocked);

    if (this._ui.progress) {
      this._ui.progress.textContent = `${progress} / ${TASKS.length + 1} standardization locks`;
    }

    if (this._ui.finishButton) {
      this._ui.finishButton.disabled = !this._completed;
    }
  }

  _syncRowUi() {
    const readyToPick = this._solved.has('z');

    this._ui.rowButtons?.forEach(button => {
      const rowIndex = Number(button.dataset.rowIndex);
      const row = rowByIndex(rowIndex);
      const zEl = this._container?.querySelector(`[data-row-z="${rowIndex}"]`);

      button.classList.remove('is-error');

      if (this._anchorLocked) {
        button.dataset.rowState = rowIndex === ZERO_ANCHOR_INDEX ? 'solved' : 'muted';
      } else if (readyToPick) {
        button.dataset.rowState = rowIndex === ZERO_ANCHOR_INDEX ? 'target' : 'candidate';
      } else if (this._solved.has('centered') && rowIndex === TARGET_ROW_INDEX) {
        button.dataset.rowState = 'target';
      } else {
        button.dataset.rowState = 'locked';
      }

      if (zEl) {
        zEl.textContent = this._solved.has('z')
          ? `z -> ${formatSigned(row?.zScore ?? 0)}`
          : rowIndex === TARGET_ROW_INDEX && this._solved.has('centered')
            ? `Centered gap -> ${formatSignedMoney(row?.centeredValue ?? 0)}`
            : 'Z value hidden';
      }
    });

    if (this._ui.rowNote) {
      this._ui.rowNote.textContent = this._anchorLocked
        ? `Row ${TARGET_ROW_NUMBER} is the zero-anchor because its z score ${formatSigned(TARGET_Z_SCORE)} sits closest to the mean-centered zero line.`
        : readyToPick
          ? `The row deck is now live. Click the observation whose standardized salary lands closest to zero.`
          : this._solved.has('mean')
            ? `The mean is ${formatMoney(MEAN_VALUE)}. Once the z scores are revealed, the row nearest that center becomes the final zero-anchor choice.`
            : 'After the numeric checkpoints, click the row whose standardized salary lands closest to zero. That is the observation nearest the column mean.';
    }
  }

  _syncSnapshot() {
    if (this._ui.meanState) {
      this._ui.meanState.textContent = this._solved.has('mean') ? formatMoney(MEAN_VALUE) : 'Pending';
      this._ui.meanState.dataset.state = this._solved.has('mean') ? 'correct' : 'missing';
    }

    if (this._ui.centeredState) {
      this._ui.centeredState.textContent = this._solved.has('centered') ? formatSignedMoney(TARGET_CENTERED_VALUE) : 'Pending';
      this._ui.centeredState.dataset.state = this._solved.has('centered') ? 'correct' : 'missing';
    }

    if (this._ui.stdState) {
      this._ui.stdState.textContent = this._solved.has('std') ? formatNumber(STD_VALUE) : 'Pending';
      this._ui.stdState.dataset.state = this._solved.has('std') ? 'correct' : 'missing';
    }

    if (this._ui.zState) {
      this._ui.zState.textContent = this._solved.has('z') ? formatSigned(TARGET_Z_SCORE) : 'Pending';
      this._ui.zState.dataset.state = this._solved.has('z') ? 'correct' : 'missing';
    }
  }

  _syncStandardReveal() {
    if (!this._ui.standardPanel) return;

    const revealed = this._solved.has('z');
    this._ui.standardPanel.hidden = !revealed;

    if (this._ui.standardNote) {
      this._ui.standardNote.textContent = revealed
        ? `The standardized chart is now live. Zero marks the mean, the shaded band spans +/-1 sigma, and row ${TARGET_ROW_NUMBER} sits at ${formatSigned(TARGET_Z_SCORE)}.`
        : `The standardized chart appears after you compute row ${TARGET_ROW_NUMBER}'s z score. Then the final step is identifying which row lives closest to zero.`;
    }
  }

  _showHint() {
    const { allowed, text } = this._engine.requestHint();
    if (!allowed || !text) return;

    this._ui.hintBox?.removeAttribute('hidden');
    if (this._ui.hintText) {
      this._ui.hintText.textContent = text;
    }
  }

  _resetLab() {
    this._solved.clear();
    this._anchorLocked = false;
    this._completed = false;

    this._container?.querySelectorAll('.w5-standard-input').forEach(input => {
      input.value = '';
      input.classList.remove('is-error', 'is-solved');
    });

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
      this._ui.summaryScore.textContent = 'Waiting for the full standardization reveal';
    }

    this._mountCalculator();
    this._setFeedback(DEFAULT_FEEDBACK);
    this._setStatus(DEFAULT_STATUS);
    this._syncTaskUi();
    this._syncProgress();
    this._syncRowUi();
    this._syncSnapshot();
    this._syncStandardReveal();
  }

  _revealSummary() {
    if (!this._ui.summary) return;

    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = `${TASKS.length + 1} / ${TASKS.length + 1} standardization locks`;
    }

    this._ui.summary.hidden = false;
    requestAnimationFrame(() => {
      this._ui.summary.classList.add('is-revealed');
    });
    this._ui.summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  _flashInput(input, isError) {
    if (!input) return;
    input.classList.toggle('is-error', Boolean(isError));

    if (isError) {
      input.focus();
      input.select?.();
      return;
    }

    input.classList.add('is-solved');
  }

  _flashRow(button, isError) {
    if (!button) return;
    button.classList.toggle('is-error', Boolean(isError));
    if (!isError) return;

    window.setTimeout(() => {
      button.classList.remove('is-error');
    }, 700);
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
