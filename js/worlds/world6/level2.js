'use strict';

import { getLevelProblem } from '../../data/problems.js';

const PROBLEM = getLevelProblem(6, 2);
const LEVEL_TITLE = PROBLEM?.title ?? 'The Data Leakage Trap';
const LEVEL_OBJECTIVE = PROBLEM?.objective ?? 'Judge which workflows are safe and which leak test information backwards.';

const VERDICTS = Object.freeze({
  safe: Object.freeze({
    label: 'Safe',
    longLabel: 'Safe Workflow',
    tone: 'safe',
    color: 'var(--color-success)',
    statusLabel: 'Safe confirmed',
  }),
  leakage: Object.freeze({
    label: 'Leakage',
    longLabel: 'Leakage',
    tone: 'leakage',
    color: 'var(--color-danger)',
    statusLabel: 'Leak exposed',
  }),
});

const SCENARIOS = Object.freeze([
  Object.freeze({
    id: 'train-median-impute',
    stage: 'Missing Data',
    color: 'var(--color-world-2)',
    title: 'Train-only Median Imputation',
    verdict: 'safe',
    copy: 'The team split train and test first, computed the Age median on the training split, then reused that frozen value in both datasets.',
    snippet: `X_train, X_test = split(df)\nage_fill = X_train['Age'].median()\nX_train['Age'] = X_train['Age'].fillna(age_fill)\nX_test['Age'] = X_test['Age'].fillna(age_fill)`,
    explanation: 'The imputation statistic was fit on train only, so the test rows never helped define the repair rule.',
    impact: 'That keeps evaluation honest because test examples are transformed with a rule learned earlier, not used to invent the rule.',
    rule: 'Split first, fit the median on train, then transform both splits with that frozen value.',
  }),
  Object.freeze({
    id: 'global-minmax-before-split',
    stage: 'Scaling',
    color: 'var(--color-world-5)',
    title: 'Global MinMax Before Split',
    verdict: 'leakage',
    copy: 'A teammate scaled Age and Salary on the full dataset first, then split the already-scaled matrix into train and test.',
    snippet: `scaled = MinMaxScaler().fit_transform(df[['Age', 'Salary']])\nX_train, X_test = split(scaled)`,
    explanation: 'The scaler saw the test-set minima and maxima before the split, so test range information leaked backward into preprocessing.',
    impact: 'That inflates evaluation because the feature scale already knows something about the held-out rows.',
    rule: 'Split first, fit MinMax on train only, then apply that frozen scaler to test.',
  }),
  Object.freeze({
    id: 'train-only-onehot',
    stage: 'Encoding',
    color: 'var(--color-world-4)',
    title: 'Frozen One-Hot Mapping',
    verdict: 'safe',
    copy: 'The City encoder was fit on the training split, then the same learned column mapping was applied to the test split without refitting.',
    snippet: `enc.fit(X_train[['City']])\nX_train_city = enc.transform(X_train[['City']])\nX_test_city = enc.transform(X_test[['City']])`,
    explanation: 'The encoder learned its category mapping from train only, then reused that mapping unchanged on test.',
    impact: 'That preserves a fair holdout because the test rows did not teach the model or the encoder any new structure.',
    rule: 'Fit the encoder on train, freeze the mapping, and only transform test with the same mapping.',
  }),
  Object.freeze({
    id: 'global-frequency-encoding',
    stage: 'Encoding',
    color: 'var(--color-warning)',
    title: 'Frequency Encoding with Full Data Counts',
    verdict: 'leakage',
    copy: 'Frequency encoding for City was computed from the entire dataset, including the held-out test rows, before the train/test transforms were written back.',
    snippet: `freq = df['City'].value_counts(normalize=True)\nX_train['City'] = X_train['City'].map(freq)\nX_test['City'] = X_test['City'].map(freq)`,
    explanation: 'The city frequencies were estimated using both train and test, so the encoded values already contain test-distribution knowledge.',
    impact: 'That contamination can make evaluation look better than it should because the preprocessing step already saw the future.',
    rule: 'Compute the frequency table on train only, then map both train and test with that train-only table.',
  }),
]);

