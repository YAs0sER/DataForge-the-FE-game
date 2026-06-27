'use strict';

import { DataFrame } from '../../pandas/dataframe.js';
import { createDataset, DATASET_KEYS } from '../../data/datasets.js';
import { getLevelProblem } from '../../data/problems.js';
import { ChartWidget } from '../../widgets/charts.js';

const PROBLEM = getLevelProblem(5, 1);
const LEVEL_TITLE = PROBLEM?.title ?? 'The Scale Problem';
const LEVEL_OBJECTIVE = PROBLEM?.objective ?? 'See why unequal scales distort distance-based algorithms.';

function createFallbackDataset() {
  return DataFrame.fromRows([
    { Age: 18, Salary: 28000, Purchase_Count: 1 },
    { Age: 25, Salary: 34000, Purchase_Count: 2 },
    { Age: 30, Salary: 39000, Purchase_Count: 3 },
    { Age: 45, Salary: 52000, Purchase_Count: 7 },
    { Age: 60, Salary: 79000, Purchase_Count: 18 },
  ]);
}

function createLevelDataset() {
  try {
    return createDataset(PROBLEM?.datasetKey ?? DATASET_KEYS.SCALING_PRACTICE);
  } catch {
    return createFallbackDataset();
  }
}

const DATASET = createLevelDataset();
const PROBE = Object.freeze({
  name: 'Nadia',
  Age: 30,
  Salary: 40000,
  Purchase_Count: 3,
});

const CANDIDATES = Object.freeze([
  Object.freeze({
    id: 'amin',
    name: 'Amin',
    tone: 'var(--color-world-5)',
    Age: 31,
    Salary: 49000,
    Purchase_Count: 4,
    rawStory: 'Almost identical age and purchase rhythm, but a visibly bigger salary gap.',
    scaledStory: 'After scaling, the tiny age and purchase gaps finally count properly.',
  }),
  Object.freeze({
    id: 'sara',
    name: 'Sara',
    tone: 'var(--color-warning)',
    Age: 48,
    Salary: 41000,
    Purchase_Count: 9,
    rawStory: 'Salary is extremely close, even though the rest of the profile drifts much farther away.',
    scaledStory: 'Once every feature is put on the same footing, the larger age and purchase gaps dominate again.',
  }),
]);

const FEATURE_META = Object.freeze([
  Object.freeze({
    id: 'Age',
    label: 'Age',
    icon: 'A',
    color: 'var(--color-world-5)',
    tone: 'var(--color-world-5)',
    rangeLabel: 'years',
  }),
  Object.freeze({
    id: 'Salary',
    label: 'Salary',
    icon: '$',
    color: 'var(--color-warning)',
    tone: 'var(--color-warning)',
    rangeLabel: 'USD span',
  }),
  Object.freeze({
    id: 'Purchase_Count',
    label: 'Purchases',
    icon: '#',
    color: 'var(--color-world-1)',
    tone: 'var(--color-world-1)',
    rangeLabel: 'count span',
  }),
]);

const FEATURE_RANGE = Object.freeze(
  FEATURE_META.reduce((acc, feature) => {
    const values = DATASET.col(feature.id).values.filter(value => typeof value === 'number' && Number.isFinite(value));
    acc[feature.id] = Math.max(...values) - Math.min(...values);
    return acc;
  }, {})
);

const DOMINANT_FEATURE_ID = FEATURE_META.reduce((current, feature) =>
  FEATURE_RANGE[feature.id] > FEATURE_RANGE[current] ? feature.id : current
, FEATURE_META[0].id);

const CANDIDATE_COMPARISONS = Object.freeze(
  CANDIDATES.map(candidate => {
    const rawByFeature = Object.freeze(
      FEATURE_META.reduce((acc, feature) => {
        acc[feature.id] = Math.abs(candidate[feature.id] - PROBE[feature.id]);
        return acc;
      }, {})
    );

    const scaledByFeature = Object.freeze(
      FEATURE_META.reduce((acc, feature) => {
        const range = FEATURE_RANGE[feature.id] || 1;
        acc[feature.id] = rawByFeature[feature.id] / range;
        return acc;
      }, {})
    );

    return Object.freeze({
      ...candidate,
      rawByFeature,
      scaledByFeature,
      rawDistance: Math.hypot(...FEATURE_META.map(feature => rawByFeature[feature.id])),
      scaledDistance: Math.hypot(...FEATURE_META.map(feature => scaledByFeature[feature.id])),
    });
  })
);

const RAW_WINNER = CANDIDATE_COMPARISONS.reduce((best, candidate) =>
  candidate.rawDistance < best.rawDistance ? candidate : best
);

