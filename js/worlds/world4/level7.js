'use strict';

import { createDataset, DATASET_KEYS } from '../../data/datasets.js';
import { getLevelProblem } from '../../data/problems.js';
import { DataFrame } from '../../pandas/dataframe.js';
import { DataTable } from '../../widgets/datatable.js';
import { CodeEditorWidget } from '../../widgets/editor.js?v=20260614b';

const PROBLEM = getLevelProblem(4, 7);
const LEVEL_TITLE = PROBLEM?.title ?? 'Code Fix - Encoding';
const LEVEL_OBJECTIVE = PROBLEM?.objective ?? 'Group rare categories and encode nominal and ordinal columns correctly.';

function createFallbackDataset() {
  return DataFrame.fromRows([
    { City: 'Rabat',      Education_Level: 'Bac',      Satisfaction: 'Low',    Target: 0 },
    { City: 'Casablanca', Education_Level: 'Licence',  Satisfaction: 'Medium', Target: 1 },
    { City: 'Marrakech',  Education_Level: 'Master',   Satisfaction: 'High',   Target: 1 },
    { City: 'Rabat',      Education_Level: 'Licence',  Satisfaction: 'Low',    Target: 0 },
    { City: 'Agadir',     Education_Level: 'Doctorat', Satisfaction: 'High',   Target: 1 },
    { City: 'Fes',        Education_Level: 'Master',   Satisfaction: 'Medium', Target: 1 },
    { City: 'Dakhla',     Education_Level: 'Bac',      Satisfaction: 'Low',    Target: 0 },
    { City: 'Tangier',    Education_Level: 'Licence',  Satisfaction: 'Medium', Target: 1 },
    { City: 'Oujda',      Education_Level: 'Master',   Satisfaction: 'High',   Target: 1 },
    { City: 'Kenitra',    Education_Level: 'Bac',      Satisfaction: 'Low',    Target: 0 },
  ]);
}

function createLevelDataset() {
  try {
    return createDataset(PROBLEM?.datasetKey ?? DATASET_KEYS.ENCODING_PRACTICE);
  } catch {
    return createFallbackDataset();
  }
}

const ORIGINAL_DF = createLevelDataset();
const CITY_COL = 'City';
const SATISFACTION_COL = 'Satisfaction';
const EDUCATION_COL = 'Education_Level';
const TARGET_COL = 'Target';
const GROUPED_LABEL = 'Autres';
const REFERENCE_THRESHOLD = 0.15;
const SATISFACTION_ORDER = Object.freeze(['Low', 'Medium', 'High']);
const ORIGINAL_ROWS = ORIGINAL_DF.toRows();
const ORIGINAL_CITY_VALUES = ORIGINAL_DF.col(CITY_COL).values;
const ORIGINAL_EDUCATION_VALUES = ORIGINAL_DF.col(EDUCATION_COL).values;
const ORIGINAL_TARGET_VALUES = ORIGINAL_DF.col(TARGET_COL).values;
const CITY_FREQ_MAP = ORIGINAL_DF.col(CITY_COL).valueCounts(true);
const RARE_CITIES = Object.freeze(
  Object.entries(CITY_FREQ_MAP)
    .filter(([, freq]) => freq < REFERENCE_THRESHOLD)
    .map(([city]) => city)
);
const GROUPED_DF = ORIGINAL_DF.replace(CITY_COL, RARE_CITIES, GROUPED_LABEL);
const GROUPED_CITY_VALUES = GROUPED_DF.col(CITY_COL).values;
const GROUPED_CITY_CARDINALITY = GROUPED_DF.col(CITY_COL).nunique();
const SURVIVING_CITIES = Object.freeze(
  [...new Set(GROUPED_CITY_VALUES)]
    .filter(value => value !== GROUPED_LABEL)
    .sort()
);
const SURVIVING_CITY_LABEL = SURVIVING_CITIES.join(', ');
const EXPECTED_ONEHOT_DF = GROUPED_DF.getDummies(CITY_COL);
const EXPECTED_CITY_DUMMY_COLS = Object.freeze(
  EXPECTED_ONEHOT_DF.columns
    .filter(col => col.startsWith(`${CITY_COL}_`))
    .sort()
);

const PROBLEM_TASKS = new Map((PROBLEM?.tasks ?? []).map(task => [task.id, task.label]));

