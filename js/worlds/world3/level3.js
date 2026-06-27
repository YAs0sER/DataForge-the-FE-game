'use strict';

import { approxEqual } from '../../data/answers.js';
import { createDataset, DATASET_KEYS } from '../../data/datasets.js';
import { DataFrame } from '../../pandas/dataframe.js';
import { CalculatorWidget } from '../../widgets/calculator.js?v=20260616c';
import { ChartWidget } from '../../widgets/charts.js';

const LEVEL_TITLE = 'The Z-Score Method';
const LEVEL_OBJECTIVE = 'Use mean, standard deviation, and |z| > 3 to flag the extreme salary.';

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
const SALARY_SERIES = DATASET.col(SALARY_COLUMN);
const SORTED_SALARIES = SALARY_SERIES.values
  .filter(value => typeof value === 'number' && Number.isFinite(value))
  .sort((a, b) => a - b);
const SALARY_COUNT = SORTED_SALARIES.length;
const SALARY_SUM = SORTED_SALARIES.reduce((sum, value) => sum + value, 0);
const MEAN_VALUE = SALARY_SERIES.mean();
const STD_VALUE = SALARY_SERIES.std();
const OUTLIER_VALUE = Math.max(...SORTED_SALARIES);
const OUTLIER_INDEX = SORTED_SALARIES.lastIndexOf(OUTLIER_VALUE);
const OUTLIER_Z = (OUTLIER_VALUE - MEAN_VALUE) / STD_VALUE;
const Z_SCORES = SORTED_SALARIES.map(value => (value - MEAN_VALUE) / STD_VALUE);
const THRESHOLD = 3;
const Q1 = SALARY_SERIES.quantile(0.25);
const Q3 = SALARY_SERIES.quantile(0.75);
const IQR = Q3 - Q1;
const LOWER_FENCE = Q1 - (1.5 * IQR);
const UPPER_FENCE = Q3 + (1.5 * IQR);
const MAX_SALARY = OUTLIER_VALUE;
const MEAN_RATIO = MEAN_VALUE / MAX_SALARY;
const SIGMA_RATIO = Math.min((MEAN_VALUE + STD_VALUE) / MAX_SALARY, 1) - MEAN_RATIO;

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const LEVEL_HINTS = Object.freeze([
  'Start with the center: mu = sum(x) / n.',
  'For sample spread, use sigma = sqrt(sum((x - mu)^2) / (n - 1)).',
  'Standardize the candidate with z = (x - mu) / sigma, then compare |z| with the threshold.',
]);

const DEFAULT_FEEDBACK = 'Start with the mean, then measure the spread with standard deviation before you standardize the extreme salary.';
const DEFAULT_STATUS = 'Lock the mean first. The standard deviation and extreme-value z-score unlock in sequence.';
const SUMMARY_COPY = 'Z-scores describe distance from the mean in standard deviation units. They still catch the rogue salary here, but the skewed distribution makes IQR the safer default rule.';

const TASKS = Object.freeze([
  {
    id: 'mean',
    label: 'Mean (mu)',
    buttonLabel: 'Lock Mean',
    cue: 'mu',
    prompt: `Average all ${SALARY_COUNT} salaries. This method includes the extreme salary, so the center will shift upward.`,
    formula: 'mu = sum(x) / n',
    expected: MEAN_VALUE,
    tolerance: 0.01,
    success: `mu = ${formatMoney(MEAN_VALUE)}. The rogue salary pulls the center far to the right of the main cluster.`,
    retry: 'That mean is off. Apply mu = sum(x) / n to the complete salary column.',
    lockedCopy: 'Ready to solve.',
  },
  {
    id: 'std',
    label: 'Standard Deviation (sigma)',
    buttonLabel: 'Lock Sigma',
    cue: 'sigma',
    prompt: 'Use the sample standard deviation rule from the code layer so the spread reflects how violently one salary stretches the distribution.',
    formula: 'sigma = sqrt(sum((x - mu)^2) / (n - 1))',
    expected: STD_VALUE,
    tolerance: 0.5,
    success: `sigma = ${formatNumber(STD_VALUE)}. One extreme salary makes the spread explode compared with the tight core cluster.`,
    retry: 'That spread is off. Use the same sample standard deviation rule as the project code: subtract the mean, square the gaps, divide by n - 1, then square-root.',
    lockedCopy: 'Unlock mean first.',
    requires: ['mean'],
  },
  {
    id: 'z',
    label: 'Extreme Value Z Score',
    buttonLabel: 'Lock Z Score',
    cue: '|z| > 3',
    prompt: 'Standardize the extreme salary, then compare its absolute z score with the threshold.',
    formula: 'z = (x - mu) / sigma',
    expected: OUTLIER_Z,
    tolerance: 0.05,
    success: `z = ${formatSigned(OUTLIER_Z)}. Because |z| is greater than ${THRESHOLD}, the salary is flagged as an outlier.`,
    retry: 'That z-score is off. Subtract the mean from the extreme salary, then divide by the sample standard deviation you just locked.',
    lockedCopy: 'Unlock mean and sigma first.',
    requires: ['mean', 'std'],
  },
]);

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

