/**
 * DataForge — dragdrop.js
 * Reusable drag-and-drop system for all level types.
 *
 * Supports:
 *  - Token → Zone  (W1-L1 variable type buckets, W4-L5 encoding zones…)
 *  - Card  → Slot  (W1-L3 pipeline ordering, W6-L1 factory assembly…)
 *  - Cell  → Zone  (W2-L1 MCAR/MAR/MNAR labels…)
 *
 * Features:
 *  - Pointer-event based (works on touch + mouse)
 *  - Ghost element follows cursor
 *  - Drop zones highlight on drag-over
 *  - Snap / bounce-back animations
 *  - Sound hooks (plugs into engine event bus if present)
 *  - Keyboard alternative (Tab → Space/Enter to pick up, Tab to next zone, Enter to drop)
 *  - Callbacks: onDrop, onCorrect, onIncorrect, onComplete
 *  - Each DragDropInstance is fully independent — multiple can coexist on one screen
 */

// ─── Utility ────────────────────────────────────────────────────────────────

/**
 * Emit on the global event bus if the engine has registered one.
 * Falls back silently if bus is absent.
 */
function _emit(event, detail) {
  if (window.__gameEventBus && typeof window.__gameEventBus.emit === 'function') {
    window.__gameEventBus.emit(event, detail);
  }
  // Also fire as a native custom event for components that prefer that pattern
  document.dispatchEvent(new CustomEvent(`dataforge:${event}`, { detail, bubbles: true }));
}

/**
 * Deep-clone a plain object / array (no circular refs).
 */
function _clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Return the element's bounding rect, accounting for scroll.
 */
function _rect(el) {
  return el.getBoundingClientRect();
}

/**
 * Check whether point (cx, cy) lies inside a DOMRect.
 */
