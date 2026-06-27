/**
 * DataForge — calculator.js
 *
 * Reusable calculator widget for manual-computation levels.
 * Supports standard arithmetic plus dataset-aware helper actions:
 *   • Sum   — sum non-missing numeric values from the bound dataset
 *   • Count — count non-missing numeric values
 *   • Sort  — sort the bound dataset ascending (useful for medians)
 */

'use strict';

function emit(target, type, detail) {
  target.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
}

function sanitizeExpression(expression) {
  return expression.replace(/×/g, '*').replace(/÷/g, '/').replace(/\s+/g, '');
}

function tokenize(expression) {
  const tokens = [];
  const source = sanitizeExpression(expression);
  let i = 0;

  while (i < source.length) {
    const char = source[i];

    if (/\d|\./.test(char) || (char === '-' && (i === 0 || /[+\-*/(]/.test(source[i - 1])))) {
      let value = char;
      i++;
      while (i < source.length && /[\d.]/.test(source[i])) {
        value += source[i];
        i++;
      }
      if (Number.isNaN(Number(value))) {
        throw new Error(`Invalid number "${value}".`);
      }
      tokens.push({ type: 'number', value: Number(value) });
      continue;
    }

    if (/[+\-*/()]/.test(char)) {
      tokens.push({ type: 'operator', value: char });
      i++;
      continue;
    }

    throw new Error(`Unsupported character "${char}".`);
  }

  return tokens;
}

function precedence(operator) {
  if (operator === '+' || operator === '-') return 1;
  if (operator === '*' || operator === '/') return 2;
  return 0;
}

function toRpn(tokens) {
  const output = [];
  const operators = [];

  for (const token of tokens) {
    if (token.type === 'number') {
      output.push(token);
      continue;
    }

    if (token.value === '(') {
      operators.push(token);
      continue;
    }

    if (token.value === ')') {
      while (operators.length && operators[operators.length - 1].value !== '(') {
        output.push(operators.pop());
      }
      if (!operators.length) throw new Error('Unbalanced parentheses.');
      operators.pop();
      continue;
    }

    while (
      operators.length &&
      operators[operators.length - 1].value !== '(' &&
      precedence(operators[operators.length - 1].value) >= precedence(token.value)
    ) {
      output.push(operators.pop());
    }
    operators.push(token);
  }

  while (operators.length) {
    const operator = operators.pop();
    if (operator.value === '(') throw new Error('Unbalanced parentheses.');
    output.push(operator);
  }

  return output;
}

function evaluateRpn(tokens) {
  const stack = [];

  for (const token of tokens) {
    if (token.type === 'number') {
      stack.push(token.value);
      continue;
    }

    const right = stack.pop();
    const left = stack.pop();
    if (left == null || right == null) {
      throw new Error('Incomplete expression.');
    }

    switch (token.value) {
      case '+': stack.push(left + right); break;
      case '-': stack.push(left - right); break;
      case '*': stack.push(left * right); break;
      case '/':
        if (right === 0) throw new Error('Division by zero.');
        stack.push(left / right);
        break;
      default:
        throw new Error(`Unsupported operator "${token.value}".`);
    }
  }

  if (stack.length !== 1) {
    throw new Error('Invalid expression.');
  }

  return stack[0];
}

function evaluateAdvancedExpression(expression) {
  const source = sanitizeExpression(expression)
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/√/g, 'sqrt');
  let index = 0;

  function peek() {
    return source[index] ?? '';
  }

  function consume(char) {
    if (peek() === char) {
      index++;
      return true;
    }
    return false;
  }

  function parseNumber() {
    let value = '';
    while (/[\d.]/.test(peek())) {
      value += peek();
      index++;
    }
    if (!value || Number.isNaN(Number(value))) {
      throw new Error('Expected a number.');
    }
    return Number(value);
  }

  function parsePrimary() {
    if (consume('(')) {
      const value = parseExpression();
      if (!consume(')')) throw new Error('Unbalanced parentheses.');
      return value;
    }
    return parseNumber();
  }

  function parseUnary() {
    if (consume('-')) return -parseUnary();
    if (source.slice(index, index + 4).toLowerCase() === 'sqrt') {
      index += 4;
      const value = parseUnary();
      if (value < 0) throw new Error('Cannot square-root a negative value.');
      return Math.sqrt(value);
    }
    return parsePrimary();
  }

  function parsePower() {
    const left = parseUnary();
    if (consume('^')) {
      return left ** parsePower();
    }
    return left;
  }

  function parseTerm() {
    let value = parsePower();
    while (peek() === '*' || peek() === '/') {
      const operator = peek();
      index++;
      const right = parsePower();
      if (operator === '*') {
        value *= right;
      } else {
        if (right === 0) throw new Error('Division by zero.');
        value /= right;
      }
    }
    return value;
  }

  function parseExpression() {
    let value = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const operator = peek();
      index++;
      const right = parseTerm();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  }

  const value = parseExpression();
  if (index !== source.length) {
    throw new Error(`Unsupported character "${peek()}".`);
  }
  return value;
}

