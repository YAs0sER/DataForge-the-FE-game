'use strict';

import { validateIndicatorColumn } from '../../data/answers.js';
import { createDataset, DATASET_KEYS } from '../../data/datasets.js';
import { getLevelProblem } from '../../data/problems.js';
import { DataTable } from '../../widgets/datatable.js';
import { CodeEditorWidget } from '../../widgets/editor.js?v=20260614b';

const PROBLEM = getLevelProblem(2, 6);
const ORIGINAL_DF = createDataset(DATASET_KEYS.MISSING_CODE_FIX);
const AGE_COL = 'Age';
const CITY_COL = 'City';
const INDICATOR_COL = 'Age_missing';
const CITY_FILL_VALUE = 'Missing';
const AGE_MEDIAN = ORIGINAL_DF.col(AGE_COL).median();
const AGE_MISSING_ROWS = ORIGINAL_DF.col(AGE_COL).values
  .map((value, index) => (value == null ? index : -1))
  .filter(index => index >= 0);
const CITY_MISSING_ROWS = ORIGINAL_DF.col(CITY_COL).values
  .map((value, index) => (value == null ? index : -1))
  .filter(index => index >= 0);
const REFERENCE = Object.freeze(
  Array.isArray(PROBLEM?.reference) && PROBLEM.reference.length
    ? PROBLEM.reference
    : [
      'df.info()',
      'df.isnull().sum()',
      "df['Age'].fillna(df['Age'].median())",
      "df['City'].fillna('Missing')",
      "df['Age_missing'] = df['Age'].isnull().astype(int)",
    ]
);

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM?.hints ?? []),
  'Preserve Age missingness before you overwrite Age, or the indicator will lose the original gaps.',
  "Use df['Age_missing'] = df['Age'].isnull().astype(int) while Age still contains NaN values.",
  "City is categorical here, so filling it with the text category 'Missing' is acceptable.",
]);

const INITIAL_CODE = `# Inspect the null pattern first.
# Preserve missingness before you overwrite it.
# Then choose the safest repairs for numeric and categorical gaps.

# df.info()
# df.isnull().sum()

# Write your pandas-like commands below:
`;

const DEFAULT_FEEDBACK = 'Inspect the null counts, preserve the Age signal before you overwrite it, then choose the safest numeric and categorical repairs.';
const DEFAULT_STATUS = 'Inspect the nulls, preserve missingness memory, then choose the right fixes for the numeric and categorical gaps.';
const SUMMARY_COPY = 'The clean fix keeps three things at once: no missing Age values, no missing City values, and a dedicated flag that remembers which Age rows were originally blank.';

