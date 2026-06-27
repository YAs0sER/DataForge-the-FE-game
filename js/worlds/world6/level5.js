'use strict';

import { validateStandardizedColumn, valuesApproxEqual } from '../../data/answers.js';
import { createDataset, DATASET_KEYS } from '../../data/datasets.js';
import { getLevelProblem } from '../../data/problems.js';
import { DataFrame, isMissing } from '../../pandas/dataframe.js';
import { DataTable } from '../../widgets/datatable.js';
import { CodeEditorWidget } from '../../widgets/editor.js?v=20260614b';
import { ChartWidget } from '../../widgets/charts.js';

const PROBLEM = getLevelProblem(6, 5);
const LEVEL_TITLE = PROBLEM?.title ?? 'The Real Dataset';
const LEVEL_OBJECTIVE = PROBLEM?.objective ?? 'Discover and fix every hidden issue in a 100-row production-style dataset.';

const AGE_COL = 'Age';
const SALARY_COL = 'Salary';
const CITY_COL = 'City';
const EDUCATION_COL = 'Education_Level';
const PURCHASE_COL = 'Purchase_Count';
const JOIN_COL = 'Join_Date';
const MISSING_CITY = 'Missing';
const GROUPED_LABEL = 'Autres';
const RARE_THRESHOLD = 0.05;
const PLACEHOLDER_CARD_FLOOR = 4;

function createFallbackDataset() {
  return DataFrame.fromRows([
    { Age: 24.2, Salary: 32000, City: 'Agadir', Education_Level: 'Bac', Purchase_Count: 1, Join_Date: '2024-01-09' },
    { Age: null, Salary: 36500, City: 'Rabat', Education_Level: 'Licence', Purchase_Count: 2, Join_Date: '2024-01-13' },
    { Age: 31.7, Salary: 220000, City: 'Dakhla', Education_Level: 'Master', Purchase_Count: 5, Join_Date: '2024-02-01' },
    { Age: 36.4, Salary: 41000, City: null, Education_Level: 'Doctorat', Purchase_Count: 2, Join_Date: '2024-02-18' },
    { Age: 42.1, Salary: 52000, City: 'Tangier', Education_Level: 'Licence', Purchase_Count: 4, Join_Date: '2024-03-11' },
    { Age: null, Salary: 58000, City: 'Oujda', Education_Level: 'Bac', Purchase_Count: 1, Join_Date: '2024-03-29' },
    { Age: 29.8, Salary: 47000, City: 'Marrakech', Education_Level: 'Master', Purchase_Count: 7, Join_Date: '2024-04-07' },
    { Age: 39.3, Salary: 350000, City: 'Kenitra', Education_Level: 'Licence', Purchase_Count: 3, Join_Date: '2024-04-19' },
  ]);
}

function createLevelDataset() {
  try {
    return createDataset(PROBLEM?.datasetKey ?? DATASET_KEYS.FINAL_PIPELINE);
  } catch {
    return createFallbackDataset();
  }
}

const ORIGINAL_DF = createLevelDataset();
const AGE_MISSING_ROWS = missingIndices(ORIGINAL_DF, AGE_COL);
const CITY_MISSING_ROWS = missingIndices(ORIGINAL_DF, CITY_COL);
const ORIGINAL_CITY_VALUES = Object.freeze([...ORIGINAL_DF.col(CITY_COL).values]);
const ORIGINAL_SALARY_VALUES = Object.freeze([...ORIGINAL_DF.col(SALARY_COL).values]);
const ORIGINAL_AGE_VALUES = Object.freeze([...ORIGINAL_DF.col(AGE_COL).values]);
const ORIGINAL_PROTECTED_COLUMNS = Object.freeze([EDUCATION_COL, PURCHASE_COL, JOIN_COL]);
const ORIGINAL_PROTECTED_VALUES = Object.freeze(
  Object.fromEntries(ORIGINAL_PROTECTED_COLUMNS.map(col => [col, Object.freeze([...ORIGINAL_DF.col(col).values])]))
);

const AGE_MEDIAN = ORIGINAL_DF.col(AGE_COL).median();
const FILLED_DF = ORIGINAL_DF
  .fillna(AGE_COL, 'median')
  .fillna(CITY_COL, MISSING_CITY);
const SALARY_FENCES = FILLED_DF.iqrFences(SALARY_COL);
const CLIPPED_DF = FILLED_DF.clip(SALARY_COL, SALARY_FENCES.lower, SALARY_FENCES.upper);
const CITY_FREQ_MAP = FILLED_DF.col(CITY_COL).valueCounts(true);
const RAW_CITY_CARDINALITY = FILLED_DF.col(CITY_COL).nunique();
const RARE_CITIES = Object.freeze(
  Object.entries(CITY_FREQ_MAP)
    .filter(([, value]) => value < RARE_THRESHOLD)
    .map(([city]) => city)
);
const RARE_CITY_ROWS = Object.freeze(
  ORIGINAL_CITY_VALUES
    .map((city, index) => (RARE_CITIES.includes(city) ? index : -1))
    .filter(index => index >= 0)
);
const GROUPED_DF = CLIPPED_DF.replace(CITY_COL, RARE_CITIES, GROUPED_LABEL);
const GROUPED_CITY_CARDINALITY = GROUPED_DF.col(CITY_COL).nunique();
const ENCODED_DF = GROUPED_DF.getDummies(CITY_COL, false, CITY_COL);
const FINAL_DF = ENCODED_DF
  .standardize(AGE_COL, '')
  .standardize(SALARY_COL, '');

const ORIGINAL_COLUMNS = Object.freeze([...ORIGINAL_DF.columns]);
const FINAL_COLUMNS = Object.freeze([...FINAL_DF.columns]);
const EXPECTED_AGE_FILLED_VALUES = Object.freeze([...FILLED_DF.col(AGE_COL).values]);
const EXPECTED_SALARY_CLIPPED_VALUES = Object.freeze([...CLIPPED_DF.col(SALARY_COL).values]);
const EXPECTED_GROUPED_CITY_VALUES = Object.freeze([...GROUPED_DF.col(CITY_COL).values]);
const EXPECTED_AGE_FINAL_VALUES = Object.freeze([...FINAL_DF.col(AGE_COL).values]);
const EXPECTED_SALARY_FINAL_VALUES = Object.freeze([...FINAL_DF.col(SALARY_COL).values]);
const EXPECTED_CITY_DUMMY_COLS = Object.freeze(
  ENCODED_DF.columns.filter(col => col.startsWith(`${CITY_COL}_`)).sort()
);
const EXPECTED_CITY_DUMMY_VALUES = Object.freeze(
  Object.fromEntries(EXPECTED_CITY_DUMMY_COLS.map(col => [col, Object.freeze([...ENCODED_DF.col(col).values])]))
);

const AUTRES_DUMMY_COL = `${CITY_COL}_${GROUPED_LABEL}`;
const MISSING_DUMMY_COL = `${CITY_COL}_${MISSING_CITY}`;
const RAW_SALARY_MAX = ORIGINAL_DF.col(SALARY_COL).max();
const CLIPPED_SALARY_MAX = CLIPPED_DF.col(SALARY_COL).max();
const AGE_NULL_TOTAL = AGE_MISSING_ROWS.length;
const CITY_NULL_TOTAL = CITY_MISSING_ROWS.length;
const TOTAL_TASKS = 6;

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const REFERENCE = Object.freeze(
  [
    '# Inspect first. Let the table tell you what is broken.',
    'df.head()',
    'df.isnull().sum()',
    'df.describe()',
    "df['Column'].value_counts(normalize=True)",
    'df.dtypes',
    '',
    '# Missing numeric pattern: choose a robust statistic when the column is skewed.',
    "df['NumericCol'] = df['NumericCol'].fillna(df['NumericCol'].median())",
    '',
    '# Missing categorical pattern: preserve the fact that the value was absent.',
    "df['CategoryCol'] = df['CategoryCol'].fillna('Missing')",
    '',
    '# IQR pattern: compute the spread, then cap with the lower and upper fences.',
    "Q1 = df['NumericCol'].quantile(0.25)",
    "Q3 = df['NumericCol'].quantile(0.75)",
    'IQR = Q3 - Q1',
    'lower = Q1 - 1.5 * IQR',
    'upper = Q3 + 1.5 * IQR',
    "df['NumericCol'] = df['NumericCol'].clip(lower, upper)",
    '',
    '# Rare-category pattern: group only labels below your chosen frequency threshold.',
    "df['CategoryCol'] = df['CategoryCol'].replace(['RareA', 'RareB'], 'Other')",
    '',
    '# Encoding pattern: widen the cleaned category column after grouping.',
    "df = pd.get_dummies(df, columns=['CategoryCol'])",
    '',
    '# Scaling pattern: standardize numeric features after all earlier repairs land.',
    "df['NumericCol'] = StandardScaler().fit_transform(df[['NumericCol']])",
  ]
);

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM?.hints ?? []),
  `Age has ${AGE_NULL_TOTAL} gaps, and the robust repair is the median ${formatNumber(AGE_MEDIAN, 1)} before you standardize the column.`,
  `City has ${CITY_NULL_TOTAL} missing labels. Keep that absence explicit with "${MISSING_CITY}" so the encoder can preserve it later.`,
  `The Salary spikes should be capped at the IQR upper fence ${formatMoney(CLIPPED_SALARY_MAX)} before you standardize Salary.`,
  `Only the four 1% city labels belong inside "${GROUPED_LABEL}". The ${MISSING_CITY} bucket is common enough to stay explicit.`,
  `The final dataset keeps ${ORIGINAL_DF.length} rows and widens City into ${EXPECTED_CITY_DUMMY_COLS.length} dummy columns while Age and Salary both finish at mean 0 and std 1.`,
]);

