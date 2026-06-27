'use strict';

import { createDataset, DATASET_KEYS } from '../../data/datasets.js';
import { getLevelProblem } from '../../data/problems.js';
import { DataFrame } from '../../pandas/dataframe.js';
import { clipOutliers, log1p, outlierMask, removeOutliers } from '../../pandas/operations.js';
import { ChartWidget } from '../../widgets/charts.js';
import { DataTable } from '../../widgets/datatable.js';

const PROBLEM = getLevelProblem(3, 4);
const LEVEL_TITLE = 'What Do We Do With It?';
const LEVEL_OBJECTIVE = 'Choose whether to suppress, cap, or log-transform outliers in each context.';

function createFallbackDataset() {
  return DataFrame.fromRows([
    { Customer_ID: 1, Daily_Spend: 21 },
    { Customer_ID: 2, Daily_Spend: 22 },
    { Customer_ID: 3, Daily_Spend: 22 },
    { Customer_ID: 4, Daily_Spend: 23 },
    { Customer_ID: 5, Daily_Spend: 24 },
    { Customer_ID: 6, Daily_Spend: 24 },
    { Customer_ID: 7, Daily_Spend: 25 },
    { Customer_ID: 8, Daily_Spend: 25 },
    { Customer_ID: 9, Daily_Spend: 26 },
    { Customer_ID: 10, Daily_Spend: 27 },
    { Customer_ID: 11, Daily_Spend: 28 },
    { Customer_ID: 12, Daily_Spend: 29 },
    { Customer_ID: 13, Daily_Spend: 31 },
    { Customer_ID: 14, Daily_Spend: 34 },
    { Customer_ID: 15, Daily_Spend: 89 },
  ]);
}

function createLevelDataset() {
  try {
    return createDataset(PROBLEM?.datasetKey ?? DATASET_KEYS.OUTLIER_DEMO);
  } catch {
    return createFallbackDataset();
  }
}

const BASE_DF = createLevelDataset();
const ID_COLUMN = BASE_DF.columns[0];
const TARGET_COLUMN = BASE_DF.columns.includes('Daily_Spend')
  ? 'Daily_Spend'
  : BASE_DF.columns[BASE_DF.columns.length - 1];
const BASE_ROWS = BASE_DF.toRows();
const BASE_VALUES = BASE_DF.col(TARGET_COLUMN).values.filter(value => typeof value === 'number' && Number.isFinite(value));
const BASE_MASK = outlierMask(BASE_DF, TARGET_COLUMN);
const OUTLIER_INDEX = BASE_MASK.findIndex(Boolean);
const OUTLIER_ROW = BASE_ROWS[OUTLIER_INDEX] ?? BASE_ROWS[BASE_ROWS.length - 1];
const OUTLIER_ID = OUTLIER_ROW?.[ID_COLUMN] ?? BASE_ROWS.length;
const OUTLIER_VALUE = OUTLIER_ROW?.[TARGET_COLUMN] ?? Math.max(...BASE_VALUES);
const { lower: LOWER_FENCE, upper: UPPER_FENCE } = BASE_DF.iqrFences(TARGET_COLUMN);
const SUPPRESSED_DF = removeOutliers(BASE_DF, TARGET_COLUMN);
const CAPPED_DF = clipOutliers(BASE_DF, TARGET_COLUMN);
const LOG_DF = log1p(BASE_DF, TARGET_COLUMN);
const RAW_MAX = Math.max(...BASE_VALUES);
const SUPPRESSED_MAX = Math.max(...SUPPRESSED_DF.col(TARGET_COLUMN).values.filter(value => typeof value === 'number' && Number.isFinite(value)));
const CAPPED_MAX = Math.max(...CAPPED_DF.col(TARGET_COLUMN).values.filter(value => typeof value === 'number' && Number.isFinite(value)));
const LOG_MAX = Math.max(...LOG_DF.col(TARGET_COLUMN).values.filter(value => typeof value === 'number' && Number.isFinite(value)));

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const DECIMAL = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const TREATMENTS = Object.freeze({
  suppress: Object.freeze({
    id: 'suppress',
    label: 'Suppression',
    shortLabel: 'Suppress',
    formula: 'drop rows where x < lower or x > upper',
    bestFor: 'Broken or clearly erroneous records',
    risk: 'You lose rows and any real signal they carried.',
    color: 'var(--color-danger)',
    accent: 'rgba(255, 77, 106, 0.18)',
    previewTitle: 'After suppression',
    previewCopy: 'The corrupted point disappears, row count drops, and the remaining distribution stays intact.',
    afterDf: SUPPRESSED_DF,
    metrics: {
      rows: SUPPRESSED_DF.length,
      peak: SUPPRESSED_MAX,
      verdict: 'Best when the outlier itself is untrustworthy noise.',
    },
  }),
  cap: Object.freeze({
    id: 'cap',
    label: 'Capping',
    shortLabel: 'Cap',
    formula: "x' = min(max(x, lower), upper)",
    bestFor: 'Rare but valid extremes you still want to keep',
    risk: 'You flatten the tail and hide how far the original spike was.',
    color: 'var(--color-warning)',
    accent: 'rgba(245, 166, 35, 0.18)',
    previewTitle: 'After capping',
    previewCopy: 'The outlier row stays, but its value is clipped to the upper fence so leverage drops fast.',
    afterDf: CAPPED_DF,
    metrics: {
      rows: CAPPED_DF.length,
      peak: CAPPED_MAX,
      verdict: 'Best when the row is real, but the model should not let it dominate.',
    },
  }),
  log: Object.freeze({
    id: 'log',
    label: 'Log Transform',
    shortLabel: 'Log',
    formula: "x' = log(x + 1)",
    bestFor: 'Valid right-skewed financial or count features',
    risk: 'Interpretation changes because the entire feature moves to log space.',
    color: 'var(--color-success)',
    accent: 'rgba(0, 212, 170, 0.18)',
    previewTitle: 'After log1p',
    previewCopy: 'The full right tail compresses, so the whole feature becomes less skewed instead of targeting one row.',
    afterDf: LOG_DF,
    metrics: {
      rows: LOG_DF.length,
      peak: LOG_MAX,
      verdict: 'Best when the real problem is global skew across the feature, not one bad record.',
    },
  }),
});

