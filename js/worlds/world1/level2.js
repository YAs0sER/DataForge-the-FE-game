'use strict';

import { getLevelProblem } from '../../data/problems.js';
import { createDataset } from '../../data/datasets.js';
import { DataTable } from '../../widgets/datatable.js';

const PROBLEM = getLevelProblem(1, 2);

const FLAG_LABELS = Object.freeze({
  missing: 'Missing Value',
  outlier: 'Outlier',
  scale: 'Scale Issue',
  cardinality: 'High Cardinality',
});

const FLAG_ORDER = Object.freeze(['missing', 'outlier', 'scale', 'cardinality']);

const FINDINGS = Object.freeze([
  {
    id: 'missing-age',
    type: 'missing',
    kind: 'cell',
    col: 'Age',
    rowIdx: 2,
    title: 'Missing Value',
    trackerCopy: 'Find the empty Age cell hidden in the messy table.',
    success: 'That blank Age entry is missing data. World 2 will teach you how to repair it safely.',
    explanation: 'Missing values represent absent information. If you do not handle them, they can break statistics, model training, or both.',
    chapter: 'World 2 - Missing Data',
    color: 'var(--color-world-2)',
  },
  {
    id: 'salary-outlier',
    type: 'outlier',
    kind: 'cell',
    col: 'Salary',
    rowIdx: 6,
    title: 'Outlier',
    trackerCopy: 'Catch the one salary value that dwarfs the rest.',
    success: '999999 is the rogue value here. World 3 will show you how to cap or remove extremes like this.',
    explanation: 'Outliers are isolated extremes that can bend averages, ranges, and model behavior far away from the typical pattern.',
    chapter: 'World 3 - Outliers',
    color: 'var(--color-world-3)',
  },
  {
    id: 'city-cardinality',
    type: 'cardinality',
    kind: 'column',
    col: 'City',
    rowIdx: null,
    title: 'High Cardinality',
    trackerCopy: 'Spot the category column that keeps introducing new names.',
    success: 'City has too many distinct values for such a small sample. World 4 will cover how to group and encode it.',
    explanation: 'High-cardinality categoricals explode into many categories, which can make encoding noisy, sparse, and harder to generalize.',
    chapter: 'World 4 - Encoding',
    color: 'var(--color-world-4)',
  },
  {
    id: 'salary-scale',
    type: 'scale',
    kind: 'column',
    col: 'Salary',
    rowIdx: null,
    title: 'Scale Issue',
    trackerCopy: 'Find the numeric column whose range dominates the others.',
    success: 'Salary lives on a much larger scale than the other numeric columns. World 5 will show how to rebalance that.',
    explanation: 'Scale issues happen when one numeric feature lives on a much larger range than the rest, which can dominate distance-based models.',
    chapter: 'World 5 - Scaling',
    color: 'var(--color-world-5)',
  },
]);

const DEFAULT_FEEDBACK = 'Start with the obvious clues: one Age cell is blank, and one Salary value is wildly larger than the rest.';
const DEFAULT_STATUS = 'Click a column header for column-wide issues, or click a suspicious cell for point issues.';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sameSelection(selection, finding) {
  if (!selection || !finding) return false;
  if (selection.kind !== finding.kind) return false;
  if (selection.col !== finding.col) return false;

  if (selection.kind === 'column') {
    return true;
  }

  return selection.rowIdx === finding.rowIdx;
}

function selectionLabel(selection) {
  if (!selection) return 'this selection';
  if (selection.kind === 'column') {
    return `${selection.col} column`;
  }
  return `${selection.col}, row ${selection.rowIdx + 1}`;
}

