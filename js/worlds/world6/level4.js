'use strict';

import { getLevelProblem } from '../../data/problems.js';
import { MCQWidget } from '../../widgets/mcq.js';

const PROBLEM = getLevelProblem(6, 4);
const LEVEL_TITLE = PROBLEM?.title ?? 'Full MCQ - All Worlds';
const LEVEL_OBJECTIVE = PROBLEM?.objective ?? 'Review the complete feature-engineering curriculum in one challenge set.';

const WORLD_SEQUENCE = Object.freeze([
  Object.freeze({
    id: 1,
    code: 'W1',
    label: 'Foundations',
    color: 'var(--color-world-1)',
    focus: 'Types, problem spotting, and pipeline order.',
  }),
  Object.freeze({
    id: 2,
    code: 'W2',
    label: 'Missing Data',
    color: 'var(--color-world-2)',
    focus: 'Mechanisms, indicators, and robust fills.',
  }),
  Object.freeze({
    id: 3,
    code: 'W3',
    label: 'Outliers',
    color: 'var(--color-world-3)',
    focus: 'IQR fences, real extremes, and treatment choice.',
  }),
  Object.freeze({
    id: 4,
    code: 'W4',
    label: 'Encoding',
    color: 'var(--color-world-4)',
    focus: 'One-hot width, frequency math, and safe mappings.',
  }),
  Object.freeze({
    id: 5,
    code: 'W5',
    label: 'Scaling',
    color: 'var(--color-world-5)',
    focus: 'Formulas, skew control, and model compatibility.',
  }),
  Object.freeze({
    id: 6,
    code: 'W6',
    label: 'Full Pipeline',
    color: 'var(--color-world-6)',
    focus: 'Leakage discipline and end-to-end strategy.',
  }),
]);

const WORLD_INDEX = new Map(WORLD_SEQUENCE.map(world => [world.id, world]));