function evaluateExpression(expression) {
  const trimmed = expression.trim();
  if (!trimmed) return 0;
  return evaluateAdvancedExpression(trimmed);
}

function numericDataset(values) {
  return values.filter(value => typeof value === 'number' && !Number.isNaN(value));
}

export class CalculatorWidget {
  constructor(container, options = {}) {
    if (!(container instanceof HTMLElement)) {
      throw new TypeError('CalculatorWidget: container must be an HTMLElement.');
    }

    this._container = container;
    this._opts = {
      title: 'Calculator',
      worldColor: 'var(--color-primary)',
      dataset: [],
      onResult: null,
      onSpecial: null,
      ...options,
    };

    this._dataset = numericDataset(this._opts.dataset);
    this._display = '';
    this._history = [];
    this._destroyFns = [];
    this._isOpen = false;
    this._panelOwner = this._container.closest('.panel');

    this._render();
  }

  get value() {
    return this._display;
  }

  get history() {
    return [...this._history];
  }

  setDataset(values) {
    this._dataset = numericDataset(values);
    this._refreshDatasetMeta();
  }

  clear() {
    this._display = '';
    this._setDisplay('');
    this._setMeta('Ready for manual feature work.');
  }

  press(key) {
    switch (key) {
      case 'C':
        this.clear();
        return;
      case '⌫':
        this._display = this._display.slice(0, -1);
        this._setDisplay(this._display);
        return;
      case '=':
        this._evaluate();
        return;
      case 'Sum':
      case 'Count':
      case 'Sort':
        this._runSpecial(key);
        return;
      case 'sqrt':
        this._display += 'sqrt(';
        this._setDisplay(this._display);
        return;
      case 'square':
        this._display += '^2';
        this._setDisplay(this._display);
        return;
      default:
        this._display += key;
        this._setDisplay(this._display);
    }
  }

  destroy() {
    this._destroyFns.forEach(fn => fn());
    this._destroyFns = [];
    this._container.classList.remove('calc-floating-host', 'calc-floating-host--left');
    this._panelOwner?.classList.remove('calculator-panel--floating');
  }