export default class World1Level2 {
  meta = {
    title: PROBLEM?.title ?? 'Spot the Problems',
    subtitle: PROBLEM?.objective ?? 'Find the four common feature-engineering problems in the messy table.',
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._dataset = createDataset(PROBLEM.datasetKey);
    this._table = null;
    this._events = null;
    this._selection = null;
    this._completed = false;
    this._solved = new Set();
    this._ui = {};
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w1-level w1-level--problems screen-section" aria-label="World 1 Level 2">
        <div class="level-hero w1-level__hero" style="--world-color: var(--color-world-1);">
          <p class="eyebrow">World 1 - Foundations</p>
          <h1 class="level-hero__title">${escapeHtml(PROBLEM.title)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(PROBLEM.objective)}
            Inspect the table, click a header or cell to open the flag menu, and tag all four problems before moving on.
          </p>
          <div class="action-row">
            <span class="status-box" id="w1-l2-progress">0 / ${FINDINGS.length} problems found</span>
            <span class="status-box" id="w1-l2-target">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w1-l2-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w1-l2-reset-btn" type="button">Reset Findings</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">02</span>
        </div>

        <article class="panel w1-level__table-panel w1-problem-table-panel">
          <div class="w1-level__panel-head">
            <div>
              <p class="eyebrow">Messy Dataset</p>
              <h2 class="panel-title">Inspect the raw signals before you clean anything</h2>
            </div>
            <p class="w1-level__microcopy">
              Range captions help with column-wide issues. Empty striped cells point to missing data, but they do not tell you which fix comes later.
            </p>
          </div>

          <div class="w1-problem-table-stage" id="w1-l2-table-stage">
            <p id="w1-l2-selection-help" class="sr-only">
              Press Enter or Space on a column header or a cell to inspect it and open the problem flag menu.
            </p>
            <div class="w1-level__table-shell w1-problem-table-shell" id="w1-l2-table"></div>

            <div class="w1-flag-toolbar" id="w1-l2-toolbar" hidden>
              <p class="w1-flag-toolbar__label" id="w1-l2-toolbar-label">Flag this selection as:</p>
              <div class="w1-flag-toolbar__actions">
                ${FLAG_ORDER.map(flag => `
                  <button
                    class="btn btn--subtle btn--sm w1-flag-toolbar__btn"
                    type="button"
                    data-flag="${flag}"
                  >
                    ${escapeHtml(FLAG_LABELS[flag])}
                  </button>
                `).join('')}
              </div>
            </div>
          </div>
        </article>

        <div class="w1-problem-grid">
          <section class="panel w1-problem-tracker" aria-label="Problem Tracker">
            <div class="w1-level__panel-head">
              <div>
                <p class="eyebrow">Problem Tracker</p>
                <h2 class="panel-title">Four clues, four future worlds</h2>
              </div>
              <p class="w1-level__microcopy">
                The category names are known. Your job is to locate the exact cell or column that matches each one.
              </p>
            </div>

            <div class="w1-problem-tracker__list">
              ${FINDINGS.map(finding => `
                <article class="w1-problem-card" data-problem-id="${finding.id}" data-problem-state="pending" style="--problem-color: ${finding.color};">
                  <div class="w1-problem-card__meta">
                    <span class="w1-problem-card__status" data-problem-status="${finding.id}">Pending</span>
                    <span class="w1-problem-card__chapter">${escapeHtml(finding.chapter)}</span>
                  </div>
                  <h3 class="w1-problem-card__title">${escapeHtml(finding.title)}</h3>
                  <p class="w1-problem-card__copy">${escapeHtml(finding.trackerCopy)}</p>
                </article>
              `).join('')}
            </div>
          </section>

          <section class="panel w1-problem-sidecar" aria-label="Coach Feed">
            <div class="w1-level__panel-head">
              <div>
                <p class="eyebrow">Coach Feed</p>
                <h2 class="panel-title">Read the structure before you reach for a fix</h2>
              </div>
              <p class="w1-level__microcopy">
                Missing values and outliers live at the point level. Scale and cardinality reveal themselves at the column level.
              </p>
            </div>

            <div class="card card--elevated w1-level__feedback" aria-live="polite">
              <p class="eyebrow">Current Guidance</p>
              <p id="w1-l2-feedback-text" class="w1-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
            </div>

            <div class="card w1-level__hint-box" id="w1-l2-hint-box" hidden>
              <p class="eyebrow">Hint</p>
              <p id="w1-l2-hint-text" class="w1-level__hint-copy"></p>
            </div>

            <div class="card w1-problem-legend">
              <p class="eyebrow">Inspection Rule</p>
              <div class="w1-problem-legend__items">
                <div class="w1-problem-legend__item">
                  <span class="w1-problem-legend__pill">Cell</span>
                  <p>Use for blanks and suspicious single values.</p>
                </div>
                <div class="w1-problem-legend__item">
                  <span class="w1-problem-legend__pill">Column</span>
                  <p>Use for broad issues like scale and many unique categories.</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section class="panel w1-problem-summary" id="w1-l2-summary" hidden aria-label="Problem Explanations">
          <div class="w1-level__panel-head">
            <div>
              <p class="eyebrow">Why These Matter</p>
              <h2 class="panel-title">You found the whole foundation set</h2>
            </div>
            <p class="w1-level__microcopy">
              Each issue previews the next world in the campaign. Review the pattern, then continue when you are ready.
            </p>
          </div>

          <div class="w1-problem-summary__grid">
            ${FINDINGS.map(finding => `
              <article class="w1-problem-summary__card" style="--problem-color: ${finding.color};">
                <p class="w1-problem-summary__kicker">${escapeHtml(finding.chapter)}</p>
                <h3 class="w1-problem-summary__title">${escapeHtml(finding.title)}</h3>
                <p class="w1-problem-summary__copy">${escapeHtml(finding.explanation)}</p>
              </article>
            `).join('')}
          </div>

          <div class="action-row">
            <span class="status-box">All four foundations issues mapped to their next chapters</span>
            <button class="btn btn--primary" id="w1-l2-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w1-l2-progress');
    this._ui.target = container.querySelector('#w1-l2-target');
    this._ui.feedback = container.querySelector('#w1-l2-feedback-text');
    this._ui.hintBox = container.querySelector('#w1-l2-hint-box');
    this._ui.hintText = container.querySelector('#w1-l2-hint-text');
    this._ui.toolbar = container.querySelector('#w1-l2-toolbar');
    this._ui.toolbarLabel = container.querySelector('#w1-l2-toolbar-label');
    this._ui.tableStage = container.querySelector('#w1-l2-table-stage');
    this._ui.tableHost = container.querySelector('#w1-l2-table');
    this._ui.summary = container.querySelector('#w1-l2-summary');
    this._ui.finishButton = container.querySelector('#w1-l2-finish-btn');
    this._ui.problemCards = Array.from(container.querySelectorAll('[data-problem-id]'));
    this._ui.problemStatuses = Array.from(container.querySelectorAll('[data-problem-status]'));
    this._ui.toolbarButtons = Array.from(container.querySelectorAll('[data-flag]'));

    this._table = new DataTable(this._ui.tableHost, this._dataset, {
      showIndex: false,
      showNullBadges: false,
      showRanges: true,
      showTypeBadges: false,
      showStatsButtons: false,
      sortable: false,
      compact: false,
      pageSize: 20,
      worldColor: 'var(--color-world-1)',
    });

    this._hydrateInteractiveTargets();
    this._syncProgress();
    this._syncTracker();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._ui.tableHost?.addEventListener('dt:column-click', event => {
      this._inspectColumn(event.detail.col);
    }, { signal });

    this._ui.tableHost?.addEventListener('dt:cell-click', event => {
      this._inspectCell(event.detail.col, event.detail.rowIdx, event.detail.value);
    }, { signal });

    this._ui.tableHost?.addEventListener('keydown', event => {
      const target = event.target.closest('th[data-col], td[data-col]');
      if (!target) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;

      event.preventDefault();

      if (target.matches('th[data-col]')) {
        this._inspectColumn(target.dataset.col);
        return;
      }

      const rowIdx = Number(target.dataset.rowIdx);
      const col = target.dataset.col;
      const value = this._dataset._data[col]?.[rowIdx];
      this._inspectCell(col, rowIdx, value);
    }, { signal });

    window.addEventListener('resize', () => this._repositionToolbar(), { signal });

    this._container?.addEventListener('click', event => {
      const flagButton = event.target.closest('[data-flag]');
      if (flagButton) {
        this._applyFlag(flagButton.dataset.flag);
        return;
      }

      if (event.target.closest('#w1-l2-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w1-l2-reset-btn')) {
        this._resetBoard();
        return;
      }

      if (event.target.closest('#w1-l2-finish-btn')) {
        if (this._completed) {
          void this._engine.complete();
        }
        return;
      }

      if (event.target.closest('#w1-l2-toolbar')) {
        return;
      }

      if (event.target.closest('th[data-col], td[data-col]')) {
        return;
      }

      this._clearSelection({ keepToolbar: false });
    }, { signal });
  }