function formatSigned(value, digits = 2) {
  const rounded = Number(value.toFixed(digits));
  return `${rounded >= 0 ? '+' : ''}${rounded.toString()}`;
}

function taskById(taskId) {
  return TASKS.find(task => task.id === taskId) ?? null;
}

export default class World3Level3 {
  meta = {
    title: LEVEL_TITLE,
    subtitle: LEVEL_OBJECTIVE,
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._events = null;
    this._calculator = null;
    this._comparisonChart = null;
    this._solved = new Set();
    this._completed = false;
    this._comparisonMode = 'z';
    this._ui = {};
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w3-level w3-level--zscore-lab screen-section" aria-label="World 3 Level 3">
        <div class="level-hero w3-level__hero" style="--world-color: var(--color-world-3);">
          <p class="eyebrow">World 3 - Outliers</p>
          <h1 class="level-hero__title">${escapeHtml(LEVEL_TITLE)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(LEVEL_OBJECTIVE)}
            This lab uses the same salary dataset, but now the extreme point must be justified as a standard-deviation event instead of a quartile breach.
          </p>
          <div class="action-row">
            <span class="status-box" id="w3-l3-progress">0 / ${TASKS.length} z-score checks locked</span>
            <span class="status-box" id="w3-l3-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w3-l3-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w3-l3-reset-btn" type="button">Reset Lab</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">03</span>
        </div>

        <div class="w3-zscore-layout">
          <article class="panel w3-zscore-visual-panel">
            <div class="w3-level__panel-head">
              <div>
                <p class="eyebrow">Z Score Lab</p>
                <h2 class="panel-title">Translate the salary spike into mean, spread, and standardized distance</h2>
              </div>
              <p class="w3-level__microcopy">
                The left board keeps the original salaries on the raw scale. The right board gradually reveals their z scores, so you can see which point breaks the |z| > ${THRESHOLD} rule.
              </p>
            </div>

            <div class="w3-fence-snapshot" aria-label="Z Score Snapshot">
              <article class="w3-fence-snapshot__card">
                <span class="w3-fence-snapshot__label">Rows In Play</span>
                <strong class="w3-fence-snapshot__value">${SALARY_COUNT}</strong>
              </article>
              <article class="w3-fence-snapshot__card">
                <span class="w3-fence-snapshot__label">Threshold Rule</span>
                <strong class="w3-fence-snapshot__value">|z| > ${THRESHOLD}</strong>
              </article>
              <article class="w3-fence-snapshot__card">
                <span class="w3-fence-snapshot__label">Extreme Salary</span>
                <strong class="w3-fence-snapshot__value" data-tone="danger">${escapeHtml(formatMoney(OUTLIER_VALUE))}</strong>
              </article>
            </div>

            <div class="w3-zscore-visual-host" id="w3-l3-visual-host"></div>
          </article>

          <div class="w3-fence-side">
            <article class="panel w3-fence-calc-panel">
              <div class="w3-level__panel-head">
                <div>
                  <p class="eyebrow">Standardization Console</p>
                  <h2 class="panel-title">Use helper actions, then lock the three checkpoint answers manually</h2>
                </div>
                <p class="w3-level__microcopy">
                  Sum and Count expose the mean fast. After that, the standard deviation and z-score steps show how strongly the rogue salary distorts the distribution.
                </p>
              </div>

              <div class="w3-zscore-calc-host" id="w3-l3-calculator"></div>
            </article>

            <article class="panel w3-fence-tracker" aria-label="Z Score Tracker">
              <div class="w3-level__panel-head">
                <div>
                  <p class="eyebrow">Checkpoint Tracker</p>
                  <h2 class="panel-title">Center first, spread second, outlier verdict last</h2>
                </div>
                <p class="w3-level__microcopy">
                  Each correct checkpoint unlocks the next one, just like a real diagnostic workflow where scale depends on center and z depends on both.
                </p>
              </div>

              <div class="w3-fence-tasklist">
                ${TASKS.map(task => `
                  <form class="w3-fence-task" data-task-id="${task.id}" data-task-state="pending" novalidate>
                    <div class="w3-fence-task__meta">
                      <span class="w3-fence-task__status" data-task-status="${task.id}">Pending</span>
                      <span class="w3-fence-task__cue">${escapeHtml(task.cue)}</span>
                    </div>
                    <h3 class="w3-fence-task__title">${escapeHtml(task.label)}</h3>
                    <p class="w3-fence-task__prompt">${escapeHtml(task.prompt)}</p>
                    <p class="w3-fence-task__formula">${escapeHtml(task.formula)}</p>

                    <div class="w3-fence-task__entry">
                      <label class="w3-fence-task__field">
                        <span class="sr-only">${escapeHtml(task.label)} answer</span>
                        <input
                          class="w3-fence-input"
                          data-task-input="${task.id}"
                          inputmode="decimal"
                          autocomplete="off"
                          placeholder="Enter value"
                          type="text"
                        >
                      </label>
                      <button class="btn btn--primary" data-task-submit="${task.id}" type="submit">${escapeHtml(task.buttonLabel)}</button>
                    </div>

                    <p class="w3-fence-task__result" data-task-result="${task.id}">${escapeHtml(task.lockedCopy)}</p>
                  </form>
                `).join('')}
              </div>
            </article>

            <div class="w3-zscore-support">
              <section class="card card--elevated w3-level__feedback" aria-live="polite">
                <p class="eyebrow">Coach Feed</p>
                <p id="w3-l3-feedback-text" class="w3-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
              </section>

              <section class="card w3-level__hint-box" id="w3-l3-hint-box" hidden>
                <p class="eyebrow">Hint</p>
                <p id="w3-l3-hint-text" class="w3-level__hint-copy"></p>
              </section>

              <section class="card w3-zscore-guide">
                <p class="eyebrow">What To Watch</p>
                <div class="w3-zscore-guide__steps">
                  <article class="w3-zscore-guide__step">
                    <span class="w3-zscore-guide__badge">1</span>
                    <p class="w3-zscore-guide__copy">Z scores ask how many standard deviations away from the mean a value lives.</p>
                  </article>
                  <article class="w3-zscore-guide__step">
                    <span class="w3-zscore-guide__badge">2</span>
                    <p class="w3-zscore-guide__copy">Skew can inflate both the mean and the spread, which is why IQR is still worth comparing on the same dataset.</p>
                  </article>
                </div>
              </section>
            </div>
          </div>
        </div>

        <section class="panel w3-fence-summary" id="w3-l3-summary" hidden aria-label="Z Score Summary">
          <div class="w3-level__panel-head">
            <div>
              <p class="eyebrow">Z Score Recap</p>
              <h2 class="panel-title">The rogue salary is more than three standard deviations from the mean</h2>
            </div>
            <p class="w3-level__microcopy">${escapeHtml(SUMMARY_COPY)}</p>
          </div>

          <div class="w3-fence-summary__grid">
            <article class="w3-fence-summary__card" style="--topic-color: var(--color-world-3);">
              <p class="w3-fence-summary__kicker">Center</p>
              <div class="w3-fence-summary__meta">
                <span class="w3-fence-summary__state">Locked In</span>
                <span class="w3-fence-summary__topic">Mean</span>
              </div>
              <h3 class="w3-fence-summary__title">${escapeHtml(formatMoney(MEAN_VALUE))}</h3>
              <p class="w3-fence-summary__copy">The outlier drags the average well above the normal salary cluster, which is why z-score methods assume the distribution shape is still worth trusting.</p>
            </article>

            <article class="w3-fence-summary__card" style="--topic-color: var(--color-world-1);">
              <p class="w3-fence-summary__kicker">Spread</p>
              <div class="w3-fence-summary__meta">
                <span class="w3-fence-summary__state">Locked In</span>
                <span class="w3-fence-summary__topic">Sigma</span>
              </div>
              <h3 class="w3-fence-summary__title">${escapeHtml(formatNumber(STD_VALUE))}</h3>
              <p class="w3-fence-summary__copy">Sample standard deviation captures how much the rogue salary stretches the data away from its average center.</p>
            </article>

            <article class="w3-fence-summary__card" style="--topic-color: var(--color-danger);">
              <p class="w3-fence-summary__kicker">Verdict</p>
              <div class="w3-fence-summary__meta">
                <span class="w3-fence-summary__state">Flagged</span>
                <span class="w3-fence-summary__topic">|z| > ${THRESHOLD}</span>
              </div>
              <h3 class="w3-fence-summary__title">${escapeHtml(formatSigned(OUTLIER_Z))}</h3>
              <p class="w3-fence-summary__copy">${escapeHtml(formatMoney(OUTLIER_VALUE))} clears the z-score threshold, but the comparison panel shows why IQR stays safer on heavily skewed salary data.</p>
            </article>
          </div>

          <div class="action-row">
            <span class="status-box">Both z score and IQR catch the same rogue salary here.</span>
            <button class="btn btn--primary" id="w3-l3-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w3-l3-progress');
    this._ui.status = container.querySelector('#w3-l3-status');
    this._ui.feedback = container.querySelector('#w3-l3-feedback-text');
    this._ui.hintBox = container.querySelector('#w3-l3-hint-box');
    this._ui.hintText = container.querySelector('#w3-l3-hint-text');
    this._ui.calculatorHost = container.querySelector('#w3-l3-calculator');
    this._ui.visualHost = container.querySelector('#w3-l3-visual-host');
    this._ui.summary = container.querySelector('#w3-l3-summary');
    this._ui.finishButton = container.querySelector('#w3-l3-finish-btn');

    this._mountCalculator();
    this._renderVisualWorkspace();
    this._syncTaskUi();
    this._syncProgress();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w3-l3-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w3-l3-reset-btn')) {
        this._resetLab();
        return;
      }

