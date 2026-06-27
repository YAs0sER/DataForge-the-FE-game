'use strict';

import { validateIndicatorColumn } from '../../data/answers.js';
import { getLevelProblem } from '../../data/problems.js';
import { DataFrame, isMissing } from '../../pandas/dataframe.js';
import { DataTable } from '../../widgets/datatable.js';

const PROBLEM = getLevelProblem(2, 4);

const SOURCE_COL = 'Age';
const INDICATOR_COL = 'Age_missing';
const MEDIAN_VALUE = 27;
const MISSING_ROW_INDEX = 1;
const EXPECTED_INDICATOR = Object.freeze([0, 1, 0]);

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM?.hints ?? []),
  'Only the row that was originally missing should receive a 1 in Age_missing.',
  'With ages 24 and 30, the midpoint is 27.',
]);

const DEFAULT_FEEDBACK = 'Repair the missing Age value first, then add a binary indicator so the model still knows that row was originally incomplete.';
const DEFAULT_STATUS = 'Click the highlighted missing Age cell in the Before panel to unlock the first repair step.';
const SUMMARY_COPY = 'Imputation fixes the blank value, and the indicator column preserves the missingness signal instead of erasing it.';

const ROWS = Object.freeze([
  Object.freeze({ Age: 24, Salary: 32000, City: 'Rabat' }),
  Object.freeze({ Age: null, Salary: 41000, City: 'Casablanca' }),
  Object.freeze({ Age: 30, Salary: 36000, City: 'Fes' }),
]);

const ORIGINAL_DF = DataFrame.fromRows(ROWS, ['Age', 'Salary', 'City']);
const FILLED_DF = ORIGINAL_DF.fillna(SOURCE_COL, MEDIAN_VALUE);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function indicatorDraftFrame(values) {
  return FILLED_DF.assign(INDICATOR_COL, values);
}

function originalAgeLabel(row) {
  return isMissing(row.Age) ? '?' : String(row.Age);
}

