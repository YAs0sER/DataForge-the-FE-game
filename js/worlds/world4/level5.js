'use strict';

import { getLevelProblem } from '../../data/problems.js';
import { createMultiZoneDrop } from '../../widgets/dragdrop.js';

const PROBLEM = getLevelProblem(4, 5);
const LEVEL_TITLE = PROBLEM?.title ?? 'Which Encoding When?';
const LEVEL_OBJECTIVE = PROBLEM?.objective ?? 'Match each variable/model pair to the safest encoding method.';

const METHOD_ZONES = Object.freeze([
  Object.freeze({
    id: 'zone-one-hot',
    label: 'One-Hot',
    shortLabel: 'One-Hot',
    formula: '1 column per category',
    copy: 'Best for low-cardinality nominal features, especially when linear models would misread raw integer labels as order.',
  }),
  Object.freeze({
    id: 'zone-label',
    label: 'Label',
    shortLabel: 'Label',
    formula: 'ordered codes',
    copy: 'Safe when the category already has a true rank and the integers are representing that order rather than inventing one.',
  }),
  Object.freeze({
    id: 'zone-frequency',
    label: 'Frequency',
    shortLabel: 'Frequency',
    formula: 'ni / N',
    copy: 'Useful when one-hot would explode into too many sparse columns because the category vocabulary is huge.',
  }),
]);

const SCENARIOS = Object.freeze([
  Object.freeze({
    id: 'scenario-color-linear',
    tokenId: 'token-color-linear',
    variable: 'Color',
    typeLabel: 'Nominal',
    valuesLabel: '3 values',
    detail: 'Red, Blue, Green',
    model: 'Linear Regression',
    zoneId: 'zone-one-hot',
    reason: 'a linear model should see three separate flags instead of a fake numeric order between colors.',
  }),
  Object.freeze({
    id: 'scenario-browser-linear',
    tokenId: 'token-browser-linear',
    variable: 'Browser',
    typeLabel: 'Nominal',
    valuesLabel: '4 values',
    detail: 'Chrome, Safari, Edge, Firefox',
    model: 'Logistic Regression',
    zoneId: 'zone-one-hot',
    reason: 'the categories are named groups with no rank, so one-hot keeps the model from treating one browser as greater than another.',
  }),
  Object.freeze({
    id: 'scenario-education-forest',
    tokenId: 'token-education-forest',
    variable: 'Education Level',
    typeLabel: 'Ordinal',
    valuesLabel: 'Low -> Medium -> High',
    detail: 'ordered achievement scale',
    model: 'Random Forest',
    zoneId: 'zone-label',
    reason: 'the scale already has real order, so compact integer codes can preserve rank without inventing a new structure.',
  }),
  Object.freeze({
    id: 'scenario-city-size-linear',
    tokenId: 'token-city-size-linear',
    variable: 'City Size',
    typeLabel: 'Ordinal',
    valuesLabel: 'Small -> Medium -> Large',
    detail: 'ordered market size',
    model: 'Linear Regression',
    zoneId: 'zone-label',
    reason: 'the order is meaningful, so label-style codes can express progression more directly than a wide one-hot matrix.',
  }),
  Object.freeze({
    id: 'scenario-postal-nn',
    tokenId: 'token-postal-nn',
    variable: 'Postal Code',
    typeLabel: 'Nominal',
    valuesLabel: '500 unique values',
    detail: 'very high cardinality',
    model: 'Neural Network',
    zoneId: 'zone-frequency',
    reason: 'one-hot would create hundreds of sparse columns, so a compact frequency signal is the safer first move.',
  }),
  Object.freeze({
    id: 'scenario-merchant-boosting',
    tokenId: 'token-merchant-boosting',
    variable: 'Merchant ID',
    typeLabel: 'Nominal',
    valuesLabel: '420 unique values',
    detail: 'long category tail',
    model: 'Gradient Model',
    zoneId: 'zone-frequency',
    reason: 'the category count is too large for clean one-hot expansion, so frequency encoding keeps the signal compact.',
  }),
]);

const ANSWER_KEY = Object.freeze(
  METHOD_ZONES.reduce((acc, zone) => {
    acc[zone.id] = Object.freeze(
      SCENARIOS
        .filter(scenario => scenario.zoneId === zone.id)
        .map(scenario => scenario.tokenId)
    );
    return acc;
  }, {})
);