const INITIAL_CODE = `# Explore before you mutate.
# The hidden issue cards unlock from the dataset clues.
#
# Try:
# df.isnull().sum()
# df.describe()
# df['City'].value_counts(normalize=True)
# df.dtypes
#
# Write your pandas-like repair commands below:
`;

const DEFAULT_FEEDBACK = 'Run the discovery commands first. This level is about listening to the dataset before you touch the fixes.';
const DEFAULT_STATUS = 'Search the raw table, reveal the hidden issue cards, then repair Age, City, Salary, and the final scale balance in a clean pipeline order.';
const SUMMARY_COPY = 'The finished dataset keeps all 100 rows, caps the Salary spikes without deleting customers, compresses City into a clean dummy block, and standardizes the two numeric features that were fighting on raw scale.';

const TASK_LABELS = new Map((PROBLEM?.tasks ?? []).map(task => [task.id, task.label]));

const TASKS = Object.freeze([
  Object.freeze({
    id: 'age-null',
    label: TASK_LABELS.get('age-null') ?? 'Repair Age with median imputation before scaling',
    title: `Missing values in ${AGE_COL} - ${AGE_NULL_TOTAL} nulls`,
    worldCode: 'W2',
    worldLabel: 'Missing Data',
    worldColor: 'var(--color-world-2)',
    column: AGE_COL,
    validate: validateAgeRepair,
  }),
  Object.freeze({
    id: 'city-null',
    label: TASK_LABELS.get('city-null') ?? 'Repair City with an explicit Missing category',
    title: `Missing values in ${CITY_COL} - ${CITY_NULL_TOTAL} nulls`,
    worldCode: 'W2',
    worldLabel: 'Missing Data',
    worldColor: 'var(--color-world-2)',
    column: CITY_COL,
    validate: validateCityRepair,
  }),
  Object.freeze({
    id: 'salary-outlier',
    label: TASK_LABELS.get('salary-outlier') ?? 'Cap the Salary spikes at the IQR fences while keeping every row',
    title: `Outliers in ${SALARY_COL} - 3 extreme spikes`,
    worldCode: 'W3',
    worldLabel: 'Outliers',
    worldColor: 'var(--color-world-3)',
    column: SALARY_COL,
    validate: validateSalaryOutlier,
  }),
  Object.freeze({
    id: 'rare-city',
    label: TASK_LABELS.get('rare-city') ?? 'Group the four rare City labels into Autres',
    title: `High cardinality tail in ${CITY_COL}`,
    worldCode: 'W4',
    worldLabel: 'Encoding',
    worldColor: 'var(--color-world-4)',
    column: CITY_COL,
    validate: validateRareCityGrouping,
  }),
  Object.freeze({
    id: 'city-encode',
    label: TASK_LABELS.get('city-encode') ?? 'One-hot encode the grouped City column into the final dummy block',
    title: `${CITY_COL} still needs one-hot encoding`,
    worldCode: 'W4',
    worldLabel: 'Encoding',
    worldColor: 'var(--color-world-4)',
    column: CITY_COL,
    validate: validateCityEncoding,
  }),
  Object.freeze({
    id: 'scale-balance',
    label: TASK_LABELS.get('scale-balance') ?? 'Standardize both Age and Salary after the repairs land',
    title: `${AGE_COL} and ${SALARY_COL} are on incompatible scales`,
    worldCode: 'W5',
    worldLabel: 'Scaling',
    worldColor: 'var(--color-world-5)',
    column: AGE_COL,
    validate: validateScaleBalance,
  }),
]);

const TASK_BY_ID = new Map(TASKS.map(task => [task.id, task]));

const STAGES = Object.freeze([
  Object.freeze({
    id: 'discover',
    label: 'Discover',
    badge: 'W1',
    color: 'var(--color-world-1)',
    taskIds: [],
    copy: 'Run the inspection commands that reveal the hidden issue cards.',
  }),
  Object.freeze({
    id: 'missing',
    label: 'Impute',
    badge: 'W2',
    color: 'var(--color-world-2)',
    taskIds: ['age-null', 'city-null'],
    copy: 'Repair missing Age with the median and keep missing City explicit.',
  }),
  Object.freeze({
    id: 'outliers',
    label: 'Cap',
    badge: 'W3',
    color: 'var(--color-world-3)',
    taskIds: ['salary-outlier'],
    copy: 'Keep the Salary rows, but clip the three spikes to the safe fence.',
  }),
  Object.freeze({
    id: 'encoding',
    label: 'Encode',
    badge: 'W4',
    color: 'var(--color-world-4)',
    taskIds: ['rare-city', 'city-encode'],
    copy: 'Shrink the City tail before the dummy columns expand it.',
  }),
  Object.freeze({
    id: 'scaling',
    label: 'Standardize',
    badge: 'W5',
    color: 'var(--color-world-5)',
    taskIds: ['scale-balance'],
    copy: 'Finish by standardizing Age and Salary onto the same statistical footing.',
  }),
]);

function missingIndices(df, colName) {
  return df.col(colName).values
    .map((value, index) => (isMissing(value) ? index : -1))
    .filter(index => index >= 0);
}

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

function formatPercent(value, digits = 0) {
  if (!Number.isFinite(value)) return '-';
  return `${Number(value.toFixed(digits))}%`;
}

function arraysEqual(actual, expected) {
  if (!Array.isArray(actual) || !Array.isArray(expected) || actual.length !== expected.length) {
    return false;
  }

  return actual.every((value, index) => value === expected[index]);
}

function columnPresent(df, colName) {
  return df instanceof DataFrame && df.columns.includes(colName);
}

function sameColumnValues(df, colName, expectedValues) {
  return columnPresent(df, colName) && arraysEqual(df.col(colName).values, expectedValues);
}

function protectedColumnsIntact(df) {
  if (!(df instanceof DataFrame) || df.length !== ORIGINAL_DF.length) return false;
  return ORIGINAL_PROTECTED_COLUMNS.every(col => sameColumnValues(df, col, ORIGINAL_PROTECTED_VALUES[col]));
}

function cityDummyCols(df) {
  if (!(df instanceof DataFrame)) return [];
  return df.columns.filter(col => col.startsWith(`${CITY_COL}_`)).sort();
}

function valuesApprox(df, colName, expectedValues, tolerance = 1e-6) {
  return columnPresent(df, colName) && valuesApproxEqual(df.col(colName).values, expectedValues, tolerance);
}

function validateAgeRepair(df) {
  if (!(df instanceof DataFrame) || !columnPresent(df, AGE_COL)) return false;
  if (AGE_MISSING_ROWS.some(index => isMissing(df.col(AGE_COL).values[index]))) return false;

  return (
    valuesApprox(df, AGE_COL, EXPECTED_AGE_FILLED_VALUES, 1e-6) ||
    valuesApprox(df, AGE_COL, EXPECTED_AGE_FINAL_VALUES, 1e-6)
  );
}

function validateCityRepair(df) {
  if (!(df instanceof DataFrame) || df.length !== ORIGINAL_DF.length) return false;

  if (columnPresent(df, CITY_COL)) {
    if (df.col(CITY_COL).nullCount() !== 0) return false;
    return CITY_MISSING_ROWS.every(index => df.col(CITY_COL).values[index] === MISSING_CITY);
  }

  return columnPresent(df, MISSING_DUMMY_COL)
    && CITY_MISSING_ROWS.every(index => df.col(MISSING_DUMMY_COL).values[index] === 1);
}

function validateSalaryOutlier(df) {
  if (!(df instanceof DataFrame) || !protectedColumnsIntact(df) || !columnPresent(df, SALARY_COL)) return false;

  return (
    valuesApprox(df, SALARY_COL, EXPECTED_SALARY_CLIPPED_VALUES, 1e-6) ||
    valuesApprox(df, SALARY_COL, EXPECTED_SALARY_FINAL_VALUES, 1e-6)
  );
}

function validateRareCityGrouping(df) {
  if (!(df instanceof DataFrame) || df.length !== ORIGINAL_DF.length) return false;

  if (columnPresent(df, CITY_COL)) {
    return RARE_CITY_ROWS.every(index => df.col(CITY_COL).values[index] === GROUPED_LABEL);
  }

  return columnPresent(df, AUTRES_DUMMY_COL)
    && RARE_CITY_ROWS.every(index => df.col(AUTRES_DUMMY_COL).values[index] === 1);
}

function validateCityEncoding(df) {
  if (!(df instanceof DataFrame) || !protectedColumnsIntact(df)) return false;
  if (columnPresent(df, CITY_COL)) return false;

  const actualDummyCols = cityDummyCols(df);
  if (!arraysEqual(actualDummyCols, EXPECTED_CITY_DUMMY_COLS)) return false;

  return EXPECTED_CITY_DUMMY_COLS.every(col => sameColumnValues(df, col, EXPECTED_CITY_DUMMY_VALUES[col]));
}

