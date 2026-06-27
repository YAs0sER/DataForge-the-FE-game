/**
 * DataForge — Router
 *
 * Synchronises the browser's address bar (hash-based URLs) with the engine's
 * phase machine.  The router is a thin coordination layer — it never owns
 * game state and never triggers state mutations directly.  All navigation
 * intent is forwarded to Engine, which is the authoritative owner of
 * world/level transitions.
 *
 * ─── Why hash routing? ────────────────────────────────────────────────────
 * DataForge is a client-side-only game distributed as static files.  Hash
 * routing (#/world/2/level/3) requires no server configuration, works from
 * file:// during development, and survives hard refreshes without 404s.
 *
 * ─── URL schema ───────────────────────────────────────────────────────────
 *
 *   #/                       → World map  (default / root)
 *   #/world/{w}              → World map, scroll to world node {w}
 *   #/world/{w}/level/{l}    → Play level {l} of world {w}
 *
 *   All other hashes → redirect to #/
 *
 * ─── Flow ─────────────────────────────────────────────────────────────────
 *
 *   Browser popstate / hashchange
 *         ↓
 *   Router.handleLocation()
 *         ↓
 *   Parse hash → Route object
 *         ↓
 *   Guard: is the target unlocked?  (reads GameState, never writes)
 *         ↓  yes                     ↓  no
 *   Engine.goToLevel()          Router.replace(#/) + toast
 *
 *   Engine calls Router.setRoute() after any navigation so the address bar
 *   stays in sync when the engine drives navigation internally
 *   (e.g. "Continue →" on the level-complete overlay).
 *
 * ─── Table of contents ────────────────────────────────────────────────────
 *  1.  Route constants & schema
 *  2.  Route parser
 *  3.  Route serialiser
 *  4.  Navigation guards
 *  5.  Router class
 *       5a.  Constructor / init
 *       5b.  Location handler (hashchange entry point)
 *       5c.  Engine → URL sync  (setRoute / push / replace)
 *       5d.  History helpers
 *       5e.  Link interception
 *       5f.  Error / fallback
 *  6.  Singleton export
 * ──────────────────────────────────────────────────────────────────────────
 */

'use strict';

import { GameState, WORLDS } from './state.js';
import { Engine, Phase }     from './engine.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. ROUTE CONSTANTS & SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Route type identifiers.
 * @enum {string}
 */
export const RouteType = Object.freeze({
  MAP:   'map',    // World map (optionally focused on a world)
  LEVEL: 'level',  // A specific world + level
  UNKNOWN: 'unknown',
});

/**
 * @typedef {Object} Route
 * @property {string}      type      — RouteType.*
 * @property {number|null} worldId   — 1–6, or null for the root map
 * @property {number|null} levelId   — 1–N, or null for world/map routes
 */

/** The hash used for the world-map root. */
const HASH_ROOT = '#/';

/**
 * Regex patterns for each route type.
 *
 *   MAP   hash:  #/  or  #/world/2
 *   LEVEL hash:  #/world/2/level/3
 */
