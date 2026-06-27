'use strict';

import { getLevelProblem } from '../../data/problems.js';
import { MCQWidget } from '../../widgets/mcq.js';

const PROBLEM = getLevelProblem(5, 6);
const LEVEL_TITLE = PROBLEM?.title ?? 'MCQ - Scaling';
const LEVEL_OBJECTIVE = PROBLEM?.objective ?? 'Review scaling formulas, model compatibility, and log-transform intuition.';

const FALLBACK_QUESTIONS = Object.freeze([
  Object.freeze({
    id: 'minmax-formula',
    type: 'single',
    prompt: 'Which formula maps a feature into the 0 to 1 interval?',
    options: [
      { id: 'zero-one', text: "x' = (x - min) / (max - min)", correct: true },
      { id: 'mean-sigma', text: "x' = (x - mean) / sigma", correct: false },
      { id: 'log1p', text: "x' = log(x + 1)", correct: false },
      { id: 'raw-divide-max', text: "x' = x / max", correct: false },
    ],
    explanation: 'MinMax scaling subtracts the column minimum, then divides by the full range so the smallest value becomes 0 and the largest becomes 1.',
  }),
  Object.freeze({
    id: 'zscore-formula',
    type: 'single',
    prompt: 'Which expression computes a z score for a value x?',
    options: [
      { id: 'x-minus-mean-over-sigma', text: 'z = (x - mean) / sigma', correct: true },
      { id: 'x-minus-min-over-range', text: 'z = (x - min) / (max - min)', correct: false },
      { id: 'sigma-over-x-minus-mean', text: 'z = sigma / (x - mean)', correct: false },
      { id: 'x-over-mean', text: 'z = x / mean', correct: false },
    ],
    explanation: 'A z score measures how many standard deviations a value sits above or below the mean.',
  }),
  Object.freeze({
    id: 'scaling-choice',
    type: 'single',
    prompt: 'You are training KNN on Age (18-60) and Salary (1000-80000). Which first move is healthiest when you want both axes to contribute on a shared bounded range?',
    options: [
      { id: 'minmax', text: 'Apply MinMax scaling to the numeric features', correct: true },
      { id: 'zscore', text: 'Apply Z-score only because bounded ranges never matter', correct: false },
      { id: 'noscale', text: 'Leave both features unscaled because KNN is threshold-based', correct: false },
      { id: 'onehot', text: 'One-hot encode the numeric columns first', correct: false },
    ],
    explanation: 'KNN is distance-based, so MinMax is a healthy first choice when you specifically want every feature living on a shared 0 to 1 scale.',
  }),
  Object.freeze({
    id: 'log-use-case',
    type: 'single',
    prompt: 'Which feature is the best candidate for `log(x + 1)`?',
    options: [
      { id: 'purchase-count', text: 'Purchase_Count with a heavy right tail and many small values', correct: true },
      { id: 'already-normal-age', text: 'Age, which is already close to a normal bell shape', correct: false },
      { id: 'binary-flag', text: 'A 0 or 1 missing-indicator column', correct: false },
      { id: 'ordered-rating', text: 'An ordinal satisfaction label encoded as 0, 1, 2', correct: false },
    ],
    explanation: 'Log transform is healthiest when a valid numeric feature has a long right tail that needs compression without deleting rows.',
  }),
  Object.freeze({
    id: 'linear-impact',
    type: 'single',
    prompt: 'Why can scaling help linear regression, especially when regularization is involved?',
    options: [
      { id: 'fair-regularization', text: 'Because coefficients and penalties become more comparable when the input features share a similar scale', correct: true },
      { id: 'turns-linear-into-tree', text: 'Because scaling turns linear regression into a threshold-based tree model', correct: false },
      { id: 'removes-missing', text: 'Because scaling automatically repairs missing numeric values', correct: false },
      { id: 'guarantees-causality', text: 'Because scaling guarantees the learned coefficients become causal effects', correct: false },
    ],
    explanation: 'When raw units are wildly different, regularization can punish some coefficients unfairly. Scaling makes the comparison between coefficients more balanced.',
  }),
  Object.freeze({
    id: 'zscore-calc',
    type: 'single',
    prompt: 'A value x = 30 sits in a column with mean = 20 and sigma = 5. What is its z score?',
    options: [
      { id: 'two', text: '2', correct: true },
      { id: 'minus-two', text: '-2', correct: false },
      { id: 'half', text: '0.5', correct: false },
      { id: 'ten', text: '10', correct: false },
    ],
    explanation: 'First center the value: 30 - 20 = 10. Then divide by sigma 5, which gives a z score of 2.',
  }),
]);

