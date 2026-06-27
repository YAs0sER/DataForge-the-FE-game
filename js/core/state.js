/**
 * DataForge — State
 *
 * Single source of truth for all game state.  Consumed by every other JS
 * module through a shared singleton (`GameState`).  Handles:
 *
 *   • Player profile   — XP, score, rank, display name
 *   • Progress         — world / level unlock & completion, star ratings
 *   • Session          — currently active world / level, lives, hints
 *   • Settings         — sound, music, accessibility preferences
 *   • Persistence      — serialise / deserialise to localStorage
 *   • Events           — lightweight pub/sub so UI modules react to changes
 *     without circular imports
 *
 * ─── Design rules ─────────────────────────────────────────────────────────
 *  • All mutations go through the provided setter methods — never write to
 *    state properties directly from outside this module.
 *  • Every setter that changes persistent state calls _persist() internally.
 *  • Subscribers receive a copy of the relevant slice, never a reference,
 *    so they cannot accidentally mutate state.
 *  • The module exports a single frozen singleton: GameState.
 *    Import it anywhere with:  import { GameState } from './state.js';
 *
 * ─── Table of contents ────────────────────────────────────────────────────
 *  1.  Constants & schemas
 *  2.  Default state factory
 *  3.  Persistence helpers
 *  4.  Event bus
 *  5.  State class
 *       5a.  Player profile
 *       5b.  Progress — worlds & levels
 *       5c.  Session (active level)
 *       5d.  Settings
 *       5e.  Persistence (load / save / reset)
 *       5f.  Derived / read-only getters
 *  6.  Singleton export
 * ──────────────────────────────────────────────────────────────────────────
 */

'use strict';

import { t } from '../i18n.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONSTANTS & SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const STORAGE_KEY = 'dataforge_save_v1';

/**
 * World metadata — static, never written to localStorage.
 * Used by the world-map screen and for progress calculations.
 */
export const WORLDS = Object.freeze([
  {
    id:          1,
    slug:        'foundations',
    title:       'Foundations',
    icon:        '📊',
    color:       '#4A90D9',
    levelCount:  4,
    chapter:     'Chapter 1 — What is Feature Engineering?',
  },
  {
    id:          2,
    slug:        'missing-data',
    title:       'Missing Data',
    icon:        '🕳️',
    color:       '#2D4A8A',
    levelCount:  6,
    chapter:     'Chapter 2 — Handling Missing Values',
  },
  {
    id:          3,
    slug:        'outliers',
    title:       'Outliers',
    icon:        '⚡',
    color:       '#E85D26',
    levelCount:  6,
    chapter:     'Chapter 3 — Outlier Detection & Treatment',
  },
  {
    id:          4,
    slug:        'encoding',
    title:       'Encoding',
    icon:        '🔢',
    color:       '#C9A84C',
    levelCount:  7,
    chapter:     'Chapter 4 — Categorical Encoding',
  },
  {
    id:          5,
    slug:        'scaling',
    title:       'Scaling',
    icon:        '⚖️',
    color:       '#00B4A0',
    levelCount:  7,
    chapter:     'Chapter 5 — Feature Scaling',
  },
  {
    id:          6,
    slug:        'pipeline',
    title:       'The Full Pipeline',
    icon:        '🏭',
    color:       '#7B5EA7',
    levelCount:  5,   // levels 1–4 + final level
    chapter:     'Chapter 6 — End-to-End Pipeline',
  },
]);

/** Total levels across all worlds. */
export const TOTAL_LEVELS = WORLDS.reduce((sum, w) => sum + w.levelCount, 0);

/**
 * XP thresholds per rank.
 * Player's rank is the last entry whose `xp` threshold they've met.
 */
export const RANKS = Object.freeze([
  { title: 'Data Intern',     xp:    0 },
  { title: 'Junior Analyst',  xp:  500 },
  { title: 'Data Analyst',    xp: 1500 },
  { title: 'Data Engineer',   xp: 3000 },
  { title: 'Senior Engineer', xp: 5500 },
  { title: 'ML Scientist',    xp: 9000 },
]);

/** XP awarded per star rating (1–3 stars). */
const XP_PER_STAR = Object.freeze({ 1: 50, 2: 100, 3: 150 });

/** Base score awarded on level completion before penalties. */
const BASE_LEVEL_SCORE = 1000;

/** Score deducted per mistake. */
const PENALTY_PER_MISTAKE = 100;