const SCALED_WINNER = CANDIDATE_COMPARISONS.reduce((best, candidate) =>
  candidate.scaledDistance < best.scaledDistance ? candidate : best
);

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const WHOLE = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(value) {
  return MONEY.format(value);
}

function formatWhole(value) {
  return WHOLE.format(value);
}

function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}

function formatScaledDistance(value) {
  return value.toFixed(3);
}

const TRACKER_STEPS = Object.freeze([
  Object.freeze({
    id: 'dominant-range',
    label: 'Identify the raw feature span that hijacks distance',
    chapter: 'Range Scan',
    recap: `Salary stretches across ${formatWhole(FEATURE_RANGE.Salary)} raw units, which dwarfs Age (${formatWhole(FEATURE_RANGE.Age)}) and Purchases (${formatWhole(FEATURE_RANGE.Purchase_Count)}).`,
  }),
  Object.freeze({
    id: 'raw-choice',
    label: 'See which neighbor raw distance picks first',
    chapter: 'Unscaled Metric',
    recap: `${RAW_WINNER.name} wins under raw units because the salary gap dominates the score even though the rest of the profile is farther away.`,
  }),
  Object.freeze({
    id: 'scaled-choice',
    label: 'Watch scaling restore the genuinely similar profile',
    chapter: 'Min-Max Lens',
    recap: `${SCALED_WINNER.name} becomes the healthier nearest neighbor once each feature is judged relative to its own dataset range.`,
  }),
]);

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM?.hints ?? []),
  `Salary spans ${formatWhole(FEATURE_RANGE.Salary)} raw units in this dataset. That is the bar that should light up first.`,
  `${RAW_WINNER.name} wins before scaling because the salary gap is only ${formatMoney(RAW_WINNER.rawByFeature.Salary)} even though the other features drift farther away.`,
  `${SCALED_WINNER.name} becomes closer after min-max scaling because the Age and Purchases gaps shrink onto the same 0-1 footing as Salary.`,
]);

const DEFAULT_FEEDBACK = 'Start by clicking the feature span bar that is so large it can drown the other features inside a raw distance formula.';
const DEFAULT_STATUS = 'Lock 1 of 3: identify the feature whose raw unit scale dominates distance.';
const SUMMARY_COPY = 'Distance-based models compare numbers directly. Scaling prevents one oversized unit system from making every other feature feel invisible.';
const TOTAL_LOCKS = TRACKER_STEPS.length;

function featureMeta(featureId) {
  return FEATURE_META.find(feature => feature.id === featureId) ?? FEATURE_META[0];
}

function candidateById(candidateId) {
  return CANDIDATE_COMPARISONS.find(candidate => candidate.id === candidateId) ?? CANDIDATE_COMPARISONS[0];
}

function trackerState(stepId, solved) {
  if (stepId === 'dominant-range') {
    return solved.dominant ? 'solved' : 'active';
  }

  if (stepId === 'raw-choice') {
    if (solved.rawChoice) return 'solved';
    return solved.dominant ? 'active' : 'pending';
  }

  if (solved.scaledChoice) return 'solved';
  return solved.rawChoice ? 'active' : 'pending';
}

function trackerLabel(state) {
  if (state === 'solved') return 'Locked';
  if (state === 'active') return 'Active';
  return 'Pending';
}

function solvedFlags(context) {
  return {
    dominant: context._dominantFeatureId === DOMINANT_FEATURE_ID,
    rawChoice: context._rawWinnerId === RAW_WINNER.id,
    scaledChoice: context._scaledWinnerId === SCALED_WINNER.id,
  };
}

function progressCount(context) {
  const solved = solvedFlags(context);
  return Number(solved.dominant) + Number(solved.rawChoice) + Number(solved.scaledChoice);
}

function resultTone(summary) {
  if (!summary) return DEFAULT_FEEDBACK;
  if (summary.mistakes === 0) {
    return 'Clean read. You caught the oversized span immediately, saw raw distance lean the wrong way, and watched scaling restore the more truthful neighbor.';
  }
  if (summary.mistakes <= 2) {
    return 'Strong finish. The scaling intuition is correct, and you recovered from a couple of detours without losing the main rule.';
  }
  return 'Mission complete. Keep the recap below in mind whenever a distance-based model is reading features with wildly different raw units.';
}