const REFERENCE = Object.freeze([
  'df.head()  # Preview the rows and identify the feature types.',
  "df['Column'].value_counts(normalize=True)  # Inspect category proportions.",
  "df['Column'] = df['Column'].replace(threshold, 'GroupedLabel')  # Merge categories below a chosen frequency.",
  "df['OrdinalColumn'] = df['OrdinalColumn'].map({'First': 0, 'Second': 1, 'Third': 2})  # Preserve a real rank.",
  "df = pd.get_dummies(df, columns=['NominalColumn'])  # Expand a nominal feature after controlling cardinality.",
  '# Decide which real columns, threshold, labels, and order fit the dataset.',
]);

const TASKS = Object.freeze([
  Object.freeze({
    id: 'group-rare-city',
    label: PROBLEM_TASKS.get('group-rare-city') ?? 'Group rare City labels into Autres before one-hot expansion',
    validate: validateGroupedCity,
  }),
  Object.freeze({
    id: 'label-satisfaction',
    label: PROBLEM_TASKS.get('label-satisfaction') ?? 'Label encode Satisfaction while keeping Low < Medium < High',
    validate: validateSatisfactionEncoding,
  }),
  Object.freeze({
    id: 'onehot-city',
    label: PROBLEM_TASKS.get('onehot-city') ?? 'One-hot encode the grouped City column into the compact dummy block',
    validate: validateOneHotCity,
  }),
]);

const TRACKER_STEPS = Object.freeze([
  Object.freeze({
    id: 'inspect',
    label: 'Inspect the city frequency map',
    chapter: 'Read the tail',
    recap: `${SURVIVING_CITY_LABEL} is the only city above the singleton band, so the long tail should collapse before any dummy columns appear.`,
  }),
  Object.freeze({
    id: 'group-rare-city',
    label: 'Collapse the singleton cities into Autres',
    chapter: 'High Cardinality',
    recap: `The eight singleton city labels should merge into ${GROUPED_LABEL}, which shrinks the vocabulary from ${ORIGINAL_DF.col(CITY_COL).nunique()} labels to ${GROUPED_CITY_CARDINALITY}.`,
  }),
  Object.freeze({
    id: 'label-satisfaction',
    label: 'Keep Satisfaction as one ordered numeric signal',
    chapter: 'Ordinal Safe Zone',
    recap: 'Satisfaction is genuinely ordered, so one compact numeric column is healthier than exploding it into multiple binary flags.',
  }),
  Object.freeze({
    id: 'onehot-city',
    label: 'Expand only the grouped City column into dummies',
    chapter: 'Compact Matrix',
    recap: `After grouping, the city feature should widen into only ${EXPECTED_CITY_DUMMY_COLS.length} dummy columns instead of a nine-column sparse block.`,
  }),
]);

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM?.hints ?? []),
  `${SURVIVING_CITY_LABEL} is the only city that appears twice. Every other city is a singleton.`,
  'Any threshold above 0.10 and at most 0.20 groups the singletons while leaving the repeated city alone. The reference card uses 0.15.',
  'If you one-hot encode City before grouping it, the original City column disappears and the compact repair is no longer reachable without Reset.',
]);

const INITIAL_CODE = `# Inspect the city tail before you expand anything.
# City should shrink first. Satisfaction should stay compact.

# df.head()
# df['City'].value_counts(normalize=True)

# Write your pandas-like commands below:
`;

