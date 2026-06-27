'use strict';

import { getLevelProblem } from '../../data/problems.js';
import { MCQWidget } from '../../widgets/mcq.js';

const PROBLEM = getLevelProblem(3, 5);
const LEVEL_TITLE = 'MCQ - Outliers';
const LEVEL_OBJECTIVE = 'Review the main outlier concepts before the code level.';

const FALLBACK_QUESTIONS = Object.freeze([
  Object.freeze({
    id: 'iqr-formula',
    type: 'single',
    prompt: 'Which formula gives the interquartile range?',
    options: [
      { id: 'q3-minus-q1', text: 'IQR = Q3 - Q1', correct: true },
      { id: 'q3-plus-q1', text: 'IQR = Q3 + Q1', correct: false },
      { id: 'median-minus-q1', text: 'IQR = median - Q1', correct: false },
      { id: 'max-minus-min', text: 'IQR = max - min', correct: false },
    ],
    explanation: 'IQR measures the spread of the middle 50 percent, so it is the distance from Q1 to Q3.',
  }),
  Object.freeze({
    id: 'zscore-formula',
    type: 'single',
    prompt: 'Which expression computes the z score for a value x?',
    options: [
      { id: 'x-minus-mu-over-sigma', text: 'z = (x - mu) / sigma', correct: true },
      { id: 'mu-minus-x-over-sigma', text: 'z = (mu - x) / sigma', correct: false },
      { id: 'x-over-mu', text: 'z = x / mu', correct: false },
      { id: 'x-minus-q3-over-iqr', text: 'z = (x - Q3) / IQR', correct: false },
    ],
    explanation: 'A z score measures how many standard deviations a value sits away from the mean.',
  }),
  Object.freeze({
    id: 'treatment-match',
    type: 'match',
    prompt: 'Match each outlier scenario to the safest first treatment.',
    explanation: 'The best treatment depends on whether the extreme point is wrong, merely too influential, or part of a wider skewed feature.',
    pairs: [
      {
        id: 'logging-bug',
        prompt: 'The extreme row came from a duplicated checkout event and the record is confirmed broken.',
        correct: 'Suppress it',
        options: ['Suppress it', 'Cap it', 'Log-transform the full feature'],
      },
      {
        id: 'vip-customer',
        prompt: 'The whale customer is real, but one row should not dominate the model.',
        correct: 'Cap it',
        options: ['Suppress it', 'Cap it', 'Log-transform the full feature'],
      },
      {
        id: 'persistent-skew',
        prompt: 'All values are plausible, but the whole feature keeps a long right tail.',
        correct: 'Log-transform the full feature',
        options: ['Suppress it', 'Cap it', 'Log-transform the full feature'],
      },
    ],
  }),
  Object.freeze({
    id: 'linear-vs-tree',
    type: 'single',
    prompt: 'If one extreme salary stays untreated, which model family is usually more sensitive to it?',
    options: [
      { id: 'linear', text: 'Linear or distance-based models', correct: true },
      { id: 'tree', text: 'Tree-based models only', correct: false },
      { id: 'none', text: 'Neither family is affected', correct: false },
      { id: 'all-same', text: 'Both families are affected in exactly the same way', correct: false },
    ],
    explanation: 'Linear and distance-based models can be pulled strongly by extreme scale, while tree models are often less sensitive because they split on thresholds.',
  }),
  Object.freeze({
    id: 'boxplot-reading',
    type: 'single',
    prompt: 'A boxplot ends its upper whisker at 36 and shows one separate point at 89. What does that point most likely represent?',
    options: [
      { id: 'outlier', text: 'An outlier beyond the upper fence', correct: true },
      { id: 'median', text: 'The median of the dataset', correct: false },
      { id: 'q3', text: 'The third quartile', correct: false },
      { id: 'missing', text: 'A missing value marker', correct: false },
    ],
    explanation: 'In a boxplot, isolated points beyond the whiskers represent observations that fall outside the normal fence range.',
  }),
  Object.freeze({
    id: 'skew-method-choice',
    type: 'single',
    prompt: 'When a numeric feature is heavily right-skewed rather than nearly normal, which outlier rule is usually safer?',
    options: [
      { id: 'iqr', text: 'The IQR rule', correct: true },
      { id: 'zscore', text: 'The z-score rule only', correct: false },
      { id: 'mean-only', text: 'Comparing each value to the mean only', correct: false },
      { id: 'drop-largest', text: 'Dropping the single largest value by default', correct: false },
    ],
    explanation: 'IQR is usually safer on skewed distributions because it depends on quartiles rather than the mean and standard deviation that the extreme point can distort.',
  }),
]);