const PATTERNS = Object.freeze({
  LEVEL: /^#\/world\/(\d+)\/level\/(\d+)\/?$/,
  MAP:   /^#\/(?:world\/(\d+))?(?:\/)?$/,
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. ROUTE PARSER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a raw location.hash string into a Route object.
 *
 * @param {string} hash  e.g. "#/world/2/level/3"
 * @returns {Route}
 */
export function parseHash(hash) {
  const raw = hash || HASH_ROOT;

  // Level route
  let m = raw.match(PATTERNS.LEVEL);
  if (m) {
    return {
      type:    RouteType.LEVEL,
      worldId: parseInt(m[1], 10),
      levelId: parseInt(m[2], 10),
    };
  }

  // Map route (with optional world focus)
  m = raw.match(PATTERNS.MAP);
  if (m) {
    return {
      type:    RouteType.MAP,
      worldId: m[1] != null ? parseInt(m[1], 10) : null,
      levelId: null,
    };
  }

  return { type: RouteType.UNKNOWN, worldId: null, levelId: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ROUTE SERIALISER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serialise a Route (or partial spec) back to a hash string.
 *
 * @param {Partial<Route>} route
 * @returns {string}  e.g. "#/world/2/level/3"
 */
export function buildHash(route) {
  if (!route || route.type === RouteType.MAP || route.type == null) {
    if (route?.worldId != null) return `#/world/${route.worldId}`;
    return HASH_ROOT;
  }
  if (route.type === RouteType.LEVEL && route.worldId != null && route.levelId != null) {
    return `#/world/${route.worldId}/level/${route.levelId}`;
  }
  return HASH_ROOT;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. NAVIGATION GUARDS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate that a parsed route is reachable given current game state.
 *
 * @param {Route} route
 * @returns {{ ok: boolean, reason: string|null }}
 */
export function guardRoute(route) {
  if (route.type === RouteType.UNKNOWN) {
    return { ok: false, reason: 'Unknown route — redirecting to map.' };
  }

  if (route.type === RouteType.MAP) {
    if (route.worldId != null) {
      const world = WORLDS.find(w => w.id === route.worldId);
      if (!world) return { ok: false, reason: `World ${route.worldId} does not exist.` };
      // World focus is purely cosmetic — always allowed even if locked
    }
    return { ok: true, reason: null };
  }

  if (route.type === RouteType.LEVEL) {
    const { worldId, levelId } = route;

    const world = WORLDS.find(w => w.id === worldId);
    if (!world) {
      return { ok: false, reason: `World ${worldId} does not exist.` };
    }
    if (levelId < 1 || levelId > world.levelCount) {
      return { ok: false, reason: `Level ${levelId} is out of range for World ${worldId}.` };
    }
    if (!GameState.isWorldUnlocked(worldId)) {
      return { ok: false, reason: `World ${worldId} is not yet unlocked.` };
    }
    if (!GameState.isLevelUnlocked(worldId, levelId)) {
      return { ok: false, reason: `Level W${worldId}L${levelId} is not yet unlocked.` };
    }
    return { ok: true, reason: null };
  }

  return { ok: false, reason: 'Unhandled route type.' };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ROUTER CLASS
// ─────────────────────────────────────────────────────────────────────────────

class RouterCore {
  constructor() {
    /**
     * The route that is currently "active" — kept in sync with the engine.
     * Updated via setRoute() whenever the engine changes screens.
     * @type {Route}
     */
    this._current = { type: RouteType.MAP, worldId: null, levelId: null };

    /**
     * Whether the router is currently processing a navigation.
     * Guards against re-entrant hashchange loops triggered by our own push().
     * @type {boolean}
     */
    this._navigating = false;

    /**
     * Whether we're mid-way through a hash update we triggered ourselves.
     * If true, the next hashchange event is ours and should be silently ignored.
     * @type {boolean}
     */
    this._suppressNext = false;

    /** Bound so we can attach and detach cleanly. */
    this._onHashChange = this._handleHashChange.bind(this);
    this._onClick      = this._handleClick.bind(this);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5a. CONSTRUCTOR / INIT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Initialise the router.  Call once, after Engine.boot().
   *
   * Reads the current URL on startup (deep-link support) and attaches the
   * hashchange listener so all subsequent navigations are intercepted.
   */
  init() {
    window.addEventListener('hashchange', this._onHashChange);
    document.addEventListener('click', this._onClick);

    // Subscribe to GameState events that might invalidate the current route
    // (e.g. a progress reset sends us back to the map)
    GameState.events.on('state:reset', () => {
      this.replace({ type: RouteType.MAP, worldId: null, levelId: null });
    });

    // Handle the URL that is already in the address bar at load time
    this._handleInitialLocation();
  }

  /**
   * Tear down listeners.  Call if the app is ever unloaded (SPA cleanup).
   */
  destroy() {
    window.removeEventListener('hashchange', this._onHashChange);
    document.removeEventListener('click', this._onClick);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5b. LOCATION HANDLER (hashchange entry point)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Respond to a hashchange event triggered by the USER (back/forward buttons,
   * manually edited address bar, or <a href="#/…"> clicks).
   *
   * When the engine drives navigation internally (goToLevel, goToWorldMap, …),
   * the engine calls Router.setRoute() which updates the hash silently via
   * Router._suppressedPush(), so those events never reach this handler.
   */
  async _handleHashChange() {
    if (this._suppressNext) {
      this._suppressNext = false;
      return;
    }
    if (this._navigating) return; // prevent re-entrant calls

    await this._handleLocation(window.location.hash);
  }

  /**
   * Handle the URL present in the address bar at page load (deep links).
   */
  async _handleInitialLocation() {
    const hash = window.location.hash || HASH_ROOT;

    // If there is no hash at all, normalise to root without adding history entry
    if (!window.location.hash) {
      this._suppressedReplace(HASH_ROOT);
    }

    await this._handleLocation(hash);
  }

  /**
   * Core: parse hash → guard → forward to Engine.
   *
   * @param {string} hash  raw location.hash value
   */
  async _handleLocation(hash) {
    if (this._navigating) return;
    this._navigating = true;

    try {
      const route = parseHash(hash);
      const { ok, reason } = guardRoute(route);

      if (!ok) {
        console.warn(`[Router] Navigation blocked: ${reason}`);
        this._showRouteError(reason);
        // Redirect to last known good route
        this._suppressedReplace(buildHash(this._current));
        return;
      }

      await this._dispatchToEngine(route);
    } finally {
      this._navigating = false;
    }
  }

  /**
   * Forward a validated Route to the appropriate Engine method.
   *
   * @param {Route} route
   */
  async _dispatchToEngine(route) {
    if (route.type === RouteType.MAP) {
      // Engine handles its own "are you sure?" guard if mid-level
      await Engine.goToWorldMap(route.worldId);

      // If a world focus is specified, scroll to / highlight that node
      if (route.worldId != null) {
        this._scrollToWorldNode(route.worldId);
      }

      this._current = route;

    } else if (route.type === RouteType.LEVEL) {
      await Engine.goToLevel(route.worldId, route.levelId);
      // If Engine accepted the navigation, _current is updated via setRoute()
      // (which Engine calls after successfully starting a level).
      // If Engine rejected it (e.g. already in that level), _current is unchanged.
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5c. ENGINE → URL SYNC  (setRoute / push / replace)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Called BY ENGINE after any successful navigation.
   * Updates the address bar to reflect the new screen without triggering
   * the hashchange handler (we suppress it).
   *
   * Engine calls this from:
   *   goToWorldMap()   → setRoute({ type: MAP })
   *   _loadLevel()     → setRoute({ type: LEVEL, worldId, levelId })
   *
   * @param {Route|{ type: string, worldId?: number, levelId?: number }} route
   * @param {boolean} [addToHistory=true]  Pass false to use replaceState behaviour.
   */
  setRoute(route, addToHistory = true) {
    const hash = buildHash(route);
    this._current = { ...route };

    if (addToHistory) {
      this._suppressedPush(hash);
    } else {
      this._suppressedReplace(hash);
    }

    // Update <title> for browser history readability
    document.title = this._titleFor(route);
  }

  /**
   * Convenience: navigate to the world map (adds history entry).
   */
  pushMap(worldId = null) {
    this.setRoute({ type: RouteType.MAP, worldId, levelId: null }, true);
  }

  /**
   * Convenience: navigate to a level (adds history entry).
   * @param {number} worldId
   * @param {number} levelId
   */
  pushLevel(worldId, levelId) {
    this.setRoute({ type: RouteType.LEVEL, worldId, levelId }, true);
  }

  /**
   * Replace the current history entry (no new entry added).
   * Use for redirects and error recovery.
   * @param {Route} route
   */
  replace(route) {
    this.setRoute(route, false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5d. HISTORY HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Push a new hash entry to the browser history without firing our own listener.
   * @param {string} hash
   */
  _suppressedPush(hash) {
    if (window.location.hash === hash) return; // already there
    this._suppressNext = true;
    // history.pushState doesn't fire hashchange in all browsers; set hash directly
    // which does fire it — that's why we set _suppressNext first.
    window.location.hash = hash;
  }

  /**
   * Replace the current history entry without firing our own listener.
   * @param {string} hash
   */
  _suppressedReplace(hash) {
    if (window.location.hash === hash) return;
    this._suppressNext = true;
    const url = window.location.pathname + window.location.search + hash;
    window.history.replaceState(null, '', url);
    // replaceState does NOT fire hashchange, so _suppressNext can be cleared immediately
    this._suppressNext = false;
  }

  /**
   * Navigate back one step in browser history.
   * The resulting hashchange will go through _handleHashChange normally.
   */
  back() {
    window.history.back();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5e. LINK INTERCEPTION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Intercept clicks on <a data-route="…"> elements throughout the game UI.
   * This lets HTML templates declare navigation intent declaratively without
   * importing the router or engine directly.
   *
   * Supported data attributes:
   *   data-route="map"                     → go to world map
   *   data-route="map" data-world="2"      → go to map, focus world 2
   *   data-route="level" data-world="2" data-level="3"  → go to W2L3
   *   data-route="back"                    → history.back()
   *   data-route="next"                    → Engine.goToNextLevel()
   *   data-route="replay"                  → Engine.replayLevel()
   *   data-route="settings"                → Engine.openSettings()
   *
   * Standard <a href="#/…"> links are handled by the hashchange listener and
   * don't need the data-route pattern, but data-route is useful for <button>
   * elements and programmatically built UIs.
   *
   * @param {MouseEvent} e
   */
  _handleClick(e) {
    const target = e.target.closest('[data-route]');
    if (!target) return;

    // Honour disabled state
    if (target.disabled || target.getAttribute('aria-disabled') === 'true') return;

    const routeType = target.dataset.route;
    const worldId   = target.dataset.world  != null ? parseInt(target.dataset.world,  10) : null;
    const levelId   = target.dataset.level  != null ? parseInt(target.dataset.level,  10) : null;

    switch (routeType) {
      case 'map':
        e.preventDefault();
        Engine.goToWorldMap(worldId).then(() => {
          if (worldId != null) this._scrollToWorldNode(worldId);
        });
        break;

      case 'level':
        if (worldId != null && levelId != null) {
          e.preventDefault();
          Engine.goToLevel(worldId, levelId);
        }
        break;

      case 'back':
        e.preventDefault();
        this.back();
        break;

      case 'next':
        e.preventDefault();
        Engine.goToNextLevel();
        break;

      case 'replay':
        e.preventDefault();
        Engine.replayLevel();
        break;

      case 'settings':
        e.preventDefault();
        Engine.openSettings();
        break;

      default:
        // Unknown data-route value — log and ignore
        console.warn(`[Router] Unknown data-route value: "${routeType}"`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5f. ERROR / FALLBACK
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Show a brief, non-blocking toast when a route is blocked.
   * @param {string|null} reason
   */
  _showRouteError(reason) {
    if (!reason) return;

    const toastRoot = document.getElementById('toast-root');
    if (!toastRoot) {
      console.warn('[Router]', reason);
      return;
    }

    const toast = document.createElement('div');
    toast.className   = 'hud-toast toast-warning';
    toast.textContent = reason;
    toast.setAttribute('role', 'alert');
    toastRoot.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('hud-toast--visible'));
    setTimeout(() => {
      toast.classList.remove('hud-toast--visible');
      toast.classList.add('hud-toast--exit');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Scroll the world map to highlight a specific world node.
   * The node must have [data-world-id] set; this is a best-effort scroll.
   * @param {number} worldId
   */
  _scrollToWorldNode(worldId) {
    // Deferred slightly so the map render can complete first
    requestAnimationFrame(() => {
      const node = document.querySelector(`.world-node[data-world-id="${worldId}"]`);
      if (node) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Briefly highlight the target node
        node.classList.add('world-node--focused');
        setTimeout(() => node.classList.remove('world-node--focused'), 1500);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public read-only accessors
  // ─────────────────────────────────────────────────────────────────────────

  /** The currently active route. @returns {Route} */
  get current() {
    return { ...this._current };
  }

  /** True if the router is mid-navigation. @returns {boolean} */
  get navigating() {
    return this._navigating;
  }

  /**
   * Build the canonical hash for a given world + level (utility for templates).
   * @param {number} worldId
   * @param {number} levelId
   * @returns {string}
   */
  levelHash(worldId, levelId) {
    return buildHash({ type: RouteType.LEVEL, worldId, levelId });
  }

  /**
   * Build the canonical hash for the world map.
   * @param {number|null} [worldId]
   * @returns {string}
   */
  mapHash(worldId = null) {
    return buildHash({ type: RouteType.MAP, worldId, levelId: null });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private: document title helper
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Build a descriptive <title> for a route (improves browser history labels).
   * @param {Route} route
   * @returns {string}
   */
  _titleFor(route) {
    const base = 'DataForge';
    if (!route || route.type === RouteType.MAP) {
      if (route?.worldId != null) {
        const world = WORLDS.find(w => w.id === route.worldId);
        return world ? `${base} — ${world.title}` : base;
      }
      return `${base} — World Map`;
    }
    if (route.type === RouteType.LEVEL) {
      const world = WORLDS.find(w => w.id === route.worldId);
      if (world) {
        return `${base} — ${world.title} · Level ${route.levelId}`;
      }
    }
    return base;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. SINGLETON EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The single shared Router instance.
 *
 * Initialisation sequence in your entry point (main.js / index.js):
 *
 * @example
 * import { Engine } from './core/engine.js';
 * import { Router } from './core/router.js';
 *
 * Engine.boot();   // loads GameState, renders world map, attaches keyboard listeners
 * Router.init();   // attaches hashchange + click listeners, handles current URL
 *
 * // Engine notifies the Router whenever it successfully navigates:
 * //   inside Engine._loadLevel():   Router.pushLevel(worldId, levelId)
 * //   inside Engine._showWorldMap(): Router.pushMap()
 * //   etc.
 *
 * URL schema reference:
 *   #/                           World map
 *   #/world/2                    World map, focused on World 2
 *   #/world/2/level/3            World 2, Level 3
 *
 * Declarative navigation in HTML (no JS import needed in templates):
 *   <button data-route="map">World Map</button>
 *   <button data-route="map" data-world="3">Go to Outliers</button>
 *   <button data-route="level" data-world="2" data-level="4">Jump to W2L4</button>
 *   <button data-route="next">Continue →</button>
 *   <button data-route="replay">Retry ↺</button>
 *   <button data-route="settings">⚙ Settings</button>
 *   <button data-route="back">← Back</button>
 */
export const Router = new RouterCore();
