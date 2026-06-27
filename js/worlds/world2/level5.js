'use strict';

import { getLevelProblem } from '../../data/problems.js';
import { MCQWidget } from '../../widgets/mcq.js';

const PROBLEM = getLevelProblem(2, 5);
const FALLBACK_QUESTIONS = Object.freeze([
  Object.freeze({
    id: 'mechanism-match',
    type: 'match',
    prompt: 'Match each missing-data mechanism to the pattern that defines it.',
    explanation: 'The mechanism explains why values disappear, and that changes how cautious your repair strategy should be.',
    pairs: [
      {
        id: 'mcar',
        prompt: 'Values go missing for a random export glitch, unrelated to any feature.',
        correct: 'MCAR',
        options: ['MCAR', 'MAR', 'MNAR'],
      },
      {
        id: 'mar',
        prompt: 'Salary is more likely to be missing for customers in one observed region.',
        correct: 'MAR',
        options: ['MCAR', 'MAR', 'MNAR'],
      },
      {
        id: 'mnar',
        prompt: 'People with very high income avoid answering the income question itself.',
        correct: 'MNAR',
        options: ['MCAR', 'MAR', 'MNAR'],
      },
    ],
  }),
  Object.freeze({
    id: 'indicator-formula',
    type: 'single',
    prompt: 'When should `Age_missing` equal 1?',
    options: [
      { id: 'original-gap', text: 'When the original Age value was missing before imputation', correct: true },
      { id: 'filled-value', text: 'When the filled Age value is above the median', correct: false },
      { id: 'numeric-column', text: 'Whenever the column is numeric', correct: false },
      { id: 'after-scaling', text: 'Only after the column has been scaled', correct: false },
    ],
    explanation: 'The indicator remembers the original gap. It is about past missingness, not about the repaired value itself.',
  }),
  Object.freeze({
    id: 'skewed-strategy',
    type: 'single',
    prompt: 'A Salary column is heavily right-skewed because a few executives earn far more than everyone else. Which fill is usually safer?',
    options: [
      { id: 'median', text: 'Median imputation', correct: true },
      { id: 'mean', text: 'Mean imputation', correct: false },
      { id: 'mode', text: 'Mode imputation', correct: false },
      { id: 'onehot', text: 'One-hot encoding first', correct: false },
    ],
    explanation: 'Median resists the pull of extreme high salaries, while the mean gets dragged toward the outliers.',
  }),
  Object.freeze({
    id: 'indicator-truefalse',
    type: 'single',
    prompt: 'True or false: after you impute a value, a missing-indicator column can still be useful.',
    options: [
      { id: 'true', text: 'True', correct: true },
      { id: 'false', text: 'False', correct: false },
    ],
    explanation: 'Imputation repairs the numeric gap, but the model may still learn from knowing which rows were originally incomplete.',
  }),
  Object.freeze({
    id: 'scenario-judgment',
    type: 'single',
    prompt: 'Blank `Promo_Code` values usually mean "no promotion used." Which treatment best preserves that business meaning?',
    options: [
      { id: 'missing-label', text: 'Keep an explicit missing label or indicator', correct: true },
      { id: 'mode-fill', text: 'Fill with the most common promo code', correct: false },
      { id: 'median-fill', text: 'Fill with the column median', correct: false },
      { id: 'drop-rows', text: 'Drop every row with a blank code', correct: false },
    ],
    explanation: 'Here the blank itself is informative, so you want to preserve that absence instead of hiding it inside a frequent category.',
  }),
  Object.freeze({
    id: 'repair-order',
    type: 'single',
    prompt: 'Which missing-data workflow order is the healthiest?',
    options: [
      { id: 'inspect-then-fix', text: 'Inspect nulls -> diagnose type/mechanism -> impute or preserve signal -> add indicator if useful', correct: true },
      { id: 'scale-first', text: 'Add indicator -> scale the column -> diagnose mechanism -> impute later', correct: false },
      { id: 'impute-blind', text: 'Impute immediately -> inspect later -> encode -> ignore the mechanism', correct: false },
      { id: 'drop-immediately', text: 'Drop the whole feature -> normalize the dataset -> backfill manually', correct: false },
    ],
    explanation: 'Healthy preprocessing inspects first, chooses a repair from type and mechanism, then preserves missingness signal when it matters.',
  }),
]);
const QUESTIONS = Array.isArray(PROBLEM?.questions) && PROBLEM.questions.length
  ? PROBLEM.questions
  : FALLBACK_QUESTIONS;

