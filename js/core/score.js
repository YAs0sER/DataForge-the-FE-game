/**
 * DataForge — Score
 *
 * All scoring logic that sits between raw game events and the GameState
 * mutations.  This module answers two distinct questions:
 *
 *   1. "What should the score / XP / stars BE?" — pure calculation functions,
 *      no side-effects, fully testable in isolation.
 *
 *   2. "How should the HUD animate when the score changes?" — the ScoreHUD
 *      class manages the live in-level score display: the 6-digit counter,
 *      the XP bar fill, the star preview, and the counting animation.
 *
 * Consumers:
 *   • engine.js  — calls ScoreHUD methods on game events
 *   • state.js   — uses the pure calculation functions inside completeLevel()
 *   • Level complete / game-over overlays — use formatScore, starRating, etc.
 *
 * ─── Table of contents ────────────────────────────────────────────────────
 *  1.  Scoring constants (mirror state.js — defined here as the authority)
 *  2.  Pure calculation functions
 *       calcLevelScore      — raw score from base, mistakes, hints, time bonus
 *       starRating          — 1|2|3 stars from mistakes + hints
 *       xpForStars          — XP awarded given star delta
 *       calcTimeBonus       — bonus points for fast completion
 *       calcStreakMultiplier — combo multiplier for consecutive correct answers
 *       calcMCQScore        — score for a completed MCQ set
 *       calcCodeLevelScore  — score for a code-fix level
 *  3.  Formatting helpers
 *       formatScore         — zero-padded 6-digit string "004200"
 *       formatXp            — "+150 XP" string
 *       formatStars         — "★★☆" string
 *       formatRankProgress  — "1 450 / 3 000 XP" string
 *  4.  ScoreHUD class       — live in-level HUD controller
 *  5.  XP bar animation helper
 * ──────────────────────────────────────────────────────────────────────────
 */

'use strict';

import { GameState, RANKS, MAX_HINTS, MAX_LIVES } from './state.js';
import { t } from '../i18n.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. SCORING CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Base score for completing any level before penalties. */
export const BASE_LEVEL_SCORE = 1000;

/** Deducted from score per mistake (wrong answer, wrong drop, etc.). */
export const PENALTY_PER_MISTAKE = 100;

/** Deducted from score per hint used. */
export const PENALTY_PER_HINT = 50;

/**
 * Maximum time bonus a player can earn (awarded for very fast completions).
 * Scales linearly: full bonus at 0 s elapsed, 0 bonus at TIME_BONUS_CAP_SECONDS.
 */
export const MAX_TIME_BONUS = 200;
export const TIME_BONUS_CAP_SECONDS = 120; // 2 minutes — after this, no time bonus

/** XP awarded by star count on first completion / improvement. */
export const XP_PER_STAR = Object.freeze({ 1: 50, 2: 100, 3: 150 });

/**
 * Streak multiplier thresholds.
 * { streak: number, multiplier: number }  — use the highest matching row.
 */
export const STREAK_TIERS = Object.freeze([
  { streak:  1, multiplier: 1.0 },
  { streak:  3, multiplier: 1.1 },
  { streak:  5, multiplier: 1.25 },
  { streak: 10, multiplier: 1.5 },
]);

/** Points awarded per correct MCQ answer. */
export const MCQ_POINTS_PER_CORRECT = 150;

/** Bonus awarded for a perfect MCQ run (all correct, no re-tries). */
export const MCQ_PERFECT_BONUS = 300;

/** Points awarded per correctly completed code task. */
export const CODE_TASK_POINTS = 200;

/** Bonus for completing all code tasks without any error runs. */
export const CODE_PERFECT_BONUS = 400;

// ─────────────────────────────────────────────────────────────────────────────
// 2. PURE CALCULATION FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate the final score for a completed level.
 *
 * @param {Object} params
 * @param {number} params.mistakes       Number of incorrect answers / actions.
 * @param {number} params.hintsUsed      Number of hints consumed (0–MAX_HINTS).
 * @param {number} [params.elapsedMs=0]  Time taken in milliseconds.
 * @param {number} [params.baseScore]    Override base; defaults to BASE_LEVEL_SCORE.
 * @returns {number}  Final score, clamped to [0, BASE_LEVEL_SCORE + MAX_TIME_BONUS].
 */
