'use strict';

import { getLevelProblem } from '../../data/problems.js';
import { createMultiZoneDrop } from '../../widgets/dragdrop.js';

const PROBLEM = getLevelProblem(5, 5);
const LEVEL_TITLE = PROBLEM?.title ?? 'Which Scaling for Which Model?';
const LEVEL_OBJECTIVE = PROBLEM?.objective ?? 'Match algorithms to MinMax, standardization, or no scaling.';

const METHOD_ZONES = Object.freeze([
  Object.freeze({
    id: 'zone-minmax',
    label: 'MinMax Scaling',
    shortLabel: 'MinMax',
    formula: '(x - min) / (max - min)',
    family: 'minmax',
    copy: 'Best for distance-heavy models that need every feature to live on a shared bounded range before comparisons happen.',
  }),
  Object.freeze({
    id: 'zone-zscore',
    label: 'Standardization (Z-Score)',
    shortLabel: 'Z-Score',
    formula: '(x - mean) / sigma',
    family: 'zscore',
    copy: 'Best for optimization-heavy models that usually learn more smoothly when inputs are centered and expressed in comparable variance units.',
  }),
  Object.freeze({
    id: 'zone-noscale',
    label: 'No Scaling Needed',
    shortLabel: 'No Scaling',
    formula: 'threshold splits',
    family: 'noscale',
    copy: 'Best for tree-style models whose branch logic depends on ordering thresholds more than raw numeric magnitude.',
  }),
]);

const ALGORITHM_CARDS = Object.freeze([
  Object.freeze({
    id: 'knn',
    tokenId: 'token-knn',
    label: 'KNN',
    family: 'Distance-based',
    detail: 'nearest-neighbor voting',
    hint: 'Distances decide which neighbors get a vote.',
    zoneId: 'zone-minmax',
    reason: 'it compares raw distances directly, so every feature should be compressed into a comparable range before neighbors are measured.',
  }),
  Object.freeze({
    id: 'kmeans',
    tokenId: 'token-kmeans',
    label: 'K-Means',
    family: 'Distance-based',
    detail: 'centroid clustering',
    hint: 'Centroids drift toward the widest feature range.',
    zoneId: 'zone-minmax',
    reason: 'cluster assignment is distance-based, so one oversized feature range would otherwise pull the centroids much harder than the rest.',
  }),
  Object.freeze({
    id: 'svm',
    tokenId: 'token-svm',
    label: 'SVM',
    family: 'Margin-based',
    detail: 'support-vector margins',
    hint: 'Margin optimization behaves better on centered features.',
    zoneId: 'zone-zscore',
    reason: 'margin optimization usually behaves more cleanly when features are centered and scaled into comparable standard deviation units.',
  }),
  Object.freeze({
    id: 'neural-network',
    tokenId: 'token-neural-network',
    label: 'Neural Network',
    family: 'Gradient-based',
    detail: 'backpropagation updates',
    hint: 'Gradient descent likes balanced input scale.',
    zoneId: 'zone-zscore',
    reason: 'standardized inputs help gradient descent converge more steadily than raw mixed-scale features.',
  }),
  Object.freeze({
    id: 'linear-regression',
    tokenId: 'token-linear-regression',
    label: 'Linear Regression',
    family: 'Coefficient-based',
    detail: 'weighted linear fit',
    hint: 'Coefficients and regularization are easier to compare after centering.',
    zoneId: 'zone-zscore',
    reason: 'standardization keeps coefficients and optimization steps on a more comparable scale when features start with very different units.',
  }),
  Object.freeze({
    id: 'random-forest',
    tokenId: 'token-random-forest',
    label: 'Random Forest',
    family: 'Tree ensemble',
    detail: 'many threshold trees',
    hint: 'Branch splits care about cut points, not unit size.',
    zoneId: 'zone-noscale',
    reason: 'its trees split on thresholds, so multiplying a feature range usually does not change the learned branch structure.',
  }),
  Object.freeze({
    id: 'decision-tree',
    tokenId: 'token-decision-tree',
    label: 'Decision Tree',
    family: 'Tree model',
    detail: 'single threshold tree',
    hint: 'Ordering matters more than absolute scale.',
    zoneId: 'zone-noscale',
    reason: 'threshold-based splits already handle raw units without needing min-max or z-score preprocessing first.',
  }),
]);

