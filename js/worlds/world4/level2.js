'use strict';

import { getLevelProblem } from '../../data/problems.js';
import { createDragDrop } from '../../widgets/dragdrop.js';

const PROBLEM = getLevelProblem(4, 2);
const LEVEL_TITLE = PROBLEM?.title ?? 'Label Encoding - The Hidden Danger';
const LEVEL_OBJECTIVE = PROBLEM?.objective ?? 'Assign numeric labels, reveal the fake-order trap, then use label encoding on a truly ordered scale.';

const NOMINAL_LEVELS = Object.freeze([
  Object.freeze({ id: 'bac', label: 'Bac', note: 'First diploma checkpoint' }),
  Object.freeze({ id: 'licence', label: 'Licence', note: 'Undergraduate degree' }),
  Object.freeze({ id: 'master', label: 'Master', note: 'Graduate degree' }),
  Object.freeze({ id: 'doctorat', label: 'Doctorat', note: 'Doctoral degree' }),
]);

const ORDINAL_LEVELS = Object.freeze([
  Object.freeze({ id: 'low', label: 'Low', note: 'Clearly smaller than Medium and High' }),
  Object.freeze({ id: 'medium', label: 'Medium', note: 'Sits between Low and High' }),
  Object.freeze({ id: 'high', label: 'High', note: 'Clearly larger than Low and Medium' }),
]);

const NOMINAL_TOKENS = Object.freeze([0, 1, 2, 3]);
const ORDINAL_TOKENS = Object.freeze([0, 1, 2]);

const STEP_META = Object.freeze([
  Object.freeze({
    id: 'nominal-map',
    label: 'Map the first column any way you want',
    chapter: 'Mechanic',
    recap: 'A label encoder can stamp arbitrary integers onto categories without asking whether those numbers mean anything.',
  }),
  Object.freeze({
    id: 'danger-seen',
    label: 'Expose the hidden model assumption',
    chapter: 'Risk',
    recap: 'A linear model will treat the encoded values as ordered numeric distances, even when the codes came from an arbitrary label map.',
  }),
  Object.freeze({
    id: 'ordinal-proof',
    label: 'Use label encoding only when the order is real',
    chapter: 'Safe Case',
    recap: 'When categories truly have rank, a 0 < 1 < 2 mapping can preserve that order more honestly.',
  }),
]);

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM?.hints ?? []),
  'For the first column, the drag step is deliberately permissive. The trap comes from what the model assumes after the encoding, not from the drag itself.',
  'If the encoded order becomes Bac < Master < Licence < Doctorat, the model will treat that exact numeric ladder as real structure.',
  'In the final panel, the correct ordinal map is Low -> 0, Medium -> 1, High -> 2.',
]);

const ORDINAL_ANSWER_KEY = Object.freeze({
  'ordinal-zone-low': 'ordinal-token-0',
  'ordinal-zone-medium': 'ordinal-token-1',
  'ordinal-zone-high': 'ordinal-token-2',
});

const DEFAULT_FEEDBACK = 'Drag the number chips onto the category rows first. For the opening column, any unique mapping works, which is exactly why the danger needs a second look.';
const DEFAULT_STATUS = 'Part 1 is live. Label-encode the first categorical column with 0, 1, 2, and 3 in any order.';
const SUMMARY_COPY = 'Label encoding is compact, but it only behaves well when the category order is truly meaningful and the model assumption matches that ranking.';

const NOMINAL_BASE_PREDICTION = 2600;
const NOMINAL_PREDICTION_STEP = 850;
const ORDINAL_BASE_PREDICTION = 1800;
const ORDINAL_PREDICTION_STEP = 700;

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
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

function nominalZoneId(levelId) {
  return `nominal-zone-${levelId}`;
}

function ordinalZoneId(levelId) {
  return `ordinal-zone-${levelId}`;
}

function nominalTokenId(value) {
  return `nominal-token-${value}`;
}

function ordinalTokenId(value) {
  return `ordinal-token-${value}`;
}

function parseTokenValue(tokenId) {
  const match = String(tokenId).match(/(\d+)$/);
  return match ? Number(match[1]) : null;
}

function filledCount(placements) {
  return Object.values(placements).filter(Boolean).length;
}

function nominalMappingFromPlacements(placements) {
  return Object.fromEntries(
    NOMINAL_LEVELS.map(level => [level.id, null])
  );
}

function collectNominalMapping(placements) {
  const mapping = nominalMappingFromPlacements(placements);

  Object.entries(placements).forEach(([tokenId, zoneId]) => {
    if (!zoneId?.startsWith('nominal-zone-')) return;
    const levelId = zoneId.replace('nominal-zone-', '');
    mapping[levelId] = parseTokenValue(tokenId);
  });

  return mapping;
}