const QUESTIONS = Array.isArray(PROBLEM?.questions) && PROBLEM.questions.length
  ? PROBLEM.questions
  : FALLBACK_QUESTIONS;

const QUESTION_META = Object.freeze({
  'minmax-formula': {
    label: 'MinMax Formula',
    chapter: '0-1 Range',
    color: 'var(--color-world-5)',
    recap: 'MinMax scaling uses the column minimum and maximum so the full feature gets squeezed into a shared 0 to 1 interval.',
  },
  'zscore-formula': {
    label: 'Z-Score Formula',
    chapter: 'Mean and Sigma',
    color: 'var(--color-warning)',
    recap: 'Standardization centers a feature at the mean, then measures each value in standard deviation units.',
  },
  'scaling-choice': {
    label: 'Method Choice',
    chapter: 'Model Fit',
    color: 'var(--color-world-1)',
    recap: 'Distance-based models often need a shared range first because one oversized axis can dominate the distance calculation.',
  },
  'log-use-case': {
    label: 'Log Transform',
    chapter: 'Skew Control',
    color: 'var(--color-success)',
    recap: 'Log transform is for valid heavy right tails, not for columns that already look balanced or for binary flags.',
  },
  'linear-impact': {
    label: 'Linear Impact',
    chapter: 'Coefficient Fairness',
    color: 'var(--color-world-4)',
    recap: 'Scaling can make coefficient comparison and regularization behavior much fairer when raw feature units start far apart.',
  },
  'zscore-calc': {
    label: 'Quick Calculation',
    chapter: 'Standardized Value',
    color: 'var(--color-danger)',
    recap: 'A z score always follows the same two moves: subtract the mean, then divide by sigma.',
  },
});

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM?.hints ?? []),
  'If the question is about a shared bounded range from 0 to 1, think MinMax.',
  'If the question is about centering at zero and measuring in standard deviations, think Z-score.',
  'If the feature has a valid heavy right tail, log transform is the candidate to keep in mind.',
]);

const DEFAULT_FEEDBACK = 'Confirm each answer, then use the explanation to tighten the scaling rule before you continue into code.';
const DEFAULT_STATUS = 'Answer each question once. Review appears immediately after you confirm.';
const NEXT_LEVEL_COPY = 'The next level turns these choices into code: normalize the bounded feature, standardize the broad linear feature, and log-transform the heavy right tail in one combined dataset.';
const SUMMARY_LOCKED_COPY = 'Finish the quiz to unlock the recap and continue forward.';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function metaFor(questionId) {
  return QUESTION_META[questionId] ?? {
    label: questionId,
    chapter: 'Scaling Review',
    color: 'var(--color-world-5)',
    recap: 'Review the explanation and lock the scaling rule before you continue.',
  };
}

function resultTone(summary) {
  if (!summary) return DEFAULT_FEEDBACK;
  if (summary.perfect) {
    return 'Perfect review. The scaling toolkit is stable, and the final World 5 code lab is ready for you.';
  }
  if (summary.correct >= Math.ceil(summary.total * 0.7)) {
    return 'Strong review. Use the recap cards below to tighten the few scaling rules that still need one more pass.';
  }
  return 'Useful checkpoint. The recap cards below show which scaling ideas to keep in view before you move into code.';
}

function resultStatus(summary) {
  if (!summary) return DEFAULT_STATUS;
  return `Review complete. ${summary.correct} / ${summary.total} answers landed correctly.`;
}

