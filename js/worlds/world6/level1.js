'use strict';

import { getLevelProblem } from '../../data/problems.js';
import { createDragDrop } from '../../widgets/dragdrop.js';

const PROBLEM = getLevelProblem(6, 1);

const STATIONS = Object.freeze([
  Object.freeze({
    id: 'cleaning-imputation',
    code: 'W2',
    title: 'Cleaning & Imputation',
    color: 'var(--color-world-2)',
    icon: 'NULL',
    copy: 'Repair missing values before every downstream statistic starts trusting the column.',
    rationale: 'Imputation leads because every later step depends on stable values instead of gaps.',
  }),
  Object.freeze({
    id: 'outlier-treatment',
    code: 'W3',
    title: 'Outlier Treatment',
    color: 'var(--color-world-3)',
    icon: 'IQR',
    copy: 'Cap, clip, or remove explosive values before they distort the next transformation.',
    rationale: 'Outlier control belongs right after cleanup so extreme values cannot bend encoders or scalers.',
  }),
  Object.freeze({
    id: 'encoding',
    code: 'W4',
    title: 'Encoding',
    color: 'var(--color-world-4)',
    icon: 'CAT',
    copy: 'Translate categories into model-ready numbers once the raw labels are already cleaned.',
    rationale: 'Encoding waits until categories are final, otherwise you expand noise into the matrix.',
  }),
  Object.freeze({
    id: 'scaling',
    code: 'W5',
    title: 'Scaling',
    color: 'var(--color-world-5)',
    icon: 'Z',
    copy: 'Balance numeric ranges only after every feature has reached its final numeric form.',
    rationale: 'Scaling finishes the line because it should see the final post-encoding numeric feature space.',
  }),
]);

const CORRECT_ORDER = Object.freeze(STATIONS.map(station => station.id));

const SLOT_META = Object.freeze([
  Object.freeze({ id: 'slot-1', step: '01', label: 'Repair Intake', copy: 'Stabilize the raw batch before anything else reads it.' }),
  Object.freeze({ id: 'slot-2', step: '02', label: 'Tame Extremes', copy: 'Protect the factory from leverage spikes and impossible values.' }),
  Object.freeze({ id: 'slot-3', step: '03', label: 'Translate Signals', copy: 'Turn categories into machine-readable structure.' }),
  Object.freeze({ id: 'slot-4', step: '04', label: 'Balance Magnitude', copy: 'Finish by aligning the numeric scale after every feature is final.' }),
]);

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM?.hints ?? []),
  'The line still starts with missing-value repair. Later statistics should not be computed on holes.',
  'Outlier treatment lands before encoding and scaling because giant values can distort both.',
  'Encoding happens before scaling because categories need to become numbers before a scaler can touch them.',
]);

const DEFAULT_FEEDBACK = 'Drag each station into the belt slot where that preprocessing responsibility truly belongs.';
const DEFAULT_STATUS = 'Lock the factory from left to right: clean, protect, translate, then balance.';
const SUMMARY_COPY = 'The assembly line is healthy again: missing values first, extreme values second, categories third, scale last.';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slotIdForToken(tokenId) {
  const index = CORRECT_ORDER.indexOf(tokenId);
  return index === -1 ? null : `slot-${index + 1}`;
}

function stationById(stationId) {
  return STATIONS.find(station => station.id === stationId) ?? null;
}

function slotById(slotId) {
  return SLOT_META.find(slot => slot.id === slotId) ?? null;
}

function nextOpenSlotId(lockedTokenIds) {
  for (const tokenId of CORRECT_ORDER) {
    if (!lockedTokenIds.has(tokenId)) {
      return slotIdForToken(tokenId);
    }
  }
  return null;
}

function progressLabel(count) {
  return `${count} / ${CORRECT_ORDER.length} stations locked`;
}

function segmentLabel(count) {
  return `${count} / ${CORRECT_ORDER.length} belt segments live`;
}