function collectOrdinalMapping(placements) {
  const mapping = Object.fromEntries(
    ORDINAL_LEVELS.map(level => [level.id, null])
  );

  Object.entries(placements).forEach(([tokenId, zoneId]) => {
    if (!zoneId?.startsWith('ordinal-zone-')) return;
    const levelId = zoneId.replace('ordinal-zone-', '');
    mapping[levelId] = parseTokenValue(tokenId);
  });

  return mapping;
}

function nominalMappingComplete(mapping) {
  return NOMINAL_LEVELS.every(level => Number.isInteger(mapping[level.id]));
}

function naturalCodes(mapping) {
  return NOMINAL_LEVELS.map(level => mapping[level.id]);
}

function hasNaturalAscendingOrder(mapping) {
  const codes = naturalCodes(mapping);
  return codes.every(Number.isInteger) && codes.every((code, index) => index === 0 || code > codes[index - 1]);
}

function orderedLabelsFromMapping(mapping) {
  return NOMINAL_LEVELS
    .map(level => ({
      ...level,
      code: mapping[level.id],
    }))
    .filter(level => Number.isInteger(level.code))
    .sort((left, right) => left.code - right.code);
}

function predictionForCode(code, base, step) {
  return base + (code * step);
}

function formatMoney(value) {
  return MONEY.format(value);
}

function nominalRiskProfile(mapping) {
  const ordered = orderedLabelsFromMapping(mapping);
  const orderedLabel = ordered.map(level => `${level.label} (${level.code})`).join(' -> ');

  if (!nominalMappingComplete(mapping)) {
    return {
      tone: 'waiting',
      headline: 'Finish the full mapping before the warning wakes up.',
      copy: 'A linear model can only invent distances after every category has been assigned a numeric code.',
      orderedLabel: 'Waiting for 4 encoded labels',
    };
  }

  if (!hasNaturalAscendingOrder(mapping)) {
    return {
      tone: 'danger',
      headline: 'The model just learned a fake ranking.',
      copy: `Your encoder created the numeric ladder ${orderedLabel}. A linear model will treat that exact order as meaningful, even though the codes came from an arbitrary label assignment rather than a measured progression.`,
      orderedLabel,
    };
  }

  return {
    tone: 'warning',
    headline: 'The order looks tidy, but the spacing is still invented.',
    copy: `This mapping preserves Bac -> Licence -> Master -> Doctorat, but the model now assumes every one-step jump is equally sized. It treats 0 -> 1 exactly like 2 -> 3, which may not reflect how the real-world effect changes.`,
    orderedLabel,
  };
}

function nominalChartRows(mapping) {
  return NOMINAL_LEVELS.map(level => {
    const code = mapping[level.id];
    const prediction = Number.isInteger(code)
      ? predictionForCode(code, NOMINAL_BASE_PREDICTION, NOMINAL_PREDICTION_STEP)
      : null;

    return {
      ...level,
      code,
      prediction,
    };
  });
}

function ordinalChartRows(mapping) {
  return ORDINAL_LEVELS.map(level => {
    const code = mapping[level.id];
    const prediction = Number.isInteger(code)
      ? predictionForCode(code, ORDINAL_BASE_PREDICTION, ORDINAL_PREDICTION_STEP)
      : null;

    return {
      ...level,
      code,
      prediction,
    };
  });
}

