/**
 * DataForge — DataFrame
 *
 * A JavaScript implementation of a pandas-like DataFrame.
 * Stores data as column-oriented arrays. All public methods return
 * new DataFrames (immutable style) unless the method name ends in
 * _inplace (mutates self). NaN is represented as the JS value NaN
 * for numeric columns and null for string columns — both are treated
 * as "missing" throughout the API.
 */

'use strict';

// ─── Sentinel ────────────────────────────────────────────────────────────────
// A single shared symbol used as the canonical "missing" value when we need
// to distinguish "deliberately missing" from undefined/0/false/empty-string.
const MISSING = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns true if a value should be considered missing/null.
 * Covers: null, undefined, NaN, the string 'NaN', and the string 'null'.
 */
function isMissing(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'number' && isNaN(v)) return true;
  if (typeof v === 'string' && (v === 'NaN' || v === 'null' || v === '')) return true;
  return false;
}

/**
 * Infers the dtype of an array of values: 'float', 'int', 'string', or 'mixed'.
 * Missing values are ignored during inference.
 */
function inferDtype(values) {
  const nonMissing = values.filter(v => !isMissing(v));
  if (nonMissing.length === 0) return 'float'; // all-null column defaults to float

  const allNumeric = nonMissing.every(v => typeof v === 'number' && !isNaN(v));
  if (!allNumeric) return 'string';

  const allInt = nonMissing.every(v => Number.isInteger(v));
  return allInt ? 'int' : 'float';
}

/**
 * Deep-copies a plain value (not objects/arrays — use cloneData for that).
 */
function copyValue(v) {
  return v; // primitives are already copied by value
}

/**
 * Creates a deep copy of the column store: { colName: [...values] }.
 */
function cloneData(data) {
  const out = {};
  for (const col of Object.keys(data)) {
    out[col] = [...data[col]];
  }
  return out;
}

// ─── Series ───────────────────────────────────────────────────────────────────

/**
 * A single column of data with a name and dtype.
 * Mostly used internally; returned by df.col(name) for chained operations.
 */
class Series {
  /**
   * @param {string} name
   * @param {Array}  values  Raw array — may contain null/NaN for missing.
   * @param {string} [dtype] 'int' | 'float' | 'string' | auto-inferred
   */
  constructor(name, values, dtype) {
    this.name   = name;
    this.values = [...values];
    this.dtype  = dtype ?? inferDtype(values);
    this.length = values.length;
  }

  // ── Null checks ──────────────────────────────────────────────────────────

  /** Returns a boolean Series: true where value is missing. */
  isnull() {
    return new Series(
      `${this.name}_isnull`,
      this.values.map(isMissing),
      'int'
    );
  }

  /** Count of missing values. */
  nullCount() {
    return this.values.filter(isMissing).length;
  }

  /** Count of non-missing values. */
  count() {
    return this.values.filter(v => !isMissing(v)).length;
  }

  // ── Numeric stats ─────────────────────────────────────────────────────────

  /** Array of non-missing numeric values. Throws if dtype is string. */
  _numericValues() {
    if (this.dtype === 'string') {
      throw new Error(`Series "${this.name}" is non-numeric (dtype: string).`);
    }
    return this.values.filter(v => !isMissing(v));
  }

  sum() {
    return this._numericValues().reduce((a, b) => a + b, 0);
  }