export function calcLevelScore({ mistakes, hintsUsed, elapsedMs = 0, baseScore = BASE_LEVEL_SCORE }) {
  const penalty = (mistakes * PENALTY_PER_MISTAKE) + (hintsUsed * PENALTY_PER_HINT);
  const timeBonus = calcTimeBonus(elapsedMs);
  return Math.max(0, Math.round(baseScore - penalty + timeBonus));
}

/**
 * Determine star rating from mistakes and hints used.
 *
 * Stars:
 *   3 — Perfect: 0 mistakes AND 0 hints
 *   2 — Good:    ≤ 1 mistake OR used a hint but ≤ 1 mistake total
 *   1 — Complete: anything worse
 *
 * @param {number} mistakes
 * @param {number} hintsUsed
 * @returns {1|2|3}
 */
export function starRating(mistakes, hintsUsed) {
  if (mistakes === 0 && hintsUsed === 0) return 3;
  if (mistakes <= 1)                     return 2;
  return 1;
}

/**
 * XP to award given the star delta (new best stars minus previous best stars).
 * Only awards XP for newly-achieved star improvements.
 *
 * @param {number} newStars       Stars just achieved (1–3).
 * @param {number} previousStars  Best stars before this run (0–3).
 * @returns {number}
 */
export function xpForStars(newStars, previousStars) {
  if (newStars <= previousStars) return 0;
  // Award XP for the new best tier only (not cumulative per star)
  return XP_PER_STAR[newStars] ?? 0;
}

/**
 * Time bonus: full MAX_TIME_BONUS at 0 ms, linearly decays to 0 at
 * TIME_BONUS_CAP_SECONDS seconds.  Returns 0 for any time beyond the cap.
 *
 * @param {number} elapsedMs  Time in milliseconds.
 * @returns {number}          Integer bonus points.
 */
export function calcTimeBonus(elapsedMs) {
  const elapsedSec = elapsedMs / 1000;
  if (elapsedSec >= TIME_BONUS_CAP_SECONDS) return 0;
  const fraction = 1 - (elapsedSec / TIME_BONUS_CAP_SECONDS);
  return Math.round(MAX_TIME_BONUS * fraction);
}

/**
 * Streak multiplier for consecutive correct answers (used in drag-drop and
 * MCQ levels to reward runs of correct picks).
 *
 * @param {number} streak  Current consecutive-correct count.
 * @returns {number}       Multiplier value (e.g. 1.25).
 */
export function calcStreakMultiplier(streak) {
  let multiplier = 1.0;
  for (const tier of STREAK_TIERS) {
    if (streak >= tier.streak) multiplier = tier.multiplier;
    else break;
  }
  return multiplier;
}

/**
 * Score for a completed MCQ level.
 *
 * @param {Object} params
 * @param {number} params.correct        Number of correct answers.
 * @param {number} params.total          Total questions.
 * @param {boolean} params.perfect       True if all correct on first attempt.
 * @param {number} [params.hintsUsed=0]
 * @returns {{ score: number, stars: 1|2|3, breakdown: Object }}
 */
export function calcMCQScore({ correct, total, perfect, hintsUsed = 0 }) {
  const base       = correct * MCQ_POINTS_PER_CORRECT;
  const perfBonus  = perfect ? MCQ_PERFECT_BONUS : 0;
  const hintPenalty = hintsUsed * PENALTY_PER_HINT;
  const score      = Math.max(0, base + perfBonus - hintPenalty);

  const mistakes   = total - correct;
  const stars      = starRating(mistakes, hintsUsed);

  return {
    score,
    stars,
    breakdown: {
      base,
      perfectBonus: perfBonus,
      hintPenalty,
      correct,
      total,
    },
  };
}

/**
 * Score for a code-fix level.
 *
 * @param {Object} params
 * @param {number} params.tasksCompleted   Number of tasks solved.
 * @param {number} params.totalTasks       Total tasks in the level.
 * @param {number} params.errorRuns        Number of times ▶ Run produced an error.
 * @param {boolean} params.perfect         True if all tasks completed without any errors.
 * @param {number} [params.hintsUsed=0]
 * @param {number} [params.elapsedMs=0]
 * @returns {{ score: number, stars: 1|2|3, breakdown: Object }}
 */