export default class World5Level6 {
  meta = {
    title: LEVEL_TITLE,
    subtitle: LEVEL_OBJECTIVE,
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._events = null;
    this._widget = null;
    this._results = new Map();
    this._summary = null;
    this._completed = false;
    this._ui = {};
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w5-level w5-level--quickcheck screen-section" aria-label="World 5 Level 6">
        <div class="level-hero w5-level__hero" style="--world-color: var(--color-world-5);">
          <p class="eyebrow">World 5 - Scaling</p>
          <h1 class="level-hero__title">${escapeHtml(LEVEL_TITLE)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(LEVEL_OBJECTIVE)}
            This review checks whether you can move between formulas, model fit, log-transform judgment, and quick standardization math before the code challenge begins.
          </p>
          <div class="action-row">
            <span class="status-box" id="w5-l6-progress">0 / ${QUESTIONS.length} questions answered</span>
            <span class="status-box" id="w5-l6-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w5-l6-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w5-l6-reset-btn" type="button">Reset Quiz</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">06</span>
        </div>

        <div class="w5-quickcheck-grid">
          <article class="panel w5-quickcheck-stage">
            <div class="w5-level__panel-head">
              <div>
                <p class="eyebrow">Scaling Review</p>
                <h2 class="panel-title">One pass across formulas, model compatibility, skew control, and quick math</h2>
              </div>
              <p class="w5-level__microcopy">
                Reset rewinds the local quiz flow so you can replay it, but hints and wrong answers still count for the current run.
              </p>
            </div>

            <div class="w5-quickcheck-widget" id="w5-l6-quiz"></div>
          </article>

          <div class="w5-quickcheck-side">
            <section class="panel w5-quickcheck-tracker" aria-label="Review Tracker">
              <div class="w5-level__panel-head">
                <div>
                  <p class="eyebrow">Review Tracker</p>
                  <h2 class="panel-title">Watch each scaling rule lock in</h2>
                </div>
                <p class="w5-level__microcopy">
                  Each card previews a decision that returns immediately in the World 5 code lab.
                </p>
              </div>

              <div class="w5-quickcheck-tracker__list">
                ${QUESTIONS.map((question, index) => {
                  const meta = metaFor(question.id);
                  return `
                    <article
                      class="w5-quickcheck-card"
                      data-question-id="${question.id}"
                      data-question-state="pending"
                      style="--topic-color: ${meta.color};"
                    >
                      <div class="w5-quickcheck-card__meta">
                        <span class="w5-quickcheck-card__status" data-question-status="${question.id}">Pending</span>
                        <span class="w5-quickcheck-card__index">Q${index + 1}</span>
                      </div>
                      <h3 class="w5-quickcheck-card__title">${escapeHtml(meta.label)}</h3>
                      <p class="w5-quickcheck-card__chapter">${escapeHtml(meta.chapter)}</p>
                      <p class="w5-quickcheck-card__copy">${escapeHtml(meta.recap)}</p>
                    </article>
                  `;
                }).join('')}
              </div>
            </section>

            <section class="panel w5-quickcheck-sidecar" aria-label="Coach Feed">
              <div class="card card--elevated w5-level__feedback" aria-live="polite">
                <p class="eyebrow">Coach Feed</p>
                <p id="w5-l6-feedback-text" class="w5-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
              </div>

              <div class="card w5-level__hint-box" id="w5-l6-hint-box" hidden>
                <p class="eyebrow">Hint</p>
                <p id="w5-l6-hint-text" class="w5-level__hint-copy"></p>
              </div>

              <div class="card w5-quickcheck-unlock">
                <p class="eyebrow">Next Challenge</p>
                <h2 class="panel-title">Code Fix - Scaling</h2>
                <p class="w5-level__microcopy">${escapeHtml(NEXT_LEVEL_COPY)}</p>
              </div>
            </section>
          </div>
        </div>

        <section class="panel w5-quickcheck-summary" id="w5-l6-summary" hidden aria-label="Review Summary">
          <div class="w5-level__panel-head">
            <div>
              <p class="eyebrow">Review Summary</p>
              <h2 class="panel-title">Your scaling readout</h2>
            </div>
            <p class="w5-level__microcopy" id="w5-l6-summary-lead">
              ${escapeHtml(SUMMARY_LOCKED_COPY)}
            </p>
          </div>

          <div class="w5-quickcheck-summary__grid" id="w5-l6-summary-grid"></div>

          <div class="action-row">
            <span class="status-box" id="w5-l6-summary-score">Waiting for final review</span>
            <button class="btn btn--primary" id="w5-l6-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w5-l6-progress');
    this._ui.status = container.querySelector('#w5-l6-status');
    this._ui.feedback = container.querySelector('#w5-l6-feedback-text');
    this._ui.hintBox = container.querySelector('#w5-l6-hint-box');
    this._ui.hintText = container.querySelector('#w5-l6-hint-text');
    this._ui.quizHost = container.querySelector('#w5-l6-quiz');
    this._ui.summary = container.querySelector('#w5-l6-summary');
    this._ui.summaryLead = container.querySelector('#w5-l6-summary-lead');
    this._ui.summaryGrid = container.querySelector('#w5-l6-summary-grid');
    this._ui.summaryScore = container.querySelector('#w5-l6-summary-score');
    this._ui.finishButton = container.querySelector('#w5-l6-finish-btn');
    this._ui.trackerCards = Array.from(container.querySelectorAll('[data-question-id]'));

    this._mountWidget();
    this._syncProgress();
    this._syncTracker();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w5-l6-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w5-l6-reset-btn')) {
        this._resetQuiz();
        return;
      }

