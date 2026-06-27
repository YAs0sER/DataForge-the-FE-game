'use strict';

import { approxEqual } from '../../data/answers.js';
import { createDataset } from '../../data/datasets.js';
import { getLevelProblem } from '../../data/problems.js';
import { isMissing } from '../../pandas/dataframe.js';
import { DataTable } from '../../widgets/datatable.js';
import { CalculatorWidget } from '../../widgets/calculator.js?v=20260616c';

const PROBLEM = getLevelProblem(2, 2);
const DATASET = createDataset(PROBLEM.datasetKey);
const AGE_VALUES = DATASET.col('Age').toArray();
const KNOWN_AGES = AGE_VALUES.filter(value => !isMissing(value));
const SORTED_AGES = [...KNOWN_AGES].sort((a, b) => a - b);
const KNOWN_SUM = KNOWN_AGES.reduce((sum, value) => sum + value, 0);
const KNOWN_COUNT = KNOWN_AGES.length;
const MEAN_VALUE = KNOWN_SUM / KNOWN_COUNT;
const MEDIAN_VALUE = SORTED_AGES[Math.floor(SORTED_AGES.length / 2)];
const MISSING_ROW_INDEX = AGE_VALUES.findIndex(value => isMissing(value));

const DEFAULT_FEEDBACK = 'Use the table to find the gap, the calculator helpers to inspect the known ages, and the checkpoint cards to lock the final values.';
const DEFAULT_STATUS = 'Solve the mean and median first. The missing-cell fill unlocks after both checkpoints are correct.';
const SUMMARY_COPY = 'This sample is nicely centered, so both imputation rules land on the same answer. In skewed data, median often stays safer.';