  mean() {
    const vals = this._numericValues();
    if (vals.length === 0) return NaN;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  median() {
    const vals = [...this._numericValues()].sort((a, b) => a - b);
    if (vals.length === 0) return NaN;
    const mid = Math.floor(vals.length / 2);
    return vals.length % 2 === 0
      ? (vals[mid - 1] + vals[mid]) / 2
      : vals[mid];
  }

  /** Sample standard deviation (ddof=1, matching pandas default). */
  std() {
    const vals = this._numericValues();
    if (vals.length < 2) return NaN;
    const m = this.mean();
    const variance = vals.reduce((acc, v) => acc + (v - m) ** 2, 0) / (vals.length - 1);
    return Math.sqrt(variance);
  }

  min() {
    const vals = this._numericValues();
    return vals.length === 0 ? NaN : Math.min(...vals);
  }

  max() {
    const vals = this._numericValues();
    return vals.length === 0 ? NaN : Math.max(...vals);
  }

  /**
   * Returns the value at a given quantile [0, 1] using linear interpolation.
   * Matches pandas default (linear method).
   * @param {number} q  0–1
   */
  quantile(q) {
    if (q < 0 || q > 1) throw new Error(`quantile must be between 0 and 1, got ${q}`);
    const vals = [...this._numericValues()].sort((a, b) => a - b);
    if (vals.length === 0) return NaN;
    if (vals.length === 1) return vals[0];

    const pos = q * (vals.length - 1);
    const lower = Math.floor(pos);
    const upper = Math.ceil(pos);
    const frac  = pos - lower;
    return vals[lower] + frac * (vals[upper] - vals[lower]);
  }

  /**
   * Pearson skewness: (mean - median) / std.
   * Returns NaN if std is 0 or not enough data.
   */
  skew() {
    const vals = this._numericValues();
    if (vals.length < 3) return NaN;
    const s = this.std();
    if (s === 0) return 0;
    // Adjusted Fisher–Pearson coefficient
    const m = this.mean();
    const n = vals.length;
    const cubic = vals.reduce((acc, v) => acc + ((v - m) / s) ** 3, 0);
    return (n / ((n - 1) * (n - 2))) * cubic;
  }

  // ── Value counts ─────────────────────────────────────────────────────────

  /**
   * Returns a plain object { value: count } sorted descending by count.
   * @param {boolean} [normalize=false]  If true, returns proportions.
   */
  valueCounts(normalize = false) {
    const counts = {};
    for (const v of this.values) {
      if (isMissing(v)) continue;
      const key = String(v);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    if (normalize) {
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      for (const k of Object.keys(counts)) counts[k] /= total;
    }
    // Sort descending
    return Object.fromEntries(
      Object.entries(counts).sort(([, a], [, b]) => b - a)
    );
  }

  /** Number of unique non-missing values. */
  nunique() {
    return new Set(this.values.filter(v => !isMissing(v)).map(String)).size;
  }

  // ── Transformations (return new Series) ───────────────────────────────────

  /**
   * Fill missing values.
   * @param {number|string} value  Scalar or 'mean'|'median'|'mode'
   */
  fillna(value) {
    let fillValue = value;
    if (value === 'mean')   fillValue = this.mean();
    if (value === 'median') fillValue = this.median();
    if (value === 'mode')   fillValue = this._mode();

    const newValues = this.values.map(v => isMissing(v) ? fillValue : v);
    return new Series(this.name, newValues, this.dtype);
  }

  /** @private */
  _mode() {
    const counts = this.valueCounts();
    const entries = Object.entries(counts);
    if (entries.length === 0) return null;
    return entries[0][0]; // already sorted descending, first is mode
  }

  /**
   * Clip values to [lower, upper]. Does not affect missing values.
   * @param {number} lower
   * @param {number} upper
   */
  clip(lower, upper) {
    const newValues = this.values.map(v =>
      isMissing(v) ? v : Math.min(Math.max(v, lower), upper)
    );
    return new Series(this.name, newValues, this.dtype === 'int' ? 'float' : this.dtype);
  }

  /**
   * log(x + 1) transform. Negative or missing values stay as-is.
   */
  log1p() {
    const newValues = this.values.map(v => {
      if (isMissing(v)) return v;
      if (v < -1) return NaN; // log of negative
      return Math.log(v + 1);
    });
    return new Series(this.name, newValues, 'float');
  }

  /**
   * Min-max normalization to [0, 1].
   */
  minMaxScale() {
    const xMin = this.min();
    const xMax = this.max();
    const range = xMax - xMin;
    const newValues = this.values.map(v => {
      if (isMissing(v)) return v;
      return range === 0 ? 0 : (v - xMin) / range;
    });
    return new Series(`${this.name}_scaled`, newValues, 'float');
  }

  /**
   * Z-score standardization: (x - mean) / std.
   */
  standardize() {
    const m = this.mean();
    const s = this.std();
    const newValues = this.values.map(v => {
      if (isMissing(v)) return v;
      return s === 0 ? 0 : (v - m) / s;
    });
    return new Series(`${this.name}_scaled`, newValues, 'float');
  }

  /**
   * Replace values using a mapping object.
   * @param {Object} mapping  { oldValue: newValue, ... }
   */
  map(mapping) {
    const newValues = this.values.map(v => {
      if (isMissing(v)) return v;
      const key = String(v);
      return key in mapping ? mapping[key] : v;
    });
    const newDtype = inferDtype(newValues);
    return new Series(this.name, newValues, newDtype);
  }

  /**
   * Replace specified values with a replacement.
   * @param {Array|string|number} targets  Value(s) to replace.
   * @param {*}                   replacement
   */
  replace(targets, replacement) {
    const targetSet = new Set(
      Array.isArray(targets) ? targets.map(String) : [String(targets)]
    );
    const newValues = this.values.map(v => {
      if (isMissing(v)) return v;
      return targetSet.has(String(v)) ? replacement : v;
    });
    return new Series(this.name, newValues, inferDtype(newValues));
  }

  /**
   * Cast to integer (0/1) — mainly for boolean series from isnull().
   */
  astype(dtype) {
    const converters = {
      int:    v => isMissing(v) ? v : Math.round(Number(v)),
      float:  v => isMissing(v) ? v : Number(v),
      string: v => isMissing(v) ? v : String(v),
    };
    const fn = converters[dtype];
    if (!fn) throw new Error(`Unknown dtype "${dtype}"`);
    return new Series(this.name, this.values.map(fn), dtype);
  }

  // ── Describe ─────────────────────────────────────────────────────────────

  /** Returns a summary stats object (mirrors pandas Series.describe()). */
  describe() {
    if (this.dtype === 'string') {
      return {
        count:  this.count(),
        unique: this.nunique(),
        top:    Object.keys(this.valueCounts())[0] ?? null,
        freq:   Object.values(this.valueCounts())[0] ?? 0,
      };
    }
    return {
      count:  this.count(),
      mean:   +this.mean().toFixed(4),
      std:    +this.std().toFixed(4),
      min:    this.min(),
      '25%':  +this.quantile(0.25).toFixed(4),
      '50%':  +this.quantile(0.50).toFixed(4),
      '75%':  +this.quantile(0.75).toFixed(4),
      max:    this.max(),
    };
  }

  // ── Utility ───────────────────────────────────────────────────────────────

  /** Returns a sorted copy of the values array (non-missing only). */
  sort(ascending = true) {
    const vals = [...this._numericValues()].sort((a, b) => ascending ? a - b : b - a);
    return new Series(this.name, vals, this.dtype);
  }

  /** Returns a plain array copy of values. */
  toArray() {
    return [...this.values];
  }

  toString() {
    const preview = this.values.slice(0, 5).map(v => isMissing(v) ? 'NaN' : v).join(', ');
    return `Series("${this.name}", [${preview}${this.length > 5 ? ', ...' : ''}], dtype=${this.dtype}, length=${this.length})`;
  }
}

// ─── DataFrame ────────────────────────────────────────────────────────────────

class DataFrame {
  /**
   * @param {Object} data  Column-oriented: { colName: [values...], ... }
   *                       All arrays must have the same length.
   */
  constructor(data = {}) {
    // Validate lengths are consistent
    const lengths = Object.values(data).map(arr => arr.length);
    if (lengths.length > 0) {
      const first = lengths[0];
      if (!lengths.every(l => l === first)) {
        throw new Error(
          `All columns must have the same length. Got: ${
            Object.entries(data).map(([k, v]) => `${k}:${v.length}`).join(', ')
          }`
        );
      }
    }

    /** @type {Object.<string, Array>} */
    this._data    = cloneData(data);
    this.columns  = Object.keys(this._data);
    this.shape    = [this.columns.length ? this._data[this.columns[0]].length : 0, this.columns.length];
    this.index    = this.shape[0] > 0 ? Array.from({ length: this.shape[0] }, (_, i) => i) : [];
  }

  // ── Row count helpers ─────────────────────────────────────────────────────

  get length() { return this.shape[0]; }

  // ── Column access ─────────────────────────────────────────────────────────

  /**
   * Returns a Series for the given column name.
   * Supports bracket-style access via Proxy (see bottom of file).
   * @param {string} name
   */
  col(name) {
    if (!(name in this._data)) throw new Error(`Column "${name}" not found. Available: ${this.columns.join(', ')}`);
    return new Series(name, this._data[name]);
  }

  /**
   * Alias: df.get(name) === df.col(name).
   */
  get(name) { return this.col(name); }

  // ── Null info ────────────────────────────────────────────────────────────

  /**
   * Returns a plain object { colName: nullCount } — mirrors df.isnull().sum().
   */
  isnullSum() {
    const result = {};
    for (const col of this.columns) {
      result[col] = this.col(col).nullCount();
    }
    return result;
  }

  /**
   * Total number of missing cells across the entire frame.
   */
  totalNulls() {
    return Object.values(this.isnullSum()).reduce((a, b) => a + b, 0);
  }

  // ── Stats ────────────────────────────────────────────────────────────────

  /**
   * Returns describe() output for all numeric columns.
   * Returns an object keyed by column name.
   */
  describe() {
    const result = {};
    for (const col of this.columns) {
      const s = this.col(col);
      result[col] = s.describe();
    }
    return result;
  }

  /**
   * Returns dtype for each column: { colName: dtype }.
   */
  dtypes() {
    const result = {};
    for (const col of this.columns) {
      result[col] = inferDtype(this._data[col]);
    }
    return result;
  }

  /**
   * Prints a summary to console (mirrors df.info()).
   * Returns a string version too for the code editor output.
   */
  info() {
    const lines = [
      `<DataFrame> (${this.length} rows × ${this.columns.length} columns)`,
      '',
      ' #   Column              Non-Null Count  Dtype ',
      '---  ------              --------------  ----- ',
    ];
    this.columns.forEach((col, i) => {
      const s         = this.col(col);
      const nonNull   = s.count();
      const dtype     = s.dtype;
      const nullLabel = `${nonNull}/${this.length} non-null`;
      lines.push(` ${String(i).padStart(2)}   ${col.padEnd(20)}${nullLabel.padEnd(16)}${dtype}`);
    });
    const str = lines.join('\n');
    console.log(str);
    return str;
  }

  // ── Subsetting / filtering ────────────────────────────────────────────────

  /**
   * Filter rows by a boolean predicate function.
   * @param {function(row: Object, index: number): boolean} predicate
   */
  filter(predicate) {
    const rows = this._toRows();
    const filtered = rows.filter((row, i) => predicate(row, i));
    return DataFrame.fromRows(filtered, this.columns);
  }

  /**
   * Returns a new DataFrame with only the specified columns.
   * @param {string[]} colNames
   */
  select(...colNames) {
    const cols = colNames.flat();
    const newData = {};
    for (const c of cols) {
      if (!(c in this._data)) throw new Error(`Column "${c}" not found.`);
      newData[c] = [...this._data[c]];
    }
    return new DataFrame(newData);
  }

  /**
   * Returns a new DataFrame with columns dropped.
   * @param {string[]} colNames
   */
  drop(...colNames) {
    const toDrop = new Set(colNames.flat());
    const newData = {};
    for (const col of this.columns) {
      if (!toDrop.has(col)) newData[col] = [...this._data[col]];
    }
    return new DataFrame(newData);
  }

  // ── Mutation (all return new DataFrame) ──────────────────────────────────

  /**
   * Assigns / overwrites a column. Returns new DataFrame.
   * @param {string}  colName
   * @param {Array|Series}  values  Array of values or a Series.
   */
  assign(colName, values) {
    const arr = values instanceof Series ? values.values : [...values];
    if (arr.length !== this.length) {
      throw new Error(
        `Column length mismatch: DataFrame has ${this.length} rows, new column has ${arr.length}.`
      );
    }
    const newData = cloneData(this._data);
    newData[colName] = arr;
    return new DataFrame(newData);
  }

  /**
   * Apply fillna to a specific column. Returns new DataFrame.
   * @param {string}         colName
   * @param {number|string}  value  Scalar or 'mean'|'median'|'mode'
   */
  fillna(colName, value) {
    const filled = this.col(colName).fillna(value);
    return this.assign(colName, filled.values);
  }

  /**
   * Clip a column. Returns new DataFrame.
   * @param {string} colName
   * @param {number} lower
   * @param {number} upper
   */
  clip(colName, lower, upper) {
    const clipped = this.col(colName).clip(lower, upper);
    return this.assign(colName, clipped.values);
  }

  /**
   * Log1p transform a column. Returns new DataFrame.
   * @param {string} colName
   */
  log1p(colName) {
    const transformed = this.col(colName).log1p();
    return this.assign(colName, transformed.values);
  }

  /**
   * Replace values in a column. Returns new DataFrame.
   */
  replace(colName, targets, replacement) {
    const replaced = this.col(colName).replace(targets, replacement);
    return this.assign(colName, replaced.values);
  }

  /**
   * Map values in a column using a mapping object. Returns new DataFrame.
   */
  mapColumn(colName, mapping) {
    const mapped = this.col(colName).map(mapping);
    return this.assign(colName, mapped.values);
  }

  /**
   * Add a missing-indicator column: colName_missing (1 where missing, 0 otherwise).
   * Returns new DataFrame with the indicator column appended.
   * @param {string} colName
   */
  addMissingIndicator(colName) {
    const indicator = this.col(colName).isnull().astype('int');
    return this.assign(`${colName}_missing`, indicator.values);
  }

  /**
   * One-hot encode a categorical column.
   * Drops the original column and appends n-1 binary columns (dummy encoding).
   * @param {string}  colName
   * @param {boolean} [dropFirst=false]  Drop first category (avoid multicollinearity).
   * @param {string}  [prefix]           Defaults to colName.
   */
  getDummies(colName, dropFirst = false, prefix = null) {
    const pfx      = prefix ?? colName;
    const series   = this.col(colName);
    const uniqueVals = [...new Set(
      series.values.filter(v => !isMissing(v)).map(String)
    )].sort();

    const categories = dropFirst ? uniqueVals.slice(1) : uniqueVals;

    let df = this.drop(colName);
    for (const cat of categories) {
      const binaryCol = series.values.map(v => (String(v) === cat ? 1 : 0));
      df = df.assign(`${pfx}_${cat}`, binaryCol);
    }
    return df;
  }

  /**
   * Min-max normalize a column. Returns new DataFrame.
   * @param {string} colName
   * @param {string} [suffix='_scaled']
   */
  minMaxScale(colName, suffix = '_scaled') {
    const scaled = this.col(colName).minMaxScale();
    return this.assign(`${colName}${suffix}`, scaled.values);
  }

  /**
   * Z-score standardize a column. Returns new DataFrame.
   * @param {string} colName
   * @param {string} [suffix='_scaled']
   */
  standardize(colName, suffix = '_scaled') {
    const std = this.col(colName).standardize();
    return this.assign(`${colName}${suffix}`, std.values);
  }

  /**
   * Filter rows: keep only rows where predicate(row) is true.
   * Convenience wrapper around .filter().
   * Usage: df.filterRows(row => row.Age < 60)
   */
  filterRows(predicate) {
    return this.filter(predicate);
  }

  /**
   * Remove rows where a column's value is outside [lower, upper].
   * Used for outlier suppression.
   */
  removeOutliers(colName, lower, upper) {
    return this.filter(row => {
      const v = row[colName];
      if (isMissing(v)) return true; // keep missing rows (separate concern)
      return v >= lower && v <= upper;
    });
  }

  // ── IQR helper ───────────────────────────────────────────────────────────

  /**
   * Computes IQR fences for a column.
   * @param {string} colName
   * @param {number} [multiplier=1.5]
   * @returns {{ Q1, Q3, IQR, lower, upper }}
   */
  iqrFences(colName, multiplier = 1.5) {
    const s   = this.col(colName);
    const Q1  = s.quantile(0.25);
    const Q3  = s.quantile(0.75);
    const IQR = Q3 - Q1;
    return {
      Q1,
      Q3,
      IQR,
      lower: Q1 - multiplier * IQR,
      upper: Q3 + multiplier * IQR,
    };
  }

  // ── Row-based helpers ─────────────────────────────────────────────────────

  /**
   * Returns first n rows as a new DataFrame.
   */
  head(n = 5) {
    const newData = {};
    for (const col of this.columns) {
      newData[col] = this._data[col].slice(0, n);
    }
    return new DataFrame(newData);
  }

  /**
   * Returns last n rows as a new DataFrame.
   */
  tail(n = 5) {
    const newData = {};
    for (const col of this.columns) {
      newData[col] = this._data[col].slice(-n);
    }
    return new DataFrame(newData);
  }

  /**
   * Returns the row at index i as a plain object.
   */
  iloc(i) {
    if (i < 0 || i >= this.length) throw new Error(`Index ${i} out of bounds (length ${this.length}).`);
    const row = {};
    for (const col of this.columns) {
      row[col] = this._data[col][i];
    }
    return row;
  }

  // ── Conversion ────────────────────────────────────────────────────────────

  /**
   * Converts to array of row objects: [{ col1: val, col2: val, ... }, ...].
   */
  _toRows() {
    return Array.from({ length: this.length }, (_, i) => this.iloc(i));
  }

  toRows() {
    return this._toRows();
  }

  /**
   * Returns a plain column-oriented object (safe copy).
   */
  toObject() {
    return cloneData(this._data);
  }

  // ── Static constructors ───────────────────────────────────────────────────

  /**
   * Build a DataFrame from an array of row objects.
   * @param {Object[]} rows
   * @param {string[]} [columnOrder]  Optional explicit column order.
   */
  static fromRows(rows, columnOrder) {
    if (rows.length === 0) return new DataFrame({});
    const cols = columnOrder ?? Object.keys(rows[0]);
    const data = {};
    for (const col of cols) {
      data[col] = rows.map(r => r[col] ?? null);
    }
    return new DataFrame(data);
  }

  /**
   * Parse a CSV string into a DataFrame.
   * Handles numeric coercion automatically.
   * @param {string}  csvText
   * @param {string}  [delimiter=',']
   */
  static fromCSV(csvText, delimiter = ',') {
    const lines = csvText.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return new DataFrame({});
    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
    const data    = {};
    for (const h of headers) data[h] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(delimiter);
      headers.forEach((h, j) => {
        const raw = (parts[j] ?? '').trim().replace(/^"|"$/g, '');
        if (raw === '' || raw === 'NaN' || raw === 'null') {
          data[h].push(null);
        } else {
          const num = Number(raw);
          data[h].push(isNaN(num) ? raw : num);
        }
      });
    }
    return new DataFrame(data);
  }

  // ── Display ───────────────────────────────────────────────────────────────

  /**
   * Renders the DataFrame as a plain-text table string.
   * @param {number} [maxRows=10]
   */
  toString(maxRows = 10) {
    const rows  = Math.min(this.length, maxRows);
    const colWidths = {};

    for (const col of this.columns) {
      colWidths[col] = col.length;
      for (let i = 0; i < rows; i++) {
        const v = this._data[col][i];
        const s = isMissing(v) ? 'NaN' : String(v);
        colWidths[col] = Math.max(colWidths[col], s.length);
      }
    }

    const sep = '  ';
    const header = ['#'.padEnd(5), ...this.columns.map(c => c.padEnd(colWidths[c]))].join(sep);
    const divider = '-'.repeat(header.length);
    const lines = [header, divider];

    for (let i = 0; i < rows; i++) {
      const cells = [String(i).padEnd(5)];
      for (const col of this.columns) {
        const v = this._data[col][i];
        const s = isMissing(v) ? 'NaN' : String(v);
        cells.push(s.padEnd(colWidths[col]));
      }
      lines.push(cells.join(sep));
    }

    if (this.length > maxRows) {
      lines.push(`... ${this.length - maxRows} more rows`);
    }

    return lines.join('\n');
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { DataFrame, Series, isMissing, inferDtype, MISSING };
