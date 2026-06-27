'use strict';

import { getLevelProblem } from '../../data/problems.js';
import { DataFrame, isMissing } from '../../pandas/dataframe.js';
import { createDragDrop } from '../../widgets/dragdrop.js';
import { DataTable } from '../../widgets/datatable.js';
import { ChartWidget } from '../../widgets/charts.js';

const PROBLEM = getLevelProblem(6, 3);
const LEVEL_TITLE = PROBLEM?.title ?? 'Pipeline Builder - Full Run';
const LEVEL_OBJECTIVE = PROBLEM?.objective ?? 'Apply the full sequence of preprocessing decisions to a small messy dataset.';

const ID_COL = 'Applicant_ID';
const AGE_COL = 'Age';
const SALARY_COL = 'Salary';
const CITY_COL = 'City';
const TARGET_COL = 'Purchased';
const MISSING_CITY = 'Missing';
const STAGE_ZONE_ID = 'w6-l3-stage-target';

const RAW_DF = DataFrame.fromRows([
  { Applicant_ID: 101, Age: 24, Salary: 32000, City: 'Casa',  Purchased: 0 },
  { Applicant_ID: 102, Age: null, Salary: 35000, City: 'Rabat', Purchased: 1 },
  { Applicant_ID: 103, Age: 30, Salary: 165000, City: null,   Purchased: 0 },
  { Applicant_ID: 104, Age: 36, Salary: 41000, City: 'Casa',  Purchased: 1 },
  { Applicant_ID: 105, Age: 38, Salary: 39000, City: 'Fes',   Purchased: 0 },
]);

const AGE_MEDIAN = RAW_DF.col(AGE_COL).median();
const IMPUTED_DF = RAW_DF.fillna(AGE_COL, 'median').fillna(CITY_COL, MISSING_CITY);
const SALARY_FENCES = IMPUTED_DF.iqrFences(SALARY_COL);
const CAPPED_DF = IMPUTED_DF.clip(SALARY_COL, SALARY_FENCES.lower, SALARY_FENCES.upper);
const ENCODED_DF = CAPPED_DF.getDummies(CITY_COL, false, CITY_COL);
const FINAL_DF = ENCODED_DF
  .minMaxScale(AGE_COL, '')
  .standardize(SALARY_COL, '');

const AGE_IMPUTED_ROW_ID = 102;
const SALARY_OUTLIER_ROW_ID = 103;
const CITY_DUMMY_COLUMNS = ENCODED_DF.columns.filter(col => col.startsWith(`${CITY_COL}_`));
const CITY_DUMMY_COUNT = CITY_DUMMY_COLUMNS.length;

const NUMBER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

const WHOLE = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM?.hints ?? []),
  'Use a robust numeric center for Age, and keep the missing City visible as its own category instead of disguising it as an existing city.',
  'The Salary spike is real revenue, so cap it instead of deleting the row. After that, one-hot City and use different scalers for Age and Salary.',
  'One-hot encoding is the safe choice here because City has no natural rank.',
  'Age wants a shared 0-1 interval. Salary wants a centered z-score after the outlier is capped.',
]);

const DEFAULT_FEEDBACK = 'Build the pipeline one bay at a time: repair missing values, tame the Salary spike, encode City, then scale Age and Salary with different rules.';
const DEFAULT_STATUS = 'Stage 1 is live. Choose the imputation rule that keeps Age robust and City explicit.';
const SUMMARY_COPY = 'This final dry run only works because each step hands the next bay cleaner, safer, and more model-ready signal.';
const TOTAL_STAGES = 4;
const TOTAL_TRANSFORMS = 6;

