import { RPEFormula, RPECalculationResult } from '@/lib/types';

/**
 * RPE-based 1RM calculation formulas
 * Based on Mike Tuchscherer's RPE chart and traditional 1RM formulas
 */

// RPE to percentage mapping (Tuchscherer RPE Chart)
const RPE_PERCENTAGES: Record<number, Record<number, number>> = {
  1: { 10: 100, 9.5: 97.8, 9: 95.5, 8.5: 93.9, 8: 92.2, 7.5: 90.7, 7: 89.2, 6.5: 87.8, 6: 86.3 },
  2: { 10: 95.5, 9.5: 93.9, 9: 92.2, 8.5: 90.7, 8: 89.2, 7.5: 87.8, 7: 86.3, 6.5: 85.0, 6: 83.7 },
  3: { 10: 92.2, 9.5: 90.7, 9: 89.2, 8.5: 87.8, 8: 86.3, 7.5: 85.0, 7: 83.7, 6.5: 82.4, 6: 81.1 },
  4: { 10: 89.2, 9.5: 87.8, 9: 86.3, 8.5: 85.0, 8: 83.7, 7.5: 82.4, 7: 81.1, 6.5: 79.9, 6: 78.6 },
  5: { 10: 86.3, 9.5: 85.0, 9: 83.7, 8.5: 82.4, 8: 81.1, 7.5: 79.9, 7: 78.6, 6.5: 77.4, 6: 76.2 },
  6: { 10: 83.7, 9.5: 82.4, 9: 81.1, 8.5: 79.9, 8: 78.6, 7.5: 77.4, 7: 76.2, 6.5: 75.1, 6: 73.9 },
  7: { 10: 81.1, 9.5: 79.9, 9: 78.6, 8.5: 77.4, 8: 76.2, 7.5: 75.1, 7: 73.9, 6.5: 72.8, 6: 71.7 },
  8: { 10: 78.6, 9.5: 77.4, 9: 76.2, 8.5: 75.1, 8: 73.9, 7.5: 72.8, 7: 71.7, 6.5: 70.7, 6: 69.6 },
  9: { 10: 76.2, 9.5: 75.1, 9: 73.9, 8.5: 72.8, 8: 71.7, 7.5: 70.7, 7: 69.6, 6.5: 68.6, 6: 67.6 },
  10: { 10: 73.9, 9.5: 72.8, 9: 71.7, 8.5: 70.7, 8: 69.6, 7.5: 68.6, 7: 67.6, 6.5: 66.7, 6: 65.7 },
};

/**
 * Calculate 1RM using Brzycki formula (Wodify's preferred method)
 */
export function calculateBrzycki(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return weight * (36 / (37 - reps));
}

/**
 * Calculate 1RM using Epley formula
 */