  _render() {
    this._container.innerHTML = `
      <section class="calc-widget" style="--world-color:${this._opts.worldColor}" tabindex="0">
        <header class="calc-widget__header">
          <div>
            <p class="eyebrow">Manual Math</p>
            <h3 class="panel-title">${this._opts.title}</h3>
          </div>
          <span class="badge badge--muted calc-widget__dataset-badge">0 values</span>
        </header>

        <div class="calc-display" aria-live="polite">0</div>
        <p class="calc-meta text-muted">Ready for manual feature work.</p>

        <div class="calc-specials" role="group" aria-label="Calculator helpers">
          <button class="btn btn--ghost calc-key calc-key--special" data-key="Sum" type="button">Sum</button>
          <button class="btn btn--ghost calc-key calc-key--special" data-key="Count" type="button">Count</button>
          <button class="btn btn--ghost calc-key calc-key--special" data-key="Sort" type="button">Sort</button>
          <button class="btn btn--ghost calc-key calc-key--special" data-key="sqrt" type="button">√</button>
          <button class="btn btn--ghost calc-key calc-key--special" data-key="square" type="button">x²</button>
        </div>

        <div class="calc-keypad" role="group" aria-label="Calculator keypad">
          ${[
            '7', '8', '9', '÷',
            '4', '5', '6', '×',
            '1', '2', '3', '-',
            '0', '.', '=', '+',
            '(', ')', '⌫', 'C',
          ].map(key => `
            <button
              class="btn ${key === '=' ? 'btn--primary' : 'btn--ghost'} calc-key"
              data-key="${key}"
              type="button"
            >${key}</button>
          `).join('')}
        </div>

        <ol class="calc-history" aria-label="Recent calculations"></ol>
      </section>
    `;

    this._displayEl = this._container.querySelector('.calc-display');
    this._metaEl = this._container.querySelector('.calc-meta');
    this._historyEl = this._container.querySelector('.calc-history');
    this._datasetBadgeEl = this._container.querySelector('.calc-widget__dataset-badge');
    this._rootEl = this._container.querySelector('.calc-widget');
    this._enableFloatingMode();

    this._container.querySelectorAll('[data-key]').forEach(button => {
      button.style.minHeight = '30px';
      button.style.height = '30px';
      button.style.paddingBlock = '0';
      const handler = () => this.press(button.dataset.key);
      button.addEventListener('click', handler);
      this._destroyFns.push(() => button.removeEventListener('click', handler));
    });

    this._onKeyDown = this._handleKeyDown.bind(this);
    this._rootEl?.addEventListener('keydown', this._onKeyDown);
    this._destroyFns.push(() => this._rootEl?.removeEventListener('keydown', this._onKeyDown));

    this._refreshDatasetMeta();
    this.clear();
  }

  _enableFloatingMode() {
    this._container.classList.add('calc-floating-host');
    this._container.style.setProperty('--world-color', this._opts.worldColor);
    this._panelOwner?.classList.add('calculator-panel--floating');

    const popover = document.createElement('section');
    popover.className = 'calc-popover';
    popover.hidden = true;

    const bar = document.createElement('div');
    bar.className = 'calc-popover__bar';

    const grip = document.createElement('span');
    grip.className = 'calc-popover__grip';
    grip.setAttribute('aria-hidden', 'true');

    const closeButton = document.createElement('button');
    closeButton.className = 'calc-popover__close';
    closeButton.type = 'button';
    closeButton.textContent = 'Close';
    closeButton.setAttribute('aria-label', 'Close calculator');

    const dockButton = document.createElement('button');
    dockButton.className = 'calc-popover__dock';
    dockButton.type = 'button';
    dockButton.textContent = 'Move left';
    dockButton.setAttribute('aria-label', 'Move calculator to the left');

    const actions = document.createElement('div');
    actions.className = 'calc-popover__actions';
    actions.append(dockButton, closeButton);

    const fab = document.createElement('button');
    fab.className = 'calc-fab';
    fab.type = 'button';
    fab.setAttribute('aria-expanded', 'false');
    fab.setAttribute('aria-label', 'Open calculator');
    fab.title = 'Open calculator';
    fab.innerHTML = '<span class="calc-fab__icon" aria-hidden="true">123</span><span class="calc-fab__label">Calculator</span>';

    bar.append(grip, actions);
    popover.append(bar, this._rootEl);
    this._container.append(popover, fab);

    this._fabEl = fab;
    this._popoverEl = popover;
    this._closeEl = closeButton;
    this._dockEl = dockButton;
    this._rootEl.tabIndex = -1;

    const openHandler = () => this._setOpen(true);
    const closeHandler = () => this._setOpen(false);
    const dockHandler = () => this._toggleDock();
    fab.addEventListener('click', openHandler);
    closeButton.addEventListener('click', closeHandler);
    dockButton.addEventListener('click', dockHandler);
    this._destroyFns.push(() => fab.removeEventListener('click', openHandler));
    this._destroyFns.push(() => closeButton.removeEventListener('click', closeHandler));
    this._destroyFns.push(() => dockButton.removeEventListener('click', dockHandler));

    this._onDocumentKeyDown = event => {
      if (event.key === 'Escape' && this._isOpen) {
        event.preventDefault();
        this._setOpen(false);
      }
    };
    document.addEventListener('keydown', this._onDocumentKeyDown);
    this._destroyFns.push(() => document.removeEventListener('keydown', this._onDocumentKeyDown));
  }

