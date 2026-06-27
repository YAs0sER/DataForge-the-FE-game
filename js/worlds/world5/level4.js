'use strict';

import { getLevelProblem } from '../../data/problems.js';
import { DataFrame } from '../../pandas/dataframe.js';
import { log1p } from '../../pandas/operations.js';
import { ChartWidget } from '../../widgets/charts.js';

const PROBLEM = getLevelProblem(5, 4);
const LEVEL_TITLE = PROBLEM?.title ?? 'Log Transform - Taming the Skew';
const LEVEL_OBJECTIVE = PROBLEM?.objective ?? 'Compress a heavy right tail with log(x + 1).';

function createLevelDataset() {
  return DataFrame.fromRows([
    { Campaign: 'R1', Referral_Clicks: 0 },
    { Campaign: 'R2', Referral_Clicks: 1 },
    { Campaign: 'R3', Referral_Clicks: 2 },
    { Campaign: 'R4', Referral_Clicks: 3 },
    { Campaign: 'R5', Referral_Clicks: 6 },
    { Campaign: 'R6', Referral_Clicks: 12 },
    { Campaign: 'R7', Referral_Clicks: 28 },
    { Campaign: 'R8', Referral_Clicks: 80 },
  ]);
}

const BASE_DF = createLevelDataset();
const FEATURE_COL = 'Referral_Clicks';
const FEATURE_LABEL = 'Referral Clicks';
const LOG_DF = log1p(BASE_DF, FEATURE_COL);
const RAW_VALUES = BASE_DF.col(FEATURE_COL).values.filter(value => typeof value === 'number' && Number.isFinite(value));
const LOG_VALUES = LOG_DF.col(FEATURE_COL).values.filter(value => typeof value === 'number' && Number.isFinite(value));
const MAX_VALUE = Math.max(...RAW_VALUES);
const SPIKE_ROW_INDEX = RAW_VALUES.lastIndexOf(MAX_VALUE);
const ZERO_ROW_INDEX = RAW_VALUES.indexOf(0);
const SECOND_HIGHEST_VALUE = [...RAW_VALUES].sort((a, b) => a - b).at(-2);
const SECOND_HIGHEST_LOG = [...LOG_VALUES].sort((a, b) => a - b).at(-2);
const RAW_TOP_GAP = MAX_VALUE - SECOND_HIGHEST_VALUE;
const LOG_MAX_VALUE = Math.max(...LOG_VALUES);
const LOG_TOP_GAP = LOG_MAX_VALUE - SECOND_HIGHEST_LOG;
const SPIKE_LOG_VALUE = LOG_VALUES[SPIKE_ROW_INDEX];
const ROWS = Object.freeze(
  BASE_DF.toRows().map((row, index) => Object.freeze({
    index,
    rowNumber: index + 1,
    label: row.Campaign,
    rawValue: row[FEATURE_COL],
    logValue: LOG_DF.toRows()[index][FEATURE_COL],
  }))
);

const TOTAL_LOCKS = 4;
const CORRECT_TRANSFORM_ID = 'log1p';
const CORRECT_INSIGHT_ID = 'compress';

const TRANSFORM_OPTIONS = Object.freeze([
  Object.freeze({
    id: 'minmax',
    label: 'Min-Max',
    formula: '(x - min) / (max - min)',
    copy: 'Useful for bounded scaling, but it does not specifically compress a valid long right tail.',
    retry: 'Min-max rescales the feature, but it is not the tail-compression move this skew problem is asking for.',
  }),
  Object.freeze({
    id: 'zscore',
    label: 'Z Score',
    formula: '(x - mean) / sigma',
    copy: 'Useful for centered standardization, but it does not directly tame multiplicative skew across the whole tail.',
    retry: 'Z-score standardization changes center and spread. This level wants the transform that squeezes the high-end tail itself.',
  }),
  Object.freeze({
    id: 'log1p',
    label: 'Log(x + 1)',
    formula: 'log(x + 1)',
    copy: 'Compresses large positive counts much more than small ones while keeping true zero values valid.',
    success: 'Exactly. `log(x + 1)` shrinks the heavy tail, keeps every row, and still behaves safely when some campaigns really have zero clicks.',
  }),
]);

const INSIGHT_OPTIONS = Object.freeze([
  Object.freeze({
    id: 'compress',
    label: 'High-end gaps shrink the most',
    copy: `The top gap falls from ${formatWhole(RAW_TOP_GAP)} raw clicks to about ${formatLogValue(LOG_TOP_GAP)} log units, so the right tail compresses without deleting rows.`,
    success: 'Correct. Log transform leaves the row order alone, but it squeezes the biggest raw gaps much harder than the tiny ones near zero.',
    retry: 'That misses the main point. The right answer should explain why the tail compresses while the ranking of rows still stays intact.',
  }),
  Object.freeze({
    id: 'equal',
    label: 'Every gap becomes equal',
    copy: 'After the transform, every neighboring difference becomes the same size.',
    retry: 'Not quite. Log transform is nonlinear, so it definitely does not make every gap identical.',
  }),
  Object.freeze({
    id: 'reverse',
    label: 'The order of rows flips',
    copy: 'The smallest campaigns leap ahead of the largest ones after the transform.',
    retry: 'No. `log(x + 1)` preserves order for non-negative values. Big rows stay big, but their lead shrinks.',
  }),
]);

