'use strict';

import { getLevelProblem } from '../../data/problems.js';
import { createDataset } from '../../data/datasets.js';
import { validatePlacementMap } from '../../data/answers.js';
import { DataTable } from '../../widgets/datatable.js';
import { createDragDrop } from '../../widgets/dragdrop.js';

const PROBLEM = getLevelProblem(1, 1);

const ZONES = Object.freeze([
  {
    id: 'zone-numerical-continuous',
    typeKey: 'numerical-continuous',
    label: 'Numerical Continuous',
    icon: '~',
    copy: 'Values move along a scale and can include decimals.',
  },
  {
    id: 'zone-numerical-discrete',
    typeKey: 'numerical-discrete',
    label: 'Numerical Discrete',
    icon: '#',
    copy: 'Countable whole-number steps like events, items, or children.',
  },
  {
    id: 'zone-categorical-nominal',
    typeKey: 'categorical-nominal',
    label: 'Categorical Nominal',
    icon: 'N',
    copy: 'Named groups with no natural rank between them.',
  },
  {
    id: 'zone-categorical-ordinal',
    typeKey: 'categorical-ordinal',
    label: 'Categorical Ordinal',
    icon: 'O',
    copy: 'Categories with a meaningful order, but not numeric distance.',
  },
  {
    id: 'zone-temporal',
    typeKey: 'temporal',
    label: 'Temporal',
    icon: 'T',
    copy: 'Columns that represent time, dates, or moments in sequence.',
  },
]);

const COLUMN_RULES = Object.freeze({
  Age: {
    tokenId: 'token-age',
    zoneId: 'zone-numerical-continuous',
    rationale: 'Age behaves like a measured quantity, so it belongs with continuous numeric features.',
  },
  Salary: {
    tokenId: 'token-salary',
    zoneId: 'zone-numerical-continuous',
    rationale: 'Salary is numeric and varies along a scale, even when shown as whole currency values.',
  },
  City: {
    tokenId: 'token-city',
    zoneId: 'zone-categorical-nominal',
    rationale: 'City names are labels with no inherent ranking, which makes them nominal categories.',
  },
  Education_Level: {
    tokenId: 'token-education-level',
    zoneId: 'zone-categorical-ordinal',
    rationale: 'Education level has a real progression from Bac to Doctorat, so it is ordinal.',
  },
  Purchase_Date: {
    tokenId: 'token-purchase-date',
    zoneId: 'zone-temporal',
    rationale: 'Purchase_Date captures when an event happened, so it should be treated as temporal data.',
  },
  Num_Children: {
    tokenId: 'token-num-children',
    zoneId: 'zone-numerical-discrete',
    rationale: 'Number of children is a count, which means it changes in whole-number steps.',
  },
});

