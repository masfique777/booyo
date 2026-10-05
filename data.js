/* Booyo - content data (all original, all offline) */
window.TL_DATA = {
  activities: [
    { id: 'letters', emoji: '🔤', label: 'ABC',    say: 'Letters!',            bg: 'linear-gradient(135deg,#ff8a80,#ff5252)' },
    { id: 'numbers', emoji: '🔢', label: '123',    say: 'Numbers!',            bg: 'linear-gradient(135deg,#82b1ff,#448aff)' },
    { id: 'shapes',  emoji: '🔺', label: 'Shapes', say: 'Shapes and colors!',  bg: 'linear-gradient(135deg,#ffe57f,#ffc400)' },
    { id: 'stories', emoji: '📖', label: 'Stories',say: 'Stories!',            bg: 'linear-gradient(135deg,#b9f6ca,#00c853)' },
    { id: 'memory',  emoji: '🃏', label: 'Match',  say: 'Matching game!',      bg: 'linear-gradient(135deg,#ea80fc,#aa00ff)' },
    { id: 'storymaker', emoji: '✨', label: 'Make a Story', say: 'Make a story!', bg: 'linear-gradient(135deg,#ffab91,#ff7043)' }
  ],

  /* v3.1 Story Maker: the child picks one picture per step and Booyo tells the story.
     {kid} = the child's name (or "a little friend"); {Kid} = capitalized for titles. */
  storyMaker: {
    who: [
      { id: 'cat', e: '🐱', label: 'Cat', name: 'a little cat', short: 'the cat', title: 'The Cat' },
      { id: 'dino', e: '🦕', label: 'Dinosaur', name: 'a friendly dinosaur', short: 'the dinosaur', title: 'The Dinosaur' },
      { id: 'biscuit', e: '🐶', label: 'Biscuit the dog', name: 'a puppy called Biscuit', short: 'Biscuit', title: 'Biscuit' },
      { id: 'me', e: '🧒', label: '{kidL}', name: '{kid}', short: '{kidS}', title: '{Kid}', me: true }
    ],
    where: [
      { id: 'park', e: '🌳', label: 'Park', go: 'went to the park', title: 'at the Park' },
      { id: 'moon', e: '🌙', label: 'Moon', go: 'flew all the way to the moon', title: 'on the Moon' },
      { id: 'beach', e: '🏖️', label: 'Beach', go: 'went to the sunny beach', title: 'at the Beach' },
      { id: 'forest', e: '🌲', label: 'Forest', go: 'walked into the green forest', title: 'in the Forest' },
      { id: 'grandma', e: '🏡', label: 'Grandma\'s house', go: 'went to Grandma\'s house', title: 'at Grandma\'s House' }
    ],
    what: [
      { id: 'treasure', e: '💎', label: 'Treasure', did: 'found a shiny treasure' },
      { id: 'friend', e: '🤝', label: 'New friend', did: 'made a new friend' },
      { id: 'picnic', e: '🧺', label: 'Picnic', did: 'had a yummy picnic' },
      { id: 'rainbow', e: '🌈', label: 'Rainbow', did: 'saw a big rainbow' }
    ],
    end: [
      { id: 'dance', e: '💃', label: 'Dance party', did: 'had a dance party' },
      { id: 'nap', e: '😴', label: 'Nap', did: 'took a cozy nap' },
      { id: 'hug', e: '🤗', label: 'Big hug', did: 'gave everyone a big hug' },
      { id: 'dinner', e: '🍲', label: 'Home for dinner', did: 'went home for dinner' }
    ]
  },

  /* v3.2 Sing My Story: original lyrics. Each part is a rhyming couplet (two sung lines).
     {kid}/{Kid} = the child's name, or "our friend" / "Our friend" when no name is set. */
  song: {
    who: {
      cat:     ['Here comes a little cat, a cat, a cat,', 'Meow, meow, meow, and a tippy-tap-tap!'],
      dino:    ['Here comes a dinosaur, stomp, stomp, stomp,', 'A big friendly dino with a romp, romp, romp!'],
      biscuit: ['Here comes Biscuit, the puppy, the pup,', 'Wag, wag, wag, and a jump-jump-up!'],
      me:      ['Here comes {kid}, hello, hello,', '{Kid} is ready, so off we go!']
    },
    where: {
      park:    ['Off we go to the park, the park, the park,', 'Swing up high, and we sing like a lark!'],
      moon:    ['Off we go to the moon, the moon, the moon,', 'Up, up, up in a silver balloon!'],
      beach:   ['Off we go to the beach, the beach, the beach,', 'Sand and sea, and a shell for each!'],
      forest:  ['Off we go to the forest, the trees, the trees,', 'Tall and green, with a whoosh of breeze!'],
      grandma: ['Off we go to Grandma\'s, hooray, hooray,', 'Hugs and cookies, all the day!']
    },
    what: {
      treasure: ['Dig, dig, dig, what did we see?', 'A shiny treasure, one, two, three!'],
      friend:   ['Knock, knock, knock, who could it be?', 'A brand new friend for you and me!'],
      picnic:   ['Munch, munch, munch, a picnic treat,', 'Yummy, yummy, yummy, time to eat!'],
      rainbow:  ['Look up high, what can we see?', 'A rainbow bright, as bright can be!']
    },
    end: {
      dance:  ['Wiggle and jiggle and spin around,', 'A dance party, bounce up and down!'],
      nap:    ['Yawn, yawn, yawn, the stars are bright,', 'A cozy nap, good night, good night!'],
      hug:    ['Arms out wide, and squeeze, squeeze, squeeze,', 'A great big hug, yes please, yes please!'],
      dinner: ['Down the road and through the door,', 'Home for dinner, and a little bit more!']
    },
    outro: 'Hooray!',
    styles: [
      { id: 'lullaby', e: '🌙', label: 'Lullaby', say: 'Sleepy lullaby' },
      { id: 'march',   e: '🥁', label: 'March', say: 'Marching band' },
      { id: 'silly',   e: '🤪', label: 'Silly Bounce', say: 'Silly bounce' }
    ]
  },

  /* v3.3 EVERYTHING BOOYO SAYS: one source of truth. The app speaks only these lines (via TX(key, vars)), and
     Parent corner → Family Voices builds its "record every line" list from them, so a new line here is recordable automatically.
     Format: key: [section, text] or [section, [variant, variant, ...]] (Booyo picks one).
     "|" splits an utterance into separately recordable lines. Placeholders:
       {name}  the child's name: recorded in pieces (words before / the name clip / words after)
       {#n} {#a} {#b} {#ans}  a number: pieces around the recorded number clips (1–20)
       {L} {lis} {word} {wordl}  a letter · {n} a number 1–20 · {item} counting things · {c} color · {s} shape · {mem} {meml} matching card
       {title} {answer}  a story · {smwho} {smshort} {smgo} {smdid} {smend}  Make a Story picks
     A line with one kind of placeholder is listed once per value ("Find the letter A.", "Find the letter B.", …);
     a line that mixes kinds ("Tap the red circle!") is recorded in pieces. */
  say: {
    /* guided play */
    g_empty:   ['gplay', 'Ask a grown-up to turn on some games!'],
    g_ann_abc: ['gplay', "Let's learn some letters!"],
    g_ann_letters: ['gplay', "Let's find letters!"],
    g_ann_count: ['numbers', "Let's count {item}!"],
    g_ann_shapes: ['gplay', "Let's find shapes!"],
    g_ann_colors: ['gplay', "Let's find colors!"],
    g_ann_story: ['stories', "Story time!|Let's read {title}."],
    g_ann_memory: ['gplay', "Let's play a matching game!|Find two the same!"],
    g_ann_sm:  ['storymaker', "Let's make a story together!"],
    g_ann_play: ['gplay', "Let's play!"],
    g_go:      ['gplay', "Let's go!"],
    g_did:     ['praise', ['You did it!', 'Hooray! You did it!', 'Super job!', 'Yay! Well done!']],
    g_okay:    ['gplay', "That's okay!|Let's try something new."],
    g_okay2:   ['gplay', "Okay!|Let's try something new."],
    g_arrow:   ['gplay', 'Do you want to try something new?|Tap the arrow!'],
    g_nowtry:  ['gplay', 'Now you try!'],
    g_watch:   ['gplay', 'Watch me!'],
    g_like:    ['gplay', 'Like that!'],
    g_shiny:   ['gplay', 'Here it is!|Tap the shiny one.'],
    g_howmany: ['numbers', 'So, how many?'],
    g_abc_tap: ['lettergames', 'Tap the {wordl}!'],
    g_abc_got: ['letters', '{L}!|{word}!'],
    g_mem_demo1: ['memory', 'Watch me!|I tap a card.'],
    g_mem_demo2: ['memory', '{mem}!|Now I find another {meml}.'],
    g_mem_demo3: ['memory', 'Two the same!|A match!|Now you try!'],
    g_mem_find: ['memory', 'Find two the same!|Tap a card.'],
    /* hello, goodbye, breaks */
    s_hi:      ['session', "Hi {name}!|I'm Booyo the owl.|Let's play together!|Here we go!"],
    s_alldone: ['session', 'All done!'],
    s_today:   ['session', "That's all the playing for today!"],
    s_great:   ['session', 'Great job, {name}!'],
    s_earned:  ['session', 'You earned {#n} stars!'],
    s_earned1: ['session', 'You earned {#n} star!'],
    s_break:   ['session', "Now it's break time.|Let's stretch up high, drink some water, and play with toys."],
    s_bye:     ['session', 'Bye bye, {name}!|See you next time!'],
    s_sleepy:  ['session', "I'm getting sleepy.|Tap the sun when you want to play again!"],
    s_back:    ['session', "Yay! You're back!|Let's keep playing!"],
    s_twomin:  ['session', 'Two more minutes of play, then a break!'],
    s_brk:     ['session', 'Great playing today, {name}!|Time for a break.|Let us stretch, drink some water, and play with toys.'],
    s_test:    ['session', 'Hi {name}!|Let us learn and play!'],
    /* menus & games */
    m_home:    ['menus', 'Hi {name}!|What do you want to play?'],
    m_more:    ['menus', 'More games!|Tap a picture.'],
    m_again:   ['menus', 'Play again, or go home?'],
    m_letters: ['menus', 'Letters!|Tap A B C to learn letters.|Tap the magnifying glass to find letters.'],
    m_tapletter: ['menus', 'Tap a letter!'],
    m_stories: ['stories', 'Story time!|Pick a story.'],
    m_memory:  ['memory', 'Find the matching pairs!|Tap two cards.'],
    /* letters */
    l_say:     ['letters', 'The letter {L}.|{lis}'],
    q_start:   ['lettergames', 'Which letter does {word} start with?'],
    q_start_ok: ['lettergames', '{word} starts with {L}!'],
    q_lower:   ['lettergames', 'Find the little {L}.'],
    q_lower_ok: ['lettergames', 'That is a little {L}!'],
    q_find:    ['lettergames', 'Find the letter {L}.'],
    q_find_ok: ['letters', '{lis}'],
    /* numbers */
    n_count:   ['numbers', 'How many {item}?|Tap them to count!'],
    n_count_ok: ['numbers', '{#n} {item}!'],
    n_counted: ['numbers', '{#n}'],
    n_add:     ['numbers', '{#a} {item} plus {#b} more.|How many {item} in all?'],
    n_add_ok:  ['numbers', '{#a} plus {#b} makes {#ans}!'],
    n_find:    ['numbers', 'Find the number {n}.'],
    n_find_ok: ['numbers', 'That is {n}!'],
    /* colors & shapes */
    c_color:   ['colors', 'Tap the {c} one!'],
    c_shape:   ['colors', 'Find the {s}!'],
    c_both:    ['colors', 'Tap the {c} {s}!'],
    c_ok:      ['colors', 'The {c} {s}!'],
    /* matching game */
    mm_name:   ['memory', '{mem}'],
    mm_match:  ['memory', '{mem}!|You found a match!'],
    mm_again:  ['memory', "{mem}.|Let's look again!"],
    /* stories (the pages themselves come from "stories" below) */
    st_intro:  ['stories', 'The end!|Now a question.'],
    st_ok:     ['stories', 'It was {answer}!'],
    /* Make a Story */
    sm_hello:  ['storymaker', "Let's make a story!"],
    sm_ask_who: ['storymaker', 'Who is in the story?|Tap a picture.'],
    sm_ask_where: ['storymaker', 'Where do they go?|Tap a picture.'],
    sm_ask_what: ['storymaker', 'What happens?|Tap a picture.'],
    sm_ask_end: ['storymaker', 'How does it end?|Tap a picture.'],
    sm_p_who:  ['storymaker', 'Once upon a time, there was {smwho}.'],
    sm_p_where: ['storymaker', '{smshort} {smgo}.'],
    sm_p_what: ['storymaker', 'There, {smshort} {smdid}.'],
    sm_p_end:  ['storymaker', 'At the end, {smshort} {smend}.'],
    sm_clip:   ['storymaker', 'And {name} said:'],
    sm_clip0:  ['storymaker', 'And our little author said:'],
    sm_sayit:  ['storymaker', 'Now you!|Hold the microphone and say something for your story.'],
    sm_nohear: ['storymaker', "I didn't hear that.|Hold the microphone and talk!"],
    sm_listen: ['storymaker', 'Listen to you!'],
    sm_skip:   ['storymaker', "That's okay!|Let's hear your story."],
    sm_wow:    ['storymaker', 'What a wonderful story!'],
    sm_by:     ['storymaker', 'A story by {name}.'],
    sm_by0:    ['storymaker', 'A story by a little author.'],
    sm_theend: ['storymaker', 'The end!'],
    sm_cover:  ['storymaker', 'Tap the book to hear it again, the music note to sing it, or the arrow to keep playing!'],
    sm_again:  ['storymaker', 'Here is your story!|Read it again, or sing it!'],
    /* Sing My Story (the sung lines themselves come from "song" above) */
    sg_pick:   ['song', "Let's sing your story!|How should we sing it?|A sleepy lullaby, a marching band, or a silly bounce?"],
    sg_again:  ['song', 'Do you want to sing again?'],
    sg_done:   ['song', 'Hooray!|What a song!|Sing it again?']
  },
  /* praise and "try again" lines: Booyo picks one at random (Family Voices plays any recorded one, for variety) */
  praise: ['Great job!', 'You did it!', 'Wonderful!', 'Super!', 'Yay! That is right!', 'Awesome!', 'Hooray!', 'Well done!'],
  tryAgain: ['Nice try!', 'Good trying! Let us try again.', 'Almost! You can do it.', 'Keep going!', 'Ooh, so close!'],
  /* Family Voices sections, in the order the parent sees them */
  voiceSections: [
    { id: 'guide', icon: '⭐', title: 'Start here: most-heard lines' },
    { id: 'session', icon: '👋', title: 'Hello, goodbye & breaks' },
    { id: 'praise', icon: '🎉', title: 'Praise & try again' },
    { id: 'gplay', icon: '🦉', title: 'Guided play: demos & help' },
    { id: 'menus', icon: '🏠', title: 'Menus & games' },
    { id: 'letters', icon: '🔤', title: 'Letters A–Z' },
    { id: 'lettergames', icon: '🔍', title: 'Letter games' },
    { id: 'numbers', icon: '🔢', title: 'Numbers & counting' },
    { id: 'colors', icon: '🎨', title: 'Colors & shapes' },
    { id: 'memory', icon: '🃏', title: 'Matching game' },
    { id: 'stories', icon: '📖', title: 'Story time' },
    { id: 'storymaker', icon: '✨', title: 'Make a Story' },
    { id: 'song', icon: '🎵', title: 'Sing My Story' }
  ],

  letters: [
    { L: 'A', word: 'Apple', e: '🍎' }, { L: 'B', word: 'Bear', e: '🐻' },
    { L: 'C', word: 'Cat', e: '🐱' },   { L: 'D', word: 'Dog', e: '🐶' },
    { L: 'E', word: 'Elephant', e: '🐘' }, { L: 'F', word: 'Fish', e: '🐟' },
    { L: 'G', word: 'Grapes', e: '🍇' }, { L: 'H', word: 'House', e: '🏠' },
    { L: 'I', word: 'Ice cream', e: '🍦' }, { L: 'J', word: 'Juice', e: '🧃' },
    { L: 'K', word: 'Key', e: '🔑' },   { L: 'L', word: 'Lion', e: '🦁' },
    { L: 'M', word: 'Moon', e: '🌙' },  { L: 'N', word: 'Nose', e: '👃' },
    { L: 'O', word: 'Orange', e: '🍊' }, { L: 'P', word: 'Pig', e: '🐷' },
    { L: 'Q', word: 'Queen', e: '👸' }, { L: 'R', word: 'Rabbit', e: '🐰' },
    { L: 'S', word: 'Sun', e: '☀️' },   { L: 'T', word: 'Tree', e: '🌳' },
    { L: 'U', word: 'Umbrella', e: '☂️' }, { L: 'V', word: 'Violin', e: '🎻' },
    { L: 'W', word: 'Whale', e: '🐳' }, { L: 'X', word: 'Fox', e: '🦊', is: 'X is at the end of fox!', noStart: true },
    { L: 'Y', word: 'Yarn', e: '🧶' },  { L: 'Z', word: 'Zebra', e: '🦓' }
  ],

  countItems: [
    { e: '🦆', name: 'ducks' }, { e: '🍎', name: 'apples' }, { e: '🐟', name: 'fish' },
    { e: '⭐', name: 'stars' }, { e: '🚗', name: 'cars' }, { e: '🌸', name: 'flowers' },
    { e: '🐞', name: 'ladybugs' }, { e: '🎈', name: 'balloons' }, { e: '🍪', name: 'cookies' },
    { e: '🐥', name: 'chicks' }, { e: '🍓', name: 'strawberries' }, { e: '🐢', name: 'turtles' }
  ],
  numberWords: ['zero','one','two','three','four','five','six','seven','eight','nine','ten',
                'eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'],

  colors: {
    red: '#e53935', blue: '#1e88e5', yellow: '#fdd835', green: '#43a047',
    orange: '#fb8c00', purple: '#8e24aa', pink: '#f06292'
  },

  memory: [
    { e: '🐶', name: 'Dog' }, { e: '🐱', name: 'Cat' }, { e: '🐸', name: 'Frog' },
    { e: '🦁', name: 'Lion' }, { e: '🐵', name: 'Monkey' }, { e: '🐷', name: 'Pig' },
    { e: '🐰', name: 'Bunny' }, { e: '🐻', name: 'Bear' }, { e: '🐤', name: 'Chick' },
    { e: '🐘', name: 'Elephant' }
  ],

  /* Original short stories. {name} is replaced with the child's name. */
  stories: [
    {
      id: 'biscuit', title: 'Biscuit Finds the Ball', cover: '🐶', bg: '#fff3e0',
      pages: [
        { art: '🐶', text: 'This is Biscuit. Biscuit is a happy little puppy.' },
        { art: '🐶🔴❓', text: 'Biscuit wants to play with his red ball. But where is it?' },
        { art: '🛏️👀', text: 'Is it under the bed? No! Just a sleepy sock.' },
        { art: '🌳🌼', text: 'Is it in the garden? No! Just a buzzy bee.' },
        { art: '🧸📦🔴', text: 'Is it in the toy box? Yes! There it is!' },
        { art: '🐶🔴💛', text: 'Biscuit wags his tail. Woof woof! Time to play!' }
      ],
      q: { say: 'What was Biscuit looking for?', choices: [
        { e: '🔴', label: 'a red ball', correct: true }, { e: '🍌', label: 'a banana' }, { e: '🚗', label: 'a car' } ] }
    },
    {
      id: 'moon', title: 'The Sleepy Moon', cover: '🌙', bg: '#e8eaf6',
      pages: [
        { art: '🌙', text: 'When the sun goes down, the moon comes up.' },
        { art: '🌙😴', text: 'The moon gives a big, sleepy yawn. Aaah!' },
        { art: '⭐✨⭐', text: 'The stars come out to twinkle, twinkle, twinkle.' },
        { art: '🦉🌳', text: 'Owl sits in the tree and says, hoo hoo, good night!' },
        { art: '🛏️💤', text: 'Everyone snuggles in bed. Good night, moon. Good night, stars.' }
      ],
      q: { say: 'Who said hoo hoo, good night?', choices: [
        { e: '🦉', label: 'the owl', correct: true }, { e: '🐟', label: 'the fish' }, { e: '🐘', label: 'the elephant' } ] }
    },
    {
      id: 'ducky', title: "Ducky's Rainy Day", cover: '🦆', bg: '#e1f5fe',
      pages: [
        { art: '🦆☁️', text: 'Ducky looks up at the sky. Here come the clouds!' },
        { art: '🌧️🦆', text: 'Drip, drop, drip, drop. The rain begins to fall.' },
        { art: '🦆💦', text: 'Ducky jumps in a puddle. Splash! Splash! Splash!' },
        { art: '🐸🦆', text: 'Frog jumps in too. Ribbit! What fun!' },
        { art: '🌈☀️', text: 'Then the sun comes out, and look, a rainbow!' }
      ],
      q: { say: 'What came out after the rain?', choices: [
        { e: '🌈', label: 'a rainbow', correct: true }, { e: '🍕', label: 'a pizza' }, { e: '🚀', label: 'a rocket' } ] }
    },
    {
      id: 'apples', title: 'Three Red Apples', cover: '🍎', bg: '#ffebee',
      pages: [
        { art: '👧🧺', text: 'Mia takes her basket to the apple tree.' },
        { art: '🌳🍎', text: 'She picks one red apple. One!' },
        { art: '🍎🍎', text: 'She picks another red apple. Two!' },
        { art: '🍎🍎🍎', text: 'She picks one more red apple. Three!' },
        { art: '👧👦🧒', text: 'Mia shares her three apples with her friends. Yum!' }
      ],
      q: { say: 'How many apples did Mia pick?', choices: [
        { e: '3', label: 'three', correct: true, num: true }, { e: '1', label: 'one', num: true }, { e: '5', label: 'five', num: true } ] }
    },
    {
      id: 'helper', title: "{name}'s Helper Day", cover: '🦸', bg: '#f3e5f5',
      pages: [
        { art: '🌞🧒', text: 'Good morning, {name}! Today is a helper day.' },
        { art: '🪴💧', text: '{name} helps water the plants. Drink up, little plants!' },
        { art: '🐱🥣', text: '{name} feeds the kitty. Meow! Thank you!' },
        { art: '🍽️🥄', text: '{name} helps set the table for dinner.' },
        { art: '🤗❤️', text: 'Everyone says thank you, {name}. You are a super helper!' }
      ],
      q: { say: 'Who did {name} feed?', choices: [
        { e: '🐱', label: 'the kitty', correct: true }, { e: '🦒', label: 'a giraffe' }, { e: '🐙', label: 'an octopus' } ] }
    },
    {
      id: 'seed', title: 'The Little Seed', cover: '🌱', bg: '#e8f5e9',
      pages: [
        { art: '🟤', text: 'A tiny seed sleeps in the soil.' },
        { art: '☀️🟤', text: 'The warm sun says, wake up, little seed!' },
        { art: '🌧️🌱', text: 'The rain gives it a drink. A little sprout pops up!' },
        { art: '🌿🌿', text: 'It grows, and grows, and grows, tall and green.' },
        { art: '🌻😊', text: 'Now it is a big, bright sunflower!' }
      ],
      q: { say: 'What did the little seed grow into?', choices: [
        { e: '🌻', label: 'a sunflower', correct: true }, { e: '🚂', label: 'a train' }, { e: '🧦', label: 'a sock' } ] }
    }
  ],

  /* Off-screen activity ideas for the parent card. */
  ideas: {
    '2-3': [
      { e: '🥄', t: 'Counting spoons', how: 'Drop spoons into a bowl one at a time and count out loud together: 1, 2, 3!' },
      { e: '🔴', t: 'Color hunt', how: 'Pick one color. Walk around the house and find 3 things that are that color.' },
      { e: '🧦', t: 'Sock matching', how: 'Mix up a few pairs of socks and match them together. Name the colors.' },
      { e: '🥤', t: 'Cup tower', how: 'Stack plastic cups high, then knock them down. Count them as you stack.' },
      { e: '🐮', t: 'Animal sounds walk', how: 'Walk like different animals and make their sounds. Moo! Quack! Roar!' },
      { e: '🫧', t: 'Bubble pop count', how: 'Blow bubbles and count how many your child pops.' },
      { e: '🎶', t: 'Clap and sing', how: 'Sing a favorite song and clap along. Try clapping fast, then slow.' },
      { e: '📦', t: 'Big box play', how: 'Turn a cardboard box into a car, boat, or house. Talk about what you see.' }
    ],
    '4-5': [
      { e: '🔷', t: 'Shape hunt', how: 'Find circles, squares, and triangles around the house (plates, windows, sandwiches).' },
      { e: '🅱️', t: 'Letter of the day', how: 'Choose a letter. Find 5 things in the house that start with that sound.' },
      { e: '🟡', t: 'Playdough letters', how: 'Roll playdough into snakes and shape the letters of your child\'s name.' },
      { e: '👕', t: 'Laundry sorting', how: 'Sort clean socks or shirts by color, then count each pile.' },
      { e: '🍂', t: 'Nature collection', how: 'Collect leaves, rocks, or sticks outside. Sort them big to small and count them.' },
      { e: '🧱', t: 'Pattern blocks', how: 'Make a pattern with blocks or toys (red, blue, red, blue). What comes next?' },
      { e: '🎨', t: 'Draw your family', how: 'Draw everyone in the family and say (or write) each person\'s name.' },
      { e: '🦘', t: 'Number hop', how: 'Tape numbers 1 to 10 on the floor. Call a number and hop to it.' }
    ],
    '5-6': [
      { e: '✏️', t: 'Name writing', how: 'Write your name with chalk, crayon, or a finger in a tray of rice or salt.' },
      { e: '🥣', t: 'Kitchen measuring', how: 'With a grown-up, measure cups of rice or water. Which holds more?' },
      { e: '🧸', t: 'Story retell', how: 'Read a book, then act out the story with toys. What happened first, next, last?' },
      { e: '🎩', t: 'Rhyme time', how: 'Say a word (cat) and take turns finding rhymes (hat, bat, mat).' },
      { e: '🍝', t: 'Pasta necklace', how: 'String pasta or beads in a pattern. Count how many you used.' },
      { e: '🪙', t: 'Snack math', how: 'Use crackers: 2 crackers plus 3 crackers makes how many? Then eat them!' },
      { e: '🗺️', t: 'Room map', how: 'Draw a simple map of your bedroom. Hide a toy and use the map to find it.' },
      { e: '🌱', t: 'Grow a bean', how: 'Plant a bean in a wet paper towel in a cup. Draw how it changes each day.' }
    ]
  },

  breakIdeas: [
    { e: '🤸', t: 'Stretch' }, { e: '💧', t: 'Drink water' }, { e: '🧸', t: 'Play with toys' }, { e: '🌳', t: 'Look outside' }
  ]
};