const STEP_META = Object.freeze([
  Object.freeze({
    id: 'one-hot-safe',
    zoneId: 'zone-one-hot',
    label: 'Protect linear models from fake order',
    chapter: 'Nominal + Linear',
    recap: 'Small nominal vocabularies are safest with one-hot because linear models should not read raw integers as rank.',
  }),
  Object.freeze({
    id: 'label-safe',
    zoneId: 'zone-label',
    label: 'Keep true order without widening the matrix',
    chapter: 'Ordinal Signal',
    recap: 'Label-style codes are safe when the category already carries a real progression such as low, medium, high.',
  }),
  Object.freeze({
    id: 'frequency-safe',
    zoneId: 'zone-frequency',
    label: 'Shrink huge vocabularies before they explode',
    chapter: 'High Cardinality',
    recap: 'Frequency encoding compresses long category tails into one numeric feature instead of hundreds of sparse binary columns.',
  }),
]);

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM?.hints ?? []),
  'Nominal plus a linear model usually points toward one-hot because raw integers would imply fake order.',
  'Ordinal categories can safely keep compact label codes when the order is real and important.',
  'When a category has hundreds of unique values, frequency encoding is often safer than exploding the feature into hundreds of one-hot columns.',
]);

const DEFAULT_FEEDBACK = 'Start with the obvious low-cardinality nominal cards. If the variable has no order and the model is linear, one-hot is usually your safest first answer.';
const DEFAULT_STATUS = 'Catch each variable-model pair and route it to the encoding method that preserves meaning without wasting columns.';
const SUMMARY_COPY = 'You now have the three encoding rules in one picture: one-hot for small nominal vocabularies, label codes for real order, and frequency encoding when high cardinality would flood the matrix.';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pluralize(value, singular, plural = `${singular}s`) {
  return value === 1 ? singular : plural;
}

function scenarioByToken(tokenId) {
  return SCENARIOS.find(scenario => scenario.tokenId === tokenId) ?? null;
}

function zoneById(zoneId) {
  return METHOD_ZONES.find(zone => zone.id === zoneId) ?? null;
}