export default class World6Level1 {
  meta = {
    title: PROBLEM?.title ?? 'Assemble the Factory',
    subtitle: PROBLEM?.objective ?? 'Place each preprocessing station in the correct end-to-end pipeline slot.',
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._dragDrop = null;
    this._events = null;
    this._lockedTokenIds = new Set();
    this._completed = false;
    this._isRunning = false;
    this._timers = [];
    this._ui = {};
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w6-level w6-level--factory screen-section" aria-label="World 6 Level 1">
        <div class="level-hero w6-level__hero" style="--world-color: var(--color-world-6);">
          <p class="eyebrow">World 6 - Full Pipeline</p>
          <h1 class="level-hero__title">${escapeHtml(this.meta.title)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(this.meta.subtitle)}
            This is the first synthesis level: every station comes from a previous world, and the belt only runs when the whole sequence respects downstream dependencies.
          </p>
          <div class="action-row">
            <span class="status-box" id="w6-l1-progress">${progressLabel(0)}</span>
            <span class="status-box" id="w6-l1-segments">${segmentLabel(0)}</span>
            <span class="status-box" id="w6-l1-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w6-l1-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w6-l1-reset-btn" type="button">Reset Factory</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">01</span>
        </div>

        <article class="panel w6-factory-panel">
          <div class="w6-level__panel-head">
            <div>
              <p class="eyebrow">Factory Floor</p>
              <h2 class="panel-title">Reconnect the preprocessing line from raw intake to clean output</h2>
            </div>
            <p class="w6-level__microcopy">
              Every correct placement locks that station into the floor and wakes up another conveyor segment. Wrong drops bounce back because an unhealthy sequence would contaminate the stages behind it.
            </p>
          </div>

          <div class="w6-factory-layout">
            <section class="w6-factory-yard" aria-label="Processing Stations">
              <div class="w6-factory-yard__head">
                <div>
                  <p class="eyebrow">Station Yard</p>
                  <h3 class="panel-title">Move each station into the correct belt slot</h3>
                </div>
                <p class="w6-factory-yard__copy">
                  Think about what each station needs from the stage before it. A downstream station should never inherit raw chaos that an upstream station was supposed to remove.
                </p>
              </div>

              <div class="w6-factory-deck" id="w6-l1-deck">
                ${STATIONS.map((station, index) => `
                  <button
                    class="drag-token dd-draggable w6-factory-card"
                    type="button"
                    data-dd-id="${station.id}"
                    style="--station-color:${station.color}; --card-tilt:${index % 2 === 0 ? '-' : ''}${4 + index}deg;"
                    aria-label="Place ${escapeHtml(station.title)} into the factory line"
                  >
                    <div class="w6-factory-card__head">
                      <span class="w6-factory-card__world">${escapeHtml(station.code)}</span>
                      <span class="w6-factory-card__icon">${escapeHtml(station.icon)}</span>
                    </div>
                    <h3 class="w6-factory-card__title">${escapeHtml(station.title)}</h3>
                    <p class="w6-factory-card__copy">${escapeHtml(station.copy)}</p>
                  </button>
                `).join('')}
              </div>
            </section>

            <div class="w6-factory-workspace">
              <section class="w6-factory-line panel" aria-label="Conveyor Assembly">
                <div class="w6-factory-line__head">
                  <div>
                    <p class="eyebrow">Conveyor Belt</p>
                    <h3 class="panel-title">Raw dataset enters on the left and should leave model-ready on the right</h3>
                  </div>
                  <p class="w6-factory-line__copy">
                    The packet run at the end is automatic. Your job is to make the route trustworthy.
                  </p>
                </div>

                <div class="w6-factory-track" id="w6-l1-track">
                  <div class="w6-factory-track__node w6-factory-track__node--terminal" data-node="raw">
                    <span class="w6-factory-track__eyebrow">Input</span>
                    <strong class="w6-factory-track__title">Raw Dataset Bin</strong>
                    <p class="w6-factory-track__copy">Gaps, spikes, categories, mixed scale.</p>
                  </div>

                  <div class="w6-factory-track__rail" aria-hidden="true">
                    <span class="w6-factory-track__flow"></span>
                    <span class="w6-factory-track__packet"></span>
                  </div>

                  <div class="w6-factory-track__slots">
                    ${SLOT_META.map(slot => `
                      <div
                        class="drop-zone dd-zone w6-factory-slot"
                        data-dd-zone="${slot.id}"
                        data-dd-label="${escapeHtml(slot.label)}"
                        aria-label="${escapeHtml(slot.label)}"
                      >
                        <span class="w6-factory-slot__step">${escapeHtml(slot.step)}</span>
                        <h4 class="w6-factory-slot__title">${escapeHtml(slot.label)}</h4>
                        <p class="w6-factory-slot__copy">${escapeHtml(slot.copy)}</p>
                      </div>
                    `).join('')}
                  </div>

                  <div class="w6-factory-track__node w6-factory-track__node--terminal" data-node="clean">
                    <span class="w6-factory-track__eyebrow">Output</span>
                    <strong class="w6-factory-track__title">Clean Feature Matrix</strong>
                    <p class="w6-factory-track__copy">Stable, encoded, scaled, ready.</p>
                  </div>
                </div>
              </section>

              <div class="w6-factory-support">
                <section class="card card--elevated w6-level__feedback" aria-live="polite">
                  <p class="eyebrow">Factory Coach</p>
                  <p id="w6-l1-feedback-text" class="w6-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
                </section>

                <section class="card w6-level__hint-box" id="w6-l1-hint-box" hidden>
                  <p class="eyebrow">Hint</p>
                  <p id="w6-l1-hint-text" class="w6-level__hint-copy"></p>
                </section>
              </div>
            </div>
          </div>
        </article>

        <section class="panel w6-factory-summary" id="w6-l1-summary" hidden aria-label="Factory Recap">
          <div class="w6-level__panel-head">
            <div>
              <p class="eyebrow">Factory Recap</p>
              <h2 class="panel-title">The line only works because each station hands the next one safer data</h2>
            </div>
            <p class="w6-level__microcopy">${escapeHtml(SUMMARY_COPY)}</p>
          </div>

          <div class="w6-factory-summary__grid">
            ${CORRECT_ORDER.map((stationId, index) => {
              const station = stationById(stationId);
              return `
                <article class="w6-factory-summary__card" style="--station-color:${station.color};">
                  <p class="w6-factory-summary__index">Station ${index + 1}</p>
                  <h3 class="w6-factory-summary__title">${escapeHtml(station.title)}</h3>
                  <p class="w6-factory-summary__copy">${escapeHtml(station.rationale)}</p>
                </article>
              `;
            }).join('')}
          </div>

          <div class="w6-factory-summary__formula">
            <p class="w6-factory-summary__label">Factory Rule</p>
            <p class="w6-factory-summary__code">
              raw -> <span class="formula-cleaning">clean</span> -> <span class="formula-outliers">protect</span> -> <span class="formula-encoding">translate</span> -> <span class="formula-scaling">balance</span> -> ready
            </p>
          </div>

          <div class="action-row">
            <span class="status-box">The assembly line is live. Next stop: the leakage checkpoint.</span>
            <button class="btn btn--primary" id="w6-l1-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w6-l1-progress');
    this._ui.segments = container.querySelector('#w6-l1-segments');
    this._ui.status = container.querySelector('#w6-l1-status');
    this._ui.feedback = container.querySelector('#w6-l1-feedback-text');
    this._ui.hintBox = container.querySelector('#w6-l1-hint-box');
    this._ui.hintText = container.querySelector('#w6-l1-hint-text');
    this._ui.track = container.querySelector('#w6-l1-track');
    this._ui.slotEls = Array.from(container.querySelectorAll('.w6-factory-slot'));
    this._ui.trackNodes = Array.from(container.querySelectorAll('.w6-factory-track__node'));
    this._ui.summary = container.querySelector('#w6-l1-summary');
    this._ui.finishButton = container.querySelector('#w6-l1-finish-btn');

    this._syncProgress();
    this._syncSlots();
  }