function validateScaleBalance(df) {
  if (!(df instanceof DataFrame) || !protectedColumnsIntact(df)) return false;
  if (!columnPresent(df, AGE_COL) || !columnPresent(df, SALARY_COL)) return false;

  return (
    validateStandardizedColumn(df, AGE_COL, 1e-6, 1e-6) &&
    validateStandardizedColumn(df, SALARY_COL, 1e-6, 1e-6) &&
    valuesApprox(df, AGE_COL, EXPECTED_AGE_FINAL_VALUES, 1e-6) &&
    valuesApprox(df, SALARY_COL, EXPECTED_SALARY_FINAL_VALUES, 1e-6)
  );
}

function validateFinalSolution(df) {
  return (
    validateAgeRepair(df) &&
    validateCityRepair(df) &&
    validateSalaryOutlier(df) &&
    validateRareCityGrouping(df) &&
    validateCityEncoding(df) &&
    validateScaleBalance(df) &&
    arraysEqual(df.columns, FINAL_COLUMNS)
  );
}

function resultMutatesData(result) {
  return result?.status === 'ok' && result.df instanceof DataFrame;
}

function resultRevealsIssue(result) {
  const type = result?.sideEffect?.type;
  return (
    type === 'isnull_sum' ||
    type === 'describe' ||
    type === 'dtypes' ||
    (type === 'value_counts' && result.sideEffect?.col === CITY_COL)
  );
}

function inspectionUnlocked(summary) {
  return summary.results.some(resultRevealsIssue);
}

function taskIdsPassingForDf(df) {
  return TASKS
    .filter(task => task.validate(df))
    .map(task => task.id);
}

function discoveredTaskIdsFromRun(summary) {
  const discovered = new Set();

  summary.results.forEach(result => {
    const type = result.sideEffect?.type;
    if (type === 'isnull_sum') {
      discovered.add('age-null');
      discovered.add('city-null');
    }

    if (type === 'describe') {
      discovered.add('salary-outlier');
      discovered.add('scale-balance');
    }

    if (type === 'dtypes') {
      discovered.add('city-encode');
    }

    if (type === 'value_counts' && result.sideEffect?.col === CITY_COL) {
      discovered.add('rare-city');
    }

    if (type === 'fillna' && result.sideEffect?.col === AGE_COL) {
      discovered.add('age-null');
    }

    if (type === 'fillna' && result.sideEffect?.col === CITY_COL) {
      discovered.add('city-null');
    }

    if ((type === 'clip' || type === 'clip_outliers') && result.sideEffect?.col === SALARY_COL) {
      discovered.add('salary-outlier');
    }

    if (type === 'group_rare' && result.sideEffect?.col === CITY_COL) {
      discovered.add('rare-city');
    }

    if (type === 'get_dummies' && result.sideEffect?.col === CITY_COL) {
      discovered.add('city-encode');
    }

    if (type === 'standardize' && (result.sideEffect?.col === AGE_COL || result.sideEffect?.col === SALARY_COL)) {
      discovered.add('scale-balance');
    }
  });

  taskIdsPassingForDf(summary.df).forEach(taskId => discovered.add(taskId));
  return discovered;
}

function visibleTaskSlots(discoveredCount) {
  if (discoveredCount >= TASKS.length) return TASKS.length;
  return Math.max(PLACEHOLDER_CARD_FLOOR, Math.min(TASKS.length, discoveredCount + 1));
}

function taskState(taskId, df, discoveredIds, fixedIds) {
  if (!discoveredIds.has(taskId)) return 'hidden';
  if (fixedIds.has(taskId)) return 'fixed';
  if (taskProgressTone(taskId, df) === 'progress') return 'progress';
  return 'identified';
}

function taskProgressTone(taskId, df) {
  if (!(df instanceof DataFrame)) return 'identified';

  switch (taskId) {
    case 'age-null': {
      if (!columnPresent(df, AGE_COL)) return 'identified';
      const nulls = df.col(AGE_COL).nullCount();
      if (nulls < AGE_NULL_TOTAL) return 'progress';
      return 'identified';
    }
    case 'city-null': {
      if (columnPresent(df, CITY_COL) && df.col(CITY_COL).nullCount() < CITY_NULL_TOTAL) return 'progress';
      if (!columnPresent(df, CITY_COL) && cityDummyCols(df).length) return 'progress';
      return 'identified';
    }
    case 'salary-outlier': {
      if (!columnPresent(df, SALARY_COL)) return 'identified';
      if (df.col(SALARY_COL).max() < RAW_SALARY_MAX) return 'progress';
      return 'identified';
    }
    case 'rare-city': {
      if (columnPresent(df, CITY_COL) && df.col(CITY_COL).nunique() < RAW_CITY_CARDINALITY) return 'progress';
      if (!columnPresent(df, CITY_COL) && cityDummyCols(df).length) return 'progress';
      return 'identified';
    }
    case 'city-encode':
      return cityDummyCols(df).length ? 'progress' : 'identified';
    case 'scale-balance': {
      if (!columnPresent(df, AGE_COL) || !columnPresent(df, SALARY_COL)) return 'identified';
      const ageStd = validateStandardizedColumn(df, AGE_COL, 0.15, 0.15);
      const salaryStd = validateStandardizedColumn(df, SALARY_COL, 0.15, 0.15);
      return ageStd || salaryStd ? 'progress' : 'identified';
    }
    default:
      return 'identified';
  }
}

function taskCopy(taskId, state, df) {
  switch (taskId) {
    case 'age-null':
      if (state === 'fixed') return `${AGE_NULL_TOTAL} missing Age values are repaired with the median path and survive the later scaling step cleanly.`;
      if (state === 'progress') return `Age is changing, but the repair only locks when every missing row inherits the median ${formatNumber(AGE_MEDIAN, 1)} before scaling.`;
      return `${AGE_NULL_TOTAL} Age cells are blank. Use the median ${formatNumber(AGE_MEDIAN, 1)} because the final numeric pipeline needs a robust center, not a mean pulled by Salary extremes.`;
    case 'city-null':
      if (state === 'fixed') return `${CITY_NULL_TOTAL} missing City values now survive as the explicit "${MISSING_CITY}" category, which the encoder can preserve later.`;
      if (state === 'progress') return `City is moving, but the repair only locks when every blank row becomes the literal "${MISSING_CITY}" category.`;
      return `${CITY_NULL_TOTAL} City cells are blank. Keep absence explicit with "${MISSING_CITY}" instead of pretending those rows belonged to an existing city.`;
    case 'salary-outlier':
      if (state === 'fixed') return `The three Salary spikes still exist as real customers, but they now stop at the IQR ceiling ${formatMoney(CLIPPED_SALARY_MAX)}.`;
      if (state === 'progress') return 'Salary changed, but the final repair keeps every row and uses the IQR fences instead of deleting the customers or jumping straight to scaling.';
      return `Three Salary values sit far beyond the healthy range. Cap them at the IQR upper fence ${formatMoney(CLIPPED_SALARY_MAX)} without deleting the rows.`;
    case 'rare-city':
      if (state === 'fixed') return `The four 1% city labels have been grouped into "${GROUPED_LABEL}", which shrinks the City vocabulary from ${RAW_CITY_CARDINALITY} labels to ${GROUPED_CITY_CARDINALITY}.`;
      if (state === 'progress') return `The City vocabulary is shrinking, but the tail is only correct when Dakhla, Oujda, Tetouan, and Kenitra merge into "${GROUPED_LABEL}".`;
      return `The City tail contains four 1% labels. Group them into "${GROUPED_LABEL}" before you widen the dataset into dummy columns.`;
    case 'city-encode':
      if (state === 'fixed') return `City is now represented by ${EXPECTED_CITY_DUMMY_COLS.length} dummy columns, including explicit ${MISSING_CITY} and ${GROUPED_LABEL} signals.`;
      if (state === 'progress') return 'Dummy columns are appearing, but the final block only locks after City has been grouped first and the exact compact dummy set is present.';
      return `City still needs one-hot encoding after the grouping pass. The clean finish widens into ${EXPECTED_CITY_DUMMY_COLS.length} dummy columns and drops the raw City text column.`;
    case 'scale-balance':
      if (state === 'fixed') return `${AGE_COL} and ${SALARY_COL} are both standardized now, so each column lands at mean 0 and standard deviation 1.`;
      if (state === 'progress') return 'One numeric column is moving toward a healthy z-score, but the final lock needs both Age and Salary standardized together after the repairs.';
      return `${AGE_COL} and ${SALARY_COL} still fight on incompatible raw scales. After the repairs, standardize both columns so they share mean 0 and std 1.`;
    default:
      return '';
  }
}

function nextObjective(fixedIds, discoveredIds, inspected) {
  if (!inspected && discoveredIds.size === 0) {
    return 'Run df.isnull().sum(), df.describe(), df[\'City\'].value_counts(normalize=True), and df.dtypes to reveal the hidden cards.';
  }

  if (!fixedIds.has('age-null')) {
    return `Repair ${AGE_COL} first with the median ${formatNumber(AGE_MEDIAN, 1)}.`;
  }

  if (!fixedIds.has('city-null')) {
    return `Repair ${CITY_COL} next with the explicit "${MISSING_CITY}" category.`;
  }

  if (!fixedIds.has('salary-outlier')) {
    return `Cap ${SALARY_COL} at the IQR ceiling ${formatMoney(CLIPPED_SALARY_MAX)} while keeping every row.`;
  }

  if (!fixedIds.has('rare-city')) {
    return `Collapse the four 1% city labels into "${GROUPED_LABEL}" before you encode ${CITY_COL}.`;
  }

  if (!fixedIds.has('city-encode')) {
    return `One-hot encode ${CITY_COL} into the compact ${EXPECTED_CITY_DUMMY_COLS.length}-column dummy block.`;
  }

  if (!fixedIds.has('scale-balance')) {
    return `Finish by standardizing both ${AGE_COL} and ${SALARY_COL}.`;
  }

  return 'All six issue cards are fixed. Review the pipeline report below, then continue.';
}

