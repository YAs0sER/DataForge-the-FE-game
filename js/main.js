'use strict';

import { Engine, Phase } from './core/engine.js';
import { Router } from './core/router.js';
import { GameState, TOTAL_LEVELS, MAX_HINTS, MAX_LIVES, WORLDS, STORAGE_KEY } from './core/state.js';
import { formatScore } from './core/score.js';

const LEVEL_HASH_RE = /^#\/world\/\d+\/level\/\d+\/?$/;
const DEBUG_PROGRESS_PARAM = 'debugProgress';

function allLevelRefs() {
  return WORLDS.flatMap(world =>
    Array.from({ length: world.levelCount }, (_, index) => ({
      worldId: world.id,
      levelId: index + 1,
    }))
  );
}

function readStoredPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return {
      playerName: parsed?.player?.name ?? 'Player',
      settings: parsed?.settings ?? null,
    };
  } catch (_) {
    return null;
  }
}

function createDebugSeed(mode) {
  const prefs = readStoredPreferences();
  const defaults = {
    language: 'fr',
    soundEnabled: true,
    musicVolume: 0.5,
    fontSize: 'medium',
    colorBlindMode: false,
    hintAutoShow: false,
  };

  let completedRefs = [];
  let unlockedWorlds = [1];

  if (mode === 'campaign-clear') {
    completedRefs = allLevelRefs();
    unlockedWorlds = WORLDS.map(world => world.id);
  } else if (mode === 'world6-final') {
    completedRefs = allLevelRefs().filter(ref => !(ref.worldId === 6 && ref.levelId === 5));
    unlockedWorlds = WORLDS.map(world => world.id);
  } else {
    return null;
  }

  const levels = {};
  completedRefs.forEach(({ worldId, levelId }) => {
    levels[`w${worldId}_l${levelId}`] = {
      completed: true,
      stars: 3,
      score: 1000,
      mistakes: 0,
      hints: 0,
    };
  });

  return {
    player: {
      name: prefs?.playerName ?? 'Player',
      totalXp: completedRefs.length * 150,
      totalScore: completedRefs.length * 1000,
    },
    levels,
    unlockedWorlds,
    settings: prefs?.settings ? { ...defaults, ...prefs.settings } : defaults,
    createdAt: Date.now(),
    savedAt: Date.now(),
    version: 1,
  };
}

function applyDebugProgressSeed() {
  const mode = new URLSearchParams(window.location.search).get(DEBUG_PROGRESS_PARAM);
  if (!mode) return;

  const seed = createDebugSeed(mode);
  if (!seed) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    GameState.load();
    console.info(`[DataForge] Debug progress seeded: ${mode}`);
  } catch (error) {
    console.warn('[DataForge] Could not apply debug progress seed:', error?.message ?? error);
  }
}

function ensureLifeIcons() {
  const container = document.querySelector('.hud-lives');
  if (!container || container.children.length >= MAX_LIVES) return;

  container.innerHTML = '';
  for (let i = 0; i < MAX_LIVES; i++) {
    const icon = document.createElement('span');
    icon.className = 'hud-life-icon';
    icon.setAttribute('aria-hidden', 'true');
    container.appendChild(icon);
  }
}

function renderLives(lives) {
  const icons = document.querySelectorAll('.hud-lives .hud-life-icon');
  icons.forEach((icon, index) => {
    icon.classList.toggle('hud-life-icon--lost', index >= lives);
  });
}

function nextObjectiveLabel() {
  for (const world of GameState.worldSummaries) {
    if (!world.unlocked) continue;

    for (const level of GameState.levelSummaries(world.id)) {
      if (level.unlocked && !level.completed) {
        return `Next target: ${world.title} - Level ${level.levelId}`;
      }
    }
  }

  return 'Campaign complete. Replay any world to sharpen your pipeline and improve your stars.';
}

function refreshShell() {
  const session = GameState.session;

  const scoreEl = document.querySelector('.hud-score');
  if (scoreEl && !session) {
    scoreEl.textContent = formatScore(GameState.totalScore);
  }

  const hintsEl = document.querySelector('.hud-hints-remaining');
  if (hintsEl && !session) {
    hintsEl.textContent = `${MAX_HINTS} hints left`;
  }

  const streakEl = document.querySelector('.hud-streak');
  if (streakEl && !session) {
    streakEl.textContent = '';
    streakEl.classList.remove('hud-streak--visible', 'hud-streak--pop');
    streakEl.classList.add('hud-streak--hidden');
  }

  renderLives(session?.lives ?? MAX_LIVES);

  const xpBar = document.querySelector('.xp-bar-fill');
  if (xpBar && !session) {
    xpBar.style.width = `${GameState.rankProgress * 100}%`;
  }

  const xpLabel = document.querySelector('.xp-bar-label');
  if (xpLabel && !session) {
    xpLabel.textContent = `${GameState.rank.title} - ${GameState.totalXp.toLocaleString('fr-FR')} XP`;
  }

  const progressCopy = document.getElementById('app-progress-copy');
  if (progressCopy) {
    progressCopy.textContent = `${GameState.levelsCompleted} / ${TOTAL_LEVELS} levels complete`;
  }

  const subtext = document.getElementById('app-subtext');
  if (subtext && document.body.dataset.screen !== 'level') {
    subtext.textContent = nextObjectiveLabel();
  }
}

function rerenderMapIfVisible() {
  if (Engine.phase !== Phase.WORLD_MAP) return;
  void Engine.goToWorldMap(Router.current.worldId ?? null);
}

function bootstrap() {
  applyDebugProgressSeed();
  ensureLifeIcons();
  window.__gameEventBus = GameState.events;

  Engine.boot({
    renderInitialMap: !LEVEL_HASH_RE.test(window.location.hash || ''),
  });

  refreshShell();
  Router.init();
  refreshShell();

  const events = [
    'xp:change',
    'score:change',
    'lives:change',
    'hints:change',
    'level:start',
    'level:complete',
    'settings:change',
  ];

  events.forEach(eventName => {
    GameState.events.on(eventName, () => {
      refreshShell();
    });
  });

  ['world:unlock', 'state:reset'].forEach(eventName => {
    GameState.events.on(eventName, () => {
      refreshShell();
      rerenderMapIfVisible();
    });
  });

  window.DataForge = { Engine, Router, GameState };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
