// Template bank for MOCK_MODE conversation sparks.
//
// Each interest has general starters ("any") plus optional season- or
// month-specific ones, so offline output still feels current. Placeholders:
//   {name}  the senior's preferred name
//   {gap}   a friendly phrase like "about a week"
//   {town}  the community's town (src/community.js), e.g. "Carmel"
//
// Nothing here names a particular town. Local places and events come from
// the community profile (COMMUNITIES.<id>.localTouches in src/community.js);
// a community without its own touches gets INDIANA_TOUCHES below.
// Volunteers say these out loud, so they're written to be spoken,
// open-ended, and respectful.

export const OPENERS = {
  // No completed contact yet: first conversation
  first: [
    "Hi {name}! I'm really glad we get to talk. To start, what's one thing you'd like me to know about you?",
    "It's so nice to meet you, {name}. What does a really good day look like for you?",
    'Hi {name}, thanks for chatting with me! How did you end up living in {town}?',
  ],
  // 0–3 days since the last contact
  recent: [
    "Good to talk again so soon, {name}! What's happened since our last chat?",
    'Hi {name}! How did the rest of your week go after we talked?',
    "Hi {name}! What's been the best part of your day so far?",
  ],
  // 4–10 days
  week: [
    "Hi {name}, it's been {gap} since we talked. What's something that made you smile this week?",
    "It's been {gap}, {name}. Catch me up! What have you been up to?",
    "I've been looking forward to this, {name}. What's new since we talked {gap} ago?",
  ],
  // 11+ days: a warm reconnect. The volunteer owns the gap so the senior never feels guilty.
  long: [
    "{name}, I've missed our chats! It's been {gap}, so I'd love to hear what you've been up to.",
    "It's so good to hear your voice, {name}. It's been {gap}, and I want to hear everything. What's been keeping you busy?",
    "Hi {name}! I'm sorry it's been {gap}. I've been thinking about you. How have things been?",
  ],
};

export const INTEREST_SPARKS = {
  gardening: {
    any: [
      "What's the most rewarding thing you've ever grown, {name}? How did you do it?",
      'If you could plant only one thing next year, what would it be and why?',
      'Who taught you to garden? I would love to hear about them.',
    ],
    fall: ['Have you started putting the garden to bed for winter? Is there anything you save or bring inside?'],
    winter: ['Do you look through seed catalogs in the winter? What are you dreaming of planting this spring?'],
    spring: ["What's the first thing you plant each spring? Do you have a secret for getting it started?"],
    summer: ["What's growing best in your garden this summer? Any tomatoes ripe yet?"],
  },
  baking: {
    any: [
      "What's a recipe you're known for, {name}? Would you walk me through how you make it?",
      'What did your kitchen smell like on holidays when you were growing up?',
      'Have you ever had a kitchen disaster that turned into a funny story?',
      'If you could teach me one recipe, which one would you pick?',
    ],
    fall: ['Is there a dish you always make once the weather turns cool? Pie, soup, something else?'],
    winter: ['Do you have a favorite holiday cookie or treat? Who did you used to bake it with?'],
  },
  music: {
    any: [
      'What song takes you right back to being a teenager? Where were you when you first heard it?',
      'Did you ever sing or play an instrument? What was your favorite piece?',
      'If you could see any musician perform live again, who would it be?',
      'What was the first concert you ever went to?',
    ],
    winter: ["What's your favorite holiday song? Does it bring back any memories?"],
  },
  faith: {
    any: [
      'Is there a hymn or reading that has stayed with you over the years? What does it mean to you?',
      'What did Sundays look like in your house growing up?',
      'Is there someone from your church community who made a big difference in your life?',
    ],
  },
  history: {
    any: [
      "What's a big news event where you remember exactly where you were? What was that day like?",
      'How has {town} changed the most since you first got to know it?',
      'If you could sit down with anyone from history, who would you pick, and what would you ask them?',
      "What's something about everyday life when you were young that people my age wouldn't believe?",
    ],
  },
  travel: {
    any: [
      "What's the most memorable trip you've ever taken? What made it special?",
      'If you could hop on a plane tomorrow, where would you go?',
      'What place surprised you the most when you visited it?',
      'What was the best meal you ever had while traveling?',
    ],
  },
  reading: {
    any: [
      'What book have you read more than once? What keeps pulling you back to it?',
      'Is there an author you think someone my age should read?',
      'What did you love reading as a kid? Did you have a favorite series?',
      'Have you read anything lately that stuck with you?',
    ],
    winter: ["Winter is good reading weather. What's on your nightstand right now?"],
  },
  crafts: {
    any: [
      "What are you working on right now? I'd love to hear about it, or see it if we're on video.",
      'Who taught you to knit or sew? Do you remember your very first project?',
      "What's the piece you're proudest of making?",
      'Is there a color or pattern you keep coming back to? What do you like about it?',
    ],
  },
  games: {
    any: [
      'What card game could you beat anyone at? Would you teach me the rules?',
      'Did your family have a game night tradition growing up?',
      'Are you more of a careful strategy player or a lucky-streak player?',
    ],
  },
  puzzles: {
    any: [
      'Do you do the crossword? Pen or pencil?',
      "What's the hardest puzzle you've ever finished?",
      'Want to try a quick trivia question together? Then you can quiz me back.',
    ],
  },
  pets: {
    any: [
      "Tell me about the best pet you've ever had. What was their personality like?",
      'What has your pet been up to lately? Any funny moments?',
      'If you could have any animal as a pet, no rules, what would you pick?',
    ],
  },
  birds: {
    any: [
      'What birds have you been seeing outside your window lately?',
      'Do you have a favorite bird? What do you like about it?',
      "What's your favorite spot in {town} to be outdoors?",
    ],
    spring: ['Have the spring birds come back yet? Which one do you look forward to most?'],
    fall: ['Have you noticed birds heading south yet? Which ones stick around all winter?'],
  },
  fishing: {
    any: [
      "What's the biggest fish you ever caught? Is the real story as big as the fish?",
      "Where's your favorite fishing spot? What makes it special?",
      'Who taught you to fish? Do you remember your first trip?',
    ],
    // Summer fishing spots come from the community's local touches.
  },
  basketball: {
    any: [
      "Who's the best basketball player you've ever seen play in person?",
      'Did you play basketball growing up? What position?',
      'Indiana takes high school basketball seriously. Do you remember a big game from back in the day?',
    ],
    fall: ['Basketball season is starting up. What are your hopes for the Pacers this year?'],
    winter: ["How do you think the Pacers are doing so far this season? Who's your favorite player?"],
    summer: ['Are you looking forward to basketball season? Who do you think will surprise people?'],
  },
  baseball: {
    any: [
      "Who's your team, and how did you end up rooting for them?",
      'Did you ever go to a ballgame with your family? What do you remember most?',
      "Who's the greatest baseball player you've ever watched?",
    ],
    spring: ['Opening Day is coming up. What are your predictions for this season?'],
    summer: ["Have you been following the season? How's your team doing?"],
    fall: ['Did you follow the World Series this year? Who were you rooting for?'],
    winter: ['Baseball season feels far away right now. What do you miss most about it?'],
  },
  cars: {
    any: [
      'What was the first car you ever owned? Whatever happened to it?',
      'If you could have any car from any year parked in your driveway, what would it be?',
      'Have you ever been to the Indy 500, or did you always watch it on TV?',
    ],
    may: ['The Indy 500 is this month! Do you have a favorite driver or race-day memory?'],
  },
  veterans: {
    any: [
      "If you're up for sharing, is there a friendship from your service days you still think about?",
      'What did you learn in the service that stuck with you your whole life?',
      'Where were you stationed? What was it like being so far from home?',
    ],
    nov: ['With Veterans Day this month, is there anything you wish people my age understood about serving?'],
  },
  family: {
    any: [
      "What's a family tradition you hope keeps going for generations?",
      "What's the latest news from your family?",
      'Who in your family are you most like? In what way?',
      "What's your favorite story to tell about your family?",
    ],
  },
  movies: {
    any: [
      "What's a movie you could watch a hundred times?",
      'Who was your favorite movie star growing up?',
      'What was going to the movies like when you were young? How much was a ticket?',
      'Have you seen anything good lately that you would recommend?',
    ],
    winter: ["What's your favorite holiday movie?"],
  },
  art: {
    any: [
      "What's a piece of art that stuck with you? What do you remember about seeing it?",
      'What do you like to paint or draw most?',
      // Local galleries come from the community's local touches.
    ],
  },
  technology: {
    any: [
      "What's the most amazing change in technology you've seen in your lifetime?",
      'What gadget do you love, and which one drives you crazy?',
      'Do you remember the first time you used a computer or a cell phone?',
      "Is there anything on your phone or tablet you'd like help figuring out? I'm happy to help.",
    ],
  },
};