      const compareButton = event.target.closest('[data-compare-mode]');
      if (compareButton) {
        this._setComparisonMode(compareButton.getAttribute('data-compare-mode'));
        return;
      }

      if (event.target.closest('#w3-l3-finish-btn')) {
        if (this._completed) {
          void this._engine.complete();
        }
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
    this._comparisonChart?.destroy();
    this._calculator = null;
    this._comparisonChart = null;
    this._solved.clear();
    this._ui = {};
  }

  _mountCalculator() {
    this._calculator?.destroy();
    this._calculator = new CalculatorWidget(this._ui.calculatorHost, {
      title: 'Z Score Console',
      dataset: SORTED_SALARIES,
      worldColor: 'var(--color-world-3)',
      onSpecial: payload => this._handleSpecialAction(payload),
      onResult: payload => this._handleCalculation(payload),
    });
  }

  _handleSpecialAction(payload) {
    if (!payload) return;

    if (payload.action === 'Sum') {
      this._setFeedback(`The full salary sum is ${formatNumber(SALARY_SUM)}. Divide by ${SALARY_COUNT} to lock the mean before you standardize anything.`);
      this._setStatus('Mean checkpoint is ready once you divide the full sum by all rows.');
      return;
    }

    if (payload.action === 'Count') {
      this._setFeedback(`There are ${SALARY_COUNT} salaries in play. The standard deviation step uses n - 1 = ${SALARY_COUNT - 1} in the denominator because the code layer uses sample standard deviation.`);
      this._setStatus('Count locked. Use it in both the mean and sample-spread formulas.');
      return;
    }

    if (payload.action === 'Sort') {
      this._setFeedback('The salary deck is already sorted from the smallest normal salary up to the single extreme outlier, so the z-score column can be read from the same ordering.');
      this._setStatus('Sorting is already done. Focus on the center, spread, and standardized distance.');
    }
  }

