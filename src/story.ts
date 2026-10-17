/**
 * Every readable document in the game. Edit the writing here — levels only reference these by key.
 *
 * The story of Ashen Vale (see STORY.md):
 * 50 years ago, Furnace No. 2 at the Vance & Co. Ironworks exploded at 3:17 AM and killed the 31 men of
 * the night shift. Owner Edmund Vance had ignored eleven pressure warnings and covered it up. The fire
 * never truly went out — it sank into the mine seams under the town and became a hunger: it takes back
 * the hours, one night at a time, always at 3:17. Clocks stop. People forget names, then whole people.
 * Three years ago Mayor Arthur Vance, Edmund's son, found the truth, ordered a quiet evacuation, and went
 * to perform the old Rite of Returning. He never came back. The Vance connection to Julian is left open.
 */
export interface StoryDoc {
  title: string;
  body: string;
}

export const DOCS = {
  // ─── Prologue ──────────────────────────────────────────────
  letter: {
    title: 'Letter on the passenger seat',
    body: 'Postmarked ASHEN VALE, three years ago. The envelope has been opened and closed many times.\n\nOne line, in a careful hand:\n\n"Don\'t come looking for me. Whatever you think is here, it will cost more than you have.\n— A."',
  },

  // ─── Act I · The Municipal Archive ─────────────────────────
  flyer: {
    title: 'Missing person',
    body: 'MISSING\n\nARTHUR VANCE\nMayor of Ashen Vale\n\nLast seen entering the Municipal Archive at 3:17 AM, October 14th.\n\nIf you have any information, contact the Town Council.\nDo not search the Archive after dark.',
  },
  councilNotice: {
    title: 'Town council notice',
    body: 'NOTICE TO ALL RESIDENTS\n\nBy order of the Mayor:\n\n1. No resident is to be out of doors between 3:00 and 3:30 AM.\n2. All clocks are to be removed from public buildings.\n3. If you wake and cannot remember the name of someone in your home, do not ask your neighbours. Report it to the Council.\n4. Do not discuss the lost hours.\n\n— Ashen Vale Town Council',
  },
  calendar: {
    title: 'Calendar page',
    body: 'OCTOBER — three years ago.\n\nThe days are crossed off in red, one by one, up to the 14th.\n\nAfter that, someone kept writing the same number into every square, pressing so hard the pen tore the paper:\n\n14 · 14 · 14 · 14 · 14 · 14 · 14',
  },
  clerkNote: {
    title: 'Note taped to a cabinet',
    body: 'Marjorie —\n\nThe registry froze over again last night. Third time this week. The vault isn\'t even refrigerated.\n\nThe Mayor says leave it locked. He says the cold is "keeping something in."\n\nI\'ve put in for a transfer. I don\'t care where.\n\n— Tom',
  },
  registry: {
    title: 'Registry, page 42',
    body: 'EVACUATION ORDER — NOT FOR PUBLICATION\n\nHouseholds 1 to 212 to leave by night, ten families at a time. No sirens. No press.\n\nReasons given by residents:\n— hours missing from every night, always beginning at 3:17\n— clocks stopping at 3:17 and refusing to be wound\n— family members whose names they can no longer recall\n\nThe town is being taken back an hour at a time. Get them out.\n\nSigned, A. Vance, Mayor',
  },
  gazette: {
    title: 'Newspaper clipping — fifty years old',
    body: 'THE ASHEN VALE GAZETTE\n\nIRONWORKS INFERNO: 31 LOST\n\nAll 31 men of the night shift are dead after Furnace No. 2 at the Vance & Co. Ironworks exploded at 3:17 this morning.\n\nProprietor Edmund Vance called the blast "an act of God." Asked about the furnace records, Mr. Vance said they were "lost in the fire."\n\nFiremen report the blaze has spread into the old mine seams beneath the town, where it cannot be reached.',
  },
  mayorJournal: {
    title: 'The Mayor\'s journal',
    body: 'I found Father\'s ledgers in the cellar.\n\nEleven pressure warnings on Furnace No. 2. Eleven. Signed by the foreman, every one returned unread. He let them burn to keep the line running, and then he buried it.\n\nBut the fire didn\'t stay buried. It\'s under us. It\'s hungry. Every night at 3:17 it takes another hour back, because thirty-one lives were never paid for.\n\nThe priest\'s old rite says the debt can be returned: burn what was taken, in the order it was taken, before the dawn.\n\nTonight I go to the vault. If I don\'t come back — someone has to finish it.',
  },
  unsentLetter: {
    title: 'Unsent letter',
    body: 'If you ever read this, it means you came anyway.\n\nI\'m sorry I wasn\'t there. I\'m sorry for a lot of things. Some debts get handed down whether you want them or not.\n\nDon\'t stay in the Vale. Don\'t carry anything for it.\n\n— A.',
  },

  // ─── Act II · The Ironworks (fifty years ago) ─────────────
  shiftBoard: {
    title: 'Shift board',
    body: 'NIGHT SHIFT — 31 MEN\n\nFurnace No. 2 pressure: HIGH\n\nThe line does NOT stop.\nBonus paid for every hour over quota.\n\n— By order of E. Vance, Proprietor',
  },
  foremanLog: {
    title: 'Foreman Hale\'s logbook',
    body: 'R. HALE — FOREMAN, NIGHT SHIFT\n\nPressure warnings on No. 2 filed with the office: 11\nWarnings answered: 0\n\nTonight the gauge is past the red. If she goes, she\'ll go at the change of shift — three o\'clock or near enough.\n\nMr. Vance says run her.\n\nGod forgive us. I\'ve told the boys to stand near the doors.',
  },
  workerNote: {
    title: 'Note pinned in the foreman\'s office',
    body: 'Hale —\n\nIt\'s my boy\'s birthday tomorrow. I swapped onto nights for the bonus so I could get him the bicycle.\n\nIf anything happens tell him I\'m sorr— no. Never mind. I\'ll tell him myself in the morning.\n\n— Danny',
  },
  watchEngraving: {
    title: 'Melted pocket watch',
    body: 'Engraved inside the case:\n\n"To R. Hale — 25 years of loyal service. Vance & Co."\n\nThe hands are fused at 3:17.\nThe copper is still warm.',
  },
  manifest: {
    title: 'Loading dock manifest',
    body: 'OUTGOING — CRATES 1 TO 31\nContents: scrap\nDestination: (left blank)\n\nUnderneath, in pencil:\n\n"They\'re not scrap, Mr. Vance. They had names."',
  },
  scratched: {
    title: 'Scratched into the smelter',
    body: 'Letters gouged deep into the iron, over and over, as if by many hands:\n\nWE ARE STILL HERE\nWE ARE STILL HERE\nWE ARE STILL HERE\nGIVE IT BACK',
  },

  // ─── Act III · The Chronos Observatory (the future) ──────
  plaque: {
    title: 'Observatory plaque',
    body: 'THE CHRONOS INSTITUTE\n\nEstablished to measure the Ashen Vale Anomaly —\na region where time is not passed, but lost.',
  },
  researcherLog: {
    title: 'Researcher\'s log',
    body: 'Day 212.\n\nThe Vale took another four hours from the calendar last night. The orrery runs backwards now; we\'ve stopped correcting it.\n\nThe shadow in the corridors doesn\'t see. It hears. And it always, always follows whoever is carrying the warmest light.\n\nMaybe that\'s the point. Maybe it wants a keeper.',
  },
  coreRecording: {
    title: 'Quartz core — recording',
    body: '"Chronos Observatory. Final recording.\n\nThe fire at the ironworks never went out. It burned forward — through every year, every hour.\n\nEach hour it eats, the town forgets a little more.\n\nWhoever hears this… burn it all before dawn."',
  },
  expeditionDrive: {
    title: 'Expedition 9 — final upload',
    body: 'We found the source. It isn\'t a fire. It\'s a debt — thirty-one lives, collected an hour at a time, always at 3:17.\n\nAnd it collects from whoever holds the light.\n\nEvery expedition that reached the Basilica ended the same way. The rite was finished, or it wasn\'t. Either way, someone always arrives again — by car, at night, in the rain.\n\nIf you are reading this: it\'s already happened to you.',
  },
  meridianScrawl: {
    title: 'Scrawled on a stone',
    body: 'DON\'T STOP ON THE BURNING STONES.\nDON\'T LOOK BACK.\n\nIt\'s faster when you look back.',
  },

  // ─── Act IV · The Cinder Basilica ──────────────────────────
  memorial: {
    title: 'Memorial plaque',
    body: 'IN MEMORY OF THE THIRTY-ONE\nFurnace No. 2 · 3:17 AM\n\nR. Hale · D. Morrow · T. Okafor · W. Brandt · J. Kowalski · E. Price · S. Moreau · and twenty-four more, their names worn smooth by hands.\n\n"Their hours were taken. Let them be returned."',
  },
  rite: {
    title: 'The Rite of Returning',
    body: 'The hour is owed, and it will be taken.\n\nTo return it: burn what is, what was, and what will be — in the order they were taken from you. Then burn the Keeper\'s Vow upon the altar.\n\nIt must be done before first light.\n\nIf the dawn finds the rite unfinished, the light will not take the debt.\nIt will take the keeper.',
  },
  crypt: {
    title: 'Inscription in the crypt',
    body: 'HERE LIE NONE OF THE THIRTY-ONE.\nThey were never found.\n\nOnly ash.\nOnly their hours.',
  },
  priestNote: {
    title: 'Note left on the crypt shelf',
    body: 'Arthur —\n\nYou were the keeper last time. You finished the rite, and still it began again.\n\nI don\'t think the rite ends it. I think it only decides who carries the light next.\n\nWho will it be?\n\n— Fr. M.',
  },
  vow: {
    title: 'The Keeper\'s Vow — altar scroll',
    body: '"Burn what you were,\nbefore the light finds what you are."',
  },
} satisfies Record<string, StoryDoc>;

export type DocId = keyof typeof DOCS;