const ANSWER_KEY = Object.freeze(
  METHOD_ZONES.reduce((acc, zone) => {
    acc[zone.id] = Object.freeze(
      ALGORITHM_CARDS
        .filter(card => card.zoneId === zone.id)
        .map(card => card.tokenId)
    );
    return acc;
  }, {})
);

const STEP_META = Object.freeze([
  Object.freeze({
    id: 'distance-models',
    zoneId: 'zone-minmax',
    label: 'Protect distance-based models from range domination',
    chapter: 'MinMax Fit',
    recap: 'KNN and K-Means compare direct distances, so one giant feature range can drown the rest unless every axis is squeezed into a shared interval.',
  }),
  Object.freeze({
    id: 'optimization-models',
    zoneId: 'zone-zscore',
    label: 'Center optimization-heavy models around comparable variance',
    chapter: 'Z-Score Fit',
    recap: 'SVM, neural networks, and linear regression usually learn more smoothly when features are centered and expressed in standard deviation units.',
  }),
  Object.freeze({
    id: 'tree-models',
    zoneId: 'zone-noscale',
    label: 'Recognize when tree models can safely skip scaling',
    chapter: 'No-Scale Fit',
    recap: 'Decision trees and random forests split on ordering thresholds, so scaling usually does not change the branch decisions they learn.',
  }),
]);

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM?.hints ?? []),
  'Distance-based algorithms usually want comparable bounded ranges first. That points toward MinMax for KNN and K-Means here.',
  'Margin-based or gradient-based learners often prefer centered, variance-balanced inputs. That is the Z-score lane.',
  'Tree models split on thresholds, so they are usually the safest cards to route into the no-scaling lane.',
]);

const DEFAULT_FEEDBACK = 'Start with the easiest pairings: tree models usually skip scaling, while distance-based models are the first ones punished by unequal numeric ranges.';
const DEFAULT_STATUS = 'Route each algorithm into the scaling rule that fits how it learns from numeric features.';
const SUMMARY_COPY = 'You now have the scaling map in one place: MinMax for direct-distance comparisons, Z-score for centered optimization, and no scaling for threshold-based trees.';

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

function cardByToken(tokenId) {
  return ALGORITHM_CARDS.find(card => card.tokenId === tokenId) ?? null;
}

function zoneById(zoneId) {
  return METHOD_ZONES.find(zone => zone.id === zoneId) ?? null;
}

function solvedCountForZone(tokenIds, zoneId) {
  return ALGORITHM_CARDS.filter(card => card.zoneId === zoneId && tokenIds.has(card.tokenId)).length;
}

function activeMethodCount(tokenIds) {
  return METHOD_ZONES.filter(zone => solvedCountForZone(tokenIds, zone.id) > 0).length;
}

export default class World5Level5 {
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
      <section class="w5-level w5-level--model-matcher screen-section" aria-label="World 5 Level 5">
        <div class="level-hero w5-level__hero" style="--world-color: var(--color-world-5);">
          <p class="eyebrow">World 5 - Scaling</p>
          <h1 class="level-hero__title">${escapeHtml(LEVEL_TITLE)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(LEVEL_OBJECTIVE)}
            Read how the algorithm learns, then send it to the scaling rule that protects its math instead of blindly scaling everything the same way.
          </p>
          <div class="action-row">
            <span class="status-box" id="w5-l5-progress">0 / ${ALGORITHM_CARDS.length} model cards solved</span>
            <span class="status-box" id="w5-l5-methods">0 / ${METHOD_ZONES.length} methods active</span>
            <span class="status-box" id="w5-l5-streak">Streak 0x</span>
            <span class="status-box" id="w5-l5-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w5-l5-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w5-l5-reset-btn" type="button">Reset Board</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">05</span>
        </div>

