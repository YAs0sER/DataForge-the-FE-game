'use strict';

import { DataFrame } from '../../pandas/dataframe.js';
import { createDataset, DATASET_KEYS } from '../../data/datasets.js';
import { getLevelProblem } from '../../data/problems.js';
import { ChartWidget } from '../../widgets/charts.js';

const PROBLEM = getLevelProblem(3, 1);

function createFallbackDataset() {
  return DataFrame.fromRows([
    { Analyst_ID: 1, Salary: 2000 },
    { Analyst_ID: 2, Salary: 2100 },
    { Analyst_ID: 3, Salary: 2200 },
    { Analyst_ID: 4, Salary: 2300 },
    { Analyst_ID: 5, Salary: 2400 },
    { Analyst_ID: 6, Salary: 2450 },
    { Analyst_ID: 7, Salary: 2500 },
    { Analyst_ID: 8, Salary: 2500 },
    { Analyst_ID: 9, Salary: 2550 },
    { Analyst_ID: 10, Salary: 2600 },
    { Analyst_ID: 11, Salary: 2700 },
    { Analyst_ID: 12, Salary: 2800 },
    { Analyst_ID: 13, Salary: 2900 },
    { Analyst_ID: 14, Salary: 3000 },
    { Analyst_ID: 15, Salary: 100000 },
  ]);
}

function createLevelDataset() {
  try {
    return createDataset(PROBLEM?.datasetKey ?? DATASET_KEYS.OUTLIER_VISUAL);
  } catch {
    return createFallbackDataset();
  }
}

const DATASET = createLevelDataset();
const SALARY_COLUMN = 'Salary';
const SALARY_VALUES = DATASET.col(SALARY_COLUMN).values.filter(value => typeof value === 'number' && Number.isFinite(value));
const UNIQUE_VALUES = [...new Set(SALARY_VALUES)].sort((a, b) => a - b);
const OUTLIER_VALUE = Math.max(...SALARY_VALUES);
const OUTLIER_INDEX = SALARY_VALUES.indexOf(OUTLIER_VALUE);
const NORMAL_VALUES = SALARY_VALUES.filter((_, index) => index !== OUTLIER_INDEX);
const NORMAL_MIN = Math.min(...NORMAL_VALUES);
const NORMAL_MAX = Math.max(...NORMAL_VALUES);
const NORMAL_MEAN = NORMAL_VALUES.reduce((sum, value) => sum + value, 0) / NORMAL_VALUES.length;
const OUTLIER_GAP = OUTLIER_VALUE - NORMAL_MAX;
const OUTLIER_RATIO = OUTLIER_VALUE / NORMAL_MEAN;
const TICK_VALUES = [NORMAL_MIN, NORMAL_MEAN, NORMAL_MAX, OUTLIER_VALUE];

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM?.hints ?? []),
  'Look for the point separated from the cluster by the largest empty stretch on the axis.',
  'Your bracket is correct only when the whole salary cluster stays inside and the far-right salary is the only point left outside.',
]);

const DEFAULT_FEEDBACK = 'Start by clicking the single salary point that looks visually detached from the main cluster.';
const DEFAULT_STATUS = 'Stage 1 of 2: spot the rogue point. The range selector unlocks after the outlier is identified.';
const SUMMARY_COPY = 'Outlier detection starts with shape and distance. The next level adds the IQR formula on top of the visual instinct you just built.';

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