const TRACKER_STEPS = Object.freeze([
  Object.freeze({
    id: 'tail',
    label: 'Find the raw spike that creates the heavy right tail',
    chapter: 'Skew Scan',
    recap: `Row ${SPIKE_ROW_INDEX + 1} reaches ${formatWhole(MAX_VALUE)} clicks, which stretches the raw axis far away from the rest of the feature.`,
  }),
  Object.freeze({
    id: 'formula',
    label: 'Choose the transform that compresses the full tail',
    chapter: 'Transform Choice',
    recap: '`log(x + 1)` is the tail-compression move here because the problem is a valid skewed feature, not a broken row.',
  }),
  Object.freeze({
    id: 'zero',
    label: 'Confirm that a true zero stays safe under log1p',
    chapter: 'Zero Safety',
    recap: `Row ${ZERO_ROW_INDEX + 1} starts at 0 and stays at 0, which is why the +1 matters for count features with real zeros.`,
  }),
  Object.freeze({
    id: 'insight',
    label: 'Lock the explanation for what the compressed tail means',
    chapter: 'Compression Insight',
    recap: `The top raw gap shrinks from ${formatWhole(RAW_TOP_GAP)} to about ${formatLogValue(LOG_TOP_GAP)} while the order of campaigns stays the same.`,
  }),
]);

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM?.hints ?? []),
  `The spike is the row with ${formatWhole(MAX_VALUE)} clicks. That single campaign is what stretches the raw axis into a long right tail.`,
  '`log(x + 1)` is the only option here that is specifically built to compress a valid, non-negative skewed feature while keeping zero values usable.',
  `Row ${ZERO_ROW_INDEX + 1} starts at 0, and log1p(0) = 0. That is the checkpoint to look for after the transform reveal.`,
  `The raw top gap is ${formatWhole(RAW_TOP_GAP)} clicks, but after log1p it becomes only about ${formatLogValue(LOG_TOP_GAP)} log units.`,
]);

const DEFAULT_FEEDBACK = 'Start with the raw chart. One campaign is valid, but its huge click count stretches the axis so hard that the rest of the feature gets squashed together.';
const DEFAULT_STATUS = 'Lock 1 of 4: click the raw spike that creates the heavy right tail.';
const SUMMARY_COPY = 'Log transforms are about valid skew, not broken rows. They keep every record, preserve ordering, and compress the oversized tail so scale-sensitive models read the feature more calmly.';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatWhole(value) {
  if (!Number.isFinite(value)) return String(value);
  return Number(value.toFixed(0)).toString();
}

function formatLogValue(value, digits = 2) {
  if (!Number.isFinite(value)) return String(value);
  return Number(value.toFixed(digits)).toString();
}

