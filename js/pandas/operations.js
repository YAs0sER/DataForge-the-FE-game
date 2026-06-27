/**
 * DataForge — Operations
 *
 * High-level, pandas-flavoured operation functions that wrap the DataFrame /
 * Series primitives.  Each function accepts a DataFrame (and arguments) and
 * returns either:
 *   • a new DataFrame  (transformations)
 *   • a plain result object / string  (queries / stats)
 *
 * These are the building blocks consumed by interpreter.js to execute
 * player-typed commands.  They are also importable directly for unit tests
 * and level-validation logic.
 *
 * Naming convention mirrors the pandas commands shown in the game's
 * command-reference cards so players can reason about what each call does.
 *
 * ─── Table of contents ────────────────────────────────────────────────────
 *  1.  Exploration / info          (info, describe, dtypes, isnullSum, head, tail)
 *  2.  Missing-value operations    (fillna, fillnaAll, addMissingIndicator)
 *  3.  Outlier operations          (iqrFences, removeOutliers, clipOutliers, log1p)
 *  4.  Encoding operations         (getDummies, labelEncode, frequencyEncode,
 *                                   groupRareCategories)
 *  5.  Scaling operations          (minMaxScale, standardize, logTransform)
 *  6.  General column helpers      (dropColumn, selectColumns, renameColumn,
 *                                   assignColumn, filterRows)
 *  7.  Pipeline composition        (applyPipeline)
 *  8.  Output formatters           (formatDescribe, formatIsnullSum, formatDtypes,
 *                                   formatValueCounts, formatInfo)
 * ──────────────────────────────────────────────────────────────────────────
 */

'use strict';

import { DataFrame, Series, isMissing } from './dataframe.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. EXPLORATION / INFO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the df.info() summary string (column list, non-null counts, dtypes).
 * Mirrors: df.info()
 *
 * @param   {DataFrame} df
 * @returns {string}
 */
export function info(df) {
  return df.info();
}

/**
 * Returns a describe() result object for all columns.
 * Mirrors: df.describe()
 *
 * @param   {DataFrame} df
 * @returns {Object}  { colName: { count, mean, std, min, 25%, 50%, 75%, max } }
 */
export function describe(df) {
  return df.describe();
}

/**
 * Returns column → dtype mapping.
 * Mirrors: df.dtypes
 *
 * @param   {DataFrame} df
 * @returns {Object}  { colName: 'int'|'float'|'string' }
 */
export function dtypes(df) {
  return df.dtypes();
}

/**
 * Returns column → null-count mapping.
 * Mirrors: df.isnull().sum()
 *
 * @param   {DataFrame} df
 * @returns {Object}  { colName: number }
 */
export function isnullSum(df) {
  return df.isnullSum();
}

/**
 * Returns the first n rows as a new DataFrame.
 * Mirrors: df.head(n)
 *
 * @param   {DataFrame} df
 * @param   {number}    [n=5]
 * @returns {DataFrame}
 */
export function head(df, n = 5) {
  return df.head(n);
}

/**
 * Returns the last n rows as a new DataFrame.
 * Mirrors: df.tail(n)
 *
 * @param   {DataFrame} df
 * @param   {number}    [n=5]
 * @returns {DataFrame}
 */
export function tail(df, n = 5) {
  return df.tail(n);
}

/**
 * Returns value counts for a single column.
 * Mirrors: df['col'].value_counts()  /  df['col'].value_counts(normalize=True)
 *
 * @param   {DataFrame} df
 * @param   {string}    colName
 * @param   {boolean}   [normalize=false]
 * @returns {Object}  { value: count|proportion }
 */
export function valueCounts(df, colName, normalize = false) {
  return df.col(colName).valueCounts(normalize);
}

/**
 * Returns a single quantile value for a column.
 * Mirrors: df['col'].quantile(q)
 *
 * @param   {DataFrame} df
 * @param   {string}    colName
 * @param   {number}    q  0–1
 * @returns {number}
 */