  _handleCalculation(payload) {
    if (!payload || typeof payload.result !== 'number' || Number.isNaN(payload.result)) return;

    const match = TASKS.find(task => !this._solved.has(task.id) && approxEqual(payload.result, task.expected, task.tolerance ?? 0.01));
    if (!match) return;

    const nextTask = TASKS.find(task => !this._solved.has(task.id) && task.id !== match.id);
    this._setFeedback(`${match.success} Lock it into the ${match.label.toLowerCase()} card when you are ready.`);

    if (nextTask) {
      this._setStatus(`${match.label} is numerically ready. Next up: ${nextTask.label}.`);
      return;
    }

    this._setStatus('The final z-score is numerically ready. Lock it in to reveal the outlier verdict and compare it with IQR.');
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
    this._renderVisualWorkspace();

    const remainingTask = TASKS.find(taskDef => !this._solved.has(taskDef.id));
    if (remainingTask) {
      this._setStatus(`${task.label} is solved. Next up: ${remainingTask.label}.`);
      return;
    }

    this._completed = true;
    this._syncProgress();
    this._setStatus('All three z-score checks are complete. Compare the IQR view if you want, then continue.');
    this._revealSummary();
  }

  _renderVisualWorkspace() {
    if (!this._ui.visualHost) return;

    this._comparisonChart?.destroy();
    this._comparisonChart = null;

    const meanSolved = this._solved.has('mean');
    const stdSolved = this._solved.has('std');
    const zSolved = this._solved.has('z');

    this._ui.visualHost.innerHTML = `
      <div class="w3-zscore-board">
        <section class="card w3-zscore-signal-panel">
          <div class="w3-zscore-board__head">
            <div>
              <p class="eyebrow">Original Salary Signal</p>
              <h3 class="panel-title">The raw scale still shows one salary tearing away from the cluster</h3>
            </div>
            <div class="w3-zscore-board__badges">
              <span class="status-box">${meanSolved ? `mu = ${formatMoney(MEAN_VALUE)}` : 'mu hidden'}</span>
              <span class="status-box">${stdSolved ? `sigma = ${formatNumber(STD_VALUE, 2)}` : 'sigma locked'}</span>
            </div>
          </div>

          <div
            class="w3-zscore-signal-stack"
            data-show-mean="${meanSolved ? 'true' : 'false'}"
            data-show-sigma="${stdSolved ? 'true' : 'false'}"
            data-show-outlier="${zSolved ? 'true' : 'false'}"
            style="--mean-ratio:${MEAN_RATIO}; --sigma-width:${Math.max(SIGMA_RATIO, 0.02)};"
          >
            <div class="w3-zscore-signal-stack__overlay" aria-hidden="true">
              <span class="w3-zscore-signal-stack__mean-line"></span>
              <span class="w3-zscore-signal-stack__mean-label">mu</span>
              <span class="w3-zscore-signal-stack__sigma-line"></span>
              <span class="w3-zscore-signal-stack__sigma-label">+1 sigma</span>
            </div>

            ${SORTED_SALARIES.map((value, index) => `
              <div class="w3-zscore-row ${zSolved && index === OUTLIER_INDEX ? 'is-outlier' : ''}">
                <div class="w3-zscore-row__meta">
                  <span class="w3-zscore-row__slot">Slot ${index + 1}</span>
                  <strong class="w3-zscore-row__salary">${escapeHtml(formatMoney(value))}</strong>
                </div>
                <div class="w3-zscore-row__track">
                  <span class="w3-zscore-row__fill" style="--fill-ratio:${Math.max(value / MAX_SALARY, 0.04)};"></span>
                </div>
              </div>
            `).join('')}
          </div>

          <p class="w3-zscore-signal-note">
            ${stdSolved
              ? `The raw scale shows why z-score methods can be tricky on skewed data: mu lands at ${formatMoney(MEAN_VALUE)}, but one extreme point still dominates the spread.`
              : 'Lock the mean and sigma checkpoints to reveal the center line and the first standard deviation step on the raw salary scale.'}
          </p>
        </section>

        <section class="card w3-zscore-zpanel">
          <div class="w3-zscore-board__head">
            <div>
              <p class="eyebrow">Transformed Z Column</p>
              <h3 class="panel-title">Standardized distance from the mean</h3>
            </div>
            <span class="status-box">${zSolved ? '|z| verdict unlocked' : 'extreme row still waiting'}</span>
          </div>

          <div class="w3-zscore-zlist">
            ${SORTED_SALARIES.map((value, index) => {
              const zScore = Z_SCORES[index];
              const ready = stdSolved && (zSolved || index !== OUTLIER_INDEX);
              const state = zSolved && Math.abs(zScore) > THRESHOLD
                ? 'danger'
                : ready
                  ? 'ready'
                  : 'locked';

              return `
                <article class="w3-zscore-zrow" data-row-state="${state}">
                  <div class="w3-zscore-zrow__meta">
                    <span class="w3-zscore-zrow__slot">Slot ${index + 1}</span>
                    <span class="w3-zscore-zrow__salary">${escapeHtml(formatMoney(value))}</span>
                  </div>
                  <strong class="w3-zscore-zrow__value">
                    ${ready ? escapeHtml(formatSigned(zScore)) : index === OUTLIER_INDEX && stdSolved ? '?' : '--'}
                  </strong>
                </article>
              `;
            }).join('')}
          </div>
        </section>
      </div>

      <section class="w3-fence-callout" ${zSolved ? '' : 'hidden'} aria-live="polite">
        <div class="w3-fence-callout__meta">
          <span class="w3-fence-callout__pill">Outlier Flagged</span>
          <span class="w3-fence-callout__pill">|z| = ${escapeHtml(formatNumber(Math.abs(OUTLIER_Z), 2))}</span>
        </div>
        <h3 class="w3-fence-callout__title">${escapeHtml(formatMoney(OUTLIER_VALUE))} sits ${escapeHtml(formatNumber(Math.abs(OUTLIER_Z), 2))} standard deviations above the mean.</h3>
        <p class="w3-fence-callout__copy">
          The raw salary spike now has a standardized explanation. Because |z| is greater than ${THRESHOLD}, the extreme salary is flagged, but the comparison toggle below explains why IQR still stays safer on skewed data.
        </p>
      </section>

      <section class="card w3-zscore-compare" data-compare-locked="${zSolved ? 'false' : 'true'}">
        <div class="w3-zscore-compare__head">
          <div>
            <p class="eyebrow">Method Comparison</p>
            <h3 class="panel-title">Switch between the z-score verdict and the IQR fence on the same dataset</h3>
          </div>
          <div class="w3-zscore-compare__tabs">
            <button
              class="btn ${this._comparisonMode === 'z' ? 'btn--primary' : 'btn--subtle btn--sm'}"
              type="button"
              data-compare-mode="z"
              ${zSolved ? '' : 'disabled'}
            >
              Z-Score View
            </button>
            <button
              class="btn ${this._comparisonMode === 'iqr' ? 'btn--primary' : 'btn--subtle btn--sm'}"
              type="button"
              data-compare-mode="iqr"
              ${zSolved ? '' : 'disabled'}
            >
              IQR View
            </button>
          </div>
        </div>

        <div class="w3-zscore-compare__stage" id="w3-l3-compare-stage">
          ${this._renderComparisonStage(zSolved)}
        </div>
      </section>
    `;

    if (zSolved && this._comparisonMode === 'iqr') {
      const chartHost = this._ui.visualHost.querySelector('#w3-l3-iqr-chart');
      if (chartHost) {
        this._mountComparisonChart(chartHost);
      }
    }
  }