export default class World5Level1 {
  meta = {
    title: LEVEL_TITLE,
    subtitle: LEVEL_OBJECTIVE,
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._events = null;
    this._rangeChart = null;
    this._candidateCharts = new Map();
    this._dominantFeatureId = null;
    this._rawWinnerId = null;
    this._scaledWinnerId = null;
    this._lens = 'raw';
    this._completed = false;
    this._mistakes = 0;
    this._summary = null;
    this._ui = {};
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w5-level w5-level--scale-problem screen-section" aria-label="World 5 Level 1">
        <div class="level-hero w5-level__hero" style="--world-color: var(--color-world-5);">
          <p class="eyebrow">World 5 - Scaling</p>
          <h1 class="level-hero__title">${escapeHtml(LEVEL_TITLE)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(LEVEL_OBJECTIVE)}
            This lab compares one probe profile against two candidates. Raw units let Salary bully the distance metric. Scaling gives Age, Salary, and Purchases a fair vote again.
          </p>
          <div class="action-row">
            <span class="status-box" id="w5-l1-progress">0 / ${TOTAL_LOCKS} scaling locks</span>
            <span class="status-box" id="w5-l1-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w5-l1-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w5-l1-reset-btn" type="button">Reset Lab</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">01</span>
        </div>

        <div class="w5-scale-grid">
          <article class="panel w5-scale-stage">
            <div class="w5-level__panel-head">
              <div>
                <p class="eyebrow">Distance Lab</p>
                <h2 class="panel-title">One oversized feature can drown the rest of the metric</h2>
              </div>
              <p class="w5-level__microcopy">
                The dataset below gives the range context. The probe and candidate cards underneath show how raw distance can get seduced by the biggest unit system before scaling restores balance.
              </p>
            </div>

            <section class="w5-scale-snapshot" aria-label="Scaling Snapshot">
              <article class="w5-scale-snapshot__card">
                <span class="w5-scale-snapshot__label">Widest Span</span>
                <strong class="w5-scale-snapshot__value" id="w5-l1-dominant-state" data-state="missing">Hidden</strong>
              </article>
              <article class="w5-scale-snapshot__card">
                <span class="w5-scale-snapshot__label">Raw Winner</span>
                <strong class="w5-scale-snapshot__value" id="w5-l1-raw-state" data-state="missing">Pending</strong>
              </article>
              <article class="w5-scale-snapshot__card">
                <span class="w5-scale-snapshot__label">Scaled Winner</span>
                <strong class="w5-scale-snapshot__value" id="w5-l1-scaled-state" data-state="missing">Pending</strong>
              </article>
              <article class="w5-scale-snapshot__card">
                <span class="w5-scale-snapshot__label">Current Lens</span>
                <strong class="w5-scale-snapshot__value" id="w5-l1-lens-state" data-state="present">Raw Units</strong>
              </article>
            </section>

            <section class="w5-scale-range-panel">
              <div class="w5-scale-range-panel__head">
                <div>
                  <p class="eyebrow">Dataset Spans</p>
                  <h3 class="panel-title">Click the feature whose raw range is most likely to hijack distance</h3>
                </div>
                <p class="w5-scale-range-panel__copy">
                  These spans come from the World 5 practice dataset. The tallest bar is the one that can overpower the distance formula when no scaling is applied.
                </p>
              </div>

              <div class="w5-scale-range-panel__stats">
                ${FEATURE_META.map(feature => `
                  <article class="w5-scale-range-chip" data-feature-chip="${feature.id}" style="--feature-tone:${feature.tone};">
                    <span class="w5-scale-range-chip__icon">${escapeHtml(feature.icon)}</span>
                    <div>
                      <strong>${escapeHtml(feature.label)}</strong>
                      <span>${escapeHtml(formatWhole(FEATURE_RANGE[feature.id]))} ${escapeHtml(feature.rangeLabel)}</span>
                    </div>
                  </article>
                `).join('')}
              </div>

              <div class="w5-scale-chart-shell" id="w5-l1-range-chart"></div>
            </section>

            <section class="w5-scale-comparison">
              <div class="w5-scale-comparison__head">
                <div>
                  <p class="eyebrow">Nearest-Neighbor Thought Experiment</p>
                  <h3 class="panel-title">Probe one profile against two different kinds of "closeness"</h3>
                </div>
                <p class="w5-scale-comparison__copy" id="w5-l1-comparison-copy">
                  Step 2 unlocks after the dominant range is identified. Under raw units, pick the candidate the metric would treat as closer.
                </p>
              </div>

              <div class="w5-scale-profiles">
                <article class="w5-scale-probe">
                  <div class="w5-scale-probe__meta">
                    <span class="w5-scale-probe__eyebrow">Probe Profile</span>
                    <h3 class="w5-scale-probe__title">${escapeHtml(PROBE.name)}</h3>
                  </div>
                  <div class="w5-scale-probe__stats">
                    <span>Age ${escapeHtml(formatWhole(PROBE.Age))}</span>
                    <span>Salary ${escapeHtml(formatMoney(PROBE.Salary))}</span>
                    <span>Purchases ${escapeHtml(formatWhole(PROBE.Purchase_Count))}</span>
                  </div>
                </article>

                <div class="w5-scale-lens">
                  <div class="w5-scale-lens__meta">
                    <span class="w5-scale-lens__eyebrow">Metric Lens</span>
                    <h3 class="w5-scale-lens__title" id="w5-l1-lens-title">Raw Distance</h3>
                  </div>
                  <div class="w5-scale-lens__buttons" role="tablist" aria-label="Distance lenses">
                    <button class="btn btn--ghost" id="w5-l1-lens-raw" type="button" data-lens="raw" aria-pressed="true">Raw Units</button>
                    <button class="btn btn--ghost" id="w5-l1-lens-scaled" type="button" data-lens="scaled" aria-pressed="false" disabled>Min-Max Lens</button>
                  </div>
                  <p class="w5-scale-lens__formula" id="w5-l1-formula-copy">
                    Raw distance compares the absolute gaps directly, so a big-unit feature can dominate without asking whether the other features are actually similar.
                  </p>
                </div>
              </div>

              <div class="w5-scale-candidate-grid">
                ${CANDIDATE_COMPARISONS.map(candidate => `
                  <article class="w5-scale-candidate" data-candidate-id="${candidate.id}" style="--candidate-tone:${candidate.tone};">
                    <div class="w5-scale-candidate__head">
                      <div>
                        <p class="w5-scale-candidate__eyebrow">Candidate</p>
                        <h3 class="w5-scale-candidate__title">${escapeHtml(candidate.name)}</h3>
                      </div>
                      <span class="w5-scale-candidate__distance" id="w5-l1-distance-${candidate.id}">Raw ~ ${escapeHtml(formatWhole(candidate.rawDistance))}</span>
                    </div>

                    <div class="w5-scale-candidate__stats">
                      <span>Age ${escapeHtml(formatWhole(candidate.Age))}</span>
                      <span>Salary ${escapeHtml(formatMoney(candidate.Salary))}</span>
                      <span>Purchases ${escapeHtml(formatWhole(candidate.Purchase_Count))}</span>
                    </div>

                    <p class="w5-scale-candidate__story" id="w5-l1-story-${candidate.id}">
                      ${escapeHtml(candidate.rawStory)}
                    </p>

                    <div class="w5-scale-candidate__chart" id="w5-l1-chart-${candidate.id}"></div>

                    <button class="btn btn--primary w5-scale-candidate__button" type="button" data-candidate-select="${candidate.id}" disabled>
                      Choose ${escapeHtml(candidate.name)} As Closer
                    </button>
                  </article>
                `).join('')}
              </div>
            </section>
          </article>

          <div class="w5-scale-side">
            <section class="panel w5-scale-tracker" aria-label="Scaling Tracker">
              <div class="w5-level__panel-head">
                <div>
                  <p class="eyebrow">Mission Tracker</p>
                  <h2 class="panel-title">Find the bully feature, then watch scaling rebalance the metric</h2>
                </div>
                <p class="w5-level__microcopy">
                  Each lock corresponds to one scaling intuition the rest of this world will build on.
                </p>
              </div>

              <div class="w5-scale-tracker__list">
                ${TRACKER_STEPS.map((step, index) => `
                  <article class="w5-scale-card" data-step-id="${step.id}" data-step-state="${index === 0 ? 'active' : 'pending'}">
                    <div class="w5-scale-card__meta">
                      <span class="w5-scale-card__status" data-step-status="${step.id}">${index === 0 ? 'Active' : 'Pending'}</span>
                      <span class="w5-scale-card__index">Step ${index + 1}</span>
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
              <p id="w5-l1-feedback-text" class="w5-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
            </section>

            <section class="card w5-level__hint-box" id="w5-l1-hint-box" hidden>
              <p class="eyebrow">Hint</p>
              <p id="w5-l1-hint-text" class="w5-level__hint-copy"></p>
            </section>

            <section class="card w5-scale-guide">
              <p class="eyebrow">What This Teaches</p>
              <div class="w5-scale-guide__steps">
                <article class="w5-scale-guide__step">
                  <span class="w5-scale-guide__badge">1</span>
                  <p>The biggest raw unit system can silently dominate Euclidean-style distance, even when other features tell a different story.</p>
                </article>
                <article class="w5-scale-guide__step">
                  <span class="w5-scale-guide__badge">2</span>
                  <p>Min-max scaling divides each gap by the feature's full dataset range, so Age and Purchases can speak at the same volume as Salary.</p>
                </article>
                <article class="w5-scale-guide__step">
                  <span class="w5-scale-guide__badge">3</span>
                  <p>Distance-based and gradient-based models care about this balance most. Tree models are much less sensitive to it.</p>
                </article>
              </div>
            </section>
          </div>
        </div>

        <section class="panel w5-scale-summary" id="w5-l1-summary" hidden aria-label="Scaling Summary">
          <div class="w5-level__panel-head">
            <div>
              <p class="eyebrow">Scaling Recap</p>
              <h2 class="panel-title">Raw distance leaned toward Salary. Scaling restored the fuller similarity picture.</h2>
            </div>
            <p class="w5-level__microcopy">${escapeHtml(SUMMARY_COPY)}</p>
          </div>

          <div class="w5-scale-summary__grid">
            <article class="w5-scale-summary__card">
              <p class="w5-scale-summary__kicker">Dominant Range</p>
              <h3 class="w5-scale-summary__title">Salary: ${escapeHtml(formatWhole(FEATURE_RANGE.Salary))}</h3>
              <p class="w5-scale-summary__copy">The salary span was so much wider than Age and Purchases that raw distance let it overpower the metric almost by itself.</p>
            </article>
            <article class="w5-scale-summary__card">
              <p class="w5-scale-summary__kicker">Raw Metric</p>
              <h3 class="w5-scale-summary__title">${escapeHtml(RAW_WINNER.name)} looked closer first</h3>
              <p class="w5-scale-summary__copy">${escapeHtml(RAW_WINNER.name)} won under raw units because a ${escapeHtml(formatMoney(RAW_WINNER.rawByFeature.Salary))} salary gap looked tiny compared with ${escapeHtml(formatMoney(SCALED_WINNER.rawByFeature.Salary))}, even though the other features pulled farther away.</p>
            </article>
            <article class="w5-scale-summary__card">
              <p class="w5-scale-summary__kicker">Scaled Metric</p>
              <h3 class="w5-scale-summary__title">${escapeHtml(SCALED_WINNER.name)} became the healthier match</h3>
              <p class="w5-scale-summary__copy">Once every feature was divided by its own range, the much smaller Age and Purchase gaps for ${escapeHtml(SCALED_WINNER.name)} finally counted the way they should.</p>
            </article>
          </div>

          <div class="action-row">
            <span class="status-box" id="w5-l1-summary-score">Waiting for the full scaling reveal</span>
            <button class="btn btn--primary" id="w5-l1-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w5-l1-progress');
    this._ui.status = container.querySelector('#w5-l1-status');
    this._ui.feedback = container.querySelector('#w5-l1-feedback-text');
    this._ui.hintBox = container.querySelector('#w5-l1-hint-box');
    this._ui.hintText = container.querySelector('#w5-l1-hint-text');
    this._ui.rangeChartHost = container.querySelector('#w5-l1-range-chart');
    this._ui.lensTitle = container.querySelector('#w5-l1-lens-title');
    this._ui.formulaCopy = container.querySelector('#w5-l1-formula-copy');
    this._ui.comparisonCopy = container.querySelector('#w5-l1-comparison-copy');
    this._ui.lensButtons = Array.from(container.querySelectorAll('[data-lens]'));
    this._ui.candidateButtons = Array.from(container.querySelectorAll('[data-candidate-select]'));
    this._ui.dominantState = container.querySelector('#w5-l1-dominant-state');
    this._ui.rawState = container.querySelector('#w5-l1-raw-state');
    this._ui.scaledState = container.querySelector('#w5-l1-scaled-state');
    this._ui.lensState = container.querySelector('#w5-l1-lens-state');
    this._ui.summary = container.querySelector('#w5-l1-summary');
    this._ui.summaryScore = container.querySelector('#w5-l1-summary-score');
    this._ui.finishButton = container.querySelector('#w5-l1-finish-btn');
    this._ui.trackerCards = Array.from(container.querySelectorAll('[data-step-id]'));
    this._ui.candidateCards = Array.from(container.querySelectorAll('[data-candidate-id]'));
    this._ui.candidateStories = Object.fromEntries(
      CANDIDATE_COMPARISONS.map(candidate => [
        candidate.id,
        container.querySelector(`#w5-l1-story-${candidate.id}`),
      ])
    );
    this._ui.candidateDistances = Object.fromEntries(
      CANDIDATE_COMPARISONS.map(candidate => [
        candidate.id,
        container.querySelector(`#w5-l1-distance-${candidate.id}`),
      ])
    );

