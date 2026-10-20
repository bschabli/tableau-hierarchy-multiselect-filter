/** Draft checkbox selection is independent from Tableau's current Set. */
export function sameIds(a,b) {return a.size===b.size&&[...a].every(id=>b.has(id));}
export function hasPendingChanges(draftIds,appliedSetIds) {return !sameIds(draftIds,appliedSetIds);}