  start() {
    this._dragDrop = createDragDrop({
      container: this._container,
      draggableSelector: '.w6-factory-card',
      zoneSelector: '.w6-factory-slot',
      allowReorder: false,
      snapBack: true,
      lockOnCorrect: true,
      multiplePerZone: false,
      clickToPlace: true,
      gradeOnDrop: true,
      correctAnswers: CORRECT_ORDER.reduce((acc, tokenId, index) => {
        acc[`slot-${index + 1}`] = tokenId;
        return acc;
      }, {}),
      onCorrect: (tokenId, zoneId) => this._handleCorrectDrop(tokenId, zoneId),
      onIncorrect: (tokenId, zoneId) => this._handleIncorrectDrop(tokenId, zoneId),
      onComplete: () => this._startSuccessRun(),
    });

    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w6-l1-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w6-l1-reset-btn')) {
        this._resetFactory();
        return;
      }

      if (event.target.closest('#w6-l1-finish-btn')) {
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
    this._clearTimers();
    this._dragDrop?.destroy();
    this._dragDrop = null;
    this._events = null;
    this._ui = {};
  }

  _handleCorrectDrop(tokenId, zoneId) {
    if (this._completed) return;

    const station = stationById(tokenId);
    const slot = slotById(zoneId);
    this._lockedTokenIds.add(tokenId);
    this._engine.correct();
    this._syncProgress();
    this._syncSlots();

    this._setFeedback(`${station?.title ?? 'Station'} locked into ${slot?.label ?? 'the belt'}. ${station?.rationale ?? ''}`);

    if (this._lockedTokenIds.size < CORRECT_ORDER.length) {
      const nextSlot = slotById(nextOpenSlotId(this._lockedTokenIds));
      this._setStatus(`${this._lockedTokenIds.size} station${this._lockedTokenIds.size === 1 ? '' : 's'} live. Next priority: ${nextSlot?.label ?? 'finish the line'}.`);
      return;
    }

    this._setStatus('All stations are aligned. Running the final packet through the factory now.');
  }