        <div class="w5-scale-grid">
          <article class="panel w5-scale-stage w5-match-stage">
            <div class="w5-level__panel-head">
              <div>
                <p class="eyebrow">Scaling Router</p>
                <h2 class="panel-title">Pair each algorithm with the scaling method that fits its learning behavior</h2>
              </div>
              <p class="w5-level__microcopy">
                This board is about model mechanics. Some algorithms compare distances, some optimize gradients, and some only split on thresholds. The safest scaling move changes with that rule.
              </p>
            </div>

            <section class="w5-scale-snapshot w5-match-scoreboard" aria-label="Routing Stats">
              <article class="w5-scale-snapshot__card">
                <span class="w5-scale-snapshot__label">Solved</span>
                <strong class="w5-scale-snapshot__value" id="w5-l5-solved-count" data-state="missing">0</strong>
                <p class="w5-match-scoreboard__copy">Algorithms locked into their best-fit lane.</p>
              </article>
              <article class="w5-scale-snapshot__card">
                <span class="w5-scale-snapshot__label">Methods Active</span>
                <strong class="w5-scale-snapshot__value" id="w5-l5-active-count" data-state="missing">0</strong>
                <p class="w5-match-scoreboard__copy">Scaling lanes that already hold a correct card.</p>
              </article>
              <article class="w5-scale-snapshot__card" data-streak-shell>
                <span class="w5-scale-snapshot__label">Current Streak</span>
                <strong class="w5-scale-snapshot__value" id="w5-l5-current-streak" data-state="missing">0x</strong>
                <p class="w5-match-scoreboard__copy" id="w5-l5-streak-copy">Three clean drops in a row activates a hot streak.</p>
              </article>
              <article class="w5-scale-snapshot__card">
                <span class="w5-scale-snapshot__label">Best Streak</span>
                <strong class="w5-scale-snapshot__value" id="w5-l5-best-streak" data-state="missing">0x</strong>
                <p class="w5-match-scoreboard__copy">Momentum matters when the model cues start blending together.</p>
              </article>
            </section>

            <section class="w5-match-stream" aria-label="Algorithm Card Bank">
              <div class="w5-match-stream__head">
                <div>
                  <p class="eyebrow">Model Bank</p>
                  <h3 class="panel-title">Drag the incoming algorithm cards into the correct scaling lane</h3>
                </div>
                <p class="w5-match-stream__copy">
                  Drag a card, or tap a card and then tap a lane if you prefer click-to-place. The one-line hint on each card tells you what part of the algorithm is sensitive to scale.
                </p>
              </div>

              <div class="w5-match-bank" id="w5-l5-card-bank">
                ${ALGORITHM_CARDS.map((card, index) => `
                  <button
                    class="drag-token dd-draggable w5-match-card"
                    type="button"
                    data-dd-id="${card.tokenId}"
                    style="--card-delay:${index * 80}ms;"
                    aria-label="Route ${escapeHtml(card.label)}"
                  >
                    <div class="w5-match-card__head">
                      <span class="w5-match-card__eyebrow">${escapeHtml(card.family)}</span>
                      <span class="w5-match-card__detail">${escapeHtml(card.detail)}</span>
                    </div>
                    <h3 class="w5-match-card__title">${escapeHtml(card.label)}</h3>
                    <p class="w5-match-card__copy">${escapeHtml(card.hint)}</p>
                  </button>
                `).join('')}
              </div>
            </section>

            <section class="w5-match-zones" aria-label="Scaling Method Lanes">
              ${METHOD_ZONES.map(zone => `
                <div
                  class="drop-zone dd-zone w5-match-zone"
                  data-dd-zone="${zone.id}"
                  data-dd-label="${escapeHtml(zone.label)}"
                  data-zone-family="${zone.family}"
                >
                  <div class="w5-match-zone__head">
                    <div>
                      <p class="w5-match-zone__eyebrow">${escapeHtml(zone.formula)}</p>
                      <h3 class="w5-match-zone__title">${escapeHtml(zone.label)}</h3>
                    </div>
                    <span class="w5-match-zone__count" data-zone-count="${zone.id}">0</span>
                  </div>
                  <p class="w5-match-zone__copy">${escapeHtml(zone.copy)}</p>
                  <span class="w5-match-zone__prompt">Drop matching cards here</span>
                </div>
              `).join('')}
            </section>
          </article>