// Used when a senior has fewer than two interests on file.
export const GENERAL_SPARKS = {
  any: [
    "What's the best piece of advice anyone ever gave you?",
    'What was your first job, and what did you learn from it?',
    "What's something you're looking forward to this week?",
    "What's a smell or a sound that takes you right back to being a kid?",
    "Is there something you've always wanted to learn?",
    // Local places and seasonal events are added from the community profile.
  ],
};

// Statewide touches for a community that has no localTouches of its own.
// Real, friendly, and non-commercial, and true anywhere in Indiana. Same shape
// as localTouches in src/community.js: { text, when, interest? }.
export const INDIANA_TOUCHES = [
  { text: 'Have you ever been to the Indiana State Fair? What do you remember most about it?', when: 'any' },
  {
    text: 'Indiana is known for high school basketball. Did you ever go to a big game when you were younger? What was the gym like?',
    when: 'any',
  },
  { text: 'Do you have a favorite Indiana state park, or a place you loved to go for a day trip?', when: 'any' },
  { text: "What's your favorite summer food? Some people say nothing beats Indiana sweet corn.", when: 'summer' },
  { text: 'The Indy 500 is this month! Did you ever go, or did you follow the race at home?', when: 'may' },
  { text: 'Thanksgiving is this month. What dish did your family always have on the table?', when: 'nov' },
  { text: 'What holiday traditions did you love growing up? Does {town} do anything special this time of year?', when: 'dec' },
  { text: 'Is there a lake or river in Indiana you love to fish? What makes it special?', when: 'summer', interest: 'fishing' },
  { text: "Is there a museum or gallery in Indiana you've enjoyed? What stuck with you?", when: 'any', interest: 'art' },
];

// One short coaching tip shown with every spark set.
export const VOLUNTEER_TIPS = [
  'Ask open-ended questions, then let them lead. A little silence is okay.',
  "Speak clearly and a bit slower than usual, but never talk down. They're the expert on their own life.",
  'Write down one detail they share so you can ask about it next time.',
  "If they bring up something hard, listen first. You don't have to fix it.",
  'If you notice a health or safety concern, tell your coordinator after the call.',
];
