/**
 * DataForge — Engine
 *
 * The central nervous system of the game.  engine.js sits between the state
 * layer (state.js), the scoring layer (score.js), and every level module.
 * It owns:
 *
 *   1.  The game-phase state machine  (world map → level → complete → …)
 *   2.  The level lifecycle           (load → start → tick → finish → teardown)
 *   3.  Player-action routing         (correct / mistake / hint / give-up)
 *   4.  Overlay management            (level-complete, game-over, rank-up, settings)
 *   5.  Navigation                    (world map, between levels, back-button guard)
 *   6.  Sound/music hooks             (thin wrappers — actual audio in audio.js)
 *   7.  Accessibility live-region     (announces score events to screen readers)
 *
 * ─── Design rules ─────────────────────────────────────────────────────────
 *  • engine.js never renders game content — that is each level module's job.
 *  • All persistent mutations go through GameState; engine reads results and
 *    drives the UI layer (ScoreHUD, overlays, transitions).
 *  • Level modules communicate with the engine exclusively through the public
 *    Engine API (engine.correct(), engine.mistake(), engine.complete(), …).
 *    They must NOT import GameState or ScoreHUD directly.
 *  • One Engine instance is created at boot and exported as a singleton.
 *
 * ─── Table of contents ────────────────────────────────────────────────────
 *  1.  Phase constants & transition map
 *  2.  Level registry  (lazy imports keyed by "w{n}_l{n}")
 *  3.  Overlay helpers (level-complete, game-over, rank-up, confirm-dialog)
 *  4.  Transition animations
 *  5.  Engine class
 *       5a.  Constructor / boot
 *       5b.  Phase machine
 *       5c.  Navigation
 *       5d.  Level lifecycle
 *       5e.  Player-action handlers (public API for level modules)
 *       5f.  Hint system
 *       5g.  Settings panel
 *       5h.  Sound hooks
 *       5i.  Accessibility announcer
 *       5j.  Internal helpers
 *  6.  Singleton export
 * ──────────────────────────────────────────────────────────────────────────
 */

'use strict';

import { GameState, WORLDS, MAX_HINTS, MAX_LIVES } from './state.js';
import { getLanguage, setLanguage, t } from '../i18n.js';
import {
  ScoreHUD,
  calcLevelScore,
  calcStreakMultiplier,
  starRating,
  xpForStars,
  buildCompletionSummary,
  formatScore,
  formatStars,
  formatXp,
  renderStars,
  PENALTY_PER_MISTAKE,
  PENALTY_PER_HINT,
} from './score.js';

const MODULE_VERSION = typeof window !== 'undefined' && window.__DATAFORGE_MODULE_VERSION__
  ? String(window.__DATAFORGE_MODULE_VERSION__)
  : '20260615b';

// ─────────────────────────────────────────────────────────────────────────────
// 1. PHASE CONSTANTS & TRANSITION MAP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All possible game phases.  The engine is always in exactly one phase.
 *
 * @enum {string}
 */
export const Phase = Object.freeze({
  BOOT:          'boot',          // initial load, not yet ready
  WORLD_MAP:     'world_map',     // player viewing the world map
  LEVEL_LOADING: 'level_loading', // async import of level module in flight
  LEVEL_ACTIVE:  'level_active',  // player actively playing
  LEVEL_PAUSED:  'level_paused',  // settings panel open mid-level
  LEVEL_DONE:    'level_done',    // level-complete overlay showing
  GAME_OVER:     'game_over',     // out-of-lives overlay showing
  RANK_UP:       'rank_up',       // rank-up celebration overlay
});

/**
 * Legal phase transitions.
 * Key   = current phase
 * Value = Set of phases this phase can transition INTO.
 */
const TRANSITIONS = new Map([
  [Phase.BOOT,          new Set([Phase.WORLD_MAP])],
  [Phase.WORLD_MAP,     new Set([Phase.LEVEL_LOADING])],
  [Phase.LEVEL_LOADING, new Set([Phase.LEVEL_ACTIVE, Phase.WORLD_MAP])],
  [Phase.LEVEL_ACTIVE,  new Set([Phase.LEVEL_PAUSED, Phase.LEVEL_DONE, Phase.GAME_OVER, Phase.WORLD_MAP])],
  [Phase.LEVEL_PAUSED,  new Set([Phase.LEVEL_ACTIVE, Phase.WORLD_MAP])],
  [Phase.LEVEL_DONE,    new Set([Phase.LEVEL_LOADING, Phase.WORLD_MAP, Phase.RANK_UP])],
  [Phase.GAME_OVER,     new Set([Phase.LEVEL_LOADING, Phase.WORLD_MAP])],
  [Phase.RANK_UP,       new Set([Phase.LEVEL_LOADING, Phase.WORLD_MAP])],
]);

// ─────────────────────────────────────────────────────────────────────────────
// 2. LEVEL REGISTRY  (lazy dynamic imports)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the JS module path for a given world/level pair.
 * Adjust the base path to match your build layout.
 *
 * @param {number} worldId
 * @param {number} levelId
 * @returns {string}
 */
function levelModulePath(worldId, levelId) {
  const world = WORLDS.find(w => w.id === worldId);
  if (!world) throw new Error(`Unknown world ${worldId}`);

  // World 6's last level has a special module name
  if (worldId === 6 && levelId === world.levelCount) {
    return `../worlds/world6/final-level.js`;
  }
  return `../worlds/world${worldId}/level${levelId}.js`;
}

/**
 * Dynamically import a level module and return it.
 * Each level module must export a default class (or object) implementing:
 *   { init(engine, container), start(), teardown() }
 *
 * @param {number} worldId
 * @param {number} levelId
 * @returns {Promise<Object>}  The level module's default export (instantiated).
 */
