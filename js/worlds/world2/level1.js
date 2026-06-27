'use strict';

import { getLevelProblem } from '../../data/problems.js';
import { createLabelDrop } from '../../widgets/dragdrop.js';

const PROBLEM = getLevelProblem(2, 1);

const MECHANISMS = Object.freeze({
  mcar: {
    tokenId: 'token-mcar',
    label: 'MCAR',
    longLabel: 'Missing Completely At Random',
    shortDefinition: 'Missingness has no pattern and does not depend on the data.',
    color: 'var(--color-success)',
  },
  mar: {
    tokenId: 'token-mar',
    label: 'MAR',
    longLabel: 'Missing At Random',
    shortDefinition: 'Missingness depends on other observed variables, not the missing value itself.',
    color: 'var(--color-warning)',
  },
  mnar: {
    tokenId: 'token-mnar',
    label: 'MNAR',
    longLabel: 'Missing Not At Random',
    shortDefinition: 'Missingness is tied to the hidden value itself or another unobserved factor.',
    color: 'var(--color-danger)',
  },
});

const SCENARIOS = Object.freeze([
  {
    id: 'scenario-sensor',
    title: 'Random Sensor Failure',
    visual: 'sensor',
    zoneId: 'zone-sensor',
    mechanismKey: 'mcar',
    copy: 'A sensor randomly fails once every 100 readings, with no pattern.',
    why: 'The failure happens independently of temperature, time, and any other recorded feature.',
    formal: 'MCAR means the probability of missingness is unrelated to both observed and unobserved values.',
    impact: 'This is the least biased mechanism. Simple imputation can be reasonable because the missingness is not systematically hiding one group.',
  },
  {
    id: 'scenario-survey',
    title: 'Skipped Salary Question',
    visual: 'survey',
    zoneId: 'zone-survey',
    mechanismKey: 'mnar',
    copy: 'Higher-income people tend to skip the salary question in surveys.',
    why: 'The chance of being missing depends on the true salary, which is exactly the value you do not observe.',
    formal: 'MNAR means missingness depends on the hidden value itself or another unobserved cause.',
    impact: 'This is the hardest case. Naive imputation can hide the bias, so you often need stronger assumptions, indicators, or domain-specific handling.',
  },
  {
    id: 'scenario-hospital',
    title: 'Older Patients Missing Digitization',
    visual: 'hospital',
    zoneId: 'zone-hospital',
    mechanismKey: 'mar',
    copy: 'Older patients are less likely to have digital records entered.',
    why: 'Missingness depends on age, which is observed elsewhere in the dataset, rather than on the missing field itself.',
    formal: 'MAR means missingness depends on other observed variables once you condition on what you already know.',
    impact: 'Observed columns can help explain the gap, so smarter imputation strategies can use those relationships more safely.',
  },
]);

const ANSWER_KEY = Object.freeze(
  Object.fromEntries(
    SCENARIOS.map(scenario => [scenario.zoneId, MECHANISMS[scenario.mechanismKey].tokenId])
  )
);

const DEFAULT_FEEDBACK = 'Ask one question for each card: does missingness depend on nothing, on another observed feature, or on the hidden value itself?';
const DEFAULT_STATUS = 'Place each mechanism token onto the scenario card that matches its missingness pattern.';
const SUMMARY_COPY = 'You mapped all three mechanisms. Open the recaps below to see the formal definitions before you continue.';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function scenarioByZone(zoneId) {
  return SCENARIOS.find(scenario => scenario.zoneId === zoneId) ?? null;
}

function scenarioByToken(tokenId) {
  const mechanismEntry = Object.entries(MECHANISMS).find(([, mechanism]) => mechanism.tokenId === tokenId);
  if (!mechanismEntry) return null;
  const [mechanismKey] = mechanismEntry;
  return SCENARIOS.find(scenario => scenario.mechanismKey === mechanismKey) ?? null;
}

