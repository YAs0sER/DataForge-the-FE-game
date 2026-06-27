'use strict';

import { getLevelProblem } from '../../data/problems.js';

const PROBLEM = getLevelProblem(4, 1);
const LEVEL_TITLE = PROBLEM?.title ?? 'The One-Hot Grid';
const LEVEL_OBJECTIVE = PROBLEM?.objective ?? 'Manually build a one-hot encoded matrix from a City column.';
const CATEGORIES = Object.freeze(['Casa', 'Rabat', 'Fes']);
const RETAINED_CATEGORIES = Object.freeze(['Casa', 'Rabat']);
const SOURCE_ROWS = Object.freeze([
  Object.freeze({ id: 1, City: 'Casa' }),
  Object.freeze({ id: 2, City: 'Rabat' }),
  Object.freeze({ id: 3, City: 'Fes' }),
  Object.freeze({ id: 4, City: 'Casa' }),
  Object.freeze({ id: 5, City: 'Rabat' }),
]);

const EXPECTED_GRID = Object.freeze(
  SOURCE_ROWS.map(row => Object.freeze(
    Object.fromEntries(CATEGORIES.map(category => [category, row.City === category ? 1 : 0]))
  ))
);

const STEP_META = Object.freeze([
  Object.freeze({
    id: 'onehot-shape',
    label: 'Every row becomes one-hot',
    chapter: 'Shape Rule',
    recap: 'A valid one-hot row contains exactly one 1 and the rest 0.',
  }),
  Object.freeze({
    id: 'category-match',
    label: 'Each 1 lands under the correct city',
    chapter: 'Column Meaning',
    recap: 'The active 1 must sit under the matching category label, not just anywhere in the row.',
  }),
  Object.freeze({
    id: 'dummy-trap',
    label: 'Drop one redundant dummy column',
    chapter: 'Practical Use',
    recap: 'One dummy column can be inferred from the others, so it is usually dropped before linear modeling.',
  }),
]);

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM?.hints ?? []),
  'Use one active column per row: one 1, two 0s.',
  'The row with City = Casa should activate only the Casa column, and the same rule applies to Rabat and Fes.',
  'If Casa = 0 and Rabat = 0, the row must already be Fes, which is why one dummy column can be dropped later.',
]);

const DEFAULT_FEEDBACK = 'Click the matrix cells to build one-hot vectors: one active 1 per row, under the matching city column.';
const DEFAULT_STATUS = 'Start with row shape first. Each row should end with exactly one 1 before you worry about whether it sits in the right column.';
const SUMMARY_COPY = 'In practice, one dummy column is usually dropped so the encoded matrix does not carry a perfectly redundant feature.';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function blankRow() {
  return Object.fromEntries(CATEGORIES.map(category => [category, 0]));
}

function createBlankGrid() {
  return SOURCE_ROWS.map(() => blankRow());
}

function rowCount(row) {
  return CATEGORIES.reduce((total, category) => total + Number(row[category] === 1), 0);
}

function rowMatchesExpected(rowIndex, grid) {
  return CATEGORIES.every(category => grid[rowIndex][category] === EXPECTED_GRID[rowIndex][category]);
}

function allRowsOneHot(grid) {
  return grid.every(row => rowCount(row) === 1);
}

function gridMatchesExpected(grid) {
  return grid.every((row, rowIndex) => rowMatchesExpected(rowIndex, grid));
}

function vectorPreview(columns) {
  return SOURCE_ROWS.map((row, rowIndex) => {
    const values = columns.map(category => EXPECTED_GRID[rowIndex][category]);
    return {
      label: row.City,
      values,
    };
  });
}

