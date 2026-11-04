// Rule-based matching: which volunteer should be a senior's Porch Light companion?
//
// We use simple, explainable rules instead of a "black box" so a coordinator
// (or a judge) can see exactly why a pair was suggested.
//
// STEP 1: Hard requirements. A volunteer is ELIGIBLE only if:
//   a) they have room (current seniors < the max they signed up for),
//   b) they share at least ONE weekly time slot with the senior, and
//   c) they offer the senior's preferred contact method (phone / video / visit).
//   d) [towns] for a senior who prefers in-person visits, they live in the same
//      county. Phone and video calls work statewide. (Town and county come
//      from src/towns/; people with no town count as the community's town.)
//   If any rule fails, the volunteer is listed as "not eligible" with the reason.
//
// STEP 2: Score the eligible volunteers.
//   +3 points for each shared interest. Common ground makes conversations
//      easier, and conversation quality is the whole point.
//   +2 points for each shared time slot, counting at most 5 slots, so a
//      volunteer who is free "all the time" can't outrank one who has real
//      common interests.
//   +1 point if the volunteer has no seniors yet, which spreads the work out.
//
// STEP 3: Sort by score (highest first). Ties go to the volunteer with fewer
// current seniors, then alphabetically by name, so results are stable.

import { interestLabel, methodLabel, slotLabel } from './vocab.js';
import { countyOfPerson } from './towns/index.js'; // [towns]

export const WEIGHTS = {
  perSharedInterest: 3,
  perSharedSlot: 2,
  maxCountedSlots: 5,
  newVolunteerBonus: 1,
};

const intersect = (a = [], b = []) => a.filter((x) => b.includes(x));

// Score one senior/volunteer pair. `currentLoad` = how many seniors the
// volunteer is already matched with.
export function scorePair(senior, volunteer, currentLoad = 0) {
  const sharedInterests = intersect(senior.interests, volunteer.interests);
  const sharedSlots = intersect(senior.availability, volunteer.availability);
  const offersMethod = (volunteer.contactMethods || []).includes(senior.contactMethod);

  const problems = [];
  if (currentLoad >= volunteer.maxSeniors) {
    problems.push(`At capacity (already has ${currentLoad} of ${volunteer.maxSeniors} senior${volunteer.maxSeniors === 1 ? '' : 's'})`);
  }
  if (sharedSlots.length === 0) {
    problems.push('No overlapping availability');
  }
  if (!offersMethod) {
    problems.push(`Does not offer ${methodLabel(senior.contactMethod).toLowerCase()}s`);
  }
  // [towns] rule d: in-person visits need the same county (unknown towns are not judged).
  const seniorCounty = countyOfPerson(senior);
  const volunteerCounty = countyOfPerson(volunteer);
  if (offersMethod && senior.contactMethod === 'visit' && seniorCounty && volunteerCounty && seniorCounty !== volunteerCounty) {
    problems.push(`Lives in ${volunteerCounty} - too far for in-person visits`);
  }

  const countedSlots = Math.min(sharedSlots.length, WEIGHTS.maxCountedSlots);
  const breakdown = [
    {
      label: `${sharedInterests.length} shared interest${sharedInterests.length === 1 ? '' : 's'}`,
      detail: sharedInterests.map(interestLabel).join(', ') || 'none',
      points: sharedInterests.length * WEIGHTS.perSharedInterest,
    },
    {
      label: `${sharedSlots.length} shared time slot${sharedSlots.length === 1 ? '' : 's'}`,
      detail:
        sharedSlots.map(slotLabel).join(', ') +
        (sharedSlots.length > WEIGHTS.maxCountedSlots ? ` (only ${WEIGHTS.maxCountedSlots} count toward the score)` : ''),
      points: countedSlots * WEIGHTS.perSharedSlot,
    },
  ];
  if (currentLoad === 0) {
    breakdown.push({ label: 'New volunteer bonus', detail: 'No seniors assigned yet', points: WEIGHTS.newVolunteerBonus });
  }

  return {
    volunteer,
    eligible: problems.length === 0,
    problems,
    sharedInterests,
    sharedSlots,
    currentLoad,
    breakdown,
    score: breakdown.reduce((sum, b) => sum + b.points, 0),
  };
}

// Rank every volunteer for one senior.
export function rankVolunteers(senior, volunteers, matches) {
  const loadOf = (volunteerId) =>
    matches.filter((m) => m.active && m.volunteerId === volunteerId).length;

  const results = volunteers.map((v) => scorePair(senior, v, loadOf(v.id)));

  const eligible = results
    .filter((r) => r.eligible)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.currentLoad - b.currentLoad ||
        a.volunteer.name.localeCompare(b.volunteer.name)
    );
  const ineligible = results
    .filter((r) => !r.eligible)
    .sort((a, b) => a.volunteer.name.localeCompare(b.volunteer.name));

  return { eligible, ineligible };
}