  _handleIncorrectDrop(tokenId, zoneId) {
    const station = stationById(tokenId);
    const slot = slotById(zoneId);

    this._engine.mistake({ costsLife: false, countsMistake: true });
    this._setFeedback(`${station?.title ?? 'That station'} does not belong in ${slot?.label ?? 'that slot'} yet. This position depends on an earlier cleanup decision being finished before the line can safely continue.`);
    this._setStatus('Incorrect routing. Repair missing values first, then outliers, then encoding, then scaling.');
  }

  _startSuccessRun() {
    if (this._isRunning || this._completed) return;

    this._isRunning = true;
    this._ui.track?.classList.add('is-running');
    this._setFeedback('Factory assembled. The raw packet is traveling through each station in the order you restored.');
    this._setStatus('Packet run in progress. Watch each station validate the stage behind it.');
    this._syncSlots();

    const sequence = [
      this._ui.trackNodes[0],
      ...this._ui.slotEls,
      this._ui.trackNodes[1],
    ].filter(Boolean);

    sequence.forEach((node, index) => {
      const timer = window.setTimeout(() => {
        node.classList.add('is-active');
      }, 180 + index * 260);
      this._timers.push(timer);
    });

    const finishTimer = window.setTimeout(() => {
      this._completeLevel();
    }, 180 + sequence.length * 260 + 240);
    this._timers.push(finishTimer);
  }

  _completeLevel() {
    this._isRunning = false;
    this._completed = true;
    this._ui.track?.classList.remove('is-running');
    this._ui.track?.classList.add('is-complete');

    if (this._ui.summary) {
      this._ui.summary.hidden = false;
      requestAnimationFrame(() => {
        this._ui.summary.classList.add('is-revealed');
      });
      this._ui.summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    this._setFeedback('The factory is stable again. Every downstream station now receives the kind of data it actually expects.');
    this._setStatus('Assembly complete. Continue when you are ready for the leakage checkpoint.');
    this._syncProgress();
    this._syncSlots();
  }

  _resetFactory() {
    this._clearTimers();
    this._dragDrop?.reset();
    this._lockedTokenIds.clear();
    this._completed = false;
    this._isRunning = false;

    this._ui.track?.classList.remove('is-running', 'is-complete');
    this._ui.slotEls?.forEach(slot => {
      slot.classList.remove('w6-factory-slot--locked', 'w6-factory-slot--next', 'is-active');
    });
    this._ui.trackNodes?.forEach(node => {
      node.classList.remove('is-active');
    });

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
    this._syncProgress();
    this._syncSlots();
  }

  _showHint() {
    const { allowed, text } = this._engine.requestHint();
    if (!allowed || !text) return;

    this._ui.hintBox?.removeAttribute('hidden');
    if (this._ui.hintText) {
      this._ui.hintText.textContent = text;
    }
  }

  _syncProgress() {
    const lockedCount = this._lockedTokenIds.size;

    if (this._ui.progress) {
      this._ui.progress.textContent = progressLabel(lockedCount);
    }

    if (this._ui.segments) {
      this._ui.segments.textContent = segmentLabel(lockedCount);
    }

    if (this._ui.finishButton) {
      this._ui.finishButton.disabled = !this._completed;
    }
  }

  _syncSlots() {
    const nextSlotId = nextOpenSlotId(this._lockedTokenIds);

    this._ui.slotEls?.forEach(slot => {
      const zoneId = slot.getAttribute('data-dd-zone');
      const expectedTokenId = CORRECT_ORDER[Math.max(0, SLOT_META.findIndex(entry => entry.id === zoneId))];
      const locked = this._lockedTokenIds.has(expectedTokenId);

      slot.classList.toggle('w6-factory-slot--locked', locked);
      slot.classList.toggle('w6-factory-slot--next', !locked && !this._completed && !this._isRunning && zoneId === nextSlotId);
      slot.classList.toggle('is-active', this._isRunning && locked);
    });
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

  _clearTimers() {
    this._timers.forEach(timer => window.clearTimeout(timer));
    this._timers = [];
  }
}