const TOTAL_SCENARIOS = SCENARIOS.length;
const SAFE_TOTAL = SCENARIOS.filter(scenario => scenario.verdict === 'safe').length;
const LEAK_TOTAL = SCENARIOS.filter(scenario => scenario.verdict === 'leakage').length;

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM?.hints ?? []),
  'Ask one question first: did the preprocessing rule learn from train only, or did test rows help define it?',
  'If the split happens after fitting a scaler, imputer, or encoder, the workflow is already contaminated.',
  'Safe pipelines follow one rhythm: split first, fit on train, then transform both train and test with the frozen rule.',
]);

const DEFAULT_FEEDBACK = 'For each workflow, ask where the preprocessing statistic came from before you call it safe.';
const DEFAULT_STATUS = 'Judge each scenario once. Safe means fit on train and transform both. Leakage means test data helped define the rule.';
const SUMMARY_COPY = 'The golden rule is simple because the consequence is not: fit preprocessing on train, then reuse that frozen transform everywhere else.';

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

function scenarioById(scenarioId) {
  return SCENARIOS.find(scenario => scenario.id === scenarioId) ?? null;
}

function verdictMeta(verdict) {
  return VERDICTS[verdict] ?? VERDICTS.safe;
}

function countCorrect(results) {
  return [...results.values()].filter(result => result.correct).length;
}

function countCorrectVerdict(results, verdict) {
  return [...results.values()].filter(result => result.correct && result.verdict === verdict).length;
}

function buildSummary(results) {
  const values = SCENARIOS
    .map(scenario => results.get(scenario.id))
    .filter(Boolean);
  const correct = values.filter(result => result.correct).length;
  return {
    total: TOTAL_SCENARIOS,
    correct,
    wrong: TOTAL_SCENARIOS - correct,
    perfect: correct === TOTAL_SCENARIOS,
    leakCorrect: values.filter(result => result.correct && result.verdict === 'leakage').length,
    safeCorrect: values.filter(result => result.correct && result.verdict === 'safe').length,
    results: values,
  };
}

function resultTone(summary) {
  if (!summary) return DEFAULT_FEEDBACK;
  if (summary.perfect) {
    return 'Perfect review. You are reading preprocessing workflows the same way a production pipeline should: split first, fit on train, transform both.';
  }
  if (summary.correct >= Math.ceil(summary.total * 0.75)) {
    return 'Strong review. The key rule is in place, and the recap below tightens the few workflows that still looked safer than they were.';
  }
  return 'Useful checkpoint. The recap below shows exactly where test information tried to flow backward through the pipeline.';
}

function resultStatus(summary) {
  if (!summary) return DEFAULT_STATUS;
  return `Review complete. ${summary.correct} / ${summary.total} workflow calls landed correctly.`;
}