export function calcCodeLevelScore({
  tasksCompleted,
  totalTasks,
  errorRuns,
  perfect,
  hintsUsed = 0,
  elapsedMs = 0,
}) {
  const base        = tasksCompleted * CODE_TASK_POINTS;
  const perfBonus   = perfect ? CODE_PERFECT_BONUS : 0;
  const errorPenalty = errorRuns * PENALTY_PER_MISTAKE;
  const hintPenalty  = hintsUsed * PENALTY_PER_HINT;
  const timeBonus    = calcTimeBonus(elapsedMs);
  const score        = Math.max(0, base + perfBonus + timeBonus - errorPenalty - hintPenalty);

  // For code levels: mistakes = errorRuns; hints = hintsUsed
  const stars = starRating(errorRuns, hintsUsed);

  return {
    score,
    stars,
    breakdown: {
      base,
      perfectBonus: perfBonus,
      timeBonus,
      errorPenalty,
      hintPenalty,
      tasksCompleted,
      totalTasks,
      errorRuns,
    },
  };
}

/**
 * Given a running session score and a per-action point delta (e.g. a streak
 * bonus on a correct drag-drop), compute the new session score.
 * Clamps to [0, BASE_LEVEL_SCORE + MAX_TIME_BONUS].
 *
 * @param {number} currentScore
 * @param {number} delta          Positive = reward, negative = penalty.
 * @returns {number}
 */
