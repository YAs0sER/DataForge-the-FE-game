'use strict';

import { getLevelProblem } from '../../data/problems.js';

const PROBLEM = getLevelProblem(2, 3);

const STRATEGIES = Object.freeze({
  mean: {
    id: 'mean',
    label: 'Mean',
    subtitle: 'Balanced numeric data',
    color: 'var(--color-success)',
  },
  median: {
    id: 'median',
    label: 'Median',
    subtitle: 'Skewed numeric data',
    color: 'var(--color-warning)',
  },
  mode: {
    id: 'mode',
    label: 'Mode',
    subtitle: 'Most frequent category',
    color: 'var(--color-world-4)',
  },
  signal: {
    id: 'signal',
    label: 'Missing Flag',
    subtitle: 'Keep the absence visible',
    color: 'var(--color-danger)',
  },
});

const SCENARIOS = Object.freeze([
  {
    id: 'salary-skew',
    column: 'Salary',
    title: 'Executive Salaries Stretch The Range',
    focus: 'Skewed numeric feature',
    visual: 'salary',
    copy: 'Column: Salary. Distribution: highly skewed because a few very high earners pull the right tail upward. Missing: 8%. Mechanism: likely MCAR after a random export glitch.',
    tags: [
      ['Distribution', 'Highly skewed'],
      ['Missing', '8%'],
      ['Mechanism', 'Likely MCAR'],
    ],
    strategy: 'median',
    reason: 'Median resists the pull of a few huge salaries, so it stays closer to a typical salary than the arithmetic average would.',
    caution: 'A mean fill would be dragged upward by the highest earners and would overstate the center of the column.',
    retry: 'When a numeric column is skewed by big extremes, prefer the middle of the ordered list over the raw average.',
  },
  {
    id: 'age-balanced',
    column: 'Age',
    title: 'Bell-Shaped Customer Ages',
    focus: 'Balanced numeric feature',
    visual: 'age',
    copy: 'Column: Age. Distribution: roughly bell-shaped with no dramatic outliers. Missing: 4%. Mechanism: likely MCAR from a one-off sync bug in the signup form.',
    tags: [
      ['Distribution', 'Fairly symmetric'],
      ['Missing', '4%'],
      ['Mechanism', 'Likely MCAR'],
    ],
    strategy: 'mean',
    reason: 'Mean uses all known ages and works well when the numeric distribution is fairly balanced and not distorted by large extremes.',
    caution: 'Median would still be usable, but the mean is the most natural summary when the center is stable and symmetric.',
    retry: 'If the numeric column is fairly balanced and not stretched by outliers, the average is usually the cleanest fill.',
  },
  {
    id: 'city-nominal',
    column: 'City',
    title: 'Dropdown Bug In A Nominal Column',
    focus: 'Categorical nominal feature',
    visual: 'city',
    copy: 'Column: City. Type: categorical nominal. Missing: 5%. Casablanca is by far the most common value, and the blank entries came from a temporary dropdown bug rather than meaningful behavior.',
    tags: [
      ['Type', 'Categorical nominal'],
      ['Missing', '5%'],
      ['Pattern', 'One dominant city'],
    ],
    strategy: 'mode',
    reason: 'Mode is the best fit here because categorical columns do not have numeric averages, and the most frequent observed category is a safe repair for a small accidental gap.',
    caution: 'Mean and median do not make sense for city names, and a special missing label is less useful when the blank itself carries no meaning.',
    retry: 'For a categorical column with one clearly dominant value, think about the most frequent observed category rather than a numeric statistic.',
  },
  {
    id: 'temperature-mnar',
    column: 'Temperature',
    title: 'The Sensor Fails At The Extremes',
    focus: 'Informative missingness',
    visual: 'sensor',
    copy: 'Column: Temperature. Type: numeric sensor reading. Missing: 15%. You suspect MNAR because the sensor tends to fail exactly when temperatures become dangerously extreme.',
    tags: [
      ['Type', 'Numeric sensor'],
      ['Missing', '15%'],
      ['Mechanism', 'Suspected MNAR'],
    ],
    strategy: 'signal',
    reason: 'The missingness itself contains signal, so you want to preserve it with a missing indicator or an explicit missing marker instead of hiding it inside one filled number.',
    caution: 'A simple mean or median fill would erase the very clue that the sensor fails in the hardest cases.',
    retry: 'When the gap itself carries information about the target condition, do not bury that clue inside a single replacement value.',
  },
  {
    id: 'promo-code',
    column: 'Promo_Code',
    title: 'Blank Usually Means "No Promotion Used"',
    focus: 'Meaningful absence',
    visual: 'promo',
    copy: 'Column: Promo_Code. Type: categorical token. Missing: 22%. In this product funnel, a blank promo code usually means the customer never used a promotion, which is behavior the model should remember.',
    tags: [
      ['Type', 'Categorical token'],
      ['Missing', '22%'],
      ['Signal', 'Absence is meaningful'],
    ],
    strategy: 'signal',
    reason: 'A dedicated missing label or indicator preserves the business meaning of "no promo used," which can be predictive on its own.',
    caution: 'Mode fill would blur together "most common code" and "no code used," destroying a useful distinction.',
    retry: 'If a blank value already tells a story about behavior, keep that absence visible instead of pretending it was a normal category.',
  },
]);

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM.hints ?? []),
  'Start with the variable type. Numeric columns point toward mean or median, while categorical columns point toward mode or an explicit missing marker.',
]);