  _renderComparisonStage(zSolved) {
    if (!zSolved) {
      return `
        <p class="w3-zscore-compare__locked-copy">
          Solve the final z-score checkpoint first. Once the outlier verdict is locked, you can swap over to the IQR lens and compare both methods on the same salary deck.
        </p>
      `;
    }

    if (this._comparisonMode === 'iqr') {
      return `
        <div class="w3-zscore-compare__iqr">
          <div class="w3-zscore-compare__iqr-head">
            <span class="status-box">Upper fence = ${escapeHtml(formatMoney(UPPER_FENCE))}</span>
            <span class="status-box">Preferred on skewed data</span>
          </div>
          <div class="w3-zscore-compare__iqr-chart" id="w3-l3-iqr-chart"></div>
          <p class="w3-zscore-compare__copy">
            IQR ignores the exact mean and standard deviation. That makes it more robust when a financial distribution is stretched by a dramatic right tail like this one.
          </p>
        </div>
      `;
    }

    return `
      <div class="w3-zscore-compare__zview">
        <div class="w3-zscore-threshold">
          <div class="w3-zscore-threshold__rail">
            <span class="w3-zscore-threshold__tick" style="--tick-position:0;">-3</span>
            <span class="w3-zscore-threshold__tick" style="--tick-position:0.5;">0</span>
            <span class="w3-zscore-threshold__tick" style="--tick-position:1;">+3</span>
            <span class="w3-zscore-threshold__marker" style="--marker-position:${Math.min(Math.abs(OUTLIER_Z) / THRESHOLD, 1.25)};"></span>
          </div>
        </div>

        <div class="w3-zscore-compare__cards">
          <article class="w3-zscore-compare__card">
            <span class="w3-zscore-compare__label">Mean</span>
            <strong>${escapeHtml(formatMoney(MEAN_VALUE))}</strong>
          </article>
          <article class="w3-zscore-compare__card">
            <span class="w3-zscore-compare__label">Sigma</span>
            <strong>${escapeHtml(formatNumber(STD_VALUE, 2))}</strong>
          </article>
          <article class="w3-zscore-compare__card" data-tone="danger">
            <span class="w3-zscore-compare__label">Extreme |z|</span>
            <strong>${escapeHtml(formatNumber(Math.abs(OUTLIER_Z), 2))}</strong>
          </article>
        </div>

        <p class="w3-zscore-compare__copy">
          The outlier clears the classic |z| > ${THRESHOLD} alarm, but because the mean and sigma are both distorted by the rogue point, tree-safe preprocessing often prefers the IQR fence for skewed salary data.
        </p>
      </div>
    `;
  }

