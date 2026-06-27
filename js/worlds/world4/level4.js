'use strict';

import { getLevelProblem } from '../../data/problems.js';

const PROBLEM = getLevelProblem(4, 4);
const LEVEL_TITLE = PROBLEM?.title ?? 'Taming High Cardinality';
const LEVEL_OBJECTIVE = PROBLEM?.objective ?? 'Identify rare categories and group them into "Autres" before one-hot encoding.';

const CITY_COUNTS = Object.freeze([
  Object.freeze({ city: 'Casablanca', count: 7 }),
  Object.freeze({ city: 'Rabat', count: 6 }),
  Object.freeze({ city: 'Marrakech', count: 5 }),
  Object.freeze({ city: 'Fes', count: 4 }),
  Object.freeze({ city: 'Dakhla', count: 1 }),
  Object.freeze({ city: 'Oujda', count: 1 }),
  Object.freeze({ city: 'Kenitra', count: 1 }),
  Object.freeze({ city: 'Tangier', count: 1 }),
]);

const TOTAL_ROWS = CITY_COUNTS.reduce((sum, entry) => sum + entry.count, 0);
const TARGET_RARE_COUNT = 4;
const DEFAULT_THRESHOLD = 0;
const GROUP_LABEL = 'Autres';
const MAX_THRESHOLD = 20;

const CITY_FREQUENCIES = Object.freeze(
  CITY_COUNTS.map(entry => Object.freeze({
    ...entry,
    percent: (entry.count / TOTAL_ROWS) * 100,
  }))
);

const RARE_CITIES = Object.freeze(
  CITY_FREQUENCIES.filter(entry => entry.count === 1).map(entry => entry.city)
);

const PREVIEW_SAMPLE_ROWS = Object.freeze([
  Object.freeze({ label: 'Row A', city: 'Casablanca' }),
  Object.freeze({ label: 'Row B', city: 'Tangier' }),
  Object.freeze({ label: 'Row C', city: 'Rabat' }),
]);

const STEP_META = Object.freeze([
  Object.freeze({
    id: 'threshold-locked',
    label: 'Highlight the rare cities with the threshold slider',
    chapter: 'Find The Tail',
    recap: 'A high-cardinality column becomes a one-hot problem when too many categories appear only once or twice.',
  }),
  Object.freeze({
    id: 'grouping-applied',
    label: 'Merge the rare cities into Autres',
    chapter: 'Group Rare Labels',
    recap: 'Grouping rare categories keeps sparse one-hot columns from multiplying without adding stable signal.',
  }),
  Object.freeze({
    id: 'impact-seen',
    label: 'Inspect the one-hot width before and after',
    chapter: 'Encoding Impact',
    recap: 'One-hot width equals category count, so grouping rare labels directly shrinks the encoded matrix.',
  }),
]);

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM?.hints ?? []),
  'Slide the threshold until only the four cities with a single row light up as rare.',
  'One-hot encoding creates one binary column per distinct city name. Fewer categories means fewer one-hot columns.',
  `After grouping, every rare city row should activate the shared ${GROUP_LABEL} column instead of its own private column.`,
]);

const DEFAULT_FEEDBACK = 'Start with the threshold slider. The goal is to isolate the thin tail of city labels before you group anything.';
const DEFAULT_STATUS = 'Part 1 is live. Move the slider until the truly rare city bars light up.';
const SUMMARY_COPY = 'Grouping rare labels does not change the common cities, but it cuts down sparse one-hot width and gives the model a sturdier fallback bucket.';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}

function pluralize(value, singular, plural = `${singular}s`) {
  return value === 1 ? singular : plural;
}