export default class World2Level1 {
  meta = {
    title: PROBLEM?.title ?? 'Why Is It Missing?',
    subtitle: PROBLEM?.objective ?? 'Assign each scenario to MCAR, MAR, or MNAR.',
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._dragDrop = null;
    this._events = null;
    this._completed = false;
    this._solvedZones = new Set();
    this._boardSyncTimer = null;
    this._ui = {};
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w2-level w2-level--mechanisms screen-section" aria-label="World 2 Level 1">
        <div class="level-hero w2-level__hero" style="--world-color: var(--color-world-2);">
          <p class="eyebrow">World 2 - Missing Data</p>
          <h1 class="level-hero__title">${escapeHtml(PROBLEM.title)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(PROBLEM.objective)}
            Match each real-world scenario to the missingness mechanism that best explains why the gap appears.
          </p>
          <div class="action-row">
            <span class="status-box" id="w2-l1-progress">0 / ${SCENARIOS.length} scenarios solved</span>
            <span class="status-box" id="w2-l1-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w2-l1-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w2-l1-reset-btn" type="button">Reset Lab</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">01</span>
        </div>

        <article class="panel w2-mechanism-panel">
          <div class="w2-level__panel-head">
            <div>
              <p class="eyebrow">Mechanism Lab</p>
              <h2 class="panel-title">Detect whether missingness is random, conditionally patterned, or self-hiding</h2>
            </div>
            <p class="w2-level__microcopy">
              The mechanism matters because it tells you how trustworthy a simple imputation will be.
            </p>
          </div>

          <section class="card card--elevated w2-mechanism-rulecard">
            <p class="eyebrow">Decision Rule</p>
            <div class="w2-mechanism-rulecard__grid">
              <article class="w2-mechanism-rulecard__step">
                <span class="w2-mechanism-rulecard__badge">MCAR</span>
                <p>If the gap has no visible pattern, it behaves like random noise.</p>
              </article>
              <article class="w2-mechanism-rulecard__step">
                <span class="w2-mechanism-rulecard__badge">MAR</span>
                <p>If another observed column explains the gap, missingness is conditional on what you can see.</p>
              </article>
              <article class="w2-mechanism-rulecard__step">
                <span class="w2-mechanism-rulecard__badge">MNAR</span>
                <p>If the hidden value itself is driving the gap, the dataset is concealing its own hardest cases.</p>
              </article>
            </div>
          </section>

          <section class="w2-mechanism-token-bank" aria-label="Missingness mechanism labels">
            ${Object.values(MECHANISMS).map(mechanism => `
              <button
                class="drag-token dd-draggable w2-mechanism-token"
                type="button"
                data-dd-id="${mechanism.tokenId}"
                data-tooltip="${escapeHtml(mechanism.longLabel)} - ${escapeHtml(mechanism.shortDefinition)}"
                aria-label="Place ${escapeHtml(mechanism.longLabel)}"
              >
                <span class="w2-mechanism-token__code">${escapeHtml(mechanism.label)}</span>
                <span class="w2-mechanism-token__name">${escapeHtml(mechanism.longLabel)}</span>
              </button>
            `).join('')}
          </section>

          <section class="w2-scenario-grid" aria-label="Missingness scenarios">
            ${SCENARIOS.map(scenario => {
              return `
                <article
                  class="w2-scenario-card"
                  data-scenario-id="${scenario.id}"
                  data-scenario-visual="${scenario.visual}"
                >
                  <div class="w2-scenario-card__shell">
                    <div class="w2-scenario-card__intro">
                      <p class="w2-scenario-card__eyebrow">${escapeHtml(scenario.title)}</p>
                      <p class="w2-scenario-card__copy">${escapeHtml(scenario.copy)}</p>
                    </div>

                    <div
                      class="drop-zone dd-zone w2-scenario-dropzone"
                      data-dd-zone="${scenario.zoneId}"
                      data-dd-label="${escapeHtml(scenario.title)}"
                      aria-label="Drop mechanism for ${escapeHtml(scenario.title)}"
                    >
                      <span class="w2-scenario-dropzone__label">Drop mechanism here</span>
                    </div>
                  </div>

                  <section class="w2-scenario-explainer" id="w2-l1-explainer-${scenario.id}" hidden>
                    <button
                      class="w2-scenario-explainer__toggle"
                      type="button"
                      data-explainer-toggle="${scenario.id}"
                      aria-expanded="true"
                    >
                      <span>Why this is ${escapeHtml(MECHANISMS[scenario.mechanismKey].label)}</span>
                      <span class="w2-scenario-explainer__icon" aria-hidden="true">-</span>
                    </button>
                    <div class="w2-scenario-explainer__body" data-explainer-body="${scenario.id}">
                      <p class="w2-scenario-explainer__why">${escapeHtml(scenario.why)}</p>
                      <p class="w2-scenario-explainer__formal">${escapeHtml(scenario.formal)}</p>
                      <p class="w2-scenario-explainer__impact">${escapeHtml(scenario.impact)}</p>
                    </div>
                  </section>
                </article>
              `;
            }).join('')}
          </section>
        </article>

        <div class="w2-mechanism-insights">
          <section class="card card--elevated w2-level__feedback" aria-live="polite">
            <p class="eyebrow">Coach Feed</p>
            <p id="w2-l1-feedback-text" class="w2-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
          </section>

          <section class="card w2-level__hint-box" id="w2-l1-hint-box" hidden>
            <p class="eyebrow">Hint</p>
            <p id="w2-l1-hint-text" class="w2-level__hint-copy"></p>
          </section>
        </div>

        <section class="panel w2-mechanism-summary" id="w2-l1-summary" hidden aria-label="Mechanism Summary">
          <div class="w2-level__panel-head">
            <div>
              <p class="eyebrow">Mechanism Recap</p>
              <h2 class="panel-title">The cause of missingness shapes the fix</h2>
            </div>
            <p class="w2-level__microcopy">${escapeHtml(SUMMARY_COPY)}</p>
          </div>

          <div class="action-row">
            <span class="status-box">MCAR, MAR, and MNAR mapped</span>
            <button class="btn btn--primary" id="w2-l1-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w2-l1-progress');
    this._ui.status = container.querySelector('#w2-l1-status');
    this._ui.feedback = container.querySelector('#w2-l1-feedback-text');
    this._ui.hintBox = container.querySelector('#w2-l1-hint-box');
    this._ui.hintText = container.querySelector('#w2-l1-hint-text');
    this._ui.summary = container.querySelector('#w2-l1-summary');
    this._ui.finishButton = container.querySelector('#w2-l1-finish-btn');
    this._ui.explainers = SCENARIOS.map(scenario => ({
      id: scenario.id,
      shell: container.querySelector(`#w2-l1-explainer-${scenario.id}`),
      body: container.querySelector(`[data-explainer-body="${scenario.id}"]`),
      toggle: container.querySelector(`[data-explainer-toggle="${scenario.id}"]`),
    }));

    this._updateBoardState({});
  }

