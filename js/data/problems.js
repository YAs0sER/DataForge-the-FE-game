/**
 * DataForge — problems.js
 *
 * Structured content registry for worlds and levels.
 * Each entry describes the concept, objective, widget dependencies, and the
 * specific content payloads that future level modules will render.
 */

'use strict';

import { DATASET_KEYS } from './datasets.js';
import { t } from '../i18n.js';

function level(levelId, config) {
  return Object.freeze({ levelId, ...config });
}

export const WORLD_LEVELS = Object.freeze({
  1: Object.freeze([
    level(1, {
      slug: 'what-are-we-working-with',
      title: 'What Are We Working With?',
      type: 'dragdrop',
      objective: 'Classify each dataset column into the correct variable type bucket.',
      datasetKey: DATASET_KEYS.FOUNDATIONS_INTRO,
      widgets: ['datatable', 'dragdrop'],
      hints: [
        'Temporal features usually store a moment in time, even if they look like strings.',
        'A count such as number of children cannot take fractional values, so it belongs with discrete variables.',
      ],
    }),
    level(2, {
      slug: 'spot-the-problems',
      title: 'Spot the Problems',
      type: 'inspection',
      objective: 'Find the four common feature-engineering problems in the messy table.',
      datasetKey: DATASET_KEYS.FOUNDATIONS_MESSY,
      widgets: ['datatable'],
      hints: [
        'Look for an empty cell, a suspiciously huge value, and a column with too many distinct names.',
        'Scale issues are usually visible on numeric columns when one range dwarfs another.',
      ],
    }),
    level(3, {
      slug: 'build-the-pipeline',
      title: 'Build the Pipeline',
      type: 'ordering',
      objective: 'Arrange the preprocessing stations in the order a healthy data pipeline should follow.',
      widgets: ['dragdrop'],
      hints: [
        'Fix missing values before you compute anything that depends on the full numeric distribution.',
        'Encoding should happen before scaling, because scaling expects numeric features.',
      ],
      cards: [
        { id: 'cleaning-imputation', label: 'Cleaning & Imputation', icon: '🧹' },
        { id: 'outlier-treatment',   label: 'Outlier Treatment',     icon: '⚡' },
        { id: 'encoding',            label: 'Encoding',              icon: '🔢' },
        { id: 'scaling',             label: 'Scaling',               icon: '⚖️' },
      ],
    }),
    level(4, {
      slug: 'quick-check',
      title: 'Quick Check',
      type: 'mcq',
      objective: 'Review the foundations world before you unlock missing-data strategy.',
      widgets: ['mcq'],
      hints: [
        'If the answer describes order without arithmetic distance, think ordinal rather than numeric.',
        'The pipeline order stays the same even when some models do not need the final scaling step.',
      ],
      questions: [
        {
          id: 'variable-type',
          type: 'single',
          prompt: 'Which variable type best matches "number of purchases in the last 30 days"?',
          options: [
            { id: 'discrete', text: 'Numerical — Discrete', correct: true },
            { id: 'continuous', text: 'Numerical — Continuous', correct: false },
            { id: 'nominal', text: 'Categorical — Nominal', correct: false },
            { id: 'temporal', text: 'Temporal', correct: false },
          ],
          explanation: 'Counts are numeric, but they move in stepwise whole-number jumps.',
        },
        {
          id: 'nan-problem',
          type: 'single',
          prompt: 'A `NaN` inside a dataset usually signals which problem?',
          options: [
            { id: 'missing', text: 'Missing value', correct: true },
            { id: 'outlier', text: 'Outlier', correct: false },
            { id: 'encoding', text: 'Encoding issue', correct: false },
            { id: 'leakage', text: 'Data leakage', correct: false },
          ],
          explanation: '`NaN` represents absent information that must be handled before modeling.',
        },
        {
          id: 'ordering',
          type: 'single',
          prompt: 'Which preprocessing stage should happen immediately before encoding?',
          options: [
            { id: 'imputation', text: 'Cleaning & imputation', correct: false },
            { id: 'outliers', text: 'Outlier treatment', correct: true },
            { id: 'scaling', text: 'Scaling', correct: false },
            { id: 'evaluation', text: 'Model evaluation', correct: false },
          ],
          explanation: 'The course pipeline handles missing values first, then outliers, then encoding, then scaling.',
        },
        {
          id: 'trees-scaling',
          type: 'single',
          prompt: 'True or false: decision-tree models usually require feature scaling.',
          options: [
            { id: 'false', text: 'False', correct: true },
            { id: 'true', text: 'True', correct: false },
          ],
          explanation: 'Tree-based models split on thresholds, so they are much less sensitive to raw scale differences.',
        },
        {
          id: 'match-treatment',
          type: 'match',
          prompt: 'Match each problem to its most natural first treatment.',
          explanation: 'Good preprocessing pairs the observed issue with the least-destructive fix that keeps useful signal.',
          pairs: [
            {
              id: 'missing-values',
              prompt: 'Missing values',
              correct: 'Impute or add a missing category',
              options: [
                'Impute or add a missing category',
                'Scale the column',
                'One-hot encode immediately',
                'Drop the target variable',
              ],
            },
            {
              id: 'outliers',
              prompt: 'Extreme outliers',
              correct: 'Cap or remove the extremes',
              options: [
                'Cap or remove the extremes',
                'Convert dates to strings',
                'Duplicate the rare rows',
                'Use frequency encoding first',
              ],
            },
            {
              id: 'high-cardinality',
              prompt: 'High-cardinality categoricals',
              correct: 'Group rare categories before encoding',
              options: [
                'Group rare categories before encoding',
                'Standardize to mean 0',
                'Use median imputation',
                'Take the logarithm',
              ],
            },
            {
              id: 'scale-issue',
              prompt: 'Unequal numeric scales',
              correct: 'Apply a scaling method',
              options: [
                'Apply a scaling method',
                'Treat as missing values',
                'Convert to ordinal labels',
                'Shuffle the rows',
              ],
            },
          ],
        },
      ],
    }),
  ]),

  2: Object.freeze([
    level(1, {
      slug: 'why-is-it-missing',
      title: 'Why Is It Missing?',
      type: 'dragdrop',
      objective: 'Assign each scenario to MCAR, MAR, or MNAR.',
      widgets: ['dragdrop'],
      hints: ['Ask whether the probability of being missing depends on observed values, unobserved values, or neither.'],
    }),
    level(2, {
      slug: 'calculate-the-imputation',
      title: 'Calculate the Imputation',
      type: 'calculator',
      objective: 'Compute the correct mean and median imputations by hand.',
      datasetKey: DATASET_KEYS.MISSING_HAND_CALC,
      widgets: ['calculator'],
      hints: ['Ignore the missing entry when you sum, count, or sort the known values.'],
    }),
    level(3, {
      slug: 'choose-your-weapon',
      title: 'Choose Your Weapon',
      type: 'scenario-cards',
      objective: 'Pick the safest imputation strategy for each missing-data scenario.',
      widgets: ['mcq'],
      hints: ['Skewed numeric columns usually prefer median over mean.'],
    }),
    level(4, {
      slug: 'the-indicator-variable',
      title: 'The Indicator Variable',
      type: 'table-transform',
      objective: 'Impute a value and add a binary indicator that remembers it was missing.',
      widgets: ['datatable'],
      hints: ['The indicator column should be 1 only on rows that were originally missing.'],
    }),
    level(5, {
      slug: 'mcq-missing-data',
      title: 'MCQ — Missing Data',
      type: 'mcq',
      objective: 'Check your understanding of missing-data mechanisms and imputation choices.',
      widgets: ['mcq'],
      hints: ['Mechanism first, strategy second. A good imputation choice depends on both.'],
      questions: [
        {
          id: 'mechanism-match',
          type: 'match',
          prompt: 'Match each missing-data mechanism to the pattern that defines it.',
          explanation: 'The mechanism explains why values disappear, and that changes how cautious your repair strategy should be.',
          pairs: [
            {
              id: 'mcar',
              prompt: 'Values go missing for a random export glitch, unrelated to any feature.',
              correct: 'MCAR',
              options: ['MCAR', 'MAR', 'MNAR'],
            },
            {
              id: 'mar',
              prompt: 'Salary is more likely to be missing for customers in one observed region.',
              correct: 'MAR',
              options: ['MCAR', 'MAR', 'MNAR'],
            },
            {
              id: 'mnar',
              prompt: 'People with very high income avoid answering the income question itself.',
              correct: 'MNAR',
              options: ['MCAR', 'MAR', 'MNAR'],
            },
          ],
        },
        {
          id: 'indicator-formula',
          type: 'single',
          prompt: 'When should `Age_missing` equal 1?',
          options: [
            { id: 'original-gap', text: 'When the original Age value was missing before imputation', correct: true },
            { id: 'filled-value', text: 'When the filled Age value is above the median', correct: false },
            { id: 'numeric-column', text: 'Whenever the column is numeric', correct: false },
            { id: 'after-scaling', text: 'Only after the column has been scaled', correct: false },
          ],
          explanation: 'The indicator remembers the original gap. It is about past missingness, not about the repaired value itself.',
        },
        {
          id: 'skewed-strategy',
          type: 'single',
          prompt: 'A Salary column is heavily right-skewed because a few executives earn far more than everyone else. Which fill is usually safer?',
          options: [
            { id: 'median', text: 'Median imputation', correct: true },
            { id: 'mean', text: 'Mean imputation', correct: false },
            { id: 'mode', text: 'Mode imputation', correct: false },
            { id: 'onehot', text: 'One-hot encoding first', correct: false },
          ],
          explanation: 'Median resists the pull of extreme high salaries, while the mean gets dragged toward the outliers.',
        },
        {
          id: 'indicator-truefalse',
          type: 'single',
          prompt: 'True or false: after you impute a value, a missing-indicator column can still be useful.',
          options: [
            { id: 'true', text: 'True', correct: true },
            { id: 'false', text: 'False', correct: false },
          ],
          explanation: 'Imputation repairs the numeric gap, but the model may still learn from knowing which rows were originally incomplete.',
        },
        {
          id: 'scenario-judgment',
          type: 'single',
          prompt: 'Blank `Promo_Code` values usually mean "no promotion used." Which treatment best preserves that business meaning?',
          options: [
            { id: 'missing-label', text: 'Keep an explicit missing label or indicator', correct: true },
            { id: 'mode-fill', text: 'Fill with the most common promo code', correct: false },
            { id: 'median-fill', text: 'Fill with the column median', correct: false },
            { id: 'drop-rows', text: 'Drop every row with a blank code', correct: false },
          ],
          explanation: 'Here the blank itself is informative, so you want to preserve that absence instead of hiding it inside a frequent category.',
        },
        {
          id: 'repair-order',
          type: 'single',
          prompt: 'Which missing-data workflow order is the healthiest?',
          options: [
            { id: 'inspect-then-fix', text: 'Inspect nulls -> diagnose type/mechanism -> impute or preserve signal -> add indicator if useful', correct: true },
            { id: 'scale-first', text: 'Add indicator -> scale the column -> diagnose mechanism -> impute later', correct: false },
            { id: 'impute-blind', text: 'Impute immediately -> inspect later -> encode -> ignore the mechanism', correct: false },
            { id: 'drop-immediately', text: 'Drop the whole feature -> normalize the dataset -> backfill manually', correct: false },
          ],
          explanation: 'Healthy preprocessing inspects first, chooses a repair from type and mechanism, then preserves missingness signal when it matters.',
        },
      ],
    }),
    level(6, {
      slug: 'code-fix-imputation',
      title: 'Code Fix — Imputation',
      type: 'code',
      objective: 'Use pandas-like commands to clean a dataset with missing numeric and categorical features.',
      datasetKey: DATASET_KEYS.MISSING_CODE_FIX,
      widgets: ['datatable', 'editor'],
      hints: ['Use median on skewed numeric data, a text category like "Missing" for categoricals, and an indicator column when absence might carry signal.'],
      reference: [
        "df.info()",
        "df.isnull().sum()",
        "df['col'].fillna(value)",
        "df['col'].fillna(df['col'].mean())",
        "df['col'].fillna(df['col'].median())",
        "df['col'].fillna('Missing')",
        "df['col_missing'] = df['col'].isnull().astype(int)",
      ],
      tasks: [
        { id: 'age-median', label: 'Fix missing Age values (skewed distribution)' },
        { id: 'city-fill', label: 'Fix missing City values (categorical)' },
        { id: 'age-indicator', label: 'Add missing indicator for Age' },
      ],
    }),
  ]),

  3: Object.freeze([
    level(1, { slug: 'see-the-outlier', title: 'See the Outlier', type: 'chart', objective: 'Spot the rogue point visually before formulas enter the scene.', datasetKey: DATASET_KEYS.OUTLIER_VISUAL, widgets: ['charts'], hints: ['Outliers are about isolation relative to the rest of the distribution.'] }),
    level(2, { slug: 'iqr-by-hand', title: 'IQR by Hand', type: 'calculator', objective: 'Compute quartiles, IQR, and the lower/upper fences manually.', datasetKey: DATASET_KEYS.OUTLIER_VISUAL, widgets: ['calculator'], hints: ['Sort first, then find Q1 and Q3 before you compute the fence.'] }),
    level(3, { slug: 'z-score-method', title: 'The Z-Score Method', type: 'calculator', objective: 'Use mean, standard deviation, and |z| > 3 to flag the extreme salary.', datasetKey: DATASET_KEYS.OUTLIER_VISUAL, widgets: ['calculator', 'charts'], hints: ['A z-score beyond ±3 is a common outlier warning line.'] }),
    level(4, { slug: 'cap-or-cut', title: 'What Do We Do With It?', type: 'scenario-cards', objective: 'Choose whether to suppress, cap, or log-transform outliers in each context.', datasetKey: DATASET_KEYS.OUTLIER_DEMO, widgets: ['datatable', 'charts'], hints: ['If the point is a real but extreme observation, capping often preserves more data.'] }),
    level(5, {
      slug: 'mcq-outliers',
      title: 'MCQ - Outliers',
      type: 'mcq',
      objective: 'Review the main outlier concepts before the code level.',
      widgets: ['mcq'],
      hints: ['IQR and z-score solve the same problem with different assumptions.'],
      questions: [
        {
          id: 'iqr-formula',
          type: 'single',
          prompt: 'Which formula gives the interquartile range?',
          options: [
            { id: 'q3-minus-q1', text: 'IQR = Q3 - Q1', correct: true },
            { id: 'q3-plus-q1', text: 'IQR = Q3 + Q1', correct: false },
            { id: 'median-minus-q1', text: 'IQR = median - Q1', correct: false },
            { id: 'max-minus-min', text: 'IQR = max - min', correct: false },
          ],
          explanation: 'IQR measures the spread of the middle 50 percent, so it is the distance from Q1 to Q3.',
        },
        {
          id: 'zscore-formula',
          type: 'single',
          prompt: 'Which expression computes the z score for a value x?',
          options: [
            { id: 'x-minus-mu-over-sigma', text: 'z = (x - mu) / sigma', correct: true },
            { id: 'mu-minus-x-over-sigma', text: 'z = (mu - x) / sigma', correct: false },
            { id: 'x-over-mu', text: 'z = x / mu', correct: false },
            { id: 'x-minus-q3-over-iqr', text: 'z = (x - Q3) / IQR', correct: false },
          ],
          explanation: 'A z score measures how many standard deviations a value sits away from the mean.',
        },
        {
          id: 'treatment-match',
          type: 'match',
          prompt: 'Match each outlier scenario to the safest first treatment.',
          explanation: 'The best treatment depends on whether the extreme point is wrong, merely too influential, or part of a wider skewed feature.',
          pairs: [
            {
              id: 'logging-bug',
              prompt: 'The extreme row came from a duplicated checkout event and the record is confirmed broken.',
              correct: 'Suppress it',
              options: ['Suppress it', 'Cap it', 'Log-transform the full feature'],
            },
            {
              id: 'vip-customer',
              prompt: 'The whale customer is real, but one row should not dominate the model.',
              correct: 'Cap it',
              options: ['Suppress it', 'Cap it', 'Log-transform the full feature'],
            },
            {
              id: 'persistent-skew',
              prompt: 'All values are plausible, but the whole feature keeps a long right tail.',
              correct: 'Log-transform the full feature',
              options: ['Suppress it', 'Cap it', 'Log-transform the full feature'],
            },
          ],
        },
        {
          id: 'linear-vs-tree',
          type: 'single',
          prompt: 'If one extreme salary stays untreated, which model family is usually more sensitive to it?',
          options: [
            { id: 'linear', text: 'Linear or distance-based models', correct: true },
            { id: 'tree', text: 'Tree-based models only', correct: false },
            { id: 'none', text: 'Neither family is affected', correct: false },
            { id: 'all-same', text: 'Both families are affected in exactly the same way', correct: false },
          ],
          explanation: 'Linear and distance-based models can be pulled strongly by extreme scale, while tree models are often less sensitive because they split on thresholds.',
        },
        {
          id: 'boxplot-reading',
          type: 'single',
          prompt: 'A boxplot ends its upper whisker at 36 and shows one separate point at 89. What does that point most likely represent?',
          options: [
            { id: 'outlier', text: 'An outlier beyond the upper fence', correct: true },
            { id: 'median', text: 'The median of the dataset', correct: false },
            { id: 'q3', text: 'The third quartile', correct: false },
            { id: 'missing', text: 'A missing value marker', correct: false },
          ],
          explanation: 'In a boxplot, isolated points beyond the whiskers represent observations that fall outside the normal fence range.',
        },
        {
          id: 'skew-method-choice',
          type: 'single',
          prompt: 'When a numeric feature is heavily right-skewed rather than nearly normal, which outlier rule is usually safer?',
          options: [
            { id: 'iqr', text: 'The IQR rule', correct: true },
            { id: 'zscore', text: 'The z-score rule only', correct: false },
            { id: 'mean-only', text: 'Comparing each value to the mean only', correct: false },
            { id: 'drop-largest', text: 'Dropping the single largest value by default', correct: false },
          ],
          explanation: 'IQR is usually safer on skewed distributions because it depends on quartiles rather than the mean and standard deviation that the extreme point can distort.',
        },
      ],
    }),
    level(6, { slug: 'code-fix-outliers', title: 'Code Fix - Outliers', type: 'code', objective: 'Inspect a dataset and cap or remove outliers with pandas-like commands.', datasetKey: DATASET_KEYS.OUTLIER_CODE_FIX, widgets: ['datatable', 'editor', 'charts'], hints: ['Use describe, quantiles, and clipping together so you can justify the treatment you choose.'] }),
  ]),

  4: Object.freeze([
    level(1, { slug: 'the-one-hot-grid', title: 'The One-Hot Grid', type: 'table-transform', objective: 'Manually build a one-hot encoded matrix from a City column.', widgets: ['datatable'], hints: ['Each row should end with exactly one 1 and the rest 0.'] }),
    level(2, { slug: 'label-hidden-danger', title: 'Label Encoding - The Hidden Danger', type: 'dragdrop', objective: 'Assign numeric labels, reveal the fake-order trap, then use label encoding on a truly ordered scale.', widgets: ['dragdrop'], hints: ['Any unique 0-3 mapping works for the first column, which is exactly why the danger appears later.'] }),
    level(3, { slug: 'frequency-encoding', title: 'Frequency Encoding', type: 'table-transform', objective: 'Count category frequencies and encode each row with ni / N.', widgets: ['charts'], hints: ['Frequency encoding replaces each category with how often it appears in the column.'] }),
    level(4, { slug: 'taming-high-cardinality', title: 'Taming High Cardinality', type: 'chart', objective: 'Identify rare categories and group them into "Autres" before one-hot encoding.', datasetKey: DATASET_KEYS.ENCODING_PRACTICE, widgets: ['charts'], hints: ['A high-cardinality column creates one one-hot column per distinct category unless you group the rare ones first.'] }),
    level(5, { slug: 'which-encoding-when', title: 'Which Encoding When?', type: 'dragdrop', objective: 'Match each variable/model pair to the safest encoding method.', widgets: ['dragdrop'], hints: ['Model assumptions matter as much as the variable type.'] }),
    level(6, {
      slug: 'mcq-encoding',
      title: 'MCQ - Encoding',
      type: 'mcq',
      objective: 'Review encoding tradeoffs, risks, and formulas.',
      widgets: ['mcq'],
      hints: [
        'One-hot is safe but expensive; label is compact but can imply fake order.',
        'Frequency encoding uses ni / N, not the raw count alone.',
      ],
      questions: [
        {
          id: 'onehot-width',
          type: 'single',
          prompt: 'A `City` column has 5 distinct categories. Before dropping any reference column, how many one-hot columns does it create?',
          options: [
            { id: 'five', text: '5 columns', correct: true },
            { id: 'four', text: '4 columns', correct: false },
            { id: 'one', text: '1 column', correct: false },
            { id: 'ten', text: '10 columns', correct: false },
          ],
          explanation: 'One-hot encoding creates one binary column per distinct category unless you intentionally drop one later.',
        },
        {
          id: 'label-risk',
          type: 'single',
          prompt: 'Why is plain label encoding risky for a nominal feature like `Color` when used with linear regression?',
          options: [
            { id: 'fake-order', text: 'The model may read the integer codes as a fake order or distance', correct: true },
            { id: 'too-wide', text: 'It always creates too many columns', correct: false },
            { id: 'kills-missing', text: 'It removes missing-value information automatically', correct: false },
            { id: 'needs-iqr', text: 'It only works after IQR outlier clipping', correct: false },
          ],
          explanation: 'Nominal labels have no rank, so integer codes can trick linear models into seeing order where none exists.',
        },
        {
          id: 'frequency-formula',
          type: 'single',
          prompt: 'A category appears 8 times in a dataset of 40 rows. What frequency-encoding value should it receive?',
          options: [
            { id: '0-2', text: '0.2', correct: true },
            { id: '0-8', text: '0.8', correct: false },
            { id: '8', text: '8', correct: false },
            { id: '5', text: '5', correct: false },
          ],
          explanation: 'Frequency encoding uses ni / N, so 8 divided by 40 gives 0.2.',
        },
        {
          id: 'cardinality-definition',
          type: 'single',
          prompt: 'What does high cardinality mean for a categorical feature?',
          options: [
            { id: 'many-unique', text: 'It has many unique categories relative to the dataset size', correct: true },
            { id: 'two-values', text: 'It has only two possible values', correct: false },
            { id: 'alphabetical', text: 'Its values are sorted alphabetically', correct: false },
            { id: 'mostly-missing', text: 'Most rows are missing that feature', correct: false },
          ],
          explanation: 'High cardinality means the feature vocabulary is large, which can make one-hot expansion sparse and expensive.',
        },
        {
          id: 'rare-category-handling',
          type: 'single',
          prompt: 'A `Postal_Code` column has hundreds of labels, and most appear only once. What is the healthiest step before one-hot expansion?',
          options: [
            { id: 'group-rare', text: 'Group the rare labels into an `Autres` or `Other` bucket', correct: true },
            { id: 'alphabetical-labels', text: 'Label encode them alphabetically', correct: false },
            { id: 'standardize-codes', text: 'Standardize the postal codes to mean 0', correct: false },
            { id: 'drop-frequent', text: 'Drop only the most frequent postal code', correct: false },
          ],
          explanation: 'Grouping rare categories shrinks the one-hot matrix while keeping the common categories explicit.',
        },
        {
          id: 'method-match',
          type: 'match',
          prompt: 'Match each feature-model pair to the safest encoding choice.',
          explanation: 'The safest encoding depends on both the category structure and what the model is likely to misread or overpay for.',
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
        },
      ],
    }),
    level(7, {
      slug: 'code-fix-encoding',
      title: 'Code Fix - Encoding',
      type: 'code',
      objective: 'Group rare categories and encode nominal and ordinal columns correctly.',
      datasetKey: DATASET_KEYS.ENCODING_PRACTICE,
      widgets: ['datatable', 'editor'],
      hints: [
        'Use value_counts(normalize=True) first so you can see which labels are singletons and which one survives the rare-category threshold.',
        'In this lab helper, df[\'City\'] = df[\'City\'].replace(0.15, \'Autres\') groups labels below 15 percent frequency into Autres.',
        'Keep Satisfaction as one ordered numeric column, then one-hot encode the grouped City column after the rare labels are merged.',
      ],
      reference: [
        'df.head()',
        "df['City'].value_counts(normalize=True)",
        "df['City'] = df['City'].replace(0.15, 'Autres')",
        "df['Satisfaction'] = df['Satisfaction'].map({'Low': 0, 'Medium': 1, 'High': 2})",
        "df = pd.get_dummies(df, columns=['City'])",
      ],
      tasks: [
        { id: 'group-rare-city', label: 'Group rare City labels into Autres before one-hot expansion' },
        { id: 'label-satisfaction', label: 'Label encode Satisfaction while keeping Low < Medium < High' },
        { id: 'onehot-city', label: 'One-hot encode the grouped City column into the compact dummy block' },
      ],
    }),
  ]),

  5: Object.freeze([
    level(1, { slug: 'the-scale-problem', title: 'The Scale Problem', type: 'chart', objective: 'See why unequal scales distort distance-based algorithms.', datasetKey: DATASET_KEYS.SCALING_PRACTICE, widgets: ['charts'], hints: ['Look for the feature whose raw units dominate the distance calculation.'] }),
    level(2, { slug: 'min-max-in-your-hands', title: 'Min-Max in Your Hands', type: 'calculator', objective: 'Normalize a bounded feature into the 0–1 interval.', datasetKey: DATASET_KEYS.SCALING_PRACTICE, widgets: ['calculator', 'charts'], hints: ['You need the column minimum and maximum before any cell can be scaled.'] }),
    level(3, { slug: 'z-score-standardization', title: 'Z-Score Standardization', type: 'calculator', objective: 'Center a feature on its mean and scale it by standard deviation.', datasetKey: DATASET_KEYS.SCALING_PRACTICE, widgets: ['calculator', 'charts'], hints: ['Standardization is about relative distance from the mean, not just range.'] }),
    level(4, { slug: 'log-transform-taming-the-skew', title: 'Log Transform — Taming the Skew', type: 'chart', objective: 'Compress a heavy right tail with log(x + 1).', widgets: ['charts'], hints: ['Log transform is most useful when a few huge values stretch the axis.'] }),
    level(5, { slug: 'which-scaling-for-which-model', title: 'Which Scaling for Which Model?', type: 'dragdrop', objective: 'Match algorithms to MinMax, standardization, or no scaling.', widgets: ['dragdrop'], hints: ['Distance-based and gradient-based models care most about feature scale.'] }),
    level(6, {
      slug: 'mcq-scaling',
      title: 'MCQ — Scaling',
      type: 'mcq',
      objective: 'Review scaling formulas, model compatibility, and log-transform intuition.',
      widgets: ['mcq'],
      hints: [
        'The right transformation depends on both the model and the distribution shape.',
        'Distance-based models usually care most about raw range domination, while tree models usually do not need scaling at all.',
      ],
      questions: [
        {
          id: 'minmax-formula',
          type: 'single',
          prompt: 'Which formula maps a feature into the 0 to 1 interval?',
          options: [
            { id: 'zero-one', text: "x' = (x - min) / (max - min)", correct: true },
            { id: 'mean-sigma', text: "x' = (x - mean) / sigma", correct: false },
            { id: 'log1p', text: "x' = log(x + 1)", correct: false },
            { id: 'raw-divide-max', text: "x' = x / max", correct: false },
          ],
          explanation: 'MinMax scaling subtracts the column minimum, then divides by the full range so the smallest value becomes 0 and the largest becomes 1.',
        },
        {
          id: 'zscore-formula',
          type: 'single',
          prompt: 'Which expression computes a z score for a value x?',
          options: [
            { id: 'x-minus-mean-over-sigma', text: 'z = (x - mean) / sigma', correct: true },
            { id: 'x-minus-min-over-range', text: 'z = (x - min) / (max - min)', correct: false },
            { id: 'sigma-over-x-minus-mean', text: 'z = sigma / (x - mean)', correct: false },
            { id: 'x-over-mean', text: 'z = x / mean', correct: false },
          ],
          explanation: 'A z score measures how many standard deviations a value sits above or below the mean.',
        },
        {
          id: 'scaling-choice',
          type: 'single',
          prompt: 'You are training KNN on Age (18–60) and Salary (1000–80000). Which first move is healthiest when you want both axes to contribute on a shared bounded range?',
          options: [
            { id: 'minmax', text: 'Apply MinMax scaling to the numeric features', correct: true },
            { id: 'zscore', text: 'Apply Z-score only because bounded ranges never matter', correct: false },
            { id: 'noscale', text: 'Leave both features unscaled because KNN is threshold-based', correct: false },
            { id: 'onehot', text: 'One-hot encode the numeric columns first', correct: false },
          ],
          explanation: 'KNN is distance-based, so MinMax is a healthy first choice when you specifically want every feature living on a shared 0 to 1 scale.',
        },
        {
          id: 'log-use-case',
          type: 'single',
          prompt: 'Which feature is the best candidate for `log(x + 1)`?',
          options: [
            { id: 'purchase-count', text: 'Purchase_Count with a heavy right tail and many small values', correct: true },
            { id: 'already-normal-age', text: 'Age, which is already close to a normal bell shape', correct: false },
            { id: 'binary-flag', text: 'A 0 or 1 missing-indicator column', correct: false },
            { id: 'ordered-rating', text: 'An ordinal satisfaction label encoded as 0, 1, 2', correct: false },
          ],
          explanation: 'Log transform is healthiest when a valid numeric feature has a long right tail that needs compression without deleting rows.',
        },
        {
          id: 'linear-impact',
          type: 'single',
          prompt: 'Why can scaling help linear regression, especially when regularization is involved?',
          options: [
            { id: 'fair-regularization', text: 'Because coefficients and penalties become more comparable when the input features share a similar scale', correct: true },
            { id: 'turns-linear-into-tree', text: 'Because scaling turns linear regression into a threshold-based tree model', correct: false },
            { id: 'removes-missing', text: 'Because scaling automatically repairs missing numeric values', correct: false },
            { id: 'guarantees-causality', text: 'Because scaling guarantees the learned coefficients become causal effects', correct: false },
          ],
          explanation: 'When raw units are wildly different, regularization can punish some coefficients unfairly. Scaling makes the comparison between coefficients more balanced.',
        },
        {
          id: 'zscore-calc',
          type: 'single',
          prompt: 'A value x = 30 sits in a column with mean = 20 and sigma = 5. What is its z score?',
          options: [
            { id: 'two', text: '2', correct: true },
            { id: 'minus-two', text: '-2', correct: false },
            { id: 'half', text: '0.5', correct: false },
            { id: 'ten', text: '10', correct: false },
          ],
          explanation: 'First center the value: 30 - 20 = 10. Then divide by sigma 5, which gives a z score of 2.',
        },
      ],
    }),
    level(7, { slug: 'code-fix-scaling', title: 'Code Fix — Scaling', type: 'code', objective: 'Normalize, standardize, and log-transform the right features in the same dataset.', datasetKey: DATASET_KEYS.SCALING_PRACTICE, widgets: ['datatable', 'editor', 'charts'], hints: ['Choose the transformation by data shape and model need, not by habit.'] }),
  ]),

  6: Object.freeze([
    level(1, { slug: 'assemble-the-factory', title: 'Assemble the Factory', type: 'ordering', objective: 'Place each preprocessing station in the correct end-to-end pipeline slot.', widgets: ['dragdrop'], hints: ['The factory is just the world-1 pipeline with higher stakes.'] }),
    level(2, { slug: 'the-data-leakage-trap', title: 'The Data Leakage Trap', type: 'mcq', objective: 'Judge which workflows are safe and which leak test information backwards.', widgets: ['mcq'], hints: ['Fit on train. Transform both. Repeat that rule until it feels automatic.'] }),
    level(3, { slug: 'pipeline-builder-full-run', title: 'Pipeline Builder — Full Run', type: 'table-transform', objective: 'Apply the full sequence of preprocessing decisions to a small messy dataset.', widgets: ['datatable', 'dragdrop', 'charts'], hints: ['Think stage by stage and keep a record of what each transformation changes.'] }),
    level(4, { slug: 'full-mcq-all-worlds', title: 'Full MCQ — All Worlds', type: 'mcq', objective: 'Review the complete feature-engineering curriculum in one challenge set.', widgets: ['mcq'], hints: ['If you are unsure, classify the problem first, then choose the treatment.'] }),
    level(5, {
      slug: 'the-real-dataset',
      title: 'The Real Dataset',
      type: 'code',
      objective: 'Discover and fix every hidden issue in a 100-row production-style dataset.',
      datasetKey: DATASET_KEYS.FINAL_PIPELINE,
      widgets: ['datatable', 'editor', 'charts'],
      hints: [
        'Start with df.isnull().sum(), df.describe(), df[\'City\'].value_counts(normalize=True), and df.dtypes so the hidden issue cards reveal themselves before you mutate the table.',
        'Age wants a median repair at 36.4, City wants the explicit Missing label, and Salary should be clipped to the IQR upper fence before you standardize it.',
        'Group only the four 1% city labels into Autres, then one-hot encode City. Finish by standardizing both Age and Salary so they share mean 0 and std 1.',
      ],
      reference: [
        'df.head()',
        'df.isnull().sum()',
        'df.describe()',
        "df['City'].value_counts(normalize=True)",
        'df.dtypes',
        "df['Age'] = df['Age'].fillna(df['Age'].median())",
        "df['City'] = df['City'].fillna('Missing')",
        "Q1 = df['Salary'].quantile(0.25)",
        "Q3 = df['Salary'].quantile(0.75)",
        'IQR = Q3 - Q1',
        'lower = Q1 - 1.5 * IQR',
        'upper = Q3 + 1.5 * IQR',
        "df['Salary'] = df['Salary'].clip(lower, upper)",
        "df['City'] = df['City'].replace(0.05, 'Autres')",
        "df = pd.get_dummies(df, columns=['City'])",
        "df['Age'] = StandardScaler().fit_transform(df[['Age']])",
        "df['Salary'] = StandardScaler().fit_transform(df[['Salary']])",
      ],
      tasks: [
        { id: 'age-null', label: 'Repair Age with median imputation before scaling' },
        { id: 'city-null', label: 'Repair City with an explicit Missing category' },
        { id: 'salary-outlier', label: 'Cap the Salary spikes at the IQR fences while keeping every row' },
        { id: 'rare-city', label: 'Group the four rare City labels into Autres' },
        { id: 'city-encode', label: 'One-hot encode the grouped City column into the final dummy block' },
        { id: 'scale-balance', label: 'Standardize both Age and Salary after the repairs land' },
      ],
    }),
  ]),
});

