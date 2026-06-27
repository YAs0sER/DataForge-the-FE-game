'use strict';

import { getLevelProblem } from '../../data/problems.js';
import { ChartWidget } from '../../widgets/charts.js';

const PROBLEM = getLevelProblem(4, 3);
const LEVEL_TITLE = PROBLEM?.title ?? 'Frequency Encoding';
const LEVEL_OBJECTIVE = PROBLEM?.objective ?? 'Count category frequencies and encode each row with ni / N.';

const SOURCE_ROWS = Object.freeze([
  Object.freeze({ id: 1, City: 'Casa' }),
  Object.freeze({ id: 2, City: 'Rabat' }),
  Object.freeze({ id: 3, City: 'Casa' }),
  Object.freeze({ id: 4, City: 'Fes' }),
  Object.freeze({ id: 5, City: 'Casa' }),
  Object.freeze({ id: 6, City: 'Agadir' }),
  Object.freeze({ id: 7, City: 'Rabat' }),
  Object.freeze({ id: 8, City: 'Casa' }),
  Object.freeze({ id: 9, City: 'Fes' }),
  Object.freeze({ id: 10, City: 'Casa' }),
]);

const CITY_ORDER = Object.freeze(['Casa', 'Rabat', 'Fes', 'Agadir']);
const TOTAL_ROWS = SOURCE_ROWS.length;
const CITY_COUNTS = Object.freeze(
  CITY_ORDER.reduce((acc, city) => {
    acc[city] = SOURCE_ROWS.filter(row => row.City === city).length;
    return acc;
  }, {})
);
const CITY_FREQUENCIES = Object.freeze(
  Object.fromEntries(CITY_ORDER.map(city => [city, CITY_COUNTS[city] / TOTAL_ROWS]))
);
const COLLISION_CITIES = Object.freeze(['Rabat', 'Fes']);
const COLLISION_VALUE = CITY_FREQUENCIES.Rabat;

const FREQUENCY_OPTIONS = Object.freeze(
  CITY_ORDER
    .map(city => ({
      city,
      value: formatFrequency(CITY_FREQUENCIES[city]),
      count: CITY_COUNTS[city],
    }))
    .filter((option, index, options) => options.findIndex(entry => entry.value === option.value) === index)
    .sort((left, right) => Number(right.value) - Number(left.value))
    .map(option => Object.freeze(option))
);

const EXPECTED_VALUES = Object.freeze(
  SOURCE_ROWS.map(row => formatFrequency(CITY_FREQUENCIES[row.City]))
);

const STEP_META = Object.freeze([
  Object.freeze({
    id: 'count-complete',
    label: 'Count every city row by row',
    chapter: 'Frequency Build',
    recap: 'Frequency encoding starts with raw occurrence counts before any numeric replacement is possible.',
  }),
  Object.freeze({
    id: 'encoding-complete',
    label: 'Fill the encoded column with ni / N',
    chapter: 'Apply Formula',
    recap: 'Every row inherits the frequency of its category, so repeated cities receive the same numeric value.',
  }),
  Object.freeze({
    id: 'collision-seen',
    label: 'Inspect the shared-code trade-off',
    chapter: 'Risk',
    recap: 'When two categories have the same frequency, frequency encoding collapses them onto the same number.',
  }),
]);

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM?.hints ?? []),
  'Count first. Casa appears half of the time in this sample, so its encoded value will become 0.5.',
  'Frequency encoding uses ni / N. Rabat and Fes each appear 2 times out of 10, so both rows should receive 0.2.',
  'The trade-off arrives when two different cities land on the same frequency. The model only sees the number, not the original label.',
]);

const DEFAULT_FEEDBACK = 'Start with the count button in the middle. Each click processes one source row and grows the tally for that city.';
const DEFAULT_STATUS = 'Part 1 is live. Count the city column row by row until the full frequency table unlocks.';
const SUMMARY_COPY = 'Frequency encoding is compact and useful for high-cardinality columns, but equal frequencies can hide the difference between distinct categories.';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatFrequency(value) {
  return Number(value).toFixed(1);
}

