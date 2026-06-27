'use strict';

import { getLevelProblem } from '../../data/problems.js';
import { MCQWidget } from '../../widgets/mcq.js';

const PROBLEM = getLevelProblem(1, 4);

const QUESTION_META = Object.freeze({
  'variable-type': {
    label: 'Variable Types',
    chapter: 'Counts and structures',
    color: 'var(--color-world-1)',
    recap: 'Counts belong with discrete numeric features because they move in whole-number steps.',
  },
  'nan-problem': {
    label: 'Missing Value Signals',
    chapter: 'World 2 preview',
    color: 'var(--color-world-2)',
    recap: 'NaN marks absent information that needs an explicit missing-data strategy before modeling.',
  },
  ordering: {
    label: 'Pipeline Order',
    chapter: 'Foundations sequence',
    color: 'var(--color-world-1)',
    recap: 'A stable pipeline cleans first, treats outliers second, encodes third, and scales last.',
  },
  'trees-scaling': {
    label: 'Model Scale Rules',
    chapter: 'World 5 preview',
    color: 'var(--color-world-5)',
    recap: 'Tree-based models usually do not rely on feature scaling because they split on thresholds, not distance.',
  },
  'match-treatment': {
    label: 'Treatment Matching',
    chapter: 'Cross-world recap',
    color: 'var(--color-world-3)',
    recap: 'A good first fix matches the observed problem without destroying more signal than necessary.',
  },
});

const DEFAULT_FEEDBACK = 'Confirm each answer, then use the explanation to tighten the concept before you continue.';
const DEFAULT_STATUS = 'Answer each question once. Review appears immediately after you confirm.';
const NEXT_WORLD_COPY = 'World 2 turns missing values into strategy: why they happen, how to impute them, and when missingness itself should become a feature.';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resultTone(summary) {
  if (!summary) return DEFAULT_FEEDBACK;
  if (summary.perfect) {
    return 'Perfect review. The foundations are stable, and the missing-data world is ready for you.';
  }
  if (summary.correct >= Math.ceil(summary.total * 0.7)) {
    return 'Strong review. Use the recap cards below to warm up the few ideas that still need one more pass.';
  }
  return 'Useful checkpoint. The recap cards below show the exact concepts to keep in view before you move on.';
}

function resultStatus(summary) {
  if (!summary) return DEFAULT_STATUS;
  return `Review complete. ${summary.correct} / ${summary.total} answers landed correctly.`;
}

