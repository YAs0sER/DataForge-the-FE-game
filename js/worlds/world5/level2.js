'use strict';

import { approxEqual } from '../../data/answers.js';
import { createDataset, DATASET_KEYS } from '../../data/datasets.js';
import { getLevelProblem } from '../../data/problems.js';
import { DataFrame } from '../../pandas/dataframe.js';
import { CalculatorWidget } from '../../widgets/calculator.js?v=20260616c';
import { ChartWidget } from '../../widgets/charts.js';

const PROBLEM = getLevelProblem(5, 2);

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
const FEATURE_COL = 'Purchase_Count';
const FEATURE_LABEL = 'Purchase Count';
const FEATURE_VALUES = DATASET.col(FEATURE_COL).values
  .filter(value => typeof value === 'number' && Number.isFinite(value));
const SORTED_VALUES = [...FEATURE_VALUES].sort((a, b) => a - b);
const MIN_VALUE = Math.min(...FEATURE_VALUES);
const MAX_VALUE = Math.max(...FEATURE_VALUES);
const RANGE_VALUE = MAX_VALUE - MIN_VALUE;
const TARGET_ROW_INDEX = 3;
const TARGET_ROW_NUMBER = TARGET_ROW_INDEX + 1;
const TARGET_RAW_VALUE = FEATURE_VALUES[TARGET_ROW_INDEX];
const TARGET_SCALED_VALUE = (TARGET_RAW_VALUE - MIN_VALUE) / RANGE_VALUE;
const MIN_ROW_INDEX = FEATURE_VALUES.indexOf(MIN_VALUE);
const MAX_ROW_INDEX = FEATURE_VALUES.lastIndexOf(MAX_VALUE);
const ROWS = Object.freeze(
  DATASET.toRows().map((row, index) => Object.freeze({
    index,
    rowNumber: index + 1,
    age: row.Age,
    salary: row.Salary,
    purchaseCount: row[FEATURE_COL],
    scaledValue: (row[FEATURE_COL] - MIN_VALUE) / RANGE_VALUE,
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

function formatNumber(value, digits = 4) {
  if (!Number.isFinite(value)) return String(value);
  return Number(value.toFixed(digits)).toString();
}

function formatScaled(value) {
  if (!Number.isFinite(value)) return String(value);
  return value === 0 || value === 1 ? value.toFixed(0) : Number(value.toFixed(4)).toString();
}

function rowByIndex(index) {
  return ROWS.find(row => row.index === index) ?? null;
}

const DEFAULT_FEEDBACK = 'Sort the purchase counts first. The first and last values of the ordered list give you the min and max that drive the min-max formula.';
const DEFAULT_STATUS = 'Start with the min and max. The feature range and scaled row checkpoint unlock after both anchors are correct.';
const SUMMARY_COPY = 'Min-max scaling keeps the feature order but squeezes the raw values into a shared 0-1 interval. That makes bounded counts easier to compare beside other features later.';

const TASKS = Object.freeze([
  Object.freeze({
    id: 'min',
    label: 'Minimum Value',
    buttonLabel: 'Lock Min',
    cue: 'First sorted value',
    prompt: `Find the smallest ${FEATURE_LABEL.toLowerCase()} in the dataset.`,
    formula: `min(${FEATURE_COL}) = ?`,
    expected: MIN_VALUE,
    tolerance: 0.001,
    success: `${FEATURE_LABEL} minimum = ${formatNumber(MIN_VALUE)}. That value becomes the 0 anchor after scaling.`,
    retry: 'That minimum is off. Sort the feature values and select the first value.',
    lockedCopy: 'Ready to solve.',
  }),
  Object.freeze({
    id: 'max',
    label: 'Maximum Value',
    buttonLabel: 'Lock Max',
    cue: 'Last sorted value',
    prompt: `Find the largest ${FEATURE_LABEL.toLowerCase()} in the dataset.`,
    formula: `max(${FEATURE_COL}) = ?`,
    expected: MAX_VALUE,
    tolerance: 0.001,
    success: `${FEATURE_LABEL} maximum = ${formatNumber(MAX_VALUE)}. That value becomes the 1 anchor after scaling.`,
    retry: 'That maximum is off. Sort the feature values and select the last value.',
    lockedCopy: 'Ready to solve.',
  }),
  Object.freeze({
    id: 'range',
    label: 'Feature Range',
    buttonLabel: 'Lock Range',
    cue: 'max - min',
    prompt: 'Subtract the minimum from the maximum to build the denominator of the min-max formula.',
    formula: 'range = max - min',
    expected: RANGE_VALUE,
    tolerance: 0.001,
    success: `Range = ${formatNumber(RANGE_VALUE)}. Every min-max scaled gap will now be measured against that ${formatNumber(RANGE_VALUE)}-unit span.`,
    retry: 'That range is off. Apply range = max - min using your locked anchors.',
    lockedCopy: 'Unlock min and max first.',
    requires: ['min', 'max'],
  }),
  Object.freeze({
    id: 'target',
    label: `Scaled Row ${TARGET_ROW_NUMBER}`,
    buttonLabel: 'Lock Scaled Value',
    cue: '(x - min) / range',
    prompt: `Normalize row ${TARGET_ROW_NUMBER} using the value shown in the dataset.`,
    formula: 'scaled x = (x - min) / (max - min)',
    expected: TARGET_SCALED_VALUE,
    tolerance: 0.01,
    success: `Row ${TARGET_ROW_NUMBER} scales to ${formatScaled(TARGET_SCALED_VALUE)}. That means ${TARGET_RAW_VALUE} sits about 35 percent of the way from the lower anchor to the upper one.`,
    retry: 'That scaled value is off. Subtract the minimum first, then divide by max - min.',
    lockedCopy: 'Unlock the range first.',
    requires: ['range'],
  }),
]);

const LEVEL_HINTS = Object.freeze([
  'Sort the feature values. The first and last values become the minimum and maximum anchors.',
  'Build the denominator with range = max - min.',
  'Use scaled x = (x - min) / (max - min) for the target row.',
  'The original maximum maps to 1, while the original minimum maps to 0.',
]);

function taskById(taskId) {
  return TASKS.find(task => task.id === taskId) ?? null;
}

function totalProgress(solvedTaskCount, anchorLocked) {
  return solvedTaskCount + Number(anchorLocked);
}

export default class World5Level2 {
  meta = {
    title: PROBLEM?.title ?? 'Min-Max in Your Hands',
    subtitle: PROBLEM?.objective ?? 'Normalize a bounded feature into the 0-1 interval.',
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._events = null;
    this._calculator = null;
    this._rawChart = null;
    this._scaledChart = null;
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
      <section class="w5-level w5-level--minmax-lab screen-section" aria-label="World 5 Level 2">
        <div class="level-hero w5-level__hero" style="--world-color: var(--color-world-5);">
          <p class="eyebrow">World 5 - Scaling</p>
          <h1 class="level-hero__title">${escapeHtml(PROBLEM.title)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(PROBLEM.objective)}
            Stay on one bounded feature, build its min-max formula by hand, then confirm which row becomes the 1.0 anchor after scaling.
          </p>
          <div class="action-row">
            <span class="status-box" id="w5-l2-progress">0 / ${TASKS.length + 1} scaling locks</span>
            <span class="status-box" id="w5-l2-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w5-l2-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w5-l2-reset-btn" type="button">Reset Lab</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">02</span>
        </div>

        <div class="w5-minmax-layout">
          <article class="panel w5-minmax-visual-panel">
            <div class="w5-level__panel-head">
              <div>
                <p class="eyebrow">Normalization Lab</p>
                <h2 class="panel-title">Shrink one bounded feature into a clean 0-1 ladder</h2>
              </div>
              <p class="w5-level__microcopy">
                This time the feature is already bounded and positive, which makes min-max scaling a natural first move. Lock the anchors, compute one interior row, then confirm which row becomes the exact upper endpoint.
              </p>
            </div>

            <div class="w5-minmax-snapshot" aria-label="Min-Max Snapshot">
              <article class="w5-minmax-snapshot__card">
                <span class="w5-minmax-snapshot__label">Raw Min</span>
                <strong class="w5-minmax-snapshot__value" id="w5-l2-min-state" data-state="missing">Pending</strong>
              </article>
              <article class="w5-minmax-snapshot__card">
                <span class="w5-minmax-snapshot__label">Raw Max</span>
                <strong class="w5-minmax-snapshot__value" id="w5-l2-max-state" data-state="missing">Pending</strong>
              </article>
              <article class="w5-minmax-snapshot__card">
                <span class="w5-minmax-snapshot__label">Range</span>
                <strong class="w5-minmax-snapshot__value" id="w5-l2-range-state" data-state="missing">Pending</strong>
              </article>
              <article class="w5-minmax-snapshot__card">
                <span class="w5-minmax-snapshot__label">Row ${TARGET_ROW_NUMBER} Scaled</span>
                <strong class="w5-minmax-snapshot__value" id="w5-l2-target-state" data-state="missing">Pending</strong>
              </article>
            </div>

            <section class="w5-minmax-row-panel">
              <div class="w5-minmax-row-panel__head">
                <div>
                  <p class="eyebrow">Dataset Rows</p>
                  <h3 class="panel-title">${FEATURE_LABEL} is the only feature we scale in this lab</h3>
                </div>
                <p class="w5-minmax-row-panel__copy" id="w5-l2-row-note">
                  The row deck turns interactive after the numeric checkpoints are done. The row with the original max value should eventually become the 1.0 anchor.
                </p>
              </div>

              <div class="w5-minmax-rows" id="w5-l2-row-grid">
                ${ROWS.map(row => `
                  <button
                    class="w5-minmax-row"
                    type="button"
                    data-row-index="${row.index}"
                    data-row-state="locked"
                    aria-label="Row ${row.rowNumber}, purchase count ${row.purchaseCount}"
                  >
                    <div class="w5-minmax-row__meta">
                      <span class="w5-minmax-row__slot">Row ${row.rowNumber}</span>
                      <span class="w5-minmax-row__purchase">${escapeHtml(formatNumber(row.purchaseCount))} purchases</span>
                    </div>
                    <div class="w5-minmax-row__stats">
                      <span>Age ${escapeHtml(formatNumber(row.age))}</span>
                      <span>Salary ${escapeHtml(formatMoney(row.salary))}</span>
                    </div>
                    <p class="w5-minmax-row__scaled" data-row-scaled="${row.index}">Scaled value hidden</p>
                  </button>
                `).join('')}
              </div>
            </section>

            <div class="w5-minmax-formulas" aria-label="Min-Max Formula Board">
              <article class="w5-minmax-formula">
                <span class="w5-minmax-formula__badge">Formula</span>
                <p class="w5-minmax-formula__title">(x - min) / (max - min)</p>
                <p class="w5-minmax-formula__copy">Subtract the lower anchor first so the minimum becomes 0. Then divide by the full feature range so the maximum becomes 1.</p>
              </article>
              <article class="w5-minmax-formula">
                <span class="w5-minmax-formula__badge">Feature</span>
                <p class="w5-minmax-formula__title">${FEATURE_LABEL}</p>
                <p class="w5-minmax-formula__copy">The raw values are ${SORTED_VALUES.join(', ')}. That makes this feature easy to scale by hand before you see the visual reveal.</p>
              </article>
              <article class="w5-minmax-formula">
                <span class="w5-minmax-formula__badge">Target</span>
                <p class="w5-minmax-formula__title">Apply the formula to row ${TARGET_ROW_NUMBER}</p>
                <p class="w5-minmax-formula__copy">Read x from the dataset, then use the anchors you calculated yourself.</p>
              </article>
            </div>

            <div class="w5-minmax-chart-grid">
              <article class="w5-minmax-chart-panel">
                <div class="w5-minmax-chart-panel__head">
                  <div>
                    <p class="eyebrow">Raw Axis</p>
                    <h3 class="panel-title">Original ${FEATURE_LABEL} bars</h3>
                  </div>
                  <p class="w5-minmax-chart-panel__copy">The raw chart keeps the original counts, so the jump from ${MIN_VALUE} to ${MAX_VALUE} stays in the feature's native units.</p>
                </div>
                <div class="w5-minmax-chart-shell" id="w5-l2-raw-chart"></div>
              </article>

              <article class="w5-minmax-chart-panel" id="w5-l2-scaled-panel" hidden>
                <div class="w5-minmax-chart-panel__head">
                  <div>
                    <p class="eyebrow">Scaled Axis</p>
                    <h3 class="panel-title">The same bars after min-max scaling</h3>
                  </div>
                  <p class="w5-minmax-chart-panel__copy" id="w5-l2-scaled-note">
                    The scaled chart reveals itself after you compute row ${TARGET_ROW_NUMBER}. Then the only remaining step is to click the row that lands exactly on 1.
                  </p>
                </div>
                <div class="w5-minmax-chart-shell" id="w5-l2-scaled-chart"></div>
              </article>
            </div>
          </article>

          <div class="w5-minmax-side">
            <article class="panel w5-minmax-calc-panel">
              <div class="w5-level__panel-head">
                <div>
                  <p class="eyebrow">Min-Max Console</p>
                  <h2 class="panel-title">Use Sort for anchors, then lock the numeric checkpoints manually</h2>
                </div>
                <p class="w5-level__microcopy">
                  Sum and Count are still available, but min-max scaling is really about ordered endpoints and the span between them.
                </p>
              </div>

              <div class="w5-minmax-calc-host" id="w5-l2-calculator"></div>
            </article>

            <article class="panel w5-minmax-tracker" aria-label="Min-Max Tracker">
              <div class="w5-level__panel-head">
                <div>
                  <p class="eyebrow">Checkpoint Tracker</p>
                  <h2 class="panel-title">Lock the two anchors, the denominator, one interior row, then the 1.0 endpoint</h2>
                </div>
                <p class="w5-level__microcopy">
                  Each checkpoint stays visible so the formula becomes a full story instead of a memorized shortcut.
                </p>
              </div>

              <div class="w5-minmax-tasklist">
                ${TASKS.map(task => `
                  <form class="w5-minmax-task" data-task-id="${task.id}" data-task-state="pending" novalidate>
                    <div class="w5-minmax-task__meta">
                      <span class="w5-minmax-task__status" data-task-status="${task.id}">Pending</span>
                      <span class="w5-minmax-task__cue">${escapeHtml(task.cue)}</span>
                    </div>
                    <h3 class="w5-minmax-task__title">${escapeHtml(task.label)}</h3>
                    <p class="w5-minmax-task__prompt">${escapeHtml(task.prompt)}</p>
                    <p class="w5-minmax-task__formula">${escapeHtml(task.formula)}</p>

                    <div class="w5-minmax-task__entry">
                      <label class="w5-minmax-task__field">
                        <span class="sr-only">${escapeHtml(task.label)} answer</span>
                        <input
                          class="w5-minmax-input"
                          data-task-input="${task.id}"
                          inputmode="decimal"
                          autocomplete="off"
                          placeholder="Enter value"
                          type="text"
                        >
                      </label>
                      <button class="btn btn--primary" data-task-submit="${task.id}" type="submit">${escapeHtml(task.buttonLabel)}</button>
                    </div>

                    <p class="w5-minmax-task__result" data-task-result="${task.id}">${escapeHtml(task.lockedCopy)}</p>
                  </form>
                `).join('')}

                <article class="w5-minmax-task w5-minmax-task--anchor" id="w5-l2-anchor-task" data-task-state="locked">
                  <div class="w5-minmax-task__meta">
                    <span class="w5-minmax-task__status" id="w5-l2-anchor-status">Locked</span>
                    <span class="w5-minmax-task__cue">1.0 Anchor</span>
                  </div>
                  <h3 class="w5-minmax-task__title">Click the row that becomes exactly 1 after scaling</h3>
                  <p class="w5-minmax-task__prompt" id="w5-l2-anchor-copy">
                    Solve the four numeric checkpoints first. Then use the row deck to click the observation whose original value equals the feature maximum.
                  </p>
                  <p class="w5-minmax-task__formula">max value -> scaled value 1</p>
                </article>
              </div>
            </article>

            <div class="w5-minmax-support">
              <section class="card card--elevated w5-level__feedback" aria-live="polite">
                <p class="eyebrow">Coach Feed</p>
                <p id="w5-l2-feedback-text" class="w5-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
              </section>

              <section class="card w5-level__hint-box" id="w5-l2-hint-box" hidden>
                <p class="eyebrow">Hint</p>
                <p id="w5-l2-hint-text" class="w5-level__hint-copy"></p>
              </section>

              <section class="card w5-minmax-guide">
                <p class="eyebrow">Why Min-Max Helps</p>
                <div class="w5-minmax-guide__steps">
                  <article class="w5-minmax-guide__step">
                    <span class="w5-minmax-guide__badge">1</span>
                    <p>The smallest raw value becomes 0 and the largest raw value becomes 1. Everything else keeps its order in between.</p>
                  </article>
                  <article class="w5-minmax-guide__step">
                    <span class="w5-minmax-guide__badge">2</span>
                    <p>The denominator is not the row count or the sum. It is the full span from the feature minimum to the feature maximum.</p>
                  </article>
                  <article class="w5-minmax-guide__step">
                    <span class="w5-minmax-guide__badge">3</span>
                    <p>Later worlds can compare this normalized feature beside others without letting the original raw units dominate the model.</p>
                  </article>
                </div>
              </section>
            </div>
          </div>
        </div>

        <section class="panel w5-minmax-summary" id="w5-l2-summary" hidden aria-label="Min-Max Summary">
          <div class="w5-level__panel-head">
            <div>
              <p class="eyebrow">Scaling Recap</p>
              <h2 class="panel-title">The raw counts kept their order, but the scale shrank into a clean 0-1 interval</h2>
            </div>
            <p class="w5-level__microcopy">${escapeHtml(SUMMARY_COPY)}</p>
          </div>

          <div class="w5-minmax-summary__grid">
            <article class="w5-minmax-summary__card">
              <p class="w5-minmax-summary__kicker">Anchors</p>
              <h3 class="w5-minmax-summary__title">${formatNumber(MIN_VALUE)} -> 0 and ${formatNumber(MAX_VALUE)} -> 1</h3>
              <p class="w5-minmax-summary__copy">The raw endpoints define the whole normalization ladder. Everything else is measured between those two anchors.</p>
            </article>
            <article class="w5-minmax-summary__card">
              <p class="w5-minmax-summary__kicker">Denominator</p>
              <h3 class="w5-minmax-summary__title">Range = ${formatNumber(RANGE_VALUE)}</h3>
              <p class="w5-minmax-summary__copy">Min-max scaling divides every adjusted value by the full feature span, not by the count of rows and not by the feature sum.</p>
            </article>
            <article class="w5-minmax-summary__card">
              <p class="w5-minmax-summary__kicker">Target Row</p>
              <h3 class="w5-minmax-summary__title">Row ${TARGET_ROW_NUMBER} -> ${formatScaled(TARGET_SCALED_VALUE)}</h3>
              <p class="w5-minmax-summary__copy">The raw value ${formatNumber(TARGET_RAW_VALUE)} sits about a third of the way up the normalized ladder once the min and max anchors are fixed.</p>
            </article>
          </div>

          <div class="action-row">
            <span class="status-box" id="w5-l2-summary-score">Waiting for the full min-max reveal</span>
            <button class="btn btn--primary" id="w5-l2-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w5-l2-progress');
    this._ui.status = container.querySelector('#w5-l2-status');
    this._ui.feedback = container.querySelector('#w5-l2-feedback-text');
    this._ui.hintBox = container.querySelector('#w5-l2-hint-box');
    this._ui.hintText = container.querySelector('#w5-l2-hint-text');
    this._ui.calculatorHost = container.querySelector('#w5-l2-calculator');
    this._ui.rawChartHost = container.querySelector('#w5-l2-raw-chart');
    this._ui.scaledChartHost = container.querySelector('#w5-l2-scaled-chart');
    this._ui.scaledPanel = container.querySelector('#w5-l2-scaled-panel');
    this._ui.scaledNote = container.querySelector('#w5-l2-scaled-note');
    this._ui.rowNote = container.querySelector('#w5-l2-row-note');
    this._ui.minState = container.querySelector('#w5-l2-min-state');
    this._ui.maxState = container.querySelector('#w5-l2-max-state');
    this._ui.rangeState = container.querySelector('#w5-l2-range-state');
    this._ui.targetState = container.querySelector('#w5-l2-target-state');
    this._ui.summary = container.querySelector('#w5-l2-summary');
    this._ui.summaryScore = container.querySelector('#w5-l2-summary-score');
    this._ui.finishButton = container.querySelector('#w5-l2-finish-btn');
    this._ui.rowButtons = Array.from(container.querySelectorAll('[data-row-index]'));
    this._ui.anchorTask = container.querySelector('#w5-l2-anchor-task');
    this._ui.anchorStatus = container.querySelector('#w5-l2-anchor-status');
    this._ui.anchorCopy = container.querySelector('#w5-l2-anchor-copy');

    this._mountCalculator();
    this._mountCharts();
    this._syncTaskUi();
    this._syncProgress();
    this._syncRowUi();
    this._syncSnapshot();
    this._syncScaledReveal();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w5-l2-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w5-l2-reset-btn')) {
        this._resetLab();
        return;
      }

      if (event.target.closest('#w5-l2-finish-btn')) {
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
    return LEVEL_HINTS[hintsUsed - 1] ?? null;
  }

  pause() {}

  resume() {}

  teardown() {
    this._events?.abort();
    this._calculator?.destroy();
    this._rawChart?.destroy();
    this._scaledChart?.destroy();
    this._calculator = null;
    this._rawChart = null;
    this._scaledChart = null;
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
    this._scaledChart?.destroy();

    this._rawChart = new ChartWidget(this._ui.rawChartHost, {
      type: 'bar',
      title: `Raw ${FEATURE_LABEL} values`,
      worldColor: 'var(--color-world-5)',
      minWidth: 520,
      height: 250,
      data: ROWS.map(row => ({
        label: `R${row.rowNumber}`,
        value: row.purchaseCount,
        color: row.index === TARGET_ROW_INDEX
          ? 'var(--color-warning)'
          : row.index === MAX_ROW_INDEX
            ? 'var(--color-success)'
            : 'var(--color-world-5)',
      })),
      valueFormatter: value => formatNumber(value),
      tooltipFormatter: item => {
        const row = rowByIndex(Number(item.label.replace('R', '')) - 1);
        return row
          ? `Row ${row.rowNumber}: ${formatNumber(row.purchaseCount)} purchases`
          : `${item.label}: ${formatNumber(item.value)}`;
      },
      ariaLabel: `Bar chart showing the raw ${FEATURE_LABEL.toLowerCase()} values for rows 1 through 5.`,
    });

    this._scaledChart = new ChartWidget(this._ui.scaledChartHost, {
      type: 'bar',
      title: `Scaled ${FEATURE_LABEL} values`,
      worldColor: 'var(--color-world-5)',
      minWidth: 520,
      height: 250,
      data: ROWS.map(row => ({
        label: `R${row.rowNumber}`,
        value: row.scaledValue,
        color: row.index === TARGET_ROW_INDEX
          ? 'var(--color-warning)'
          : row.index === MAX_ROW_INDEX
            ? 'var(--color-success)'
            : 'var(--color-world-5)',
      })),
      valueFormatter: value => formatScaled(value),
      tooltipFormatter: item => {
        const row = rowByIndex(Number(item.label.replace('R', '')) - 1);
        return row
          ? `Row ${row.rowNumber}: scaled ${formatScaled(row.scaledValue)} from raw ${formatNumber(row.purchaseCount)}`
          : `${item.label}: ${formatScaled(item.value)}`;
      },
      ariaLabel: `Bar chart showing the min-max scaled ${FEATURE_LABEL.toLowerCase()} values for rows 1 through 5.`,
    });
  }

  _handleSpecialAction(payload) {
    if (!payload) return;

    if (payload.action === 'Sort') {
      this._setFeedback(`Sorted ${FEATURE_LABEL.toLowerCase()}: ${SORTED_VALUES.join(', ')}. The first value is the min and the last value is the max.`);
      this._setStatus('Great. Use the ordered list to lock the min and max anchors first.');
      return;
    }

    if (payload.action === 'Count') {
      this._setFeedback(`There are ${FEATURE_VALUES.length} rows, but min-max scaling does not divide by the row count. It divides by max - min.`);
      this._setStatus('Count is a side note here. The real denominator is the feature range.');
      return;
    }

    if (payload.action === 'Sum') {
      const total = FEATURE_VALUES.reduce((sum, value) => sum + value, 0);
      this._setFeedback(`The raw total is ${formatNumber(total)}, but min-max scaling never uses the feature sum. Stay focused on the endpoints and the range instead.`);
      this._setStatus('Min-max uses min, max, and the span between them, not the total.');
    }
  }

  _handleCalculation(payload) {
    if (!payload || typeof payload.result !== 'number' || Number.isNaN(payload.result)) return;

    const signals = [
      ['min', MIN_VALUE, `That calculator result matches the minimum anchor: ${formatNumber(MIN_VALUE)}.`],
      ['max', MAX_VALUE, `That calculator result matches the maximum anchor: ${formatNumber(MAX_VALUE)}.`],
      ['range', RANGE_VALUE, `That result matches the range: ${formatNumber(RANGE_VALUE)}.`],
      ['target', TARGET_SCALED_VALUE, `That result matches row ${TARGET_ROW_NUMBER}'s scaled value: ${formatScaled(TARGET_SCALED_VALUE)}.`],
    ];

    const match = signals.find(([taskId, expected]) =>
      !this._solved.has(taskId) && approxEqual(payload.result, expected, taskById(taskId)?.tolerance ?? 0.01)
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

    if (!approxEqual(numericValue, task.expected, task.tolerance ?? 0.01)) {
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
    this._syncScaledReveal();

    if (this._solved.has('target') && !this._anchorLocked) {
      this._setStatus('All numeric checkpoints are locked. Click the row whose original value equals the feature maximum so it lands on 1.0.');
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

    if (!this._solved.has('target')) {
      this._setFeedback('The row deck becomes gradeable only after the numeric checkpoints are finished. Lock min, max, range, and the target scaled value first.');
      this._setStatus('Finish the four numeric checkpoints before you select the 1.0 anchor row.');
      return;
    }

    if (rowIndex !== MAX_ROW_INDEX) {
      this._engine.mistake({ costsLife: false, countsMistake: true });
      const row = rowByIndex(rowIndex);
      this._setFeedback(`Row ${row?.rowNumber ?? '?'} does not become 1.0. Only the row with the original max value ${formatNumber(MAX_VALUE)} reaches the upper anchor after min-max scaling.`);
      this._flashRow(button, true);
      return;
    }

    this._anchorLocked = true;
    this._completed = true;
    this._engine.correct();
    this._setFeedback(`Correct. Row ${MAX_ROW_INDEX + 1} carries the original maximum ${formatNumber(MAX_VALUE)}, so min-max scaling sends it to exactly 1.`);
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
        input.value = task.id === 'target' ? formatScaled(task.expected) : formatNumber(task.expected);
      } else if (locked) {
        input.value = '';
      }
    });

    if (this._ui.anchorTask && this._ui.anchorStatus && this._ui.anchorCopy) {
      const unlocked = this._solved.has('target');
      this._ui.anchorTask.dataset.taskState = this._anchorLocked ? 'solved' : unlocked ? 'pending' : 'locked';
      this._ui.anchorStatus.textContent = this._anchorLocked ? 'Solved' : unlocked ? 'Active' : 'Locked';
      this._ui.anchorCopy.textContent = this._anchorLocked
        ? `Row ${MAX_ROW_INDEX + 1} becomes 1 because it carries the original maximum ${formatNumber(MAX_VALUE)}.`
        : unlocked
          ? `Click the row with raw ${FEATURE_LABEL.toLowerCase()} = ${formatNumber(MAX_VALUE)}. That is the only observation that should land on 1.0.`
          : 'Solve the four numeric checkpoints first. Then use the row deck to click the observation whose original value equals the feature maximum.';
    }
  }

  _syncProgress() {
    const progress = totalProgress(this._solved.size, this._anchorLocked);

    if (this._ui.progress) {
      this._ui.progress.textContent = `${progress} / ${TASKS.length + 1} scaling locks`;
    }

    if (this._ui.finishButton) {
      this._ui.finishButton.disabled = !this._completed;
    }
  }

  _syncRowUi() {
    const readyToPick = this._solved.has('target');

    this._ui.rowButtons?.forEach(button => {
      const rowIndex = Number(button.dataset.rowIndex);
      const row = rowByIndex(rowIndex);
      const scaledEl = this._container?.querySelector(`[data-row-scaled="${rowIndex}"]`);

      button.classList.remove('is-error');

      if (this._anchorLocked) {
        button.dataset.rowState = rowIndex === MAX_ROW_INDEX ? 'solved' : rowIndex === MIN_ROW_INDEX ? 'anchor-min' : rowIndex === TARGET_ROW_INDEX ? 'target' : 'muted';
      } else if (readyToPick) {
        button.dataset.rowState = rowIndex === TARGET_ROW_INDEX ? 'target' : 'candidate';
      } else if (this._solved.has('min') && rowIndex === MIN_ROW_INDEX) {
        button.dataset.rowState = 'anchor-min';
      } else if (this._solved.has('max') && rowIndex === MAX_ROW_INDEX) {
        button.dataset.rowState = 'anchor-max';
      } else if (this._solved.has('target') && rowIndex === TARGET_ROW_INDEX) {
        button.dataset.rowState = 'target';
      } else {
        button.dataset.rowState = 'locked';
      }

      if (scaledEl) {
        scaledEl.textContent = this._solved.has('target')
          ? `Scaled -> ${formatScaled(row?.scaledValue ?? 0)}`
          : rowIndex === TARGET_ROW_INDEX && this._solved.has('range')
            ? `Target formula ready for row ${TARGET_ROW_NUMBER}`
            : 'Scaled value hidden';
      }
    });

    if (this._ui.rowNote) {
      this._ui.rowNote.textContent = this._anchorLocked
        ? `Row ${MAX_ROW_INDEX + 1} is the 1.0 anchor because its raw ${FEATURE_LABEL.toLowerCase()} equals the maximum ${formatNumber(MAX_VALUE)}.`
        : readyToPick
          ? `The row deck is now live. Click the row with raw ${FEATURE_LABEL.toLowerCase()} = ${formatNumber(MAX_VALUE)} to confirm the 1.0 anchor.`
          : `The row deck turns interactive after the numeric checkpoints are done. The row with the original max value should eventually become the 1.0 anchor.`;
    }
  }

  _syncSnapshot() {
    if (this._ui.minState) {
      this._ui.minState.textContent = this._solved.has('min') ? formatNumber(MIN_VALUE) : 'Pending';
      this._ui.minState.dataset.state = this._solved.has('min') ? 'correct' : 'missing';
    }

    if (this._ui.maxState) {
      this._ui.maxState.textContent = this._solved.has('max') ? formatNumber(MAX_VALUE) : 'Pending';
      this._ui.maxState.dataset.state = this._solved.has('max') ? 'correct' : 'missing';
    }

    if (this._ui.rangeState) {
      this._ui.rangeState.textContent = this._solved.has('range') ? formatNumber(RANGE_VALUE) : 'Pending';
      this._ui.rangeState.dataset.state = this._solved.has('range') ? 'correct' : 'missing';
    }

    if (this._ui.targetState) {
      this._ui.targetState.textContent = this._solved.has('target') ? formatScaled(TARGET_SCALED_VALUE) : 'Pending';
      this._ui.targetState.dataset.state = this._solved.has('target') ? 'correct' : 'missing';
    }
  }

  _syncScaledReveal() {
    if (!this._ui.scaledPanel) return;

    const revealed = this._solved.has('target');
    this._ui.scaledPanel.hidden = !revealed;

    if (this._ui.scaledNote) {
      this._ui.scaledNote.textContent = revealed
        ? `The scaled chart is now live. Row ${TARGET_ROW_NUMBER} sits at ${formatScaled(TARGET_SCALED_VALUE)}, and the final step is confirming which row lands on exactly 1.`
        : `The scaled chart reveals itself after you compute row ${TARGET_ROW_NUMBER}. Then the only remaining step is to click the row that lands exactly on 1.`;
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

    this._container?.querySelectorAll('.w5-minmax-input').forEach(input => {
      input.value = '';
      input.classList.remove('is-error', 'is-solved');
    });

    if (this._ui.summary) {
      this._ui.summary.hidden = true;
      this._ui.summary.classList.remove('is-revealed');
    }

    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = 'Waiting for the full min-max reveal';
    }

    this._mountCalculator();
    this._setFeedback(DEFAULT_FEEDBACK);
    this._setStatus(DEFAULT_STATUS);
    this._syncTaskUi();
    this._syncProgress();
    this._syncRowUi();
    this._syncSnapshot();
    this._syncScaledReveal();
  }

  _revealSummary() {
    if (!this._ui.summary) return;

    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = `${TASKS.length + 1} / ${TASKS.length + 1} scaling locks`;
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