export default class World4Level1 {
  meta = {
    title: LEVEL_TITLE,
    subtitle: LEVEL_OBJECTIVE,
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._events = null;
    this._grid = createBlankGrid();
    this._touchedRows = new Set();
    this._awardedStepIds = new Set();
    this._completed = false;
    this._gridLocked = false;
    this._trapDropped = false;
    this._connectorsVisible = false;
    this._ui = {};
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w4-level w4-level--onehot screen-section" aria-label="World 4 Level 1">
        <div class="level-hero w4-level__hero" style="--world-color: var(--color-world-4);">
          <p class="eyebrow">World 4 - Encoding</p>
          <h1 class="level-hero__title">${escapeHtml(LEVEL_TITLE)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(LEVEL_OBJECTIVE)}
            Build the binary matrix by hand, watch each row turn into a valid vector, then finish with the practical reason one dummy column is usually dropped.
          </p>
          <div class="action-row">
            <span class="status-box" id="w4-l1-progress">0 / ${STEP_META.length} encoding locks</span>
            <span class="status-box" id="w4-l1-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w4-l1-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w4-l1-reset-btn" type="button">Reset Grid</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">01</span>
        </div>

        <div class="w4-onehot-grid">
          <div class="w4-onehot-board-wrap">
            <div class="w4-onehot-board" id="w4-l1-board">
              <article class="panel w4-onehot-panel">
                <div class="w4-level__panel-head">
                  <div>
                    <p class="eyebrow">Source Column</p>
                    <h2 class="panel-title">Original City values</h2>
                  </div>
                  <p class="w4-level__microcopy">
                    The pill on each row validates one-hot shape only: green means that row currently has exactly one active 1.
                  </p>
                </div>

                <div class="w4-onehot-table-shell">
                  <table class="w4-onehot-source-table">
                    <thead>
                      <tr>
                        <th scope="col">Row</th>
                        <th scope="col">City</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${SOURCE_ROWS.map((row, rowIndex) => `
                        <tr>
                          <th scope="row">
                            <span class="w4-onehot-source-pill" data-row-pill="${rowIndex}" data-row-state="pending">Start</span>
                          </th>
                          <td>
                            <div class="w4-onehot-source-cell">
                              <span class="w4-onehot-city-chip" data-city-source="${rowIndex}">${escapeHtml(row.City)}</span>
                              <span class="w4-onehot-row-note" data-row-note="${rowIndex}">Choose 1 active column</span>
                            </div>
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </article>

              <article class="panel w4-onehot-panel">
                <div class="w4-level__panel-head">
                  <div>
                    <p class="eyebrow">One-Hot Matrix</p>
                    <h2 class="panel-title">Toggle each square until every row becomes a valid binary vector</h2>
                  </div>
                  <p class="w4-level__microcopy">
                    The target cells carry a subtle guide marker. Exact row-to-column matching matters only after the one-hot shape is stable.
                  </p>
                </div>

                <div class="w4-onehot-table-shell">
                  <table class="w4-onehot-matrix-table" aria-label="One-hot matrix builder">
                    <thead>
                      <tr>
                        <th scope="col">Row</th>
                        ${CATEGORIES.map(category => `<th scope="col">${escapeHtml(category)}</th>`).join('')}
                      </tr>
                    </thead>
                    <tbody>
                      ${SOURCE_ROWS.map((row, rowIndex) => `
                        <tr>
                          <th scope="row">Row ${rowIndex + 1}</th>
                          ${CATEGORIES.map(category => `
                            <td>
                              <button
                                class="w4-onehot-cell"
                                type="button"
                                data-grid-row="${rowIndex}"
                                data-grid-col="${category}"
                                data-cell-value="0"
                                data-target="${row.City === category ? 'true' : 'false'}"
                                aria-pressed="false"
                              >0</button>
                            </td>
                          `).join('')}
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </article>

              <svg class="w4-onehot-connectors" id="w4-l1-connectors" aria-hidden="true"></svg>
            </div>
          </div>

          <div class="w4-onehot-side">
            <section class="panel w4-onehot-tracker" aria-label="Encoding Tracker">
              <div class="w4-level__panel-head">
                <div>
                  <p class="eyebrow">Encoding Tracker</p>
                  <h2 class="panel-title">Lock row shape, exact mapping, then the practical trap</h2>
                </div>
                <p class="w4-level__microcopy">
                  The first lock cares only about one-hot structure. The second lock checks that each 1 sits under the correct city column.
                </p>
              </div>

              <div class="w4-onehot-tracker__list">
                ${STEP_META.map((step, index) => `
                  <article class="w4-onehot-card" data-step-id="${step.id}" data-step-state="${index === 0 ? 'active' : 'pending'}">
                    <div class="w4-onehot-card__meta">
                      <span class="w4-onehot-card__status" data-step-status="${step.id}">${index === 0 ? 'Active' : 'Pending'}</span>
                      <span class="w4-onehot-card__index">Step ${index + 1}</span>
                    </div>
                    <h3 class="w4-onehot-card__title">${escapeHtml(step.label)}</h3>
                    <p class="w4-onehot-card__chapter">${escapeHtml(step.chapter)}</p>
                    <p class="w4-onehot-card__copy">${escapeHtml(step.recap)}</p>
                  </article>
                `).join('')}
              </div>
            </section>

            <section class="card card--elevated w4-level__feedback" aria-live="polite">
              <p class="eyebrow">Coach Feed</p>
              <p id="w4-l1-feedback-text" class="w4-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
            </section>

            <section class="card w4-level__hint-box" id="w4-l1-hint-box" hidden>
              <p class="eyebrow">Hint</p>
              <p id="w4-l1-hint-text" class="w4-level__hint-copy"></p>
            </section>

            <section class="card w4-onehot-guide">
              <p class="eyebrow">Encoding Rules</p>
              <div class="w4-onehot-guide__steps">
                <article class="w4-onehot-guide__step">
                  <span class="w4-onehot-guide__badge">1</span>
                  <p>One-hot means exactly one 1 per row because every row belongs to exactly one category.</p>
                </article>
                <article class="w4-onehot-guide__step">
                  <span class="w4-onehot-guide__badge">2</span>
                  <p>The active 1 has to sit under the matching category label, not just anywhere in the row.</p>
                </article>
                <article class="w4-onehot-guide__step">
                  <span class="w4-onehot-guide__badge">3</span>
                  <p>For linear models, one dummy column is often dropped because the last category is already implied by the other binary columns.</p>
                </article>
              </div>
            </section>
          </div>
        </div>

        <section class="panel w4-onehot-summary" id="w4-l1-summary" hidden aria-label="Dummy Variable Trap">
          <div class="w4-level__panel-head">
            <div>
              <p class="eyebrow">Dummy Variable Trap</p>
              <h2 class="panel-title">The full matrix is correct, but one column is still redundant in practice</h2>
            </div>
            <p class="w4-level__microcopy">${escapeHtml(SUMMARY_COPY)}</p>
          </div>

          <div class="w4-onehot-summary__grid">
            <article class="w4-onehot-summary__card">
              <p class="w4-onehot-summary__kicker">Why Drop One?</p>
              <h3 class="w4-onehot-summary__title">Fes is already implied by Casa and Rabat</h3>
              <p class="w4-onehot-summary__copy" id="w4-l1-trap-copy">
                If Casa = 0 and Rabat = 0, the row must already be Fes. That makes the third dummy column perfectly redundant for many linear models.
              </p>
              <div class="w4-onehot-summary__formula">Fes = 1 - Casa - Rabat</div>
              <div class="action-row">
                <span class="status-box" id="w4-l1-trap-status">3 dummy columns still live</span>
                <button class="btn btn--primary" id="w4-l1-drop-btn" type="button">Drop Fes Column</button>
              </div>
            </article>

            <article class="w4-onehot-summary__card w4-onehot-summary__card--preview">
              <p class="w4-onehot-summary__kicker">Mini Demo</p>
              <h3 class="w4-onehot-summary__title">Watch the matrix shrink without losing meaning</h3>
              <div class="w4-onehot-mini-matrix" id="w4-l1-trap-preview"></div>
            </article>
          </div>

          <div class="action-row">
            <span class="status-box" id="w4-l1-summary-score">Matrix solved. Drop one dummy column to finish the lesson.</span>
            <button class="btn btn--primary" id="w4-l1-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w4-l1-progress');
    this._ui.status = container.querySelector('#w4-l1-status');
    this._ui.feedback = container.querySelector('#w4-l1-feedback-text');
    this._ui.hintBox = container.querySelector('#w4-l1-hint-box');
    this._ui.hintText = container.querySelector('#w4-l1-hint-text');
    this._ui.board = container.querySelector('#w4-l1-board');
    this._ui.connectors = container.querySelector('#w4-l1-connectors');
    this._ui.rowPills = Array.from(container.querySelectorAll('[data-row-pill]'));
    this._ui.rowNotes = Array.from(container.querySelectorAll('[data-row-note]'));
    this._ui.matrixCells = Array.from(container.querySelectorAll('[data-grid-row][data-grid-col]'));
    this._ui.summary = container.querySelector('#w4-l1-summary');
    this._ui.trapCopy = container.querySelector('#w4-l1-trap-copy');
    this._ui.trapStatus = container.querySelector('#w4-l1-trap-status');
    this._ui.trapPreview = container.querySelector('#w4-l1-trap-preview');
    this._ui.dropButton = container.querySelector('#w4-l1-drop-btn');
    this._ui.summaryScore = container.querySelector('#w4-l1-summary-score');
    this._ui.finishButton = container.querySelector('#w4-l1-finish-btn');
    this._ui.trackerCards = Array.from(container.querySelectorAll('[data-step-id]'));

    this._renderTrapPreview();
    this._syncGrid();
    this._syncTracker();
    this._syncSummary();
    this._syncProgress();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w4-l1-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w4-l1-reset-btn')) {
        this._resetLevel();
        return;
      }

      if (event.target.closest('#w4-l1-drop-btn')) {
        this._dropTrapColumn();
        return;
      }

      if (event.target.closest('#w4-l1-finish-btn')) {
        if (this._completed) {
          if (typeof this._engine.complete === 'function') {
            void this._engine.complete();
          }
        }
        return;
      }

      const cell = event.target.closest('[data-grid-row][data-grid-col]');
      if (cell) {
        this._toggleCell(
          Number(cell.getAttribute('data-grid-row')),
          cell.getAttribute('data-grid-col')
        );
      }
    }, { signal });