function formatRatio(value) {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}x`;
}

function taskCount(spotted, rangeSolved) {
  return Number(spotted) + Number(rangeSolved);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default class World3Level1 {
  meta = {
    title: PROBLEM?.title ?? 'See the Outlier',
    subtitle: PROBLEM?.objective ?? 'Spot the rogue point visually before formulas enter the scene.',
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._events = null;
    this._chart = null;
    this._spotted = false;
    this._rangeSolved = false;
    this._completed = false;
    this._range = {
      lowerIndex: 0,
      upperIndex: UNIQUE_VALUES.length - 1,
    };
    this._ui = {};
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w3-level w3-level--outlier-spotter screen-section" aria-label="World 3 Level 1">
        <div class="level-hero w3-level__hero" style="--world-color: var(--color-world-3);">
          <p class="eyebrow">World 3 - Outliers</p>
          <h1 class="level-hero__title">${escapeHtml(PROBLEM.title)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(PROBLEM.objective)}
            No formulas yet. This lab is about seeing isolation, then drawing the boundary that leaves the rogue point outside.
          </p>
          <div class="action-row">
            <span class="status-box" id="w3-l1-progress">0 / 2 intuition steps locked</span>
            <span class="status-box" id="w3-l1-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w3-l1-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w3-l1-reset-btn" type="button">Reset Lab</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">01</span>
        </div>

        <div class="w3-outlier-grid">
          <article class="panel w3-outlier-chart-panel">
            <div class="w3-level__panel-head">
              <div>
                <p class="eyebrow">Visual Lab</p>
                <h2 class="panel-title">A tight salary cluster with one value far beyond the rest</h2>
              </div>
              <p class="w3-level__microcopy">
                Hover points for exact salaries. The axis is spaced to keep isolation readable, so this stage rewards visual pattern recognition over arithmetic.
              </p>
            </div>

            <div class="w3-outlier-snapshot" aria-label="Visual Snapshot">
              <article class="w3-outlier-snapshot__card">
                <span class="w3-outlier-snapshot__label">Cluster Average</span>
                <strong class="w3-outlier-snapshot__value">${escapeHtml(formatMoney(NORMAL_MEAN))}</strong>
              </article>
              <article class="w3-outlier-snapshot__card">
                <span class="w3-outlier-snapshot__label">Rogue Point</span>
                <strong class="w3-outlier-snapshot__value" id="w3-l1-rogue-value" data-tone="danger">Hidden</strong>
              </article>
              <article class="w3-outlier-snapshot__card">
                <span class="w3-outlier-snapshot__label">Current Bracket</span>
                <strong class="w3-outlier-snapshot__value" id="w3-l1-bracket-value">Full Range</strong>
              </article>
            </div>

            <div class="w3-outlier-chart-shell" id="w3-l1-chart"></div>

            <section class="w3-outlier-callout" id="w3-l1-callout" hidden aria-live="polite">
              <div class="w3-outlier-callout__meta">
                <span class="w3-outlier-callout__pill">Rogue Point Found</span>
                <span class="w3-outlier-callout__pill">${escapeHtml(formatMoney(OUTLIER_VALUE))}</span>
              </div>
              <h3 class="w3-outlier-callout__title">That salary sits ${escapeHtml(formatRatio(OUTLIER_RATIO))} above the cluster average.</h3>
              <p class="w3-outlier-callout__copy">
                The main cluster averages ${escapeHtml(formatMoney(NORMAL_MEAN))}, tops out near ${escapeHtml(formatMoney(NORMAL_MAX))}, and then leaves a ${escapeHtml(formatMoney(OUTLIER_GAP))} jump before the rogue point.
              </p>
            </section>

            <section class="card w3-range-panel" id="w3-l1-range-panel" data-range-state="locked">
              <div class="w3-range-panel__head">
                <div>
                  <p class="eyebrow">Range Selector</p>
                  <h3 class="panel-title">Bracket where the normal salaries live</h3>
                </div>
                <p class="w3-range-panel__selection" id="w3-l1-range-label">Locked until the outlier is spotted</p>
              </div>

              <div class="w3-range-shell" id="w3-l1-range-shell">
                <div class="w3-range-track" aria-hidden="true"></div>
                <div class="w3-range-active" id="w3-l1-range-active" aria-hidden="true"></div>
                <input
                  class="w3-range-input w3-range-input--lower"
                  id="w3-l1-lower"
                  type="range"
                  min="0"
                  max="${UNIQUE_VALUES.length - 1}"
                  step="1"
                  value="0"
                  aria-label="Lower bracket handle"
                >
                <input
                  class="w3-range-input w3-range-input--upper"
                  id="w3-l1-upper"
                  type="range"
                  min="0"
                  max="${UNIQUE_VALUES.length - 1}"
                  step="1"
                  value="${UNIQUE_VALUES.length - 1}"
                  aria-label="Upper bracket handle"
                >
              </div>

              <div class="w3-range-ticks" aria-hidden="true">
                ${TICK_VALUES.map(value => `<span class="w3-range-tick">${escapeHtml(formatMoney(value))}</span>`).join('')}
              </div>

              <div class="w3-range-controls" aria-label="Bracket step controls">
                <div class="w3-range-stepper">
                  <span class="w3-range-stepper__label">Lower Bound</span>
                  <div class="w3-range-stepper__actions">
                    <button class="btn btn--subtle btn--sm" type="button" data-range-step="lower:-1">-</button>
                    <button class="btn btn--subtle btn--sm" type="button" data-range-step="lower:1">+</button>
                  </div>
                </div>
                <div class="w3-range-stepper">
                  <span class="w3-range-stepper__label">Upper Bound</span>
                  <div class="w3-range-stepper__actions">
                    <button class="btn btn--subtle btn--sm" type="button" data-range-step="upper:-1">-</button>
                    <button class="btn btn--subtle btn--sm" type="button" data-range-step="upper:1">+</button>
                  </div>
                </div>
              </div>

              <div class="w3-range-cta">
                <p class="w3-range-note" id="w3-l1-range-note">
                  Find the isolated point first, then drag the handles so only that far-right salary sits outside the bracket.
                </p>
                <button class="btn btn--primary" id="w3-l1-confirm-btn" type="button" disabled>Confirm Normal Range</button>
              </div>
            </section>
          </article>

          <div class="w3-outlier-side">
            <section class="panel w3-outlier-tracker" aria-label="Mission Tracker">
              <div class="w3-level__panel-head">
                <div>
                  <p class="eyebrow">Mission Tracker</p>
                  <h2 class="panel-title">Lock the visual intuition before the formulas arrive</h2>
                </div>
                <p class="w3-level__microcopy">
                  The first step is point selection. The second step is drawing a range that keeps the full cluster together.
                </p>
              </div>

              <div class="w3-outlier-tracker__list">
                <article class="w3-outlier-task" id="w3-l1-task-spot" data-task-state="active">
                  <div class="w3-outlier-task__meta">
                    <span class="w3-outlier-task__status" id="w3-l1-task-spot-status">Active</span>
                    <span class="w3-outlier-task__cue">Step 1</span>
                  </div>
                  <h3 class="w3-outlier-task__title">Spot the rogue point</h3>
                  <p class="w3-outlier-task__copy" id="w3-l1-task-spot-copy">
                    Click the one salary that looks detached from the main group.
                  </p>
                </article>

                <article class="w3-outlier-task" id="w3-l1-task-range" data-task-state="locked">
                  <div class="w3-outlier-task__meta">
                    <span class="w3-outlier-task__status" id="w3-l1-task-range-status">Locked</span>
                    <span class="w3-outlier-task__cue">Step 2</span>
                  </div>
                  <h3 class="w3-outlier-task__title">Bracket the normal range</h3>
                  <p class="w3-outlier-task__copy" id="w3-l1-task-range-copy">
                    Keep the whole cluster inside the bracket and leave only the rogue point outside.
                  </p>
                </article>
              </div>
            </section>

            <section class="card card--elevated w3-level__feedback" aria-live="polite">
              <p class="eyebrow">Coach Feed</p>
              <p id="w3-l1-feedback-text" class="w3-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
            </section>

            <section class="card w3-level__hint-box" id="w3-l1-hint-box" hidden>
              <p class="eyebrow">Hint</p>
              <p id="w3-l1-hint-text" class="w3-level__hint-copy"></p>
            </section>

            <section class="card w3-outlier-guide">
              <p class="eyebrow">What To Watch</p>
              <div class="w3-outlier-guide__steps">
                <article class="w3-outlier-guide__step">
                  <span class="w3-outlier-guide__badge">1</span>
                  <p class="w3-outlier-guide__copy">Isolation matters more than raw size. The outlier is the point with the biggest empty space around it.</p>
                </article>
                <article class="w3-outlier-guide__step">
                  <span class="w3-outlier-guide__badge">2</span>
                  <p class="w3-outlier-guide__copy">A healthy bracket keeps the cluster intact. If a normal point gets pushed outside, the range is still too narrow.</p>
                </article>
              </div>
            </section>
          </div>
        </div>

        <section class="panel w3-outlier-summary" id="w3-l1-summary" hidden aria-label="Outlier Summary">
          <div class="w3-level__panel-head">
            <div>
              <p class="eyebrow">Outlier Recap</p>
              <h2 class="panel-title">You identified the isolated point and defended the normal cluster</h2>
            </div>
            <p class="w3-level__microcopy">${escapeHtml(SUMMARY_COPY)}</p>
          </div>

          <div class="w3-outlier-summary__grid">
            <article class="w3-outlier-summary__card" style="--topic-color: var(--color-world-3);">
              <p class="w3-outlier-summary__kicker">Visual Rule</p>
              <div class="w3-outlier-summary__meta">
                <span class="w3-outlier-summary__state">Locked In</span>
                <span class="w3-outlier-summary__topic">Isolation</span>
              </div>
              <h3 class="w3-outlier-summary__title">Outliers are about separation</h3>
              <p class="w3-outlier-summary__copy">The rogue point stood out because the cluster ended and a large empty gap began before that last salary appeared.</p>
            </article>

            <article class="w3-outlier-summary__card" style="--topic-color: var(--color-world-1);">
              <p class="w3-outlier-summary__kicker">Bracket Intuition</p>
              <div class="w3-outlier-summary__meta">
                <span class="w3-outlier-summary__state">Locked In</span>
                <span class="w3-outlier-summary__topic">Normal Range</span>
              </div>
              <h3 class="w3-outlier-summary__title">Keep the cluster, reject the rogue point</h3>
              <p class="w3-outlier-summary__copy">A useful range keeps ordinary salaries together and leaves only the abnormal point outside the boundary.</p>
            </article>

            <article class="w3-outlier-summary__card" style="--topic-color: var(--color-warning);">
              <p class="w3-outlier-summary__kicker">Next Up</p>
              <div class="w3-outlier-summary__meta">
                <span class="w3-outlier-summary__state">Next Level</span>
                <span class="w3-outlier-summary__topic">IQR</span>
              </div>
              <h3 class="w3-outlier-summary__title">Now formalize the fence</h3>
              <p class="w3-outlier-summary__copy">The next level turns this intuition into Q1, Q3, IQR, and the lower and upper fences that detect the same rogue point mathematically.</p>
            </article>
          </div>

          <div class="action-row">
            <span class="status-box">2 / 2 intuition steps locked</span>
            <button class="btn btn--primary" id="w3-l1-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w3-l1-progress');
    this._ui.status = container.querySelector('#w3-l1-status');
    this._ui.feedback = container.querySelector('#w3-l1-feedback-text');
    this._ui.hintBox = container.querySelector('#w3-l1-hint-box');
    this._ui.hintText = container.querySelector('#w3-l1-hint-text');
    this._ui.chartHost = container.querySelector('#w3-l1-chart');
    this._ui.callout = container.querySelector('#w3-l1-callout');
    this._ui.rangePanel = container.querySelector('#w3-l1-range-panel');
    this._ui.rangeShell = container.querySelector('#w3-l1-range-shell');
    this._ui.rangeActive = container.querySelector('#w3-l1-range-active');
    this._ui.rangeLabel = container.querySelector('#w3-l1-range-label');
    this._ui.rangeNote = container.querySelector('#w3-l1-range-note');
    this._ui.rangeStepButtons = [...container.querySelectorAll('[data-range-step]')];
    this._ui.lowerInput = container.querySelector('#w3-l1-lower');
    this._ui.upperInput = container.querySelector('#w3-l1-upper');
    this._ui.confirmButton = container.querySelector('#w3-l1-confirm-btn');
    this._ui.rogueValue = container.querySelector('#w3-l1-rogue-value');
    this._ui.bracketValue = container.querySelector('#w3-l1-bracket-value');
    this._ui.summary = container.querySelector('#w3-l1-summary');
    this._ui.finishButton = container.querySelector('#w3-l1-finish-btn');
    this._ui.taskSpot = container.querySelector('#w3-l1-task-spot');
    this._ui.taskSpotStatus = container.querySelector('#w3-l1-task-spot-status');
    this._ui.taskSpotCopy = container.querySelector('#w3-l1-task-spot-copy');
    this._ui.taskRange = container.querySelector('#w3-l1-task-range');
    this._ui.taskRangeStatus = container.querySelector('#w3-l1-task-range-status');
    this._ui.taskRangeCopy = container.querySelector('#w3-l1-task-range-copy');

    this._mountChart();
    this._syncProgress();
    this._syncTasks();
    this._syncRangeUI();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w3-l1-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w3-l1-reset-btn')) {
        this._resetLab();
        return;
      }

      if (event.target.closest('#w3-l1-confirm-btn')) {
        this._confirmRange();
        return;
      }

      const stepButton = event.target.closest('[data-range-step]');
      if (stepButton) {
        const [which, delta] = String(stepButton.dataset.rangeStep ?? '').split(':');
        this._stepRange(which, Number(delta));
        return;
      }

      if (event.target.closest('#w3-l1-finish-btn')) {
        if (this._completed) {
          void this._engine.complete();
        }
      }
    }, { signal });

    this._container?.addEventListener('input', event => {
      if (event.target === this._ui.lowerInput) {
        this._updateRange('lower', Number(this._ui.lowerInput.value));
      }

      if (event.target === this._ui.upperInput) {
        this._updateRange('upper', Number(this._ui.upperInput.value));
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
    this._chart?.destroy();
    this._chart = null;
    this._ui = {};
  }

  _mountChart() {
    const band = this._rangeSolved
      ? {
          from: this._selectedLowerValue(),
          to: this._selectedUpperValue(),
          label: 'Normal range',
          tone: 'var(--color-world-1)',
          opacity: 0.14,
        }
      : null;

    const markers = [];
    if (this._spotted) {
      markers.push({
        value: OUTLIER_VALUE,
        label: formatMoney(OUTLIER_VALUE),
        tone: 'var(--color-danger)',
      });
    }

    if (this._rangeSolved) {
      markers.unshift(
        {
          value: this._selectedLowerValue(),
          label: formatMoney(this._selectedLowerValue()),
          tone: 'var(--color-world-1)',
        },
        {
          value: this._selectedUpperValue(),
          label: formatMoney(this._selectedUpperValue()),
          tone: 'var(--color-world-1)',
        }
      );
    }

    const connectors = this._spotted
      ? [{
          from: NORMAL_MAX,
          to: OUTLIER_VALUE,
          label: `${formatMoney(OUTLIER_GAP)} jump`,
          tone: 'var(--color-danger)',
        }]
      : [];

    const chartData = SALARY_VALUES.map((value, index) => {
      const isOutlier = index === OUTLIER_INDEX;
      const spottedOutlier = isOutlier && this._spotted;

      return {
        value,
        color: spottedOutlier ? 'var(--color-danger)' : 'var(--color-world-1)',
        state: spottedOutlier ? (this._rangeSolved ? 'danger' : 'selected') : 'default',
        tooltip: `Salary: ${formatMoney(value)}`,
        meta: { isOutlier },
        ariaLabel: isOutlier && spottedOutlier
          ? `Outlier salary ${formatMoney(value)}`
          : `Salary ${formatMoney(value)}`,
      };
    });

    if (!this._chart) {
      this._chart = new ChartWidget(this._ui.chartHost, {
        type: 'dotplot',
        title: 'Salary Dot Plot',
        data: chartData,
        worldColor: 'var(--color-world-3)',
        height: 340,
        minWidth: 880,
        showGrid: true,
        scaleMode: 'distribution',
        tickValues: TICK_VALUES,
        valueFormatter: formatMoney,
        band,
        markers,
        connectors,
        ariaLabel: 'Dot plot of salaries with one isolated outlier on the far right.',
        onPointClick: detail => this._handlePointClick(detail),
      });
      return;
    }

    this._chart.update({
      data: chartData,
      band,
      markers,
      connectors,
    });
  }

  _handlePointClick(detail) {
    if (detail.index === OUTLIER_INDEX) {
      if (!this._spotted) {
        this._spotted = true;
        this._engine.correct();
        this._setFeedback(`Correct. ${formatMoney(OUTLIER_VALUE)} is visually detached from the rest of the salary cluster.`);
        this._setStatus('Outlier identified. Stage 2 is now active: bracket the normal range so only that rogue point stays outside.');
      } else {
        this._setFeedback(`Yes, ${formatMoney(OUTLIER_VALUE)} is still the rogue point. Now use the bracket to defend the normal salary range.`);
      }

      this._syncProgress();
      this._syncTasks();
      this._syncRangeUI();
      this._mountChart();
      return;
    }

    if (this._rangeSolved) {
      this._setFeedback('The outlier is already locked in. Use Continue when you are ready for the IQR method.');
      return;
    }

    this._engine.mistake({ costsLife: false, countsMistake: true });
    this._setFeedback(`${formatMoney(detail.value)} still lives inside the main cluster. Look for the point separated by the largest empty stretch on the axis.`);
    this._setStatus(this._spotted
      ? 'The rogue point is already found. Keep moving the bracket until only that far-right salary sits outside.'
      : 'Stage 1 still active. Find the single detached point before the range selector unlocks.'
    );
  }

  _updateRange(which, rawIndex) {
    if (!this._spotted || this._rangeSolved) return;

    if (which === 'lower') {
      this._range.lowerIndex = clamp(rawIndex, 0, this._range.upperIndex - 1);
    } else {
      this._range.upperIndex = clamp(rawIndex, this._range.lowerIndex + 1, UNIQUE_VALUES.length - 1);
    }

    if (this._ui.lowerInput) {
      this._ui.lowerInput.value = String(this._range.lowerIndex);
    }

    if (this._ui.upperInput) {
      this._ui.upperInput.value = String(this._range.upperIndex);
    }

    this._syncRangeUI();
  }

  _stepRange(which, delta) {
    if (!this._spotted || this._rangeSolved || !Number.isFinite(delta)) return;

    if (which === 'lower') {
      this._updateRange('lower', this._range.lowerIndex + delta);
      return;
    }

    if (which === 'upper') {
      this._updateRange('upper', this._range.upperIndex + delta);
    }
  }

  _confirmRange() {
    if (!this._spotted || this._rangeSolved) return;

    this._syncRangeFromInputs();

    const lower = this._selectedLowerValue();
    const upper = this._selectedUpperValue();
    const outsideIndices = SALARY_VALUES
      .map((value, index) => (value < lower || value > upper ? index : -1))
      .filter(index => index >= 0);

    const correct = outsideIndices.length === 1 && outsideIndices[0] === OUTLIER_INDEX;

    if (!correct) {
      this._engine.mistake({ costsLife: false, countsMistake: true });
      this._setFeedback('That bracket still cuts into the cluster or leaves the rogue point inside. Adjust it until only the far-right salary sits outside the range.');
      this._setStatus('Range not locked. Keep the whole cluster together, then confirm again.');
      return;
    }

    this._rangeSolved = true;
    this._completed = true;
    this._engine.correct();
    this._setFeedback(`Locked in. ${formatMoney(lower)} to ${formatMoney(upper)} keeps the normal salary cluster intact and leaves ${formatMoney(OUTLIER_VALUE)} outside.`);
    this._setStatus('Both intuition steps are complete. Review the recap below, then continue to the IQR method.');
    this._syncProgress();
    this._syncTasks();
    this._syncRangeUI();
    this._mountChart();
    this._revealSummary();
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
    this._spotted = false;
    this._rangeSolved = false;
    this._completed = false;
    this._range.lowerIndex = 0;
    this._range.upperIndex = UNIQUE_VALUES.length - 1;

    if (this._ui.summary) {
      this._ui.summary.hidden = true;
      this._ui.summary.classList.remove('is-revealed');
    }

    this._setFeedback(DEFAULT_FEEDBACK);
    this._setStatus(DEFAULT_STATUS);
    this._syncProgress();
    this._syncTasks();
    this._syncRangeUI();
    this._mountChart();
  }

  _revealSummary() {
    if (!this._ui.summary) return;

    this._ui.summary.hidden = false;
    requestAnimationFrame(() => {
      this._ui.summary.classList.add('is-revealed');
    });
    this._ui.summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  _selectedLowerValue() {
    return UNIQUE_VALUES[this._range.lowerIndex];
  }

  _selectedUpperValue() {
    return UNIQUE_VALUES[this._range.upperIndex];
  }

  _syncProgress() {
    const completedTasks = taskCount(this._spotted, this._rangeSolved);

    if (this._ui.progress) {
      this._ui.progress.textContent = `${completedTasks} / 2 intuition steps locked`;
    }

    if (this._ui.finishButton) {
      this._ui.finishButton.disabled = !this._completed;
    }
  }

  _syncTasks() {
    if (this._ui.taskSpot) {
      this._ui.taskSpot.dataset.taskState = this._spotted ? 'solved' : 'active';
    }

    if (this._ui.taskSpotStatus) {
      this._ui.taskSpotStatus.textContent = this._spotted ? 'Locked In' : 'Active';
    }

    if (this._ui.taskSpotCopy) {
      this._ui.taskSpotCopy.textContent = this._spotted
        ? `${formatMoney(OUTLIER_VALUE)} is confirmed as the rogue point.`
        : 'Click the one salary point that looks detached from the main group.';
    }

    if (this._ui.taskRange) {
      this._ui.taskRange.dataset.taskState = !this._spotted ? 'locked' : this._rangeSolved ? 'solved' : 'active';
    }

    if (this._ui.taskRangeStatus) {
      this._ui.taskRangeStatus.textContent = !this._spotted ? 'Locked' : this._rangeSolved ? 'Locked In' : 'Active';
    }

    if (this._ui.taskRangeCopy) {
      this._ui.taskRangeCopy.textContent = !this._spotted
        ? 'Find the rogue point first to unlock the bracket controls.'
        : this._rangeSolved
          ? `The normal range is locked at ${formatMoney(this._selectedLowerValue())} to ${formatMoney(this._selectedUpperValue())}.`
          : 'Keep the full salary cluster inside the bracket and leave only the rogue point outside.';
    }
  }

  _syncRangeUI() {
    const lower = this._selectedLowerValue();
    const upper = this._selectedUpperValue();
    const startRatio = this._range.lowerIndex / Math.max(UNIQUE_VALUES.length - 1, 1);
    const endRatio = this._range.upperIndex / Math.max(UNIQUE_VALUES.length - 1, 1);

    if (this._ui.rangeShell) {
      this._ui.rangeShell.style.setProperty('--range-start', String(startRatio));
      this._ui.rangeShell.style.setProperty('--range-width', String(endRatio - startRatio));
    }

    if (this._ui.lowerInput) {
      this._ui.lowerInput.disabled = !this._spotted || this._rangeSolved;
      this._ui.lowerInput.value = String(this._range.lowerIndex);
    }

    if (this._ui.upperInput) {
      this._ui.upperInput.disabled = !this._spotted || this._rangeSolved;
      this._ui.upperInput.value = String(this._range.upperIndex);
    }

    if (this._ui.confirmButton) {
      this._ui.confirmButton.disabled = !this._spotted || this._rangeSolved;
    }

    this._ui.rangeStepButtons?.forEach(button => {
      button.disabled = !this._spotted || this._rangeSolved;
    });

    if (this._ui.rangePanel) {
      this._ui.rangePanel.dataset.rangeState = !this._spotted ? 'locked' : this._rangeSolved ? 'solved' : 'active';
    }

    if (this._ui.rangeLabel) {
      this._ui.rangeLabel.textContent = !this._spotted
        ? 'Locked until the outlier is spotted'
        : this._rangeSolved
          ? `Normal range confirmed: ${formatMoney(lower)} -> ${formatMoney(upper)}`
          : `${formatMoney(lower)} -> ${formatMoney(upper)}`;
    }

    if (this._ui.rangeNote) {
      this._ui.rangeNote.textContent = !this._spotted
        ? 'Find the isolated point first, then drag the handles so only that far-right salary sits outside the bracket.'
        : this._rangeSolved
          ? `${formatMoney(OUTLIER_VALUE)} is the only point outside the confirmed bracket.`
          : 'Keep the full cluster inside the bracket and leave only the rogue salary outside before you confirm.';
    }

    if (this._ui.rogueValue) {
      this._ui.rogueValue.textContent = this._spotted ? formatMoney(OUTLIER_VALUE) : 'Hidden';
    }

    if (this._ui.bracketValue) {
      this._ui.bracketValue.textContent = !this._spotted
        ? 'Full Range'
        : `${formatMoney(lower)} -> ${formatMoney(upper)}`;
    }

    if (this._ui.callout) {
      this._ui.callout.hidden = !this._spotted;
    }
  }

  _syncRangeFromInputs() {
    if (this._ui.lowerInput) {
      this._range.lowerIndex = clamp(Number(this._ui.lowerInput.value), 0, UNIQUE_VALUES.length - 2);
    }

    if (this._ui.upperInput) {
      this._range.upperIndex = clamp(Number(this._ui.upperInput.value), this._range.lowerIndex + 1, UNIQUE_VALUES.length - 1);
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