  start() {
    this._dragDrop = createLabelDrop(this._container, ANSWER_KEY, {
      container: this._container,
      draggableSelector: '.w2-mechanism-token',
      zoneSelector: '.w2-scenario-dropzone',
      onDrop: () => {
        this._updateBoardState();
      },
      onCorrect: (tokenId, zoneId) => {
        const scenario = scenarioByZone(zoneId);
        const mechanism = Object.values(MECHANISMS).find(entry => entry.tokenId === tokenId);
        this._solvedZones.add(zoneId);

        if (scenario && mechanism && !this._completed) {
          this._setStatus(`${this._solvedCount()} / ${SCENARIOS.length} scenarios solved`);
          this._setFeedback(`${mechanism.label} fits ${scenario.title.toLowerCase()} because ${scenario.why.toLowerCase()}`);
        }

        this._updateBoardState();
        this._checkForCompletion();
        this._engine.correct();
      },
      onIncorrect: (tokenId, zoneId) => {
        const attemptedScenario = scenarioByZone(zoneId);
        const correctScenario = scenarioByToken(tokenId);

        if (attemptedScenario && correctScenario) {
          this._setFeedback(`Not quite. ${attemptedScenario.title} is not ${Object.values(MECHANISMS).find(entry => entry.tokenId === tokenId)?.label}. Compare it with ${correctScenario.title.toLowerCase()} instead.`);
        }

        this._updateBoardState();
        this._scheduleBoardRefresh();
        this._engine.mistake({ costsLife: false, countsMistake: true });
      },
      onComplete: () => {
        this._checkForCompletion();
      },
    });

    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w2-l1-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w2-l1-reset-btn')) {
        this._resetLab();
        return;
      }