const DEFAULT_FEEDBACK = 'Read the column type, shape, and missingness mechanism together before you commit to one repair strategy.';
const DEFAULT_STATUS = 'Choose one strategy for the current scenario, confirm it, then review the explanation on the back of the card.';
const SUMMARY_COPY = 'The right imputation choice comes from three signals at once: variable type, distribution shape, and whether missingness itself carries information.';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shuffleCopy(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function scenarioAt(index) {
  return SCENARIOS[index] ?? null;
}

function resultAttemptsLabel(attempts) {
  return attempts <= 1 ? 'First try' : `${attempts} tries`;
}

export default class World2Level3 {
  meta = {
    title: PROBLEM?.title ?? 'Choose Your Weapon',
    subtitle: PROBLEM?.objective ?? 'Pick the safest imputation strategy for each missing-data scenario.',
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._events = null;
    this._currentIndex = 0;
    this._selectedStrategy = null;
    this._lastWrongStrategy = null;
    this._revealed = false;
    this._completed = false;
    this._isTransitioning = false;
    this._strategyOrder = shuffleCopy(Object.values(STRATEGIES));
    this._attempts = new Map();
    this._results = new Map();
    this._ui = {};
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w2-level w2-level--strategydeck screen-section" aria-label="World 2 Level 3">
        <div class="level-hero w2-level__hero" style="--world-color: var(--color-world-2);">
          <p class="eyebrow">World 2 - Missing Data</p>
          <h1 class="level-hero__title">${escapeHtml(PROBLEM.title)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(PROBLEM.objective)}
            Each scenario asks for the safest repair strategy, not just a formula. Match the context before you choose the fill.
          </p>
          <div class="action-row">
            <span class="status-box" id="w2-l3-progress">0 / ${SCENARIOS.length} strategies matched</span>
            <span class="status-box" id="w2-l3-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w2-l3-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w2-l3-reset-btn" type="button">Reset Deck</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">03</span>
        </div>

        <div class="w2-strategy-layout">
          <article class="panel w2-strategy-stage-panel">
            <div class="w2-level__panel-head">
              <div>
                <p class="eyebrow">Strategy Deck</p>
                <h2 class="panel-title">One scenario at a time, one safest repair to choose</h2>
              </div>
              <p class="w2-level__microcopy">
                Wrong answers cost a life here because the lesson is about judgment. The best choice depends on type, shape, and why the gap exists.
              </p>
            </div>

            <div class="w2-strategy-stage-meta">
              <span class="status-box" id="w2-l3-stage-index">Card 1 / ${SCENARIOS.length}</span>
              <span class="status-box" id="w2-l3-stage-focus">Focus: ${escapeHtml(SCENARIOS[0].focus)}</span>
            </div>

            <div class="w2-strategy-card-shell" id="w2-l3-card-shell"></div>
            <div class="w2-strategy-controls" id="w2-l3-controls"></div>
          </article>

          <div class="w2-strategy-side">
            <section class="panel w2-strategy-tracker" aria-label="Scenario Tracker">
              <div class="w2-level__panel-head">
                <div>
                  <p class="eyebrow">Scenario Tracker</p>
                  <h2 class="panel-title">Watch each choice lock in</h2>
                </div>
                <p class="w2-level__microcopy">
                  Duplicate strategies are normal. Different situations can still point to the same safest repair.
                </p>
              </div>

              <div class="w2-strategy-tracker__list">
                ${SCENARIOS.map((scenario, index) => `
                  <article
                    class="w2-strategy-tracker__item"
                    data-scenario-id="${scenario.id}"
                    data-scenario-state="${index === 0 ? 'current' : 'pending'}"
                  >
                    <div class="w2-strategy-tracker__meta">
                      <span class="w2-strategy-tracker__status" data-scenario-status="${scenario.id}">${index === 0 ? 'Live' : 'Pending'}</span>
                      <span class="w2-strategy-tracker__index">S${index + 1}</span>
                    </div>
                    <h3 class="w2-strategy-tracker__title">${escapeHtml(scenario.column)}</h3>
                    <p class="w2-strategy-tracker__copy">${escapeHtml(scenario.focus)}</p>
                  </article>
                `).join('')}
              </div>
            </section>

            <section class="card card--elevated w2-level__feedback" aria-live="polite">
              <p class="eyebrow">Coach Feed</p>
              <p id="w2-l3-feedback-text" class="w2-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
            </section>

            <section class="card w2-level__hint-box" id="w2-l3-hint-box" hidden>
              <p class="eyebrow">Hint</p>
              <p id="w2-l3-hint-text" class="w2-level__hint-copy"></p>
            </section>

            <section class="card w2-strategy-guide">
              <p class="eyebrow">Strategy Guide</p>
              <div class="w2-strategy-guide__list">
                ${Object.values(STRATEGIES).map(strategy => `
                  <article class="w2-strategy-guide__item" style="--strategy-color: ${strategy.color};">
                    <span class="w2-strategy-guide__badge">${escapeHtml(strategy.label)}</span>
                    <p>${escapeHtml(strategy.subtitle)}</p>
                  </article>
                `).join('')}
              </div>
            </section>
          </div>
        </div>

        <section class="panel w2-strategy-summary" id="w2-l3-summary" hidden aria-label="Strategy Recap">
          <div class="w2-level__panel-head">
            <div>
              <p class="eyebrow">Strategy Recap</p>
              <h2 class="panel-title">Type, shape, and mechanism decide the weapon</h2>
            </div>
            <p class="w2-level__microcopy">${escapeHtml(SUMMARY_COPY)}</p>
          </div>

          <div class="w2-strategy-summary__grid" id="w2-l3-summary-grid"></div>

          <div class="action-row">
            <span class="status-box">The deck is cleared. You are ready to build missingness indicators next.</span>
            <button class="btn btn--primary" id="w2-l3-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w2-l3-progress');
    this._ui.status = container.querySelector('#w2-l3-status');
    this._ui.feedback = container.querySelector('#w2-l3-feedback-text');
    this._ui.hintBox = container.querySelector('#w2-l3-hint-box');
    this._ui.hintText = container.querySelector('#w2-l3-hint-text');
    this._ui.stageIndex = container.querySelector('#w2-l3-stage-index');
    this._ui.stageFocus = container.querySelector('#w2-l3-stage-focus');
    this._ui.cardShell = container.querySelector('#w2-l3-card-shell');
    this._ui.controls = container.querySelector('#w2-l3-controls');
    this._ui.summary = container.querySelector('#w2-l3-summary');
    this._ui.summaryGrid = container.querySelector('#w2-l3-summary-grid');
    this._ui.finishButton = container.querySelector('#w2-l3-finish-btn');
    this._ui.trackerItems = Array.from(container.querySelectorAll('[data-scenario-id]'));

    this._renderStage();
    this._syncProgress();
    this._syncTracker();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      const strategyButton = event.target.closest('[data-strategy-choice]');
      if (strategyButton) {
        this._selectStrategy(strategyButton.getAttribute('data-strategy-choice'));
        return;
      }

      if (event.target.closest('#w2-l3-confirm-btn')) {
        this._confirmSelection();
        return;
      }

      if (event.target.closest('#w2-l3-next-btn')) {
        this._advanceDeck();
        return;
      }

      if (event.target.closest('#w2-l3-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w2-l3-reset-btn')) {
        this._resetDeck();
        return;
      }

      if (event.target.closest('#w2-l3-finish-btn')) {
        if (this._completed) {
          void this._engine.complete();
        }
      }
    }, { signal });
  }

  getHint(hintsUsed) {
    return LEVEL_HINTS[hintsUsed - 1] ?? scenarioAt(this._currentIndex)?.retry ?? null;
  }

  pause() {}

  resume() {}

  teardown() {
    this._events?.abort();
    this._results.clear();
    this._attempts.clear();
    this._ui = {};
  }

  _renderStage() {
    const scenario = scenarioAt(this._currentIndex);
    if (!scenario) return;

    const strategy = STRATEGIES[scenario.strategy];
    const solved = this._results.get(scenario.id);

    if (this._ui.stageIndex) {
      this._ui.stageIndex.textContent = `Card ${this._currentIndex + 1} / ${SCENARIOS.length}`;
    }

    if (this._ui.stageFocus) {
      this._ui.stageFocus.textContent = `Focus: ${scenario.focus}`;
    }

    this._ui.cardShell.innerHTML = this._revealed
      ? `
        <article
          class="scenario-card w2-strategy-card w2-strategy-card--answer"
          data-card-face="back"
          data-scenario-visual="${scenario.visual}"
          style="--strategy-color: ${strategy.color};"
        >
          <div class="w2-strategy-card__header">
            <p class="w2-strategy-card__eyebrow">Best Strategy</p>
            <h3 class="w2-strategy-card__title">${escapeHtml(strategy.label)}</h3>
            <span class="w2-strategy-card__strategy-tag">${escapeHtml(strategy.subtitle)}</span>
          </div>

          <div class="scenario-card__body w2-strategy-card__body">
            <p class="w2-strategy-card__reason">${escapeHtml(scenario.reason)}</p>
            <p class="w2-strategy-card__caution">${escapeHtml(scenario.caution)}</p>
          </div>

          <div class="scenario-card__meta w2-strategy-card__meta">
            ${escapeHtml(resultAttemptsLabel(solved?.attempts ?? 1))} - ${escapeHtml(scenario.column)}
          </div>
        </article>
      `
      : `
        <article
          class="scenario-card w2-strategy-card"
          data-card-face="front"
          data-scenario-visual="${scenario.visual}"
          style="--strategy-color: ${strategy.color};"
        >
          <div class="w2-strategy-card__header">
            <p class="w2-strategy-card__eyebrow">Column: ${escapeHtml(scenario.column)}</p>
            <h3 class="w2-strategy-card__title">${escapeHtml(scenario.title)}</h3>
          </div>

          <div class="scenario-card__body w2-strategy-card__body">
            <p>${escapeHtml(scenario.copy)}</p>
            <div class="w2-strategy-card__tags">
              ${scenario.tags.map(([label, value]) => `
                <article class="w2-strategy-card__tag">
                  <span class="w2-strategy-card__tag-label">${escapeHtml(label)}</span>
                  <strong class="w2-strategy-card__tag-value">${escapeHtml(value)}</strong>
                </article>
              `).join('')}
            </div>
          </div>

          <div class="scenario-card__meta w2-strategy-card__meta">
            Match the safest imputation choice to this context before you reveal the explanation.
          </div>
        </article>
      `;

    this._renderControls();
  }

  _renderControls() {
    const scenario = scenarioAt(this._currentIndex);
    if (!scenario || !this._ui.controls) return;

    if (this._revealed) {
      this._ui.controls.innerHTML = `
        <div class="w2-strategy-cta w2-strategy-cta--revealed">
          <span class="status-box">${escapeHtml(STRATEGIES[scenario.strategy].label)} locked in</span>
          <button class="btn btn--primary" id="w2-l3-next-btn" type="button">
            ${this._currentIndex === SCENARIOS.length - 1 ? 'Open Recap' : 'Next Scenario'}
          </button>
        </div>
      `;
      return;
    }

    this._ui.controls.innerHTML = `
      <div class="w2-strategy-choice-grid" role="group" aria-label="Imputation strategies">
        ${this._strategyOrder.map(strategy => {
          const selected = this._selectedStrategy === strategy.id;
          const wrong = !selected && this._lastWrongStrategy === strategy.id;

          return `
            <button
              class="w2-strategy-choice ${selected ? 'w2-strategy-choice--selected' : ''} ${wrong ? 'w2-strategy-choice--wrong' : ''}"
              type="button"
              data-strategy-choice="${strategy.id}"
              style="--strategy-color: ${strategy.color};"
            >
              <span class="w2-strategy-choice__label">${escapeHtml(strategy.label)}</span>
              <span class="w2-strategy-choice__copy">${escapeHtml(strategy.subtitle)}</span>
            </button>
          `;
        }).join('')}
      </div>

      <div class="w2-strategy-cta">
        <p class="w2-strategy-inline-hint">
          ${escapeHtml(this._lastWrongStrategy ? scenario.retry : 'Pick the safest strategy, then confirm it to flip the card and reveal the reasoning.')}
        </p>
        <button
          class="btn btn--primary"
          id="w2-l3-confirm-btn"
          type="button"
          ${this._selectedStrategy && !this._isTransitioning ? '' : 'disabled'}
        >
          Confirm Strategy
        </button>
      </div>
    `;
  }

  _selectStrategy(strategyId) {
    if (this._revealed || this._isTransitioning || !STRATEGIES[strategyId]) return;

    this._selectedStrategy = strategyId;
    this._lastWrongStrategy = null;
    this._renderControls();
  }

  _confirmSelection() {
    const scenario = scenarioAt(this._currentIndex);
    if (!scenario || this._revealed || this._isTransitioning || !this._selectedStrategy) return;

    const attempts = (this._attempts.get(scenario.id) ?? 0) + 1;
    this._attempts.set(scenario.id, attempts);

    if (this._selectedStrategy !== scenario.strategy) {
      this._lastWrongStrategy = this._selectedStrategy;
      this._selectedStrategy = null;
      this._setFeedback(`Try again. ${scenario.retry}`);
      this._setStatus('That strategy does not fit the full context. Re-read the type, shape, and mechanism before you choose again.');
      this._engine.mistake();
      this._renderControls();
      this._shakeCurrentCard();
      return;
    }

    this._results.set(scenario.id, {
      scenarioId: scenario.id,
      column: scenario.column,
      strategy: scenario.strategy,
      attempts,
      reason: scenario.reason,
      caution: scenario.caution,
    });

    this._engine.correct();
    this._setFeedback(`Correct. ${scenario.reason}`);
    this._setStatus(`${scenario.column} is locked in. Review the explanation on the back of the card, then continue.`);
    this._syncProgress();
    this._syncTracker();
    this._flipCurrentCard();
  }

  _shakeCurrentCard() {
    const card = this._ui.cardShell?.querySelector('.scenario-card');
    if (!card) return;

    card.classList.remove('scenario-card--shake');
    void card.offsetWidth;
    card.classList.add('scenario-card--shake');
  }

  _flipCurrentCard() {
    const card = this._ui.cardShell?.querySelector('.scenario-card');
    if (!card) {
      this._revealed = true;
      this._renderStage();
      return;
    }

    this._isTransitioning = true;
    card.classList.add('scenario-card--flip-out');

    window.setTimeout(() => {
      this._revealed = true;
      this._renderStage();

      const revealedCard = this._ui.cardShell?.querySelector('.scenario-card');
      revealedCard?.classList.add('scenario-card--flip-in');

      window.setTimeout(() => {
        this._isTransitioning = false;
      }, 240);
    }, 200);
  }

  _advanceDeck() {
    if (!this._revealed || this._isTransitioning) return;

    if (this._currentIndex === SCENARIOS.length - 1) {
      this._revealSummary();
      return;
    }

    this._currentIndex += 1;
    this._revealed = false;
    this._selectedStrategy = null;
    this._lastWrongStrategy = null;
    this._setStatus(`Scenario ${this._currentIndex + 1} is live. Choose the safest imputation strategy before you reveal the explanation.`);
    this._renderStage();
    this._syncTracker();
  }

  _revealSummary() {
    this._completed = true;

    if (this._ui.summaryGrid) {
      this._ui.summaryGrid.innerHTML = SCENARIOS.map(scenario => {
        const result = this._results.get(scenario.id);
        const strategy = STRATEGIES[scenario.strategy];

        return `
          <article class="w2-strategy-summary__card" style="--strategy-color: ${strategy.color};">
            <div class="w2-strategy-summary__meta">
              <span class="w2-strategy-summary__badge">${escapeHtml(strategy.label)}</span>
              <span class="w2-strategy-summary__attempts">${escapeHtml(resultAttemptsLabel(result?.attempts ?? 1))}</span>
            </div>
            <h3 class="w2-strategy-summary__title">${escapeHtml(scenario.column)}</h3>
            <p class="w2-strategy-summary__copy">${escapeHtml(scenario.reason)}</p>
          </article>
        `;
      }).join('');
    }

    if (this._ui.summary) {
      this._ui.summary.hidden = false;
      requestAnimationFrame(() => {
        this._ui.summary.classList.add('is-revealed');
      });
      this._ui.summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    this._setFeedback(SUMMARY_COPY);
    this._setStatus('All five scenarios are matched. Review the recap, then continue to the indicator-variable level.');
    this._syncProgress();
    this._syncTracker();
  }

  _showHint() {
    const { allowed, text } = this._engine.requestHint();
    if (!allowed || !text) return;

    this._ui.hintBox?.removeAttribute('hidden');
    if (this._ui.hintText) {
      this._ui.hintText.textContent = text;
    }
  }

  _resetDeck() {
    this._currentIndex = 0;
    this._selectedStrategy = null;
    this._lastWrongStrategy = null;
    this._revealed = false;
    this._completed = false;
    this._isTransitioning = false;
    this._strategyOrder = shuffleCopy(Object.values(STRATEGIES));
    this._attempts.clear();
    this._results.clear();

    if (this._ui.summary) {
      this._ui.summary.hidden = true;
      this._ui.summary.classList.remove('is-revealed');
    }

    if (this._ui.summaryGrid) {
      this._ui.summaryGrid.innerHTML = '';
    }

    this._renderStage();
    this._syncProgress();
    this._syncTracker();
    this._setFeedback(DEFAULT_FEEDBACK);
    this._setStatus(DEFAULT_STATUS);
  }

  _syncProgress() {
    if (this._ui.progress) {
      this._ui.progress.textContent = `${this._results.size} / ${SCENARIOS.length} strategies matched`;
    }

    if (this._ui.finishButton) {
      this._ui.finishButton.disabled = !this._completed;
    }
  }

  _syncTracker() {
    this._ui.trackerItems.forEach((item, index) => {
      const scenarioId = item.getAttribute('data-scenario-id');
      const status = item.querySelector(`[data-scenario-status="${scenarioId}"]`);
      const solved = this._results.has(scenarioId);
      const current = !solved && index === this._currentIndex && !this._completed;

      item.setAttribute('data-scenario-state', solved ? 'solved' : current ? 'current' : 'pending');

      if (status) {
        status.textContent = solved ? 'Locked In' : current ? 'Live' : 'Pending';
      }
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