function shuffleCopy(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function transformOptionById(optionId) {
  return TRANSFORM_OPTIONS.find(option => option.id === optionId) ?? null;
}

function insightOptionById(optionId) {
  return INSIGHT_OPTIONS.find(option => option.id === optionId) ?? null;
}

function solvedFlags(context) {
  return {
    tail: context._tailLocked,
    formula: context._transformChoiceId === CORRECT_TRANSFORM_ID,
    zero: context._zeroLocked,
    insight: context._insightChoiceId === CORRECT_INSIGHT_ID,
  };
}

function progressCount(context) {
  const solved = solvedFlags(context);
  return Number(solved.tail) + Number(solved.formula) + Number(solved.zero) + Number(solved.insight);
}

function trackerState(stepId, solved) {
  if (stepId === 'tail') {
    return solved.tail ? 'solved' : 'active';
  }

  if (stepId === 'formula') {
    if (solved.formula) return 'solved';
    return solved.tail ? 'active' : 'pending';
  }

  if (stepId === 'zero') {
    if (solved.zero) return 'solved';
    return solved.formula ? 'active' : 'pending';
  }

  if (solved.insight) return 'solved';
  return solved.zero ? 'active' : 'pending';
}

function trackerLabel(state) {
  if (state === 'solved') return 'Locked';
  if (state === 'active') return 'Active';
  return 'Pending';
}

function resultTone(summary) {
  if (!summary) return DEFAULT_FEEDBACK;
  if (summary.mistakes === 0) {
    return 'Clean finish. You spotted the spike, chose the right transform, protected zero safely, and locked the real reason log compression helps.';
  }
  if (summary.mistakes <= 2) {
    return 'Strong recovery. The transform logic is correct, and the recap below should make the compression pattern stick for the next scaling levels.';
  }
  return 'Mission complete. Keep the recap in mind: log transform is for valid skewed features where the whole tail needs to calm down.';
}

export default class World5Level4 {
  meta = {
    title: LEVEL_TITLE,
    subtitle: LEVEL_OBJECTIVE,
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._events = null;
    this._rawChart = null;
    this._logChart = null;
    this._tailLocked = false;
    this._transformChoiceId = null;
    this._zeroLocked = false;
    this._insightChoiceId = null;
    this._completed = false;
    this._mistakes = 0;
    this._summary = null;
    this._transformOrder = shuffleCopy(TRANSFORM_OPTIONS);
    this._insightOrder = shuffleCopy(INSIGHT_OPTIONS);
    this._ui = {};
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w5-level w5-level--log-lab screen-section" aria-label="World 5 Level 4">
        <div class="level-hero w5-level__hero" style="--world-color: var(--color-world-5);">
          <p class="eyebrow">World 5 - Scaling</p>
          <h1 class="level-hero__title">${escapeHtml(LEVEL_TITLE)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(LEVEL_OBJECTIVE)}
            This lab keeps every campaign row, but compresses one oversized right-tail feature so scale-sensitive models stop overreacting to the spike.
          </p>
          <div class="action-row">
            <span class="status-box" id="w5-l4-progress">0 / ${TOTAL_LOCKS} log locks</span>
            <span class="status-box" id="w5-l4-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w5-l4-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w5-l4-reset-btn" type="button">Reset Lab</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">04</span>
        </div>

        <div class="w5-scale-grid">
          <article class="panel w5-scale-stage">
            <div class="w5-level__panel-head">
              <div>
                <p class="eyebrow">Log Lab</p>
                <h2 class="panel-title">Keep the rows, but squeeze the tail so the full feature becomes readable again</h2>
              </div>
              <p class="w5-level__microcopy">
                This is not an error-cleanup mission. The spike is valid. The goal is to calm a feature whose right tail is stretching the axis far more than the model needs.
              </p>
            </div>

            <section class="w5-scale-snapshot" aria-label="Log Snapshot">
              <article class="w5-scale-snapshot__card">
                <span class="w5-scale-snapshot__label">Tail Spike</span>
                <strong class="w5-scale-snapshot__value" id="w5-l4-spike-state" data-state="missing">Pending</strong>
              </article>
              <article class="w5-scale-snapshot__card">
                <span class="w5-scale-snapshot__label">Chosen Transform</span>
                <strong class="w5-scale-snapshot__value" id="w5-l4-transform-state" data-state="missing">Pending</strong>
              </article>
              <article class="w5-scale-snapshot__card">
                <span class="w5-scale-snapshot__label">Zero Safety</span>
                <strong class="w5-scale-snapshot__value" id="w5-l4-zero-state" data-state="missing">Pending</strong>
              </article>
              <article class="w5-scale-snapshot__card">
                <span class="w5-scale-snapshot__label">Tail Gap</span>
                <strong class="w5-scale-snapshot__value" id="w5-l4-gap-state" data-state="missing">Pending</strong>
              </article>
            </section>

            <section class="w5-log-panel">
              <div class="w5-log-panel__head">
                <div>
                  <p class="eyebrow">Raw Feature</p>
                  <h3 class="panel-title">Click the campaign that stretches the raw axis into a heavy right tail</h3>
                </div>
                <p class="w5-log-panel__copy">
                  The feature below is valid count data. The problem is not one broken row. The problem is that one huge campaign makes the rest of the scale feel cramped.
                </p>
              </div>

              <div class="w5-log-value-ribbon" aria-label="Raw click counts">
                ${ROWS.map(row => `
                  <span class="w5-log-value-chip" data-value-chip="${row.index}">
                    ${escapeHtml(row.label)} - ${escapeHtml(formatWhole(row.rawValue))}
                  </span>
                `).join('')}
              </div>

              <div class="w5-log-chart-shell" id="w5-l4-raw-chart"></div>
              <p class="w5-log-panel__copy" id="w5-l4-raw-note">
                Click the tallest bar first. That is the valid spike creating the long right tail.
              </p>
            </section>

            <section class="w5-log-panel">
              <div class="w5-log-panel__head">
                <div>
                  <p class="eyebrow">Transform Choice</p>
                  <h3 class="panel-title">Pick the operation that compresses a valid non-negative tail without deleting rows</h3>
                </div>
                <p class="w5-log-panel__copy">
                  Min-max and z-score are still useful elsewhere in this world. Here we need the option that specifically calms the high end of the distribution.
                </p>
              </div>

              <div class="w5-log-choice-grid" id="w5-l4-transform-grid">
                ${this._transformOrder.map(option => `
                  <button class="w5-log-choice" type="button" data-transform-choice="${option.id}" data-choice-state="locked">
                    <span class="w5-log-choice__eyebrow">Transform</span>
                    <strong class="w5-log-choice__title">${escapeHtml(option.label)}</strong>
                    <code class="w5-log-choice__formula">${escapeHtml(option.formula)}</code>
                    <p class="w5-log-choice__copy">${escapeHtml(option.copy)}</p>
                  </button>
                `).join('')}
              </div>
            </section>

            <section class="w5-log-panel" id="w5-l4-transform-panel" hidden>
              <div class="w5-log-panel__head">
                <div>
                  <p class="eyebrow">After Log1p</p>
                  <h3 class="panel-title">The spike is still the largest row, but it no longer dwarfs the rest of the feature</h3>
                </div>
                <p class="w5-log-panel__copy" id="w5-l4-transform-note">
                  The transformed chart is live. Click the point that stays exactly at zero after the <code>+1</code> safety shift.
                </p>
              </div>

              <div class="w5-log-transform-stats">
                <article class="w5-log-transform-stat">
                  <span class="w5-log-transform-stat__label">Raw top gap</span>
                  <strong class="w5-log-transform-stat__value">${escapeHtml(formatWhole(RAW_TOP_GAP))}</strong>
                  <p class="w5-log-transform-stat__copy">Gap from ${escapeHtml(formatWhole(SECOND_HIGHEST_VALUE))} to ${escapeHtml(formatWhole(MAX_VALUE))}</p>
                </article>
                <article class="w5-log-transform-stat">
                  <span class="w5-log-transform-stat__label">Log top gap</span>
                  <strong class="w5-log-transform-stat__value">${escapeHtml(formatLogValue(LOG_TOP_GAP))}</strong>
                  <p class="w5-log-transform-stat__copy">Gap from ${escapeHtml(formatLogValue(SECOND_HIGHEST_LOG))} to ${escapeHtml(formatLogValue(LOG_MAX_VALUE))}</p>
                </article>
              </div>

              <div class="w5-log-chart-shell" id="w5-l4-log-chart"></div>
            </section>
          </article>

          <div class="w5-scale-side">
            <section class="panel w5-scale-tracker" aria-label="Log Tracker">
              <div class="w5-level__panel-head">
                <div>
                  <p class="eyebrow">Mission Tracker</p>
                  <h2 class="panel-title">Spot the skew, choose the transform, protect zero, explain the compression</h2>
                </div>
                <p class="w5-level__microcopy">
                  Each lock turns one part of log-transform intuition into a visible decision rather than a memorized formula.
                </p>
              </div>

              <div class="w5-scale-tracker__list">
                ${TRACKER_STEPS.map((step, index) => `
                  <article class="w5-scale-card" data-step-id="${step.id}" data-step-state="${index === 0 ? 'active' : 'pending'}">
                    <div class="w5-scale-card__meta">
                      <span class="w5-scale-card__status" data-step-status="${step.id}">${index === 0 ? 'Active' : 'Pending'}</span>
                      <span class="w5-scale-card__index">Step ${index + 1}</span>
                    </div>
                    <h3 class="w5-scale-card__title">${escapeHtml(step.label)}</h3>
                    <p class="w5-scale-card__chapter">${escapeHtml(step.chapter)}</p>
                    <p class="w5-scale-card__copy">${escapeHtml(step.recap)}</p>
                  </article>
                `).join('')}
              </div>
            </section>

            <section class="panel w5-log-panel w5-log-insight-panel" aria-label="Compression Insight">
              <div class="w5-log-panel__head">
                <div>
                  <p class="eyebrow">Final Check</p>
                  <h2 class="panel-title">Which statement best explains what the log transform just did?</h2>
                </div>
                <p class="w5-log-panel__copy">
                  This last step unlocks after the zero-safe point is confirmed. Choose the explanation that fits the transformed chart, not just the formula name.
                </p>
              </div>

              <div class="w5-log-choice-grid w5-log-choice-grid--insight" id="w5-l4-insight-grid">
                ${this._insightOrder.map(option => `
                  <button class="w5-log-choice" type="button" data-insight-choice="${option.id}" data-choice-state="locked">
                    <span class="w5-log-choice__eyebrow">Insight</span>
                    <strong class="w5-log-choice__title">${escapeHtml(option.label)}</strong>
                    <p class="w5-log-choice__copy">${escapeHtml(option.copy)}</p>
                  </button>
                `).join('')}
              </div>
            </section>

            <section class="card card--elevated w5-level__feedback" aria-live="polite">
              <p class="eyebrow">Coach Feed</p>
              <p id="w5-l4-feedback-text" class="w5-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
            </section>

            <section class="card w5-level__hint-box" id="w5-l4-hint-box" hidden>
              <p class="eyebrow">Hint</p>
              <p id="w5-l4-hint-text" class="w5-level__hint-copy"></p>
            </section>

            <section class="card w5-scale-guide">
              <p class="eyebrow">What This Teaches</p>
              <div class="w5-scale-guide__steps">
                <article class="w5-scale-guide__step">
                  <span class="w5-scale-guide__badge">1</span>
                  <p>Log transforms are healthiest when the row values are real but the full feature is stretched by a long right tail.</p>
                </article>
                <article class="w5-scale-guide__step">
                  <span class="w5-scale-guide__badge">2</span>
                  <p>The <code>+1</code> keeps genuine zero counts usable because <code>log1p(0)</code> stays exactly 0 instead of breaking at <code>log(0)</code>.</p>
                </article>
                <article class="w5-scale-guide__step">
                  <span class="w5-scale-guide__badge">3</span>
                  <p>Row order does not flip. The transform simply compresses the top-end spacing so one huge value stops shouting over the rest.</p>
                </article>
              </div>
            </section>
          </div>
        </div>

        <section class="panel w5-scale-summary" id="w5-l4-summary" hidden aria-label="Log Transform Summary">
          <div class="w5-level__panel-head">
            <div>
              <p class="eyebrow">Log Recap</p>
              <h2 class="panel-title">The tail stayed valid, but its leverage shrank dramatically once the feature moved to log space</h2>
            </div>
            <p class="w5-level__microcopy">${escapeHtml(SUMMARY_COPY)}</p>
          </div>

          <div class="w5-scale-summary__grid">
            <article class="w5-scale-summary__card">
              <p class="w5-scale-summary__kicker">Raw Tail</p>
              <h3 class="w5-scale-summary__title">${escapeHtml(formatWhole(SECOND_HIGHEST_VALUE))} -> ${escapeHtml(formatWhole(MAX_VALUE))}</h3>
              <p class="w5-scale-summary__copy">Before the transform, the top gap was ${escapeHtml(formatWhole(RAW_TOP_GAP))} clicks, which made the rest of the feature look much tighter than it really was.</p>
            </article>
            <article class="w5-scale-summary__card">
              <p class="w5-scale-summary__kicker">After log1p</p>
              <h3 class="w5-scale-summary__title">${escapeHtml(formatLogValue(SECOND_HIGHEST_LOG))} -> ${escapeHtml(formatLogValue(LOG_MAX_VALUE))}</h3>
              <p class="w5-scale-summary__copy">That same top gap shrank to about ${escapeHtml(formatLogValue(LOG_TOP_GAP))} log units, which is why the right tail now feels much less dominant.</p>
            </article>
            <article class="w5-scale-summary__card">
              <p class="w5-scale-summary__kicker">Zero Safe</p>
              <h3 class="w5-scale-summary__title">Row ${ZERO_ROW_INDEX + 1}: 0 -> ${escapeHtml(formatLogValue(LOG_VALUES[ZERO_ROW_INDEX]))}</h3>
              <p class="w5-scale-summary__copy">The <code>+1</code> keeps real zeros valid, so count features can be compressed without breaking rows that genuinely had no activity.</p>
            </article>
          </div>

          <div class="action-row">
            <span class="status-box" id="w5-l4-summary-score">Waiting for the full log reveal</span>
            <button class="btn btn--primary" id="w5-l4-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w5-l4-progress');
    this._ui.status = container.querySelector('#w5-l4-status');
    this._ui.feedback = container.querySelector('#w5-l4-feedback-text');
    this._ui.hintBox = container.querySelector('#w5-l4-hint-box');
    this._ui.hintText = container.querySelector('#w5-l4-hint-text');
    this._ui.rawChartHost = container.querySelector('#w5-l4-raw-chart');
    this._ui.rawNote = container.querySelector('#w5-l4-raw-note');
    this._ui.transformPanel = container.querySelector('#w5-l4-transform-panel');
    this._ui.transformNote = container.querySelector('#w5-l4-transform-note');
    this._ui.logChartHost = container.querySelector('#w5-l4-log-chart');
    this._ui.spikeState = container.querySelector('#w5-l4-spike-state');
    this._ui.transformState = container.querySelector('#w5-l4-transform-state');
    this._ui.zeroState = container.querySelector('#w5-l4-zero-state');
    this._ui.gapState = container.querySelector('#w5-l4-gap-state');
    this._ui.summary = container.querySelector('#w5-l4-summary');
    this._ui.summaryScore = container.querySelector('#w5-l4-summary-score');
    this._ui.finishButton = container.querySelector('#w5-l4-finish-btn');
    this._ui.trackerCards = Array.from(container.querySelectorAll('[data-step-id]'));
    this._ui.transformButtons = Array.from(container.querySelectorAll('[data-transform-choice]'));
    this._ui.insightButtons = Array.from(container.querySelectorAll('[data-insight-choice]'));
    this._ui.valueChips = Array.from(container.querySelectorAll('[data-value-chip]'));

    this._mountCharts();
    this._syncTracker();
    this._syncSnapshots();
    this._syncProgress();
    this._syncChoices();
    this._syncTransformReveal();
    this._syncValueChips();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w5-l4-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w5-l4-reset-btn')) {
        this._resetLab();
        return;
      }

      if (event.target.closest('#w5-l4-finish-btn')) {
        if (this._completed) {
          void this._engine.complete();
        }
        return;
      }

      const transformButton = event.target.closest('[data-transform-choice]');
      if (transformButton) {
        this._handleTransformPick(transformButton.getAttribute('data-transform-choice'));
        return;
      }

      const insightButton = event.target.closest('[data-insight-choice]');
      if (insightButton) {
        this._handleInsightPick(insightButton.getAttribute('data-insight-choice'));
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
    this._rawChart?.destroy();
    this._logChart?.destroy();
    this._rawChart = null;
    this._logChart = null;
    this._ui = {};
  }

  _mountCharts() {
    this._rawChart?.destroy();
    this._logChart?.destroy();

    this._rawChart = new ChartWidget(this._ui.rawChartHost, {
      type: 'bar',
      title: `Raw ${FEATURE_LABEL} values`,
      worldColor: 'var(--color-world-5)',
      minWidth: 720,
      height: 280,
      data: ROWS.map(row => ({
        label: row.label,
        value: row.rawValue,
        color: row.index === SPIKE_ROW_INDEX ? 'var(--color-warning)' : 'var(--color-world-5)',
      })),
      valueFormatter: value => formatWhole(value),
      tooltipFormatter: item => `Row ${item.label}: ${formatWhole(item.value)} clicks`,
      ariaLabel: `Bar chart showing the raw ${FEATURE_LABEL.toLowerCase()} values with one very large right-tail spike.`,
      onPointClick: detail => this._handleRawPick(detail.index),
    });

    this._logChart = new ChartWidget(this._ui.logChartHost, {
      type: 'dotplot',
      title: `log(x + 1) transformed ${FEATURE_LABEL.toLowerCase()}`,
      worldColor: 'var(--color-world-5)',
      minWidth: 720,
      height: 260,
      showGrid: true,
      scaleMode: 'linear',
      tickValues: [0, 1, 2, 3, 4, LOG_MAX_VALUE],
      valueFormatter: value => formatLogValue(value),
      data: ROWS.map(row => ({
        value: row.logValue,
        label: row.label,
        color: row.index === ZERO_ROW_INDEX
          ? 'var(--color-success)'
          : row.index === SPIKE_ROW_INDEX
            ? 'var(--color-warning)'
            : 'var(--color-world-5)',
        state: row.index === ZERO_ROW_INDEX ? 'active' : row.index === SPIKE_ROW_INDEX ? 'selected' : 'default',
        tooltip: `Row ${row.label}: log1p(${formatWhole(row.rawValue)}) = ${formatLogValue(row.logValue)}`,
        ariaLabel: `Row ${row.label}, log transformed value ${formatLogValue(row.logValue)}`,
      })),
      markers: [
        {
          value: 0,
          label: '0 stays 0',
          tone: 'var(--color-success)',
        },
        {
          value: LOG_MAX_VALUE,
          label: `Max ${formatLogValue(LOG_MAX_VALUE)}`,
          tone: 'var(--color-warning)',
        },
      ],
      connectors: [{
        from: SECOND_HIGHEST_LOG,
        to: LOG_MAX_VALUE,
        label: `Top gap ${formatLogValue(LOG_TOP_GAP)}`,
        tone: 'var(--color-warning)',
      }],
      ariaLabel: `Dot plot showing the ${FEATURE_LABEL.toLowerCase()} values after log transform with zero preserved.`,
      onPointClick: detail => this._handleLogPick(detail.index),
    });
  }

  _handleRawPick(index) {
    if (this._completed || this._tailLocked) return;

    if (index === SPIKE_ROW_INDEX) {
      this._tailLocked = true;
      this._engine.correct();
      this._setFeedback(`Correct. Row ${SPIKE_ROW_INDEX + 1} spikes to ${formatWhole(MAX_VALUE)} clicks, which is what stretches the feature into a heavy right tail.`);
      this._setStatus('Lock 1 complete. Now choose the transform that compresses a valid non-negative tail without deleting rows.');
      this._syncTracker();
      this._syncSnapshots();
      this._syncProgress();
      this._syncChoices();
      this._syncValueChips();
      return;
    }

    this._mistakes += 1;
    this._engine.mistake({ costsLife: false, countsMistake: true });
    this._setFeedback(`Row ${index + 1} is part of the smaller cluster, not the tail-stretching spike. Click the campaign whose bar leaps all the way up to ${formatWhole(MAX_VALUE)}.`);
    this._setStatus('Not yet. The correct first lock is the raw spike creating the long right tail.');
  }

  _handleTransformPick(optionId) {
    if (this._completed || this._transformChoiceId === CORRECT_TRANSFORM_ID) return;

    if (!this._tailLocked) {
      this._setFeedback('The transform stage is still locked. Identify the raw spike first so the long-tail problem is visible before you repair it.');
      this._setStatus(DEFAULT_STATUS);
      return;
    }

    const option = transformOptionById(optionId);
    if (!option) return;

    if (optionId === CORRECT_TRANSFORM_ID) {
      this._transformChoiceId = optionId;
      this._engine.correct();
      this._setFeedback(option.success);
      this._setStatus('Lock 2 complete. The transformed chart is live now. Click the point that stays exactly at zero after `log(x + 1)`.');
      this._syncTracker();
      this._syncSnapshots();
      this._syncProgress();
      this._syncChoices();
      this._syncTransformReveal();
      return;
    }

    this._mistakes += 1;
    this._engine.mistake({ costsLife: false, countsMistake: true });
    this._setFeedback(option.retry);
    this._setStatus('Transform choice missed. Pick the option that specifically compresses a valid long right tail while keeping zero counts safe.');
  }

  _handleLogPick(index) {
    if (this._completed || this._zeroLocked) return;

    if (this._transformChoiceId !== CORRECT_TRANSFORM_ID) {
      this._setFeedback('The transformed chart is still locked. Choose the correct tail-compression formula first.');
      this._setStatus('The zero-safety checkpoint unlocks after the log transform is selected.');
      return;
    }

    if (index === ZERO_ROW_INDEX) {
      this._zeroLocked = true;
      this._engine.correct();
      this._setFeedback(`Exactly. Row ${ZERO_ROW_INDEX + 1} started at 0 and still lands at 0, which is why the +1 matters for count features that can genuinely be zero.`);
      this._setStatus('Lock 3 complete. Finish by choosing the statement that best explains what the log transform did to the tail.');
      this._syncTracker();
      this._syncSnapshots();
      this._syncProgress();
      this._syncChoices();
      this._syncTransformReveal();
      this._syncValueChips();
      return;
    }

    this._mistakes += 1;
    this._engine.mistake({ costsLife: false, countsMistake: true });
    this._setFeedback(`Row ${index + 1} does not stay on zero. Look for the campaign that originally had 0 clicks, because log1p(0) remains 0.`);
    this._setStatus('Zero-safety checkpoint missed. Click the transformed point created from the raw zero row.');
  }

  _handleInsightPick(optionId) {
    if (this._completed || this._insightChoiceId === CORRECT_INSIGHT_ID) return;

    if (!this._zeroLocked) {
      this._setFeedback('The final explanation unlocks only after you confirm the zero-safe point on the transformed chart.');
      this._setStatus('Zero safety comes before the final interpretation step.');
      return;
    }

    const option = insightOptionById(optionId);
    if (!option) return;

    if (optionId === CORRECT_INSIGHT_ID) {
      this._insightChoiceId = optionId;
      this._engine.correct();
      this._completeLevel(option.success);
      return;
    }

    this._mistakes += 1;
    this._engine.mistake({ costsLife: false, countsMistake: true });
    this._setFeedback(option.retry);
    this._setStatus('Final explanation missed. Choose the statement that matches the new chart spacing, not just the formula name.');
  }

  _completeLevel(message) {
    this._completed = true;
    this._summary = {
      locksCompleted: TOTAL_LOCKS,
      totalLocks: TOTAL_LOCKS,
      mistakes: this._mistakes,
    };

    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = `${TOTAL_LOCKS} / ${TOTAL_LOCKS} log locks`;
    }

    if (this._ui.summary) {
      this._ui.summary.hidden = false;
      requestAnimationFrame(() => {
        this._ui.summary.classList.add('is-revealed');
      });
      this._ui.summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    this._setFeedback(message || resultTone(this._summary));
    this._setStatus('All four log-transform locks are complete. Review the recap, then continue.');
    this._syncTracker();
    this._syncSnapshots();
    this._syncProgress();
    this._syncChoices();
    this._syncTransformReveal();
    this._syncValueChips();
  }

  _resetLab() {
    this._tailLocked = false;
    this._transformChoiceId = null;
    this._zeroLocked = false;
    this._insightChoiceId = null;
    this._completed = false;
    this._mistakes = 0;
    this._summary = null;
    this._transformOrder = shuffleCopy(TRANSFORM_OPTIONS);
    this._insightOrder = shuffleCopy(INSIGHT_OPTIONS);

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
      this._ui.summaryScore.textContent = 'Waiting for the full log reveal';
    }

    this._setFeedback(DEFAULT_FEEDBACK);
    this._setStatus(DEFAULT_STATUS);
    this._syncTracker();
    this._syncSnapshots();
    this._syncProgress();
    this._syncChoices();
    this._syncTransformReveal();
    this._syncValueChips();
  }

  _showHint() {
    const { allowed, text } = this._engine.requestHint();
    if (!allowed || !text) return;

    this._ui.hintBox?.removeAttribute('hidden');
    if (this._ui.hintText) {
      this._ui.hintText.textContent = text;
    }
  }

  _syncTracker() {
    const solved = solvedFlags(this);

    this._ui.trackerCards?.forEach(card => {
      const stepId = card.getAttribute('data-step-id');
      const state = trackerState(stepId, solved);
      const status = card.querySelector('[data-step-status]');
      card.dataset.stepState = state;
      if (status) {
        status.textContent = trackerLabel(state);
      }
    });
  }

  _syncSnapshots() {
    if (this._ui.spikeState) {
      this._ui.spikeState.textContent = this._tailLocked ? `Row ${SPIKE_ROW_INDEX + 1} -> ${formatWhole(MAX_VALUE)}` : 'Pending';
      this._ui.spikeState.dataset.state = this._tailLocked ? 'correct' : 'missing';
    }

    if (this._ui.transformState) {
      const locked = this._transformChoiceId === CORRECT_TRANSFORM_ID;
      this._ui.transformState.textContent = locked ? 'log(x + 1)' : 'Pending';
      this._ui.transformState.dataset.state = locked ? 'correct' : 'missing';
    }

    if (this._ui.zeroState) {
      this._ui.zeroState.textContent = this._zeroLocked ? `Row ${ZERO_ROW_INDEX + 1} -> 0` : 'Pending';
      this._ui.zeroState.dataset.state = this._zeroLocked ? 'correct' : 'missing';
    }

    if (this._ui.gapState) {
      const revealed = this._transformChoiceId === CORRECT_TRANSFORM_ID;
      this._ui.gapState.textContent = revealed ? `${formatWhole(RAW_TOP_GAP)} -> ${formatLogValue(LOG_TOP_GAP)}` : 'Pending';
      this._ui.gapState.dataset.state = this._insightChoiceId === CORRECT_INSIGHT_ID ? 'correct' : revealed ? 'present' : 'missing';
    }
  }

  _syncProgress() {
    const progress = progressCount(this);

    if (this._ui.progress) {
      this._ui.progress.textContent = `${progress} / ${TOTAL_LOCKS} log locks`;
    }

    if (this._ui.finishButton) {
      this._ui.finishButton.disabled = !this._completed;
    }
  }

  _syncChoices() {
    this._ui.transformButtons?.forEach(button => {
      const optionId = button.getAttribute('data-transform-choice');
      const unlocked = this._tailLocked;
      const solved = this._transformChoiceId === CORRECT_TRANSFORM_ID;
      const isCorrect = optionId === CORRECT_TRANSFORM_ID;
      button.disabled = !unlocked || solved;

      if (!unlocked) {
        button.dataset.choiceState = 'locked';
      } else if (solved && isCorrect) {
        button.dataset.choiceState = 'solved';
      } else if (solved) {
        button.dataset.choiceState = 'muted';
      } else {
        button.dataset.choiceState = 'active';
      }
    });

    this._ui.insightButtons?.forEach(button => {
      const optionId = button.getAttribute('data-insight-choice');
      const unlocked = this._zeroLocked;
      const solved = this._insightChoiceId === CORRECT_INSIGHT_ID;
      const isCorrect = optionId === CORRECT_INSIGHT_ID;
      button.disabled = !unlocked || solved;

      if (!unlocked) {
        button.dataset.choiceState = 'locked';
      } else if (solved && isCorrect) {
        button.dataset.choiceState = 'solved';
      } else if (solved) {
        button.dataset.choiceState = 'muted';
      } else {
        button.dataset.choiceState = 'active';
      }
    });
  }

  _syncTransformReveal() {
    if (!this._ui.transformPanel) return;

    const revealed = this._transformChoiceId === CORRECT_TRANSFORM_ID;
    this._ui.transformPanel.hidden = !revealed;

    if (this._ui.transformNote) {
      this._ui.transformNote.textContent = this._zeroLocked
        ? `Zero is confirmed safe, the spike still leads at ${formatLogValue(SPIKE_LOG_VALUE)}, and the only remaining task is to explain why the tail now feels much calmer.`
        : revealed
          ? 'The transformed chart is live. Click the point that stays exactly at zero after the `+1` safety shift.'
          : 'The transformed chart will appear after the correct formula is selected.';
    }

    if (this._ui.rawNote) {
      this._ui.rawNote.textContent = this._tailLocked
        ? `Row ${SPIKE_ROW_INDEX + 1} is the valid tail spike. The next question is which transform compresses that entire right edge without deleting rows.`
        : 'Click the tallest bar first. That is the valid spike creating the long right tail.';
    }
  }

  _syncValueChips() {
    this._ui.valueChips?.forEach(chip => {
      const index = Number(chip.getAttribute('data-value-chip'));
      chip.dataset.chipState = this._tailLocked && index === SPIKE_ROW_INDEX
        ? 'spike'
        : this._zeroLocked && index === ZERO_ROW_INDEX
          ? 'zero'
          : 'idle';
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