export default class World4Level5 {
  meta = {
    title: LEVEL_TITLE,
    subtitle: LEVEL_OBJECTIVE,
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._dragDrop = null;
    this._events = null;
    this._solvedTokenIds = new Set();
    this._awardedStepIds = new Set();
    this._completed = false;
    this._streak = 0;
    this._bestStreak = 0;
    this._lastCelebratedStreak = 0;
    this._ui = {};
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w4-level w4-level--encoding-chooser screen-section" aria-label="World 4 Level 5">
        <div class="level-hero w4-level__hero" style="--world-color: var(--color-world-4);">
          <p class="eyebrow">World 4 - Encoding</p>
          <h1 class="level-hero__title">${escapeHtml(LEVEL_TITLE)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(LEVEL_OBJECTIVE)}
            Read the variable type, read the model badge, then send each card to the encoding rule that keeps meaning without creating fake order or matrix bloat.
          </p>
          <div class="action-row">
            <span class="status-box" id="w4-l5-progress">0 / ${SCENARIOS.length} decision cards solved</span>
            <span class="status-box" id="w4-l5-streak">Streak 0x</span>
            <span class="status-box" id="w4-l5-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w4-l5-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w4-l5-reset-btn" type="button">Reset Flow</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">05</span>
        </div>

        <div class="w4-encoding-grid">
          <article class="panel w4-encoding-stage">
            <div class="w4-level__panel-head">
              <div>
                <p class="eyebrow">Decision Flow</p>
                <h2 class="panel-title">Variable type plus model assumptions should decide the encoding</h2>
              </div>
              <p class="w4-level__microcopy">
                The cards above are your incoming feature requests. Catch them before a bad encoding creates fake order, unnecessary width, or a giant sparse matrix.
              </p>
            </div>

            <section class="w4-encoding-scoreboard" aria-label="Decision Stats">
              <article class="w4-encoding-scoreboard__card">
                <span class="w4-encoding-scoreboard__label">Solved</span>
                <strong class="w4-encoding-scoreboard__value" id="w4-l5-solved-count">0</strong>
                <p class="w4-encoding-scoreboard__copy">Cards locked into the right method.</p>
              </article>
              <article class="w4-encoding-scoreboard__card" data-streak-shell>
                <span class="w4-encoding-scoreboard__label">Current Streak</span>
                <strong class="w4-encoding-scoreboard__value" id="w4-l5-current-streak">0x</strong>
                <p class="w4-encoding-scoreboard__copy" id="w4-l5-streak-copy">Three correct decisions in a row activates a hot streak.</p>
              </article>
              <article class="w4-encoding-scoreboard__card">
                <span class="w4-encoding-scoreboard__label">Best Streak</span>
                <strong class="w4-encoding-scoreboard__value" id="w4-l5-best-streak">0x</strong>
                <p class="w4-encoding-scoreboard__copy">Momentum matters when the pairings come fast.</p>
              </article>
            </section>

            <section class="w4-encoding-stream" aria-label="Incoming feature cards">
              <div class="w4-encoding-stream__head">
                <div>
                  <p class="eyebrow">Incoming Stream</p>
                  <h3 class="w4-encoding-stream__title">Cards drop in from the top lane</h3>
                </div>
                <p class="w4-encoding-stream__copy">
                  Drag each card into the safest method bucket, or tap a card and then tap a zone if you prefer click-to-place.
                </p>
              </div>

              <div class="w4-encoding-stream__cards" id="w4-l5-card-bank">
                ${SCENARIOS.map((scenario, index) => `
                  <button
                    class="drag-token dd-draggable w4-encoding-card"
                    type="button"
                    data-dd-id="${scenario.tokenId}"
                    data-card-zone="${scenario.zoneId}"
                    style="--card-delay:${index * 90}ms;"
                    aria-label="Route ${escapeHtml(scenario.variable)} with ${escapeHtml(scenario.model)}"
                  >
                    <div class="w4-encoding-card__head">
                      <span class="w4-encoding-card__eyebrow">${escapeHtml(scenario.variable)}</span>
                      <span class="w4-encoding-card__model">${escapeHtml(scenario.model)}</span>
                    </div>
                    <div class="w4-encoding-card__detail">
                      <span class="w4-encoding-card__badge">${escapeHtml(scenario.typeLabel)}</span>
                      <span class="w4-encoding-card__badge">${escapeHtml(scenario.valuesLabel)}</span>
                    </div>
                    <p class="w4-encoding-card__copy">${escapeHtml(scenario.detail)}</p>
                  </button>
                `).join('')}
              </div>
            </section>

            <section class="w4-encoding-zones" aria-label="Encoding method zones">
              ${METHOD_ZONES.map(zone => `
                <div
                  class="drop-zone dd-zone w4-encoding-zone"
                  data-dd-zone="${zone.id}"
                  data-dd-label="${escapeHtml(zone.label)}"
                  data-zone-family="${zone.id.replace('zone-', '')}"
                >
                  <div class="w4-encoding-zone__head">
                    <div>
                      <p class="w4-encoding-zone__eyebrow">${escapeHtml(zone.formula)}</p>
                      <h3 class="w4-encoding-zone__title">${escapeHtml(zone.label)}</h3>
                    </div>
                    <span class="w4-encoding-zone__count" data-zone-count="${zone.id}">0</span>
                  </div>
                  <p class="w4-encoding-zone__copy">${escapeHtml(zone.copy)}</p>
                  <span class="w4-encoding-zone__prompt">Drop matching cards here</span>
                </div>
              `).join('')}
            </section>
          </article>

          <div class="w4-encoding-side">
            <section class="panel w4-encoding-tracker" aria-label="Encoding Tracker">
              <div class="w4-level__panel-head">
                <div>
                  <p class="eyebrow">Encoding Tracker</p>
                  <h2 class="panel-title">Lock the three core decision rules</h2>
                </div>
                <p class="w4-level__microcopy">
                  Finish one-hot safety, ordinal safety, and high-cardinality safety. Once all three are green, the decision map is yours.
                </p>
              </div>

              <div class="w4-encoding-tracker__list">
                ${STEP_META.map((step, index) => `
                  <article class="w4-encoding-tracker__card" data-step-id="${step.id}" data-step-state="${index === 0 ? 'active' : 'pending'}">
                    <div class="w4-encoding-tracker__meta">
                      <span class="w4-encoding-tracker__status" data-step-status="${step.id}">${index === 0 ? 'Active' : 'Pending'}</span>
                      <span class="w4-encoding-tracker__index">Rule ${index + 1}</span>
                    </div>
                    <h3 class="w4-encoding-tracker__title">${escapeHtml(step.label)}</h3>
                    <p class="w4-encoding-tracker__chapter">${escapeHtml(step.chapter)}</p>
                    <p class="w4-encoding-tracker__copy">${escapeHtml(step.recap)}</p>
                  </article>
                `).join('')}
              </div>
            </section>

            <section class="card card--elevated w4-level__feedback" aria-live="polite">
              <p class="eyebrow">Coach Feed</p>
              <p id="w4-l5-feedback-text" class="w4-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
            </section>

            <section class="card w4-level__hint-box" id="w4-l5-hint-box" hidden>
              <p class="eyebrow">Hint</p>
              <p id="w4-l5-hint-text" class="w4-level__hint-copy"></p>
            </section>

            <section class="card w4-encoding-guide">
              <p class="eyebrow">Decision Guide</p>
              <div class="w4-encoding-guide__steps">
                <article class="w4-encoding-guide__step">
                  <span class="w4-encoding-guide__badge">1</span>
                  <p>Small nominal categories plus linear-style models usually want one-hot so the model does not imagine rank where none exists.</p>
                </article>
                <article class="w4-encoding-guide__step">
                  <span class="w4-encoding-guide__badge">2</span>
                  <p>Ordinal categories can stay compact with label codes when the numbers are representing a real progression.</p>
                </article>
                <article class="w4-encoding-guide__step">
                  <span class="w4-encoding-guide__badge">3</span>
                  <p>Very high-cardinality categories often need frequency encoding first so the feature space does not explode into hundreds of sparse columns.</p>
                </article>
              </div>
            </section>
          </div>
        </div>

        <section class="panel w4-encoding-summary" id="w4-l5-summary" hidden aria-label="Encoding Summary">
          <div class="w4-level__panel-head">
            <div>
              <p class="eyebrow">Encoding Recap</p>
              <h2 class="panel-title">The decision map is now stable: nominal, ordinal, and high-cardinality cases are separated</h2>
            </div>
            <p class="w4-level__microcopy">${escapeHtml(SUMMARY_COPY)}</p>
          </div>

          <div class="w4-encoding-summary__grid">
            ${METHOD_ZONES.map(zone => `
              <article class="w4-encoding-summary__card" data-summary-family="${zone.id.replace('zone-', '')}">
                <p class="w4-encoding-summary__kicker">${escapeHtml(zone.label)}</p>
                <h3 class="w4-encoding-summary__title" data-summary-count="${zone.id}">0 cards matched</h3>
                <p class="w4-encoding-summary__copy">${escapeHtml(zone.copy)}</p>
                <p class="w4-encoding-summary__list" data-summary-list="${zone.id}"></p>
              </article>
            `).join('')}
          </div>

          <div class="action-row">
            <span class="status-box" id="w4-l5-summary-score">0 / ${STEP_META.length} encoding rules locked</span>
            <span class="status-box" id="w4-l5-summary-streak">Best streak: 0x</span>
            <button class="btn btn--primary" id="w4-l5-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w4-l5-progress');
    this._ui.streak = container.querySelector('#w4-l5-streak');
    this._ui.status = container.querySelector('#w4-l5-status');
    this._ui.solvedCount = container.querySelector('#w4-l5-solved-count');
    this._ui.currentStreak = container.querySelector('#w4-l5-current-streak');
    this._ui.bestStreak = container.querySelector('#w4-l5-best-streak');
    this._ui.streakCopy = container.querySelector('#w4-l5-streak-copy');
    this._ui.streakShell = container.querySelector('[data-streak-shell]');
    this._ui.feedback = container.querySelector('#w4-l5-feedback-text');
    this._ui.hintBox = container.querySelector('#w4-l5-hint-box');
    this._ui.hintText = container.querySelector('#w4-l5-hint-text');
    this._ui.summary = container.querySelector('#w4-l5-summary');
    this._ui.summaryScore = container.querySelector('#w4-l5-summary-score');
    this._ui.summaryStreak = container.querySelector('#w4-l5-summary-streak');
    this._ui.finishButton = container.querySelector('#w4-l5-finish-btn');
    this._ui.zoneCounts = Array.from(container.querySelectorAll('[data-zone-count]'));
    this._ui.summaryCounts = Array.from(container.querySelectorAll('[data-summary-count]'));
    this._ui.summaryLists = Array.from(container.querySelectorAll('[data-summary-list]'));
    this._ui.trackerCards = Array.from(container.querySelectorAll('[data-step-id]'));

    this._syncBoard();
    this._syncTracker();
    this._syncSummary();
  }