function renderBarChart(rows, emptyLabel) {
  const numericRows = rows.filter(row => typeof row.prediction === 'number');
  if (!numericRows.length) {
    return `
      <div class="w4-label-bars w4-label-bars--empty">
        <p class="w4-label-bars__empty">${escapeHtml(emptyLabel)}</p>
      </div>
    `;
  }

  const min = Math.min(...numericRows.map(row => row.prediction));
  const max = Math.max(...numericRows.map(row => row.prediction));
  const span = Math.max(1, max - min);

  return `
    <div class="w4-label-bars" role="img" aria-label="Bar chart showing model predictions for each encoded category.">
      ${rows.map(row => {
        const height = row.prediction == null
          ? 18
          : 24 + (((row.prediction - min) / span) * 76);
        const tone = row.prediction == null ? 'empty' : 'filled';

        return `
          <article class="w4-label-bar" data-bar-state="${tone}">
            <span class="w4-label-bar__value">${row.prediction == null ? '--' : escapeHtml(formatMoney(row.prediction))}</span>
            <div class="w4-label-bar__track">
              <div class="w4-label-bar__fill" style="height:${height}%;"></div>
            </div>
            <span class="w4-label-bar__label">${escapeHtml(row.label)}</span>
            <span class="w4-label-bar__meta">${row.code == null ? 'code --' : `code ${row.code}`}</span>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function nominalLevelForZone(zoneId) {
  return NOMINAL_LEVELS.find(level => nominalZoneId(level.id) === zoneId) ?? null;
}

function ordinalLevelForZone(zoneId) {
  return ORDINAL_LEVELS.find(level => ordinalZoneId(level.id) === zoneId) ?? null;
}

export default class World4Level2 {
  meta = {
    title: LEVEL_TITLE,
    subtitle: LEVEL_OBJECTIVE,
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._events = null;
    this._nominalDragDrop = null;
    this._ordinalDragDrop = null;
    this._awardedStepIds = new Set();
    this._dangerVisible = false;
    this._completed = false;
    this._lastMachineEvent = null;
    this._machineTimer = null;
    this._ui = {};
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w4-level w4-level--label-danger screen-section" aria-label="World 4 Level 2">
        <div class="level-hero w4-level__hero" style="--world-color: var(--color-world-4);">
          <p class="eyebrow">World 4 - Encoding</p>
          <h1 class="level-hero__title">${escapeHtml(LEVEL_TITLE)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(LEVEL_OBJECTIVE)}
            First let the encoder stamp arbitrary integers onto categories. Then inspect what a linear model secretly assumes from those numbers, and finish with a case where the ordering is actually valid.
          </p>
          <div class="action-row">
            <span class="status-box" id="w4-l2-progress">0 / ${STEP_META.length} encoding locks</span>
            <span class="status-box" id="w4-l2-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w4-l2-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w4-l2-reset-btn" type="button">Reset Lesson</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">02</span>
        </div>

        <div class="w4-label-grid">
          <article class="panel w4-label-stage">
            <div class="w4-level__panel-head">
              <div>
                <p class="eyebrow">Label Encoder</p>
                <h2 class="panel-title">Stamp numbers onto categories first, then inspect what the model learns from them</h2>
              </div>
              <p class="w4-level__microcopy">
                Part 1 is deliberately permissive. The opening drag step only teaches the mechanism. The real lesson starts when a model treats those labels like numeric structure.
              </p>
            </div>

            <div class="w4-label-nominal-lab" id="w4-l2-nominal-lab">
              <section class="w4-label-token-bank" id="w4-l2-nominal-bank" aria-label="Nominal encoding tokens">
                ${NOMINAL_TOKENS.map(value => `
                  <button
                    class="drag-token w4-label-token w4-label-token--nominal"
                    type="button"
                    data-dd-id="${nominalTokenId(value)}"
                    aria-label="Assign code ${value}"
                  >
                    <span class="w4-label-token__value">${value}</span>
                    <span class="w4-label-token__copy">code chip</span>
                  </button>
                `).join('')}
              </section>

              <div class="w4-label-board">
              <section class="w4-label-column w4-label-column--source" aria-label="Original categories">
                <div class="w4-label-column__head">
                  <p class="eyebrow">Original Column</p>
                  <h3 class="w4-label-column__title">Education_Level</h3>
                </div>

                <div class="w4-label-rows">
                  ${NOMINAL_LEVELS.map(level => `
                    <article class="w4-label-row">
                      <div class="w4-label-row__copy">
                        <h4 class="w4-label-row__label">${escapeHtml(level.label)}</h4>
                        <p class="w4-label-row__note">${escapeHtml(level.note)}</p>
                      </div>
                      <div class="drop-zone w4-label-drop" data-dd-zone="${nominalZoneId(level.id)}">
                        <span class="w4-label-drop__prompt">Drop 0-3</span>
                      </div>
                    </article>
                  `).join('')}
                </div>
              </section>

              <section class="w4-label-machine-shell" aria-label="Encoder machine">
                <div class="w4-label-machine" id="w4-l2-machine" data-machine-state="idle">
                  <div class="w4-label-machine__input">
                    <span class="w4-label-machine__eyebrow">Input label</span>
                    <strong id="w4-l2-machine-label">Awaiting chip</strong>
                  </div>
                  <div class="w4-label-machine__core">
                    <div class="w4-label-machine__belt" aria-hidden="true"></div>
                    <div class="w4-label-machine__screen">
                      <span class="w4-label-machine__screen-copy">Encoder output</span>
                      <span class="w4-label-machine__screen-value" id="w4-l2-machine-code">--</span>
                    </div>
                  </div>
                  <div class="w4-label-machine__output">
                    <span class="w4-label-machine__eyebrow">Machine status</span>
                    <strong id="w4-l2-machine-status">Drag a code chip onto any category row.</strong>
                  </div>
                </div>
                <p class="w4-label-machine__note">
                  A label encoder only replaces category text with integers. It does not know whether those integers should carry order or distance.
                </p>
              </section>

              <section class="w4-label-column w4-label-column--encoded" aria-label="Encoded output">
                <div class="w4-label-column__head">
                  <p class="eyebrow">Encoded Column</p>
                  <h3 class="w4-label-column__title">Education_Level_code</h3>
                </div>

                <div class="w4-label-rows">
                  ${NOMINAL_LEVELS.map(level => `
                    <article class="w4-label-output-row">
                      <span class="w4-label-output-row__label">${escapeHtml(level.label)}</span>
                      <span class="w4-label-output-pill" data-nominal-output="${level.id}" data-code-state="empty">--</span>
                    </article>
                  `).join('')}
                </div>
              </section>
              </div>
            </div>

            <section class="card w4-label-danger" id="w4-l2-danger" hidden aria-label="Hidden danger demo">
              <div class="w4-level__panel-head">
                <div>
                  <p class="eyebrow">Danger Demo</p>
                  <h2 class="panel-title">A linear model will now treat your label map like numeric truth</h2>
                </div>
                <p class="w4-level__microcopy">
                  The bar chart uses a simple linear rule: prediction = base + step * encoded value. The model never sees the original category words.
                </p>
              </div>

              <div class="action-row">
                <span class="status-box" id="w4-l2-danger-order">Waiting for encoded order</span>
                <button class="btn btn--primary" id="w4-l2-danger-btn" type="button">Show Model Assumption</button>
              </div>

              <div class="w4-label-warning" id="w4-l2-danger-visual" hidden>
                <article class="w4-label-warning__card" data-tone="warning">
                  <p class="w4-label-warning__kicker">Warning Card</p>
                  <h3 class="w4-label-warning__title" id="w4-l2-danger-headline">The model assumes your numbers carry structure.</h3>
                  <p class="w4-label-warning__copy" id="w4-l2-danger-copy"></p>
                </article>

                <div class="w4-label-slider-stack">
                  <label class="w4-label-slider-row">
                    <span class="w4-label-slider-row__meta" id="w4-l2-bac-meta">Bac = --</span>
                    <input class="w4-label-slider" id="w4-l2-bac-slider" type="range" min="0" max="3" value="0" disabled>
                    <span class="w4-label-slider-row__value" id="w4-l2-bac-prediction">--</span>
                  </label>
                  <label class="w4-label-slider-row">
                    <span class="w4-label-slider-row__meta" id="w4-l2-doctorat-meta">Doctorat = --</span>
                    <input class="w4-label-slider" id="w4-l2-doctorat-slider" type="range" min="0" max="3" value="0" disabled>
                    <span class="w4-label-slider-row__value" id="w4-l2-doctorat-prediction">--</span>
                  </label>
                </div>

                <div class="w4-label-chart-shell" id="w4-l2-danger-chart"></div>
              </div>
            </section>

            <section class="panel w4-label-ordinal" id="w4-l2-ordinal" hidden aria-label="Ordinal encoding redo">
              <div class="w4-level__panel-head">
                <div>
                  <p class="eyebrow">When It Works</p>
                  <h2 class="panel-title">Now try the same mechanic on a truly ordered scale</h2>
                </div>
                <p class="w4-level__microcopy">
                  Low, Medium, and High already carry a rank. Here the job is to encode that order honestly instead of inventing one.
                </p>
              </div>

              <div class="w4-label-ordinal__layout" id="w4-l2-ordinal-lab">
                <div class="w4-label-ordinal__bank" aria-label="Ordinal encoding tokens">
                  ${ORDINAL_TOKENS.map(value => `
                    <button
                      class="drag-token w4-label-token w4-label-token--ordinal"
                      type="button"
                      data-dd-id="${ordinalTokenId(value)}"
                      aria-label="Assign ordinal code ${value}"
                    >
                      <span class="w4-label-token__value">${value}</span>
                      <span class="w4-label-token__copy">ordered code</span>
                    </button>
                  `).join('')}
                </div>

                <div class="w4-label-ordinal__workspace">
                  <div class="w4-label-ordinal__rows">
                    ${ORDINAL_LEVELS.map(level => `
                      <article class="w4-label-row w4-label-row--ordinal">
                        <div class="w4-label-row__copy">
                          <h4 class="w4-label-row__label">${escapeHtml(level.label)}</h4>
                          <p class="w4-label-row__note">${escapeHtml(level.note)}</p>
                        </div>
                        <div class="drop-zone w4-label-ordinal-drop" data-dd-zone="${ordinalZoneId(level.id)}">
                          <span class="w4-label-drop__prompt">Drop 0-2</span>
                        </div>
                        <span class="w4-label-output-pill" data-ordinal-output="${level.id}" data-code-state="empty">--</span>
                      </article>
                    `).join('')}
                  </div>

                  <article class="card w4-label-ordinal-preview">
                    <p class="w4-label-warning__kicker">Ordinal Preview</p>
                    <h3 class="w4-label-warning__title">This time the encoded direction can be trusted</h3>
                    <p class="w4-label-warning__copy" id="w4-l2-ordinal-copy">
                      Map Low, Medium, and High into an honest numeric rise. A model can only use the ranking well if the order itself is real.
                    </p>
                    <div class="w4-label-chart-shell" id="w4-l2-ordinal-chart"></div>
                  </article>
                </div>
              </div>
            </section>
          </article>

          <div class="w4-label-side">
            <section class="panel w4-label-tracker" aria-label="Encoding Tracker">
              <div class="w4-level__panel-head">
                <div>
                  <p class="eyebrow">Encoding Tracker</p>
                  <h2 class="panel-title">Mechanic first, risk second, safe use last</h2>
                </div>
                <p class="w4-level__microcopy">
                  The first lock only proves that the encoder can stamp integers onto text. The next two locks decide whether that numeric structure is trustworthy.
                </p>
              </div>

              <div class="w4-label-tracker__list">
                ${STEP_META.map((step, index) => `
                  <article class="w4-label-card" data-step-id="${step.id}" data-step-state="${index === 0 ? 'active' : 'pending'}">
                    <div class="w4-label-card__meta">
                      <span class="w4-label-card__status" data-step-status="${step.id}">${index === 0 ? 'Active' : 'Pending'}</span>
                      <span class="w4-label-card__index">Step ${index + 1}</span>
                    </div>
                    <h3 class="w4-label-card__title">${escapeHtml(step.label)}</h3>
                    <p class="w4-label-card__chapter">${escapeHtml(step.chapter)}</p>
                    <p class="w4-label-card__copy">${escapeHtml(step.recap)}</p>
                  </article>
                `).join('')}
              </div>
            </section>

            <section class="card card--elevated w4-level__feedback" aria-live="polite">
              <p class="eyebrow">Coach Feed</p>
              <p id="w4-l2-feedback-text" class="w4-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
            </section>

            <section class="card w4-level__hint-box" id="w4-l2-hint-box" hidden>
              <p class="eyebrow">Hint</p>
              <p id="w4-l2-hint-text" class="w4-level__hint-copy"></p>
            </section>

            <section class="card w4-label-guide">
              <p class="eyebrow">Reading Guide</p>
              <div class="w4-label-guide__steps">
                <article class="w4-label-guide__step">
                  <span class="w4-label-guide__badge">1</span>
                  <p>Label encoding only replaces category text with integers. It does not certify that those integers should behave like meaningful numeric distance.</p>
                </article>
                <article class="w4-label-guide__step">
                  <span class="w4-label-guide__badge">2</span>
                  <p>Linear models read encoded values as ordered magnitudes. They do not know whether your numbering came from real rank or arbitrary bookkeeping.</p>
                </article>
                <article class="w4-label-guide__step">
                  <span class="w4-label-guide__badge">3</span>
                  <p>When the category order is genuine, label encoding can preserve that ranking compactly. When it is not, safer encodings are needed.</p>
                </article>
              </div>
            </section>
          </div>
        </div>

        <section class="panel w4-label-summary" id="w4-l2-summary" hidden aria-label="Encoding Summary">
          <div class="w4-level__panel-head">
            <div>
              <p class="eyebrow">Encoding Recap</p>
              <h2 class="panel-title">Compact codes are only safe when the order is meaningful</h2>
            </div>
            <p class="w4-level__microcopy">${escapeHtml(SUMMARY_COPY)}</p>
          </div>

          <div class="action-row">
            <span class="status-box" id="w4-l2-summary-score">Waiting for ordinal proof</span>
            <button class="btn btn--primary" id="w4-l2-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w4-l2-progress');
    this._ui.status = container.querySelector('#w4-l2-status');
    this._ui.feedback = container.querySelector('#w4-l2-feedback-text');
    this._ui.hintBox = container.querySelector('#w4-l2-hint-box');
    this._ui.hintText = container.querySelector('#w4-l2-hint-text');
    this._ui.nominalLab = container.querySelector('#w4-l2-nominal-lab');
    this._ui.ordinalLab = container.querySelector('#w4-l2-ordinal-lab');
    this._ui.machine = container.querySelector('#w4-l2-machine');
    this._ui.machineLabel = container.querySelector('#w4-l2-machine-label');
    this._ui.machineCode = container.querySelector('#w4-l2-machine-code');
    this._ui.machineStatus = container.querySelector('#w4-l2-machine-status');
    this._ui.nominalOutputs = NOMINAL_LEVELS.map(level => container.querySelector(`[data-nominal-output="${level.id}"]`));
    this._ui.ordinalOutputs = ORDINAL_LEVELS.map(level => container.querySelector(`[data-ordinal-output="${level.id}"]`));
    this._ui.danger = container.querySelector('#w4-l2-danger');
    this._ui.dangerOrder = container.querySelector('#w4-l2-danger-order');
    this._ui.dangerButton = container.querySelector('#w4-l2-danger-btn');
    this._ui.dangerVisual = container.querySelector('#w4-l2-danger-visual');
    this._ui.dangerHeadline = container.querySelector('#w4-l2-danger-headline');
    this._ui.dangerCopy = container.querySelector('#w4-l2-danger-copy');
    this._ui.bacMeta = container.querySelector('#w4-l2-bac-meta');
    this._ui.bacSlider = container.querySelector('#w4-l2-bac-slider');
    this._ui.bacPrediction = container.querySelector('#w4-l2-bac-prediction');
    this._ui.doctoratMeta = container.querySelector('#w4-l2-doctorat-meta');
    this._ui.doctoratSlider = container.querySelector('#w4-l2-doctorat-slider');
    this._ui.doctoratPrediction = container.querySelector('#w4-l2-doctorat-prediction');
    this._ui.dangerChart = container.querySelector('#w4-l2-danger-chart');
    this._ui.ordinalPanel = container.querySelector('#w4-l2-ordinal');
    this._ui.ordinalCopy = container.querySelector('#w4-l2-ordinal-copy');
    this._ui.ordinalChart = container.querySelector('#w4-l2-ordinal-chart');
    this._ui.summary = container.querySelector('#w4-l2-summary');
    this._ui.summaryScore = container.querySelector('#w4-l2-summary-score');
    this._ui.finishButton = container.querySelector('#w4-l2-finish-btn');
    this._ui.trackerCards = Array.from(container.querySelectorAll('[data-step-id]'));

    this._syncNominalBoard();
    this._syncDangerDemo();
    this._syncOrdinalBoard();
    this._syncTracker();
    this._syncSummary();
    this._syncProgress();
  }

  start() {
    this._nominalDragDrop = createDragDrop({
      container: this._ui.nominalLab,
      draggableSelector: '.w4-label-token--nominal',
      zoneSelector: '.w4-label-drop',
      allowReorder: true,
      snapBack: false,
      lockOnCorrect: false,
      clickToPlace: true,
      gradeOnDrop: false,
      onDrop: (tokenId, zoneId) => {
        const level = nominalLevelForZone(zoneId);
        const value = parseTokenValue(tokenId);

        if (level && Number.isInteger(value)) {
          this._pulseMachine(level.label, value);
          this._setFeedback(`${level.label} is now encoded as ${value}. The encoder is happy because it only sees labels turning into integers.`);
          this._setStatus('Keep assigning chips until all four categories have numeric labels.');
        }

        this._syncNominalBoard();
        this._checkNominalCompletion();
      },
    });

    this._ordinalDragDrop = createDragDrop({
      container: this._ui.ordinalLab,
      draggableSelector: '.w4-label-token--ordinal',
      zoneSelector: '.w4-label-ordinal-drop',
      correctAnswers: ORDINAL_ANSWER_KEY,
      snapBack: true,
      lockOnCorrect: true,
      clickToPlace: true,
      onDrop: () => {
        this._syncOrdinalBoard();
      },
      onCorrect: (tokenId, zoneId) => {
        const level = ordinalLevelForZone(zoneId);
        const value = parseTokenValue(tokenId);

        if (level && Number.isInteger(value) && !this._completed) {
          this._setFeedback(`${level.label} now holds code ${value}. Keep the ordinal ladder rising from Low to High.`);
          this._setStatus('Ordinal redo in progress. Lock all three ranks into 0 < 1 < 2.');
        }

        this._syncOrdinalBoard();
      },
      onIncorrect: (tokenId, zoneId) => {
        const level = ordinalLevelForZone(zoneId);
        const value = parseTokenValue(tokenId);
        this._setFeedback(`${value} does not belong on ${level?.label ?? 'that row'}. In this safe case, the numbers must climb with the true rank.`);
        this._setStatus('Wrong ordinal placement. Try again with Low -> 0, Medium -> 1, High -> 2.');
        this._syncOrdinalBoard();
        this._engine.mistake({ costsLife: false, countsMistake: true });
      },
      onComplete: () => {
        this._syncOrdinalBoard();
        this._checkOrdinalCompletion();
      },
    });

    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w4-l2-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w4-l2-reset-btn')) {
        this._resetLevel();
        return;
      }

      if (event.target.closest('#w4-l2-danger-btn')) {
        this._revealDanger();
        return;
      }

      if (event.target.closest('#w4-l2-finish-btn')) {
        if (this._completed) {
          if (typeof this._engine.complete === 'function') {
            void this._engine.complete();
          }
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
    this._nominalDragDrop?.destroy();
    this._ordinalDragDrop?.destroy();
    this._nominalDragDrop = null;
    this._ordinalDragDrop = null;
    clearTimeout(this._machineTimer);
    this._ui = {};
  }

  _currentNominalPlacements() {
    return this._nominalDragDrop?.getPlacements() ?? {};
  }

  _currentOrdinalPlacements() {
    return this._ordinalDragDrop?.getPlacements() ?? {};
  }

  _currentNominalMapping() {
    return collectNominalMapping(this._currentNominalPlacements());
  }

  _currentOrdinalMapping() {
    return collectOrdinalMapping(this._currentOrdinalPlacements());
  }

  _checkNominalCompletion() {
    const mapping = this._currentNominalMapping();
    if (!nominalMappingComplete(mapping) || this._awardedStepIds.has('nominal-map')) {
      return;
    }

    this._lockNominalTokens(true);
    this._awardStep('nominal-map');
    this._revealSection(this._ui.danger);
    this._syncDangerDemo();
    this._setFeedback('All four categories are encoded. The mechanics worked perfectly, which is why the next question matters: what will the model assume from those numbers?');
    this._setStatus('Part 1 complete. Open the danger demo and inspect the numeric structure your label map just created.');
  }

  _revealDanger() {
    if (!this._awardedStepIds.has('nominal-map') || this._dangerVisible) return;

    this._dangerVisible = true;
    if (this._ui.dangerVisual) {
      this._ui.dangerVisual.hidden = false;
    }

    if (!this._awardedStepIds.has('danger-seen')) {
      this._awardStep('danger-seen');
      this._revealSection(this._ui.ordinalPanel);
      this._setFeedback('The warning is live. A linear model is now reading your codes as ordered magnitudes, not as harmless labels.');
      this._setStatus('Part 2 complete. Rebuild the second scenario with a real ordinal order to show when label encoding can be defensible.');
    }

    this._syncDangerDemo();
  }

  _checkOrdinalCompletion() {
    if (this._awardedStepIds.has('ordinal-proof')) return;

    this._awardStep('ordinal-proof');
    this._completed = true;
    this._revealSection(this._ui.summary);
    this._syncSummary();
    this._setFeedback('Safe case locked. Low, Medium, and High carry a real rank, so the 0 < 1 < 2 mapping now preserves meaningful order instead of inventing one.');
    this._setStatus('Encoding lesson complete. Continue to the frequency-based encoding chapter next.');
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
    this._nominalDragDrop?.reset();
    this._ordinalDragDrop?.reset();

    this._awardedStepIds.clear();
    this._dangerVisible = false;
    this._completed = false;
    this._lastMachineEvent = null;
    clearTimeout(this._machineTimer);

    this._lockNominalTokens(false);

    if (this._ui.danger) {
      this._ui.danger.hidden = true;
      this._ui.danger.classList.remove('is-revealed');
    }

    if (this._ui.dangerVisual) {
      this._ui.dangerVisual.hidden = true;
    }

    if (this._ui.ordinalPanel) {
      this._ui.ordinalPanel.hidden = true;
      this._ui.ordinalPanel.classList.remove('is-revealed');
    }

    if (this._ui.summary) {
      this._ui.summary.hidden = true;
      this._ui.summary.classList.remove('is-revealed');
    }

    this._syncNominalBoard();
    this._syncDangerDemo();
    this._syncOrdinalBoard();
    this._syncTracker();
    this._syncSummary();
    this._syncProgress();
    this._setFeedback(DEFAULT_FEEDBACK);
    this._setStatus(DEFAULT_STATUS);
  }

  _lockNominalTokens(locked) {
    const tokens = this._container?.querySelectorAll('.w4-label-token--nominal') ?? [];
    tokens.forEach(token => {
      token.style.pointerEvents = locked ? 'none' : '';
    });
  }

  _revealSection(section) {
    if (!section) return;

    section.hidden = false;
    requestAnimationFrame(() => section.classList.add('is-revealed'));
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  _pulseMachine(label, code) {
    this._lastMachineEvent = { label, code };

    if (this._ui.machineLabel) {
      this._ui.machineLabel.textContent = label;
    }
    if (this._ui.machineCode) {
      this._ui.machineCode.textContent = String(code);
    }
    if (this._ui.machineStatus) {
      this._ui.machineStatus.textContent = `${label} fell through the encoder and exited as code ${code}.`;
    }
    if (this._ui.machine) {
      this._ui.machine.dataset.machineState = 'processing';
    }

    clearTimeout(this._machineTimer);
    this._machineTimer = setTimeout(() => {
      if (this._ui.machine) {
        this._ui.machine.dataset.machineState = 'idle';
      }
    }, 560);
  }

  _syncNominalBoard() {
    const mapping = this._currentNominalMapping();

    NOMINAL_LEVELS.forEach((level, index) => {
      const output = this._ui.nominalOutputs[index];
      const code = mapping[level.id];

      if (output) {
        output.textContent = Number.isInteger(code) ? String(code) : '--';
        output.dataset.codeState = Number.isInteger(code) ? 'filled' : 'empty';
      }
    });

    if (!this._lastMachineEvent) {
      if (this._ui.machineLabel) {
        this._ui.machineLabel.textContent = 'Awaiting chip';
      }
      if (this._ui.machineCode) {
        this._ui.machineCode.textContent = '--';
      }
      if (this._ui.machineStatus) {
        this._ui.machineStatus.textContent = 'Drag a code chip onto any category row.';
      }
      if (this._ui.machine) {
        this._ui.machine.dataset.machineState = 'idle';
      }
    }

    const profile = nominalRiskProfile(mapping);
    if (this._ui.dangerOrder) {
      this._ui.dangerOrder.textContent = nominalMappingComplete(mapping)
        ? `Numeric order learned: ${profile.orderedLabel}`
        : `${filledCount(this._currentNominalPlacements())} / ${NOMINAL_LEVELS.length} categories encoded`;
    }
  }

  _syncDangerDemo() {
    const mapping = this._currentNominalMapping();
    const profile = nominalRiskProfile(mapping);

    if (this._ui.dangerButton) {
      this._ui.dangerButton.disabled = !this._awardedStepIds.has('nominal-map') || this._dangerVisible;
    }

    if (this._ui.dangerHeadline) {
      this._ui.dangerHeadline.textContent = profile.headline;
    }

    if (this._ui.dangerCopy) {
      this._ui.dangerCopy.textContent = profile.copy;
    }

    const bacCode = mapping.bac;
    const doctoratCode = mapping.doctorat;
    const bacPrediction = Number.isInteger(bacCode)
      ? predictionForCode(bacCode, NOMINAL_BASE_PREDICTION, NOMINAL_PREDICTION_STEP)
      : null;
    const doctoratPrediction = Number.isInteger(doctoratCode)
      ? predictionForCode(doctoratCode, NOMINAL_BASE_PREDICTION, NOMINAL_PREDICTION_STEP)
      : null;

    if (this._ui.bacMeta) {
      this._ui.bacMeta.textContent = `Bac = ${Number.isInteger(bacCode) ? bacCode : '--'}`;
    }
    if (this._ui.bacSlider) {
      this._ui.bacSlider.value = String(Number.isInteger(bacCode) ? bacCode : 0);
    }
    if (this._ui.bacPrediction) {
      this._ui.bacPrediction.textContent = bacPrediction == null ? '--' : formatMoney(bacPrediction);
    }

    if (this._ui.doctoratMeta) {
      this._ui.doctoratMeta.textContent = `Doctorat = ${Number.isInteger(doctoratCode) ? doctoratCode : '--'}`;
    }
    if (this._ui.doctoratSlider) {
      this._ui.doctoratSlider.value = String(Number.isInteger(doctoratCode) ? doctoratCode : 0);
    }
    if (this._ui.doctoratPrediction) {
      this._ui.doctoratPrediction.textContent = doctoratPrediction == null ? '--' : formatMoney(doctoratPrediction);
    }

    if (this._ui.dangerChart) {
      this._ui.dangerChart.innerHTML = renderBarChart(
        nominalChartRows(mapping),
        'The prediction bars appear after the full label map is in place.'
      );
    }
  }

  _syncOrdinalBoard() {
    const mapping = this._currentOrdinalMapping();
    const placed = filledCount(this._currentOrdinalPlacements());

    ORDINAL_LEVELS.forEach((level, index) => {
      const output = this._ui.ordinalOutputs[index];
      const code = mapping[level.id];

      if (output) {
        output.textContent = Number.isInteger(code) ? String(code) : '--';
        output.dataset.codeState = Number.isInteger(code) ? 'filled' : 'empty';
      }
    });

    if (this._ui.ordinalCopy) {
      this._ui.ordinalCopy.textContent = this._completed
        ? 'Low, Medium, and High now rise in a real order. The model can read the ranking without inventing a nonsense ladder.'
        : placed === 0
          ? 'Map Low, Medium, and High into an honest numeric rise. A model can only use the ranking well if the order itself is real.'
          : `${placed} / ${ORDINAL_LEVELS.length} ordinal slots locked. Keep the codes increasing with the true rank.`;
    }

    if (this._ui.ordinalChart) {
      this._ui.ordinalChart.innerHTML = renderBarChart(
        ordinalChartRows(mapping),
        'Once the ranked categories are encoded, the preview will rise cleanly from Low to High.'
      );
    }
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
        stepId === 'nominal-map' ||
        (stepId === 'danger-seen' && this._awardedStepIds.has('nominal-map')) ||
        (stepId === 'ordinal-proof' && this._awardedStepIds.has('danger-seen'))
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
    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = this._completed
        ? `${STEP_META.length} / ${STEP_META.length} encoding locks`
        : 'Waiting for ordinal proof';
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