          <div class="w5-scale-side">
            <section class="panel w5-scale-tracker w5-match-tracker" aria-label="Scaling Tracker">
              <div class="w5-level__panel-head">
                <div>
                  <p class="eyebrow">Rule Tracker</p>
                  <h2 class="panel-title">Lock the distance rule, the optimization rule, and the tree rule</h2>
                </div>
                <p class="w5-level__microcopy">
                  The same scale problem does not hit every model the same way. Finish all three rules and the scaling map becomes much easier to remember.
                </p>
              </div>

              <div class="w5-scale-tracker__list">
                ${STEP_META.map((step, index) => `
                  <article class="w5-scale-card" data-step-id="${step.id}" data-step-state="${index === 0 ? 'active' : 'pending'}">
                    <div class="w5-scale-card__meta">
                      <span class="w5-scale-card__status" data-step-status="${step.id}">${index === 0 ? 'Active' : 'Pending'}</span>
                      <span class="w5-scale-card__index">Rule ${index + 1}</span>
                    </div>
                    <h3 class="w5-scale-card__title">${escapeHtml(step.label)}</h3>
                    <p class="w5-scale-card__chapter">${escapeHtml(step.chapter)}</p>
                    <p class="w5-scale-card__copy">${escapeHtml(step.recap)}</p>
                  </article>
                `).join('')}
              </div>
            </section>

            <section class="card card--elevated w5-level__feedback" aria-live="polite">
              <p class="eyebrow">Coach Feed</p>
              <p id="w5-l5-feedback-text" class="w5-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
            </section>

            <section class="card w5-level__hint-box" id="w5-l5-hint-box" hidden>
              <p class="eyebrow">Hint</p>
              <p id="w5-l5-hint-text" class="w5-level__hint-copy"></p>
            </section>

            <section class="card w5-scale-guide w5-match-guide">
              <p class="eyebrow">Scaling Guide</p>
              <div class="w5-scale-guide__steps">
                <article class="w5-scale-guide__step">
                  <span class="w5-scale-guide__badge">1</span>
                  <p>Distance-based models care immediately about raw range, so they are the first ones to route toward MinMax in this lesson.</p>
                </article>
                <article class="w5-scale-guide__step">
                  <span class="w5-scale-guide__badge">2</span>
                  <p>Optimization-heavy models usually prefer standardized features because centered inputs make gradients and margins more stable.</p>
                </article>
                <article class="w5-scale-guide__step">
                  <span class="w5-scale-guide__badge">3</span>
                  <p>Tree models split on thresholds, so scaling usually changes the numbers without changing the decisions.</p>
                </article>
              </div>
            </section>
          </div>
        </div>

        <section class="panel w5-scale-summary w5-match-summary" id="w5-l5-summary" hidden aria-label="Scaling Summary">
          <div class="w5-level__panel-head">
            <div>
              <p class="eyebrow">Scaling Recap</p>
              <h2 class="panel-title">The model map is now stable: distance, optimization, and threshold learners each got the right treatment</h2>
            </div>
            <p class="w5-level__microcopy">${escapeHtml(SUMMARY_COPY)}</p>
          </div>

          <div class="w5-scale-summary__grid">
            ${METHOD_ZONES.map(zone => `
              <article class="w5-scale-summary__card w5-match-summary__card" data-summary-family="${zone.family}">
                <p class="w5-scale-summary__kicker">${escapeHtml(zone.shortLabel)}</p>
                <h3 class="w5-scale-summary__title" data-summary-count="${zone.id}">0 algorithms matched</h3>
                <p class="w5-scale-summary__copy">${escapeHtml(zone.copy)}</p>
                <p class="w5-match-summary__list" data-summary-list="${zone.id}"></p>
              </article>
            `).join('')}
          </div>