const ANSWER_KEY = Object.freeze({
  'zone-numerical-continuous': ['token-age', 'token-salary'],
  'zone-numerical-discrete': ['token-num-children'],
  'zone-categorical-nominal': ['token-city'],
  'zone-categorical-ordinal': ['token-education-level'],
  'zone-temporal': ['token-purchase-date'],
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function previewValues(values, limit = 3) {
  return values
    .filter(value => value !== null && value !== undefined && !(typeof value === 'number' && Number.isNaN(value)))
    .slice(0, limit)
    .map(value => String(value))
    .join(', ');
}

function countPlacedColumns(placements) {
  return Object.values(placements).filter(Boolean).length;
}

function zoneCount(placements, zoneId) {
  return Object.values(placements).filter(value => value === zoneId).length;
}

function zoneMeta(zoneId) {
  return ZONES.find(zone => zone.id === zoneId) ?? null;
}

export default class World1Level1 {
  meta = {
    title: PROBLEM?.title ?? 'What Are We Working With?',
    subtitle: PROBLEM?.objective ?? 'Classify each dataset column into the correct variable type bucket.',
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._dataset = createDataset(PROBLEM.datasetKey);
    this._table = null;
    this._dragDrop = null;
    this._completed = false;
    this._boardSyncTimer = null;
    this._onControlClick = null;
    this._ui = {};
    this._events = null;
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w1-level screen-section" aria-label="World 1 Level 1">
        <div class="level-hero w1-level__hero" style="--world-color: var(--color-world-1);">
          <p class="eyebrow">World 1 - Foundations</p>
          <h1 class="level-hero__title">${escapeHtml(PROBLEM.title)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(PROBLEM.objective)}
            Drag each column card into the best bucket, or tap a card and then tap a bucket, then watch the table headers lock in the right type mark.
          </p>
          <div class="action-row">
            <span class="status-box" id="w1-l1-progress">0 / ${this._dataset.columns.length} columns classified</span>
            <span class="status-box">Goal: fill all ${ZONES.length} buckets</span>
            <button class="btn btn--hint" id="w1-l1-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w1-l1-reset-btn" type="button">Reset Board</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">01</span>
        </div>

        <div class="w1-level__stack">
          <article class="panel w1-level__table-panel">
            <div class="w1-level__panel-head">
              <div>
                <p class="eyebrow">Dataset Preview</p>
                <h2 class="panel-title">Read the columns before you classify them</h2>
              </div>
              <p class="w1-level__microcopy">
                Focus on the meaning of each field, not just the raw dtype printed by the browser.
              </p>
            </div>
            <div class="w1-level__table-shell" id="w1-l1-table"></div>
          </article>

          <article class="panel w1-level__lab-panel">
            <div class="w1-level__panel-head">
              <div>
                <p class="eyebrow">Classification Lab</p>
                <h2 class="panel-title">Sort the columns into the right feature types</h2>
              </div>
              <p class="w1-level__microcopy">
                One bucket needs two columns, so keep an eye out for both measured numeric fields.
              </p>
            </div>

            <div class="w1-level__lab-layout">
              <section class="w1-level__token-bank" id="w1-l1-token-bank" aria-label="Column cards">
                ${this._dataset.columns.map(columnName => {
                  const profile = COLUMN_RULES[columnName];
                  const sample = previewValues(this._dataset.col(columnName).values);
                  return `
                    <button
                      class="drag-token dd-draggable w1-column-card"
                      type="button"
                      data-dd-id="${profile.tokenId}"
                      aria-label="Classify ${escapeHtml(columnName)}"
                    >
                      <span class="w1-column-card__name">${escapeHtml(columnName)}</span>
                      <span class="w1-column-card__sample">${escapeHtml(sample)}</span>
                    </button>
                  `;
                }).join('')}
              </section>

              <div class="w1-level__workspace">
                <section class="w1-level__zones" aria-label="Variable type buckets">
                  ${ZONES.map(zone => `
                    <div class="drop-zone dd-zone w1-type-zone" data-dd-zone="${zone.id}">
                      <div class="w1-type-zone__header">
                        <span class="w1-type-zone__icon" aria-hidden="true">${escapeHtml(zone.icon)}</span>
                        <div>
                          <h3 class="w1-type-zone__title">${escapeHtml(zone.label)}</h3>
                          <p class="w1-type-zone__copy">${escapeHtml(zone.copy)}</p>
                        </div>
                        <span class="drop-zone__count" data-zone-count="${zone.id}">0</span>
                      </div>
                    </div>
                  `).join('')}
                </section>

                <section class="card card--elevated w1-level__feedback" aria-live="polite">
                  <p class="eyebrow">Coach Feed</p>
                  <p id="w1-l1-feedback-text" class="w1-level__feedback-copy">
                    Start by finding the clearly temporal field. Then separate measured quantities from plain labels.
                  </p>
                </section>

                <section class="card w1-level__hint-box" id="w1-l1-hint-box" hidden>
                  <p class="eyebrow">Hint</p>
                  <p id="w1-l1-hint-text" class="w1-level__hint-copy"></p>
                </section>
              </div>
            </div>
          </article>
        </div>
      </section>
    `;

    this._ui.progress = container.querySelector('#w1-l1-progress');
    this._ui.feedback = container.querySelector('#w1-l1-feedback-text');
    this._ui.hintBox = container.querySelector('#w1-l1-hint-box');
    this._ui.hintText = container.querySelector('#w1-l1-hint-text');
    this._ui.hintButton = container.querySelector('#w1-l1-hint-btn');
    this._ui.resetButton = container.querySelector('#w1-l1-reset-btn');
    this._ui.zoneCounts = Array.from(container.querySelectorAll('[data-zone-count]'));

    this._table = new DataTable(container.querySelector('#w1-l1-table'), this._dataset, {
      showIndex: false,
      showNullBadges: false,
      showRanges: false,
      showTypeBadges: true,
      showStatsButtons: false,
      sortable: false,
      compact: false,
      pageSize: 10,
      worldColor: 'var(--color-world-1)',
    });

    this._disableHeaderBadgeDragging();
    this._updateBoardState({});
  }

  start() {
    this._dragDrop = createDragDrop({
      container: this._container,
      draggableSelector: '.dd-draggable',
      zoneSelector: '.dd-zone',
      multiplePerZone: true,
      snapBack: true,
      lockOnCorrect: true,
      correctAnswers: ANSWER_KEY,
      onDrop: () => {
        this._updateBoardState(this._dragDrop.getPlacements());
      },
      onCorrect: (tokenId, zoneId) => {
        const columnName = this._columnFromToken(tokenId);
        const zone = zoneMeta(zoneId);

        if (columnName && zone) {
          this._table.setTypeBadge(columnName, zone.typeKey);
          this._table.flashColumn(columnName, 'green');
          this._setFeedback(COLUMN_RULES[columnName].rationale);
        }

        this._updateBoardState(this._dragDrop.getPlacements());
        this._engine.correct();
      },
      onIncorrect: (tokenId) => {
        const columnName = this._columnFromToken(tokenId);

        if (columnName) {
          this._table.flashColumn(columnName, 'amber');
          this._setFeedback(`Not quite. ${COLUMN_RULES[columnName].rationale}`);
        }

        this._updateBoardState(this._dragDrop.getPlacements());
        this._scheduleBoardRefresh();
        this._engine.mistake({ costsLife: false, countsMistake: true });
      },
      onComplete: (placements) => {
        if (this._completed) return;
        if (!validatePlacementMap(placements, ANSWER_KEY)) return;

        this._completed = true;
        this._setFeedback('Everything is classified correctly. You now know which columns are numeric, categorical, or temporal.');
        this._engine.complete();
      },
    });

    this._onControlClick = event => {
      if (event.target.closest('#w1-l1-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w1-l1-reset-btn')) {
        this._resetBoard();
      }
    };

    this._container?.addEventListener('click', this._onControlClick);
  }

  getHint(hintsUsed) {
    return PROBLEM.hints?.[hintsUsed - 1] ?? null;
  }

  pause() {}

  resume() {}

  teardown() {
    this._events?.abort();
    if (this._boardSyncTimer) {
      window.clearTimeout(this._boardSyncTimer);
      this._boardSyncTimer = null;
    }
    this._container?.removeEventListener('click', this._onControlClick);
    this._dragDrop?.destroy();
    this._table?.destroy?.();
    this._dragDrop = null;
    this._table = null;
    this._onControlClick = null;
    this._ui = {};
  }

  _disableHeaderBadgeDragging() {
    this._container.querySelectorAll('.type-badge').forEach(badge => {
      badge.setAttribute('draggable', 'false');
      badge.setAttribute('aria-hidden', 'true');
      badge.style.pointerEvents = 'none';
      badge.removeAttribute('title');
    });
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
    this._dragDrop?.reset();
    this._completed = false;
    if (this._boardSyncTimer) {
      window.clearTimeout(this._boardSyncTimer);
      this._boardSyncTimer = null;
    }

    Object.keys(COLUMN_RULES).forEach(columnName => {
      this._table.clearTypeBadge(columnName);
    });

    this._updateBoardState(this._dragDrop?.getPlacements() ?? {});
    this._setFeedback('Board reset. Try anchoring the obvious time field first, then split counts from measured values.');
  }

  _updateBoardState(placements) {
    const placed = countPlacedColumns(placements);

    if (this._ui.progress) {
      this._ui.progress.textContent = `${placed} / ${this._dataset.columns.length} columns classified`;
    }

    this._ui.zoneCounts.forEach(node => {
      const zoneId = node.getAttribute('data-zone-count');
      node.textContent = String(zoneCount(placements, zoneId));
    });
  }

  _setFeedback(message) {
    if (this._ui.feedback) {
      this._ui.feedback.textContent = message;
    }
  }

  _scheduleBoardRefresh() {
    if (this._boardSyncTimer) {
      window.clearTimeout(this._boardSyncTimer);
    }

    // DragDrop removes incorrect placements after its shake + snap-back finish.
    this._boardSyncTimer = window.setTimeout(() => {
      this._boardSyncTimer = null;
      this._updateBoardState(this._dragDrop?.getPlacements() ?? {});
    }, 650);
  }

  _columnFromToken(tokenId) {
    return Object.keys(COLUMN_RULES).find(columnName => COLUMN_RULES[columnName].tokenId === tokenId) ?? null;
  }
}
