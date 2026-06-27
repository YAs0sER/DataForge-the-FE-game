/**
 * DataForge — mcq.js
 *
 * Generic quiz engine for review and concept-check levels.
 * Supports:
 *   • single-answer multiple choice
 *   • inline match-the-pairs questions
 */

'use strict';

function emit(target, type, detail) {
  target.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
}

function esc(text) {
  return String(text)
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

export class MCQWidget {
  constructor(container, options = {}) {
    if (!(container instanceof HTMLElement)) {
      throw new TypeError('MCQWidget: container must be an HTMLElement.');
    }

    this._container = container;
    this._opts = {
      questions: [],
      worldColor: 'var(--color-primary)',
      onAnswer: null,
      onComplete: null,
      ...options,
    };

    this._questions = this._opts.questions;
    this._index = 0;
    this._results = [];
    this._selection = null;
    this._destroyFns = [];

    this._render();
  }

  get results() {
    return [...this._results];
  }

  restart() {
    this._index = 0;
    this._results = [];
    this._selection = null;
    this._renderQuestion();
  }

  destroy() {
    this._destroyFns.forEach(fn => fn());
    this._destroyFns = [];
  }

  _render() {
    this._container.innerHTML = `
      <section class="mcq-shell" style="--world-color:${this._opts.worldColor}">
        <header class="mcq-shell__header">
          <div class="mcq-progress" aria-label="Question progress"></div>
          <p class="text-muted">One attempt per question. Explanations appear immediately after you confirm.</p>
        </header>

        <div class="mcq-stage"></div>

        <footer class="mcq-footer">
          <button class="btn btn--primary mcq-confirm" type="button" disabled>Confirm</button>
          <button class="btn btn--primary mcq-next" type="button" hidden>Continue</button>
        </footer>
      </section>
    `;

    this._progressEl = this._container.querySelector('.mcq-progress');
    this._stageEl = this._container.querySelector('.mcq-stage');
    this._confirmBtn = this._container.querySelector('.mcq-confirm');
    this._nextBtn = this._container.querySelector('.mcq-next');

    this._onConfirm = this._confirmCurrent.bind(this);
    this._onNext = this._advance.bind(this);

    this._confirmBtn.addEventListener('click', this._onConfirm);
    this._nextBtn.addEventListener('click', this._onNext);

    this._destroyFns.push(() => this._confirmBtn.removeEventListener('click', this._onConfirm));
    this._destroyFns.push(() => this._nextBtn.removeEventListener('click', this._onNext));

    this._renderQuestion();
  }

  _renderQuestion() {
    const question = this._questions[this._index];
    this._selection = null;

    this._confirmBtn.disabled = true;
    this._confirmBtn.hidden = false;
    this._nextBtn.hidden = true;

    this._progressEl.innerHTML = this._questions.map((_, index) => {
      const result = this._results[index];
      const cls = result
        ? (result.correct ? 'mcq-pip mcq-pip--correct' : 'mcq-pip mcq-pip--wrong')
        : (index === this._index ? 'mcq-pip mcq-pip--active' : 'mcq-pip');
      return `<span class="${cls}" aria-hidden="true"></span>`;
    }).join('');

    if (!question) {
      this._complete();
      return;
    }

    if (question.type === 'match') {
      this._renderMatchQuestion(question);
    } else {
      this._renderSingleQuestion(question);
    }
  }

  _renderSingleQuestion(question) {
    const options = shuffleCopy(question.options);

    this._stageEl.innerHTML = `
      <article class="mcq-question">
        <p class="eyebrow">Question ${this._index + 1} / ${this._questions.length}</p>
        <h3 class="panel-title">${esc(question.prompt)}</h3>
        <div class="mcq-options" role="radiogroup" aria-label="${esc(question.prompt)}">
          ${options.map((option, optionIndex) => `
            <button class="mcq-option" data-option-id="${esc(option.id)}" type="button">
              <span class="mcq-option__key">${String.fromCharCode(65 + optionIndex)}</span>
              <span>${esc(option.text)}</span>
            </button>
          `).join('')}
        </div>
        <div class="mcq-explanation" hidden></div>
      </article>
    `;

    const buttons = this._stageEl.querySelectorAll('.mcq-option');
    buttons.forEach(button => {
      const handler = () => {
        buttons.forEach(item => item.classList.remove('mcq-option--selected'));
        button.classList.add('mcq-option--selected');
        this._selection = { type: 'single', optionId: button.dataset.optionId };
        this._confirmBtn.disabled = false;
      };
      button.addEventListener('click', handler);
      this._destroyFns.push(() => button.removeEventListener('click', handler));
    });
  }

  _renderMatchQuestion(question) {
    this._stageEl.innerHTML = `
      <article class="mcq-question">
        <p class="eyebrow">Question ${this._index + 1} / ${this._questions.length}</p>
        <h3 class="panel-title">${esc(question.prompt)}</h3>
        <div class="mcq-match-grid">
          ${question.pairs.map(pair => `
            <label class="mcq-match-row" for="pair-${esc(pair.id)}">
              <span class="mcq-match-row__label">${esc(pair.prompt)}</span>
              <select class="input mcq-match-select" id="pair-${esc(pair.id)}" data-pair-id="${esc(pair.id)}">
                <option value="">Choose a match</option>
                ${shuffleCopy(pair.options).map(option => `<option value="${esc(option)}">${esc(option)}</option>`).join('')}
              </select>
            </label>
          `).join('')}
        </div>
        <div class="mcq-explanation" hidden></div>
      </article>
    `;

    const selects = this._stageEl.querySelectorAll('.mcq-match-select');
    const onChange = () => {
      const answers = {};
      selects.forEach(select => {
        answers[select.dataset.pairId] = select.value;
      });
      this._selection = { type: 'match', answers };
      this._confirmBtn.disabled = Object.values(answers).some(value => !value);
    };

    selects.forEach(select => {
      select.addEventListener('change', onChange);
      this._destroyFns.push(() => select.removeEventListener('change', onChange));
    });
  }

  _confirmCurrent() {
    const question = this._questions[this._index];
    if (!question || !this._selection || this._confirmBtn.disabled || this._confirmBtn.hidden) return;

    this._confirmBtn.disabled = true;

    const explanationEl = this._stageEl.querySelector('.mcq-explanation');
    let result;

    if (question.type === 'match') {
      result = this._scoreMatch(question);
      this._lockMatchQuestion(question, result);
    } else {
      result = this._scoreSingle(question);
      this._lockSingleQuestion(question, result);
    }

    this._results[this._index] = result;
    explanationEl.hidden = false;
    explanationEl.innerHTML = `<p>${esc(result.explanation)}</p>`;

    this._confirmBtn.hidden = true;
    this._nextBtn.hidden = false;

    this._opts.onAnswer?.(result);
    emit(this._container, 'mcq:answer', result);
  }

  _scoreSingle(question) {
    const chosen = question.options.find(option => option.id === this._selection.optionId);
    const correct = Boolean(chosen?.correct);
    return {
      questionId: question.id,
      correct,
      selected: chosen?.id ?? null,
      explanation: question.explanation ?? (correct ? 'Correct.' : 'Not quite.'),
    };
  }

  _scoreMatch(question) {
    const answers = this._selection.answers;
    const pairResults = question.pairs.map(pair => ({
      pairId: pair.id,
      selected: answers[pair.id],
      correct: answers[pair.id] === pair.correct,
    }));

    return {
      questionId: question.id,
      correct: pairResults.every(pair => pair.correct),
      pairs: pairResults,
      explanation: question.explanation ?? 'Review the pairings and try to explain why each treatment fits.',
    };
  }

  _lockSingleQuestion(question, result) {
    const buttons = this._stageEl.querySelectorAll('.mcq-option');
    buttons.forEach(button => {
      const option = question.options.find(item => item.id === button.dataset.optionId);
      button.classList.add('mcq-option--locked');
      if (option?.correct) button.classList.add('mcq-option--correct');
      if (button.dataset.optionId === result.selected && !option?.correct) {
        button.classList.add('mcq-option--wrong');
      }
    });
  }

  _lockMatchQuestion(question, result) {
    const selects = this._stageEl.querySelectorAll('.mcq-match-select');
    selects.forEach(select => {
      const pair = question.pairs.find(item => item.id === select.dataset.pairId);
      const pairResult = result.pairs.find(item => item.pairId === pair.id);
      select.disabled = true;
      select.classList.add(pairResult.correct ? 'mcq-match-select--correct' : 'mcq-match-select--wrong');
    });
  }

  _advance() {
    this._index += 1;
    if (this._index >= this._questions.length) {
      this._complete();
      return;
    }
    this._renderQuestion();
  }

  _complete() {
    const summary = {
      total: this._questions.length,
      correct: this._results.filter(result => result.correct).length,
      wrong: this._results.filter(result => !result.correct).length,
      results: [...this._results],
      perfect: this._results.every(result => result.correct),
    };

    this._stageEl.innerHTML = `
      <article class="mcq-question mcq-question--complete">
        <p class="eyebrow">Review Complete</p>
        <h3 class="panel-title">${summary.correct} / ${summary.total} correct</h3>
        <p class="mcq-explanation">${summary.perfect ? 'Perfect run. You can move on with full confidence.' : 'You have a clear read on what to revisit before the next world.'}</p>
      </article>
    `;

    this._confirmBtn.hidden = true;
    this._nextBtn.hidden = true;

    this._opts.onComplete?.(summary);
    emit(this._container, 'mcq:complete', summary);
  }
}