const QUESTION_BANK = Object.freeze([
  Object.freeze({
    id: 'pipeline-order',
    worldId: 1,
    worldCode: 'W1',
    worldLabel: 'Foundations',
    worldColor: 'var(--color-world-1)',
    label: 'Pipeline Order',
    chapter: 'Dependency Chain',
    kind: 'Ordering',
    recap: 'Missing values come first, scaling comes last, and every middle step depends on that order.',
    type: 'match',
    prompt: 'Match each pipeline step number to the healthiest preprocessing station.',
    explanation: 'The stable order is missing-data repair, then outlier treatment, then encoding, then scaling once every feature is numeric and safe to compare.',
    pairs: [
      {
        id: 'step-1',
        prompt: 'Step 1',
        correct: 'Cleaning & Imputation',
        options: ['Cleaning & Imputation', 'Outlier Treatment', 'Encoding', 'Scaling'],
      },
      {
        id: 'step-2',
        prompt: 'Step 2',
        correct: 'Outlier Treatment',
        options: ['Cleaning & Imputation', 'Outlier Treatment', 'Encoding', 'Scaling'],
      },
      {
        id: 'step-3',
        prompt: 'Step 3',
        correct: 'Encoding',
        options: ['Cleaning & Imputation', 'Outlier Treatment', 'Encoding', 'Scaling'],
      },
      {
        id: 'step-4',
        prompt: 'Step 4',
        correct: 'Scaling',
        options: ['Cleaning & Imputation', 'Outlier Treatment', 'Encoding', 'Scaling'],
      },
    ],
  }),
  Object.freeze({
    id: 'variable-type-count',
    worldId: 1,
    worldCode: 'W1',
    worldLabel: 'Foundations',
    worldColor: 'var(--color-world-1)',
    label: 'Type Recognition',
    chapter: 'Discrete vs Continuous',
    kind: 'Concept',
    recap: 'Counts are numeric, but they move in whole-number steps rather than across a smooth continuum.',
    type: 'single',
    prompt: 'Which variable type best fits `number_of_purchases_last_30_days`?',
    options: [
      { id: 'discrete', text: 'Numerical - Discrete', correct: true },
      { id: 'continuous', text: 'Numerical - Continuous', correct: false },
      { id: 'nominal', text: 'Categorical - Nominal', correct: false },
      { id: 'temporal', text: 'Temporal', correct: false },
    ],
    explanation: 'Purchase counts are numeric and ordered, but they increase in whole-number jumps, so they belong with discrete variables.',
  }),
  Object.freeze({
    id: 'missing-mechanism-mar',
    worldId: 2,
    worldCode: 'W2',
    worldLabel: 'Missing Data',
    worldColor: 'var(--color-world-2)',
    label: 'Mechanism Check',
    chapter: 'MCAR vs MAR vs MNAR',
    kind: 'Concept',
    recap: 'MAR means missingness depends on another observed feature, not on the missing value itself.',
    type: 'single',
    prompt: 'Salary values are more likely to be missing for customers in one observed region. Which mechanism is this?',
    options: [
      { id: 'mcar', text: 'MCAR', correct: false },
      { id: 'mar', text: 'MAR', correct: true },
      { id: 'mnar', text: 'MNAR', correct: false },
      { id: 'none', text: 'Not a missing-data problem', correct: false },
    ],
    explanation: 'The missingness depends on an observed column, Region, so this is MAR rather than fully random or self-dependent missingness.',
  }),
  Object.freeze({
    id: 'missing-indicator',
    worldId: 2,
    worldCode: 'W2',
    worldLabel: 'Missing Data',
    worldColor: 'var(--color-world-2)',
    label: 'Indicator Signal',
    chapter: 'Remember the Gap',
    kind: 'Application',
    recap: 'A missing indicator records the original absence, not whether the repaired value looks unusual later.',
    type: 'single',
    prompt: 'When should `Age_missing` equal 1?',
    options: [
      { id: 'original-gap', text: 'Only when the original Age value was missing before imputation', correct: true },
      { id: 'median-fill', text: 'Whenever the imputed Age equals the median', correct: false },
      { id: 'numeric-column', text: 'Whenever Age is numeric', correct: false },
      { id: 'post-scale', text: 'Only after the column has been scaled', correct: false },
    ],
    explanation: 'The indicator remembers which rows originally had no Age value. It is a history flag, not a statistic about the repaired number.',
  }),
  Object.freeze({
    id: 'missing-skew-fill',
    worldId: 2,
    worldCode: 'W2',
    worldLabel: 'Missing Data',
    worldColor: 'var(--color-world-2)',
    label: 'Robust Fill Choice',
    chapter: 'Skewed Numeric Repair',
    kind: 'Application',
    recap: 'Median is safer than mean when a numeric column is pulled by a long right tail.',
    type: 'single',
    prompt: 'A Salary column is heavily right-skewed by a few executive salaries. Which fill is usually safer?',
    options: [
      { id: 'median', text: 'Median imputation', correct: true },
      { id: 'mean', text: 'Mean imputation', correct: false },
      { id: 'mode', text: 'Mode imputation', correct: false },
      { id: 'drop-column', text: 'Drop the whole column immediately', correct: false },
    ],
    explanation: 'Median resists the pull of the extreme high salaries, while the mean gets dragged upward by those outliers.',
  }),
  Object.freeze({
    id: 'outlier-iqr-fence',
    worldId: 3,
    worldCode: 'W3',
    worldLabel: 'Outliers',
    worldColor: 'var(--color-world-3)',
    label: 'IQR Fence',
    chapter: 'Calculation',
    kind: 'Calculation',
    recap: 'Upper fence uses Q3 + 1.5 x IQR after you compute IQR = Q3 - Q1.',
    type: 'single',
    prompt: 'A column has Q1 = 10 and Q3 = 18. What is the upper IQR fence?',
    supportCopy: 'Work the middle spread first, then extend 1.5 IQR above Q3.',
    options: [
      { id: '26', text: '26', correct: false },
      { id: '30', text: '30', correct: true },
      { id: '34', text: '34', correct: false },
      { id: '42', text: '42', correct: false },
    ],
    explanation: 'IQR = 18 - 10 = 8. The upper fence is 18 + 1.5 x 8, which lands at 30.',
  }),
  Object.freeze({
    id: 'outlier-real-row',
    worldId: 3,
    worldCode: 'W3',
    worldLabel: 'Outliers',
    worldColor: 'var(--color-world-3)',
    label: 'Real Extreme Treatment',
    chapter: 'Cap vs Cut',
    kind: 'Application',
    recap: 'A real but oversized observation is often capped so the row survives without dominating the model.',
    type: 'single',
    prompt: 'A whale customer purchase is real, but one row should not dominate the model. Which first treatment is healthiest?',
    options: [
      { id: 'cap', text: 'Cap or clip the extreme value', correct: true },
      { id: 'drop', text: 'Delete the row immediately', correct: false },
      { id: 'ignore', text: 'Leave it unchanged because it is real', correct: false },
      { id: 'onehot', text: 'One-hot encode the numeric column', correct: false },
    ],
    explanation: 'Because the event is valid, capping keeps the customer record while shrinking the leverage of the extreme value.',
  }),
  Object.freeze({
    id: 'encoding-onehot-width',
    worldId: 4,
    worldCode: 'W4',
    worldLabel: 'Encoding',
    worldColor: 'var(--color-world-4)',
    label: 'One-Hot Width',
    chapter: 'Expansion Cost',
    kind: 'Calculation',
    recap: 'One-hot creates one binary column per distinct category unless you intentionally drop one later.',
    type: 'single',
    prompt: 'A `City` column has 4 distinct labels. Before dropping any reference column, how many one-hot columns does it create?',
    options: [
      { id: '4', text: '4 columns', correct: true },
      { id: '3', text: '3 columns', correct: false },
      { id: '1', text: '1 column', correct: false },
      { id: '8', text: '8 columns', correct: false },
    ],
    explanation: 'One-hot encoding creates one binary feature per category, so 4 distinct cities become 4 columns.',
  }),
  Object.freeze({
    id: 'encoding-frequency',
    worldId: 4,
    worldCode: 'W4',
    worldLabel: 'Encoding',
    worldColor: 'var(--color-world-4)',
    label: 'Frequency Math',
    chapter: 'ni / N',
    kind: 'Calculation',
    recap: 'Frequency encoding uses the category share of the dataset, not the raw count by itself.',
    type: 'single',
    prompt: 'A category appears 6 times in a dataset of 30 rows. What frequency-encoding value should it receive?',
    options: [
      { id: '0.2', text: '0.2', correct: true },
      { id: '0.6', text: '0.6', correct: false },
      { id: '6', text: '6', correct: false },
      { id: '5', text: '5', correct: false },
    ],
    explanation: 'Frequency encoding uses ni / N, so 6 divided by 30 becomes 0.2.',
  }),
  Object.freeze({
    id: 'encoding-method-match',
    worldId: 4,
    worldCode: 'W4',
    worldLabel: 'Encoding',
    worldColor: 'var(--color-world-4)',
    label: 'Method Compatibility',
    chapter: 'Feature + Model Fit',
    kind: 'Matching',
    recap: 'The safe encoding depends on both category structure and what the downstream model is likely to misread.',
    type: 'match',
    prompt: 'Match each feature-model pair to the safest encoding choice.',
    explanation: 'Nominal low-cardinality features usually want one-hot, true order can survive label encoding, and huge vocabularies often need a compressed signal first.',
    pairs: [
      {
        id: 'color-linear',
        prompt: 'Color (nominal, 3 values) + Linear Regression',
        correct: 'One-Hot',
        options: ['One-Hot', 'Label', 'Frequency'],
      },
      {
        id: 'education-forest',
        prompt: 'Education Level (ordinal: low / medium / high) + Random Forest',
        correct: 'Label',
        options: ['One-Hot', 'Label', 'Frequency'],
      },
      {
        id: 'postal-nn',
        prompt: 'Postal Code (500 unique values) + Neural Network',
        correct: 'Frequency',
        options: ['One-Hot', 'Label', 'Frequency'],
      },
    ],
  }),
  Object.freeze({
    id: 'scaling-formula',
    worldId: 5,
    worldCode: 'W5',
    worldLabel: 'Scaling',
    worldColor: 'var(--color-world-5)',
    label: 'MinMax Formula',
    chapter: '0 to 1 Range',
    kind: 'Formula',
    recap: 'MinMax subtracts the minimum, then divides by the full range so the column lands between 0 and 1.',
    type: 'single',
    prompt: 'Which formula maps a feature into the 0 to 1 interval?',
    options: [
      { id: 'minmax', text: "x' = (x - min) / (max - min)", correct: true },
      { id: 'zscore', text: "x' = (x - mean) / sigma", correct: false },
      { id: 'log1p', text: "x' = log(x + 1)", correct: false },
      { id: 'divide-max', text: "x' = x / max", correct: false },
    ],
    explanation: 'MinMax scaling subtracts the column minimum, then divides by the full range so the smallest value becomes 0 and the largest becomes 1.',
  }),
  Object.freeze({
    id: 'scaling-log-use',
    worldId: 5,
    worldCode: 'W5',
    worldLabel: 'Scaling',
    worldColor: 'var(--color-world-5)',
    label: 'Log Candidate',
    chapter: 'Skew Control',
    kind: 'Concept',
    recap: 'Log transform is for valid heavy right tails, not for columns that already look balanced or binary.',
    type: 'single',
    prompt: 'Which feature is the best candidate for `log(x + 1)`?',
    options: [
      { id: 'purchase-count', text: 'Purchase_Count with a heavy right tail and many small values', correct: true },
      { id: 'balanced-age', text: 'Age that already looks close to a bell shape', correct: false },
      { id: 'indicator', text: 'A 0 or 1 missing-indicator column', correct: false },
      { id: 'ordinal', text: 'An ordinal satisfaction label encoded as 0, 1, 2', correct: false },
    ],
    explanation: 'Log transform is healthiest when a valid numeric feature has a long right tail that needs compression without deleting rows.',
  }),
  Object.freeze({
    id: 'scaling-model-choice',
    worldId: 5,
    worldCode: 'W5',
    worldLabel: 'Scaling',
    worldColor: 'var(--color-world-5)',
    label: 'Model Sensitivity',
    chapter: 'Who Cares About Scale',
    kind: 'Concept',
    recap: 'Distance-based and gradient-based models usually care far more about raw feature scale than tree models do.',
    type: 'single',
    prompt: 'Which model pair usually needs scaling more urgently than a decision-tree workflow?',
    options: [
      { id: 'knn-logreg', text: 'KNN and Logistic Regression', correct: true },
      { id: 'forest-tree', text: 'Random Forest and Decision Tree', correct: false },
      { id: 'xgboost-tree', text: 'Gradient-boosted trees and Decision Tree only', correct: false },
      { id: 'naivebayes-rules', text: 'Naive Bayes and a hand-written rules table', correct: false },
    ],
    explanation: 'KNN depends on distances and logistic regression often benefits from comparable feature scales, while tree models are much less sensitive to raw range differences.',
  }),
  Object.freeze({
    id: 'leakage-code-read',
    worldId: 6,
    worldCode: 'W6',
    worldLabel: 'Full Pipeline',
    worldColor: 'var(--color-world-6)',
    label: 'Leakage Read',
    chapter: 'Fit Boundary',
    kind: 'Code Read',
    recap: 'Leakage happens when the preprocessing rule learns from held-out rows before the split boundary is respected.',
    type: 'single',
    prompt: 'Why does this workflow leak?',
    supportCopy: 'Read the order carefully. The dangerous part is when the statistic was learned, not just which function name appears.',
    snippet: "age_fill = df['Age'].median()\n" +
      "df['Age'] = df['Age'].fillna(age_fill)\n" +
      "X_train, X_test = split(df)",
    options: [
      { id: 'full-df-median', text: 'The median was learned on the full dataframe before the split', correct: true },
      { id: 'fillna-illegal', text: 'Using fillna on Age is invalid syntax', correct: false },
      { id: 'split-too-early', text: 'The split should happen after model training', correct: false },
      { id: 'missing-only-trees', text: 'Leakage only matters for tree models', correct: false },
    ],
    explanation: 'The fill value was estimated from the full dataset, so the held-out rows helped define the preprocessing rule before the train/test boundary was enforced.',
  }),
  Object.freeze({
    id: 'full-strategy',
    worldId: 6,
    worldCode: 'W6',
    worldLabel: 'Full Pipeline',
    worldColor: 'var(--color-world-6)',
    label: 'Full Strategy',
    chapter: 'End-to-End Recipe',
    kind: 'Application',
    recap: 'The healthiest recipe respects the dependency chain and freezes every learned transform on train only.',
    type: 'single',
    prompt: 'You are preparing data for KNN. The dataset has missing Age values, a real Salary spike, and a nominal City column. Which full strategy is healthiest?',
    options: [
      {
        id: 'median-cap-onehot-train',
        text: 'Median-impute Age, cap Salary, one-hot City, scale on train only, then transform both splits',
        correct: true,
      },
      {
        id: 'mean-drop-label-full',
        text: 'Mean-impute Age, drop the Salary row, label-encode City, and scale on the full dataset before splitting',
        correct: false,
      },
      {
        id: 'mode-ignore-onehot',
        text: 'Mode-impute every column, ignore the Salary spike, one-hot City, and skip scaling because KNN does not care',
        correct: false,
      },
      {
        id: 'drop-missing-zscore-city',
        text: 'Drop incomplete rows immediately, z-score every column, and keep City as raw text',
        correct: false,
      },
    ],
    explanation: 'That plan respects the pipeline order, chooses treatments that fit each feature, and avoids leakage by fitting the learned transforms on train only.',
  }),
]);

