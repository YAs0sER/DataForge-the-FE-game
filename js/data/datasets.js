/**
 * DataForge — datasets.js
 *
 * Central registry of deterministic dataset builders used across worlds.
 * The goal is to keep level modules focused on interaction logic rather than
 * row-by-row fixture construction.
 */

'use strict';

import { DataFrame } from '../pandas/dataframe.js';

export const DATASET_KEYS = Object.freeze({
  FOUNDATIONS_INTRO:    'foundations_intro',
  FOUNDATIONS_MESSY:    'foundations_messy',
  MISSING_HAND_CALC:    'missing_hand_calc',
  MISSING_CODE_FIX:     'missing_code_fix',
  OUTLIER_VISUAL:       'outlier_visual',
  OUTLIER_DEMO:         'outlier_demo',
  OUTLIER_CODE_FIX:     'outlier_code_fix',
  ENCODING_PRACTICE:    'encoding_practice',
  SCALING_PRACTICE:     'scaling_practice',
  FINAL_PIPELINE:       'final_pipeline',
});

const EDUCATION_LEVELS = ['Bac', 'Licence', 'Master', 'Doctorat'];
const CORE_CITIES = ['Casablanca', 'Rabat', 'Marrakech', 'Tangier', 'Fes', 'Agadir'];
const RARE_CITIES = ['Dakhla', 'Oujda', 'Tetouan', 'Kenitra'];

