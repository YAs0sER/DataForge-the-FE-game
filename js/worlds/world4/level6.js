'use strict';

import { getLevelProblem } from '../../data/problems.js';
import { MCQWidget } from '../../widgets/mcq.js';

const PROBLEM = getLevelProblem(4, 6);
const LEVEL_TITLE = PROBLEM?.title ?? 'MCQ - Encoding';
const LEVEL_OBJECTIVE = PROBLEM?.objective ?? 'Review encoding tradeoffs, risks, and formulas.';

const FALLBACK_QUESTIONS = Object.freeze([
  Object.freeze({
    id: 'onehot-width',
    type: 'single',
    prompt: 'A `City` column has 5 distinct categories. Before dropping any reference column, how many one-hot columns does it create?',
    options: [
      { id: 'five', text: '5 columns', correct: true },
      { id: 'four', text: '4 columns', correct: false },
      { id: 'one', text: '1 column', correct: false },
      { id: 'ten', text: '10 columns', correct: false },
    ],
    explanation: 'One-hot encoding creates one binary column per distinct category unless you intentionally drop one later.',
  }),
  Object.freeze({
    id: 'label-risk',
    type: 'single',
    prompt: 'Why is plain label encoding risky for a nominal feature like `Color` when used with linear regression?',
    options: [
      { id: 'fake-order', text: 'The model may read the integer codes as a fake order or distance', correct: true },
      { id: 'too-wide', text: 'It always creates too many columns', correct: false },
      { id: 'kills-missing', text: 'It removes missing-value information automatically', correct: false },
      { id: 'needs-iqr', text: 'It only works after IQR outlier clipping', correct: false },
    ],
    explanation: 'Nominal labels have no rank, so integer codes can trick linear models into seeing order where none exists.',
  }),
  Object.freeze({
    id: 'frequency-formula',
    type: 'single',
    prompt: 'A category appears 8 times in a dataset of 40 rows. What frequency-encoding value should it receive?',
    options: [
      { id: '0-2', text: '0.2', correct: true },
      { id: '0-8', text: '0.8', correct: false },
      { id: '8', text: '8', correct: false },
      { id: '5', text: '5', correct: false },
    ],
    explanation: 'Frequency encoding uses ni / N, so 8 divided by 40 gives 0.2.',
  }),
  Object.freeze({
    id: 'cardinality-definition',
    type: 'single',
    prompt: 'What does high cardinality mean for a categorical feature?',
    options: [
      { id: 'many-unique', text: 'It has many unique categories relative to the dataset size', correct: true },
      { id: 'two-values', text: 'It has only two possible values', correct: false },
      { id: 'alphabetical', text: 'Its values are sorted alphabetically', correct: false },
      { id: 'mostly-missing', text: 'Most rows are missing that feature', correct: false },
    ],
    explanation: 'High cardinality means the feature vocabulary is large, which can make one-hot expansion sparse and expensive.',
  }),
  Object.freeze({
    id: 'rare-category-handling',
    type: 'single',
    prompt: 'A `Postal_Code` column has hundreds of labels, and most appear only once. What is the healthiest step before one-hot expansion?',
    options: [
      { id: 'group-rare', text: 'Group the rare labels into an `Autres` or `Other` bucket', correct: true },
      { id: 'alphabetical-labels', text: 'Label encode them alphabetically', correct: false },
      { id: 'standardize-codes', text: 'Standardize the postal codes to mean 0', correct: false },
      { id: 'drop-frequent', text: 'Drop only the most frequent postal code', correct: false },
    ],
    explanation: 'Grouping rare categories shrinks the one-hot matrix while keeping the common categories explicit.',
  }),
  Object.freeze({
    id: 'method-match',
    type: 'match',
    prompt: 'Match each feature-model pair to the safest encoding choice.',
    explanation: 'The safest encoding depends on both the category structure and what the model is likely to misread or overpay for.',
    pairs: [
      {
        id: 'color-linear',
        prompt: 'Color (nominal, 3 values) + Linear Regression',
        correct: 'One-Hot',
        options: ['One-Hot', 'Label', 'Frequency'],
      },
      {
        id: 'education-forest',
        prompt: 'Education Level (ordinal: low / medium / high) + Random Forest',
        correct: 'Label',
        options: ['One-Hot', 'Label', 'Frequency'],
      },
      {
        id: 'postal-nn',
        prompt: 'Postal Code (500 unique values) + Neural Network',
        correct: 'Frequency',
        options: ['One-Hot', 'Label', 'Frequency'],
      },
    ],
  }),
]);

const QUESTIONS = Array.isArray(PROBLEM?.questions) && PROBLEM.questions.length
  ? PROBLEM.questions
  : FALLBACK_QUESTIONS;