function ageState(df) {
  if (!columnPresent(df, AGE_COL)) return { label: '-', tone: 'warning' };
  if (validateScaleBalance(df)) return { label: 'Standardized', tone: 'correct' };

  const nulls = df.col(AGE_COL).nullCount();
  if (nulls > 0) return { label: `${nulls} nulls`, tone: 'warning' };
  if (validateAgeRepair(df)) return { label: 'Median Repaired', tone: 'present' };
  return { label: 'Mutated', tone: 'warning' };
}

function cityState(df) {
  if (!(df instanceof DataFrame)) return { label: '-', tone: 'warning' };
  if (validateCityEncoding(df)) return { label: `${EXPECTED_CITY_DUMMY_COLS.length} dummies`, tone: 'correct' };

  if (columnPresent(df, CITY_COL)) {
    const nulls = df.col(CITY_COL).nullCount();
    const uniques = df.col(CITY_COL).nunique();
    if (nulls > 0) return { label: `${nulls} nulls`, tone: 'warning' };
    if (validateRareCityGrouping(df)) return { label: `${uniques} labels`, tone: 'present' };
    if (validateCityRepair(df)) return { label: `"${MISSING_CITY}" kept`, tone: 'present' };
    return { label: `${uniques} labels`, tone: 'missing' };
  }

  const dummies = cityDummyCols(df);
  if (dummies.length) return { label: `${dummies.length} dummies`, tone: 'present' };
  return { label: '-', tone: 'warning' };
}

function salaryState(df) {
  if (!columnPresent(df, SALARY_COL)) return { label: '-', tone: 'warning' };
  if (validateScaleBalance(df)) return { label: 'Standardized', tone: 'correct' };
  if (validateSalaryOutlier(df)) return { label: `Capped ${formatMoney(CLIPPED_SALARY_MAX)}`, tone: 'present' };
  return { label: `Max ${formatMoney(df.col(SALARY_COL).max())}`, tone: 'warning' };
}

function filteredRows(df, query) {
  if (!(df instanceof DataFrame)) return [];
  const trimmed = query.trim().toLowerCase();
  const rows = df.toRows();

  if (!trimmed) return rows;

  return rows.filter(row => Object.entries(row).some(([key, value]) => {
    const text = `${key} ${isMissing(value) ? 'NaN' : String(value)}`.toLowerCase();
    return text.includes(trimmed);
  }));
}

function ageChartConfig(df) {
  const values = columnPresent(df, AGE_COL)
    ? df.col(AGE_COL).values.filter(value => !isMissing(value))
    : [];

  return {
    type: 'histogram',
    title: 'Age Distribution',
    worldColor: validateScaleBalance(df) ? 'var(--color-success)' : 'var(--color-world-2)',
    minWidth: 320,
    height: 220,
    bins: 7,
    data: values,
    tooltipFormatter: bin => `${formatNumber(bin.start, 1)} to ${formatNumber(bin.end, 1)}: ${bin.count} rows`,
    ariaLabel: 'Histogram of Age values in the current dataset.',
  };
}

function salaryChartConfig(df) {
  const values = columnPresent(df, SALARY_COL)
    ? df.col(SALARY_COL).values.filter(value => !isMissing(value))
    : [];

  return {
    type: 'histogram',
    title: 'Salary Distribution',
    worldColor: validateScaleBalance(df)
      ? 'var(--color-success)'
      : validateSalaryOutlier(df)
        ? 'var(--color-world-5)'
        : 'var(--color-world-3)',
    minWidth: 320,
    height: 220,
    bins: 7,
    data: values,
    tooltipFormatter: bin => `${formatMoney(bin.start)} to ${formatMoney(bin.end)}: ${bin.count} rows`,
    ariaLabel: 'Histogram of Salary values in the current dataset.',
  };
}

function cityChartConfig(df) {
  const countMap = columnPresent(df, CITY_COL)
    ? df.col(CITY_COL).valueCounts(false)
    : Object.fromEntries(
      cityDummyCols(df).map(col => [col.replace(`${CITY_COL}_`, ''), df.col(col).values.reduce((sum, value) => sum + Number(value || 0), 0)])
    );

  const data = Object.entries(countMap)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, value]) => ({
      label,
      value,
      color: label === GROUPED_LABEL
        ? 'var(--color-world-4)'
        : label === MISSING_CITY
          ? 'var(--color-world-2)'
          : 'var(--color-world-6)',
    }));

  return {
    type: 'bar',
    title: columnPresent(df, CITY_COL) ? 'City Frequency Map' : 'City Dummy Totals',
    worldColor: 'var(--color-world-4)',
    minWidth: Math.max(520, data.length * 82),
    height: 250,
    data,
    valueFormatter: value => String(value),
    tooltipFormatter: item => `${item.label}: ${item.value} rows`,
    ariaLabel: 'Bar chart showing the current City distribution.',
  };
}

function stageState(stage, fixedIds, discoveredIds, inspected) {
  if (stage.id === 'discover') {
    return inspected ? 'done' : discoveredIds.size > 0 ? 'active' : 'pending';
  }

  const fixedCount = stage.taskIds.filter(taskId => fixedIds.has(taskId)).length;
  const discoveredCount = stage.taskIds.filter(taskId => discoveredIds.has(taskId)).length;

  if (fixedCount === stage.taskIds.length) return 'done';
  if (fixedCount > 0 || discoveredCount > 0) return 'active';
  return 'pending';
}