  getHint(hintsUsed) {
    return PROBLEM.hints?.[hintsUsed - 1] ?? null;
  }

  pause() {
    this._hideToolbar();
  }

  resume() {
    if (this._selection) {
      this._repositionToolbar();
    }
  }

  teardown() {
    this._events?.abort();
    this._table?.destroy?.();
    this._engine = null;
    this._container = null;
    this._table = null;
    this._events = null;
    this._selection = null;
    this._ui = {};
  }

  _hydrateInteractiveTargets() {
    this._container.querySelectorAll('#w1-l2-table th[data-col], #w1-l2-table td[data-col]').forEach(node => {
      node.tabIndex = 0;
      node.classList.add('w1-inspect-target');
      node.setAttribute('aria-describedby', 'w1-l2-selection-help');
      node.setAttribute('title', node.matches('th[data-col]') ? 'Inspect this column' : 'Inspect this cell');
    });
  }

  _inspectColumn(col) {
    const anchorEl = this._getHeaderEl(col);
    if (!anchorEl) return;

    this._selection = {
      kind: 'column',
      col,
      rowIdx: null,
      value: null,
      anchorEl,
    };

    this._highlightSelection();
    this._setStatus(`Inspecting ${col}. Use the toolbar for column-wide issues like scale or high cardinality.`);
    this._setFeedback(`You selected the ${col} column. Decide whether the whole column has a scale problem or too many distinct categories.`);
    this._showToolbar();
  }