      if (event.target.closest('#w2-l1-finish-btn')) {
        if (this._completed) {
          void this._engine.complete();
        }
        return;
      }

      const toggle = event.target.closest('[data-explainer-toggle]');
      if (toggle) {
        this._toggleExplainer(toggle.getAttribute('data-explainer-toggle'));
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
    if (this._boardSyncTimer) {
      window.clearTimeout(this._boardSyncTimer);
      this._boardSyncTimer = null;
    }
    this._dragDrop?.destroy();
    this._dragDrop = null;
    this._solvedZones.clear();
    this._ui = {};
  }

  _showHint() {
    const { allowed, text } = this._engine.requestHint();
    if (!allowed || !text) return;

    this._ui.hintBox?.removeAttribute('hidden');
    if (this._ui.hintText) {
      this._ui.hintText.textContent = text;
    }
  }

  _resetLab() {
    this._dragDrop?.reset();
    this._completed = false;
    this._solvedZones.clear();

    if (this._boardSyncTimer) {
      window.clearTimeout(this._boardSyncTimer);
      this._boardSyncTimer = null;
    }

    this._ui.summary?.setAttribute('hidden', '');
    this._ui.summary?.classList.remove('is-revealed');

    this._ui.explainers.forEach(explainer => {
      explainer.shell?.setAttribute('hidden', '');
      explainer.shell?.classList.remove('is-revealed');
      explainer.body?.removeAttribute('hidden');
      explainer.toggle?.setAttribute('aria-expanded', 'true');
      const icon = explainer.toggle?.querySelector('.w2-scenario-explainer__icon');
      if (icon) icon.textContent = '-';
    });

    this._updateBoardState();
    this._setFeedback(DEFAULT_FEEDBACK);
    this._setStatus(DEFAULT_STATUS);
  }

  _updateBoardState() {
    const placed = this._solvedCount();

    if (this._ui.progress) {
      this._ui.progress.textContent = `${placed} / ${SCENARIOS.length} scenarios solved`;
    }

    if (this._ui.finishButton) {
      this._ui.finishButton.disabled = !this._completed;
    }
  }

  _checkForCompletion() {
    if (this._completed || this._solvedCount() !== SCENARIOS.length) return;

    this._completed = true;
    this._updateBoardState();
    this._revealRecap();
  }

  _solvedCount() {
    return this._solvedZones.size;
  }

  _scheduleBoardRefresh() {
    if (this._boardSyncTimer) {
      window.clearTimeout(this._boardSyncTimer);
    }

    this._boardSyncTimer = window.setTimeout(() => {
      this._boardSyncTimer = null;
      this._updateBoardState();
    }, 650);
  }

  _revealRecap() {
    this._setFeedback(SUMMARY_COPY);
    this._setStatus('All three mechanisms matched. Review the explanations below, then continue.');
    this._ui.finishButton?.removeAttribute('disabled');

    this._ui.explainers.forEach(explainer => {
      explainer.shell?.removeAttribute('hidden');
      explainer.body?.removeAttribute('hidden');
      explainer.toggle?.setAttribute('aria-expanded', 'true');
      const icon = explainer.toggle?.querySelector('.w2-scenario-explainer__icon');
      if (icon) icon.textContent = '-';

      requestAnimationFrame(() => {
        explainer.shell?.classList.add('is-revealed');
      });
    });

    if (this._ui.summary) {
      this._ui.summary.hidden = false;
      requestAnimationFrame(() => {
        this._ui.summary.classList.add('is-revealed');
      });
      this._ui.summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  _toggleExplainer(scenarioId) {
    const explainer = this._ui.explainers.find(entry => entry.id === scenarioId);
    if (!explainer?.body || !explainer?.toggle) return;

    const expanded = explainer.toggle.getAttribute('aria-expanded') === 'true';
    explainer.toggle.setAttribute('aria-expanded', String(!expanded));
    explainer.body.hidden = expanded;

    const icon = explainer.toggle.querySelector('.w2-scenario-explainer__icon');
    if (icon) {
      icon.textContent = expanded ? '+' : '-';
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