const QUESTION_META = Object.freeze({
  'onehot-width': {
    label: 'One-Hot Width',
    chapter: 'One Column Per Category',
    color: 'var(--color-world-4)',
    recap: 'One-hot width tracks the number of distinct categories, which is why high-cardinality columns become expensive so quickly.',
  },
  'label-risk': {
    label: 'Fake Order Risk',
    chapter: 'Label Trap',
    color: 'var(--color-danger)',
    recap: 'Plain label encoding is risky on nominal features because the integers can imply rank and distance that do not exist.',
  },
  'frequency-formula': {
    label: 'Frequency Math',
    chapter: 'ni / N',
    color: 'var(--color-success)',
    recap: 'Frequency encoding replaces the category with how often it appears in the full column, not with an arbitrary code.',
  },
  'cardinality-definition': {
    label: 'Cardinality',
    chapter: 'Vocabulary Size',
    color: 'var(--color-world-1)',
    recap: 'High cardinality means a categorical feature carries a large vocabulary, which makes naive one-hot encoding wide and sparse.',
  },
  'rare-category-handling': {
    label: 'Rare Grouping',
    chapter: 'Autres Bucket',
    color: 'var(--color-warning)',
    recap: 'Grouping rare labels before one-hot expansion keeps the common categories explicit while trimming the long sparse tail.',
  },
  'method-match': {
    label: 'Method Compatibility',
    chapter: 'Model + Feature Pair',
    color: 'var(--color-world-5)',
    recap: 'The safest encoding depends on both the feature structure and what the model is likely to misread or overpay for.',
  },
});

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM?.hints ?? []),
  'Low-cardinality nominal features plus linear models usually point toward one-hot.',
  'If a category has real order, label-style codes can preserve that signal safely.',
  'When the vocabulary is huge, think about grouping rare labels or using frequency encoding before expanding into one-hot columns.',
]);

const DEFAULT_FEEDBACK = 'Confirm each answer, then use the explanation to tighten the encoding rule before the code lab.';
const DEFAULT_STATUS = 'Answer each question once. Review appears immediately after you confirm.';
const NEXT_LEVEL_COPY = 'The next level turns these rules into code: group rare labels, one-hot the right nominal feature, preserve ordinal order, and keep the high-cardinality column under control.';
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
    chapter: 'Encoding Review',
    color: 'var(--color-world-4)',
    recap: 'Review the explanation and lock the encoding rule before you continue.',
  };
}

function resultTone(summary) {
  if (!summary) return DEFAULT_FEEDBACK;
  if (summary.perfect) {
    return 'Perfect review. The encoding toolkit is stable, and the code lab is ready for you.';
  }
  if (summary.correct >= Math.ceil(summary.total * 0.7)) {
    return 'Strong review. Use the recap cards below to tighten the few encoding rules that still need one more look.';
  }
  return 'Useful checkpoint. The recap cards below show which encoding ideas to keep in view before you move into code.';
}

function resultStatus(summary) {
  if (!summary) return DEFAULT_STATUS;
  return `Review complete. ${summary.correct} / ${summary.total} answers landed correctly.`;
}

export default class World4Level6 {
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
      <section class="w4-level w4-level--quickcheck screen-section" aria-label="World 4 Level 6">
        <div class="level-hero w4-level__hero" style="--world-color: var(--color-world-4);">
          <p class="eyebrow">World 4 - Encoding</p>
          <h1 class="level-hero__title">${escapeHtml(LEVEL_TITLE)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(LEVEL_OBJECTIVE)}
            This review checks whether you can move between one-hot width, label-encoding risk, frequency math, high-cardinality handling, and model compatibility before the code challenge begins.
          </p>
          <div class="action-row">
            <span class="status-box" id="w4-l6-progress">0 / ${QUESTIONS.length} questions answered</span>
            <span class="status-box" id="w4-l6-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w4-l6-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w4-l6-reset-btn" type="button">Reset Quiz</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">06</span>
        </div>

        <div class="w4-quickcheck-grid">
          <article class="panel w4-quickcheck-stage">
            <div class="w4-level__panel-head">
              <div>
                <p class="eyebrow">Encoding Review</p>
                <h2 class="panel-title">One pass across width, fake-order risk, frequency math, rare grouping, and model fit</h2>
              </div>
              <p class="w4-level__microcopy">
                Reset rewinds the local quiz flow so you can replay it, but hints and wrong answers still count for the current run.
              </p>
            </div>

            <div class="w4-quickcheck-widget" id="w4-l6-quiz"></div>
          </article>