  _mountComparisonChart(host) {
    const chartData = SORTED_SALARIES.map((value, index) => ({
      value,
      color: index === OUTLIER_INDEX ? 'var(--color-danger)' : 'var(--color-world-1)',
      state: index === OUTLIER_INDEX ? 'danger' : 'default',
      tooltip: `Salary: ${formatMoney(value)}`,
      ariaLabel: index === OUTLIER_INDEX
        ? `Outlier salary ${formatMoney(value)}`
        : `Salary ${formatMoney(value)}`,
    }));

    this._comparisonChart = new ChartWidget(host, {
      type: 'dotplot',
      title: 'IQR Comparison',
      data: chartData,
      worldColor: 'var(--color-world-3)',
      height: 260,
      minWidth: 720,
      showGrid: true,
      scaleMode: 'distribution',
      tickValues: [SORTED_SALARIES[0], Q1, Q3, UPPER_FENCE, OUTLIER_VALUE],
      valueFormatter: formatMoney,
      band: {
        from: Math.max(LOWER_FENCE, SORTED_SALARIES[0]),
        to: UPPER_FENCE,
        label: 'IQR safe zone',
        tone: 'var(--color-world-1)',
        opacity: 0.14,
      },
      markers: [
        {
          value: UPPER_FENCE,
          label: `Upper fence ${formatMoney(UPPER_FENCE)}`,
          tone: 'var(--color-world-1)',
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
        label: `${formatMoney(OUTLIER_VALUE - UPPER_FENCE)} beyond fence`,
        tone: 'var(--color-danger)',
      }],
      ariaLabel: 'Dot plot showing the same salary deck with the IQR upper fence and one extreme outlier beyond it.',
    });
  }