    window.addEventListener('resize', () => this._drawConnectors(), { signal });
  }

  getHint(hintsUsed) {
    return LEVEL_HINTS[hintsUsed - 1] ?? null;
  }

  pause() {}

  resume() {}

  teardown() {
    this._events?.abort();
    this._ui = {};
  }

  _toggleCell(rowIndex, category) {
    if (this._gridLocked || !Number.isInteger(rowIndex) || !CATEGORIES.includes(category)) {
      return;
    }

    const row = this._grid[rowIndex];
    if (!row) return;

    row[category] = row[category] === 1 ? 0 : 1;
    this._touchedRows.add(rowIndex);

    this._syncGrid();
    this._evaluateProgression({ rowIndex, category });
  }

  _dropTrapColumn() {
    if (!this._awardedStepIds.has('category-match') || this._trapDropped) return;

    this._trapDropped = true;
    this._renderTrapPreview();
    this._evaluateProgression();
  }

  _resetLevel() {
    this._grid = createBlankGrid();
    this._touchedRows.clear();
    this._awardedStepIds.clear();
    this._completed = false;
    this._gridLocked = false;
    this._trapDropped = false;
    this._connectorsVisible = false;

    if (this._ui.summary) {
      this._ui.summary.hidden = true;
      this._ui.summary.classList.remove('is-revealed');
    }

    this._renderTrapPreview();
    this._syncGrid();
    this._syncTracker();
    this._syncSummary();
    this._syncProgress();
    this._setFeedback(DEFAULT_FEEDBACK);
    this._setStatus(DEFAULT_STATUS);
    this._drawConnectors();
  }

  _evaluateProgression(context = {}) {
    const oneHotSolved = allRowsOneHot(this._grid);
    const matrixSolved = gridMatchesExpected(this._grid);

    if (oneHotSolved && !this._awardedStepIds.has('onehot-shape')) {
      this._awardStep('onehot-shape');
      this._setFeedback('Row shape locked. Every row now has exactly one active 1.');
      this._setStatus('One-hot structure is correct. Now make sure each 1 sits under the matching city column.');
    }

    if (matrixSolved && !this._awardedStepIds.has('category-match')) {
      this._awardStep('category-match');
      this._gridLocked = true;
      this._connectorsVisible = true;
      this._revealSummary();
      this._setFeedback('Matrix complete. The source cities now map cleanly into binary vectors, and the connector lines show the exact category-to-column relationship.');
      this._setStatus('Encoding matrix solved. Finish the lesson by dropping one redundant dummy column in the trap demo.');
      this._syncGrid();
      this._syncSummary();
      this._drawConnectors();
    }

    if (matrixSolved && this._trapDropped && !this._awardedStepIds.has('dummy-trap')) {
      this._awardStep('dummy-trap');
      this._completed = true;
      this._setFeedback('Practical lock complete. Dropping one dummy column keeps the information while avoiding a perfectly redundant feature.');
      this._setStatus('Encoding lesson complete. Continue to Label Encoding next.');
      this._syncSummary();
    }

    this._syncTracker();
    this._syncProgress();

    if (this._completed || (matrixSolved && this._trapDropped)) {
      return;
    }

    if (!this._awardedStepIds.has('category-match')) {
      const rowIndex = context.rowIndex;
      if (Number.isInteger(rowIndex)) {
        const count = rowCount(this._grid[rowIndex]);
        if (count === 1 && rowMatchesExpected(rowIndex, this._grid)) {
          this._setFeedback(`Row ${rowIndex + 1} is clean. The vector matches ${SOURCE_ROWS[rowIndex].City} exactly.`);
        } else if (count === 1) {
          this._setFeedback(`Row ${rowIndex + 1} has the right one-hot shape, but the 1 is under the wrong city column.`);
        } else if (count > 1) {
          this._setFeedback(`Row ${rowIndex + 1} has ${count} active cells. One-hot rows must contain exactly one 1.`);
        } else {
          this._setFeedback(`Row ${rowIndex + 1} has no active city yet. Switch on exactly one column for that row.`);
        }
      }

      if (!this._awardedStepIds.has('onehot-shape')) {
        const readyRows = this._grid.filter(row => rowCount(row) === 1).length;
        this._setStatus(`${readyRows} / ${SOURCE_ROWS.length} rows currently have exactly one hot cell.`);
      } else {
        this._setStatus('Row shape is locked. Keep tuning the column placement until every 1 aligns with the matching city label.');
      }
    }
  }

  _awardStep(stepId) {
    this._awardedStepIds.add(stepId);
    this._engine.correct();
  }

  _showHint() {
    const { allowed, text } = this._engine.requestHint();
    if (!allowed || !text) return;

    this._ui.hintBox?.removeAttribute('hidden');
    if (this._ui.hintText) {
      this._ui.hintText.textContent = text;
    }
  }

  _revealSummary() {
    if (!this._ui.summary) return;

    this._ui.summary.hidden = false;
    requestAnimationFrame(() => {
      this._ui.summary.classList.add('is-revealed');
    });
    this._ui.summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  _syncGrid() {
    const cells = this._ui.matrixCells ?? [];
    cells.forEach(cell => {
      const rowIndex = Number(cell.getAttribute('data-grid-row'));
      const category = cell.getAttribute('data-grid-col');
      const value = this._grid[rowIndex]?.[category] ?? 0;
      const isCorrect = rowMatchesExpected(rowIndex, this._grid) && value === 1;
      const isWrongHot = value === 1 && EXPECTED_GRID[rowIndex][category] !== 1;

      cell.textContent = String(value);
      cell.setAttribute('data-cell-value', String(value));
      cell.setAttribute('aria-pressed', String(value === 1));
      cell.disabled = this._gridLocked;
      cell.classList.toggle('is-hot', value === 1);
      cell.classList.toggle('is-correct', isCorrect);
      cell.classList.toggle('is-wrong', isWrongHot);
    });

    const rowPills = this._ui.rowPills ?? [];
    const rowNotes = this._ui.rowNotes ?? [];

    SOURCE_ROWS.forEach((row, rowIndex) => {
      const count = rowCount(this._grid[rowIndex]);
      const touched = this._touchedRows.has(rowIndex);
      const mapped = rowMatchesExpected(rowIndex, this._grid);
      const pill = rowPills[rowIndex];
      const note = rowNotes[rowIndex];

      if (pill) {
        let pillState = 'pending';
        let pillText = 'Start';

        if (this._gridLocked && mapped) {
          pillState = 'solved';
          pillText = 'Encoded';
        } else if (touched && count === 1) {
          pillState = 'ready';
          pillText = '1 Hot';
        } else if (touched) {
          pillState = 'warning';
          pillText = count === 0 ? 'Empty' : `${count} Hot`;
        }

        pill.dataset.rowState = pillState;
        pill.textContent = pillText;
      }

      if (note) {
        if (this._gridLocked && mapped) {
          note.textContent = `${row.City} -> ${this._activeCategoryLabel(rowIndex)}`;
        } else if (!touched) {
          note.textContent = 'Choose 1 active column';
        } else if (count === 1 && mapped) {
          note.textContent = `Correct vector for ${row.City}`;
        } else if (count === 1) {
          note.textContent = `One hot, but not ${row.City}`;
        } else if (count === 0) {
          note.textContent = 'No active city yet';
        } else {
          note.textContent = `${count} active cells - keep only one`;
        }
      }
    });
  }

  _syncTracker() {
    const cards = this._ui.trackerCards ?? [];
    cards.forEach(card => {
      const stepId = card.getAttribute('data-step-id');
      const status = card.querySelector(`[data-step-status="${stepId}"]`);
      let state = 'pending';

      if (this._awardedStepIds.has(stepId)) {
        state = 'solved';
      } else if (
        stepId === 'onehot-shape' ||
        (stepId === 'category-match' && this._awardedStepIds.has('onehot-shape')) ||
        (stepId === 'dummy-trap' && this._awardedStepIds.has('category-match'))
      ) {
        state = 'active';
      }

      card.setAttribute('data-step-state', state);
      if (status) {
        status.textContent = state === 'solved' ? 'Solved' : state === 'active' ? 'Active' : 'Pending';
      }
    });
  }

  _syncSummary() {
    if (this._ui.trapStatus) {
      this._ui.trapStatus.textContent = this._trapDropped ? '2 dummy columns kept' : '3 dummy columns still live';
    }

    if (this._ui.trapCopy) {
      this._ui.trapCopy.textContent = this._trapDropped
        ? 'Once Fes is dropped, rows with Casa = 0 and Rabat = 0 still decode back to Fes automatically. The information stays, but the redundant third dummy disappears.'
        : 'If Casa = 0 and Rabat = 0, the row must already be Fes. That makes the third dummy column perfectly redundant for many linear models.';
    }

    if (this._ui.dropButton) {
      this._ui.dropButton.disabled = this._trapDropped || !this._awardedStepIds.has('category-match');
    }

    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = this._completed
        ? `${STEP_META.length} / ${STEP_META.length} encoding locks`
        : 'Matrix solved. Drop one dummy column to finish the lesson.';
    }

    if (this._ui.finishButton) {
      this._ui.finishButton.disabled = !this._completed;
    }
  }

  _syncProgress() {
    if (this._ui.progress) {
      this._ui.progress.textContent = `${this._awardedStepIds.size} / ${STEP_META.length} encoding locks`;
    }
  }

  _renderTrapPreview() {
    if (!this._ui.trapPreview) return;

    const columns = this._trapDropped ? RETAINED_CATEGORIES : CATEGORIES;
    const rows = vectorPreview(columns);

    this._ui.trapPreview.innerHTML = `
      <table class="w4-onehot-mini-table" aria-label="Dummy trap demo preview">
        <thead>
          <tr>
            <th scope="col">City</th>
            ${columns.map(category => `<th scope="col">${escapeHtml(category)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <th scope="row">${escapeHtml(row.label)}</th>
              ${row.values.map(value => `<td>${value}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  _activeCategoryLabel(rowIndex) {
    return CATEGORIES.find(category => this._grid[rowIndex][category] === 1) ?? 'None';
  }

  _drawConnectors() {
    const svg = this._ui.connectors;
    const board = this._ui.board;
    if (!svg || !board) return;

    if (!this._connectorsVisible || !this._awardedStepIds.has('category-match')) {
      svg.innerHTML = '';
      return;
    }

    const boardRect = board.getBoundingClientRect();
    if (!boardRect.width || !boardRect.height) return;

    const paths = SOURCE_ROWS.map((row, rowIndex) => {
      const source = board.querySelector(`[data-city-source="${rowIndex}"]`);
      const activeCell = board.querySelector(`[data-grid-row="${rowIndex}"][data-cell-value="1"]`);
      if (!source || !activeCell) return '';

      const sourceRect = source.getBoundingClientRect();
      const targetRect = activeCell.getBoundingClientRect();
      const startX = sourceRect.right - boardRect.left;
      const startY = sourceRect.top + sourceRect.height / 2 - boardRect.top;
      const endX = targetRect.left - boardRect.left;
      const endY = targetRect.top + targetRect.height / 2 - boardRect.top;
      const bend = Math.max(40, (endX - startX) * 0.4);
      const d = `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`;
      return `<path class="w4-onehot-connector" d="${d}" style="animation-delay:${rowIndex * 80}ms;"></path>`;
    }).join('');

    svg.setAttribute('viewBox', `0 0 ${boardRect.width} ${boardRect.height}`);
    svg.innerHTML = paths;
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