export function quantile(df, colName, q) {
  return df.col(colName).quantile(q);
}

/**
 * Returns the skewness of a column (Fisher–Pearson coefficient).
 * Mirrors: df['col'].skew()
 *
 * @param   {DataFrame} df
 * @param   {string}    colName
 * @returns {number}
 */
export function skew(df, colName) {
  return df.col(colName).skew();
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. MISSING-VALUE OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fill missing values in a single column.
 * Mirrors: df['col'].fillna(value)
 *          df['col'].fillna(df['col'].mean())
 *          df['col'].fillna(df['col'].median())
 *          df['col'].fillna('Missing')
 *
 * @param   {DataFrame}       df
 * @param   {string}          colName
 * @param   {number|string}   value   Scalar, or 'mean'|'median'|'mode'
 * @returns {DataFrame}
 */
export function fillna(df, colName, value) {
  return df.fillna(colName, value);
}

/**
 * Fill missing values in every column simultaneously using a strategy map.
 * Useful for pipeline steps that need to impute several columns at once.
 *
 * @param   {DataFrame} df
 * @param   {Object}    strategyMap  { colName: value|'mean'|'median'|'mode' }
 * @returns {DataFrame}
 *
 * @example
 * fillnaAll(df, { Age: 'median', City: 'Missing', Salary: 'mean' })
 */
export function fillnaAll(df, strategyMap) {
  let result = df;
  for (const [col, value] of Object.entries(strategyMap)) {
    result = result.fillna(col, value);
  }
  return result;
}

/**
 * Add a binary missing-indicator column (1 = was missing, 0 = not missing).
 * The new column is named `${colName}_missing`.
 * Mirrors: df['col_missing'] = df['col'].isnull().astype(int)
 *
 * @param   {DataFrame} df
 * @param   {string}    colName
 * @returns {DataFrame}
 */
export function addMissingIndicator(df, colName) {
  return df.addMissingIndicator(colName);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. OUTLIER OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute IQR-based fence values for a column.
 * Returns a plain stats object — does NOT modify the DataFrame.
 * Mirrors: the manual calculation block shown in W3-L2.
 *
 * @param   {DataFrame} df
 * @param   {string}    colName
 * @param   {number}    [multiplier=1.5]
 * @returns {{ Q1: number, Q3: number, IQR: number, lower: number, upper: number }}
 */
export function iqrFences(df, colName, multiplier = 1.5) {
  return df.iqrFences(colName, multiplier);
}

/**
 * Remove (suppress) rows where colName falls outside IQR fences.
 * Mirrors: df = df[df['col'] <= upper]  (combined with lower bound)
 *
 * @param   {DataFrame} df
 * @param   {string}    colName
 * @param   {number}    [multiplier=1.5]
 * @returns {DataFrame}
 */
export function removeOutliers(df, colName, multiplier = 1.5) {
  const { lower, upper } = df.iqrFences(colName, multiplier);
  return df.removeOutliers(colName, lower, upper);
}

/**
 * Cap (Winsorise) a column's values at the IQR fences in-place on a new DataFrame.
 * Mirrors: df['col'] = df['col'].clip(lower, upper)
 *
 * @param   {DataFrame} df
 * @param   {string}    colName
 * @param   {number}    [multiplier=1.5]
 * @returns {DataFrame}
 */
export function clipOutliers(df, colName, multiplier = 1.5) {
  const { lower, upper } = df.iqrFences(colName, multiplier);
  return df.clip(colName, lower, upper);
}

/**
 * Clip a column to explicit [lower, upper] bounds (manual fences).
 * Mirrors: df['col'] = df['col'].clip(lower, upper)
 *
 * @param   {DataFrame} df
 * @param   {string}    colName
 * @param   {number}    lower
 * @param   {number}    upper
 * @returns {DataFrame}
 */
export function clip(df, colName, lower, upper) {
  return df.clip(colName, lower, upper);
}

/**
 * Apply log1p (log(x + 1)) transform to a column.
 * Suitable for right-skewed, non-negative data (salaries, counts, etc.).
 * Mirrors: df['col'] = np.log1p(df['col'])
 *
 * @param   {DataFrame} df
 * @param   {string}    colName
 * @returns {DataFrame}
 */
export function log1p(df, colName) {
  return df.log1p(colName);
}

/**
 * Returns a boolean mask Series indicating which rows in colName are outliers
 * according to the IQR method.  Useful for visualization layers that need to
 * highlight specific cells in the table widget.
 *
 * @param   {DataFrame} df
 * @param   {string}    colName
 * @param   {number}    [multiplier=1.5]
 * @returns {boolean[]}  Array of booleans (true = outlier), length === df.length
 */
export function outlierMask(df, colName, multiplier = 1.5) {
  const { lower, upper } = df.iqrFences(colName, multiplier);
  return df.col(colName).values.map(v => {
    if (isMissing(v)) return false;
    return v < lower || v > upper;
  });
}

/**
 * Returns a boolean mask Series indicating which rows are z-score outliers.
 * A value is flagged if |z| > threshold (default 3).
 *
 * @param   {DataFrame} df
 * @param   {string}    colName
 * @param   {number}    [threshold=3]
 * @returns {boolean[]}
 */
export function zScoreOutlierMask(df, colName, threshold = 3) {
  const s   = df.col(colName);
  const mu  = s.mean();
  const sig = s.std();
  return s.values.map(v => {
    if (isMissing(v) || sig === 0) return false;
    return Math.abs((v - mu) / sig) > threshold;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ENCODING OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One-hot encode a categorical column.
 * The original column is dropped; binary dummy columns are appended.
 * Mirrors: pd.get_dummies(df, columns=['col'])
 *
 * @param   {DataFrame} df
 * @param   {string}    colName
 * @param   {boolean}   [dropFirst=false]  Drop first category (avoids dummy trap).
 * @param   {string}    [prefix]           Column-name prefix; defaults to colName.
 * @returns {DataFrame}
 */
export function getDummies(df, colName, dropFirst = false, prefix = null) {
  return df.getDummies(colName, dropFirst, prefix);
}

/**
 * Label-encode a categorical column using a caller-supplied mapping.
 * Mirrors: df['col'] = df['col'].map({'a': 0, 'b': 1, ...})
 *
 * @param   {DataFrame} df
 * @param   {string}    colName
 * @param   {Object}    mapping  { categoryString: numericCode, ... }
 * @returns {DataFrame}
 *
 * @example
 * labelEncode(df, 'Education_Level', { Bac: 0, Licence: 1, Master: 2, Doctorat: 3 })
 */
export function labelEncode(df, colName, mapping) {
  return df.mapColumn(colName, mapping);
}

/**
 * Auto label-encode a categorical column by assigning integer codes in
 * alphabetical order.  Useful for ordinal columns where the player hasn't
 * supplied an explicit mapping.
 *
 * @param   {DataFrame} df
 * @param   {string}    colName
 * @returns {{ df: DataFrame, mapping: Object }}
 *          Returns both the new DataFrame and the generated mapping so the
 *          interpreter can display it to the player.
 */
export function autoLabelEncode(df, colName) {
  const unique = [...new Set(
    df.col(colName).values.filter(v => !isMissing(v)).map(String)
  )].sort();

  const mapping = {};
  unique.forEach((val, i) => { mapping[val] = i; });

  return { df: df.mapColumn(colName, mapping), mapping };
}

/**
 * Frequency-encode a categorical column.
 * Each category is replaced by its relative frequency (proportion) in the column.
 * Mirrors:
 *   freq = df['col'].value_counts(normalize=True)
 *   df['col'] = df['col'].map(freq)
 *
 * @param   {DataFrame} df
 * @param   {string}    colName
 * @returns {{ df: DataFrame, freqMap: Object }}
 *          Returns the new DataFrame and the frequency map for display.
 */
export function frequencyEncode(df, colName) {
  const freqMap = df.col(colName).valueCounts(true); // normalized = proportions
  return {
    df: df.mapColumn(colName, freqMap),
    freqMap,
  };
}

/**
 * Group rare categories into a single "Autres" (or custom) replacement label.
 * Categories whose relative frequency is below `threshold` are replaced.
 * Mirrors:
 *   threshold = 0.05
 *   rare = freq[freq < threshold].index
 *   df['col'] = df['col'].replace(rare, 'Autres')
 *
 * @param   {DataFrame} df
 * @param   {string}    colName
 * @param   {number}    [threshold=0.05]  Frequency below which a category is "rare".
 * @param   {string}    [replacement='Autres']
 * @returns {{ df: DataFrame, rareCategories: string[], originalCardinality: number, newCardinality: number }}
 */
export function groupRareCategories(df, colName, threshold = 0.05, replacement = 'Autres') {
  const freqMap           = df.col(colName).valueCounts(true);
  const originalCardinality = Object.keys(freqMap).length;
  const rareCategories    = Object.entries(freqMap)
    .filter(([, freq]) => freq < threshold)
    .map(([cat]) => cat);

  if (rareCategories.length === 0) {
    return {
      df,
      rareCategories: [],
      originalCardinality,
      newCardinality: originalCardinality,
    };
  }

  const newDf       = df.replace(colName, rareCategories, replacement);
  const newCardinality = newDf.col(colName).nunique();

  return { df: newDf, rareCategories, originalCardinality, newCardinality };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. SCALING OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Min-Max normalize a column to [0, 1].
 * Mirrors: scaler_mm = MinMaxScaler(); df['col_scaled'] = scaler_mm.fit_transform(df[['col']])
 *
 * @param   {DataFrame} df
 * @param   {string}    colName
 * @param   {string}    [suffix='_scaled']  Appended to produce the new column name.
 *                                          Pass '' to overwrite the original column.
 * @returns {DataFrame}
 */
export function minMaxScale(df, colName, suffix = '_scaled') {
  return df.minMaxScale(colName, suffix);
}

/**
 * Z-score standardise a column (mean=0, std=1).
 * Mirrors: scaler_std = StandardScaler(); df['col_scaled'] = scaler_std.fit_transform(df[['col']])
 *
 * @param   {DataFrame} df
 * @param   {string}    colName
 * @param   {string}    [suffix='_scaled']
 * @returns {DataFrame}
 */
export function standardize(df, colName, suffix = '_scaled') {
  return df.standardize(colName, suffix);
}

/**
 * Apply log1p transform as a scaling / distribution-correction step.
 * Alias of the outlier-section log1p but exposed here for the scaling
 * command-reference card in World 5.
 *
 * @param   {DataFrame} df
 * @param   {string}    colName
 * @returns {DataFrame}
 */
export function logTransform(df, colName) {
  return df.log1p(colName);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. GENERAL COLUMN HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drop one or more columns.
 * Mirrors: df.drop(columns=['col'])
 *
 * @param   {DataFrame}        df
 * @param   {string|string[]}  colNames
 * @returns {DataFrame}
 */
export function dropColumn(df, colNames) {
  const cols = Array.isArray(colNames) ? colNames : [colNames];
  return df.drop(...cols);
}

/**
 * Select (keep) only the specified columns.
 * Mirrors: df[['col1', 'col2']]
 *
 * @param   {DataFrame}  df
 * @param   {string[]}   colNames
 * @returns {DataFrame}
 */
export function selectColumns(df, colNames) {
  return df.select(...colNames);
}

/**
 * Rename a single column.
 *
 * @param   {DataFrame} df
 * @param   {string}    oldName
 * @param   {string}    newName
 * @returns {DataFrame}
 */
export function renameColumn(df, oldName, newName) {
  if (!df.columns.includes(oldName)) {
    throw new Error(`Column "${oldName}" not found.`);
  }
  const values = df.col(oldName).values;
  return df.drop(oldName).assign(newName, values);
}

/**
 * Assign (add or overwrite) a column with an array of values.
 * Mirrors: df['new_col'] = [...]
 *
 * @param   {DataFrame}  df
 * @param   {string}     colName
 * @param   {Array}      values
 * @returns {DataFrame}
 */
export function assignColumn(df, colName, values) {
  return df.assign(colName, values);
}

/**
 * Filter rows using a predicate function.
 * Mirrors: df[df['col'] > value]
 *
 * @param   {DataFrame}                          df
 * @param   {function(row: Object): boolean}     predicate
 * @returns {DataFrame}
 */
export function filterRows(df, predicate) {
  return df.filter(predicate);
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. PIPELINE COMPOSITION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply a sequence of operation functions to a DataFrame in order.
 * Each step is a { fn, args } descriptor where fn is any exported operation
 * from this module (or any compatible function) and args is an array of
 * additional arguments beyond the DataFrame.
 *
 * This is the engine behind W6-L3 "Pipeline Builder — Full Run."
 *
 * @param   {DataFrame}  df
 * @param   {Array<{ fn: function, args: Array, label?: string }>} steps
 * @returns {{ df: DataFrame, log: string[] }}
 *          Returns the final DataFrame and a human-readable log of each step.
 *
 * @example
 * applyPipeline(rawDf, [
 *   { fn: fillna,            args: ['Age', 'median'],               label: 'Impute Age (median)' },
 *   { fn: fillna,            args: ['City', 'Missing'],             label: 'Impute City (Missing category)' },
 *   { fn: clipOutliers,      args: ['Salary'],                      label: 'Cap Salary outliers (IQR)' },
 *   { fn: groupRareCategories, args: ['City', 0.05],                label: 'Group rare cities' },
 *   { fn: getDummies,        args: ['City'],                        label: 'One-Hot encode City' },
 *   { fn: minMaxScale,       args: ['Age', ''],                     label: 'Min-Max scale Age' },
 *   { fn: standardize,       args: ['Salary', ''],                  label: 'Z-score standardize Salary' },
 * ])
 */
export function applyPipeline(df, steps) {
  const log = [];
  let current = df;

  steps.forEach((step, i) => {
    const { fn, args = [], label } = step;
    const stepLabel = label ?? `Step ${i + 1}: ${fn.name}(${args.map(a => JSON.stringify(a)).join(', ')})`;
    try {
      const result = fn(current, ...args);
      // Some operations (frequencyEncode, groupRareCategories, autoLabelEncode)
      // return { df, ...metadata } instead of a bare DataFrame.
      current = result instanceof DataFrame ? result : result.df;
      log.push(`✓ ${stepLabel}`);
    } catch (err) {
      log.push(`✗ ${stepLabel} — ERROR: ${err.message}`);
      throw err; // re-throw so the interpreter can surface it
    }
  });

  return { df: current, log };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. OUTPUT FORMATTERS
//    These produce console-ready strings for the fake pandas REPL in the editor.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format describe() output as a readable table string.
 *
 * @param   {Object} describeResult  Result of describe(df).
 * @returns {string}
 */
export function formatDescribe(describeResult) {
  const cols   = Object.keys(describeResult);
  if (cols.length === 0) return '(empty)';

  // Gather all stat keys from the first column
  const statKeys = Object.keys(describeResult[cols[0]]);
  const colWidth = 12;
  const statWidth = 8;

  const header  = ''.padEnd(statWidth) + cols.map(c => c.slice(0, colWidth).padStart(colWidth)).join('');
  const divider = '-'.repeat(header.length);
  const lines   = [header, divider];

  for (const stat of statKeys) {
    let row = stat.padEnd(statWidth);
    for (const col of cols) {
      const val = describeResult[col][stat];
      const formatted = val == null ? 'NaN' : (typeof val === 'number' ? val.toFixed(2) : String(val));
      row += formatted.slice(0, colWidth).padStart(colWidth);
    }
    lines.push(row);
  }

  return lines.join('\n');
}

/**
 * Format isnullSum() output as a readable two-column table string.
 *
 * @param   {Object} isnullResult  { colName: nullCount }
 * @param   {number} totalRows
 * @returns {string}
 */
export function formatIsnullSum(isnullResult, totalRows) {
  const lines = ['Column               Null Count  % Missing'];
  lines.push('-'.repeat(42));
  for (const [col, count] of Object.entries(isnullResult)) {
    const pct = totalRows > 0 ? ((count / totalRows) * 100).toFixed(1) + '%' : 'N/A';
    lines.push(`${col.padEnd(20)} ${String(count).padStart(10)}  ${pct.padStart(9)}`);
  }
  const total = Object.values(isnullResult).reduce((a, b) => a + b, 0);
  lines.push('-'.repeat(42));
  lines.push(`${'TOTAL'.padEnd(20)} ${String(total).padStart(10)}`);
  return lines.join('\n');
}

/**
 * Format dtypes() output as a two-column list.
 *
 * @param   {Object} dtypesResult  { colName: dtype }
 * @returns {string}
 */
export function formatDtypes(dtypesResult) {
  const lines = ['Column               Dtype'];
  lines.push('-'.repeat(30));
  for (const [col, dtype] of Object.entries(dtypesResult)) {
    lines.push(`${col.padEnd(20)} ${dtype}`);
  }
  return lines.join('\n');
}

/**
 * Format valueCounts() output.
 *
 * @param   {Object}  countsResult  { value: count|proportion }
 * @param   {string}  colName
 * @param   {boolean} normalize
 * @returns {string}
 */
export function formatValueCounts(countsResult, colName, normalize = false) {
  const header = `${colName}`;
  const label  = normalize ? 'Frequency' : 'Count';
  const lines  = [`${header.padEnd(20)} ${label}`];
  lines.push('-'.repeat(32));
  for (const [val, count] of Object.entries(countsResult)) {
    const formatted = normalize ? count.toFixed(4) : String(count);
    lines.push(`${val.padEnd(20)} ${formatted}`);
  }
  return lines.join('\n');
}

/**
 * Format iqrFences() stats for console output.
 *
 * @param   {Object} fences  { Q1, Q3, IQR, lower, upper }
 * @param   {string} colName
 * @returns {string}
 */
export function formatIqrFences(fences, colName) {
  const { Q1, Q3, IQR, lower, upper } = fences;
  return [
    `IQR Fences — ${colName}`,
    `─────────────────────────`,
    `  Q1 (25th pct) : ${Q1.toFixed(4)}`,
    `  Q3 (75th pct) : ${Q3.toFixed(4)}`,
    `  IQR           : ${IQR.toFixed(4)}`,
    `  Lower fence   : ${lower.toFixed(4)}  (Q1 − 1.5 × IQR)`,
    `  Upper fence   : ${upper.toFixed(4)}  (Q3 + 1.5 × IQR)`,
  ].join('\n');
}

/**
 * Format groupRareCategories() result summary for console output.
 *
 * @param   {Object} result  Return value of groupRareCategories()
 * @param   {string} colName
 * @param   {string} replacement
 * @returns {string}
 */
export function formatGroupRare(result, colName, replacement) {
  const { rareCategories, originalCardinality, newCardinality } = result;
  if (rareCategories.length === 0) {
    return `No rare categories found in "${colName}" at the given threshold.`;
  }
  return [
    `Grouped rare categories in "${colName}":`,
    `  Replaced : ${rareCategories.join(', ')}`,
    `  With     : "${replacement}"`,
    `  Cardinality: ${originalCardinality} → ${newCardinality} unique values`,
  ].join('\n');
}

/**
 * Format a pipeline log (from applyPipeline) for console output.
 *
 * @param   {string[]} log
 * @returns {string}
 */
export function formatPipelineLog(log) {
  return ['Pipeline execution:', ...log].join('\n  ');
}
