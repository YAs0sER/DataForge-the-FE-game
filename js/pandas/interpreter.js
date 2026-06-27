/**
 * DataForge — Interpreter
 *
 * A fake-pandas REPL that parses player-typed Python-ish commands,
 * maps them to operations.js functions, and returns structured results
 * consumed by the code-editor widget (editor.js).
 *
 * Design goals:
 *   • Forgiving parser — players aren't writing real Python; we match intent.
 *   • Stateful session — variables (df, Q1, IQR, …) persist across runs.
 *   • Every execution returns an ExecutionResult so the editor can update
 *     the table widget, console panel, and task-checker independently.
 *   • No eval() / Function() — safe, deterministic, auditable.
 *
 * ─── Table of contents ────────────────────────────────────────────────────
 *  1.  Types & constants
 *  2.  Tokeniser / parser  (line → ParsedCommand)
 *  3.  Command handlers    (one per command family)
 *  4.  Variable store      (session state)
 *  5.  Dispatcher          (ParsedCommand → handler)
 *  6.  Public API          (Interpreter class)
 * ──────────────────────────────────────────────────────────────────────────
 */

'use strict';

import { DataFrame, Series, isMissing } from './dataframe.js';
import {
  // exploration
  info, describe, dtypes, isnullSum, head, tail, valueCounts, quantile, skew,
  // missing
  fillna, addMissingIndicator,
  // outliers
  iqrFences, removeOutliers, clipOutliers, clip, log1p, outlierMask, zScoreOutlierMask,
  // encoding
  getDummies, labelEncode, autoLabelEncode, frequencyEncode, groupRareCategories,
  // scaling
  minMaxScale, standardize, logTransform,
  // helpers
  dropColumn, selectColumns, renameColumn, assignColumn, filterRows,
  // formatters
  formatDescribe, formatIsnullSum, formatDtypes, formatValueCounts,
  formatIqrFences, formatGroupRare,
} from './operations.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. TYPES & CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ExecutionResult
 * @property {'ok'|'error'|'info'}  status
 * @property {string}               output      — formatted string for the console panel
 * @property {DataFrame|null}       df          — updated DataFrame (null if unchanged)
 * @property {Object|null}          sideEffect  — extra data for the UI (masks, maps, …)
 * @property {string}               raw         — the original command string
 */

/**
 * @typedef {Object} ParsedCommand
 * @property {string}   type        — command family key
 * @property {string}   target      — primary variable name (usually 'df')
 * @property {string[]} args        — positional string arguments
 * @property {Object}   kwargs      — keyword arguments { name: value }
 * @property {string}   assignTo    — left-hand-side variable name if `x = …`
 * @property {string}   raw         — original trimmed line
 */