          <div class="w5-match-matrix-shell">
            <div class="w5-match-matrix__head">
              <p class="eyebrow">Study Matrix</p>
              <h3 class="panel-title">Algorithm x scaling best fit</h3>
            </div>
            <table class="w5-match-matrix" aria-label="Scaling fit matrix">
              <thead>
                <tr>
                  <th scope="col">Algorithm</th>
                  ${METHOD_ZONES.map(zone => `<th scope="col">${escapeHtml(zone.shortLabel)}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${ALGORITHM_CARDS.map(card => `
                  <tr>
                    <th scope="row">${escapeHtml(card.label)}</th>
                    ${METHOD_ZONES.map(zone => `
                      <td data-cell-state="${card.zoneId === zone.id ? 'best' : 'empty'}">
                        ${card.zoneId === zone.id ? 'Best fit' : '-'}
                      </td>
                    `).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="action-row">
            <span class="status-box" id="w5-l5-summary-score">0 / ${STEP_META.length} scaling rules locked</span>
            <span class="status-box" id="w5-l5-summary-streak">Best streak: 0x</span>
            <button class="btn btn--primary" id="w5-l5-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w5-l5-progress');
    this._ui.methods = container.querySelector('#w5-l5-methods');
    this._ui.streak = container.querySelector('#w5-l5-streak');
    this._ui.status = container.querySelector('#w5-l5-status');
    this._ui.solvedCount = container.querySelector('#w5-l5-solved-count');
    this._ui.activeCount = container.querySelector('#w5-l5-active-count');
    this._ui.currentStreak = container.querySelector('#w5-l5-current-streak');
    this._ui.bestStreak = container.querySelector('#w5-l5-best-streak');
    this._ui.streakCopy = container.querySelector('#w5-l5-streak-copy');
    this._ui.streakShell = container.querySelector('[data-streak-shell]');
    this._ui.feedback = container.querySelector('#w5-l5-feedback-text');
    this._ui.hintBox = container.querySelector('#w5-l5-hint-box');
    this._ui.hintText = container.querySelector('#w5-l5-hint-text');
    this._ui.summary = container.querySelector('#w5-l5-summary');
    this._ui.summaryScore = container.querySelector('#w5-l5-summary-score');
    this._ui.summaryStreak = container.querySelector('#w5-l5-summary-streak');
    this._ui.finishButton = container.querySelector('#w5-l5-finish-btn');
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
      draggableSelector: '.w5-match-card',
      zoneSelector: '.w5-match-zone',
      onDrop: () => {
        this._syncBoard();
      },
      onCorrect: (tokenId, zoneId) => {
        const card = cardByToken(tokenId);
        const zone = zoneById(zoneId);

        this._solvedTokenIds.add(tokenId);
        this._streak += 1;
        this._bestStreak = Math.max(this._bestStreak, this._streak);
        this._evaluateMilestones();

        if (card && zone) {
          this._setFeedback(`${card.label} belongs in ${zone.label} because ${card.reason}`);
        }

        if (this._streak >= 3 && this._streak > this._lastCelebratedStreak) {
          this._lastCelebratedStreak = this._streak;
          this._setStatus(`Hot streak ${this._streak}x. You are matching model mechanics to scaling behavior instead of guessing by habit.`);
        } else {
          const remaining = ALGORITHM_CARDS.length - this._solvedTokenIds.size;
          this._setStatus(
            remaining > 0
              ? `${this._solvedTokenIds.size} ${pluralize(this._solvedTokenIds.size, 'card')} solved. ${remaining} ${pluralize(remaining, 'algorithm')} still ${remaining === 1 ? 'needs' : 'need'} a scaling lane.`
              : 'All model cards are routed correctly. Review the recap and continue.'
          );
        }

        this._syncBoard();
        this._syncTracker();
        this._syncSummary();
        this._engine.correct();
      },
      onIncorrect: (tokenId, zoneId) => {
        const card = cardByToken(tokenId);
        const attemptedZone = zoneById(zoneId);
        const expectedZone = card ? zoneById(card.zoneId) : null;

        this._streak = 0;
        this._syncBoard();

        if (card && attemptedZone && expectedZone) {
          this._setFeedback(`${card.label} does not belong in ${attemptedZone.label}. It should go to ${expectedZone.label} because ${card.reason}`);
        } else {
          this._setFeedback('That lane is not the best fit. Re-read how the algorithm learns before you route it again.');
        }

        this._setStatus('Streak reset. Ask whether the model compares distances, optimizes gradients, or just splits on thresholds.');
        this._engine.mistake({ costsLife: false, countsMistake: true });
      },
      onComplete: () => {
        this._handleCompletion();
      },
    });

    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w5-l5-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w5-l5-reset-btn')) {
        this._resetLevel();
        return;
      }