export function applyScoreDelta(currentScore, delta) {
  return Math.max(0, Math.min(BASE_LEVEL_SCORE + MAX_TIME_BONUS, currentScore + delta));
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. FORMATTING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a score as a zero-padded 6-digit string for the HUD.
 * e.g. formatScore(4200) → "004200"
 *
 * @param {number} score
 * @returns {string}
 */
export function formatScore(score) {
  return String(Math.max(0, Math.floor(score))).padStart(6, '0');
}

/**
 * Format an XP delta for display in toasts / animations.
 * e.g. formatXp(150) → "+150 XP"
 *
 * @param {number} xp
 * @returns {string}
 */
export function formatXp(xp) {
  return xp >= 0 ? `+${xp} XP` : `${xp} XP`;
}

/**
 * Format stars as filled/empty star characters.
 * e.g. formatStars(2) → "★★☆"
 *
 * @param {number} earned  0–3
 * @param {number} [max=3]
 * @returns {string}
 */
export function formatStars(earned, max = 3) {
  const filled = '★'.repeat(Math.max(0, Math.min(earned, max)));
  const empty  = '☆'.repeat(Math.max(0, max - Math.min(earned, max)));
  return filled + empty;
}

/**
 * Format rank progress for display below the XP bar.
 * e.g. formatRankProgress(1450, 3000, 'Data Analyst', 'Data Engineer')
 *   → "1 450 / 3 000 XP  ·  Data Analyst → Data Engineer"
 *
 * @param {number} currentXp
 * @param {number} nextThreshold
 * @param {string} currentRankTitle
 * @param {string} nextRankTitle
 * @returns {string}
 */
export function formatRankProgress(currentXp, nextThreshold, currentRankTitle, nextRankTitle) {
  const fmt = n => n.toLocaleString('fr-FR'); // space-separated thousands (French locale, matches game audience)
  return `${fmt(currentXp)} / ${fmt(nextThreshold)} XP  ·  ${currentRankTitle} → ${nextRankTitle}`;
}

/**
 * Format an elapsed time in ms as "mm:ss".
 * e.g. formatTime(75000) → "01:15"
 *
 * @param {number} elapsedMs
 * @returns {string}
 */
export function formatTime(elapsedMs) {
  const totalSec = Math.floor(elapsedMs / 1000);
  const mins     = Math.floor(totalSec / 60);
  const secs     = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Build the level-complete summary object consumed by the level-complete
 * overlay (engine.js / level-complete screen).
 *
 * @param {Object} params
 * @param {number} params.worldId
 * @param {number} params.levelId
 * @param {number} params.score
 * @param {number} params.stars
 * @param {number} params.xpGained
 * @param {number} params.mistakes
 * @param {number} params.hintsUsed
 * @param {number} params.elapsedMs
 * @returns {Object}
 */
export function buildCompletionSummary({ worldId, levelId, score, stars, xpGained, mistakes, hintsUsed, elapsedMs }) {
  const session   = GameState.session;                 // may be null if called after finishLevel()
  const totalXp   = GameState.totalXp;
  const rank      = GameState.rank;
  const rankProg  = GameState.rankProgress;

  // Rank info for the next tier
  const currentRankIdx = RANKS.reduce((bestIndex, rankDef, index) => (
    totalXp >= rankDef.xp ? index : bestIndex
  ), 0);
  const nextRank       = RANKS[currentRankIdx + 1] ?? null;
  const nextRankTitle  = nextRank ? t(nextRank.title) : null;

  return {
    worldId,
    levelId,
    score:         formatScore(score),
    scoreRaw:      score,
    stars,
    starsFormatted: formatStars(stars),
    xpGained,
    xpFormatted:   formatXp(xpGained),
    mistakes,
    hintsUsed,
    elapsedMs,
    timeFormatted: formatTime(elapsedMs),
    timeBonus:     calcTimeBonus(elapsedMs),
    totalXp,
    rank:          rank.title,
    rankProgress:  rankProg,
    nextRank:      nextRankTitle,
    nextRankXp:    nextRank?.xp   ?? null,
    rankProgressFormatted: nextRank
      ? formatRankProgress(totalXp, nextRank.xp, rank.title, nextRankTitle)
      : `${totalXp.toLocaleString('fr-FR')} XP  ·  ${t('Max rank reached')}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ScoreHUD CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ScoreHUD
 *
 * Manages the live in-level scoring display:
 *   • 6-digit score counter (top-right of the fixed nav bar)
 *   • XP progress bar (top full-width strip)
 *   • Lives hexagons (top-left)
 *   • Hints remaining indicator
 *   • Live streak badge
 *   • Toast notifications for XP gains, streak milestones, penalties
 *
 * The HUD does NOT own the score values — it reads them from GameState and
 * animates DOM elements.  engine.js is responsible for calling the HUD
 * methods at the right game moments.
 *
 * Usage:
 *   const hud = new ScoreHUD();
 *   hud.mount();              // called once after the level DOM is ready
 *   hud.onCorrect(streak);    // called by engine on a correct player action
 *   hud.onMistake();          // called by engine on a wrong action
 *   hud.onHintUsed();         // called by engine when player uses a hint
 *   hud.onLevelComplete(summary);  // called by engine to trigger the transition
 *   hud.unmount();            // cleanup before navigating away
 */
export class ScoreHUD {
  constructor() {
    /** @type {number} Live session score shown on screen. */
    this._displayedScore = 0;

    /** @type {number} Target score (animated toward). */
    this._targetScore    = 0;

    /** @type {number|null} requestAnimationFrame handle for score animation. */
    this._scoreRaf       = null;

    /** @type {number} Current streak (consecutive correct answers). */
    this._streak         = 0;

    /** @type {boolean} Whether the HUD is mounted and DOM refs are valid. */
    this._mounted        = false;

    // DOM element refs — populated in mount()
    this._els = {
      scoreDisplay:   null,   // .hud-score  (6-digit span)
      xpBar:          null,   // .xp-bar-fill
      xpLabel:        null,   // .xp-bar-label (optional)
      livesContainer: null,   // .hud-lives
      hintsLabel:     null,   // .hud-hints-remaining
      streakBadge:    null,   // .hud-streak
      toastContainer: null,   // .hud-toast-container
    };

    // Bound event listeners for GameState events
    this._onScoreChange  = this._handleScoreChange.bind(this);
    this._onXpChange     = this._handleXpChange.bind(this);
    this._onLivesChange  = this._handleLivesChange.bind(this);
    this._onHintsChange  = this._handleHintsChange.bind(this);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Mount the HUD by querying the DOM and subscribing to GameState events.
   * Call once after level HTML is in the DOM.
   */
  mount() {
    this._els.scoreDisplay   = document.querySelector('.hud-score');
    this._els.xpBar          = document.querySelector('.xp-bar-fill');
    this._els.xpLabel        = document.querySelector('.xp-bar-label');
    this._els.livesContainer = document.querySelector('.hud-lives');
    this._els.hintsLabel     = document.querySelector('.hud-hints-remaining');
    this._els.streakBadge    = document.querySelector('.hud-streak');
    this._els.toastContainer = document.querySelector('.hud-toast-container');

    // Subscribe to state events
    this._unsubScore  = GameState.events.on('score:change', this._onScoreChange);
    this._unsubXp     = GameState.events.on('xp:change',   this._onXpChange);
    this._unsubLives  = GameState.events.on('lives:change', this._onLivesChange);
    this._unsubHints  = GameState.events.on('hints:change', this._onHintsChange);

    this._mounted = true;

    // Initialise display from current state
    this._syncAll();
  }

  /**
   * Unmount the HUD.  Cancel animations and remove event listeners.
   */
  unmount() {
    if (!this._mounted) return;
    this._unsubScore?.();
    this._unsubXp?.();
    this._unsubLives?.();
    this._unsubHints?.();
    if (this._scoreRaf) cancelAnimationFrame(this._scoreRaf);
    this._mounted = false;
  }

  // ── Public API (called by engine.js) ─────────────────────────────────────

  /**
   * A correct answer was given.  Update streak and show reward toast.
   * @param {number} [newStreak]  Pass the engine's streak counter if tracked there.
   */
  onCorrect(newStreak) {
    if (!this._mounted) return;
    if (newStreak !== undefined) this._streak = newStreak;
    else this._streak++;

    const multiplier = calcStreakMultiplier(this._streak);

    if (this._streak >= 3) {
      this._showStreakBadge(this._streak, multiplier);
    }

    // Flash the score display green
    this._flashElement(this._els.scoreDisplay, 'hud-flash-correct');
  }

  /**
   * A mistake was recorded.  Reset streak, flash lives.
   */
  onMistake() {
    if (!this._mounted) return;
    this._streak = 0;
    this._hideStreakBadge();
    this._flashElement(this._els.scoreDisplay, 'hud-flash-error');
    this._showToast(`-${PENALTY_PER_MISTAKE} pts`, 'toast-penalty');
  }

  /**
   * A hint was used.
   */
  onHintUsed() {
    if (!this._mounted) return;
    this._showToast(`-${PENALTY_PER_HINT} pts (hint)`, 'toast-hint');
  }

  /**
   * Level completed.  Trigger the score roll-up animation then call back.
   * @param {Object}   summary      — return of buildCompletionSummary()
   * @param {Function} [onDone]     — called after animation finishes
   */
  onLevelComplete(summary, onDone) {
    if (!this._mounted) return;

    // Show XP toast
    this._showToast(summary.xpFormatted, 'toast-xp');

    // Animate the XP bar to its new fill level
    this._animateXpBar(GameState.rankProgress);

    // After a short delay let engine handle the level-complete overlay
    setTimeout(() => {
      this._hideStreakBadge();
      onDone?.();
    }, 600);
  }

  /**
   * Reset streak counter externally (e.g. between sub-tasks).
   */
  resetStreak() {
    this._streak = 0;
    this._hideStreakBadge();
  }

  /**
   * Directly set the live session score (e.g. during the level to keep
   * the HUD in sync when the engine recalculates mid-level score).
   * @param {number} score
   * @param {boolean} [animate=true]
   */
  setScore(score, animate = true) {
    this._targetScore = Math.max(0, score);
    if (animate) {
      this._animateScoreCounter();
    } else {
      this._displayedScore = this._targetScore;
      this._renderScore();
    }
  }

  // ── Private: sync all display from current GameState ─────────────────────

  _syncAll() {
    const session = GameState.session;
    if (session) {
      this._displayedScore = session.score;
      this._targetScore    = session.score;
      this._renderScore();
      this._renderLives(session.lives);
      this._renderHints(session.hintsUsed);
    }
    this._syncXpBar();
  }

  _syncXpBar() {
    const progress = GameState.rankProgress;
    if (this._els.xpBar) {
      this._els.xpBar.style.width = `${progress * 100}%`;
    }
    if (this._els.xpLabel) {
      const rank    = GameState.rank;
      const totalXp = GameState.totalXp;
      this._els.xpLabel.textContent = `${rank.title}  ·  ${totalXp.toLocaleString('fr-FR')} XP`;
    }
  }

  // ── Private: event handlers ───────────────────────────────────────────────

  _handleScoreChange({ totalScore, delta }) {
    // totalScore is cumulative — for the HUD we want the live session score
    // which is tracked in the session object.
    const session = GameState.session;
    if (session) {
      this._targetScore = session.score;
      this._animateScoreCounter();
    }
  }

  _handleXpChange({ totalXp }) {
    this._animateXpBar(GameState.rankProgress);
    this._showToast(formatXp(totalXp - (GameState.totalXp - totalXp)), 'toast-xp');
  }

  _handleLivesChange({ lives }) {
    this._renderLives(lives);
  }

  _handleHintsChange({ hintsUsed }) {
    this._renderHints(hintsUsed);
  }

  // ── Private: DOM renderers ────────────────────────────────────────────────

  _renderScore() {
    if (this._els.scoreDisplay) {
      this._els.scoreDisplay.textContent = formatScore(this._displayedScore);
    }
  }

  /**
   * Smooth count-up / count-down animation for the score display.
   * Uses requestAnimationFrame with a speed proportional to the delta.
   */
  _animateScoreCounter() {
    if (this._scoreRaf) cancelAnimationFrame(this._scoreRaf);

    const SPEED = 8; // points moved per frame at 60 fps

    const tick = () => {
      const diff = this._targetScore - this._displayedScore;
      if (Math.abs(diff) < 1) {
        this._displayedScore = this._targetScore;
        this._renderScore();
        return;
      }
      // Accelerate for large diffs, decelerate near target
      const delta = Math.sign(diff) * Math.max(1, Math.min(SPEED, Math.abs(diff) * 0.1));
      this._displayedScore += delta;
      this._renderScore();
      this._scoreRaf = requestAnimationFrame(tick);
    };

    this._scoreRaf = requestAnimationFrame(tick);
  }

  /**
   * Render the lives hexagons — dims icons equal to (MAX_LIVES - lives).
   * @param {number} lives  0–MAX_LIVES
   */
  _renderLives(lives) {
    if (!this._els.livesContainer) return;
    const icons = this._els.livesContainer.querySelectorAll('.hud-life-icon');
    icons.forEach((icon, i) => {
      const active = i < lives;
      icon.classList.toggle('hud-life-icon--lost', !active);
      icon.setAttribute('aria-label', active ? 'Life' : 'Lost life');
    });
  }

  /**
   * Render the hints remaining indicator.
   * @param {number} hintsUsed
   */
  _renderHints(hintsUsed) {
    const remaining = MAX_HINTS - hintsUsed;
    if (this._els.hintsLabel) {
      this._els.hintsLabel.textContent = `${remaining} hint${remaining !== 1 ? 's' : ''} left`;
    }
  }

  /**
   * Show/update the streak badge.
   * @param {number} streak
   * @param {number} multiplier
   */
  _showStreakBadge(streak, multiplier) {
    if (!this._els.streakBadge) return;
    this._els.streakBadge.textContent = `🔥 ×${streak}  (${multiplier}×)`;
    this._els.streakBadge.classList.add('hud-streak--visible');
    this._els.streakBadge.classList.remove('hud-streak--hidden');
    // Pop animation: remove then re-add class to retrigger CSS keyframe
    this._els.streakBadge.classList.remove('hud-streak--pop');
    void this._els.streakBadge.offsetWidth; // force reflow
    this._els.streakBadge.classList.add('hud-streak--pop');
  }

  _hideStreakBadge() {
    if (!this._els.streakBadge) return;
    this._els.streakBadge.classList.remove('hud-streak--visible', 'hud-streak--pop');
    this._els.streakBadge.classList.add('hud-streak--hidden');
  }

  // ── Private: XP bar animation ─────────────────────────────────────────────

  /**
   * Animate the XP bar to `targetFill` (0–1).
   * Handles rank-up overflow: bar fills to 100%, briefly glows, then restarts at 0%.
   * @param {number} targetFill
   */
  _animateXpBar(targetFill) {
    if (!this._els.xpBar) return;

    const bar = this._els.xpBar;
    const currentFill = parseFloat(bar.style.width) / 100 || 0;

    // If the target is less than current (rank-up happened), do overflow animation
    if (targetFill < currentFill) {
      // Fill to 100%
      bar.style.transition = 'width 300ms ease-out';
      bar.style.width = '100%';
      bar.classList.add('xp-bar-fill--rankup');

      setTimeout(() => {
        // Reset to 0% instantly
        bar.style.transition = 'none';
        bar.style.width = '0%';
        bar.classList.remove('xp-bar-fill--rankup');

        // Animate up to new fill
        requestAnimationFrame(() => {
          bar.style.transition = 'width 600ms ease-out';
          bar.style.width = `${targetFill * 100}%`;
          this._syncXpBar();
        });
      }, 400);
    } else {
      bar.style.transition = 'width 600ms ease-out';
      bar.style.width = `${targetFill * 100}%`;
      // Brief glow
      bar.classList.add('xp-bar-fill--glow');
      setTimeout(() => bar.classList.remove('xp-bar-fill--glow'), 800);
      this._syncXpBar();
    }
  }

  // ── Private: flash & toast helpers ────────────────────────────────────────

  /**
   * Briefly add a CSS class to an element to trigger a flash animation,
   * then remove it.
   * @param {Element|null} el
   * @param {string}       className
   * @param {number}       [durationMs=500]
   */
  _flashElement(el, className, durationMs = 500) {
    if (!el) return;
    el.classList.add(className);
    setTimeout(() => el.classList.remove(className), durationMs);
  }

  /**
   * Show a floating toast notification near the score counter.
   *
   * @param {string} text         e.g. "+150 XP"
   * @param {string} [type='']    CSS modifier class (toast-xp, toast-penalty, toast-hint)
   * @param {number} [durationMs=1800]
   */
  _showToast(text, type = '', durationMs = 1800) {
    if (!this._els.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = ['hud-toast', type].filter(Boolean).join(' ');
    toast.textContent = text;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    this._els.toastContainer.appendChild(toast);

    // Trigger enter animation
    requestAnimationFrame(() => toast.classList.add('hud-toast--visible'));

    // Remove after duration
    setTimeout(() => {
      toast.classList.remove('hud-toast--visible');
      toast.classList.add('hud-toast--exit');
      setTimeout(() => toast.remove(), 300);
    }, durationMs);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. XP BAR ANIMATION HELPER (standalone, for non-HUD contexts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Animate a standalone XP bar element to a target fill percentage.
 * Used on the world-map screen and the rank-up modal.
 *
 * @param {HTMLElement} barEl        The fill element (inner bar).
 * @param {number}      targetFill   0–1.
 * @param {number}      [durationMs=700]
 */
export function animateXpBar(barEl, targetFill, durationMs = 700) {
  if (!barEl) return;
  barEl.style.transition = `width ${durationMs}ms ease-out`;
  barEl.style.width = `${Math.max(0, Math.min(1, targetFill)) * 100}%`;
}

/**
 * Build a star-rating DOM fragment (3 <span> elements) for a given star count.
 * Appends to `containerEl` if provided, otherwise returns the fragment.
 *
 * @param {number}           earned      0–3
 * @param {HTMLElement|null} containerEl
 * @returns {DocumentFragment}
 */
export function renderStars(earned, containerEl = null) {
  const frag = document.createDocumentFragment();
  for (let i = 1; i <= 3; i++) {
    const span = document.createElement('span');
    span.className = i <= earned ? 'star star--filled' : 'star star--empty';
    span.textContent = i <= earned ? '★' : '☆';
    span.setAttribute('aria-hidden', 'true');
    frag.appendChild(span);
  }
  if (containerEl) containerEl.appendChild(frag);
  return frag;
}