const SCENARIOS = Object.freeze([
  Object.freeze({
    id: 'duplicate-checkout',
    title: 'The Outlier Came From A Replayed Checkout',
    focus: 'Corrupted row',
    visual: 'suppress',
    copy: `Column: ${TARGET_COLUMN}. The spike at ${formatMoney(OUTLIER_VALUE)} came from a duplicated transaction event after the payment service retried the same checkout twice. Logs confirm the row is not trustworthy evidence.`,
    tags: [
      ['Evidence', 'Replay bug confirmed'],
      ['Goal', 'Remove broken noise'],
      ['Tradeoff', 'Cleaner signal, fewer rows'],
    ],
    treatment: 'suppress',
    reason: 'Suppress the outlier because the row itself is corrupted. Once you know the record is wrong, the safest move is to remove that bad evidence.',
    caution: 'Capping or log-transforming would still preserve a row you already know is invalid.',
    retry: 'If the extreme value is a logging or measurement error, delete the broken row rather than reshaping it.',
  }),
  Object.freeze({
    id: 'vip-spender',
    title: 'The Whale Customer Is Real, But Too Influential',
    focus: 'Valid rare event',
    visual: 'cap',
    copy: `Column: ${TARGET_COLUMN}. The ${formatMoney(OUTLIER_VALUE)} spend is a verified VIP purchase day. The row matters, but one legitimate whale customer should not overpower the rest of the training signal.`,
    tags: [
      ['Evidence', 'Purchase verified'],
      ['Goal', 'Keep the row'],
      ['Tradeoff', 'Reduce leverage, preserve count'],
    ],
    treatment: 'cap',
    reason: 'Cap the outlier because the row is real, but clipping it at the fence keeps the customer in the dataset without letting one value dominate the model.',
    caution: 'Suppressing would throw away real behavior, while log transform is broader than the narrow fence-based control this scenario needs.',
    retry: 'If the outlier is real and you want to preserve the row count, think about clipping its leverage instead of deleting it.',
  }),
  Object.freeze({
    id: 'tail-is-the-problem',
    title: 'The Whole Feature Lives On A Long Right Tail',
    focus: 'Feature-level skew',
    visual: 'log',
    copy: `Column: ${TARGET_COLUMN}. All rows are plausible, but the feature stays right-skewed quarter after quarter. You are preparing it for a linear model that is sensitive to scale and tail stretch.`,
    tags: [
      ['Evidence', 'Skew persists over time'],
      ['Goal', 'Compress the tail'],
      ['Tradeoff', 'Entire feature changes scale'],
    ],
    treatment: 'log',
    reason: 'Use a log transform because the issue is not just one row. The whole feature is skewed, so compressing the tail across every record is the cleanest repair.',
    caution: 'Suppressing or capping only targets the spike, but this scenario says the wider distribution shape is the real modeling problem.',
    retry: 'When the full feature is right-skewed, transform the column instead of treating only one observation.',
  }),
]);

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM?.hints ?? []),
  'Ask first whether the extreme value is wrong, merely too influential, or part of a globally skewed feature.',
  'Capping is the only option here that keeps the row but directly clips its leverage at the fence.',
]);

const DEFAULT_FEEDBACK = 'Outlier treatment is a judgment call. Read the context before you decide whether to remove, clip, or transform.';
const DEFAULT_STATUS = 'Scenario 1 is live. Choose the safest treatment for the outlier, then confirm it to run the preview.';
const SUMMARY_COPY = 'Broken rows should disappear, real but dangerous extremes can be capped, and persistent skew often deserves a log transform across the full feature.';

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

