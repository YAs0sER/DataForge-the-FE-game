'use strict';

import { getLevelProblem } from '../../data/problems.js';
import { validateOrderedPlacement } from '../../data/answers.js';
import { createDragDrop } from '../../widgets/dragdrop.js';

const PROBLEM = getLevelProblem(1, 3);

const CORRECT_ORDER = Object.freeze([
  'cleaning-imputation',
  'outlier-treatment',
  'encoding',
  'scaling',
]);

const STATION_META = Object.freeze({
  'cleaning-imputation': {
    code: 'CLN',
    color: 'var(--color-world-2)',
    copy: 'Repair gaps first so later statistics are built on complete information.',
    rationale: 'Cleaning and imputation should come first, because every later stage depends on stable values.',
  },
  'outlier-treatment': {
    code: 'OUT',
    color: 'var(--color-world-3)',
    copy: 'Tame explosive values before they distort encoders, scalers, or summaries.',
    rationale: 'Outlier treatment belongs right after imputation, before the dataset is translated or rescaled.',
  },
  'encoding': {
    code: 'ENC',
    color: 'var(--color-world-4)',
    copy: 'Translate categories into model-friendly numbers after the raw values are stabilized.',
    rationale: 'Encoding should happen after cleanup, because categories need their final cleaned form before expansion.',
  },
  scaling: {
    code: 'SCL',
    color: 'var(--color-world-5)',
    copy: 'Balance numeric ranges after every feature has reached its final numeric form.',
    rationale: 'Scaling comes last, once every feature is numeric and ready for distance-sensitive models.',
  },
});

const SLOT_LABELS = Object.freeze([
  { id: 'slot-1', label: '1', subtitle: 'Start' },
  { id: 'slot-2', label: '2', subtitle: 'Stabilize' },
  { id: 'slot-3', label: '3', subtitle: 'Translate' },
  { id: 'slot-4', label: '4', subtitle: 'Balance' },
]);

const DEFAULT_FEEDBACK = 'Drag the stations into the rail, then run the pipeline to check the sequence.';
const DEFAULT_STATUS = 'Place all four stations before you press Run Pipeline.';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function countPlaced(placements) {
  return Object.values(placements).filter(Boolean).length;
}

function isRailFilled(placements) {
  return CORRECT_ORDER.every(tokenId => Boolean(placements[tokenId]));
}

function slotForToken(tokenId) {
  return `slot-${CORRECT_ORDER.indexOf(tokenId) + 1}`;
}

function tokenForSlot(slotId) {
  return CORRECT_ORDER.find(tokenId => slotForToken(tokenId) === slotId) ?? null;
}