function groupedChartData(groupedCities) {
  const groupedSet = new Set(groupedCities);
  const groupedTotal = CITY_FREQUENCIES
    .filter(entry => groupedSet.has(entry.city))
    .reduce((sum, entry) => sum + entry.count, 0);

  const common = CITY_FREQUENCIES.filter(entry => !groupedSet.has(entry.city));

  return Object.freeze([
    ...common.map(entry => Object.freeze(entry)),
    Object.freeze({
      city: GROUP_LABEL,
      count: groupedTotal,
      percent: (groupedTotal / TOTAL_ROWS) * 100,
    }),
  ]);
}

function activeRareCities(threshold) {
  return CITY_FREQUENCIES
    .filter(entry => entry.percent <= threshold + 0.0001)
    .map(entry => entry.city);
}

function previewColumns(mode, groupedCities) {
  if (mode === 'after') {
    return [
      ...CITY_FREQUENCIES.filter(entry => !groupedCities.includes(entry.city)).map(entry => entry.city),
      GROUP_LABEL,
    ];
  }

  return CITY_FREQUENCIES.map(entry => entry.city);
}

function matrixValue(mode, rowCity, columnCity, groupedCities) {
  if (mode === 'before') {
    return rowCity === columnCity ? 1 : 0;
  }

  const groupedSet = new Set(groupedCities);
  if (groupedSet.has(rowCity)) {
    return columnCity === GROUP_LABEL ? 1 : 0;
  }

  return rowCity === columnCity ? 1 : 0;
}