export default class World6Level5 {
  meta = {
    title: LEVEL_TITLE,
    subtitle: LEVEL_OBJECTIVE,
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._events = null;
    this._table = null;
    this._tableSourceDf = ORIGINAL_DF;
    this._editor = null;
    this._ageChart = null;
    this._salaryChart = null;
    this._cityChart = null;
    this._searchQuery = '';
    this._inspected = false;
    this._inspectionAwarded = false;
    this._discoveredTaskIds = new Set();
    this._fixedTaskIds = new Set();
    this._awardedTaskIds = new Set();
    this._mistakeRuns = 0;
    this._completed = false;
    this._summary = null;
    this._ui = {};
    this._tableBridge = {
      update: df => {
        if (df instanceof DataFrame) {
          this._tableSourceDf = df;
          this._renderExplorer();
        }
      },
      applyExecutionResult: result => {
        if (result?.status === 'ok' && result.df instanceof DataFrame) {
          this._tableSourceDf = result.df;
          this._renderExplorer();
        }
      },
    };
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w6-level w6-level--dataset screen-section" aria-label="World 6 Level 5">
        <div class="level-hero w6-final-hero" style="--world-color: var(--color-world-6);">
          <p class="eyebrow">World 6 - Final Dataset</p>
          <h1 class="level-hero__title">${escapeHtml(LEVEL_TITLE)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(LEVEL_OBJECTIVE)}
            The raw table looks realistic on purpose: some problems are missing, some are numeric, and some only reveal themselves when you inspect the city frequency map and the scale profile together.
          </p>
          <div class="action-row">
            <span class="status-box" id="w6-l5-progress">0 / ${TOTAL_TASKS} issue cards fixed</span>
            <span class="status-box" id="w6-l5-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w6-l5-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w6-l5-reset-btn" type="button">Reset Lab</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">05</span>
        </div>

        <div class="w6-final-layout">
          <div class="w6-final-left">
            <article class="panel w6-final-explorer">
              <div class="w6-level__panel-head">
                <div>
                  <p class="eyebrow">Dataset Explorer</p>
                  <h2 class="panel-title">Search the live table, sort the headers, and open column stats while the pipeline evolves</h2>
                </div>
                <p class="w6-level__microcopy">
                  Null cells already stand out subtly. The bigger traps are structural: the Salary spikes, the long City tail, and the scale mismatch that only becomes obvious after you profile the numeric columns.
                </p>
              </div>

              <div class="w6-final-snapshot" aria-label="Explorer Snapshot">
                <article class="w6-final-snapshot__card">
                  <span class="w6-final-snapshot__label">Visible Rows</span>
                  <strong class="w6-final-snapshot__value" id="w6-l5-visible-count">${ORIGINAL_DF.length} / ${ORIGINAL_DF.length}</strong>
                </article>
                <article class="w6-final-snapshot__card">
                  <span class="w6-final-snapshot__label">${escapeHtml(AGE_COL)} State</span>
                  <strong class="w6-final-snapshot__value" id="w6-l5-age-state" data-state="warning">${AGE_NULL_TOTAL} nulls</strong>
                </article>
                <article class="w6-final-snapshot__card">
                  <span class="w6-final-snapshot__label">${escapeHtml(CITY_COL)} State</span>
                  <strong class="w6-final-snapshot__value" id="w6-l5-city-state" data-state="warning">${RAW_CITY_CARDINALITY} labels</strong>
                </article>
                <article class="w6-final-snapshot__card">
                  <span class="w6-final-snapshot__label">${escapeHtml(SALARY_COL)} State</span>
                  <strong class="w6-final-snapshot__value" id="w6-l5-salary-state" data-state="warning">Max ${formatMoney(RAW_SALARY_MAX)}</strong>
                </article>
              </div>

              <div class="w6-final-search">
                <label class="w6-final-search__field">
                  <span class="w6-final-search__label">Search / filter rows</span>
                  <input id="w6-l5-search" class="w6-final-search__input" type="search" placeholder="Search a city, education level, date, or exact value..." autocomplete="off" />
                </label>
                <button class="btn btn--subtle btn--sm" id="w6-l5-search-clear" type="button">Clear</button>
              </div>

              <div class="w6-final-table-shell" id="w6-l5-table"></div>
            </article>

            <section class="panel w6-final-checklist" aria-label="Problem Checklist">
              <div class="w6-level__panel-head">
                <div>
                  <p class="eyebrow">Problem Checklist</p>
                  <h2 class="panel-title">Reveal the hidden issue cards, then move each one from identified to fixed</h2>
                </div>
                <p class="w6-level__microcopy">
                  Discovery commands unlock the real brief. Correct fixes flip the cards to Fixed and push dataset health toward 100%.
                </p>
              </div>

              <div class="action-row">
                <span class="status-box" id="w6-l5-found">0 / ${TOTAL_TASKS} found</span>
                <span class="status-box" id="w6-l5-fixed">0 / 0 fixed</span>
                <span class="status-box" id="w6-l5-checklist-status">Run the discovery commands to reveal the first issue cards.</span>
              </div>

              <div class="w6-final-task-grid" id="w6-l5-task-grid"></div>
            </section>
          </div>

          <div class="w6-final-right">
            <article class="panel w6-final-editor-panel">
              <div class="w6-level__panel-head">
                <div>
                  <p class="eyebrow">Code Editor</p>
                  <h2 class="panel-title">Use the full pandas-like toolkit, but only after the dataset tells you what is wrong</h2>
                </div>
                <p class="w6-level__microcopy">
                  The reference card is intentionally broad. The task sidebar stays quiet until you reveal the hidden issue cards from the checklist.
                </p>
              </div>

              <div class="w6-final-editor-shell" id="w6-l5-editor"></div>
            </article>

            <section class="panel w6-final-dashboard" aria-label="Progress Summary">
              <div class="w6-level__panel-head">
                <div>
                  <p class="eyebrow">Progress Summary</p>
                  <h2 class="panel-title">Found, fixed, and health-tracked like a production repair board</h2>
                </div>
                <p class="w6-level__microcopy">
                  The mini pipeline only lights up when the fixes land in a healthy order. Dataset health reflects what is currently fixed, not just what you have touched.
                </p>
              </div>

              <div class="w6-final-dashboard__health">
                <div class="w6-final-health-ring" id="w6-l5-health-ring" style="--health-progress:0%;">
                  <span id="w6-l5-health-value">0%</span>
                </div>
                <div class="w6-final-health-copy">
                  <p class="eyebrow">Dataset Health</p>
                  <p id="w6-l5-health-copy" class="w6-final-health-copy__text">No hidden issues are fixed yet.</p>
                </div>
              </div>

              <div class="w6-final-dashboard__stats">
                <article class="w6-final-dashboard__stat">
                  <span class="w6-final-dashboard__label">Problems Found</span>
                  <strong class="w6-final-dashboard__value" id="w6-l5-found-count">0 / ${TOTAL_TASKS}</strong>
                </article>
                <article class="w6-final-dashboard__stat">
                  <span class="w6-final-dashboard__label">Problems Fixed</span>
                  <strong class="w6-final-dashboard__value" id="w6-l5-fixed-count">0 / 0</strong>
                </article>
                <article class="w6-final-dashboard__stat">
                  <span class="w6-final-dashboard__label">Final Shape</span>
                  <strong class="w6-final-dashboard__value" id="w6-l5-shape-state">${ORIGINAL_DF.length} x ${ORIGINAL_DF.columns.length}</strong>
                </article>
              </div>

              <div class="w6-final-stage-list" id="w6-l5-stage-list"></div>
            </section>

            <section class="panel w6-final-charts" aria-label="Distribution Monitor">
              <div class="w6-level__panel-head">
                <div>
                  <p class="eyebrow">Distribution Monitor</p>
                  <h2 class="panel-title">Watch the missingness disappear, the Salary spike compress, and the City tail collapse</h2>
                </div>
                <p class="w6-level__microcopy">
                  These charts always reflect the full dataset, even when the explorer is filtered to a smaller search result set.
                </p>
              </div>

              <div class="w6-final-chart-grid">
                <article class="w6-final-chart-card">
                  <div class="w6-final-chart-card__stats">
                    <span class="w6-final-chart-card__chip" id="w6-l5-age-null-chip">${AGE_NULL_TOTAL} nulls</span>
                    <span class="w6-final-chart-card__chip" id="w6-l5-age-center-chip">Median ${formatNumber(AGE_MEDIAN, 1)}</span>
                  </div>
                  <div class="w6-final-chart-shell" id="w6-l5-age-chart"></div>
                </article>

                <article class="w6-final-chart-card">
                  <div class="w6-final-chart-card__stats">
                    <span class="w6-final-chart-card__chip" id="w6-l5-salary-cap-chip">Fence ${formatMoney(CLIPPED_SALARY_MAX)}</span>
                    <span class="w6-final-chart-card__chip" id="w6-l5-salary-max-chip">Max ${formatMoney(RAW_SALARY_MAX)}</span>
                  </div>
                  <div class="w6-final-chart-shell" id="w6-l5-salary-chart"></div>
                </article>

                <article class="w6-final-chart-card w6-final-chart-card--wide">
                  <div class="w6-final-chart-card__stats">
                    <span class="w6-final-chart-card__chip" id="w6-l5-city-tail-chip">${RARE_CITIES.length} rare labels</span>
                    <span class="w6-final-chart-card__chip" id="w6-l5-city-shape-chip">${RAW_CITY_CARDINALITY} labels before grouping</span>
                  </div>
                  <div class="w6-final-chart-shell" id="w6-l5-city-chart"></div>
                </article>
              </div>
            </section>

            <section class="card card--elevated w6-level__feedback" aria-live="polite">
              <p class="eyebrow">Coach Feed</p>
              <p id="w6-l5-feedback-text" class="w6-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
            </section>

            <section class="card w6-level__hint-box" id="w6-l5-hint-box" hidden>
              <p class="eyebrow">Hint</p>
              <p id="w6-l5-hint-text" class="w6-level__hint-copy"></p>
            </section>
          </div>
        </div>

        <section class="panel w6-final-report" id="w6-l5-summary" hidden aria-label="Data Pipeline Report">
          <div class="w6-level__panel-head">
            <div>
              <p class="eyebrow">Data Pipeline Report</p>
              <h2 class="panel-title">The raw dataset is now clean, compact, and model-ready for the lessons this game has taught</h2>
            </div>
            <p class="w6-level__microcopy">${escapeHtml(SUMMARY_COPY)}</p>
          </div>

          <div class="w6-final-report__grid">
            <article class="w6-final-report__card">
              <p class="w6-final-report__kicker">Missing Data</p>
              <h3 class="w6-final-report__title">Age and City repaired without hiding the truth</h3>
              <p class="w6-final-report__copy">${AGE_NULL_TOTAL} Age gaps were filled with the median ${formatNumber(AGE_MEDIAN, 1)}, and ${CITY_NULL_TOTAL} City gaps survived as the explicit "${MISSING_CITY}" category.</p>
            </article>
            <article class="w6-final-report__card">
              <p class="w6-final-report__kicker">Outliers</p>
              <h3 class="w6-final-report__title">Salary spikes kept, but clipped</h3>
              <p class="w6-final-report__copy">The three Salary spikes were capped at ${formatMoney(CLIPPED_SALARY_MAX)} instead of deleting valid rows, so the high earners stay in the dataset without dominating it.</p>
            </article>
            <article class="w6-final-report__card">
              <p class="w6-final-report__kicker">Encoding</p>
              <h3 class="w6-final-report__title">City tail compressed into a compact dummy block</h3>
              <p class="w6-final-report__copy">${RARE_CITIES.join(', ')} were grouped into "${GROUPED_LABEL}", then ${CITY_COL} widened into ${EXPECTED_CITY_DUMMY_COLS.length} dummy columns while preserving "${MISSING_CITY}" as its own signal.</p>
            </article>
            <article class="w6-final-report__card">
              <p class="w6-final-report__kicker">Scaling</p>
              <h3 class="w6-final-report__title">Age and Salary finally speak the same scale language</h3>
              <p class="w6-final-report__copy">${AGE_COL} and ${SALARY_COL} both finish with mean 0 and standard deviation 1, which prevents raw units from overpowering the downstream model.</p>
            </article>
          </div>

          <div class="w6-final-report__recipe">
            <p class="w6-final-report__label">Final Pipeline Recipe</p>
            <pre class="w6-final-report__code">df['Age'] = df['Age'].fillna(df['Age'].median())
df['City'] = df['City'].fillna('Missing')
Q1 = df['Salary'].quantile(0.25)
Q3 = df['Salary'].quantile(0.75)
IQR = Q3 - Q1
lower = Q1 - 1.5 * IQR
upper = Q3 + 1.5 * IQR
df['Salary'] = df['Salary'].clip(lower, upper)
df['City'] = df['City'].replace(0.05, 'Autres')
df = pd.get_dummies(df, columns=['City'])
df['Age'] = StandardScaler().fit_transform(df[['Age']])
df['Salary'] = StandardScaler().fit_transform(df[['Salary']])</pre>
          </div>

          <div class="action-row">
            <span class="status-box" id="w6-l5-summary-score">Waiting for the full repair</span>
            <button class="btn btn--primary" id="w6-l5-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w6-l5-progress');
    this._ui.status = container.querySelector('#w6-l5-status');
    this._ui.feedback = container.querySelector('#w6-l5-feedback-text');
    this._ui.hintBox = container.querySelector('#w6-l5-hint-box');
    this._ui.hintText = container.querySelector('#w6-l5-hint-text');
    this._ui.visibleCount = container.querySelector('#w6-l5-visible-count');
    this._ui.ageState = container.querySelector('#w6-l5-age-state');
    this._ui.cityState = container.querySelector('#w6-l5-city-state');
    this._ui.salaryState = container.querySelector('#w6-l5-salary-state');
    this._ui.searchInput = container.querySelector('#w6-l5-search');
    this._ui.searchClear = container.querySelector('#w6-l5-search-clear');
    this._ui.tableHost = container.querySelector('#w6-l5-table');
    this._ui.taskGrid = container.querySelector('#w6-l5-task-grid');
    this._ui.checklistStatus = container.querySelector('#w6-l5-checklist-status');
    this._ui.found = container.querySelector('#w6-l5-found');
    this._ui.fixed = container.querySelector('#w6-l5-fixed');
    this._ui.foundCount = container.querySelector('#w6-l5-found-count');
    this._ui.fixedCount = container.querySelector('#w6-l5-fixed-count');
    this._ui.shapeState = container.querySelector('#w6-l5-shape-state');
    this._ui.healthRing = container.querySelector('#w6-l5-health-ring');
    this._ui.healthValue = container.querySelector('#w6-l5-health-value');
    this._ui.healthCopy = container.querySelector('#w6-l5-health-copy');
    this._ui.stageList = container.querySelector('#w6-l5-stage-list');
    this._ui.editorHost = container.querySelector('#w6-l5-editor');
    this._ui.ageChartHost = container.querySelector('#w6-l5-age-chart');
    this._ui.salaryChartHost = container.querySelector('#w6-l5-salary-chart');
    this._ui.cityChartHost = container.querySelector('#w6-l5-city-chart');
    this._ui.ageNullChip = container.querySelector('#w6-l5-age-null-chip');
    this._ui.ageCenterChip = container.querySelector('#w6-l5-age-center-chip');
    this._ui.salaryCapChip = container.querySelector('#w6-l5-salary-cap-chip');
    this._ui.salaryMaxChip = container.querySelector('#w6-l5-salary-max-chip');
    this._ui.cityTailChip = container.querySelector('#w6-l5-city-tail-chip');
    this._ui.cityShapeChip = container.querySelector('#w6-l5-city-shape-chip');
    this._ui.summary = container.querySelector('#w6-l5-summary');
    this._ui.summaryScore = container.querySelector('#w6-l5-summary-score');
    this._ui.finishButton = container.querySelector('#w6-l5-finish-btn');

    this._mountEditor();
    this._mountCharts();
    this._renderExplorer();
    this._syncEditorTasks();
    this._syncChecklist();
    this._syncDashboard();
    this._syncSummaryState();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w6-l5-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w6-l5-reset-btn') || event.target.closest('.editor-reset')) {
        this._resetLab();
        return;
      }