/** Score deducted per hint used. */
const PENALTY_PER_HINT = 50;

/** Maximum hints per level. */
export const MAX_HINTS = 2;

/** Maximum lives per level. */
export const MAX_LIVES = 3;

// ─────────────────────────────────────────────────────────────────────────────
// 2. DEFAULT STATE FACTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a brand-new state object.  Used on first launch and after full reset.
 * @returns {Object}
 */
function createDefaultState() {
  return {
    // ── Player profile ────────────────────────────────────────────────
    player: {
      name:       'Player',
      totalXp:    0,
      totalScore: 0,   // cumulative across all completed levels
    },

    // ── Progress ──────────────────────────────────────────────────────
    // Keyed by "w{worldId}_l{levelId}", e.g. "w1_l1".
    // Value: { completed: bool, stars: 0|1|2|3, score: number, mistakes: number, hints: number }
    levels: {},

    // Which worlds are unlocked (world 1 always unlocked on new game).
    unlockedWorlds: [1],

    // ── Settings ──────────────────────────────────────────────────────
    settings: {
      language:        'fr',     // 'fr' | 'en'
      soundEnabled:    true,
      musicVolume:     0.5,     // 0–1
      fontSize:        'medium', // 'small' | 'medium' | 'large'
      colorBlindMode:  false,
      hintAutoShow:    false,
    },

    // ── Meta ──────────────────────────────────────────────────────────
    createdAt:  Date.now(),
    savedAt:    Date.now(),
    version:    1,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. PERSISTENCE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch (e) {
    console.warn('[DataForge] Could not save state to localStorage:', e.message);
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1) return null;   // schema mismatch → fresh start
    return parsed;
  } catch (e) {
    console.warn('[DataForge] Could not load state from localStorage:', e.message);
    return null;
  }
}

/**
 * Deep-merge `incoming` onto `base`, returning a new object.
 * Only merges plain objects one level deep (good enough for our schema).
 */