async function importLevel(worldId, levelId) {
  const path = levelModulePath(worldId, levelId);
  const versionedPath = `${path}${path.includes('?') ? '&' : '?'}v=${encodeURIComponent(MODULE_VERSION)}`;
  const mod  = await import(/* @vite-ignore */ versionedPath);
  const Ctor = mod.default;
  if (typeof Ctor !== 'function') {
    throw new Error(`Level module ${path} must have a default export (class or factory function).`);
  }
  return new Ctor();
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. OVERLAY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build and inject the level-complete overlay into #overlay-root.
 * Returns a Promise that resolves when the player clicks "Continue" or "Replay".
 *
 * @param {Object}   summary   — from buildCompletionSummary()
 * @param {string}   worldColor
 * @returns {Promise<'continue'|'replay'|'map'>}
 */
function showLevelCompleteOverlay(summary, worldColor) {
  return new Promise(resolve => {
    const root = document.getElementById('overlay-root');
    if (!root) { resolve('continue'); return; }

    root.innerHTML = `
      <div class="overlay overlay--level-complete" role="dialog" aria-modal="true"
           aria-labelledby="lc-title" style="--world-color:${worldColor}">

        <div class="overlay__particles" aria-hidden="true"></div>

        <div class="overlay__body">
          <div class="overlay__world-icon" aria-hidden="true">${_worldIconFor(summary.worldId)}</div>

          <h2 id="lc-title" class="overlay__title">Level Complete</h2>

          <div class="overlay__stars" aria-label="${summary.starsFormatted} stars">
            <!-- stars injected below via renderStars -->
          </div>

          <div class="overlay__score-block">
            <span class="overlay__score-label">Score</span>
            <span class="overlay__score-value">${summary.score}</span>
          </div>

          <dl class="overlay__stats">
            <div class="overlay__stat">
              <dt>XP Gained</dt><dd class="overlay__xp">${summary.xpFormatted}</dd>
            </div>
            <div class="overlay__stat">
              <dt>Time</dt><dd>${summary.timeFormatted}</dd>
            </div>
            <div class="overlay__stat">
              <dt>Mistakes</dt><dd>${summary.mistakes}</dd>
            </div>
            <div class="overlay__stat">
              <dt>Hints Used</dt><dd>${summary.hintsUsed} / ${MAX_HINTS}</dd>
            </div>
          </dl>

          <p class="overlay__rank-progress">${summary.rankProgressFormatted}</p>

          <div class="overlay__actions">
            <button class="btn btn--subtle" id="lc-btn-map"    type="button">World Map</button>
            <button class="btn btn--subtle" id="lc-btn-replay" type="button">Replay ↺</button>
            <button class="btn btn--primary" id="lc-btn-continue" type="button">Continue →</button>
          </div>
        </div>
      </div>`;

    // Inject animated stars
    const starsEl = root.querySelector('.overlay__stars');
    renderStars(summary.stars, starsEl);

    // Stagger-animate each star appearing
    Array.from(starsEl.children).forEach((s, i) => {
      s.style.animationDelay = `${i * 180}ms`;
      s.classList.add('star--animate-in');
    });

    root.querySelector('#lc-btn-continue').addEventListener('click', () => { _clearOverlay(root); resolve('continue'); });
    root.querySelector('#lc-btn-replay').addEventListener('click',   () => { _clearOverlay(root); resolve('replay');   });
    root.querySelector('#lc-btn-map').addEventListener('click',      () => { _clearOverlay(root); resolve('map');      });

    // Trap focus inside overlay
    _trapFocus(root);
    root.querySelector('#lc-btn-continue').focus();
  });
}

/**
 * Show the final game report overlay after the last level is completed.
 * @param {Object} summary
 * @param {Object} codeResult
 * @returns {Promise<'replay'|'map'>}
 */
function showFinalPipelineOverlay(summary, codeResult = {}) {
  return new Promise(resolve => {
    const root = document.getElementById('overlay-root');
    if (!root) { resolve('map'); return; }

    const report = _normalizeFinalCodeResult(codeResult);

    root.innerHTML = `
      <div class="overlay overlay--game-finale" role="dialog" aria-modal="true"
           aria-labelledby="fg-title" style="--world-color:var(--color-world-6)">
        <div class="overlay__particles" aria-hidden="true"></div>

        <div class="overlay__body overlay__body--finale">
          <section class="overlay__finale-hero">
            <div class="overlay__world-icon" aria-hidden="true">${_worldIconFor(summary.worldId)}</div>
            <div class="overlay__finale-copy">
              <p class="overlay__eyebrow">Data Pipeline Report</p>
              <h2 id="fg-title" class="overlay__title">Factory Fully Online</h2>
              <p class="overlay__subtitle">
                Every world feeds this screen: missing values were repaired, outliers were capped, City became a compact dummy block, and the final numeric pair now shares the same statistical scale.
              </p>
            </div>
            <div class="overlay__stars" aria-label="${summary.starsFormatted} stars"></div>
          </section>

          <section class="overlay__finale-factory" aria-hidden="true">
            <div class="overlay__finale-belt"></div>
            <div class="overlay__finale-dot"></div>
            <div class="overlay__finale-pipeline">
              ${WORLDS.map(world => `
                <article class="overlay__finale-node" style="--node-color:${world.color}">
                  <span class="overlay__finale-node-badge">W${world.id}</span>
                  <strong class="overlay__finale-node-title">${_escapeHtml(t(world.title))}</strong>
                </article>
              `).join('')}
            </div>
          </section>

          <section class="overlay__finale-stats">
            <article class="overlay__finale-stat">
              <span class="overlay__finale-stat-label">Dataset Health</span>
              <strong class="overlay__finale-stat-value">${report.datasetHealth}%</strong>
            </article>
            <article class="overlay__finale-stat">
              <span class="overlay__finale-stat-label">Tasks Fixed</span>
              <strong class="overlay__finale-stat-value">${report.tasksCompleted} / ${report.totalTasks}</strong>
            </article>
            <article class="overlay__finale-stat">
              <span class="overlay__finale-stat-label">Score</span>
              <strong class="overlay__finale-stat-value">${summary.score}</strong>
            </article>
            <article class="overlay__finale-stat">
              <span class="overlay__finale-stat-label">Time</span>
              <strong class="overlay__finale-stat-value">${summary.timeFormatted}</strong>
            </article>
            <article class="overlay__finale-stat">
              <span class="overlay__finale-stat-label">Hints</span>
              <strong class="overlay__finale-stat-value">${summary.hintsUsed} / ${MAX_HINTS}</strong>
            </article>
            <article class="overlay__finale-stat">
              <span class="overlay__finale-stat-label">Mistakes</span>
              <strong class="overlay__finale-stat-value">${summary.mistakes}</strong>
            </article>
          </section>

          <section class="overlay__finale-grid">
            <article class="overlay__finale-panel">
              <div class="overlay__finale-panel-head">
                <p class="overlay__eyebrow">Cleaned Dataset Preview</p>
                <h3 class="overlay__finale-panel-title">First 10 rows of the finished table</h3>
              </div>
              <div class="overlay__finale-table-wrap">
                ${_renderFinalPreviewTable(report.finalColumns, report.previewRows)}
              </div>
            </article>

            <article class="overlay__finale-panel">
              <div class="overlay__finale-panel-head">
                <p class="overlay__eyebrow">Python Script</p>
                <h3 class="overlay__finale-panel-title">The command sequence used in the final repair</h3>
              </div>
              <pre class="overlay__finale-script">${_escapeHtml(report.script)}</pre>
            </article>
          </section>

          <footer class="overlay__finale-footer">
            <p class="overlay__rank-progress">${summary.rankProgressFormatted}</p>
            <div class="overlay__actions">
              <button class="btn btn--subtle" id="fg-btn-replay" type="button">Replay Final Level</button>
              <button class="btn btn--subtle" id="fg-btn-export" type="button">Export .py</button>
              <button class="btn btn--primary" id="fg-btn-map" type="button">World Map</button>
            </div>
          </footer>
        </div>
      </div>`;

    const starsEl = root.querySelector('.overlay__stars');
    renderStars(summary.stars, starsEl);
    Array.from(starsEl.children).forEach((star, index) => {
      star.style.animationDelay = `${index * 180}ms`;
      star.classList.add('star--animate-in');
    });

    root.querySelector('#fg-btn-replay').addEventListener('click', () => {
      _clearOverlay(root);
      resolve('replay');
    });

    root.querySelector('#fg-btn-map').addEventListener('click', () => {
      _clearOverlay(root);
      resolve('map');
    });

    root.querySelector('#fg-btn-export').addEventListener('click', () => {
      _downloadTextFile(report.exportFileName, report.script);
    });

    _trapFocus(root);
    root.querySelector('#fg-btn-map').focus();
  });
}

/**
 * Build and inject the game-over overlay.
 * @param {number} score  — session score at time of game over.
 * @returns {Promise<'retry'|'map'>}
 */
function showGameOverOverlay(score) {
  return new Promise(resolve => {
    const root = document.getElementById('overlay-root');
    if (!root) { resolve('map'); return; }

    root.innerHTML = `
      <div class="overlay overlay--game-over" role="dialog" aria-modal="true"
           aria-labelledby="go-title">
        <div class="overlay__body">
          <h2 id="go-title" class="overlay__title overlay__title--danger">Out of Attempts</h2>
          <p class="overlay__subtitle">Better luck next time!</p>
          <div class="overlay__score-block">
            <span class="overlay__score-label">Session Score</span>
            <span class="overlay__score-value">${formatScore(score)}</span>
          </div>
          <div class="overlay__actions">
            <button class="btn btn--subtle"  id="go-btn-map"   type="button">Return to Map</button>
            <button class="btn btn--warning" id="go-btn-retry" type="button">Retry Level</button>
          </div>
        </div>
      </div>`;

    root.querySelector('#go-btn-retry').addEventListener('click', () => { _clearOverlay(root); resolve('retry'); });
    root.querySelector('#go-btn-map').addEventListener('click',   () => { _clearOverlay(root); resolve('map');   });

    _trapFocus(root);
    root.querySelector('#go-btn-retry').focus();
  });
}

/**
 * Show a rank-up celebration overlay.
 * @param {string} newRankTitle
 * @param {number} totalXp
 * @returns {Promise<void>}   Resolves when player dismisses.
 */
function showRankUpOverlay(newRankTitle, totalXp) {
  return new Promise(resolve => {
    const root = document.getElementById('overlay-root');
    if (!root) { resolve(); return; }

    root.innerHTML = `
      <div class="overlay overlay--rank-up" role="dialog" aria-modal="true"
           aria-labelledby="ru-title">
        <div class="overlay__body overlay__body--center">
          <div class="overlay__rank-burst" aria-hidden="true">🎉</div>
          <h2 id="ru-title" class="overlay__title overlay__title--accent">Rank Up!</h2>
          <p class="overlay__rank-new">${newRankTitle}</p>
          <p class="overlay__rank-xp">${totalXp.toLocaleString('fr-FR')} XP total</p>
          <div class="overlay__actions">
            <button class="btn btn--primary" id="ru-btn-ok" type="button">Keep Going →</button>
          </div>
        </div>
      </div>`;

    root.querySelector('#ru-btn-ok').addEventListener('click', () => { _clearOverlay(root); resolve(); });
    _trapFocus(root);
    root.querySelector('#ru-btn-ok').focus();
  });
}

/**
 * Generic confirmation dialog.
 * @param {string} message
 * @param {string} [confirmLabel='Confirm']
 * @param {string} [cancelLabel='Cancel']
 * @returns {Promise<boolean>}
 */
function showConfirmDialog(message, confirmLabel = 'Confirm', cancelLabel = 'Cancel') {
  return new Promise(resolve => {
    const root = document.getElementById('overlay-root');
    if (!root) { resolve(false); return; }

    root.innerHTML = `
      <div class="overlay overlay--confirm" role="alertdialog" aria-modal="true"
           aria-labelledby="cd-msg">
        <div class="overlay__body overlay__body--compact">
          <p id="cd-msg" class="overlay__confirm-message">${_escapeHtml(message)}</p>
          <div class="overlay__actions">
            <button class="btn btn--subtle"  id="cd-btn-cancel"  type="button">${_escapeHtml(cancelLabel)}</button>
            <button class="btn btn--warning" id="cd-btn-confirm" type="button">${_escapeHtml(confirmLabel)}</button>
          </div>
        </div>
      </div>`;

    root.querySelector('#cd-btn-confirm').addEventListener('click', () => { _clearOverlay(root); resolve(true);  });
    root.querySelector('#cd-btn-cancel').addEventListener('click',  () => { _clearOverlay(root); resolve(false); });

    _trapFocus(root);
    root.querySelector('#cd-btn-cancel').focus();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. TRANSITION ANIMATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fade the screen to black, call fn(), then fade back in.
 * @param {Function} fn          Sync or async function to run at the midpoint.
 * @param {number}  [halfMs=400] Duration of each half of the cross-fade.
 * @returns {Promise<void>}
 */
async function crossFade(fn, halfMs = 400) {
  const curtain = _getCurtain();
  curtain.style.transition = `opacity ${halfMs}ms ease`;
  curtain.style.opacity    = '1';
  curtain.setAttribute('aria-hidden', 'false');
  await _delay(halfMs);

  await fn();

  curtain.style.opacity = '0';
  await _delay(halfMs);
  curtain.setAttribute('aria-hidden', 'true');
}

/**
 * Larger cinematic transition used between worlds on the map screen.
 * @param {string} worldIcon
 * @param {string} worldColor
 * @param {string} worldTitle
 * @returns {Promise<void>}
 */
async function cinematicWorldTransition(worldIcon, worldColor, worldTitle) {
  const curtain = _getCurtain();
  // Phase 1: fade to black
  curtain.style.transition = 'opacity 400ms ease';
  curtain.style.opacity    = '1';
  curtain.setAttribute('aria-hidden', 'false');
  await _delay(400);

  // Briefly show world title in the curtain
  curtain.innerHTML = `
    <div class="curtain__world-reveal" style="color:${worldColor}">
      <span class="curtain__world-icon">${worldIcon}</span>
      <span class="curtain__world-title">${_escapeHtml(worldTitle)}</span>
    </div>`;
  await _delay(600);

  // Phase 2: fade out curtain
  curtain.style.opacity = '0';
  await _delay(400);
  curtain.innerHTML = '';
  curtain.setAttribute('aria-hidden', 'true');
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ENGINE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class EngineCore {
  constructor() {
    /** @type {string}       Current game phase (one of Phase.*). */
    this._phase = Phase.BOOT;

    /** @type {number|null}  Active world ID. */
    this._worldId = null;

    /** @type {number|null}  Active level ID. */
    this._levelId = null;

    /**
     * The mounted level instance (return of `new LevelModule()`).
     * Must implement { init(engine, container), start(), teardown() }.
     * @type {Object|null}
     */
    this._level = null;

    /** @type {ScoreHUD|null}  Live HUD controller. */
    this._hud = null;

    /**
     * Session-level streak counter.
     * Reset to 0 on any mistake; incremented on correct action.
     * @type {number}
     */
    this._streak = 0;

    /**
     * Session-level elapsed timer.
     * @type {number|null}  Performance.now() value at level start.
     */
    this._levelStartTime = null;

    /**
     * Previous rank title, used to detect rank-up after XP gain.
     * @type {string|null}
     */
    this._rankBeforeLevel = null;

    /**
     * Code-level completion payload kept long enough for the final overlay.
     * @type {Object|null}
     */
    this._lastCodeResult = null;

    // Bind keyboard handler for back-button / Escape
    this._onKeyDown = this._handleKeyDown.bind(this);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5a. CONSTRUCTOR / BOOT
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Initialise the engine.  Call once at application startup.
   * Loads persisted state, then navigates to the world map.
   */
  boot({ renderInitialMap = true } = {}) {
    GameState.load();

    document.addEventListener('keydown', this._onKeyDown);

    // Apply saved accessibility settings to <html>
    this._applySettings(GameState.settings);

    // Enter world-map phase immediately so the router can deep-link into
    // levels after boot without fighting BOOT → LEVEL_LOADING restrictions.
    this._goPhase(Phase.WORLD_MAP);

    if (renderInitialMap) {
      this._showWorldMap();
    }

    console.info('[Engine] DataForge booted. Phase:', this._phase);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5b. PHASE MACHINE
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Attempt a phase transition.  Throws if the transition is not in TRANSITIONS.
   * @param {string} next  One of Phase.*
   */
  _goPhase(next) {
    const allowed = TRANSITIONS.get(this._phase);
    if (!allowed || !allowed.has(next)) {
      throw new Error(
        `[Engine] Illegal phase transition: ${this._phase} → ${next}`
      );
    }
    console.debug(`[Engine] Phase: ${this._phase} → ${next}`);
    this._phase = next;
  }

  /** @returns {string} Current phase. */
  get phase() { return this._phase; }

  // ───────────────────────────────────────────────────────────────────────────
  // 5c. NAVIGATION
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Navigate to the world map, with an optional confirmation if mid-level.
   * Safe to call from any phase.
   */
  async goToWorldMap(worldId = null) {
    if (this._phase === Phase.WORLD_MAP) {
      this._lastCodeResult = null;
      this._showWorldMap(worldId);
      return;
    }

    if (this._phase === Phase.LEVEL_ACTIVE || this._phase === Phase.LEVEL_PAUSED) {
      const confirmed = await showConfirmDialog(
        'Return to the world map? Your progress in this level will be lost.',
        'Return to Map',
        'Keep Playing'
      );
      if (!confirmed) return;
      this._teardownLevel(/* save= */ false);
    }

    await crossFade(async () => {
      this._lastCodeResult = null;
      this._goPhase(Phase.WORLD_MAP);
      this._showWorldMap(worldId);
    });
  }

  /**
   * Launch a specific world + level.  Validates unlock state before loading.
   *
   * @param {number} worldId
   * @param {number} levelId
   */
  async goToLevel(worldId, levelId) {
    if (!GameState.isWorldUnlocked(worldId)) {
      console.warn(`[Engine] World ${worldId} is not unlocked.`);
      return;
    }
    if (!GameState.isLevelUnlocked(worldId, levelId)) {
      console.warn(`[Engine] Level W${worldId}L${levelId} is not unlocked.`);
      return;
    }

    const world = WORLDS.find(w => w.id === worldId);

    // If transitioning from world map, do a world-reveal animation for new worlds
    const isNewWorld = (this._worldId !== worldId);

    await crossFade(async () => {
      this._goPhase(Phase.LEVEL_LOADING);
      if (isNewWorld && this._phase !== Phase.BOOT) {
        await cinematicWorldTransition(world.icon, world.color, t(world.title));
      }
      await this._loadLevel(worldId, levelId);
    }, isNewWorld ? 0 : 400); // crossFade half=0 when we already did cinematicWorldTransition
  }

  /**
   * Proceed to the next level after completing the current one.
   * If the last level of a world, go to map.
   */
  async goToNextLevel() {
    const world = WORLDS.find(w => w.id === this._worldId);
    if (!world) { await this.goToWorldMap(); return; }

    const nextLevelId = this._levelId + 1;
    if (nextLevelId > world.levelCount) {
      // Last level of world — return to map
      await this.goToWorldMap();
    } else {
      await this.goToLevel(this._worldId, nextLevelId);
    }
  }

  /**
   * Replay the current level (retry after game over, or by choice).
   */
  async replayLevel() {
    const w = this._worldId;
    const l = this._levelId;
    if (w == null || l == null) { await this.goToWorldMap(); return; }
    await crossFade(async () => {
      this._goPhase(Phase.LEVEL_LOADING);
      await this._loadLevel(w, l);
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5d. LEVEL LIFECYCLE
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Internal: load and start a level.
   * @param {number} worldId
   * @param {number} levelId
   */
  async _loadLevel(worldId, levelId) {
    this._teardownLevel(/* save= */ false);  // clean previous if any
    this._lastCodeResult = null;

    this._worldId = worldId;
    this._levelId = levelId;

    // Grab container — level.html must have <main id="level-content">
    const container = document.getElementById('level-content');
    if (!container) throw new Error('[Engine] #level-content element not found in DOM.');

    // Empty the content area
    container.innerHTML = '';

    let levelInstance;
    try {
      levelInstance = await importLevel(worldId, levelId);
    } catch (err) {
      console.error('[Engine] Failed to import level module:', err);
      this._showShellToast(`World ${worldId}, Level ${levelId} is not available yet.`, 'toast-warning');
      this._goPhase(Phase.WORLD_MAP);
      this._showWorldMap();
      return;
    }

    this._level = levelInstance;

    // Update nav breadcrumb
    this._updateBreadcrumb(worldId, levelId);

    // Apply world theme class to <body>
    this._applyWorldTheme(worldId);
    this._setScreen('level');

    // Mount ScoreHUD
    this._hud = new ScoreHUD();

    // Start a new session in state
    GameState.startLevel(worldId, levelId);
    this._rankBeforeLevel = GameState.rank.title;

    // Reset engine-level session counters
    this._streak         = 0;
    this._levelStartTime = performance.now();

    // Init the level module — it may render content synchronously or async
    try {
      await levelInstance.init(this, container);
      this._hud.mount();
      this._goPhase(Phase.LEVEL_ACTIVE);
      levelInstance.start();
    } catch (err) {
      console.error(`[Engine] Failed to initialize W${worldId}L${levelId}:`, err);
      try { levelInstance.teardown?.(); } catch (_) {}
      this._level = null;
      this._hud?.unmount();
      this._hud = null;
      GameState.abandonLevel();

      container.innerHTML = `
        <section class="panel screen-section" aria-live="polite">
          <p class="eyebrow">Level Load Error</p>
          <h1 class="panel-title">World ${worldId}, Level ${levelId} could not start</h1>
          <p class="text-muted">
            The level files did not finish loading. Retry once to fetch the latest version.
          </p>
          <div class="action-row">
            <button class="btn btn--primary" type="button" data-route="level" data-world="${worldId}" data-level="${levelId}">
              Retry Level
            </button>
            <button class="btn btn--subtle" type="button" data-route="map">World Map</button>
          </div>
        </section>
      `;
      this._showShellToast(`World ${worldId}, Level ${levelId} failed to start.`, 'toast-warning');
      return;
    }
    this._syncRoute({ type: 'level', worldId, levelId });

    this._announce(`Level started: World ${worldId}, Level ${levelId}`);
  }

  /**
   * Teardown the current level: unmount HUD, call level.teardown(), clear session.
   * @param {boolean} save  Whether to commit progress (false on abandon/retry).
   */
  _teardownLevel(save = false) {
    if (this._hud) {
      this._hud.unmount();
      this._hud = null;
    }
    if (this._level) {
      try { this._level.teardown?.(); } catch (_) {}
      this._level = null;
    }
    if (!save) {
      GameState.abandonLevel();
      this._lastCodeResult = null;
    }
    this._streak         = 0;
    this._levelStartTime = null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5e. PLAYER-ACTION HANDLERS  (public API for level modules)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * A correct player action occurred.
   *
   * Increments the streak, applies the streak score multiplier, and updates
   * the HUD.  If `points` is omitted, no direct score change is applied here —
   * the final score is computed at level completion via calcLevelScore().
   *
   * @param {Object}  [options]
   * @param {number}  [options.points=0]   Optional immediate point reward.
   * @param {boolean} [options.isSubTask]  True for code-level task completions.
   */
  correct({ points = 0, isSubTask = false } = {}) {
    if (this._phase !== Phase.LEVEL_ACTIVE) return;

    this._streak++;
    const multiplier = calcStreakMultiplier(this._streak);

    if (points > 0) {
      const awarded = Math.round(points * multiplier);
      GameState.addSessionScore(awarded);
    }

    this._hud?.onCorrect(this._streak);
    this._playSound(isSubTask ? 'task_complete' : 'correct');
    this._announce(isSubTask ? 'Task complete.' : 'Correct!');
  }

  /**
   * A wrong player action occurred.
   *
   * Decrements lives and streak.  If lives reach 0, triggers game over.
   *
   * @param {Object}  [options]
   * @param {boolean} [options.costsLife=true]  Set false for low-stakes errors.
   */
  mistake({ costsLife = true, countsMistake = costsLife } = {}) {
    if (this._phase !== Phase.LEVEL_ACTIVE) return;

    this._streak = 0;

    if (costsLife) {
      const { lives } = GameState.recordMistake();

      this._hud?.onMistake();
      this._playSound('mistake');
      this._announce('Incorrect. Try again.');

      if (lives <= 0) {
        this._triggerGameOver();
      }
    } else {
      if (countsMistake) {
        GameState.recordSoftMistake(PENALTY_PER_MISTAKE);
        this._hud?.onMistake();
        this._announce('Incorrect. Try again.');
      } else {
        this._hud?._flashElement(
          document.querySelector('.hud-score'),
          'hud-flash-error'
        );
        this._announce('Not quite. Try again.');
      }

      this._playSound('mistake');
    }
  }

  /**
   * The level has been fully completed by the player.
   * Calculates score/stars/XP, commits to state, shows overlay.
   *
   * @param {Object} [options]
   * @param {number} [options.bonusPoints=0]  Extra points to add before calculating.
   */
  async complete({ bonusPoints = 0 } = {}) {
    if (this._phase !== Phase.LEVEL_ACTIVE) return;

    const elapsedMs = this._levelStartTime
      ? performance.now() - this._levelStartTime
      : 0;

    // finishLevel() commits state and returns { stars, score, xpGained }
    const { stars, score, xpGained } = GameState.finishLevel();

    const summary = buildCompletionSummary({
      worldId:   this._worldId,
      levelId:   this._levelId,
      score,
      stars,
      xpGained,
      mistakes:  GameState.getLevelRecord(this._worldId, this._levelId).mistakes  ?? 0,
      hintsUsed: GameState.getLevelRecord(this._worldId, this._levelId).hints     ?? 0,
      elapsedMs,
    });
    const isFinalGameLevel = _isFinalGameLevel(summary.worldId, summary.levelId);
    const finalCodeResult = isFinalGameLevel ? this._lastCodeResult : null;

    // Let HUD run its completion animation, then show overlay
    this._hud?.onLevelComplete(summary, async () => {
      this._goPhase(Phase.LEVEL_DONE);
      this._teardownLevel(/* save= */ true);

      this._playSound('level_complete');
      this._announce(`Level complete! ${summary.starsFormatted} — ${summary.xpFormatted}`);

      // Check for rank up
      const rankAfter = GameState.rank.title;
      if (rankAfter !== this._rankBeforeLevel) {
        this._goPhase(Phase.RANK_UP);
        this._playSound('rank_up');
        await showRankUpOverlay(rankAfter, GameState.totalXp);
        this._goPhase(Phase.LEVEL_DONE);
      }

      const world  = WORLDS.find(w => w.id === summary.worldId);
      const choice = await showLevelCompleteOverlay(summary, world?.color ?? '#6C63FF');

      if (choice === 'continue' && isFinalGameLevel) {
        const finaleChoice = await showFinalPipelineOverlay(summary, finalCodeResult);
        this._lastCodeResult = null;

        if (finaleChoice === 'replay') {
          await this.replayLevel();
        } else {
          await this.goToWorldMap(summary.worldId);
        }
        return;
      }

      this._lastCodeResult = null;

      if      (choice === 'continue') await this.goToNextLevel();
      else if (choice === 'replay')   await this.replayLevel();
      else                            await this.goToWorldMap();
    });
  }

  /**
   * Variant of complete() for MCQ levels.
   * Accepts the MCQ score breakdown and drives the same overlay flow.
   *
   * @param {{ correct: number, total: number, perfect: boolean, hintsUsed: number }} mcqResult
   */
  async completeMCQ(mcqResult) {
    if (this._phase !== Phase.LEVEL_ACTIVE) return;
    // MCQ levels don't use calcLevelScore — they use calcMCQScore
    // But finishLevel() reads session mistakes/hints, so we don't need to re-calc
    await this.complete();
  }

  /**
   * Variant of complete() for code-fix levels.
   * The level module passes task completion stats; engine delegates to complete().
   *
   * @param {{ tasksCompleted: number, totalTasks: number, errorRuns: number }} codeResult
   */
  async completeCodeLevel(codeResult) {
    if (this._phase !== Phase.LEVEL_ACTIVE) return;
    this._lastCodeResult = codeResult ?? null;
    await this.complete();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5f. HINT SYSTEM
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Player pressed the hint button.
   * Returns the hint payload (text) from the level module if hints remain.
   *
   * @returns {{ allowed: boolean, text: string|null, hintsRemaining: number }}
   */
  requestHint() {
    if (this._phase !== Phase.LEVEL_ACTIVE) {
      return { allowed: false, text: null, hintsRemaining: 0 };
    }

    const { allowed, hintsUsed, hintsRemaining } = GameState.useHint();

    if (!allowed) {
      this._showHintExhaustedMessage();
      return { allowed: false, text: null, hintsRemaining: 0 };
    }

    // Ask the level module for its hint text
    const hintText = this._level?.getHint?.(hintsUsed) ?? null;

    this._hud?.onHintUsed();
    this._playSound('hint');
    this._announce(`Hint: ${hintText ?? 'No hint available.'}`);

    return { allowed: true, text: hintText, hintsRemaining };
  }

  /** Show a toast when hints are exhausted. */
  _showHintExhaustedMessage() {
    const toast = document.createElement('div');
    toast.className   = 'hud-toast toast-warning';
    toast.textContent = 'No hints remaining!';
    toast.setAttribute('role', 'alert');
    document.getElementById('toast-root')?.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('hud-toast--visible'));
    setTimeout(() => { toast.classList.remove('hud-toast--visible'); setTimeout(() => toast.remove(), 300); }, 2000);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5g. SETTINGS PANEL
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Open the settings panel (pauses the level if one is active).
   */
  openSettings() {
    const wasPaused = this._phase === Phase.LEVEL_PAUSED;
    if (this._phase === Phase.LEVEL_ACTIVE) {
      this._goPhase(Phase.LEVEL_PAUSED);
      this._level?.pause?.();
    }

    const panel = document.getElementById('settings-panel');
    if (!panel) return;

    panel.removeAttribute('hidden');
    panel.setAttribute('aria-hidden', 'false');
    _trapFocus(panel);

    // Hydrate settings controls from current state
    const s = GameState.settings;
    _setCheckbox(panel, '#setting-sound',      s.soundEnabled);
    _setSelect(  panel, '#setting-language',   s.language ?? 'fr');
    _setRange(   panel, '#setting-music',      s.musicVolume);
    _setSelect(  panel, '#setting-fontsize',   s.fontSize);
    _setCheckbox(panel, '#setting-colorblind', s.colorBlindMode);
    _setCheckbox(panel, '#setting-hint-auto',  s.hintAutoShow);

    // Wire save button (idempotent — existing listener will fire if already wired)
    const saveBtn = panel.querySelector('#settings-save');
    if (saveBtn && !saveBtn._wired) {
      saveBtn._wired = true;
      saveBtn.addEventListener('click', () => this._saveSettings(panel));
    }
    const closeBtn = panel.querySelector('#settings-close');
    if (closeBtn && !closeBtn._wired) {
      closeBtn._wired = true;
      closeBtn.addEventListener('click', () => this.closeSettings());
    }
    const resetBtn = panel.querySelector('#settings-reset-progress');
    if (resetBtn && !resetBtn._wired) {
      resetBtn._wired = true;
      resetBtn.addEventListener('click', () => { void this._resetGameProgress(); });
    }
  }

  /** Close the settings panel and resume if a level was active. */
  closeSettings() {
    this._hideSettingsPanel();

    if (this._phase === Phase.LEVEL_PAUSED) {
      this._goPhase(Phase.LEVEL_ACTIVE);
      this._level?.resume?.();
    }
  }

  /** Hide the settings panel without changing the underlying game phase. */
  _hideSettingsPanel() {
    const panel = document.getElementById('settings-panel');
    if (panel) {
      panel.setAttribute('hidden', '');
      panel.setAttribute('aria-hidden', 'true');
    }
  }

  /** Read settings form, persist, and apply. */
  _saveSettings(panel) {
    const previousLanguage = getLanguage();
    const updates = {
      language:       _getSelect(  panel, '#setting-language') || 'fr',
      soundEnabled:   _getCheckbox(panel, '#setting-sound'),
      musicVolume:    _getRange(   panel, '#setting-music'),
      fontSize:       _getSelect(  panel, '#setting-fontsize'),
      colorBlindMode: _getCheckbox(panel, '#setting-colorblind'),
      hintAutoShow:   _getCheckbox(panel, '#setting-hint-auto'),
    };
    GameState.updateSettings(updates);
    this._applySettings(updates);
    this.closeSettings();
    if (updates.language !== previousLanguage) {
      window.location.reload();
    }
  }

  /** Confirm and wipe campaign progress while keeping user settings. */
  async _resetGameProgress() {
    const confirmed = await showConfirmDialog(
      t('Reset all game progress and start over from World 1? This keeps your settings but clears unlocked worlds, completed levels, stars, score, and XP.'),
      t('Reset Progress'),
      t('Keep Progress')
    );
    if (!confirmed) return;

    const leavingLevel = this._phase === Phase.LEVEL_ACTIVE || this._phase === Phase.LEVEL_PAUSED;
    this._hideSettingsPanel();

    const finalizeReset = () => {
      if (leavingLevel) {
        this._teardownLevel(/* save= */ false);
      }

      GameState.resetProgress();
      if (this._phase !== Phase.WORLD_MAP) {
        this._goPhase(Phase.WORLD_MAP);
      }
      this._showWorldMap();
      this._announce('Game progress reset. Starting over from World 1.');
      this._showShellToast('Game progress reset. World 1 is unlocked again.');
    };

    if (leavingLevel) {
      await crossFade(async () => {
        finalizeReset();
      }, 250);
      return;
    }

    finalizeReset();
  }

  /**
   * Apply settings to the document.
   * @param {Object} settings
   */
  _applySettings(settings) {
    const html = document.documentElement;

    setLanguage(settings.language ?? 'fr');

    // Font size
    html.dataset.fontSize = settings.fontSize ?? 'medium';

    // Color-blind mode
    html.classList.toggle('color-blind', !!settings.colorBlindMode);

    // Sound/music (actual audio handled by audio.js if present)
    if (window.AudioEngine) {
      window.AudioEngine.setSoundEnabled(!!settings.soundEnabled);
      window.AudioEngine.setMusicVolume(settings.musicVolume ?? 0.5);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5h. SOUND HOOKS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Play a named sound effect if sound is enabled.
   * Delegates to window.AudioEngine (audio.js) if available.
   *
   * Sound IDs used internally:
   *   'correct' | 'mistake' | 'hint' | 'task_complete' |
   *   'level_complete' | 'rank_up' | 'click' | 'drag_drop'
   *
   * @param {string} soundId
   */
  _playSound(soundId) {
    if (!GameState.settings.soundEnabled) return;
    window.AudioEngine?.play?.(soundId);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5i. ACCESSIBILITY ANNOUNCER
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Politely announce a message to screen readers via a live region.
   * @param {string} message
   */
  _announce(message) {
    const region = document.getElementById('sr-announcer');
    if (!region) return;
    // Clear then set forces re-announcement even if message is the same
    region.textContent = '';
    requestAnimationFrame(() => { region.textContent = message; });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5j. INTERNAL HELPERS
  // ───────────────────────────────────────────────────────────────────────────

  /** Trigger game-over flow. */
  async _triggerGameOver() {
    const session = GameState.session;
    const score   = session?.score ?? 0;

    this._goPhase(Phase.GAME_OVER);
    this._teardownLevel(/* save= */ false);

    this._playSound('game_over');
    this._announce('Game over. Out of lives.');

    const choice = await showGameOverOverlay(score);

    if (choice === 'retry') await this.replayLevel();
    else                    await this.goToWorldMap();
  }

  /** Render the world map screen. */
  _showWorldMap(worldId = null) {
    const main = document.getElementById('main-content');
    if (!main) return;

    const summaries = GameState.worldSummaries;
    const totalLevels = summaries.reduce((sum, world) => sum + world.levelCount, 0);
    const totalStarsEarned = summaries.reduce((sum, world) => sum + world.stars.earned, 0);
    const totalStarsPossible = summaries.reduce((sum, world) => sum + world.stars.max, 0);
    const unlockedWorlds = summaries.filter(world => world.unlocked).length;
    const isCampaignComplete = GameState.levelsCompleted >= totalLevels;
    const nextObjective = summaries
      .filter(world => world.unlocked)
      .flatMap(world => GameState.levelSummaries(world.id).map(level => ({ world, level })))
      .find(({ level }) => level.unlocked && !level.completed);
    const objectiveLabel = nextObjective
      ? `${t('Next target:')} ${t(nextObjective.world.title)} - ${t('Level')} ${nextObjective.level.levelId}`
      : 'Campaign complete. Replay any world to improve your stars and repair speed.';
    const heroObjective = isCampaignComplete
      ? 'Every world is online. Revisit any challenge to optimize your score, reduce hints, and keep the full pipeline sharp.'
      : `Start with foundations, then stabilize missing values, outliers, encoding,
            scaling, and full production pipelines in order.`;

    this._setScreen('map');
    this._clearWorldTheme();
    this._setSubtext(isCampaignComplete
      ? 'Campaign complete. The factory is fully online, and every world is open for replay, star chasing, and faster clean-room runs.'
      : 'Feature engineering through six connected worlds of cleanup, encoding, scaling, and pipeline design.');
    this._syncRoute({ type: 'map', worldId, levelId: null });

    const breadcrumb = document.getElementById('level-breadcrumb');
    if (breadcrumb) {
      breadcrumb.textContent = worldId != null
        ? `World Map - Focus on World ${worldId}`
        : 'World Map - Data Pipeline';
    }

    main.innerHTML = `
      <section class="world-map screen-section" aria-label="World Map">
        <div class="level-hero world-map__hero" style="--world-color: var(--color-primary);">
          <p class="eyebrow">Campaign Overview</p>
          <h1 class="level-hero__title">Navigate the Data Pipeline</h1>
          <p class="level-hero__objective">
            ${heroObjective}
          </p>
          <div class="action-row">
            <span class="status-box">${summaries.length} worlds - ${totalLevels} levels</span>
            <span class="status-box">${unlockedWorlds} unlocked</span>
            <span class="status-box">${objectiveLabel}</span>
          </div>
          <span class="level-hero__number" aria-hidden="true">FE</span>
        </div>

        <div class="world-map__layout">
          <div class="panel world-map__stage">
            <div class="world-map__pipeline" aria-label="Data Pipeline">
              ${summaries.map(w => `
                <div class="world-node ${w.unlocked ? 'world-node--unlocked' : 'world-node--locked'}
                            ${w.completed ? 'world-node--completed' : ''}"
                     data-world-id="${w.id}"
                     tabindex="${w.unlocked ? '0' : '-1'}"
                     role="button"
                     aria-label="${w.title}${!w.unlocked ? ' (locked)' : ''}: ${w.progress}% complete"
                     style="--world-color:${w.color}">
                  <span class="world-node__icon" aria-hidden="true">${w.icon}</span>
                  <span class="world-node__title">${_escapeHtml(w.title)}</span>
                  <span class="world-node__progress">${w.progress}% complete</span>
                  ${w.completed ? `<span class="world-node__stars" aria-label="${w.stars.earned} of ${w.stars.max} stars">${w.stars.earned} / ${w.stars.max} stars</span>` : ''}
                  ${!w.unlocked ? '<span class="world-node__lock" aria-hidden="true">LOCK</span>' : ''}
                  <div class="world-node__tooltip" aria-hidden="true">
                    <strong>${_escapeHtml(w.chapter)}</strong><br>
                    ${w.levelCount} levels - ${w.progress}% complete
                  </div>
                </div>
              `).join('<div class="world-map__segment" aria-hidden="true"></div>')}
            </div>
          </div>

          <section class="panel world-map__intel world-map__overview" aria-label="Progress Overview">
            <div class="world-map__intel-block">
              <p class="eyebrow">Pipeline Status</p>
              <p class="world-map__global-progress">
                ${GameState.levelsCompleted} / ${totalLevels} levels complete
              </p>
              <div class="world-map__xp-row">
                <span>${GameState.rank.title}</span>
                <span>${GameState.totalXp.toLocaleString('fr-FR')} XP</span>
              </div>
            </div>

            <div class="world-map__intel-grid">
              <div class="world-map__metric">
                <span class="world-map__metric-label">Global Progress</span>
                <strong class="world-map__metric-value">${GameState.globalProgress}%</strong>
              </div>
              <div class="world-map__metric">
                <span class="world-map__metric-label">Stars Earned</span>
                <strong class="world-map__metric-value">${totalStarsEarned} / ${totalStarsPossible}</strong>
              </div>
              <div class="world-map__metric">
                <span class="world-map__metric-label">Unlocked Worlds</span>
                <strong class="world-map__metric-value">${unlockedWorlds} / ${summaries.length}</strong>
              </div>
              <div class="world-map__metric">
                <span class="world-map__metric-label">Current Rank</span>
                <strong class="world-map__metric-value">${GameState.rank.title}</strong>
              </div>
            </div>

            <div class="world-map__checklist" role="list">
              ${summaries.map(w => `
                <article class="world-map__checklist-item" role="listitem" style="--world-color:${w.color}">
                  <div>
                    <p class="world-map__checklist-title">${_escapeHtml(w.title)}</p>
                    <p class="world-map__checklist-copy">${_escapeHtml(w.chapter)}</p>
                  </div>
                  <div class="world-map__checklist-meta">
                    <span>${w.progress}%</span>
                    <span>${w.unlocked ? 'Unlocked' : 'Locked'}</span>
                  </div>
                </article>
              `).join('')}
            </div>
          </section>
        </div>
      </section>`;

    // Attach click / keyboard handlers to world nodes
    main.querySelectorAll('.world-node--unlocked').forEach(node => {
      const worldId = parseInt(node.dataset.worldId, 10);

      node.addEventListener('click', () => this._handleWorldNodeClick(worldId));
      node.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this._handleWorldNodeClick(worldId);
        }
      });
    });
  }

  /**
   * Clicking a world node opens its first uncompleted level (or level 1 if all done).
   * @param {number} worldId
   */
  _handleWorldNodeClick(worldId) {
    const levels   = GameState.levelSummaries(worldId);
    const firstOpen = levels.find(l => l.unlocked && !l.completed);
    const target    = firstOpen ?? levels.find(l => l.unlocked);
    if (target) this.goToLevel(worldId, target.levelId);
  }

  /** Update the fixed breadcrumb nav bar. */
  _updateBreadcrumb(worldId, levelId) {
    const world = WORLDS.find(w => w.id === worldId);
    const el    = document.getElementById('level-breadcrumb');
    if (!el || !world) return;

    const levelMeta = this._level?.meta ?? {};
    const levelName = t(levelMeta.title ?? `Level ${levelId}`);

    el.textContent = `${t(world.title)} › ${t('Level')} ${levelId} - ${levelName}`;
    this._setSubtext(t(levelMeta.subtitle ?? world.chapter));
  }

  /** Apply world-scoped CSS class to <body> for world-specific theme overrides. */
  _applyWorldTheme(worldId) {
    document.body.className = document.body.className
      .replace(/\bworld-theme-\d\b/g, '')
      .trim();
    document.body.classList.add(`world-theme-${worldId}`);
  }

  /** Remove any world-scoped theme class from <body>. */
  _clearWorldTheme() {
    document.body.className = document.body.className
      .replace(/\bworld-theme-\d\b/g, '')
      .trim();
  }

  /**
   * Toggle the map / level screens in the shared shell.
   * @param {'map'|'level'} screen
   */
  _setScreen(screen) {
    const mapScreen = document.getElementById('screen-map');
    const levelScreen = document.getElementById('screen-level');

    if (mapScreen) {
      if (screen === 'map') mapScreen.removeAttribute('hidden');
      else mapScreen.setAttribute('hidden', '');
    }
    if (levelScreen) {
      if (screen === 'level') levelScreen.removeAttribute('hidden');
      else levelScreen.setAttribute('hidden', '');
    }

    document.body.dataset.screen = screen;
  }

  /**
   * Keep the router hash in sync without creating a direct dependency cycle.
   * @param {{ type: string, worldId?: number|null, levelId?: number|null }} route
   */
  _syncRoute(route) {
    void import('./router.js')
      .then(({ Router }) => Router.setRoute(route))
      .catch(() => {});
  }

  /**
   * Update the supporting text shown under the breadcrumb in the app header.
   * @param {string} text
   */
  _setSubtext(text) {
    const el = document.getElementById('app-subtext');
    if (el) {
      el.textContent = text;
    }
  }

  /**
   * Show a non-blocking toast from the engine shell itself.
   * @param {string} message
   * @param {string} [type='toast-warning']
   */
  _showShellToast(message, type = 'toast-warning') {
    const toastRoot = document.getElementById('toast-root');
    if (!toastRoot) return;

    const toast = document.createElement('div');
    toast.className = ['hud-toast', type].filter(Boolean).join(' ');
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    toastRoot.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('hud-toast--visible'));
    setTimeout(() => {
      toast.classList.remove('hud-toast--visible');
      toast.classList.add('hud-toast--exit');
      setTimeout(() => toast.remove(), 260);
    }, 2400);
  }

  /** Keyboard handler: Escape closes settings, back-button guard on Alt+ArrowLeft. */
  _handleKeyDown(e) {
    if (e.key === 'Escape') {
      if (this._phase === Phase.LEVEL_PAUSED) {
        this.closeSettings();
      }
    }
    if (e.key === 'ArrowLeft' && e.altKey) {
      // Browser back shortcut — ask for confirmation if mid-level
      if (this._phase === Phase.LEVEL_ACTIVE || this._phase === Phase.LEVEL_PAUSED) {
        e.preventDefault();
        this.goToWorldMap();
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE-PRIVATE UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Get or create the full-screen curtain overlay used for cross-fades. */
function _getCurtain() {
  let curtain = document.getElementById('transition-curtain');
  if (!curtain) {
    curtain = document.createElement('div');
    curtain.id = 'transition-curtain';
    curtain.className = 'transition-curtain';
    curtain.setAttribute('aria-hidden', 'true');
    curtain.style.opacity = '0';
    document.body.appendChild(curtain);
  }
  return curtain;
}

/** Clear the overlay root and its contents. */
function _clearOverlay(root) {
  root.innerHTML = '';
}

/**
 * Trap keyboard focus inside an element.
 * Returns a cleanup function that removes the listener.
 * @param {HTMLElement} el
 * @returns {Function}
 */
function _trapFocus(el) {
  const focusable = () => Array.from(
    el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
  ).filter(e => !e.disabled && !e.hidden);

  const handler = e => {
    if (e.key !== 'Tab') return;
    const items = focusable();
    if (!items.length) return;
    const first = items[0];
    const last  = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  };
  el.addEventListener('keydown', handler);
  return () => el.removeEventListener('keydown', handler);
}

function _isFinalGameLevel(worldId, levelId) {
  const lastWorld = WORLDS[WORLDS.length - 1];
  return !!lastWorld && worldId === lastWorld.id && levelId === lastWorld.levelCount;
}

function _normalizeFinalCodeResult(codeResult = {}) {
  const previewRows = Array.isArray(codeResult.previewRows)
    ? codeResult.previewRows.slice(0, 10)
    : [];
  const finalColumns = Array.isArray(codeResult.finalColumns) && codeResult.finalColumns.length
    ? [...codeResult.finalColumns]
    : Object.keys(previewRows[0] ?? {});
  const script = typeof codeResult.script === 'string' && codeResult.script.trim()
    ? codeResult.script.trim()
    : '# No script captured.';
  const exportFileName = typeof codeResult.exportFileName === 'string' && codeResult.exportFileName.trim()
    ? codeResult.exportFileName.trim()
    : 'dataforge_final_pipeline_solution.py';

  return {
    previewRows,
    finalColumns,
    script,
    exportFileName,
    datasetHealth: Number.isFinite(codeResult.datasetHealth) ? Math.max(0, Math.min(100, Math.round(codeResult.datasetHealth))) : 100,
    tasksCompleted: Number.isFinite(codeResult.tasksCompleted) ? codeResult.tasksCompleted : 0,
    totalTasks: Number.isFinite(codeResult.totalTasks) ? codeResult.totalTasks : 0,
  };
}

function _renderFinalPreviewTable(columns, rows) {
  if (!Array.isArray(columns) || !columns.length || !Array.isArray(rows) || !rows.length) {
    return '<p class="overlay__finale-empty">No dataset preview captured.</p>';
  }

  const head = columns.map(col => `<th>${_escapeHtml(col)}</th>`).join('');
  const body = rows.map((row, index) => `
    <tr>
      <th scope="row">${index + 1}</th>
      ${columns.map(col => `<td>${_formatPreviewValue(row?.[col])}</td>`).join('')}
    </tr>
  `).join('');

  return `
    <table class="overlay__finale-table">
      <thead>
        <tr>
          <th>#</th>
          ${head}
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function _formatPreviewValue(value) {
  if (value == null) return '<span class="overlay__finale-null">NaN</span>';
  if (typeof value === 'number' && Number.isFinite(value)) {
    const text = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
    return _escapeHtml(text);
  }
  return _escapeHtml(String(value));
}

function _downloadTextFile(fileName, text) {
  const blob = new Blob([text], { type: 'text/x-python;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Minimal HTML escape to prevent XSS in dynamic strings. */
function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Return the world icon for a given world ID. */
function _worldIconFor(worldId) {
  const w = WORLDS.find(x => x.id === worldId);
  return w?.icon ?? '🌐';
}

/** Promise-based delay. */
function _delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Settings panel DOM helpers ────────────────────────────────────────────────
function _setCheckbox(root, selector, value)   { const el = root.querySelector(selector); if (el) el.checked  = !!value; }
function _setRange(   root, selector, value)   { const el = root.querySelector(selector); if (el) el.value    = value;   }
function _setSelect(  root, selector, value)   { const el = root.querySelector(selector); if (el) el.value    = value;   }
function _getCheckbox(root, selector)          { return !!root.querySelector(selector)?.checked;     }
function _getRange(   root, selector)          { return parseFloat(root.querySelector(selector)?.value ?? 0.5); }
function _getSelect(  root, selector)          { return root.querySelector(selector)?.value ?? '';   }

// ─────────────────────────────────────────────────────────────────────────────
// 6. SINGLETON EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The single shared Engine instance.
 *
 * Import and call `Engine.boot()` once in your app entry point:
 *
 * @example
 * import { Engine } from './core/engine.js';
 * Engine.boot();
 *
 * Level modules receive the engine via their `init(engine, container)` call
 * and should only interact with it through the public API:
 *
 * @example
 * // Inside a level module:
 * export default class MyLevel {
 *   meta = { title: 'Variable Types' };
 *
 *   async init(engine, container) {
 *     this._engine = engine;
 *     container.innerHTML = `...`;
 *   }
 *
 *   start() {
 *     // attach event listeners, set up drag/drop, etc.
 *   }
 *
 *   getHint(hintsUsed) {
 *     return ['Try dragging Age to Numerical Continuous.', 'City is Categorical Nominal.'][hintsUsed] ?? null;
 *   }
 *
 *   teardown() {
 *     // remove listeners, cancel timers
 *   }
 * }
 */
/**
 * The single shared engine instance.  Import this wherever you need the engine.
 * Do NOT call `new EngineCore()` anywhere else.
 */
export const Engine = new EngineCore();
// NOTE: Level modules receive the engine via init(engine, container) — they
//       should never import Engine directly.  Only the app entry point and
//       the world-map / navigation layer need this export.