const QUESTION_META_INDEX = new Map(QUESTION_BANK.map(question => [question.id, question]));
const QUESTIONS = Array.isArray(PROBLEM?.questions) && PROBLEM.questions.length
  ? PROBLEM.questions.map(question => Object.freeze({ ...(QUESTION_META_INDEX.get(question.id) ?? {}), ...question }))
  : QUESTION_BANK;

const QUESTIONS_BY_ID = new Map(QUESTIONS.map(question => [question.id, question]));
const TOTAL_QUESTIONS = QUESTIONS.length;
const TOTAL_WORLDS = WORLD_SEQUENCE.length;

const WORLD_COUNTS = WORLD_SEQUENCE.map(world => {
  const total = QUESTIONS.filter(question => Number(question.worldId) === world.id).length;
  return Object.freeze({ worldId: world.id, total });
});

const LEVEL_HINTS = Object.freeze([
  ...(PROBLEM?.hints ?? []),
  'If the question feels messy, classify the problem first: missingness, outlier, encoding, scaling, or leakage.',
  'When a column is skewed or extreme, ask whether you need a robust statistic, a cap, or a compression transform.',
  'If a model can misread fake order, think one-hot. If the workflow learns from held-out data, think leakage.',
  'The production rule never changes: split first, fit on train, then transform both splits with the frozen rule.',
]);