  _inspectCell(col, rowIdx, value) {
    const anchorEl = this._getCellEl(col, rowIdx);
    if (!anchorEl) return;

    this._selection = {
      kind: 'cell',
      col,
      rowIdx,
      value,
      anchorEl,
    };

    this._highlightSelection();
    this._setStatus(`Inspecting ${col}, row ${rowIdx + 1}. Use the toolbar for point issues like missing values or outliers.`);
    this._setFeedback(`You selected ${col}, row ${rowIdx + 1}. If the cell is blank, think missing value. If it is suspiciously extreme, think outlier.`);
    this._showToolbar();
  }

  _showToolbar() {
    if (!this._selection || !this._ui.toolbar || !this._ui.toolbarLabel) return;

    const allowed = this._selection.kind === 'column'
      ? new Set(['scale', 'cardinality'])
      : new Set(['missing', 'outlier']);

    this._ui.toolbarLabel.textContent = `Flag ${selectionLabel(this._selection)} as:`;
    this._ui.toolbarButtons.forEach(button => {
      const enabled = allowed.has(button.dataset.flag);
      button.disabled = !enabled;
      button.setAttribute('aria-disabled', String(!enabled));
    });

    this._ui.toolbar.hidden = false;
    this._repositionToolbar();
  }

  _repositionToolbar() {
    if (!this._selection?.anchorEl || !this._ui.toolbar || this._ui.toolbar.hidden || !this._ui.tableStage) {
      return;
    }

    const stageRect = this._ui.tableStage.getBoundingClientRect();
    const anchorRect = this._selection.anchorEl.getBoundingClientRect();

    const toolbar = this._ui.toolbar;
    const toolbarWidth = toolbar.offsetWidth;
    const toolbarHeight = toolbar.offsetHeight;

    let left = anchorRect.left - stageRect.left + (anchorRect.width / 2);
    let top = anchorRect.bottom - stageRect.top + 14;

    const minLeft = (toolbarWidth / 2) + 16;
    const maxLeft = stageRect.width - (toolbarWidth / 2) - 16;
    left = Math.max(minLeft, Math.min(maxLeft, left));

    const maxTop = stageRect.height - toolbarHeight - 12;
    top = Math.max(16, Math.min(maxTop, top));

    toolbar.style.left = `${left}px`;
    toolbar.style.top = `${top}px`;
  }

