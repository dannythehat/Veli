// Shared by the browser quiz (check.js) and the Worker (worker.js), so the result
// someone sees on screen and the plan we store or email always match.

export const QUESTIONS = [
  {
    id: 'q1', title: 'How often are you out alone after dark?', type: 'single',
    options: [
      { text: 'Rarely', tag: 'rarely' },
      { text: 'Sometimes', tag: 'sometimes' },
      { text: 'Most weeks', tag: 'most_weeks' },
      { text: 'Almost daily', tag: 'almost_daily' }
    ]
  },
  {
    id: 'q2', title: 'How do you usually get home?', type: 'single',
    options: [
      { text: 'Walk', tag: 'walk' },
      { text: 'Taxi or Uber', tag: 'taxi' },
      { text: 'Public transport', tag: 'public_transport' },
      { text: 'Drive', tag: 'drive' }
    ]
  },
  {
    id: 'q3', title: 'What worries you most?', hint: 'Pick up to 2', type: 'multi', max: 2,
    options: [
      { text: 'Taxi drivers', tag: 'taxi' },
      { text: 'Being followed', tag: 'followed' },
      { text: 'Nobody knowing where I am', tag: 'nobody_knows' },
      { text: 'Drinks being spiked', tag: 'spiked' },
      { text: 'Getting lost', tag: 'lost' },
      { text: 'Fumbling for my phone in an emergency', tag: 'phone_fumble' }
    ]
  },
  {
    id: 'q4', title: 'Who would you want told if something felt wrong?', hint: 'Pick up to 3', type: 'multi', max: 3,
    options: [
      { text: 'Mum or family', tag: 'family' },
      { text: 'Partner', tag: 'partner' },
      { text: 'Best friend', tag: 'best_friend' },
      { text: 'Flatmate', tag: 'flatmate' }
    ]
  },
  {
    id: 'q5', title: 'Do you currently do anything to feel safer?', type: 'single',
    options: [
      { text: 'Share location', tag: 'share_location' },
      { text: 'Fake phone calls', tag: 'fake_calls' },
      { text: 'Carry an alarm', tag: 'alarm' },
      { text: 'Nothing', tag: 'nothing' }
    ]
  },
  {
    id: 'q6', title: 'Where does your phone usually sit when you\'re out?', type: 'single',
    options: [
      { text: 'In my hand', tag: 'hand' },
      { text: 'Pocket', tag: 'pocket' },
      { text: 'Bag', tag: 'bag' },
      { text: 'Depends', tag: 'depends' }
    ]
  },
  {
    id: 'q7', title: 'Would you carry a stylish accessory on your bag that can record and alert for you?', type: 'single',
    options: [
      { text: 'Definitely', tag: 'definitely' },
      { text: 'Maybe', tag: 'maybe' },
      { text: 'Only if it\'s really stylish', tag: 'if_stylish' },
      { text: 'No', tag: 'no' }
    ]
  },
  {
    id: 'q8', title: 'What would you expect to pay?', type: 'single',
    options: [
      { text: 'Under £50', tag: 'under_50' },
      { text: '£50 to £80', tag: '50_80' },
      { text: '£80 to £120', tag: '80_120' },
      { text: '£120 plus', tag: '120_plus' }
    ]
  },
  {
    id: 'q9', title: 'Which colour would you choose?', type: 'colour',
    options: [
      { text: 'Oatmeal', tag: 'oatmeal', image: '/assets/web/colour-oatmeal-640.webp' },
      { text: 'Charcoal', tag: 'charcoal', image: '/assets/web/colour-charcoal-640.webp' },
      { text: 'Caramel', tag: 'caramel', image: '/assets/web/colour-caramel-640.webp' },
      { text: 'Ivory', tag: 'ivory', image: '/assets/web/colour-ivory-640.webp' },
      { text: 'Mocha', tag: 'mocha', image: '/assets/web/colour-mocha-640.webp' }
    ]
  },
  {
    id: 'q10', title: 'Last one. A little about you.', type: 'about',
    age: ['Under 18', '18 to 24', '25 to 34', '35 to 44', '45 to 54', '55 plus'],
    countries: [
      'United Kingdom', 'Ireland', 'United States', 'Canada', 'Australia', 'New Zealand',
      'France', 'Germany', 'Spain', 'Italy', 'Netherlands', 'Belgium', 'Sweden', 'Denmark',
      'Norway', 'Portugal', 'Poland', 'Switzerland', 'United Arab Emirates', 'South Africa',
      'India', 'Singapore', 'Other'
    ]
  }
];

export const CONCERNS = {
  taxi: {
    label: 'Taxi drivers',
    help: 'Getting in a cab alone is one of the most common worries. VELI is designed to record the journey, share your live route with someone you trust and alert them if something feels wrong.'
  },
  followed: {
    label: 'Being followed',
    help: 'VELI is designed to notice when a journey changes, quietly capture what is around you and let your trusted circle see where you are.'
  },
  nobody_knows: {
    label: 'Nobody knowing where I am',
    help: 'VELI is designed to keep your chosen people updated on your journey and let them know when you have arrived.'
  },
  spiked: {
    label: 'Drinks being spiked',
    help: 'VELI is designed to help you signal your trusted circle discreetly and share your location without reaching for your phone.'
  },
  lost: {
    label: 'Getting lost',
    help: 'Ask VELI for directions or the nearest ATM, station or open shop, hands free.'
  },
  phone_fumble: {
    label: 'Fumbling for my phone in an emergency',
    help: 'One tap or one phrase starts recording and alerts your circle. No unlocking, no fumbling.'
  }
};