const DEFAULT_FEEDBACK = 'Work one world at a time. The fastest way through the review is still the real skill: classify the problem, then choose the least-destructive treatment.';
const DEFAULT_STATUS = 'Answer each question once. The world tracker will show which part of the curriculum still needs another pass.';
const NEXT_LEVEL_COPY = 'The next step is the final dataset: inspect a production-style table, decide the full recipe, and write the pandas-like fixes without leaking future information backward.';
const SUMMARY_LOCKED_COPY = 'Finish all 15 questions to unlock the per-world breakdown and the weak-spot spotlight.';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function worldMeta(worldId) {
  return WORLD_INDEX.get(Number(worldId)) ?? WORLD_INDEX.get(6);
}

function metaFor(questionId) {
  const question = QUESTIONS_BY_ID.get(questionId);
  const world = worldMeta(question?.worldId);
  return {
    questionId,
    label: question?.label ?? questionId,
    chapter: question?.chapter ?? world.focus,
    kind: question?.kind ?? 'Concept',
    recap: question?.recap ?? 'Review the explanation and reconnect the rule before the final code level.',
    worldId: Number(question?.worldId ?? world.id),
    worldCode: question?.worldCode ?? world.code,
    worldLabel: question?.worldLabel ?? world.label,
    worldColor: question?.worldColor ?? world.color,
  };
}

function countsByWorld(resultsMap) {
  return WORLD_SEQUENCE.map(world => {
    const worldQuestions = QUESTIONS.filter(question => Number(question.worldId) === world.id);
    const answeredQuestions = worldQuestions.filter(question => resultsMap.has(question.id));
    const correct = answeredQuestions.filter(question => resultsMap.get(question.id)?.correct).length;
    const wrong = answeredQuestions.length - correct;

    return {
      ...world,
      total: worldQuestions.length,
      answered: answeredQuestions.length,
      correct,
      wrong,
      accuracy: worldQuestions.length ? correct / worldQuestions.length : 1,
      missedQuestions: worldQuestions.filter(question => !resultsMap.get(question.id)?.correct),
    };
  });
}

function buildSummary(results) {
  const orderedResults = QUESTIONS
    .map(question => results.get(question.id))
    .filter(Boolean);
  const correct = orderedResults.filter(result => result.correct).length;
  const breakdown = countsByWorld(results);
  const imperfectWorlds = breakdown.filter(world => world.correct < world.total);
  const lowestAccuracy = imperfectWorlds.length
    ? Math.min(...imperfectWorlds.map(world => world.accuracy))
    : 1;
  const weakWorlds = imperfectWorlds.filter(world => world.accuracy === lowestAccuracy);
  const revisit = orderedResults
    .filter(result => !result.correct)
    .map(result => ({ ...result, ...metaFor(result.questionId) }));

  return {
    total: TOTAL_QUESTIONS,
    correct,
    wrong: TOTAL_QUESTIONS - correct,
    perfect: correct === TOTAL_QUESTIONS,
    breakdown,
    weakWorlds,
    revisit,
    results: orderedResults,
  };
}

function resultTone(summary) {
  if (!summary) return DEFAULT_FEEDBACK;
  if (summary.perfect) {
    return 'Perfect review. Every world held up, and the full feature-engineering toolkit is ready for the final dataset.';
  }
  if (summary.correct >= Math.ceil(summary.total * 0.8)) {
    return 'Strong review. The toolkit is mostly stable, and the breakdown below shows the few worlds worth tightening before the final code run.';
  }
  return 'Useful checkpoint. The breakdown below shows exactly which worlds are still asking for another pass before the final dataset challenge.';
}

function resultStatus(summary) {
  if (!summary) return DEFAULT_STATUS;
  return `Review complete. ${summary.correct} / ${summary.total} answers landed correctly across all worlds.`;
}

function spotlightCopy(summary) {
  if (!summary || summary.perfect) {
    return 'No weak spots detected. Every world finished at full strength, so the final dataset can be approached as one connected pipeline rather than six isolated tricks.';
  }

  const names = summary.weakWorlds.map(world => `${world.code} ${world.label}`).join(' and ');
  return `Weakest area${summary.weakWorlds.length > 1 ? 's' : ''}: ${names}. Revisit the missed topic${summary.weakWorlds.length > 1 ? 's' : ''} there before the last code level.`;
}