function createSeededRandom(seed = 17) {
  let state = seed >>> 0;
  return function next() {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pick(rand, values) {
  return values[Math.floor(rand() * values.length)];
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function frame(rows) {
  return DataFrame.fromRows(rows);
}

export function createFoundationsIntroDataset() {
  return frame([
    { Age: 24.5, Salary: 36000, City: 'Rabat',      Education_Level: 'Licence', Purchase_Date: isoDate(2025, 1, 14), Num_Children: 0 },
    { Age: 31.2, Salary: 52800, City: 'Casablanca', Education_Level: 'Master',  Purchase_Date: isoDate(2025, 2, 3),  Num_Children: 1 },
    { Age: 27.8, Salary: 47250, City: 'Marrakech',  Education_Level: 'Bac',     Purchase_Date: isoDate(2025, 2, 27), Num_Children: 0 },
    { Age: 38.1, Salary: 68900, City: 'Tangier',    Education_Level: 'Doctorat',Purchase_Date: isoDate(2025, 3, 19), Num_Children: 2 },
    { Age: 29.7, Salary: 45100, City: 'Agadir',     Education_Level: 'Licence', Purchase_Date: isoDate(2025, 4, 7),  Num_Children: 3 },
  ]);
}

export function createFoundationsMessyDataset() {
  return frame([
    { Age: 22, Salary: 2600,   City: 'Rabat',      Education_Level: 'Bac',      Purchase_Count: 1, Tenure_Months: 3,  Segment: 'Bronze', Join_Date: isoDate(2024, 1, 5)  },
    { Age: 26, Salary: 3150,   City: 'Casablanca', Education_Level: 'Licence',  Purchase_Count: 4, Tenure_Months: 8,  Segment: 'Silver', Join_Date: isoDate(2024, 2, 11) },
    { Age: null, Salary: 4200, City: 'Marrakech',  Education_Level: 'Master',   Purchase_Count: 3, Tenure_Months: 12, Segment: 'Silver', Join_Date: isoDate(2024, 2, 22) },
    { Age: 35, Salary: 5100,   City: 'Fes',        Education_Level: 'Doctorat', Purchase_Count: 6, Tenure_Months: 16, Segment: 'Gold',   Join_Date: isoDate(2024, 3, 2)  },
    { Age: 41, Salary: 5800,   City: 'Agadir',     Education_Level: 'Bac',      Purchase_Count: 2, Tenure_Months: 21, Segment: 'Bronze', Join_Date: isoDate(2024, 3, 19) },
    { Age: 29, Salary: 4700,   City: 'Tangier',    Education_Level: 'Licence',  Purchase_Count: 5, Tenure_Months: 13, Segment: 'Silver', Join_Date: isoDate(2024, 4, 6)  },
    { Age: 33, Salary: 999999, City: 'Kenitra',    Education_Level: 'Master',   Purchase_Count: 7, Tenure_Months: 18, Segment: 'Gold',   Join_Date: isoDate(2024, 4, 28) },
    { Age: 24, Salary: 3850,   City: 'Oujda',      Education_Level: 'Bac',      Purchase_Count: 2, Tenure_Months: 7,  Segment: 'Bronze', Join_Date: isoDate(2024, 5, 10) },
    { Age: 37, Salary: 6200,   City: 'Tetouan',    Education_Level: 'Doctorat', Purchase_Count: 8, Tenure_Months: 26, Segment: 'Gold',   Join_Date: isoDate(2024, 5, 30) },
    { Age: 28, Salary: 4400,   City: 'Dakhla',     Education_Level: 'Licence',  Purchase_Count: 4, Tenure_Months: 11, Segment: 'Silver', Join_Date: isoDate(2024, 6, 9)  },
    { Age: 45, Salary: 7100,   City: 'Rabat',      Education_Level: 'Master',   Purchase_Count: 9, Tenure_Months: 31, Segment: 'Gold',   Join_Date: isoDate(2024, 6, 25) },
    { Age: 31, Salary: 5000,   City: 'Casablanca', Education_Level: 'Licence',  Purchase_Count: 5, Tenure_Months: 14, Segment: 'Silver', Join_Date: isoDate(2024, 7, 14) },
  ]);
}

export function createMissingHandCalcDataset() {
  return frame([
    { Age: 25 },
    { Age: 30 },
    { Age: null },
    { Age: 28 },
    { Age: 35 },
    { Age: 22 },
  ]);
}

export function createMissingCodeFixDataset() {
  return frame([
    { Age: 23, Salary: 32000, City: 'Rabat',      Education_Level: 'Bac' },
    { Age: null, Salary: 41000, City: 'Casablanca', Education_Level: 'Licence' },
    { Age: 29, Salary: 47000, City: null,         Education_Level: 'Master' },
    { Age: 35, Salary: 55000, City: 'Fes',        Education_Level: 'Doctorat' },
    { Age: null, Salary: 36500, City: 'Agadir',   Education_Level: 'Licence' },
    { Age: 41, Salary: 92000, City: 'Rabat',      Education_Level: 'Master' },
    { Age: 26, Salary: 28000, City: null,         Education_Level: 'Bac' },
    { Age: 38, Salary: 61000, City: 'Tangier',    Education_Level: 'Master' },
    { Age: 24, Salary: 30000, City: 'Casablanca', Education_Level: 'Licence' },
    { Age: 53, Salary: 125000, City: 'Marrakech', Education_Level: 'Doctorat' },
    { Age: null, Salary: 45000, City: 'Fes',      Education_Level: 'Licence' },
    { Age: 32, Salary: 51000, City: 'Rabat',      Education_Level: 'Master' },
    { Age: 27, Salary: 34000, City: null,         Education_Level: 'Bac' },
    { Age: 44, Salary: 78000, City: 'Agadir',     Education_Level: 'Master' },
    { Age: 30, Salary: 39000, City: 'Casablanca', Education_Level: 'Licence' },
  ]);
}

export function createOutlierSeries() {
  return [21, 22, 22, 23, 24, 24, 25, 25, 26, 27, 28, 29, 31, 34, 89];
}

export function createOutlierVisualDataset() {
  const salaries = [
    2000, 2100, 2200, 2300, 2400, 2450, 2500, 2500,
    2550, 2600, 2700, 2800, 2900, 3000, 100000,
  ];

  return frame(salaries.map((value, index) => ({
    Analyst_ID: index + 1,
    Salary: value,
  })));
}

export function createOutlierDemoDataset() {
  return frame(createOutlierSeries().map((value, index) => ({
    Customer_ID: index + 1,
    Daily_Spend: value,
  })));
}

export function createOutlierCodeFixDataset() {
  return frame([
    { Customer_ID: 1,  Age: 23, Salary: 32000 },
    { Customer_ID: 2,  Age: 25, Salary: 34000 },
    { Customer_ID: 3,  Age: 27, Salary: 35500 },
    { Customer_ID: 4,  Age: 29, Salary: 36800 },
    { Customer_ID: 5,  Age: 31, Salary: 38200 },
    { Customer_ID: 6,  Age: 33, Salary: 39600 },
    { Customer_ID: 7,  Age: 35, Salary: 41000 },
    { Customer_ID: 8,  Age: 36, Salary: 42500 },
    { Customer_ID: 9,  Age: 37, Salary: 43800 },
    { Customer_ID: 10, Age: 38, Salary: 45200 },
    { Customer_ID: 11, Age: 39, Salary: 46600 },
    { Customer_ID: 12, Age: 40, Salary: 48000 },
    { Customer_ID: 13, Age: 41, Salary: 49500 },
    { Customer_ID: 14, Age: 42, Salary: 51000 },
    { Customer_ID: 15, Age: 43, Salary: 52800 },
    { Customer_ID: 16, Age: 44, Salary: 54600 },
    { Customer_ID: 17, Age: 28, Salary: 56500 },
    { Customer_ID: 18, Age: 32, Salary: 198000 },
    { Customer_ID: 19, Age: 79, Salary: 61200 },
    { Customer_ID: 20, Age: 34, Salary: 58900 },
  ]);
}

export function createEncodingPracticeDataset() {
  return frame([
    { City: 'Rabat',      Education_Level: 'Bac',      Satisfaction: 'Low',    Target: 0 },
    { City: 'Casablanca', Education_Level: 'Licence',  Satisfaction: 'Medium', Target: 1 },
    { City: 'Marrakech',  Education_Level: 'Master',   Satisfaction: 'High',   Target: 1 },
    { City: 'Rabat',      Education_Level: 'Licence',  Satisfaction: 'Low',    Target: 0 },
    { City: 'Agadir',     Education_Level: 'Doctorat', Satisfaction: 'High',   Target: 1 },
    { City: 'Fes',        Education_Level: 'Master',   Satisfaction: 'Medium', Target: 1 },
    { City: 'Dakhla',     Education_Level: 'Bac',      Satisfaction: 'Low',    Target: 0 },
    { City: 'Tangier',    Education_Level: 'Licence',  Satisfaction: 'Medium', Target: 1 },
    { City: 'Oujda',      Education_Level: 'Master',   Satisfaction: 'High',   Target: 1 },
    { City: 'Kenitra',    Education_Level: 'Bac',      Satisfaction: 'Low',    Target: 0 },
  ]);
}

export function createScalingPracticeDataset() {
  return frame([
    { Age: 18, Salary: 28000, Purchase_Count: 1 },
    { Age: 25, Salary: 34000, Purchase_Count: 2 },
    { Age: 30, Salary: 39000, Purchase_Count: 3 },
    { Age: 45, Salary: 52000, Purchase_Count: 7 },
    { Age: 60, Salary: 79000, Purchase_Count: 18 },
  ]);
}

export function createFinalPipelineDataset(rowCount = 100, seed = 42) {
  const rand = createSeededRandom(seed);
  const rows = [];

  for (let i = 0; i < rowCount; i++) {
    const ageBase = 22 + Math.floor(rand() * 34);
    const salaryBase = 26000 + Math.floor(rand() * 72000);
    const purchaseBase = Math.floor((rand() ** 3) * 42);

    rows.push({
      Age: round(ageBase + rand(), 1),
      Salary: salaryBase,
      City: pick(rand, CORE_CITIES),
      Education_Level: pick(rand, EDUCATION_LEVELS),
      Purchase_Count: purchaseBase,
      Join_Date: isoDate(2023 + Math.floor(rand() * 3), 1 + Math.floor(rand() * 12), 1 + Math.floor(rand() * 28)),
    });
  }

  // Inject the hidden problems used by the final pipeline level.
  [3, 9, 14, 22, 31, 38, 46, 51, 64, 72, 84, 93].forEach(i => { rows[i].Age = null; });
  [5, 18, 27, 35, 49, 68, 77, 96].forEach(i => { rows[i].City = null; });
  [12, 48, 87].forEach((i, idx) => { rows[i].Salary = 220000 + idx * 65000; });
  [7, 28, 54, 88].forEach((i, idx) => { rows[i].City = RARE_CITIES[idx]; });

  return frame(rows);
}

export const SAMPLE_SERIES = Object.freeze({
  salaries: Object.freeze([1200, 1700, 1800, 2400, 3100, 4200, 4800, 6200, 8200, 14500]),
  ages: Object.freeze([18, 25, 30, 45, 60]),
  skewedPurchases: Object.freeze([0, 1, 1, 2, 2, 3, 4, 7, 12, 24, 39]),
});

export const DATASET_BUILDERS = Object.freeze({
  [DATASET_KEYS.FOUNDATIONS_INTRO]: createFoundationsIntroDataset,
  [DATASET_KEYS.FOUNDATIONS_MESSY]: createFoundationsMessyDataset,
  [DATASET_KEYS.MISSING_HAND_CALC]: createMissingHandCalcDataset,
  [DATASET_KEYS.MISSING_CODE_FIX]: createMissingCodeFixDataset,
  [DATASET_KEYS.OUTLIER_VISUAL]: createOutlierVisualDataset,
  [DATASET_KEYS.OUTLIER_DEMO]: createOutlierDemoDataset,
  [DATASET_KEYS.OUTLIER_CODE_FIX]: createOutlierCodeFixDataset,
  [DATASET_KEYS.ENCODING_PRACTICE]: createEncodingPracticeDataset,
  [DATASET_KEYS.SCALING_PRACTICE]: createScalingPracticeDataset,
  [DATASET_KEYS.FINAL_PIPELINE]: createFinalPipelineDataset,
});

export function createDataset(key, options = {}) {
  const builder = DATASET_BUILDERS[key];
  if (!builder) {
    throw new Error(`Unknown dataset key "${key}".`);
  }
  return builder(options.rowCount, options.seed);
}