const QUESTION_META = Object.freeze({
  'mechanism-match': {
    label: 'Mechanism Match',
    chapter: 'MCAR / MAR / MNAR',
    color: 'var(--color-world-2)',
    recap: 'Mechanism is the first lens because it tells you whether the gap is random, observed-patterned, or tied to the missing value itself.',
  },
  'indicator-formula': {
    label: 'Indicator Logic',
    chapter: 'Missingness Memory',
    color: 'var(--color-world-1)',
    recap: 'Indicator columns mark where the original gap lived, even after the main feature has been repaired.',
  },
  'skewed-strategy': {
    label: 'Skewed Numeric Fix',
    chapter: 'Imputation Strategy',
    color: 'var(--color-warning)',
    recap: 'Median stays safer than mean when a numeric distribution is stretched by a few huge values.',
  },
  'indicator-truefalse': {
    label: 'Signal Preservation',
    chapter: 'Feature Design',
    color: 'var(--color-success)',
    recap: 'Repairing a blank value does not erase the possibility that the original missingness still carries predictive signal.',
  },
  'scenario-judgment': {
    label: 'Business Meaning',
    chapter: 'Scenario Judgment',
    color: 'var(--color-world-4)',
    recap: 'Some blanks already mean something in the business process, so the safest move is to preserve that absence explicitly.',
  },
  'repair-order': {
    label: 'Repair Order',
    chapter: 'Workflow Sequence',
    color: 'var(--color-world-5)',
    recap: 'Inspect first, choose the mechanism-aware strategy second, then repair while keeping useful missingness signal alive.',
  },
});

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM?.hints ?? []),
  'Indicator columns describe where the original gap was, not whether the filled value looks large or small.',
  'If the blank itself already carries business meaning, preserving that absence is usually safer than blending it into a common category.',
]);

const DEFAULT_FEEDBACK = 'Confirm each answer, then use the explanation to tighten the mechanism and strategy layer before the code lab.';
const DEFAULT_STATUS = 'Answer each question once. Review appears immediately after you confirm.';
const NEXT_LEVEL_COPY = 'The next level turns these ideas into code: inspect nulls, choose the repair, and write the pandas-like commands that clean the dataset.';

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
    chapter: 'Missing Data Review',
    color: 'var(--color-world-2)',
    recap: 'Review the explanation and lock the concept before you continue.',
  };
}

function resultTone(summary) {
  if (!summary) return DEFAULT_FEEDBACK;
  if (summary.perfect) {
    return 'Perfect review. The missing-data strategy layer is locked, and the code lab is ready for you.';
  }
  if (summary.correct >= Math.ceil(summary.total * 0.7)) {
    return 'Strong review. Use the recap cards below to tighten the few missing-data judgments that still need one more glance.';
  }
  return 'Useful checkpoint. The recap cards below show which missing-data ideas to keep in view before you code the repairs.';
}

function resultStatus(summary) {
  if (!summary) return DEFAULT_STATUS;
  return `Review complete. ${summary.correct} / ${summary.total} answers landed correctly.`;
}