function worldStatus(world, completed, activeQuestionId) {
  const activeWorldId = activeQuestionId ? metaFor(activeQuestionId).worldId : null;
  if (completed) {
    if (world.correct === world.total) return 'perfect';
    return world.accuracy <= 0.5 ? 'priority' : 'review';
  }
  if (world.id === activeWorldId) return 'active';
  if (world.answered > 0) return 'in-progress';
  return 'pending';
}

export default class World6Level4 {
  meta = {
    title: LEVEL_TITLE,
    subtitle: LEVEL_OBJECTIVE,
  };

  constructor() {
    this._engine = null;
    this._container = null;
    this._events = null;
    this._widget = null;
    this._results = new Map();
    this._summary = null;
    this._completed = false;
    this._activeQuestionId = QUESTIONS[0]?.id ?? null;
    this._questionObserver = null;
    this._isDecoratingQuestion = false;
    this._ui = {};
  }

  async init(engine, container) {
    this._engine = engine;
    this._container = container;
    this._events = new AbortController();

    container.innerHTML = `
      <section class="w6-level w6-level--review screen-section" aria-label="World 6 Level 4">
        <div class="level-hero w6-level__hero w6-review-hero" style="--world-color: var(--color-world-6);">
          <p class="eyebrow">World 6 - Final Review</p>
          <h1 class="level-hero__title">${escapeHtml(LEVEL_TITLE)}</h1>
          <p class="level-hero__objective">
            ${escapeHtml(LEVEL_OBJECTIVE)}
            This is the full curriculum checkpoint: calculations, concepts, workflow discipline, and one end-to-end strategy before the last real dataset.
          </p>
          <div class="action-row">
            <span class="status-box" id="w6-l4-progress">0 / ${TOTAL_QUESTIONS} questions answered</span>
            <span class="status-box" id="w6-l4-world-progress">0 / ${TOTAL_WORLDS} worlds touched</span>
            <span class="status-box" id="w6-l4-status">${escapeHtml(DEFAULT_STATUS)}</span>
            <button class="btn btn--hint" id="w6-l4-hint-btn" type="button">Hint</button>
            <button class="btn btn--subtle btn--sm" id="w6-l4-reset-btn" type="button">Reset Review</button>
          </div>
          <span class="level-hero__number" aria-hidden="true">04</span>
        </div>

        <div class="w6-review-layout">
          <article class="panel w6-review-stage">
            <div class="w6-level__panel-head">
              <div>
                <p class="eyebrow">Spectrum Review</p>
                <h2 class="panel-title">Fifteen questions across six worlds, one final mental model</h2>
              </div>
              <p class="w6-level__microcopy">
                Every question carries its world badge directly in the review stage, so you can feel whether the weak point is local or whether it breaks the full pipeline logic.
              </p>
            </div>

            <div class="w6-review-widget-shell">
              <div class="w6-review-widget" id="w6-l4-quiz"></div>
            </div>
          </article>

          <div class="w6-review-side">
            <section class="panel w6-review-worlds" aria-label="World Tracker">
              <div class="w6-level__panel-head">
                <div>
                  <p class="eyebrow">World Tracker</p>
                  <h2 class="panel-title">Keep the whole curriculum visible</h2>
                </div>
                <p class="w6-level__microcopy">
                  The final level is easier when you can see which world is already stable and which one still needs a second look.
                </p>
              </div>

              <div class="w6-review-worlds__grid" id="w6-l4-world-grid">
                ${WORLD_SEQUENCE.map(world => {
                  const count = WORLD_COUNTS.find(entry => entry.worldId === world.id)?.total ?? 0;
                  return `
                    <article
                      class="w6-review-world-card"
                      data-world-id="${world.id}"
                      data-world-state="pending"
                      style="--world-card-color:${world.color};"
                    >
                      <div class="w6-review-world-card__meta">
                        <span class="w6-review-world-card__badge">${escapeHtml(world.code)}</span>
                        <span class="w6-review-world-card__score" data-world-score="${world.id}">0 / ${count}</span>
                      </div>
                      <h3 class="w6-review-world-card__title">${escapeHtml(world.label)}</h3>
                      <p class="w6-review-world-card__copy">${escapeHtml(world.focus)}</p>
                    </article>
                  `;
                }).join('')}
              </div>
            </section>

            <section class="panel w6-review-ledger" aria-label="Question Ledger">
              <div class="w6-level__panel-head">
                <div>
                  <p class="eyebrow">Question Ledger</p>
                  <h2 class="panel-title">See each topic lock in</h2>
                </div>
                <p class="w6-level__microcopy">
                  Use the ledger to spot whether the misses are scattered or clustering inside the same world.
                </p>
              </div>

              <div class="w6-review-ledger__list">
                ${QUESTIONS.map((question, index) => {
                  const meta = metaFor(question.id);
                  return `
                    <article
                      class="w6-review-ledger-card"
                      data-question-id="${question.id}"
                      data-question-state="pending"
                      style="--topic-color:${meta.worldColor};"
                    >
                      <div class="w6-review-ledger-card__meta">
                        <span class="w6-review-ledger-card__badge">${escapeHtml(meta.worldCode)}</span>
                        <span class="w6-review-ledger-card__index">Q${index + 1}</span>
                      </div>
                      <h3 class="w6-review-ledger-card__title">${escapeHtml(meta.label)}</h3>
                      <p class="w6-review-ledger-card__chapter">${escapeHtml(meta.chapter)}</p>
                      <span class="w6-review-ledger-card__status" data-question-status="${question.id}">Pending</span>
                    </article>
                  `;
                }).join('')}
              </div>
            </section>

            <section class="panel w6-review-sidecar" aria-label="Coach Feed">
              <div class="card card--elevated w6-level__feedback" aria-live="polite">
                <p class="eyebrow">Coach Feed</p>
                <p id="w6-l4-feedback-text" class="w6-level__feedback-copy">${escapeHtml(DEFAULT_FEEDBACK)}</p>
              </div>

              <div class="card w6-level__hint-box" id="w6-l4-hint-box" hidden>
                <p class="eyebrow">Hint</p>
                <p id="w6-l4-hint-text" class="w6-level__hint-copy"></p>
              </div>

              <div class="card w6-review-next">
                <p class="eyebrow">Next Challenge</p>
                <h2 class="panel-title">The Real Dataset</h2>
                <p class="w6-level__microcopy">${escapeHtml(NEXT_LEVEL_COPY)}</p>
              </div>
            </section>
          </div>
        </div>

        <section class="panel w6-review-summary" id="w6-l4-summary" hidden aria-label="Review Summary">
          <div class="w6-level__panel-head">
            <div>
              <p class="eyebrow">All-Worlds Recap</p>
              <h2 class="panel-title">Where the toolkit is strong and where it still bends</h2>
            </div>
            <p class="w6-level__microcopy" id="w6-l4-summary-lead">${escapeHtml(SUMMARY_LOCKED_COPY)}</p>
          </div>

          <div class="w6-review-summary__hero">
            <article class="w6-review-summary__scorecard">
              <p class="w6-review-summary__label">Final Score</p>
              <strong class="w6-review-summary__value" id="w6-l4-summary-score-display">Waiting</strong>
              <p class="w6-review-summary__copy">The final dataset should feel like one integrated workflow, not six isolated mini-lessons.</p>
            </article>

            <article class="w6-review-summary__spotlight" id="w6-l4-summary-spotlight">
              <p class="w6-review-summary__label">Weak-Spot Spotlight</p>
              <p class="w6-review-summary__copy">${escapeHtml(SUMMARY_LOCKED_COPY)}</p>
            </article>
          </div>

          <div class="w6-review-summary__breakdown" id="w6-l4-breakdown-grid"></div>

          <div class="w6-review-summary__revisit">
            <div class="w6-level__panel-head">
              <div>
                <p class="eyebrow">Priority Revisit</p>
                <h2 class="panel-title">Only the misses return here</h2>
              </div>
              <p class="w6-level__microcopy">
                Perfect answers do not need another card. This panel only surfaces the topics that still deserve attention before the code finale.
              </p>
            </div>
            <div class="w6-review-summary__revisit-grid" id="w6-l4-revisit-grid"></div>
          </div>

          <div class="action-row">
            <span class="status-box" id="w6-l4-summary-score">Waiting for final review</span>
            <button class="btn btn--primary" id="w6-l4-finish-btn" type="button">Continue</button>
          </div>
        </section>
      </section>
    `;

    this._ui.progress = container.querySelector('#w6-l4-progress');
    this._ui.worldProgress = container.querySelector('#w6-l4-world-progress');
    this._ui.status = container.querySelector('#w6-l4-status');
    this._ui.feedback = container.querySelector('#w6-l4-feedback-text');
    this._ui.hintBox = container.querySelector('#w6-l4-hint-box');
    this._ui.hintText = container.querySelector('#w6-l4-hint-text');
    this._ui.quizHost = container.querySelector('#w6-l4-quiz');
    this._ui.worldCards = Array.from(container.querySelectorAll('[data-world-id]'));
    this._ui.ledgerCards = Array.from(container.querySelectorAll('[data-question-id]'));
    this._ui.summary = container.querySelector('#w6-l4-summary');
    this._ui.summaryLead = container.querySelector('#w6-l4-summary-lead');
    this._ui.summaryScore = container.querySelector('#w6-l4-summary-score');
    this._ui.summaryScoreDisplay = container.querySelector('#w6-l4-summary-score-display');
    this._ui.summarySpotlight = container.querySelector('#w6-l4-summary-spotlight');
    this._ui.breakdownGrid = container.querySelector('#w6-l4-breakdown-grid');
    this._ui.revisitGrid = container.querySelector('#w6-l4-revisit-grid');
    this._ui.finishButton = container.querySelector('#w6-l4-finish-btn');

    this._mountWidget();
    this._syncProgress();
    this._syncWorldCards();
    this._syncLedger();
  }