export default class World6Level2 {
  meta = {
    title: LEVEL_TITLE,
    subtitle: LEVEL_OBJECTIVE,
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._events = null;
    this._results = new Map();
    this._summary = null;
    this._completed = false;
    this._lastSignal = 'neutral';
    this._verdictOrder = shuffleCopy(Object.entries(VERDICTS));
    this._ui = {};
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w6-level w6-level--leakage screen-section" aria-label="World 6 Level 2">
        <div class="level-hero w6-level__hero" style="--world-color: var(--color-world-6);">
          <p class="eyebrow">World 6 - Full Pipeline</p>
          <h1 class="level-hero__title">${escapeHtml(LEVEL_TITLE)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(LEVEL_OBJECTIVE)}
            This level is about workflow discipline: the moment test information helps define a preprocessing rule, the evaluation is no longer trustworthy.
          </p>
          <div class="action-row">
            <span class="status-box" id="w6-l2-progress">0 / ${TOTAL_SCENARIOS} scenarios judged</span>
            <span class="status-box" id="w6-l2-safe">0 / ${SAFE_TOTAL} safe workflows confirmed</span>
            <span class="status-box" id="w6-l2-leaks">0 / ${LEAK_TOTAL} leaks exposed</span>
            <span class="status-box" id="w6-l2-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w6-l2-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w6-l2-reset-btn" type="button">Reset Review</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">02</span>
        </div>

        <article class="panel w6-leak-panel">
          <div class="w6-level__panel-head">
            <div>
              <p class="eyebrow">Leakage Timeline</p>
              <h2 class="panel-title">A healthy pipeline splits first, then fits the preprocessing rules on train only</h2>
            </div>
            <p class="w6-level__microcopy">
              Safe workflows reinforce the forward train-to-test pattern. Leakage workflows reveal backward contamination from held-out data into preprocessing.
            </p>
          </div>

          <div class="w6-leak-stats" aria-label="Leakage Stats">
            <article class="w6-leak-stat">
              <span class="w6-leak-stat__label">Judged</span>
              <strong class="w6-leak-stat__value" id="w6-l2-judged-count">0</strong>
              <p class="w6-leak-stat__copy">Scenario calls locked so far.</p>
            </article>
            <article class="w6-leak-stat">
              <span class="w6-leak-stat__label">Safe Paths</span>
              <strong class="w6-leak-stat__value" id="w6-l2-safe-count">0</strong>
              <p class="w6-leak-stat__copy">Workflows that kept the split honest.</p>
            </article>
            <article class="w6-leak-stat">
              <span class="w6-leak-stat__label">Leaks Caught</span>
              <strong class="w6-leak-stat__value" id="w6-l2-leak-count">0</strong>
              <p class="w6-leak-stat__copy">Backward contamination exposed.</p>
            </article>
          </div>

          <div class="w6-leak-track" id="w6-l2-track" data-risk-state="neutral">
            <div class="w6-leak-track__main">
              <article class="w6-leak-node" data-node="raw">
                <p class="w6-leak-node__eyebrow">Input</p>
                <h3 class="w6-leak-node__title">Raw Data</h3>
              </article>
              <article class="w6-leak-node" data-node="split">
                <p class="w6-leak-node__eyebrow">Step 1</p>
                <h3 class="w6-leak-node__title">Split Train / Test</h3>
              </article>
              <article class="w6-leak-node" data-node="prep">
                <p class="w6-leak-node__eyebrow">Step 2</p>
                <h3 class="w6-leak-node__title">Fit Preprocessing</h3>
              </article>
              <article class="w6-leak-node" data-node="train">
                <p class="w6-leak-node__eyebrow">Step 3</p>
                <h3 class="w6-leak-node__title">Train Model</h3>
              </article>
              <article class="w6-leak-node" data-node="eval">
                <p class="w6-leak-node__eyebrow">Step 4</p>
                <h3 class="w6-leak-node__title">Evaluate</h3>
              </article>
            </div>

            <div class="w6-leak-track__flow" aria-hidden="true">
              <span class="w6-leak-track__forward"></span>
              <span class="w6-leak-track__backflow"></span>
            </div>

            <div class="w6-leak-track__branch" aria-hidden="true">
              <span class="w6-leak-track__branch-label">Test data should stay on this branch until transform time.</span>
            </div>
          </div>

          <div class="w6-leak-readout">
            <section class="card w6-leak-alert" id="w6-l2-alert" data-alert-tone="neutral">
              <p class="eyebrow">Risk Watch</p>
              <h3 class="panel-title" id="w6-l2-alert-title">No backward leak identified yet</h3>
              <p class="w6-level__microcopy" id="w6-l2-alert-copy">
                Safe calls reinforce the frozen train-only rule. Correct leakage calls light up the red backflow and show why the evaluation would look too optimistic.
              </p>
            </section>

            <section class="card w6-leak-meter" aria-label="Evaluation Signal">
              <p class="eyebrow">Evaluation Signal</p>
              <div class="w6-leak-meter__group">
                <div class="w6-leak-meter__label-row">
                  <span>Honest holdout</span>
                  <span id="w6-l2-honest-label">Stable</span>
                </div>
                <div class="w6-leak-meter__rail">
                  <span class="w6-leak-meter__fill w6-leak-meter__fill--honest" id="w6-l2-honest-fill"></span>
                </div>
              </div>
              <div class="w6-leak-meter__group">
                <div class="w6-leak-meter__label-row">
                  <span>Optimistic score</span>
                  <span id="w6-l2-optimistic-label">No leak inflation</span>
                </div>
                <div class="w6-leak-meter__rail">
                  <span class="w6-leak-meter__fill w6-leak-meter__fill--optimistic" id="w6-l2-optimistic-fill"></span>
                </div>
              </div>
            </section>
          </div>
        </article>

        <div class="w6-leak-grid">
          <section class="w6-leak-scenario-grid" aria-label="Leakage Scenarios">
            ${SCENARIOS.map((scenario, index) => {
              return `
                <article
                  class="scenario-card w6-leak-card"
                  data-scenario-id="${scenario.id}"
                  data-scenario-state="pending"
                  data-scenario-verdict="${scenario.verdict}"
                  style="--scenario-color:${scenario.color};"
                >
                  <div class="w6-leak-card__head">
                    <p class="w6-leak-card__eyebrow">Scenario ${index + 1} • ${escapeHtml(scenario.stage)}</p>
                    <h3 class="w6-leak-card__title">${escapeHtml(scenario.title)}</h3>
                    <p class="w6-leak-card__copy">${escapeHtml(scenario.copy)}</p>
                  </div>

                  <pre class="w6-leak-card__code"><code>${escapeHtml(scenario.snippet)}</code></pre>

                  <div class="w6-leak-card__actions">
                    ${this._verdictOrder.map(([verdictId, verdict]) => `
                      <button
                        class="btn btn--subtle w6-leak-choice"
                        type="button"
                        data-scenario-id="${scenario.id}"
                        data-scenario-choice="${verdictId}"
                      >
                        ${escapeHtml(verdict.label)}
                      </button>
                    `).join('')}
                  </div>

                  <section class="w6-leak-card__answer" data-answer-shell="${scenario.id}" hidden>
                    <div class="w6-leak-card__answer-head">
                      <span class="w6-leak-card__badge" data-answer-badge="${scenario.id}">
                        ${escapeHtml(verdictMeta(scenario.verdict).longLabel)}
                      </span>
                      <span class="w6-leak-card__note" data-answer-note="${scenario.id}">Judgment locked.</span>
                    </div>
                    <p class="w6-leak-card__answer-copy">${escapeHtml(scenario.explanation)}</p>
                    <p class="w6-leak-card__answer-impact">${escapeHtml(scenario.impact)}</p>
                    <p class="w6-leak-card__answer-rule">${escapeHtml(scenario.rule)}</p>
                  </section>
                </article>
              `;
            }).join('')}
          </section>

          <div class="w6-leak-side">
            <section class="card card--elevated w6-level__feedback" aria-live="polite">
              <p class="eyebrow">Coach Feed</p>
              <p id="w6-l2-feedback-text" class="w6-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
            </section>

            <section class="card w6-level__hint-box" id="w6-l2-hint-box" hidden>
              <p class="eyebrow">Hint</p>
              <p id="w6-l2-hint-text" class="w6-level__hint-copy"></p>
            </section>

            <section class="card w6-leak-rulecard" id="w6-l2-rulecard" data-rule-tone="neutral">
              <p class="eyebrow">Golden Rule</p>
              <h2 class="panel-title" id="w6-l2-rule-title">Fit on Train. Transform Both.</h2>
              <p class="w6-level__microcopy" id="w6-l2-rule-copy">
                Every scenario in this level collapses to one checkpoint: did the preprocessing rule learn from train only, or did held-out rows help define it?
              </p>
            </section>
          </div>
        </div>

        <section class="panel w6-leak-summary" id="w6-l2-summary" hidden aria-label="Leakage Summary">
          <div class="w6-level__panel-head">
            <div>
              <p class="eyebrow">Leakage Recap</p>
              <h2 class="panel-title">Holdout integrity depends on where the fit happened</h2>
            </div>
            <p class="w6-level__microcopy" id="w6-l2-summary-lead">${escapeHtml(SUMMARY_COPY)}</p>
          </div>

          <div class="w6-leak-summary__grid" id="w6-l2-summary-grid"></div>

          <div class="action-row">
            <span class="status-box" id="w6-l2-summary-score">Waiting for final review</span>
            <button class="btn btn--primary" id="w6-l2-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w6-l2-progress');
    this._ui.safeProgress = container.querySelector('#w6-l2-safe');
    this._ui.leakProgress = container.querySelector('#w6-l2-leaks');
    this._ui.status = container.querySelector('#w6-l2-status');
    this._ui.feedback = container.querySelector('#w6-l2-feedback-text');
    this._ui.hintBox = container.querySelector('#w6-l2-hint-box');
    this._ui.hintText = container.querySelector('#w6-l2-hint-text');
    this._ui.track = container.querySelector('#w6-l2-track');
    this._ui.alert = container.querySelector('#w6-l2-alert');
    this._ui.alertTitle = container.querySelector('#w6-l2-alert-title');
    this._ui.alertCopy = container.querySelector('#w6-l2-alert-copy');
    this._ui.honestFill = container.querySelector('#w6-l2-honest-fill');
    this._ui.honestLabel = container.querySelector('#w6-l2-honest-label');
    this._ui.optimisticFill = container.querySelector('#w6-l2-optimistic-fill');
    this._ui.optimisticLabel = container.querySelector('#w6-l2-optimistic-label');
    this._ui.judgedCount = container.querySelector('#w6-l2-judged-count');
    this._ui.safeCount = container.querySelector('#w6-l2-safe-count');
    this._ui.leakCount = container.querySelector('#w6-l2-leak-count');
    this._ui.rulecard = container.querySelector('#w6-l2-rulecard');
    this._ui.ruleTitle = container.querySelector('#w6-l2-rule-title');
    this._ui.ruleCopy = container.querySelector('#w6-l2-rule-copy');
    this._ui.summary = container.querySelector('#w6-l2-summary');
    this._ui.summaryLead = container.querySelector('#w6-l2-summary-lead');
    this._ui.summaryGrid = container.querySelector('#w6-l2-summary-grid');
    this._ui.summaryScore = container.querySelector('#w6-l2-summary-score');
    this._ui.finishButton = container.querySelector('#w6-l2-finish-btn');
    this._ui.cards = Array.from(container.querySelectorAll('.w6-leak-card'));

    this._syncAll();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      const choiceButton = event.target.closest('[data-scenario-choice]');
      if (choiceButton) {
        const scenarioId = choiceButton.getAttribute('data-scenario-id');
        const verdict = choiceButton.getAttribute('data-scenario-choice');
        this._answerScenario(scenarioId, verdict);
        return;
      }

      if (event.target.closest('#w6-l2-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w6-l2-reset-btn')) {
        this._resetReview();
        return;
      }

      if (event.target.closest('#w6-l2-finish-btn')) {
        if (this._completed && this._summary) {
          if (typeof this._engine.completeMCQ === 'function') {
            void this._engine.completeMCQ(this._summary);
          } else if (typeof this._engine.complete === 'function') {
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
    this._engine = null;
    this._container = null;
    this._events = null;
    this._results.clear();
    this._summary = null;
    this._ui = {};
  }

  _answerScenario(scenarioId, selected) {
    if (!scenarioId || !selected || this._results.has(scenarioId) || this._completed) return;

    const scenario = scenarioById(scenarioId);
    if (!scenario) return;

    const correct = selected === scenario.verdict;
    const result = {
      scenarioId,
      selected,
      correct,
      verdict: scenario.verdict,
    };

    this._results.set(scenarioId, result);
    this._lastSignal = correct ? scenario.verdict : 'review';

    if (correct) {
      this._engine.correct();
      if (scenario.verdict === 'leakage') {
        this._setFeedback(`Leak caught. ${scenario.explanation}`);
      } else {
        this._setFeedback(`Safe call. ${scenario.explanation}`);
      }
    } else {
      this._engine.mistake({ costsLife: false, countsMistake: true });
      this._setFeedback(`Review this workflow. ${scenario.explanation}`);
    }

    const answered = this._results.size;
    if (answered === TOTAL_SCENARIOS) {
      this._setStatus('All workflow calls are locked. Review the rule card and the recap below, then continue.');
    } else if (correct) {
      this._setStatus(`${scenario.title} checked. ${answered} / ${TOTAL_SCENARIOS} scenarios judged.`);
    } else {
      this._setStatus(`Judgment logged. ${answered} / ${TOTAL_SCENARIOS} scenarios judged. Keep checking where the fit happened.`);
    }

    this._syncAll();

    if (answered === TOTAL_SCENARIOS) {
      this._completeReview();
    }
  }

  _completeReview() {
    this._summary = buildSummary(this._results);
    this._completed = true;

    if (this._ui.summaryLead) {
      this._ui.summaryLead.textContent = resultTone(this._summary);
    }

    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = `${this._summary.correct} / ${this._summary.total} correct`;
    }

    if (this._ui.summaryGrid) {
      this._ui.summaryGrid.innerHTML = this._summary.results.map(result => {
        const scenario = scenarioById(result.scenarioId);
        const verdict = verdictMeta(scenario?.verdict ?? 'safe');
        return `
          <article
            class="w6-leak-summary__card"
            data-summary-state="${result.correct ? 'correct' : 'review'}"
            style="--scenario-color:${scenario?.color ?? 'var(--color-world-6)'};"
          >
            <div class="w6-leak-summary__meta">
              <span class="w6-leak-summary__badge">${escapeHtml(verdict.longLabel)}</span>
              <span class="w6-leak-summary__score">${result.correct ? 'Correct' : 'Review'}</span>
            </div>
            <h3 class="w6-leak-summary__title">${escapeHtml(scenario?.title ?? result.scenarioId)}</h3>
            <p class="w6-leak-summary__copy">${escapeHtml(scenario?.rule ?? '')}</p>
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

    this._setFeedback(resultTone(this._summary));
    this._setStatus(resultStatus(this._summary));
    this._lastSignal = this._summary.leakCorrect > 0 ? 'leakage' : 'safe';
    this._syncAll();
  }

  _resetReview() {
    this._results.clear();
    this._summary = null;
    this._completed = false;
    this._lastSignal = 'neutral';

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

    if (this._ui.summaryGrid) {
      this._ui.summaryGrid.innerHTML = '';
    }

    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = 'Waiting for final review';
    }

    if (this._ui.summaryLead) {
      this._ui.summaryLead.textContent = SUMMARY_COPY;
    }

    this._setFeedback(DEFAULT_FEEDBACK);
    this._setStatus(DEFAULT_STATUS);
    this._syncAll();
  }

  _showHint() {
    const { allowed, text } = this._engine.requestHint();
    if (!allowed || !text) return;

    this._ui.hintBox?.removeAttribute('hidden');
    if (this._ui.hintText) {
      this._ui.hintText.textContent = text;
    }
  }

  _syncAll() {
    this._syncProgress();
    this._syncCards();
    this._syncTimeline();
    this._syncRuleCard();
  }

  _syncProgress() {
    const answered = this._results.size;
    const safeCorrect = countCorrectVerdict(this._results, 'safe');
    const leakCorrect = countCorrectVerdict(this._results, 'leakage');

    if (this._ui.progress) {
      this._ui.progress.textContent = `${answered} / ${TOTAL_SCENARIOS} scenarios judged`;
    }

    if (this._ui.safeProgress) {
      this._ui.safeProgress.textContent = `${safeCorrect} / ${SAFE_TOTAL} safe workflows confirmed`;
    }

    if (this._ui.leakProgress) {
      this._ui.leakProgress.textContent = `${leakCorrect} / ${LEAK_TOTAL} leaks exposed`;
    }

    if (this._ui.judgedCount) {
      this._ui.judgedCount.textContent = String(answered);
    }

    if (this._ui.safeCount) {
      this._ui.safeCount.textContent = String(safeCorrect);
    }

    if (this._ui.leakCount) {
      this._ui.leakCount.textContent = String(leakCorrect);
    }

    if (this._ui.finishButton) {
      this._ui.finishButton.disabled = !this._completed;
    }
  }

  _syncCards() {
    this._ui.cards?.forEach(card => {
      const scenarioId = card.getAttribute('data-scenario-id');
      const scenario = scenarioById(scenarioId);
      const result = this._results.get(scenarioId);
      const answerShell = card.querySelector(`[data-answer-shell="${scenarioId}"]`);
      const answerNote = card.querySelector(`[data-answer-note="${scenarioId}"]`);
      const buttons = Array.from(card.querySelectorAll('[data-scenario-choice]'));

      if (!scenario || !result) {
        card.dataset.scenarioState = 'pending';
        answerShell?.setAttribute('hidden', '');
        buttons.forEach(button => {
          button.disabled = false;
          button.dataset.choiceState = 'idle';
        });
        return;
      }

      card.dataset.scenarioState = result.correct ? `locked-${scenario.verdict}` : `review-${scenario.verdict}`;
      answerShell?.removeAttribute('hidden');

      if (answerNote) {
        if (result.correct && scenario.verdict === 'safe') {
          answerNote.textContent = 'You protected the holdout correctly.';
        } else if (result.correct) {
          answerNote.textContent = 'You exposed the backward leak.';
        } else {
          answerNote.textContent = `Correct answer: ${verdictMeta(scenario.verdict).longLabel}.`;
        }
      }

      buttons.forEach(button => {
        const verdict = button.getAttribute('data-scenario-choice');
        button.disabled = true;

        if (verdict === scenario.verdict) {
          button.dataset.choiceState = 'correct';
        } else if (verdict === result.selected) {
          button.dataset.choiceState = 'wrong';
        } else {
          button.dataset.choiceState = 'muted';
        }
      });
    });
  }

  _syncTimeline() {
    const safeCorrect = countCorrectVerdict(this._results, 'safe');
    const leakCorrect = countCorrectVerdict(this._results, 'leakage');

    if (this._ui.track) {
      this._ui.track.dataset.riskState = leakCorrect > 0 ? 'warning' : safeCorrect > 0 ? 'safe' : 'neutral';
    }

    if (this._ui.alert) {
      if (this._lastSignal === 'leakage') {
        this._ui.alert.dataset.alertTone = 'leakage';
        this._ui.alertTitle.textContent = 'Backward contamination exposed';
        this._ui.alertCopy.textContent = 'A preprocessing statistic learned from held-out rows and then flowed backward into the train-time rule. That makes the evaluation look safer than reality.';
      } else if (this._lastSignal === 'safe') {
        this._ui.alert.dataset.alertTone = 'safe';
        this._ui.alertTitle.textContent = 'Train-only fit confirmed';
        this._ui.alertCopy.textContent = 'The workflow split first, learned the transform on train only, and then reused that frozen rule on test without refitting.';
      } else if (this._lastSignal === 'review') {
        this._ui.alert.dataset.alertTone = 'review';
        this._ui.alertTitle.textContent = 'Re-check where the fit happened';
        this._ui.alertCopy.textContent = 'The dangerous part is rarely the transform itself. The risk lives in whether held-out rows helped define the preprocessing statistic.';
      } else {
        this._ui.alert.dataset.alertTone = 'neutral';
        this._ui.alertTitle.textContent = 'No backward leak identified yet';
        this._ui.alertCopy.textContent = 'Safe calls reinforce the frozen train-only rule. Correct leakage calls light up the red backflow and show why the evaluation would look too optimistic.';
      }
    }

    if (this._ui.honestFill) {
      this._ui.honestFill.style.width = `${Math.min(96, 34 + safeCorrect * 20)}%`;
    }

    if (this._ui.optimisticFill) {
      this._ui.optimisticFill.style.width = `${leakCorrect ? Math.min(96, 48 + leakCorrect * 20) : 20}%`;
    }

    if (this._ui.honestLabel) {
      this._ui.honestLabel.textContent = safeCorrect
        ? `${safeCorrect} stable workflow${safeCorrect === 1 ? '' : 's'} confirmed`
        : 'Waiting for train-only confirmation';
    }

    if (this._ui.optimisticLabel) {
      this._ui.optimisticLabel.textContent = leakCorrect
        ? `${leakCorrect} inflated workflow${leakCorrect === 1 ? '' : 's'} exposed`
        : 'No leak inflation';
    }
  }

  _syncRuleCard() {
    if (!this._ui.rulecard || !this._ui.ruleTitle || !this._ui.ruleCopy) return;

    if (this._completed) {
      this._ui.rulecard.dataset.ruleTone = 'locked';
      this._ui.ruleTitle.textContent = 'Fit on Train. Transform Both.';
      this._ui.ruleCopy.textContent = 'This is the production habit to keep: split first, fit every imputer, scaler, and encoder on train only, then reuse that frozen rule on every other split.';
      return;
    }

    if (this._lastSignal === 'leakage') {
      this._ui.rulecard.dataset.ruleTone = 'leakage';
      this._ui.ruleTitle.textContent = 'Leakage Means Test Helped Define the Rule';
      this._ui.ruleCopy.textContent = 'If the imputer, scaler, encoder, or frequency table was estimated using held-out rows, the evaluation has already seen the future.';
      return;
    }

    if (this._lastSignal === 'safe') {
      this._ui.rulecard.dataset.ruleTone = 'safe';
      this._ui.ruleTitle.textContent = 'Safe Means the Rule Was Frozen on Train';
      this._ui.ruleCopy.textContent = 'The test split is allowed to be transformed, but it is never allowed to teach the preprocessing step what statistic or mapping to use.';
      return;
    }

    if (this._lastSignal === 'review') {
      this._ui.rulecard.dataset.ruleTone = 'review';
      this._ui.ruleTitle.textContent = 'Start with the Split Boundary';
      this._ui.ruleCopy.textContent = 'When a workflow feels ambiguous, ignore the operation name and ask a simpler question: were the fit statistics learned before or after the split?';
      return;
    }

    this._ui.rulecard.dataset.ruleTone = 'neutral';
    this._ui.ruleTitle.textContent = 'Fit on Train. Transform Both.';
    this._ui.ruleCopy.textContent = 'Every scenario in this level collapses to one checkpoint: did the preprocessing rule learn from train only, or did held-out rows help define it?';
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
}