  start() {
    this._dragDrop = createMultiZoneDrop(this._container, ANSWER_KEY, {
      draggableSelector: '.w4-encoding-card',
      zoneSelector: '.w4-encoding-zone',
      onDrop: () => {
        this._syncBoard();
      },
      onCorrect: (tokenId, zoneId) => {
        const scenario = scenarioByToken(tokenId);
        const zone = zoneById(zoneId);

        this._solvedTokenIds.add(tokenId);
        this._streak += 1;
        this._bestStreak = Math.max(this._bestStreak, this._streak);
        this._evaluateMilestones();

        if (scenario && zone) {
          this._setFeedback(`${zone.label} is correct for ${scenario.variable} because ${scenario.reason}`);
        }

        if (this._streak >= 3 && this._streak > this._lastCelebratedStreak) {
          this._lastCelebratedStreak = this._streak;
          this._setStatus(`Hot streak ${this._streak}x. You are now reading variable type and model assumptions together.`);
        } else {
          const remaining = SCENARIOS.length - this._solvedTokenIds.size;
          this._setStatus(
            remaining > 0
              ? `${this._solvedTokenIds.size} cards solved. ${remaining} ${pluralize(remaining, 'decision')} still incoming.`
              : 'All cards routed correctly. Review the recap and continue.'
          );
        }

        this._syncBoard();
        this._syncTracker();
        this._syncSummary();
        this._engine.correct();
      },
      onIncorrect: (tokenId, zoneId) => {
        const scenario = scenarioByToken(tokenId);
        const expectedZone = scenario ? zoneById(scenario.zoneId) : null;
        const attemptedZone = zoneById(zoneId);

        this._streak = 0;
        this._syncBoard();

        if (scenario && expectedZone && attemptedZone) {
          this._setFeedback(`${scenario.variable} does not belong in ${attemptedZone.label}. It should go to ${expectedZone.label} because ${scenario.reason}`);
        } else {
          this._setFeedback('That drop is not safe. Re-read the variable type and the model badge before you try again.');
        }

        this._setStatus('Streak reset. Read the type first, then ask whether the model can handle order or high cardinality.');
        this._engine.mistake({ costsLife: false, countsMistake: true });
      },
      onComplete: () => {
        this._handleCompletion();
      },
    });

    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w4-l5-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w4-l5-reset-btn')) {
        this._resetLevel();
        return;
      }