  start() {
    const signal = this._events?.signal;
    if (!signal) return;

    this._container?.addEventListener('click', event => {
      if (event.target.closest('#w6-l4-hint-btn')) {
        this._showHint();
        return;
      }

      if (event.target.closest('#w6-l4-reset-btn')) {
        this._resetQuiz();
        return;
      }

      if (event.target.closest('#w6-l4-finish-btn')) {
        if (this._completed && this._summary) {
          if (typeof this._engine.completeMCQ === 'function') {
            void this._engine.completeMCQ(this._summary);
          } else if (typeof this._engine.complete === 'function') {
            void this._engine.complete();
          }
        }
      }
    }, { signal });
  }

  getHint(hintsUsed) {
    return LEVEL_HINTS[hintsUsed - 1] ?? null;
  }

  pause() {}

  resume() {}

  teardown() {
    this._events?.abort();
    this._widget?.destroy();
    this._questionObserver?.disconnect();
    this._widget = null;
    this._questionObserver = null;
    this._engine = null;
    this._container = null;
    this._events = null;
    this._results.clear();
    this._summary = null;
    this._ui = {};
  }

  _mountWidget() {
    this._widget?.destroy();
    this._questionObserver?.disconnect();
    this._ui.quizHost.innerHTML = '';

    this._widget = new MCQWidget(this._ui.quizHost, {
      questions: QUESTIONS,
      worldColor: 'var(--color-world-6)',
      onAnswer: result => this._handleAnswer(result),
      onComplete: summary => this._handleComplete(summary),
    });

    this._questionObserver = new MutationObserver(() => {
      if (!this._isDecoratingQuestion) {
        this._decorateCurrentQuestion();
      }
    });
    this._questionObserver.observe(this._ui.quizHost, { childList: true, subtree: true });
    this._decorateCurrentQuestion();
  }