    this._mountCharts();
    this._syncLens();
    this._syncTracker();
    this._syncSnapshots();
    this._syncProgress();
    this._syncSelectionState();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w5-l1-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w5-l1-reset-btn')) {
        this._resetLab();
        return;
      }

      if (event.target.closest('#w5-l1-finish-btn')) {
        if (this._completed) {
          void this._engine.complete();
        }
        return;
      }

      const lensButton = event.target.closest('[data-lens]');
      if (lensButton) {
        this._setLens(lensButton.getAttribute('data-lens'));
        return;
      }

      const candidateButton = event.target.closest('[data-candidate-select]');
      if (candidateButton) {
        this._handleCandidatePick(candidateButton.getAttribute('data-candidate-select'));
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
    this._rangeChart?.destroy();
    this._candidateCharts.forEach(chart => chart.destroy());
    this._rangeChart = null;
    this._candidateCharts.clear();
    this._ui = {};
  }

  _mountCharts() {
    this._rangeChart?.destroy();
    this._rangeChart = new ChartWidget(this._ui.rangeChartHost, {
      type: 'bar',
      title: 'Feature spans in raw dataset units',
      worldColor: 'var(--color-world-5)',
      minWidth: 720,
      height: 280,
      data: FEATURE_META.map(feature => ({
        label: feature.label,
        value: FEATURE_RANGE[feature.id],
        color: feature.color,
      })),
      valueFormatter: value => formatWhole(value),
      tooltipFormatter: item => `${item.label} span: ${formatWhole(item.value)} raw units`,
      ariaLabel: 'Bar chart showing how much larger the Salary range is than Age and Purchases.',
      onPointClick: detail => this._handleRangePick(detail.label),
    });

    CANDIDATE_COMPARISONS.forEach(candidate => {
      const host = this._container.querySelector(`#w5-l1-chart-${candidate.id}`);
      const chart = new ChartWidget(host, this._candidateChartConfig(candidate, this._lens));
      this._candidateCharts.set(candidate.id, chart);
    });
  }

  _candidateChartConfig(candidate, lens) {
    const scaled = lens === 'scaled';

    return {
      type: 'bar',
      title: scaled ? 'Scaled feature gaps (% of full range)' : 'Raw feature gaps',
      worldColor: candidate.tone,
      minWidth: 360,
      height: 240,
      data: FEATURE_META.map(feature => ({
        label: feature.label,
        value: scaled
          ? candidate.scaledByFeature[feature.id] * 100
          : candidate.rawByFeature[feature.id],
        color: feature.color,
      })),
      valueFormatter: value => scaled ? formatPercent(value) : formatWhole(value),
      tooltipFormatter: item => {
        const feature = featureMeta(item.label === 'Purchases' ? 'Purchase_Count' : item.label);
        if (scaled) {
          return `${feature.label} gap: ${formatPercent(candidate.scaledByFeature[feature.id] * 100)} of the full dataset range`;
        }
        if (feature.id === 'Salary') {
          return `${feature.label} gap: ${formatMoney(candidate.rawByFeature[feature.id])}`;
        }
        return `${feature.label} gap: ${formatWhole(candidate.rawByFeature[feature.id])}`;
      },
      ariaLabel: scaled
        ? `Bar chart showing the min-max scaled feature gaps for ${candidate.name}.`
        : `Bar chart showing the raw feature gaps for ${candidate.name}.`,
    };
  }

  _handleRangePick(label) {
    if (this._completed || this._dominantFeatureId === DOMINANT_FEATURE_ID) return;

    const clickedId = label === 'Purchases' ? 'Purchase_Count' : label;
    if (clickedId === DOMINANT_FEATURE_ID) {
      this._dominantFeatureId = DOMINANT_FEATURE_ID;
      this._engine.correct();
      this._setFeedback(`Correct. ${featureMeta(DOMINANT_FEATURE_ID).label} spans ${formatWhole(FEATURE_RANGE[DOMINANT_FEATURE_ID])} raw units, so it can easily drown the other features inside an unscaled distance calculation.`);
      this._setStatus(`Lock 1 complete. Now choose which candidate raw distance would treat as closer to ${PROBE.name}.`);
      this._syncTracker();
      this._syncSnapshots();
      this._syncProgress();
      this._syncSelectionState();
      return;
    }

    this._mistakes += 1;
    this._engine.mistake({ costsLife: false, countsMistake: true });
    this._setFeedback(`${label} is not the bully feature here. The dominant span should be the one that dwarfs ${formatWhole(FEATURE_RANGE.Age)} Age units and ${formatWhole(FEATURE_RANGE.Purchase_Count)} Purchase units by a huge margin.`);
    this._setStatus('Not yet. Click the tallest span bar to unlock the raw-distance comparison.');
  }

  _handleCandidatePick(candidateId) {
    if (this._completed) return;

    if (this._dominantFeatureId !== DOMINANT_FEATURE_ID) {
      this._setFeedback('The comparison stage is still locked. Identify the dominant raw span first so the distance distortion has context.');
      this._setStatus(DEFAULT_STATUS);
      return;
    }

    if (!this._rawWinnerId) {
      if (candidateId === RAW_WINNER.id) {
        this._rawWinnerId = candidateId;
        this._engine.correct();
        this._lens = 'scaled';
        this._setFeedback(`Exactly. Under raw units, ${RAW_WINNER.name} looks closer because the salary gap is only ${formatMoney(RAW_WINNER.rawByFeature.Salary)}, and that single feature overwhelms the larger Age and Purchase gaps.`);
        this._setStatus(`Lock 2 complete. The charts just switched to min-max scale. Choose which candidate is genuinely closer once every feature uses the same footing.`);
      } else {
        this._mistakes += 1;
        this._engine.mistake({ costsLife: false, countsMistake: true });
        this._setFeedback(`${candidateById(candidateId).name} feels more similar overall, but raw distance is still seduced by the much smaller salary gap on ${RAW_WINNER.name}. Pick the candidate the unscaled metric would prefer, not the one you personally trust more.`);
        this._setStatus('Raw-distance choice missed. Look at which candidate owns the smallest Salary gap before scaling.');
      }

      this._syncLens();
      this._syncTracker();
      this._syncSnapshots();
      this._syncProgress();
      this._syncSelectionState();
      return;
    }

    if (this._scaledWinnerId) return;

    if (candidateId === SCALED_WINNER.id) {
      this._scaledWinnerId = candidateId;
      this._engine.correct();
      this._completeLevel();
      return;
    }

    this._mistakes += 1;
    this._engine.mistake({ costsLife: false, countsMistake: true });
    this._setFeedback(`${candidateById(candidateId).name} only looked closer while Salary was bullying the metric. Under min-max scaling, the much bigger Age and Purchase gaps matter again, so ${SCALED_WINNER.name} should now win.`);
    this._setStatus('Scaled-distance choice missed. Compare the percentage-of-range bars rather than the raw dollar gaps.');
    this._syncSelectionState();
  }

  _setLens(lens) {
    if (lens !== 'raw' && lens !== 'scaled') return;
    if (lens === 'scaled' && !this._rawWinnerId) {
      this._setFeedback('The min-max lens unlocks after you first witness the wrong raw-distance answer.');
      this._setStatus('Raw comparison still in progress. Pick the raw winner first.');
      return;
    }

    this._lens = lens;
    this._syncLens();
    this._syncSnapshots();
    this._syncSelectionState();
  }

  _completeLevel() {
    this._completed = true;
    this._summary = {
      locksCompleted: TOTAL_LOCKS,
      totalLocks: TOTAL_LOCKS,
      mistakes: this._mistakes,
    };

    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = `${TOTAL_LOCKS} / ${TOTAL_LOCKS} scaling locks`;
    }

    if (this._ui.summary) {
      this._ui.summary.hidden = false;
      requestAnimationFrame(() => {
        this._ui.summary.classList.add('is-revealed');
      });
      this._ui.summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    this._setFeedback(resultTone(this._summary));
    this._setStatus('Scaling intuition complete. Continue to the min-max calculator next.');
    this._syncTracker();
    this._syncSnapshots();
    this._syncProgress();
    this._syncSelectionState();
  }

  _resetLab() {
    this._dominantFeatureId = null;
    this._rawWinnerId = null;
    this._scaledWinnerId = null;
    this._lens = 'raw';
    this._completed = false;
    this._mistakes = 0;
    this._summary = null;

    if (this._ui.summary) {
      this._ui.summary.hidden = true;
      this._ui.summary.classList.remove('is-revealed');
    }

    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = 'Waiting for the full scaling reveal';
    }

    this._setFeedback(DEFAULT_FEEDBACK);
    this._setStatus(DEFAULT_STATUS);
    this._syncLens();
    this._syncTracker();
    this._syncSnapshots();
    this._syncProgress();
    this._syncSelectionState();
  }

  _showHint() {
    const { allowed, text } = this._engine.requestHint();
    if (!allowed || !text) return;

    this._ui.hintBox?.removeAttribute('hidden');
    if (this._ui.hintText) {
      this._ui.hintText.textContent = text;
    }
  }

  _syncLens() {
    const scaled = this._lens === 'scaled';

    if (this._ui.lensTitle) {
      this._ui.lensTitle.textContent = scaled ? 'Min-Max Distance' : 'Raw Distance';
    }

    if (this._ui.formulaCopy) {
      this._ui.formulaCopy.textContent = scaled
        ? 'Min-max scaling divides each gap by the feature range, so every bar now shows how much of the full dataset span that difference consumes.'
        : 'Raw distance compares the absolute gaps directly, so a big-unit feature can dominate without asking whether the other features are actually similar.';
    }

    if (this._ui.comparisonCopy) {
      this._ui.comparisonCopy.textContent = scaled
        ? `The charts are now normalized by feature range. Pick the candidate who is actually closer to ${PROBE.name} once Salary stops drowning the other signals.`
        : `Step 2 unlocks after the dominant range is identified. Under raw units, pick the candidate the metric would treat as closer to ${PROBE.name}.`;
    }

    if (this._ui.lensButtons) {
      this._ui.lensButtons.forEach(button => {
        const lens = button.getAttribute('data-lens');
        const active = lens === this._lens;
        button.setAttribute('aria-pressed', String(active));
        button.disabled = lens === 'scaled' && !this._rawWinnerId;
      });
    }

    CANDIDATE_COMPARISONS.forEach(candidate => {
      this._candidateCharts.get(candidate.id)?.update(this._candidateChartConfig(candidate, this._lens));

      const distanceEl = this._ui.candidateDistances[candidate.id];
      if (distanceEl) {
        distanceEl.textContent = scaled
          ? `Scaled ${formatScaledDistance(candidate.scaledDistance)}`
          : `Raw ~ ${formatWhole(candidate.rawDistance)}`;
      }

      const storyEl = this._ui.candidateStories[candidate.id];
      if (storyEl) {
        storyEl.textContent = scaled ? candidate.scaledStory : candidate.rawStory;
      }
    });
  }

  _syncTracker() {
    const solved = solvedFlags(this);

    this._ui.trackerCards?.forEach(card => {
      const stepId = card.dataset.stepId;
      const state = trackerState(stepId, solved);
      const statusEl = card.querySelector('[data-step-status]');

      card.dataset.stepState = state;
      if (statusEl) {
        statusEl.textContent = trackerLabel(state);
      }
    });
  }

  _syncSnapshots() {
    if (this._ui.dominantState) {
      const solved = this._dominantFeatureId === DOMINANT_FEATURE_ID;
      this._ui.dominantState.textContent = solved ? featureMeta(DOMINANT_FEATURE_ID).label : 'Hidden';
      this._ui.dominantState.dataset.state = solved ? 'correct' : 'missing';
    }

    if (this._ui.rawState) {
      const solved = this._rawWinnerId === RAW_WINNER.id;
      this._ui.rawState.textContent = solved ? RAW_WINNER.name : 'Pending';
      this._ui.rawState.dataset.state = solved ? 'correct' : 'missing';
    }

    if (this._ui.scaledState) {
      const solved = this._scaledWinnerId === SCALED_WINNER.id;
      this._ui.scaledState.textContent = solved ? SCALED_WINNER.name : 'Pending';
      this._ui.scaledState.dataset.state = solved ? 'correct' : this._rawWinnerId ? 'present' : 'missing';
    }

    if (this._ui.lensState) {
      this._ui.lensState.textContent = this._lens === 'scaled' ? 'Min-Max' : 'Raw Units';
      this._ui.lensState.dataset.state = this._lens === 'scaled' ? 'correct' : 'present';
    }
  }

  _syncProgress() {
    if (this._ui.progress) {
      this._ui.progress.textContent = `${progressCount(this)} / ${TOTAL_LOCKS} scaling locks`;
    }

    if (this._ui.finishButton) {
      this._ui.finishButton.disabled = !this._completed;
    }
  }

  _syncSelectionState() {
    const rawStageOpen = this._dominantFeatureId === DOMINANT_FEATURE_ID && !this._rawWinnerId;
    const scaledStageOpen = this._rawWinnerId === RAW_WINNER.id && !this._scaledWinnerId && this._lens === 'scaled';

    this._ui.candidateButtons?.forEach(button => {
      const candidateId = button.getAttribute('data-candidate-select');
      const enabled = rawStageOpen || scaledStageOpen;
      button.disabled = !enabled;
      button.textContent = rawStageOpen
        ? `Choose ${candidateById(candidateId).name} Under Raw Distance`
        : scaledStageOpen
          ? `Choose ${candidateById(candidateId).name} Under Min-Max`
          : `Choose ${candidateById(candidateId).name} As Closer`;
    });

    this._ui.candidateCards?.forEach(card => {
      const candidateId = card.getAttribute('data-candidate-id');
      let state = 'idle';

      if (this._rawWinnerId === candidateId) {
        state = this._lens === 'raw' ? 'locked' : 'past';
      }
      if (this._scaledWinnerId === candidateId) {
        state = 'locked';
      }

      card.dataset.candidateState = state;
    });
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