// All recognised command families.  The parser maps raw text → one of these.
const CMD = Object.freeze({
  // exploration
  INFO:            'info',
  DESCRIBE:        'describe',
  DTYPES:          'dtypes',
  ISNULL_SUM:      'isnull_sum',
  HEAD:            'head',
  TAIL:            'tail',
  VALUE_COUNTS:    'value_counts',
  QUANTILE:        'quantile',
  SKEW:            'skew',
  // missing
  FILLNA:          'fillna',
  FILLNA_MEAN:     'fillna_mean',
  FILLNA_MEDIAN:   'fillna_median',
  FILLNA_MODE:     'fillna_mode',
  ADD_INDICATOR:   'add_indicator',
  // outliers
  IQR_FENCES:      'iqr_fences',
  REMOVE_OUTLIERS: 'remove_outliers',
  CLIP_OUTLIERS:   'clip_outliers',
  CLIP:            'clip',
  LOG1P:           'log1p',
  OUTLIER_MASK:    'outlier_mask',
  ZSCORE_MASK:     'zscore_mask',
  // encoding
  GET_DUMMIES:     'get_dummies',
  LABEL_ENCODE:    'label_encode',
  FREQ_ENCODE:     'freq_encode',
  GROUP_RARE:      'group_rare',
  // scaling
  MINMAX:          'minmax',
  STANDARDIZE:     'standardize',
  LOG_TRANSFORM:   'log_transform',
  // helpers
  DROP:            'drop',
  SELECT:          'select',
  RENAME:          'rename',
  ASSIGN:          'assign',
  FILTER:          'filter',
  // variable assignment / print
  VAR_ASSIGN:      'var_assign',
  PRINT:           'print',
  UNKNOWN:         'unknown',
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. TOKENISER / PARSER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pull the string content out of the first quoted argument in `text`.
 * Handles both single and double quotes.
 * Returns null if none found.
 * @param {string} text
 * @returns {string|null}
 */
function extractQuotedArg(text) {
  const m = text.match(/['"]([^'"]+)['"]/);
  return m ? m[1] : null;
}

/**
 * Extract all quoted strings from `text`, in order.
 * @param {string} text
 * @returns {string[]}
 */
function extractAllQuoted(text) {
  const re = /['"]([^'"]+)['"]/g;
  const results = [];
  let m;
  while ((m = re.exec(text)) !== null) results.push(m[1]);
  return results;
}

/**
 * Extract a bare (unquoted) numeric literal from the end of an argument list.
 * @param {string} text
 * @returns {number|null}
 */
function extractNumber(text) {
  const m = text.match(/[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/);
  return m ? Number(m[0]) : null;
}

/**
 * Extract all bare numeric literals from `text`, in order.
 * @param {string} text
 * @returns {number[]}
 */
function extractAllNumbers(text) {
  return (text.match(/[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
}

/**
 * Try to parse an inline dict literal like {'a': 0, 'b': 1, 'c': 2}.
 * Returns null if the text doesn't contain a recognisable dict.
 * @param {string} text
 * @returns {Object|null}
 */
function extractDictLiteral(text) {
  const m = text.match(/\{([^}]+)\}/);
  if (!m) return null;
  const inner = m[1];
  const pairs = inner.split(',').map(s => s.trim()).filter(Boolean);
  const result = {};
  for (const pair of pairs) {
    // Match  'key': value  or  "key": value  (value may be string or number)
    const pm = pair.match(/['"]([^'"]+)['"]\s*:\s*(?:['"]([^'"]*)['"']|(-?\d+(?:\.\d+)?))/);
    if (!pm) return null;
    result[pm[1]] = pm[3] !== undefined ? Number(pm[3]) : pm[2];
  }
  return result;
}

/**
 * Detect whether the line contains normalize=True / normalize=False.
 * @param {string} text
 * @returns {boolean}
 */
function extractNormalize(text) {
  return /normalize\s*=\s*True/i.test(text);
}

/**
 * Detect drop_first=True.
 * @param {string} text
 * @returns {boolean}
 */
function extractDropFirst(text) {
  return /drop_first\s*=\s*True/i.test(text);
}

/**
 * Detect the left-hand side of an assignment: `varName = …`
 * Returns the variable name or null.
 * @param {string} raw
 * @returns {string|null}
 */
function detectAssignment(raw) {
  // Must not be inside quotes; simple heuristic: match  word = non-= at start
  const m = raw.match(/^([A-Za-z_]\w*)\s*=\s*(?!=)/);
  return m ? m[1] : null;
}

/**
 * Detect a DataFrame column assignment like: df['col'] = ...
 * Returns the assigned column name or null.
 * @param {string} raw
 * @returns {string|null}
 */
function detectDataFrameColumnAssignment(raw) {
  const m = raw.match(/^df\s*\[\s*['"]([^'"]+)['"]\s*\]\s*=\s*(?!=)/);
  return m ? m[1] : null;
}

/** Evaluate lesson arithmetic without eval(). */
function evaluateArithmeticExpression(expression, vars) {
  const tokens = [];
  const tokenPattern = /\s*([A-Za-z_]\w*|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[()+\-*/])\s*/gy;
  let cursor = 0;

  while (cursor < expression.length) {
    tokenPattern.lastIndex = cursor;
    const match = tokenPattern.exec(expression);
    if (!match || match.index !== cursor) {
      throw new Error(`Unsupported arithmetic near "${expression.slice(cursor)}".`);
    }
    tokens.push(match[1]);
    cursor = tokenPattern.lastIndex;
  }

  let index = 0;
  const peek = () => tokens[index];
  const take = () => tokens[index++];

  const parsePrimary = () => {
    const token = take();
    if (token === undefined) throw new Error('Incomplete arithmetic expression.');
    if (token === '(') {
      const value = parseExpression();
      if (take() !== ')') throw new Error('Missing closing parenthesis.');
      return value;
    }
    if (token === '+' || token === '-') {
      const value = parsePrimary();
      return token === '-' ? -value : value;
    }
    if (/^\d/.test(token)) return Number(token);
    if (!(token in vars)) throw new Error(`Variable "${token}" must be computed first.`);
    const value = vars[token];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`Variable "${token}" is not a number.`);
    }
    return value;
  };

  const parseTerm = () => {
    let value = parsePrimary();
    while (peek() === '*' || peek() === '/') {
      const operator = take();
      const right = parsePrimary();
      if (operator === '/' && right === 0) throw new Error('Division by zero.');
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  };

  function parseExpression() {
    let value = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const operator = take();
      const right = parseTerm();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  }

  const result = parseExpression();
  if (index !== tokens.length) throw new Error(`Unexpected token "${peek()}".`);
  if (!Number.isFinite(result)) throw new Error('Arithmetic result is not finite.');
  return result;
}

/**
 * The main parser.  Takes one trimmed line of player input and returns a
 * ParsedCommand.  Handles the most common pandas idioms used across all
 * six worlds' command-reference cards.
 *
 * @param {string} raw  — one trimmed line
 * @returns {ParsedCommand}
 */
function parseLine(raw) {
  /** @type {ParsedCommand} */
  const cmd = {
    type:     CMD.UNKNOWN,
    target:   'df',
    args:     [],
    kwargs:   {},
    assignTo: null,
    raw,
  };

  // ── Assignment detection ──────────────────────────────────────────────
  // e.g.  Q1 = df['Age'].quantile(0.25)
  //       df = df[df['Salary'] <= upper]
  //       df['col_missing'] = df['col'].isnull().astype(int)
  const lhs = detectAssignment(raw);
  if (lhs) cmd.assignTo = lhs;
  const assignedDfColumn = detectDataFrameColumnAssignment(raw);
  if (assignedDfColumn) cmd.kwargs.assignedColumn = assignedDfColumn;

  // Work on the RHS (or the whole line if no assignment)
  const rhs = lhs || assignedDfColumn
    ? raw.slice(raw.indexOf('=') + 1).trim()
    : raw;

  // ── Exploration ───────────────────────────────────────────────────────

  // df.info()
  if (/df\.info\s*\(\s*\)/.test(rhs)) {
    cmd.type = CMD.INFO; return cmd;
  }

  // df.describe()
  if (/df\.describe\s*\(\s*\)/.test(rhs)) {
    cmd.type = CMD.DESCRIBE; return cmd;
  }

  // df.dtypes
  if (/df\.dtypes(?!\w)/.test(rhs)) {
    cmd.type = CMD.DTYPES; return cmd;
  }

  // df.isnull().sum()
  if (/df\.isnull\s*\(\s*\)\.sum\s*\(\s*\)/.test(rhs)) {
    cmd.type = CMD.ISNULL_SUM; return cmd;
  }

  // df.head(n) / df.head()
  if (/df\.head\s*\(/.test(rhs)) {
    cmd.type = CMD.HEAD;
    const n = extractNumber(rhs.replace(/.*head\s*\(/, ''));
    if (n !== null) cmd.args = [n];
    return cmd;
  }

  // df.tail(n)
  if (/df\.tail\s*\(/.test(rhs)) {
    cmd.type = CMD.TAIL;
    const n = extractNumber(rhs.replace(/.*tail\s*\(/, ''));
    if (n !== null) cmd.args = [n];
    return cmd;
  }

  // df['col'].value_counts(normalize=True/False)
  if (/value_counts\s*\(/.test(rhs)) {
    cmd.type = CMD.VALUE_COUNTS;
    cmd.args = [extractQuotedArg(rhs)];
    cmd.kwargs.normalize = extractNormalize(rhs);
    return cmd;
  }

  // df['col'].quantile(q)  or  Q1 = df['col'].quantile(0.25)
  if (/quantile\s*\(/.test(rhs)) {
    cmd.type = CMD.QUANTILE;
    cmd.args = [extractQuotedArg(rhs)];
    // The quantile value comes after `quantile(`
    const afterQ = rhs.replace(/.*quantile\s*\(/, '');
    cmd.args.push(extractNumber(afterQ));
    return cmd;
  }

  // df['col'].skew()
  if (/skew\s*\(/.test(rhs)) {
    cmd.type = CMD.SKEW;
    cmd.args = [extractQuotedArg(rhs)];
    return cmd;
  }

  // ── Missing values ────────────────────────────────────────────────────

  // df['col'].fillna(df['col'].mean())   → fillna_mean
  if (/fillna\s*\(.*\.mean\s*\(\s*\)\s*\)/.test(rhs)) {
    cmd.type = CMD.FILLNA_MEAN;
    cmd.args = [extractAllQuoted(rhs)[0]]; // first quoted = col name
    return cmd;
  }

  // df['col'].fillna(df['col'].median())
  if (/fillna\s*\(.*\.median\s*\(\s*\)\s*\)/.test(rhs)) {
    cmd.type = CMD.FILLNA_MEDIAN;
    cmd.args = [extractAllQuoted(rhs)[0]];
    return cmd;
  }

  // df['col'].fillna(df['col'].mode()[0])   — mode
  if (/fillna\s*\(.*\.mode\s*\(\s*\)/.test(rhs)) {
    cmd.type = CMD.FILLNA_MODE;
    cmd.args = [extractAllQuoted(rhs)[0]];
    return cmd;
  }

  // df['col'].fillna('Missing') or df['col'].fillna(value)
  if (/fillna\s*\(/.test(rhs)) {
    cmd.type = CMD.FILLNA;
    const quoted = extractAllQuoted(rhs);
    // quoted[0] = column name (from df['col']), quoted[1] = fill value if string
    cmd.args[0] = quoted[0]; // col
    if (quoted.length >= 2) {
      cmd.args[1] = quoted[1]; // string fill value
    } else {
      // numeric fill value
      const afterFillna = rhs.replace(/.*fillna\s*\(/, '');
      const num = extractNumber(afterFillna);
      cmd.args[1] = num !== null ? num : 0;
    }
    return cmd;
  }

  // df['col_missing'] = df['col'].isnull().astype(int)
  // Also catches: df.addMissingIndicator('col')
  if (/isnull\s*\(\s*\)\.astype/.test(rhs) || /addMissingIndicator/.test(rhs)) {
    cmd.type = CMD.ADD_INDICATOR;
    // The source column is the first quoted string in the RHS.
    cmd.args = [extractAllQuoted(rhs)[0]];
    return cmd;
  }

  // ── Outliers ──────────────────────────────────────────────────────────

  // IQR = Q3 - Q1  (bare arithmetic — store in variable)
  if (lhs && /^[A-Za-z_\d\s()+\-*/.]+$/.test(rhs)) {
    cmd.type = CMD.VAR_ASSIGN;
    cmd.args = ['ARITH_EXPR', rhs];
    return cmd;
  }

  if (/^IQR\s*=\s*Q3\s*-\s*Q1$/.test(raw.trim())) {
    cmd.type = CMD.VAR_ASSIGN;
    cmd.assignTo = 'IQR';
    cmd.args = ['IQR_EXPR']; // special token
    return cmd;
  }

  // lower = Q1 - 1.5 * IQR
  if (/^lower\s*=/.test(raw.trim())) {
    cmd.type = CMD.VAR_ASSIGN;
    cmd.assignTo = 'lower';
    cmd.args = ['LOWER_EXPR'];
    return cmd;
  }

  // upper = Q3 + 1.5 * IQR
  if (/^upper\s*=/.test(raw.trim())) {
    cmd.type = CMD.VAR_ASSIGN;
    cmd.assignTo = 'upper';
    cmd.args = ['UPPER_EXPR'];
    return cmd;
  }

  // df['col'].quantile(0.25)  already caught above
  // Q1 = df['col'].quantile(0.25)  → caught above by quantile + assignTo

  // df = df[df['col'] <= upper]  or  df = df[df['col'] >= lower]
  // Outlier suppression via boolean indexing
  if (/df\s*\[\s*df\s*\[/.test(rhs)) {
    cmd.type = CMD.FILTER;
    // Extract col, operator, variable or literal
    const fm = rhs.match(/df\s*\[\s*['"]([^'"]+)['"]\s*\]\s*([<>]=?|==|!=)\s*([A-Za-z_]\w*|-?\d+(?:\.\d+)?)/);
    if (fm) {
      cmd.args = [fm[1], fm[2], fm[3]]; // col, op, rhs-val
    }
    return cmd;
  }

  // df['col'] = df['col'].clip(lower, upper)
  if (/\.clip\s*\(/.test(rhs)) {
    cmd.type = CMD.CLIP;
    cmd.args[0] = extractAllQuoted(rhs)[0]; // col
    const nums = extractAllNumbers(rhs.replace(/.*clip\s*\(/, ''));
    if (nums.length >= 2) {
      cmd.args[1] = nums[0]; // lower
      cmd.args[2] = nums[1]; // upper
    } else {
      // variable names (lower / upper from session)
      const varMatch = rhs.replace(/.*clip\s*\(/, '').match(/([A-Za-z_]\w*)\s*,\s*([A-Za-z_]\w*)/);
      if (varMatch) {
        cmd.args[1] = varMatch[1]; // will be resolved from session
        cmd.args[2] = varMatch[2];
        cmd.kwargs.useVars = true;
      }
    }
    return cmd;
  }

  // np.log1p(df['col'])  or  df['col'] = np.log1p(df['col'])
  if (/log1p\s*\(/.test(rhs)) {
    cmd.type = CMD.LOG1P;
    cmd.args = [extractQuotedArg(rhs)];
    return cmd;
  }

  // ── Encoding ─────────────────────────────────────────────────────────

  // pd.get_dummies(df, columns=['col'])  or  pd.get_dummies(df, columns=['col'], drop_first=True)
  if (/get_dummies\s*\(/.test(rhs)) {
    cmd.type = CMD.GET_DUMMIES;
    cmd.args = [extractQuotedArg(rhs.replace(/.*columns\s*=\s*\[/, ''))]; // col inside columns=[...]
    cmd.kwargs.dropFirst = extractDropFirst(rhs);
    return cmd;
  }

  // df['col'].map({'a': 0, 'b': 1})   — label encode via explicit map
  if (/\.map\s*\(\s*\{/.test(rhs)) {
    cmd.type = CMD.LABEL_ENCODE;
    cmd.args = [extractAllQuoted(rhs)[0]]; // col
    cmd.kwargs.mapping = extractDictLiteral(rhs);
    return cmd;
  }

  // freq = df['col'].value_counts(normalize=True)  — already caught by value_counts above
  // df['col'] = df['col'].map(freq)  — map with a stored variable
  if (/\.map\s*\(\s*([A-Za-z_]\w*)\s*\)/.test(rhs) && !/\{/.test(rhs)) {
    const varMatch = rhs.match(/\.map\s*\(\s*([A-Za-z_]\w*)\s*\)/);
    cmd.type = CMD.LABEL_ENCODE;
    cmd.args = [extractAllQuoted(rhs)[0]]; // col
    cmd.kwargs.mappingVar = varMatch ? varMatch[1] : null;
    return cmd;
  }

  // df['col'].replace(rare, 'Autres')  — group rare
  if (/\.replace\s*\(/.test(rhs) && /[Aa]utres|rare/.test(rhs)) {
    cmd.type = CMD.GROUP_RARE;
    cmd.args = [extractAllQuoted(rhs)[0]]; // col
    const threshold = extractNumber(rhs.replace(/.*replace/, '')) ?? 0.05;
    cmd.kwargs.threshold = threshold;
    const quoted = extractAllQuoted(rhs);
    const replacement = quoted[quoted.length - 1] ?? 'Autres';
    cmd.kwargs.replacement = replacement;
    return cmd;
  }

  // freq = df['col'].value_counts(normalize=True)  → pure variable assignment,
  // already handled by VALUE_COUNTS + assignTo

  // ── Scaling ───────────────────────────────────────────────────────────

  // scaler_mm.fit_transform(df[['col']])  or  MinMaxScaler / minMaxScale
  if (/[Mm]in[Mm]ax|minmax/.test(rhs) && /fit_transform|minMaxScale/.test(rhs)) {
    cmd.type = CMD.MINMAX;
    cmd.args = [extractQuotedArg(rhs)];
    return cmd;
  }

  // StandardScaler / standardize
  if (/[Ss]tandard[Ss]caler|standardize|zscore|z_score/.test(rhs) && /fit_transform|standardize/.test(rhs)) {
    cmd.type = CMD.STANDARDIZE;
    cmd.args = [extractQuotedArg(rhs)];
    return cmd;
  }

  // ── General helpers ───────────────────────────────────────────────────

  // df.drop(columns=['col'])  or  df.drop('col', axis=1)
  if (/df\.drop\s*\(/.test(rhs)) {
    cmd.type = CMD.DROP;
    cmd.args = extractAllQuoted(rhs);
    return cmd;
  }

  // df[['col1','col2']]  — select subset
  if (/df\s*\[\s*\[/.test(rhs)) {
    cmd.type = CMD.SELECT;
    cmd.args = extractAllQuoted(rhs);
    return cmd;
  }

  // print(x)  or just typing a variable name
  if (/^print\s*\(/.test(rhs) || /^[A-Za-z_]\w*$/.test(rhs.trim())) {
    cmd.type = CMD.PRINT;
    cmd.args = [rhs.replace(/^print\s*\(|\)\s*$/g, '').trim()];
    return cmd;
  }

  return cmd; // CMD.UNKNOWN
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. COMMAND HANDLERS
//    Each handler receives (parsedCmd, session) and returns ExecutionResult.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper: build a successful ExecutionResult.
 * @param {string}     output
 * @param {DataFrame}  [df]
 * @param {Object}     [sideEffect]
 * @param {string}     [raw]
 */
function ok(output, df = null, sideEffect = null, raw = '') {
  return { status: 'ok', output, df, sideEffect, raw };
}

/**
 * Helper: build an error ExecutionResult.
 */
function err(message, raw = '') {
  return { status: 'error', output: `❌ ${message}`, df: null, sideEffect: null, raw };
}

/**
 * Helper: resolve a value that might be a session variable name or a literal.
 * @param {string|number} val
 * @param {Object} session
 * @returns {number|string}
 */
function resolveValue(val, session) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string' && val in session.vars) return session.vars[val];
  return val;
}

// ── Handler map ──────────────────────────────────────────────────────────────

const HANDLERS = {

  // ── Exploration ───────────────────────────────────────────────────────

  [CMD.INFO](cmd, session) {
    try {
      const out = info(session.df);
      return ok(out, null, null, cmd.raw);
    } catch (e) { return err(e.message, cmd.raw); }
  },

  [CMD.DESCRIBE](cmd, session) {
    try {
      const result = describe(session.df);
      return ok(formatDescribe(result), null, { type: 'describe', data: result }, cmd.raw);
    } catch (e) { return err(e.message, cmd.raw); }
  },

  [CMD.DTYPES](cmd, session) {
    try {
      const result = dtypes(session.df);
      return ok(formatDtypes(result), null, { type: 'dtypes', data: result }, cmd.raw);
    } catch (e) { return err(e.message, cmd.raw); }
  },

  [CMD.ISNULL_SUM](cmd, session) {
    try {
      const result = isnullSum(session.df);
      return ok(
        formatIsnullSum(result, session.df.length),
        null,
        { type: 'isnull_sum', data: result },
        cmd.raw
      );
    } catch (e) { return err(e.message, cmd.raw); }
  },

  [CMD.HEAD](cmd, session) {
    try {
      const n   = cmd.args[0] ?? 5;
      const sub = head(session.df, n);
      return ok(sub.toString(n), null, { type: 'head', n }, cmd.raw);
    } catch (e) { return err(e.message, cmd.raw); }
  },

  [CMD.TAIL](cmd, session) {
    try {
      const n   = cmd.args[0] ?? 5;
      const sub = tail(session.df, n);
      return ok(sub.toString(n), null, { type: 'tail', n }, cmd.raw);
    } catch (e) { return err(e.message, cmd.raw); }
  },

  [CMD.VALUE_COUNTS](cmd, session) {
    try {
      const col  = cmd.args[0];
      if (!col) return err('Specify a column: df[\'col\'].value_counts()', cmd.raw);
      const norm = cmd.kwargs.normalize ?? false;
      const result = valueCounts(session.df, col, norm);
      // Store in session so `freq = df['col'].value_counts(normalize=True)` works
      if (cmd.assignTo) session.vars[cmd.assignTo] = result;
      return ok(
        formatValueCounts(result, col, norm),
        null,
        { type: 'value_counts', col, data: result, normalize: norm },
        cmd.raw
      );
    } catch (e) { return err(e.message, cmd.raw); }
  },

  [CMD.QUANTILE](cmd, session) {
    try {
      const col = cmd.args[0];
      const q   = cmd.args[1] ?? 0.5;
      if (!col) return err('Specify a column: df[\'col\'].quantile(0.25)', cmd.raw);
      const result = quantile(session.df, col, q);
      if (cmd.assignTo) session.vars[cmd.assignTo] = result;
      const label = q === 0.25 ? 'Q1' : q === 0.75 ? 'Q3' : `Q${q}`;
      return ok(`${label} = ${result.toFixed(4)}`, null, { type: 'quantile', col, q, result }, cmd.raw);
    } catch (e) { return err(e.message, cmd.raw); }
  },

  [CMD.SKEW](cmd, session) {
    try {
      const col = cmd.args[0];
      if (!col) return err('Specify a column: df[\'col\'].skew()', cmd.raw);
      const result = skew(session.df, col);
      if (cmd.assignTo) session.vars[cmd.assignTo] = result;
      const label = Math.abs(result) > 1
        ? (result > 0 ? '⚠ Right-skewed (consider log transform)' : '⚠ Left-skewed')
        : '✓ Approximately symmetric';
      return ok(`Skewness of "${col}": ${result.toFixed(4)}  ${label}`, null, { type: 'skew', col, result }, cmd.raw);
    } catch (e) { return err(e.message, cmd.raw); }
  },

  // ── Missing values ────────────────────────────────────────────────────

  [CMD.FILLNA](cmd, session) {
    try {
      const [col, value] = cmd.args;
      if (!col) return err('Specify a column: df[\'col\'].fillna(value)', cmd.raw);
      const newDf = fillna(session.df, col, value);
      const fixed = session.df.col(col).nullCount() - newDf.col(col).nullCount();
      return ok(
        `Filled ${fixed} missing value(s) in "${col}" with ${JSON.stringify(value)}.`,
        newDf,
        { type: 'fillna', col, value, fixedCount: fixed },
        cmd.raw
      );
    } catch (e) { return err(e.message, cmd.raw); }
  },

  [CMD.FILLNA_MEAN](cmd, session) {
    try {
      const col    = cmd.args[0];
      if (!col) return err('Specify a column.', cmd.raw);
      const meanVal = session.df.col(col).mean();
      const newDf  = fillna(session.df, col, 'mean');
      const fixed  = session.df.col(col).nullCount();
      return ok(
        `Filled ${fixed} missing value(s) in "${col}" with mean (${meanVal.toFixed(4)}).`,
        newDf,
        { type: 'fillna', col, value: meanVal, fixedCount: fixed },
        cmd.raw
      );
    } catch (e) { return err(e.message, cmd.raw); }
  },

  [CMD.FILLNA_MEDIAN](cmd, session) {
    try {
      const col     = cmd.args[0];
      if (!col) return err('Specify a column.', cmd.raw);
      const medVal  = session.df.col(col).median();
      const newDf   = fillna(session.df, col, 'median');
      const fixed   = session.df.col(col).nullCount();
      return ok(
        `Filled ${fixed} missing value(s) in "${col}" with median (${medVal.toFixed(4)}).`,
        newDf,
        { type: 'fillna', col, value: medVal, fixedCount: fixed },
        cmd.raw
      );
    } catch (e) { return err(e.message, cmd.raw); }
  },

  [CMD.FILLNA_MODE](cmd, session) {
    try {
      const col    = cmd.args[0];
      if (!col) return err('Specify a column.', cmd.raw);
      const modeVal = session.df.col(col)._mode();
      const newDf  = fillna(session.df, col, 'mode');
      const fixed  = session.df.col(col).nullCount();
      return ok(
        `Filled ${fixed} missing value(s) in "${col}" with mode ("${modeVal}").`,
        newDf,
        { type: 'fillna', col, value: modeVal, fixedCount: fixed },
        cmd.raw
      );
    } catch (e) { return err(e.message, cmd.raw); }
  },

  [CMD.ADD_INDICATOR](cmd, session) {
    try {
      const col   = cmd.args[0];
      if (!col) return err('Specify a column: df[\'col_missing\'] = df[\'col\'].isnull().astype(int)', cmd.raw);
      const newDf = addMissingIndicator(session.df, col);
      const ones  = newDf.col(`${col}_missing`).sum();
      return ok(
        `Added column "${col}_missing" (${ones} rows flagged as 1).`,
        newDf,
        { type: 'add_indicator', col, indicatorCol: `${col}_missing` },
        cmd.raw
      );
    } catch (e) { return err(e.message, cmd.raw); }
  },

  // ── Outliers ──────────────────────────────────────────────────────────

  [CMD.IQR_FENCES](cmd, session) {
    try {
      const col     = cmd.args[0];
      if (!col) return err('Specify a column: df[\'col\'].quantile(…)', cmd.raw);
      const fences  = iqrFences(session.df, col);
      // Auto-store Q1, Q3, IQR, lower, upper in session
      session.vars.Q1    = fences.Q1;
      session.vars.Q3    = fences.Q3;
      session.vars.IQR   = fences.IQR;
      session.vars.lower = fences.lower;
      session.vars.upper = fences.upper;
      if (cmd.assignTo) session.vars[cmd.assignTo] = fences;
      return ok(
        formatIqrFences(fences, col),
        null,
        { type: 'iqr_fences', col, ...fences },
        cmd.raw
      );
    } catch (e) { return err(e.message, cmd.raw); }
  },

  [CMD.REMOVE_OUTLIERS](cmd, session) {
    try {
      const col    = cmd.args[0];
      if (!col) return err('Specify a column.', cmd.raw);
      const before = session.df.length;
      const newDf  = removeOutliers(session.df, col);
      const removed = before - newDf.length;
      return ok(
        `Removed ${removed} outlier row(s) from "${col}" (${newDf.length} rows remain).`,
        newDf,
        { type: 'remove_outliers', col, removed },
        cmd.raw
      );
    } catch (e) { return err(e.message, cmd.raw); }
  },

  [CMD.CLIP](cmd, session) {
    try {
      const col = cmd.args[0];
      if (!col) return err('Specify a column.', cmd.raw);

      let lower, upper;
      if (cmd.kwargs.useVars) {
        lower = resolveValue(cmd.args[1], session);
        upper = resolveValue(cmd.args[2], session);
      } else {
        lower = cmd.args[1] ?? resolveValue('lower', session);
        upper = cmd.args[2] ?? resolveValue('upper', session);
      }
      if (lower == null || upper == null) {
        return err('Could not resolve lower/upper fences. Run IQR calculations first.', cmd.raw);
      }
      const newDf  = clip(session.df, col, Number(lower), Number(upper));
      const capped = session.df.col(col).values.filter(
        v => !isMissing(v) && (v < Number(lower) || v > Number(upper))
      ).length;
      return ok(
        `Capped ${capped} value(s) in "${col}" to [${Number(lower).toFixed(2)}, ${Number(upper).toFixed(2)}].`,
        newDf,
        { type: 'clip', col, lower, upper, capped },
        cmd.raw
      );
    } catch (e) { return err(e.message, cmd.raw); }
  },

  [CMD.CLIP_OUTLIERS](cmd, session) {
    try {
      const col    = cmd.args[0];
      if (!col) return err('Specify a column.', cmd.raw);
      const fences = iqrFences(session.df, col);
      const newDf  = clipOutliers(session.df, col);
      const capped = session.df.col(col).values.filter(
        v => !isMissing(v) && (v < fences.lower || v > fences.upper)
      ).length;
      return ok(
        `Capped ${capped} outlier(s) in "${col}" at IQR fences [${fences.lower.toFixed(2)}, ${fences.upper.toFixed(2)}].`,
        newDf,
        { type: 'clip_outliers', col, ...fences, capped },
        cmd.raw
      );
    } catch (e) { return err(e.message, cmd.raw); }
  },

  [CMD.LOG1P](cmd, session) {
    try {
      const col   = cmd.args[0];
      if (!col) return err('Specify a column: np.log1p(df[\'col\'])', cmd.raw);
      const skewBefore = session.df.col(col).skew();
      const newDf  = log1p(session.df, col);
      const skewAfter  = newDf.col(col).skew();
      return ok(
        `Applied log1p to "${col}".\n  Skewness: ${skewBefore.toFixed(4)} → ${skewAfter.toFixed(4)}`,
        newDf,
        { type: 'log1p', col, skewBefore, skewAfter },
        cmd.raw
      );
    } catch (e) { return err(e.message, cmd.raw); }
  },

  // ── Encoding ─────────────────────────────────────────────────────────

  [CMD.GET_DUMMIES](cmd, session) {
    try {
      const col       = cmd.args[0];
      if (!col) return err('Specify a column: pd.get_dummies(df, columns=[\'col\'])', cmd.raw);
      const dropFirst = cmd.kwargs.dropFirst ?? false;
      const before    = session.df.columns.length;
      const newDf     = getDummies(session.df, col, dropFirst);
      const added     = newDf.columns.length - before + 1; // +1 because original dropped
      return ok(
        `One-Hot encoded "${col}": added ${added} binary column(s).${dropFirst ? ' (first category dropped)' : ''}`,
        newDf,
        { type: 'get_dummies', col, dropFirst, newCols: newDf.columns },
        cmd.raw
      );
    } catch (e) { return err(e.message, cmd.raw); }
  },

  [CMD.LABEL_ENCODE](cmd, session) {
    try {
      const col = cmd.args[0];
      if (!col) return err('Specify a column: df[\'col\'].map({…})', cmd.raw);

      let mapping = cmd.kwargs.mapping;

      // Resolve a stored variable (e.g. `freq` from a previous value_counts call)
      if (!mapping && cmd.kwargs.mappingVar) {
        mapping = session.vars[cmd.kwargs.mappingVar];
        if (!mapping) return err(`Variable "${cmd.kwargs.mappingVar}" not found. Compute it first.`, cmd.raw);
      }

      if (!mapping) return err('Provide a mapping dict: df[\'col\'].map({\'a\': 0, \'b\': 1})', cmd.raw);

      const newDf = labelEncode(session.df, col, mapping);
      return ok(
        `Encoded "${col}" using mapping: ${JSON.stringify(mapping)}`,
        newDf,
        { type: 'label_encode', col, mapping },
        cmd.raw
      );
    } catch (e) { return err(e.message, cmd.raw); }
  },

  [CMD.FREQ_ENCODE](cmd, session) {
    try {
      const col = cmd.args[0];
      if (!col) return err('Specify a column.', cmd.raw);
      const { df: newDf, freqMap } = frequencyEncode(session.df, col);
      if (cmd.assignTo) session.vars[cmd.assignTo] = freqMap;
      return ok(
        formatValueCounts(freqMap, col, true) + '\n\n✓ Applied frequency encoding to column.',
        newDf,
        { type: 'freq_encode', col, freqMap },
        cmd.raw
      );
    } catch (e) { return err(e.message, cmd.raw); }
  },

  [CMD.GROUP_RARE](cmd, session) {
    try {
      const col         = cmd.args[0];
      if (!col) return err('Specify a column.', cmd.raw);
      const threshold   = cmd.kwargs.threshold ?? 0.05;
      const replacement = cmd.kwargs.replacement ?? 'Autres';
      const result      = groupRareCategories(session.df, col, threshold, replacement);
      if (cmd.assignTo) session.vars[cmd.assignTo] = result;
      return ok(
        formatGroupRare(result, col, replacement),
        result.df,
        { type: 'group_rare', col, ...result },
        cmd.raw
      );
    } catch (e) { return err(e.message, cmd.raw); }
  },

  // ── Scaling ───────────────────────────────────────────────────────────

  [CMD.MINMAX](cmd, session) {
    try {
      const col    = cmd.args[0];
      if (!col) return err('Specify a column.', cmd.raw);
      const xMin   = session.df.col(col).min();
      const xMax   = session.df.col(col).max();
      const newDf  = minMaxScale(session.df, col, '');  // '' = overwrite in place
      return ok(
        `Min-Max scaled "${col}" to [0, 1].\n  Original range: [${xMin.toFixed(2)}, ${xMax.toFixed(2)}]`,
        newDf,
        { type: 'minmax', col, xMin, xMax },
        cmd.raw
      );
    } catch (e) { return err(e.message, cmd.raw); }
  },

  [CMD.STANDARDIZE](cmd, session) {
    try {
      const col   = cmd.args[0];
      if (!col) return err('Specify a column.', cmd.raw);
      const mu    = session.df.col(col).mean();
      const sigma = session.df.col(col).std();
      const newDf = standardize(session.df, col, '');
      return ok(
        `Z-score standardized "${col}".\n  μ = ${mu.toFixed(4)}, σ = ${sigma.toFixed(4)} → result has mean≈0, std≈1`,
        newDf,
        { type: 'standardize', col, mu, sigma },
        cmd.raw
      );
    } catch (e) { return err(e.message, cmd.raw); }
  },

  [CMD.LOG_TRANSFORM](cmd, session) {
    // Alias: identical to LOG1P handler
    return HANDLERS[CMD.LOG1P](cmd, session);
  },

  // ── Helpers ───────────────────────────────────────────────────────────

  [CMD.FILTER](cmd, session) {
    try {
      const [col, op, valToken] = cmd.args;
      if (!col || !op) return err('Could not parse filter expression.', cmd.raw);
      const val = resolveValue(valToken, session);
      const numVal = Number(val);
      const ops = {
        '<=': v => v <= numVal, '>=': v => v >= numVal,
        '<':  v => v < numVal,  '>':  v => v > numVal,
        '==': v => v === numVal, '!=': v => v !== numVal,
      };
      const predFn = ops[op];
      if (!predFn) return err(`Unknown operator "${op}".`, cmd.raw);
      const before = session.df.length;
      const newDf  = filterRows(session.df, row => {
        const v = row[col];
        return isMissing(v) ? true : predFn(v);
      });
      const removed = before - newDf.length;
      return ok(
        `Filtered "${col}" ${op} ${val}: removed ${removed} row(s), ${newDf.length} remain.`,
        newDf,
        { type: 'filter', col, op, val, removed },
        cmd.raw
      );
    } catch (e) { return err(e.message, cmd.raw); }
  },

  [CMD.DROP](cmd, session) {
    try {
      const cols  = cmd.args.filter(Boolean);
      if (cols.length === 0) return err('Specify column(s) to drop.', cmd.raw);
      const newDf = dropColumn(session.df, cols);
      return ok(`Dropped column(s): ${cols.join(', ')}.`, newDf, { type: 'drop', cols }, cmd.raw);
    } catch (e) { return err(e.message, cmd.raw); }
  },

  [CMD.SELECT](cmd, session) {
    try {
      const cols = cmd.args.filter(Boolean);
      if (cols.length === 0) return err('Specify column(s) to select.', cmd.raw);
      const newDf = selectColumns(session.df, cols);
      return ok(`Selected columns: ${cols.join(', ')}.`, newDf, { type: 'select', cols }, cmd.raw);
    } catch (e) { return err(e.message, cmd.raw); }
  },

  // ── Variable assignment & print ───────────────────────────────────────

  [CMD.VAR_ASSIGN](cmd, session) {
    try {
      const token = cmd.args[0];
      const name  = cmd.assignTo;

      if (token === 'ARITH_EXPR') {
        const value = evaluateArithmeticExpression(cmd.args[1], session.vars);
        session.vars[name] = value;
        return ok(`${name} = ${value.toFixed(4)}`, null, { type: 'var', name, value }, cmd.raw);
      }

      if (token === 'IQR_EXPR') {
        const q1 = session.vars.Q1, q3 = session.vars.Q3;
        if (q1 == null || q3 == null) return err('Q1 and Q3 must be computed first.', cmd.raw);
        session.vars.IQR = q3 - q1;
        return ok(`IQR = ${session.vars.IQR.toFixed(4)}`, null, { type: 'var', name, value: session.vars.IQR }, cmd.raw);
      }
      if (token === 'LOWER_EXPR') {
        const { Q1, IQR } = session.vars;
        if (Q1 == null || IQR == null) return err('Q1 and IQR must be computed first.', cmd.raw);
        const mult = 1.5; // default
        session.vars.lower = Q1 - mult * IQR;
        return ok(`lower = ${session.vars.lower.toFixed(4)}`, null, { type: 'var', name, value: session.vars.lower }, cmd.raw);
      }
      if (token === 'UPPER_EXPR') {
        const { Q3, IQR } = session.vars;
        if (Q3 == null || IQR == null) return err('Q3 and IQR must be computed first.', cmd.raw);
        const mult = 1.5;
        session.vars.upper = Q3 + mult * IQR;
        return ok(`upper = ${session.vars.upper.toFixed(4)}`, null, { type: 'var', name, value: session.vars.upper }, cmd.raw);
      }
      return err(`Unknown assignment expression: ${token}`, cmd.raw);
    } catch (e) { return err(e.message, cmd.raw); }
  },

  [CMD.PRINT](cmd, session) {
    const name = cmd.args[0];
    if (!name) return ok('', null, null, cmd.raw);
    if (name === 'df') {
      return ok(session.df.toString(), null, { type: 'print_df' }, cmd.raw);
    }
    if (name in session.vars) {
      const v = session.vars[name];
      const str = (v instanceof DataFrame)
        ? v.toString()
        : (typeof v === 'object' && v !== null)
          ? JSON.stringify(v, null, 2)
          : String(v);
      return ok(str, null, { type: 'print_var', name, value: v }, cmd.raw);
    }
    return err(`Name "${name}" is not defined.`, cmd.raw);
  },

  [CMD.UNKNOWN](cmd) {
    return {
      status:     'error',
      output:     `❌ Unknown command: "${cmd.raw}"\n   Type a command from the reference card on the right.`,
      df:         null,
      sideEffect: null,
      raw:        cmd.raw,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. VARIABLE STORE  (session state, one per Interpreter instance)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a fresh session store.
 * @param {DataFrame} initialDf
 * @returns {{ df: DataFrame, vars: Object, history: string[] }}
 */
function createSession(initialDf) {
  return {
    df:      initialDf,
    vars:    {},          // named variables: Q1, Q3, IQR, lower, upper, freq, …
    history: [],          // raw command strings, for re-run / display
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. DISPATCHER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Route a parsed command to its handler, updating the session in place.
 * @param {ParsedCommand} cmd
 * @param {Object}        session
 * @returns {ExecutionResult}
 */
function dispatch(cmd, session) {
  const handler = HANDLERS[cmd.type] ?? HANDLERS[CMD.UNKNOWN];
  const result  = handler(cmd, session);

  // Commit DataFrame update to session
  if (result.df instanceof DataFrame) {
    session.df = result.df;
  }

  // If the command was a pure variable read/assignment with no DF change,
  // still make sure session.vars is current (handlers do this directly).

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. PUBLIC API — Interpreter class
// ─────────────────────────────────────────────────────────────────────────────

export class Interpreter {
  /**
   * @param {DataFrame} initialDf   The dataset for this level/session.
   */
  constructor(initialDf) {
    if (!(initialDf instanceof DataFrame)) {
      throw new Error('Interpreter requires a DataFrame instance.');
    }
    this._session = createSession(initialDf);
  }

  // ── Core execution ───────────────────────────────────────────────────

  /**
   * Execute a single line of player input.
   * Handles multi-statement lines separated by semicolons.
   *
   * @param   {string} line
   * @returns {ExecutionResult[]}  One result per statement.
   */
  run(line) {
    const statements = line.split(';').map(s => s.trim()).filter(Boolean);
    const results    = [];

    for (const stmt of statements) {
      this._session.history.push(stmt);
      const cmd    = parseLine(stmt);
      const result = dispatch(cmd, this._session);
      results.push(result);
      // Abort remaining statements on error
      if (result.status === 'error') break;
    }

    return results;
  }

  /**
   * Execute multiple lines at once (e.g. a code block from the editor).
   * Blank lines and comment lines (starting with #) are skipped.
   *
   * @param   {string} codeBlock
   * @returns {ExecutionResult[]}
   */
  runBlock(codeBlock) {
    const lines   = codeBlock.split('\n').map(l => l.trim());
    const results = [];

    for (const line of lines) {
      if (!line || line.startsWith('#')) continue;
      const lineResults = this.run(line);
      results.push(...lineResults);
      // Stop on first error
      if (lineResults.some(r => r.status === 'error')) break;
    }

    return results;
  }

  // ── State accessors ───────────────────────────────────────────────────

  /** Current working DataFrame. */
  get df() { return this._session.df; }

  /** Named variable store (Q1, Q3, IQR, lower, upper, freq, …). */
  get vars() { return { ...this._session.vars }; }

  /** Command history for this session (raw strings). */
  get history() { return [...this._session.history]; }

  // ── Session management ────────────────────────────────────────────────

  /**
   * Reset the DataFrame to a new one (e.g. when a level resets).
   * Clears vars and history.
   * @param {DataFrame} df
   */
  reset(df) {
    if (!(df instanceof DataFrame)) throw new Error('reset() requires a DataFrame.');
    this._session = createSession(df);
  }

  /**
   * Snapshot the current session state.  Useful for the editor's "undo" feature.
   * @returns {Object}
   */
  snapshot() {
    return {
      df:      this._session.df,   // DataFrames are immutable; no deep copy needed
      vars:    { ...this._session.vars },
      history: [...this._session.history],
    };
  }

  /**
   * Restore a previously taken snapshot.
   * @param {Object} snap  — return value of snapshot()
   */
  restore(snap) {
    this._session.df      = snap.df;
    this._session.vars    = { ...snap.vars };
    this._session.history = [...snap.history];
  }

  // ── Task validation helper ────────────────────────────────────────────

  /**
   * Check whether a list of task validators all pass against the current df.
   * Each validator is a function (df, vars) → boolean.
   * Returns an array of { label, passed } objects for the task-status panel.
   *
   * @param {Array<{ label: string, validate: function }>} tasks
   * @returns {Array<{ label: string, passed: boolean }>}
   */
  checkTasks(tasks) {
    return tasks.map(({ label, validate }) => {
      try {
        return { label, passed: Boolean(validate(this._session.df, this._session.vars)) };
      } catch {
        return { label, passed: false };
      }
    });
  }
}

// ─── Named export of helpers for tests ────────────────────────────────────────
export { parseLine, dispatch, createSession, CMD };