  _hideToolbar() {
    if (!this._ui.toolbar) return;
    this._ui.toolbar.hidden = true;
  }

  _applyFlag(flag) {
    if (!this._selection) {
      this._setFeedback('Select a header or cell first, then choose a flag from the toolbar.');
      return;
    }

    const solvedTarget = FINDINGS.find(finding => sameSelection(this._selection, finding) && this._solved.has(finding.id));
    if (solvedTarget) {
      this._setFeedback(`${selectionLabel(this._selection)} is already tagged as ${solvedTarget.title}. Hunt for one of the remaining issues.`);
      this._setStatus(`${selectionLabel(this._selection)} is already solved.`);
      this._hideToolbar();
      return;
    }

    const finding = FINDINGS.find(candidate =>
      candidate.type === flag && sameSelection(this._selection, candidate)
    );

    if (!finding) {
      this._flashWrongSelection();
      this._setFeedback(this._wrongFlagMessage(flag));
      this._engine.mistake({ costsLife: false, countsMistake: true });
      return;
    }

    this._solved.add(finding.id);
    this._applySolvedVisuals(finding);
    this._syncProgress();
    this._syncTracker();
    this._setFeedback(finding.success);
    this._setStatus(`${this._solved.size} / ${FINDINGS.length} problems found`);
    this._hideToolbar();
    this._clearSelection({ keepToolbar: true });
    this._engine.correct();

    if (this._solved.size === FINDINGS.length) {
      this._revealSummary();
    }
  }

  _applySolvedVisuals(finding) {
    if (!this._table) return;

    if (finding.id === 'missing-age') {
      this._table.highlightColumn(finding.col, 'missing');
      this._table.flashCell(finding.col, finding.rowIdx, 'green');
      this._getCellEl(finding.col, finding.rowIdx)?.classList.add('w1-problem-cell--missing');
      return;
    }

    if (finding.id === 'salary-outlier') {
      const mask = Array.from({ length: this._dataset.length }, (_, index) => index === finding.rowIdx);
      this._table.setOutlierMask(finding.col, mask);
      this._table.flashCell(finding.col, finding.rowIdx, 'green');
      return;
    }

    if (finding.id === 'city-cardinality') {
      this._table.highlightColumn(finding.col, 'cardinality');
      this._table.flashColumn(finding.col, 'green');
      return;
    }

    if (finding.id === 'salary-scale') {
      this._table.highlightColumn(finding.col, 'scale');
      this._table.flashColumn(finding.col, 'green');
    }
  }

  _wrongFlagMessage(flag) {
    if (!this._selection) {
      return 'Select something in the table first.';
    }

    if (this._selection.kind === 'column') {
      if (flag === 'missing') {
        return 'Missing values start as point-level evidence. Click the blank cell itself instead of only the header.';
      }
      if (flag === 'outlier') {
        return 'Outliers are suspicious single values. Click the extreme cell itself, not the whole column.';
      }
      if (flag === 'scale') {
        return `Scale is not the main issue in ${this._selection.col}. Look for the numeric column whose range dwarfs the others.`;
      }
      if (flag === 'cardinality') {
        return `High cardinality belongs to the column with many distinct category names, not ${this._selection.col}.`;
      }
    }

    if (this._selection.kind === 'cell') {
      if (flag === 'scale') {
        return 'Scale is a column-wide pattern. Click the header of the dominant numeric column instead of a single cell.';
      }
      if (flag === 'cardinality') {
        return 'High cardinality is a property of an entire categorical column, not one row.';
      }
      if (flag === 'missing') {
        return 'That cell is not the missing-value clue. Hunt for the blank tile in the table.';
      }
      if (flag === 'outlier') {
        return 'That value is not the rogue point. Look for the number that explodes far past the rest of its column.';
      }
    }

    return `That is not the right flag for ${selectionLabel(this._selection)}.`;
  }