const QUESTIONS = Array.isArray(PROBLEM?.questions) && PROBLEM.questions.length
  ? PROBLEM.questions
  : FALLBACK_QUESTIONS;

const QUESTION_META = Object.freeze({
  'iqr-formula': {
    label: 'IQR Formula',
    chapter: 'Quartile Spread',
    color: 'var(--color-world-3)',
    recap: 'IQR is the distance from Q1 to Q3, so it tracks the middle half of the distribution rather than the full range.',
  },
  'zscore-formula': {
    label: 'Z Score Formula',
    chapter: 'Standardized Distance',
    color: 'var(--color-world-1)',
    recap: 'A z score turns a raw value into distance from the mean measured in standard deviation units.',
  },
  'treatment-match': {
    label: 'Treatment Choice',
    chapter: 'Suppress / Cap / Log',
    color: 'var(--color-warning)',
    recap: 'Good outlier treatment depends on what the point means, not on one favorite repair method.',
  },
  'linear-vs-tree': {
    label: 'Model Sensitivity',
    chapter: 'Linear vs Tree',
    color: 'var(--color-success)',
    recap: 'Extreme scale usually distorts linear and distance-based models more than tree models that split on thresholds.',
  },
  'boxplot-reading': {
    label: 'Boxplot Reading',
    chapter: 'Visual Detection',
    color: 'var(--color-danger)',
    recap: 'A lone point beyond the whiskers is the boxplot way of saying the observation sits outside the normal fence range.',
  },
  'skew-method-choice': {
    label: 'Skew Rule',
    chapter: 'IQR vs Z Score',
    color: 'var(--color-world-5)',
    recap: 'Skewed distributions usually push you toward IQR because quartiles stay steadier than the mean and standard deviation.',
  },
});

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM?.hints ?? []),
  'Quartiles stay steadier than mean and standard deviation when one extreme point drags the tail hard to the right.',
  'If a boxplot shows a separate point beyond the whisker, read it as a fence breach rather than a summary statistic.',
]);

const DEFAULT_FEEDBACK = 'Confirm each answer, then use the explanation to tighten the outlier rule before the code lab.';
const DEFAULT_STATUS = 'Answer each question once. Review appears immediately after you confirm.';
const NEXT_LEVEL_COPY = 'The next level turns detection into code: inspect the stats, compute the fences, then suppress or cap the right columns with pandas-like commands.';

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
    chapter: 'Outlier Review',
    color: 'var(--color-world-3)',
    recap: 'Review the explanation and lock the concept before you continue.',
  };
}

function resultTone(summary) {
  if (!summary) return DEFAULT_FEEDBACK;
  if (summary.perfect) {
    return 'Perfect review. The outlier toolkit is locked, and the code lab is ready for you.';
  }
  if (summary.correct >= Math.ceil(summary.total * 0.7)) {
    return 'Strong review. Use the recap cards below to tighten the few outlier judgments that still need one more glance.';
  }
  return 'Useful checkpoint. The recap cards below show which outlier ideas to keep in view before you write the fixes in code.';
}

function resultStatus(summary) {
  if (!summary) return DEFAULT_STATUS;
  return `Review complete. ${summary.correct} / ${summary.total} answers landed correctly.`;
}

export default class World3Level5 {
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
      <section class="w3-level w3-level--quickcheck screen-section" aria-label="World 3 Level 5">
        <div class="level-hero w3-level__hero" style="--world-color: var(--color-world-3);">
          <p class="eyebrow">World 3 - Outliers</p>
          <h1 class="level-hero__title">${escapeHtml(LEVEL_TITLE)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(LEVEL_OBJECTIVE)}
            This review checks whether you can move between formulas, visual detection, treatment choice, and model impact before the code challenge begins.
          </p>
          <div class="action-row">
            <span class="status-box" id="w3-l5-progress">0 / ${QUESTIONS.length} questions answered</span>
            <span class="status-box" id="w3-l5-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w3-l5-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w3-l5-reset-btn" type="button">Reset Quiz</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">05</span>
        </div>

        <div class="w3-quickcheck-grid">
          <article class="panel w3-quickcheck-stage">
            <div class="w3-level__panel-head">
              <div>
                <p class="eyebrow">Outlier Review</p>
                <h2 class="panel-title">One pass across formulas, treatment choice, model behavior, and visual reading</h2>
              </div>
              <p class="w3-level__microcopy">
                Reset rewinds the local quiz flow so you can replay it, but hints and wrong answers still count for the current run.
              </p>
            </div>

            <div class="w3-quickcheck-widget" id="w3-l5-quiz"></div>
          </article>

