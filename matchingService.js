export function scoreCompatibility(userA, userB) {
  let score = 40; 
  const sharedSignals = [];
  
  if (userA.budget && userA.budget === userB.budget) {
    score += 15;
    sharedSignals.push(`Similar budget`);
  } else if (userA.budget && userB.budget) {
    if ((userA.budget === 'luxury' && userB.budget === 'budget') || (userA.budget === 'budget' && userB.budget === 'luxury')) {
      score -= 20;
    }
  }

  if (userA.pace && userA.pace === userB.pace) {
    score += 10;
    sharedSignals.push(`Similar pace`);
  }

  if (userA.accommodation && userA.accommodation === userB.accommodation) {
    score += 10;
    sharedSignals.push(`Prefers ${userA.accommodation}`);
  }

  const activitiesA = userA.activities || [];
  const activitiesB = userB.activities || [];
  const commonActivities = activitiesA.filter(a => activitiesB.includes(a));
  
  if (commonActivities.length > 0) {
    score += Math.min(25, commonActivities.length * 5);
    sharedSignals.push(...commonActivities.slice(0, 3));
  }

  const prefsA = userA.travelPreferences || [];
  const prefsB = userB.travelPreferences || [];
  const commonPrefs = prefsA.filter(p => prefsB.includes(p));
  
  if (commonPrefs.length > 0) {
    score += Math.min(20, commonPrefs.length * 5);
  }

  score = Math.min(98, score);
  score = Math.max(0, score);

  let verdict = 'low';
  if (score >= 70) verdict = 'high';
  else if (score >= 50) verdict = 'medium';

  return {
    score,
    verdict,
    sharedSignals: [...new Set(sharedSignals)],
    destinationOverlap: false,
    matchReason: "You both share similar travel preferences and budgets."
  };
}
