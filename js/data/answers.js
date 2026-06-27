/**
 * DataForge — answers.js
 *
 * Reusable validators for the interaction and code levels.
 * These are intentionally generic so future worlds can compose them instead of
 * hard-coding one-off checks inside level modules.
 */

'use strict';

import { DataFrame, isMissing } from '../pandas/dataframe.js';

export function approxEqual(a, b, tolerance = 0.1) {
  if (typeof a !== 'number' || typeof b !== 'number') return false;
  return Math.abs(a - b) <= tolerance;
}

export function valuesApproxEqual(actual, expected, tolerance = 0.1) {
  if (!Array.isArray(actual) || !Array.isArray(expected) || actual.length !== expected.length) {
    return false;
  }
  return actual.every((value, index) => approxEqual(value, expected[index], tolerance));
}

export function validatePlacementMap(placements, expectedByZone) {
  for (const [zoneId, expected] of Object.entries(expectedByZone)) {
    const expectedIds = Array.isArray(expected) ? expected : [expected];
    const actualIds = Object.entries(placements)
      .filter(([, actualZoneId]) => actualZoneId === zoneId)
      .map(([tokenId]) => tokenId)
      .sort();

    if (actualIds.length !== expectedIds.length) return false;
    const normalizedExpected = [...expectedIds].sort();
    for (let i = 0; i < normalizedExpected.length; i++) {
      if (actualIds[i] !== normalizedExpected[i]) return false;
    }
  }
  return true;
}

export function validateOrderedPlacement(placements, orderedTokenIds) {
  return orderedTokenIds.every((tokenId, index) => placements[tokenId] === `slot-${index + 1}`);
}

export function validateFilledMissingValues(df, colName, expectedValue, tolerance = 0.1) {
  if (!(df instanceof DataFrame)) return false;
  const series = df.col(colName);
  return series.values.every(value =>
    !isMissing(value) && (typeof expectedValue === 'number' ? approxEqual(value, expectedValue, tolerance) : value === expectedValue)
  );
}

export function validateIndicatorColumn(df, sourceCol, indicatorCol) {
  if (!(df instanceof DataFrame)) return false;
  const source = df.col(sourceCol).values;
  const indicator = df.col(indicatorCol).values;
  if (source.length !== indicator.length) return false;

  return indicator.every((value, index) => {
    const expected = isMissing(source[index]) ? 1 : 0;
    return value === expected;
  });
}

export function validateOneHotColumns(df, prefix, expectedCategories) {
  if (!(df instanceof DataFrame)) return false;
  const expectedCols = expectedCategories.map(category => `${prefix}_${category}`);
  return expectedCols.every(col => df.columns.includes(col));
}

export function validateGroupedRareValues(df, colName, replacement = 'Autres') {
  if (!(df instanceof DataFrame)) return false;
  return df.col(colName).values.includes(replacement);
}

export function validateScaledRange(df, colName, min = 0, max = 1, tolerance = 1e-6) {
  if (!(df instanceof DataFrame)) return false;
  const values = df.col(colName).values.filter(value => !isMissing(value));
  if (!values.length) return false;

  const actualMin = Math.min(...values);
  const actualMax = Math.max(...values);
  return approxEqual(actualMin, min, tolerance) && approxEqual(actualMax, max, tolerance);
}

export function validateStandardizedColumn(df, colName, meanTolerance = 0.1, stdTolerance = 0.1) {
  if (!(df instanceof DataFrame)) return false;
  const series = df.col(colName);
  return approxEqual(series.mean(), 0, meanTolerance) && approxEqual(series.std(), 1, stdTolerance);
}

export function validateLogTransform(df, originalValues, transformedCol, tolerance = 1e-6) {
  if (!(df instanceof DataFrame) || !Array.isArray(originalValues)) return false;
  const actual = df.col(transformedCol).values;
  if (actual.length !== originalValues.length) return false;

  return actual.every((value, index) => approxEqual(value, Math.log1p(originalValues[index]), tolerance));
}

export function buildTaskValidators(taskDefs) {
  return taskDefs.map(task => ({
    label: task.label,
    validate: task.validate,
  }));
}