  _setComparisonMode(mode) {
    if (!this._solved.has('z')) return;
    if (mode !== 'z' && mode !== 'iqr') return;
    if (this._comparisonMode === mode) return;

    this._comparisonMode = mode;
    this._renderVisualWorkspace();
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
        input.value = formatNumber(task.expected);
      } else if (locked) {
        input.value = '';
      }
    });
  }

  _syncProgress() {
    if (this._ui.progress) {
      this._ui.progress.textContent = `${this._solved.size} / ${TASKS.length} z-score checks locked`;
    }

    if (this._ui.finishButton) {
      this._ui.finishButton.disabled = !this._completed;
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
    this._completed = false;
    this._comparisonMode = 'z';

    this._container?.querySelectorAll('.w3-fence-input').forEach(input => {
      input.value = '';
      input.classList.remove('is-error', 'is-solved');
    });

    if (this._ui.summary) {
      this._ui.summary.hidden = true;
      this._ui.summary.classList.remove('is-revealed');
    }

    this._comparisonChart?.destroy();
    this._comparisonChart = null;
    this._mountCalculator();
    this._renderVisualWorkspace();
    this._syncTaskUi();
    this._syncProgress();
    this._setFeedback(DEFAULT_FEEDBACK);
    this._setStatus(DEFAULT_STATUS);
  }

  _revealSummary() {
    if (!this._ui.summary) return;

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
