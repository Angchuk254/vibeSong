// ============================================
// YakBeats — Daily vibe messages
// ============================================
// One set per weekday (0 = Sunday). A message is picked per day, so it stays
// the same all day and changes tomorrow. {place} becomes the user's city (or
// "your corner of the world" when location is off/unknown).

export const DAILY_VIBES: string[][] = [
  // Sunday
  [
    "Sunday reset mode: phone on DND, playlist on shuffle, zero plans. {place} can wait, the chill can't.",
    "It's Sunday in {place} — the unofficial holiday of slow chai, long naps and songs you haven't heard in years.",
    "Main-character Sunday. Walk somewhere with no destination and let the queue write the soundtrack.",
    "Soft Sunday energy only. Low volume, high feelings, no notifications allowed.",
    "Sunday scaries are cancelled. Put on something warm and pretend Monday is a myth.",
  ],
  // Monday
  [
    "New week, same legend. Hit play on something loud and walk into Monday like you own {place}.",
    "Monday called. We let it go to voicemail and queued up a banger instead.",
    "Manifesting a week with good weather in {place}, fast Wi-Fi and a playlist that never skips.",
    "Mondays are just Fridays that haven't found their soundtrack yet. Let's fix that.",
    "Coffee: loading. Motivation: buffering. Music: already playing. Two out of three is a win.",
  ],
  // Tuesday
  [
    "Tuesday is the most underrated day. No hype, no pressure — just you, {place} and a perfect song.",
    "Low-key Tuesday agenda: stay hydrated, stay kind, stay vibing. Everything else is optional.",
    "It's giving productive. Lo-fi on, tabs open, snacks within reach. You've got this.",
    "Small wins count. Finished a task? Play your victory song. Didn't? Play it anyway.",
    "Tuesday tip: the right song can turn a to-do list into a montage. Try it.",
  ],
  // Wednesday
  [
    "Halfway there, {place}. Mid-week slump? Nah — mid-week soundtrack era.",
    "Wednesday = hump day. Climb it with a playlist and slide down the other side.",
    "Plot twist: today is the day you find your new favourite song. Go dig in Browse.",
    "It's Wednesday, my dudes. Stretch, breathe, turn the volume up one notch.",
    "Mid-week check-in: you're doing better than you think. Here's your sign to take a music break.",
  ],
  // Thursday
  [
    "Thursday is basically Friday's opening act. Warm up the speakers in {place}.",
    "Almost weekend. Start drafting the road-trip playlist now — future you will thank you.",
    "Throwback Thursday: go play the song that was your whole personality three years ago.",
    "Energy check: 60% tired, 40% vibes. Let's flip that with something upbeat.",
    "Thursday mood: deep focus, good headphones, and a song on repeat that nobody needs to know about.",
  ],
  // Friday
  [
    "IT'S FRIDAY. {place} is officially in weekend mode. Volume up, worries down.",
    "Friday feeling unlocked. The only deadline left is picking tonight's playlist.",
    "Weekend loading: ▓▓▓▓▓▓▓▓░ 90%. Hit play to finish the download.",
    "Friday rule: no sad songs before sunset. After sunset? No rules.",
    "You survived the week. That deserves a full album, not just a song.",
  ],
  // Saturday
  [
    "Saturday in {place}: long drives, loud singalongs, zero skips. That's the vibe.",
    "No alarms, no emails, just vibes. Saturday is a whole genre on its own.",
    "Weekend side quest: find one song you've never heard and add it to a playlist.",
    "Saturday agenda: friends, food, fresh music. In any order you like.",
    "The weekend is short — make the playlist long.",
  ],
];

/** Himalayan places get their own greeting and extra local vibes */
export interface LocalFlavour {
  match: RegExp;
  hello: string;
  vibes: string[];
}

export const LOCAL_FLAVOURS: LocalFlavour[] = [
  {
    match: /\b(leh|ladakh|kargil|nubra|zanskar|diskit|padum)\b/i,
    hello: 'Julley',
    vibes: [
      'Julley from 3,500 m up! Thin air, big mountains, and even bigger playlists. Stay hydrated, {place}.',
      'Prayer flags flapping, Indus flowing, kahwa in hand — the perfect setup for a Ladakhi folk session.',
      "Clear skies over {place} hit different. Put on something slow and watch the mountains change colour.",
      'Fun fact: sound travels just fine at high altitude. Your neighbours will hear this one. Julley!',
    ],
  },
  {
    match: /\b(kaza|spiti|kinnaur|reckong|lahaul|keylong|tabo)\b/i,
    hello: 'Julley',
    vibes: [
      "Cold desert, warm hearts. {place} deserves a soundtrack as epic as its valleys.",
      'Spiti skies at night are unreal — pair them with something ambient and just stare.',
    ],
  },
  {
    match: /\b(nepal|kathmandu|pokhara|lalitpur|patan|bhaktapur|biratnagar|butwal|chitwan)\b/i,
    hello: 'Namaste',
    vibes: [
      'Namaste, {place}! Momos in one hand, playlist in the other — what more do you need?',
      'From Thamel alleys to Phewa lake sunsets, Nepal runs on good music. Keep it going.',
      'Dashain-level energy on a random weekday. Turn it up, {place}!',
    ],
  },
  {
    match: /\b(bhutan|thimphu|paro|punakha|phuentsholing|bumthang|trashigang|wangdue)\b/i,
    hello: 'Kuzuzangpo la',
    vibes: [
      'Kuzuzangpo la, {place}! Gross National Happiness starts with a great playlist.',
      'Rigsar on, ema datshi on the table, dzongs in the distance. Peak Bhutan vibes.',
      "In the Land of the Thunder Dragon, the bass drops hit extra hard. Try it.",
    ],
  },
  {
    match: /\b(dharamshala|dharamsala|mcleod|gangtok|sikkim|tawang|darjeeling|kalimpong)\b/i,
    hello: 'Tashi Delek',
    vibes: [
      'Tashi Delek, {place}! Mist on the hills, butter tea in the cup, and a soft playlist to match.',
      "Monastery bells in the morning, mountain lo-fi all afternoon. That's the {place} routine.",
    ],
  },
  {
    match: /\b(manali|shimla|kullu|kasol|mandi|solan|chamba|himachal)\b/i,
    hello: 'Ram Ram',
    vibes: [
      'Pahadi mornings in {place} deserve pahadi beats. Nati on, blanket on, world off.',
      'Apple orchards, pine forests and a playlist on loop — {place} really said main-character energy.',
    ],
  },
];

/** Stable pick for a given day, so the message doesn't change on every refresh */
export function pickForDay<T>(items: T[], date: Date, salt = 0): T {
  const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${salt}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return items[Math.abs(h) % items.length];
}