export default class World1Level3 {
  meta = {
    title: PROBLEM?.title ?? 'Build the Pipeline',
    subtitle: PROBLEM?.objective ?? 'Arrange the preprocessing stations in the order a healthy data pipeline should follow.',
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._dragDrop = null;
    this._events = null;
    this._completed = false;
    this._isRunning = false;
    this._runTimers = [];
    this._ui = {};
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w1-level w1-level--pipeline screen-section" aria-label="World 1 Level 3">
        <div class="level-hero w1-level__hero" style="--world-color: var(--color-world-1);">
          <p class="eyebrow">World 1 - Foundations</p>
          <h1 class="level-hero__title">${escapeHtml(PROBLEM.title)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(PROBLEM.objective)}
            Arrange the preprocessing stations, then run the sequence like a healthy feature-engineering conveyor.
          </p>
          <div class="action-row">
            <span class="status-box" id="w1-l3-progress">0 / ${CORRECT_ORDER.length} stations placed</span>
            <span class="status-box" id="w1-l3-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w1-l3-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w1-l3-reset-btn" type="button">Reset Layout</button>
            <button class="btn btn--primary" id="w1-l3-run-btn" type="button">Run Pipeline</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">03</span>
        </div>

        <article class="panel w1-pipeline-panel">
          <div class="w1-level__panel-head">
            <div>
              <p class="eyebrow">Pipeline Lab</p>
              <h2 class="panel-title">Turn the scattered stations into one clean processing flow</h2>
            </div>
            <p class="w1-level__microcopy">
              This level checks sequence, not formulas. Think about which stage must happen before another stage can trust the data it receives.
            </p>
          </div>

          <div class="w1-pipeline-layout">
            <section class="w1-pipeline-deck" id="w1-l3-deck" aria-label="Pipeline stations">
              ${PROBLEM.cards.map(card => {
                const meta = STATION_META[card.id];
                return `
                  <button
                    class="drag-token dd-draggable w1-pipeline-card"
                    type="button"
                    data-dd-id="${card.id}"
                    style="--station-color: ${meta.color};"
                    aria-label="Place ${escapeHtml(card.label)} in the pipeline"
                  >
                    <span class="w1-pipeline-card__code">${escapeHtml(meta.code)}</span>
                    <span class="w1-pipeline-card__label">${escapeHtml(card.label)}</span>
                    <span class="w1-pipeline-card__copy">${escapeHtml(meta.copy)}</span>
                  </button>
                `;
              }).join('')}
            </section>

            <div class="w1-pipeline-workspace">
              <section class="w1-pipeline-rail-shell" aria-label="Pipeline rail">
                <div class="w1-pipeline-rail" id="w1-l3-rail">
                  <div class="w1-pipeline-rail__track" aria-hidden="true">
                    <span class="w1-pipeline-rail__flow"></span>
                    <span class="w1-pipeline-rail__dot"></span>
                  </div>

                  <div class="w1-pipeline-rail__slots">
                    ${SLOT_LABELS.map(slot => `
                      <div
                        class="drop-zone pipeline-slot dd-zone w1-pipeline-slot"
                        data-dd-zone="${slot.id}"
                        data-dd-label="Step ${slot.label}"
                        aria-label="Pipeline step ${slot.label}"
                      >
                        <span class="pipeline-slot__number">${slot.label}</span>
                        <span class="w1-pipeline-slot__subtitle">${escapeHtml(slot.subtitle)}</span>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </section>

              <div class="w1-pipeline-feedback-grid">
                <section class="card card--elevated w1-level__feedback" aria-live="polite">
                  <p class="eyebrow">Coach Feed</p>
                  <p id="w1-l3-feedback-text" class="w1-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
                </section>

                <section class="card w1-level__hint-box" id="w1-l3-hint-box" hidden>
                  <p class="eyebrow">Hint</p>
                  <p id="w1-l3-hint-text" class="w1-level__hint-copy"></p>
                </section>
              </div>
            </div>
          </div>
        </article>

        <section class="panel w1-pipeline-summary" id="w1-l3-summary" hidden aria-label="Pipeline Recap">
          <div class="w1-level__panel-head">
            <div>
              <p class="eyebrow">Pipeline Recap</p>
              <h2 class="panel-title">Healthy preprocessing follows one dependable order</h2>
            </div>
            <p class="w1-level__microcopy">
              Clean first, protect the distribution, translate categories, then balance the numeric scales.
            </p>
          </div>

          <div class="w1-pipeline-summary__grid">
            ${CORRECT_ORDER.map((tokenId, index) => {
              const card = PROBLEM.cards.find(entry => entry.id === tokenId);
              const meta = STATION_META[tokenId];
              return `
                <article class="w1-pipeline-summary__step" style="--station-color: ${meta.color};">
                  <p class="w1-pipeline-summary__index">Step ${index + 1}</p>
                  <h3 class="w1-pipeline-summary__title">${escapeHtml(card.label)}</h3>
                  <p class="w1-pipeline-summary__copy">${escapeHtml(meta.rationale)}</p>
                </article>
              `;
            }).join('')}
          </div>

          <div class="w1-pipeline-formula">
            <p class="w1-pipeline-formula__label">Pipeline Formula</p>
            <p class="w1-pipeline-formula__code">
              X' = <span class="formula-scaling">f_scale</span>(<span class="formula-encoding">f_encode</span>(<span class="formula-outliers">f_outliers</span>(<span class="formula-cleaning">f_impute</span>(X))))
            </p>
          </div>

          <div class="action-row">
            <span class="status-box">The rail is stable. You are ready for the World 1 review.</span>
            <button class="btn btn--primary" id="w1-l3-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w1-l3-progress');
    this._ui.status = container.querySelector('#w1-l3-status');
    this._ui.feedback = container.querySelector('#w1-l3-feedback-text');
    this._ui.hintBox = container.querySelector('#w1-l3-hint-box');
    this._ui.hintText = container.querySelector('#w1-l3-hint-text');
    this._ui.runButton = container.querySelector('#w1-l3-run-btn');
    this._ui.resetButton = container.querySelector('#w1-l3-reset-btn');
    this._ui.finishButton = container.querySelector('#w1-l3-finish-btn');
    this._ui.rail = container.querySelector('#w1-l3-rail');
    this._ui.summary = container.querySelector('#w1-l3-summary');
    this._ui.slots = Array.from(container.querySelectorAll('.w1-pipeline-slot'));

    this._updateProgress();
  }

  start() {
    this._dragDrop = createDragDrop({
      container: this._container,
      draggableSelector: '.w1-pipeline-card',
      zoneSelector: '.w1-pipeline-slot',
      allowReorder: true,
      snapBack: false,
      lockOnCorrect: false,
      multiplePerZone: false,
      clickToPlace: true,
      gradeOnDrop: false,
      onDrop: (tokenId, zoneId) => {
        const card = PROBLEM.cards.find(entry => entry.id === tokenId);
        const slotNumber = zoneId.replace('slot-', '');
        this._clearRunDecorations();
        this._setFeedback(`${card?.label ?? 'Station'} moved into step ${slotNumber}. Keep arranging the pipeline before you run it.`);
        this._setStatus('Rearrange freely, then press Run Pipeline to check the full sequence.');
        this._updateProgress();
      },
    });

    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w1-l3-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w1-l3-reset-btn')) {
        this._resetLayout();
        return;
      }

      if (event.target.closest('#w1-l3-run-btn')) {
        this._runPipelineCheck();
        return;
      }

      if (event.target.closest('#w1-l3-finish-btn')) {
        if (this._completed) {
          void this._engine.complete();
        }
      }
    }, { signal });
  }

  getHint(hintsUsed) {
    return PROBLEM.hints?.[hintsUsed - 1] ?? null;
  }

  pause() {}

  resume() {}

  teardown() {
    this._events?.abort();
    this._clearTimers();
    this._dragDrop?.destroy();
    this._dragDrop = null;
    this._events = null;
    this._ui = {};
  }

  _updateProgress() {
    const placements = this._dragDrop?.getPlacements() ?? {};
    const placedCount = countPlaced(placements);

    if (this._ui.progress) {
      this._ui.progress.textContent = `${placedCount} / ${CORRECT_ORDER.length} stations placed`;
    }

    if (this._ui.runButton) {
      this._ui.runButton.disabled = this._isRunning;
    }
  }

  _runPipelineCheck() {
    if (this._isRunning || this._completed) return;

    const placements = this._dragDrop?.getPlacements() ?? {};
    this._clearRunDecorations();

    if (!isRailFilled(placements)) {
      this._markEmptySlots(placements);
      this._setFeedback('The rail is not assembled yet. Fill every numbered slot before you run the sequence.');
      this._setStatus('All four slots must be filled before the pipeline can run.');
      this._engine.mistake({ costsLife: false, countsMistake: true });
      return;
    }

    if (!validateOrderedPlacement(placements, CORRECT_ORDER)) {
      this._markWrongSlots(placements);
      this._setFeedback('The order is still unstable. Fix the highlighted slots so the pipeline cleans before it translates and scales.');
      this._setStatus('Incorrect order. Rearrange the highlighted stations and run the pipeline again.');
      this._engine.mistake({ costsLife: false, countsMistake: true });
      return;
    }

    this._startSuccessRun();
  }

  _startSuccessRun() {
    this._isRunning = true;
    if (this._ui.runButton) {
      this._ui.runButton.disabled = true;
      this._ui.runButton.textContent = 'Running...';
    }

    this._setFeedback('The sequence is healthy. Watch the data move through cleaning, outliers, encoding, and scaling.');
    this._setStatus('Pipeline locked. Running the full flow now.');
    this._ui.rail?.classList.add('is-running');

    this._ui.slots.forEach((slot, index) => {
      const timer = window.setTimeout(() => {
        slot.classList.add('w1-pipeline-slot--lit');
      }, index * 340);
      this._runTimers.push(timer);
    });

    const finishTimer = window.setTimeout(() => {
      this._ui.rail?.classList.remove('is-running');
      this._ui.rail?.classList.add('is-complete');
      if (this._ui.runButton) {
        this._ui.runButton.textContent = 'Run Pipeline';
      }
      this._isRunning = false;
      this._completed = true;
      this._engine.correct();
      this._revealSummary();
    }, 1700);

    this._runTimers.push(finishTimer);
  }

  _revealSummary() {
    if (!this._ui.summary) return;

    this._ui.summary.hidden = false;
    requestAnimationFrame(() => {
      this._ui.summary.classList.add('is-revealed');
    });

    this._setFeedback('Perfect order. Review the recap below, then continue into the World 1 quick check.');
    this._setStatus('Pipeline verified. Continue when you are ready.');
    this._ui.summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  _markEmptySlots(placements) {
    this._ui.slots.forEach(slot => {
      const slotId = slot.getAttribute('data-dd-zone');
      const hasToken = Object.values(placements).includes(slotId);
      slot.classList.toggle('w1-pipeline-slot--missing', !hasToken);
    });
  }

  _markWrongSlots(placements) {
    this._ui.slots.forEach(slot => {
      const slotId = slot.getAttribute('data-dd-zone');
      const expectedTokenId = tokenForSlot(slotId);
      const isCorrect = placements[expectedTokenId] === slotId;
      slot.classList.toggle('w1-pipeline-slot--wrong', !isCorrect);
    });
  }

  _clearRunDecorations() {
    this._ui.slots.forEach(slot => {
      slot.classList.remove('w1-pipeline-slot--wrong', 'w1-pipeline-slot--missing', 'w1-pipeline-slot--lit');
    });
    this._ui.rail?.classList.remove('is-running', 'is-complete');
  }

  _resetLayout() {
    this._clearTimers();
    this._dragDrop?.reset();
    this._clearRunDecorations();
    this._completed = false;
    this._isRunning = false;

    if (this._ui.runButton) {
      this._ui.runButton.disabled = false;
      this._ui.runButton.textContent = 'Run Pipeline';
    }

    if (this._ui.summary) {
      this._ui.summary.hidden = true;
      this._ui.summary.classList.remove('is-revealed');
    }

    this._setFeedback(DEFAULT_FEEDBACK);
    this._setStatus(DEFAULT_STATUS);
    this._updateProgress();
  }

  _showHint() {
    const { allowed, text } = this._engine.requestHint();
    if (!allowed || !text) return;

    this._ui.hintBox?.removeAttribute('hidden');
    if (this._ui.hintText) {
      this._ui.hintText.textContent = text;
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

  _clearTimers() {
    this._runTimers.forEach(timer => window.clearTimeout(timer));
    this._runTimers = [];
  }
}