const STAGES = Object.freeze([
  Object.freeze({
    id: 'imputation',
    worldCode: 'W2',
    color: 'var(--color-world-2)',
    stepLabel: 'Stage 1 / 4',
    title: 'Imputation Bay',
    prompt: 'Two cells are missing. Choose the repair card that keeps numeric signal stable and keeps the missing City visible for the encoder.',
    objective: 'Age needs a robust numeric fill. City should stay categorical, but its missing state should not disappear.',
    checks: Object.freeze([
      'Age should gain a real value without leaning on the Salary spike.',
      'City should preserve that it was absent instead of pretending it matched an existing city.',
    ]),
    correctChoice: 'impute-median-missing',
    choices: Object.freeze([
      Object.freeze({
        id: 'impute-median-missing',
        badge: 'Robust + explicit',
        title: 'Median Age + Missing City bucket',
        copy: 'Use the Age median and turn the empty City cell into a Missing category.',
        rationale: `Median keeps Age steady at ${formatWhole(AGE_MEDIAN)}, and Missing lets City be encoded honestly later.`,
      }),
      Object.freeze({
        id: 'impute-mean-mode',
        badge: 'Too smooth',
        title: 'Mean Age + most common City',
        copy: 'Average Age and hide the missing city by replacing it with the most common label.',
        rationale: 'The mean is easier for extreme values to tug around, and mode hides the fact that the city was actually absent.',
      }),
      Object.freeze({
        id: 'drop-missing-rows',
        badge: 'Too destructive',
        title: 'Drop every incomplete row',
        copy: 'Delete any row that contains a missing value before the rest of the pipeline starts.',
        rationale: 'That throws away useful signal before you have even tried the straightforward repairs.',
      }),
    ]),
    logEntries: Object.freeze([
      Object.freeze({
        worldCode: 'W2',
        color: 'var(--color-world-2)',
        line: "impute(Age, method='median')",
        note: `Filled the missing Age with ${formatWhole(AGE_MEDIAN)}.`,
      }),
      Object.freeze({
        worldCode: 'W2',
        color: 'var(--color-world-2)',
        line: "impute(City, method='missing_category')",
        note: "Converted the empty City cell into the explicit label 'Missing'.",
      }),
    ]),
    apply(df) {
      return df.fillna(AGE_COL, 'median').fillna(CITY_COL, MISSING_CITY);
    },
    sideEffect: Object.freeze({ type: 'fillna', col: AGE_COL }),
    successFeedback: `Imputation locked. Age now uses the median ${formatWhole(AGE_MEDIAN)}, and City keeps an explicit Missing bucket for the encoder.`,
    nextStatus: 'Imputation complete. Stage 2 is live: keep the Salary row, but cap the spike so it loses leverage.',
  }),
  Object.freeze({
    id: 'outlier',
    worldCode: 'W3',
    color: 'var(--color-world-3)',
    stepLabel: 'Stage 2 / 4',
    title: 'Outlier Bay',
    prompt: 'One Salary value is real but too dominant. Choose the treatment that keeps the row while shrinking its leverage.',
    objective: 'The spike belongs to a valid customer. Repair the value, not the example itself.',
    checks: Object.freeze([
      'Keep all 5 rows in the table.',
      `Cap the Salary spike at the IQR ceiling instead of deleting the record.`,
    ]),
    correctChoice: 'cap-salary-iqr',
    choices: Object.freeze([
      Object.freeze({
        id: 'cap-salary-iqr',
        badge: 'Correct guardrail',
        title: 'Cap Salary at the IQR upper fence',
        copy: 'Keep the row, but clip the Salary spike to the safe upper fence.',
        rationale: `That preserves the example while limiting the spike to ${formatMoney(SALARY_FENCES.upper)}.`,
      }),
      Object.freeze({
        id: 'remove-salary-row',
        badge: 'Too harsh',
        title: 'Remove the outlier row entirely',
        copy: 'Delete the customer record that carries the huge Salary value.',
        rationale: 'The spike is real revenue, so deleting the row would erase legitimate behavior instead of taming leverage.',
      }),
      Object.freeze({
        id: 'log-salary-early',
        badge: 'Wrong timing',
        title: 'Log-transform Salary right away',
        copy: 'Compress the Salary column before any targeted outlier treatment.',
        rationale: 'This stage is about a precise fence-based cap, not a whole-column reshaping move.',
      }),
    ]),
    logEntries: Object.freeze([
      Object.freeze({
        worldCode: 'W3',
        color: 'var(--color-world-3)',
        line: "cap_outliers(Salary, method='IQR')",
        note: `Clipped the Salary spike at ${formatMoney(SALARY_FENCES.upper)} while keeping the row.`,
      }),
    ]),
    apply(df) {
      return df.clip(SALARY_COL, SALARY_FENCES.lower, SALARY_FENCES.upper);
    },
    sideEffect: Object.freeze({ type: 'clip', col: SALARY_COL }),
    successFeedback: `Outlier bay locked. The Salary row stays in play, but the spike now stops at ${formatMoney(SALARY_FENCES.upper)}.`,
    nextStatus: 'Outlier control complete. Stage 3 is live: translate City into model-ready signals without inventing rank.',
  }),
  Object.freeze({
    id: 'encoding',
    worldCode: 'W4',
    color: 'var(--color-world-4)',
    stepLabel: 'Stage 3 / 4',
    title: 'Encoding Bay',
    prompt: 'City is clean now, but still textual. Choose the encoding method that stays neutral about city order.',
    objective: 'The model needs numeric columns, but City has no meaningful ladder from low to high.',
    checks: Object.freeze([
      'The original City column should expand into binary signal columns.',
      'No fake ordinal order should be introduced between Casa, Fes, Missing, and Rabat.',
    ]),
    correctChoice: 'encode-city-onehot',
    choices: Object.freeze([
      Object.freeze({
        id: 'encode-city-onehot',
        badge: 'Neutral encoding',
        title: 'One-hot encode City',
        copy: 'Turn each city label into its own 0/1 column.',
        rationale: 'One-hot keeps City nominal, so the model never learns a fake numeric order between the categories.',
      }),
      Object.freeze({
        id: 'encode-city-ordinal',
        badge: 'Fake rank',
        title: 'Map City to 1, 2, 3, 4',
        copy: 'Turn each category into a single integer code.',
        rationale: 'Integer labels create a false ladder, as if Rabat were greater than Casa in a meaningful numeric way.',
      }),
      Object.freeze({
        id: 'encode-city-frequency',
        badge: 'Wrong signal',
        title: 'Use frequency encoding',
        copy: 'Replace each city with how often it appears in the dataset.',
        rationale: 'This stage wants explicit category columns, not a compressed frequency proxy.',
      }),
    ]),
    logEntries: Object.freeze([
      Object.freeze({
        worldCode: 'W4',
        color: 'var(--color-world-4)',
        line: "encode(City, method='one_hot')",
        note: `Expanded City into ${CITY_DUMMY_COUNT} dummy columns with no fake rank.`,
      }),
    ]),
    apply(df) {
      return df.getDummies(CITY_COL, false, CITY_COL);
    },
    sideEffect: Object.freeze({ type: 'get_dummies', col: CITY_COL }),
    successFeedback: 'Encoding locked. City is now represented by clean binary signals instead of a risky fake order.',
    nextStatus: 'Encoding complete. Final stage is live: scale Age and Salary with the methods that fit each feature.',
  }),
  Object.freeze({
    id: 'scaling',
    worldCode: 'W5',
    color: 'var(--color-world-5)',
    stepLabel: 'Stage 4 / 4',
    title: 'Scaling Bay',
    prompt: 'Age and Salary are both numeric now, but they do not want the same scaler. Choose the mixed scaling recipe that fits both.',
    objective: 'Age is bounded and should share a 0-1 range. Salary should be centered and standardized after the cap.',
    checks: Object.freeze([
      'Age should end on a shared 0-1 interval.',
      'Salary should finish as a centered z-score, not another min-max column.',
    ]),
    correctChoice: 'scale-age-minmax-salary-zscore',
    choices: Object.freeze([
      Object.freeze({
        id: 'scale-age-minmax-salary-zscore',
        badge: 'Feature-specific fit',
        title: 'MinMax Age + z-score Salary',
        copy: 'Move Age into 0-1 and standardize Salary around mean 0 and sigma 1.',
        rationale: 'That matches the role of each feature: Age is bounded, while Salary benefits from centered variance units.',
      }),
      Object.freeze({
        id: 'scale-both-minmax',
        badge: 'Too uniform',
        title: 'MinMax both Age and Salary',
        copy: 'Force both numeric features onto the same 0-1 interval.',
        rationale: 'Age fits MinMax, but Salary loses the centered z-score profile this pipeline wants after capping.',
      }),
      Object.freeze({
        id: 'scale-both-zscore',
        badge: 'Wrong for Age',
        title: 'Standardize both Age and Salary',
        copy: 'Turn both numeric columns into mean-zero, sigma-scaled features.',
        rationale: 'Salary fits that plan, but Age is the bounded feature that should finish on a shared 0-1 range.',
      }),
    ]),
    logEntries: Object.freeze([
      Object.freeze({
        worldCode: 'W5',
        color: 'var(--color-world-5)',
        line: "scale(Age, method='minmax')",
        note: 'Moved Age onto the 0-1 interval.',
      }),
      Object.freeze({
        worldCode: 'W5',
        color: 'var(--color-world-5)',
        line: "scale(Salary, method='zscore')",
        note: 'Centered Salary around 0 with variance-based units.',
      }),
    ]),
    apply(df) {
      return df.minMaxScale(AGE_COL, '').standardize(SALARY_COL, '');
    },
    sideEffect: Object.freeze({ type: 'standardize', col: SALARY_COL }),
    successFeedback: 'Scaling locked. Age now shares a 0-1 range, and Salary now lives in centered z-score units.',
    nextStatus: 'All bays are locked. Review the full recipe below, then continue to the curriculum recap.',
  }),
]);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatNumber(value, digits = 3) {
  if (!Number.isFinite(value)) return String(value);
  return Number(value.toFixed(digits)).toString();
}