const TASKS = Object.freeze([
  {
    id: 'age-indicator',
    label: 'Preserve the original Age missingness signal',
    validate(df) {
      if (!df.columns.includes(INDICATOR_COL)) return false;
      const candidate = ORIGINAL_DF.assign(INDICATOR_COL, df.col(INDICATOR_COL).values);
      return validateIndicatorColumn(candidate, AGE_COL, INDICATOR_COL);
    },
  },
  {
    id: 'age-median',
    label: 'Repair the numeric Age gaps with a robust center',
    validate(df) {
      const values = df.col(AGE_COL).values;
      if (df.isnullSum()[AGE_COL] !== 0) return false;
      return AGE_MISSING_ROWS.every(index => values[index] === AGE_MEDIAN);
    },
  },
  {
    id: 'city-fill',
    label: 'Repair the City gaps with an explicit category',
    validate(df) {
      const values = df.col(CITY_COL).values;
      if (df.isnullSum()[CITY_COL] !== 0) return false;
      return CITY_MISSING_ROWS.every(index => values[index] === CITY_FILL_VALUE);
    },
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

function taskIdsFromSummary(summary) {
  return TASKS
    .filter((task, index) => summary.tasks[index]?.passed)
    .map(task => task.id);
}

function labelForTask(taskId) {
  return TASKS.find(task => task.id === taskId)?.label ?? taskId;
}

function resultTone(summary) {
  if (!summary) return DEFAULT_FEEDBACK;
  if (summary.errorRuns === 0) {
    return 'Clean run. You inspected, preserved the missingness signal, and repaired both features without burning any error runs.';
  }
  if (summary.errorRuns <= 2) {
    return 'Strong finish. The dataset is repaired, and you recovered from a small number of wrong turns without losing the workflow.';
  }
  return 'Mission complete. The recap below shows the safest missing-data sequence to keep in mind for later code levels.';
}

export default class World2Level6 {
  meta = {
    title: PROBLEM?.title ?? 'Code Fix — Imputation',
    subtitle: PROBLEM?.objective ?? 'Use pandas-like commands to clean a dataset with missing numeric and categorical features.',
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._events = null;
    this._table = null;
    this._editor = null;
    this._passedTaskIds = new Set();
    this._awardedTaskIds = new Set();
    this._errorRuns = 0;
    this._completed = false;
    this._summary = null;
    this._ui = {};
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w2-level w2-level--codefix screen-section" aria-label="World 2 Level 6">
        <div class="level-hero w2-level__hero" style="--world-color: var(--color-world-2);">
          <p class="eyebrow">World 2 - Missing Data</p>
          <h1 class="level-hero__title">${escapeHtml(PROBLEM.title)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(PROBLEM.objective)}
            This is the first code lab, so the goal is not just the final table. It is using the right sequence while the missingness signal is still available.
          </p>
          <div class="action-row">
            <span class="status-box" id="w2-l6-progress">0 / ${TASKS.length} repairs locked</span>
            <span class="status-box" id="w2-l6-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w2-l6-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w2-l6-reset-btn" type="button">Reset Lab</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">06</span>
        </div>

        <div class="w2-codefix-layout">
          <div class="w2-codefix-data-stack">
            <article class="panel w2-codefix-table-panel">
              <div class="w2-level__panel-head">
                <div>
                  <p class="eyebrow">Dataset Console</p>
                  <h2 class="panel-title">15 rows, two missing-value columns, one signal worth preserving</h2>
                </div>
                <p class="w2-level__microcopy">
                  The table updates live after every successful run. Null badges stay on the headers so you can watch the gaps disappear.
                </p>
              </div>

              <div class="w2-codefix-snapshot" aria-label="Repair Snapshot">
                <article class="w2-codefix-snapshot__card">
                  <span class="w2-codefix-snapshot__label">Age Nulls</span>
                  <strong class="w2-codefix-snapshot__value" id="w2-l6-age-null-count">3</strong>
                </article>
                <article class="w2-codefix-snapshot__card">
                  <span class="w2-codefix-snapshot__label">City Nulls</span>
                  <strong class="w2-codefix-snapshot__value" id="w2-l6-city-null-count">3</strong>
                </article>
                <article class="w2-codefix-snapshot__card">
                  <span class="w2-codefix-snapshot__label">Age Indicator</span>
                  <strong class="w2-codefix-snapshot__value" id="w2-l6-indicator-state">Not Added</strong>
                </article>
              </div>

              <div class="w2-codefix-table-shell" id="w2-l6-table"></div>
            </article>

            <div class="w2-codefix-support">
              <section class="card card--elevated w2-level__feedback" aria-live="polite">
                <p class="eyebrow">Coach Feed</p>
                <p id="w2-l6-feedback-text" class="w2-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
              </section>

              <section class="card w2-level__hint-box" id="w2-l6-hint-box" hidden>
                <p class="eyebrow">Hint</p>
                <p id="w2-l6-hint-text" class="w2-level__hint-copy"></p>
              </section>

              <section class="card w2-codefix-guide">
                <p class="eyebrow">Decision Rules</p>
                <div class="w2-codefix-guide__steps">
                  <article class="w2-codefix-guide__step">
                    <span class="w2-codefix-guide__badge">1</span>
                    <p>Inspect the null counts with <code>df.info()</code> or <code>df.isnull().sum()</code>.</p>
                  </article>
                  <article class="w2-codefix-guide__step">
                    <span class="w2-codefix-guide__badge">2</span>
                    <p>Preserve missingness before overwrite. If you fill <code>Age</code> first, the original gaps disappear.</p>
                  </article>
                  <article class="w2-codefix-guide__step">
                    <span class="w2-codefix-guide__badge">3</span>
                    <p>Choose the repair from the column type: use a robust center for skewed numeric data, and an explicit label for missing categorical values.</p>
                  </article>
                </div>
              </section>
            </div>
          </div>

          <article class="panel w2-codefix-editor-panel">
            <div class="w2-level__panel-head">
              <div>
                <p class="eyebrow">Code Arena</p>
                <h2 class="panel-title">Write the pandas-like repair commands in the correct order</h2>
              </div>
              <p class="w2-level__microcopy">
                Exploration commands are safe. The editor auto-pairs quotes and brackets now, but wrong fill commands still overwrite blanks, so use Reset if you choose the wrong strategy.
              </p>
            </div>

            <div class="w2-codefix-editor-shell" id="w2-l6-editor"></div>
          </article>
        </div>

        <section class="panel w2-codefix-summary" id="w2-l6-summary" hidden aria-label="Code Fix Recap">
          <div class="w2-level__panel-head">
            <div>
              <p class="eyebrow">Code Lab Recap</p>
              <h2 class="panel-title">The repaired dataset keeps both usability and missingness memory</h2>
            </div>
            <p class="w2-level__microcopy">${escapeHtml(SUMMARY_COPY)}</p>
          </div>

          <div class="w2-codefix-summary__grid">
            <article class="w2-codefix-summary__card">
              <p class="w2-codefix-summary__kicker">Signal First</p>
              <h3 class="w2-codefix-summary__title">Age_missing before fill</h3>
              <p class="w2-codefix-summary__copy">The indicator must be created while Age still contains nulls, otherwise the original missing rows disappear from view.</p>
            </article>
            <article class="w2-codefix-summary__card">
              <p class="w2-codefix-summary__kicker">Numeric Repair</p>
              <h3 class="w2-codefix-summary__title">Age -> median (${AGE_MEDIAN})</h3>
              <p class="w2-codefix-summary__copy">Median protects the numeric repair from skew better than a raw average would in this dataset.</p>
            </article>
            <article class="w2-codefix-summary__card">
              <p class="w2-codefix-summary__kicker">Categorical Repair</p>
              <h3 class="w2-codefix-summary__title">City -> "${CITY_FILL_VALUE}"</h3>
              <p class="w2-codefix-summary__copy">A text category keeps every row while making the absence explicit instead of pretending it was one of the observed cities.</p>
            </article>
          </div>

          <div class="action-row">
            <span class="status-box" id="w2-l6-summary-score">Waiting for a clean repair run</span>
            <button class="btn btn--primary" id="w2-l6-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w2-l6-progress');
    this._ui.status = container.querySelector('#w2-l6-status');
    this._ui.feedback = container.querySelector('#w2-l6-feedback-text');
    this._ui.hintBox = container.querySelector('#w2-l6-hint-box');
    this._ui.hintText = container.querySelector('#w2-l6-hint-text');
    this._ui.tableHost = container.querySelector('#w2-l6-table');
    this._ui.editorHost = container.querySelector('#w2-l6-editor');
    this._ui.ageNullCount = container.querySelector('#w2-l6-age-null-count');
    this._ui.cityNullCount = container.querySelector('#w2-l6-city-null-count');
    this._ui.indicatorState = container.querySelector('#w2-l6-indicator-state');
    this._ui.summary = container.querySelector('#w2-l6-summary');
    this._ui.summaryScore = container.querySelector('#w2-l6-summary-score');
    this._ui.finishButton = container.querySelector('#w2-l6-finish-btn');

    this._mountTable();
    this._mountEditor();
    this._syncSnapshot(ORIGINAL_DF);
    this._syncProgress();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w2-l6-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w2-l6-reset-btn') || event.target.closest('.editor-reset')) {
        this._resetLab();
        return;
      }

      if (event.target.closest('#w2-l6-finish-btn')) {
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
    this._table = null;
    this._editor = null;
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
      worldColor: 'var(--color-world-2)',
    });
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
      worldColor: 'var(--color-world-2)',
      onRun: summary => this._handleRun(summary),
    });
  }

  _handleRun(summary) {
    const hasError = summary.results.some(result => result.status === 'error');
    const changedData = summary.results.some(result => result.df);
    const nextPassedIds = new Set(taskIdsFromSummary(summary));
    const newlyPassedIds = [...nextPassedIds].filter(taskId => !this._awardedTaskIds.has(taskId));

    this._passedTaskIds = nextPassedIds;
    this._syncSnapshot(summary.df);

    if (hasError) {
      this._errorRuns += 1;
      this._engine.mistake({ costsLife: false, countsMistake: true });
      this._setFeedback('The interpreter hit an error. Stick closely to the reference card and remember that this runner expects pandas-like commands, not free-form Python.');
      this._setStatus('Execution error. Reset only if you already overwrote a column with the wrong repair.');
      this._syncProgress();
      return;
    }

    if (newlyPassedIds.length) {
      newlyPassedIds.forEach(taskId => {
        this._awardedTaskIds.add(taskId);
        this._engine.correct();
      });

      this._handleMilestone(newlyPassedIds, summary.df);
      this._syncProgress();

      if (nextPassedIds.size === TASKS.length) {
        this._completeRun();
      }
      return;
    }

    if (changedData) {
      this._engine.mistake({ costsLife: false, countsMistake: true });
      this._handleNonPassingMutation(summary.df);
      this._syncProgress();
      return;
    }

    this._handleInspectionRun(summary);
    this._syncProgress();
  }

  _handleMilestone(taskIds, df) {
    taskIds.forEach(taskId => {
      if (taskId === 'age-indicator') {
        this._table?.flashColumn(INDICATOR_COL, 'green');
      }
      if (taskId === 'age-median') {
        this._table?.flashColumn(AGE_COL, 'green');
      }
      if (taskId === 'city-fill') {
        this._table?.flashColumn(CITY_COL, 'green');
      }
    });

    const currentCount = this._passedTaskIds.size;
    const labels = taskIds.map(labelForTask);
    const ageConsumedWithoutIndicator = df.isnullSum()[AGE_COL] === 0 && !this._passedTaskIds.has('age-indicator');

    if (currentCount === TASKS.length) {
      this._setFeedback('All three repairs are locked. The table is clean, and the Age missingness signal is still preserved.');
      this._setStatus('Mission complete. Review the recap below, then continue to the next world.');
      return;
    }

    if (ageConsumedWithoutIndicator) {
      this._setFeedback('You repaired Age before preserving its missingness memory. Use Reset, then create the missingness indicator before you overwrite the Age nulls.');
      this._setStatus('Reset recommended. Once Age has no nulls left, the correct indicator can no longer be reconstructed in this lab.');
      return;
    }

    if (labels.length === 1) {
      this._setFeedback(`${labels[0]} is now locked in.`);
    } else {
      this._setFeedback(`${labels.join(' + ')} locked in on the same run.`);
    }

    if (!this._passedTaskIds.has('age-indicator')) {
      this._setStatus('Missingness signal still pending. Create the indicator column before you overwrite Age.');
      return;
    }

    if (!this._passedTaskIds.has('age-median')) {
      this._setStatus('Signal preserved. Next: choose the safest repair for the numeric Age gaps.');
      return;
    }

    if (!this._passedTaskIds.has('city-fill')) {
      this._setStatus('Numeric repair is done. Finish the categorical repair with an explicit missing category.');
    }
  }

  _handleInspectionRun(summary) {
    const inspectedNulls = summary.results.some(result => result.sideEffect?.type === 'isnull_sum' || result.raw === 'df.info()');
    if (inspectedNulls) {
      this._setFeedback('Good inspection run. Age and City are the two missing-value targets, and the Age signal should be preserved before the numeric gaps are overwritten.');
      this._setStatus('Inspection complete. Preserve the Age signal next, then choose the numeric and categorical repairs.');
      return;
    }

    this._setFeedback('No repair landed yet, but the run was safe. Use the decision rules and the reference card to move from inspection into the three actual fixes.');
    this._setStatus(DEFAULT_STATUS);
  }

  _handleNonPassingMutation(df) {
    const nulls = df.isnullSum();
    const hasIndicator = df.columns.includes(INDICATOR_COL);
    const indicatorCorrect = hasIndicator && TASKS[0].validate(df);

    if (nulls[AGE_COL] === 0 && !indicatorCorrect) {
      this._setFeedback('Age has already been overwritten without preserving the original gaps. Use Reset, then create the missingness indicator before you fill Age.');
      this._setStatus('Reset recommended. The Age indicator must be created while the column still contains null values.');
      return;
    }

    if (nulls[AGE_COL] === 0 && !TASKS[1].validate(df)) {
      this._setFeedback(`Age is filled, but not with the median repair. Use Reset and rerun the Age fill with df['Age'].fillna(df['Age'].median()).`);
      this._setStatus('Reset recommended. Wrong fill values cannot be repaired with fillna once the nulls are gone.');
      return;
    }

    if (nulls[CITY_COL] === 0 && !TASKS[2].validate(df)) {
      this._setFeedback(`City is filled, but not with the explicit "${CITY_FILL_VALUE}" category. Use Reset and rerun the categorical repair.`);
      this._setStatus('Reset recommended. Categorical fill choices overwrite the original blanks.');
      return;
    }

    this._setFeedback('That run changed the table, but no repair objective locked in. Compare the result against the three mission targets before you run again.');
    this._setStatus('No mission card advanced. Reset if you consumed the nulls with the wrong transformation.');
  }

  _completeRun() {
    this._completed = true;
    this._summary = {
      tasksCompleted: TASKS.length,
      totalTasks: TASKS.length,
      errorRuns: this._errorRuns,
    };

    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = `${TASKS.length} / ${TASKS.length} repairs locked`;
    }

    if (this._ui.summary) {
      this._ui.summary.hidden = false;
      requestAnimationFrame(() => {
        this._ui.summary.classList.add('is-revealed');
      });
      this._ui.summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    this._setFeedback(resultTone(this._summary));
    this._setStatus('Code lab complete. The repaired dataset is ready for the next world.');
    this._syncProgress();
  }

  _resetLab() {
    this._passedTaskIds.clear();
    this._awardedTaskIds.clear();
    this._errorRuns = 0;
    this._completed = false;
    this._summary = null;

    this._editor?.reset(ORIGINAL_DF);
    this._syncSnapshot(ORIGINAL_DF);

    if (this._ui.summary) {
      this._ui.summary.hidden = true;
      this._ui.summary.classList.remove('is-revealed');
    }

    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = 'Waiting for a clean repair run';
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
    const nulls = df.isnullSum();
    const hasIndicator = df.columns.includes(INDICATOR_COL);
    const indicatorCorrect = hasIndicator && TASKS[0].validate(df);

    if (this._ui.ageNullCount) {
      this._ui.ageNullCount.textContent = String(nulls[AGE_COL] ?? 0);
    }

    if (this._ui.cityNullCount) {
      this._ui.cityNullCount.textContent = String(nulls[CITY_COL] ?? 0);
    }

    if (this._ui.indicatorState) {
      this._ui.indicatorState.textContent = !hasIndicator ? 'Not Added' : indicatorCorrect ? 'Correct' : 'Present';
      this._ui.indicatorState.dataset.state = !hasIndicator ? 'missing' : indicatorCorrect ? 'correct' : 'present';
    }
  }

  _syncProgress() {
    if (this._ui.progress) {
      this._ui.progress.textContent = `${this._passedTaskIds.size} / ${TASKS.length} repairs locked`;
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