function formatLogValue(value) {
  if (!Number.isFinite(value)) return String(value);
  return DECIMAL.format(value);
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function scenarioAt(index, scenarios = SCENARIOS) {
  return scenarios[index] ?? null;
}

function trackerMarkup(scenarios) {
  return scenarios.map((scenario, index) => `
    <article
      class="w3-treatment-tracker__item"
      data-scenario-id="${scenario.id}"
      data-scenario-state="${index === 0 ? 'current' : 'pending'}"
    >
      <div class="w3-treatment-tracker__meta">
        <span class="w3-treatment-tracker__status" data-scenario-status="${scenario.id}">${index === 0 ? 'Live' : 'Pending'}</span>
        <span class="w3-treatment-tracker__index">S${index + 1}</span>
      </div>
      <h3 class="w3-treatment-tracker__title">${escapeHtml(scenario.title)}</h3>
      <p class="w3-treatment-tracker__copy">${escapeHtml(scenario.focus)}</p>
    </article>
  `).join('');
}

function resultAttemptsLabel(attempts) {
  return attempts <= 1 ? 'First try' : `${attempts} tries`;
}

function chartEntriesFromFrame(df, treatmentId = 'raw') {
  return df.toRows().map(row => {
    const value = row[TARGET_COLUMN];
    const rowId = row[ID_COLUMN];
    const highlighted = rowId === OUTLIER_ID && treatmentId !== 'suppress';

    return {
      value,
      color: highlighted
        ? (TREATMENTS[treatmentId]?.color ?? 'var(--color-danger)')
        : 'var(--color-world-1)',
      state: highlighted ? 'selected' : 'default',
      tooltip: treatmentId === 'log'
        ? `${ID_COLUMN} ${rowId} - log1p(${TARGET_COLUMN}) = ${formatLogValue(value)}`
        : `${ID_COLUMN} ${rowId} - ${TARGET_COLUMN}: ${formatMoney(value)}`,
      ariaLabel: treatmentId === 'log'
        ? `Row ${rowId} log transformed value ${formatLogValue(value)}`
        : `Row ${rowId} value ${formatMoney(value)}`,
    };
  });
}

function afterChartConfig(treatmentId) {
  const treatment = TREATMENTS[treatmentId];
  if (!treatment) return null;

  const data = chartEntriesFromFrame(treatment.afterDf, treatmentId);

  if (treatmentId === 'log') {
    return {
      title: treatment.previewTitle,
      data,
      worldColor: treatment.color,
      height: 230,
      minWidth: 360,
      showGrid: true,
      scaleMode: 'linear',
      valueFormatter: formatLogValue,
      ariaLabel: 'Dot plot showing the distribution after log transform.',
      markers: [{
        value: LOG_MAX,
        label: `Max ${formatLogValue(LOG_MAX)}`,
        tone: treatment.color,
      }],
    };
  }

  return {
    title: treatment.previewTitle,
    data,
    worldColor: treatment.color,
    height: 230,
    minWidth: 360,
    showGrid: true,
    scaleMode: 'distribution',
    valueFormatter: formatMoney,
    ariaLabel: `Dot plot showing the distribution after ${treatment.label.toLowerCase()}.`,
    band: {
      from: Math.max(LOWER_FENCE, Math.min(...treatment.afterDf.col(TARGET_COLUMN).values)),
      to: UPPER_FENCE,
      label: 'IQR safe zone',
      tone: 'var(--color-world-1)',
      opacity: 0.14,
    },
    markers: [{
      value: UPPER_FENCE,
      label: `Upper fence ${formatMoney(UPPER_FENCE)}`,
      tone: treatment.color,
    }],
  };
}

export default class World3Level4 {
  meta = {
    title: LEVEL_TITLE,
    subtitle: LEVEL_OBJECTIVE,
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._events = null;
    this._table = null;
    this._beforeChart = null;
    this._afterChart = null;
    this._currentIndex = 0;
    this._scenarios = shuffle(SCENARIOS);
    this._treatmentOrder = shuffle(Object.values(TREATMENTS));
    this._selectedTreatment = null;
    this._lastWrongTreatment = null;
    this._revealed = false;
    this._completed = false;
    this._isTransitioning = false;
    this._attempts = new Map();
    this._results = new Map();
    this._timers = new Set();
    this._ui = {};
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w3-level w3-level--treatment-lab screen-section" aria-label="World 3 Level 4">
        <div class="level-hero w3-level__hero" style="--world-color: var(--color-world-3);">
          <p class="eyebrow">World 3 - Outliers</p>
          <h1 class="level-hero__title">${escapeHtml(LEVEL_TITLE)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(LEVEL_OBJECTIVE)}
            The same outlier can deserve three different treatments depending on whether it is wrong, merely too influential, or part of a wider skew problem.
          </p>
          <div class="action-row">
            <span class="status-box" id="w3-l4-progress">0 / ${SCENARIOS.length} treatment calls locked</span>
            <span class="status-box" id="w3-l4-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w3-l4-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w3-l4-reset-btn" type="button">Reset Deck</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">04</span>
        </div>

        <div class="w3-treatment-layout">
          <article class="panel w3-treatment-stage-panel">
            <div class="w3-level__panel-head">
              <div>
                <p class="eyebrow">Treatment Lab</p>
                <h2 class="panel-title">Read the context, then apply the safest outlier response</h2>
              </div>
              <p class="w3-level__microcopy">
                The dataset stays the same. What changes is the story around that extreme point, and that story changes the correct action.
              </p>
            </div>

            <div class="w3-treatment-stage-meta">
              <span class="status-box" id="w3-l4-stage-index">Card 1 / ${SCENARIOS.length}</span>
              <span class="status-box" id="w3-l4-stage-focus">Focus: ${escapeHtml(this._scenarios[0].focus)}</span>
            </div>

            <div class="w3-treatment-board">
              <section class="w3-treatment-dataset">
                <div class="w3-treatment-dataset__head">
                  <div>
                    <p class="eyebrow">Shared Dataset</p>
                    <h3 class="panel-title">One obvious outlier, three different treatment decisions</h3>
                  </div>
                  <p class="w3-treatment-dataset__copy">
                    The table always starts from the raw values. The preview only changes after you lock the right treatment.
                  </p>
                </div>

                <div class="w3-treatment-snapshot" aria-label="Treatment Snapshot">
                  <article class="w3-treatment-snapshot__card">
                    <span class="w3-treatment-snapshot__label">Rows</span>
                    <strong class="w3-treatment-snapshot__value">${BASE_DF.length}</strong>
                  </article>
                  <article class="w3-treatment-snapshot__card">
                    <span class="w3-treatment-snapshot__label">Upper Fence</span>
                    <strong class="w3-treatment-snapshot__value">${escapeHtml(formatMoney(UPPER_FENCE))}</strong>
                  </article>
                  <article class="w3-treatment-snapshot__card">
                    <span class="w3-treatment-snapshot__label">Outlier</span>
                    <strong class="w3-treatment-snapshot__value" data-tone="danger">${escapeHtml(formatMoney(OUTLIER_VALUE))}</strong>
                  </article>
                </div>

                <div class="w3-treatment-table-shell" id="w3-l4-table"></div>
              </section>

              <section class="w3-treatment-preview" id="w3-l4-preview" data-preview-state="idle" data-treatment-mode="idle">
                <div class="w3-treatment-preview__head">
                  <div>
                    <p class="eyebrow">Before / After Preview</p>
                    <h3 class="panel-title" id="w3-l4-preview-title">Choose a treatment to simulate the after-state</h3>
                  </div>
                  <p class="w3-treatment-preview__copy" id="w3-l4-preview-copy">
                    The left chart stays raw. The right chart and metrics wake up only after the correct treatment is locked in.
                  </p>
                </div>

                <div class="w3-treatment-chart-grid">
                  <div class="w3-treatment-chart-shell" id="w3-l4-before-chart"></div>
                  <div class="w3-treatment-chart-shell" id="w3-l4-after-chart">
                    <div class="w3-treatment-placeholder">
                      <span class="w3-treatment-placeholder__badge">Awaiting Choice</span>
                      <p>Pick the right treatment card below to preview the transformed distribution.</p>
                    </div>
                  </div>
                </div>

                <div class="w3-treatment-metrics">
                  <article class="w3-treatment-metric">
                    <span class="w3-treatment-metric__label">Rows After</span>
                    <strong class="w3-treatment-metric__value" id="w3-l4-metric-rows">--</strong>
                  </article>
                  <article class="w3-treatment-metric">
                    <span class="w3-treatment-metric__label">Peak After</span>
                    <strong class="w3-treatment-metric__value" id="w3-l4-metric-peak">--</strong>
                  </article>
                  <article class="w3-treatment-metric w3-treatment-metric--wide">
                    <span class="w3-treatment-metric__label">Why It Helps</span>
                    <p class="w3-treatment-metric__copy" id="w3-l4-metric-verdict">Choose a treatment to reveal the reasoning and the transformed shape.</p>
                  </article>
                </div>
              </section>
            </div>

            <div class="w3-treatment-card-shell" id="w3-l4-card-shell"></div>
            <div class="w3-treatment-controls" id="w3-l4-controls"></div>
          </article>

          <div class="w3-treatment-side">
            <section class="panel w3-treatment-tracker" aria-label="Scenario Tracker">
              <div class="w3-level__panel-head">
                <div>
                  <p class="eyebrow">Scenario Tracker</p>
                  <h2 class="panel-title">Lock the safest action for each context</h2>
                </div>
                <p class="w3-level__microcopy">
                  Same dataset, different business meaning. The right treatment depends on what the extreme point actually represents.
                </p>
              </div>

              <div class="w3-treatment-tracker__list" id="w3-l4-tracker-list">
                ${trackerMarkup(this._scenarios)}
              </div>
            </section>

            <section class="card card--elevated w3-level__feedback" aria-live="polite">
              <p class="eyebrow">Coach Feed</p>
              <p id="w3-l4-feedback-text" class="w3-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
            </section>

            <section class="card w3-level__hint-box" id="w3-l4-hint-box" hidden>
              <p class="eyebrow">Hint</p>
              <p id="w3-l4-hint-text" class="w3-level__hint-copy"></p>
            </section>

            <section class="card w3-treatment-guide">
              <p class="eyebrow">Method Guide</p>
              <div class="w3-treatment-guide__list">
                ${Object.values(TREATMENTS).map(treatment => `
                  <article class="w3-treatment-guide__item">
                    <div class="w3-treatment-guide__head">
                      <span class="w3-treatment-guide__badge">${escapeHtml(treatment.shortLabel)}</span>
                      <strong>${escapeHtml(treatment.label)}</strong>
                    </div>
                    <p class="w3-treatment-guide__formula">${escapeHtml(treatment.formula)}</p>
                    <p class="w3-treatment-guide__copy">Best for: ${escapeHtml(treatment.bestFor)}</p>
                    <p class="w3-treatment-guide__copy">Risk: ${escapeHtml(treatment.risk)}</p>
                  </article>
                `).join('')}
              </div>
            </section>
          </div>
        </div>

        <section class="panel w3-treatment-summary" id="w3-l4-summary" hidden aria-label="Treatment Recap">
          <div class="w3-level__panel-head">
            <div>
              <p class="eyebrow">Treatment Recap</p>
              <h2 class="panel-title">Outlier fixes depend on what the extreme point means</h2>
            </div>
            <p class="w3-level__microcopy">${escapeHtml(SUMMARY_COPY)}</p>
          </div>

          <div class="w3-treatment-summary__grid" id="w3-l4-summary-grid"></div>

          <div class="action-row">
            <span class="status-box">You are ready for the World 3 review.</span>
            <button class="btn btn--primary" id="w3-l4-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w3-l4-progress');
    this._ui.status = container.querySelector('#w3-l4-status');
    this._ui.feedback = container.querySelector('#w3-l4-feedback-text');
    this._ui.hintBox = container.querySelector('#w3-l4-hint-box');
    this._ui.hintText = container.querySelector('#w3-l4-hint-text');
    this._ui.stageIndex = container.querySelector('#w3-l4-stage-index');
    this._ui.stageFocus = container.querySelector('#w3-l4-stage-focus');
    this._ui.tableHost = container.querySelector('#w3-l4-table');
    this._ui.beforeChartHost = container.querySelector('#w3-l4-before-chart');
    this._ui.afterChartHost = container.querySelector('#w3-l4-after-chart');
    this._ui.preview = container.querySelector('#w3-l4-preview');
    this._ui.previewTitle = container.querySelector('#w3-l4-preview-title');
    this._ui.previewCopy = container.querySelector('#w3-l4-preview-copy');
    this._ui.metricRows = container.querySelector('#w3-l4-metric-rows');
    this._ui.metricPeak = container.querySelector('#w3-l4-metric-peak');
    this._ui.metricVerdict = container.querySelector('#w3-l4-metric-verdict');
    this._ui.cardShell = container.querySelector('#w3-l4-card-shell');
    this._ui.controls = container.querySelector('#w3-l4-controls');
    this._ui.summary = container.querySelector('#w3-l4-summary');
    this._ui.summaryGrid = container.querySelector('#w3-l4-summary-grid');
    this._ui.finishButton = container.querySelector('#w3-l4-finish-btn');
    this._ui.trackerList = container.querySelector('#w3-l4-tracker-list');
    this._ui.trackerItems = Array.from(container.querySelectorAll('[data-scenario-id]'));

    this._mountWidgets();
    this._renderStage();
    this._syncProgress();
    this._syncTracker();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      const treatmentButton = event.target.closest('[data-treatment-choice]');
      if (treatmentButton) {
        this._selectTreatment(treatmentButton.getAttribute('data-treatment-choice'));
        return;
      }

      if (event.target.closest('#w3-l4-confirm-btn')) {
        this._confirmSelection();
        return;
      }

      if (event.target.closest('#w3-l4-next-btn')) {
        this._advanceDeck();
        return;
      }

      if (event.target.closest('#w3-l4-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w3-l4-reset-btn')) {
        this._resetDeck();
        return;
      }

      if (event.target.closest('#w3-l4-finish-btn')) {
        if (this._completed) {
          void this._engine.complete();
        }
      }
    }, { signal });
  }

  getHint(hintsUsed) {
    return LEVEL_HINTS[hintsUsed - 1] ?? scenarioAt(this._currentIndex, this._scenarios)?.retry ?? null;
  }

  pause() {}

  resume() {}

  teardown() {
    this._events?.abort();
    this._clearTimers();
    this._table?.destroy();
    this._beforeChart?.destroy();
    this._afterChart?.destroy();
    this._table = null;
    this._beforeChart = null;
    this._afterChart = null;
    this._ui = {};
  }

  _mountWidgets() {
    this._table = new DataTable(this._ui.tableHost, BASE_DF, {
      pageSize: BASE_DF.length,
      showIndex: false,
      showNullBadges: false,
      showRanges: true,
      showStatsButtons: false,
      sortable: false,
      compact: true,
      worldColor: 'var(--color-world-3)',
    });
    this._table.setOutlierMask(TARGET_COLUMN, BASE_MASK);

    this._beforeChart = new ChartWidget(this._ui.beforeChartHost, {
      type: 'dotplot',
      title: 'Before Treatment',
      data: chartEntriesFromFrame(BASE_DF),
      worldColor: 'var(--color-world-3)',
      height: 230,
      minWidth: 360,
      showGrid: true,
      scaleMode: 'distribution',
      valueFormatter: formatMoney,
      tickValues: [BASE_VALUES[0], UPPER_FENCE, OUTLIER_VALUE],
      band: {
        from: Math.max(LOWER_FENCE, Math.min(...BASE_VALUES)),
        to: UPPER_FENCE,
        label: 'IQR safe zone',
        tone: 'var(--color-world-1)',
        opacity: 0.14,
      },
      markers: [
        {
          value: UPPER_FENCE,
          label: `Upper fence ${formatMoney(UPPER_FENCE)}`,
          tone: 'var(--color-warning)',
        },
        {
          value: OUTLIER_VALUE,
          label: formatMoney(OUTLIER_VALUE),
          tone: 'var(--color-danger)',
        },
      ],
      connectors: [{
        from: UPPER_FENCE,
        to: OUTLIER_VALUE,
        label: `${formatMoney(OUTLIER_VALUE - UPPER_FENCE)} over fence`,
        tone: 'var(--color-danger)',
      }],
      ariaLabel: 'Raw dot plot before any outlier treatment.',
    });

    this._showBaseDatasetState();
  }

  _renderStage() {
    const scenario = scenarioAt(this._currentIndex, this._scenarios);
    if (!scenario) return;

    if (this._ui.stageIndex) {
      this._ui.stageIndex.textContent = `Card ${this._currentIndex + 1} / ${SCENARIOS.length}`;
    }

    if (this._ui.stageFocus) {
      this._ui.stageFocus.textContent = `Focus: ${scenario.focus}`;
    }

    const treatment = TREATMENTS[scenario.treatment];
    const solved = this._results.get(scenario.id);

    this._ui.cardShell.innerHTML = this._revealed
      ? `
        <article
          class="scenario-card w3-treatment-card w3-treatment-card--answer"
          data-card-face="back"
          data-scenario-visual="neutral"
        >
          <div class="w3-treatment-card__header">
            <p class="w3-treatment-card__eyebrow">Best Treatment</p>
            <h3 class="w3-treatment-card__title">${escapeHtml(treatment.label)}</h3>
            <span class="w3-treatment-card__strategy-tag">${escapeHtml(treatment.bestFor)}</span>
          </div>

          <div class="scenario-card__body w3-treatment-card__body">
            <p class="w3-treatment-card__reason">${escapeHtml(scenario.reason)}</p>
            <p class="w3-treatment-card__caution">${escapeHtml(scenario.caution)}</p>
          </div>

          <div class="scenario-card__meta w3-treatment-card__meta">
            ${escapeHtml(resultAttemptsLabel(solved?.attempts ?? 1))} - ${escapeHtml(scenario.focus)}
          </div>
        </article>
      `
      : `
        <article
          class="scenario-card w3-treatment-card"
          data-card-face="front"
          data-scenario-visual="neutral"
        >
          <div class="w3-treatment-card__header">
            <p class="w3-treatment-card__eyebrow">Scenario ${this._currentIndex + 1}</p>
            <h3 class="w3-treatment-card__title">${escapeHtml(scenario.title)}</h3>
          </div>

          <div class="scenario-card__body w3-treatment-card__body">
            <p>${escapeHtml(scenario.copy)}</p>
            <div class="w3-treatment-card__tags">
              ${scenario.tags.map(([label, value]) => `
                <article class="w3-treatment-card__tag">
                  <span class="w3-treatment-card__tag-label">${escapeHtml(label)}</span>
                  <strong class="w3-treatment-card__tag-value">${escapeHtml(value)}</strong>
                </article>
              `).join('')}
            </div>
          </div>

          <div class="scenario-card__meta w3-treatment-card__meta">
            Choose the safest treatment, then confirm it to preview the transformed table and distribution.
          </div>
        </article>
      `;

    this._renderControls();
  }

  _renderControls() {
    const scenario = scenarioAt(this._currentIndex, this._scenarios);
    if (!scenario || !this._ui.controls) return;

    const renderChoice = treatment => {
      const selected = this._selectedTreatment === treatment.id;
      const wrong = !selected && this._lastWrongTreatment === treatment.id;
      const correct = this._revealed && scenario.treatment === treatment.id;
      const disabled = this._revealed ? 'disabled' : '';

      return `
        <button
          class="w3-treatment-choice ${selected ? 'w3-treatment-choice--selected' : ''} ${wrong ? 'w3-treatment-choice--wrong' : ''} ${correct ? 'w3-treatment-choice--correct' : ''}"
          type="button"
          data-treatment-choice="${treatment.id}"
          data-treatment-card="${treatment.id}"
          ${disabled}
        >
          <div class="w3-treatment-choice__head">
            <span class="w3-treatment-choice__badge">${escapeHtml(treatment.shortLabel)}</span>
            <div>
              <span class="w3-treatment-choice__label">${escapeHtml(treatment.label)}</span>
              <span class="w3-treatment-choice__copy">${escapeHtml(treatment.bestFor)}</span>
            </div>
          </div>
          <p class="w3-treatment-choice__formula">${escapeHtml(treatment.formula)}</p>
          <p class="w3-treatment-choice__risk">Risk: ${escapeHtml(treatment.risk)}</p>
        </button>
      `;
    };

    this._ui.controls.innerHTML = `
      <div class="w3-treatment-choice-grid" role="group" aria-label="Outlier treatment choices">
        ${this._treatmentOrder.map(renderChoice).join('')}
      </div>

      <div class="w3-treatment-cta ${this._revealed ? 'w3-treatment-cta--revealed' : ''}">
        <p class="w3-treatment-inline-hint">
          ${escapeHtml(this._revealed
            ? TREATMENTS[scenario.treatment].previewCopy
            : this._lastWrongTreatment
              ? scenario.retry
              : 'Pick the treatment that fits the meaning of the outlier, not just the formula you remember.'
          )}
        </p>
        <button
          class="btn btn--primary"
          id="${this._revealed ? 'w3-l4-next-btn' : 'w3-l4-confirm-btn'}"
          type="button"
          ${!this._revealed && (!this._selectedTreatment || this._isTransitioning) ? 'disabled' : ''}
        >
          ${this._revealed
            ? this._currentIndex === SCENARIOS.length - 1 ? 'Open Recap' : 'Next Scenario'
            : 'Confirm Treatment'}
        </button>
      </div>
    `;
  }

  _selectTreatment(treatmentId) {
    if (this._revealed || this._isTransitioning || !TREATMENTS[treatmentId]) return;

    this._selectedTreatment = treatmentId;
    this._lastWrongTreatment = null;
    this._renderControls();
  }

  _confirmSelection() {
    const scenario = scenarioAt(this._currentIndex, this._scenarios);
    if (!scenario || this._revealed || this._isTransitioning || !this._selectedTreatment) return;

    const attempts = (this._attempts.get(scenario.id) ?? 0) + 1;
    this._attempts.set(scenario.id, attempts);

    if (this._selectedTreatment !== scenario.treatment) {
      this._lastWrongTreatment = this._selectedTreatment;
      this._selectedTreatment = null;
      this._setFeedback(`Try again. ${scenario.retry}`);
      this._setStatus('That treatment does not match the story. Decide whether the outlier is wrong, influential, or part of a wider skew pattern.');
      this._engine.mistake();
      this._renderControls();
      this._shakeCurrentCard();
      return;
    }

    this._results.set(scenario.id, {
      scenarioId: scenario.id,
      title: scenario.title,
      treatment: scenario.treatment,
      attempts,
      reason: scenario.reason,
    });

    this._engine.correct();
    this._setFeedback(`Correct. ${scenario.reason}`);
    this._setStatus(`${TREATMENTS[scenario.treatment].label} is locked in. Watch the before/after preview, then continue.`);
    this._syncProgress();
    this._syncTracker();
    this._flipCurrentCard();
  }

  _shakeCurrentCard() {
    const card = this._ui.cardShell?.querySelector('.scenario-card');
    if (!card) return;

    card.classList.remove('scenario-card--shake');
    void card.offsetWidth;
    card.classList.add('scenario-card--shake');
  }

  _flipCurrentCard() {
    const scenario = scenarioAt(this._currentIndex, this._scenarios);
    const card = this._ui.cardShell?.querySelector('.scenario-card');

    if (!card) {
      this._revealed = true;
      this._renderStage();
      this._runPreview(scenario?.treatment);
      return;
    }

    this._isTransitioning = true;
    card.classList.add('scenario-card--flip-out');

    window.setTimeout(() => {
      this._revealed = true;
      this._renderStage();
      this._runPreview(scenario?.treatment);

      const revealedCard = this._ui.cardShell?.querySelector('.scenario-card');
      revealedCard?.classList.add('scenario-card--flip-in');

      window.setTimeout(() => {
        this._isTransitioning = false;
      }, 240);
    }, 200);
  }

  _runPreview(treatmentId) {
    const treatment = TREATMENTS[treatmentId];
    if (!treatment) {
      this._showBaseDatasetState();
      return;
    }

    this._clearTimers();

    if (this._ui.preview) {
      this._ui.preview.dataset.previewState = 'live';
      this._ui.preview.dataset.treatmentMode = treatmentId;
    }

    if (this._ui.previewTitle) {
      this._ui.previewTitle.textContent = treatment.previewTitle;
    }

    if (this._ui.previewCopy) {
      this._ui.previewCopy.textContent = treatment.previewCopy;
    }

    if (treatmentId === 'suppress') {
      this._table?.update(treatment.afterDf, { type: 'filter' });
    } else if (treatmentId === 'cap') {
      this._table?.update(treatment.afterDf, { type: 'clip' });
    } else {
      this._table?.update(treatment.afterDf, { type: 'log1p' });
    }

    const newMask = Array.from({ length: treatment.afterDf.length }, () => false);
    this._table?.setOutlierMask(TARGET_COLUMN, newMask);

    this._renderAfterChart(treatmentId);
    this._animateMetrics(treatmentId);
  }

  _renderAfterChart(treatmentId) {
    const config = afterChartConfig(treatmentId);
    if (!config || !this._ui.afterChartHost) return;

    this._afterChart?.destroy();
    this._ui.afterChartHost.innerHTML = '';

    this._afterChart = new ChartWidget(this._ui.afterChartHost, {
      type: 'dotplot',
      ...config,
    });
  }

  _animateMetrics(treatmentId) {
    const treatment = TREATMENTS[treatmentId];
    if (!treatment) return;

    if (this._ui.metricRows) {
      this._ui.metricRows.textContent = '--';
    }
    if (this._ui.metricPeak) {
      this._ui.metricPeak.textContent = '--';
      this._ui.metricPeak.classList.remove('is-countdown');
    }
    if (this._ui.metricVerdict) {
      this._ui.metricVerdict.textContent = 'Applying treatment...';
    }

    this._schedule(() => {
      if (this._ui.metricRows) {
        this._ui.metricRows.textContent = String(treatment.metrics.rows);
      }
    }, 120);

    if (treatmentId === 'cap') {
      const countdownValues = [OUTLIER_VALUE, 72, 58, 46, CAPPED_MAX];
      if (this._ui.metricPeak) {
        this._ui.metricPeak.classList.add('is-countdown');
      }
      countdownValues.forEach((value, index) => {
        this._schedule(() => {
          if (this._ui.metricPeak) {
            this._ui.metricPeak.textContent = formatMoney(value);
          }
        }, 180 + (index * 120));
      });
    } else {
      const formatter = treatmentId === 'log' ? formatLogValue : formatMoney;
      this._schedule(() => {
        if (this._ui.metricPeak) {
          this._ui.metricPeak.textContent = formatter(treatment.metrics.peak);
        }
      }, 220);
    }

    this._schedule(() => {
      if (this._ui.metricVerdict) {
        this._ui.metricVerdict.textContent = treatment.metrics.verdict;
      }
    }, 260);
  }

  _showBaseDatasetState() {
    this._clearTimers();

    this._table?.update(BASE_DF);
    this._table?.setOutlierMask(TARGET_COLUMN, BASE_MASK);

    this._afterChart?.destroy();
    this._afterChart = null;

    if (this._ui.afterChartHost) {
      this._ui.afterChartHost.innerHTML = `
        <div class="w3-treatment-placeholder">
          <span class="w3-treatment-placeholder__badge">Awaiting Choice</span>
          <p>Pick the right treatment card below to preview the transformed distribution.</p>
        </div>
      `;
    }

    if (this._ui.preview) {
      this._ui.preview.dataset.previewState = 'idle';
      this._ui.preview.dataset.treatmentMode = 'idle';
    }

    if (this._ui.previewTitle) {
      this._ui.previewTitle.textContent = 'Choose a treatment to simulate the after-state';
    }

    if (this._ui.previewCopy) {
      this._ui.previewCopy.textContent = 'The left chart stays raw. The right chart and metrics wake up only after the correct treatment is locked in.';
    }

    if (this._ui.metricRows) {
      this._ui.metricRows.textContent = '--';
    }
    if (this._ui.metricPeak) {
      this._ui.metricPeak.textContent = '--';
      this._ui.metricPeak.classList.remove('is-countdown');
    }
    if (this._ui.metricVerdict) {
      this._ui.metricVerdict.textContent = 'Choose a treatment to reveal the reasoning and the transformed shape.';
    }
  }

  _advanceDeck() {
    if (!this._revealed || this._isTransitioning) return;

    if (this._currentIndex === SCENARIOS.length - 1) {
      this._revealSummary();
      return;
    }

    this._currentIndex += 1;
    this._treatmentOrder = shuffle(Object.values(TREATMENTS));
    this._revealed = false;
    this._selectedTreatment = null;
    this._lastWrongTreatment = null;
    this._showBaseDatasetState();
    this._setStatus(`Scenario ${this._currentIndex + 1} is live. Match the outlier story to the safest treatment before you confirm it.`);
    this._renderStage();
    this._syncTracker();
  }

  _revealSummary() {
    this._completed = true;

    if (this._ui.summaryGrid) {
      this._ui.summaryGrid.innerHTML = this._scenarios.map(scenario => {
        const result = this._results.get(scenario.id);
        const treatment = TREATMENTS[scenario.treatment];

        return `
          <article class="w3-treatment-summary__card">
            <div class="w3-treatment-summary__meta">
              <span class="w3-treatment-summary__badge">${escapeHtml(treatment.label)}</span>
              <span class="w3-treatment-summary__attempts">${escapeHtml(resultAttemptsLabel(result?.attempts ?? 1))}</span>
            </div>
            <h3 class="w3-treatment-summary__title">${escapeHtml(scenario.title)}</h3>
            <p class="w3-treatment-summary__copy">${escapeHtml(scenario.reason)}</p>
          </article>
        `;
      }).join('');
    }

    if (this._ui.summary) {
      this._ui.summary.hidden = false;
      requestAnimationFrame(() => {
        this._ui.summary.classList.add('is-revealed');
      });
      this._ui.summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    this._setFeedback(SUMMARY_COPY);
    this._setStatus('All three treatment calls are locked. Review the recap, then continue to the World 3 quiz.');
    this._syncProgress();
    this._syncTracker();
  }

  _showHint() {
    const { allowed, text } = this._engine.requestHint();
    if (!allowed || !text) return;

    this._ui.hintBox?.removeAttribute('hidden');
    if (this._ui.hintText) {
      this._ui.hintText.textContent = text;
    }
  }

  _resetDeck() {
    this._clearTimers();
    this._currentIndex = 0;
    this._scenarios = shuffle(SCENARIOS);
    this._treatmentOrder = shuffle(Object.values(TREATMENTS));
    this._selectedTreatment = null;
    this._lastWrongTreatment = null;
    this._revealed = false;
    this._completed = false;
    this._isTransitioning = false;
    this._attempts.clear();
    this._results.clear();

    if (this._ui.summary) {
      this._ui.summary.hidden = true;
      this._ui.summary.classList.remove('is-revealed');
    }

    if (this._ui.summaryGrid) {
      this._ui.summaryGrid.innerHTML = '';
    }

    if (this._ui.trackerList) {
      this._ui.trackerList.innerHTML = trackerMarkup(this._scenarios);
      this._ui.trackerItems = Array.from(this._ui.trackerList.querySelectorAll('[data-scenario-id]'));
    }

    this._showBaseDatasetState();
    this._renderStage();
    this._syncProgress();
    this._syncTracker();
    this._setFeedback(DEFAULT_FEEDBACK);
    this._setStatus(DEFAULT_STATUS);
  }

  _syncProgress() {
    if (this._ui.progress) {
      this._ui.progress.textContent = `${this._results.size} / ${SCENARIOS.length} treatment calls locked`;
    }

    if (this._ui.finishButton) {
      this._ui.finishButton.disabled = !this._completed;
    }
  }

  _syncTracker() {
    this._ui.trackerItems.forEach((item, index) => {
      const scenarioId = item.getAttribute('data-scenario-id');
      const status = item.querySelector(`[data-scenario-status="${scenarioId}"]`);
      const solved = this._results.has(scenarioId);
      const current = !solved && index === this._currentIndex && !this._completed;

      item.setAttribute('data-scenario-state', solved ? 'solved' : current ? 'current' : 'pending');

      if (status) {
        status.textContent = solved ? 'Locked In' : current ? 'Live' : 'Pending';
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

  _schedule(callback, delay) {
    const timerId = window.setTimeout(() => {
      this._timers.delete(timerId);
      callback();
    }, delay);

    this._timers.add(timerId);
    return timerId;
  }

  _clearTimers() {
    this._timers.forEach(timerId => window.clearTimeout(timerId));
    this._timers.clear();
  }
}