export function calculateEpley(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/**
 * Calculate 1RM using Lander formula
 */
export function calculateLander(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return (100 * weight) / (101.3 - 2.67123 * reps);
}

/**
 * Calculate 1RM using O'Conner formula
 */
export function calculateOConner(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return weight * (1 + 0.025 * reps);
}

/**
 * Calculate 1RM using Lombardi formula
 * Better for higher rep ranges (10-15 reps)
 */
export function calculateLombardi(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return weight * Math.pow(reps, 0.1);
}

/**
 * Calculate 1RM using Mayhew formula
 * Validated across diverse populations (trained and untrained)
 */
export function calculateMayhew(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return (100 * weight) / (52.2 + (48.8 * Math.exp(-0.075 * reps)));
}

/**
 * Calculate 1RM using Tuchscherer RPE method
 */
export function calculateTuchscherer(weight: number, reps: number, rpe: number): number {
  const percentage = RPE_PERCENTAGES[reps]?.[rpe];
  if (!percentage) {
    // Fallback to Brzycki if RPE data not available
    return calculateBrzycki(weight, reps);
  }
  return weight / (percentage / 100);
}

/**
 * Calculate weight to lift based on 1RM and target reps
 * Uses all 6 formulas and averages them (like TopEndSports)
 */
export function calculateWeightFromOneRepMax(
  oneRepMax: number,
  targetReps: number
): number {
  if (targetReps === 1) return oneRepMax;
  
  // Calculate using all 6 formulas and average them
  // Formula: weight = 1RM * (inverse of 1RM formula coefficient)
  const brzycki = oneRepMax * ((37 - targetReps) / 36);
  const epley = oneRepMax / (1 + targetReps / 30);
  const lander = oneRepMax * ((101.3 - 2.67123 * targetReps) / 100);
  const oconner = oneRepMax / (1 + 0.025 * targetReps);
  const lombardi = oneRepMax / Math.pow(targetReps, 0.1);
  const mayhew = oneRepMax * ((52.2 + (48.8 * Math.exp(-0.075 * targetReps))) / 100);
  
  // Average all formulas (like TopEndSports does)
  const average = (brzycki + epley + lander + oconner + lombardi + mayhew) / 6;
  
  return Math.round(average);
}

/**
 * Calculate recommended weight based on current 1RM, target reps, and RPE
 */
export function calculateRecommendedWeight(
  oneRepMax: number,
  targetReps: number,
  targetRPE: number
): number {
  const percentage = RPE_PERCENTAGES[targetReps]?.[targetRPE];
  if (!percentage) {
    // Fallback calculation for unsupported rep/RPE combinations
    const fallbackPercentage = Math.max(50, 100 - (targetReps * 2.5) - ((10 - targetRPE) * 5));
    return Math.round(oneRepMax * (fallbackPercentage / 100));
  }
  return Math.round(oneRepMax * (percentage / 100));
}

/**
 * Get accuracy rating based on rep range
 */
export function getAccuracyRating(reps: number): 'high' | 'medium' | 'low' {
  if (reps >= 1 && reps <= 6) return 'high';
  if (reps >= 7 && reps <= 10) return 'medium';
  return 'low';
}

/**
 * Get accuracy confidence as number (0-100) and description
 * Higher reps and extreme ranges are less reliable
 */
export function getAccuracyConfidence(reps: number, hasRPE: boolean = false): { 
  score: number;
  label: 'high' | 'medium' | 'low';
  description: string;
} {
  // If RPE is provided, confidence is higher (Tuchscherer is very accurate with RPE)
  if (hasRPE) {
    return {
      score: 95,
      label: 'high',
      description: 'Very reliable (RPE-based calculation)'
    };
  }

  // Based on rep range
  if (reps >= 1 && reps <= 3) {
    return {
      score: 95,
      label: 'high',
      description: 'Very reliable (low rep range)'
    };
  }
  
  if (reps >= 4 && reps <= 6) {
    return {
      score: 90,
      label: 'high',
      description: 'Very reliable (optimal rep range)'
    };
  }
  
  if (reps >= 7 && reps <= 10) {
    return {
      score: 75,
      label: 'medium',
      description: 'Good estimate (mid-range)'
    };
  }
  
  if (reps >= 11 && reps <= 15) {
    return {
      score: 70,
      label: 'medium',
      description: 'Moderate estimate (high rep range)'
    };
  }
  
  if (reps >= 16 && reps <= 20) {
    return {
      score: 60,
      label: 'low',
      description: 'Lower confidence (high reps, endurance factor)'
    };
  }
  
  // Beyond 20 reps
  return {
    score: 40,
    label: 'low',
    description: 'Low confidence (extreme rep range, endurance-based)'
  };
}

/**
 * Calculate 1RM using multiple formulas and return results
 */
export function calculateOneRepMax(
  weight: number,
  reps: number,
  rpe?: number
): RPECalculationResult[] {
  const results: RPECalculationResult[] = [];
  const accuracy = getAccuracyRating(reps);

  // Brzycki (Wodify's default)
  results.push({
    formula: 'brzycki',
    estimatedOneRepMax: Math.round(calculateBrzycki(weight, reps)),
    recommendedWeight: weight,
    accuracy,
  });

  // Epley
  results.push({
    formula: 'epley',
    estimatedOneRepMax: Math.round(calculateEpley(weight, reps)),
    recommendedWeight: weight,
    accuracy,
  });

  // Lander
  results.push({
    formula: 'lander',
    estimatedOneRepMax: Math.round(calculateLander(weight, reps)),
    recommendedWeight: weight,
    accuracy,
  });

  // O'Conner
  results.push({
    formula: 'oconner',
    estimatedOneRepMax: Math.round(calculateOConner(weight, reps)),
    recommendedWeight: weight,
    accuracy,
  });

  // Lombardi (better for higher reps 10-15)
  results.push({
    formula: 'lombardi',
    estimatedOneRepMax: Math.round(calculateLombardi(weight, reps)),
    recommendedWeight: weight,
    accuracy,
  });

  // Mayhew (validated across diverse populations)
  results.push({
    formula: 'mayhew',
    estimatedOneRepMax: Math.round(calculateMayhew(weight, reps)),
    recommendedWeight: weight,
    accuracy,
  });

  // Tuchscherer (if RPE provided)
  if (rpe) {
    results.push({
      formula: 'tuchscherer',
      estimatedOneRepMax: Math.round(calculateTuchscherer(weight, reps, rpe)),
      recommendedWeight: weight,
      accuracy,
    });
  }

  // Average of all formulas
  const validResults = results.filter(r => r.formula !== 'average');
  const averageOneRepMax = Math.round(
    validResults.reduce((sum, r) => sum + r.estimatedOneRepMax, 0) / validResults.length
  );

  results.push({
    formula: 'average',
    estimatedOneRepMax: averageOneRepMax,
    recommendedWeight: weight,
    accuracy,
  });

  return results;
}

/**
 * Get the best 1RM estimate (using Brzycki as default, like Wodify)
 */
export function getBestOneRepMaxEstimate(
  weight: number,
  reps: number,
  rpe?: number,
  preferredFormula: RPEFormula = 'brzycki'
): number {
  const results = calculateOneRepMax(weight, reps, rpe);
  const preferred = results.find(r => r.formula === preferredFormula);
  return preferred?.estimatedOneRepMax || results[0].estimatedOneRepMax;
}

/**
 * Calculate percentage increase for progressive overload
 */
export function calculatePercentageIncrease(
  currentWeight: number,
  percentageString: string
): number {
  // Handle formats like "+5%", "5%", "+10", "10"
  const cleanString = percentageString.replace(/[+%\s]/g, '');
  const percentage = parseFloat(cleanString);
  
  if (isNaN(percentage)) return currentWeight;
  
  // If the original string contained '%', treat as percentage
  if (percentageString.includes('%')) {
    return Math.round(currentWeight * (1 + percentage / 100));
  }
  
  // Otherwise, treat as absolute weight increase
  return currentWeight + percentage;
}