export default class World2Level5 {
  meta = {
    title: PROBLEM?.title ?? 'MCQ — Missing Data',
    subtitle: PROBLEM?.objective ?? 'Check your understanding of missing-data mechanisms and imputation choices.',
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
      <section class="w2-level w2-level--quickcheck screen-section" aria-label="World 2 Level 5">
        <div class="level-hero w2-level__hero" style="--world-color: var(--color-world-2);">
          <p class="eyebrow">World 2 - Missing Data</p>
          <h1 class="level-hero__title">${escapeHtml(PROBLEM.title)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(PROBLEM.objective)}
            This review checks whether you can identify the mechanism, choose the safest repair, and decide when missingness itself should become a feature.
          </p>
          <div class="action-row">
            <span class="status-box" id="w2-l5-progress">0 / ${QUESTIONS.length} questions answered</span>
            <span class="status-box" id="w2-l5-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w2-l5-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w2-l5-reset-btn" type="button">Reset Quiz</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">05</span>
        </div>

        <div class="w2-quickcheck-grid">
          <article class="panel w2-quickcheck-stage">
            <div class="w2-level__panel-head">
              <div>
                <p class="eyebrow">Missing Data Review</p>
                <h2 class="panel-title">One pass across mechanism, strategy, signal, and workflow order</h2>
              </div>
              <p class="w2-level__microcopy">
                Reset rewinds the local quiz flow so you can replay it, but hints and wrong answers still count for the current run.
              </p>
            </div>

            <div class="w2-quickcheck-widget" id="w2-l5-quiz"></div>
          </article>

          <div class="w2-quickcheck-side">
            <section class="panel w2-quickcheck-tracker" aria-label="Review Tracker">
              <div class="w2-level__panel-head">
                <div>
                  <p class="eyebrow">Review Tracker</p>
                  <h2 class="panel-title">Watch each missing-data concept lock in</h2>
                </div>
                <p class="w2-level__microcopy">
                  Each card previews an idea that immediately returns in the code lab.
                </p>
              </div>

              <div class="w2-quickcheck-tracker__list">
                ${QUESTIONS.map((question, index) => {
                  const meta = metaFor(question.id);
                  return `
                    <article
                      class="w2-quickcheck-card"
                      data-question-id="${question.id}"
                      data-question-state="pending"
                      style="--topic-color: ${meta.color};"
                    >
                      <div class="w2-quickcheck-card__meta">
                        <span class="w2-quickcheck-card__status" data-question-status="${question.id}">Pending</span>
                        <span class="w2-quickcheck-card__index">Q${index + 1}</span>
                      </div>
                      <h3 class="w2-quickcheck-card__title">${escapeHtml(meta.label)}</h3>
                      <p class="w2-quickcheck-card__chapter">${escapeHtml(meta.chapter)}</p>
                      <p class="w2-quickcheck-card__copy">${escapeHtml(meta.recap)}</p>
                    </article>
                  `;
                }).join('')}
              </div>
            </section>

            <section class="panel w2-quickcheck-sidecar" aria-label="Coach Feed">
              <div class="card card--elevated w2-level__feedback" aria-live="polite">
                <p class="eyebrow">Coach Feed</p>
                <p id="w2-l5-feedback-text" class="w2-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
              </div>

              <div class="card w2-level__hint-box" id="w2-l5-hint-box" hidden>
                <p class="eyebrow">Hint</p>
                <p id="w2-l5-hint-text" class="w2-level__hint-copy"></p>
              </div>

              <div class="card w2-quickcheck-unlock">
                <p class="eyebrow">Next Challenge</p>
                <h2 class="panel-title">Code Fix — Imputation</h2>
                <p class="w2-level__microcopy">${escapeHtml(NEXT_LEVEL_COPY)}</p>
              </div>
            </section>
          </div>
        </div>

        <section class="panel w2-quickcheck-summary" id="w2-l5-summary" hidden aria-label="Review Summary">
          <div class="w2-level__panel-head">
            <div>
              <p class="eyebrow">Review Summary</p>
              <h2 class="panel-title">Your missing-data readout</h2>
            </div>
            <p class="w2-level__microcopy" id="w2-l5-summary-lead">
              Finish the quiz to unlock the recap and continue forward.
            </p>
          </div>

          <div class="w2-quickcheck-summary__grid" id="w2-l5-summary-grid"></div>

          <div class="action-row">
            <span class="status-box" id="w2-l5-summary-score">Waiting for final review</span>
            <button class="btn btn--primary" id="w2-l5-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w2-l5-progress');
    this._ui.status = container.querySelector('#w2-l5-status');
    this._ui.feedback = container.querySelector('#w2-l5-feedback-text');
    this._ui.hintBox = container.querySelector('#w2-l5-hint-box');
    this._ui.hintText = container.querySelector('#w2-l5-hint-text');
    this._ui.quizHost = container.querySelector('#w2-l5-quiz');
    this._ui.summary = container.querySelector('#w2-l5-summary');
    this._ui.summaryLead = container.querySelector('#w2-l5-summary-lead');
    this._ui.summaryGrid = container.querySelector('#w2-l5-summary-grid');
    this._ui.summaryScore = container.querySelector('#w2-l5-summary-score');
    this._ui.finishButton = container.querySelector('#w2-l5-finish-btn');
    this._ui.trackerCards = Array.from(container.querySelectorAll('[data-question-id]'));

    this._mountWidget();
    this._syncProgress();
    this._syncTracker();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w2-l5-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w2-l5-reset-btn')) {
        this._resetQuiz();
        return;
      }

      if (event.target.closest('#w2-l5-finish-btn')) {
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
      worldColor: 'var(--color-world-2)',
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
            class="w2-quickcheck-summary__card"
            data-summary-state="${result.correct ? 'correct' : 'review'}"
            style="--topic-color: ${meta.color};"
          >
            <p class="w2-quickcheck-summary__kicker">${escapeHtml(meta.chapter)}</p>
            <div class="w2-quickcheck-summary__meta">
              <span class="w2-quickcheck-summary__state">${result.correct ? 'Locked In' : 'Review'}</span>
              <span class="w2-quickcheck-summary__topic">${escapeHtml(meta.label)}</span>
            </div>
            <p class="w2-quickcheck-summary__copy">${escapeHtml(result.explanation)}</p>
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

    if (!this._completed && answered > 0) {
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