      if (event.target.closest('#w5-l5-finish-btn')) {
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
    this._setFeedback('Scaling board complete. You separated distance-based, optimization-heavy, and tree-based models without over-scaling the whole pipeline.');
    this._setStatus('Scaling lesson complete. Review the matrix, then continue to the MCQ checkpoint.');
    this._revealSection(this._ui.summary);
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

    this._syncBoard();
    this._syncTracker();
    this._syncSummary();
    this._setFeedback(DEFAULT_FEEDBACK);
    this._setStatus(DEFAULT_STATUS);
  }

  _syncBoard() {
    const solvedCount = this._solvedTokenIds.size;
    const activeCount = activeMethodCount(this._solvedTokenIds);

    if (this._ui.progress) {
      this._ui.progress.textContent = `${solvedCount} / ${ALGORITHM_CARDS.length} model cards solved`;
    }

    if (this._ui.methods) {
      this._ui.methods.textContent = `${activeCount} / ${METHOD_ZONES.length} methods active`;
    }

    if (this._ui.streak) {
      this._ui.streak.textContent = `Streak ${this._streak}x`;
    }

    if (this._ui.solvedCount) {
      this._ui.solvedCount.textContent = String(solvedCount);
      this._ui.solvedCount.dataset.state = solvedCount > 0 ? 'correct' : 'missing';
    }

    if (this._ui.activeCount) {
      this._ui.activeCount.textContent = String(activeCount);
      this._ui.activeCount.dataset.state = activeCount > 0 ? 'present' : 'missing';
    }

    if (this._ui.currentStreak) {
      this._ui.currentStreak.textContent = `${this._streak}x`;
      this._ui.currentStreak.dataset.state = this._streak >= 3 ? 'correct' : this._streak > 0 ? 'present' : 'missing';
    }

    if (this._ui.bestStreak) {
      this._ui.bestStreak.textContent = `${this._bestStreak}x`;
      this._ui.bestStreak.dataset.state = this._bestStreak >= 3 ? 'correct' : this._bestStreak > 0 ? 'present' : 'missing';
    }

    if (this._ui.summaryStreak) {
      this._ui.summaryStreak.textContent = `Best streak: ${this._bestStreak}x`;
    }

    if (this._ui.streakCopy) {
      this._ui.streakCopy.textContent = this._streak >= 3
        ? 'Hot streak active. You are reading the learning rule behind the model, not just the name on the card.'
        : this._bestStreak >= 3
          ? 'Hot streak reached once already. Keep the last few routes just as deliberate.'
          : 'Three clean drops in a row activates a hot streak.';
    }

    if (this._ui.streakShell) {
      this._ui.streakShell.dataset.streakState = this._streak >= 3 ? 'hot' : this._bestStreak >= 3 ? 'banked' : 'idle';
    }

    this._ui.zoneCounts.forEach(node => {
      const zoneId = node.getAttribute('data-zone-count');
      const count = solvedCountForZone(this._solvedTokenIds, zoneId);
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
      const count = ALGORITHM_CARDS.filter(card => card.zoneId === zoneId).length;
      node.textContent = `${count} ${pluralize(count, 'algorithm')} matched`;
    });

    this._ui.summaryLists.forEach(node => {
      const zoneId = node.getAttribute('data-summary-list');
      const cards = ALGORITHM_CARDS
        .filter(card => card.zoneId === zoneId)
        .map(card => card.label)
        .join(', ');

      node.textContent = cards;
    });

    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = `${this._awardedStepIds.size} / ${STEP_META.length} scaling rules locked`;
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