// Practical tips that work today, with or without VELI.
const TIPS = {
  taxi: {
    title: 'Check the car before you get in.',
    body: 'Match the number plate, car model and driver name to your app. Sit in the back and use the app to share your trip with someone.'
  },
  followed: {
    title: 'Know what to do if someone follows you.',
    body: 'Cross the road and see if they cross too. Head for somewhere busy and lit, like a shop, bar or petrol station, and tell the staff.'
  },
  nobody_knows: {
    title: 'Agree a "home safe" text.',
    body: 'Before you go out, share your live location with one person using Find My or Google Maps. Agree that you will text when you are home, and what they will do if that text does not arrive.'
  },
  spiked: {
    title: 'Keep your drink in sight.',
    body: 'Watch it being poured and keep it in your hand. If you or a friend suddenly feel very drunk or unwell, tell a friend and the venue staff straight away.'
  },
  lost: {
    title: 'Plan your way home before you leave.',
    body: 'Download an offline map of the area and screenshot the route home. Carry a small power bank so your phone lasts the night.'
  },
  phone_fumble: {
    title: 'Set up your phone\'s emergency shortcut tonight.',
    body: 'On iPhone, turn on Emergency SOS and press the side button five times. On most Android phones, press the power button five times. Add your emergency contacts so they are told too.'
  },
  walk: {
    title: 'Choose the lit route.',
    body: 'Pick busy, well lit streets even if they take a few minutes longer. Keep one ear free of headphones so you can hear what is around you.'
  },
  public_transport: {
    title: 'Sit where people can see you.',
    body: 'On buses sit near the driver. On trains choose a busy carriage. Check the time of the last service before you head out.'
  },
  drive: {
    title: 'Park for the walk back.',
    body: 'Park near the exit and under lights. Have your keys ready before you reach the car and lock the doors as soon as you are in.'
  },
  hand: {
    title: 'Keep your phone out of sight on quiet streets.',
    body: 'A phone in your hand can make you a target and pull your eyes down. Hold it close, look up often and step into a doorway if you need to check it.'
  },
  battery: {
    title: 'Leave with at least half your battery.',
    body: 'Low battery is one of the most common reasons people cannot call for help. Charge before you go, or carry a small power bank.'
  }
};

const UK_SILENT_999 = 'In the UK, if you call 999 and cannot speak, press 55 when asked and the police will know you need help.';

const pickText = (answer) => (Array.isArray(answer) ? answer : answer ? [answer] : []);

// Top 3 concerns from Q3, plus taxi if they get cabs home and nobody_knows if they do nothing to feel safer.
export function topConcerns(answers = {}) {
  const chosen = pickText(answers.q3).map((a) => a.tag).filter((tag) => CONCERNS[tag]);
  const counts = new Map();
  const order = [];
  const add = (tag) => {
    if (!counts.has(tag)) order.push(tag);
    counts.set(tag, (counts.get(tag) || 0) + 1);
  };
  chosen.forEach(add);
  if (answers.q2?.tag === 'taxi') add('taxi');
  if (answers.q5?.tag === 'nothing') add('nobody_knows');

  const ranked = order
    .map((tag, index) => ({ tag, count: counts.get(tag), index }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .map(({ tag }) => ({ tag, chosen: true }));

  // Fewer than three? Add the ones their other answers point to, marked as suggested.
  const fillers = [];
  if (['pocket', 'bag', 'depends'].includes(answers.q6?.tag)) fillers.push('phone_fumble');
  if (answers.q2?.tag === 'walk') fillers.push('followed');
  fillers.push('nobody_knows', 'phone_fumble', 'followed', 'lost');
  for (const tag of fillers) {
    if (ranked.length >= 3) break;
    if (!ranked.some((c) => c.tag === tag)) ranked.push({ tag, chosen: false });
  }

  return ranked.slice(0, 3).map((c) => ({ ...c, ...CONCERNS[c.tag] }));
}

export function safetyPlan(answers = {}, concerns = topConcerns(answers)) {
  const keys = [];
  const push = (key) => { if (TIPS[key] && !keys.includes(key)) keys.push(key); };
  concerns.forEach((c) => push(c.tag));
  push(answers.q2?.tag);
  if (answers.q6?.tag === 'hand') push('hand');
  push('battery');

  const tips = keys.slice(0, 3).map((key) => ({ key, ...TIPS[key] }));
  // UK respondents get the silent 999 call added to the tip where it matters most.
  if (answers.q10?.country === 'United Kingdom') {
    const tip = tips.find((t) => ['followed', 'phone_fumble'].includes(t.key));
    if (tip) tip.body = `${tip.body} ${UK_SILENT_999}`;
  }
  return tips;
}

export function circleText(answers = {}) {
  const people = pickText(answers.q4).map((a) => a.text);
  if (!people.length) return '';
  if (people.length === 1) return people[0];
  return `${people.slice(0, -1).join(', ')} and ${people[people.length - 1]}`;
}