  _handleAnswer(result) {
    const question = metaFor(result.questionId);
    this._results.set(result.questionId, result);

    if (result.correct) {
      this._engine.correct();
      this._setFeedback(`Correct. ${result.explanation}`);
    } else {
      this._engine.mistake({ costsLife: false, countsMistake: true });
      this._setFeedback(`Review this one. ${result.explanation}`);
    }

    const answered = this._results.size;
    if (answered === TOTAL_QUESTIONS) {
      this._setStatus('All answers are locked. Scroll into the all-worlds recap and use the weak-spot spotlight before the final dataset.');
    } else {
      this._setStatus(`${question.worldCode} ${question.label} checked. ${answered} / ${TOTAL_QUESTIONS} questions answered.`);
    }

    this._syncProgress();
    this._syncWorldCards();
    this._syncLedger();
  }

  _handleComplete() {
    this._summary = buildSummary(this._results);
    this._completed = true;

    if (this._ui.summaryLead) {
      this._ui.summaryLead.textContent = resultTone(this._summary);
    }

    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = `${this._summary.correct} / ${this._summary.total} correct`;
    }

    if (this._ui.summaryScoreDisplay) {
      this._ui.summaryScoreDisplay.textContent = `${this._summary.correct} / ${this._summary.total}`;
    }

    if (this._ui.summarySpotlight) {
      this._ui.summarySpotlight.innerHTML = `
        <p class="w6-review-summary__label">Weak-Spot Spotlight</p>
        <p class="w6-review-summary__copy">${escapeHtml(spotlightCopy(this._summary))}</p>
      `;
    }

    if (this._ui.breakdownGrid) {
      this._ui.breakdownGrid.innerHTML = this._summary.breakdown.map(world => {
        const state = this._summary.perfect
          ? 'perfect'
          : this._summary.weakWorlds.some(entry => entry.id === world.id)
            ? 'priority'
            : world.correct === world.total
              ? 'steady'
              : 'review';
        const missed = world.missedQuestions.map(question => metaFor(question.id).label).join(', ');

        return `
          <article
            class="w6-review-breakdown-card"
            data-breakdown-state="${state}"
            style="--world-card-color:${world.color};"
          >
            <div class="w6-review-breakdown-card__meta">
              <span class="w6-review-breakdown-card__badge">${escapeHtml(world.code)}</span>
              <span class="w6-review-breakdown-card__score">${world.correct} / ${world.total}</span>
            </div>
            <h3 class="w6-review-breakdown-card__title">${escapeHtml(world.label)}</h3>
            <div class="w6-review-breakdown-card__meter">
              <span style="width:${Math.max(10, world.accuracy * 100)}%"></span>
            </div>
            <p class="w6-review-breakdown-card__copy">
              ${escapeHtml(world.correct === world.total
                ? `Locked in. ${world.focus}`
                : `Missed topic${world.missedQuestions.length > 1 ? 's' : ''}: ${missed}.`)}
            </p>
          </article>
        `;
      }).join('');
    }

    if (this._ui.revisitGrid) {
      if (!this._summary.revisit.length) {
        this._ui.revisitGrid.innerHTML = `
          <article class="w6-review-revisit-card w6-review-revisit-card--perfect">
            <p class="w6-review-revisit-card__eyebrow">No revisit needed</p>
            <h3 class="w6-review-revisit-card__title">All worlds are stable</h3>
            <p class="w6-review-revisit-card__copy">There are no missed questions to surface here, so the final dataset can be approached as a full-speed synthesis run.</p>
          </article>
        `;
      } else {
        this._ui.revisitGrid.innerHTML = this._summary.revisit.map(result => `
          <article
            class="w6-review-revisit-card"
            style="--world-card-color:${result.worldColor};"
          >
            <div class="w6-review-revisit-card__meta">
              <span class="w6-review-revisit-card__badge">${escapeHtml(result.worldCode)}</span>
              <span class="w6-review-revisit-card__kind">${escapeHtml(result.kind)}</span>
            </div>
            <h3 class="w6-review-revisit-card__title">${escapeHtml(result.label)}</h3>
            <p class="w6-review-revisit-card__chapter">${escapeHtml(result.chapter)}</p>
            <p class="w6-review-revisit-card__copy">${escapeHtml(result.explanation)}</p>
          </article>
        `).join('');
      }
    }

    if (this._ui.summary) {
      this._ui.summary.hidden = false;
      requestAnimationFrame(() => {
        this._ui.summary.classList.add('is-revealed');
      });
      this._ui.summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    this._setFeedback(resultTone(this._summary));
    this._setStatus(resultStatus(this._summary));
    this._activeQuestionId = null;
    this._syncProgress();
    this._syncWorldCards();
    this._syncLedger();
  }

  _resetQuiz() {
    this._results.clear();
    this._summary = null;
    this._completed = false;
    this._activeQuestionId = QUESTIONS[0]?.id ?? null;
    this._widget?.restart();

    if (this._ui.hintBox) {
      this._ui.hintBox.hidden = true;
    }

    if (this._ui.hintText) {
      this._ui.hintText.textContent = '';
    }

    if (this._ui.summary) {
      this._ui.summary.hidden = true;
      this._ui.summary.classList.remove('is-revealed');
    }

    if (this._ui.summaryLead) {
      this._ui.summaryLead.textContent = SUMMARY_LOCKED_COPY;
    }

    if (this._ui.summaryScore) {
      this._ui.summaryScore.textContent = 'Waiting for final review';
    }

    if (this._ui.summaryScoreDisplay) {
      this._ui.summaryScoreDisplay.textContent = 'Waiting';
    }

    if (this._ui.summarySpotlight) {
      this._ui.summarySpotlight.innerHTML = `
        <p class="w6-review-summary__label">Weak-Spot Spotlight</p>
        <p class="w6-review-summary__copy">${escapeHtml(SUMMARY_LOCKED_COPY)}</p>
      `;
    }

    if (this._ui.breakdownGrid) {
      this._ui.breakdownGrid.innerHTML = '';
    }

    if (this._ui.revisitGrid) {
      this._ui.revisitGrid.innerHTML = '';
    }

    this._setFeedback(DEFAULT_FEEDBACK);
    this._setStatus(DEFAULT_STATUS);
    this._decorateCurrentQuestion();
    this._syncProgress();
    this._syncWorldCards();
    this._syncLedger();
  }