      if (event.target.closest('#w5-l6-finish-btn')) {
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
    this._widget?.destroy();
    this._widget = null;
    this._engine = null;
    this._container = null;
    this._events = null;
    this._results.clear();
    this._summary = null;
    this._ui = {};
  }

  _mountWidget() {
    this._widget?.destroy();
    this._ui.quizHost.innerHTML = '';

    this._widget = new MCQWidget(this._ui.quizHost, {
      questions: QUESTIONS,
      worldColor: 'var(--color-world-5)',
      onAnswer: result => this._handleAnswer(result),
      onComplete: summary => this._handleComplete(summary),
    });
  }

  _handleAnswer(result) {
    const question = metaFor(result.questionId);
    this._results.set(result.questionId, result);

    if (result.correct) {
      this._engine.correct();
      this._setFeedback(`Correct. ${result.explanation}`);
    } else {
      this._engine.mistake({ costsLife: false, countsMistake: true });
      this._setFeedback(`Review this one. ${result.explanation}`);
    }

    const answered = this._results.size;
    if (answered === QUESTIONS.length) {
      this._setStatus('All answers are locked. Press Continue inside the quiz to finish the review.');
    } else if (question) {
      this._setStatus(`${question.label} checked. ${answered} / ${QUESTIONS.length} questions answered.`);
    }

    this._syncProgress();
    this._syncTracker();
  }

  _handleComplete(summary) {
    this._summary = summary;
    this._completed = true;

    if (this._ui.summaryLead) {
      this._ui.summaryLead.textContent = resultTone(summary);
    }

    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = `${summary.correct} / ${summary.total} correct`;
    }

    if (this._ui.summaryGrid) {
      this._ui.summaryGrid.innerHTML = summary.results.map(result => {
        const meta = metaFor(result.questionId);
        return `
          <article
            class="w5-quickcheck-summary__card"
            data-summary-state="${result.correct ? 'correct' : 'review'}"
            style="--topic-color: ${meta.color};"
          >
            <p class="w5-quickcheck-summary__kicker">${escapeHtml(meta.chapter)}</p>
            <div class="w5-quickcheck-summary__meta">
              <span class="w5-quickcheck-summary__state">${result.correct ? 'Locked In' : 'Review'}</span>
              <span class="w5-quickcheck-summary__topic">${escapeHtml(meta.label)}</span>
            </div>
            <p class="w5-quickcheck-summary__copy">${escapeHtml(result.explanation)}</p>
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

    this._setFeedback(resultTone(summary));
    this._setStatus(resultStatus(summary));
    this._syncProgress();
    this._syncTracker();
  }

  _resetQuiz() {
    this._results.clear();
    this._summary = null;
    this._completed = false;
    this._widget?.restart();

    if (this._ui.summary) {
      this._ui.summary.hidden = true;
      this._ui.summary.classList.remove('is-revealed');
    }

    if (this._ui.summaryGrid) {
      this._ui.summaryGrid.innerHTML = '';
    }

    if (this._ui.summaryLead) {
      this._ui.summaryLead.textContent = SUMMARY_LOCKED_COPY;
    }

    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = 'Waiting for final review';
    }

    this._setFeedback(DEFAULT_FEEDBACK);
    this._setStatus(DEFAULT_STATUS);
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

  _syncProgress() {
    const answered = this._results.size;
    const correct = Array.from(this._results.values()).filter(result => result.correct).length;

    if (this._ui.progress) {
      if (this._completed && this._summary) {
        this._ui.progress.textContent = `${this._summary.correct} / ${this._summary.total} correct`;
      } else {
        this._ui.progress.textContent = `${answered} / ${QUESTIONS.length} questions answered`;
      }
    }

    if (this._ui.finishButton) {
      this._ui.finishButton.disabled = !this._completed;
    }

    if (!this._completed && answered > 0 && answered < QUESTIONS.length) {
      this._setStatus(`${correct} correct so far, ${answered - correct} to revisit.`);
    }
  }

  _syncTracker() {
    this._ui.trackerCards.forEach(card => {
      const questionId = card.getAttribute('data-question-id');
      const result = this._results.get(questionId);
      const status = card.querySelector(`[data-question-status="${questionId}"]`);

      if (!result) {
        card.setAttribute('data-question-state', 'pending');
        if (status) status.textContent = 'Pending';
        return;
      }

      card.setAttribute('data-question-state', result.correct ? 'correct' : 'review');
      if (status) {
        status.textContent = result.correct ? 'Locked In' : 'Review';
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