      if (event.target.closest('#w4-l5-finish-btn')) {
        if (this._completed && typeof this._engine.complete === 'function') {
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
    this._dragDrop?.destroy();
    this._dragDrop = null;
    this._ui = {};
  }

  _evaluateMilestones() {
    STEP_META.forEach(step => {
      const zoneTokens = ANSWER_KEY[step.zoneId] ?? [];
      const solved = zoneTokens.every(tokenId => this._solvedTokenIds.has(tokenId));
      if (solved) {
        this._awardedStepIds.add(step.id);
      }
    });
  }

  _handleCompletion() {
    if (this._completed) return;

    this._completed = true;
    this._evaluateMilestones();
    this._syncBoard();
    this._syncTracker();
    this._syncSummary();
    this._revealSection(this._ui.summary);
    this._setFeedback('Decision board complete. You separated nominal, ordinal, and high-cardinality cases without mixing up model assumptions.');
    this._setStatus('Encoding lesson complete. Review the recap, then continue to the MCQ checkpoint.');
  }

  _showHint() {
    const { allowed, text } = this._engine.requestHint();
    if (!allowed || !text) return;

    this._ui.hintBox?.removeAttribute('hidden');
    if (this._ui.hintText) {
      this._ui.hintText.textContent = text;
    }
  }

  _resetLevel() {
    this._dragDrop?.reset();
    this._solvedTokenIds.clear();
    this._awardedStepIds.clear();
    this._completed = false;
    this._streak = 0;
    this._bestStreak = 0;
    this._lastCelebratedStreak = 0;

    if (this._ui.summary) {
      this._ui.summary.hidden = true;
      this._ui.summary.classList.remove('is-revealed');
    }

    this._syncBoard();
    this._syncTracker();
    this._syncSummary();
    this._setFeedback(DEFAULT_FEEDBACK);
    this._setStatus(DEFAULT_STATUS);
  }

  _syncBoard() {
    const solvedCount = this._solvedTokenIds.size;

    if (this._ui.progress) {
      this._ui.progress.textContent = `${solvedCount} / ${SCENARIOS.length} decision cards solved`;
    }

    if (this._ui.solvedCount) {
      this._ui.solvedCount.textContent = String(solvedCount);
    }

    if (this._ui.streak) {
      this._ui.streak.textContent = `Streak ${this._streak}x`;
    }

    if (this._ui.currentStreak) {
      this._ui.currentStreak.textContent = `${this._streak}x`;
    }

    if (this._ui.bestStreak) {
      this._ui.bestStreak.textContent = `${this._bestStreak}x`;
    }

    if (this._ui.summaryStreak) {
      this._ui.summaryStreak.textContent = `Best streak: ${this._bestStreak}x`;
    }

    if (this._ui.streakCopy) {
      this._ui.streakCopy.textContent = this._streak >= 3
        ? 'Hot streak active. Keep routing by rule instead of guessing by habit.'
        : this._bestStreak >= 3
          ? 'Hot streak reached once already. Keep the board clean to finish strong.'
          : 'Three correct decisions in a row activates a hot streak.';
    }

    if (this._ui.streakShell) {
      this._ui.streakShell.dataset.streakState = this._streak >= 3 ? 'hot' : this._bestStreak >= 3 ? 'banked' : 'idle';
    }

    this._ui.zoneCounts.forEach(node => {
      const zoneId = node.getAttribute('data-zone-count');
      const count = SCENARIOS.filter(
        scenario => scenario.zoneId === zoneId && this._solvedTokenIds.has(scenario.tokenId)
      ).length;

      node.textContent = String(count);
    });

    if (this._ui.finishButton) {
      this._ui.finishButton.disabled = !this._completed;
    }
  }

  _syncTracker() {
    const unresolvedStepId = STEP_META.find(step => !this._awardedStepIds.has(step.id))?.id ?? null;

    this._ui.trackerCards.forEach(card => {
      const stepId = card.getAttribute('data-step-id');
      const status = card.querySelector(`[data-step-status="${stepId}"]`);
      const state = this._awardedStepIds.has(stepId)
        ? 'solved'
        : stepId === unresolvedStepId
          ? 'active'
          : 'pending';

      card.dataset.stepState = state;
      if (status) {
        status.textContent = state === 'solved' ? 'Solved' : state === 'active' ? 'Active' : 'Pending';
      }
    });
  }

  _syncSummary() {
    this._ui.summaryCounts.forEach(node => {
      const zoneId = node.getAttribute('data-summary-count');
      const count = SCENARIOS.filter(scenario => scenario.zoneId === zoneId).length;
      node.textContent = `${count} ${pluralize(count, 'card')} matched`;
    });

    this._ui.summaryLists.forEach(node => {
      const zoneId = node.getAttribute('data-summary-list');
      const cards = SCENARIOS
        .filter(scenario => scenario.zoneId === zoneId)
        .map(scenario => scenario.variable)
        .join(', ');

      node.textContent = cards;
    });

    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = `${this._awardedStepIds.size} / ${STEP_META.length} encoding rules locked`;
    }
  }

  _revealSection(section) {
    if (!section) return;

    section.hidden = false;
    requestAnimationFrame(() => section.classList.add('is-revealed'));
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