  _showHint() {
    const { allowed, text } = this._engine.requestHint();
    if (!allowed || !text) return;

    this._ui.hintBox?.removeAttribute('hidden');
    if (this._ui.hintText) {
      this._ui.hintText.textContent = text;
    }
  }

  _decorateCurrentQuestion() {
    if (this._isDecoratingQuestion) return;

    const questionEl = this._ui.quizHost?.querySelector('.mcq-question');
    const eyebrow = questionEl?.querySelector('.eyebrow');
    const title = questionEl?.querySelector('.panel-title');
    if (!questionEl || !eyebrow || !title) return;

    const match = eyebrow.textContent.match(/Question\s+(\d+)\s*\/\s*(\d+)/i);
    if (!match) {
      this._activeQuestionId = null;
      this._syncWorldCards();
      this._syncLedger();
      return;
    }

    const questionIndex = Math.max(0, Number(match[1]) - 1);
    const question = QUESTIONS[questionIndex];
    if (!question) return;

    const meta = metaFor(question.id);
    this._activeQuestionId = question.id;

    let shell = questionEl.querySelector('.w6-review-question-meta');
    if (shell?.dataset.questionId === question.id) {
      shell.style.setProperty('--question-color', meta.worldColor);
      this._syncWorldCards();
      this._syncLedger();
      return;
    }

    this._isDecoratingQuestion = true;
    this._questionObserver?.disconnect();

    if (!shell) {
      shell = document.createElement('div');
      shell.className = 'w6-review-question-meta';
      title.parentNode.insertBefore(shell, title);
    }

    try {
      shell.dataset.questionId = question.id;
      shell.style.setProperty('--question-color', meta.worldColor);
      shell.innerHTML = `
        <div class="w6-review-question-meta__badges">
          <span class="w6-review-question-meta__world">${escapeHtml(meta.worldCode)} - ${escapeHtml(meta.worldLabel)}</span>
          <span class="w6-review-question-meta__kind">${escapeHtml(meta.kind)}</span>
          <span class="w6-review-question-meta__topic">${escapeHtml(meta.chapter)}</span>
        </div>
        ${question.supportCopy ? `<p class="w6-review-question-meta__copy">${escapeHtml(question.supportCopy)}</p>` : ''}
        ${question.snippet ? `<pre class="w6-review-question-meta__snippet"><code>${escapeHtml(question.snippet)}</code></pre>` : ''}
      `;
    } finally {
      this._isDecoratingQuestion = false;
      if (this._questionObserver && this._ui.quizHost) {
        this._questionObserver.observe(this._ui.quizHost, { childList: true, subtree: true });
      }
    }

    this._syncWorldCards();
    this._syncLedger();
  }

  _syncProgress() {
    const answered = this._results.size;
    const worldsTouched = countsByWorld(this._results).filter(world => world.answered > 0).length;
    const correct = Array.from(this._results.values()).filter(result => result.correct).length;

    if (this._ui.progress) {
      this._ui.progress.textContent = this._completed && this._summary
        ? `${this._summary.correct} / ${this._summary.total} correct`
        : `${answered} / ${TOTAL_QUESTIONS} questions answered`;
    }

    if (this._ui.worldProgress) {
      this._ui.worldProgress.textContent = this._completed
        ? `${TOTAL_WORLDS} / ${TOTAL_WORLDS} worlds reviewed`
        : `${worldsTouched} / ${TOTAL_WORLDS} worlds touched`;
    }

    if (this._ui.finishButton) {
      this._ui.finishButton.disabled = !this._completed;
    }

    if (!this._completed && answered > 0 && answered < TOTAL_QUESTIONS) {
      this._setStatus(`${correct} correct so far, ${answered - correct} to revisit. Keep an eye on the world tracker, not just the total score.`);
    }
  }

  _syncWorldCards() {
    const breakdown = countsByWorld(this._results);
    this._ui.worldCards.forEach(card => {
      const worldId = Number(card.getAttribute('data-world-id'));
      const world = breakdown.find(entry => entry.id === worldId);
      if (!world) return;

      card.dataset.worldState = worldStatus(world, this._completed, this._activeQuestionId);
      const score = card.querySelector(`[data-world-score="${worldId}"]`);
      if (score) {
        score.textContent = this._completed
          ? `${world.correct} / ${world.total}`
          : `${world.answered} / ${world.total}`;
      }
    });
  }

  _syncLedger() {
    this._ui.ledgerCards.forEach(card => {
      const questionId = card.getAttribute('data-question-id');
      const result = this._results.get(questionId);
      const status = card.querySelector(`[data-question-status="${questionId}"]`);

      if (result) {
        card.dataset.questionState = result.correct ? 'correct' : 'review';
        if (status) {
          status.textContent = result.correct ? 'Locked In' : 'Review';
        }
        return;
      }

      if (!this._completed && questionId === this._activeQuestionId) {
        card.dataset.questionState = 'active';
        if (status) {
          status.textContent = 'Current';
        }
        return;
      }

      card.dataset.questionState = 'pending';
      if (status) {
        status.textContent = 'Pending';
      }
    });
  }

  _setFeedback(message) {
    if (this._ui.feedback) {
      this._ui.feedback.textContent = message;
    }
  }

  _setStatus(message) {
    if (this._ui.status) {
      this._ui.status.textContent = message;
    }
  }
}