function pluralize(value, singular, plural = `${singular}s`) {
  return value === 1 ? singular : plural;
}

function renderTally(count) {
  return Array.from({ length: count }, () => '<span class="w4-frequency-tally__mark" aria-hidden="true"></span>').join('');
}

function chartData(highlightCollision = false) {
  return CITY_ORDER.map(city => {
    const isCollision = COLLISION_CITIES.includes(city);
    const color = highlightCollision && isCollision
      ? 'rgba(245, 166, 35, 0.94)'
      : city === 'Casa'
        ? 'rgba(201, 168, 76, 0.94)'
        : city === 'Agadir'
          ? 'rgba(255, 255, 255, 0.52)'
          : 'rgba(231, 199, 115, 0.82)';

    return {
      label: city,
      value: CITY_FREQUENCIES[city],
      count: CITY_COUNTS[city],
      color,
      shared: highlightCollision && isCollision,
    };
  });
}

export default class World4Level3 {
  meta = {
    title: LEVEL_TITLE,
    subtitle: LEVEL_OBJECTIVE,
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._events = null;
    this._chart = null;
    this._countedRows = 0;
    this._counts = Object.fromEntries(CITY_ORDER.map(city => [city, 0]));
    this._selectedValues = Array.from({ length: TOTAL_ROWS }, () => '');
    this._rowStates = Array.from({ length: TOTAL_ROWS }, () => 'pending');
    this._awardedStepIds = new Set();
    this._collisionShown = false;
    this._completed = false;
    this._ui = {};
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w4-level w4-level--frequency screen-section" aria-label="World 4 Level 3">
        <div class="level-hero w4-level__hero" style="--world-color: var(--color-world-4);">
          <p class="eyebrow">World 4 - Encoding</p>
          <h1 class="level-hero__title">${escapeHtml(LEVEL_TITLE)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(LEVEL_OBJECTIVE)}
            Count the cities row by row, convert each category into its observed frequency, then inspect what the method loses when two different cities share the same rate.
          </p>
          <div class="action-row">
            <span class="status-box" id="w4-l3-progress">0 / ${STEP_META.length} encoding locks</span>
            <span class="status-box" id="w4-l3-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w4-l3-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w4-l3-reset-btn" type="button">Reset Lab</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">03</span>
        </div>

        <div class="w4-frequency-grid">
          <article class="panel w4-frequency-stage">
            <div class="w4-level__panel-head">
              <div>
                <p class="eyebrow">Frequency Lab</p>
                <h2 class="panel-title">Count first, encode second, then inspect what shared frequencies hide</h2>
              </div>
              <p class="w4-level__microcopy">
                Frequency encoding compresses a whole category column into one numeric signal. The upside is compactness. The downside is that different labels can collapse onto the same value.
              </p>
            </div>

            <div class="w4-frequency-board">
              <section class="w4-frequency-panel w4-frequency-panel--source" aria-label="Original city column">
                <div class="w4-frequency-panel__head">
                  <p class="eyebrow">Original Column</p>
                  <h3 class="w4-frequency-panel__title">Ville</h3>
                </div>

                <div class="w4-frequency-rows">
                  ${SOURCE_ROWS.map((row, index) => `
                    <article class="w4-frequency-row" data-source-row="${index}" data-row-state="${index === 0 ? 'current' : 'pending'}">
                      <span class="w4-frequency-row__index">Row ${index + 1}</span>
                      <span class="w4-frequency-row__city">${escapeHtml(row.City)}</span>
                      <span class="w4-frequency-row__status" data-source-pill="${index}">${index === 0 ? 'Current' : 'Pending'}</span>
                    </article>
                  `).join('')}
                </div>
              </section>

              <section class="w4-frequency-panel w4-frequency-panel--counter" aria-label="Frequency counter">
                <div class="w4-frequency-panel__head">
                  <p class="eyebrow">Counter Widget</p>
                  <h3 class="w4-frequency-panel__title">Count the column one row at a time</h3>
                </div>

                <div class="w4-frequency-counter__cards">
                  ${CITY_ORDER.map(city => `
                    <article class="w4-frequency-counter__card" data-counter-city="${city}" data-counter-state="idle">
                      <div class="w4-frequency-counter__meta">
                        <span class="w4-frequency-counter__city">${escapeHtml(city)}</span>
                        <span class="w4-frequency-counter__count" data-counter-count="${city}">0</span>
                      </div>
                      <div class="w4-frequency-tally" data-counter-tally="${city}" aria-label="${escapeHtml(city)} tally"></div>
                    </article>
                  `).join('')}
                </div>

                <div class="w4-frequency-counter__controls">
                  <span class="status-box" id="w4-l3-count-status">0 / ${TOTAL_ROWS} rows counted</span>
                  <button class="btn btn--primary" id="w4-l3-count-btn" type="button">Count Row 1</button>
                </div>

                <section class="w4-frequency-table" id="w4-l3-frequency-table" hidden aria-label="Computed frequency table">
                  <div class="w4-frequency-panel__head">
                    <p class="eyebrow">Computed Table</p>
                    <h3 class="w4-frequency-panel__title">Counts and normalized frequencies</h3>
                  </div>

                  <table class="w4-frequency-table__grid">
                    <thead>
                      <tr>
                        <th scope="col">City</th>
                        <th scope="col">n_i</th>
                        <th scope="col">n_i / N</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${CITY_ORDER.map(city => `
                        <tr data-frequency-city="${city}">
                          <th scope="row">${escapeHtml(city)}</th>
                          <td>${CITY_COUNTS[city]}</td>
                          <td>${escapeHtml(formatFrequency(CITY_FREQUENCIES[city]))}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </section>
              </section>

              <section class="w4-frequency-panel w4-frequency-panel--encoded" aria-label="Encoded output column">
                <div class="w4-frequency-panel__head">
                  <p class="eyebrow">Encoded Column</p>
                  <h3 class="w4-frequency-panel__title">Fill each row with the frequency of its city</h3>
                </div>

                <div class="w4-frequency-encoded">
                  ${SOURCE_ROWS.map((row, index) => `
                    <article class="w4-frequency-encoded__row" data-encoded-row="${index}" data-row-state="pending">
                      <div class="w4-frequency-encoded__meta">
                        <span class="w4-frequency-encoded__index">Row ${index + 1}</span>
                        <span class="w4-frequency-encoded__city">${escapeHtml(row.City)}</span>
                      </div>
                      <label class="sr-only" for="w4-l3-select-${index}">Frequency for ${escapeHtml(row.City)} row ${index + 1}</label>
                      <select class="w4-frequency-select" id="w4-l3-select-${index}" data-encoded-select="${index}" disabled>
                        <option value="">Select frequency</option>
                        ${FREQUENCY_OPTIONS.map(option => `
                          <option value="${escapeHtml(option.value)}">${escapeHtml(`${option.value} (${option.count}/${TOTAL_ROWS})`)}</option>
                        `).join('')}
                      </select>
                      <span class="w4-frequency-encoded__badge" data-encoded-badge="${index}">Waiting</span>
                    </article>
                  `).join('')}
                </div>

                <div class="w4-frequency-encoded__controls">
                  <span class="status-box" id="w4-l3-encode-status">Encoding locked until counting is complete</span>
                  <button class="btn btn--primary" id="w4-l3-check-btn" type="button" disabled>Check Encodings</button>
                </div>
              </section>
            </div>
          </article>

          <div class="w4-frequency-side">
            <section class="panel w4-frequency-tracker" aria-label="Encoding Tracker">
              <div class="w4-level__panel-head">
                <div>
                  <p class="eyebrow">Encoding Tracker</p>
                  <h2 class="panel-title">Build the counts, apply the formula, then inspect the trade-off</h2>
                </div>
                <p class="w4-level__microcopy">
                  The first lock is pure counting. The second lock applies n_i / N to every row. The final lock asks what happens when two labels share the same encoded value.
                </p>
              </div>

              <div class="w4-frequency-tracker__list">
                ${STEP_META.map((step, index) => `
                  <article class="w4-frequency-card" data-step-id="${step.id}" data-step-state="${index === 0 ? 'active' : 'pending'}">
                    <div class="w4-frequency-card__meta">
                      <span class="w4-frequency-card__status" data-step-status="${step.id}">${index === 0 ? 'Active' : 'Pending'}</span>
                      <span class="w4-frequency-card__index">Step ${index + 1}</span>
                    </div>
                    <h3 class="w4-frequency-card__title">${escapeHtml(step.label)}</h3>
                    <p class="w4-frequency-card__chapter">${escapeHtml(step.chapter)}</p>
                    <p class="w4-frequency-card__copy">${escapeHtml(step.recap)}</p>
                  </article>
                `).join('')}
              </div>
            </section>

            <section class="card card--elevated w4-level__feedback" aria-live="polite">
              <p class="eyebrow">Coach Feed</p>
              <p id="w4-l3-feedback-text" class="w4-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
            </section>

            <section class="card w4-level__hint-box" id="w4-l3-hint-box" hidden>
              <p class="eyebrow">Hint</p>
              <p id="w4-l3-hint-text" class="w4-level__hint-copy"></p>
            </section>

            <section class="card w4-frequency-guide">
              <p class="eyebrow">Formula Guide</p>
              <div class="w4-frequency-guide__steps">
                <article class="w4-frequency-guide__step">
                  <span class="w4-frequency-guide__badge">1</span>
                  <p>Count how many times each city appears. Those are the raw category frequencies n_i.</p>
                </article>
                <article class="w4-frequency-guide__step">
                  <span class="w4-frequency-guide__badge">2</span>
                  <p>Divide each count by N, the total number of rows. That converts counts into comparable proportions.</p>
                </article>
                <article class="w4-frequency-guide__step">
                  <span class="w4-frequency-guide__badge">3</span>
                  <p>Every row inherits its city's proportion. That keeps the encoding compact, but equal frequencies can erase category identity.</p>
                </article>
              </div>
            </section>
          </div>
        </div>

        <section class="panel w4-frequency-collision" id="w4-l3-collision" hidden aria-label="Frequency collision demo">
          <div class="w4-level__panel-head">
            <div>
              <p class="eyebrow">Trade-Off Reveal</p>
              <h2 class="panel-title">Frequency encoding is compact, but different cities can collapse onto the same code</h2>
            </div>
            <p class="w4-level__microcopy">
              The chart below shows the final frequency distribution. Two city labels land on the exact same frequency, which means the encoded column alone cannot distinguish them.
            </p>
          </div>

          <div class="w4-frequency-collision__layout">
            <article class="w4-frequency-collision__card">
              <p class="w4-frequency-collision__kicker">Shared-Code Prompt</p>
              <h3 class="w4-frequency-collision__title" id="w4-l3-collision-title">Can the model tell Rabat from Fes once both become 0.2?</h3>
              <p class="w4-frequency-collision__copy" id="w4-l3-collision-copy">
                Click the compare button to highlight the collision and see the exact trade-off of this method.
              </p>
              <div class="action-row">
                <span class="status-box" id="w4-l3-collision-status">Shared code hidden</span>
                <button class="btn btn--primary" id="w4-l3-collision-btn" type="button">Compare Rabat and Fes</button>
              </div>
            </article>

            <article class="w4-frequency-collision__card w4-frequency-collision__card--chart">
              <p class="w4-frequency-collision__kicker">Frequency Distribution</p>
              <h3 class="w4-frequency-collision__title">Bar chart of n_i / N by city</h3>
              <div class="w4-frequency-chart-shell" id="w4-l3-chart"></div>
            </article>
          </div>
        </section>

        <section class="panel w4-frequency-summary" id="w4-l3-summary" hidden aria-label="Frequency encoding summary">
          <div class="w4-level__panel-head">
            <div>
              <p class="eyebrow">Encoding Recap</p>
              <h2 class="panel-title">You built the counts, applied the frequencies, and inspected the collision</h2>
            </div>
            <p class="w4-level__microcopy">${escapeHtml(SUMMARY_COPY)}</p>
          </div>

          <div class="action-row">
            <span class="status-box" id="w4-l3-summary-score">Waiting for trade-off review</span>
            <button class="btn btn--primary" id="w4-l3-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w4-l3-progress');
    this._ui.status = container.querySelector('#w4-l3-status');
    this._ui.feedback = container.querySelector('#w4-l3-feedback-text');
    this._ui.hintBox = container.querySelector('#w4-l3-hint-box');
    this._ui.hintText = container.querySelector('#w4-l3-hint-text');
    this._ui.sourceRows = Array.from(container.querySelectorAll('[data-source-row]'));
    this._ui.sourcePills = Array.from(container.querySelectorAll('[data-source-pill]'));
    this._ui.counterCards = Array.from(container.querySelectorAll('[data-counter-city]'));
    this._ui.counterCounts = Array.from(container.querySelectorAll('[data-counter-count]'));
    this._ui.counterTallies = Array.from(container.querySelectorAll('[data-counter-tally]'));
    this._ui.countStatus = container.querySelector('#w4-l3-count-status');
    this._ui.countButton = container.querySelector('#w4-l3-count-btn');
    this._ui.frequencyTable = container.querySelector('#w4-l3-frequency-table');
    this._ui.frequencyRows = Array.from(container.querySelectorAll('[data-frequency-city]'));
    this._ui.encodedRows = Array.from(container.querySelectorAll('[data-encoded-row]'));
    this._ui.encodedSelects = Array.from(container.querySelectorAll('[data-encoded-select]'));
    this._ui.encodedBadges = Array.from(container.querySelectorAll('[data-encoded-badge]'));
    this._ui.encodeStatus = container.querySelector('#w4-l3-encode-status');
    this._ui.checkButton = container.querySelector('#w4-l3-check-btn');
    this._ui.collision = container.querySelector('#w4-l3-collision');
    this._ui.collisionTitle = container.querySelector('#w4-l3-collision-title');
    this._ui.collisionCopy = container.querySelector('#w4-l3-collision-copy');
    this._ui.collisionStatus = container.querySelector('#w4-l3-collision-status');
    this._ui.collisionButton = container.querySelector('#w4-l3-collision-btn');
    this._ui.chartHost = container.querySelector('#w4-l3-chart');
    this._ui.summary = container.querySelector('#w4-l3-summary');
    this._ui.summaryScore = container.querySelector('#w4-l3-summary-score');
    this._ui.finishButton = container.querySelector('#w4-l3-finish-btn');
    this._ui.trackerCards = Array.from(container.querySelectorAll('[data-step-id]'));

    this._syncSourceTable();
    this._syncCounterWidget();
    this._syncEncodingBoard();
    this._syncCollisionPanel();
    this._syncTracker();
    this._syncSummary();
    this._syncProgress();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w4-l3-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w4-l3-reset-btn')) {
        this._resetLevel();
        return;
      }

      if (event.target.closest('#w4-l3-count-btn')) {
        this._countNextRow();
        return;
      }

      if (event.target.closest('#w4-l3-check-btn')) {
        this._checkEncodings();
        return;
      }

      if (event.target.closest('#w4-l3-collision-btn')) {
        this._revealCollision();
        return;
      }

      if (event.target.closest('#w4-l3-finish-btn')) {
        if (this._completed && typeof this._engine.complete === 'function') {
          void this._engine.complete();
        }
      }
    }, { signal });

    this._container?.addEventListener('change', event => {
      const select = event.target.closest('[data-encoded-select]');
      if (!select || this._awardedStepIds.has('encoding-complete')) return;

      const rowIndex = Number(select.getAttribute('data-encoded-select'));
      if (!Number.isInteger(rowIndex)) return;

      this._selectedValues[rowIndex] = select.value;
      this._rowStates[rowIndex] = select.value ? 'filled' : 'pending';
      this._syncEncodingBoard();
    }, { signal });
  }

  getHint(hintsUsed) {
    return LEVEL_HINTS[hintsUsed - 1] ?? null;
  }

  pause() {}

  resume() {}

  teardown() {
    this._events?.abort();
    this._chart?.destroy();
    this._chart = null;
    this._ui = {};
  }

  _countNextRow() {
    if (this._awardedStepIds.has('count-complete')) return;

    const row = SOURCE_ROWS[this._countedRows];
    if (!row) return;

    this._counts[row.City] += 1;
    this._countedRows += 1;

    this._syncSourceTable();
    this._syncCounterWidget();

    if (this._countedRows === TOTAL_ROWS) {
      this._awardStep('count-complete');
      this._syncCounterWidget();
      this._syncEncodingBoard();
      this._setFeedback('Count complete. Casa appears 5 times, Rabat and Fes 2 times each, and Agadir once. The frequency table is now unlocked.');
      this._setStatus('Part 1 complete. Use the computed n_i / N values to fill the encoded column on the right.');
      return;
    }

    const remaining = TOTAL_ROWS - this._countedRows;
    this._setFeedback(`Row ${this._countedRows} counted: ${row.City} now has ${this._counts[row.City]} ${pluralize(this._counts[row.City], 'occurrence')}.`);
    this._setStatus(`${this._countedRows} / ${TOTAL_ROWS} rows counted. ${remaining} ${pluralize(remaining, 'row')} still waiting.`);
  }

  _checkEncodings() {
    if (!this._awardedStepIds.has('count-complete')) {
      this._setFeedback('Count the whole column first. The encoding choices should come from measured frequencies, not guesses.');
      this._setStatus('Counting still in progress. Finish the tally before you encode.');
      return;
    }

    if (this._awardedStepIds.has('encoding-complete')) return;

    if (this._selectedValues.some(value => !value)) {
      this._setFeedback('Some encoded cells are still blank. Every row needs the frequency of its city before the column can be checked.');
      this._setStatus('The encoded column is incomplete. Fill all 10 rows before you check.');
      this._rowStates = this._selectedValues.map(value => value ? 'filled' : 'pending');
      this._syncEncodingBoard();
      return;
    }

    let wrongCount = 0;

    this._rowStates = this._selectedValues.map((value, index) => {
      const correct = value === EXPECTED_VALUES[index];
      if (!correct) wrongCount += 1;
      return correct ? 'correct' : 'wrong';
    });

    this._syncEncodingBoard();

    if (!wrongCount) {
      this._rowStates = this._rowStates.map(() => 'locked');
      this._awardStep('encoding-complete');
      this._revealSection(this._ui.collision);
      this._mountChart(false);
      this._syncEncodingBoard();
      this._syncCollisionPanel();
      this._setFeedback('Encoded column locked. Every row now carries the observed frequency of its city.');
      this._setStatus('Part 2 complete. Inspect the chart next and compare the cities that share the same encoded value.');
      return;
    }

    this._engine.mistake({ costsLife: false, countsMistake: true });
    this._setFeedback(`${wrongCount} ${pluralize(wrongCount, 'row')} still use the wrong frequency. Recheck the rows for Rabat, Fes, Casa, and Agadir against the table in the middle.`);
    this._setStatus('Encoding mismatch. Compare the dropdown values against the computed n_i / N table and try again.');
  }

  _revealCollision() {
    if (!this._awardedStepIds.has('encoding-complete') || this._collisionShown) return;

    this._collisionShown = true;
    this._completed = true;
    this._awardStep('collision-seen');
    this._mountChart(true);
    this._syncCollisionPanel();
    this._revealSection(this._ui.summary);
    this._setFeedback(`Trade-off revealed. Rabat and Fes both become ${formatFrequency(COLLISION_VALUE)}, so the encoded column alone cannot distinguish them.`);
    this._setStatus('Frequency encoding lesson complete. Continue to the high-cardinality chapter next.');
  }

  _resetLevel() {
    this._countedRows = 0;
    this._counts = Object.fromEntries(CITY_ORDER.map(city => [city, 0]));
    this._selectedValues = Array.from({ length: TOTAL_ROWS }, () => '');
    this._rowStates = Array.from({ length: TOTAL_ROWS }, () => 'pending');
    this._awardedStepIds.clear();
    this._collisionShown = false;
    this._completed = false;
    this._chart?.destroy();
    this._chart = null;

    this._ui.encodedSelects.forEach(select => {
      select.value = '';
    });

    if (this._ui.frequencyTable) {
      this._ui.frequencyTable.hidden = true;
    }

    if (this._ui.collision) {
      this._ui.collision.hidden = true;
      this._ui.collision.classList.remove('is-revealed');
    }

    if (this._ui.summary) {
      this._ui.summary.hidden = true;
      this._ui.summary.classList.remove('is-revealed');
    }

    this._syncSourceTable();
    this._syncCounterWidget();
    this._syncEncodingBoard();
    this._syncCollisionPanel();
    this._syncTracker();
    this._syncSummary();
    this._syncProgress();
    this._setFeedback(DEFAULT_FEEDBACK);
    this._setStatus(DEFAULT_STATUS);
  }

  _awardStep(stepId) {
    this._awardedStepIds.add(stepId);
    this._engine.correct();
    this._syncTracker();
    this._syncSummary();
    this._syncProgress();
  }

  _showHint() {
    const { allowed, text } = this._engine.requestHint();
    if (!allowed || !text) return;

    this._ui.hintBox?.removeAttribute('hidden');
    if (this._ui.hintText) {
      this._ui.hintText.textContent = text;
    }
  }

  _revealSection(section) {
    if (!section) return;

    section.hidden = false;
    requestAnimationFrame(() => section.classList.add('is-revealed'));
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  _mountChart(highlightCollision) {
    if (!this._ui.chartHost) return;

    const data = chartData(highlightCollision);
    const config = {
      type: 'bar',
      title: 'Frequency Distribution',
      data,
      worldColor: 'var(--color-world-4)',
      height: 250,
      minWidth: 360,
      valueFormatter: formatFrequency,
      tooltipFormatter: item => {
        const base = `${item.label}: ${formatFrequency(item.value)} (${item.count}/${TOTAL_ROWS})`;
        if (highlightCollision && item.shared) {
          return `${base} - shared with ${item.label === 'Rabat' ? 'Fes' : 'Rabat'}`;
        }
        return base;
      },
      ariaLabel: 'Bar chart showing city frequencies after frequency encoding.',
    };

    if (!this._chart) {
      this._chart = new ChartWidget(this._ui.chartHost, config);
      return;
    }

    this._chart.update(config);
  }

  _syncSourceTable() {
    const currentIndex = this._countedRows < TOTAL_ROWS ? this._countedRows : -1;

    this._ui.sourceRows.forEach((rowEl, index) => {
      let state = 'pending';
      let label = 'Pending';

      if (index < this._countedRows) {
        state = 'counted';
        label = 'Counted';
      } else if (index === currentIndex) {
        state = 'current';
        label = 'Current';
      }

      rowEl.dataset.rowState = state;
      const pill = this._ui.sourcePills[index];
      if (pill) {
        pill.textContent = label;
      }
    });
  }

  _syncCounterWidget() {
    this._ui.counterCards.forEach(card => {
      const city = card.getAttribute('data-counter-city');
      const counted = this._counts[city] ?? 0;
      const cityCount = this._countedRows ? SOURCE_ROWS[this._countedRows - 1]?.City : null;
      const state = this._awardedStepIds.has('count-complete')
        ? 'complete'
        : city === cityCount
          ? 'active'
          : counted > 0
            ? 'warm'
            : 'idle';

      card.dataset.counterState = state;
    });

    this._ui.counterCounts.forEach(label => {
      const city = label.getAttribute('data-counter-count');
      label.textContent = `${this._counts[city] ?? 0}`;
    });

    this._ui.counterTallies.forEach(tally => {
      const city = tally.getAttribute('data-counter-tally');
      tally.innerHTML = renderTally(this._counts[city] ?? 0);
    });

    if (this._ui.countStatus) {
      this._ui.countStatus.textContent = `${this._countedRows} / ${TOTAL_ROWS} rows counted`;
    }

    if (this._ui.countButton) {
      this._ui.countButton.disabled = this._awardedStepIds.has('count-complete');
      this._ui.countButton.textContent = this._awardedStepIds.has('count-complete')
        ? 'Counting Complete'
        : `Count Row ${this._countedRows + 1}`;
    }

    if (this._ui.frequencyTable) {
      this._ui.frequencyTable.hidden = !this._awardedStepIds.has('count-complete');
    }
  }

  _syncEncodingBoard() {
    const unlocked = this._awardedStepIds.has('count-complete');
    const locked = this._awardedStepIds.has('encoding-complete');

    this._ui.encodedSelects.forEach((select, index) => {
      select.disabled = !unlocked || locked;
      if (!locked && select.value !== this._selectedValues[index]) {
        select.value = this._selectedValues[index];
      }
    });

    this._ui.encodedRows.forEach((rowEl, index) => {
      const state = locked ? 'locked' : this._rowStates[index];
      rowEl.dataset.rowState = state;
    });

    this._ui.encodedBadges.forEach((badge, index) => {
      const state = locked ? 'locked' : this._rowStates[index];
      const value = this._selectedValues[index];

      if (state === 'locked') {
        badge.textContent = `Locked ${EXPECTED_VALUES[index]}`;
      } else if (state === 'correct') {
        badge.textContent = 'Correct';
      } else if (state === 'wrong') {
        badge.textContent = 'Mismatch';
      } else if (state === 'filled') {
        badge.textContent = value || 'Filled';
      } else {
        badge.textContent = 'Waiting';
      }
    });

    if (this._ui.encodeStatus) {
      if (!unlocked) {
        this._ui.encodeStatus.textContent = 'Encoding locked until counting is complete';
      } else if (locked) {
        this._ui.encodeStatus.textContent = 'Encoded column locked';
      } else {
        const filled = this._selectedValues.filter(Boolean).length;
        this._ui.encodeStatus.textContent = `${filled} / ${TOTAL_ROWS} encoded cells filled`;
      }
    }

    if (this._ui.checkButton) {
      this._ui.checkButton.disabled = !unlocked || locked;
    }
  }

  _syncCollisionPanel() {
    if (this._ui.collisionTitle) {
      this._ui.collisionTitle.textContent = this._collisionShown
        ? `Rabat and Fes both collapse to ${formatFrequency(COLLISION_VALUE)}`
        : 'Can the model tell Rabat from Fes once both become 0.2?';
    }

    if (this._ui.collisionCopy) {
      this._ui.collisionCopy.textContent = this._collisionShown
        ? `No. Rabat and Fes are different labels, but frequency encoding maps both to ${formatFrequency(COLLISION_VALUE)} because they each appear 2 times out of ${TOTAL_ROWS}. That makes the encoded feature compact, but it also loses category identity here.`
        : 'Click the compare button to highlight the collision and see the exact trade-off of this method.';
    }

    if (this._ui.collisionStatus) {
      this._ui.collisionStatus.textContent = this._collisionShown
        ? `Shared code = ${formatFrequency(COLLISION_VALUE)}`
        : 'Shared code hidden';
    }

    if (this._ui.collisionButton) {
      this._ui.collisionButton.disabled = !this._awardedStepIds.has('encoding-complete') || this._collisionShown;
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
        stepId === 'count-complete' ||
        (stepId === 'encoding-complete' && this._awardedStepIds.has('count-complete')) ||
        (stepId === 'collision-seen' && this._awardedStepIds.has('encoding-complete'))
      ) {
        state = 'active';
      }

      card.dataset.stepState = state;
      if (status) {
        status.textContent = state === 'solved' ? 'Solved' : state === 'active' ? 'Active' : 'Pending';
      }
    });
  }

  _syncSummary() {
    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = this._completed
        ? `${STEP_META.length} / ${STEP_META.length} encoding locks`
        : 'Waiting for trade-off review';
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
