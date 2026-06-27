/**
 * DataForge — editor.js
 *
 * Code editor widget for pandas-like levels.
 * Couples a textarea-based editor with the fake Interpreter, a console panel,
 * optional task tracking, and optional DataTable live updates.
 */

'use strict';

import { DataFrame } from '../pandas/dataframe.js';
import { Interpreter } from '../pandas/interpreter.js';

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function emit(target, type, detail) {
  target.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
}

function formatResults(results) {
  return results.map(result => {
    const prefix = result.status === 'error' ? '[error]' : result.status === 'info' ? '[info]' : '[ok]';
    return `${prefix} ${result.output || '(no output)'}`;
  }).join('\n\n');
}

function highlightCode(text) {
  const tokens = [];
  const stash = (className, value) => {
    const key = `__DF_TOKEN_${tokens.length}__`;
    tokens.push({
      key,
      html: `<span class="editor-token editor-token--${className}">${escapeHtml(value)}</span>`,
    });
    return key;
  };

  let staged = text
    .replace(/("[^"\n]*"|'[^'\n]*')/g, match => stash('string', match))
    .replace(/(#.*$)/gm, match => stash('comment', match));

  staged = escapeHtml(staged)
    .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="editor-token editor-token--number">$1</span>')
    .replace(/\b(df|pd|np|freq|IQR|Q1|Q3|threshold|rare)\b/g, '<span class="editor-token editor-token--keyword">$1</span>');

  tokens.forEach(token => {
    staged = staged.replace(token.key, token.html);
  });

  return staged;
}

export class CodeEditorWidget {
  constructor(container, options = {}) {
    if (!(container instanceof HTMLElement)) {
      throw new TypeError('CodeEditorWidget: container must be an HTMLElement.');
    }
    if (!(options.df instanceof DataFrame)) {
      throw new TypeError('CodeEditorWidget: options.df must be a DataFrame instance.');
    }

    this._container = container;
    this._opts = {
      df: options.df,
      initialCode: options.initialCode ?? '# Write your pandas-like commands here',
      reference: options.reference ?? [],
      tasks: options.tasks ?? [],
      emptyTaskMessage: options.emptyTaskMessage ?? 'No task validators configured.',
      table: options.table ?? null,
      worldColor: options.worldColor ?? 'var(--color-primary)',
      runButtonLabel: options.runButtonLabel ?? 'Run',
      onRun: options.onRun ?? null,
    };

    this._interpreter = new Interpreter(this._opts.df);
    this._baselineDf = this._opts.df;
    this._render();
  }

  get code() {
    return this._textareaEl.value;
  }

  get df() {
    return this._interpreter.df;
  }

  setCode(code) {
    this._textareaEl.value = code;
    this._syncEditorChrome();
  }

  setTasks(tasks) {
    this._opts.tasks = tasks;
    this._renderTasks(this._interpreter.checkTasks(this._opts.tasks));
  }

  setReference(reference) {
    this._opts.reference = reference;
    this._renderReference();
  }

  reset(df = this._baselineDf) {
    if (!(df instanceof DataFrame)) {
      throw new TypeError('CodeEditorWidget.reset(): df must be a DataFrame instance.');
    }

    this._baselineDf = df;
    this._interpreter.reset(df);
    this._textareaEl.value = this._opts.initialCode;
    this._consoleEl.textContent = 'Interpreter reset. Ready to run again.';
    this._statusEl.textContent = 'Ready';
    this._statusEl.className = 'badge badge--muted editor-status';
    this._opts.table?.update?.(df);
    this._renderTasks(this._interpreter.checkTasks(this._opts.tasks));
    this._syncEditorChrome();
  }

  run() {
    const results = this._interpreter.runBlock(this._textareaEl.value);
    const taskStatus = this._interpreter.checkTasks(this._opts.tasks);

    this._consoleEl.textContent = formatResults(results);
    this._renderTasks(taskStatus);

    results.forEach(result => {
      if (result.status === 'ok' && this._opts.table?.applyExecutionResult) {
        this._opts.table.applyExecutionResult(result);
      }
    });

    const summary = {
      results,
      df: this._interpreter.df,
      vars: this._interpreter.vars,
      tasks: taskStatus,
      perfect: taskStatus.every(task => task.passed),
    };

    const hasError = results.some(result => result.status === 'error');
    this._statusEl.textContent = hasError ? 'Error' : 'Executed';
    this._statusEl.className = `badge ${hasError ? 'badge--danger' : 'badge--success'} editor-status`;

    this._opts.onRun?.(summary);
    emit(this._container, 'editor:run', summary);

    return summary;
  }

  destroy() {
    this._runBtn?.removeEventListener('click', this._onRun);
    this._resetBtn?.removeEventListener('click', this._onReset);
    this._textareaEl?.removeEventListener('input', this._onInput);
    this._textareaEl?.removeEventListener('scroll', this._onScroll);
    this._textareaEl?.removeEventListener('keydown', this._onKeyDown);
  }

  _render() {
    this._container.innerHTML = `
      <section class="editor-widget" style="--world-color:${this._opts.worldColor}">
        <header class="editor-toolbar">
          <div>
            <p class="eyebrow">Code Lab</p>
            <h3 class="panel-title">Pandas Runner</h3>
          </div>
          <div class="editor-toolbar__actions">
            <span class="badge badge--muted editor-status">Ready</span>
            <button class="btn btn--ghost editor-reset" type="button">Reset</button>
            <button class="btn btn--primary editor-run" type="button">${this._opts.runButtonLabel}</button>
          </div>
        </header>

        <div class="editor-layout">
          <section class="editor-pane" aria-label="Code editor">
            <div class="editor-surface">
              <pre class="editor-gutter" aria-hidden="true"></pre>
              <div class="editor-code">
                <pre class="editor-highlight" aria-hidden="true"></pre>
                <textarea class="editor-input" spellcheck="false"></textarea>
              </div>
            </div>
            <pre class="editor-console" aria-live="polite">Ready to execute pandas-like commands.</pre>
          </section>

          <aside class="editor-sidebar">
            <section class="editor-panel">
              <div class="editor-panel__header">
                <h4 class="section-title">Task Status</h4>
              </div>
              <ul class="editor-task-list"></ul>
            </section>
            <section class="editor-panel">
              <div class="editor-panel__header">
                <h4 class="section-title">Reference</h4>
              </div>
              <pre class="editor-reference"></pre>
            </section>
          </aside>
        </div>
      </section>
    `;

    this._statusEl = this._container.querySelector('.editor-status');
    this._runBtn = this._container.querySelector('.editor-run');
    this._resetBtn = this._container.querySelector('.editor-reset');
    this._textareaEl = this._container.querySelector('.editor-input');
    this._highlightEl = this._container.querySelector('.editor-highlight');
    this._gutterEl = this._container.querySelector('.editor-gutter');
    this._consoleEl = this._container.querySelector('.editor-console');
    this._taskListEl = this._container.querySelector('.editor-task-list');
    this._referenceEl = this._container.querySelector('.editor-reference');

    this._textareaEl.value = this._opts.initialCode;

    this._onRun = () => this.run();
    this._onReset = () => this.reset();
    this._onInput = () => this._syncEditorChrome();
    this._onScroll = () => {
      this._highlightEl.scrollTop = this._textareaEl.scrollTop;
      this._highlightEl.scrollLeft = this._textareaEl.scrollLeft;
      this._gutterEl.scrollTop = this._textareaEl.scrollTop;
    };
    this._onKeyDown = event => this._handleKeyDown(event);

    this._runBtn.addEventListener('click', this._onRun);
    this._resetBtn.addEventListener('click', this._onReset);
    this._textareaEl.addEventListener('input', this._onInput);
    this._textareaEl.addEventListener('scroll', this._onScroll);
    this._textareaEl.addEventListener('keydown', this._onKeyDown);

    this._renderReference();
    this._renderTasks(this._interpreter.checkTasks(this._opts.tasks));
    this._syncEditorChrome();
  }

  _renderReference() {
    this._referenceEl.textContent = this._opts.reference.length
      ? this._opts.reference.join('\n')
      : 'No reference loaded.';
  }

  _handleKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.run();
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const pairMap = {
      '(': ')',
      '[': ']',
      '{': '}',
      '"': '"',
      '\'': '\'',
    };

    const closerSet = new Set(Object.values(pairMap));
    const start = this._textareaEl.selectionStart;
    const end = this._textareaEl.selectionEnd;
    const nextChar = this._textareaEl.value.slice(end, end + 1);

    if (closerSet.has(event.key) && start === end && nextChar === event.key) {
      event.preventDefault();
      this._textareaEl.setSelectionRange(start + 1, start + 1);
      return;
    }

    const open = pairMap[event.key];

    if (open) {
      event.preventDefault();
      this._insertPairedText(event.key, open);
      return;
    }

    if (event.key === 'Backspace') {
      if (start !== end || start === 0) return;

      const prevChar = this._textareaEl.value.slice(start - 1, start);
      const nextChar = this._textareaEl.value.slice(start, start + 1);
      if (pairMap[prevChar] && pairMap[prevChar] === nextChar) {
        event.preventDefault();
        this._replaceEditorRange(start - 1, start + 1, '');
        this._textareaEl.setSelectionRange(start - 1, start - 1);
      }
    }
  }

  _insertPairedText(openChar, closeChar) {
    const start = this._textareaEl.selectionStart;
    const end = this._textareaEl.selectionEnd;
    const selected = this._textareaEl.value.slice(start, end);
    const nextValue = `${openChar}${selected}${closeChar}`;
    const cursorOffset = selected ? nextValue.length - 1 : 1;

    this._replaceEditorRange(start, end, nextValue);
    if (selected) {
      this._textareaEl.setSelectionRange(start + 1, end + 1);
    } else {
      this._textareaEl.setSelectionRange(start + cursorOffset, start + cursorOffset);
    }
  }

  _replaceEditorRange(start, end, nextValue) {
    const current = this._textareaEl.value;
    this._textareaEl.value = `${current.slice(0, start)}${nextValue}${current.slice(end)}`;
    this._syncEditorChrome();
  }

  _renderTasks(statuses) {
    if (!statuses.length) {
      this._taskListEl.innerHTML = `<li class="editor-task editor-task--empty">${escapeHtml(this._opts.emptyTaskMessage)}</li>`;
      return;
    }

    this._taskListEl.innerHTML = statuses.map(task => `
      <li class="editor-task ${task.passed ? 'editor-task--done' : 'editor-task--pending'}">
        <span class="editor-task__dot" aria-hidden="true"></span>
        <span>${task.label}</span>
      </li>
    `).join('');
  }

  _syncEditorChrome() {
    const code = this._textareaEl.value;
    const lineCount = Math.max(1, code.split('\n').length);
    this._gutterEl.textContent = Array.from({ length: lineCount }, (_, index) => index + 1).join('\n');
    this._highlightEl.innerHTML = `${highlightCode(code)}\n`;
  }
}