      if (event.target.closest('#w6-l5-search-clear')) {
        this._clearSearch();
        return;
      }

      if (event.target.closest('#w6-l5-finish-btn')) {
        if (this._completed && this._summary) {
          if (typeof this._engine.completeCodeLevel === 'function') {
            void this._engine.completeCodeLevel(this._summary);
          } else if (typeof this._engine.complete === 'function') {
            void this._engine.complete();
          }
        }
      }
    }, { signal });

    this._ui.searchInput?.addEventListener('input', event => {
      this._searchQuery = event.target.value;
      this._renderExplorer();
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
    this._ageChart?.destroy();
    this._salaryChart?.destroy();
    this._cityChart?.destroy();
    this._table = null;
    this._editor = null;
    this._ageChart = null;
    this._salaryChart = null;
    this._cityChart = null;
    this._ui = {};
    this._discoveredTaskIds.clear();
    this._fixedTaskIds.clear();
    this._awardedTaskIds.clear();
  }

  _mountEditor() {
    this._editor?.destroy();
    this._ui.editorHost.innerHTML = '';
    this._editor = new CodeEditorWidget(this._ui.editorHost, {
      df: ORIGINAL_DF,
      initialCode: INITIAL_CODE,
      reference: REFERENCE,
      tasks: [],
      emptyTaskMessage: 'Reveal issue cards from the dataset checklist to populate this tracker.',
      table: this._tableBridge,
      worldColor: 'var(--color-world-6)',
      onRun: summary => this._handleRun(summary),
    });
  }

  _mountCharts() {
    this._ageChart?.destroy();
    this._salaryChart?.destroy();
    this._cityChart?.destroy();

    this._ageChart = new ChartWidget(this._ui.ageChartHost, ageChartConfig(this._tableSourceDf));
    this._salaryChart = new ChartWidget(this._ui.salaryChartHost, salaryChartConfig(this._tableSourceDf));
    this._cityChart = new ChartWidget(this._ui.cityChartHost, cityChartConfig(this._tableSourceDf));
  }

  _handleRun(summary) {
    const hasError = summary.results.some(result => result.status === 'error');
    const changedData = summary.results.some(resultMutatesData);
    const revealedThisRun = discoveredTaskIdsFromRun(summary);
    const newlyRevealedIds = [...revealedThisRun].filter(taskId => !this._discoveredTaskIds.has(taskId));
    const nextFixedIds = new Set(taskIdsPassingForDf(summary.df));
    const newlyFixedIds = [...nextFixedIds].filter(taskId => !this._awardedTaskIds.has(taskId));
    const inspectionThisRun = inspectionUnlocked(summary) && !this._inspected;
    const solvedNow = validateFinalSolution(summary.df);

    if (inspectionThisRun) {
      this._inspected = true;
      if (!this._inspectionAwarded) {
        this._inspectionAwarded = true;
        this._engine.correct();
      }
    }

    revealedThisRun.forEach(taskId => this._discoveredTaskIds.add(taskId));
    this._fixedTaskIds = nextFixedIds;
    this._tableSourceDf = summary.df instanceof DataFrame ? summary.df : this._tableSourceDf;

    this._syncEditorTasks();
    this._renderExplorer();
    this._syncChecklist();
    this._syncDashboard();
    this._syncCharts(summary.df);

    if (hasError) {
      this._mistakeRuns += 1;
      this._engine.mistake({ costsLife: false, countsMistake: true });
      this._setFeedback('The interpreter hit an error. Stay close to the reference card, especially for the IQR arithmetic and the exact StandardScaler syntax.');
      this._setStatus('Execution error. Reset if the dataset drifted into a state that no longer matches the 100-row repair target.');
      return;
    }

    if (newlyFixedIds.length) {
      newlyFixedIds.forEach(taskId => {
        this._awardedTaskIds.add(taskId);
        this._engine.correct();
        this._flashTaskColumn(taskId);
      });

      this._handleMilestone(newlyRevealedIds, newlyFixedIds, summary.df);
      this._syncChecklist();
      this._syncDashboard();

      if (validateFinalSolution(summary.df)) {
        this._completeRun();
      }
      return;
    }

    if (solvedNow) {
      this._setFeedback('All six hidden issues are fixed. The final dataset matches the clean production recipe again.');
      this._setStatus('Dataset health is 100%. Review the final pipeline report, then continue.');
      this._completeRun();
      return;
    }

    if (newlyRevealedIds.length || inspectionThisRun) {
      this._handleDiscovery(newlyRevealedIds);
      this._syncChecklist();
      this._syncDashboard();
      return;
    }

    if (changedData) {
      this._mistakeRuns += 1;
      this._engine.mistake({ costsLife: false, countsMistake: true });
      this._handleNonPassingMutation(summary.df);
      return;
    }

    this._handleSafeExploration(summary);
  }

  _handleMilestone(newlyRevealedIds, newlyFixedIds, df) {
    if (newlyRevealedIds.length && !newlyFixedIds.length) {
      this._handleDiscovery(newlyRevealedIds);
      return;
    }

    if (newlyFixedIds.length === 1) {
      const task = TASK_BY_ID.get(newlyFixedIds[0]);
      this._setFeedback(`${task.title} is fixed. ${taskCopy(task.id, 'fixed', df)}`);
    } else if (newlyFixedIds.length > 1) {
      this._setFeedback(`${newlyFixedIds.map(taskId => TASK_BY_ID.get(taskId)?.title).join(' + ')} locked in on the same run.`);
    }

    if (validateFinalSolution(df)) {
      this._setStatus('All six hidden issues are fixed. Review the pipeline report below, then continue.');
      return;
    }

    this._setStatus(nextObjective(this._fixedTaskIds, this._discoveredTaskIds, this._inspected));
  }

  _handleDiscovery(newlyRevealedIds) {
    if (!newlyRevealedIds.length) {
      this._setFeedback('Safe inspection run. Keep reading the null counts, city frequencies, and numeric profile until the hidden cards reveal themselves.');
      this._setStatus(nextObjective(this._fixedTaskIds, this._discoveredTaskIds, this._inspected));
      return;
    }

    const titles = newlyRevealedIds.map(taskId => TASK_BY_ID.get(taskId)?.title ?? taskId);
    this._setFeedback(`Discovery sweep complete: ${titles.join(' + ')} revealed.`);
    this._setStatus(nextObjective(this._fixedTaskIds, this._discoveredTaskIds, this._inspected));
  }

  _handleSafeExploration(summary) {
    if (summary.results.some(result => result.sideEffect?.type === 'info' || result.sideEffect?.type === 'head' || result.sideEffect?.type === 'tail')) {
      this._setFeedback('Good warmup. The table is still intact, but the real issue cards reveal themselves fastest through null counts, describe(), City frequencies, and dtypes.');
      this._setStatus(nextObjective(this._fixedTaskIds, this._discoveredTaskIds, this._inspected));
      return;
    }

    this._setFeedback('The run was safe, but it did not reveal or fix anything new. Compare the dataset clues against the checklist and the reference card.');
    this._setStatus(nextObjective(this._fixedTaskIds, this._discoveredTaskIds, this._inspected));
  }

  _handleNonPassingMutation(df) {
    if (!(df instanceof DataFrame)) {
      this._setFeedback('The dataset changed, but the resulting table could not be verified. Reset and replay the repair path step by step.');
      this._setStatus('Reset recommended. Keep the dataset shape readable while you work through the fixes.');
      return;
    }

    if (df.length !== ORIGINAL_DF.length) {
      this._setFeedback('This final lab never wants row deletion. Keep all 100 examples and repair the bad values instead of filtering customers away.');
      this._setStatus('Reset recommended. The correct solution keeps all 100 rows.');
      return;
    }

    if (!protectedColumnsIntact(df)) {
      this._setFeedback(`${EDUCATION_COL}, ${PURCHASE_COL}, and ${JOIN_COL} are not part of the hidden-fix brief. Reset and leave those columns untouched while you repair Age, Salary, and City.`);
      this._setStatus('Reset recommended. Only the hidden issue columns should change in this level.');
      return;
    }

    if (columnPresent(df, AGE_COL) && !validateAgeRepair(df) && !validateScaleBalance(df) && df.col(AGE_COL).nullCount() !== AGE_NULL_TOTAL) {
      this._setFeedback(`${AGE_COL} changed, but the repair does not match the median path. Fill the gaps with ${formatNumber(AGE_MEDIAN, 1)} before you standardize the column.`);
      this._setStatus(`No issue card advanced. ${AGE_COL} should use the median repair before scaling.`);
      return;
    }

    if (columnPresent(df, CITY_COL) && !validateCityRepair(df) && df.col(CITY_COL).nullCount() !== CITY_NULL_TOTAL) {
      this._setFeedback(`${CITY_COL} changed, but the missing rows are not preserved as the explicit "${MISSING_CITY}" category yet.`);
      this._setStatus(`No issue card advanced. ${CITY_COL} should keep missingness visible before encoding.`);
      return;
    }

    if (columnPresent(df, SALARY_COL) && !validateSalaryOutlier(df) && df.col(SALARY_COL).max() < RAW_SALARY_MAX) {
      this._setFeedback(`${SALARY_COL} moved, but the outlier repair is off. Cap the three spikes with the IQR fences before you standardize Salary.`);
      this._setStatus(`No issue card advanced. ${SALARY_COL} should be clipped, not dropped or transformed too early.`);
      return;
    }

    if (cityDummyCols(df).length && !validateCityEncoding(df)) {
      this._setFeedback('City dummy columns appeared, but the final block is not correct yet. Group the rare labels into Autres before you call pd.get_dummies.');
      this._setStatus('No issue card advanced. The encoding block only locks after the grouped City vocabulary is correct.');
      return;
    }

    if (validateStandardizedColumn(df, AGE_COL, 0.15, 0.15) || validateStandardizedColumn(df, SALARY_COL, 0.15, 0.15)) {
      this._setFeedback('One numeric column is heading toward a z-score, but the full scale balance only locks when both Age and Salary are standardized after the earlier repairs.');
      this._setStatus('No issue card advanced. Finish the repair order before the final standardization pair.');
      return;
    }

    this._setFeedback('That run changed the dataset, but no hidden issue card advanced. Compare the current table against the checklist and reset if the pipeline order drifted.');
    this._setStatus('No issue card advanced. Keep the sequence clean: inspect -> impute -> cap -> group -> encode -> standardize.');
  }

  _completeRun() {
    if (this._completed) return;

    this._completed = true;
    const finalScript = String(this._editor?.code ?? '')
      .split('\n')
      .map(line => line.replace(/\s+$/g, ''))
      .join('\n')
      .trim();

    this._summary = {
      tasksCompleted: this._fixedTaskIds.size,
      totalTasks: TASKS.length,
      discoveredTasks: this._discoveredTaskIds.size,
      datasetHealth: 100,
      mistakeRuns: this._mistakeRuns,
      errorRuns: this._mistakeRuns,
      perfect: this._mistakeRuns === 0,
      finalColumns: [...this._tableSourceDf.columns],
      previewRows: this._tableSourceDf.head(10).toRows(),
      script: finalScript,
      exportFileName: 'dataforge_final_pipeline_solution.py',
    };

    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = `${this._fixedTaskIds.size} / ${TASKS.length} issue cards fixed`;
    }

    if (this._ui.summary) {
      this._ui.summary.hidden = false;
      requestAnimationFrame(() => {
        this._ui.summary.classList.add('is-revealed');
      });
      this._ui.summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    this._setFeedback(this._mistakeRuns === 0
      ? 'Perfect pipeline. You discovered every issue before fixing it, and the final dataset now matches a clean production-ready handoff.'
      : 'Mission complete. The final report below captures the clean repair order you can reuse whenever a real dataset arrives this messy.');
    this._setStatus('Dataset health is 100%. Review the final pipeline report, then continue.');
    this._syncSummaryState();
  }

  _resetLab() {
    this._searchQuery = '';
    this._tableSourceDf = ORIGINAL_DF;
    this._inspected = false;
    this._inspectionAwarded = false;
    this._discoveredTaskIds.clear();
    this._fixedTaskIds.clear();
    this._awardedTaskIds.clear();
    this._mistakeRuns = 0;
    this._completed = false;
    this._summary = null;

    if (this._ui.searchInput) {
      this._ui.searchInput.value = '';
    }

    this._editor?.setTasks([]);
    this._editor?.reset(ORIGINAL_DF);
    this._renderExplorer();
    this._syncEditorTasks();
    this._syncChecklist();
    this._syncDashboard();
    this._syncCharts(ORIGINAL_DF);
    this._syncSummaryState();

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

  _clearSearch() {
    this._searchQuery = '';
    if (this._ui.searchInput) {
      this._ui.searchInput.value = '';
      this._ui.searchInput.focus();
    }
    this._renderExplorer();
  }

  _renderExplorer() {
    const rows = filteredRows(this._tableSourceDf, this._searchQuery);
    const visibleCount = rows.length;
    const visibleDf = rows.length
      ? DataFrame.fromRows(rows, this._tableSourceDf.columns)
      : null;

    this._table?.destroy();
    this._table = null;
    this._ui.tableHost.innerHTML = '';

    if (visibleDf) {
      this._table = new DataTable(this._ui.tableHost, visibleDf, {
        showIndex: false,
        sortable: true,
        compact: true,
        pageSize: 12,
        worldColor: 'var(--color-world-6)',
        showStatsButtons: true,
      });
      this._decorateExplorerTable(visibleDf);
    } else {
      this._ui.tableHost.innerHTML = `
        <article class="w6-final-empty">
          <p class="eyebrow">No rows match</p>
          <p class="w6-final-empty__copy">Try a broader search term or clear the filter to bring the full dataset back.</p>
        </article>
      `;
    }

    this._syncSnapshot(visibleCount, this._tableSourceDf);
  }

  _decorateExplorerTable(explorerDf) {
    if (!this._table || !(explorerDf instanceof DataFrame)) return;

    if (this._discoveredTaskIds.has('age-null') && !this._fixedTaskIds.has('age-null') && explorerDf.columns.includes(AGE_COL)) {
      this._table.highlightColumn(AGE_COL, 'missing');
    }

    if (this._discoveredTaskIds.has('city-null') && !this._fixedTaskIds.has('city-null') && explorerDf.columns.includes(CITY_COL)) {
      this._table.highlightColumn(CITY_COL, 'missing');
    }

    if (this._discoveredTaskIds.has('salary-outlier') && !this._fixedTaskIds.has('salary-outlier') && explorerDf.columns.includes(SALARY_COL)) {
      this._table.highlightColumn(SALARY_COL, 'outlier');
      this._table.setOutlierMask(
        SALARY_COL,
        explorerDf.col(SALARY_COL).values.map(value => !isMissing(value) && value > CLIPPED_SALARY_MAX)
      );
    }

    if ((this._discoveredTaskIds.has('rare-city') || this._discoveredTaskIds.has('city-encode'))
      && !this._fixedTaskIds.has('city-encode')
      && explorerDf.columns.includes(CITY_COL)) {
      this._table.highlightColumn(CITY_COL, 'cardinality');
    }
  }

  _syncEditorTasks() {
    const discoveredTasks = TASKS
      .filter(task => this._discoveredTaskIds.has(task.id))
      .map(task => ({ label: task.label, validate: task.validate }));

    this._editor?.setTasks(discoveredTasks);
  }

  _syncCharts(df = this._tableSourceDf) {
    this._ageChart?.update(ageChartConfig(df));
    this._salaryChart?.update(salaryChartConfig(df));
    this._cityChart?.update(cityChartConfig(df));

    if (this._ui.ageNullChip) {
      const ageNulls = columnPresent(df, AGE_COL) ? df.col(AGE_COL).nullCount() : 0;
      this._ui.ageNullChip.textContent = `${ageNulls} nulls`;
    }

    if (this._ui.ageCenterChip) {
      this._ui.ageCenterChip.textContent = validateScaleBalance(df)
        ? 'mean 0 / std 1'
        : `Median ${formatNumber(AGE_MEDIAN, 1)}`;
    }

    if (this._ui.salaryCapChip) {
      this._ui.salaryCapChip.textContent = validateSalaryOutlier(df) || validateScaleBalance(df)
        ? `Capped ${formatMoney(CLIPPED_SALARY_MAX)}`
        : `Fence ${formatMoney(CLIPPED_SALARY_MAX)}`;
    }

    if (this._ui.salaryMaxChip) {
      const max = columnPresent(df, SALARY_COL) ? df.col(SALARY_COL).max() : RAW_SALARY_MAX;
      this._ui.salaryMaxChip.textContent = validateScaleBalance(df)
        ? 'mean 0 / std 1'
        : `Max ${formatMoney(max)}`;
    }

    if (this._ui.cityTailChip) {
      this._ui.cityTailChip.textContent = validateRareCityGrouping(df)
        ? `Tail grouped to ${GROUPED_LABEL}`
        : `${RARE_CITIES.length} rare labels`;
    }

    if (this._ui.cityShapeChip) {
      this._ui.cityShapeChip.textContent = validateCityEncoding(df)
        ? `${EXPECTED_CITY_DUMMY_COLS.length} dummies`
        : `${columnPresent(df, CITY_COL) ? df.col(CITY_COL).nunique() : cityDummyCols(df).length} labels`;
    }
  }

  _syncSnapshot(visibleCount, df) {
    const age = ageState(df);
    const city = cityState(df);
    const salary = salaryState(df);

    if (this._ui.visibleCount) {
      this._ui.visibleCount.textContent = `${visibleCount} / ${ORIGINAL_DF.length}`;
    }

    if (this._ui.ageState) {
      this._ui.ageState.textContent = age.label;
      this._ui.ageState.dataset.state = age.tone;
    }

    if (this._ui.cityState) {
      this._ui.cityState.textContent = city.label;
      this._ui.cityState.dataset.state = city.tone;
    }

    if (this._ui.salaryState) {
      this._ui.salaryState.textContent = salary.label;
      this._ui.salaryState.dataset.state = salary.tone;
    }
  }

  _syncChecklist() {
    const discoveredCount = this._discoveredTaskIds.size;
    const fixedCount = this._fixedTaskIds.size;
    const visibleSlots = visibleTaskSlots(discoveredCount);
    const cards = TASKS.slice(0, visibleSlots).map(task => {
      const state = taskState(task.id, this._tableSourceDf, this._discoveredTaskIds, this._fixedTaskIds);
      if (state === 'hidden') {
        return `
          <article class="w6-final-task-card w6-final-task-card--placeholder" data-task-state="hidden">
            <div class="w6-final-task-card__meta">
              <span class="w6-final-task-card__badge">?</span>
              <span class="w6-final-task-card__status">Unidentified</span>
            </div>
            <h3 class="w6-final-task-card__title">Unknown issue</h3>
            <p class="w6-final-task-card__copy">Inspect the dataset to reveal what belongs in this slot.</p>
          </article>
        `;
      }

      return `
        <article class="w6-final-task-card" data-task-state="${state}" style="--task-color:${task.worldColor};">
          <div class="w6-final-task-card__meta">
            <span class="w6-final-task-card__badge">${task.worldCode}</span>
            <span class="w6-final-task-card__status">${state === 'fixed' ? 'Fixed' : state === 'progress' ? 'In Progress' : 'Identified'}</span>
          </div>
          <h3 class="w6-final-task-card__title">${escapeHtml(task.title)}</h3>
          <p class="w6-final-task-card__world">${escapeHtml(task.worldLabel)}</p>
          <p class="w6-final-task-card__copy">${escapeHtml(taskCopy(task.id, state, this._tableSourceDf))}</p>
        </article>
      `;
    }).join('');

    if (this._ui.taskGrid) {
      this._ui.taskGrid.innerHTML = cards;
    }

    if (this._ui.found) {
      this._ui.found.textContent = `${discoveredCount} / ${TASKS.length} found`;
    }

    if (this._ui.fixed) {
      this._ui.fixed.textContent = discoveredCount
        ? `${fixedCount} / ${discoveredCount} fixed`
        : '0 / 0 fixed';
    }

    if (this._ui.checklistStatus) {
      this._ui.checklistStatus.textContent = nextObjective(this._fixedTaskIds, this._discoveredTaskIds, this._inspected);
    }
  }

  _syncDashboard() {
    const discoveredCount = this._discoveredTaskIds.size;
    const fixedCount = this._fixedTaskIds.size;
    const health = Math.round((fixedCount / TASKS.length) * 100);

    if (this._ui.progress) {
      this._ui.progress.textContent = `${fixedCount} / ${TASKS.length} issue cards fixed`;
    }

    if (this._ui.foundCount) {
      this._ui.foundCount.textContent = `${discoveredCount} / ${TASKS.length}`;
    }

    if (this._ui.fixedCount) {
      this._ui.fixedCount.textContent = discoveredCount
        ? `${fixedCount} / ${discoveredCount}`
        : '0 / 0';
    }

    if (this._ui.shapeState) {
      this._ui.shapeState.textContent = `${this._tableSourceDf.length} x ${this._tableSourceDf.columns.length}`;
    }

    if (this._ui.healthRing) {
      this._ui.healthRing.style.setProperty('--health-progress', `${health}%`);
    }

    if (this._ui.healthValue) {
      this._ui.healthValue.textContent = formatPercent(health, 0);
    }

    if (this._ui.healthCopy) {
      this._ui.healthCopy.textContent = health === 100
        ? 'Every hidden issue is fixed and the final dataset is stable.'
        : discoveredCount === 0
          ? 'No hidden issues are fixed yet.'
          : `${fixedCount} issue cards are fixed. ${TASKS.length - fixedCount} still need attention.`;
    }

    if (this._ui.stageList) {
      this._ui.stageList.innerHTML = STAGES.map(stage => {
        const state = stageState(stage, this._fixedTaskIds, this._discoveredTaskIds, this._inspected);
        return `
          <article class="w6-final-stage-card" data-stage-state="${state}" style="--stage-color:${stage.color};">
            <div class="w6-final-stage-card__meta">
              <span class="w6-final-stage-card__badge">${stage.badge}</span>
              <span class="w6-final-stage-card__status">${state === 'done' ? 'Done' : state === 'active' ? 'Active' : 'Pending'}</span>
            </div>
            <h3 class="w6-final-stage-card__title">${escapeHtml(stage.label)}</h3>
            <p class="w6-final-stage-card__copy">${escapeHtml(stage.copy)}</p>
          </article>
        `;
      }).join('');
    }
  }

  _syncSummaryState() {
    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = this._completed
        ? `${this._fixedTaskIds.size} / ${TASKS.length} issue cards fixed`
        : 'Waiting for the full repair';
    }
  }

  _setFeedback(text) {
    if (this._ui.feedback) {
      this._ui.feedback.textContent = text;
    }
  }

  _setStatus(text) {
    if (this._ui.status) {
      this._ui.status.textContent = text;
    }
  }

  _flashTaskColumn(taskId) {
    if (!this._table) return;

    if (taskId === 'age-null' && this._table.columns.includes(AGE_COL)) {
      this._table.flashColumn(AGE_COL, 'green');
    }

    if (taskId === 'city-null' && this._table.columns.includes(CITY_COL)) {
      this._table.flashColumn(CITY_COL, 'green');
    }

    if (taskId === 'salary-outlier' && this._table.columns.includes(SALARY_COL)) {
      this._table.flashColumn(SALARY_COL, 'green');
    }

    if (taskId === 'rare-city' && this._table.columns.includes(CITY_COL)) {
      this._table.flashColumn(CITY_COL, 'green');
    }

    if (taskId === 'city-encode') {
      const firstDummy = EXPECTED_CITY_DUMMY_COLS.find(col => this._table.columns.includes(col));
      if (firstDummy) {
        this._table.flashColumn(firstDummy, 'green');
      }
    }

    if (taskId === 'scale-balance') {
      if (this._table.columns.includes(AGE_COL)) this._table.flashColumn(AGE_COL, 'green');
      if (this._table.columns.includes(SALARY_COL)) this._table.flashColumn(SALARY_COL, 'green');
    }
  }
}