export default class World4Level4 {
  meta = {
    title: LEVEL_TITLE,
    subtitle: LEVEL_OBJECTIVE,
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._events = null;
    this._threshold = DEFAULT_THRESHOLD;
    this._selectedRareCities = [];
    this._groupedCities = [];
    this._grouped = false;
    this._groupingAnimating = false;
    this._previewMode = 'before';
    this._awardedStepIds = new Set();
    this._completed = false;
    this._timers = new Set();
    this._ui = {};
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();
    this._selectedRareCities = activeRareCities(this._threshold);

    container.innerHTML = `
      <section class="w4-level w4-level--cardinality screen-section" aria-label="World 4 Level 4">
        <div class="level-hero w4-level__hero" style="--world-color: var(--color-world-4);">
          <p class="eyebrow">World 4 - Encoding</p>
          <h1 class="level-hero__title">${escapeHtml(LEVEL_TITLE)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(LEVEL_OBJECTIVE)}
            Find the thin tail of rare city labels, merge them into one fallback bucket, and inspect how the one-hot matrix shrinks when cardinality drops.
          </p>
          <div class="action-row">
            <span class="status-box" id="w4-l4-progress">0 / ${STEP_META.length} cardinality locks</span>
            <span class="status-box" id="w4-l4-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w4-l4-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w4-l4-reset-btn" type="button">Reset Lab</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">04</span>
        </div>

        <div class="w4-cardinality-grid">
          <article class="panel w4-cardinality-stage">
            <div class="w4-level__panel-head">
              <div>
                <p class="eyebrow">Cardinality Lab</p>
                <h2 class="panel-title">Use a rare-category threshold before the one-hot matrix explodes</h2>
              </div>
              <p class="w4-level__microcopy">
                Every distinct city becomes a one-hot column. Grouping rare labels first keeps the encoded table compact without touching the common categories.
              </p>
            </div>

            <section class="w4-cardinality-chart-panel">
              <div class="w4-cardinality-chart-panel__head">
                <div>
                  <p class="eyebrow">Ville Frequencies</p>
                  <h3 class="w4-cardinality-chart-panel__title">26 rows across 8 city labels</h3>
                </div>
                <p class="w4-cardinality-chart-panel__copy">
                  The bar chart shows the full category distribution before any grouping. The rare tail should collapse into a shared fallback bucket.
                </p>
              </div>

              <div class="w4-cardinality-metrics">
                <article class="w4-cardinality-metric">
                  <span class="w4-cardinality-metric__label">Rows</span>
                  <strong class="w4-cardinality-metric__value">${TOTAL_ROWS}</strong>
                </article>
                <article class="w4-cardinality-metric">
                  <span class="w4-cardinality-metric__label">Unique Cities</span>
                  <strong class="w4-cardinality-metric__value" id="w4-l4-unique-count">${CITY_FREQUENCIES.length}</strong>
                </article>
                <article class="w4-cardinality-metric">
                  <span class="w4-cardinality-metric__label">One-Hot Width</span>
                  <strong class="w4-cardinality-metric__value" id="w4-l4-width-count">${CITY_FREQUENCIES.length} columns</strong>
                </article>
                <article class="w4-cardinality-metric w4-cardinality-metric--wide">
                  <span class="w4-cardinality-metric__label">Grouping Target</span>
                  <p class="w4-cardinality-metric__copy" id="w4-l4-group-copy">Find the rare city bars first. Only then should the fallback ${GROUP_LABEL} bucket appear.</p>
                </article>
              </div>

              <div class="w4-cardinality-chart" id="w4-l4-chart" role="img" aria-label="Horizontal bar chart showing city frequencies."></div>

              <div class="w4-cardinality-slider-block">
                <div class="w4-cardinality-slider-block__head">
                  <label class="w4-cardinality-slider-block__title" for="w4-l4-threshold">Rare threshold (%)</label>
                  <span class="w4-cardinality-slider-block__value" id="w4-l4-threshold-value">${DEFAULT_THRESHOLD}%</span>
                </div>
                <input
                  class="w4-cardinality-slider"
                  id="w4-l4-threshold"
                  type="range"
                  min="0"
                  max="${MAX_THRESHOLD}"
                  step="1"
                  value="${DEFAULT_THRESHOLD}"
                >
                <div class="w4-cardinality-slider-block__meta">
                  <span class="status-box" id="w4-l4-rare-status">0 categories highlighted</span>
                  <span class="status-box" id="w4-l4-group-status">Grouping locked until the rare tail is isolated</span>
                </div>
              </div>

              <div class="w4-cardinality-cta">
                <p class="w4-cardinality-cta__copy" id="w4-l4-cta-copy">
                  Slide until only the truly rare cities light up. Then merge them into one shared label.
                </p>
                <button class="btn btn--primary" id="w4-l4-apply-btn" type="button" disabled>Apply Grouping</button>
              </div>
            </section>

            <section class="panel w4-cardinality-impact" id="w4-l4-impact" hidden aria-label="One-hot impact preview">
              <div class="w4-level__panel-head">
                <div>
                  <p class="eyebrow">Impact Preview</p>
                  <h2 class="panel-title">Compare the one-hot matrix before and after grouping</h2>
                </div>
                <p class="w4-level__microcopy">
                  One-hot width always mirrors category count. The preview below shows exactly how the rare rows stop demanding their own private columns.
                </p>
              </div>

              <div class="w4-cardinality-impact__toolbar">
                <div class="w4-cardinality-impact__tabs" role="tablist" aria-label="Preview modes">
                  <button class="btn btn--ghost" id="w4-l4-preview-before" type="button" data-preview-mode="before" aria-pressed="true">Before Grouping</button>
                  <button class="btn btn--ghost" id="w4-l4-preview-after" type="button" data-preview-mode="after" aria-pressed="false">After Grouping</button>
                </div>
                <span class="status-box" id="w4-l4-impact-status">Preview the 8-column matrix first, then switch to the grouped version.</span>
              </div>

              <div class="w4-cardinality-impact__stats">
                <article class="w4-cardinality-impact__stat" data-preview-card="before">
                  <span class="w4-cardinality-impact__label">Before</span>
                  <strong class="w4-cardinality-impact__value">8 columns</strong>
                </article>
                <article class="w4-cardinality-impact__stat" data-preview-card="after">
                  <span class="w4-cardinality-impact__label">After</span>
                  <strong class="w4-cardinality-impact__value">5 columns</strong>
                </article>
              </div>

              <div class="w4-cardinality-matrix-shell" id="w4-l4-matrix"></div>
            </section>
          </article>

          <div class="w4-cardinality-side">
            <section class="panel w4-cardinality-tracker" aria-label="Cardinality Tracker">
              <div class="w4-level__panel-head">
                <div>
                  <p class="eyebrow">Cardinality Tracker</p>
                  <h2 class="panel-title">Shrink the category space before you encode it</h2>
                </div>
                <p class="w4-level__microcopy">
                  The lesson moves in three locks: detect the rare tail, group it, then inspect how the encoded width changes.
                </p>
              </div>

              <div class="w4-cardinality-tracker__list">
                ${STEP_META.map((step, index) => `
                  <article class="w4-cardinality-card" data-step-id="${step.id}" data-step-state="${index === 0 ? 'active' : 'pending'}">
                    <div class="w4-cardinality-card__meta">
                      <span class="w4-cardinality-card__status" data-step-status="${step.id}">${index === 0 ? 'Active' : 'Pending'}</span>
                      <span class="w4-cardinality-card__index">Step ${index + 1}</span>
                    </div>
                    <h3 class="w4-cardinality-card__title">${escapeHtml(step.label)}</h3>
                    <p class="w4-cardinality-card__chapter">${escapeHtml(step.chapter)}</p>
                    <p class="w4-cardinality-card__copy">${escapeHtml(step.recap)}</p>
                  </article>
                `).join('')}
              </div>
            </section>

            <section class="card card--elevated w4-level__feedback" aria-live="polite">
              <p class="eyebrow">Coach Feed</p>
              <p id="w4-l4-feedback-text" class="w4-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
            </section>

            <section class="card w4-level__hint-box" id="w4-l4-hint-box" hidden>
              <p class="eyebrow">Hint</p>
              <p id="w4-l4-hint-text" class="w4-level__hint-copy"></p>
            </section>

            <section class="card w4-cardinality-guide">
              <p class="eyebrow">Why This Matters</p>
              <div class="w4-cardinality-guide__steps">
                <article class="w4-cardinality-guide__step">
                  <span class="w4-cardinality-guide__badge">1</span>
                  <p>High-cardinality columns create many sparse one-hot columns, especially when labels appear only once.</p>
                </article>
                <article class="w4-cardinality-guide__step">
                  <span class="w4-cardinality-guide__badge">2</span>
                  <p>Grouping rare labels into ${GROUP_LABEL} preserves the frequent categories while reducing noisy width.</p>
                </article>
                <article class="w4-cardinality-guide__step">
                  <span class="w4-cardinality-guide__badge">3</span>
                  <p>The grouped fallback bucket helps future code levels keep the encoded matrix smaller and more stable.</p>
                </article>
              </div>
            </section>
          </div>
        </div>

        <section class="panel w4-cardinality-summary" id="w4-l4-summary" hidden aria-label="Cardinality Summary">
          <div class="w4-level__panel-head">
            <div>
              <p class="eyebrow">Encoding Recap</p>
              <h2 class="panel-title">Rare labels grouped, one-hot width reduced, sparse noise trimmed</h2>
            </div>
            <p class="w4-level__microcopy">${escapeHtml(SUMMARY_COPY)}</p>
          </div>

          <div class="w4-cardinality-summary__grid">
            <article class="w4-cardinality-summary__card">
              <p class="w4-cardinality-summary__kicker">Rare Bucket</p>
              <h3 class="w4-cardinality-summary__title">${GROUP_LABEL}</h3>
              <p class="w4-cardinality-summary__copy">${RARE_CITIES.join(', ')} now share one fallback category instead of four private labels.</p>
            </article>
            <article class="w4-cardinality-summary__card">
              <p class="w4-cardinality-summary__kicker">Matrix Width</p>
              <h3 class="w4-cardinality-summary__title">8 -> 5</h3>
              <p class="w4-cardinality-summary__copy">Grouping rare labels cut the one-hot matrix from eight columns down to five.</p>
            </article>
            <article class="w4-cardinality-summary__card">
              <p class="w4-cardinality-summary__kicker">Takeaway</p>
              <h3 class="w4-cardinality-summary__title">Compact, Not Blind</h3>
              <p class="w4-cardinality-summary__copy">Keep the common categories explicit and use ${GROUP_LABEL} only for the thin, unstable tail.</p>
            </article>
          </div>

          <div class="action-row">
            <span class="status-box" id="w4-l4-summary-score">Waiting for impact review</span>
            <button class="btn btn--primary" id="w4-l4-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w4-l4-progress');
    this._ui.status = container.querySelector('#w4-l4-status');
    this._ui.feedback = container.querySelector('#w4-l4-feedback-text');
    this._ui.hintBox = container.querySelector('#w4-l4-hint-box');
    this._ui.hintText = container.querySelector('#w4-l4-hint-text');
    this._ui.chart = container.querySelector('#w4-l4-chart');
    this._ui.threshold = container.querySelector('#w4-l4-threshold');
    this._ui.thresholdValue = container.querySelector('#w4-l4-threshold-value');
    this._ui.rareStatus = container.querySelector('#w4-l4-rare-status');
    this._ui.groupStatus = container.querySelector('#w4-l4-group-status');
    this._ui.groupCopy = container.querySelector('#w4-l4-group-copy');
    this._ui.uniqueCount = container.querySelector('#w4-l4-unique-count');
    this._ui.widthCount = container.querySelector('#w4-l4-width-count');
    this._ui.ctaCopy = container.querySelector('#w4-l4-cta-copy');
    this._ui.applyButton = container.querySelector('#w4-l4-apply-btn');
    this._ui.impact = container.querySelector('#w4-l4-impact');
    this._ui.impactStatus = container.querySelector('#w4-l4-impact-status');
    this._ui.previewButtons = Array.from(container.querySelectorAll('[data-preview-mode]'));
    this._ui.previewCards = Array.from(container.querySelectorAll('[data-preview-card]'));
    this._ui.matrix = container.querySelector('#w4-l4-matrix');
    this._ui.summary = container.querySelector('#w4-l4-summary');
    this._ui.summaryScore = container.querySelector('#w4-l4-summary-score');
    this._ui.finishButton = container.querySelector('#w4-l4-finish-btn');
    this._ui.trackerCards = Array.from(container.querySelectorAll('[data-step-id]'));

    this._syncChart();
    this._syncImpact();
    this._syncTracker();
    this._syncProgress();
    this._syncSummary();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w4-l4-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w4-l4-reset-btn')) {
        this._resetLevel();
        return;
      }

      if (event.target.closest('#w4-l4-apply-btn')) {
        this._applyGrouping();
        return;
      }

      const previewButton = event.target.closest('[data-preview-mode]');
      if (previewButton) {
        this._setPreviewMode(previewButton.getAttribute('data-preview-mode'));
        return;
      }

      if (event.target.closest('#w4-l4-finish-btn')) {
        if (this._completed && typeof this._engine.complete === 'function') {
          void this._engine.complete();
        }
      }
    }, { signal });

    this._container?.addEventListener('input', event => {
      const slider = event.target.closest('#w4-l4-threshold');
      if (!slider || this._grouped || this._groupingAnimating) return;
      this._updateThreshold(Number(slider.value));
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
    this._ui = {};
  }

  _updateThreshold(value) {
    this._threshold = Number.isFinite(value) ? value : DEFAULT_THRESHOLD;
    this._selectedRareCities = activeRareCities(this._threshold);

    if (
      this._selectedRareCities.length === TARGET_RARE_COUNT &&
      !this._awardedStepIds.has('threshold-locked')
    ) {
      this._awardStep('threshold-locked');
      this._setFeedback(`Threshold locked. ${TARGET_RARE_COUNT} rare cities now light up as the tail you should group before one-hot encoding.`);
      this._setStatus('Part 1 complete. Apply the grouping to collapse the rare tail into one fallback label.');
    } else if (!this._awardedStepIds.has('threshold-locked')) {
      const rareCount = this._selectedRareCities.length;
      this._setStatus(`Threshold set to ${this._threshold}%. ${rareCount} ${pluralize(rareCount, 'category')} currently marked as rare.`);
    }

    this._syncChart();
  }

  _applyGrouping() {
    if (this._grouped || this._groupingAnimating) return;

    if (this._selectedRareCities.length !== TARGET_RARE_COUNT) {
      this._setFeedback(`Not there yet. Move the slider until exactly ${TARGET_RARE_COUNT} rare city bars are highlighted.`);
      this._setStatus('Grouping is still locked. Highlight only the thin tail first.');
      this._engine.mistake({ costsLife: false, countsMistake: true });
      return;
    }

    this._groupingAnimating = true;
    this._setFeedback(`Grouping in progress. ${this._selectedRareCities.join(', ')} are collapsing into ${GROUP_LABEL}.`);
    this._setStatus('Merging the rare labels into one fallback bucket...');
    this._syncChart();

    this._schedule(() => {
      this._grouped = true;
      this._groupingAnimating = false;
      this._groupedCities = [...this._selectedRareCities];
      this._previewMode = 'before';
      this._awardStep('grouping-applied');
      this._syncChart();
      this._syncImpact();
      this._revealSection(this._ui.impact);
      this._setFeedback(`Grouping applied. The rare city labels now share one ${GROUP_LABEL} bucket, which immediately trims future one-hot width.`);
      this._setStatus('Part 2 complete. Compare the one-hot matrix before and after grouping.');
    }, 420);
  }

  _setPreviewMode(mode) {
    if (!this._grouped || this._groupingAnimating) return;
    if (mode !== 'before' && mode !== 'after') return;

    this._previewMode = mode;
    this._syncImpact();

    if (mode === 'after' && !this._awardedStepIds.has('impact-seen')) {
      this._completed = true;
      this._awardStep('impact-seen');
      this._revealSection(this._ui.summary);
      this._setFeedback(`Impact confirmed. The grouped matrix now needs only 5 one-hot columns because the rare cities share ${GROUP_LABEL}.`);
      this._setStatus('Cardinality lesson complete. Continue to the encoding-decision challenge next.');
      return;
    }

    if (mode === 'after') {
      this._setStatus('After grouping, the rare rows all activate the shared Autres column.');
    } else {
      this._setStatus('Before grouping, each rare city still demands its own private one-hot column.');
    }
  }

  _awardStep(stepId) {
    this._awardedStepIds.add(stepId);
    this._engine.correct();
    this._syncTracker();
    this._syncProgress();
    this._syncSummary();
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
    this._clearTimers();
    this._threshold = DEFAULT_THRESHOLD;
    this._selectedRareCities = activeRareCities(this._threshold);
    this._groupedCities = [];
    this._grouped = false;
    this._groupingAnimating = false;
    this._previewMode = 'before';
    this._awardedStepIds.clear();
    this._completed = false;

    if (this._ui.threshold) {
      this._ui.threshold.value = String(DEFAULT_THRESHOLD);
    }

    if (this._ui.impact) {
      this._ui.impact.hidden = true;
      this._ui.impact.classList.remove('is-revealed');
    }

    if (this._ui.summary) {
      this._ui.summary.hidden = true;
      this._ui.summary.classList.remove('is-revealed');
    }

    this._syncChart();
    this._syncImpact();
    this._syncTracker();
    this._syncProgress();
    this._syncSummary();
    this._setFeedback(DEFAULT_FEEDBACK);
    this._setStatus(DEFAULT_STATUS);
  }

  _syncChart() {
    const selectedSet = new Set(this._selectedRareCities);
    const groupedSet = new Set(this._groupedCities);
    const source = this._grouped ? groupedChartData(this._groupedCities) : CITY_FREQUENCIES;
    const maxCount = Math.max(...source.map(entry => entry.count), 1);

    if (this._ui.chart) {
      this._ui.chart.innerHTML = `
        <div class="w4-cardinality-bars">
          ${source.map(entry => {
            const isRare = !this._grouped && selectedSet.has(entry.city);
            const isGrouped = this._grouped && groupedSet.has(entry.city);
            const isFallback = entry.city === GROUP_LABEL;
            const state = this._groupingAnimating && isRare
              ? 'collapsing'
              : isFallback
                ? 'fallback'
                : isRare
                  ? 'rare'
                  : 'common';

            return `
              <article class="w4-cardinality-bar" data-bar-state="${state}">
                <div class="w4-cardinality-bar__meta">
                  <span class="w4-cardinality-bar__city">${escapeHtml(entry.city)}</span>
                  <span class="w4-cardinality-bar__count">${entry.count} / ${TOTAL_ROWS}</span>
                </div>
                <div class="w4-cardinality-bar__track">
                  <div class="w4-cardinality-bar__fill" style="width:${(entry.count / maxCount) * 100}%;"></div>
                </div>
                <div class="w4-cardinality-bar__value">${escapeHtml(formatPercent(entry.percent))}</div>
              </article>
            `;
          }).join('')}
        </div>
      `;
    }

    if (this._ui.thresholdValue) {
      this._ui.thresholdValue.textContent = `${this._threshold}%`;
    }

    if (this._ui.rareStatus) {
      if (this._grouped) {
        this._ui.rareStatus.textContent = `${this._groupedCities.length} rare labels grouped`;
      } else {
        this._ui.rareStatus.textContent = `${this._selectedRareCities.length} ${pluralize(this._selectedRareCities.length, 'category', 'categories')} highlighted`;
      }
    }

    if (this._ui.groupStatus) {
      if (this._groupingAnimating) {
        this._ui.groupStatus.textContent = `Grouping ${this._selectedRareCities.length} rare labels...`;
      } else if (this._grouped) {
        this._ui.groupStatus.textContent = `Reduced from 8 to 5 unique values`;
      } else if (this._selectedRareCities.length === TARGET_RARE_COUNT) {
        this._ui.groupStatus.textContent = `${TARGET_RARE_COUNT} rare cities isolated and ready to group`;
      } else {
        this._ui.groupStatus.textContent = 'Grouping locked until the rare tail is isolated';
      }
    }

    if (this._ui.groupCopy) {
      this._ui.groupCopy.textContent = this._grouped
        ? `${GROUP_LABEL} now absorbs ${this._groupedCities.join(', ')} so the one-hot matrix no longer needs four private columns for them.`
        : `The goal is to isolate the thin tail of rare labels, not to swallow the common cities with the slider.`;
    }

    if (this._ui.uniqueCount) {
      this._ui.uniqueCount.textContent = this._grouped ? '5' : '8';
    }

    if (this._ui.widthCount) {
      this._ui.widthCount.textContent = this._grouped ? '5 columns' : '8 columns';
    }

    if (this._ui.ctaCopy) {
      this._ui.ctaCopy.textContent = this._grouped
        ? `Grouping complete. ${GROUP_LABEL} is live, and the impact preview is ready below.`
        : this._selectedRareCities.length === TARGET_RARE_COUNT
          ? `Perfect. ${this._selectedRareCities.join(', ')} form the rare tail. Apply grouping to merge them into ${GROUP_LABEL}.`
          : 'Slide until only the truly rare cities light up. Then merge them into one shared label.';
    }

    if (this._ui.applyButton) {
      this._ui.applyButton.disabled = this._grouped || this._groupingAnimating || this._selectedRareCities.length !== TARGET_RARE_COUNT;
    }

    if (this._ui.threshold) {
      this._ui.threshold.disabled = this._grouped || this._groupingAnimating;
    }
  }

  _syncImpact() {
    const groupedCities = this._groupedCities;
    const columns = previewColumns(this._previewMode, groupedCities);

    this._ui.previewButtons.forEach(button => {
      const active = button.getAttribute('data-preview-mode') === this._previewMode;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.classList.toggle('is-active', active);
      button.disabled = !this._grouped;
    });

    this._ui.previewCards.forEach(card => {
      const mode = card.getAttribute('data-preview-card');
      card.dataset.previewState = mode === this._previewMode ? 'active' : 'idle';
    });

    if (this._ui.impactStatus) {
      this._ui.impactStatus.textContent = this._grouped
        ? this._previewMode === 'before'
          ? 'Before grouping, every city demands its own one-hot column.'
          : `After grouping, the four rare cities share the ${GROUP_LABEL} column.`
        : 'Preview the 8-column matrix first, then switch to the grouped version.';
    }

    if (this._ui.matrix) {
      this._ui.matrix.innerHTML = `
        <div class="w4-cardinality-matrix">
          <div class="w4-cardinality-matrix__head">
            <span class="w4-cardinality-matrix__title">${this._previewMode === 'before' ? 'Before Grouping' : 'After Grouping'}</span>
            <span class="w4-cardinality-matrix__badge">${columns.length} columns</span>
          </div>

          <div class="w4-cardinality-matrix__table-shell">
            <table class="w4-cardinality-matrix__table">
              <thead>
                <tr>
                  <th scope="col">Sample</th>
                  <th scope="col">City</th>
                  ${columns.map(column => `<th scope="col">${escapeHtml(column)}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${PREVIEW_SAMPLE_ROWS.map(row => `
                  <tr>
                    <th scope="row">${escapeHtml(row.label)}</th>
                    <td>${escapeHtml(row.city)}</td>
                    ${columns.map(column => `
                      <td data-cell-state="${matrixValue(this._previewMode, row.city, column, groupedCities) ? 'hot' : 'cold'}">
                        ${matrixValue(this._previewMode, row.city, column, groupedCities)}
                      </td>
                    `).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  }

  _syncTracker() {
    this._ui.trackerCards.forEach(card => {
      const stepId = card.getAttribute('data-step-id');
      const status = card.querySelector(`[data-step-status="${stepId}"]`);
      let state = 'pending';

      if (this._awardedStepIds.has(stepId)) {
        state = 'solved';
      } else if (
        stepId === 'threshold-locked' ||
        (stepId === 'grouping-applied' && this._awardedStepIds.has('threshold-locked')) ||
        (stepId === 'impact-seen' && this._awardedStepIds.has('grouping-applied'))
      ) {
        state = 'active';
      }

      card.dataset.stepState = state;
      if (status) {
        status.textContent = state === 'solved' ? 'Solved' : state === 'active' ? 'Active' : 'Pending';
      }
    });
  }

  _syncProgress() {
    if (this._ui.progress) {
      this._ui.progress.textContent = `${this._awardedStepIds.size} / ${STEP_META.length} cardinality locks`;
    }

    if (this._ui.finishButton) {
      this._ui.finishButton.disabled = !this._completed;
    }
  }

  _syncSummary() {
    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = this._completed
        ? `${STEP_META.length} / ${STEP_META.length} cardinality locks`
        : 'Waiting for impact review';
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

  _schedule(callback, delay) {
    const timerId = window.setTimeout(() => {
      this._timers.delete(timerId);
      callback();
    }, delay);

    this._timers.add(timerId);
    return timerId;
  }

  _clearTimers() {
    this._timers.forEach(timerId => window.clearTimeout(timerId));
    this._timers.clear();
  }
}