          <div class="w4-quickcheck-side">
            <section class="panel w4-quickcheck-tracker" aria-label="Review Tracker">
              <div class="w4-level__panel-head">
                <div>
                  <p class="eyebrow">Review Tracker</p>
                  <h2 class="panel-title">Watch each encoding rule lock in</h2>
                </div>
                <p class="w4-level__microcopy">
                  Each card previews a rule that immediately returns in the World 4 code lab.
                </p>
              </div>

              <div class="w4-quickcheck-tracker__list">
                ${QUESTIONS.map((question, index) => {
                  const meta = metaFor(question.id);
                  return `
                    <article
                      class="w4-quickcheck-card"
                      data-question-id="${question.id}"
                      data-question-state="pending"
                      style="--topic-color: ${meta.color};"
                    >
                      <div class="w4-quickcheck-card__meta">
                        <span class="w4-quickcheck-card__status" data-question-status="${question.id}">Pending</span>
                        <span class="w4-quickcheck-card__index">Q${index + 1}</span>
                      </div>
                      <h3 class="w4-quickcheck-card__title">${escapeHtml(meta.label)}</h3>
                      <p class="w4-quickcheck-card__chapter">${escapeHtml(meta.chapter)}</p>
                      <p class="w4-quickcheck-card__copy">${escapeHtml(meta.recap)}</p>
                    </article>
                  `;
                }).join('')}
              </div>
            </section>

            <section class="panel w4-quickcheck-sidecar" aria-label="Coach Feed">
              <div class="card card--elevated w4-level__feedback" aria-live="polite">
                <p class="eyebrow">Coach Feed</p>
                <p id="w4-l6-feedback-text" class="w4-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
              </div>

              <div class="card w4-level__hint-box" id="w4-l6-hint-box" hidden>
                <p class="eyebrow">Hint</p>
                <p id="w4-l6-hint-text" class="w4-level__hint-copy"></p>
              </div>

              <div class="card w4-quickcheck-unlock">
                <p class="eyebrow">Next Challenge</p>
                <h2 class="panel-title">Code Fix - Encoding</h2>
                <p class="w4-level__microcopy">${escapeHtml(NEXT_LEVEL_COPY)}</p>
              </div>
            </section>
          </div>
        </div>

        <section class="panel w4-quickcheck-summary" id="w4-l6-summary" hidden aria-label="Review Summary">
          <div class="w4-level__panel-head">
            <div>
              <p class="eyebrow">Review Summary</p>
              <h2 class="panel-title">Your encoding readout</h2>
            </div>
            <p class="w4-level__microcopy" id="w4-l6-summary-lead">
              ${escapeHtml(SUMMARY_LOCKED_COPY)}
            </p>
          </div>

          <div class="w4-quickcheck-summary__grid" id="w4-l6-summary-grid"></div>

          <div class="action-row">
            <span class="status-box" id="w4-l6-summary-score">Waiting for final review</span>
            <button class="btn btn--primary" id="w4-l6-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w4-l6-progress');
    this._ui.status = container.querySelector('#w4-l6-status');
    this._ui.feedback = container.querySelector('#w4-l6-feedback-text');
    this._ui.hintBox = container.querySelector('#w4-l6-hint-box');
    this._ui.hintText = container.querySelector('#w4-l6-hint-text');
    this._ui.quizHost = container.querySelector('#w4-l6-quiz');
    this._ui.summary = container.querySelector('#w4-l6-summary');
    this._ui.summaryLead = container.querySelector('#w4-l6-summary-lead');
    this._ui.summaryGrid = container.querySelector('#w4-l6-summary-grid');
    this._ui.summaryScore = container.querySelector('#w4-l6-summary-score');
    this._ui.finishButton = container.querySelector('#w4-l6-finish-btn');
    this._ui.trackerCards = Array.from(container.querySelectorAll('[data-question-id]'));

    this._mountWidget();
    this._syncProgress();
    this._syncTracker();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w4-l6-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w4-l6-reset-btn')) {
        this._resetQuiz();
        return;
      }

      if (event.target.closest('#w4-l6-finish-btn')) {
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
      worldColor: 'var(--color-world-4)',
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
            class="w4-quickcheck-summary__card"
            data-summary-state="${result.correct ? 'correct' : 'review'}"
            style="--topic-color: ${meta.color};"
          >
            <p class="w4-quickcheck-summary__kicker">${escapeHtml(meta.chapter)}</p>
            <div class="w4-quickcheck-summary__meta">
              <span class="w4-quickcheck-summary__state">${result.correct ? 'Locked In' : 'Review'}</span>
              <span class="w4-quickcheck-summary__topic">${escapeHtml(meta.label)}</span>
            </div>
            <p class="w4-quickcheck-summary__copy">${escapeHtml(result.explanation)}</p>
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