export default class World1Level4 {
  meta = {
    title: PROBLEM?.title ?? 'Quick Check',
    subtitle: PROBLEM?.objective ?? 'Review the foundations world before you unlock missing-data strategy.',
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
      <section class="w1-level w1-level--quickcheck screen-section" aria-label="World 1 Level 4">
        <div class="level-hero w1-level__hero" style="--world-color: var(--color-world-1);">
          <p class="eyebrow">World 1 - Foundations</p>
          <h1 class="level-hero__title">${escapeHtml(PROBLEM.title)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(PROBLEM.objective)}
            Lock in the foundations before the campaign moves from spotting issues into fixing them.
          </p>
          <div class="action-row">
            <span class="status-box" id="w1-l4-progress">0 / ${PROBLEM.questions.length} questions answered</span>
            <span class="status-box" id="w1-l4-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w1-l4-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w1-l4-reset-btn" type="button">Reset Quiz</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">04</span>
        </div>

        <div class="w1-quickcheck-grid">
          <article class="panel w1-quickcheck-stage">
            <div class="w1-level__panel-head">
              <div>
                <p class="eyebrow">Foundations Review</p>
                <h2 class="panel-title">One clean pass across types, missing values, order, scale, and treatment choices</h2>
              </div>
              <p class="w1-level__microcopy">
                Reset rewinds the local quiz flow so you can replay it, but hints and wrong answers still count for the current run.
              </p>
            </div>

            <div class="w1-quickcheck-widget" id="w1-l4-quiz"></div>
          </article>

          <div class="w1-quickcheck-side">
            <section class="panel w1-quickcheck-tracker" aria-label="Review Tracker">
              <div class="w1-level__panel-head">
                <div>
                  <p class="eyebrow">Review Tracker</p>
                  <h2 class="panel-title">Watch each concept lock in</h2>
                </div>
                <p class="w1-level__microcopy">
                  Each card points at a concept that will return in later worlds.
                </p>
              </div>

              <div class="w1-quickcheck-tracker__list">
                ${PROBLEM.questions.map((question, index) => {
                  const meta = QUESTION_META[question.id];
                  return `
                    <article
                      class="w1-quickcheck-card"
                      data-question-id="${question.id}"
                      data-question-state="pending"
                      style="--topic-color: ${meta.color};"
                    >
                      <div class="w1-quickcheck-card__meta">
                        <span class="w1-quickcheck-card__status" data-question-status="${question.id}">Pending</span>
                        <span class="w1-quickcheck-card__index">Q${index + 1}</span>
                      </div>
                      <h3 class="w1-quickcheck-card__title">${escapeHtml(meta.label)}</h3>
                      <p class="w1-quickcheck-card__chapter">${escapeHtml(meta.chapter)}</p>
                      <p class="w1-quickcheck-card__copy">${escapeHtml(meta.recap)}</p>
                    </article>
                  `;
                }).join('')}
              </div>
            </section>

            <section class="panel w1-quickcheck-sidecar" aria-label="Coach Feed">
              <div class="card card--elevated w1-level__feedback" aria-live="polite">
                <p class="eyebrow">Coach Feed</p>
                <p id="w1-l4-feedback-text" class="w1-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
              </div>

              <div class="card w1-level__hint-box" id="w1-l4-hint-box" hidden>
                <p class="eyebrow">Hint</p>
                <p id="w1-l4-hint-text" class="w1-level__hint-copy"></p>
              </div>

              <div class="card w1-quickcheck-unlock">
                <p class="eyebrow">Next World</p>
                <h2 class="panel-title">Missing Data Strategy</h2>
                <p class="w1-level__microcopy">${escapeHtml(NEXT_WORLD_COPY)}</p>
              </div>
            </section>
          </div>
        </div>

        <section class="panel w1-quickcheck-summary" id="w1-l4-summary" hidden aria-label="Review Summary">
          <div class="w1-level__panel-head">
            <div>
              <p class="eyebrow">Review Summary</p>
              <h2 class="panel-title">Your foundations readout</h2>
            </div>
            <p class="w1-level__microcopy" id="w1-l4-summary-lead">
              Finish the quiz to unlock the recap and continue forward.
            </p>
          </div>

          <div class="w1-quickcheck-summary__grid" id="w1-l4-summary-grid"></div>

          <div class="action-row">
            <span class="status-box" id="w1-l4-summary-score">Waiting for final review</span>
            <button class="btn btn--primary" id="w1-l4-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w1-l4-progress');
    this._ui.status = container.querySelector('#w1-l4-status');
    this._ui.feedback = container.querySelector('#w1-l4-feedback-text');
    this._ui.hintBox = container.querySelector('#w1-l4-hint-box');
    this._ui.hintText = container.querySelector('#w1-l4-hint-text');
    this._ui.quizHost = container.querySelector('#w1-l4-quiz');
    this._ui.summary = container.querySelector('#w1-l4-summary');
    this._ui.summaryLead = container.querySelector('#w1-l4-summary-lead');
    this._ui.summaryGrid = container.querySelector('#w1-l4-summary-grid');
    this._ui.summaryScore = container.querySelector('#w1-l4-summary-score');
    this._ui.finishButton = container.querySelector('#w1-l4-finish-btn');
    this._ui.trackerCards = Array.from(container.querySelectorAll('[data-question-id]'));

    this._mountWidget();
    this._syncProgress();
    this._syncTracker();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w1-l4-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w1-l4-reset-btn')) {
        this._resetQuiz();
        return;
      }

      if (event.target.closest('#w1-l4-finish-btn')) {
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
    return PROBLEM.hints?.[hintsUsed - 1] ?? null;
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
      questions: PROBLEM.questions,
      worldColor: 'var(--color-world-1)',
      onAnswer: result => this._handleAnswer(result),
      onComplete: summary => this._handleComplete(summary),
    });
  }

  _handleAnswer(result) {
    const question = QUESTION_META[result.questionId];
    this._results.set(result.questionId, result);

    if (result.correct) {
      this._engine.correct();
      this._setFeedback(`Correct. ${result.explanation}`);
    } else {
      this._engine.mistake({ costsLife: false, countsMistake: true });
      this._setFeedback(`Review this one. ${result.explanation}`);
    }

    const answered = this._results.size;
    if (answered === PROBLEM.questions.length) {
      this._setStatus('All answers are locked. Press Continue inside the quiz to finish the review.');
    } else if (question) {
      this._setStatus(`${question.label} checked. ${answered} / ${PROBLEM.questions.length} questions answered.`);
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
        const meta = QUESTION_META[result.questionId];
        return `
          <article
            class="w1-quickcheck-summary__card"
            data-summary-state="${result.correct ? 'correct' : 'review'}"
            style="--topic-color: ${meta.color};"
          >
            <p class="w1-quickcheck-summary__kicker">${escapeHtml(meta.chapter)}</p>
            <div class="w1-quickcheck-summary__meta">
              <span class="w1-quickcheck-summary__state">${result.correct ? 'Locked In' : 'Review'}</span>
              <span class="w1-quickcheck-summary__topic">${escapeHtml(meta.label)}</span>
            </div>
            <p class="w1-quickcheck-summary__copy">${escapeHtml(result.explanation)}</p>
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
        this._ui.progress.textContent = `${answered} / ${PROBLEM.questions.length} questions answered`;
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