function _hitTest(rect, cx, cy) {
  return (
    cx >= rect.left &&
    cx <= rect.right &&
    cy >= rect.top &&
    cy <= rect.bottom
  );
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ANIMATION_DURATION = 260; // ms — snap / bounce-back
const GHOST_OPACITY      = 0.78;
const HOVER_SCALE        = 1.06;

// CSS class names (keeps JS free of hard-coded style strings)
const CLS = {
  draggable:      'dd-draggable',
  dragging:       'dd-dragging',
  ghost:          'dd-ghost',
  zone:           'dd-zone',
  zoneActive:     'dd-zone--active',    // drag is over this zone
  zoneTargetable: 'dd-zone--targetable',
  zoneOccupied:   'dd-zone--occupied',  // a token lives here
  zoneCorrect:    'dd-zone--correct',
  zoneIncorrect:  'dd-zone--incorrect',
  tokenPlaced:    'dd-token--placed',
  tokenSelected:  'dd-token--selected',
  tokenCorrect:   'dd-token--correct',
  tokenIncorrect: 'dd-token--incorrect',
  slotEmpty:      'dd-slot--empty',
  slotFilled:     'dd-slot--filled',
};

// ─── DragDropInstance ────────────────────────────────────────────────────────

/**
 * A self-contained drag-and-drop session bound to a container element.
 *
 * @param {Object} config
 * @param {HTMLElement}   config.container        Root element that holds all draggables + zones
 * @param {string}        config.draggableSelector CSS selector for draggable items (default '.dd-draggable')
 * @param {string}        config.zoneSelector      CSS selector for drop zones  (default '.dd-zone')
 * @param {boolean}       config.allowReorder      Whether dropping a token on an occupied zone swaps them (default false)
 * @param {boolean}       config.snapBack          Whether incorrect drops bounce tokens back (default true)
 * @param {boolean}       config.lockOnCorrect     Whether correct tokens become non-draggable (default true)
 * @param {boolean}       config.multiplePerZone   Whether a zone can hold more than one token (default false)
 * @param {boolean}       config.gradeOnDrop       Whether drops are graded immediately (default true)
 * @param {Function}      config.validate          (tokenId, zoneId) => boolean  — correctness check
 * @param {Function}      config.onDrop            (tokenId, zoneId, isCorrect) => void
 * @param {Function}      config.onCorrect         (tokenId, zoneId) => void
 * @param {Function}      config.onIncorrect       (tokenId, zoneId) => void
 * @param {Function}      config.onComplete        (placements) => void  — fires when all zones satisfied
 * @param {Object}        config.correctAnswers     { [zoneId]: tokenId | tokenId[] }  shorthand validate alternative
 */
export class DragDropInstance {
  constructor(config) {
    this._cfg = Object.assign({
      draggableSelector : `.${CLS.draggable}`,
      zoneSelector      : `.${CLS.zone}`,
      allowReorder      : false,
      snapBack          : true,
      lockOnCorrect     : true,
      multiplePerZone   : false,
      clickToPlace      : true,
      gradeOnDrop       : true,
      validate          : null,
      onDrop            : null,
      onCorrect         : null,
      onIncorrect       : null,
      onComplete        : null,
      correctAnswers    : null,
    }, config);

    if (!this._cfg.container) {
      throw new Error('[DragDrop] config.container is required');
    }

    // placements: { [tokenId]: zoneId | null }
    this._placements = {};
    // reverse: { [zoneId]: tokenId[] }
    this._zoneContents = {};

    // Drag state
    this._active = null; // { tokenEl, tokenId, startZoneId, ghost, origRect }

    // Keyboard state
    this._kbToken  = null; // currently keyboard-selected token id
    this._kbZones  = [];   // ordered zone ids for keyboard navigation
    this._kbZoneIdx = -1;
    this._clickTokenId = null;

    this._destroyed = false;

    this._init();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Returns a snapshot of current placements */
  getPlacements() {
    return _clone(this._placements);
  }

  /** Programmatically place a token in a zone (e.g., for loading saved state) */
  place(tokenId, zoneId, animate = false) {
    const tokenEl = this._getTokenEl(tokenId);
    const zoneEl  = this._getZoneEl(zoneId);
    if (!tokenEl || !zoneEl) return;
    this._doPlace(tokenEl, tokenId, zoneEl, zoneId, animate);
  }

  /** Reset all tokens to their origin positions */
  reset() {
    const tokens = this._cfg.container.querySelectorAll(this._cfg.draggableSelector);
    tokens.forEach(el => {
      const id = el.dataset.ddId;
      this._returnToOrigin(el, id, false);
    });
    this._placements  = {};
    this._zoneContents = {};
    // Re-mark all zones as empty
    this._cfg.container.querySelectorAll(this._cfg.zoneSelector).forEach(z => {
      z.classList.remove(CLS.zoneOccupied, CLS.zoneCorrect, CLS.zoneIncorrect);
      z.classList.add(CLS.slotEmpty);
    });
  }

  /** Destroy all listeners and remove the ghost element if any */
  destroy() {
    this._destroyed = true;
    this._cleanupPointerListeners();
    document.removeEventListener('keydown', this._onKeyDown);
    if (this._active?.ghost) {
      this._active.ghost.remove();
    }
    this._clearClickSelection();
  }

  // ── Initialization ─────────────────────────────────────────────────────────

  _init() {
    const container = this._cfg.container;

    // Seed placements map for every draggable present in DOM
    container.querySelectorAll(this._cfg.draggableSelector).forEach(el => {
      const id = el.dataset.ddId;
      if (!id) {
        console.warn('[DragDrop] draggable element missing data-dd-id:', el);
        return;
      }
      this._placements[id] = null; // not placed anywhere yet
      // Store the token's home so we can animate it back
      el._ddHomeParent = el.parentElement;
      el._ddHomeNextSibling = el.nextSibling;
    });

    // Seed zone contents
    container.querySelectorAll(this._cfg.zoneSelector).forEach(el => {
      const id = el.dataset.ddZone;
      if (!id) {
        console.warn('[DragDrop] zone element missing data-dd-zone:', el);
        return;
      }
      this._zoneContents[id] = [];
      el.classList.add(CLS.slotEmpty);
    });

    // Pointer events (pointerdown on container via delegation)
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp   = this._onPointerUp.bind(this);
    this._onKeyDown     = this._onKeyDown.bind(this);

    container.addEventListener('pointerdown', this._onPointerDown);
    document.addEventListener('keydown', this._onKeyDown);

    // Build keyboard zone order
    this._kbZones = Array.from(container.querySelectorAll(this._cfg.zoneSelector)).map(el => {
      if (!el.hasAttribute('tabindex')) {
        el.tabIndex = 0;
      }
      if (!el.dataset.ddLabel) {
        const labelSource = el.querySelector('h3, [data-dd-title]')?.textContent?.trim();
        if (labelSource) {
          el.dataset.ddLabel = labelSource;
        }
      }
      return el.dataset.ddZone;
    }).filter(Boolean);
  }

  // ── Pointer Handlers ───────────────────────────────────────────────────────

  _onPointerDown(e) {
    if (this._destroyed) return;

    const zoneEl = e.target.closest(this._cfg.zoneSelector);
    if (zoneEl && this._cfg.clickToPlace && this._clickTokenId) {
      const tokenId = this._clickTokenId;
      const carriedToken = this._getTokenEl(tokenId);
      const fromZoneId = this._placements[tokenId] ?? null;
      const zoneId = zoneEl.dataset.ddZone;

      if (!zoneId || !carriedToken) return;

      e.preventDefault();
      this._clearClickSelection();
      this._handleDrop(carriedToken, tokenId, fromZoneId, zoneId);
      return;
    }

    const tokenEl = e.target.closest(this._cfg.draggableSelector);
    if (!tokenEl || tokenEl.classList.contains(CLS.tokenCorrect) && this._cfg.lockOnCorrect) return;

    const tokenId = tokenEl.dataset.ddId;
    if (!tokenId) return;

    e.preventDefault();
    tokenEl.setPointerCapture(e.pointerId);
    this._clearClickSelection();

    const rect = _rect(tokenEl);

    // Create ghost
    const ghost = this._createGhost(tokenEl, e.clientX, e.clientY, rect);

    // Lift original slightly (dim it)
    tokenEl.classList.add(CLS.dragging);
    tokenEl.style.opacity = '0.35';

    // Determine current zone (if any)
    const currentZone = this._placements[tokenId] ?? null;

    this._active = {
      tokenEl,
      tokenId,
      pointerId: e.pointerId,
      startZoneId: currentZone,
      ghost,
      origRect: rect,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      startX: e.clientX,
      startY: e.clientY,
      didMove: false,
    };

    // Attach move/up to the token el (pointer capture ensures we get all events)
    tokenEl.addEventListener('pointermove', this._onPointerMove);
    tokenEl.addEventListener('pointerup',   this._onPointerUp);
    tokenEl.addEventListener('pointercancel', this._onPointerUp);

    _emit('drag:start', { tokenId, currentZone });
  }

  _onPointerMove(e) {
    if (!this._active || this._destroyed) return;
    e.preventDefault();

    const { ghost, offsetX, offsetY, startX, startY } = this._active;
    ghost.style.left = `${e.clientX - offsetX}px`;
    ghost.style.top  = `${e.clientY - offsetY}px`;
    if (!this._active.didMove) {
      const movedFarEnough = Math.hypot(e.clientX - startX, e.clientY - startY) > 6;
      if (movedFarEnough) {
        this._active.didMove = true;
      }
    }

    // Highlight hovered zone
    this._updateZoneHighlight(e.clientX, e.clientY);
  }

  _onPointerUp(e) {
    if (!this._active || this._destroyed) return;

    const { tokenEl, tokenId, startZoneId, ghost, didMove } = this._active;

    if (!didMove && this._cfg.clickToPlace) {
      ghost.remove();
      tokenEl.classList.remove(CLS.dragging);
      tokenEl.style.opacity = '';
      this._clearZoneHighlights();
      this._cleanupPointerListeners(tokenEl);

      if (this._clickTokenId === tokenId) {
        this._clearClickSelection();
      } else {
        this._selectTokenForClick(tokenEl, tokenId);
      }

      this._active = null;
      return;
    }

    // Find the drop target
    const targetZone = this._findZoneAt(e.clientX, e.clientY);

    ghost.remove();
    tokenEl.classList.remove(CLS.dragging);
    tokenEl.style.opacity = '';

    // Clear zone highlights
    this._clearZoneHighlights();

    this._cleanupPointerListeners(tokenEl);

    if (targetZone) {
      this._handleDrop(tokenEl, tokenId, startZoneId, targetZone);
    } else {
      // Dropped on nothing → snap back
      this._animateReturn(tokenEl, tokenId, startZoneId);
    }

    this._active = null;
  }

  // ── Drop Logic ─────────────────────────────────────────────────────────────

  _handleDrop(tokenEl, tokenId, fromZoneId, toZoneId) {
    this._clearClickSelection();

    const zoneEl   = this._getZoneEl(toZoneId);
    const occupied = this._zoneContents[toZoneId] ?? [];

    // Zone is occupied and we don't allow multiple
    if (!this._cfg.multiplePerZone && occupied.length > 0) {
      if (this._cfg.allowReorder) {
        // Swap the current occupant back to origin
        const evictId  = occupied[0];
        const evictEl  = this._getTokenEl(evictId);
        this._returnToOrigin(evictEl, evictId, true);
      } else {
        // Bounce back
        this._animateReturn(tokenEl, tokenId, fromZoneId);
        return;
      }
    }

    // Remove from previous zone if there was one
    if (fromZoneId) {
      this._removeFromZone(tokenId, fromZoneId);
    }

    // Determine correctness
    const shouldGrade = this._cfg.gradeOnDrop !== false;
    const isCorrect = shouldGrade ? this._checkCorrect(tokenId, toZoneId) : null;

    // Commit placement
    this._doPlace(tokenEl, tokenId, zoneEl, toZoneId, true, isCorrect);

    // Callbacks
    if (typeof this._cfg.onDrop === 'function') {
      this._cfg.onDrop(tokenId, toZoneId, isCorrect);
    }

    if (shouldGrade) {
      if (isCorrect) {
        this._onCorrectDrop(tokenEl, tokenId, toZoneId, zoneEl);
      } else {
        this._onIncorrectDrop(tokenEl, tokenId, toZoneId, zoneEl, fromZoneId);
      }
    }

    _emit('drag:drop', { tokenId, zoneId: toZoneId, isCorrect });

    // Check completion
    if (shouldGrade) {
      this._checkCompletion();
    }
  }

  _doPlace(tokenEl, tokenId, zoneEl, zoneId, animate, isCorrect = null) {
    // Update data structures
    this._placements[tokenId] = zoneId;
    if (!this._zoneContents[zoneId]) this._zoneContents[zoneId] = [];
    if (!this._zoneContents[zoneId].includes(tokenId)) {
      this._zoneContents[zoneId].push(tokenId);
    }

    // Move token into zone DOM
    if (animate) {
      this._animateSnap(tokenEl, zoneEl, () => {
        zoneEl.appendChild(tokenEl);
        tokenEl.style.transform = '';
        tokenEl.style.position  = '';
      });
    } else {
      zoneEl.appendChild(tokenEl);
    }

    zoneEl.classList.remove(CLS.slotEmpty);
    zoneEl.classList.add(CLS.zoneOccupied);
    tokenEl.classList.add(CLS.tokenPlaced);
  }

  _onCorrectDrop(tokenEl, tokenId, zoneId, zoneEl) {
    tokenEl.classList.add(CLS.tokenCorrect);
    zoneEl.classList.add(CLS.zoneCorrect);
    zoneEl.classList.remove(CLS.zoneIncorrect);

    if (this._cfg.lockOnCorrect) {
      tokenEl.style.pointerEvents = 'none';
    }

    // Success micro-animation: pop scale
    this._popAnimation(tokenEl);

    // Screen-edge flash green (subtle)
    this._flashEdge('correct');

    _emit('drag:correct', { tokenId, zoneId });

    if (typeof this._cfg.onCorrect === 'function') {
      this._cfg.onCorrect(tokenId, zoneId);
    }
  }

  _onIncorrectDrop(tokenEl, tokenId, zoneId, zoneEl, fromZoneId) {
    tokenEl.classList.add(CLS.tokenIncorrect);
    zoneEl.classList.add(CLS.zoneIncorrect);

    this._flashEdge('incorrect');

    if (this._cfg.snapBack) {
      // Brief shake then return
      this._shakeAnimation(tokenEl, () => {
        tokenEl.classList.remove(CLS.tokenIncorrect);
        zoneEl.classList.remove(CLS.zoneIncorrect, CLS.zoneOccupied);
        this._removeFromZone(tokenId, zoneId);
        this._animateReturn(tokenEl, tokenId, fromZoneId);
      });
    }

    _emit('drag:incorrect', { tokenId, zoneId });

    if (typeof this._cfg.onIncorrect === 'function') {
      this._cfg.onIncorrect(tokenId, zoneId);
    }
  }

  // ── Correctness ────────────────────────────────────────────────────────────

  _checkCorrect(tokenId, zoneId) {
    // Explicit validate function takes priority
    if (typeof this._cfg.validate === 'function') {
      return this._cfg.validate(tokenId, zoneId);
    }
    // Fall back to correctAnswers map
    if (this._cfg.correctAnswers) {
      const expected = this._cfg.correctAnswers[zoneId];
      if (Array.isArray(expected)) return expected.includes(tokenId);
      if (expected !== undefined)  return expected === tokenId;
    }
    // No validation provided → treat all drops as correct
    return true;
  }

  _checkCompletion() {
    const zones = Object.keys(this._zoneContents);
    const allFilled = zones.length > 0 && zones.every(zId => {
      return (this._zoneContents[zId] ?? []).length > 0;
    });

    if (!allFilled) return;

    const allCorrect = Object.entries(this._placements).every(([tId, zId]) => {
      if (zId === null) return false;
      return this._checkCorrect(tId, zId);
    });

    if (allCorrect) {
      _emit('drag:complete', { placements: _clone(this._placements) });
      if (typeof this._cfg.onComplete === 'function') {
        this._cfg.onComplete(_clone(this._placements));
      }
    }
  }

  // ── Zone Management ────────────────────────────────────────────────────────

  _removeFromZone(tokenId, zoneId) {
    this._placements[tokenId] = null;
    const arr = this._zoneContents[zoneId];
    if (arr) {
      const idx = arr.indexOf(tokenId);
      if (idx !== -1) arr.splice(idx, 1);
      if (arr.length === 0) {
        const zoneEl = this._getZoneEl(zoneId);
        if (zoneEl) {
          zoneEl.classList.remove(CLS.zoneOccupied, CLS.zoneCorrect, CLS.zoneIncorrect);
          zoneEl.classList.add(CLS.slotEmpty);
        }
      }
    }
  }

  _returnToOrigin(tokenEl, tokenId, animate) {
    if (!tokenEl) return;
    const fromZoneId = this._placements[tokenId];
    if (fromZoneId) this._removeFromZone(tokenId, fromZoneId);
    tokenEl.classList.remove(CLS.tokenPlaced, CLS.tokenCorrect, CLS.tokenIncorrect);
    tokenEl.style.pointerEvents = '';

    if (animate) {
      this._animateReturn(tokenEl, tokenId, null);
    } else {
      // Re-insert at original DOM position
      const parent = tokenEl._ddHomeParent;
      const sibling = tokenEl._ddHomeNextSibling;
      if (parent) {
        parent.insertBefore(tokenEl, sibling || null);
      }
    }
  }

  _findZoneAt(cx, cy) {
    const zones = this._cfg.container.querySelectorAll(this._cfg.zoneSelector);
    for (const zone of zones) {
      if (_hitTest(_rect(zone), cx, cy)) {
        return zone.dataset.ddZone;
      }
    }
    return null;
  }

  _updateZoneHighlight(cx, cy) {
    this._cfg.container.querySelectorAll(this._cfg.zoneSelector).forEach(zoneEl => {
      const over = _hitTest(_rect(zoneEl), cx, cy);
      zoneEl.classList.toggle(CLS.zoneActive, over);
    });
  }

  _clearZoneHighlights() {
    this._cfg.container.querySelectorAll(this._cfg.zoneSelector).forEach(zoneEl => {
      zoneEl.classList.remove(CLS.zoneActive);
    });
  }

  // ── Animations ─────────────────────────────────────────────────────────────

  /**
   * Create a floating ghost clone that follows the pointer.
   */
  _createGhost(tokenEl, cx, cy, origRect) {
    const ghost = tokenEl.cloneNode(true);
    ghost.classList.add(CLS.ghost);
    ghost.style.cssText = `
      position: fixed;
      left: ${origRect.left}px;
      top:  ${origRect.top}px;
      width:  ${origRect.width}px;
      height: ${origRect.height}px;
      pointer-events: none;
      opacity: ${GHOST_OPACITY};
      z-index: 9999;
      transform: scale(${HOVER_SCALE});
      transform-origin: center center;
      transition: transform 80ms ease;
      box-shadow: 0 12px 40px rgba(108,99,255,0.35), 0 4px 12px rgba(0,0,0,0.5);
      border-radius: var(--radius-card, 12px);
    `;
    document.body.appendChild(ghost);
    return ghost;
  }

  /**
   * Snap the token to the center of a zone with a quick elastic animation.
   */
  _animateSnap(tokenEl, zoneEl, onDone) {
    const fromRect = _rect(tokenEl);
    const toRect   = _rect(zoneEl);

    const dx = toRect.left + toRect.width  / 2 - (fromRect.left + fromRect.width  / 2);
    const dy = toRect.top  + toRect.height / 2 - (fromRect.top  + fromRect.height / 2);

    tokenEl.style.transition = `transform ${ANIMATION_DURATION}ms cubic-bezier(0.34,1.56,0.64,1)`;
    tokenEl.style.transform  = `translate(${dx}px, ${dy}px) scale(1.05)`;

    setTimeout(() => {
      tokenEl.style.transition = '';
      tokenEl.style.transform  = '';
      onDone?.();
    }, ANIMATION_DURATION);
  }

  /**
   * Animate a token back to its home position.
   */
  _animateReturn(tokenEl, tokenId, fromZoneId) {
    const currentRect = _rect(tokenEl);
    const parent  = tokenEl._ddHomeParent;
    const sibling = tokenEl._ddHomeNextSibling;

    if (!parent) return;

    // Temporarily place at home to measure target rect
    parent.insertBefore(tokenEl, sibling || null);
    const homeRect = _rect(tokenEl);

    const dx = currentRect.left - homeRect.left;
    const dy = currentRect.top  - homeRect.top;

    // Snap from current (offset) back to 0,0
    tokenEl.style.transform  = `translate(${dx}px, ${dy}px)`;
    tokenEl.style.transition = '';

    requestAnimationFrame(() => {
      tokenEl.style.transition = `transform ${ANIMATION_DURATION}ms cubic-bezier(0.34,1.56,0.64,1)`;
      tokenEl.style.transform  = 'translate(0,0)';

      setTimeout(() => {
        tokenEl.style.transition = '';
        tokenEl.style.transform  = '';
      }, ANIMATION_DURATION);
    });
  }

  /**
   * Pop (scale pulse) animation for correct placement.
   */
  _popAnimation(el) {
    el.animate(
      [
        { transform: 'scale(1)'    },
        { transform: 'scale(1.18)', offset: 0.4 },
        { transform: 'scale(0.96)', offset: 0.7 },
        { transform: 'scale(1)'    },
      ],
      { duration: 380, easing: 'ease-out' }
    );
  }

  /**
   * Shake animation for incorrect placement, then invoke callback.
   */
  _shakeAnimation(el, onDone) {
    const anim = el.animate(
      [
        { transform: 'translateX(0)'    },
        { transform: 'translateX(-8px)', offset: 0.15 },
        { transform: 'translateX(7px)',  offset: 0.35 },
        { transform: 'translateX(-5px)', offset: 0.55 },
        { transform: 'translateX(3px)',  offset: 0.75 },
        { transform: 'translateX(0)'    },
      ],
      { duration: 340, easing: 'ease-out' }
    );
    anim.onfinish = () => onDone?.();
  }

  /**
   * Flash the screen edges (top HUD area) with a subtle color burst.
   */
  _flashEdge(type) {
    const color = type === 'correct'
      ? 'rgba(0,212,170,0.18)'   // teal — success
      : 'rgba(255,77,106,0.20)'; // red  — error

    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed; inset: 0; z-index: 9998;
      pointer-events: none;
      background: ${color};
      animation: dd-flash 340ms ease-out forwards;
    `;
    // Inject keyframes once
    if (!document.getElementById('dd-flash-kf')) {
      const style = document.createElement('style');
      style.id = 'dd-flash-kf';
      style.textContent = `@keyframes dd-flash { from { opacity:1 } to { opacity:0 } }`;
      document.head.appendChild(style);
    }
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 340);
  }

  // ── Keyboard Support ────────────────────────────────────────────────────────
  // WCAG: Tab to focus token, Space/Enter to pick up, Tab between zones, Enter to drop.

  _onKeyDown(e) {
    if (this._destroyed) return;

    const focused = document.activeElement;

    // Pick up a focused token
    if ((e.key === ' ' || e.key === 'Enter') && !this._kbToken) {
      if (focused && focused.matches(this._cfg.draggableSelector)) {
        const tokenId = focused.dataset.ddId;
        if (!tokenId) return;
        if (focused.classList.contains(CLS.tokenCorrect) && this._cfg.lockOnCorrect) return;

        this._kbToken   = tokenId;
        this._kbZoneIdx = -1;
        focused.classList.add(CLS.dragging);
        focused.setAttribute('aria-grabbed', 'true');
        e.preventDefault();

        // Announce for screen readers
        this._ariaAnnounce(`Picked up ${focused.textContent.trim()}. Use Tab to navigate drop zones, Enter to drop.`);
      }
      return;
    }

    // Navigate zones while carrying
    if (this._kbToken) {
      if (e.key === 'Tab') {
        e.preventDefault();
        const dir = e.shiftKey ? -1 : 1;
        this._kbZoneIdx = (this._kbZoneIdx + dir + this._kbZones.length) % this._kbZones.length;
        const zoneId = this._kbZones[this._kbZoneIdx];
        const zoneEl = this._getZoneEl(zoneId);

        this._clearZoneHighlights();
        zoneEl?.classList.add(CLS.zoneActive);
        zoneEl?.focus();

        this._ariaAnnounce(`Over zone: ${zoneEl?.dataset.ddLabel || zoneId}`);
        return;
      }

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (this._kbZoneIdx < 0) return;

        const tokenId = this._kbToken;
        const zoneId  = this._kbZones[this._kbZoneIdx];
        const tokenEl = this._getTokenEl(tokenId);
        const fromZoneId = this._placements[tokenId] ?? null;

        tokenEl?.classList.remove(CLS.dragging);
        tokenEl?.removeAttribute('aria-grabbed');
        this._clearZoneHighlights();
        this._kbToken   = null;
        this._kbZoneIdx = -1;

        this._handleDrop(tokenEl, tokenId, fromZoneId, zoneId);
        return;
      }

      if (e.key === 'Escape') {
        const tokenEl = this._getTokenEl(this._kbToken);
        tokenEl?.classList.remove(CLS.dragging);
        tokenEl?.removeAttribute('aria-grabbed');
        this._clearZoneHighlights();
        this._kbToken   = null;
        this._kbZoneIdx = -1;
        this._ariaAnnounce('Drag cancelled.');
        return;
      }
    }
  }

  _ariaAnnounce(msg) {
    let live = document.getElementById('dd-aria-live');
    if (!live) {
      live = document.createElement('div');
      live.id = 'dd-aria-live';
      live.setAttribute('role', 'status');
      live.setAttribute('aria-live', 'polite');
      live.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);';
      document.body.appendChild(live);
    }
    live.textContent = '';
    requestAnimationFrame(() => { live.textContent = msg; });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _getTokenEl(tokenId) {
    return this._cfg.container.querySelector(`[data-dd-id="${tokenId}"]`);
  }

  _getZoneEl(zoneId) {
    return this._cfg.container.querySelector(`[data-dd-zone="${zoneId}"]`);
  }

  _selectTokenForClick(tokenEl, tokenId) {
    this._clearClickSelection();
    this._clickTokenId = tokenId;
    tokenEl.classList.add(CLS.tokenSelected);
    tokenEl.setAttribute('aria-pressed', 'true');

    this._cfg.container.querySelectorAll(this._cfg.zoneSelector).forEach(zoneEl => {
      zoneEl.classList.add(CLS.zoneTargetable);
    });

    this._ariaAnnounce(`Selected ${tokenEl.textContent.trim()}. Choose a bucket to place it.`);
  }

  _clearClickSelection() {
    if (this._clickTokenId) {
      const tokenEl = this._getTokenEl(this._clickTokenId);
      tokenEl?.classList.remove(CLS.tokenSelected);
      tokenEl?.removeAttribute('aria-pressed');
    }

    this._clickTokenId = null;
    this._cfg.container.querySelectorAll(this._cfg.zoneSelector).forEach(zoneEl => {
      zoneEl.classList.remove(CLS.zoneTargetable);
    });
  }

  _cleanupPointerListeners(tokenEl) {
    if (tokenEl) {
      tokenEl.removeEventListener('pointermove',   this._onPointerMove);
      tokenEl.removeEventListener('pointerup',     this._onPointerUp);
      tokenEl.removeEventListener('pointercancel', this._onPointerUp);
    }
  }
}

// ─── Convenience Factory ─────────────────────────────────────────────────────

/**
 * Shorthand factory — sugar over `new DragDropInstance(config)`.
 *
 * @param {Object} config  — same as DragDropInstance config
 * @returns {DragDropInstance}
 *
 * @example
 * const dd = createDragDrop({
 *   container: document.getElementById('level-w1-l1'),
 *   correctAnswers: {
 *     'zone-numerical-continuous' : 'token-age',
 *     'zone-numerical-discrete'   : 'token-children',
 *     'zone-categorical-nominal'  : 'token-city',
 *     'zone-categorical-ordinal'  : 'token-education',
 *     'zone-temporal'             : 'token-date',
 *   },
 *   onCorrect(tokenId, zoneId) {
 *     console.log(`✓ ${tokenId} → ${zoneId}`);
 *   },
 *   onComplete(placements) {
 *     showLevelComplete();
 *   },
 * });
 */
export function createDragDrop(config) {
  return new DragDropInstance(config);
}

// ─── Preset Factories (per level type) ───────────────────────────────────────

/**
 * Preset: Variable-type buckets (W1-L1)
 * Tokens are column header badges; zones are the five type buckets.
 */
export function createVariableTypeDrop(container, correctAnswers, callbacks = {}) {
  return createDragDrop({
    container,
    correctAnswers,
    snapBack     : true,
    lockOnCorrect: true,
    ...callbacks,
  });
}

/**
 * Preset: Pipeline ordering (W1-L3, W6-L1)
 * Slots are numbered; any token can go in any slot but only one ordering is correct.
 * Pass validate function to check full-order correctness on complete.
 */
export function createOrderingDrop(container, correctOrder, callbacks = {}) {
  // correctOrder: array of tokenIds in correct slot order, e.g. ['cleaning','outliers','encoding','scaling']
  return createDragDrop({
    container,
    validate(tokenId, zoneId) {
      // zoneId expected to be 'slot-1', 'slot-2', etc.
      const slotIdx = parseInt(zoneId.replace('slot-', ''), 10) - 1;
      return correctOrder[slotIdx] === tokenId;
    },
    allowReorder : true,
    snapBack     : false, // ordering lets you rearrange freely
    lockOnCorrect: false,
    onComplete   : callbacks.onComplete,
    onDrop       : callbacks.onDrop,
    onCorrect    : callbacks.onCorrect,
    onIncorrect  : callbacks.onIncorrect,
  });
}

/**
 * Preset: Mechanism labelling (W2-L1 MCAR/MAR/MNAR)
 * Each scenario card is a zone; label tokens must be placed correctly.
 */
export function createLabelDrop(container, correctAnswers, callbacks = {}) {
  return createDragDrop({
    container,
    correctAnswers,
    snapBack     : true,
    lockOnCorrect: true,
    ...callbacks,
  });
}

/**
 * Preset: Encoding method zones (W4-L5, W5-L5)
 * Multiple tokens can land in each zone; any item in right zone = correct.
 */
export function createMultiZoneDrop(container, correctAnswers, callbacks = {}) {
  return createDragDrop({
    container,
    correctAnswers,
    multiplePerZone: true,
    snapBack       : true,
    lockOnCorrect  : true,
    ...callbacks,
  });
}

// ─── CSS Injection ────────────────────────────────────────────────────────────
// Injects the minimum runtime styles needed for the system to work.
// Full visual theming lives in widgets.css — these are only structural.

(function injectBaseStyles() {
  if (document.getElementById('dd-base-styles')) return;
  const style = document.createElement('style');
  style.id = 'dd-base-styles';
  style.textContent = `
    /* ── Draggables ── */
    .dd-draggable {
      cursor: grab;
      user-select: none;
      touch-action: none;
      will-change: transform;
    }
    .dd-draggable:focus-visible {
      outline: 2px solid var(--color-primary, #6C63FF);
      outline-offset: 3px;
    }
    .dd-dragging {
      cursor: grabbing;
    }

    /* ── Ghost ── */
    .dd-ghost {
      cursor: grabbing !important;
    }

    /* ── Zones ── */
    .dd-zone {
      transition:
        border-color 120ms ease,
        background   120ms ease,
        box-shadow   120ms ease;
    }
    .dd-zone--active {
      border-color: var(--color-primary, #6C63FF) !important;
      background:   rgba(108, 99, 255, 0.08) !important;
      box-shadow:   0 0 0 2px rgba(108,99,255,0.25);
    }
    .dd-zone--targetable {
      border-color: rgba(108, 99, 255, 0.7) !important;
      box-shadow:   0 0 0 1px rgba(108,99,255,0.22);
    }
    .dd-zone--correct {
      border-color: var(--color-success, #00D4AA) !important;
      background:   rgba(0, 212, 170, 0.07) !important;
    }
    .dd-zone--incorrect {
      border-color: var(--color-danger, #FF4D6A) !important;
      background:   rgba(255, 77, 106, 0.07) !important;
    }
    .dd-zone--occupied {
      border-style: solid !important;
    }

    /* ── Tokens (placed state) ── */
    .dd-token--correct {
      border-color: var(--color-success, #00D4AA) !important;
    }
    .dd-token--selected {
      border-color: var(--color-primary, #6C63FF) !important;
      box-shadow:   0 0 0 2px rgba(108,99,255,0.22), 0 12px 24px rgba(0,0,0,0.18);
      transform:    translateY(-1px) scale(1.01);
    }
    .dd-token--incorrect {
      border-color: var(--color-danger,  #FF4D6A) !important;
    }
  `;
  document.head.appendChild(style);
})();
