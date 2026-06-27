/**
 * DataForge — DataTable Widget
 *
 * A live-updating, animated dataset table that renders a DataFrame instance,
 * responds to interpreter ExecutionResults, and drives the full palette of
 * cell/column/row animations described in components.css + animations.css.
 *
 * Used across all code-fix levels (W2L6, W3L6, W4L7, W5L7, W6 final),
 * the drag-and-drop type-tagging level (W1L1), problem-spotting (W1L2),
 * and the indicator-variable level (W2L4).
 *
 * ─── Public API ────────────────────────────────────────────────────────────
 *
 *   new DataTable(container, df, options)
 *   table.update(newDf, sideEffect)      ← called by code editor on each Run
 *   table.applyExecutionResult(result)   ← convenience wrapper for run results
 *   table.highlightColumn(col, flagType) ← W1L2 problem-flagging
 *   table.clearColumnFlag(col)
 *   table.setOutlierMask(col, boolArr)   ← W3: IQR / z-score highlighting
 *   table.clearOutlierMask(col)
 *   table.setTypeBadge(col, type)        ← W1L1 drag-drop type assignment
 *   table.clearTypeBadge(col)
 *   table.flashCell(col, rowIdx, type)   ← manual cell flash ('amber'|'green')
 *   table.flashColumn(col, type)
 *   table.animateRowRemoval(rowIdx)      ← W3 outlier suppression
 *   table.animateColumnAppear(col)       ← W2L4 indicator column added
 *   table.sort(col)                      ← toggle sort on a column
 *   table.showColumnStats(col)           ← mini stats panel (W6 final)
 *   table.hideColumnStats()
 *   table.scrollToColumn(col)
 *   table.destroy()
 *
 *   Events (via addEventListener on the container):
 *     'dt:cell-click'     → { detail: { col, rowIdx, value } }
 *     'dt:column-click'   → { detail: { col } }
 *     'dt:column-flag'    → { detail: { col, flagType } }
 *     'dt:sort-change'    → { detail: { col, direction } }
 *     'dt:stats-open'     → { detail: { col, stats } }
 *
 * ─── Options ───────────────────────────────────────────────────────────────
 *
 *   maxRows       {number}   Max rows to render (default: 100, paginated below)
 *   pageSize      {number}   Rows per virtual page (default: 20)
 *   showIndex     {boolean}  Show row-index column (default: true)
 *   showNullBadges {boolean} Show null-count badges on headers (default: true)
 *   showRanges    {boolean}  Show min–max range under numeric headers (default: true)
 *   showTypeBadges {boolean} Show draggable type badges (W1L1 mode, default: false)
 *   showFlagBar   {boolean}  Show column-flag toolbar on click (W1L2, default: false)
 *   sortable      {boolean}  Enable click-to-sort on headers (default: true)
 *   highlightNulls {boolean} Apply cell--null class to missing cells (default: true)
 *   animateUpdates {boolean} Flash cells on df change (default: true)
 *   compact       {boolean}  Reduced cell padding for wide datasets (default: false)
 *   worldColor    {string}   CSS color for accent highlights (default: var(--color-primary))
 *
 * ─── Table of contents ─────────────────────────────────────────────────────
 *  1.  Constants & helpers
 *  2.  DataTable class
 *       2a.  Constructor / init
 *       2b.  Full render pipeline
 *       2c.  Header row builder
 *       2d.  Data row builder (with virtual pagination)
 *       2e.  Cell renderer
 *       2f.  Live update — applyExecutionResult / update
 *       2g.  Column-diff engine (what changed between two DataFrames)
 *       2h.  Cell animation drivers
 *       2i.  Row removal animation
 *       2j.  Column appear animation
 *       2k.  Sort
 *       2l.  Column flagging (W1L2)
 *       2m.  Type badge assignment (W1L1)
 *       2n.  Outlier mask
 *       2o.  Column stats panel (W6 final)
 *       2p.  Pagination controls
 *       2q.  Event helpers
 *       2r.  Null badges
 *       2s.  DOM helpers
 *       2t.  Destroy / cleanup
 * ──────────────────────────────────────────────────────────────────────────
 */

'use strict';

import { DataFrame, isMissing, inferDtype } from '../pandas/dataframe.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Column flag types and their CSS class / badge color mapping. */
const FLAG_MAP = Object.freeze({
  missing:      { cls: 'col--flagged-missing',     badge: 'badge--danger',  label: '🕳️ Missing Value'  },
  outlier:      { cls: 'col--flagged-outlier',     badge: 'badge--warning', label: '⚡ Outlier'        },
  scale:        { cls: 'col--flagged-scale',       badge: 'badge--primary', label: '📏 Scale Issue'    },
  cardinality:  { cls: 'col--flagged-cardinality', badge: 'badge--world',   label: '🏷️ High Cardinality' },
});

/** Variable-type display config used for type badges (W1L1). */
const TYPE_BADGE_MAP = Object.freeze({
  'numerical-continuous': { label: '~',  color: 'var(--color-world-1)' },
  'numerical-discrete':   { label: '#',  color: 'var(--color-world-1)' },
  'categorical-nominal':  { label: 'N',  color: 'var(--color-world-4)' },
  'categorical-ordinal':  { label: 'O',  color: 'var(--color-world-4)' },
  'temporal':             { label: '⏱', color: 'var(--color-world-5)' },
});

/** How many ms to keep a flash class before removing it. */
const FLASH_DURATION_MS = 900;

/** How many rows trigger pagination controls. */
const PAGINATION_THRESHOLD = 20;

/** Max visible pages in the pagination strip. */
const MAX_PAGE_BUTTONS = 5;

/**
 * Format a cell value for display.
 * Numbers use tabular mono; missing values render as the string "NaN".
 * @param {*} value
 * @param {string} dtype  'int'|'float'|'string'
 * @returns {{ text: string, isMissing: boolean, isNumeric: boolean }}
 */
function formatCell(value, dtype) {
  if (isMissing(value)) {
    return { text: 'NaN', isMissing: true, isNumeric: dtype !== 'string' };
  }
  if (dtype === 'float' && typeof value === 'number') {
    // Up to 4 decimal places, trim trailing zeros
    const formatted = parseFloat(value.toFixed(4)).toString();
    return { text: formatted, isMissing: false, isNumeric: true };
  }
  return { text: String(value), isMissing: false, isNumeric: dtype !== 'string' };
}