          <div class="w3-quickcheck-side">
            <section class="panel w3-quickcheck-tracker" aria-label="Review Tracker">
              <div class="w3-level__panel-head">
                <div>
                  <p class="eyebrow">Review Tracker</p>
                  <h2 class="panel-title">Watch each outlier concept lock in</h2>
                </div>
                <p class="w3-level__microcopy">
                  Each card previews a rule that immediately returns in the World 3 code lab.
                </p>
              </div>

              <div class="w3-quickcheck-tracker__list">
                ${QUESTIONS.map((question, index) => {
                  const meta = metaFor(question.id);
                  return `
                    <article
                      class="w3-quickcheck-card"
                      data-question-id="${question.id}"
                      data-question-state="pending"
                      style="--topic-color: ${meta.color};"
                    >
                      <div class="w3-quickcheck-card__meta">
                        <span class="w3-quickcheck-card__status" data-question-status="${question.id}">Pending</span>
                        <span class="w3-quickcheck-card__index">Q${index + 1}</span>
                      </div>
                      <h3 class="w3-quickcheck-card__title">${escapeHtml(meta.label)}</h3>
                      <p class="w3-quickcheck-card__chapter">${escapeHtml(meta.chapter)}</p>
                      <p class="w3-quickcheck-card__copy">${escapeHtml(meta.recap)}</p>
                    </article>
                  `;
                }).join('')}
              </div>
            </section>

            <section class="panel w3-quickcheck-sidecar" aria-label="Coach Feed">
              <div class="card card--elevated w3-level__feedback" aria-live="polite">
                <p class="eyebrow">Coach Feed</p>
                <p id="w3-l5-feedback-text" class="w3-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
              </div>

              <div class="card w3-level__hint-box" id="w3-l5-hint-box" hidden>
                <p class="eyebrow">Hint</p>
                <p id="w3-l5-hint-text" class="w3-level__hint-copy"></p>
              </div>

              <div class="card w3-quickcheck-unlock">
                <p class="eyebrow">Next Challenge</p>
                <h2 class="panel-title">Code Fix - Outliers</h2>
                <p class="w3-level__microcopy">${escapeHtml(NEXT_LEVEL_COPY)}</p>
              </div>
            </section>
          </div>
        </div>

        <section class="panel w3-quickcheck-summary" id="w3-l5-summary" hidden aria-label="Review Summary">
          <div class="w3-level__panel-head">
            <div>
              <p class="eyebrow">Review Summary</p>
              <h2 class="panel-title">Your outlier readout</h2>
            </div>
            <p class="w3-level__microcopy" id="w3-l5-summary-lead">
              Finish the quiz to unlock the recap and continue forward.
            </p>
          </div>

          <div class="w3-quickcheck-summary__grid" id="w3-l5-summary-grid"></div>

          <div class="action-row">
            <span class="status-box" id="w3-l5-summary-score">Waiting for final review</span>
            <button class="btn btn--primary" id="w3-l5-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w3-l5-progress');
    this._ui.status = container.querySelector('#w3-l5-status');
    this._ui.feedback = container.querySelector('#w3-l5-feedback-text');
    this._ui.hintBox = container.querySelector('#w3-l5-hint-box');
    this._ui.hintText = container.querySelector('#w3-l5-hint-text');
    this._ui.quizHost = container.querySelector('#w3-l5-quiz');
    this._ui.summary = container.querySelector('#w3-l5-summary');
    this._ui.summaryLead = container.querySelector('#w3-l5-summary-lead');
    this._ui.summaryGrid = container.querySelector('#w3-l5-summary-grid');
    this._ui.summaryScore = container.querySelector('#w3-l5-summary-score');
    this._ui.finishButton = container.querySelector('#w3-l5-finish-btn');
    this._ui.trackerCards = Array.from(container.querySelectorAll('[data-question-id]'));

    this._mountWidget();
    this._syncProgress();
    this._syncTracker();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w3-l5-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w3-l5-reset-btn')) {
        this._resetQuiz();
        return;
      }

      if (event.target.closest('#w3-l5-finish-btn')) {
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
      worldColor: 'var(--color-world-3)',
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
            class="w3-quickcheck-summary__card"
            data-summary-state="${result.correct ? 'correct' : 'review'}"
            style="--topic-color: ${meta.color};"
          >
            <p class="w3-quickcheck-summary__kicker">${escapeHtml(meta.chapter)}</p>
            <div class="w3-quickcheck-summary__meta">
              <span class="w3-quickcheck-summary__state">${result.correct ? 'Locked In' : 'Review'}</span>
              <span class="w3-quickcheck-summary__topic">${escapeHtml(meta.label)}</span>
            </div>
            <p class="w3-quickcheck-summary__copy">${escapeHtml(result.explanation)}</p>
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
      this._ui.summaryLead.textContent = 'Finish the quiz to unlock the recap and continue forward.';
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
