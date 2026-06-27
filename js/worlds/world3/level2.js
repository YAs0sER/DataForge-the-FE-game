'use strict';

import { approxEqual } from '../../data/answers.js';
import { createDataset, DATASET_KEYS } from '../../data/datasets.js';
import { getLevelProblem } from '../../data/problems.js';
import { DataFrame } from '../../pandas/dataframe.js';
import { CalculatorWidget } from '../../widgets/calculator.js?v=20260616c';

const PROBLEM = getLevelProblem(3, 2);

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
const SORTED_SALARIES = DATASET.col(SALARY_COLUMN).values
  .filter(value => typeof value === 'number' && Number.isFinite(value))
  .sort((a, b) => a - b);
const SALARY_COUNT = SORTED_SALARIES.length;

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function quantileDetails(q) {
  const position = q * (SORTED_SALARIES.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const fraction = position - lowerIndex;
  const lowerValue = SORTED_SALARIES[lowerIndex];
  const upperValue = SORTED_SALARIES[upperIndex];
  const value = lowerValue + fraction * (upperValue - lowerValue);

  return Object.freeze({
    q,
    position,
    lowerIndex,
    upperIndex,
    lowerSlot: lowerIndex + 1,
    upperSlot: upperIndex + 1,
    lowerValue,
    upperValue,
    fraction,
    value,
  });
}

const Q1 = quantileDetails(0.25);
const Q3 = quantileDetails(0.75);
const IQR = Q3.value - Q1.value;
const LOWER_FENCE = Q1.value - (1.5 * IQR);
const UPPER_FENCE = Q3.value + (1.5 * IQR);
const FLAGGED_OUTLIERS = SORTED_SALARIES.filter(value => value < LOWER_FENCE || value > UPPER_FENCE);
const FLAGGED_OUTLIER = FLAGGED_OUTLIERS[0];

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM?.hints ?? []),
  'Use the position rule q x (n - 1), then interpolate between the values on either side of that position.',
  'For interpolation, use lower value + fraction x (upper value - lower value).',
]);

const DEFAULT_FEEDBACK = 'Sort the salaries mentally, lock Q1 and Q3, then use the spread between them to build the fences.';
const DEFAULT_STATUS = 'Start with Q1 and Q3. The IQR and fence checkpoints unlock after the quartiles are solved.';
const SUMMARY_COPY = 'The salary that looked suspicious visually in Level 1 is now provably outside the upper fence. The next levels focus on how to treat that kind of point.';