function mergeState(base, incoming) {
  const result = { ...base };
  for (const key of Object.keys(incoming)) {
    if (
      incoming[key] !== null &&
      typeof incoming[key] === 'object' &&
      !Array.isArray(incoming[key]) &&
      typeof base[key] === 'object' &&
      base[key] !== null &&
      !Array.isArray(base[key])
    ) {
      result[key] = { ...base[key], ...incoming[key] };
    } else {
      result[key] = incoming[key];
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. EVENT BUS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal pub/sub event bus.
 *
 * Events emitted by state mutations:
 *   'xp:change'         { totalXp, delta, rank }
 *   'score:change'      { totalScore, delta }
 *   'level:complete'    { worldId, levelId, stars, score, xpGained }
 *   'level:start'       { worldId, levelId }
 *   'world:unlock'      { worldId }
 *   'lives:change'      { lives }
 *   'hints:change'      { hintsUsed, hintsRemaining }
 *   'settings:change'   { settings }
 *   'state:reset'       {}
 */
class EventBus {
  constructor() {
    /** @type {Object.<string, Function[]>} */
    this._listeners = {};
  }

  /**
   * Subscribe to an event.
   * @param {string}   event
   * @param {Function} fn    Callback receives the event payload.
   * @returns {Function}     Unsubscribe function.
   */
  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
    return () => this.off(event, fn);
  }

  /**
   * Subscribe to an event once.
   */
  once(event, fn) {
    const unsub = this.on(event, payload => {
      fn(payload);
      unsub();
    });
    return unsub;
  }

  /**
   * Unsubscribe a specific listener.
   */
  off(event, fn) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(f => f !== fn);
  }

  /**
   * Emit an event to all subscribers.
   * @param {string} event
   * @param {Object} [payload={}]
   */
  emit(event, payload = {}) {
    (this._listeners[event] ?? []).forEach(fn => {
      try { fn({ ...payload }); }
      catch (e) { console.error(`[EventBus] Error in listener for "${event}":`, e); }
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. STATE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class State {
  constructor() {
    /** @type {ReturnType<createDefaultState>} */
    this._data = createDefaultState();

    /** @type {EventBus} */
    this.events = new EventBus();

    /**
     * Active level session — lives, hints, mistake count for the level
     * currently being played.  Null when on the world map.
     * @type {Object|null}
     */
    this._session = null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5a. PLAYER PROFILE
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Set the player's display name.
   * @param {string} name
   */
  setPlayerName(name) {
    this._data.player.name = String(name).trim().slice(0, 24) || 'Player';
    this._persist();
  }

  /**
   * Add XP to the player's total.  Fires 'xp:change'.
   * @param {number} delta  Must be >= 0.
   */
  addXp(delta) {
    if (delta <= 0) return;
    const before = this._data.player.totalXp;
    this._data.player.totalXp += delta;
    this._persist();
    this.events.emit('xp:change', {
      totalXp: this._data.player.totalXp,
      delta,
      rank:    this.rank,
    });
    // Check if rank changed
    const rankBefore = _rankFor(before);
    const rankAfter  = _rankFor(this._data.player.totalXp);
    if (rankAfter.title !== rankBefore.title) {
      this.events.emit('rank:change', { rank: rankAfter });
    }
  }

  /**
   * Add to the cumulative total score.  Fires 'score:change'.
   * @param {number} delta
   */
  addScore(delta) {
    if (delta <= 0) return;
    this._data.player.totalScore += delta;
    this._persist();
    this.events.emit('score:change', {
      totalScore: this._data.player.totalScore,
      delta,
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5b. PROGRESS — WORLDS & LEVELS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Returns the level key used for storage.
   * @param {number} worldId
   * @param {number} levelId
   * @returns {string}
   */
  _levelKey(worldId, levelId) {
    return `w${worldId}_l${levelId}`;
  }

  /**
   * Returns the stored record for a level, or a default (incomplete) record.
   * @param {number} worldId
   * @param {number} levelId
   * @returns {{ completed: boolean, stars: number, score: number, mistakes: number, hints: number }}
   */
  getLevelRecord(worldId, levelId) {
    const key = this._levelKey(worldId, levelId);
    return this._data.levels[key] ?? {
      completed: false,
      stars:     0,
      score:     0,
      mistakes:  0,
      hints:     0,
    };
  }

  /**
   * Mark a level complete.  Calculates stars, awards XP and score.
   * Unlocks the next level / world if applicable.
   * Fires 'level:complete'.
   *
   * @param {number} worldId
   * @param {number} levelId
   * @param {{ mistakes: number, hintsUsed: number }} stats
   * @returns {{ stars: number, score: number, xpGained: number }}
   */
  completeLevel(worldId, levelId, stats = {}) {
    const { mistakes = 0, hintsUsed = 0 } = stats;

    // ── Calculate stars ──────────────────────────────────────────────
    let stars;
    if (mistakes === 0 && hintsUsed === 0) stars = 3;
    else if (mistakes <= 1)                stars = 2;
    else                                   stars = 1;

    // ── Calculate score ──────────────────────────────────────────────
    const rawScore = Math.max(
      0,
      BASE_LEVEL_SCORE - (mistakes * PENALTY_PER_MISTAKE) - (hintsUsed * PENALTY_PER_HINT)
    );

    // Only improve a record — never decrease existing stars/score on retry
    const existing = this.getLevelRecord(worldId, levelId);
    const bestStars = Math.max(existing.stars, stars);
    const bestScore = Math.max(existing.score, rawScore);

    const key = this._levelKey(worldId, levelId);
    this._data.levels[key] = {
      completed: true,
      stars:     bestStars,
      score:     bestScore,
      mistakes,
      hints:     hintsUsed,
    };

    // ── XP ───────────────────────────────────────────────────────────
    // Only award XP for newly-achieved stars (so replaying doesn't inflate XP)
    const newStars = bestStars - existing.stars;
    const xpGained = newStars > 0 ? XP_PER_STAR[bestStars] : 0;
    if (xpGained > 0) this.addXp(xpGained);
    if (rawScore > existing.score) this.addScore(rawScore - existing.score);

    // ── Unlock next ──────────────────────────────────────────────────
    this._unlockNext(worldId, levelId);

    this._persist();
    this.events.emit('level:complete', { worldId, levelId, stars: bestStars, score: bestScore, xpGained });

    return { stars: bestStars, score: bestScore, xpGained };
  }

  /**
   * Unlock the level immediately following (worldId, levelId).
   * If it was the last level in a world, unlock the next world.
   * @private
   */
  _unlockNext(worldId, levelId) {
    const world = WORLDS.find(w => w.id === worldId);
    if (!world) return;

    if (levelId < world.levelCount) {
      // Next level in same world — levels are implicitly unlocked by
      // completing the prior one; no separate storage needed.
      // (isLevelUnlocked() checks this dynamically.)
    } else {
      // Last level of this world → unlock next world
      const nextWorldId = worldId + 1;
      if (nextWorldId <= WORLDS.length && !this._data.unlockedWorlds.includes(nextWorldId)) {
        this._data.unlockedWorlds.push(nextWorldId);
        this.events.emit('world:unlock', { worldId: nextWorldId });
      }
    }
  }

  /**
   * Whether a world is available to the player.
   * @param {number} worldId
   * @returns {boolean}
   */
  isWorldUnlocked(worldId) {
    return this._data.unlockedWorlds.includes(worldId);
  }

  /**
   * Whether a specific level is available to play.
   * Level 1 of an unlocked world is always available.
   * Subsequent levels require the previous level to be completed.
   * @param {number} worldId
   * @param {number} levelId
   * @returns {boolean}
   */
  isLevelUnlocked(worldId, levelId) {
    if (!this.isWorldUnlocked(worldId)) return false;
    if (levelId === 1) return true;
    return this.getLevelRecord(worldId, levelId - 1).completed;
  }

  /**
   * Whether a level has been completed at least once.
   * @param {number} worldId
   * @param {number} levelId
   * @returns {boolean}
   */
  isLevelComplete(worldId, levelId) {
    return this.getLevelRecord(worldId, levelId).completed;
  }

  /**
   * Stars earned for a level (0 if not yet completed).
   * @param {number} worldId
   * @param {number} levelId
   * @returns {0|1|2|3}
   */
  levelStars(worldId, levelId) {
    return this.getLevelRecord(worldId, levelId).stars;
  }

  /**
   * Completion percentage for a world (0–100).
   * @param {number} worldId
   * @returns {number}
   */
  worldProgress(worldId) {
    const world = WORLDS.find(w => w.id === worldId);
    if (!world) return 0;
    let completed = 0;
    for (let l = 1; l <= world.levelCount; l++) {
      if (this.isLevelComplete(worldId, l)) completed++;
    }
    return Math.round((completed / world.levelCount) * 100);
  }

  /**
   * Star rating for an entire world (sum of all level stars, max = levelCount × 3).
   * @param {number} worldId
   * @returns {{ earned: number, max: number }}
   */
  worldStars(worldId) {
    const world = WORLDS.find(w => w.id === worldId);
    if (!world) return { earned: 0, max: 0 };
    let earned = 0;
    for (let l = 1; l <= world.levelCount; l++) {
      earned += this.levelStars(worldId, l);
    }
    return { earned, max: world.levelCount * 3 };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5c. SESSION (ACTIVE LEVEL)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Begin a level session.  Initialises lives, hints, and mistake counter.
   * Fires 'level:start'.
   * @param {number} worldId
   * @param {number} levelId
   */
  startLevel(worldId, levelId) {
    if (!this.isLevelUnlocked(worldId, levelId)) {
      throw new Error(`Level W${worldId}-L${levelId} is not yet unlocked.`);
    }
    this._session = {
      worldId,
      levelId,
      lives:      MAX_LIVES,
      hintsUsed:  0,
      mistakes:   0,
      score:      BASE_LEVEL_SCORE,   // live score that decrements during play
      startedAt:  Date.now(),
    };
    this.events.emit('level:start', { worldId, levelId });
    this.events.emit('lives:change', { lives: MAX_LIVES });
  }

  /**
   * Record a mistake for the active level session.
   * Decrements lives and live score.  Fires 'lives:change'.
   * @returns {{ lives: number, gameOver: boolean }}
   */
  recordMistake() {
    this._requireSession();
    this._session.mistakes++;
    this._session.lives      = Math.max(0, this._session.lives - 1);
    this._session.score      = Math.max(0, this._session.score - PENALTY_PER_MISTAKE);
    this.events.emit('score:change', {
      totalScore: this._data.player.totalScore,
      delta:      -PENALTY_PER_MISTAKE,
      sessionScore: this._session.score,
    });
    this.events.emit('lives:change', { lives: this._session.lives });
    return {
      lives:    this._session.lives,
      gameOver: this._session.lives === 0,
    };
  }

  /**
   * Record a mistake without consuming a life.
   * Useful for MCQ and review levels where wrong answers should still affect
   * the final star rating, but the player should finish the whole quiz.
   *
   * @param {number} [penalty=0] Optional score penalty to apply.
   * @returns {{ mistakes: number, lives: number }}
   */
  recordSoftMistake(penalty = 0) {
    this._requireSession();
    this._session.mistakes++;
    this._session.score = Math.max(0, this._session.score - Math.max(0, penalty));
    if (penalty > 0) {
      this.events.emit('score:change', {
        totalScore: this._data.player.totalScore,
        delta:      -penalty,
        sessionScore: this._session.score,
      });
    }
    return {
      mistakes: this._session.mistakes,
      lives:    this._session.lives,
    };
  }

  /**
   * Add points to the active level session without touching cumulative score.
   * Used for streak rewards and sub-task completions while a level is live.
   *
   * @param {number} delta
   * @returns {{ sessionScore: number }}
   */
  addSessionScore(delta) {
    this._requireSession();
    if (delta === 0) {
      return { sessionScore: this._session.score };
    }

    this._session.score = Math.max(0, this._session.score + delta);
    this.events.emit('score:change', {
      totalScore: this._data.player.totalScore,
      delta,
      sessionScore: this._session.score,
    });

    return { sessionScore: this._session.score };
  }

  /**
   * Use a hint for the active level.  Deducts score.
   * Fires 'hints:change'.
   * @returns {{ hintsUsed: number, hintsRemaining: number, allowed: boolean }}
   */
  useHint() {
    this._requireSession();
    if (this._session.hintsUsed >= MAX_HINTS) {
      return { hintsUsed: this._session.hintsUsed, hintsRemaining: 0, allowed: false };
    }
    this._session.hintsUsed++;
    this._session.score = Math.max(0, this._session.score - PENALTY_PER_HINT);
    const hintsRemaining = MAX_HINTS - this._session.hintsUsed;
    this.events.emit('score:change', {
      totalScore: this._data.player.totalScore,
      delta:      -PENALTY_PER_HINT,
      sessionScore: this._session.score,
    });
    this.events.emit('hints:change', { hintsUsed: this._session.hintsUsed, hintsRemaining });
    return { hintsUsed: this._session.hintsUsed, hintsRemaining, allowed: true };
  }

  /**
   * Finalise the active session and record completion.
   * Calls completeLevel() internally.
   * @returns {{ stars: number, score: number, xpGained: number }}
   */
  finishLevel() {
    this._requireSession();
    const { worldId, levelId, mistakes, hintsUsed } = this._session;
    const result = this.completeLevel(worldId, levelId, { mistakes, hintsUsed });
    this._session = null;
    return result;
  }

  /**
   * Abandon the active session (player hit "Return to Map").
   * Progress is NOT saved.
   */
  abandonLevel() {
    this._session = null;
  }

  /**
   * A shallow copy of the active session, or null if on the world map.
   * @returns {Object|null}
   */
  get session() {
    return this._session ? { ...this._session } : null;
  }

  /** @private */
  _requireSession() {
    if (!this._session) throw new Error('No active level session. Call startLevel() first.');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5d. SETTINGS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Update one or more settings.  Fires 'settings:change'.
   * @param {Partial<typeof createDefaultState['settings']>} updates
   */
  updateSettings(updates) {
    const allowed = new Set([
      'language', 'soundEnabled', 'musicVolume', 'fontSize', 'colorBlindMode', 'hintAutoShow',
    ]);
    for (const key of Object.keys(updates)) {
      if (!allowed.has(key)) {
        console.warn(`[State] Unknown setting "${key}" — ignored.`);
        continue;
      }
      this._data.settings[key] = updates[key];
    }
    this._persist();
    this.events.emit('settings:change', { settings: { ...this._data.settings } });
  }

  /**
   * Returns a copy of the current settings object.
   * @returns {Object}
   */
  get settings() {
    return { ...this._data.settings };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5e. PERSISTENCE
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Load state from localStorage.  Merges onto defaults so new fields added
   * in future versions are always present.  Called once at startup.
   */
  load() {
    const saved = loadFromStorage();
    if (saved) {
      this._data = mergeState(createDefaultState(), saved);
    }
    // Always ensure world 1 is unlocked
    if (!this._data.unlockedWorlds.includes(1)) {
      this._data.unlockedWorlds.unshift(1);
    }
  }

  /**
   * Force-save current state to localStorage.
   * Normally called automatically by every mutation.
   */
  save() {
    this._persist();
  }

  /**
   * Wipe all progress and reset to a new game state.  Fires 'state:reset'.
   * Does NOT clear settings.
   */
  resetProgress() {
    const savedSettings = { ...this._data.settings };
    const savedName     = this._data.player.name;
    this._data          = createDefaultState();
    this._data.settings = savedSettings;
    this._data.player.name = savedName;
    this._session       = null;
    this._persist();
    this.events.emit('state:reset', {});
  }

  /**
   * Completely wipe everything including settings.
   */
  hardReset() {
    this._data    = createDefaultState();
    this._session = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    this.events.emit('state:reset', {});
  }

  /** @private — internal persist called by all mutation methods. */
  _persist() {
    saveToStorage(this._data);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5f. DERIVED / READ-ONLY GETTERS
  // ───────────────────────────────────────────────────────────────────────────

  /** Player display name. */
  get playerName() { return this._data.player.name; }

  /** Total accumulated XP. */
  get totalXp() { return this._data.player.totalXp; }

  /** Total accumulated score. */
  get totalScore() { return this._data.player.totalScore; }

  /** Current rank object { title, xp }. */
  get rank() {
    const rank = _rankFor(this._data.player.totalXp);
    return { ...rank, title: t(rank.title) };
  }

  /** Progress toward next rank (0–1). */
  get rankProgress() {
    const current  = _rankFor(this._data.player.totalXp);
    const idx      = RANKS.indexOf(current);
    if (idx === RANKS.length - 1) return 1; // max rank
    const next     = RANKS[idx + 1];
    const span     = next.xp - current.xp;
    const earned   = this._data.player.totalXp - current.xp;
    return Math.min(1, earned / span);
  }

  /** Number of levels completed across all worlds. */
  get levelsCompleted() {
    return Object.values(this._data.levels).filter(r => r.completed).length;
  }

  /** Global progress percentage (0–100). */
  get globalProgress() {
    return Math.round((this.levelsCompleted / TOTAL_LEVELS) * 100);
  }

  /** List of unlocked world IDs. */
  get unlockedWorlds() { return [...this._data.unlockedWorlds]; }

  /**
   * Full progress summary for the world-map screen.
   * @returns {Array<{ id, title, icon, color, unlocked, completed, progress, stars, levelCount }>}
   */
  get worldSummaries() {
    return WORLDS.map(w => ({
      id:         w.id,
      title:      t(w.title),
      icon:       w.icon,
      color:      w.color,
      levelCount: w.levelCount,
      chapter:    t(w.chapter),
      unlocked:   this.isWorldUnlocked(w.id),
      completed:  this.worldProgress(w.id) === 100,
      progress:   this.worldProgress(w.id),
      stars:      this.worldStars(w.id),
    }));
  }

  /**
   * Full level summary for a world's level-select or HUD.
   * @param {number} worldId
   * @returns {Array<{ levelId, unlocked, completed, stars, score }>}
   */
  levelSummaries(worldId) {
    const world = WORLDS.find(w => w.id === worldId);
    if (!world) return [];
    return Array.from({ length: world.levelCount }, (_, i) => {
      const levelId = i + 1;
      const record  = this.getLevelRecord(worldId, levelId);
      return {
        levelId,
        unlocked:  this.isLevelUnlocked(worldId, levelId),
        completed: record.completed,
        stars:     record.stars,
        score:     record.score,
      };
    });
  }

  /**
   * Returns a serialisable snapshot for debugging or export.
   * @returns {Object}
   */
  snapshot() {
    return JSON.parse(JSON.stringify(this._data));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Private utility — rank lookup (module-level, not on the class)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the rank object corresponding to a given XP total.
 * @param {number} xp
 * @returns {{ title: string, xp: number }}
 */
function _rankFor(xp) {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (xp >= r.xp) rank = r;
    else break;
  }
  return rank;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. SINGLETON EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The single shared game state instance.
 * Import this in any module that needs to read or mutate game state.
 *
 * @example
 * import { GameState } from './state.js';
 * GameState.load();                              // once, at app boot
 * GameState.startLevel(1, 1);
 * GameState.recordMistake();
 * GameState.finishLevel();
 * GameState.events.on('xp:change', ({ totalXp }) => updateHUD(totalXp));
 */
export const GameState = new State();

// Convenience re-export of the EventBus class for modules that want to
// create their own local buses (e.g. the editor widget's internal events).
export { EventBus };