  _setOpen(open) {
    this._isOpen = Boolean(open);
    if (this._popoverEl) {
      this._popoverEl.hidden = !this._isOpen;
    }
    this._fabEl?.setAttribute('aria-expanded', String(this._isOpen));
    this._fabEl?.classList.toggle('is-hidden', this._isOpen);

    if (this._isOpen) {
      this._rootEl?.focus();
    } else {
      this._fabEl?.focus();
    }
  }

  _toggleDock() {
    const dockedLeft = this._container.classList.toggle('calc-floating-host--left');
    if (this._dockEl) {
      this._dockEl.textContent = dockedLeft ? 'Move right' : 'Move left';
      this._dockEl.setAttribute(
        'aria-label',
        dockedLeft ? 'Move calculator to the right' : 'Move calculator to the left',
      );
    }
  }

  _handleKeyDown(event) {
    const allowed = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '+', '-', '*', '/', '^', '(', ')']);
    if (allowed.has(event.key)) {
      event.preventDefault();
      this.press(event.key === '*' ? '×' : event.key === '/' ? '÷' : event.key);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      this.press('=');
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      this.press('⌫');
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this._setOpen(false);
    }
  }

  _evaluate() {
    try {
      const expression = this._display || '0';
      const result = evaluateExpression(expression);
      const formatted = String(Number(result.toFixed(6)));
      this._pushHistory(`${expression} = ${formatted}`);
      this._display = formatted;
      this._setDisplay(formatted);
      this._setMeta('Expression evaluated.');

      const payload = { expression, result };
      this._opts.onResult?.(payload);
      emit(this._container, 'calc:result', payload);
    } catch (error) {
      this._setMeta(error.message, true);
      emit(this._container, 'calc:error', { message: error.message });
    }
  }

  _runSpecial(action) {
    if (!this._dataset.length) {
      this._setMeta('Attach a dataset before using helper buttons.', true);
      return;
    }

    let resultText = '';
    let value = null;

    if (action === 'Sum') {
      value = this._dataset.reduce((sum, item) => sum + item, 0);
      resultText = String(Number(value.toFixed(6)));
    } else if (action === 'Count') {
      value = this._dataset.length;
      resultText = String(value);
    } else if (action === 'Sort') {
      value = [...this._dataset].sort((a, b) => a - b);
      resultText = value.join(', ');
    }

    this._display = typeof value === 'number' ? resultText : this._display;
    this._setDisplay(typeof value === 'number' ? resultText : this._display);
    this._setMeta(`${action}: ${resultText}`);
    this._pushHistory(`${action}: ${resultText}`);

    const payload = { action, value, dataset: [...this._dataset] };
    this._opts.onSpecial?.(payload);
    emit(this._container, 'calc:special', payload);
  }

  _refreshDatasetMeta() {
    if (!this._datasetBadgeEl) return;
    this._datasetBadgeEl.textContent = `${this._dataset.length} values`;
  }

  _pushHistory(text) {
    this._history.unshift(text);
    this._history = this._history.slice(0, 5);
    this._historyEl.innerHTML = this._history.map(item => `<li>${item}</li>`).join('');
  }

  _setDisplay(text) {
    this._displayEl.textContent = text || '0';
  }

  _setMeta(text, isError = false) {
    this._metaEl.textContent = text;
    this._metaEl.classList.toggle('text-danger', isError);
  }
}