const TASKS = Object.freeze([
  {
    id: 'q1',
    label: 'Q1 (25th percentile)',
    buttonLabel: 'Lock Q1',
    cue: '25th percentile',
    formula: 'position = 0.25 x (n - 1)',
    expected: Q1.value,
    success: `Q1 = ${formatMoney(Q1.value)}. It sits halfway between ${formatMoney(Q1.lowerValue)} and ${formatMoney(Q1.upperValue)}.`,
    retry: 'That Q1 is off. Use the quartile position rule, then interpolate if the position falls between values.',
    lockedCopy: 'Ready to solve.',
  },
  {
    id: 'q3',
    label: 'Q3 (75th percentile)',
    buttonLabel: 'Lock Q3',
    cue: '75th percentile',
    formula: 'position = 0.75 x (n - 1)',
    expected: Q3.value,
    success: `Q3 = ${formatMoney(Q3.value)}. It sits halfway between ${formatMoney(Q3.lowerValue)} and ${formatMoney(Q3.upperValue)}.`,
    retry: 'That Q3 is off. Use the quartile position rule, then interpolate if the position falls between values.',
    lockedCopy: 'Ready to solve.',
  },
  {
    id: 'iqr',
    label: 'Interquartile Range',
    buttonLabel: 'Lock IQR',
    cue: 'Q3 - Q1',
    formula: 'IQR = Q3 - Q1',
    expected: IQR,
    success: `IQR = ${formatMoney(IQR)}. The middle half of the salaries spans ${formatMoney(IQR)}.`,
    retry: 'That spread is off. Subtract Q1 from Q3 and keep the currency units aligned.',
    lockedCopy: 'Unlock Q1 and Q3 first.',
    requires: ['q1', 'q3'],
  },
  {
    id: 'lower',
    label: 'Lower Fence',
    buttonLabel: 'Lock Lower Fence',
    cue: 'Lower boundary',
    formula: 'lower = Q1 - (1.5 x IQR)',
    expected: LOWER_FENCE,
    success: `Lower fence = ${formatMoney(LOWER_FENCE)}. No salary falls below that boundary in this sample.`,
    retry: 'That lower fence is off. Start from Q1 and move down by 1.5 x IQR.',
    lockedCopy: 'Unlock Q1 and IQR first.',
    requires: ['q1', 'iqr'],
  },
  {
    id: 'upper',
    label: 'Upper Fence',
    buttonLabel: 'Lock Upper Fence',
    cue: 'Upper boundary',
    formula: 'upper = Q3 + (1.5 x IQR)',
    expected: UPPER_FENCE,
    success: `Upper fence = ${formatMoney(UPPER_FENCE)}. Anything above that line becomes an outlier candidate.`,
    retry: 'That upper fence is off. Start from Q3 and move up by 1.5 x IQR.',
    lockedCopy: 'Unlock Q3 and IQR first.',
    requires: ['q3', 'iqr'],
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

function formatNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  return Number(value.toFixed(4)).toString();
}

function taskById(taskId) {
  return TASKS.find(task => task.id === taskId) ?? null;
}

function totalProgress(solvedTaskCount, outlierLocked) {
  return solvedTaskCount + Number(outlierLocked);
}

export default class World3Level2 {
  meta = {
    title: PROBLEM?.title ?? 'IQR by Hand',
    subtitle: PROBLEM?.objective ?? 'Compute quartiles, IQR, and the lower/upper fences manually.',
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._events = null;
    this._calculator = null;
    this._solved = new Set();
    this._outlierLocked = false;
    this._completed = false;
    this._ui = {};
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w3-level w3-level--fence-lab screen-section" aria-label="World 3 Level 2">
        <div class="level-hero w3-level__hero" style="--world-color: var(--color-world-3);">
          <p class="eyebrow">World 3 - Outliers</p>
          <h1 class="level-hero__title">${escapeHtml(PROBLEM.title)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(PROBLEM.objective)}
            This time the suspicious salary must survive a full quartile and fence calculation before you are allowed to flag it.
          </p>
          <div class="action-row">
            <span class="status-box" id="w3-l2-progress">0 / ${TASKS.length + 1} fence checkpoints locked</span>
            <span class="status-box" id="w3-l2-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w3-l2-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w3-l2-reset-btn" type="button">Reset Lab</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">02</span>
        </div>

        <div class="w3-fence-layout">
          <article class="panel w3-fence-workbook">
            <div class="w3-level__panel-head">
              <div>
                <p class="eyebrow">Fence Workbook</p>
                <h2 class="panel-title">Turn the salary cluster into quartiles, spread, and hard boundaries</h2>
              </div>
              <p class="w3-level__microcopy">
                The level follows the same quantile convention as the pandas layer in this project: position = q x (n - 1), then interpolate when the position falls between two ordered salaries.
              </p>
            </div>

            <section class="w3-fence-salary-panel" aria-label="Sorted Salary Deck">
              <div class="w3-fence-salary-panel__head">
                <div>
                  <p class="eyebrow">Sorted Salary Deck</p>
                  <h3 class="panel-title">Click the breaching salary only after both fences are locked</h3>
                </div>
                <p class="w3-fence-salary-panel__copy" id="w3-l2-salary-note">
                  Quartiles use ordered position, so the slot numbers matter as much as the salary values.
                </p>
              </div>

              <div class="w3-fence-salary-grid" id="w3-l2-salary-grid">
                ${SORTED_SALARIES.map((value, index) => {
                  const chipWindow = index === Q1.lowerIndex || index === Q1.upperIndex
                    ? 'q1'
                    : index === Q3.lowerIndex || index === Q3.upperIndex
                      ? 'q3'
                      : 'none';

                  return `
                    <button
                      class="w3-fence-chip"
                      type="button"
                      data-salary-index="${index}"
                      data-salary-value="${value}"
                      data-chip-state="locked"
                      data-chip-window="${chipWindow}"
                      aria-label="Salary slot ${index + 1}, value ${formatMoney(value)}"
                    >
                      <span class="w3-fence-chip__slot">Slot ${index + 1}</span>
                      <strong class="w3-fence-chip__value">${escapeHtml(formatMoney(value))}</strong>
                    </button>
                  `;
                }).join('')}
              </div>
            </section>

            <div class="w3-fence-formulas" aria-label="Fence Formula Board">
              <article class="w3-fence-formula">
                <span class="w3-fence-formula__badge">Position Rule</span>
                <p class="w3-fence-formula__title">q x (n - 1)</p>
                <p class="w3-fence-formula__copy">Use q = 0.25 for Q1 and q = 0.75 for Q3.</p>
              </article>
              <article class="w3-fence-formula">
                <span class="w3-fence-formula__badge">Interpolation</span>
                <p class="w3-fence-formula__title">lower + f x (upper - lower)</p>
                <p class="w3-fence-formula__copy">Use the fractional part of the position as f.</p>
              </article>
              <article class="w3-fence-formula">
                <span class="w3-fence-formula__badge">Fence Rule</span>
                <p class="w3-fence-formula__title">Q1/Q3 +/- (1.5 x IQR)</p>
                <p class="w3-fence-formula__copy">Subtract for the lower fence and add for the upper fence.</p>
              </article>
            </div>

            <section class="w3-fence-callout" id="w3-l2-callout" hidden aria-live="polite">
              <div class="w3-fence-callout__meta">
                <span class="w3-fence-callout__pill">Fence Locked</span>
                <span class="w3-fence-callout__pill">${escapeHtml(formatMoney(UPPER_FENCE))} upper fence</span>
              </div>
              <h3 class="w3-fence-callout__title">${escapeHtml(formatMoney(FLAGGED_OUTLIER))} breaches the upper fence by ${escapeHtml(formatMoney(FLAGGED_OUTLIER - UPPER_FENCE))}.</h3>
              <p class="w3-fence-callout__copy">
                Every normal salary stays inside ${escapeHtml(formatMoney(LOWER_FENCE))} to ${escapeHtml(formatMoney(UPPER_FENCE))}. The far-right salary is the only one that falls outside the mathematical boundary.
              </p>
            </section>
          </article>

          <div class="w3-fence-side">
            <article class="panel w3-fence-calc-panel">
              <div class="w3-level__panel-head">
                <div>
                  <p class="eyebrow">Quartile Calculator</p>
                  <h2 class="panel-title">Use the helper actions, then lock each checkpoint manually</h2>
                </div>
                <p class="w3-level__microcopy">
                  Sort and Count help most in this lab. Sum is available too, but quartiles care more about ordered position than raw total.
                </p>
              </div>

              <div class="w3-fence-calc-host" id="w3-l2-calculator"></div>
            </article>

            <article class="panel w3-fence-tracker" aria-label="Fence Tracker">
              <div class="w3-level__panel-head">
                <div>
                  <p class="eyebrow">Fence Tracker</p>
                  <h2 class="panel-title">Lock the quartiles, then let the fence expose the outlier</h2>
                </div>
                <p class="w3-level__microcopy">
                  Each correct checkpoint stays visible, so the whole argument from quartiles to flagged outlier builds one step at a time.
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

                <article class="w3-fence-task w3-fence-task--outlier" id="w3-l2-outlier-task" data-task-state="locked">
                  <div class="w3-fence-task__meta">
                    <span class="w3-fence-task__status" id="w3-l2-outlier-status">Locked</span>
                    <span class="w3-fence-task__cue">Fence Check</span>
                  </div>
                  <h3 class="w3-fence-task__title">Flag the breaching salary</h3>
                  <p class="w3-fence-task__prompt" id="w3-l2-outlier-copy">
                    Solve the lower and upper fences first, then click the salary chip that falls outside the boundary.
                  </p>
                  <p class="w3-fence-task__formula">Valid outlier if value < lower fence or value > upper fence</p>
                </article>
              </div>
            </article>

            <div class="w3-fence-support">
              <section class="card card--elevated w3-level__feedback" aria-live="polite">
                <p class="eyebrow">Coach Feed</p>
                <p id="w3-l2-feedback-text" class="w3-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
              </section>

              <section class="card w3-level__hint-box" id="w3-l2-hint-box" hidden>
                <p class="eyebrow">Hint</p>
                <p id="w3-l2-hint-text" class="w3-level__hint-copy"></p>
              </section>

              <section class="card w3-fence-guide">
                <p class="eyebrow">Manual Rule</p>
                <p class="w3-level__microcopy">
                  This level uses linear interpolation, so a quartile can land between two salaries. Once you know Q1 and Q3, the IQR and both fences become straight arithmetic.
                </p>
              </section>
            </div>
          </div>
        </div>

        <section class="panel w3-fence-summary" id="w3-l2-summary" hidden aria-label="Fence Summary">
          <div class="w3-level__panel-head">
            <div>
              <p class="eyebrow">Fence Recap</p>
              <h2 class="panel-title">The visual outlier is now mathematically outside the fence</h2>
            </div>
            <p class="w3-level__microcopy">${escapeHtml(SUMMARY_COPY)}</p>
          </div>

          <div class="w3-fence-summary__grid">
            <article class="w3-fence-summary__card" style="--topic-color: var(--color-world-3);">
              <p class="w3-fence-summary__kicker">Quartiles</p>
              <div class="w3-fence-summary__meta">
                <span class="w3-fence-summary__state">Locked In</span>
                <span class="w3-fence-summary__topic">Q1 / Q3</span>
              </div>
              <h3 class="w3-fence-summary__title">${escapeHtml(formatMoney(Q1.value))} and ${escapeHtml(formatMoney(Q3.value))}</h3>
              <p class="w3-fence-summary__copy">The 25th and 75th percentiles come from interpolation between slots ${Q1.lowerSlot}-${Q1.upperSlot} and ${Q3.lowerSlot}-${Q3.upperSlot}.</p>
            </article>

            <article class="w3-fence-summary__card" style="--topic-color: var(--color-world-1);">
              <p class="w3-fence-summary__kicker">Spread</p>
              <div class="w3-fence-summary__meta">
                <span class="w3-fence-summary__state">Locked In</span>
                <span class="w3-fence-summary__topic">IQR</span>
              </div>
              <h3 class="w3-fence-summary__title">${escapeHtml(formatMoney(IQR))} middle spread</h3>
              <p class="w3-fence-summary__copy">The IQR keeps the focus on the middle half of the distribution instead of letting the extreme salary distort the spread.</p>
            </article>

            <article class="w3-fence-summary__card" style="--topic-color: var(--color-danger);">
              <p class="w3-fence-summary__kicker">Outlier Verdict</p>
              <div class="w3-fence-summary__meta">
                <span class="w3-fence-summary__state">Flagged</span>
                <span class="w3-fence-summary__topic">Fence Breach</span>
              </div>
              <h3 class="w3-fence-summary__title">${escapeHtml(formatMoney(FLAGGED_OUTLIER))} sits above ${escapeHtml(formatMoney(UPPER_FENCE))}</h3>
              <p class="w3-fence-summary__copy">Only one salary crosses the upper fence, so the same rogue point from Level 1 is now justified by a formal IQR rule.</p>
            </article>
          </div>

          <div class="action-row">
            <span class="status-box">${FLAGGED_OUTLIERS.length} salary sits outside the fence in this sample.</span>
            <button class="btn btn--primary" id="w3-l2-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w3-l2-progress');
    this._ui.status = container.querySelector('#w3-l2-status');
    this._ui.feedback = container.querySelector('#w3-l2-feedback-text');
    this._ui.hintBox = container.querySelector('#w3-l2-hint-box');
    this._ui.hintText = container.querySelector('#w3-l2-hint-text');
    this._ui.calculatorHost = container.querySelector('#w3-l2-calculator');
    this._ui.summary = container.querySelector('#w3-l2-summary');
    this._ui.finishButton = container.querySelector('#w3-l2-finish-btn');
    this._ui.salaryNote = container.querySelector('#w3-l2-salary-note');
    this._ui.salaryButtons = [...container.querySelectorAll('[data-salary-value]')];
    this._ui.outlierTask = container.querySelector('#w3-l2-outlier-task');
    this._ui.outlierStatus = container.querySelector('#w3-l2-outlier-status');
    this._ui.outlierCopy = container.querySelector('#w3-l2-outlier-copy');
    this._ui.callout = container.querySelector('#w3-l2-callout');

    this._mountCalculator();
    this._syncTaskUi();
    this._syncProgress();
    this._syncSalaryUi();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w3-l2-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w3-l2-reset-btn')) {
        this._resetLab();
        return;
      }

      if (event.target.closest('#w3-l2-finish-btn')) {
        if (this._completed) {
          void this._engine.complete();
        }
        return;
      }

      const salaryButton = event.target.closest('[data-salary-value]');
      if (salaryButton) {
        this._handleSalaryPick(salaryButton);
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
    this._calculator = null;
    this._solved.clear();
    this._ui = {};
  }

  _mountCalculator() {
    this._calculator?.destroy();
    this._calculator = new CalculatorWidget(this._ui.calculatorHost, {
      title: 'IQR Fence Console',
      dataset: SORTED_SALARIES,
      worldColor: 'var(--color-world-3)',
      onSpecial: payload => this._handleSpecialAction(payload),
      onResult: payload => this._handleCalculation(payload),
    });
  }

  _handleSpecialAction(payload) {
    if (!payload) return;

    if (payload.action === 'Count') {
      this._setFeedback(`There are ${SALARY_COUNT} ordered salaries. That means each quantile position uses q x (${SALARY_COUNT} - 1).`);
      this._setStatus('Use the count to place Q1 and Q3 before you calculate the spread.');
      return;
    }

    if (payload.action === 'Sort') {
      this._setFeedback(`The salaries are already sorted in the deck: slots ${Q1.lowerSlot}-${Q1.upperSlot} build Q1 and slots ${Q3.lowerSlot}-${Q3.upperSlot} build Q3.`);
      this._setStatus('Quartiles care about ordered position, so keep your eye on the slot numbers.');
      return;
    }

    if (payload.action === 'Sum') {
      this._setFeedback('The total salary sum is not the star of this lab. Quartiles and fences depend on ordered position and spread, not the raw total.');
      this._setStatus('Stay focused on quartile position, interpolation, and the 1.5 x IQR fence rule.');
    }
  }

  _handleCalculation(payload) {
    if (!payload || typeof payload.result !== 'number' || Number.isNaN(payload.result)) return;

    const signals = [
      ['q1', Q1.value, `That calculator result matches Q1: ${formatMoney(Q1.value)}.`],
      ['q3', Q3.value, `That calculator result matches Q3: ${formatMoney(Q3.value)}.`],
      ['iqr', IQR, `That result matches the IQR: ${formatMoney(IQR)}.`],
      ['lower', LOWER_FENCE, `That result matches the lower fence: ${formatMoney(LOWER_FENCE)}.`],
      ['upper', UPPER_FENCE, `That result matches the upper fence: ${formatMoney(UPPER_FENCE)}.`],
    ];

    const match = signals.find(([taskId, expected]) => !this._solved.has(taskId) && approxEqual(payload.result, expected, 0.01));
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

    if (!approxEqual(numericValue, task.expected, 0.01)) {
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
    this._syncSalaryUi();

    if (this._solved.has('lower') && this._solved.has('upper') && !this._outlierLocked) {
      this._setStatus('Both fences are locked. Click the salary chip that breaches the boundary.');
      return;
    }

    const remainingTask = TASKS.find(taskDef => !this._solved.has(taskDef.id));
    if (remainingTask) {
      this._setStatus(`${task.label} is solved. Next up: ${remainingTask.label}.`);
      return;
    }

    this._setStatus('All fence calculations are locked. Click the salary chip that sits outside the boundary.');
  }

  _handleSalaryPick(button) {
    const value = Number(button?.dataset?.salaryValue);
    if (!Number.isFinite(value) || this._outlierLocked) return;

    if (!this._solved.has('lower') || !this._solved.has('upper')) {
      this._setFeedback('The salary deck becomes gradeable only after the lower and upper fences are locked. Finish the fence math first.');
      this._setStatus('Solve the lower and upper fence checkpoints before you flag the breaching salary.');
      return;
    }

    const isOutlier = value < LOWER_FENCE || value > UPPER_FENCE;
    if (!isOutlier) {
      this._engine.mistake({ costsLife: false, countsMistake: true });
      this._setFeedback(`${formatMoney(value)} still lives inside the fence. Only a salary outside ${formatMoney(LOWER_FENCE)} to ${formatMoney(UPPER_FENCE)} should be flagged.`);
      this._flashChip(button, true);
      return;
    }

    this._outlierLocked = true;
    this._completed = true;
    this._engine.correct();
    this._setFeedback(`Correct. ${formatMoney(value)} breaches the upper fence and is the only mathematical outlier in the deck.`);
    this._setStatus('All six checkpoints are complete. Review the recap, then continue.');
    this._syncTaskUi();
    this._syncProgress();
    this._syncSalaryUi();
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
        input.value = formatNumber(task.expected);
      } else if (locked) {
        input.value = '';
      }
    });

    if (this._ui.outlierTask && this._ui.outlierStatus && this._ui.outlierCopy) {
      const unlocked = this._solved.has('lower') && this._solved.has('upper');
      this._ui.outlierTask.dataset.taskState = this._outlierLocked ? 'solved' : unlocked ? 'pending' : 'locked';
      this._ui.outlierStatus.textContent = this._outlierLocked ? 'Solved' : unlocked ? 'Active' : 'Locked';
      this._ui.outlierCopy.textContent = this._outlierLocked
        ? `${formatMoney(FLAGGED_OUTLIER)} is the only salary outside the fence.`
        : unlocked
          ? `Click the one salary outside ${formatMoney(LOWER_FENCE)} to ${formatMoney(UPPER_FENCE)}.`
          : 'Solve the lower and upper fences first, then click the salary chip that falls outside the boundary.';
    }
  }

  _syncProgress() {
    const progress = totalProgress(this._solved.size, this._outlierLocked);

    if (this._ui.progress) {
      this._ui.progress.textContent = `${progress} / ${TASKS.length + 1} fence checkpoints locked`;
    }

    if (this._ui.finishButton) {
      this._ui.finishButton.disabled = !this._completed;
    }
  }

  _syncSalaryUi() {
    const readyToPick = this._solved.has('lower') && this._solved.has('upper');

    this._ui.salaryButtons?.forEach(button => {
      const value = Number(button.dataset.salaryValue);
      const isOutlier = value < LOWER_FENCE || value > UPPER_FENCE;

      button.classList.remove('is-error');
      button.disabled = false;

      if (this._outlierLocked) {
        button.dataset.chipState = isOutlier ? 'solved' : 'muted';
      } else if (readyToPick) {
        button.dataset.chipState = 'candidate';
      } else {
        button.dataset.chipState = 'locked';
      }
    });

    if (this._ui.salaryNote) {
      this._ui.salaryNote.textContent = this._outlierLocked
        ? `${formatMoney(FLAGGED_OUTLIER)} is the only salary outside the confirmed fence.`
        : readyToPick
          ? `Both fences are solved. Click the one salary outside ${formatMoney(LOWER_FENCE)} to ${formatMoney(UPPER_FENCE)}.`
          : 'Quartiles use ordered position, so the slot numbers matter as much as the salary values.';
    }

    if (this._ui.callout) {
      this._ui.callout.hidden = !this._outlierLocked;
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
    this._outlierLocked = false;
    this._completed = false;

    this._container?.querySelectorAll('.w3-fence-input').forEach(input => {
      input.value = '';
      input.classList.remove('is-error', 'is-solved');
    });

    if (this._ui.summary) {
      this._ui.summary.hidden = true;
      this._ui.summary.classList.remove('is-revealed');
    }

    this._mountCalculator();
    this._setFeedback(DEFAULT_FEEDBACK);
    this._setStatus(DEFAULT_STATUS);
    this._syncTaskUi();
    this._syncProgress();
    this._syncSalaryUi();
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

  _flashChip(button, isError) {
    if (!button) return;
    button.classList.toggle('is-error', Boolean(isError));
    if (!isError) return;

    window.setTimeout(() => {
      button.classList.remove('is-error');
    }, 650);
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