export default class World2Level4 {
  meta = {
    title: PROBLEM?.title ?? 'The Indicator Variable',
    subtitle: PROBLEM?.objective ?? 'Impute a value and add a binary indicator that remembers it was missing.',
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._events = null;
    this._beforeTable = null;
    this._afterTable = null;
    this._completedTasks = new Set();
    this._selectedGap = false;
    this._completed = false;
    this._indicatorDraft = [...EXPECTED_INDICATOR].map(() => 0);
    this._ui = {};
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w2-level w2-level--indicator screen-section" aria-label="World 2 Level 4">
        <div class="level-hero w2-level__hero" style="--world-color: var(--color-world-2);">
          <p class="eyebrow">World 2 - Missing Data</p>
          <h1 class="level-hero__title">${escapeHtml(PROBLEM.title)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(PROBLEM.objective)}
            The repair should keep two truths at once: the Age value gets filled, and the model still remembers which row was originally missing.
          </p>
          <div class="action-row">
            <span class="status-box" id="w2-l4-progress">0 / 3 transformation steps locked</span>
            <span class="status-box" id="w2-l4-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w2-l4-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w2-l4-reset-btn" type="button">Reset Transform</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">04</span>
        </div>

        <div class="w2-indicator-layout">
          <article class="panel w2-indicator-panel w2-indicator-panel--before">
            <div class="w2-level__panel-head">
              <div>
                <p class="eyebrow">Before</p>
                <h2 class="panel-title">Original dataset with one missing Age value</h2>
              </div>
              <p class="w2-level__microcopy">
                Click the highlighted gap in row 2 to start the repair. Salary and City stay untouched in this lesson.
              </p>
            </div>

            <div class="w2-indicator-table-shell" id="w2-l4-before-table"></div>
          </article>

          <article class="panel w2-indicator-panel w2-indicator-panel--after">
            <div class="w2-level__panel-head">
              <div>
                <p class="eyebrow">After</p>
                <h2 class="panel-title">Transformation preview that wakes up step by step</h2>
              </div>
              <p class="w2-level__microcopy">
                The preview unlocks after you repair Age, then grows once you add the indicator column and mark the original missing row.
              </p>
            </div>

            <div class="w2-indicator-after-shell" id="w2-l4-after-shell" data-after-stage="locked">
              <div class="w2-indicator-after-overlay" id="w2-l4-after-overlay">
                <p class="w2-indicator-after-overlay__eyebrow">Preview Locked</p>
                <p class="w2-indicator-after-overlay__copy">Repair the missing Age cell on the left to reveal the first transformation.</p>
              </div>
              <div class="w2-indicator-table-shell" id="w2-l4-after-table"></div>
            </div>
          </article>

          <div class="w2-indicator-side">
            <article class="panel w2-indicator-tracker" aria-label="Transformation Steps">
              <div class="w2-level__panel-head">
                <div>
                  <p class="eyebrow">Transformation Steps</p>
                  <h2 class="panel-title">Lock the repair, the new column, and the indicator pattern</h2>
                </div>
                <p class="w2-level__microcopy">
                  Each solved step immediately updates the After panel so you can see how the final table is assembled.
                </p>
              </div>

              <div class="w2-indicator-step-list">
                <article class="w2-indicator-step" data-step-id="fill" data-step-state="pending">
                  <div class="w2-indicator-step__meta">
                    <span class="w2-indicator-step__status" id="w2-l4-fill-status">Pending</span>
                    <span class="w2-indicator-step__cue">Center the gap</span>
                  </div>
                  <h3 class="w2-indicator-step__title">Fill the missing Age value</h3>
                  <p class="w2-indicator-step__prompt">
                    Click the missing Age cell first, then enter the repair value that best centers the observed Age values.
                  </p>
                  <form class="w2-indicator-form" data-step-form="fill" novalidate>
                    <label class="w2-indicator-field">
                      <span class="sr-only">Filled Age value</span>
                      <input
                        class="w2-indicator-input"
                        id="w2-l4-fill-input"
                        type="text"
                        inputmode="decimal"
                        autocomplete="off"
                        placeholder="Repair value"
                        disabled
                      >
                    </label>
                    <button class="btn btn--primary" id="w2-l4-fill-submit" type="submit" disabled>Repair Age</button>
                  </form>
                  <p class="w2-indicator-step__result" id="w2-l4-fill-result">Click the missing Age cell on the left to unlock this step.</p>
                </article>

                <article class="w2-indicator-step" data-step-id="column" data-step-state="locked">
                  <div class="w2-indicator-step__meta">
                    <span class="w2-indicator-step__status" id="w2-l4-column-status">Locked</span>
                    <span class="w2-indicator-step__cue">feature + "_missing"</span>
                  </div>
                  <h3 class="w2-indicator-step__title">Add the missingness column</h3>
                  <p class="w2-indicator-step__prompt">
                    Create a new indicator column using the source feature name plus <code>_missing</code> so the transformed table can track the original gap.
                  </p>
                  <form class="w2-indicator-form" data-step-form="column" novalidate>
                    <label class="w2-indicator-field">
                      <span class="sr-only">Column name</span>
                      <input
                        class="w2-indicator-input"
                        id="w2-l4-column-input"
                        type="text"
                        autocomplete="off"
                        placeholder="feature_missing"
                        disabled
                      >
                    </label>
                    <button class="btn btn--primary" id="w2-l4-column-submit" type="submit" disabled>Add Column</button>
                  </form>
                  <p class="w2-indicator-step__result" id="w2-l4-column-result">Unlocks after the Age repair is solved.</p>
                </article>

                <article class="w2-indicator-step" data-step-id="indicator" data-step-state="locked">
                  <div class="w2-indicator-step__meta">
                    <span class="w2-indicator-step__status" id="w2-l4-indicator-status">Locked</span>
                    <span class="w2-indicator-step__cue">1 = was missing</span>
                  </div>
                  <h3 class="w2-indicator-step__title">Fill the indicator column correctly</h3>
                  <p class="w2-indicator-step__prompt">
                    Toggle each row between 0 and 1. Only the row that was originally missing should end up with 1.
                  </p>

                  <div class="w2-indicator-toggle-list" id="w2-l4-indicator-editor" aria-label="Indicator editor">
                    ${ROWS.map((row, index) => `
                      <button class="w2-indicator-toggle" type="button" data-indicator-row="${index}" disabled>
                        <span class="w2-indicator-toggle__meta">
                          <span class="w2-indicator-toggle__row">Row ${index + 1}</span>
                          <span class="w2-indicator-toggle__copy">Original Age: ${escapeHtml(originalAgeLabel(row))} - ${escapeHtml(row.City)}</span>
                        </span>
                        <span class="w2-indicator-toggle__value" data-indicator-value="${index}">0</span>
                      </button>
                    `).join('')}
                  </div>

                  <div class="w2-indicator-cta">
                    <p class="w2-indicator-inline-hint">0 means Age was already present. 1 means the row was missing before the fill.</p>
                    <button class="btn btn--primary" id="w2-l4-indicator-check" type="button" disabled>Lock Indicator</button>
                  </div>
                  <p class="w2-indicator-step__result" id="w2-l4-indicator-result">Create the column first, then mark the original missing row.</p>
                </article>
              </div>
            </article>

            <section class="card card--elevated w2-level__feedback" aria-live="polite">
              <p class="eyebrow">Coach Feed</p>
              <p id="w2-l4-feedback-text" class="w2-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
            </section>

            <section class="card w2-level__hint-box" id="w2-l4-hint-box" hidden>
              <p class="eyebrow">Hint</p>
              <p id="w2-l4-hint-text" class="w2-level__hint-copy"></p>
            </section>

            <section class="card w2-indicator-guide">
              <p class="eyebrow">Why This Pattern Matters</p>
              <p class="w2-level__microcopy">
                A plain fill would hide the fact that row 2 originally had no Age. The indicator lets the model keep that signal while still giving the numeric column a usable value.
              </p>
            </section>
          </div>
        </div>

        <section class="panel w2-indicator-summary" id="w2-l4-summary" hidden aria-label="Indicator Variable Recap">
          <div class="w2-level__panel-head">
            <div>
              <p class="eyebrow">Indicator Recap</p>
              <h2 class="panel-title">The final table keeps both the fill and the missingness story</h2>
            </div>
            <p class="w2-level__microcopy">${escapeHtml(SUMMARY_COPY)}</p>
          </div>

          <div class="w2-indicator-summary__grid">
            <article class="w2-indicator-summary__card">
              <p class="w2-indicator-summary__kicker">Filled Value</p>
              <h3 class="w2-indicator-summary__title">Row 2 Age = 27</h3>
              <p class="w2-indicator-summary__copy">The missing Age cell gets the median of the observed ages, so the numeric column becomes fully usable.</p>
            </article>
            <article class="w2-indicator-summary__card">
              <p class="w2-indicator-summary__kicker">Indicator Column</p>
              <h3 class="w2-indicator-summary__title">Age_missing = [0, 1, 0]</h3>
              <p class="w2-indicator-summary__copy">Only the second row receives 1 because that is the row that started out missing before the imputation step.</p>
            </article>
          </div>

          <article class="w2-indicator-formula-card">
            <p class="eyebrow">Binary Missingness Formula</p>
            <code class="w2-indicator-formula-card__code">m_i = 1{x_i missing}</code>
            <p class="w2-indicator-formula-card__copy">
              Read it as: for row <em>i</em>, the indicator becomes 1 when the original value was missing, and 0 otherwise.
            </p>
          </article>

          <div class="action-row">
            <span class="status-box">The preview is complete. You now have an imputed feature and a missingness flag side by side.</span>
            <button class="btn btn--primary" id="w2-l4-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w2-l4-progress');
    this._ui.status = container.querySelector('#w2-l4-status');
    this._ui.feedback = container.querySelector('#w2-l4-feedback-text');
    this._ui.hintBox = container.querySelector('#w2-l4-hint-box');
    this._ui.hintText = container.querySelector('#w2-l4-hint-text');
    this._ui.beforeHost = container.querySelector('#w2-l4-before-table');
    this._ui.afterHost = container.querySelector('#w2-l4-after-table');
    this._ui.afterShell = container.querySelector('#w2-l4-after-shell');
    this._ui.afterOverlay = container.querySelector('#w2-l4-after-overlay');
    this._ui.summary = container.querySelector('#w2-l4-summary');
    this._ui.finishButton = container.querySelector('#w2-l4-finish-btn');
    this._ui.fillInput = container.querySelector('#w2-l4-fill-input');
    this._ui.columnInput = container.querySelector('#w2-l4-column-input');
    this._ui.fillResult = container.querySelector('#w2-l4-fill-result');
    this._ui.columnResult = container.querySelector('#w2-l4-column-result');
    this._ui.indicatorResult = container.querySelector('#w2-l4-indicator-result');
    this._ui.fillStatus = container.querySelector('#w2-l4-fill-status');
    this._ui.columnStatus = container.querySelector('#w2-l4-column-status');
    this._ui.indicatorStatus = container.querySelector('#w2-l4-indicator-status');
    this._ui.fillSubmit = container.querySelector('#w2-l4-fill-submit');
    this._ui.columnSubmit = container.querySelector('#w2-l4-column-submit');
    this._ui.indicatorCheck = container.querySelector('#w2-l4-indicator-check');
    this._ui.stepCards = Array.from(container.querySelectorAll('[data-step-id]'));
    this._ui.indicatorButtons = Array.from(container.querySelectorAll('[data-indicator-row]'));
    this._ui.indicatorValues = Array.from(container.querySelectorAll('[data-indicator-value]'));

    this._mountTables();
    this._syncChecklist();
    this._syncProgress();
    this._syncAfterPanel();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._ui.beforeHost?.addEventListener('dt:cell-click', event => {
      this._handleBeforeCellClick(event.detail);
    }, { signal });

    this._container?.addEventListener('click', event => {
      const toggle = event.target.closest('[data-indicator-row]');
      if (toggle) {
        this._toggleIndicator(Number(toggle.getAttribute('data-indicator-row')));
        return;
      }

      if (event.target.closest('#w2-l4-indicator-check')) {
        this._checkIndicator();
        return;
      }

      if (event.target.closest('#w2-l4-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w2-l4-reset-btn')) {
        this._resetLevel();
        return;
      }

      if (event.target.closest('#w2-l4-finish-btn')) {
        if (this._completed) {
          void this._engine.complete();
        }
      }
    }, { signal });

    this._container?.addEventListener('submit', event => {
      const form = event.target.closest('[data-step-form]');
      if (!form) return;
      event.preventDefault();

      const stepId = form.getAttribute('data-step-form');
      if (stepId === 'fill') {
        this._submitFill();
        return;
      }

      if (stepId === 'column') {
        this._submitColumn();
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
    this._beforeTable?.destroy();
    this._afterTable?.destroy();
    this._beforeTable = null;
    this._afterTable = null;
    this._completedTasks.clear();
    this._ui = {};
  }

  _mountTables() {
    this._beforeTable?.destroy();
    this._afterTable?.destroy();

    const tableOptions = {
      compact: true,
      showIndex: false,
      showNullBadges: false,
      showRanges: false,
      showStatsButtons: false,
      sortable: false,
      worldColor: 'var(--color-world-2)',
    };

    this._beforeTable = new DataTable(this._ui.beforeHost, ORIGINAL_DF, tableOptions);
    this._afterTable = new DataTable(this._ui.afterHost, this._currentAfterFrame(), tableOptions);

    requestAnimationFrame(() => {
      this._decorateBeforeGapCell();
      this._decorateAfterPanel();
      this._beforeTable?.flashCell(SOURCE_COL, MISSING_ROW_INDEX, 'amber');
    });
  }

  _handleBeforeCellClick(detail) {
    if (!detail || this._completedTasks.has('fill')) return;

    if (detail.col !== SOURCE_COL || detail.rowIdx !== MISSING_ROW_INDEX) {
      this._setFeedback('The only cell you need to repair is the highlighted missing Age entry in row 2.');
      return;
    }

    this._selectedGap = true;
    this._syncChecklist();
    this._decorateBeforeGapCell();
    this._setFeedback('Good catch. The two observed ages are 24 and 30, so the midpoint lands at 27.');
    this._setStatus('Gap selected. Type 27 to repair the missing Age value.');
    this._ui.fillInput?.focus();
  }

  _submitFill() {
    if (this._completedTasks.has('fill')) return;

    if (!this._selectedGap) {
      this._setFeedback('Click the missing Age cell in row 2 before you try to repair it.');
      this._setStatus(DEFAULT_STATUS);
      return;
    }

    const rawValue = this._ui.fillInput?.value?.trim() ?? '';
    const numericValue = Number(rawValue);

    if (!rawValue || Number.isNaN(numericValue)) {
      this._setFeedback('Enter the repair value before you confirm the step.');
      this._flashInput(this._ui.fillInput, true);
      return;
    }

    if (numericValue !== MEDIAN_VALUE) {
      this._setFeedback('That Age repair is off. Use the center of the observed ages in this tiny column.');
      this._flashInput(this._ui.fillInput, true);
      this._engine.mistake({ costsLife: false, countsMistake: true });
      return;
    }

    this._completedTasks.add('fill');
    this._engine.correct();
    this._flashInput(this._ui.fillInput, false);
    this._syncAfterTable();
    this._syncChecklist();
    this._syncProgress();
    this._setFeedback('Correct. The missing Age cell is now repaired, so the After panel can wake up.');
    this._setStatus('Age is repaired. Add the new missingness column next so the model can remember the original gap.');

    requestAnimationFrame(() => {
      this._afterTable?.flashCell(SOURCE_COL, MISSING_ROW_INDEX, 'green');
      this._ui.columnInput?.focus();
    });
  }

  _submitColumn() {
    if (!this._completedTasks.has('fill') || this._completedTasks.has('column')) return;

    const rawValue = this._ui.columnInput?.value?.trim() ?? '';
    if (!rawValue) {
      this._setFeedback('Name the new column before you try to add it.');
      this._flashInput(this._ui.columnInput, true);
      return;
    }

    if (rawValue !== INDICATOR_COL) {
      const exactCaseMatch = rawValue.toLowerCase() === INDICATOR_COL.toLowerCase();
      this._setFeedback(
        exactCaseMatch
          ? 'Close. Use the source feature name followed by _missing, with the same casing and underscore.'
          : 'That name is off. Build it from the original feature name plus _missing.'
      );
      this._flashInput(this._ui.columnInput, true);
      this._engine.mistake({ costsLife: false, countsMistake: true });
      return;
    }

    this._completedTasks.add('column');
    this._engine.correct();
    this._flashInput(this._ui.columnInput, false);
    this._syncAfterTable();
    this._syncChecklist();
    this._syncProgress();
    this._setFeedback('Nice. The new indicator column is live, and now you can mark which row was originally blank.');
    this._setStatus('Toggle the indicator rows so only the originally missing Age row ends with a value of 1.');

    requestAnimationFrame(() => {
      this._afterTable?.flashColumn(INDICATOR_COL, 'amber');
    });
  }

  _toggleIndicator(rowIdx) {
    if (!this._completedTasks.has('column') || this._completedTasks.has('indicator')) return;
    if (!Number.isInteger(rowIdx) || rowIdx < 0 || rowIdx >= this._indicatorDraft.length) return;

    this._indicatorDraft[rowIdx] = this._indicatorDraft[rowIdx] === 1 ? 0 : 1;
    this._syncIndicatorEditor();
    this._syncAfterTable();
  }

  _checkIndicator() {
    if (!this._completedTasks.has('column') || this._completedTasks.has('indicator')) return;

    const candidate = ORIGINAL_DF.assign(INDICATOR_COL, this._indicatorDraft);
    if (!validateIndicatorColumn(candidate, SOURCE_COL, INDICATOR_COL)) {
      this._setFeedback('That indicator pattern is off. Give 1 only to the row that was originally missing before the fill.');
      this._setStatus('Re-check the original Before table. Only row 2 started with a missing Age value.');
      this._engine.mistake({ costsLife: false, countsMistake: true });
      this._shakeIndicatorButtons();
      return;
    }

    this._completedTasks.add('indicator');
    this._completed = true;
    this._engine.correct();
    this._syncAfterTable();
    this._syncChecklist();
    this._syncProgress();
    this._setFeedback(SUMMARY_COPY);
    this._setStatus('All three steps are locked. Review the recap and formula card, then continue.');
    this._revealSummary();

    requestAnimationFrame(() => {
      this._afterTable?.flashColumn(INDICATOR_COL, 'green');
    });
  }

  _revealSummary() {
    if (!this._ui.summary) return;

    this._ui.summary.hidden = false;
    requestAnimationFrame(() => {
      this._ui.summary.classList.add('is-revealed');
    });
    this._ui.summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  _showHint() {
    const { allowed, text } = this._engine.requestHint();
    if (!allowed || !text) return;

    this._ui.hintBox?.removeAttribute('hidden');
    if (this._ui.hintText) {
      this._ui.hintText.textContent = text;
    }
  }

  _resetLevel() {
    this._completedTasks.clear();
    this._selectedGap = false;
    this._completed = false;
    this._indicatorDraft = [...EXPECTED_INDICATOR].map(() => 0);

    this._ui.summary?.setAttribute('hidden', '');
    this._ui.summary?.classList.remove('is-revealed');
    this._ui.fillInput && (this._ui.fillInput.value = '');
    this._ui.columnInput && (this._ui.columnInput.value = '');
    this._ui.fillInput?.classList.remove('is-error', 'is-solved');
    this._ui.columnInput?.classList.remove('is-error', 'is-solved');

    this._mountTables();
    this._syncChecklist();
    this._syncProgress();
    this._syncAfterPanel();
    this._setFeedback(DEFAULT_FEEDBACK);
    this._setStatus(DEFAULT_STATUS);
  }

  _currentAfterFrame() {
    if (this._completedTasks.has('indicator')) {
      return indicatorDraftFrame(EXPECTED_INDICATOR);
    }

    if (this._completedTasks.has('column')) {
      return indicatorDraftFrame(this._indicatorDraft);
    }

    if (this._completedTasks.has('fill')) {
      return FILLED_DF;
    }

    return ORIGINAL_DF;
  }

  _syncAfterTable() {
    const nextDf = this._currentAfterFrame();
    this._afterTable?.update(nextDf);
    requestAnimationFrame(() => {
      this._decorateAfterPanel();
    });
  }

  _syncChecklist() {
    const fillSolved = this._completedTasks.has('fill');
    const columnSolved = this._completedTasks.has('column');
    const indicatorSolved = this._completedTasks.has('indicator');

    this._setStepState('fill', fillSolved ? 'solved' : this._selectedGap ? 'active' : 'pending');
    this._setStepState('column', columnSolved ? 'solved' : fillSolved ? 'pending' : 'locked');
    this._setStepState('indicator', indicatorSolved ? 'solved' : columnSolved ? 'pending' : 'locked');

    if (this._ui.fillStatus) {
      this._ui.fillStatus.textContent = fillSolved ? 'Solved' : this._selectedGap ? 'Armed' : 'Pending';
    }

    if (this._ui.columnStatus) {
      this._ui.columnStatus.textContent = columnSolved ? 'Solved' : fillSolved ? 'Ready' : 'Locked';
    }

    if (this._ui.indicatorStatus) {
      this._ui.indicatorStatus.textContent = indicatorSolved ? 'Solved' : columnSolved ? 'Ready' : 'Locked';
    }

    if (this._ui.fillResult) {
      this._ui.fillResult.textContent = fillSolved
        ? 'Age repaired. Row 2 now carries the median value 27.'
        : this._selectedGap
          ? 'Gap selected. Enter the repair value that best centers the observed ages.'
          : 'Click the missing Age cell on the left to unlock this step.';
    }

    if (this._ui.columnResult) {
      this._ui.columnResult.textContent = columnSolved
        ? 'Column added. The After panel can now track missingness explicitly.'
        : fillSolved
          ? 'Ready to add the indicator column using the feature-name + _missing pattern.'
          : 'Unlocks after the Age repair is solved.';
    }

    if (this._ui.indicatorResult) {
      this._ui.indicatorResult.textContent = indicatorSolved
        ? 'Indicator locked. Only the originally missing row carries a 1.'
        : columnSolved
          ? 'Toggle the rows and lock the final 0/1 pattern.'
          : 'Create the column first, then mark the original missing row.';
    }

    if (this._ui.fillInput) {
      this._ui.fillInput.disabled = fillSolved || !this._selectedGap;
      if (fillSolved) this._ui.fillInput.value = String(MEDIAN_VALUE);
    }

    if (this._ui.fillSubmit) {
      this._ui.fillSubmit.disabled = fillSolved || !this._selectedGap;
    }

    if (this._ui.columnInput) {
      this._ui.columnInput.disabled = columnSolved || !fillSolved;
      if (columnSolved) this._ui.columnInput.value = INDICATOR_COL;
    }

    if (this._ui.columnSubmit) {
      this._ui.columnSubmit.disabled = columnSolved || !fillSolved;
    }

    if (this._ui.indicatorCheck) {
      this._ui.indicatorCheck.disabled = indicatorSolved || !columnSolved;
    }

    this._syncIndicatorEditor();
  }

  _syncIndicatorEditor() {
    const indicatorEnabled = this._completedTasks.has('column') && !this._completedTasks.has('indicator');

    this._ui.indicatorButtons.forEach((button, index) => {
      button.disabled = !indicatorEnabled;
      button.dataset.indicatorState = this._indicatorDraft[index] === 1 ? 'active' : 'inactive';
    });

    this._ui.indicatorValues.forEach((node, index) => {
      node.textContent = String(this._indicatorDraft[index]);
    });
  }

  _syncAfterPanel() {
    const solvedCount = this._completedTasks.size;
    if (this._ui.progress) {
      this._ui.progress.textContent = `${solvedCount} / 3 transformation steps locked`;
    }

    if (this._ui.finishButton) {
      this._ui.finishButton.disabled = !this._completed;
    }
  }

  _syncProgress() {
    this._syncAfterPanel();
  }

  _decorateBeforeGapCell() {
    const gapCell = this._ui.beforeHost?.querySelector(`td[data-col="${SOURCE_COL}"][data-row-idx="${MISSING_ROW_INDEX}"]`);
    if (!gapCell) return;

    gapCell.classList.add('w2-indicator-gap-cell');
    gapCell.classList.toggle('is-selected', this._selectedGap && !this._completedTasks.has('fill'));

    const nullText = gapCell.querySelector('.dt-null-text');
    if (nullText) {
      nullText.textContent = '?';
      nullText.setAttribute('aria-label', 'Missing Age value');
    }
  }

  _decorateAfterPanel() {
    const stage = this._completedTasks.has('indicator')
      ? 'complete'
      : this._completedTasks.has('column')
        ? 'column'
        : this._completedTasks.has('fill')
          ? 'filled'
          : 'locked';

    if (this._ui.afterShell) {
      this._ui.afterShell.dataset.afterStage = stage;
    }

    if (this._ui.afterOverlay) {
      this._ui.afterOverlay.hidden = stage !== 'locked';
      this._ui.afterOverlay.querySelector('.w2-indicator-after-overlay__copy').textContent =
        stage === 'locked'
          ? 'Repair the missing Age cell on the left to reveal the first transformation.'
          : stage === 'filled'
            ? 'Age is repaired. Add the Age_missing column to keep the original gap visible.'
            : stage === 'column'
              ? 'The new column is live. Toggle the rows until only the original gap is marked with 1.'
              : 'Preview complete. The table now keeps both the imputed value and the missingness signal.';
    }

    const afterGapCell = this._ui.afterHost?.querySelector(`td[data-col="${SOURCE_COL}"][data-row-idx="${MISSING_ROW_INDEX}"]`);
    const afterNullText = afterGapCell?.querySelector('.dt-null-text');
    if (afterNullText) {
      afterNullText.textContent = '?';
      afterNullText.setAttribute('aria-label', 'Missing Age value');
    }

    const indicatorCells = this._ui.afterHost?.querySelectorAll(`th[data-col="${INDICATOR_COL}"], td[data-col="${INDICATOR_COL}"]`) ?? [];
    indicatorCells.forEach(cell => {
      cell.classList.toggle('w2-indicator-after-draft', stage === 'column');
      cell.classList.toggle('w2-indicator-after-final', stage === 'complete');
    });
  }

  _setStepState(stepId, state) {
    const card = this._ui.stepCards.find(node => node.getAttribute('data-step-id') === stepId);
    if (card) {
      card.dataset.stepState = state;
    }
  }

  _shakeIndicatorButtons() {
    this._ui.indicatorButtons.forEach(button => {
      button.classList.remove('w2-indicator-toggle--shake');
      void button.offsetWidth;
      button.classList.add('w2-indicator-toggle--shake');
    });
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