const DEFAULT_FEEDBACK = 'Inspect the city frequencies first, then collapse the singleton cities before you widen the matrix.';
const DEFAULT_STATUS = 'Recommended flow: inspect City frequencies -> group rare labels -> encode Satisfaction -> one-hot City.';
const SUMMARY_COPY = 'The clean encoding repair preserves ordinal meaning inside Satisfaction, compresses the long City tail into Autres, and only then expands City into a compact dummy block.';
const TOTAL_LOCKS = TRACKER_STEPS.length;
const NON_MUTATING_DF_TYPES = new Set(['head', 'tail', 'select']);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function arraysEqual(actual, expected) {
  if (!Array.isArray(actual) || !Array.isArray(expected) || actual.length !== expected.length) {
    return false;
  }

  return actual.every((value, index) => value === expected[index]);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function sameColumnValues(df, colName, expectedValues) {
  if (!(df instanceof DataFrame) || !df.columns.includes(colName)) return false;
  return arraysEqual(df.col(colName).values, expectedValues);
}

function protectedColumnsIntact(df) {
  if (!(df instanceof DataFrame)) return false;
  if (df.length !== ORIGINAL_DF.length) return false;

  return (
    sameColumnValues(df, EDUCATION_COL, ORIGINAL_EDUCATION_VALUES) &&
    sameColumnValues(df, TARGET_COL, ORIGINAL_TARGET_VALUES)
  );
}

function validateGroupedCity(df) {
  if (!(df instanceof DataFrame) || !protectedColumnsIntact(df)) return false;

  if (!df.columns.includes(CITY_COL)) {
    return validateOneHotCity(df);
  }

  return arraysEqual(df.col(CITY_COL).values, GROUPED_CITY_VALUES);
}

function validateSatisfactionEncoding(df) {
  if (!(df instanceof DataFrame) || !protectedColumnsIntact(df)) return false;
  if (!df.columns.includes(SATISFACTION_COL)) return false;

  const values = df.col(SATISFACTION_COL).values;
  if (!values.every(isFiniteNumber)) return false;

  const mapping = new Map();
  for (let index = 0; index < ORIGINAL_ROWS.length; index += 1) {
    const originalLabel = ORIGINAL_ROWS[index][SATISFACTION_COL];
    const encodedValue = values[index];
    if (mapping.has(originalLabel) && mapping.get(originalLabel) !== encodedValue) {
      return false;
    }
    mapping.set(originalLabel, encodedValue);
  }

  const low = mapping.get('Low');
  const medium = mapping.get('Medium');
  const high = mapping.get('High');

  return isFiniteNumber(low) && isFiniteNumber(medium) && isFiniteNumber(high) && low < medium && medium < high;
}

function validateOneHotCity(df) {
  if (!(df instanceof DataFrame) || !protectedColumnsIntact(df)) return false;
  if (df.columns.includes(CITY_COL)) return false;

  const actualDummyCols = df.columns
    .filter(col => col.startsWith(`${CITY_COL}_`))
    .sort();

  if (!arraysEqual(actualDummyCols, EXPECTED_CITY_DUMMY_COLS)) return false;

  return EXPECTED_CITY_DUMMY_COLS.every(col => sameColumnValues(df, col, EXPECTED_ONEHOT_DF.col(col).values));
}

function validateFinalSolution(df) {
  return validateOneHotCity(df) && validateSatisfactionEncoding(df);
}

function cityDummyCols(df) {
  if (!(df instanceof DataFrame)) return [];
  return df.columns.filter(col => col.startsWith(`${CITY_COL}_`));
}

function cityVocabularyState(df) {
  if (!(df instanceof DataFrame)) {
    return { label: '-', tone: 'missing' };
  }

  const dummyCols = cityDummyCols(df);
  if (dummyCols.length) {
    const exact = arraysEqual([...dummyCols].sort(), EXPECTED_CITY_DUMMY_COLS);
    return {
      label: `${dummyCols.length} dummies`,
      tone: exact ? 'correct' : 'warning',
    };
  }

  if (!df.columns.includes(CITY_COL)) {
    return { label: '-', tone: 'warning' };
  }

  const count = df.col(CITY_COL).nunique();
  return {
    label: String(count),
    tone: count === GROUPED_CITY_CARDINALITY ? 'present' : count === ORIGINAL_DF.col(CITY_COL).nunique() ? 'warning' : 'warning',
  };
}

function cityEncodingState(df) {
  if (validateOneHotCity(df)) {
    return { label: 'One-Hot', tone: 'correct' };
  }

  const dummyCols = cityDummyCols(df);
  if (dummyCols.length) {
    return { label: 'Exploded', tone: 'warning' };
  }

  if (!df.columns.includes(CITY_COL)) {
    return { label: 'Missing', tone: 'warning' };
  }

  if (validateGroupedCity(df)) {
    return { label: 'Grouped', tone: 'present' };
  }

  if (df.col(CITY_COL).values.includes(GROUPED_LABEL)) {
    return { label: 'Mixed', tone: 'warning' };
  }

  return { label: 'Raw', tone: 'missing' };
}

function satisfactionState(df) {
  if (validateSatisfactionEncoding(df)) {
    return { label: 'Encoded', tone: 'correct' };
  }

  if (!df.columns.includes(SATISFACTION_COL)) {
    return { label: 'Rebuilt', tone: 'warning' };
  }

  const values = df.col(SATISFACTION_COL).values;
  if (values.every(isFiniteNumber)) {
    return { label: 'Wrong Map', tone: 'warning' };
  }

  return { label: 'Text', tone: 'missing' };
}

function taskIdsFromSummary(summary) {
  return TASKS
    .filter((task, index) => summary.tasks[index]?.passed)
    .map(task => task.id);
}

function labelForTask(taskId) {
  return TASKS.find(task => task.id === taskId)?.label ?? taskId;
}

function inspectionUnlocked(summary) {
  return summary.results.some(result => {
    const type = result.sideEffect?.type;
    if (type === 'value_counts' && result.sideEffect?.col === CITY_COL) return true;
    if (type === 'head' || type === 'tail' || type === 'dtypes') return true;
    return result.raw === 'df.info()';
  });
}

function resultMutatesData(result) {
  if (!(result?.df instanceof DataFrame)) return false;
  return !NON_MUTATING_DF_TYPES.has(result.sideEffect?.type ?? '');
}

function trackerState(stepId, inspected, passedTaskIds) {
  if (stepId === 'inspect') {
    return inspected ? 'solved' : 'active';
  }

  if (stepId === 'onehot-city') {
    if (passedTaskIds.has('onehot-city')) return 'solved';
    return inspected && passedTaskIds.has('group-rare-city') ? 'active' : 'pending';
  }

  if (passedTaskIds.has(stepId)) return 'solved';
  return inspected ? 'active' : 'pending';
}

function stateLabel(state) {
  if (state === 'solved') return 'Locked';
  if (state === 'active') return 'Active';
  return 'Pending';
}

function resultTone(summary) {
  if (!summary) return DEFAULT_FEEDBACK;
  if (summary.mistakeRuns === 0) {
    return 'Clean lab. The rare city tail was compressed first, Satisfaction kept its true order, and the final dummy block stayed compact.';
  }
  if (summary.mistakeRuns <= 2) {
    return 'Strong finish. The final encoding choices are correct, and you recovered from a couple of detours without losing the main rule.';
  }
  return 'Mission complete. Use the recap below to keep the order of encoding decisions stable before the scaling world begins.';
}

export default class World4Level7 {
  meta = {
    title: LEVEL_TITLE,
    subtitle: LEVEL_OBJECTIVE,
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._events = null;
    this._table = null;
    this._editor = null;
    this._inspected = false;
    this._inspectionAwarded = false;
    this._passedTaskIds = new Set();
    this._awardedTaskIds = new Set();
    this._mistakeRuns = 0;
    this._completed = false;
    this._summary = null;
    this._ui = {};
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w4-level w4-level--codefix screen-section" aria-label="World 4 Level 7">
        <div class="level-hero w4-level__hero" style="--world-color: var(--color-world-4);">
          <p class="eyebrow">World 4 - Encoding</p>
          <h1 class="level-hero__title">${escapeHtml(LEVEL_TITLE)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(LEVEL_OBJECTIVE)}
            ${escapeHtml(CITY_COL)} is the wide nominal feature, so it should shrink before it expands. ${escapeHtml(SATISFACTION_COL)} is genuinely ordered, so it should stay compact as one numeric signal.
          </p>
          <div class="action-row">
            <span class="status-box" id="w4-l7-progress">0 / ${TOTAL_LOCKS} mission locks</span>
            <span class="status-box" id="w4-l7-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w4-l7-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w4-l7-reset-btn" type="button">Reset Lab</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">07</span>
        </div>

        <article class="panel w4-codefix-data-panel">
          <div class="w4-level__panel-head">
            <div>
              <p class="eyebrow">Dataset Console</p>
              <h2 class="panel-title">One long nominal tail, one safe ordinal signal, one target to leave untouched</h2>
            </div>
            <p class="w4-level__microcopy">
              The compact repair keeps all ${ORIGINAL_DF.length} rows, protects the true order inside ${escapeHtml(SATISFACTION_COL)}, and prevents ${escapeHtml(CITY_COL)} from exploding into nine sparse dummy columns.
            </p>
          </div>

          <div class="w4-codefix-snapshot" aria-label="Encoding Snapshot">
            <article class="w4-codefix-snapshot__card">
              <span class="w4-codefix-snapshot__label">Rows</span>
              <strong class="w4-codefix-snapshot__value" id="w4-l7-row-count">${ORIGINAL_DF.length}</strong>
            </article>
            <article class="w4-codefix-snapshot__card">
              <span class="w4-codefix-snapshot__label">${escapeHtml(CITY_COL)} Vocabulary</span>
              <strong class="w4-codefix-snapshot__value" id="w4-l7-city-vocab" data-state="warning">${ORIGINAL_DF.col(CITY_COL).nunique()}</strong>
            </article>
            <article class="w4-codefix-snapshot__card">
              <span class="w4-codefix-snapshot__label">${escapeHtml(SATISFACTION_COL)} State</span>
              <strong class="w4-codefix-snapshot__value" id="w4-l7-satisfaction-state" data-state="missing">Text</strong>
            </article>
            <article class="w4-codefix-snapshot__card">
              <span class="w4-codefix-snapshot__label">${escapeHtml(CITY_COL)} Encoding</span>
              <strong class="w4-codefix-snapshot__value" id="w4-l7-city-state" data-state="missing">Raw</strong>
            </article>
          </div>

          <div class="w4-codefix-table-shell" id="w4-l7-table"></div>
        </article>

        <div class="w4-codefix-main">
          <article class="panel w4-codefix-editor-panel">
            <div class="w4-level__panel-head">
              <div>
                <p class="eyebrow">Code Arena</p>
                <h2 class="panel-title">Shrink the long tail first, then encode the right columns the right way</h2>
              </div>
              <p class="w4-level__microcopy">
                The reference shows reusable operation shapes without assembling the solution. Choose the columns, threshold, grouped label, and ordinal order from the dataset evidence.
              </p>
            </div>

            <div class="w4-codefix-editor-shell" id="w4-l7-editor"></div>
          </article>

          <div class="w4-codefix-side">
            <section class="panel w4-codefix-tracker" aria-label="Encoding Tracker">
              <div class="w4-level__panel-head">
                <div>
                  <p class="eyebrow">Mission Tracker</p>
                  <h2 class="panel-title">Lock the diagnosis, the grouping, the ordinal map, and the final dummy block</h2>
                </div>
                <p class="w4-level__microcopy">
                  The final encoding choice only counts when the rare labels are already collapsed and the ordinal feature still keeps its ranking.
                </p>
              </div>

              <div class="w4-codefix-tracker__list">
                ${TRACKER_STEPS.map((step, index) => `
                  <article class="w4-codefix-tracker__card" data-step-id="${step.id}" data-step-state="${index === 0 ? 'active' : 'pending'}">
                    <div class="w4-codefix-tracker__meta">
                      <span class="w4-codefix-tracker__status" data-step-status="${step.id}">${index === 0 ? 'Active' : 'Pending'}</span>
                      <span class="w4-codefix-tracker__index">Lock ${index + 1}</span>
                    </div>
                    <h3 class="w4-codefix-tracker__title">${escapeHtml(step.label)}</h3>
                    <p class="w4-codefix-tracker__chapter">${escapeHtml(step.chapter)}</p>
                    <p class="w4-codefix-tracker__copy">${escapeHtml(step.recap)}</p>
                  </article>
                `).join('')}
              </div>
            </section>

            <section class="card card--elevated w4-level__feedback" aria-live="polite">
              <p class="eyebrow">Coach Feed</p>
              <p id="w4-l7-feedback-text" class="w4-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
            </section>

            <section class="card w4-level__hint-box" id="w4-l7-hint-box" hidden>
              <p class="eyebrow">Hint</p>
              <p id="w4-l7-hint-text" class="w4-level__hint-copy"></p>
            </section>

            <section class="card w4-codefix-guide">
              <p class="eyebrow">Recommended Sequence</p>
              <div class="w4-codefix-guide__steps">
                <article class="w4-codefix-guide__step">
                  <span class="w4-codefix-guide__badge">1</span>
                  <p>Inspect <code>${escapeHtml(CITY_COL)}</code> with <code>value_counts(normalize=True)</code> so the singleton tail becomes obvious.</p>
                </article>
                <article class="w4-codefix-guide__step">
                  <span class="w4-codefix-guide__badge">2</span>
                  <p>Collapse the singleton cities into <code>${GROUPED_LABEL}</code>. The reference command uses <code>replace(0.15, '${GROUPED_LABEL}')</code>.</p>
                </article>
                <article class="w4-codefix-guide__step">
                  <span class="w4-codefix-guide__badge">3</span>
                  <p>Keep <code>${escapeHtml(SATISFACTION_COL)}</code> as one ordered numeric column, then one-hot encode the grouped <code>${escapeHtml(CITY_COL)}</code> feature.</p>
                </article>
              </div>
            </section>
          </div>
        </div>

        <section class="panel w4-codefix-summary" id="w4-l7-summary" hidden aria-label="Encoding Recap">
          <div class="w4-level__panel-head">
            <div>
              <p class="eyebrow">Code Lab Recap</p>
              <h2 class="panel-title">Compact where possible, wide only where necessary</h2>
            </div>
            <p class="w4-level__microcopy">${escapeHtml(SUMMARY_COPY)}</p>
          </div>

          <div class="w4-codefix-summary__grid">
            <article class="w4-codefix-summary__card">
              <p class="w4-codefix-summary__kicker">Nominal Tail</p>
              <h3 class="w4-codefix-summary__title">Eight singletons -> ${GROUPED_LABEL}</h3>
              <p class="w4-codefix-summary__copy">The long ${escapeHtml(CITY_COL)} tail shrank from ${ORIGINAL_DF.col(CITY_COL).nunique()} labels to ${GROUPED_CITY_CARDINALITY}, with ${escapeHtml(SURVIVING_CITY_LABEL)} staying visible because it appears twice.</p>
            </article>
            <article class="w4-codefix-summary__card">
              <p class="w4-codefix-summary__kicker">Ordinal Signal</p>
              <h3 class="w4-codefix-summary__title">${escapeHtml(SATISFACTION_ORDER.join(' < '))}</h3>
              <p class="w4-codefix-summary__copy">${escapeHtml(SATISFACTION_COL)} stayed as one ordered numeric feature, which preserves rank without pretending it needs a separate dummy column for each level.</p>
            </article>
            <article class="w4-codefix-summary__card">
              <p class="w4-codefix-summary__kicker">Final Matrix</p>
              <h3 class="w4-codefix-summary__title">${escapeHtml(EXPECTED_CITY_DUMMY_COLS.join(' + '))}</h3>
              <p class="w4-codefix-summary__copy">Only after grouping did the nominal feature widen, which kept the matrix compact and avoided the nine-column version that would have appeared from the raw city labels.</p>
            </article>
          </div>

          <div class="action-row">
            <span class="status-box" id="w4-l7-summary-score">Waiting for the full encoding repair</span>
            <button class="btn btn--primary" id="w4-l7-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w4-l7-progress');
    this._ui.status = container.querySelector('#w4-l7-status');
    this._ui.feedback = container.querySelector('#w4-l7-feedback-text');
    this._ui.hintBox = container.querySelector('#w4-l7-hint-box');
    this._ui.hintText = container.querySelector('#w4-l7-hint-text');
    this._ui.tableHost = container.querySelector('#w4-l7-table');
    this._ui.editorHost = container.querySelector('#w4-l7-editor');
    this._ui.rowCount = container.querySelector('#w4-l7-row-count');
    this._ui.cityVocabulary = container.querySelector('#w4-l7-city-vocab');
    this._ui.satisfactionState = container.querySelector('#w4-l7-satisfaction-state');
    this._ui.cityEncodingState = container.querySelector('#w4-l7-city-state');
    this._ui.summary = container.querySelector('#w4-l7-summary');
    this._ui.summaryScore = container.querySelector('#w4-l7-summary-score');
    this._ui.finishButton = container.querySelector('#w4-l7-finish-btn');
    this._ui.trackerCards = Array.from(container.querySelectorAll('[data-step-id]'));

    this._mountTable();
    this._mountEditor();
    this._syncSnapshot(ORIGINAL_DF);
    this._syncTracker();
    this._syncProgress();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w4-l7-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w4-l7-reset-btn') || event.target.closest('.editor-reset')) {
        this._resetLab();
        return;
      }

      if (event.target.closest('#w4-l7-finish-btn')) {
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
      worldColor: 'var(--color-world-4)',
    });
    this._table.highlightColumn(CITY_COL, 'cardinality');
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
      worldColor: 'var(--color-world-4)',
      onRun: summary => this._handleRun(summary),
    });
  }

  _handleRun(summary) {
    const hasError = summary.results.some(result => result.status === 'error');
    const changedData = summary.results.some(resultMutatesData);
    const unlockedInspection = inspectionUnlocked(summary) && !this._inspected;
    const nextPassedIds = new Set(taskIdsFromSummary(summary));
    const newlyPassedIds = [...nextPassedIds].filter(taskId => !this._awardedTaskIds.has(taskId));

    if (unlockedInspection) {
      this._inspected = true;
      if (!this._inspectionAwarded) {
        this._inspectionAwarded = true;
        this._engine.correct();
      }
    }

    this._passedTaskIds = nextPassedIds;
    this._syncSnapshot(summary.df);
    this._syncTracker();

    if (hasError) {
      this._mistakeRuns += 1;
      this._engine.mistake({ costsLife: false, countsMistake: true });
      this._setFeedback('The interpreter hit an error. Stay close to the reference card, especially for the rare-category helper and the explicit Satisfaction map.');
      this._setStatus('Execution error. Reset if the failed run already widened the matrix or consumed a column with the wrong encoding.');
      this._syncProgress();
      return;
    }

    if (newlyPassedIds.length) {
      newlyPassedIds.forEach(taskId => {
        this._awardedTaskIds.add(taskId);
        this._engine.correct();
      });
    }

    if (unlockedInspection || newlyPassedIds.length) {
      this._handleMilestone(unlockedInspection, newlyPassedIds, summary.df);
      this._syncProgress();

      if (this._inspected && nextPassedIds.size === TASKS.length && validateFinalSolution(summary.df)) {
        this._completeRun();
      }
      return;
    }

    if (changedData) {
      this._mistakeRuns += 1;
      this._engine.mistake({ costsLife: false, countsMistake: true });
      this._handleNonPassingMutation(summary.df);
      this._syncProgress();
      return;
    }

    this._handleInspectionRun(summary);
    this._syncProgress();
  }

  _handleMilestone(unlockedInspection, taskIds, df) {
    taskIds.forEach(taskId => {
      if (taskId === 'group-rare-city') {
        this._table?.flashColumn(CITY_COL, 'green');
      }
      if (taskId === 'label-satisfaction') {
        this._table?.flashColumn(SATISFACTION_COL, 'green');
      }
      if (taskId === 'onehot-city') {
        EXPECTED_CITY_DUMMY_COLS.forEach(col => this._table?.flashColumn(col, 'green'));
      }
    });

    if (this._inspected && this._passedTaskIds.size === TASKS.length && validateFinalSolution(df)) {
      this._setFeedback('All four mission locks are in place. The city tail is compact, the ordinal signal is safe, and the final matrix stayed small.');
      this._setStatus('Mission complete. Review the recap below, then continue to the scaling world.');
      return;
    }

    if (unlockedInspection && !taskIds.length) {
      this._setFeedback(`Inspection locked. ${SURVIVING_CITY_LABEL} is the only repeated city, so the rest of the city vocabulary belongs in ${GROUPED_LABEL} before one-hot expansion.`);
      this._setStatus(`Diagnosis complete. Next: group the singleton city labels, then keep ${SATISFACTION_COL} ordered and compact.`);
      return;
    }

    if (taskIds.length === 1) {
      this._setFeedback(`${labelForTask(taskIds[0])} is now locked in.`);
    } else if (taskIds.length > 1) {
      this._setFeedback(`${taskIds.map(labelForTask).join(' + ')} locked in on the same run.`);
    }

    if (!this._inspected) {
      this._setStatus(`Repair progress landed, but inspection is still missing. Run ${CITY_COL}.value_counts(normalize=True) once to lock the diagnostic step.`);
      return;
    }

    if (!this._passedTaskIds.has('group-rare-city')) {
      this._setStatus(`Inspection is done. Collapse the singleton cities into ${GROUPED_LABEL} before you widen the matrix.`);
      return;
    }

    if (!this._passedTaskIds.has('label-satisfaction')) {
      this._setStatus(`${CITY_COL} is grouped. Next: encode ${SATISFACTION_COL} so Low < Medium < High remains true.`);
      return;
    }

    if (!this._passedTaskIds.has('onehot-city')) {
      this._setStatus(`The prep work is ready. Finish by one-hot encoding the grouped ${CITY_COL} column into the compact dummy block.`);
    }
  }

  _handleInspectionRun(summary) {
    const reviewedCity = summary.results.some(
      result => result.sideEffect?.type === 'value_counts' && result.sideEffect?.col === CITY_COL
    );

    if (reviewedCity) {
      this._setFeedback(`Good inspection run. ${SURVIVING_CITY_LABEL} sits above the singleton band, which is why the other city labels should merge into ${GROUPED_LABEL} before one-hot encoding.`);
      this._setStatus(`Inspection complete. Group the city tail first, keep ${SATISFACTION_COL} ordered, and one-hot the grouped city feature last.`);
      return;
    }

    this._setFeedback('No repair landed yet, but the run was safe. Use the reference card to move from inspection into the grouping and encoding sequence.');
    this._setStatus(DEFAULT_STATUS);
  }

  _handleNonPassingMutation(df) {
    if (!(df instanceof DataFrame)) {
      this._setFeedback('That run changed something, but the table state could not be verified. Use Reset and replay the encoding sequence from the top.');
      this._setStatus('Reset recommended. The final matrix should stay compact and keep all rows intact.');
      return;
    }

    if (df.length !== ORIGINAL_DF.length) {
      this._setFeedback('Encoding should not delete rows in this lab. Use Reset and keep all 10 examples while you repair the feature columns.');
      this._setStatus('Reset recommended. This level changes categories, not row count.');
      return;
    }

    if (!sameColumnValues(df, EDUCATION_COL, ORIGINAL_EDUCATION_VALUES) || !sameColumnValues(df, TARGET_COL, ORIGINAL_TARGET_VALUES)) {
      this._setFeedback(`${EDUCATION_COL} and ${TARGET_COL} are control columns here. Use Reset and leave them untouched while you repair ${CITY_COL} and ${SATISFACTION_COL}.`);
      this._setStatus('Reset recommended. Only the encoding target columns should change in this lab.');
      return;
    }

    if (cityDummyCols(df).length && !validateOneHotCity(df)) {
      this._setFeedback(`${CITY_COL} widened too early or too widely. Use Reset, group the singleton labels first, and only then run get_dummies on the grouped city column.`);
      this._setStatus('Reset recommended. The raw city labels should not expand straight into the final matrix.');
      return;
    }

    if (!df.columns.includes(SATISFACTION_COL)) {
      this._setFeedback(`${SATISFACTION_COL} should remain one ordered numeric column, not disappear into a rebuilt structure. Use Reset and keep it compact.`);
      this._setStatus('Reset recommended. This feature needs label encoding, not structural expansion.');
      return;
    }

    const satisfactionValues = df.col(SATISFACTION_COL).values;
    if (satisfactionValues.every(isFiniteNumber) && !validateSatisfactionEncoding(df)) {
      this._setFeedback(`${SATISFACTION_COL} is numeric now, but the ordering is not stable. Use Reset and keep the encoded values monotonic so Low < Medium < High still holds.`);
      this._setStatus('Reset recommended. The ordinal ranking must survive the encoding.');
      return;
    }

    if (df.columns.includes(CITY_COL) && df.col(CITY_COL).values.includes(GROUPED_LABEL) && !validateGroupedCity(df)) {
      this._setFeedback(`${CITY_COL} has started to collapse, but the final grouping is off. The singleton cities should merge into ${GROUPED_LABEL} while ${SURVIVING_CITY_LABEL} stays separate.`);
      this._setStatus('No mission lock advanced. Compare the current city labels against the compact two-group target before you run again.');
      return;
    }

    this._setFeedback('That run changed the table, but no mission card advanced. Compare the current dataset against the three encoding repairs before you run again.');
    this._setStatus('No mission lock advanced. Reset if the city column widened too early or the ordinal map consumed the wrong order.');
  }

  _completeRun() {
    this._completed = true;
    this._summary = {
      tasksCompleted: TASKS.length,
      totalTasks: TASKS.length,
      inspected: this._inspected,
      mistakeRuns: this._mistakeRuns,
    };

    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = `${TOTAL_LOCKS} / ${TOTAL_LOCKS} mission locks`;
    }

    if (this._ui.summary) {
      this._ui.summary.hidden = false;
      requestAnimationFrame(() => {
        this._ui.summary.classList.add('is-revealed');
      });
      this._ui.summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    this._setFeedback(resultTone(this._summary));
    this._setStatus('Code lab complete. The encoding toolkit is ready for the scaling world.');
    this._syncProgress();
  }

  _resetLab() {
    this._inspected = false;
    this._inspectionAwarded = false;
    this._passedTaskIds.clear();
    this._awardedTaskIds.clear();
    this._mistakeRuns = 0;
    this._completed = false;
    this._summary = null;

    this._editor?.reset(ORIGINAL_DF);
    this._syncSnapshot(ORIGINAL_DF);
    this._syncTracker();

    if (this._ui.summary) {
      this._ui.summary.hidden = true;
      this._ui.summary.classList.remove('is-revealed');
    }

    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = 'Waiting for the full encoding repair';
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
    const cityVocabulary = cityVocabularyState(df);
    const cityState = cityEncodingState(df);
    const satisfaction = satisfactionState(df);

    if (this._ui.rowCount) {
      this._ui.rowCount.textContent = String(df.length);
    }

    if (this._ui.cityVocabulary) {
      this._ui.cityVocabulary.textContent = cityVocabulary.label;
      this._ui.cityVocabulary.dataset.state = cityVocabulary.tone;
    }

    if (this._ui.satisfactionState) {
      this._ui.satisfactionState.textContent = satisfaction.label;
      this._ui.satisfactionState.dataset.state = satisfaction.tone;
    }

    if (this._ui.cityEncodingState) {
      this._ui.cityEncodingState.textContent = cityState.label;
      this._ui.cityEncodingState.dataset.state = cityState.tone;
    }
  }

  _syncTracker() {
    this._ui.trackerCards?.forEach(card => {
      const stepId = card.dataset.stepId;
      const state = trackerState(stepId, this._inspected, this._passedTaskIds);
      const statusEl = card.querySelector('[data-step-status]');

      card.dataset.stepState = state;
      if (statusEl) {
        statusEl.textContent = stateLabel(state);
      }
    });
  }

  _syncProgress() {
    const lockedCount = (this._inspected ? 1 : 0) + this._passedTaskIds.size;

    if (this._ui.progress) {
      this._ui.progress.textContent = `${lockedCount} / ${TOTAL_LOCKS} mission locks`;
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
