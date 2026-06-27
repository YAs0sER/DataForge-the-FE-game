'use strict';

import { setLanguage } from './i18n.js';

const params = new URLSearchParams(window.location.search);
const worldId = Number(params.get('world') ?? 1);
const levelId = Number(params.get('level') ?? 1);
const moduleVersion = params.get('moduleV') ?? window.__DATAFORGE_MODULE_VERSION__ ?? '20260621a';
setLanguage(params.get('lang') ?? 'fr');

const ui = {
  title: document.getElementById('dev-harness-title'),
  subtitle: document.getElementById('dev-harness-subtitle'),
  route: document.getElementById('dev-harness-route'),
  correct: document.getElementById('dev-harness-correct'),
  mistakes: document.getElementById('dev-harness-mistakes'),
  hints: document.getElementById('dev-harness-hints'),
  complete: document.getElementById('dev-harness-complete'),
  root: document.getElementById('dev-harness-root'),
};

const debugState = {
  correct: 0,
  mistakes: 0,
  hintsUsed: 0,
  completed: false,
  note: 'Pending',
};

let levelInstance = null;

window.__DATAFORGE_DEV__ = {
  debugState,
  ui,
  get level() {
    return levelInstance;
  },
};

function setWorldTheme(world) {
  document.body.className = document.body.className
    .replace(/\bworld-theme-\d\b/g, '')
    .trim();
  document.body.classList.add('world-theme-' + world);
}

function renderDebug() {
  ui.route.textContent = `W${worldId} - L${levelId}`;
  ui.correct.textContent = `Correct: ${debugState.correct}`;
  ui.mistakes.textContent = `Mistakes: ${debugState.mistakes}`;
  ui.hints.textContent = `Hints: ${debugState.hintsUsed} / 2`;
  ui.complete.textContent = debugState.note;
}

function buildEngineStub() {
  return {
    correct() {
      debugState.correct += 1;
      renderDebug();
    },

    mistake() {
      debugState.mistakes += 1;
      renderDebug();
    },

    requestHint() {
      if (debugState.hintsUsed >= 2) {
        debugState.note = 'No hints remaining';
        renderDebug();
        return { allowed: false, text: null, hintsRemaining: 0 };
      }

      debugState.hintsUsed += 1;
      const text = levelInstance?.getHint?.(debugState.hintsUsed) ?? null;
      debugState.note = text ? 'Hint revealed' : 'No hint available';
      renderDebug();

      return {
        allowed: true,
        text,
        hintsRemaining: Math.max(0, 2 - debugState.hintsUsed),
      };
    },

    async complete() {
      debugState.completed = true;
      debugState.note = 'Level complete triggered';
      renderDebug();
    },

    async completeMCQ() {
      return this.complete();
    },

    async completeCodeLevel() {
      return this.complete();
    },
  };
}

async function bootHarness() {
  setWorldTheme(worldId);
  renderDebug();

  try {
    const mod = await import(`./worlds/world${worldId}/level${levelId}.js?v=${encodeURIComponent(moduleVersion)}`);
    const LevelCtor = mod.default;

    if (typeof LevelCtor !== 'function') {
      throw new Error('Level module does not export a default class.');
    }

    levelInstance = new LevelCtor();
    const engineStub = buildEngineStub();

    await levelInstance.init(engineStub, ui.root);
    levelInstance.start?.();

    ui.title.textContent = levelInstance.meta?.title ?? `World ${worldId} Level ${levelId}`;
    ui.subtitle.textContent = levelInstance.meta?.subtitle ?? 'Standalone level preview';
    document.title = `DataForge Dev - W${worldId}L${levelId}`;
  } catch (error) {
    ui.title.textContent = 'Harness failed to load';
    ui.subtitle.textContent = error instanceof Error ? error.message : String(error);
    ui.root.innerHTML = `
      <article class="panel">
        <p class="eyebrow">Harness Error</p>
        <h1 class="panel-title">Could not mount W${worldId}-L${levelId}</h1>
        <p class="text-muted">${String(error instanceof Error ? error.message : error)}</p>
      </article>
    `;
  }
}

window.addEventListener('beforeunload', () => {
  levelInstance?.teardown?.();
});

bootHarness();