function formatWhole(value) {
  if (!Number.isFinite(value)) return String(value);
  return WHOLE.format(value);
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return String(value);
  return MONEY.format(value);
}

function formatSigned(value, digits = 3) {
  if (!Number.isFinite(value)) return String(value);
  const rounded = Number(value.toFixed(digits));
  return `${rounded >= 0 ? '+' : ''}${rounded}`;
}

function stageById(stageId) {
  return STAGES.find(stage => stage.id === stageId) ?? null;
}

function choiceById(stage, choiceId) {
  return stage?.choices.find(choice => choice.id === choiceId) ?? null;
}

function shuffleCopy(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function ageValueForRow(df, rowId) {
  const row = df.toRows().find(entry => entry[ID_COL] === rowId);
  return row?.[AGE_COL];
}

function salaryValueForRow(df, rowId) {
  const row = df.toRows().find(entry => entry[ID_COL] === rowId);
  return row?.[SALARY_COL];
}

function buildSalaryMask(df) {
  return df.toRows().map(row => {
    const value = row[SALARY_COL];
    return typeof value === 'number' && Number.isFinite(value) && value > SALARY_FENCES.upper;
  });
}

function ageChartConfig(df, stagesLocked) {
  const scaled = stagesLocked >= TOTAL_STAGES;
  const imputed = stagesLocked >= 1;

  return {
    type: 'dotplot',
    title: 'Age Monitor',
    worldColor: scaled ? 'var(--color-world-5)' : 'var(--color-world-2)',
    minWidth: 300,
    height: 208,
    showGrid: true,
    scaleMode: scaled ? 'linear' : 'distribution',
    valueFormatter: value => scaled ? formatNumber(value, 3) : formatWhole(value),
    band: scaled ? {
      from: 0,
      to: 1,
      label: 'Target 0-1 range',
      tone: 'var(--color-world-5)',
      opacity: 0.14,
    } : null,
    markers: scaled
      ? [
        { value: 0, label: '0', tone: 'var(--color-world-5)' },
        { value: 1, label: '1', tone: 'var(--color-success)' },
      ]
      : imputed
        ? [{ value: AGE_MEDIAN, label: `median ${formatWhole(AGE_MEDIAN)}`, tone: 'var(--color-world-2)' }]
        : [],
    data: df.toRows()
      .filter(row => !isMissing(row[AGE_COL]))
      .map(row => {
        const value = row[AGE_COL];
        const isImputedRow = row[ID_COL] === AGE_IMPUTED_ROW_ID;
        const isFilled = imputed && isImputedRow;

        return {
          value,
          label: `ID ${row[ID_COL]}`,
          color: scaled
            ? 'var(--color-success)'
            : isFilled
              ? 'var(--color-warning)'
              : 'var(--color-world-2)',
          state: scaled
            ? 'active'
            : isFilled
              ? 'selected'
              : 'default',
          tooltip: scaled
            ? `ID ${row[ID_COL]} - Age scaled ${formatNumber(value, 3)}`
            : `ID ${row[ID_COL]} - Age ${formatWhole(value)}${isFilled ? ' (imputed)' : ''}`,
          ariaLabel: `Applicant ${row[ID_COL]} Age ${scaled ? formatNumber(value, 3) : formatWhole(value)}`,
        };
      }),
    ariaLabel: 'Dot plot showing the current Age values through the pipeline.',
  };
}

function salaryChartConfig(df, stagesLocked) {
  const scaled = stagesLocked >= TOTAL_STAGES;
  const capped = stagesLocked >= 2;

  return {
    type: 'dotplot',
    title: 'Salary Monitor',
    worldColor: scaled ? 'var(--color-world-5)' : 'var(--color-world-3)',
    minWidth: 300,
    height: 208,
    showGrid: true,
    scaleMode: scaled ? 'linear' : 'distribution',
    valueFormatter: value => scaled ? formatSigned(value, 3) : formatMoney(value),
    band: scaled
      ? {
        from: -1,
        to: 1,
        label: 'Within 1 sigma',
        tone: 'var(--color-world-5)',
        opacity: 0.14,
      }
      : {
        from: Math.min(...df.col(SALARY_COL).values),
        to: SALARY_FENCES.upper,
        label: 'Safe zone',
        tone: 'var(--color-world-3)',
        opacity: 0.1,
      },
    markers: scaled
      ? [{ value: 0, label: 'mean 0', tone: 'var(--color-warning)' }]
      : [{ value: SALARY_FENCES.upper, label: `IQR cap ${formatMoney(SALARY_FENCES.upper)}`, tone: 'var(--color-warning)' }],
    data: df.toRows().map(row => {
      const value = row[SALARY_COL];
      const focusRow = row[ID_COL] === SALARY_OUTLIER_ROW_ID;
      const unresolved = !scaled && typeof value === 'number' && value > SALARY_FENCES.upper;
      const repaired = !scaled && capped && focusRow && !unresolved;

      return {
        value,
        label: `ID ${row[ID_COL]}`,
        color: scaled
          ? focusRow
            ? 'var(--color-warning)'
            : 'var(--color-world-5)'
          : unresolved
            ? 'var(--color-danger)'
            : repaired
              ? 'var(--color-warning)'
              : 'var(--color-world-3)',
        state: scaled
          ? focusRow
            ? 'selected'
            : 'active'
          : unresolved
            ? 'selected'
            : repaired
              ? 'active'
              : 'default',
        tooltip: scaled
          ? `ID ${row[ID_COL]} - Salary z-score ${formatSigned(value, 3)}`
          : `ID ${row[ID_COL]} - Salary ${formatMoney(value)}${repaired ? ' (capped)' : unresolved ? ' (outlier)' : ''}`,
        ariaLabel: `Applicant ${row[ID_COL]} Salary ${scaled ? formatSigned(value, 3) : formatMoney(value)}`,
      };
    }),
    ariaLabel: 'Dot plot showing the current Salary values through the pipeline.',
  };
}

function resultTone(summary) {
  if (!summary) return DEFAULT_FEEDBACK;
  if (summary.mistakes === 0) {
    return 'Perfect dry run. Each bay received the right feature-engineering move on the first pass, and the whole pipeline now reads like one coherent production recipe.';
  }
  if (summary.mistakes <= 2) {
    return 'Strong finish. The pipeline is correct, and the recipe card below should make the step order feel automatic next time.';
  }
  return 'Pipeline complete. The recap below is the part to keep: every bay changes the data in a way the next bay depends on.';
}

function renderRecipeDraftHtml(logEntries) {
  const solvedLines = logEntries.map(entry => `
    <span class="w6-pipeline-recipe__line">
      <span class="w6-pipeline-recipe__world" style="--stage-color:${entry.color};">${escapeHtml(entry.worldCode)}</span>
      <span>${escapeHtml(entry.line)}</span>
    </span>
  `);

  const pendingCount = Math.max(0, TOTAL_TRANSFORMS - logEntries.length);
  const pendingLines = Array.from({ length: pendingCount }, (_, index) => `
    <span class="w6-pipeline-recipe__line is-pending"># waiting for transform ${logEntries.length + index + 1}</span>
  `);

  return [...solvedLines, ...pendingLines].join('');
}

function renderFinalRecipeHtml() {
  return `
    <span class="w6-pipeline-recipe__line">
      <span class="w6-pipeline-recipe__world" style="--stage-color:var(--color-world-2);">W2</span>
      <span>impute(Age, method='median')</span>
    </span>
    <span class="w6-pipeline-recipe__line">
      <span class="w6-pipeline-recipe__world" style="--stage-color:var(--color-world-2);">W2</span>
      <span>impute(City, method='missing_category')</span>
    </span>
    <span class="w6-pipeline-recipe__line">
      <span class="w6-pipeline-recipe__world" style="--stage-color:var(--color-world-3);">W3</span>
      <span>cap_outliers(Salary, method='IQR')</span>
    </span>
    <span class="w6-pipeline-recipe__line">
      <span class="w6-pipeline-recipe__world" style="--stage-color:var(--color-world-4);">W4</span>
      <span>encode(City, method='one_hot')</span>
    </span>
    <span class="w6-pipeline-recipe__line">
      <span class="w6-pipeline-recipe__world" style="--stage-color:var(--color-world-5);">W5</span>
      <span>scale(Age, method='minmax')</span>
    </span>
    <span class="w6-pipeline-recipe__line">
      <span class="w6-pipeline-recipe__world" style="--stage-color:var(--color-world-5);">W5</span>
      <span>scale(Salary, method='zscore')</span>
    </span>
  `;
}

export default class World6Level3 {
  meta = {
    title: LEVEL_TITLE,
    subtitle: LEVEL_OBJECTIVE,
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._events = null;
    this._dragDrop = null;
    this._table = null;
    this._ageChart = null;
    this._salaryChart = null;
    this._currentDf = RAW_DF;
    this._currentStageIndex = 0;
    this._logEntries = [];
    this._mistakes = 0;
    this._completed = false;
    this._summary = null;
    this._pendingAdvance = false;
    this._advanceTimer = null;
    this._choiceOrders = new Map(STAGES.map(stage => [stage.id, shuffleCopy(stage.choices)]));
    this._ui = {};
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w6-level w6-level--pipeline screen-section" aria-label="World 6 Level 3">
        <div class="level-hero w6-level__hero" style="--world-color: var(--color-world-6);">
          <p class="eyebrow">World 6 - Full Pipeline</p>
          <h1 class="level-hero__title">${escapeHtml(LEVEL_TITLE)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(LEVEL_OBJECTIVE)}
            This is the first full pipeline dry run with real dependencies between bays. Every correct choice changes what the next step is allowed to trust.
          </p>
          <div class="action-row">
            <span class="status-box" id="w6-l3-progress">0 / ${TOTAL_STAGES} stages locked</span>
            <span class="status-box" id="w6-l3-log-progress">0 / ${TOTAL_TRANSFORMS} transforms logged</span>
            <span class="status-box" id="w6-l3-shape">${RAW_DF.length} x ${RAW_DF.columns.length} frame</span>
            <span class="status-box" id="w6-l3-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w6-l3-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w6-l3-reset-btn" type="button">Reset Pipeline</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">03</span>
        </div>

        <section class="card w6-pipeline-map" aria-label="Pipeline progress">
          <div class="w6-level__panel-head">
            <div>
              <p class="eyebrow">Mission Tracker</p>
              <h2 class="panel-title">Four dependent bays, one complete pipeline</h2>
            </div>
            <p class="w6-level__microcopy">Follow the active bay from left to right. A stage locks only when its output is safe for the next transformation.</p>
          </div>
          <div class="w6-pipeline-map__list" id="w6-l3-map-list">
            ${STAGES.map((stage, index) => `
              <article class="w6-pipeline-map__card" data-stage-card="${stage.id}" data-stage-state="${index === 0 ? 'active' : 'pending'}" style="--stage-color:${stage.color};">
                <div class="w6-pipeline-map__meta">
                  <span class="w6-pipeline-map__badge">${escapeHtml(stage.worldCode)}</span>
                  <span class="w6-pipeline-map__status" data-stage-status="${stage.id}">${index === 0 ? 'Active' : 'Pending'}</span>
                </div>
                <h3 class="w6-pipeline-map__title">${escapeHtml(stage.title)}</h3>
                <p class="w6-pipeline-map__copy">${escapeHtml(stage.objective)}</p>
              </article>
            `).join('')}
          </div>
        </section>

        <div class="w6-pipeline-layout">
          <article class="panel w6-pipeline-data-panel">
            <div class="w6-level__panel-head">
              <div>
                <p class="eyebrow">Dataset Console</p>
                <h2 class="panel-title">Start with one messy table and watch each bay rewrite what the next bay receives</h2>
              </div>
              <p class="w6-level__microcopy">
                Missing values, one extreme Salary spike, one categorical column, then two numeric features that want different scalers. The table is the shared truth every bay edits.
              </p>
            </div>

            <div class="w6-pipeline-snapshot" aria-label="Pipeline Snapshot">
              <article class="w6-pipeline-snapshot__card">
                <span class="w6-pipeline-snapshot__label">Frame Shape</span>
                <strong class="w6-pipeline-snapshot__value" id="w6-l3-shape-card">${RAW_DF.length} x ${RAW_DF.columns.length}</strong>
                <p class="w6-pipeline-snapshot__copy">Rows stay fixed. Columns widen only after encoding.</p>
              </article>
              <article class="w6-pipeline-snapshot__card">
                <span class="w6-pipeline-snapshot__label">Missing Cells</span>
                <strong class="w6-pipeline-snapshot__value" id="w6-l3-null-card">2</strong>
                <p class="w6-pipeline-snapshot__copy">Imputation should bring this to zero before anything else continues.</p>
              </article>
              <article class="w6-pipeline-snapshot__card">
                <span class="w6-pipeline-snapshot__label">Salary Watch</span>
                <strong class="w6-pipeline-snapshot__value" id="w6-l3-salary-card" data-state="warning">Spike Live</strong>
                <p class="w6-pipeline-snapshot__copy">The real row stays, but its leverage should shrink at the IQR fence.</p>
              </article>
              <article class="w6-pipeline-snapshot__card">
                <span class="w6-pipeline-snapshot__label">City Signal</span>
                <strong class="w6-pipeline-snapshot__value" id="w6-l3-city-card" data-state="present">Raw Category</strong>
                <p class="w6-pipeline-snapshot__copy">City becomes binary columns only after the missing label is repaired.</p>
              </article>
            </div>

            <div class="w6-pipeline-table-shell" id="w6-l3-table"></div>

            <div class="w6-pipeline-chart-grid">
              <article class="w6-pipeline-chart-card">
                <div class="w6-pipeline-chart-shell" id="w6-l3-age-chart"></div>
              </article>
              <article class="w6-pipeline-chart-card">
                <div class="w6-pipeline-chart-shell" id="w6-l3-salary-chart"></div>
              </article>
            </div>
          </article>

          <div class="w6-pipeline-center">
            <div id="w6-l3-stage-host"></div>

            <section class="card card--elevated w6-level__feedback" aria-live="polite">
              <p class="eyebrow">Pipeline Coach</p>
              <p id="w6-l3-feedback-text" class="w6-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
            </section>

            <section class="card w6-level__hint-box" id="w6-l3-hint-box" hidden>
              <p class="eyebrow">Hint</p>
              <p id="w6-l3-hint-text" class="w6-level__hint-copy"></p>
            </section>
          </div>

        </div>

        <div class="w6-pipeline-support-grid">
          <section class="card w6-pipeline-log">
            <p class="eyebrow">Transformation Log</p>
            <h2 class="panel-title">Every correct bay writes a permanent recipe line</h2>
            <div class="w6-pipeline-log__list" id="w6-l3-log-list">
              <article class="w6-pipeline-log__empty">
                <p>No transforms recorded yet.</p>
                <p>Stage 1 will write the first two recipe lines once the imputation rule is locked.</p>
              </article>
            </div>
          </section>

          <section class="card w6-pipeline-recipe">
            <p class="eyebrow">Recipe Draft</p>
            <h2 class="panel-title">Current pipeline script</h2>
            <pre class="w6-pipeline-recipe__code" id="w6-l3-recipe-code">${renderRecipeDraftHtml([])}</pre>
          </section>
        </div>

        <section class="panel w6-pipeline-summary" id="w6-l3-summary" hidden aria-label="Pipeline Summary">
          <div class="w6-level__panel-head">
            <div>
              <p class="eyebrow">Pipeline Recap</p>
              <h2 class="panel-title">The whole run works because every bay respected the dependency behind it</h2>
            </div>
            <p class="w6-level__microcopy">${escapeHtml(SUMMARY_COPY)}</p>
          </div>

          <div class="w6-pipeline-summary__grid">
            <article class="w6-pipeline-summary__card">
              <p class="w6-pipeline-summary__kicker">Imputation</p>
              <h3 class="w6-pipeline-summary__title">Repair missing values before anything downstream reads them</h3>
              <p class="w6-pipeline-summary__copy">Age used the median so the center stayed robust. City kept an explicit Missing label so the categorical absence survived into the encoding step.</p>
            </article>
            <article class="w6-pipeline-summary__card">
              <p class="w6-pipeline-summary__kicker">Outliers</p>
              <h3 class="w6-pipeline-summary__title">Keep the real Salary row, cap only the leverage</h3>
              <p class="w6-pipeline-summary__copy">The outlier was valid revenue, so the pipeline clipped the value at ${escapeHtml(formatMoney(SALARY_FENCES.upper))} instead of deleting the customer record.</p>
            </article>
            <article class="w6-pipeline-summary__card">
              <p class="w6-pipeline-summary__kicker">Encoding + Scaling</p>
              <h3 class="w6-pipeline-summary__title">Translate City, then scale each numeric feature by its own job</h3>
              <p class="w6-pipeline-summary__copy">City became ${CITY_DUMMY_COUNT} binary columns, Age moved onto 0-1, and Salary finished as a centered z-score. The mixed recipe matters as much as the step order.</p>
            </article>
          </div>

          <div class="w6-pipeline-summary__recipe">
            <p class="w6-pipeline-summary__label">Final Recipe</p>
            <pre class="w6-pipeline-recipe__code">${renderFinalRecipeHtml()}</pre>
          </div>

          <div class="action-row">
            <span class="status-box" id="w6-l3-summary-score">Waiting for all 4 stages</span>
            <button class="btn btn--primary" id="w6-l3-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w6-l3-progress');
    this._ui.logProgress = container.querySelector('#w6-l3-log-progress');
    this._ui.shape = container.querySelector('#w6-l3-shape');
    this._ui.status = container.querySelector('#w6-l3-status');
    this._ui.feedback = container.querySelector('#w6-l3-feedback-text');
    this._ui.hintBox = container.querySelector('#w6-l3-hint-box');
    this._ui.hintText = container.querySelector('#w6-l3-hint-text');
    this._ui.tableHost = container.querySelector('#w6-l3-table');
    this._ui.ageChartHost = container.querySelector('#w6-l3-age-chart');
    this._ui.salaryChartHost = container.querySelector('#w6-l3-salary-chart');
    this._ui.stageHost = container.querySelector('#w6-l3-stage-host');
    this._ui.mapCards = Array.from(container.querySelectorAll('[data-stage-card]'));
    this._ui.logList = container.querySelector('#w6-l3-log-list');
    this._ui.recipeCode = container.querySelector('#w6-l3-recipe-code');
    this._ui.shapeCard = container.querySelector('#w6-l3-shape-card');
    this._ui.nullCard = container.querySelector('#w6-l3-null-card');
    this._ui.salaryCard = container.querySelector('#w6-l3-salary-card');
    this._ui.cityCard = container.querySelector('#w6-l3-city-card');
    this._ui.summary = container.querySelector('#w6-l3-summary');
    this._ui.summaryScore = container.querySelector('#w6-l3-summary-score');
    this._ui.finishButton = container.querySelector('#w6-l3-finish-btn');

    this._mountTable();
    this._mountCharts();
    this._renderStage();
    this._syncVisualState();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w6-l3-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w6-l3-reset-btn')) {
        this._resetPipeline();
        return;
      }

      if (event.target.closest('#w6-l3-finish-btn')) {
        if (this._completed) {
          void this._engine.complete();
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
    this._clearAdvanceTimer();
    this._dragDrop?.destroy();
    this._table?.destroy();
    this._ageChart?.destroy();
    this._salaryChart?.destroy();
    this._dragDrop = null;
    this._table = null;
    this._ageChart = null;
    this._salaryChart = null;
    this._ui = {};
  }

  _mountTable() {
    this._table?.destroy();
    this._table = new DataTable(this._ui.tableHost, this._currentDf, {
      showIndex: false,
      showStatsButtons: false,
      sortable: false,
      compact: true,
      worldColor: 'var(--color-world-6)',
    });
    this._syncTableSignals();
  }

  _mountCharts() {
    this._ageChart?.destroy();
    this._salaryChart?.destroy();

    this._ageChart = new ChartWidget(this._ui.ageChartHost, ageChartConfig(this._currentDf, this._currentStageIndex));
    this._salaryChart = new ChartWidget(this._ui.salaryChartHost, salaryChartConfig(this._currentDf, this._currentStageIndex));
  }

  _renderStage() {
    this._dragDrop?.destroy();
    this._dragDrop = null;
    this._pendingAdvance = false;

    if (this._completed || this._currentStageIndex >= STAGES.length) {
      this._ui.stageHost.innerHTML = `
        <section class="panel w6-pipeline-stage w6-pipeline-stage--complete">
          <div class="w6-level__panel-head">
            <div>
              <p class="eyebrow">Pipeline Ready</p>
              <h2 class="panel-title">Every bay is locked, and the full recipe is now stable</h2>
            </div>
            <p class="w6-level__microcopy">
              The summary below captures the full transformation chain. The table on the left already reflects the finished feature matrix.
            </p>
          </div>
          <div class="w6-pipeline-stage__complete-grid">
            <article class="w6-pipeline-stage__complete-card">
              <span class="w6-pipeline-stage__complete-label">Stages Locked</span>
              <strong class="w6-pipeline-stage__complete-value">${TOTAL_STAGES} / ${TOTAL_STAGES}</strong>
            </article>
            <article class="w6-pipeline-stage__complete-card">
              <span class="w6-pipeline-stage__complete-label">Transforms Logged</span>
              <strong class="w6-pipeline-stage__complete-value">${TOTAL_TRANSFORMS} / ${TOTAL_TRANSFORMS}</strong>
            </article>
            <article class="w6-pipeline-stage__complete-card">
              <span class="w6-pipeline-stage__complete-label">Final Shape</span>
              <strong class="w6-pipeline-stage__complete-value">${this._currentDf.length} x ${this._currentDf.columns.length}</strong>
            </article>
          </div>
        </section>
      `;
      return;
    }

    const stage = STAGES[this._currentStageIndex];

    this._ui.stageHost.innerHTML = `
      <section class="panel w6-pipeline-stage" style="--stage-color:${stage.color};" aria-label="${escapeHtml(stage.title)}">
        <div class="w6-level__panel-head">
          <div>
            <p class="eyebrow">${escapeHtml(stage.worldCode)} - ${escapeHtml(stage.stepLabel)}</p>
            <h2 class="panel-title">${escapeHtml(stage.title)}</h2>
          </div>
          <p class="w6-level__microcopy">${escapeHtml(stage.objective)}</p>
        </div>

        <div class="w6-pipeline-stage__prompt">
          <p>${escapeHtml(stage.prompt)}</p>
        </div>

        <div class="w6-pipeline-stage__checks">
          ${stage.checks.map(check => `
            <article class="w6-pipeline-stage__check">
              <span class="w6-pipeline-stage__check-dot"></span>
              <p>${escapeHtml(check)}</p>
            </article>
          `).join('')}
        </div>

        <div class="w6-pipeline-target dd-zone" data-dd-zone="${STAGE_ZONE_ID}" data-dd-label="Apply ${escapeHtml(stage.title)}">
          <span class="w6-pipeline-target__eyebrow">Active Bay</span>
          <h3 class="w6-pipeline-target__title">Drop the best method card here</h3>
          <p class="w6-pipeline-target__copy">Drag a card into the bay, or click a card first and then click the bay to place it.</p>
        </div>

        <div class="w6-pipeline-choice-grid">
          ${(this._choiceOrders.get(stage.id) ?? stage.choices).map(choice => `
            <button
              class="w6-pipeline-choice dd-draggable"
              type="button"
              data-dd-id="${choice.id}"
            >
              <span class="w6-pipeline-choice__badge">${escapeHtml(choice.badge)}</span>
              <h3 class="w6-pipeline-choice__title">${escapeHtml(choice.title)}</h3>
              <p class="w6-pipeline-choice__copy">${escapeHtml(choice.copy)}</p>
            </button>
          `).join('')}
        </div>
      </section>
    `;

    this._dragDrop = createDragDrop({
      container: this._ui.stageHost,
      draggableSelector: '.w6-pipeline-choice',
      zoneSelector: '.w6-pipeline-target',
      allowReorder: false,
      snapBack: true,
      lockOnCorrect: true,
      multiplePerZone: false,
      clickToPlace: true,
      gradeOnDrop: true,
      correctAnswers: {
        [STAGE_ZONE_ID]: stage.correctChoice,
      },
      onCorrect: tokenId => this._handleCorrectChoice(stage, tokenId),
      onIncorrect: tokenId => this._handleIncorrectChoice(stage, tokenId),
    });
  }

  _handleCorrectChoice(stage, tokenId) {
    if (this._pendingAdvance || this._completed || stage.id !== STAGES[this._currentStageIndex]?.id) return;

    this._pendingAdvance = true;
    this._engine.correct();
    this._setFeedback(stage.successFeedback);
    this._setStatus(stage.nextStatus);

    this._advanceTimer = window.setTimeout(() => {
      this._advanceTimer = null;
      this._applyStage(stage, tokenId);
    }, 420);
  }

  _handleIncorrectChoice(stage, tokenId) {
    if (this._pendingAdvance || this._completed || stage.id !== STAGES[this._currentStageIndex]?.id) return;

    const choice = choiceById(stage, tokenId);
    this._mistakes += 1;
    this._engine.mistake({ costsLife: false, countsMistake: true });
    this._setFeedback(`${choice?.title ?? 'That method'} is not the right fit here. ${choice?.rationale ?? 'Try the option that preserves the correct downstream signal.'}`);
    this._setStatus(`Stage still open. Re-check what ${stage.title.toLowerCase()} needs to protect before the next bay can trust the table.`);
  }

  _applyStage(stage) {
    const previousDf = this._currentDf;
    const nextDf = stage.apply(previousDf);

    this._currentDf = nextDf;
    this._currentStageIndex += 1;
    this._logEntries.push(...stage.logEntries);

    this._applyTableUpdate(stage, nextDf);
    this._syncVisualState();

    if (this._currentStageIndex >= TOTAL_STAGES) {
      this._completePipeline();
      return;
    }

    this._renderStage();
  }

  _applyTableUpdate(stage, nextDf) {
    if (!this._table) return;

    if (stage.id === 'imputation') {
      this._table.update(nextDf, stage.sideEffect);
      this._table.clearColumnFlag(AGE_COL);
      this._table.clearColumnFlag(CITY_COL);
      this._table.flashColumn(AGE_COL, 'green');
      this._table.flashColumn(CITY_COL, 'green');
      return;
    }

    if (stage.id === 'outlier') {
      this._table.update(nextDf, stage.sideEffect);
      this._table.clearOutlierMask(SALARY_COL);
      this._table.clearColumnFlag(SALARY_COL);
      this._table.flashColumn(SALARY_COL, 'green');
      return;
    }

    if (stage.id === 'encoding') {
      this._table.clearColumnFlag(CITY_COL);
      this._table.update(nextDf, stage.sideEffect);
      window.setTimeout(() => {
        this._table?.scrollToColumn(CITY_DUMMY_COLUMNS[0] ?? AGE_COL);
      }, 160);
      return;
    }

    this._table.update(nextDf, stage.sideEffect);
    this._table.clearColumnFlag(AGE_COL);
    this._table.clearColumnFlag(SALARY_COL);
    this._table.flashColumn(AGE_COL, 'green');
    this._table.flashColumn(SALARY_COL, 'green');
    window.setTimeout(() => {
      this._table?.scrollToColumn(AGE_COL);
    }, 120);
  }

  _completePipeline() {
    if (this._completed) return;

    this._completed = true;
    this._summary = {
      stagesCompleted: TOTAL_STAGES,
      transformsLogged: this._logEntries.length,
      mistakes: this._mistakes,
    };

    this._renderStage();
    this._syncVisualState();

    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = `${TOTAL_STAGES} / ${TOTAL_STAGES} stages locked`;
    }

    if (this._ui.summary) {
      this._ui.summary.hidden = false;
      requestAnimationFrame(() => {
        this._ui.summary.classList.add('is-revealed');
      });
      this._ui.summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    this._setFeedback(resultTone(this._summary));
    this._setStatus('Pipeline ready. Review the recap below, then continue to the final curriculum checkpoint.');
  }

  _resetPipeline() {
    this._clearAdvanceTimer();
    this._dragDrop?.destroy();
    this._dragDrop = null;

    this._currentDf = RAW_DF;
    this._currentStageIndex = 0;
    this._logEntries = [];
    this._mistakes = 0;
    this._completed = false;
    this._summary = null;
    this._pendingAdvance = false;
    this._choiceOrders = new Map(STAGES.map(stage => [stage.id, shuffleCopy(stage.choices)]));

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
      this._ui.summaryScore.textContent = 'Waiting for all 4 stages';
    }

    this._mountTable();
    this._mountCharts();
    this._renderStage();
    this._syncVisualState();
    this._setFeedback(DEFAULT_FEEDBACK);
    this._setStatus(DEFAULT_STATUS);
  }

  _showHint() {
    const { allowed, text } = this._engine.requestHint();
    if (!allowed || !text) return;

    this._ui.hintBox?.removeAttribute('hidden');
    if (this._ui.hintText) {
      this._ui.hintText.textContent = text;
    }
  }

  _syncVisualState() {
    this._syncProgress();
    this._syncSnapshot();
    this._syncMap();
    this._syncLog();
    this._syncRecipeDraft();
    this._syncCharts();
    this._syncTableSignals();
  }

  _syncProgress() {
    if (this._ui.progress) {
      this._ui.progress.textContent = `${this._currentStageIndex} / ${TOTAL_STAGES} stages locked`;
    }

    if (this._ui.logProgress) {
      this._ui.logProgress.textContent = `${this._logEntries.length} / ${TOTAL_TRANSFORMS} transforms logged`;
    }

    if (this._ui.shape) {
      this._ui.shape.textContent = `${this._currentDf.length} x ${this._currentDf.columns.length} frame`;
    }

    if (this._ui.finishButton) {
      this._ui.finishButton.disabled = !this._completed;
    }
  }

  _syncSnapshot() {
    if (this._ui.shapeCard) {
      this._ui.shapeCard.textContent = `${this._currentDf.length} x ${this._currentDf.columns.length}`;
    }

    if (this._ui.nullCard) {
      this._ui.nullCard.textContent = NUMBER.format(this._currentDf.totalNulls());
    }

    if (this._ui.salaryCard) {
      if (this._currentStageIndex < 2) {
        this._ui.salaryCard.textContent = 'Spike Live';
        this._ui.salaryCard.dataset.state = 'warning';
      } else if (this._currentStageIndex < TOTAL_STAGES) {
        this._ui.salaryCard.textContent = `Capped ${formatMoney(SALARY_FENCES.upper)}`;
        this._ui.salaryCard.dataset.state = 'present';
      } else {
        this._ui.salaryCard.textContent = 'Z-Scored';
        this._ui.salaryCard.dataset.state = 'correct';
      }
    }

    if (this._ui.cityCard) {
      if (this._currentStageIndex < 1) {
        this._ui.cityCard.textContent = 'Raw Category';
        this._ui.cityCard.dataset.state = 'present';
      } else if (this._currentStageIndex < 3) {
        this._ui.cityCard.textContent = 'Missing Tagged';
        this._ui.cityCard.dataset.state = 'present';
      } else {
        this._ui.cityCard.textContent = `${CITY_DUMMY_COUNT} Dummies`;
        this._ui.cityCard.dataset.state = 'correct';
      }
    }
  }

  _syncMap() {
    this._ui.mapCards.forEach((card, index) => {
      const stage = stageById(card.getAttribute('data-stage-card'));
      if (!stage) return;

      let state = 'pending';
      if (index < this._currentStageIndex) state = 'locked';
      else if (!this._completed && index === this._currentStageIndex) state = 'active';
      else if (this._completed) state = 'locked';

      card.dataset.stageState = state;
      const status = card.querySelector(`[data-stage-status="${stage.id}"]`);
      if (status) {
        status.textContent = state === 'locked' ? 'Locked' : state === 'active' ? 'Active' : 'Pending';
      }
    });
  }

  _syncLog() {
    if (!this._ui.logList) return;

    if (!this._logEntries.length) {
      this._ui.logList.innerHTML = `
        <article class="w6-pipeline-log__empty">
          <p>No transforms recorded yet.</p>
          <p>Stage 1 will write the first two recipe lines once the imputation rule is locked.</p>
        </article>
      `;
      return;
    }

    this._ui.logList.innerHTML = this._logEntries.map(entry => `
      <article class="w6-pipeline-log__item" style="--stage-color:${entry.color};">
        <div class="w6-pipeline-log__meta">
          <span class="w6-pipeline-log__world">${escapeHtml(entry.worldCode)}</span>
          <code class="w6-pipeline-log__line">${escapeHtml(entry.line)}</code>
        </div>
        <p class="w6-pipeline-log__note">${escapeHtml(entry.note)}</p>
      </article>
    `).join('');
  }

  _syncRecipeDraft() {
    if (this._ui.recipeCode) {
      this._ui.recipeCode.innerHTML = renderRecipeDraftHtml(this._logEntries);
    }
  }

  _syncCharts() {
    this._ageChart?.update(ageChartConfig(this._currentDf, this._currentStageIndex));
    this._salaryChart?.update(salaryChartConfig(this._currentDf, this._currentStageIndex));
  }

  _syncTableSignals() {
    if (!this._table) return;

    this._table.clearColumnFlag(AGE_COL);
    this._table.clearColumnFlag(SALARY_COL);
    this._table.clearColumnFlag(CITY_COL);
    this._table.clearOutlierMask(SALARY_COL);

    if (this._currentStageIndex < 1) {
      this._table.highlightColumn(AGE_COL, 'missing');
      this._table.highlightColumn(CITY_COL, 'missing');
    }

    if (this._currentStageIndex < 2) {
      this._table.highlightColumn(SALARY_COL, 'outlier');
      this._table.setOutlierMask(SALARY_COL, buildSalaryMask(this._currentDf));
    }

    if (this._currentStageIndex >= 3 && !this._completed) {
      this._table.highlightColumn(AGE_COL, 'scale');
      this._table.highlightColumn(SALARY_COL, 'scale');
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

  _clearAdvanceTimer() {
    if (this._advanceTimer !== null) {
      window.clearTimeout(this._advanceTimer);
      this._advanceTimer = null;
    }
  }
}
