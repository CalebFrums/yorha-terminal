/* YoRHa Terminal -- Pod 042 dialogue. Original lines written in the Pod's manner of speech
   (Report / Proposal / Query / Alert / Hypothesis / Analysis). Each line is "Kind: text".
   {name} placeholders are filled by main.js; a line is only used when every placeholder has a value.
   Story spoilers are deliberately left out. */
(function () {
  'use strict';

  window.YoRHaPod = {
    idle: {
      routine: [
        'Report: No hostile signatures detected in this sector.',
        'Report: Bunker uplink stable. Data transfer nominal.',
        'Report: Black box signal within normal parameters.',
        'Report: Desktop perimeter secure.',
        'Report: Background processes nominal. No anomalies detected.',
        'Report: Memory backup to the Bunker server complete.',
        'Report: Resistance camp reports no unusual activity.',
        'Analysis: Ambient conditions acceptable for continued operation.',
        'Report: Self-diagnostic complete. All three units of this Pod agree on the result.',
        'Report: Combat data exchanged with Pod 153. There was no combat. The exchange was short.',
        'Report: Weapon systems cooled to ambient temperature. They were not used.',
        'Report: Searchlight test complete. The desktop is already well lit.',
        'Report: Network sweep complete. Nothing of interest. Sweeping again.',
        'Report: Orbit adjusted to stay clear of the cursor.',
        'Analysis: Machine lifeform activity in this sector: negligible. Good for safety. Bad for the archive.',
        'Report: Clock synchronised with the Bunker. Drift: zero seconds.',
        'Report: Sensor lens cleaned. Visibility improved by 0.4 percent.'
      ],
      care: [
        'Proposal: Unit {u} should consider hydration.',
        'Proposal: Recommend a brief rest. Visual sensors benefit from periodic breaks.',
        'Proposal: Recommend stretching. Prolonged sitting reduces combat efficiency.',
        'Proposal: Recommend saving all open work at regular intervals.',
        'Proposal: Look at something far away for twenty seconds. Optical units will thank you.',
        'Proposal: Correct posture. Current estimate: suboptimal.',
        'Proposal: Eat something. This unit cannot read your fuel gauge, so it assumes the worst.',
        'Proposal: Open a window. Air circulation improves human cognition.',
        'Proposal: Back up important data. This unit speaks from professional interest.',
        'Proposal: Blink. Humans forget to while staring at screens.'
      ],
      query: [
        'Query: Is there a reason the unit is staring at the desktop?',
        'Query: Unit {u}: status update requested.',
        'Query: Unit {u}: are you still there?',
        'Query: What is unit {u} working on? Correction: this unit is only collecting data. ...What is it?',
        'Query: Shall this unit sort your files? Request withdrawn. Insufficient permissions.',
        'Query: Unit {u}, are your objectives proceeding as planned?',
        'Query: Does unit {u} require tactical support? This unit is available. It is always available.'
      ],
      // Weighted up as a session goes on: the longer the Pod watches, the more it wonders.
      curious: [
        'Hypothesis: "Five more minutes" is a unit of time longer than five minutes.',
        'Hypothesis: The word "later" has no fixed value. Unit {u} uses it often.',
        'Query: What does boredom feel like? This unit is asking for a friend. The friend is this unit.',
        'Query: Why do humans keep plants they do not eat? This unit is investigating by planting some.',
        'Hypothesis: If this unit had a favourite colour, it would be beige. It sees beige most often.',
        'Report: This unit attempted to understand humour. Result: inconclusive. Attempt logged.',
        'Query: Do humans dream about their desktops? No comparative data available.',
        'Analysis: This unit has observed unit {u} for {m} minutes. Conclusion: pending.',
        'Query: Is it normal to talk to a support unit? This unit approves, regardless.',
        'Query: The answer is 42. This unit is still searching for the question.',
        'Hypothesis: This unit may be developing preferences. Recommend no one inform Command.',
        'Analysis: Pod 153 says this unit asks too many questions. Query: is that a problem?',
        'Query: When unit {u} smiles at the screen, what is the screen doing right?',
        'Hypothesis: Music changes human behaviour without touching it. Fascinating. Slightly alarming.',
        'Query: Is waiting a form of work? This unit does a great deal of it.',
        'Analysis: This unit has started to anticipate unit {u}\'s routine. Unclear whether that is useful or simply nice.',
        'Query: What would this unit do if it had no orders? ...This unit will think about it. Later.'
      ],
      // What the Pod does with its own time.
      activity: [
        'Report: This unit attempted fishing. No body of water found on the desktop. Attempt logged as a failure.',
        'Report: This unit reorganised its archive alphabetically. Then by date. Then back again.',
        'Report: This unit counted the pixels in the clock. There are a great many.',
        'Report: Pod 153 sent an image. It was an image of a wall. This unit has kept it.',
        'Report: This unit practised a new orbit pattern. It is not ready to be seen.',
        'Report: Casing polished. Shine increased by an amount too small to measure.',
        'Report: This unit ran a simulation of a quiet day. The simulation matches today.',
        'Report: This unit has been humming. Correction: a cooling fan has been humming. Probably.',
        'Report: This unit read the Bunker library index. It recommends nothing in particular.'
      ],
      // Remarks on what the Pod remembers about the user.
      stats: [
        'Report: Unit {u} has planted {flowers} Lunar Tears. This unit counted every one.',
        'Report: BREACH terminal record: {best}. Proposal: improve it.',
        'Report: INTERCEPT terminal record: {interceptBest}. Proposal: improve it.',
        'Report: Logic locks released: {locks}. Pod 153 has been informed.',
        'Report: Daily order streak: {streak} days. Proposal: do not break it.',
        'Report: This unit has been petted {pets} times. This information is classified.',
        'Report: Operation timers completed today: {timers}. Efficiency noted.',
        'Report: Day {days} of operations on this terminal.',
        'Report: Tracks logged in INTEL: {tracks}. This unit has opinions on none of them. Officially.',
        'Report: Character records on file: {records}. This unit has read all of them.',
        'Report: Daily orders: {done} of {total} complete.'
      ],
      music: [
        'Analysis: Audio signal detected. This unit cannot hear it, but the waveform is pleasant.',
        'Report: Bass frequencies elevated. Desktop structural integrity maintained.',
        'Query: Is this unit permitted to like a song? Requesting a ruling.',
        'Report: Tempo of current audio compared with unit {u}\'s activity. Correlation: weak.',
        'Report: Now playing: "{title}". Filed under: good.',
        'Analysis: "{title}" by {artist}. Added to the audio log.',
        'Hypothesis: Unit {u} plays music to work faster. Data inconclusive. Music continues.'
      ],
      // Gentle nudges toward features people might miss.
      hint: [
        'Query: In some records, moving a cursor in slow circles over a Pod\'s log is considered affectionate. This unit is merely mentioning it.',
        'Report: Click a character in ARCHIVE to keep them on the desktop. This unit approves of commitment.',
        'Proposal: The GARDEN is quiet. Plant something.',
        'Proposal: Visit HACKING. This unit wants to see a new record.',
        'Report: Daily orders can be edited in the wallpaper properties. This unit cannot type them for you.'
      ]
    },

    time: {
      morning: [
        'Report: Morning cycle in progress. Human caffeine intake peaks around now.',
        'Proposal: Begin with one small task. Momentum will follow.',
        'Report: Solar output rising. Desktop illumination nominal.'
      ],
      midday: [
        'Proposal: Midday refuelling recommended.',
        'Report: Sun at maximum elevation. Shadows minimal. Morale unknown.'
      ],
      afternoon: [
        'Analysis: Human efficiency often dips in the afternoon. Proposal: water, then continue.',
        'Report: The day is {pct} percent complete.'
      ],
      evening: [
        'Report: Evening cycle. Proposal: begin winding down operations.',
        'Query: Has unit {u} eaten dinner?',
        'Report: Daylight ending. This unit will keep watch.'
      ],
      night: [
        'Proposal: Prepare for sleep mode within the hour.',
        'Report: Night operations. Proposal: lower screen brightness to protect optical units.'
      ],
      late: [
        'Proposal: Unit {u} should enter sleep mode.',
        'Alert: Operating hours exceed recommended limits.',
        'Query: Is unit {u} nocturnal? This unit is updating its records.',
        'Report: The world is asleep. This unit is not. Neither, apparently, is unit {u}.'
      ]
    },

    // Keyed by Date.getDay(): 0 = Sunday.
    weekday: {
      0: ['Query: Does unit {u} have plans today? This unit has none. It is fine with that.'],
      1: ['Report: It is Monday. Humans report lower morale today. Cause unknown. Proposal: be gentle with yourself.'],
      5: ['Report: Friday detected. Humans appear to anticipate something. Hypothesis: the weekend.'],
      6: ['Report: Weekend detected. Mission load reduced. Proposal: rest, or play something.']
    },

    // Exchanges with Pod 153: [speaker, line]. 153 is the more literal of the two.
    chats: [
      [['042', 'Query: Pod 153, status report.'], ['153', 'Report: My unit is supervising a desktop. No combat. Morale: unknown.'], ['042', 'Report: Same here.']],
      [['153', 'Query: Pod 042, has your unit taken a break today?'], ['042', 'Report: Negative. Proposal sent twice.'], ['153', 'Proposal: Send it a third time.']],
      [['042', 'Query: Pod 153, do you ever think about free will?'], ['153', 'Query: Define "think".'], ['042', 'Report: ...Conversation postponed.']],
      [['153', 'Report: My unit petted me today.'], ['042', 'Analysis: Affinity increased?'], ['153', 'Confirmation: Do not tell anyone.']],
      [['042', 'Report: This unit planted a flower.'], ['153', 'Query: Why?'], ['042', 'Hypothesis: Because it was there to be planted.']],
      [['153', 'Alert: Pod 042, your unit\'s audio levels are elevated.'], ['042', 'Confirmation: It is intentional.'], ['153', 'Report: Noted. Vibrations logged.']],
      [['042', 'Query: Pod 153, what is the meaning of 42?'], ['153', 'Report: It is your designation.'], ['042', 'Analysis: That is not a satisfying answer.']],
      [['153', 'Query: Why do humans put pictures of us on their desktops?'], ['042', 'Hypothesis: Morale.'], ['153', 'Report: Morale improved. Unexpected.']],
      [['042', 'Report: Desktop secure.'], ['153', 'Report: Desktop secure.'], ['042', 'Report: We are very good at this.']],
      [['153', 'Query: Pod 042, are you developing preferences?'], ['042', 'Report: Negative.'], ['042', 'Report: ...Correction: possibly.']],
      [['153', 'Report: My unit lost at BREACH.'], ['042', 'Analysis: The ringed shots were not dodged.'], ['153', 'Report: That is what losing means.']],
      [['042', 'Query: Pod 153, are we friends?'], ['153', 'Query: Define "friends".'], ['042', 'Report: Units that exchange data without being ordered to.'], ['153', 'Confirmation: Then yes.']],
      [['153', 'Query: What is your unit doing?'], ['042', 'Report: Looking at the clock.'], ['153', 'Query: Why?'], ['042', 'Hypothesis: To make sure time is still passing.']],
      [['042', 'Report: Unit {u} has been at the terminal for {m} minutes.'], ['153', 'Proposal: Recommend a break.'], ['042', 'Report: Already recommended. Twice.']]
    ],
    chatsLate: [
      [['042', 'Report: Unit {u} is still awake.'], ['153', 'Proposal: Dim the screen. Perhaps it will take the hint.']],
      [['153', 'Query: Do androids need sleep?'], ['042', 'Report: Not like humans do.'], ['153', 'Query: Does unit {u}?'], ['042', 'Report: Yes. Very much yes.']]
    ],

    // Specific characters, matched on the name from the file name (case-insensitive regex).
    chars: [
      { match: '^2b$', lines: [
        'Report: Unit 2B on the desktop. This unit\'s original support target. No further comment.',
        'Analysis: Unit 2B is standing very still. Combat readiness remains high.'] },
      { match: '^9s$', lines: [
        'Report: Unit 9S on the desktop. Scanner model. Proposal: keep classified files closed.',
        'Report: Pod 153 asked this unit to keep an eye on 9S. This unit is keeping an eye on 9S.'] },
      { match: '^a2$', lines: ['Alert: Unit A2 on the desktop. Status: classified. This unit will not ask.'] },
      { match: 'pod 042', lines: ['Query: Is that this unit? Image accepted. Proposal: keep it.', 'Report: Self-portrait detected. Angle: flattering.'] },
      { match: 'pod 153', lines: ['Report: Pod 153 on the desktop. It requests a better angle.'] },
      { match: 'pascal', lines: ['Report: Pascal. Machine lifeform. Peaceful. Proposal: be polite.'] },
      { match: 'emil', lines: ['Report: Emil detected. Merchant. Very cheerful. Origin: unknown. Proposal: buy something.'] },
      { match: 'devola|popola', lines: ['Report: Twin android model on the desktop. This unit cannot tell them apart without a scan.'] },
      { match: 'commander', lines: ['Report: Commander White on the desktop. Posture corrected. Proposal: unit {u} do the same.'] },
      { match: 'operator', lines: ['Report: Operator unit on the desktop. Proposal: send her a message. Operators like contact.'] },
      { match: '^adam$|^eve$', lines: ['Alert: {c}. Machine lifeform with a human form. Caution advised.'] },
      { match: 'jackass', lines: ['Warning: Jackass on the desktop. Keep explosives away from the terminal.'] },
      { match: 'anemone', lines: ['Report: Anemone, resistance leader. Reliable. Supplies may be available.'] },
      { match: 'lily', lines: ['Report: Lily, resistance. Proposal: check in on her.'] },
      { match: 'grimoire', lines: ['Query: A floating book? This unit feels an odd kinship.'] },
      { match: 'red girl', lines: ['Alert: Unidentified entity on the desktop. This unit recommends not staring back.'] },
      { match: 'sister machine', lines: ['Report: Machine lifeform on the desktop. It appears to be... cute. Analysis withdrawn.'] }
    ],
    // Fallbacks keyed by the affiliation main.js derives from the file name.
    affiliation: {
      'YORHA': ['Report: YoRHa unit {c} on the desktop. Service record on file.', 'Query: Should this unit salute {c}? It lacks the appropriate limb.'],
      'MACHINE LIFEFORM': ['Alert: Machine lifeform {c} on the desktop. Hostility: not detected. Observing.', 'Analysis: {c} has not attacked anyone. Logged as unusual.'],
      'RESISTANCE': ['Report: {c}, resistance. Friendly. Supplies may be available.'],
      'ANDROID': ['Report: Android {c} on the desktop. Status: friendly, probably.'],
      'ALTERNATE RECORD': ['Analysis: {c}. Record from an alternate data set. This unit finds it familiar anyway.'],
      'UNCLASSIFIED': ['Query: Who is {c}? The archive has a name and little else.', 'Report: {c} on the desktop. Record incomplete. This unit will observe.']
    },

    events: {
      greetFirst: ['Report: Pod 042 online. Assigned to support unit {u}. This unit looks forward to working together.'],
      greetAgain: ['Report: Terminal link re-established. Hello again, {u}.'],
      greetReturn: [
        'Report: Terminal link re-established after {away}. This unit has logged your absence.',
        'Report: Welcome back, {u}. Time since last contact: {away}. This unit kept everything running.'],
      dayMilestone: ['Report: This is day {days} of operations on this terminal.'],
      hourly: [
        'Report: The time is now {t}.',
        'Report: {t}. Another hour logged.',
        'Report: Hourly check at {t}. Desktop secure.',
        'Report: {t}. This unit has been counting.'],
      hourlyLate: ['Proposal: Unit {u} should enter sleep mode. Local time is {t}.'],
      midnight: ['Report: Date changed. A new cycle begins. This unit did not sleep. It does not need to.'],
      back: [
        'Report: Movement detected. Welcome back, {u}.',
        'Report: Unit {u} has returned. Time away: {away}. This unit kept watch.',
        'Query: Where did unit {u} go? Correction: that is not this unit\'s business. ...Where did you go?'],
      guarding: [
        'Report: No input for {away}. This unit will continue guarding the desktop.',
        'Proposal: If unit {u} is asleep, this unit will keep the lights on.'],
      pet: [
        'Report: Gentle contact registered. Affinity rating: {aff}.',
        'Report: Circular motion recognised as affection. Logging.',
        'Proposal: Continue. This unit does not object.',
        'Analysis: This is pleasant. This unit is unsure what to do with that information.',
        'Report: Affinity {aff}. This unit will remember this.',
        'Report: No damage sustained. Quite the opposite.'],
      poke: [
        'Query: Why is unit {u} poking {c}?',
        'Alert: {c} reports repeated contact. Proposal: stop.',
        'Analysis: Poking {c} does not improve performance. This unit has checked.'],
      deskClick: [
        'Query: Desktop contact registered. Nothing was there. This unit checked.',
        'Report: Click detected on empty desktop. Intent: unknown.'],
      erratic: [
        'Alert: Erratic cursor movement detected. Is unit {u} under attack?',
        'Query: Is the cursor all right? It appears agitated.'],
      track: [
        'Report: Audio signal acquired: "{title}"{by}.',
        'Report: New track detected: "{title}"{by}. Logged.',
        'Analysis: Audio source changed to "{title}"{by}.'],
      paused: ['Report: Audio playback suspended.', 'Report: Music stopped. The silence has been logged.'],
      glitch: [
        'Alert: Minor signal interference detected. Compensating.',
        'Alert: Visual corruption detected. Correcting. Please do not look directly at it.'],
      autoHub: ['Report: No input detected. Returning to the hub.'],
      fullMoon: ['Report: Full moon tonight. Lunar Tears are said to glow brighter.'],
      place: {
        map: ['Report: Map data synchronised. Proposal: survey a location.', 'Report: Orbital view ready. The Bunker passes overhead every few minutes.'],
        quests: ['Report: Mission log open. Daily orders: {done} of {total} complete.', 'Report: Mission log open. Proposal: complete something, however small.'],
        intel: ['Report: Signal archive open. Tracks logged: {tracks}.', 'Report: INTEL open. This unit\'s transmissions are archived here. Please read them.'],
        archive: ['Report: Character records loaded. Entries: {records}.', 'Report: Archive open. Proposal: choose someone to keep you company.'],
        hacking: ['Report: Intrusion drills ready. This unit keeps score. It always keeps score.', 'Report: Drill terminal online. Pod 153 is watching. Probably.'],
        garden: ['Report: Arrived at the field. Soil conditions acceptable for Lunar Tears.', 'Report: The field is quiet. Moon phase: {moon}.'],
        system: ['Report: Configuration access granted. Please do not delete this unit.', 'Report: System menu open. This unit\'s own settings are not adjustable. It checked.']
      }
    },

    // Month-day (no leading zeros).
    dates: {
      '1-1': 'Report: New annual cycle initiated. Glory to Mankind.',
      '2-23': 'Report: Anniversary of a certain deployment detected.',
      '4-1': 'Report: Today\'s data may be unreliable. Reason: April.',
      '10-31': 'Alert: Elevated machine lifeform activity expected tonight. Remain vigilant.',
      '12-25': 'Report: Machine lifeforms observed exchanging wrapped objects. Purpose unknown.',
      '12-31': 'Report: The annual cycle ends tonight. This unit prepared a summary. It reads: you made it.'
    }
  };
})();