/**
 * Deep-equality check for two primitive cell values.
 * Used by the diff engine to decide whether to flash a cell.
 */
function cellChanged(oldVal, newVal) {
  if (isMissing(oldVal) && isMissing(newVal)) return false;
  if (isMissing(oldVal) || isMissing(newVal)) return true;
  return oldVal !== newVal;
}

/** Clamp a number to [min, max]. */
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// ─────────────────────────────────────────────────────────────────────────────
// 2. DataTable CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class DataTable {
  /**
   * @param {HTMLElement} container  — target element; will be populated by this widget
   * @param {DataFrame}   df         — initial DataFrame to display
   * @param {Object}      [options]  — see header comments
   */
  constructor(container, df, options = {}) {
    if (!(container instanceof HTMLElement)) {
      throw new TypeError('DataTable: container must be an HTMLElement.');
    }
    if (!(df instanceof DataFrame)) {
      throw new TypeError('DataTable: df must be a DataFrame instance.');
    }

    this._container = container;
    this._df        = df;

    // ── Merge options with defaults ─────────────────────────────────────
    this._opts = {
      maxRows:        100,
      pageSize:       20,
      showIndex:      true,
      showNullBadges: true,
      showRanges:     true,
      showTypeBadges: false,
      showStatsButtons: true,
      showFlagBar:    false,
      sortable:       true,
      highlightNulls: true,
      animateUpdates: true,
      compact:        false,
      worldColor:     'var(--color-primary)',
      ...options,
    };

    // ── Internal state ─────────────────────────────────────────────────
    this._page         = 0;          // current page (0-based)
    this._sortCol      = null;       // currently sorted column name
    this._sortDir      = 'asc';      // 'asc' | 'desc'
    this._sortedRows   = null;       // cached row-index array after sort
    this._columnFlags  = {};         // { colName: flagType }
    this._typeBadges   = {};         // { colName: typeKey }
    this._outlierMasks = {};         // { colName: boolean[] }
    this._statsPanel   = null;       // currently open stats panel DOM element
    this._statsPanelCol = null;      // column whose stats panel is open

    // Track pending row-removal promises so we don't double-animate
    this._removingRows = new Set();  // Set of rowIdx (in original df)

    // Abort controller for column-stats click-outside listener
    this._statsOutsideAC = null;

    this._render();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2a. CONSTRUCTOR / INIT  (continued in _render)
  // ─────────────────────────────────────────────────────────────────────────

  /** @returns {DataFrame} The current (possibly updated) DataFrame. */
  get df() { return this._df; }

  /** @returns {number} Total rows in the current DataFrame. */
  get rowCount() { return this._df.length; }

  /** @returns {string[]} Column names in the current DataFrame. */
  get columns() { return this._df.columns; }

  // ─────────────────────────────────────────────────────────────────────────
  // 2b. FULL RENDER PIPELINE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Full (re)render of the table.  Called on init and after structural changes
   * (column added, row removed, sort, page change).
   * Animated delta updates use _patchCells() instead.
   * @private
   */
  _render() {
    const { pageSize, compact } = this._opts;

    // ── Recompute sorted row index ──────────────────────────────────────
    this._sortedRows = this._computeSortedRows();

    // ── Pagination window ───────────────────────────────────────────────
    const totalRows  = this._sortedRows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    this._page       = clamp(this._page, 0, totalPages - 1);
    const pageStart  = this._page * pageSize;
    const pageEnd    = Math.min(pageStart + pageSize, totalRows);
    const visibleRows = this._sortedRows.slice(pageStart, pageEnd);

    // ── Build DOM ───────────────────────────────────────────────────────
    const wrap = document.createElement('div');
    wrap.className = 'dt-root';

    // Table info bar
    wrap.appendChild(this._buildInfoBar(totalRows, pageStart, pageEnd));

    // Scrollable table wrapper
    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'data-table-wrapper dt-scroll-wrap';
    scrollWrap.setAttribute('role', 'region');
    scrollWrap.setAttribute('aria-label', 'Dataset table');
    scrollWrap.setAttribute('tabindex', '0');

    const table = document.createElement('table');
    table.className = ['data-table', compact ? 'data-table--compact' : ''].filter(Boolean).join(' ');
    table.setAttribute('aria-rowcount', String(totalRows));
    table.setAttribute('aria-colcount', String(this._df.columns.length + (this._opts.showIndex ? 1 : 0)));

    table.appendChild(this._buildHeader());
    table.appendChild(this._buildBody(visibleRows, pageStart));

    scrollWrap.appendChild(table);
    wrap.appendChild(scrollWrap);

    // Pagination (only when needed)
    if (totalRows > pageSize) {
      wrap.appendChild(this._buildPaginationControls(totalPages));
    }

    // ── Swap into container ─────────────────────────────────────────────
    this._container.innerHTML = '';
    this._container.appendChild(wrap);

    // ── Store refs ──────────────────────────────────────────────────────
    this._tableEl       = table;
    this._scrollWrapEl  = scrollWrap;
    this._wrapEl        = wrap;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2c. HEADER ROW BUILDER
  // ─────────────────────────────────────────────────────────────────────────

  /** @private */
  _buildHeader() {
    const dtypes    = this._df.dtypes();
    const nullSums  = this._opts.showNullBadges ? this._df.isnullSum() : {};
    const thead     = document.createElement('thead');
    const tr        = document.createElement('tr');
    tr.setAttribute('role', 'row');

    // ── Row index column ────────────────────────────────────────────────
    if (this._opts.showIndex) {
      const th = document.createElement('th');
      th.className = 'dt-idx-header';
      th.textContent = '#';
      th.setAttribute('aria-label', 'Row index');
      th.setAttribute('scope', 'col');
      tr.appendChild(th);
    }

    // ── Data columns ────────────────────────────────────────────────────
    for (const col of this._df.columns) {
      const th      = document.createElement('th');
      const dtype   = dtypes[col];
      const nullCnt = nullSums[col] ?? 0;
      const flagType = this._columnFlags[col];
      const typeKey  = this._typeBadges[col];

      th.dataset.col   = col;
      th.dataset.dtype = dtype;
      th.setAttribute('scope', 'col');
      th.setAttribute('aria-sort', this._sortCol === col
        ? (this._sortDir === 'asc' ? 'ascending' : 'descending')
        : 'none'
      );

      // Apply column flag class if set
      if (flagType && FLAG_MAP[flagType]) {
        th.classList.add(FLAG_MAP[flagType].cls.replace('col--', 'th--'));
      }

      // Active sort indicator
      if (this._sortCol === col) {
        th.classList.add('dt-col--sorted');
        th.dataset.sortDir = this._sortDir;
      }

      // ── Inner content ─────────────────────────────────────────────
      const inner = document.createElement('div');
      inner.className = 'th-inner';

      // Type badge (W1L1 drag mode)
      if (this._opts.showTypeBadges) {
        const badge = this._buildTypeBadge(col, typeKey);
        inner.appendChild(badge);
      }

      // Column name
      const nameSpan = document.createElement('span');
      nameSpan.className = 'dt-col-name';
      nameSpan.textContent = col;
      inner.appendChild(nameSpan);

      // Null badge
      if (this._opts.showNullBadges) {
        const nbadge = this._buildNullBadge(col, nullCnt);
        inner.appendChild(nbadge);
      }

      // Flag indicator (W1L2)
      if (flagType && FLAG_MAP[flagType]) {
        const fb = document.createElement('span');
        fb.className = `badge ${FLAG_MAP[flagType].badge} dt-flag-badge`;
        fb.textContent = flagType[0].toUpperCase();
        fb.setAttribute('aria-label', FLAG_MAP[flagType].label);
        inner.appendChild(fb);
      }

      // Sort arrow
      if (this._opts.sortable && dtype !== 'string') {
        const arrow = document.createElement('span');
        arrow.className = 'dt-sort-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = this._sortCol === col
          ? (this._sortDir === 'asc' ? ' ↑' : ' ↓')
          : '';
        inner.appendChild(arrow);
      }

      // Stats icon (W6 final level)
      if (this._opts.showStatsButtons) {
        const statsBtn = document.createElement('button');
        statsBtn.className = 'btn btn--icon dt-stats-btn';
        statsBtn.setAttribute('aria-label', `Column stats for ${col}`);
        statsBtn.setAttribute('type', 'button');
        statsBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          aria-hidden="true" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <rect x="1" y="7" width="2" height="4"/>
          <rect x="5" y="4" width="2" height="7"/>
          <rect x="9" y="1" width="2" height="10"/>
        </svg>`;
        statsBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this._statsPanelCol === col) {
            this.hideColumnStats();
          } else {
            this.showColumnStats(col, statsBtn);
          }
        });
        inner.appendChild(statsBtn);
      }

      th.appendChild(inner);

      // ── Numeric range caption ─────────────────────────────────────
      if (this._opts.showRanges && dtype !== 'string') {
        const series = this._df.col(col);
        const min    = series.min();
        const max    = series.max();
        if (!isNaN(min) && !isNaN(max)) {
          const range = document.createElement('span');
          range.className = 'th-range';
          range.textContent = `${_fmtNum(min)} – ${_fmtNum(max)}`;
          range.setAttribute('aria-label', `Range: ${_fmtNum(min)} to ${_fmtNum(max)}`);
          th.appendChild(range);
        }
      }

      // ── Click handlers ────────────────────────────────────────────
      if (this._opts.sortable) {
        th.style.cursor = 'pointer';
        th.addEventListener('click', (e) => {
          if (e.target.closest('.dt-stats-btn')) return;
          if (e.target.closest('.type-badge')) return;
          this.sort(col);
        });
      }

      // W1L2 flag-bar: right-click or long-press
      if (this._opts.showFlagBar) {
        th.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this._showFlagToolbar(col, th);
        });
      }

      this._emitColumnClick(th, col);
      tr.appendChild(th);
    }

    thead.appendChild(tr);
    return thead;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2d. DATA ROW BUILDER (virtual pagination)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Build the <tbody> for the visible row window.
   * @param {number[]} visibleRowIndices  — original df row indices to render
   * @param {number}   pageStart          — for aria-rowindex
   * @private
   */
  _buildBody(visibleRowIndices, pageStart) {
    const dtypes = this._df.dtypes();
    const tbody  = document.createElement('tbody');

    for (let i = 0; i < visibleRowIndices.length; i++) {
      const rowIdx = visibleRowIndices[i];
      const tr     = document.createElement('tr');
      tr.dataset.rowIdx = rowIdx;
      tr.setAttribute('aria-rowindex', String(pageStart + i + 2)); // +2: header is row 1

      // Index cell
      if (this._opts.showIndex) {
        const td = document.createElement('td');
        td.className = 'dt-idx-cell';
        td.textContent = String(rowIdx);
        td.setAttribute('aria-label', `Row ${rowIdx}`);
        tr.appendChild(td);
      }

      // Data cells
      for (const col of this._df.columns) {
        const value = this._df._data[col][rowIdx];
        const td    = this._buildCell(col, rowIdx, value, dtypes[col]);
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    }

    // Empty state
    if (visibleRowIndices.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = this._df.columns.length + (this._opts.showIndex ? 1 : 0);
      td.className = 'dt-empty-state';
      td.textContent = 'No rows to display.';
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    return tbody;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2e. CELL RENDERER
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Build a single <td> element.
   * @param {string} col
   * @param {number} rowIdx  — original DataFrame row index
   * @param {*}      value
   * @param {string} dtype
   * @returns {HTMLTableCellElement}
   * @private
   */
  _buildCell(col, rowIdx, value, dtype) {
    const { text, isMissing: missing, isNumeric } = formatCell(value, dtype);
    const isOutlier = (this._outlierMasks[col] ?? [])[rowIdx] === true;

    const td = document.createElement('td');
    td.dataset.col    = col;
    td.dataset.rowIdx = String(rowIdx);
    td.setAttribute('role', 'gridcell');

    // CSS classes
    const classes = [];
    if (missing && this._opts.highlightNulls) classes.push('cell--null');
    if (isOutlier) classes.push('cell--outlier');
    if (isNumeric) classes.push('dt-cell--numeric');
    if (classes.length) td.className = classes.join(' ');

    // Value display
    if (missing) {
      td.innerHTML = `<span class="dt-null-text" aria-label="Missing value">NaN</span>`;
    } else {
      const span = document.createElement('span');
      span.className = 'dt-cell-value';
      span.textContent = text;
      td.appendChild(span);
    }

    // Click handler (emits dt:cell-click)
    td.addEventListener('click', () => {
      this._emit('dt:cell-click', { col, rowIdx, value });
    });

    return td;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2f. LIVE UPDATE — applyExecutionResult / update
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Primary external update path.
   * Called by the code editor widget after every successful ▶ Run.
   *
   * Inspects the ExecutionResult's sideEffect to decide between:
   *   • Full re-render  (structural change: columns added/removed, rows removed)
   *   • Cell patch      (values changed, no structure change)
   *   • No-op           (exploration command — df unchanged)
   *
   * @param {import('./interpreter.js').ExecutionResult} result
   */
  applyExecutionResult(result) {
    if (!result || result.status === 'error') return;

    const newDf = result.df;
    if (!(newDf instanceof DataFrame)) return; // exploration result — no df change

    this.update(newDf, result.sideEffect);
  }

  /**
   * Update the table to display a new DataFrame.
   * Automatically selects full re-render vs. animated cell patch.
   *
   * @param {DataFrame} newDf
   * @param {Object|null} [sideEffect]  — from ExecutionResult; informs animation strategy
   */
  update(newDf, sideEffect = null) {
    if (!(newDf instanceof DataFrame)) return;

    const oldDf    = this._df;
    const sideType = sideEffect?.type ?? null;

    // ── Detect structural change ────────────────────────────────────────
    const colsAdded   = newDf.columns.filter(c => !oldDf.columns.includes(c));
    const colsRemoved = oldDf.columns.filter(c => !newDf.columns.includes(c));
    const rowsRemoved = newDf.length < oldDf.length;
    const colsChanged = oldDf.columns.length !== newDf.columns.length;

    const isStructural = colsAdded.length > 0 || colsRemoved.length > 0 || rowsRemoved;

    // Update stored df
    this._df = newDf;

    if (isStructural) {
      // ── Animate outgoing rows before re-rendering ───────────────────
      if (rowsRemoved && sideType === 'remove_outliers' || sideType === 'filter') {
        const removedCount  = oldDf.length - newDf.length;
        const newRowValues  = new Set(newDf._toRows().map(r => JSON.stringify(r)));
        const removedIndices = [];

        for (let i = 0; i < oldDf.length; i++) {
          const rowKey = JSON.stringify(oldDf.iloc(i));
          if (!newRowValues.has(rowKey)) removedIndices.push(i);
        }

        // Animate removed rows, then full re-render
        const animDone = removedIndices.map(idx => this.animateRowRemoval(idx));
        Promise.all(animDone).then(() => {
          this._page = 0;
          this._sortedRows = null;
          this._sortCol = null;
          this._render();
          if (colsAdded.length) {
            colsAdded.forEach(col => this.animateColumnAppear(col));
          }
        });
      } else {
        // Immediate structural re-render
        this._page = 0;
        this._sortedRows = null;
        this._render();

        // Announce new columns with appear animation
        colsAdded.forEach(col => this.animateColumnAppear(col));
      }

      // Update null badges regardless
      this._refreshNullBadges();
    } else {
      // ── Animated cell patch ────────────────────────────────────────
      if (this._opts.animateUpdates) {
        this._patchCells(oldDf, newDf, sideEffect);
      } else {
        this._render();
      }
      this._refreshNullBadges();
      this._refreshHeaderRanges();
    }

    this._emit('dt:updated', { df: newDf, sideEffect });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2g. COLUMN-DIFF ENGINE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Compare two DataFrames and animate cells that changed value.
   * Only processes cells that are currently visible on the active page.
   *
   * @param {DataFrame} oldDf
   * @param {DataFrame} newDf
   * @param {Object|null} sideEffect
   * @private
   */
  _patchCells(oldDf, newDf, sideEffect) {
    const { pageSize } = this._opts;
    const pageStart    = this._page * pageSize;
    const visibleRows  = this._sortedRows
      ? this._sortedRows.slice(pageStart, pageStart + pageSize)
      : Array.from({ length: Math.min(pageSize, newDf.length) }, (_, i) => pageStart + i);

    // Determine which columns changed
    const sharedCols = oldDf.columns.filter(c => newDf.columns.includes(c));

    for (const col of sharedCols) {
      const oldVals = oldDf._data[col];
      const newVals = newDf._data[col];
      const dtype   = inferDtype(newVals);

      for (const rowIdx of visibleRows) {
        if (rowIdx >= newDf.length) continue;

        const oldVal = oldVals[rowIdx];
        const newVal = newVals[rowIdx];

        if (!cellChanged(oldVal, newVal)) continue;

        // Find the cell element
        const td = this._getCellEl(col, rowIdx);
        if (!td) continue;

        // Patch the cell value in-place
        const wasMissing = isMissing(oldVal);
        const nowMissing = isMissing(newVal);

        if (wasMissing && !nowMissing) {
          // NaN → filled: remove null class, update content
          td.classList.remove('cell--null');
          td.innerHTML = '';
          const span = document.createElement('span');
          span.className = 'dt-cell-value';
          span.textContent = formatCell(newVal, dtype).text;
          td.appendChild(span);
          this.flashCell(col, rowIdx, 'green');
        } else if (!wasMissing && nowMissing) {
          // Value → NaN: add null class
          td.classList.add('cell--null');
          td.innerHTML = `<span class="dt-null-text" aria-label="Missing value">NaN</span>`;
          this.flashCell(col, rowIdx, 'amber');
        } else if (!nowMissing) {
          // Value changed
          const cellSpan = td.querySelector('.dt-cell-value');
          if (cellSpan) {
            cellSpan.textContent = formatCell(newVal, dtype).text;
          } else {
            td.innerHTML = '';
            const span = document.createElement('span');
            span.className = 'dt-cell-value';
            span.textContent = formatCell(newVal, dtype).text;
            td.appendChild(span);
          }

          // Outlier masking (e.g. after clip)
          const isOutlier = (this._outlierMasks[col] ?? [])[rowIdx] === true;
          td.classList.toggle('cell--outlier', isOutlier);
          this.flashCell(col, rowIdx, 'amber');
        }

        td.dataset.value = String(newVal);
      }
    }

    // Rebuild sorted row cache if the sort column was modified
    if (this._sortCol && sharedCols.includes(this._sortCol)) {
      this._sortedRows = this._computeSortedRows();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2h. CELL ANIMATION DRIVERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Flash a single cell with a CSS animation class.
   * @param {string} col
   * @param {number} rowIdx
   * @param {'amber'|'green'} type
   */
  flashCell(col, rowIdx, type = 'amber') {
    const td = this._getCellEl(col, rowIdx);
    if (!td) return;
    const cls = type === 'green' ? 'cell--correct-fill' : 'cell--updated';
    this._triggerClass(td, cls, FLASH_DURATION_MS);
  }

  /**
   * Flash every cell in a column.
   * @param {string} col
   * @param {'amber'|'green'} [type='amber']
   * @param {number} [staggerMs=20]  delay between rows
   */
  flashColumn(col, type = 'amber', staggerMs = 20) {
    const tbody = this._tableEl?.querySelector('tbody');
    if (!tbody) return;

    const cells = tbody.querySelectorAll(`td[data-col="${CSS.escape(col)}"]`);
    cells.forEach((td, i) => {
      const cls = type === 'green' ? 'cell--correct-fill' : 'cell--updated';
      setTimeout(() => this._triggerClass(td, cls, FLASH_DURATION_MS), i * staggerMs);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2i. ROW REMOVAL ANIMATION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Animate a row fading out (outlier suppression / filter).
   * Returns a Promise that resolves when the animation finishes.
   * @param {number} rowIdx  — original DataFrame row index
   * @returns {Promise<void>}
   */
  animateRowRemoval(rowIdx) {
    if (this._removingRows.has(rowIdx)) return Promise.resolve();
    this._removingRows.add(rowIdx);

    const tr = this._tableEl?.querySelector(`tr[data-row-idx="${rowIdx}"]`);
    if (!tr) {
      this._removingRows.delete(rowIdx);
      return Promise.resolve();
    }

    return new Promise(resolve => {
      // First flash red to signal "this is the outlier"
      tr.style.background = 'var(--color-danger-dim)';
      tr.style.color      = 'var(--color-danger)';

      setTimeout(() => {
        tr.classList.add('cell--row-deleted');
        tr.style.overflow = 'hidden';

        const onEnd = () => {
          tr.removeEventListener('animationend', onEnd);
          this._removingRows.delete(rowIdx);
          resolve();
        };
        tr.addEventListener('animationend', onEnd);

        // Fallback timeout in case animationend never fires
        setTimeout(() => {
          this._removingRows.delete(rowIdx);
          resolve();
        }, 600);
      }, 300);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2j. COLUMN APPEAR ANIMATION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Animate a newly-added column sliding in from the right.
   * Called after a structural re-render that added a column.
   * @param {string} col
   */
  animateColumnAppear(col) {
    const escaped = CSS.escape(col);
    // Header cell
    const th = this._tableEl?.querySelector(`th[data-col="${escaped}"]`);
    if (th) this._triggerClass(th, 'col--new', 800);

    // Body cells
    const tbody = this._tableEl?.querySelector('tbody');
    if (!tbody) return;
    const cells = tbody.querySelectorAll(`td[data-col="${escaped}"]`);
    cells.forEach((td, i) => {
      setTimeout(() => this._triggerClass(td, 'col--new', 800), i * 15);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2k. SORT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Toggle sort on a column.  Cycles: none → asc → desc → none.
   * Triggers a full re-render to reorder rows.
   * @param {string} col
   */
  sort(col) {
    if (this._sortCol === col) {
      if (this._sortDir === 'asc')  this._sortDir = 'desc';
      else { this._sortCol = null; this._sortDir = 'asc'; }
    } else {
      this._sortCol = col;
      this._sortDir = 'asc';
    }
    this._page = 0;
    this._render();
    this._emit('dt:sort-change', { col, direction: this._sortDir });
  }

  /**
   * Compute the sorted row-index array from the current df + sort state.
   * @returns {number[]}
   * @private
   */
  _computeSortedRows() {
    const n = this._df.length;
    const indices = Array.from({ length: n }, (_, i) => i);

    if (!this._sortCol || !this._df.columns.includes(this._sortCol)) {
      return indices;
    }

    const vals = this._df._data[this._sortCol];
    const dir  = this._sortDir === 'asc' ? 1 : -1;

    return indices.sort((a, b) => {
      const va = vals[a];
      const vb = vals[b];
      if (isMissing(va) && isMissing(vb)) return 0;
      if (isMissing(va)) return 1;   // missing always last
      if (isMissing(vb)) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return dir * (va - vb);
      return dir * String(va).localeCompare(String(vb));
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2l. COLUMN FLAGGING (W1L2 — Spot the Problems)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Flag a column with a problem type.  Adds a visual flag to the header
   * and applies a tinted background to that column's cells.
   * @param {string} col
   * @param {'missing'|'outlier'|'scale'|'cardinality'} flagType
   */
  highlightColumn(col, flagType) {
    if (!FLAG_MAP[flagType]) return;

    const prev = this._columnFlags[col];
    if (prev === flagType) return; // already set

    this._columnFlags[col] = flagType;

    // Update header
    const th = this._tableEl?.querySelector(`th[data-col="${CSS.escape(col)}"]`);
    if (th) {
      // Remove any previous flag class
      if (prev) this._removeFlagClass(th, prev);
      const thClass = FLAG_MAP[flagType].cls.replace('col--', 'th--');
      th.classList.add(thClass);

      // Update / add flag badge in header
      let badge = th.querySelector('.dt-flag-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = `badge dt-flag-badge`;
        th.querySelector('.th-inner')?.appendChild(badge);
      }
      badge.className = `badge ${FLAG_MAP[flagType].badge} dt-flag-badge`;
      badge.textContent = flagType[0].toUpperCase();
      badge.setAttribute('aria-label', FLAG_MAP[flagType].label);
    }

    // Tint the column's visible cells
    const tbody = this._tableEl?.querySelector('tbody');
    if (tbody) {
      const cells = tbody.querySelectorAll(`td[data-col="${CSS.escape(col)}"]`);
      cells.forEach(td => {
        if (prev) td.classList.remove(FLAG_MAP[prev].cls);
        td.classList.add(FLAG_MAP[flagType].cls);
      });
    }

    this._emit('dt:column-flag', { col, flagType });
  }

  /**
   * Remove the flag from a column.
   * @param {string} col
   */
  clearColumnFlag(col) {
    const prev = this._columnFlags[col];
    if (!prev) return;

    delete this._columnFlags[col];

    const th = this._tableEl?.querySelector(`th[data-col="${CSS.escape(col)}"]`);
    if (th) {
      this._removeFlagClass(th, prev);
      th.querySelector('.dt-flag-badge')?.remove();
    }

    const tbody = this._tableEl?.querySelector('tbody');
    if (tbody) {
      tbody.querySelectorAll(`td[data-col="${CSS.escape(col)}"]`)
        .forEach(td => td.classList.remove(FLAG_MAP[prev].cls));
    }
  }

  /** @private */
  _removeFlagClass(th, flagType) {
    const thClass = FLAG_MAP[flagType]?.cls?.replace('col--', 'th--');
    if (thClass) th.classList.remove(thClass);
  }

  /**
   * Show the floating flag-selection toolbar for a column (W1L2).
   * @param {string} col
   * @param {HTMLElement} thEl
   * @private
   */
  _showFlagToolbar(col, thEl) {
    // Remove any existing toolbar
    this._container.querySelectorAll('.dt-flag-toolbar').forEach(el => el.remove());

    const toolbar = document.createElement('div');
    toolbar.className = 'dt-flag-toolbar';
    toolbar.setAttribute('role', 'menu');
    toolbar.setAttribute('aria-label', `Flag column ${col}`);

    Object.entries(FLAG_MAP).forEach(([type, meta]) => {
      const btn = document.createElement('button');
      btn.className = `btn btn--sm ${meta.badge.replace('badge--', 'btn--')} dt-flag-option`;
      btn.textContent = meta.label;
      btn.setAttribute('role', 'menuitem');
      btn.type = 'button';
      btn.addEventListener('click', () => {
        this.highlightColumn(col, type);
        toolbar.remove();
      });
      toolbar.appendChild(btn);
    });

    // Position below the th
    const rect = thEl.getBoundingClientRect();
    const wrapRect = this._container.getBoundingClientRect();
    toolbar.style.top  = `${rect.bottom - wrapRect.top + 4}px`;
    toolbar.style.left = `${rect.left  - wrapRect.left}px`;

    this._container.style.position = 'relative';
    this._container.appendChild(toolbar);

    // Click-outside to close
    const close = (e) => {
      if (!toolbar.contains(e.target) && !thEl.contains(e.target)) {
        toolbar.remove();
        document.removeEventListener('click', close, true);
      }
    };
    setTimeout(() => document.addEventListener('click', close, true), 0);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2m. TYPE BADGE ASSIGNMENT (W1L1 — What Are We Working With?)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Assign a variable-type badge to a column header (W1L1 mode).
   * Reflects the player dragging the column to the correct bucket.
   * @param {string} col
   * @param {string} typeKey  — one of TYPE_BADGE_MAP keys
   */
  setTypeBadge(col, typeKey) {
    this._typeBadges[col] = typeKey;

    const th = this._tableEl?.querySelector(`th[data-col="${CSS.escape(col)}"]`);
    if (!th) return;

    const badge = th.querySelector('.type-badge');
    if (!badge) return;

    const meta = TYPE_BADGE_MAP[typeKey];
    if (!meta) return;

    badge.textContent = meta.label;
    badge.style.color           = meta.color;
    badge.style.borderColor     = meta.color;
    badge.style.boxShadow       = `0 0 8px ${meta.color}40`;
    badge.classList.add('type-badge--assigned');
    badge.setAttribute('title', typeKey.replace(/-/g, ' '));

    // Highlight the column
    this._highlightColumnCells(col, 'cell--highlight', 800);

    this._emit('dt:type-badge-set', { col, typeKey });
  }

  /** Remove type assignment from a column. */
  clearTypeBadge(col) {
    delete this._typeBadges[col];
    const th = this._tableEl?.querySelector(`th[data-col="${CSS.escape(col)}"]`);
    const badge = th?.querySelector('.type-badge');
    if (!badge) return;

    badge.classList.remove('type-badge--assigned');
    badge.textContent = '?';
    badge.style.color = '';
    badge.style.borderColor = '';
    badge.style.boxShadow = '';
    badge.removeAttribute('title');
  }

  /**
   * Build the draggable type badge element.
   * @param {string} col
   * @param {string|undefined} typeKey
   * @private
   */
  _buildTypeBadge(col, typeKey) {
    const badge = document.createElement('span');
    badge.className = 'type-badge';
    badge.setAttribute('draggable', 'true');
    badge.setAttribute('aria-label', `Drag to classify ${col}`);
    badge.setAttribute('role', 'button');
    badge.dataset.col = col;

    if (typeKey && TYPE_BADGE_MAP[typeKey]) {
      const meta = TYPE_BADGE_MAP[typeKey];
      badge.textContent        = meta.label;
      badge.style.color        = meta.color;
      badge.style.borderColor  = meta.color;
      badge.classList.add('type-badge--assigned');
    } else {
      badge.textContent = '?';
    }

    // Drag start: announce which column is being dragged
    badge.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', col);
      e.dataTransfer.effectAllowed = 'move';
      badge.classList.add('drag-token--dragging');
      this._emit('dt:badge-drag-start', { col });
    });
    badge.addEventListener('dragend', () => {
      badge.classList.remove('drag-token--dragging');
    });

    return badge;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2n. OUTLIER MASK
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Apply a boolean outlier mask to a column.
   * Cells where mask[i] === true receive the cell--outlier class.
   * @param {string}    col
   * @param {boolean[]} mask  — length must equal df.length
   */
  setOutlierMask(col, mask) {
    if (!Array.isArray(mask) || mask.length !== this._df.length) {
      console.warn(`DataTable.setOutlierMask: mask length mismatch for "${col}".`);
      return;
    }
    this._outlierMasks[col] = mask;

    const tbody = this._tableEl?.querySelector('tbody');
    if (!tbody) return;

    const cells = tbody.querySelectorAll(`td[data-col="${CSS.escape(col)}"]`);
    cells.forEach(td => {
      const rowIdx = parseInt(td.dataset.rowIdx, 10);
      const isOut  = mask[rowIdx] === true;
      td.classList.toggle('cell--outlier', isOut);
    });
  }

  /**
   * Remove the outlier mask from a column.
   * @param {string} col
   */
  clearOutlierMask(col) {
    delete this._outlierMasks[col];

    const tbody = this._tableEl?.querySelector('tbody');
    if (!tbody) return;

    tbody.querySelectorAll(`td[data-col="${CSS.escape(col)}"]`)
      .forEach(td => td.classList.remove('cell--outlier'));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2o. COLUMN STATS PANEL (W6 final level)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Show a mini statistics panel anchored below a column header.
   * @param {string}      col
   * @param {HTMLElement} [anchorEl]  — element to position relative to (th or stats btn)
   */
  showColumnStats(col, anchorEl) {
    this.hideColumnStats();

    if (!this._df.columns.includes(col)) return;

    const series  = this._df.col(col);
    const stats   = series.describe();
    const nullCnt = series.nullCount();
    const total   = this._df.length;

    const panel = document.createElement('div');
    panel.className = 'dt-stats-panel card card--elevated';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', `Statistics for column ${col}`);

    // Header
    const header = document.createElement('div');
    header.className = 'dt-stats-header';
    header.innerHTML = `
      <span class="dt-stats-col-name font-mono font-bold">${_escHtml(col)}</span>
      <span class="badge badge--muted">${series.dtype}</span>
    `;
    panel.appendChild(header);

    // Stats table
    const rows  = Object.entries(stats);
    const stTbl = document.createElement('table');
    stTbl.className = 'dt-stats-table';

    rows.forEach(([key, val]) => {
      const tr  = stTbl.insertRow();
      const tdK = tr.insertCell();
      const tdV = tr.insertCell();
      tdK.className = 'dt-stats-key text-muted text-xs';
      tdV.className = 'dt-stats-val font-mono text-sm';
      tdK.textContent = key;
      tdV.textContent = val == null ? 'N/A'
        : typeof val === 'number' ? _fmtNum(val)
        : String(val);
    });

    // Null row
    const nullTr = stTbl.insertRow();
    const nk = nullTr.insertCell(); nk.className = 'dt-stats-key text-muted text-xs';
    const nv = nullTr.insertCell(); nv.className = 'dt-stats-val font-mono text-sm';
    nk.textContent = 'nulls';
    nv.innerHTML = nullCnt > 0
      ? `<span class="null-badge">${nullCnt}</span>&thinsp;/ ${total}`
      : `<span class="null-badge null-badge--zero">0</span>`;

    panel.appendChild(stTbl);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn--icon btn--subtle dt-stats-close';
    closeBtn.setAttribute('aria-label', 'Close stats');
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.hideColumnStats());
    panel.appendChild(closeBtn);

    // Position
    if (anchorEl) {
      const anchorRect = anchorEl.getBoundingClientRect();
      const wrapRect   = this._container.getBoundingClientRect();
      this._container.style.position = 'relative';
      panel.style.top  = `${anchorRect.bottom - wrapRect.top + 4}px`;
      panel.style.left = `${anchorRect.left  - wrapRect.left}px`;
    }

    this._container.appendChild(panel);
    this._statsPanel    = panel;
    this._statsPanelCol = col;

    // Fade in
    panel.style.opacity = '0';
    requestAnimationFrame(() => {
      panel.style.transition = 'opacity 150ms ease-out';
      panel.style.opacity    = '1';
    });

    // Click-outside to close
    this._statsOutsideAC = new AbortController();
    document.addEventListener('click', (e) => {
      if (!panel.contains(e.target) && !anchorEl?.contains(e.target)) {
        this.hideColumnStats();
      }
    }, { capture: true, signal: this._statsOutsideAC.signal });

    this._emit('dt:stats-open', { col, stats });
  }

  /** Close the column stats panel. */
  hideColumnStats() {
    if (this._statsPanel) {
      this._statsPanel.remove();
      this._statsPanel    = null;
      this._statsPanelCol = null;
    }
    this._statsOutsideAC?.abort();
    this._statsOutsideAC = null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2p. PAGINATION CONTROLS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Build the pagination control bar.
   * @param {number} totalPages
   * @private
   */
  _buildPaginationControls(totalPages) {
    const bar = document.createElement('div');
    bar.className = 'dt-pagination';
    bar.setAttribute('role', 'navigation');
    bar.setAttribute('aria-label', 'Table pagination');

    const current  = this._page;
    const pageSize = this._opts.pageSize;
    const total    = this._df.length;
    const start    = current * pageSize + 1;
    const end      = Math.min((current + 1) * pageSize, total);

    // Row range label
    const label = document.createElement('span');
    label.className = 'dt-pagination-label text-muted text-xs font-mono';
    label.textContent = `${start}–${end} of ${total} rows`;
    bar.appendChild(label);

    // Page buttons
    const btnGroup = document.createElement('div');
    btnGroup.className = 'dt-pagination-btns';

    // Previous
    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn btn--sm btn--subtle dt-page-prev';
    prevBtn.type = 'button';
    prevBtn.textContent = '←';
    prevBtn.disabled = current === 0;
    prevBtn.setAttribute('aria-label', 'Previous page');
    prevBtn.addEventListener('click', () => { this._page--; this._render(); });
    btnGroup.appendChild(prevBtn);

    // Page number buttons (windowed)
    const half   = Math.floor(MAX_PAGE_BUTTONS / 2);
    let startPage = Math.max(0, current - half);
    let endPage   = Math.min(totalPages - 1, startPage + MAX_PAGE_BUTTONS - 1);
    startPage = Math.max(0, endPage - MAX_PAGE_BUTTONS + 1);

    for (let p = startPage; p <= endPage; p++) {
      const btn = document.createElement('button');
      btn.className = `btn btn--sm ${p === current ? 'btn--primary' : 'btn--subtle'} dt-page-btn`;
      btn.type = 'button';
      btn.textContent = String(p + 1);
      btn.setAttribute('aria-label', `Page ${p + 1}`);
      btn.setAttribute('aria-current', p === current ? 'page' : 'false');
      if (p === current) btn.disabled = true;
      else btn.addEventListener('click', () => { this._page = p; this._render(); });
      btnGroup.appendChild(btn);
    }

    // Next
    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn--sm btn--subtle dt-page-next';
    nextBtn.type = 'button';
    nextBtn.textContent = '→';
    nextBtn.disabled = current >= totalPages - 1;
    nextBtn.setAttribute('aria-label', 'Next page');
    nextBtn.addEventListener('click', () => { this._page++; this._render(); });
    btnGroup.appendChild(nextBtn);

    bar.appendChild(btnGroup);
    return bar;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2q. EVENT HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Dispatch a custom event on the container.
   * @param {string} name
   * @param {Object} [detail={}]
   * @private
   */
  _emit(name, detail = {}) {
    this._container.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
  }

  /**
   * Wire a column header click to emit dt:column-click.
   * @private
   */
  _emitColumnClick(thEl, col) {
    thEl.addEventListener('click', (e) => {
      if (e.target.closest('.dt-stats-btn')) return;
      this._emit('dt:column-click', { col });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2r. NULL BADGES
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Rebuild a single null-count badge element.
   * @param {string} col
   * @param {number} count
   * @private
   */
  _buildNullBadge(col, count) {
    const badge = document.createElement('span');
    badge.className   = count > 0 ? 'null-badge dt-null-badge' : 'null-badge null-badge--zero dt-null-badge';
    badge.dataset.col = col;
    badge.textContent = String(count);
    badge.setAttribute('aria-label', `${count} null values in ${col}`);
    return badge;
  }

  /**
   * Live-refresh null badges on all headers after a df update.
   * @private
   */
  _refreshNullBadges() {
    if (!this._opts.showNullBadges || !this._tableEl) return;
    const nullSums = this._df.isnullSum();

    for (const col of this._df.columns) {
      const badge = this._tableEl.querySelector(`.dt-null-badge[data-col="${CSS.escape(col)}"]`);
      if (!badge) continue;

      const count = nullSums[col] ?? 0;
      badge.textContent = String(count);
      badge.className   = count > 0
        ? 'null-badge dt-null-badge'
        : 'null-badge null-badge--zero dt-null-badge';
      badge.setAttribute('aria-label', `${count} null values in ${col}`);

      // Pop animation on change
      this._triggerClass(badge, 'anim-correct-pop', 400);
    }
  }

  /**
   * Live-refresh range captions on all numeric headers.
   * @private
   */
  _refreshHeaderRanges() {
    if (!this._opts.showRanges || !this._tableEl) return;
    const dtypes = this._df.dtypes();

    for (const col of this._df.columns) {
      if (dtypes[col] === 'string') continue;
      const th    = this._tableEl.querySelector(`th[data-col="${CSS.escape(col)}"]`);
      const range = th?.querySelector('.th-range');
      if (!range) continue;

      const series = this._df.col(col);
      const min    = series.min();
      const max    = series.max();
      if (!isNaN(min) && !isNaN(max)) {
        range.textContent = `${_fmtNum(min)} – ${_fmtNum(max)}`;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2s. DOM HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get a cell element by column name and row index.
   * Returns null if not currently rendered (off-page or table not mounted).
   * @param {string} col
   * @param {number} rowIdx
   * @returns {HTMLTableCellElement|null}
   */
  _getCellEl(col, rowIdx) {
    return this._tableEl?.querySelector(
      `td[data-col="${CSS.escape(col)}"][data-row-idx="${rowIdx}"]`
    ) ?? null;
  }

  /**
   * Temporarily add a CSS class to an element, then remove it after ms.
   * Force-reflows between remove/add to re-trigger a keyframe.
   * @param {HTMLElement} el
   * @param {string}      cls
   * @param {number}      [ms]
   * @private
   */
  _triggerClass(el, cls, ms = FLASH_DURATION_MS) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth; // force reflow
    el.classList.add(cls);
    if (ms > 0) {
      setTimeout(() => el.classList.remove(cls), ms);
    }
  }

  /**
   * Temporarily highlight all cells in a column.
   * @param {string} col
   * @param {string} cls
   * @param {number} ms
   * @private
   */
  _highlightColumnCells(col, cls, ms) {
    const tbody = this._tableEl?.querySelector('tbody');
    if (!tbody) return;
    tbody.querySelectorAll(`td[data-col="${CSS.escape(col)}"]`)
      .forEach(td => this._triggerClass(td, cls, ms));
  }

  /**
   * Build the info bar shown above the table (row count, df shape).
   * @param {number} total
   * @param {number} start
   * @param {number} end
   * @private
   */
  _buildInfoBar(total, start, end) {
    const bar = document.createElement('div');
    bar.className = 'dt-info-bar';
    bar.innerHTML = `
      <span class="dt-shape badge badge--muted font-mono">
        ${total}&nbsp;×&nbsp;${this._df.columns.length}
      </span>
      <span class="dt-page-info text-muted text-xs">
        Showing rows ${start + 1}–${end}
      </span>
    `;
    return bar;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public navigation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Scroll the table horizontally so that a column is in view.
   * @param {string} col
   */
  scrollToColumn(col) {
    const th = this._tableEl?.querySelector(`th[data-col="${CSS.escape(col)}"]`);
    if (th && this._scrollWrapEl) {
      const thRect   = th.getBoundingClientRect();
      const wrapRect = this._scrollWrapEl.getBoundingClientRect();
      this._scrollWrapEl.scrollLeft += thRect.left - wrapRect.left - 16;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2t. DESTROY / CLEANUP
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Teardown the widget: remove DOM, abort listeners.
   * Call when the level is torn down.
   */
  destroy() {
    this.hideColumnStats();
    this._container.innerHTML = '';
    this._sortedRows   = null;
    this._removingRows.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE-PRIVATE UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a number for display in range captions and stats.
 * Keeps up to 2 decimal places and uses compact notation for large numbers.
 * @param {number} n
 * @returns {string}
 */
function _fmtNum(n) {
  if (!isFinite(n)) return String(n);
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000)     return (n / 1_000).toFixed(1) + 'k';
  if (Number.isInteger(n))       return String(n);
  return parseFloat(n.toFixed(2)).toString();
}

/**
 * Minimal HTML escape for dynamic strings in innerHTML.
 * @param {string} str
 * @returns {string}
 */
function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