export function getWorldLevels(worldId) {
  return WORLD_LEVELS[worldId] ?? [];
}

export function getLevelProblem(worldId, levelId) {
  const problem = getWorldLevels(worldId).find(level => level.levelId === levelId) ?? null;
  return problem ? localizeProblem(problem) : null;
}

export function allProblems() {
  return Object.entries(WORLD_LEVELS).flatMap(([worldId, levels]) =>
    levels.map(levelDef => localizeProblem({ worldId: Number(worldId), ...levelDef }))
  );
}

const LOCALIZED_STRING_KEYS = new Set([
  'title',
  'objective',
  'hints',
  'label',
  'options',
  'prompt',
  'text',
  'explanation',
  'correct',
  'chapter',
  'subtitle',
  'copy',
  'success',
  'lockedCopy',
  'emptyCopy',
  'headline',
]);

const SKIP_LOCALIZATION_KEYS = new Set([
  'id',
  'slug',
  'type',
  'datasetKey',
  'widgets',
  'reference',
  'icon',
]);

function localizeProblemValue(value, key = '') {
  if (Array.isArray(value)) {
    if (SKIP_LOCALIZATION_KEYS.has(key)) return value.slice();
    return value.map(item => localizeProblemValue(item, key));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [entryKey, localizeProblemValue(entryValue, entryKey)])
    );
  }

  if (typeof value !== 'string') return value;
  if (SKIP_LOCALIZATION_KEYS.has(key)) return value;
  if (!LOCALIZED_STRING_KEYS.has(key)) return value;

  return t(value);
}

function localizeProblem(problem) {
  return localizeProblemValue(problem);
}