const TASKS = Object.freeze([
  {
    id: 'mean',
    label: 'Mean Imputation',
    buttonLabel: 'Check Mean',
    cue: 'Use Sum + Count',
    prompt: 'Ignore the missing row, sum the known ages, and divide by the number of known ages.',
    formula: 'Mean = sum of known ages / count of known ages',
    expected: MEAN_VALUE,
    success: `${KNOWN_SUM} / ${KNOWN_COUNT} = ${formatNumber(MEAN_VALUE)}. That is the mean imputation value.`,
    retry: 'That mean is off. Sum only the known ages, then divide by the count of known rows.',
    lockedCopy: 'Ready to solve.',
  },
  {
    id: 'median',
    label: 'Median Imputation',
    buttonLabel: 'Check Median',
    cue: 'Use Sort',
    prompt: 'Sort the known ages and take the middle value of the ordered list.',
    formula: 'Median = middle value after sorting the known ages',
    expected: MEDIAN_VALUE,
    success: `${SORTED_AGES.join(', ')} puts ${formatNumber(MEDIAN_VALUE)} in the middle, so that is the median.`,
    retry: 'That median is off. Sort the five known ages and look at the exact middle value.',
    lockedCopy: 'Ready to solve.',
  },
  {
    id: 'fill',
    label: 'Fill The Missing Age',
    buttonLabel: 'Fill Missing Age',
    cue: `Row ${MISSING_ROW_INDEX + 1}`,
    prompt: `Write the imputed Age for row ${MISSING_ROW_INDEX + 1} after you have locked both statistics above.`,
    formula: `Imputed Age for row ${MISSING_ROW_INDEX + 1} = ?`,
    expected: MEAN_VALUE,
    success: `Row ${MISSING_ROW_INDEX + 1} gets ${formatNumber(MEAN_VALUE)} here because both the mean and median agree.`,
    retry: 'That fill value is off. Reuse the solved mean and median values before you write into the missing cell.',
    lockedCopy: 'Unlock mean and median first.',
    requires: ['mean', 'median'],
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

function formatNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  return Number(value.toFixed(4)).toString();
}

function taskById(taskId) {
  return TASKS.find(task => task.id === taskId) ?? null;
}

export default class World2Level2 {
  meta = {
    title: PROBLEM?.title ?? 'Calculate the Imputation',
    subtitle: PROBLEM?.objective ?? 'Compute the correct mean and median imputations by hand.',
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._events = null;
    this._table = null;
    this._calculator = null;
    this._solved = new Set();
    this._completed = false;
    this._ui = {};
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w2-level w2-level--handcalc screen-section" aria-label="World 2 Level 2">
        <div class="level-hero w2-level__hero" style="--world-color: var(--color-world-2);">
          <p class="eyebrow">World 2 - Missing Data</p>
          <h1 class="level-hero__title">${escapeHtml(PROBLEM.title)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(PROBLEM.objective)}
            Ignore the missing entry, compute both statistics manually, and then write the repair back into the empty Age cell.
          </p>
          <div class="action-row">
            <span class="status-box" id="w2-l2-progress">0 / ${TASKS.length} checkpoints solved</span>
            <span class="status-box" id="w2-l2-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w2-l2-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w2-l2-reset-btn" type="button">Reset Lab</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">02</span>
        </div>

        <div class="w2-handcalc-layout">
          <article class="panel w2-handcalc-dataset-panel">
            <div class="w2-level__panel-head">
              <div>
                <p class="eyebrow">Age Snapshot</p>
                <h2 class="panel-title">One missing row, five known ages, two statistics to compute</h2>
              </div>
              <p class="w2-level__microcopy">
                Keep the row order stable. The missing cell is the one you will repair after you finish the mean and median checkpoints.
              </p>
            </div>

            <div class="w2-handcalc-snapshot" aria-label="Dataset Snapshot">
              <article class="w2-handcalc-snapshot__card">
                <span class="w2-handcalc-snapshot__label">Known Ages</span>
                <strong class="w2-handcalc-snapshot__value">${KNOWN_COUNT}</strong>
              </article>
              <article class="w2-handcalc-snapshot__card">
                <span class="w2-handcalc-snapshot__label">Missing Cells</span>
                <strong class="w2-handcalc-snapshot__value">${DATASET.totalNulls()}</strong>
              </article>
              <article class="w2-handcalc-snapshot__card">
                <span class="w2-handcalc-snapshot__label">Target Row</span>
                <strong class="w2-handcalc-snapshot__value">Row ${MISSING_ROW_INDEX + 1}</strong>
              </article>
            </div>

            <div class="w2-handcalc-table-shell" id="w2-l2-table"></div>

            <div class="w2-handcalc-rules" aria-label="Imputation Rules">
              <article class="w2-handcalc-rule">
                <span class="w2-handcalc-rule__badge">Mean</span>
                <p>Use the known-value sum divided by the number of known rows.</p>
              </article>
              <article class="w2-handcalc-rule">
                <span class="w2-handcalc-rule__badge">Median</span>
                <p>Sort the known ages and take the middle position.</p>
              </article>
              <article class="w2-handcalc-rule">
                <span class="w2-handcalc-rule__badge">Rule</span>
                <p>Missing rows do not join the sum, the count, or the sorted list.</p>
              </article>
            </div>
          </article>

          <div class="w2-handcalc-side">
            <article class="panel w2-handcalc-calc-panel">
              <div class="w2-level__panel-head">
                <div>
                  <p class="eyebrow">Imputation Calculator</p>
                  <h2 class="panel-title">Use helpers, then lock the final answers manually</h2>
                </div>
                <p class="w2-level__microcopy">
                  Reset rebuilds the local calculator state, but hints and wrong attempts still count for the current run.
                </p>
              </div>

              <div class="w2-handcalc-calc-host" id="w2-l2-calculator"></div>
            </article>

            <article class="panel w2-handcalc-tracker" aria-label="Checkpoint Tracker">
              <div class="w2-level__panel-head">
                <div>
                  <p class="eyebrow">Checkpoint Tracker</p>
                  <h2 class="panel-title">Solve the two statistics, then repair the gap</h2>
                </div>
                <p class="w2-level__microcopy">
                  Each checkpoint locks after a correct answer so you can see the whole imputation path build up step by step.
                </p>
              </div>

              <div class="w2-handcalc-tasklist">
                ${TASKS.map(task => `
                  <form class="w2-handcalc-task" data-task-id="${task.id}" data-task-state="pending" novalidate>
                    <div class="w2-handcalc-task__meta">
                      <span class="w2-handcalc-task__status" data-task-status="${task.id}">Pending</span>
                      <span class="w2-handcalc-task__cue">${escapeHtml(task.cue)}</span>
                    </div>
                    <h3 class="w2-handcalc-task__title">${escapeHtml(task.label)}</h3>
                    <p class="w2-handcalc-task__prompt">${escapeHtml(task.prompt)}</p>
                    <p class="w2-handcalc-task__formula">${escapeHtml(task.formula)}</p>

                    <div class="w2-handcalc-task__entry">
                      <label class="w2-handcalc-task__field">
                        <span class="sr-only">${escapeHtml(task.label)} answer</span>
                        <input
                          class="w2-handcalc-input"
                          data-task-input="${task.id}"
                          inputmode="decimal"
                          autocomplete="off"
                          placeholder="Enter value"
                          type="text"
                        >
                      </label>
                      <button class="btn btn--primary" data-task-submit="${task.id}" type="submit">${escapeHtml(task.buttonLabel)}</button>
                    </div>

                    <p class="w2-handcalc-task__result" data-task-result="${task.id}">${escapeHtml(task.lockedCopy)}</p>
                  </form>
                `).join('')}
              </div>
            </article>

            <div class="w2-handcalc-support">
              <section class="card card--elevated w2-level__feedback" aria-live="polite">
                <p class="eyebrow">Coach Feed</p>
                <p id="w2-l2-feedback-text" class="w2-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
              </section>

              <section class="card w2-level__hint-box" id="w2-l2-hint-box" hidden>
                <p class="eyebrow">Hint</p>
                <p id="w2-l2-hint-text" class="w2-level__hint-copy"></p>
              </section>

              <section class="card w2-handcalc-guide">
                <p class="eyebrow">What This Teaches</p>
                <p class="w2-level__microcopy">
                  Mean borrows information from every known value. Median cares only about ordered position. Later levels will teach you when one is safer than the other.
                </p>
              </section>
            </div>
          </div>
        </div>

        <section class="panel w2-handcalc-summary" id="w2-l2-summary" hidden aria-label="Imputation Summary">
          <div class="w2-level__panel-head">
            <div>
              <p class="eyebrow">Imputation Recap</p>
              <h2 class="panel-title">Both paths converge on the same fill in this sample</h2>
            </div>
            <p class="w2-level__microcopy">${escapeHtml(SUMMARY_COPY)}</p>
          </div>

          <div class="w2-handcalc-summary__grid">
            <article class="w2-handcalc-summary__card">
              <p class="w2-handcalc-summary__kicker">Mean path</p>
              <h3 class="w2-handcalc-summary__title">${formatNumber(MEAN_VALUE)}</h3>
              <p class="w2-handcalc-summary__copy">${KNOWN_SUM} divided by ${KNOWN_COUNT} known ages gives the average fill.</p>
            </article>
            <article class="w2-handcalc-summary__card">
              <p class="w2-handcalc-summary__kicker">Median path</p>
              <h3 class="w2-handcalc-summary__title">${formatNumber(MEDIAN_VALUE)}</h3>
              <p class="w2-handcalc-summary__copy">${SORTED_AGES.join(', ')} leaves ${formatNumber(MEDIAN_VALUE)} in the middle position.</p>
            </article>
            <article class="w2-handcalc-summary__card">
              <p class="w2-handcalc-summary__kicker">Filled row</p>
              <h3 class="w2-handcalc-summary__title">Row ${MISSING_ROW_INDEX + 1} = ${formatNumber(MEAN_VALUE)}</h3>
              <p class="w2-handcalc-summary__copy">The missing Age cell becomes ${formatNumber(MEAN_VALUE)} here because both imputation rules agree.</p>
            </article>
          </div>

          <div class="action-row">
            <span class="status-box">Mean and median both repair the gap to 28 in this balanced sample.</span>
            <button class="btn btn--primary" id="w2-l2-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w2-l2-progress');
    this._ui.status = container.querySelector('#w2-l2-status');
    this._ui.feedback = container.querySelector('#w2-l2-feedback-text');
    this._ui.hintBox = container.querySelector('#w2-l2-hint-box');
    this._ui.hintText = container.querySelector('#w2-l2-hint-text');
    this._ui.tableHost = container.querySelector('#w2-l2-table');
    this._ui.calculatorHost = container.querySelector('#w2-l2-calculator');
    this._ui.summary = container.querySelector('#w2-l2-summary');
    this._ui.finishButton = container.querySelector('#w2-l2-finish-btn');

    this._mountTable();
    this._mountCalculator();
    this._syncTaskUi();
    this._syncProgress();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w2-l2-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w2-l2-reset-btn')) {
        this._resetLab();
        return;
      }

      if (event.target.closest('#w2-l2-finish-btn')) {
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
    return PROBLEM.hints?.[hintsUsed - 1] ?? null;
  }

  pause() {}

  resume() {}

  teardown() {
    this._events?.abort();
    this._table?.destroy();
    this._calculator?.destroy();
    this._table = null;
    this._calculator = null;
    this._ui = {};
    this._solved.clear();
  }

  _mountTable() {
    this._table?.destroy();
    this._table = new DataTable(this._ui.tableHost, DATASET, {
      showStatsButtons: false,
      sortable: false,
      worldColor: 'var(--color-world-2)',
    });

    requestAnimationFrame(() => {
      this._table?.flashCell('Age', MISSING_ROW_INDEX, 'amber');
    });
  }

  _mountCalculator() {
    this._calculator?.destroy();
    this._calculator = new CalculatorWidget(this._ui.calculatorHost, {
      title: 'Age Imputation Console',
      dataset: KNOWN_AGES,
      worldColor: 'var(--color-world-2)',
      onSpecial: payload => this._handleSpecialAction(payload),
      onResult: payload => this._handleCalculation(payload),
    });
  }

  _handleSpecialAction(payload) {
    if (!payload) return;

    if (payload.action === 'Sum') {
      this._setFeedback(`The known ages sum to ${formatNumber(KNOWN_SUM)}. Now divide by the ${KNOWN_COUNT} known rows for the mean.`);
      this._setStatus('Mean checkpoint is ready once you divide the known-value sum by the known-value count.');
      return;
    }

    if (payload.action === 'Count') {
      this._setFeedback(`There are ${KNOWN_COUNT} known ages. The missing row does not count in the denominator.`);
      this._setStatus('Count the known rows only, then pair that count with the known-value sum.');
      return;
    }

    if (payload.action === 'Sort') {
      this._setFeedback(`Sorted known ages: ${SORTED_AGES.join(', ')}. The middle value of that ordered list is the median.`);
      this._setStatus('Median checkpoint is ready once you identify the exact middle of the sorted list.');
    }
  }

  _handleCalculation(payload) {
    if (!payload || typeof payload.result !== 'number' || Number.isNaN(payload.result)) return;

    if (approxEqual(payload.result, MEAN_VALUE, 0.01) && !this._solved.has('mean')) {
      this._setFeedback(`That calculator result lands on ${formatNumber(MEAN_VALUE)}. Save it into the mean checkpoint when you are ready.`);
      return;
    }

    if (approxEqual(payload.result, MEDIAN_VALUE, 0.01) && !this._solved.has('median')) {
      this._setFeedback(`That calculator result also matches the median value here. Lock the median checkpoint after you confirm the sorted list.`);
    }
  }

  _gradeTask(taskId) {
    const task = taskById(taskId);
    if (!task || this._solved.has(taskId)) return;

    if (task.requires?.some(requiredId => !this._solved.has(requiredId))) {
      const requiredLabels = task.requires
        .map(requiredId => taskById(requiredId)?.label?.toLowerCase() ?? requiredId)
        .join(' and ');
      this._setFeedback(`Finish ${requiredLabels} before you fill the missing Age cell.`);
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

    if (this._solved.size === TASKS.length) {
      this._revealSummary();
      return;
    }

    if (taskId === 'mean' || taskId === 'median') {
      if (this._solved.has('mean') && this._solved.has('median')) {
        this._setStatus(`Mean and median are locked. Fill row ${MISSING_ROW_INDEX + 1} to finish the lab.`);
      } else {
        const remaining = TASKS.filter(taskDef => !this._solved.has(taskDef.id) && taskDef.id !== 'fill')[0];
        this._setStatus(`${task.label} is solved. Next up: ${remaining?.label ?? 'Fill the missing Age'}.`);
      }
    }
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
      this._ui.progress.textContent = `${this._solved.size} / ${TASKS.length} checkpoints solved`;
    }

    if (this._ui.finishButton) {
      this._ui.finishButton.disabled = !this._completed;
    }
  }

  _revealSummary() {
    this._completed = true;
    this._setFeedback(SUMMARY_COPY);
    this._setStatus('All three checkpoints are solved. Review the recap, then continue.');
    this._syncProgress();

    if (this._ui.summary) {
      this._ui.summary.hidden = false;
      requestAnimationFrame(() => {
        this._ui.summary.classList.add('is-revealed');
      });
      this._ui.summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    this._ui.summary?.setAttribute('hidden', '');
    this._ui.summary?.classList.remove('is-revealed');

    this._container?.querySelectorAll('[data-task-input]').forEach(input => {
      input.value = '';
      input.classList.remove('is-error', 'is-solved');
    });

    this._mountTable();
    this._mountCalculator();
    this._syncTaskUi();
    this._syncProgress();
    this._setFeedback(DEFAULT_FEEDBACK);
    this._setStatus(DEFAULT_STATUS);
  }

  _flashInput(input, isError) {
    if (!(input instanceof HTMLElement)) return;
    input.classList.toggle('is-error', isError);
    if (!isError) {
      input.classList.add('is-solved');
      return;
    }

    window.setTimeout(() => {
      input.classList.remove('is-error');
    }, 900);
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