  _flashWrongSelection() {
    if (!this._selection || !this._table) return;

    if (this._selection.kind === 'column') {
      this._table.flashColumn(this._selection.col, 'amber');
      return;
    }

    this._table.flashCell(this._selection.col, this._selection.rowIdx, 'amber');
  }

  _revealSummary() {
    if (this._completed || !this._ui.summary) return;

    this._completed = true;
    this._ui.summary.hidden = false;

    requestAnimationFrame(() => {
      this._ui.summary.classList.add('is-revealed');
    });

    this._setFeedback('All four problems are tagged. Review the explanation cards below, then continue to finish the level.');
    this._setStatus('All four problems found. Review the summary and continue.');
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

  _resetBoard() {
    this._solved.clear();
    this._completed = false;

    this._table?.clearColumnFlag('Age');
    this._table?.clearColumnFlag('City');
    this._table?.clearColumnFlag('Salary');
    this._table?.clearOutlierMask('Salary');

    this._container.querySelectorAll('.w1-problem-cell--missing, .w1-problem-target--active').forEach(node => {
      node.classList.remove('w1-problem-cell--missing', 'w1-problem-target--active');
    });

    this._clearSelection({ keepToolbar: false });
    this._syncProgress();
    this._syncTracker();

    if (this._ui.summary) {
      this._ui.summary.hidden = true;
      this._ui.summary.classList.remove('is-revealed');
    }

    this._setFeedback(DEFAULT_FEEDBACK);
    this._setStatus(DEFAULT_STATUS);
  }

  _syncProgress() {
    if (this._ui.progress) {
      this._ui.progress.textContent = `${this._solved.size} / ${FINDINGS.length} problems found`;
    }
  }

  _syncTracker() {
    this._ui.problemCards.forEach(card => {
      const finding = FINDINGS.find(entry => entry.id === card.getAttribute('data-problem-id'));
      if (!finding) return;

      const solved = this._solved.has(finding.id);
      card.setAttribute('data-problem-state', solved ? 'done' : 'pending');
      const status = card.querySelector(`[data-problem-status="${finding.id}"]`);
      if (status) {
        status.textContent = solved ? 'Found' : 'Pending';
      }
    });
  }

  _setFeedback(message) {
    if (this._ui.feedback) {
      this._ui.feedback.textContent = message;
    }
  }

  _setStatus(message) {
    if (this._ui.target) {
      this._ui.target.textContent = message;
    }
  }

  _highlightSelection() {
    this._container.querySelectorAll('.w1-problem-target--active').forEach(node => {
      node.classList.remove('w1-problem-target--active');
    });

    this._selection?.anchorEl?.classList.add('w1-problem-target--active');
  }

  _clearSelection({ keepToolbar = false } = {}) {
    this._selection = null;
    this._container.querySelectorAll('.w1-problem-target--active').forEach(node => {
      node.classList.remove('w1-problem-target--active');
    });

    if (!keepToolbar) {
      this._hideToolbar();
    }
  }

  _getHeaderEl(col) {
    return this._container.querySelector(`#w1-l2-table th[data-col="${CSS.escape(col)}"]`);
  }

  _getCellEl(col, rowIdx) {
    return this._container.querySelector(`#w1-l2-table td[data-col="${CSS.escape(col)}"][data-row-idx="${rowIdx}"]`);
  }
}
