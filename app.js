/* Booyo - app logic. Vanilla JS, no network, data stays in localStorage. */
(function () {
  'use strict';
  var D = window.TL_DATA;

  /* ---------- helpers ---------- */
  function rand(n) { return Math.floor(Math.random() * n); }
  function pick(a) { return a[rand(a.length)]; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = rand(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function sample(a, n) { return shuffle(a).slice(0, n); }
  function todayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function h(tag, props) {
    var el = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } }
  };

  /* ---------- state ---------- */
  var SKILLS = ['letters', 'numbers', 'shapes', 'colors', 'stories', 'memory'];
  var DEFAULT_SETTINGS = {
    childName: '', ageBand: '4-5', guided: true, sessionLen: 0,
    activities: { letters: true, numbers: true, shapes: true, stories: true, memory: true, storymaker: true },
    limitMin: 20, sound: true, speechRate: 0.85, voiceURI: '', voiceStyle: 'soft', fullscreen: true, setupDone: false,   // v3.3: softer voice by default
    fvOn: false, fvActive: 'mix', fvLessons: true,   // v3 Family Voices: off by default
    smGuided: true, smSayIt: true,                    // v3.1 Story Maker
    sgSingAlong: true, sgLyrics: true, sgVol: 'soft', // v3.2 Sing My Story
    calm: false, schedule: false, extraTime: 'normal', bigTargets: false, tapMode: 'tap',   // v3.1 Calm & Accessible: all off
    contrast: false, captions: false, kbd: false, scan: false, scanSpeed: 1.5
  };
  var settings = Object.assign({}, DEFAULT_SETTINGS, store.get('tl_settings', {}));
  settings.activities = Object.assign({}, DEFAULT_SETTINGS.activities, settings.activities || {});

  function blankProgress() {
    var p = { stars: 0, activitiesDone: 0, skills: {}, sessions: {}, lettersSeen: [], days: {} };
    SKILLS.forEach(function (s) { p.skills[s] = 0; });
    D.activities.forEach(function (a) { p.sessions[a.id] = 0; });
    return p;
  }
  var progress = Object.assign(blankProgress(), store.get('tl_progress', {}));
  progress.skills = Object.assign(blankProgress().skills, progress.skills || {});
  progress.sessions = Object.assign(blankProgress().sessions, progress.sessions || {});
  var usage = store.get('tl_usage', { date: todayKey(), seconds: 0, bonusMin: 0 });

  function saveSettings() { store.set('tl_settings', settings); }
  function saveProgress() { store.set('tl_progress', progress); }
  function saveUsage() { store.set('tl_usage', usage); }
  function ensureUsageToday() {
    if (usage.date !== todayKey()) { usage = { date: todayKey(), seconds: 0, bonusMin: 0 }; saveUsage(); }
  }
  function name() { return (settings.childName || '').trim() || 'friend'; }
  function band() { return settings.ageBand || '4-5'; }
  function dayRec() {
    var k = todayKey();
    if (!progress.days[k]) progress.days[k] = { stars: 0, done: 0 };
    return progress.days[k];
  }
  function addStar(skills) {
    [].concat(skills).forEach(function (s) { progress.skills[s] = (progress.skills[s] || 0) + 1; });
    progress.stars++; dayRec().stars++;
    if (G.active && G.rec) G.rec.stars++;
    saveProgress();
    var sc = document.getElementById('starCount');
    if (sc) { sc.textContent = progress.stars; sc.parentNode.classList.remove('pulse'); void sc.offsetWidth; sc.parentNode.classList.add('pulse'); }
  }
  function activityDone(id) {
    progress.activitiesDone++; progress.sessions[id] = (progress.sessions[id] || 0) + 1; dayRec().done++;
    progress.lastPlayed = new Date().toISOString();
    saveProgress();
  }

  /* ---------- speech ---------- */
  /* v3.3 "Booyo's voice": Soft (default) is quieter, a touch slower and lower; Normal is the v3.2 voice. */
  var VOICE_STYLES = { soft: { vol: 0.75, rate: -0.05, pitch: 0.95, fx: 0.55 }, normal: { vol: 1, rate: 0, pitch: 1.05, fx: 1 } };
  function voiceProf() { return VOICE_STYLES[settings.voiceStyle] || VOICE_STYLES.soft; }
  var Speech = {
    ok: typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined',
    voices: [],
    load: function () {
      if (!this.ok) return;
      try { this.voices = window.speechSynthesis.getVoices().filter(function (v) { return /^en/i.test(v.lang); }); } catch (e) { this.voices = []; }
    },
    voice: function () {
      if (!this.voices.length) this.load();
      var vs = this.voices, i;
      for (i = 0; i < vs.length; i++) if (vs[i].voiceURI === settings.voiceURI) return vs[i];
      /* Score voices: on-device (works offline) first, then natural/enhanced warm voices, then US/other English.
         Novelty/robotic voices are pushed to the bottom. */
      var pref = [/natural/i, /neural/i, /premium/i, /enhanced/i, /samantha/i, /\bava\b/i, /allison/i, /susan/i, /karen/i, /moira/i, /tessa/i, /serena/i,
                  /google uk english female/i, /google us english/i, /aria/i, /jenny/i, /libby/i, /sonia/i, /zira/i, /hazel/i, /female/i];
      var warm = /natural|neural|premium|enhanced|female|samantha|\bava\b|allison|susan|karen|moira|tessa|serena|aria|jenny|libby|sonia|zira|hazel/i;
      var harsh = /\bmale\b|daniel|\balex\b|david|\bmark\b|\bguy\b|ryan|george|james|thomas|rishi|aaron|arthur/i;
      var odd = /compact|novelty|whisper|bad news|bells|boing|bubbles|cellos|zarvox|trinoids|albert|jester|organ|superstar|wobble|grandma|grandpa|eddy|flo\b|reed|rocko|sandy|shelley|junior|ralph|fred|kathy/i;
      var best = null, bestScore = -1e9;
      vs.forEach(function (v) {
        var sc = 0;
        if (v.localService) sc += 100;
        if (/en[-_]US/i.test(v.lang)) sc += 20; else if (/en[-_](GB|AU|CA|IE|NZ|IN)/i.test(v.lang)) sc += 10;
        for (var p = 0; p < pref.length; p++) if (pref[p].test(v.name)) { sc += 60 - p * 2; break; }
        if (odd.test(v.name)) sc -= 150;
        if (settings.voiceStyle !== 'normal') { if (warm.test(v.name) && !/\bmale\b/i.test(v.name.replace(/female/ig, ''))) sc += 30; if (harsh.test(v.name.replace(/female/ig, ''))) sc -= 40; }
        if (sc > bestScore) { bestScore = sc; best = v; }
      });
      return best;
    },
    /* say(): plays a family recording when Family Voices is on and the line was recorded, otherwise the built-in voice.
       Returns { clipMs, ttsChars } when recordings are used (talk() uses it for pacing), else null. */
    say: function (text, opts) {
      opts = opts || {};
      fvStop();
      if (TEST && text) (FV.allSaid = FV.allSaid || []).push(String(text));
      caption(text);
      var plan = fvPlan(text);
      if (plan) {
        var info = { clipMs: 0, ttsChars: 0 };
        plan.forEach(function (p) { if (p.clip) info.clipMs += p.clip.dur || 3000; else info.ttsChars += p.text.length; });
        fvSpeak(plan, opts);
        return info;
      }
      this.tts(text, opts);
      return null;
    },
    tts: function (text, opts) {
      opts = opts || {};
      if (text) { fvLog({ kind: 'tts', text: String(text) }); if (TEST) (FV.allTts = FV.allTts || []).push(String(text)); }
      var done = false, fin = function () { if (!done) { done = true; if (opts.onend) opts.onend(); } };
      if (!this.ok || !text) { setTimeout(fin, 50); return; }
      try {
        window.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(String(text).replace(/\bBooyo\b/g, 'Boo-yoh'));   // say the name the right way
        var v = this.voice();
        if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
        var vp = voiceProf();
        u.rate = Math.max(0.55, speechRate() + vp.rate); u.pitch = vp.pitch; u.volume = vp.vol;
        if (opts.onboundary) u.onboundary = opts.onboundary;
        u.onend = fin; u.onerror = fin;
        window.speechSynthesis.speak(u);
      } catch (e) { fin(); }
    },
    stop: function () { fvStop(); if (this.ok) { try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } } }
  };
  if (Speech.ok) {
    Speech.load();
    try { window.speechSynthesis.addEventListener('voiceschanged', function () { Speech.load(); fillVoiceSelect(); }); } catch (e) { /* old browser */ }
  }

  /* ---------- sound effects (Web Audio, generated, cheerful only) ---------- */
  var Sound = {
    ctx: null,
    get: function () {
      if (!this.ctx) { var C = window.AudioContext || window.webkitAudioContext; if (C) { try { this.ctx = new C(); } catch (e) { this.ctx = null; } } }
      return this.ctx;
    },
    resume: function () { var c = this.get(); if (c && c.state === 'suspended') c.resume(); },
    tone: function (f, start, dur, type, vol) {
      var c = this.get(); if (!c) return;
      var t0 = c.currentTime + start, o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime((vol || 0.12) * (settings.calm ? 0.35 : 1) * voiceProf().fx, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.05);
    },
    yay: function () { if (!settings.sound) return; var self = this; if (settings.calm) { [523.25, 659.25].forEach(function (f, i) { self.tone(f, i * 0.16, 0.45, 'sine', 0.08); }); return; } [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { self.tone(f, i * 0.09, 0.3, 'triangle'); }); },
    pop: function () { if (!settings.sound) return; this.tone(700, 0, 0.12, 'sine', 0.07); },
    flip: function () { if (!settings.sound) return; this.tone(520, 0, 0.1, 'sine', 0.05); }
  };

  var PRAISE = D.praise, ENCOURAGE = D.tryAgain;   // v3.3: all of Booyo's lines live in data.js

  /* ---------- screen management ---------- */
  var app = document.getElementById('app');
  var mode = 'kid', onBreak = false, repeatFn = null, token = 0, guardsOn = false, warned = false;
  function show(el, screen) {
    token++; Speech.stop(); repeatFn = null; Hand.hide(); idleStop(); if (SG.cur && screen !== 'sg-play') sgHalt(false); fvLeave(screen);
    Array.prototype.forEach.call(document.querySelectorAll('.confetti, .burst'), function (n) { n.remove(); });
    app.replaceChildren(el); app.setAttribute('data-screen', screen || '');
    window.scrollTo(0, 0);
    kbdAfterShow(el); if (settings.scan) { Scan.cur = null; scanSync(); }
  }
  /* setTimeout that is cancelled automatically if the screen changes */
  function later(fn, ms) { var t = token; setTimeout(function () { if (t === token) fn(); }, ms); }

  function kidBar(opts) {
    opts = opts || {};
    var left = opts.home === false
      ? h('button', { class: 'kbtn lock', 'aria-label': 'Grown-ups', title: 'Grown-ups', onclick: function () { openGate(parentMode); } }, '🔒')
      : h('button', { class: 'kbtn home', 'aria-label': 'Home', onclick: function () { Sound.pop(); (opts.back || kidHome)(); } }, opts.back ? '⬅️' : '🏠');
    return h('header', { class: 'kidbar' },
      left,
      opts.back ? h('button', { class: 'kbtn home', 'aria-label': 'Home', onclick: function () { Sound.pop(); kidHome(); } }, '🏠') : null,
      h('div', { class: 'kidtitle', 'aria-hidden': 'true' }),
      h('button', { class: 'kbtn speak', 'aria-label': 'Say it again', onclick: function () { if (repeatFn) repeatFn(); } }, '🔊'));
  }

  function confetti() {
    if (calmish()) return;
    var em = ['⭐', '🌟', '🎉', '✨', '🎈', '💖'];
    var box = h('div', { class: 'confetti', 'aria-hidden': 'true' });
    for (var i = 0; i < 26; i++) {
      box.appendChild(h('span', { style: { left: rand(100) + '%', animationDelay: (Math.random() * 0.6) + 's', fontSize: (24 + rand(28)) + 'px' } }, pick(em)));
    }
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 2800);
  }
  function burst(el) {
    if (calmish()) return;
    var r = el.getBoundingClientRect();
    var s = h('div', { class: 'burst', 'aria-hidden': 'true', style: { left: (r.left + r.width / 2) + 'px', top: (r.top + r.height / 2) + 'px' } }, '⭐');
    document.body.appendChild(s);
    setTimeout(function () { s.remove(); }, 1000);
  }

  /* ---------- kid home ---------- */
  var OPEN = {};
  var TILE_TONES = ['tone-teal', 'tone-sun', 'tone-sky', 'tone-mint'];
  function actTile(a, i) {
    return h('button', { class: 'tile ' + TILE_TONES[i % TILE_TONES.length], 'data-act': a.id, 'aria-label': a.say, onclick: function () { Sound.pop(); OPEN[a.id](); } },
      h('span', { class: 'tile-emoji' }, a.emoji), h('span', { class: 'tile-label' }, a.label));
  }
  /* v3.3 kid home: one big "Play with Booyo" (guided) button, at most 4 big tiles; everything else is behind "More" */
  function kidHome() {
    mode = 'kid'; enterKidGuards();
    if (isOverLimit()) return showBreak();
    var acts = D.activities.filter(function (a) { return settings.activities[a.id]; });
    var greet = TX('m_home');
    var main = acts.length <= 4 ? acts : acts.slice(0, 3), rest = acts.length <= 4 ? [] : acts.slice(3);
    var tiles = main.map(actTile);
    if (rest.length) tiles.push(h('button', { class: 'tile tone-more', id: 'moreTile', 'aria-label': 'More games', onclick: function () { Sound.pop(); kidMore(); } },
      h('span', { class: 'tile-emoji' }, rest.map(function (a) { return a.emoji; }).slice(0, 3).join('')), h('span', { class: 'tile-label' }, 'More')));
    var play = acts.length ? h('button', { class: 'play-booyo', id: 'playBooyo', 'aria-label': 'Play with Booyo', onclick: function () { G.fromHome = true; beginSession(); } },
      h('img', { src: 'icons/icon-192.png', alt: '', width: '192', height: '192' }), h('span', {}, 'Play with Booyo')) : null;
    var body = acts.length
      ? h('div', { class: 'tiles n' + tiles.length }, tiles)
      : h('div', { class: 'empty' }, h('div', { class: 'big-emoji' }, '🧸'), h('p', {}, 'Ask a grown-up to turn on some games.'));
    show(h('main', { class: 'screen kid home-screen' },
      kidBar({ home: false }),
      h('h1', { class: 'hello' }, 'Hi ' + name() + '! 👋'),
      play, body), 'kidHome');
    repeatFn = function () { Speech.say(greet); };
    Speech.say(greet);
  }
  function kidMore() {
    var acts = D.activities.filter(function (a) { return settings.activities[a.id]; }).slice(3);
    var say = TX('m_more');
    show(h('main', { class: 'screen kid home-screen more-screen' },
      kidBar({}),
      h('div', { class: 'tiles n' + acts.length }, acts.map(function (a, i) { return actTile(a, i + 1); }))), 'kidMore');
    repeatFn = function () { Speech.say(say); };
    Speech.say(say);
  }

  function splash() {
    mode = 'kid';
    var go = function () { Sound.resume(); fvUnlock(); kidHome(); };
    show(h('main', { class: 'screen kid splash' },
      h('img', { class: 'brand-icon bounce', src: 'icons/icon-512.png', alt: 'Booyo', width: '512', height: '512' }),
      h('h1', { class: 'hello' }, 'Hi ' + name() + '!'),
      h('button', { class: 'play-btn', 'aria-label': 'Start', onclick: go }, '▶')), 'splash');
  }

  /* ---------- generic quiz engine ---------- */
  function progressDots(done, total) {
    var row = h('div', { class: 'dots', 'aria-hidden': 'true' });
    for (var i = 0; i < total; i++) row.appendChild(h('span', { class: i < done ? 'dot on' : 'dot' }));
    return row;
  }
  function runQuiz(cfg) {
    var round = 0, earned = 0;
    function next() {
      if (round >= cfg.rounds) return celebrate(cfg, earned);
      var q = cfg.make(round), locked = false;
      var grid = h('div', { class: 'choices c' + q.choices.length + (q.wide ? ' wide' : '') });
      q.choices.forEach(function (c) {
        var b = h('button', { class: 'choice', 'aria-label': c.label }, c.el);
        b.addEventListener('click', function () {
          if (locked || b.disabled) return;
          if (c.correct) {
            locked = true; b.classList.add('right'); earned++;
            addStar(q.skill || cfg.skill); Sound.yay(); burst(b);
            Speech.say(pick(PRAISE) + ' ' + (q.after || ''));
            later(next, 1900);
          } else {
            b.classList.add('soft'); b.disabled = true;
            Speech.say(pick(ENCOURAGE) + ' ' + q.say);
          }
        });
        grid.appendChild(b);
      });
      round++;
      show(h('main', { class: 'screen kid quiz ' + (cfg.cls || '') },
        kidBar({ title: cfg.title, back: cfg.back }),
        cfg.rounds > 1 ? progressDots(round - 1, cfg.rounds) : null,
        h('section', { class: 'prompt' }, q.visual || null, q.text ? h('p', { class: 'ptext' }, q.text) : null),
        grid), cfg.id);
      repeatFn = function () { Speech.say(q.say); };
      Speech.say(q.intro ? q.intro + ' ' + q.say : q.say);
    }
    next();
  }
  function celebrate(cfg, earned) {
    activityDone(cfg.id);
    var msg = TX('s_great') + ' ' + TX(earned === 1 ? 's_earned1' : 's_earned', { n: earned });
    show(h('main', { class: 'screen kid celebrate' },
      kidBar({}),
      h('div', { class: 'big-emoji bounce' }, '🏆'),
      h('h1', { class: 'hello' }, 'Great job, ' + name() + '!'),
      h('div', { class: 'earned', 'aria-label': earned + ' stars' }, earned ? '⭐'.repeat(Math.min(earned, 12)) : '💖'),
      h('div', { class: 'row' },
        h('button', { class: 'bigbtn green', 'aria-label': 'Play again', onclick: function () { Sound.pop(); cfg.again(); } }, '🔁'),
        h('button', { class: 'bigbtn blue', 'aria-label': 'Home', onclick: function () { Sound.pop(); kidHome(); } }, '🏠'))), 'celebrate');
    confetti(); Sound.yay();
    repeatFn = function () { Speech.say(msg); };
    Speech.say(msg + ' ' + TX('m_again'));
  }

  /* ---------- letters ---------- */
  function lettersMenu() {
    var say = TX('m_letters');
    show(h('main', { class: 'screen kid' },
      kidBar({ title: '🔤' }),
      h('div', { class: 'menu2' },
        h('button', { class: 'menu-btn', style: { background: 'linear-gradient(135deg,#ff8a80,#ff5252)' }, 'aria-label': 'Learn letters', onclick: function () { Sound.pop(); lettersExplore(); } },
          h('span', { class: 'tile-emoji' }, 'ABC'), h('span', { class: 'tile-label' }, 'Learn')),
        h('button', { class: 'menu-btn', style: { background: 'linear-gradient(135deg,#ffd180,#ff9100)' }, 'aria-label': 'Find the letter', onclick: function () { Sound.pop(); findLetterGame(); } },
          h('span', { class: 'tile-emoji' }, '🔍'), h('span', { class: 'tile-label' }, 'Find')))), 'lettersMenu');
    repeatFn = function () { Speech.say(say); };
    Speech.say(say);
  }
  var ARROW_L = function () { return h('span', { class: 'arrow-txt' }, '\u25C0\uFE0E'); };
  var ARROW_R = function () { return h('span', { class: 'arrow-txt r' }, '\u25B6\uFE0E'); };
  var TILE_COLORS = ['#ef5350', '#ab47bc', '#5c6bc0', '#29b6f6', '#26a69a', '#9ccc65', '#ffca28', '#ffa726', '#ec407a', '#7e57c2'];
  function lettersExplore() {
    var grid = h('div', { class: 'letter-grid' });
    D.letters.forEach(function (l, i) {
      var seen = progress.lettersSeen.indexOf(l.L) >= 0;
      grid.appendChild(h('button', { class: 'letter-tile' + (seen ? ' seen' : ''), style: { background: TILE_COLORS[i % TILE_COLORS.length] }, 'aria-label': 'Letter ' + l.L,
        onclick: function () { Sound.pop(); letterCard(i); } }, l.L));
    });
    var say = TX('m_tapletter');
    show(h('main', { class: 'screen kid' }, kidBar({ title: 'ABC', back: lettersMenu }), grid), 'lettersExplore');
    repeatFn = function () { Speech.say(say); };
    Speech.say(say);
  }
  function letterSay(l) { return TX('l_say', { letter: l }); }
  function letterCard(i) {
    var l = D.letters[i];
    if (progress.lettersSeen.indexOf(l.L) < 0) { progress.lettersSeen.push(l.L); saveProgress(); }
    var card = h('div', { class: 'letter-card', style: { borderColor: TILE_COLORS[i % TILE_COLORS.length] } },
      h('div', { class: 'lc-letters', style: { color: TILE_COLORS[i % TILE_COLORS.length] } }, l.L + l.L.toLowerCase()),
      h('button', { class: 'lc-emoji', 'aria-label': l.word, onclick: function () { Speech.say(letterSay(l)); } }, l.e),
      h('div', { class: 'lc-word' }, l.L === 'X' ? h('span', {}, 'Fo', h('b', {}, 'x')) : h('span', {}, h('b', {}, l.word.charAt(0)), l.word.slice(1))));
    show(h('main', { class: 'screen kid' },
      kidBar({ title: 'ABC', back: lettersExplore }),
      card,
      h('div', { class: 'row' },
        h('button', { class: 'bigbtn blue', 'aria-label': 'Previous letter', onclick: function () { Sound.pop(); letterCard((i + 25) % 26); } }, ARROW_L()),
        h('button', { class: 'bigbtn green', 'aria-label': 'Next letter', onclick: function () { Sound.pop(); letterCard((i + 1) % 26); } }, ARROW_R()))), 'letterCard');
    repeatFn = function () { Speech.say(letterSay(l)); };
    Speech.say(letterSay(l));
  }
  /* Question makers are shared by the v1 menus and the v2 guided session.
     Each returns { choices, visual, text, say, after, desc, skill? }. desc is a short parent-facing note for the report. */
  function letterQ(o) {
    var n = o.n, type = pick(o.types);
    var pool = type === 'start' ? D.letters.filter(function (l) { return !l.noStart; }) : D.letters;
    var target = pick(pool);
    var others = sample(D.letters.filter(function (l) { return l.L !== target.L; }), n - 1);
    var lower = type === 'lower';
    var choices = shuffle([target].concat(others)).map(function (l) {
      return { label: l.L, correct: l.L === target.L, el: h('span', { class: 'big-letter' }, lower ? l.L.toLowerCase() : l.L) };
    });
    if (type === 'start') {
      return { choices: choices, visual: h('div', { class: 'prompt-emoji' }, target.e), text: target.word + ' → ?',
        say: TX('q_start', { letter: target }), after: TX('q_start_ok', { letter: target }), desc: 'first letter of "' + target.word + '"' };
    }
    if (lower) {
      return { choices: choices, visual: h('div', { class: 'prompt-letter' }, target.L, h('span', { class: 'arrow' }, ' → '), '?'),
        say: TX('q_lower', { letter: target }), after: TX('q_lower_ok', { letter: target }), desc: 'lowercase ' + target.L.toLowerCase() };
    }
    return { choices: choices, visual: h('div', { class: 'prompt-letter' }, '🔍 ', target.L),
      say: TX('q_find', { letter: target }), after: TX('q_find_ok', { letter: target }), desc: 'find the letter ' + target.L };
  }
  function findLetterGame() {
    var n = { '2-3': 2, '4-5': 3, '5-6': 4 }[band()];
    var types = band() === '5-6' ? ['find', 'start', 'lower'] : band() === '4-5' ? ['find', 'find', 'start'] : ['find'];
    runQuiz({
      id: 'letters', title: '🔍', skill: 'letters', rounds: 5, back: lettersMenu, again: findLetterGame,
      make: function () { return letterQ({ n: n, types: types }); }
    });
  }

  /* ---------- numbers ---------- */
  function numberChoices(ans, n, min, max) {
    var cands = [];
    for (var x = min; x <= max; x++) if (x !== ans) cands.push(x);
    cands.sort(function (a, b) { return (Math.abs(a - ans) + Math.random() * 2) - (Math.abs(b - ans) + Math.random() * 2); });
    return shuffle([ans].concat(cands.slice(0, n - 1)));
  }
  /* o: { max, n, types, item?, min? } */
  function numberQ(o) {
    var type = pick(o.types), item = o.item || pick(D.countItems), ans, visual, say, text, after, lo = o.min || 1;
    if (type === 'count') {
      ans = lo + rand(Math.max(1, o.max - lo + 1));
      var counted = 0, grid = h('div', { class: 'count-grid' + (ans > 10 ? ' many' : '') });
      var q = { choices: numberChoices(ans, o.n, 1, Math.max(o.max, o.n)).map(numChoice(ans)), visual: grid, countGrid: grid,
        say: TX('n_count', { item: item }), after: TX('n_count_ok', { n: ans, item: item }), desc: 'count ' + ans + ' ' + item.name, onAllCounted: null };
      for (var i = 0; i < ans; i++) {
        (function () {
          var s = h('button', { class: 'count-item', 'aria-label': item.name }, item.e);
          s.addEventListener('click', function () {
            if (s.classList.contains('counted')) return;
            counted++; s.classList.add('counted'); s.setAttribute('data-n', counted);
            Sound.flip(); Speech.say(TX('n_counted', { n: counted }));
            if (counted === ans && q.onAllCounted) q.onAllCounted();
          });
          grid.appendChild(s);
        })();
      }
      return q;
    }
    if (type === 'add') {
      var a = 1 + rand(5), b = 1 + rand(5); ans = a + b;
      visual = h('div', { class: 'add-row' },
        addGroup(item.e, a), h('div', { class: 'op' }, '+'), addGroup(item.e, b));
      text = a + ' + ' + b + ' = ?';
      say = TX('n_add', { a: a, b: b, item: item });
      after = TX('n_add_ok', { a: a, b: b, ans: ans });
      return { choices: numberChoices(ans, o.n, 2, 10).map(numChoice(ans)), visual: visual, text: text, say: say, after: after, desc: a + ' + ' + b };
    }
    ans = 1 + rand(o.max);
    visual = h('div', { class: 'prompt-letter' }, '🔍 ', band() === '5-6' ? h('span', { class: 'numword' }, D.numberWords[ans]) : String(ans));
    say = TX('n_find', { n: ans }); after = TX('n_find_ok', { n: ans });
    return { choices: numberChoices(ans, o.n, 1, Math.max(o.max, o.n)).map(numChoice(ans)), visual: visual, say: say, after: after, desc: 'find the number ' + ans };
  }
  function numberGame() {
    var cfgN = { '2-3': { max: 5, n: 2, types: ['count', 'count', 'find'] },
                 '4-5': { max: 10, n: 3, types: ['count', 'count', 'find'] },
                 '5-6': { max: 15, n: 4, types: ['count', 'add', 'add', 'find'] } }[band()];
    runQuiz({
      id: 'numbers', title: '🔢', skill: 'numbers', rounds: 5, again: numberGame,
      make: function () { return numberQ(cfgN); }
    });
  }
  function addGroup(e, n) {
    var g = h('div', { class: 'add-group' });
    for (var i = 0; i < n; i++) g.appendChild(h('span', {}, e));
    return g;
  }
  function numChoice(ans) {
    return function (v) { return { label: String(v), correct: v === ans, el: h('span', { class: 'big-num' }, String(v)) }; };
  }

  /* ---------- shapes & colors ---------- */
  function starPoints() {
    var pts = [];
    for (var i = 0; i < 10; i++) {
      var r = i % 2 === 0 ? 44 : 19, a = Math.PI / 5 * i - Math.PI / 2;
      pts.push((50 + r * Math.cos(a)).toFixed(1) + ',' + (53 + r * Math.sin(a)).toFixed(1));
    }
    return pts.join(' ');
  }
  var SHAPE_SVG = {
    circle: '<circle cx="50" cy="50" r="40"/>',
    square: '<rect x="12" y="12" width="76" height="76" rx="6"/>',
    triangle: '<polygon points="50,9 93,88 7,88"/>',
    star: '<polygon points="' + starPoints() + '"/>',
    heart: '<path d="M50 88 C18 64 4 44 12 27 C20 10 42 10 50 28 C58 10 80 10 88 27 C96 44 82 64 50 88Z"/>',
    rectangle: '<rect x="4" y="24" width="92" height="52" rx="5"/>',
    oval: '<ellipse cx="50" cy="50" rx="45" ry="29"/>',
    diamond: '<polygon points="50,5 90,50 50,95 10,50"/>'
  };
  function shapeEl(shape, color, outline) {
    var fill = outline ? 'none' : D.colors[color];
    var stroke = outline ? '#546e7a' : 'rgba(0,0,0,.35)';
    var dash = outline ? ' stroke-dasharray="7 5"' : '';
    return h('span', { class: 'shape', html: '<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true"><g fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (outline ? 5 : 3) + '"' + dash + ' stroke-linejoin="round">' + SHAPE_SVG[shape] + '</g></svg>' });
  }
  function colorBlob(color) { return h('span', { class: 'blob', style: { background: D.colors[color] } }); }
  var SHAPE_CFG = {
    '2-3': { shapes: ['circle', 'square', 'triangle'], colors: ['red', 'blue', 'yellow', 'green'], n: 2, types: ['color', 'shape'] },
    '4-5': { shapes: ['circle', 'square', 'triangle', 'star', 'heart', 'rectangle'], colors: ['red', 'blue', 'yellow', 'green', 'orange', 'purple'], n: 3, types: ['color', 'shape', 'both', 'both'] },
    '5-6': { shapes: Object.keys(SHAPE_SVG), colors: Object.keys(D.colors), n: 4, types: ['both', 'both', 'shape', 'color'] }
  };
  /* o: { shapes, colors, n, types } */
  function shapeQ(o) {
    var type = pick(o.types), n = o.n, combos, target, visual, say, skill, text, desc;
    if (type === 'color') {
      var s = pick(o.shapes), cols = sample(o.colors, n);
      target = { s: s, c: cols[0] }; combos = cols.map(function (c) { return { s: s, c: c }; });
      visual = colorBlob(target.c); text = target.c; say = TX('c_color', { c: target.c }); skill = 'colors'; desc = 'the color ' + target.c;
    } else if (type === 'shape') {
      var c = pick(o.colors), shs = sample(o.shapes, n);
      target = { s: shs[0], c: c }; combos = shs.map(function (x) { return { s: x, c: c }; });
      visual = shapeEl(target.s, null, true); text = target.s; say = TX('c_shape', { s: target.s }); skill = 'shapes'; desc = 'the shape ' + target.s;
    } else {
      target = { s: pick(o.shapes), c: pick(o.colors) };
      combos = [target];
      var key = function (x) { return x.s + '|' + x.c; }, seen = {}; seen[key(target)] = 1;
      var tries = 0;
      while (combos.length < n && tries < 200) {
        tries++;
        var r = rand(3), x = r === 0 ? { s: target.s, c: pick(o.colors) } : r === 1 ? { s: pick(o.shapes), c: target.c } : { s: pick(o.shapes), c: pick(o.colors) };
        if (!seen[key(x)]) { seen[key(x)] = 1; combos.push(x); }
      }
      visual = h('div', { class: 'both-hint' }, colorBlob(target.c), h('span', { class: 'op' }, '+'), shapeEl(target.s, null, true));
      text = target.c + ' ' + target.s; say = TX('c_both', { c: target.c, s: target.s }); skill = ['shapes', 'colors']; desc = target.c + ' ' + target.s;
    }
    var choices = shuffle(combos).map(function (x) {
      return { label: x.c + ' ' + x.s, correct: x.s === target.s && x.c === target.c, el: shapeEl(x.s, x.c) };
    });
    return { choices: choices, visual: visual, text: text, say: say, skill: skill, after: TX('c_ok', { c: target.c, s: target.s }), desc: desc };
  }
  function shapesGame() {
    var cfgS = SHAPE_CFG[band()];
    runQuiz({
      id: 'shapes', title: '🔺🔵', skill: 'shapes', rounds: 5, again: shapesGame,
      make: function () { return shapeQ(cfgS); }
    });
  }

  /* ---------- stories ---------- */
  function storyName() { return (settings.childName || '').trim() || 'Sam'; }
  function fillName(t) { return String(t).replace(/\{name\}/g, storyName()); }
  function storyList() {
    var say = TX('m_stories');
    show(h('main', { class: 'screen kid' },
      kidBar({ title: '📖' }),
      h('div', { class: 'story-grid' }, D.stories.map(function (s) {
        return h('button', { class: 'story-cover', style: { background: s.bg }, 'aria-label': fillName(s.title),
          onclick: function () { Sound.pop(); readStory(s, 0); } },
          h('span', { class: 'cover-emoji' }, s.cover), h('span', { class: 'cover-title' }, fillName(s.title)));
      }))), 'storyList');
    repeatFn = function () { Speech.say(say); };
    Speech.say(say);
  }
  function readStory(story, idx) {
    var page = story.pages[idx], text = fillName(page.text), last = idx === story.pages.length - 1;
    var words = [], pos = 0;
    var para = h('p', { class: 'story-text' });
    text.split(/(\s+)/).forEach(function (part) {
      if (/^\s+$/.test(part) || !part) { para.appendChild(document.createTextNode(part)); pos += part.length; return; }
      var sp = h('span', { class: 'w' }, part); words.push({ start: pos, end: pos + part.length, el: sp }); para.appendChild(sp); pos += part.length;
    });
    function readAloud() {
      words.forEach(function (w) { w.el.classList.remove('hl'); });
      Speech.say((idx === 0 ? '' : '') + text, {
        onboundary: function (e) {
          if (typeof e.charIndex !== 'number') return;
          words.forEach(function (w) { w.el.classList.toggle('hl', e.charIndex >= w.start && e.charIndex < w.end); });
        },
        onend: function () { words.forEach(function (w) { w.el.classList.remove('hl'); }); }
      });
    }
    show(h('main', { class: 'screen kid story', style: { background: story.bg } },
      kidBar({ title: fillName(story.title), back: storyList }),
      progressDots(idx + 1, story.pages.length),
      h('button', { class: 'story-art', 'aria-label': 'Read again', onclick: readAloud }, page.art),
      para,
      h('div', { class: 'row' },
        h('button', { class: 'bigbtn blue', 'aria-label': 'Back', disabled: idx === 0, onclick: function () { Sound.pop(); readStory(story, idx - 1); } }, ARROW_L()),
        h('button', { class: 'bigbtn green', 'aria-label': last ? 'Question' : 'Next page', onclick: function () { Sound.pop(); if (last) storyQuestion(story); else readStory(story, idx + 1); } }, last ? '❓' : ARROW_R()))), 'storyPage');
    repeatFn = readAloud;
    readAloud();
  }
  function storyQuestion(story) {
    runQuiz({
      id: 'stories', title: fillName(story.title), skill: 'stories', rounds: 1, cls: 'story-q', back: storyList,
      again: function () { readStory(story, 0); },
      make: function () {
        return {
          intro: TX('st_intro'), say: fillName(story.q.say), text: '❓',
          choices: story.q.choices.map(function (c) {
            return { label: c.label, correct: !!c.correct, el: h('span', { class: c.num ? 'big-num' : 'choice-emoji' }, c.e) };
          }),
          after: TX('st_ok', { story: story })
        };
      }
    });
  }

  /* ---------- memory / matching ---------- */
  function memoryGame() {
    var pairs = { '2-3': 3, '4-5': 4, '5-6': 6 }[band()];
    var items = sample(D.memory, pairs);
    var cards = shuffle(items.concat(items)).map(function (it) { return { it: it, open: false, done: false, el: null }; });
    var first = null, busy = false, matched = 0;
    var grid = h('div', { class: 'mem-grid m' + cards.length });
    function render(c) { c.el.classList.toggle('open', c.open || c.done); c.el.classList.toggle('done', c.done); }
    cards.forEach(function (c) {
      c.el = h('button', { class: 'mem-card', 'aria-label': 'Card' },
        h('span', { class: 'back' }, '❓'), h('span', { class: 'front' }, c.it.e));
      c.el.addEventListener('click', function () {
        if (busy || c.open || c.done) return;
        c.open = true; render(c); Sound.flip();
        if (!first) { first = c; Speech.say(TX('mm_name', { mem: c.it })); return; }
        var a = first; first = null;
        if (a.it === c.it) {
          a.done = c.done = true; render(a); render(c); matched++;
          addStar('memory'); Sound.yay(); burst(c.el);
          Speech.say(TX('mm_match', { mem: c.it }));
          if (matched === pairs) later(function () { celebrate({ id: 'memory', again: memoryGame }, pairs); }, 1800);
        } else {
          busy = true; Speech.say(TX('mm_again', { mem: c.it }));
          later(function () { a.open = c.open = false; render(a); render(c); busy = false; }, 1300);
        }
      });
      grid.appendChild(c.el);
    });
    var say = TX('m_memory');
    show(h('main', { class: 'screen kid' }, kidBar({ title: '🃏' }), grid), 'memory');
    repeatFn = function () { Speech.say(say); };
    Speech.say(say);
  }

  OPEN = { more: kidMore, letters: lettersMenu, numbers: numberGame, shapes: shapesGame, stories: storyList, memory: memoryGame, storymaker: function () { stopGuided('switched'); storyMaker(null); } };

  /* ---------- screen time ---------- */
  function limitSeconds() { return settings.limitMin > 0 ? (Number(settings.limitMin) + (usage.bonusMin || 0)) * 60 : Infinity; }
  function isOverLimit() { ensureUsageToday(); return usage.seconds >= limitSeconds(); }
  function showBreak() {
    onBreak = true;
    if (G.active) endRec('time');
    G.sleeping = false;
    var msg = TX('s_brk');
    show(h('main', { class: 'screen kid break-screen' },
      settings.guided !== false ? owlEl('waving big') : h('div', { class: 'big-emoji bounce' }, '🧸'),
      h('h1', { class: 'hello' }, 'Time for a break!'),
      h('div', { class: 'break-ideas' }, D.breakIdeas.map(function (b) { return h('div', { class: 'break-idea' }, h('span', {}, b.e), h('small', {}, b.t)); })),
      h('button', { class: 'grownup-btn', onclick: function () { openGate(parentMode); } }, '🔒 Grown-ups')), 'break');
    repeatFn = function () { Speech.say(msg); };
    Speech.say(msg);
  }
  setInterval(function () {
    if (mode !== 'kid' || onBreak || document.visibilityState !== 'visible') return;
    var scr = app.getAttribute('data-screen');
    /* timer pauses on start screens, the sleepy screen, and after the session has ended */
    if (scr === 'splash' || scr === 'gstart' || scr === 'gsleep' || scr === 'gdone' || scr === 'gend' || scr === 'gempty') return;
    ensureUsageToday();
    usage.seconds++;
    if (G.active && G.rec) { G.rec.activeSec++; if (G.rec.activeSec % 5 === 0) saveSessions(); }
    if (usage.seconds % 5 === 0) saveUsage();
    var left = limitSeconds() - usage.seconds;
    if (left === 120 && !warned) { warned = true; if (G.active) G.wrapUp = true; else Speech.say(TX('s_twomin')); }
    if (left <= 0) { saveUsage(); showBreak(); }
  }, 1000);
  document.addEventListener('visibilitychange', saveUsage);

  /* ---------- toddler-proofing guards ---------- */
  function enterKidGuards() {
    document.body.classList.add('kidmode');
    if (!guardsOn) { guardsOn = true; try { history.pushState({ tl: 'kid' }, ''); } catch (e) { /* file:// quirks */ } }
  }
  window.addEventListener('popstate', function () {
    if (mode === 'kid') { try { history.pushState({ tl: 'kid' }, ''); } catch (e) { /* ignore */ } if (!onBreak && settings.guided === false) kidHome(); }
  });
  window.addEventListener('beforeunload', function (e) {
    if (mode === 'kid' && settings.setupDone) { saveUsage(); e.preventDefault(); e.returnValue = ''; }
  });
  document.addEventListener('contextmenu', function (e) { if (mode === 'kid') e.preventDefault(); });
  document.addEventListener('keydown', function (e) {
    if (mode === 'kid' && (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowLeft'))) e.preventDefault();
  });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

  /* ---------- parent gate ---------- */
  function openGate(onPass) {
    Speech.stop();
    if (document.querySelector('.gate-overlay')) return;
    var ov = h('div', { class: 'gate-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Grown-ups only' });
    var box = h('div', { class: 'gate' });
    ov.appendChild(box); document.body.appendChild(ov);
    function close() {
      ov.remove();
      if (mode === 'kid' && G.active && !G.sleeping) { idleKick(); if (G.repeat) G.repeat(); }
    }
    function step1() {
      var raf = 0, start = 0;
      var fill = h('span', { class: 'hold-fill' });
      var btn = h('button', { class: 'hold-btn', id: 'holdBtn' }, fill, h('span', { class: 'hold-label' }, 'Press & hold 3 seconds'));
      function begin(e) {
        e.preventDefault(); start = performance.now();
        var loop = function () {
          var p = Math.min(1, (performance.now() - start) / 3000);
          fill.style.width = (p * 100) + '%';
          if (p >= 1) { step2(); } else raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      }
      function end() { cancelAnimationFrame(raf); fill.style.width = '0%'; }
      btn.addEventListener('pointerdown', begin);
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { btn.addEventListener(ev, end); });
      btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      box.replaceChildren(h('h2', {}, '👋 Grown-ups only'), h('p', {}, 'Step 1 of 2: press and hold the button for 3 seconds.'), btn,
        h('button', { class: 'link-btn', onclick: close }, 'Cancel'));
    }
    function step2(msg) {
      var a = 3 + rand(7), b = 3 + rand(7), ans = a * b;
      var opts = [ans], cand = [ans + a, ans - b, ans + 1, ans + 10, ans - 2, ans + b];
      cand.forEach(function (x) { if (opts.length < 6 && x > 0 && opts.indexOf(x) < 0) opts.push(x); });
      box.replaceChildren(h('h2', {}, '👋 Grown-ups only'),
        h('p', {}, msg || 'Step 2 of 2: solve this.'),
        h('div', { class: 'gate-q', id: 'gateQ', 'data-a': a, 'data-b': b }, 'What is ' + a + ' × ' + b + '?'),
        h('div', { class: 'gate-opts' }, shuffle(opts).map(function (o) {
          return h('button', { class: 'gate-opt', 'data-v': o, onclick: function () { if (o === ans) { ov.remove(); onPass(); } else { gateCooldown = Date.now() + 30000; close(); } } }, String(o));
        })),
        h('button', { class: 'link-btn', onclick: close }, 'Cancel'));
    }
    step1();
  }

  /* ---------- parent mode ---------- */
  function parentMode() {
    stopGuided('parent');
    mode = 'parent'; onBreak = false; warned = false;
    document.body.classList.remove('kidmode');
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    Speech.stop();
    renderParent('menu');
  }
  var toastT;
  function toast(t) {
    var el = document.getElementById('toast');
    if (!el) { el = h('div', { id: 'toast', role: 'status' }); document.body.appendChild(el); }
    el.textContent = t; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('show'); }, 1400);
  }
  function fillVoiceSelect() {
    var sel = document.getElementById('voiceSel');
    if (!sel) return;
    sel.replaceChildren(h('option', { value: '' }, 'Automatic (best available)'));
    Speech.voices.forEach(function (v) {
      var o = h('option', { value: v.voiceURI }, v.name + ' (' + v.lang + ')');
      if (v.voiceURI === settings.voiceURI) o.selected = true;
      sel.appendChild(o);
    });
  }
  function card(title, cls) {
    var c = h('section', { class: 'pcard ' + (cls || '') }, h('h2', {}, title));
    for (var i = 2; i < arguments.length; i++) append(c, arguments[i]);
    return c;
  }
  var ideaShift = 0;
  function todaysIdeas() {
    var list = D.ideas[band()], d = new Date();
    var seed = d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate() + ideaShift * 4;
    var out = [];
    for (var i = 0; i < 4; i++) out.push(list[(seed + i) % list.length]);
    return out;
  }
  /* v3.3 Parent corner: a short menu; each section opens its own page */
  var PPAGE = 'menu';
  var PPAGES = [
    { id: 'child', icon: '👶', title: 'Child', sub: function (S) { return ((S.childName || '').trim() || 'No name yet') + ' · ages ' + band().replace('-', '–'); } },
    { id: 'play', icon: '🎮', title: 'Play settings', sub: function (S) { return (S.guided !== false ? 'Guided mode' : 'Menu mode') + ' · ' + (S.limitMin ? S.limitMin + ' min a day' : 'no time limit') + ' · ' + (S.voiceStyle === 'normal' ? 'normal' : 'soft') + ' voice'; } },
    { id: 'voices', icon: '🎙️', title: 'Family Voices', sub: function (S) { return (S.fvOn ? 'On' : 'Off') + ' · ' + fvVoices.length + ' family voice' + (fvVoices.length === 1 ? '' : 's'); } },
    { id: 'stories', icon: '📚', title: 'My Stories', sub: function () { return SM.stories.length + ' saved stor' + (SM.stories.length === 1 ? 'y' : 'ies') + ' · songs'; } },
    { id: 'calm', icon: '🌙', title: 'Calm & Accessible', sub: function (S) { var on = []; if (S.calm) on.push('Calm'); if (S.schedule) on.push('Schedule'); if (S.bigTargets) on.push('Big buttons'); if (S.contrast) on.push('Contrast'); if (S.captions) on.push('Captions'); if (S.kbd) on.push('Keyboard'); if (S.scan) on.push('Switch'); return on.length ? on.join(' · ') : 'All off'; } },
    { id: 'reports', icon: '📈', title: 'Reports', sub: function () { return progress.stars + ' stars · sessions · offline ideas'; } },
    { id: 'help', icon: '💡', title: 'Help', sub: function () { return 'Setup tips · privacy · offline'; } }
  ];
  function moreOpts(id) {
    var d = h('details', { class: 'more-opts', id: id || null }, h('summary', {}, 'More options'));
    for (var i = 1; i < arguments.length; i++) append(d, arguments[i]);
    return d;
  }
  function renderParent(page) {
    if (page) PPAGE = page;
    if (!PPAGES.some(function (x) { return x.id === PPAGE; })) PPAGE = 'menu';
    var S = settings;
    var fmtMin = function (s) { return Math.floor(s / 60); };
    ensureUsageToday();

    // profile
    var nameIn = h('input', { type: 'text', id: 'childName', maxlength: '20', value: S.childName || '', autocomplete: 'off', 'aria-label': 'Child name', placeholder: 'Optional, e.g. Maya' });
    nameIn.addEventListener('input', function () { S.childName = nameIn.value.replace(/[<>]/g, '').slice(0, 20); saveSettings(); });
    nameIn.addEventListener('change', function () { toast('Saved ✓'); });
    var ageRow = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Age band' });
    [['2-3', 'Ages 2–3'], ['4-5', 'Ages 4–5'], ['5-6', 'Ages 5–6']].forEach(function (a) {
      var b = h('button', { class: 'seg-btn' + (S.ageBand === a[0] ? ' on' : ''), role: 'radio', 'aria-checked': String(S.ageBand === a[0]), 'data-age': a[0],
        onclick: function () { S.ageBand = a[0]; saveSettings(); toast('Saved ✓'); renderParent(); } }, a[1]);
      ageRow.appendChild(b);
    });
    var profile = card('👶 Child profile', '',
      h('label', { class: 'field' }, h('span', {}, 'Child\'s name (optional)'), nameIn),
      h('p', { class: 'hint' }, 'Booyo uses this name. If it is empty, Booyo says "friend".'),
      h('div', { class: 'field' }, h('span', {}, 'Age band (sets difficulty)'), ageRow),
      h('p', { class: 'hint' }, { '2-3': 'Ages 2–3: 2 choices, counting to 5, basic shapes & colors, 3 matching pairs.',
        '4-5': 'Ages 4–5: 3 choices, counting to 10, more shapes & colors, "starts with" letters, 4 pairs.',
        '5-6': 'Ages 5–6: 4 choices, counting to 15 + simple addition, lowercase letters, 6 pairs.' }[S.ageBand]));

    // activities
    var actList = h('div', { class: 'toggles' });
    D.activities.forEach(function (a) {
      var cb = h('input', { type: 'checkbox', id: 'act-' + a.id });
      cb.checked = !!S.activities[a.id];
      cb.addEventListener('change', function () { S.activities[a.id] = cb.checked; saveSettings(); toast('Saved ✓'); });
      actList.appendChild(h('label', { class: 'toggle' }, cb, h('span', { class: 'toggle-ui' }), h('span', {}, a.emoji + ' ' + { letters: 'Letters (ABC + find the letter)', numbers: 'Numbers & counting', shapes: 'Shapes & colors', stories: 'Read-aloud stories', memory: 'Matching / memory game', storymaker: 'Make a Story (story builder)' }[a.id])));
    });
    var acts = card('🎮 Activities', '', actList);

    // screen time
    var limSel = h('select', { id: 'limitSel', 'aria-label': 'Daily limit' });
    [5, 10, 15, 20, 30, 45, 60, 90, 0].forEach(function (m) {
      var o = h('option', { value: m }, m ? m + ' minutes per day' : 'No limit');
      if (Number(S.limitMin) === m) o.selected = true;
      limSel.appendChild(o);
    });
    limSel.addEventListener('change', function () { S.limitMin = Number(limSel.value); saveSettings(); toast('Saved ✓'); renderParent(); });
    var usedMin = fmtMin(usage.seconds), lim = S.limitMin > 0 ? S.limitMin + (usage.bonusMin || 0) : 0;
    var pct = lim ? Math.min(100, Math.round(usage.seconds / (lim * 60) * 100)) : 0;
    var time = card('⏱️ Daily screen time', '',
      h('label', { class: 'field' }, h('span', {}, 'Daily limit'), limSel),
      h('div', { class: 'meter' }, h('span', { style: { width: pct + '%' } })),
      h('p', { class: 'hint' }, 'Used today: ' + usedMin + ' min' + (lim ? ' of ' + lim + ' min' + (usage.bonusMin ? ' (includes +' + usage.bonusMin + ' extra)' : '') : '') +
        '. When time is up, a gentle "time for a break" screen appears. Only a grown-up can unlock it.'),
      h('div', { class: 'btn-row' },
        h('button', { class: 'pbtn', onclick: function () { usage.bonusMin = (usage.bonusMin || 0) + 10; saveUsage(); toast('+10 minutes today'); renderParent(); } }, '+10 minutes today')),
      moreOpts(null, h('div', { class: 'btn-row' }, h('button', { class: 'pbtn ghost', onclick: function () { usage.seconds = 0; usage.bonusMin = 0; saveUsage(); toast('Timer reset'); renderParent(); } }, 'Reset today\'s timer'))));

    // voice & sound
    var voiceSel = h('select', { id: 'voiceSel', 'aria-label': 'Voice' });
    voiceSel.addEventListener('change', function () { S.voiceURI = voiceSel.value; saveSettings(); toast('Saved ✓'); });
    var rate = h('input', { type: 'range', min: '0.6', max: '1.2', step: '0.05', value: S.speechRate, 'aria-label': 'Speech speed' });
    rate.addEventListener('change', function () { S.speechRate = Number(rate.value); saveSettings(); toast('Saved ✓'); });
    var snd = h('input', { type: 'checkbox' }); snd.checked = !!S.sound;
    snd.addEventListener('change', function () { S.sound = snd.checked; saveSettings(); toast('Saved ✓'); });
    var fs = h('input', { type: 'checkbox' }); fs.checked = !!S.fullscreen;
    fs.addEventListener('change', function () { S.fullscreen = fs.checked; saveSettings(); toast('Saved ✓'); });
    var autoV = Speech.voice();
    var vRow = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Booyo\'s voice', id: 'voiceStyle' });
    [['soft', '🌸 Soft (gentle)'], ['normal', '🔊 Normal']].forEach(function (o) {
      var on = (S.voiceStyle || 'soft') === o[0];
      vRow.appendChild(h('button', { class: 'seg-btn' + (on ? ' on' : ''), role: 'radio', 'aria-checked': String(on), 'data-vstyle': o[0],
        onclick: function () { S.voiceStyle = o[0]; saveSettings(); toast('Saved ✓'); Sound.resume(); Speech.say(TX('s_test')); renderParent(); } }, o[1]));
    });
    var voice = card('🔊 Booyo\'s voice', '',
      Speech.ok ? null : h('p', { class: 'warn' }, 'This browser does not support speech. Try Chrome, Edge, or Safari.'),
      Speech.ok && noVoice() ? h('p', { class: 'warn' }, 'No English voice found on this device yet. Booyo will still guide with pictures, a pointing hand and glowing answers, but your child will hear no words. Install a voice in the device settings (Text-to-speech / Spoken Content).') : null,
      vRow,
      h('p', { class: 'hint' }, (S.voiceStyle === 'normal' ? 'Normal: full volume and the regular speed.' : 'Soft (default): quieter, a little slower and lower, and Booyo picks a warmer voice when the device has one. Sound effects are softer too.')),
      h('div', { class: 'btn-row' }, h('button', { class: 'pbtn ghost', id: 'testVoice', onclick: function () { Sound.resume(); Speech.say(TX('s_test')); } }, '▶ Test voice')),
      h('label', { class: 'toggle' }, snd, h('span', { class: 'toggle-ui' }), h('span', {}, 'Happy sound effects')),
      moreOpts('voiceMore',
        autoV ? h('p', { class: 'hint' }, 'Automatic choice: ' + autoV.name + (autoV.localService ? ' (on-device, works offline)' : ' (may need internet)') + '.') : null,
        h('label', { class: 'field' }, h('span', {}, 'Pick a voice'), voiceSel),
        h('label', { class: 'field' }, h('span', {}, 'Speaking speed (about 0.8–0.9 is easiest for little ones)'), rate),
        h('label', { class: 'toggle' }, fs, h('span', { class: 'toggle-ui' }), h('span', {}, 'Go full screen in kid mode'))));

    // progress
    var maxSkill = Math.max.apply(null, SKILLS.map(function (s) { return progress.skills[s] || 0; }).concat([1]));
    var skillLabels = { letters: '🔤 Letters', numbers: '🔢 Numbers', shapes: '🔺 Shapes', colors: '🎨 Colors', stories: '📖 Stories', memory: '🃏 Memory' };
    var last7 = h('div', { class: 'week' });
    var dayVals = [];
    for (var i = 6; i >= 0; i--) { var d = new Date(); d.setDate(d.getDate() - i); var k = todayKey(d); dayVals.push({ d: d, v: (progress.days[k] || {}).stars || 0 }); }
    var maxDay = Math.max.apply(null, dayVals.map(function (x) { return x.v; }).concat([1]));
    dayVals.forEach(function (x) {
      last7.appendChild(h('div', { class: 'wday' }, h('div', { class: 'wbar-wrap' }, h('div', { class: 'wbar', style: { height: Math.round(x.v / maxDay * 100) + '%' } })),
        h('small', {}, String(x.v)), h('small', { class: 'wl' }, x.d.toLocaleDateString(undefined, { weekday: 'short' }))));
    });
    var prog = card('📈 Progress', 'wide',
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('b', {}, String(progress.stars)), h('span', {}, '⭐ stars')),
        h('div', { class: 'stat' }, h('b', {}, String(progress.activitiesDone)), h('span', {}, '🏅 activities done')),
        h('div', { class: 'stat' }, h('b', {}, progress.lettersSeen.length + '/26'), h('span', {}, '🔤 letters explored')),
        h('div', { class: 'stat' }, h('b', {}, String((progress.days[todayKey()] || {}).stars || 0)), h('span', {}, '⭐ today'))),
      h('h3', {}, 'Correct answers by skill'),
      h('div', { class: 'skills' }, SKILLS.map(function (s) {
        var v = progress.skills[s] || 0;
        return h('div', { class: 'skill' }, h('span', { class: 'sk-l' }, skillLabels[s]), h('span', { class: 'sk-bar' }, h('span', { style: { width: Math.round(v / maxSkill * 100) + '%' } })), h('b', {}, String(v)));
      })),
      h('p', { class: 'hint' }, 'Rounds finished: ' + D.activities.map(function (a) { return a.emoji + ' ' + (progress.sessions[a.id] || 0); }).join('   ')),
      h('h3', {}, 'Stars in the last 7 days'), last7,
      h('div', { class: 'btn-row' }, h('button', { class: 'pbtn ghost danger', onclick: function () {
        if (window.confirm('Reset all progress (stars and counts)? Settings are kept.')) { progress = blankProgress(); saveProgress(); toast('Progress reset'); renderParent(); }
      } }, 'Reset progress')));

    // offline ideas
    var ideas = card('🌈 Today\'s offline activity ideas', 'ideas-card',
      h('p', { class: 'hint' }, 'Screen-free ideas for ages ' + S.ageBand.replace('-', '–') + '. Print this card or just read it aloud.'),
      h('ul', { class: 'ideas' }, todaysIdeas().map(function (it) {
        return h('li', {}, h('span', { class: 'idea-e' }, it.e), h('div', {}, h('b', {}, it.t), h('p', {}, fillName(it.how))), h('span', { class: 'check', 'aria-hidden': 'true' }, '☐'));
      })),
      h('div', { class: 'btn-row noprint' },
        h('button', { class: 'pbtn ghost', onclick: function () { ideaShift++; renderParent(); document.getElementById('ideasCard').scrollIntoView({ block: 'center' }); } }, '🔄 Different ideas'),
        h('button', { class: 'pbtn ghost', onclick: function () { printCard('ideas'); } }, '🖨️ Print')));
    ideas.id = 'ideasCard';

    var privacy = card('🔐 Privacy & safety', '',
      h('ul', { class: 'plain' },
        h('li', {}, 'Everything is stored only on this device (browser localStorage, and IndexedDB for Family Voices recordings and saved stories). No accounts, no ads, no tracking, no uploads, no internet needed.'),
        h('li', {}, 'Kid mode has no links, ads, purchases or typing. Leaving kid mode needs this grown-up check (hold 3 seconds + a math question). A wrong answer closes it and locks it for 30 seconds.'),
        h('li', {}, 'Guided mode needs no grown-up mid-session: it ends by itself at the daily limit, and pauses (timer stopped) if nobody taps for about 2 minutes.'),
        h('li', {}, 'Still lock the device to this app (see the setup tips above): a browser can\'t stop a child from pressing the Home button.'),
        h('li', { id: 'offlineStatus' }, offlineStatusText())),
      h('p', {}, h('a', { href: 'privacy.html', target: '_blank', rel: 'noopener', id: 'privacyLink', class: 'plink' }, '📄 Read Booyo\'s full privacy page')));

    // guided mode
    var gTog = h('input', { type: 'checkbox', id: 'guidedToggle' }); gTog.checked = S.guided !== false;
    gTog.addEventListener('change', function () { S.guided = gTog.checked; saveSettings(); toast('Saved ✓'); renderParent(); });
    var lenSel = h('select', { id: 'sessionLenSel', 'aria-label': 'Session length' });
    [[0, 'Automatic (by age and time left)'], [3, '3 activities (short)'], [4, '4 activities'], [5, '5 activities'], [6, '6 activities (long)']].forEach(function (x) {
      var o = h('option', { value: x[0] }, x[1]); if (Number(S.sessionLen || 0) === x[0]) o.selected = true; lenSel.appendChild(o);
    });
    lenSel.addEventListener('change', function () { S.sessionLen = Number(lenSel.value); saveSettings(); toast('Saved ✓'); renderParent(); });
    var plan = buildPlaylist(true);
    var guided = card('🦉 Guided mode (Booyo the owl)', '',
      h('label', { class: 'toggle' }, gTog, h('span', { class: 'toggle-ui' }), h('span', {}, 'Guided mode: Booyo leads the way (best when your child plays alone)')),
      h('p', { class: 'hint' }, S.guided !== false
        ? 'On: after one tap on the big ▶, Booyo talks your child through a short mix of activities, shows what to tap with a pointing hand, does the first one as a demo, helps after mistakes, and ends with a calm goodbye screen. No reading or menus needed.'
        : 'Off: your child picks games from a menu of picture tiles. Better with a grown-up nearby.'),
      moreOpts('guidedMore', h('label', { class: 'field' }, h('span', {}, 'Session length'), lenSel),
      h('p', { class: 'hint' }, plan.length ? 'Next session: ' + plan.map(function (it) { return GTYPES[it.type].icon; }).join(' → ') + ' 🏆  (about ' + Math.round(plan.length * minutesPerItem()) + ' min; it ends earlier if the daily limit is reached)' : 'Turn on at least one activity.')));

    var startBtn = h('button', { class: 'start-btn', id: 'startKid', onclick: function () {
      S.setupDone = true; saveSettings(); Sound.resume(); fvUnlock();
      if (S.fullscreen && document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(function () {});
      }
      kidStart();
    } }, '▶ Start kid mode');

    var head = h('header', { class: 'phead' },
      h('div', { class: 'pbrand' }, h('img', { src: 'icons/icon-192.png', alt: '', width: '192', height: '192' }), h('div', {}, h('h1', {}, 'Booyo'), h('p', {}, 'Parent corner'))),
      startBtn);
    var foot = h('footer', { class: 'pfoot' }, 'Booyo v3.3.1 · works offline · made for home learning · Made by Savir and his dad · ',
      h('a', { href: 'privacy.html', target: '_blank', rel: 'noopener', id: 'footPrivacy' }, 'Privacy'));
    if (PPAGE === 'menu') {
      var menu = h('nav', { class: 'pmenu', 'aria-label': 'Parent corner sections' }, PPAGES.map(function (pg) {
        return h('button', { class: 'pmenu-btn', 'data-ppage': pg.id, onclick: function () { renderParent(pg.id); } },
          h('span', { class: 'pm-ic', 'aria-hidden': 'true' }, pg.icon), h('span', { class: 'pm-t' }, h('b', {}, pg.title), h('small', {}, pg.sub(S))), h('span', { class: 'pm-go', 'aria-hidden': 'true' }, '›'));
      }));
      show(h('main', { class: 'screen parent pmain', 'data-ppage': 'menu' }, head,
        S.setupDone ? null : h('div', { class: 'welcome' }, h('b', {}, 'Welcome! '), 'Open ', h('b', {}, '👶 Child'), ' to set your child\'s name and age, and ', h('b', {}, '🎮 Play settings'), ' for the daily time limit. Then tap ', h('b', {}, 'Start kid mode'), '. Next time the app opens straight into kid mode; come back here with the 🔒 button and the grown-up check.'),
        menu, foot), 'parent');
      return;
    }
    var pg = PPAGES.filter(function (x) { return x.id === PPAGE; })[0];
    var cards = {
      child: function () { return [profile]; },
      play: function () { return [guided, acts, time, voice]; },
      voices: function () { return [fvCard()]; },
      stories: function () { return [smCard()]; },
      calm: function () { return [a11yCard()]; },
      reports: function () { return [reportCard(), prog, ideas]; },
      help: function () { return [tipsCard(), privacy]; }
    }[PPAGE]();
    show(h('main', { class: 'screen parent ppage', 'data-ppage': PPAGE }, head,
      h('div', { class: 'ppage-head' }, h('button', { class: 'pbtn ghost', id: 'pBack', onclick: function () { renderParent('menu'); } }, '⬅ Menu'), h('h2', {}, pg.icon + ' ' + pg.title)),
      h('div', { class: 'pgrid one' }, cards), foot), 'parent');
    fillVoiceSelect();
  }

  /* =====================================================================
     v2 GUIDED MODE: Booyo the owl leads a short daily playlist.
     No reading needed: voice + pictures + pointing hand + glow.
     ===================================================================== */
  var QS = {};
  try {
    (location.search || '').replace(/^\?/, '').split('&').forEach(function (p) {
      if (!p) return; var i = p.indexOf('=');
      QS[decodeURIComponent(i < 0 ? p : p.slice(0, i))] = i < 0 ? '' : decodeURIComponent(p.slice(i + 1));
    });
  } catch (e) { /* ignore */ }
  /* Test flag (?tltest=1) shortens every timer so automated tests can run a full session quickly.
     Optional: tlk=<scale>, tlidle=<ms>, tllong=<ms>. Never used in normal play. */
  var TEST = QS.tltest === '1';
  var K = TEST ? (Number(QS.tlk) || 0.1) : 1;
  var T = {
    idle: TEST && QS.tlidle ? Number(QS.tlidle) : 8000 * K,       // no tap for this long -> repeat prompt + hint
    reprompts: 3,                                                    // then gently offer to move on
    longIdle: TEST && QS.tllong ? Number(QS.tllong) : 120000 * K,   // total idle (while waiting for a tap) -> sleepy screen
    beat: 700 * K,
    step: 650 * K
  };

  var G = { active: false, list: [], idx: 0, rec: null, sleeping: false, repeat: null, streak: {}, struggle: {}, wrapUp: false };
  var gateCooldown = 0;

  var GTYPES = {
    abc:     { act: 'letters', skill: 'letters', icon: '🔤', name: 'ABC letters (letter + picture)' },
    letters: { act: 'letters', skill: 'letters', icon: '🔍', name: 'Find the letter' },
    numbers: { act: 'numbers', skill: 'numbers', icon: '🔢', name: 'Counting & numbers' },
    shapes:  { act: 'shapes',  skill: 'shapes',  icon: '🔺', name: 'Shapes' },
    colors:  { act: 'shapes',  skill: 'colors',  icon: '🎨', name: 'Colors' },
    story:   { act: 'stories', skill: 'stories', icon: '📖', name: 'Story + question' },
    memory:  { act: 'memory',  skill: 'memory',  icon: '🃏', name: 'Matching pairs' },
    storymaker: { act: 'storymaker', skill: 'stories', icon: '✨', name: 'Make a Story' }
  };
  var GSHORT = { abc: 'ABC', letters: 'Letters', numbers: 'Counting', shapes: 'Shapes', colors: 'Colors', story: 'Story', memory: 'Matching', storymaker: 'Make a story' };
  Object.keys(GSHORT).forEach(function (k) { GTYPES[k].short = GSHORT[k]; });
  /* difficulty table: index 0 = easier, 1 = normal, 2 = a bit harder (always inside the age band) */
  var BAND_CFG = {
    '2-3': { n: [2, 2, 3], count: [3, 5, 6],   rounds: 3, pairs: [2, 3, 3], letterTypes: [['find'], ['find'], ['find']],
             numTypes: [['count'], ['count'], ['count', 'count', 'find']] },
    '4-5': { n: [2, 3, 4], count: [5, 10, 12], rounds: 3, pairs: [3, 4, 4], letterTypes: [['find'], ['find', 'find', 'start'], ['find', 'start', 'lower']],
             numTypes: [['count'], ['count', 'count', 'find'], ['count', 'find', 'find']] },
    '5-6': { n: [3, 4, 4], count: [10, 15, 20], rounds: 4, pairs: [4, 5, 6], letterTypes: [['find', 'start'], ['find', 'start', 'lower'], ['start', 'lower', 'lower']],
             numTypes: [['count', 'find'], ['count', 'add', 'find'], ['add', 'add', 'count']] }
  };
  function bandCfg() { return BAND_CFG[band()] || BAND_CFG['4-5']; }
  function lvl(skill) { var v = (progress.adapt || {})[skill] || 0; return Math.max(-1, Math.min(1, v)); }
  function L(skill) { return lvl(skill) + 1; }
  function noVoice() { if (!Speech.ok) return true; if (!Speech.voices.length) Speech.load(); return !Speech.voices.length; }

  /* ---------- Booyo (inline SVG, animated with CSS) ---------- */
  var OWL_SVG = '<svg viewBox="0 0 160 172" width="100%" height="100%" aria-hidden="true">' +
    '<g class="o-wing o-wl"><ellipse cx="30" cy="104" rx="19" ry="38" fill="#6d4c41"/></g>' +
    '<g class="o-wing o-wr"><ellipse cx="130" cy="104" rx="19" ry="38" fill="#6d4c41"/></g>' +
    '<polygon points="34,46 46,8 66,36" fill="#795548"/><polygon points="126,46 114,8 94,36" fill="#795548"/>' +
    '<ellipse cx="80" cy="98" rx="55" ry="66" fill="#8d6e63"/>' +
    '<ellipse cx="80" cy="122" rx="37" ry="39" fill="#ffe0b2"/>' +
    '<path d="M60 112q7 7 14 0M86 112q7 7 14 0M72 128q7 7 14 0M60 142q7 7 14 0M86 142q7 7 14 0" stroke="#ffcc80" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    '<circle cx="56" cy="68" r="23" fill="#fff" stroke="#ffb74d" stroke-width="5"/><circle cx="104" cy="68" r="23" fill="#fff" stroke="#ffb74d" stroke-width="5"/>' +
    '<g class="o-pupils"><circle cx="59" cy="70" r="10.5" fill="#3e2723"/><circle cx="101" cy="70" r="10.5" fill="#3e2723"/>' +
    '<circle cx="62.5" cy="66" r="3.6" fill="#fff"/><circle cx="104.5" cy="66" r="3.6" fill="#fff"/></g>' +
    '<g class="o-lids"><ellipse cx="56" cy="68" rx="25.5" ry="25.5" fill="#8d6e63"/><ellipse cx="104" cy="68" rx="25.5" ry="25.5" fill="#8d6e63"/></g>' +
    '<g class="o-closed" stroke="#3e2723" stroke-width="4" fill="none" stroke-linecap="round"><path d="M42 72q14 11 28 0"/><path d="M90 72q14 11 28 0"/></g>' +
    '<circle cx="34" cy="96" r="7" fill="#ff8a80" opacity=".55"/><circle cx="126" cy="96" r="7" fill="#ff8a80" opacity=".55"/>' +
    '<polygon class="o-jaw" points="73,92 87,92 80,104" fill="#ef6c00"/>' +
    '<polygon points="69,84 91,84 80,98" fill="#ff9800"/>' +
    '<path d="M64 160l-6 9M68 161v10M72 160l6 9M88 160l-6 9M92 161v10M96 160l6 9" stroke="#ff9800" stroke-width="5" stroke-linecap="round"/>' +
    '</svg>';
  function owlEl(cls) {
    var o = h('div', { class: 'ollie ' + (cls || ''), role: 'button', 'aria-label': 'Booyo the owl. Tap to hear again.' },
      h('div', { class: 'ollie-bubble', 'aria-hidden': 'true' }),
      h('div', { class: 'ollie-body', html: OWL_SVG }),
      h('div', { class: 'ollie-zzz', 'aria-hidden': 'true' }, h('span', {}, 'z'), h('span', {}, 'z'), h('span', {}, 'Z')));
    o.setAttribute('tabindex', '0');
    o.addEventListener('click', function () { Sound.pop(); if (G.repeat) G.repeat(); else if (repeatFn) repeatFn(); });
    o.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && !settings.scan) { e.preventDefault(); o.click(); } });
    return o;
  }
  function owl() { return app.querySelector('.ollie'); }
  function setBubble(cue) {
    var b = app.querySelector('.ollie-bubble');
    if (!b || cue === undefined || cue === null) return;
    b.replaceChildren(); append(b, typeof cue === 'string' ? cue : cue.cloneNode(true));
    b.classList.remove('popin'); void b.offsetWidth; b.classList.add('popin');
  }

  /* talk(): speak + animate Booyo, then call cb. Paced by speech end, with a minimum on-screen time (so devices without a voice
     still get time to look at the pictures) and a maximum (in case the browser never reports the end of speech). */
  var sayId = 0;
  function talk(text, cue, cb, opts) {
    opts = opts || {};
    var id = ++sayId, t0 = Date.now(), ended = false, tok = token;
    var rate = speechRate();
    var est = (600 + String(text).length * 62) / rate;
    var minMs = est * 0.6 * K, maxMs = (est * 1.6 + 2500) * K;
    setBubble(cue);
    var o = owl(), happy = cue === '⭐' || cue === '🎉';
    if (o) { o.classList.add('talking'); if (happy) o.classList.add('happy'); }
    function finish() {
      if (id !== sayId) return;
      var ow = owl(); if (ow) { ow.classList.remove('talking'); if (happy) ow.classList.remove('happy'); }
      if (cb && tok === token) cb();
    }
    function check() {
      if (id !== sayId) return;
      var el = Date.now() - t0;
      if ((ended && el >= minMs) || el >= maxMs) finish();
      else setTimeout(check, 60);
    }
    var info = Speech.say(text, { onend: function () { ended = true; }, onboundary: opts.onboundary });
    if (info && info.clipMs) maxMs = Math.max(maxMs, info.clipMs + (600 + info.ttsChars * 62) / rate * 1.6 + 2500);   // family clips: wait for the real recording
    setTimeout(check, 60);
  }

  /* ---------- pointing hand + glow ---------- */
  var Hand = {
    el: null, target: null,
    at: function (target, opts) {
      opts = opts || {};
      if (!target || !target.isConnected) return;
      if (this.target && this.target !== target) this.target.classList.remove('glow');
      if (!this.el) { this.el = h('div', { class: 'hand', 'aria-hidden': 'true' }, '👆'); document.body.appendChild(this.el); }
      this.target = target;
      if (opts.glow !== false) target.classList.add('glow');
      this.el.classList.toggle('sweep', !!opts.sweep);
      this.el.classList.toggle('demo', !!opts.demo);
      this.place();
    },
    place: function () {
      if (!this.el || !this.target) return;
      var r = this.target.getBoundingClientRect();
      this.el.style.left = (r.left + r.width / 2) + 'px';
      this.el.style.top = (r.top + r.height * (this.el.classList.contains('sweep') ? 0.35 : 0.55)) + 'px';
    },
    tap: function () { var e = this.el; if (!e) return; e.classList.remove('tapping'); void e.offsetWidth; e.classList.add('tapping'); },
    hide: function () { if (this.target) this.target.classList.remove('glow'); this.target = null; if (this.el) { this.el.remove(); this.el = null; } }
  };
  window.addEventListener('resize', function () { Hand.place(); });
  window.addEventListener('scroll', function () { Hand.place(); }, true);

  /* ---------- idle handling ---------- */
  var Idle = { t: 0, n: 0, fn: null, expect: false, accum: 0, last: Date.now() };
  function idleArm(fn) { Idle.fn = fn; Idle.n = 0; Idle.expect = true; idleKick(); }
  function idleKick() { clearTimeout(Idle.t); if (Idle.fn && settings.extraTime !== 'off') Idle.t = setTimeout(idleFire, idleMs()); }
  function idleFire() {
    if (!Idle.fn) return;
    if (document.querySelector('.gate-overlay') || document.visibilityState !== 'visible') return idleKick();
    Idle.n++; Idle.fn(Idle.n);
  }
  function idleStop() { clearTimeout(Idle.t); Idle.fn = null; Idle.expect = false; }
  document.addEventListener('pointerdown', function () { Idle.accum = 0; if (Idle.fn) { Idle.n = 0; idleKick(); } }, true);
  setInterval(function () {
    var now = Date.now(), dt = now - Idle.last; Idle.last = now;
    if (!G.active || !Idle.expect || G.sleeping || mode !== 'kid' || onBreak) return;
    if (document.querySelector('.gate-overlay') || document.visibilityState !== 'visible') return;
    Idle.accum += dt;
    if (Idle.accum >= longIdleMs()) goSleep();
  }, 250);

  /* idle ladder: repeat prompt (x3) -> offer to move on -> move on */
  function idleLadder(r, reprompt, done) {
    return function (n) {
      if (n <= T.reprompts) { r.idleReprompts++; return reprompt(n); }
      if (n === T.reprompts + 1) return offerSkip(r, done);
      if (!r.skipped) r.skipped = 'idle';
      idleStop(); Hand.hide();
      talk(TX('g_okay'), '🌈', function () { later(done, T.beat); });
    };
  }
  function offerSkip(r, done) {
    var main = app.querySelector('main'); if (!main) return;
    var btn = main.querySelector('.skip-btn');
    if (!btn) {
      btn = h('button', { class: 'skip-btn', 'aria-label': 'Something new' }, ARROW_R());
      btn.addEventListener('click', function () {
        if (btn.getAttribute('data-used')) return;
        btn.setAttribute('data-used', '1'); Sound.pop(); r.skipped = 'child'; idleStop(); Hand.hide();
        talk(TX('g_okay2'), '🌈', function () { later(done, T.beat); });
      });
      main.appendChild(btn);
    }
    Hand.at(btn);
    talk(TX('g_arrow'), '➡️', idleKick);
  }
  function hintSweep(container) {
    if (!container) return;
    Array.prototype.forEach.call(container.children, function (c, i) {
      if (c.disabled) return;
      setTimeout(function () { c.classList.remove('wiggle'); void c.offsetWidth; c.classList.add('wiggle'); }, i * 220);
    });
    Hand.at(container, { glow: false, sweep: true });
  }

  /* ---------- session records (for the parent report) ---------- */
  function loadSessions() { var s = store.get('tl_sessions', []); return Array.isArray(s) ? s : []; }
  function saveSessions() {
    if (!G.rec) return;
    var all = loadSessions().filter(function (s) { return s.id !== G.rec.id; });
    all.push(G.rec); while (all.length > 30) all.shift();
    store.set('tl_sessions', all);
  }
  function curRec() { return G.rec && G.rec.items[G.rec.items.length - 1]; }
  function endRec(reason) {
    if (!G.active || !G.rec) { G.active = false; return; }
    G.active = false; G.sleeping = false; G.rec.end = new Date().toISOString(); G.rec.endedBy = reason;
    saveSessions();
  }
  function adapt(skill, firstTry, struggled) {
    if (!progress.adapt) progress.adapt = {};
    var s = G.streak, f = G.struggle, cur = lvl(skill), nv = cur;
    if (firstTry) { s[skill] = (s[skill] || 0) + 1; f[skill] = 0; if (s[skill] >= 3) { nv = Math.min(1, cur + 1); s[skill] = 0; } }
    else if (struggled) { f[skill] = (f[skill] || 0) + 1; s[skill] = 0; if (f[skill] >= 2) { nv = Math.max(-1, cur - 1); f[skill] = 0; } }
    else s[skill] = 0;
    if (nv !== cur) {
      progress.adapt[skill] = nv; saveProgress();
      if (G.rec) { G.rec.changes.push({ skill: skill, dir: nv > cur ? 'up' : 'down', to: nv }); saveSessions(); }
    }
  }

  /* ---------- playlist ---------- */
  function sessionTarget() { return Number(settings.sessionLen) || { '2-3': 4, '4-5': 5, '5-6': 6 }[band()] || 5; }
  function minutesPerItem() { return { '2-3': 1.5, '4-5': 2, '5-6': 2.5 }[band()] || 2; }
  function seededRand(seed) { var x = seed >>> 0 || 1; return function () { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return (x % 100000) / 100000; }; }
  function buildPlaylist() {
    var A = settings.activities, b = band(), d = new Date();
    var todays = loadSessions().filter(function (s) { return s.start && todayKey(new Date(s.start)) === todayKey(); }).length;
    var seed = d.getFullYear() * 1000 + d.getMonth() * 40 + d.getDate() + todays * 7;
    var rnd = seededRand(seed * 2654435761);
    var odd = d.getDate() % 2 === 1;
    var core = [];
    if (A.letters) core.push(b === '2-3' ? 'abc' : 'letters');
    if (A.numbers) core.push('numbers');
    if (A.shapes) core.push(odd ? 'colors' : 'shapes');
    if (A.memory) core.push('memory');
    if (A.shapes) core.push(odd ? 'shapes' : 'colors');
    if (A.letters) core.push(b === '2-3' ? 'letters' : 'abc');
    var n = sessionTarget();
    ensureUsageToday();
    var left = limitSeconds() - usage.seconds;
    if (isFinite(left)) n = Math.min(n, Math.max(1, Math.floor(left / 60 / minutesPerItem())));
    var useStory = A.stories && (n >= 3 || !core.length);
    var take = useStory ? n - 1 : n;
    var list = [];
    if (core.length) {
      var rot = Math.floor(rnd() * core.length);
      // keep the first two skills of the day varied: rotate, but always include numbers + letters early when available
      var ordered = core.slice(rot).concat(core.slice(0, rot));
      var reps = core.filter(function (t) { return t !== 'memory'; });
      var i = 0;
      while (list.length < take) { list.push(i < ordered.length ? ordered[i] : reps[i % reps.length]); i++; }
      for (var si = list.length - 1; si > 0; si--) { var sj = Math.floor(rnd() * (si + 1)), st = list[si]; list[si] = list[sj]; list[sj] = st; }
      // no two of the same in a row, memory not first (a gentle quiz warms up better)
      for (var k = 0; k < 12; k++) {
        var bad = false;
        for (var j = 1; j < list.length; j++) if (list[j] === list[j - 1]) { var x = list.splice(j, 1)[0]; list.push(x); bad = true; break; }
        if (list[0] === 'memory' && list.length > 1) { list.push(list.shift()); bad = true; }
        if (!bad) break;
      }
    }
    if (useStory) list.push('story');
    // v3.1: Make a Story takes the read-aloud story's place on alternate sessions (or the last slot when stories are off)
    if (A.storymaker !== false && settings.smGuided !== false && n >= 2) {
      if (useStory) { if ((Math.floor(d.getTime() / 86400000) + todays) % 2 === 0) list[list.length - 1] = 'storymaker'; }
      else if (list.length >= 2) list[list.length - 1] = 'storymaker';
      else list.push('storymaker');
    }
    if (TEST && QS.tlplan) list = QS.tlplan.split(',').filter(function (t) { return GTYPES[t]; });
    var storyIdx = ((progress.storyNext || 0) % D.stories.length);
    var abcStart = progress.abcNext || 0;
    var gDone = progress.gDone || {};
    return list.map(function (t) {
      var it = { type: t, demo: t !== 'story' && t !== 'abc' && t !== 'storymaker' && (gDone[t] || 0) < 3 };
      if (t === 'numbers') it.item = pick(D.countItems);
      if (t === 'story') it.story = storyIdx;
      if (t === 'abc') { it.letters = []; for (var q = 0; q < 3; q++) it.letters.push((abcStart + q) % 26); abcStart += 3; }
      return it;
    });
  }
  function itemTitle(it) {
    var base = GTYPES[it.type].name;
    if (it.type === 'numbers' && it.item) return base + ' (' + it.item.name + ')';
    if (it.type === 'story') return 'Story: ' + fillName(D.stories[it.story].title);
    if (it.type === 'abc') return 'ABC: ' + it.letters.map(function (i) { return D.letters[i].L; }).join(', ');
    return base;
  }
  function announceFor(it) {
    switch (it.type) {
      case 'abc': return { say: TX('g_ann_abc'), pic: 'ABC' };
      case 'letters': return { say: TX('g_ann_letters'), pic: '🔍🔤' };
      case 'numbers': return { say: TX('g_ann_count', { item: it.item }), pic: it.item.e + it.item.e + it.item.e };
      case 'shapes': return { say: TX('g_ann_shapes'), pic: h('span', { class: 'pic-row' }, shapeEl('circle', 'blue'), shapeEl('triangle', 'red'), shapeEl('star', 'yellow')) };
      case 'colors': return { say: TX('g_ann_colors'), pic: h('span', { class: 'pic-row' }, colorBlob('red'), colorBlob('yellow'), colorBlob('blue')) };
      case 'story': var s = D.stories[it.story]; return { say: TX('g_ann_story', { story: s }), pic: '📖' + s.cover };
      case 'memory': return { say: TX('g_ann_memory'), pic: '🃏🃏' };
      case 'storymaker': return { say: TX('g_ann_sm'), pic: '✨📖' };
    }
    return { say: TX('g_ann_play'), pic: '⭐' };
  }

  /* ---------- guided screens ---------- */
  function lockBtn() {
    return h('button', { class: 'kbtn lock', 'aria-label': 'Grown-ups', title: 'Grown-ups', onclick: function () { if (Date.now() < gateCooldown) return; openGate(parentMode); } }, '🔒');
  }
  function pathEl() {
    var p = h('div', { class: 'gpath', 'aria-hidden': 'true' });
    if (!G.list.length) return p;
    G.list.forEach(function (it, i) { p.appendChild(h('span', { class: 'gstep' + (i < G.idx ? ' done' : i === G.idx ? ' now' : '') }, GTYPES[it.type].icon)); });
    p.appendChild(h('span', { class: 'gstep goal' + (G.idx >= G.list.length ? ' now' : '') }, '🏆'));
    return p;
  }
  function gBar() {
    return h('header', { class: 'kidbar gbar' }, lockBtn(), pathEl(), G.fromHome ? homeFromGuided() : h('div', { class: 'gbar-sp', 'aria-hidden': 'true' }));
  }
  function gScreen(cls, content, screen, owlCls) {
    var main = h('main', { class: 'screen kid guided ' + cls },
      gBar(), scheduleEl(G.list, G.idx),
      h('div', { class: 'gstage' }, h('div', { class: 'gside' }, owlEl(owlCls)), h('div', { class: 'gmain' }, content)));
    show(main, screen);
    if (noVoice()) document.body.classList.add('novoice'); else document.body.classList.remove('novoice');
    return main;
  }

  /* v3.3: a guided session started from the kid home ("Play with Booyo") can go back home; the unattended guided start cannot */
  function homeFromGuided(big) {
    return h('button', { class: big ? 'bigbtn blue' : 'kbtn home', id: big ? 'gHomeBig' : 'gHome', 'aria-label': 'Home',
      onclick: function () { Sound.pop(); stopGuided('home'); G.fromHome = false; kidHome(); } }, '🏠');
  }
  function guidedStart() {
    G.fromHome = false;
    mode = 'kid'; enterKidGuards(); G.active = false; G.list = []; G.sleeping = false;
    if (isOverLimit()) return showBreak();
    var play = h('button', { class: 'play-btn', 'aria-label': 'Play', onclick: beginSession }, '▶');
    var main = h('main', { class: 'screen kid guided gstart' },
      h('header', { class: 'kidbar gbar' }, lockBtn(), h('div', { class: 'gpath' },
        h('span', { class: 'gbrand' }, h('img', { src: 'icons/icon-192.png', alt: '', width: '192', height: '192' }), h('span', {}, 'Booyo')))),
      h('div', { class: 'gstart-stage' },
        owlEl('waving big'),
        h('h1', { class: 'hello' }, 'Hi ' + name() + '! 👋'),
        play));
    if (settings.schedule) { var pre = scheduleEl(buildPlaylist(), 0); if (pre) main.insertBefore(pre, main.children[1]); }
    show(main, 'gstart');
    G.repeat = null;
    setBubble('👋');
    later(function () { Hand.at(play, { glow: false }); }, 300);
  }

  function beginSession() {
    Sound.resume(); Sound.pop(); fvUnlock();
    if (settings.fullscreen && document.documentElement.requestFullscreen && !document.fullscreenElement) {
      try { document.documentElement.requestFullscreen().catch(function () {}); } catch (e) { /* ignore */ }
    }
    ensureUsageToday();
    if (isOverLimit()) return showBreak();
    G.list = buildPlaylist(); G.idx = 0; G.sleeping = false; G.streak = {}; G.struggle = {}; G.wrapUp = false;
    G.rec = { id: Date.now().toString(36) + rand(1000), start: new Date().toISOString(), end: null, endedBy: '', band: band(),
      planned: G.list.map(function (t) { return t.type; }), items: [], stars: 0, sleeps: 0, activeSec: 0, changes: [] };
    Idle.accum = 0;
    if (!G.list.length) {
      gScreen('ghello', [h('div', { class: 'announce-pic' }, '🧸')], 'gempty', '');
      talk(TX('g_empty'), '🧸');
      return;
    }
    G.active = true; saveSessions();
    gScreen('ghello', [h('h1', { class: 'hello' }, 'Hi ' + name() + '! 👋'), h('div', { class: 'announce-pic' }, '🦉')], 'ghello', 'waving');
    G.repeat = null;
    talk(TX('s_hi'), '👋', function () { later(nextItem, T.beat); });
  }

  function nextItem() {
    if (!G.active) return;
    if (G.idx >= G.list.length) return sessionDone('done');
    var left = limitSeconds() - usage.seconds;
    if (G.idx > 0 && (G.wrapUp || (isFinite(left) && left < 45))) return sessionDone('time');
    var it = G.list[G.idx];
    G.rec.items.push({ type: it.type, title: itemTitle(it), icon: GTYPES[it.type].icon, questions: 0, firstTry: 0, wrongTaps: 0,
      helped: [], idleReprompts: 0, skipped: '', demo: false, start: new Date().toISOString() });
    saveSessions();
    var a = announceFor(it);
    gScreen('gannounce', [h('div', { class: 'announce-pic' }, a.pic)], 'g-announce', 'happy');
    G.repeat = function () { talk(a.say, GTYPES[it.type].icon); };
    talk(a.say, GTYPES[it.type].icon, function () { later(function () { runItem(it); }, T.beat); });
  }

  function runItem(it) {
    var fin = function () { finishItem(it); };
    if (it.type === 'abc') return gAbc(it, fin);
    if (it.type === 'story') return gStory(it, fin);
    if (it.type === 'memory') return gMemory(it, fin);
    if (it.type === 'storymaker') return storyMaker(fin);
    var B = bandCfg(), make;
    if (it.type === 'letters') make = function (demo) { var l = L('letters'); return letterQ({ n: B.n[l], types: demo ? ['find'] : B.letterTypes[l] }); };
    else if (it.type === 'numbers') make = function (demo) { var l = L('numbers'); return numberQ({ item: it.item, n: B.n[l], max: demo ? 3 : B.count[l], min: 2, types: demo ? ['count'] : B.numTypes[l] }); };
    else if (it.type === 'shapes') make = function (demo) { var l = L('shapes'), S = SHAPE_CFG[band()]; return shapeQ({ shapes: S.shapes, colors: S.colors, n: B.n[l], types: demo || band() === '2-3' || l === 0 ? ['shape'] : ['shape', 'both'] }); };
    else make = function (demo) { var l = L('colors'), S = SHAPE_CFG[band()]; return shapeQ({ shapes: S.shapes, colors: S.colors, n: B.n[l], types: demo || band() !== '5-6' || l < 2 ? ['color'] : ['color', 'both'] }); };
    gQuiz({ type: it.type, skill: GTYPES[it.type].skill, rounds: B.rounds, demo: it.demo, make: make }, fin);
  }

  function finishItem(it) {
    idleStop(); Hand.hide(); G.repeat = null;
    var r = curRec();
    if (r) r.end = new Date().toISOString();
    progress.gDone = progress.gDone || {};
    if (!r || !r.skipped) { progress.gDone[it.type] = (progress.gDone[it.type] || 0) + 1; activityDone(GTYPES[it.type].act); }
    if (it.type === 'story') progress.storyNext = (it.story + 1) % D.stories.length;
    if (it.type === 'abc') progress.abcNext = (it.letters[it.letters.length - 1] + 1) % 26;
    saveProgress(); saveSessions();
    G.idx++;
    var p = app.querySelector('.gpath'); if (p) p.replaceWith(pathEl());
    var sc = app.querySelector('.gschedule'), sn = scheduleEl(G.list, G.idx); if (sc && sn) sc.replaceWith(sn);
    var skipped = r && r.skipped;
    if (!skipped) { confetti(); Sound.yay(); }
    talk(skipped ? TX('g_go') : TX('g_did'), skipped ? '➡️' : '🎉',
      function () { later(nextItem, T.beat); });
  }

  /* ---------- guided quiz (letters, numbers, shapes, colors, story question) ---------- */
  function gQuiz(it, done) {
    var rounds = it.rounds || 3, round = 0, r = curRec();
    function next() {
      if (round >= rounds) return done();
      round++;
      ask(false, round === 1 && it.demo ? TX('g_nowtry') + ' ' : '');
    }
    function ask(demo, intro) {
      var q = it.make(demo), st = { wrong: 0, helped: false, locked: true, done: false };
      var btns = [], okBtn = null;
      var grid = h('div', { class: 'choices c' + q.choices.length });
      q.choices.forEach(function (c) {
        var b = h('button', { class: 'choice', 'aria-label': c.label }, c.el);
        if (c.correct) { okBtn = b; if (TEST) b.setAttribute('data-ok', '1'); }
        b.addEventListener('click', function () { tap(c, b); });
        grid.appendChild(b); btns.push(b);
      });
      var main = gScreen('gquiz ' + (it.cls || ''), [
        rounds > 1 ? progressDots(demo ? 0 : round - 1, rounds) : null,
        h('section', { class: 'prompt' }, q.visual || null, q.text ? h('p', { class: 'ptext' }, q.text) : null),
        grid], 'g-' + it.type);
      var helpAt = Math.min(2, q.choices.length - 1);
      function enabledCount() { return btns.filter(function (b) { return !b.disabled; }).length; }
      function tap(c, b) {
        if (st.locked || st.done || b.disabled) return;
        if (c.correct) {
          st.done = true; idleStop(); Hand.hide(); b.classList.add('right');
          addStar(q.skill || it.skill); Sound.yay(); burst(b);
          var first = st.wrong === 0 && !st.helped;
          r.questions++; if (first) r.firstTry++;
          adapt(it.skill, first, st.wrong >= helpAt); saveSessions();
          G.repeat = null;
          talk(pick(PRAISE) + ' ' + (q.after || ''), '⭐', function () { later(next, T.beat); });
        } else {
          st.wrong++; r.wrongTaps++; b.classList.add('soft'); b.disabled = true; saveSessions();
          if (!st.helped && (st.wrong >= helpAt || enabledCount() === 1)) {
            st.helped = true; r.helped.push(q.desc || 'a question');
            Hand.at(okBtn);
            talk(TX('g_shiny') + ' ' + q.say, '✨', idleKick);
          } else talk(pick(ENCOURAGE) + ' ' + q.say, '💪', idleKick);
        }
      }
      function firstUncounted() { return q.countGrid ? q.countGrid.querySelector('.count-item:not(.counted)') : null; }
      if (q.countGrid) {
        q.onAllCounted = function () {
          if (st.locked || st.done) return;
          later(function () { if (st.done) return; hintSweep(grid); talk(TX('g_howmany'), '❓', idleKick); }, 900);
        };
      }
      function childTurn() {
        st.locked = false;
        G.repeat = function () { talk(q.say, '👆', idleKick); };
        idleArm(idleLadder(r, function () {
          var u = firstUncounted();
          if (st.helped) Hand.at(okBtn);
          else if (u) Hand.at(u, { glow: false });
          else hintSweep(grid);
          talk(q.say, '👆', idleKick);
        }, done));
        talk(intro + q.say, '👆', function () {
          idleKick();
          if (st.done) return;
          if (noVoice() || (q.countGrid && round === 1)) { var u = firstUncounted(); if (u) Hand.at(u, { glow: false }); else hintSweep(grid); }
        });
      }
      if (!demo) return childTurn();
      /* demo: "Watch me!" Booyo's hand does the first one */
      r.demo = true; main.classList.add('demoing');
      G.repeat = null;
      talk(TX('g_watch') + ' ' + q.say, '👀', function () {
        var steps = [];
        if (q.countGrid) Array.prototype.forEach.call(q.countGrid.querySelectorAll('.count-item'), function (ci) {
          steps.push(function (nx) { Hand.at(ci, { glow: false, demo: true }); later(function () { Hand.tap(); ci.click(); later(nx, T.step * 1.2); }, T.step); });
        });
        steps.push(function (nx) {
          Hand.at(okBtn, { demo: true });
          later(function () { Hand.tap(); okBtn.classList.add('right'); Sound.yay(); later(nx, T.step); }, T.step * 1.3);
        });
        (function run(i) { if (i >= steps.length) return after(); steps[i](function () { run(i + 1); }); })(0);
        function after() { talk(TX('g_like') + ' ' + (q.after || ''), '👍', function () { Hand.hide(); later(next, T.beat); }); }
      });
    }
    if (it.demo) ask(true, ''); else next();
  }

  /* ---------- ABC parade: letter + picture, tap the picture ---------- */
  function gAbc(it, done) {
    var r = curRec(), i = 0;
    function showL() {
      if (i >= it.letters.length) return done();
      var li = it.letters[i], l = D.letters[li], col = TILE_COLORS[li % TILE_COLORS.length], tapped = false;
      if (progress.lettersSeen.indexOf(l.L) < 0) { progress.lettersSeen.push(l.L); saveProgress(); }
      var pic = h('button', { class: 'lc-emoji', 'aria-label': l.word }, l.e);
      if (TEST) pic.setAttribute('data-ok', '1');
      var cardEl = h('div', { class: 'letter-card', style: { borderColor: col } },
        h('div', { class: 'lc-letters', style: { color: col } }, l.L + l.L.toLowerCase()), pic,
        h('div', { class: 'lc-word' }, l.L === 'X' ? h('span', {}, 'Fo', h('b', {}, 'x')) : h('span', {}, h('b', {}, l.word.charAt(0)), l.word.slice(1))));
      gScreen('gabc', [progressDots(i, it.letters.length), cardEl], 'g-abc');
      var sayIt = letterSay(l) + ' ' + TX('g_abc_tap', { letter: l });
      pic.addEventListener('click', function () {
        if (tapped) return;
        tapped = true; idleStop(); Hand.hide(); pic.classList.add('right-pic');
        addStar('letters'); Sound.yay(); burst(pic); r.questions++; r.firstTry++; saveSessions();
        G.repeat = null;
        talk(TX('g_abc_got', { letter: l }) + ' ' + pick(PRAISE), '⭐', function () { i++; later(showL, T.beat); });
      });
      G.repeat = function () { talk(sayIt, '👆', idleKick); };
      idleArm(idleLadder(r, function () { Hand.at(pic); talk(sayIt, '👆', idleKick); }, done));
      talk(sayIt, '👆', function () { idleKick(); if (!tapped && (i === 0 || noVoice())) Hand.at(pic); });
    }
    showL();
  }

  /* ---------- story: read aloud, pages turn by themselves, then one question ---------- */
  function gStory(it, done) {
    var story = D.stories[it.story];
    function page(idx) {
      if (idx >= story.pages.length) return question();
      var pg = story.pages[idx], text = fillName(pg.text), words = [], pos = 0;
      var para = h('p', { class: 'story-text' });
      text.split(/(\s+)/).forEach(function (part) {
        if (/^\s+$/.test(part) || !part) { para.appendChild(document.createTextNode(part)); pos += part.length; return; }
        var sp = h('span', { class: 'w' }, part); words.push({ start: pos, end: pos + part.length, el: sp }); para.appendChild(sp); pos += part.length;
      });
      var art = h('button', { class: 'story-art', 'aria-label': 'Read again' }, pg.art);
      var main = gScreen('gstory', [progressDots(idx + 1, story.pages.length), art, para], 'g-story');
      main.style.background = story.bg;
      function readAloud() {
        words.forEach(function (w) { w.el.classList.remove('hl'); });
        talk(text, '📖', function () {
          words.forEach(function (w) { w.el.classList.remove('hl'); });
          later(function () { page(idx + 1); }, 900 * K);
        }, { onboundary: function (e) {
          if (typeof e.charIndex !== 'number') return;
          words.forEach(function (w) { w.el.classList.toggle('hl', e.charIndex >= w.start && e.charIndex < w.end); });
        } });
      }
      art.addEventListener('click', readAloud);
      G.repeat = readAloud;
      readAloud();
    }
    function question() {
      gQuiz({ type: 'story', skill: 'stories', rounds: 1, demo: false, cls: 'story-q', make: function () {
        return {
          say: fillName(story.q.say), text: '❓', desc: 'story question: ' + fillName(story.q.say),
          choices: story.q.choices.map(function (c) { return { label: c.label, correct: !!c.correct, el: h('span', { class: c.num ? 'big-num' : 'choice-emoji' }, c.e) }; }),
          after: TX('st_ok', { story: story })
        };
      } }, done);
    }
    page(0);
  }

  /* ---------- matching pairs ---------- */
  function gMemory(it, done) {
    var r = curRec(), pairs = bandCfg().pairs[L('memory')];
    var items = sample(D.memory, pairs);
    var cards = shuffle(items.concat(items)).map(function (x) { return { it: x, open: false, done: false, el: null }; });
    var first = null, busy = true, matched = 0, misses = 0, missRun = 0, helped = false;
    var grid = h('div', { class: 'mem-grid m' + cards.length });
    function render(c) { c.el.classList.toggle('open', c.open || c.done); c.el.classList.toggle('done', c.done); }
    function mate(c) { return cards.filter(function (o) { return o !== c && o.it === c.it; })[0]; }
    function finishMem() {
      if (!progress.adapt) progress.adapt = {};
      var cur = lvl('memory'), nv = helped ? Math.max(-1, cur - 1) : misses <= pairs ? Math.min(1, cur + 1) : cur;
      if (nv !== cur) { progress.adapt.memory = nv; saveProgress(); G.rec.changes.push({ skill: 'memory', dir: nv > cur ? 'up' : 'down', to: nv }); }
      saveSessions();
      later(done, T.beat);
    }
    cards.forEach(function (c, ci) {
      c.el = h('button', { class: 'mem-card', 'aria-label': 'Card' }, h('span', { class: 'back' }, '❓'), h('span', { class: 'front' }, c.it.e));
      if (TEST) c.el.setAttribute('data-k', String(items.indexOf(c.it)));
      c.el.addEventListener('click', function () { flip(c, false); });
      grid.appendChild(c.el);
    });
    function flip(c, demo) {
      if ((busy && !demo) || c.open || c.done) return;
      c.open = true; render(c); Sound.flip();
      if (!first) {
        first = c; Hand.hide();
        if (!demo) {
          talk(TX('mm_name', { mem: c.it }), null);
          if (missRun >= 3) { helped = true; missRun = 0; r.helped.push('matching pairs (' + c.it.name + ')'); Hand.at(mate(c).el); }
        }
        return;
      }
      var a = first; first = null; Hand.hide();
      if (a.it === c.it) {
        var clean = missRun === 0;
        a.done = c.done = true; render(a); render(c); matched++; missRun = 0;
        if (demo) return;
        addStar('memory'); Sound.yay(); burst(c.el); r.questions++; if (clean) r.firstTry++; saveSessions();
        talk(TX('mm_match', { mem: c.it }), '⭐', function () { if (matched === pairs) finishMem(); else idleKick(); });
        if (matched === pairs) idleStop();
      } else {
        busy = true; misses++; missRun++; r.wrongTaps++; saveSessions();
        talk(TX('mm_again', { mem: c.it }), '💪');
        later(function () { a.open = c.open = false; render(a); render(c); busy = false; idleKick(); }, Math.max(500, 1300 * K));
      }
    }
    var main = gScreen('gmem', [grid], 'g-memory');
    function childTurn(intro) {
      busy = false;
      G.repeat = function () { talk(TX('g_mem_find'), '👆', idleKick); };
      idleArm(idleLadder(r, function () {
        var down = cards.filter(function (c) { return !c.open && !c.done; });
        if (down.length) Hand.at(down[rand(down.length)].el, { glow: false });
        talk(TX('g_mem_find'), '👆', idleKick);
      }, done));
      talk(intro + TX('g_mem_find'), '👆', function () {
        idleKick();
        if (noVoice() && !first) { var d = cards.filter(function (c) { return !c.open && !c.done; })[0]; if (d) Hand.at(d.el, { glow: false }); }
      });
    }
    if (!it.demo || pairs < 2) return childTurn('');
    r.demo = true; main.classList.add('demoing');
    var a0 = cards[0], b0 = mate(a0);
    talk(TX('g_mem_demo1'), '👀', function () {
      Hand.at(a0.el, { glow: false, demo: true });
      later(function () {
        Hand.tap(); flip(a0, true);
        talk(TX('g_mem_demo2', { mem: a0.it }), '👀', function () {
          Hand.at(b0.el, { glow: false, demo: true });
          later(function () {
            Hand.tap(); flip(b0, true); Sound.yay();
            talk(TX('g_mem_demo3'), '👍', function () { Hand.hide(); main.classList.remove('demoing'); childTurn(''); });
          }, T.step * 1.3);
        });
      }, T.step * 1.3);
    });
  }

  /* ---------- end of session, sleepy screen ---------- */
  function sessionDone(reason) {
    if (!G.active) return;
    endRec(reason);
    idleStop(); Hand.hide();
    var stars = G.rec.stars;
    gScreen('gdone', [
      h('h1', { class: 'hello' }, 'All done! 🎉'),
      h('div', { class: 'big-emoji bounce' }, '🏆'),
      h('div', { class: 'earned', 'aria-label': stars + ' stars' }, stars ? '⭐'.repeat(Math.min(stars, 15)) : '💖')], 'gdone', 'happy');
    confetti(); Sound.yay();
    var msg = TX(reason === 'time' ? 's_today' : 's_alldone') + ' ' + TX('s_great') + ' ' + TX(stars === 1 ? 's_earned1' : 's_earned', { n: stars });
    G.repeat = function () { talk(msg, '🎉'); };
    talk(msg, '🎉', function () { later(gEnd, 2500 * K); });
  }
  function gEnd() {
    gScreen('gend', [
      h('h1', { class: 'hello' }, '👋'),
      h('div', { class: 'break-ideas' }, D.breakIdeas.map(function (b) { return h('div', { class: 'break-idea' }, h('span', {}, b.e), h('small', {}, b.t)); })),
      G.fromHome ? h('div', { class: 'row' }, homeFromGuided(true)) : null], 'gend', 'waving');
    var bye = TX('s_bye');
    G.repeat = function () { talk(bye, '👋'); };
    talk(TX('s_break') + ' ' + bye, '👋');
  }
  function goSleep() {
    if (G.sleeping || !G.active) return;
    G.sleeping = true; idleStop();
    if (G.rec) { G.rec.sleeps++; saveSessions(); }
    var wakeBtn = h('button', { class: 'wake-btn', 'aria-label': 'Wake up' }, '☀️');
    var main = h('main', { class: 'screen kid guided gsleep' },
      h('header', { class: 'kidbar gbar' }, lockBtn(), pathEl()),
      h('div', { class: 'gstart-stage' }, owlEl('sleepy big'), wakeBtn));
    main.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.lock')) return; wakeUp(); });
    show(main, 'gsleep');
    G.repeat = null;
    talk(TX('s_sleepy'), '😴', function () { Hand.at(wakeBtn, { glow: false }); });
  }
  function wakeUp() {
    if (!G.sleeping) return;
    G.sleeping = false; Idle.accum = 0; Sound.resume(); Sound.pop(); fvUnlock();
    if (isOverLimit()) return showBreak();
    var it = G.list[G.idx];
    if (!it) return sessionDone('done');
    it.demo = false;
    gScreen('ghello', [h('div', { class: 'announce-pic' }, '☀️')], 'g-wake', 'happy');
    talk(TX('s_back'), '☀️', function () { later(function () { runItem(it); }, T.beat); });
  }

  /* ---------- parent corner: session report + setup tips ---------- */
  var REASONS = { done: 'finished the whole playlist', time: 'daily time limit reached', parent: 'a grown-up opened the Parent corner', switched: 'switched to menu mode', '': 'still in progress (or the app was closed)' };
  var SKILL_NAMES = { letters: 'Letters', numbers: 'Numbers', shapes: 'Shapes', colors: 'Colors', memory: 'Matching', stories: 'Stories' };
  function fmtTime(iso) { try { var d = new Date(iso); return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); } catch (e) { return iso; } }
  function levelName(v) { return v < 0 ? 'easier' : v > 0 ? 'a bit harder' : 'normal'; }
  function reportCard() {
    var all = loadSessions(), last = all[all.length - 1];
    var c = card('📝 Session report', 'wide');
    c.id = 'reportCard';
    if (!last) { c.appendChild(h('p', { class: 'hint' }, 'No guided sessions yet. After your child plays with Booyo, you will see here what they did, how many stars they earned, and where they needed help.')); return c; }
    var mins = Math.round((last.activeSec || 0) / 60);
    var helpAll = [], idleTotal = 0, skippedN = 0;
    last.items.forEach(function (it) { helpAll = helpAll.concat(it.helped || []); idleTotal += it.idleReprompts || 0; if (it.skipped) skippedN++; });
    c.appendChild(h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('b', {}, String(last.items.filter(function (i) { return !i.skipped; }).length) + '/' + last.planned.length), h('span', {}, 'activities done')),
      h('div', { class: 'stat' }, h('b', {}, String(last.stars)), h('span', {}, '⭐ stars')),
      h('div', { class: 'stat' }, h('b', {}, (mins < 1 && last.activeSec ? '<1' : String(mins)) + ' min'), h('span', {}, '⏱️ playing time')),
      h('div', { class: 'stat' }, h('b', {}, String(helpAll.length)), h('span', {}, '✨ times Booyo helped'))));
    c.appendChild(h('p', { class: 'hint' }, 'Last session: ' + fmtTime(last.start) + ' · ages ' + String(last.band).replace('-', '–') + ' · ended: ' + (REASONS[last.endedBy] || last.endedBy) +
      (last.sleeps ? ' · paused ' + last.sleeps + '× because nobody tapped for a while' : '')));
    var tbl = h('table', { class: 'rtable' }, h('thead', {}, h('tr', {}, h('th', {}, 'Activity'), h('th', {}, 'Right first try'), h('th', {}, 'Wrong taps'), h('th', {}, 'Notes'))));
    var tb = h('tbody');
    last.items.forEach(function (it) {
      var notes = [];
      if (it.demo) notes.push('Booyo showed how first');
      if (it.helped && it.helped.length) notes.push('needed help with: ' + it.helped.join('; '));
      if (it.idleReprompts) notes.push('Booyo repeated the question ' + it.idleReprompts + '× (no tap)');
      if (it.skipped === 'idle') notes.push('moved on (no taps)');
      if (it.skipped === 'child') notes.push('child chose to move on');
      tb.appendChild(h('tr', {}, h('td', {}, it.icon + ' ' + it.title), h('td', {}, it.questions ? it.firstTry + ' of ' + it.questions : '–'), h('td', {}, String(it.wrongTaps || 0)), h('td', {}, notes.join(' · ') || 'smooth sailing ✓')));
    });
    tbl.appendChild(tb); c.appendChild(h('div', { class: 'rwrap' }, tbl));
    c.appendChild(h('h3', {}, 'Where help was needed'));
    c.appendChild(helpAll.length ? h('ul', { class: 'plain' }, helpAll.map(function (x) { return h('li', {}, x); })) : h('p', { class: 'hint' }, 'No help needed this time. 🎉'));
    c.appendChild(h('h3', {}, 'Difficulty (adjusts by itself, always within the age band)'));
    c.appendChild(h('p', { class: 'hint' }, ['letters', 'numbers', 'shapes', 'colors', 'memory'].map(function (s) { return SKILL_NAMES[s] + ': ' + levelName(lvl(s)); }).join(' · ') +
      (last.changes && last.changes.length ? '. This session: ' + last.changes.map(function (x) { return SKILL_NAMES[x.skill] + (x.dir === 'up' ? ' went up ↑' : ' went down ↓'); }).join(', ') + '.' : '.')));
    var older = all.slice(0, -1).slice(-5).reverse();
    if (older.length) {
      c.appendChild(h('h3', {}, 'Earlier sessions'));
      c.appendChild(h('ul', { class: 'plain' }, older.map(function (s) {
        var hn = 0; s.items.forEach(function (i) { hn += (i.helped || []).length; });
        return h('li', {}, fmtTime(s.start) + ': ' + s.items.map(function (i) { return i.icon; }).join(' ') + ' · ' + s.stars + ' ⭐ · ' + hn + ' help · ' + (REASONS[s.endedBy] || s.endedBy));
      })));
    }
    c.appendChild(h('div', { class: 'btn-row' }, h('button', { class: 'pbtn ghost danger', onclick: function () {
      if (window.confirm('Clear all session reports?')) { store.set('tl_sessions', []); toast('Reports cleared'); renderParent(); }
    } }, 'Clear reports')));
    return c;
  }
  function tipsCard() {
    var c = card('🛡️ Setup tips for unsupervised use', 'wide tips-card');
    c.id = 'tipsCard';
    var sec = function (t, items) { return h('div', { class: 'tip' }, h('h3', {}, t), h('ul', { class: 'plain' }, items.map(function (x) { return h('li', {}, x); }))); };
    c.appendChild(h('p', { class: 'hint' }, 'Guided mode is designed so your child can play without help, but the device itself must be locked to this app. Do this once, then test it with your child before leaving them alone.'));
    c.appendChild(h('div', { class: 'tips' },
      sec('📲 Install it (works offline)', [
        'Open the app once from an https:// address or localhost (it saves all its files on the device), then: iPad/iPhone Safari → Share → Add to Home Screen; Android Chrome → menu → Install app / Add to Home screen.',
        'After that it opens full-screen from its own owl icon (named "Booyo") and works in Airplane mode. The Privacy card below shows "Offline-ready" when the files are saved.',
        'Plain http:// on a home-network address can\'t save files offline (browser rule), and neither can opening index.html as a file (it still works offline that way, it just can\'t be installed).']),
      sec('📱 iPad / iPhone: Guided Access', [
        'Open this app in Safari → Share → Add to Home Screen, then open it from the Home Screen icon.',
        'Settings → Accessibility → Guided Access → turn On. Set a Passcode (one your child doesn\'t know) and turn on Face ID/Touch ID if you like.',
        'Open the app, then triple-click the side (or Home) button → Options: turn OFF "Volume Buttons" and "Keyboards", leave "Touch" ON → Start.',
        'Optional: in Options, set a Time Limit as a second safety net. To exit: triple-click and enter your passcode.']),
      sec('🤖 Android: Screen pinning or Kids Space', [
        'Settings → Security (or Security & privacy → More security settings) → App pinning / Screen pinning → On, and turn on "Ask for PIN before unpinning".',
        'Open the app in Chrome (menu → Add to Home screen / Install app), open Recent apps, tap the app icon at the top → Pin.',
        'Or use Google Kids Space / Family Link on supported tablets to limit which apps your child can open.',
        'To exit a pin: hold Back + Overview (or swipe up and hold), then enter your PIN.']),
      sec('🔥 Amazon Fire tablet', [
        'Amazon Kids (child) profiles can\'t open local web apps like this one, so use your adult profile with App Pinning.',
        'Adult profile → Settings → Security & Privacy → App Pinning → On (leave "Disable Touch" OFF, your child needs touch).',
        'Turn on Parental Controls (Settings → Profiles & Family Library / Parental Controls) with a password so the store, browser and settings are locked.',
        'Open the app, open the task switcher (square button) and tap the pin icon.']),
      sec('🔊 Sound, headphones, power', [
        'Set the volume to about half before you start, then test Booyo\'s voice (Voice & sound → Test voice).',
        'Kids\' headphones with an 85 dB volume limit are best. On iPhone/iPad: Settings → Sounds & Haptics → Headphone Safety → Reduce Loud Audio.',
        'Plug in the charger or start above 50% battery. Low Power Mode is fine.',
        'Turn on Airplane mode or Do Not Disturb so no notifications, calls or pop-ups appear. The app works fully offline. (Check the voice still works in Airplane mode: some "online" voices need internet.)',
        'Set Auto-Lock to longer than the session. If nobody taps for about 2 minutes, Booyo falls asleep and the timer pauses.',
        'Optional: in Family Voices, record Grandma, Dad or a big sibling so Booyo cheers in a familiar voice. Recordings work offline too; test them once with the volume you will use.']),
      sec('✅ Before you leave', [
        'Do the first session together so your child meets Booyo and learns "tap the big green ▶".',
        'Pick a daily time limit and session length here; the session ends by itself at the limit with a calm goodbye screen.',
        'Stay within earshot. This app is not a babysitter, especially for 2-3 year olds.',
        'Afterwards, check the Session report above to see where your child needed help.'])));
    c.appendChild(h('div', { class: 'btn-row noprint' }, h('button', { class: 'pbtn ghost', onclick: function () { printCard('tips'); } }, '🖨️ Print setup tips')));
    return c;
  }
  function printCard(which) {
    document.body.classList.add('print-' + which);
    var undo = function () { document.body.classList.remove('print-' + which); window.removeEventListener('afterprint', undo); };
    window.addEventListener('afterprint', undo);
    window.print();
    setTimeout(undo, 1500);
  }
  function stopGuided(reason) { if (G.active) endRec(reason || 'switched'); G.sleeping = false; idleStop(); Hand.hide(); }


  function kidStart() { if (settings.guided !== false) guidedStart(); else kidHome(); }

  /* ---------- install to home screen + offline (PWA) ---------- */
  var offlineReady = false;
  if (/^https?:$/.test(location.protocol)) {
    try { document.head.appendChild(h('link', { rel: 'manifest', href: 'manifest.json' })); } catch (e) { /* ignore */ }
    if ('serviceWorker' in navigator) {   // only exists on https:// or localhost (secure contexts)
      navigator.serviceWorker.register('sw.js').then(function () { return navigator.serviceWorker.ready; })
        .then(function () { offlineReady = true; var el = document.getElementById('offlineStatus'); if (el) el.textContent = offlineStatusText(); })
        .catch(function () { /* offline caching unavailable; app still works online */ });
    }
  }
  function offlineStatusText() {
    if (offlineReady || (navigator.serviceWorker && navigator.serviceWorker.controller)) return '✅ Offline-ready: all files are saved on this device, so it works without internet and can be added to the Home Screen.';
    if (location.protocol === 'file:') return 'Opened from a file: works offline as long as the folder stays on this device. (Home-Screen install needs the app to be served over https or localhost.)';
    if (!window.isSecureContext) return '⚠️ Offline saving needs https (or localhost). On this address the app needs the server to be reachable.';
    return 'Saving files for offline use…';
  }

  /* =====================================================================
     v3 FAMILY VOICES: grandparents, parents and siblings record Booyo's guide lines
     (and, optionally, lesson content). OFF by default. Clips are Blobs in this browser's
     IndexedDB only; nothing is uploaded. Anything not recorded uses the built-in voice.
     ===================================================================== */
  var FV_LANGS = { en: 'English', bn: 'Bangla', other: 'Other' };
  var FV_ICONS = ['👵', '👴', '👩', '👨', '🧒', '👧', '👦', '🧕', '👳', '💖'];
  var FV_MAX_MS = 10000;
  function fvLineMax(id) { return id === 'sg_whole' ? 90000 : /^sg_/.test(String(id)) ? 15000 : FV_MAX_MS; }
  var FV_SLOTS = { start: 'At the start of each session', praise: 'Mixed in with praise', end: 'At goodbye' };
  var SM_FV = [   // Make a Story lines a family member can record: [id, label, script, extra matching texts]
    ['sm_intro', 'Start', "Let's make a story!", ["Let's make a story together!"]],
    ['sm_who', 'Who?', 'Who is in the story?'], ['sm_where', 'Where?', 'Where do they go?'],
    ['sm_what', 'What happens?', 'What happens?'], ['sm_end', 'The end?', 'How does it end?'],
    ['sm_tap', 'Tap a picture', 'Tap a picture.'],
    ['sm_say', 'Say it!', 'Now you! Hold the microphone and say something for your story.'],
    ['sm_once', 'Once upon a time', 'Once upon a time'], ['sm_wow', 'Wonderful story', 'What a wonderful story!'],
    ['sm_theend', 'The end', 'The end!']
  ];
  var FV_GUIDE = [
    { id: 'greet', label: 'Greeting', say: 'Hi!', bn: 'Assalamu alaikum! / Kemon acho? (কেমন আছো?)', hint: 'Just the greeting. The child\'s name clip plays right after it.' },
    { id: 'name', label: 'Child\'s name', name: true, hint: 'Say just the name, warmly. It is used wherever Booyo says the name.' },
    { id: 'praise_1', label: 'Praise 1', say: 'Great job!', bn: 'Shabash! (শাবাশ!)', cat: 'praise' },
    { id: 'praise_2', label: 'Praise 2', say: 'You did it!', bn: 'Khub bhalo! (খুব ভালো!)', cat: 'praise' },
    { id: 'praise_3', label: 'Praise 3', say: 'Wonderful!', bn: 'Darun! (দারুণ!)', cat: 'praise' },
    { id: 'praise_4', label: 'Praise 4 (optional)', say: 'Well done!', bn: 'Bah, ki shundor! (বাহ, কী সুন্দর!)', cat: 'praise' },
    { id: 'praise_5', label: 'Praise 5 (optional)', say: 'Super!', bn: 'Oshadharon! (অসাধারণ!)', cat: 'praise' },
    { id: 'try_1', label: 'Try again 1', say: 'Nice try! Let\'s try again.', bn: 'Abar cheshta koro! (আবার চেষ্টা করো!)', cat: 'try' },
    { id: 'try_2', label: 'Try again 2', say: 'Almost! You can do it.', bn: 'Prai hoye geche! (প্রায় হয়ে গেছে!)', cat: 'try' },
    { id: 'try_3', label: 'Try again 3 (optional)', say: 'Keep going!', bn: 'Cholo, abar kori! (চলো, আবার করি!)', cat: 'try' },
    { id: 'start', label: 'Let\'s start', say: 'Let\'s start! Here we go!', bn: 'Cholo shuru kori! (চলো শুরু করি!)' },
    { id: 'break', label: 'Break time', say: 'Time for a break! Let\'s stretch and drink some water.', bn: 'Ekhon birati! Ektu pani khao. (এখন বিরতি! একটু পানি খাও।)' },
    { id: 'alldone', label: 'All done', say: 'All done!', bn: 'Sob shesh! (সব শেষ!)' },
    { id: 'bye', label: 'Goodbye', say: 'Bye bye! See you next time!', bn: 'Abar dekha hobe! (আবার দেখা হবে!)' }
  ];
  var FV_LINE_RE = /^(greet|name|praise_\d{1,2}|try_\d{1,2}|x_[a-z0-9_]{1,60}|start|break|alldone|bye|custom_[a-z0-9]{1,16}|abc_[A-Z]|num_\d{1,2}|color_[a-z]{1,12}|shape_[a-z]{1,12}|st_[a-z0-9]{1,16}_(\d{1,2}|q)|sm_[a-z]{1,12}|sg_(whole|hooray|[wcae]_[a-z]{1,12}))$/;

  function normName(s) { return String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''); }
  function fmtBytes(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function fvSan(s, max) { return String(s || '').replace(/[<>]/g, '').trim().slice(0, max || 24); }

  /* voice list (small, sync) lives in localStorage; the audio lives in IndexedDB */
  var fvVoices = store.get('tl_voices', []);
  if (!Array.isArray(fvVoices)) fvVoices = [];
  function saveVoices() { store.set('tl_voices', fvVoices); }
  function fvVoice(id) { for (var i = 0; i < fvVoices.length; i++) if (fvVoices[i].id === id) return fvVoices[i]; return null; }
  function fvNewId(p) { return (p || 'v') + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36); }

  var VDB = {
    db: null, p: null,
    open: function () {
      var self = this;
      if (self.db) return Promise.resolve(self.db);
      if (self.p) return self.p;
      self.p = new Promise(function (res, rej) {
        if (!window.indexedDB) return rej(new Error('IndexedDB is not available'));
        var rq;
        try { rq = window.indexedDB.open('booyo-voices', 2); } catch (e) { return rej(e); }
        rq.onupgradeneeded = function () {
          var db = rq.result;
          if (!db.objectStoreNames.contains('clips')) db.createObjectStore('clips', { keyPath: 'k' }).createIndex('voice', 'voice');
          if (!db.objectStoreNames.contains('stories')) db.createObjectStore('stories', { keyPath: 'id' });   // v3.1 Story Maker
        };
        rq.onsuccess = function () { self.db = rq.result; self.db.onversionchange = function () { try { self.db.close(); } catch (e) { /* ignore */ } self.db = null; }; res(self.db); };
        rq.onerror = function () { rej(rq.error); };
        rq.onblocked = function () { rej(new Error('blocked')); };
      });
      self.p.catch(function () { self.p = null; });
      return self.p;
    },
    tx: function (mode, fn, name) {
      name = name || 'clips';
      return this.open().then(function (db) {
        return new Promise(function (res, rej) {
          var t = db.transaction(name, mode), out, r = fn(t.objectStore(name));
          if (r) r.onsuccess = function () { out = r.result; };
          t.oncomplete = function () { res(out); };
          t.onerror = function () { rej(t.error); };
          t.onabort = function () { rej(t.error || new Error('aborted')); };
        });
      });
    },
    all: function () { return this.tx('readonly', function (s) { return s.getAll(); }); },
    put: function (rec) { return this.tx('readwrite', function (s) { return s.put(rec); }); },
    del: function (keys) { return this.tx('readwrite', function (s) { [].concat(keys).forEach(function (k) { s.delete(k); }); }); }
  };

  var FV = { clips: {}, ready: false, err: '', audio: null, pid: 0, tok: 0, rot: 0, last: {}, log: [], unlocked: false, silent: '', screenVoice: null, persisted: null, usage: null };
  function fvLog(e) { e.t = Date.now(); FV.log.push(e); if (FV.log.length > 300) FV.log.shift(); }
  function fvLoad() {
    return VDB.all().then(function (rows) {
      FV.clips = {};
      (rows || []).forEach(function (r) {
        if (!r || !r.voice || !r.line) return;
        if (!r.blob && r.buf) r.blob = new Blob([r.buf], { type: r.mime || 'audio/webm' });
        if (!r.blob) return;
        (FV.clips[r.voice] = FV.clips[r.voice] || {})[r.line] = r;
        if (!fvVoice(r.voice)) { fvVoices.push({ id: r.voice, label: 'Family voice', lang: 'other', icon: '💖', custom: [], created: Date.now() }); saveVoices(); }
      });
      FV.ready = true; fvStorageInfo(); fvRefresh();
    }).catch(function (e) {
      FV.ready = true; FV.err = 'Recordings can\'t be saved in this browser (' + ((e && (e.name || e.message)) || 'storage blocked') + '). Private browsing often blocks it.';
      fvRefresh();
    });
  }
  function fvStorageInfo() {
    try {
      if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then(function (p) { FV.persisted = p; });
      if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(function (e) { FV.usage = e; });
    } catch (e) { /* ignore */ }
  }
  function fvPersist() {
    try {
      if (FV.persisted || !navigator.storage || !navigator.storage.persist) return;
      navigator.storage.persist().then(function (p) { FV.persisted = p; }).catch(function () {});
    } catch (e) { /* ignore */ }
  }
  function fvVoiceClips(v) { var m = FV.clips[v.id] || {}; return Object.keys(m).map(function (k) { return m[k]; }); }
  function fvClip(v, line) { return (FV.clips[v.id] || {})[line] || null; }

  /* =====================================================================
     v3.3 EVERY LINE RECORDABLE. TX(key, vars) renders Booyo's lines from D.say (data.js), and fvMaster() lists every
     recordable line from the same templates, so a new line in data.js is recordable automatically.
     Lines with the child's name or a number are recorded in pieces; TX() registers how each spoken sentence breaks into
     pieces so fvPlan() can stitch family clips (and the built-in voice for anything missing) in order.
     ===================================================================== */
  var LN_VAR = { L: 'letter', lis: 'letter', word: 'letter', wordl: 'letter', n: 'num', item: 'item', c: 'color', s: 'shape', mem: 'mem', meml: 'mem',
    title: 'story', answer: 'story', smwho: 'who', smshort: 'who', smgo: 'where', smdid: 'what', smend: 'end' };
  var LN_DOM_LABEL = { letter: 'Letter', num: 'Number', item: 'Counting', color: 'Color', shape: 'Shape', mem: 'Card', story: 'Story', who: 'Who', where: 'Where', what: 'What happens', end: 'Ending' };
  function lnNorm(t) { return String(t || '').toLowerCase().replace(/\s+/g, ' ').replace(/^[\s.!?,:]+|[\s.!?,:]+$/g, ''); }
  function lnSlug(t) { return String(t).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 14) || 'x'; }
  function lnStoryAns(st) { return st.q.choices.filter(function (c) { return c.correct; })[0].label; }
  function lnVal(k, v) {
    switch (k) {
      case 'L': return v.letter.L;
      case 'lis': return v.letter.is || (v.letter.L + ' is for ' + v.letter.word + '!');
      case 'word': return v.letter.word;
      case 'wordl': return v.letter.word.toLowerCase();
      case 'n': return String(v.n);
      case 'item': return v.item.name;
      case 'c': return v.c;
      case 's': return v.s;
      case 'mem': return v.mem.name;
      case 'meml': return v.mem.name.toLowerCase();
      case 'title': return fillName(v.story.title);
      case 'answer': return fillName(lnStoryAns(v.story));
      case 'smwho': return smFill(v.who.name);
      case 'smshort': return smFill(v.who.short);
      case 'smgo': return v.where.go;
      case 'smdid': return v.what.did;
      case 'smend': return v.end.did;
    }
    return '';
  }
  function lnDomKey(dom, v) {
    switch (dom) {
      case 'letter': return v.letter.L; case 'num': return String(v.n); case 'item': return lnSlug(v.item.name); case 'color': return v.c; case 'shape': return v.s;
      case 'mem': return lnSlug(v.mem.name); case 'story': return v.story.id; case 'who': return v.who.id; case 'where': return v.where.id; case 'what': return v.what.id; case 'end': return v.end.id;
    }
    return '';
  }
  function lnDomains() {
    var nums = []; for (var n = 1; n <= 20; n++) nums.push(n);
    var wrap = function (k) { return function (x) { var o = {}; o[k] = x; return o; }; };
    return { letter: D.letters.map(wrap('letter')), num: nums.map(wrap('n')), item: D.countItems.map(wrap('item')), color: Object.keys(D.colors).map(wrap('c')),
      shape: Object.keys(SHAPE_SVG).map(wrap('s')), mem: D.memory.map(wrap('mem')), story: D.stories.map(wrap('story')),
      who: D.storyMaker.who.map(wrap('who')), where: D.storyMaker.where.map(wrap('where')), what: D.storyMaker.what.map(wrap('what')), end: D.storyMaker.end.map(wrap('end')) };
  }
  /* parse "Tap the {c} {s}!" into tokens; work out whether the line is recorded whole (maybe once per value) or in pieces */
  var LN_PARSE = {};
  function lnParse(src) {
    if (LN_PARSE[src]) return LN_PARSE[src];
    var toks = [], re = /\{(#?)(\w+)\}/g, m, last = 0;
    while ((m = re.exec(src))) {
      if (m.index > last) toks.push({ t: src.slice(last, m.index) });
      toks.push({ v: m[2], split: m[1] === '#' || m[2] === 'name', num: m[1] === '#' });
      last = re.lastIndex;
    }
    if (last < src.length) toks.push({ t: src.slice(last) });
    var doms = {}, nsplit = 0;
    toks.forEach(function (k) { if (k.v && !k.split) doms[LN_VAR[k.v]] = 1; if (k.split) nsplit++; });
    var dl = Object.keys(doms), out = { toks: toks, doms: dl, whole: !nsplit && dl.length <= 1 };
    if (!out.whole) {   // pieces: split vars stand alone; with several kinds of placeholder each one is its own piece
      var pieces = [], cur = [];
      var flush = function () { if (cur.length) { pieces.push({ toks: cur }); cur = []; } };
      toks.forEach(function (k) {
        if (k.split) { flush(); pieces.push({ split: k }); }
        else if (k.v && dl.length > 1) { flush(); pieces.push({ word: k }); }
        else cur.push(k);
      });
      flush();
      out.pieces = pieces.filter(function (p) { return p.split || p.word || /[\p{L}\p{N}]/u.test(p.toks.map(function (k) { return k.t || '{' + k.v + '}'; }).join('')); });
    }
    LN_PARSE[src] = out;
    return out;
  }
  function lnRenderToks(toks, vars) {
    return toks.map(function (k) {
      if (k.t !== undefined) return k.t;
      if (k.v === 'name') return vars.name !== undefined ? vars.name : name();
      if (k.num) return String(vars[k.v]);
      return lnVal(k.v, vars);
    }).join('');
  }
  function lnCap(s) { return s.replace(/^(\s*)(\p{Ll})/u, function (a, sp, c) { return sp + c.toUpperCase(); }); }
  function lnVariants(key) { var e = D.say[key]; return e ? [].concat(e[1]) : []; }
  function lnBaseId(key, vi, si, nv, ns) { return 'x_' + key.toLowerCase() + (nv > 1 ? '_v' + vi : '') + (ns > 1 ? '_' + si : ''); }
  /* pieces of one rendered line: [{ id, text }] (id null = always the built-in voice) */
  function lnPieceSeq(key, vi, si, vars, P) {
    var segs = lnVariants(key)[vi].split('|'), base = lnBaseId(key, vi, si, lnVariants(key).length, segs.length), seq = [];
    var M = fvMaster();
    P.pieces.forEach(function (pc, pi) {
      if (pc.split) {
        if (pc.split.v === 'name') {
          var nm = vars.name !== undefined ? vars.name : name(), cn = (settings.childName || '').trim();
          seq.push({ id: cn && normName(nm) === normName(cn) ? 'name' : null, text: nm });
        } else { var n = Number(vars[pc.split.v]); seq.push({ id: n >= 1 && n <= 20 ? 'num_' + n : null, text: String(vars[pc.split.v]) }); }
        return;
      }
      if (pc.word) {
        var val = lnVal(pc.word.v, vars), dom = LN_VAR[pc.word.v], cn2 = (settings.childName || '').trim();
        if (cn2 && normName(val) === normName(cn2)) { seq.push({ id: 'name', text: val }); return; }
        var wid = 'x_w_' + dom + '_' + pc.word.v + '_' + lnDomKey(dom, vars);
        seq.push({ id: M.byText[lnNorm(val)] || wid, text: val });
        return;
      }
      var txt = lnRenderToks(pc.toks, vars), pdom = null;
      pc.toks.forEach(function (k) { if (k.v) pdom = LN_VAR[k.v]; });
      var pid = base + '_p' + pi + (pdom ? '_' + lnDomKey(pdom, vars).toLowerCase() : '');
      seq.push({ id: M.byText[lnNorm(txt)] || pid, text: txt.trim() });
    });
    return seq;
  }
  /* TX(key, vars): the text Booyo says. Also registers piece-recorded sentences for Family Voices. */
  function TX(key, vars) {
    vars = vars || {};
    var vs = lnVariants(key);
    if (!vs.length) return '';
    var vi = vars.v !== undefined ? vars.v : vs.length > 1 ? rand(vs.length) : 0;
    var segs = vs[vi].split('|');
    return segs.map(function (seg, si) {
      var P = lnParse(seg), txt = lnCap(lnRenderToks(P.toks, vars));
      if (!P.whole) lnRegister(txt, lnPieceSeq(key, vi, si, vars, P));
      return txt;
    }).join(' ');
  }
  function lnRegister(txt, seq) {
    var p = lnNorm(txt); if (!p) return;
    var L = FV.dyn || (FV.dyn = []);
    for (var i = 0; i < L.length; i++) if (L[i].p === p) { L.splice(i, 1); break; }
    L.unshift({ p: p, seq: seq });
    if (L.length > 300) L.length = 300;
  }
  /* ---------- the master list ---------- */
  var LN_LEGACY_PRAISE = { 'great job': 'praise_1', 'you did it': 'praise_2', 'wonderful': 'praise_3', 'well done': 'praise_4', 'super': 'praise_5' };
  var LN_LEGACY_TRY = { 'almost! you can do it': 'try_2', 'keep going': 'try_3' };
  function fvMaster() {
    var key = [settings.childName, D.stories.length, Object.keys(D.say).length].join('|');
    if (FV.master && FV.mk === key) return FV.master;
    var lines = [], byId = {}, byText = {};
    function add(ln) {
      var nt = lnNorm(ln.text);
      if (!ln.forceNew && nt && byText[nt]) { var ex = byId[byText[nt]]; if (ex && ln.sample && !ex.sample) ex.sample = ln.sample; return ex; }
      if (byId[ln.id]) return byId[ln.id];
      byId[ln.id] = ln; if (nt && !byText[nt]) byText[nt] = ln.id; lines.push(ln);
      return ln;
    }
    var M = { lines: lines, byId: byId, byText: byText };
    FV.master = M; FV.mk = key;   // set early: lnPieceSeq() looks things up while we build
    var cn = (settings.childName || '').trim(), sn = storyName();
    /* 1) the legacy (v3) lines keep their ids so old recordings and voice packs still work */
    FV_GUIDE.forEach(function (g) {
      if (g.name) { add({ id: 'name', sec: 'guide', text: cn, label: 'Child\'s name', name: true, script: cn }); return; }
      add({ id: g.id, sec: 'guide', text: g.say, label: g.label, cat: g.cat, legacy: true });
    });
    var ps = 6, ts = 4;
    D.praise.concat(lnVariants('g_did')).forEach(function (t) { var n = lnNorm(t); add({ id: LN_LEGACY_PRAISE[n] || 'praise_' + (ps++), sec: 'praise', text: t, label: 'Praise', cat: 'praise' }); });
    D.tryAgain.forEach(function (t) { var n = lnNorm(t); add({ id: LN_LEGACY_TRY[n] || 'try_' + (ts++), sec: 'praise', text: t, label: 'Try again', cat: 'try' }); });
    D.letters.forEach(function (l) { add({ id: 'abc_' + l.L, sec: 'letters', text: lnVal('lis', { letter: l }), label: 'Letter ' + l.L }); });
    for (var n = 1; n <= 20; n++) add({ id: 'num_' + n, sec: 'numbers', text: String(n), label: 'Number ' + n, alt: '(' + D.numberWords[n] + ')' });
    Object.keys(D.colors).forEach(function (c) { add({ id: 'color_' + c, sec: 'colors', text: 'Tap the ' + c + ' one!', label: 'Color: ' + c, swatch: D.colors[c] }); });
    Object.keys(SHAPE_SVG).forEach(function (s) { add({ id: 'shape_' + s, sec: 'colors', text: 'Find the ' + s + '!', label: 'Shape: ' + s }); });
    D.stories.forEach(function (s) {
      var g = 'story_' + s.id;
      s.pages.forEach(function (p, i) { var dep = /\{name\}/.test(p.text); add({ id: 'st_' + s.id + '_' + i, sec: g, text: fillName(p.text), label: 'Page ' + (i + 1), alt: 'Page ' + (i + 1) + ' of ' + s.pages.length, nameDep: dep, nmUsed: dep ? sn : '', forceNew: true }); });
      var qd = /\{name\}/.test(s.q.say);
      add({ id: 'st_' + s.id + '_q', sec: g, text: fillName(s.q.say), label: 'Question', alt: 'The question at the end', nameDep: qd, nmUsed: qd ? sn : '', forceNew: true });
    });
    SM_FV.forEach(function (l) { var ln = add({ id: l[0], sec: 'storymaker', text: l[2], label: l[1] }); (l[3] || []).forEach(function (x) { if (!byText[lnNorm(x)]) byText[lnNorm(x)] = ln.id; }); });
    /* 2) every template in D.say, expanded per value or split into pieces */
    var DOM = lnDomains();
    Object.keys(D.say).forEach(function (k) {
      var sec = D.say[k][0], vs = lnVariants(k);
      vs.forEach(function (src, vi) {
        var segs = src.split('|');
        segs.forEach(function (seg, si) {
          var P = lnParse(seg), base = lnBaseId(k, vi, si, vs.length, segs.length);
          var cat = sec === 'praise' ? 'praise' : null;
          var sample = function (vars) { var o = { k: k, v: vi, si: si, vars: vars }; return o; };
          if (P.whole) {
            if (!P.doms.length) { add({ id: base, sec: sec, text: lnCap(lnRenderToks(P.toks, {})), cat: cat, sample: sample({}) }); return; }
            var dom = P.doms[0];
            DOM[dom].forEach(function (vars) {
              var txt = lnCap(lnRenderToks(P.toks, vars)), dep = !!(cn && normName(txt).indexOf(normName(cn)) >= 0 && (dom === 'who' || dom === 'story'));
              add({ id: base + '_' + lnDomKey(dom, vars).toLowerCase(), sec: sec, text: txt, label: LN_DOM_LABEL[dom] + ': ' + lnLabel(dom, vars), cat: cat, sample: sample(vars), nameDep: dep, nmUsed: dep ? (dom === 'who' ? cn : sn) : '' });
            });
            return;
          }
          /* pieces: list each piece once per value it can take */
          var pdoms = P.doms, combos = [{}];
          pdoms.forEach(function (d) { var nx = []; combos.forEach(function (c) { DOM[d].forEach(function (v) { nx.push(Object.assign({}, c, v)); }); }); combos = nx; });
          if (combos.length > 400) combos = combos.slice(0, 400);
          combos.forEach(function (vars) {
            var full = Object.assign({ name: cn || 'friend', n: 3, a: 2, b: 3, ans: 5 }, vars);
            var whole = lnCap(lnRenderToks(P.toks, full));
            lnPieceSeq(k, vi, si, full, P).forEach(function (pc) {
              if (!pc.id || pc.id === 'name' || /^num_/.test(pc.id) || byId[pc.id]) return;
              var isWord = /^x_w_/.test(pc.id);
              add({ id: pc.id, sec: sec, text: pc.text, piece: true, label: isWord ? 'Word' : 'Part of a sentence', alt: 'Used in: "' + whole + '"', sample: sample(full), cat: cat });
            });
          });
        });
      });
    });
    lines.forEach(function (l) { if (!l.text && !l.name) l.disabled = true; });
    return M;
  }
  function lnLabel(dom, v) {
    switch (dom) {
      case 'letter': return v.letter.L; case 'num': return String(v.n); case 'item': return v.item.name; case 'color': return v.c; case 'shape': return v.s;
      case 'mem': return v.mem.name; case 'story': return fillName(v.story.title); default: var o = v[dom]; return o ? smFill(o.label) : '';
    }
  }
  /* the sentence Booyo would say that uses this line (tests and the "Play Booyo's version" button) */
  function lnSample(ln) {
    if (!ln) return '';
    if (ln.sample) { var s = ln.sample, segs = lnVariants(s.k)[s.v].split('|'), P = lnParse(segs[s.si]), txt = lnCap(lnRenderToks(P.toks, s.vars)); if (!P.whole) lnRegister(txt, lnPieceSeq(s.k, s.v, s.si, s.vars, P)); return txt; }
    if (ln.id === 'greet') return TX('m_home');
    if (ln.id === 'name') return TX('s_great');
    return ln.text;
  }

  /* ---------- what to record ---------- */
  function fvScriptName(v) { return (settings.childName || '').trim() || (v && v.forName) || ''; }
  function fvLetterPhrase(l) { return letterSay(l).replace(/^The letter \w\.\s*/, '').replace(/[.!?]+$/, ''); }
  function fvGroups(v) {
    var nm = fvScriptName(v), bn = v.lang === 'bn', other = v.lang === 'other', M = fvMaster();
    var any = bn || other ? 'Say it your way, in any language.' : '';
    var guideMeta = {}; FV_GUIDE.forEach(function (g) { guideMeta[g.id || 'name'] = g; });
    var bySec = {};
    M.lines.forEach(function (l) {
      var o;
      if (l.name || l.id === 'name') {
        var g0 = guideMeta.name;
        o = { id: 'name', label: g0.label, script: nm || '(type the child\'s name above first)', hint: g0.hint, nameDep: true, nmUsed: nm, disabled: !nm };
      } else if (l.sec === 'guide' && guideMeta[l.id]) {
        var g = guideMeta[l.id];
        o = { id: l.id, label: g.label, script: bn && g.bn ? g.bn : g.say, cat: g.cat,
          alt: bn && g.bn ? 'Booyo says: "' + g.say + '"' : other ? 'Say it your way, in your language. Booyo says: "' + g.say + '"' : '', hint: g.hint || '' };
      } else {
        o = { id: l.id, label: l.label || '', script: l.text, alt: l.alt ? l.alt + (any ? ' · ' + any : '') : any, nameDep: l.nameDep, nmUsed: l.nmUsed, swatch: l.swatch, cat: l.cat, piece: l.piece, disabled: l.disabled };
      }
      (bySec[l.sec] = bySec[l.sec] || []).push(o);
    });
    (v.custom || []).forEach(function (c) { (bySec.guide = bySec.guide || []).push({ id: c.id, label: 'Custom line', script: c.text, alt: '🎁 ' + (FV_SLOTS[c.slot] || ''), custom: c }); });
    /* Sing My Story song lines (v3.2) */
    var gs = [{ id: 'sg_whole', label: 'The whole song', script: 'Sing the whole song your way, to any tune you like (up to 90 seconds).', alt: 'Plays instead of Booyo\'s chanting, starting when the words start. Tip: listen to a Booyo song first to feel the speed.', max: 90000 }];
    var SG0 = D.song, nm0 = (settings.childName || '').trim();
    var smLab = function (step, k) { var c = D.storyMaker[step].filter(function (x) { return x.id === k; })[0]; return c ? c.label : k; };
    Object.keys(SG0.who).forEach(function (k) { var dep = k === 'me' && !!nm0; gs.push({ id: 'sg_w_' + k, label: 'Who: ' + (k === 'me' ? (nm0 || 'our friend') : smLab('who', k)), script: SG0.who[k].map(function (l) { return sgFill(l, { author: nm0 }); }).join(' / '), alt: any || 'Two lines, sung or chanted', max: 15000, nameDep: dep, nmUsed: dep ? nm0 : '' }); });
    Object.keys(SG0.where).forEach(function (k) { gs.push({ id: 'sg_c_' + k, label: 'Chorus: ' + smLab('where', k), script: SG0.where[k].join(' / '), alt: any || 'The chorus (it is sung twice)', max: 15000 }); });
    Object.keys(SG0.what).forEach(function (k) { gs.push({ id: 'sg_a_' + k, label: 'What happens: ' + smLab('what', k), script: SG0.what[k].join(' / '), alt: any, max: 15000 }); });
    Object.keys(SG0.end).forEach(function (k) { gs.push({ id: 'sg_e_' + k, label: 'Ending: ' + smLab('end', k), script: SG0.end[k].join(' / '), alt: any, max: 15000 }); });
    gs.push({ id: 'sg_hooray', label: 'Last line', script: SG0.outro, alt: any, max: 15000 });
    bySec.song = gs.concat(bySec.song || []);
    var LESSON = { letters: 1, lettergames: 1, numbers: 1, colors: 1 };
    var groups = [];
    D.voiceSections.forEach(function (sec) {
      if (bySec[sec.id] && bySec[sec.id].length) groups.push({ id: sec.id, icon: sec.icon, title: sec.title, lines: bySec[sec.id], lesson: !!LESSON[sec.id], core: sec.id === 'guide' ? FV_GUIDE.length : 0 });
      if (sec.id === 'stories') D.stories.forEach(function (st) { var k = 'story_' + st.id; if (bySec[k]) groups.push({ id: k, icon: st.cover, title: 'Story: ' + fillName(st.title), lesson: true, lines: bySec[k] }); });
    });
    return groups;
  }
  function fvValid(rec, line) {
    if (line === 'name') { var c = (settings.childName || '').trim(); return !!c && rec.nm === normName(c); }
    if (rec.nm) return rec.nm === normName(storyName());
    return true;
  }
  function fvStats(v) {
    var m = FV.clips[v.id] || {}, st = { guide: 0, guideTotal: FV_GUIDE.length, lesson: 0, lessonTotal: 0, all: 0, allTotal: 0, n: 0, bytes: 0 };
    Object.keys(m).forEach(function (k) { st.n++; st.bytes += m[k].size || (m[k].blob && m[k].blob.size) || 0; });
    FV_GUIDE.forEach(function (g) { if (m[g.id]) st.guide++; });
    fvGroups(v).forEach(function (g) { g.lines.forEach(function (l) { if (l.disabled || l.custom) return; st.allTotal++; if (m[l.id]) st.all++; if (g.lesson || /^story_/.test(g.id)) { st.lessonTotal++; if (m[l.id]) st.lesson++; } }); });
    return st;
  }

  /* ---------- matching Booyo's text to recordings ---------- */
  function fvActiveVoices() {
    var withClips = fvVoices.filter(function (v) { return fvVoiceClips(v).length; });
    if (settings.fvActive && settings.fvActive !== 'mix') { var one = fvVoice(settings.fvActive); if (one) return withClips.indexOf(one) >= 0 ? [one] : []; }
    return withClips;
  }
  function fvPhrases() {
    var lessons = settings.fvLessons !== false, M = fvMaster(), key = [FV.mk, lessons].join('|');
    if (FV.pk === key && FV.ph) return FV.ph;
    var P = [];
    function add(p, ref, kind) { p = String(p).toLowerCase().replace(/[\s.!?,:]+$/, ''); if (p) P.push({ p: p, ref: ref, kind: kind || 'line' }); }
    var LESSON = /^(letters|lettergames|numbers|colors|story_)/;
    /* 1) every whole line in the master list (exact recordings win) */
    M.lines.forEach(function (l) {
      if (l.piece || l.disabled || !l.text) return;
      if (l.id === 'name') { add(l.text, 'name', 'name'); return; }
      if (!lessons && LESSON.test(l.sec)) return;
      add(l.text, l.cat ? '@' + l.cat : l.id);
    });
    SM_FV.forEach(function (l) { (l[3] || []).forEach(function (x) { add(x, l[0]); }); });
    /* 2) v3 phrase families, so the classic guide lines keep covering what they always covered */
    D.praise.concat(lnVariants('g_did')).forEach(function (p) { add(p, '@praise'); });
    D.tryAgain.concat(["Let's look again", 'Let us look again']).forEach(function (p) { add(p, '@try'); });
    add("Let's play together! Here we go", '@startS');
    ['Let us learn and play', "Let's play together", 'Here we go', "Let's keep playing"].forEach(function (p) { add(p, '@start'); });
    ['Time for a break. Let us stretch, drink some water, and play with toys', "Now it's break time. Let's stretch up high, drink some water, and play with toys", 'Time for a break']
      .forEach(function (p) { add(p, '@break'); });
    ['All done', "That's all the playing for today"].forEach(function (p) { add(p, '@alldone'); });
    add('Bye bye, ' + name() + '! See you next time', '@byeS');
    ['Bye bye', 'See you next time'].forEach(function (p) { add(p, '@bye'); });
    add('Hi ' + name(), '@greet');
    P.sort(function (a, b) { return b.p.length - a.p.length; });
    FV.pk = key; FV.ph = P;
    return P;
  }
  function fvFind(line, ctx) {
    var order = ctx.pref ? [ctx.pref].concat(ctx.voices.filter(function (v) { return v !== ctx.pref; })) : ctx.voices;
    for (var i = 0; i < order.length; i++) {
      var r = fvClip(order[i], line);
      if (r && fvValid(r, line)) { ctx.pref = order[i]; return { rec: r, voice: order[i] }; }
    }
    return null;
  }
  function fvCatIds(cat) { return fvMaster().lines.filter(function (l) { return l.cat === cat; }).map(function (l) { return l.id; }); }
  function fvCatClips(v, cat) {
    var out = fvCatIds(cat).map(function (l) { return fvClip(v, l); }).filter(Boolean);
    if (cat === 'praise') (v.custom || []).forEach(function (c) { if (c.slot === 'praise') { var r = fvClip(v, c.id); if (r) out.push(r); } });
    return out;
  }
  function fvPickCat(cat, ctx) {
    var vs = ctx.voices.filter(function (v) { return fvCatClips(v, cat).length; });
    if (!vs.length) return null;
    var v = vs.length > 1 ? vs[FV.rot++ % vs.length] : vs[0];   // "mix": praise takes turns between family voices
    var list = fvCatClips(v, cat), last = FV.last[cat];
    var cand = list.length > 1 ? list.filter(function (r) { return r !== last; }) : list;
    var r = pick(cand); FV.last[cat] = r; ctx.pref = v;
    return { rec: r, voice: v };
  }
  function fvCustom(slot, ctx) {
    var order = ctx.pref ? [ctx.pref].concat(ctx.voices.filter(function (v) { return v !== ctx.pref; })) : ctx.voices;
    for (var i = 0; i < order.length; i++) {
      var v = order[i], c = (v.custom || []).filter(function (x) { return x.slot === slot && fvClip(v, x.id); });
      if (c.length) return { rec: fvClip(v, pick(c).id), voice: v };
    }
    return null;
  }
  function fvResolve(ref, ctx) {
    if (ref.charAt(0) === '@') {
      var cat = ref.slice(1), out = [];
      if (cat === 'praise' || cat === 'try') { var pc = fvPickCat(cat, ctx); return pc ? [pc] : null; }
      if (cat === 'greet') { var g = fvFind('greet', ctx); if (!g) return null; out.push(g); var nmc = fvFind('name', ctx); if (nmc) out.push(nmc); return out; }
      var base = cat === 'startS' ? 'start' : cat === 'byeS' ? 'bye' : cat;
      var m = fvFind(base, ctx); if (m) out.push(m);
      if (cat === 'startS' || cat === 'byeS') { var cu = fvCustom(cat === 'startS' ? 'start' : 'end', ctx); if (cu) out.push(cu); }
      return out.length ? out : null;
    }
    var f = fvFind(ref, ctx);
    return f ? [f] : null;
  }
  /* Split text into [{clip}|{text}] parts. Returns null when nothing is recorded (then the built-in voice speaks it as before). */
  function fvPlan(text) {
    if (!settings.fvOn || !FV.ready || !text) return null;
    var voices = fvActiveVoices(); if (!voices.length) return null;
    var P = fvPhrases(), s = String(text), low = s.toLowerCase(), n = s.length;
    var parts = [], buf = '', i = 0, any = false, ctx = { pref: null, voices: voices };
    function flush() { var t = buf.replace(/^[\s.!?,]+/, '').trim(); if (/[\p{L}\p{N}]/u.test(t)) parts.push({ text: t }); buf = ''; }
    function sentStart(k) { var j = k - 1; while (j >= 0 && /\s/.test(s[j])) j--; return j < 0 || /[.!?]/.test(s[j]); }
    while (i < n) {
      var hit = null;
      if (i === 0 || !/[\p{L}\p{N}']/u.test(s[i - 1])) {
        /* longest registered sentence wins ("2 fish!" must not be cut short by a recent "2!") */
        if (FV.dyn && sentStart(i)) for (var di = 0, bestLen = 0; di < FV.dyn.length; di++) {
          var de = FV.dyn[di];
          if (de.p.length <= bestLen || low.substr(i, de.p.length) !== de.p) continue;
          var dend = i + de.p.length, dp = /^[.!?,:]*/.exec(s.slice(dend))[0].length;
          if (dend + dp < n && !/\s/.test(s[dend + dp])) continue;
          var sp = [], anyClip = false;
          de.seq.forEach(function (pc) {
            var f = pc.id ? fvFind(pc.id, ctx) : null;
            if (f) { sp.push({ clip: f.rec, voice: f.voice, text: pc.text }); anyClip = true; } else if (/[\p{L}\p{N}]/u.test(pc.text)) sp.push({ text: pc.text });
          });
          if (anyClip) { hit = { parts: sp, end: dend + dp }; bestLen = de.p.length; }
        }
        for (var k = 0; k < P.length && !hit; k++) {
          var e = P[k];
          if (low.substr(i, e.p.length) !== e.p) continue;
          var end = i + e.p.length, punct = /^[.!?,:]*/.exec(s.slice(end))[0].length;
          if (e.kind === 'name') { if (end < n && /[\p{L}\p{N}]/u.test(s[end])) continue; punct = 0; }
          else if (!sentStart(i) || (end + punct < n && !/\s/.test(s[end + punct]))) continue;
          var clips = fvResolve(e.ref, ctx);
          if (clips) hit = { clips: clips, end: end + punct, text: s.slice(i, end + punct) };
        }
      }
      if (hit && hit.parts) { flush(); hit.parts.forEach(function (x) { parts.push(x); }); any = true; i = hit.end; }
      else if (hit) {
        flush();
        hit.clips.forEach(function (c, ci) { parts.push({ clip: c.rec, voice: c.voice, text: ci === 0 ? hit.text : '' }); });
        any = true; i = hit.end;
      } else { buf += s[i]; i++; }
    }
    flush();
    return any ? parts : null;
  }

  /* TEST only: an in-memory family voice with tiny silent clips for the given lines ('*' = every line; null = remove) */
  function fvTestWav() {   /* TEST only: a valid 0.05 s silent WAV so fake clips really play */
    var n = 800, b = new ArrayBuffer(44 + n * 2), d = new DataView(b);
    var w = function (o, str) { for (var i = 0; i < str.length; i++) d.setUint8(o + i, str.charCodeAt(i)); };
    w(0, 'RIFF'); d.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true);
    d.setUint32(24, 16000, true); d.setUint32(28, 32000, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true); w(36, 'data'); d.setUint32(40, n * 2, true);
    return new Blob([b], { type: 'audio/wav' });
  }
  function fvTestFake(ids) {
    if (ids === null) { delete FV.clips.vtest; fvVoices = fvVoices.filter(function (v) { return v.id !== 'vtest'; }); FV.pk = null; return; }
    if (!fvVoice('vtest')) fvVoices.push({ id: 'vtest', label: 'Test Grandma', lang: 'en', icon: '👵', custom: [], created: Date.now() });
    var M = fvMaster(), list = ids === '*' ? M.lines.filter(function (l) { return !l.disabled; }).map(function (l) { return l.id; }) : [].concat(ids);
    var blob = fvTestWav(), cn = normName((settings.childName || '').trim()), sn = normName(storyName());
    FV.clips.vtest = FV.clips.vtest || {};
    list.forEach(function (id) { var l = M.byId[id] || {}; FV.clips.vtest[id] = { k: 'vtest|' + id, voice: 'vtest', line: id, blob: blob, mime: 'audio/wav', dur: 300, size: 64, nm: id === 'name' ? cn : l.nameDep ? sn : '' }; });
    settings.fvOn = true; FV.ready = true;
  }
  /* ---------- playback ---------- */
  function fvAudio() {
    if (!FV.audio) { FV.audio = new Audio(); FV.audio.preload = 'auto'; FV.audio.setAttribute('playsinline', ''); }
    return FV.audio;
  }
  function fvUrl(rec) { if (!rec.url) rec.url = URL.createObjectURL(rec.blob); return rec.url; }
  function fvSilentUrl() {
    if (FV.silent) return FV.silent;
    var n = 800, b = new ArrayBuffer(44 + n * 2), d = new DataView(b);
    var w = function (o, str) { for (var i = 0; i < str.length; i++) d.setUint8(o + i, str.charCodeAt(i)); };
    w(0, 'RIFF'); d.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true);
    d.setUint32(24, 8000, true); d.setUint32(28, 16000, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true); w(36, 'data'); d.setUint32(40, n * 2, true);
    FV.silent = URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
    return FV.silent;
  }
  /* call from a tap: lets iOS play later clips without another tap */
  function fvUnlock() {
    if (FV.unlocked || !settings.fvOn || !fvActiveVoices().length) return;
    FV.unlocked = true;
    try { var a = fvAudio(); a.src = fvSilentUrl(); var p = a.play(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ignore */ }
  }
  function fvBadge(v) {
    Array.prototype.forEach.call(document.querySelectorAll('.fv-badge'), function (b) { b.remove(); });
    var o = app.querySelector('.ollie');
    if (o) o.classList.toggle('fv-talking', !!v);
    if (!v) return;
    var b = h('div', { class: 'fv-badge' + (o ? '' : ' float'), 'aria-hidden': 'true' }, h('span', { class: 'fv-b-ic' }, v.icon || '💖'), h('span', { class: 'fv-b-l' }, v.label));
    if (o) o.appendChild(b); else document.body.appendChild(b);
  }
  function fvPlayClip(rec, voice, cb, preview) {
    var a = fvAudio(), my = ++FV.tok, done = false, t = 0;
    function fin(ok) {
      if (done) return; done = true; clearTimeout(t);
      if (FV.tok === my) { a.onended = a.onerror = null; fvBadge(null); }
      if (!ok) fvLog({ kind: 'fallback', line: rec.line, voice: voice.label });
      cb(ok);
    }
    try {
      a.onended = function () { fin(true); };
      a.onerror = function () { fin(false); };
      a.src = fvUrl(rec);
      fvBadge(voice);
      fvLog({ kind: preview ? 'preview' : 'clip', line: rec.line, voice: voice.label });
      var p = a.play();
      if (p && p.catch) p.catch(function (e) { if (FV.tok === my && !(e && e.name === 'AbortError')) fin(false); });
      t = setTimeout(function () { fin(true); }, (rec.dur || FV_MAX_MS) + 2500);
    } catch (e) { fin(false); }
  }
  function fvSpeak(parts, opts) {
    var pid = ++FV.pid, k = 0;
    function next() {
      if (pid !== FV.pid) return;
      if (k >= parts.length) { if (opts.onend) opts.onend(); return; }
      var p = parts[k++];
      if (p.clip) fvPlayClip(p.clip, p.voice, function (ok) { if (pid !== FV.pid) return; if (ok || !p.text) next(); else Speech.tts(p.text, { onend: next }); });
      else Speech.tts(p.text, { onend: next });
    }
    next();
  }
  function fvStop() {
    if (!FV.audio && !document.querySelector('.fv-badge')) { FV.pid++; return; }
    FV.pid++; FV.tok++;
    if (FV.audio) { try { FV.audio.pause(); } catch (e) { /* ignore */ } }
    fvBadge(null);
  }
  function fvPreview(rec, v) { fvStop(); Speech.stop(); Sound.resume(); fvPlayClip(rec, v, function () {}, true); }

  /* ---------- recording ---------- */
  var Rec = {
    stream: null, mr: null, timer: 0, cap: 0, raf: 0, src: null, releaseT: 0,
    support: function () {
      if (location.protocol !== 'file:' && window.isSecureContext === false) return 'insecure';
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return window.isSecureContext === false ? 'insecure' : 'nomic';
      if (typeof window.MediaRecorder === 'undefined') return 'norec';
      return '';
    },
    mime: function () {
      if (typeof window.MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
      var apple = /Apple/.test(navigator.vendor || '');
      var webm = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'], mp4 = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/aac'];
      var c = apple ? mp4.concat(webm) : webm.concat(mp4);   // Safari: AAC in MP4; Chrome/Firefox/Android: Opus in WebM
      for (var i = 0; i < c.length; i++) { try { if (MediaRecorder.isTypeSupported(c[i])) return c[i]; } catch (e) { /* ignore */ } }
      return '';
    },
    getStream: function () {
      var self = this;
      clearTimeout(self.releaseT);
      if (self.stream && self.stream.getAudioTracks().some(function (t) { return t.readyState === 'live'; })) return Promise.resolve(self.stream);
      return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
        .then(function (s) { self.stream = s; return s; });
    },
    record: function (o) {
      var self = this;
      return self.getStream().then(function (stream) {
        return new Promise(function (res, rej) {
          var mime = self.mime(), mr, chunks = [], t0 = 0, maxMs = o.maxMs || FV_MAX_MS;
          try { mr = mime ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32000 }) : new MediaRecorder(stream); }
          catch (e) { try { mr = new MediaRecorder(stream); } catch (e2) { return rej(e2); } }
          function cleanup() {
            clearInterval(self.timer); clearTimeout(self.cap); cancelAnimationFrame(self.raf); self.mr = null;
            if (self.src) { try { self.src.disconnect(); } catch (e) { /* ignore */ } self.src = null; }
            self.releaseLater();
          }
          mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
          mr.onerror = function (e) { cleanup(); rej((e && e.error) || new Error('recorder error')); };
          mr.onstop = function () {
            var dur = Date.now() - t0; cleanup();
            var type = (mr.mimeType || mime || (chunks[0] && chunks[0].type) || 'audio/webm');
            res({ blob: new Blob(chunks, { type: type }), mime: type, dur: Math.min(dur, maxMs + 300) });
          };
          self.mr = mr;
          try { mr.start(250); } catch (e) { cleanup(); return rej(e); }
          t0 = Date.now();
          if (o.onStart) o.onStart();
          self.timer = setInterval(function () { if (o.onTick) o.onTick(Math.max(0, maxMs - (Date.now() - t0))); }, 100);
          self.cap = setTimeout(function () { self.stop(); }, maxMs);
          var ctx = Sound.get();
          if (ctx && o.onLevel) {
            try {
              if (ctx.state === 'suspended') ctx.resume();
              var src = ctx.createMediaStreamSource(stream), an = ctx.createAnalyser(); an.fftSize = 512; src.connect(an); self.src = src;
              var buf = new Uint8Array(an.fftSize);
              (function loop() {
                an.getByteTimeDomainData(buf); var m = 0;
                for (var i = 0; i < buf.length; i++) { var x = Math.abs(buf[i] - 128); if (x > m) m = x; }
                o.onLevel(m / 128); self.raf = requestAnimationFrame(loop);
              })();
            } catch (e) { /* level meter is optional */ }
          }
        });
      });
    },
    stop: function () { if (this.mr && this.mr.state !== 'inactive') { try { this.mr.stop(); } catch (e) { /* ignore */ } } },
    releaseLater: function () { var self = this; clearTimeout(self.releaseT); self.releaseT = setTimeout(function () { self.release(); }, 60000); },
    release: function () {
      clearTimeout(this.releaseT); this.stop();
      if (this.stream) { this.stream.getTracks().forEach(function (t) { t.stop(); }); this.stream = null; }
    }
  };
  function fvSupportText(code) {
    return {
      insecure: 'Recording needs a secure address: https:// or the installed Home Screen app. Browsers block the microphone on plain http:// home-network addresses.',
      nomic: 'This browser does not give web apps microphone access. Try a recent Chrome, Edge, Firefox or Safari (iPhone/iPad iOS 14.5 or newer).',
      norec: 'This browser can\'t record audio (no MediaRecorder). Update it (Safari 14.5+, Chrome, Firefox) or record on another device and import the voice pack file here.'
    }[code] || '';
  }
  function fvMicErr(e) {
    var n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError')
      return 'Microphone access was blocked, so nothing was recorded. To record, allow the microphone for this app: iPhone/iPad: Settings → Apps → Safari → Microphone (or aA → Website Settings); Android Chrome: tap the icon left of the address → Permissions → Microphone; desktop: the mic icon in the address bar. Booyo keeps using its built-in voice meanwhile.';
    if (n === 'NotFoundError' || n === 'OverconstrainedError' || n === 'DevicesNotFoundError') return 'No microphone was found on this device.';
    if (n === 'NotReadableError' || n === 'AbortError' || n === 'TrackStartError') return 'The microphone is busy (another app may be using it). Close other apps and try again.';
    return 'Recording did not work in this browser (' + (n || (e && e.message) || 'error') + ').';
  }
  function fvSave(v, ln, res) {
    var rec = { k: v.id + '|' + ln.id, voice: v.id, line: ln.id, blob: res.blob, mime: res.mime, dur: res.dur, size: res.blob.size,
      nm: ln.nameDep ? normName(ln.nmUsed) : '', t: Date.now() };
    return VDB.put(rec).catch(function () {
      /* very old Safari can't store Blobs in IndexedDB: store the raw bytes instead */
      return new Promise(function (ok, bad) { var fr = new FileReader(); fr.onload = function () { ok(fr.result); }; fr.onerror = function () { bad(fr.error); }; fr.readAsArrayBuffer(res.blob); })
        .then(function (buf) { var r2 = {}; Object.keys(rec).forEach(function (k) { if (k !== 'blob') r2[k] = rec[k]; }); r2.buf = buf; return VDB.put(r2); });
    }).then(function () {
      var old = fvClip(v, ln.id); if (old && old.url) URL.revokeObjectURL(old.url);
      (FV.clips[v.id] = FV.clips[v.id] || {})[ln.id] = rec;
      fvPersist(); fvStorageInfo();
      return rec;
    });
  }
  function fvDeleteClip(v, line) {
    return VDB.del(v.id + '|' + line).then(function () {
      var old = fvClip(v, line); if (old && old.url) URL.revokeObjectURL(old.url);
      if (FV.clips[v.id]) delete FV.clips[v.id][line];
    });
  }
  function fvDeleteVoice(v) {
    var keys = fvVoiceClips(v).map(function (r) { if (r.url) URL.revokeObjectURL(r.url); return r.k; });
    return (keys.length ? VDB.del(keys) : Promise.resolve()).then(function () {
      delete FV.clips[v.id];
      fvVoices = fvVoices.filter(function (x) { return x.id !== v.id; }); saveVoices();
      if (settings.fvActive === v.id) { settings.fvActive = 'mix'; saveSettings(); }
      fvStorageInfo();
    });
  }

  /* ---------- voice pack file (.booyovoice): JSON with base64 audio ---------- */
  function fvB64(blob) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { var s = String(fr.result); res(s.slice(s.indexOf(',') + 1)); };
      fr.onerror = function () { rej(fr.error); };
      fr.readAsDataURL(blob);
    });
  }
  function fvExport(v) {
    var recs = fvVoiceClips(v);
    return Promise.all(recs.map(function (r) {
      return fvB64(r.blob).then(function (b64) { return { line: r.line, mime: r.mime, dur: r.dur, nm: r.nm || '', t: r.t, data: b64 }; });
    })).then(function (clips) {
      var pack = { format: 'booyo-voice', version: 1, app: 'Booyo', exported: new Date().toISOString(),
        voice: { label: v.label, lang: v.lang, icon: v.icon, forName: fvScriptName(v), custom: v.custom || [] }, clips: clips };
      var safe = String(v.label).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'family';
      return { name: 'Booyo-voice-' + safe + '-' + todayKey() + '.booyovoice', blob: new Blob([JSON.stringify(pack)], { type: 'application/json' }), count: clips.length };
    });
  }
  function fvDownload(f) {
    var url = URL.createObjectURL(f.blob), a = h('a', { href: url, download: f.name, style: { display: 'none' } });
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 5000);
  }
  function fvDeliver(f) {
    var file = null;
    try { file = new File([f.blob], f.name, { type: 'application/json' }); } catch (e) { file = null; }
    var canShare = false;
    try { canShare = !!(file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) { canShare = false; }
    if (!canShare) { fvDownload(f); toast('Saved ' + f.name); return; }
    fvDialog('📤 Send this voice pack', [h('p', {}, f.name + ' · ' + fmtBytes(f.blob.size) + ' · ' + f.count + ' recordings'),
      h('p', { class: 'hint' }, 'Send it to the parent by WhatsApp, Messages, email, AirDrop or a USB stick. They open Booyo → Parent corner → Family Voices → Import.')],
      [{ t: '📤 Share…', fn: function (close) { navigator.share({ files: [file], title: 'Booyo voice pack' }).catch(function () {}); close(); } },
       { t: '💾 Download', ghost: true, fn: function (close) { fvDownload(f); close(); } }]);
  }
  function fvReadText(file) {
    return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(String(fr.result)); }; fr.onerror = function () { rej(fr.error); }; fr.readAsText(file); });
  }
  function fvB64Blob(b64, mime) {
    var bin = atob(b64), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Blob([u], { type: mime });
  }
  function fvImport(file) {
    if (!file) return Promise.reject(new Error('No file chosen.'));
    if (file.size > 200 * 1048576) return Promise.reject(new Error('That file is too big for a voice pack (over 200 MB).'));
    return fvReadText(file).then(function (txt) {
      var p;
      try { p = JSON.parse(txt); } catch (e) { throw new Error('That file is not a Booyo voice pack.'); }
      if (!p || (p.format !== 'booyo-voice' && p.format !== 'toddyvoice') || !p.voice || !Array.isArray(p.clips)) throw new Error('That file is not a Booyo voice pack.');
      var clips = p.clips.filter(function (c) {
        return c && typeof c.line === 'string' && FV_LINE_RE.test(c.line) && typeof c.data === 'string' && /^audio\/[\w.+-]+(;[\w=.,\s-]*)?$/i.test(String(c.mime || ''));
      }).slice(0, 3000);
      if (!clips.length) throw new Error('This voice pack has no recordings in it.');
      var label = fvSan(p.voice.label) || 'Family voice';
      var custom = (Array.isArray(p.voice.custom) ? p.voice.custom : []).filter(function (c) { return c && /^custom_[a-z0-9]{1,16}$/.test(c.id) && FV_SLOTS[c.slot]; })
        .map(function (c) { return { id: c.id, text: fvSan(c.text, 120), slot: c.slot }; }).slice(0, 30);
      var existing = fvVoices.filter(function (v) { return v.label.toLowerCase() === label.toLowerCase(); })[0];
      var replace = existing && window.confirm('A voice called "' + label + '" is already here.\n\nOK = replace its recordings with the ones in this file.\nCancel = keep both (the new one gets a number).');
      var start = replace ? fvDeleteVoice(existing) : Promise.resolve();
      return start.then(function () {
        var lab = label, k = 2;
        while (fvVoices.some(function (v) { return v.label.toLowerCase() === lab.toLowerCase(); })) lab = label + ' (' + (k++) + ')';
        var v = { id: fvNewId('v'), label: lab, lang: FV_LANGS[p.voice.lang] ? p.voice.lang : 'other', icon: FV_ICONS.indexOf(p.voice.icon) >= 0 ? p.voice.icon : '💖',
          forName: fvSan(p.voice.forName, 20), custom: custom, created: Date.now(), imported: new Date().toISOString() };
        fvVoices.push(v); saveVoices();
        var bad = 0, chain = Promise.resolve();
        clips.forEach(function (c) {
          chain = chain.then(function () {
            var blob;
            try { blob = fvB64Blob(c.data, c.mime); } catch (e) { bad++; return; }
            var nm = normName(fvSan(c.nm, 40));
            return fvSave(v, { id: c.line, nameDep: !!nm, nmUsed: nm }, { blob: blob, mime: c.mime, dur: Math.min(Number(c.dur) || 3000, fvLineMax(c.line) + 300) });
          });
        });
        return chain.then(function () {
          var probe = fvAudio(), cant = clips.filter(function (c) { try { return probe.canPlayType(c.mime) === ''; } catch (e) { return false; } }).length;
          return { voice: v, n: clips.length - bad, cant: cant };
        });
      });
    });
  }

  /* ---------- parent corner UI ---------- */
  function fvDialog(title, body, btns) {
    var ov = h('div', { class: 'gate-overlay fv-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
    var close = function () { ov.remove(); };
    ov.appendChild(h('div', { class: 'gate fv-gate' }, h('h2', {}, title), body,
      h('div', { class: 'btn-row center' }, (btns || []).map(function (b) { return h('button', { class: 'pbtn' + (b.ghost ? ' ghost' : ''), onclick: function () { b.fn(close); } }, b.t); }),
        h('button', { class: 'pbtn ghost', onclick: close }, 'Close'))));
    document.body.appendChild(ov);
    return ov;
  }
  function fvRefresh() {
    var scr = app.getAttribute('data-screen');
    if (scr === 'parent') { var old = document.getElementById('fvCard'); if (old) old.replaceWith(fvCard()); }
    else if (scr === 'fvoice' && FV.screenVoice) fvFillBody(fvVoice(FV.screenVoice), true);
  }
  function fvLeave(screen) {
    if (screen === 'fvoice') return;
    FV.screenVoice = null;
    Array.prototype.forEach.call(document.querySelectorAll('.fv-overlay, .fv-dialog'), function (n) { n.remove(); });
    if (Rec.stream || Rec.mr) Rec.release();
  }
  function fvMeter(label, done, total, id) {
    var pct = total ? Math.round(done / total * 100) : 0;
    return h('div', { class: 'fv-meter', id: id || null }, h('div', { class: 'fv-mlabel' }, h('span', {}, label), h('b', {}, done + ' / ' + total)),
      h('div', { class: 'meter' }, h('span', { style: { width: pct + '%' } })));
  }
  function fvCard() {
    var S = settings, c = card('🎙️ Family Voices', 'wide fv-card');
    c.id = 'fvCard';
    var tog = h('input', { type: 'checkbox', id: 'fvToggle' }); tog.checked = !!S.fvOn;
    tog.addEventListener('change', function () { S.fvOn = tog.checked; saveSettings(); FV.unlocked = false; toast(S.fvOn ? 'Family Voices on ✓' : 'Family Voices off'); fvRefresh(); });
    c.appendChild(h('label', { class: 'toggle' }, tog, h('span', { class: 'toggle-ui' }), h('span', {}, 'Use family voices in kid mode')));
    c.appendChild(h('p', { class: 'hint' }, S.fvOn
      ? 'On: when Booyo says something a family member recorded, your child hears that recording, with a little badge showing who it is. Anything not recorded uses the built-in voice.'
      : 'Off (default): Booyo uses the built-in voice only. You can record now and switch this on later. Recordings are kept.'));
    if (S.fvOn) {
      var act = h('select', { id: 'fvActive', 'aria-label': 'Which family voice' });
      [['mix', '🔀 Mix: praise takes turns between family voices']].concat(fvVoices.map(function (v) { return [v.id, v.icon + ' ' + v.label + ' only']; })).forEach(function (o) {
        var op = h('option', { value: o[0] }, o[1]); if ((S.fvActive || 'mix') === o[0]) op.selected = true; act.appendChild(op);
      });
      act.addEventListener('change', function () { S.fvActive = act.value; saveSettings(); toast('Saved ✓'); });
      var les = h('input', { type: 'checkbox', id: 'fvLessons' }); les.checked = S.fvLessons !== false;
      les.addEventListener('change', function () { S.fvLessons = les.checked; saveSettings(); toast('Saved ✓'); });
      c.appendChild(h('div', { class: 'fv-opts' },
        h('label', { class: 'field' }, h('span', {}, 'Which voice'), act),
        h('label', { class: 'toggle' }, les, h('span', { class: 'toggle-ui' }), h('span', {}, 'Also use recordings in lessons (letters, numbers, colors, shapes, stories)'))));
      if (!fvActiveVoices().length && FV.ready) c.appendChild(h('p', { class: 'warn' }, 'Nothing recorded yet, so Booyo uses the built-in voice.'));
    }
    if (FV.err) c.appendChild(h('p', { class: 'warn' }, FV.err));
    var list = h('div', { class: 'fv-list' });
    if (!FV.ready) list.appendChild(h('p', { class: 'hint' }, 'Loading recordings…'));
    else if (!fvVoices.length) list.appendChild(h('p', { class: 'hint' }, 'No family voices yet. Add one below: Grandma, Dad, Nanu, a big sister…'));
    fvVoices.forEach(function (v) {
      var st = fvStats(v);
      list.appendChild(h('div', { class: 'fv-voice', 'data-voice': v.id },
        h('div', { class: 'fv-vhead' }, h('span', { class: 'fv-vic' }, v.icon || '💖'),
          h('div', { class: 'fv-vname' }, h('b', {}, v.label), h('small', {}, FV_LANGS[v.lang] + ' · ' + st.n + ' recording' + (st.n === 1 ? '' : 's') + ' · ' + fmtBytes(st.bytes) + ' on this device'))),
        fvMeter('Most-heard lines', st.guide, st.guideTotal),
        fvMeter('Every line (optional)', st.all, st.allTotal),
        h('div', { class: 'btn-row' },
          h('button', { class: 'pbtn fv-open', onclick: function () { fvScreen(v.id); } }, '🎙️ Record'),
          h('button', { class: 'pbtn ghost fv-export', disabled: !st.n, onclick: function (e) {
            var b = e.currentTarget; b.disabled = true;
            fvExport(v).then(function (f) { b.disabled = false; fvDeliver(f); }).catch(function (er) { b.disabled = false; toast('Export failed: ' + (er && er.message)); });
          } }, '📤 Export'),
          h('button', { class: 'pbtn ghost danger fv-del', onclick: function () {
            if (!window.confirm('Delete ' + v.label + '\'s voice and all ' + st.n + ' recordings from this device?')) return;
            fvDeleteVoice(v).then(function () { toast('Deleted'); fvRefresh(); });
          } }, '🗑️ Delete'))));
    });
    c.appendChild(list);
    // add a voice
    var chosen = { icon: '👵' };
    var lab = h('input', { type: 'text', id: 'fvNewLabel', maxlength: '24', autocomplete: 'off', placeholder: 'Who is recording? e.g. Grandma, Dad, Nanu' });
    var lang = h('select', { id: 'fvNewLang', 'aria-label': 'Language' });
    Object.keys(FV_LANGS).forEach(function (k) { lang.appendChild(h('option', { value: k }, FV_LANGS[k])); });
    var icons = h('div', { class: 'fv-icons', role: 'radiogroup', 'aria-label': 'Picture' });
    FV_ICONS.forEach(function (ic) {
      var b = h('button', { class: 'fv-ic' + (ic === chosen.icon ? ' on' : ''), role: 'radio', 'aria-label': ic, 'aria-checked': String(ic === chosen.icon), onclick: function () {
        chosen.icon = ic; Array.prototype.forEach.call(icons.children, function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); });
      } }, ic);
      icons.appendChild(b);
    });
    var addBtn = h('button', { class: 'pbtn', id: 'fvAdd', onclick: function () {
      var l = fvSan(lab.value);
      if (!l) { lab.focus(); toast('Type a name first'); return; }
      var v = { id: fvNewId('v'), label: l, lang: lang.value, icon: chosen.icon, custom: [], created: Date.now() };
      fvVoices.push(v); saveVoices(); fvScreen(v.id);
    } }, '＋ Add family voice');
    var fileIn = h('input', { type: 'file', id: 'fvImportFile', class: 'fv-file', 'aria-label': 'Voice pack file' });
    fileIn.addEventListener('change', function () {
      var f = fileIn.files && fileIn.files[0]; fileIn.value = '';
      if (!f) return;
      toast('Importing…');
      fvImport(f).then(function (r) {
        toast('Imported ' + r.n + ' recordings for ' + r.voice.label + ' ✓'); fvRefresh();
        if (r.cant) fvDialog('⚠️ Some recordings may not play here', [h('p', {}, r.cant + ' recordings use an audio format this browser may not play. Booyo uses the built-in voice for those. Recording again on this device fixes it.')], []);
      }).catch(function (e) { fvDialog('Could not import', [h('p', {}, (e && e.message) || 'Unknown error')], []); });
    });
    c.appendChild(h('h3', {}, 'Add a family voice'));
    c.appendChild(h('div', { class: 'fv-add' },
      h('label', { class: 'field' }, h('span', {}, 'Name'), lab),
      h('label', { class: 'field' }, h('span', {}, 'Language'), lang),
      h('div', { class: 'field' }, h('span', {}, 'Picture (shown on the badge)'), icons),
      h('div', { class: 'btn-row' }, addBtn, h('button', { class: 'pbtn ghost', id: 'fvImport', onclick: function () { fileIn.click(); } }, '📥 Import a voice pack'), fileIn)));
    var total = 0; fvVoices.forEach(function (v) { total += fvStats(v).bytes; });
    c.appendChild(h('ul', { class: 'plain fv-notes' },
      h('li', {}, 'Recording far away? Grandma opens Booyo on her own phone, adds herself here, records, then taps 📤 Export and sends you the file. You tap 📥 Import.'),
      h('li', {}, '🔐 Recordings stay in this browser on this device and are never uploaded. A file is only made when you tap Export, and you choose where it goes.'),
      h('li', { id: 'fvStorage' }, '💾 Family Voices use ' + fmtBytes(total) + ' here (about 40–80 KB per line).' +
        (FV.persisted ? ' Storage is protected from automatic cleanup ✓.' : ' Keep an exported copy as a backup: browsers can clear site data when the device is low on space.') +
        ' On iPhone/iPad, use the Home Screen app: Safari may delete website data after 7 days without a visit.')));
    return c;
  }

  function fvScreen(id) {
    var v = fvVoice(id); if (!v) return renderParent('voices');
    FV.screenVoice = id; FV.q = ''; FV.miss = false;
    var body = h('div', { id: 'fvBody' });
    show(h('main', { class: 'screen parent fv-screen' },
      h('header', { class: 'phead' },
        h('div', {}, h('h1', {}, '🎙️ Family Voices'), h('p', {}, 'Parent corner · recordings stay on this device')),
        h('button', { class: 'pbtn ghost', id: 'fvBack', onclick: function () { Rec.release(); renderParent('voices'); } }, '⬅ Family Voices')),
      body), 'fvoice');
    FV.screenVoice = id;
    fvFillBody(v, false);
  }
  function fvFillBody(v, keep) {
    var body = document.getElementById('fvBody'); if (!body || !v) return;
    var y = window.scrollY, open = {};
    Array.prototype.forEach.call(body.querySelectorAll('details[data-g]'), function (d) { open[d.getAttribute('data-g')] = d.open; });
    var groups = fvGroups(v), st = fvStats(v), sup = Rec.support();
    // who
    var lab = h('input', { type: 'text', id: 'fvLabel', maxlength: '24', value: v.label, autocomplete: 'off' });
    lab.addEventListener('change', function () { var l = fvSan(lab.value); if (l) { v.label = l; saveVoices(); toast('Saved ✓'); fvFillBody(v, true); } });
    var lang = h('select', { id: 'fvLang' });
    Object.keys(FV_LANGS).forEach(function (k) { var o = h('option', { value: k }, FV_LANGS[k]); if (v.lang === k) o.selected = true; lang.appendChild(o); });
    lang.addEventListener('change', function () { v.lang = lang.value; saveVoices(); fvFillBody(v, true); });
    var icons = h('div', { class: 'fv-icons' });
    FV_ICONS.forEach(function (ic) { icons.appendChild(h('button', { class: 'fv-ic' + (v.icon === ic ? ' on' : ''), 'aria-label': ic, onclick: function () { v.icon = ic; saveVoices(); fvFillBody(v, true); } }, ic)); });
    var who = h('section', { class: 'pcard fv-who' },
      h('div', { class: 'fv-whohead' }, h('span', { class: 'fv-vic big' }, v.icon), h('div', {}, h('h2', {}, v.label + '\'s voice'), h('p', { class: 'hint' }, FV_LANGS[v.lang] + ' · ' + st.n + ' recording' + (st.n === 1 ? '' : 's') + ' · ' + fmtBytes(st.bytes)))),
      h('div', { class: 'fv-whogrid' },
        h('label', { class: 'field' }, h('span', {}, 'Name on the badge'), lab),
        h('label', { class: 'field' }, h('span', {}, 'Language'), lang),
        h('div', { class: 'field' }, h('span', {}, 'Picture'), icons)));
    if (!(settings.childName || '').trim()) {
      var fn = h('input', { type: 'text', id: 'fvForName', maxlength: '20', value: v.forName || '', autocomplete: 'off', placeholder: 'e.g. Maya' });
      fn.addEventListener('change', function () { v.forName = fvSan(fn.value, 20); saveVoices(); fvFillBody(v, true); });
      who.appendChild(h('label', { class: 'field' }, h('span', {}, 'Child\'s name (for the name line and stories; set it in Child profile on the child\'s device)'), fn));
    }
    who.appendChild(fvMeter('Start here: most-heard lines', st.guide, st.guideTotal, 'fvProgress'));
    who.appendChild(fvMeter('Every line Booyo can say', st.all, st.allTotal, 'fvAllProgress'));
    if (sup) who.appendChild(h('p', { class: 'warn', id: 'fvSupport' }, '🎤 ' + fvSupportText(sup)));
    else who.appendChild(h('p', { class: 'hint' }, '🎤 The microphone is only on while you record. Most lines are a few seconds. Hold the phone about a hand away, in a quiet room, and say it the way you would to the child. Anything you skip is said by Booyo\'s own voice.'));
    /* v3.3 toolbar: record-next walk-through, search, not-recorded filter */
    var todo = fvTodo(v, groups);
    var srch = h('input', { type: 'search', id: 'fvSearch', value: FV.q || '', autocomplete: 'off', placeholder: 'Search lines, e.g. moon, apple, bye', 'aria-label': 'Search lines' });
    var miss = h('input', { type: 'checkbox', id: 'fvOnlyMissing' }); miss.checked = !!FV.miss;
    var tools = h('section', { class: 'pcard fv-tools' },
      h('button', { class: 'fv-big rec fv-recnext', id: 'fvRecNext', disabled: !!sup || !todo.length, onclick: function () { fvRecorder(v, fvTodo(v), 0, 'Record next', null, { big: true }); } },
        todo.length ? '⏺ Record next unrecorded' : '🎉 Everything is recorded'),
      h('p', { class: 'hint center' }, todo.length ? todo.length + ' lines left. It walks you through them one by one: Record, Play, Next. Stop any time; it remembers.' : 'Every line has a family recording.'),
      h('div', { class: 'fv-find' }, h('label', { class: 'field' }, h('span', {}, '🔎 Find a line'), srch),
        h('label', { class: 'toggle' }, miss, h('span', { class: 'toggle-ui' }), h('span', {}, 'Only show lines not recorded yet'))));
    var secs = h('div', { id: 'fvSections' });
    var tmr = 0;
    srch.addEventListener('input', function () { clearTimeout(tmr); tmr = setTimeout(function () { FV.q = srch.value; fvFillSections(v, secs, sup, {}); }, 160); });
    miss.addEventListener('change', function () { FV.miss = miss.checked; fvFillSections(v, secs, sup, {}); });
    body.replaceChildren(who, tools, secs, h('div', { class: 'btn-row' }, h('button', { class: 'pbtn ghost', onclick: function () { Rec.release(); renderParent('voices'); } }, '⬅ Back to Family Voices')));
    fvFillSections(v, secs, sup, open, groups);
    if (keep) window.scrollTo(0, y);
  }
  /* every recordable line that has no recording yet, in list order */
  function fvTodo(v, groups) {
    var out = [];
    (groups || fvGroups(v)).forEach(function (g) { g.lines.forEach(function (l) { if (!l.disabled && !l.custom && !fvClip(v, l.id)) out.push(Object.assign({ group: g.title }, l)); }); });
    return out;
  }
  function fvMatch(ln, q) { return !q || (ln.script + ' ' + (ln.label || '') + ' ' + (ln.alt || '')).toLowerCase().indexOf(q) >= 0; }
  function fvFillSections(v, box, sup, open, groups) {
    groups = groups || fvGroups(v);
    var q = String(FV.q || '').trim().toLowerCase(), miss = !!FV.miss, filtering = !!(q || miss), shown = 0;
    if (!open || !Object.keys(open).length) { open = {}; Array.prototype.forEach.call(box.querySelectorAll('details[data-g]'), function (d) { open[d.getAttribute('data-g')] = d.open; }); }
    var parts = [];
    groups.forEach(function (g) {
      var done = g.lines.filter(function (l) { return fvClip(v, l.id); }).length;
      var vis = g.lines.filter(function (l) { return fvMatch(l, q) && (!miss || (!fvClip(v, l.id) && !l.disabled)); });
      if (filtering && !vis.length) return;
      shown += vis.length;
      var d = h('details', { class: 'pcard fv-group', 'data-g': g.id });
      d.open = filtering ? true : g.id in open ? open[g.id] : g.id === 'guide';
      var recLines = g.lines.filter(function (l) { return !l.disabled; });
      var firstMissing = 0; for (var i = 0; i < recLines.length; i++) if (!fvClip(v, recLines[i].id)) { firstMissing = i; break; }
      d.appendChild(h('summary', {}, h('span', { class: 'fv-gtitle' }, g.icon + ' ' + g.title),
        h('span', { class: 'fv-gcount' + (done === g.lines.length ? ' full' : '') }, done + ' of ' + g.lines.length + ' recorded')));
      var fill = function () {
        if (d.getAttribute('data-filled')) return; d.setAttribute('data-filled', '1');
        if (g.lesson && g.id === 'letters') d.appendChild(h('p', { class: 'hint' }, 'Lesson recordings are optional. Anything you skip is read by the built-in voice.'));
        if (g.id === 'guide') d.appendChild(h('p', { class: 'hint' }, 'These are the lines your child hears most: greeting, name, praise, try again, start, break and goodbye. Record these first.'));
        d.appendChild(h('div', { class: 'btn-row' }, h('button', { class: 'pbtn fv-recall', 'data-g': g.id, disabled: !!sup || !recLines.length, onclick: function () {
          fvRecorder(v, recLines, firstMissing, g.title, null, { big: recLines.length > 1 });
        } }, '⏺ Record all of this section' + (done ? ' (continue)' : ''))));
        var lst = h('div', { class: 'fv-lines' });
        (filtering ? vis : g.lines).forEach(function (ln) { lst.appendChild(fvLineRow(v, ln, !!sup, g.title)); });
        d.appendChild(lst);
        if (g.id === 'guide' && !filtering) d.appendChild(fvCustomForm(v, !!sup));
      };
      if (d.open) fill();
      d.addEventListener('toggle', function () { if (d.open) fill(); });
      parts.push(d);
    });
    if (filtering && !shown) parts.push(h('p', { class: 'hint fv-none' }, q ? 'No lines match "' + q + '".' : 'Everything is recorded 🎉'));
    box.replaceChildren.apply(box, parts);
  }
  function fvLineRow(v, ln, noRec, title) {
    var rec = fvClip(v, ln.id), stale = rec && (ln.id === 'name' || rec.nm) && rec.nm !== normName(ln.nmUsed || '');
    return h('div', { class: 'fv-line' + (rec ? ' done' : '') + (ln.disabled ? ' off' : ''), 'data-line': ln.id },
      ln.swatch ? h('span', { class: 'fv-sw', style: { background: ln.swatch } }) : null,
      h('div', { class: 'fv-ltext' }, h('small', { class: 'fv-llabel' }, ln.label), h('b', {}, ln.script), ln.alt ? h('small', {}, ln.alt) : null, ln.hint ? h('small', { class: 'fv-hint' }, ln.hint) : null,
        stale ? h('small', { class: 'warn' }, 'Recorded for a different name, so it isn\'t used now. Record again.') : null),
      h('span', { class: 'fv-status' }, rec ? '✓ ' + ((rec.dur || 0) / 1000).toFixed(1) + ' s' : ''),
      h('div', { class: 'fv-lbtns' },
        h('button', { class: 'pbtn small fv-rec', disabled: noRec || !!ln.disabled, 'aria-label': (rec ? 'Re-record ' : 'Record ') + ln.label, onclick: function () { fvRecorder(v, [ln], 0, title); } }, rec ? '🔁 Re-record' : '⏺ Record'),
        rec ? h('button', { class: 'pbtn small ghost fv-play', 'aria-label': 'Play ' + ln.label, onclick: function () { fvPreview(rec, v); } }, '▶ Play') : null,
        rec ? h('button', { class: 'pbtn small ghost danger fv-delline', 'aria-label': 'Delete ' + ln.label, onclick: function () {
          if (!window.confirm('Delete this recording?')) return;
          fvDeleteClip(v, ln.id).then(function () { if (ln.custom) { v.custom = v.custom.filter(function (c) { return c.id !== ln.id; }); saveVoices(); } toast('Deleted'); fvFillBody(v, true); });
        } }, '🗑') : null));
  }
  function fvCustomForm(v, noRec) {
    var txt = h('input', { type: 'text', id: 'fvCustomText', maxlength: '120', autocomplete: 'off', placeholder: 'e.g. "Nanu loves you so much!"' });
    var slot = h('select', { id: 'fvCustomSlot', 'aria-label': 'When it plays' });
    Object.keys(FV_SLOTS).forEach(function (k) { slot.appendChild(h('option', { value: k }, FV_SLOTS[k])); });
    return h('div', { class: 'fv-custom' },
      h('h3', {}, '🎁 Record a custom line'),
      h('div', { class: 'fv-whogrid' }, h('label', { class: 'field' }, h('span', {}, 'What you will say'), txt), h('label', { class: 'field' }, h('span', {}, 'When it plays'), slot)),
      h('button', { class: 'pbtn', id: 'fvCustomRec', disabled: noRec, onclick: function () {
        var t = fvSan(txt.value, 120); if (!t) { txt.focus(); toast('Type the line first'); return; }
        var c = { id: fvNewId('custom_').toLowerCase().slice(0, 23), text: t, slot: slot.value };
        v.custom = (v.custom || []).concat([c]); saveVoices();
        fvRecorder(v, [{ id: c.id, label: 'Custom line', script: t, alt: '🎁 ' + FV_SLOTS[c.slot], custom: c }], 0, 'Custom line', function () {
          if (!fvClip(v, c.id)) { v.custom = v.custom.filter(function (x) { return x.id !== c.id; }); saveVoices(); }
        });
      } }, '⏺ Record a custom line'));
  }
  function fvRecorder(v, lines, idx, title, onClose, opts) {
    opts = opts || {};
    var sup = Rec.support();
    if (sup) { fvDialog('🎤 Recording is not available', [h('p', {}, fvSupportText(sup))], []); return; }
    Array.prototype.forEach.call(document.querySelectorAll('.fv-overlay'), function (n) { n.remove(); });
    var ov = h('div', { class: 'gate-overlay fv-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Record' });
    var box = h('div', { class: 'gate fv-recbox' });
    ov.appendChild(box); document.body.appendChild(ov);
    var state = 'idle', msg = '', msgWarn = false, closed = false;
    function close() {
      closed = true; Rec.stop(); fvStop(); ov.remove();
      if (onClose) onClose();
      fvFillBody(v, true);
    }
    function render() {
      var ln = lines[idx], rec = fvClip(v, ln.id);
      var head = h('div', { class: 'fv-rhead' }, h('span', {}, v.icon + ' ' + v.label), h('span', { id: 'fvRecPos' }, (ln.group || title) + (lines.length > 1 ? ' · ' + (idx + 1) + ' of ' + lines.length : '')));
      var script = h('div', { class: 'fv-script', id: 'fvScript' }, ln.script);
      var alt = ln.alt ? h('p', { class: 'hint' }, ln.alt) : null;
      var mid;
      if (state === 'recording') {
        mid = h('div', { class: 'fv-live' },
          h('div', { class: 'fv-count', id: 'fvCount' }, h('b', { id: 'fvCountN' }, '10'), h('small', {}, 'sec left')),
          h('div', { class: 'fv-level', 'aria-hidden': 'true' }, h('span', { id: 'fvLevel' })),
          h('p', { class: 'fv-recdot' }, '● Recording… speak now'));
      } else if (state === 'busy') mid = h('p', { class: 'hint' }, '🎤 Turning on the microphone… (allow it if the browser asks)');
      else mid = msg ? h('p', { class: msgWarn ? 'warn fv-msg' : 'hint fv-msg', id: 'fvMsg' }, msg) : h('p', { class: 'hint' }, rec ? 'Recorded ✓ (' + ((rec.dur || 0) / 1000).toFixed(1) + ' s)' : 'Tap Record, ' + (/^sg_/.test(ln.id) ? 'sing or say' : 'say') + ' the line, then tap Stop (it stops by itself after ' + Math.round((ln.max || FV_MAX_MS) / 1000) + ' seconds).');
      var btns = h('div', { class: 'fv-rbtns' });
      if (state === 'recording') btns.appendChild(h('button', { class: 'fv-big stop', id: 'fvStop', onclick: function () { Rec.stop(); } }, '⏹ Stop'));
      else if (state === 'idle') {
        btns.appendChild(h('button', { class: 'fv-big rec', id: 'fvRecBtn', onclick: go }, rec ? '🔁 Record again' : '⏺ Record'));
        var big = !!opts.big, row = h('div', { class: 'btn-row center' + (big ? ' fv-bigrow' : '') });
        if (rec) row.appendChild(h('button', { class: big ? 'fv-big play' : 'pbtn ghost', id: 'fvListen', onclick: function () { fvPreview(fvClip(v, ln.id), v); } }, '▶ Play'));
        if (lines.length > 1) row.appendChild(h('button', { class: big ? 'fv-big next' : 'pbtn', id: 'fvNext', onclick: next }, idx < lines.length - 1 ? (rec ? 'Next ➜' : 'Skip ➜') : '✓ Finish'));
        btns.appendChild(row);
        var row2 = h('div', { class: 'btn-row center' });
        if (!ln.custom && !/^sg_/.test(ln.id)) row2.appendChild(h('button', { class: 'pbtn ghost small', id: 'fvHear', onclick: function () { fvStop(); Sound.resume(); Speech.tts(ln.script); } }, '🔈 Hear Booyo say it'));
        row2.appendChild(h('button', { class: 'pbtn ghost', id: 'fvClose', onclick: close }, lines.length > 1 ? 'Close' : rec ? '✓ Done' : 'Cancel'));
        btns.appendChild(row2);
      }
      box.replaceChildren(head, script, alt || '', mid, btns);
      ov.setAttribute('data-state', state);
    }
    function go() {
      state = 'busy'; msg = ''; msgWarn = false; render(); fvStop(); Speech.stop(); Sound.resume();
      var ln = lines[idx], lmax = ln.max || FV_MAX_MS;
      Rec.record({
        maxMs: lmax,
        onStart: function () { if (closed) { Rec.stop(); return; } state = 'recording'; render(); },
        onTick: function (ms) {
          var el = document.getElementById('fvCountN'), ring = document.getElementById('fvCount');
          if (el) el.textContent = String(Math.ceil(ms / 1000));
          if (ring) ring.style.setProperty('--p', (ms / lmax * 100).toFixed(1) + '%');
        },
        onLevel: function (x) { var el = document.getElementById('fvLevel'); if (el) el.style.width = Math.min(100, Math.round(x * 180)) + '%'; }
      }).then(function (res) {
        if (closed) return;
        if (res.dur < 400 || !res.blob.size) { state = 'idle'; msg = 'That was too short. Tap Record, say the line, then tap Stop.'; msgWarn = true; render(); return; }
        return fvSave(v, ln, res).then(function (r) {
          state = 'idle'; msg = '✓ Saved (' + (res.dur / 1000).toFixed(1) + ' s). Listen, record again' + (lines.length > 1 ? ', or go to the next one.' : ', or tap Done.'); render();
          fvPreview(r, v);
        });
      }).catch(function (e) { if (closed) return; state = 'idle'; msg = e && e.name ? fvMicErr(e) : 'Could not save: ' + ((e && e.message) || e); msgWarn = true; render(); });
    }
    function next() {
      fvStop();
      if (idx < lines.length - 1) { idx++; msg = ''; render(); }
      else { toast('🎉 ' + title + ': done'); close(); }
    }
    render();
  }

  /* =====================================================================
     v3.1 STORY MAKER: the child builds a story by tapping one picture per step;
     Booyo reads the story-so-far after every pick. Optional "Say it!" voice line.
     Finished stories are kept in IndexedDB (store "stories", newest 30).
     ===================================================================== */
  var SM_MAX = 30;
  var SM_PROMPT = { who: 'Who is in the story?', where: 'Where do they go?', what: 'What happens?', end: 'How does it end?' };
  var SM_STEP_ICON = { who: '👤', where: '🗺️', what: '⭐', end: '🌙' };
  var SM = { readId: 0, stories: [], ready: false, err: '', trimmed: Number(store.get('tl_sm_trimmed', 0)) || 0, micBlocked: false };
  function smKid() { return (settings.childName || '').trim(); }
  function smFill(t) {
    var k = smKid();
    return String(t).replace(/\{Kid\}/g, k || 'Our Friend').replace(/\{kidS\}/g, k || 'our friend').replace(/\{kidL\}/g, k || 'Friend').replace(/\{kid\}/g, k || 'a little friend');
  }
  function smCap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function smPages(p) {
    var out = [];
    if (p.who) out.push({ k: 'who', e: p.who.e, text: TX('sm_p_who', { who: p.who }) });
    if (p.where) out.push({ k: 'where', e: p.who.e + p.where.e, text: TX('sm_p_where', { who: p.who, where: p.where }) });
    if (p.what) out.push({ k: 'what', e: p.what.e, text: TX('sm_p_what', { who: p.who, what: p.what }) });
    if (p.end) out.push({ k: 'end', e: p.end.e, text: TX('sm_p_end', { who: p.who, end: p.end }) });
    return out;
  }
  function smTitle(p) { return smFill(p.who.title) + ' ' + p.where.title; }
  function smAuthor(name) { return name ? 'A story by ' + name : 'A story by a little author'; }
  function smBook(rec) {
    var out = rec.pages.map(function (p) { return { kind: 'page', e: p.e, text: p.text }; });
    if (rec.clip) out.push({ kind: 'clip', e: '🎤', text: (rec.author ? rec.author + ' says…' : 'The author says…'), say: rec.author ? TX('sm_clip', { name: rec.author }) : TX('sm_clip0') });
    out.push({ kind: 'end', e: '🎉', text: TX('sm_theend') });
    return out;
  }
  function smGet(id) { for (var i = 0; i < SM.stories.length; i++) if (SM.stories[i].id === id) return SM.stories[i]; return null; }

  /* ---------- storage ---------- */
  function smLoad() {
    return VDB.tx('readonly', function (s) { return s.getAll(); }, 'stories').then(function (rows) {
      SM.stories = (rows || []).filter(function (r) { return r && r.id && Array.isArray(r.pages); }).map(function (r) {
        if (!r.clip && r.buf) r.clip = new Blob([r.buf], { type: r.mime || 'audio/webm' });
        return r;
      }).sort(function (a, b) { return a.t - b.t; });
      SM.ready = true; smRefresh();
    }).catch(function (e) {
      SM.ready = true; SM.err = 'Stories can\'t be saved in this browser (' + ((e && (e.name || e.message)) || 'storage blocked') + ').';
      smRefresh();
    });
  }
  function smPut(rec) {
    return VDB.tx('readwrite', function (s) { return s.put(rec); }, 'stories').catch(function (err) {
      if (!rec.clip) throw err;
      return new Promise(function (ok, bad) { var fr = new FileReader(); fr.onload = function () { ok(fr.result); }; fr.onerror = function () { bad(fr.error); }; fr.readAsArrayBuffer(rec.clip); })
        .then(function (buf) { var r2 = {}; Object.keys(rec).forEach(function (k) { if (k !== 'clip' && k.charAt(0) !== '_') r2[k] = rec[k]; }); r2.buf = buf; return VDB.tx('readwrite', function (s) { return s.put(r2); }, 'stories'); });
    });
  }
  function smSave(rec) {
    return smPut(rec).then(function () {
      SM.stories.push(rec);
      var drop = [];
      while (SM.stories.length > SM_MAX) drop.push(SM.stories.shift());
      if (!drop.length) return;
      SM.trimmed += drop.length; store.set('tl_sm_trimmed', SM.trimmed);
      return VDB.tx('readwrite', function (s) { drop.forEach(function (d) { s.delete(d.id); }); }, 'stories');
    }).then(function () { fvPersist(); return rec; });
  }
  function smDelete(id) {
    return VDB.tx('readwrite', function (s) { return s.delete(id); }, 'stories').then(function () {
      var r = smGet(id); if (r && r._c && r._c.url) URL.revokeObjectURL(r._c.url);
      SM.stories = SM.stories.filter(function (x) { return x.id !== id; });
    });
  }
  function smRefresh() {
    var scr = app.getAttribute('data-screen');
    if (scr === 'parent') { var old = document.getElementById('smCard'); if (old) old.replaceWith(smCard()); }
  }

  /* ---------- reading aloud (built-in voice or Family Voices, plus the child's own clip) ---------- */
  function smUnlockAudio() {
    try { var a = fvAudio(); if (!a.paused) return; a.src = fvSilentUrl(); var p = a.play(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ignore */ }
  }
  function smPlayClip(rec, cb) {
    if (!rec.clip) return cb();
    rec._c = rec._c || { blob: rec.clip, dur: rec.dur || 4000, line: 'smkid' };
    fvPlayClip(rec._c, { label: rec.author || 'Little author', icon: '🧒' }, function () { cb(); });
  }
  function smRead(rec, onPage, done) {
    var book = smBook(rec), k = 0, tok0 = token, my = ++SM.readId;
    Speech.stop();
    (function step() {
      if (tok0 !== token || my !== SM.readId) return;
      if (k >= book.length) { onPage(-1); if (done) done(); return; }
      var i = k++, p = book[i];
      onPage(i);
      if (p.kind === 'clip') talk(p.say, '🎤', function () { smPlayClip(rec, step); });
      else talk(p.text, p.kind === 'end' ? '🎉' : '📖', step);
    })();
  }

  /* ---------- kid screens ---------- */
  function smChoices(step) {
    var list = D.storyMaker[step], n = band() === '2-3' ? 3 : 4;
    var out = sample(list, Math.min(n, list.length));
    if (step === 'who' && !out.some(function (c) { return c.me; })) out[out.length - 1] = list.filter(function (c) { return c.me; })[0];
    return shuffle(out);
  }
  function smScreen(content, scr) {
    if (G.active) return gScreen('gsm', content, scr);
    var main = h('main', { class: 'screen kid guided sm-screen' }, kidBar({ title: '✨' }),
      h('div', { class: 'gstage' }, h('div', { class: 'gside' }, owlEl('')), h('div', { class: 'gmain' }, content)));
    show(main, scr);
    if (noVoice()) document.body.classList.add('novoice'); else document.body.classList.remove('novoice');
    return main;
  }
  function smStrip(pages, hi) {
    var ol = h('ol', { class: 'sm-strip', 'aria-label': 'Your story so far' });
    pages.forEach(function (p, i) {
      ol.appendChild(h('li', { class: 'sm-page' + (i === hi ? ' reading' : '') + (p.kind ? ' ' + p.kind : ''), 'data-k': p.k || p.kind || '' },
        h('span', { class: 'sm-pe', 'aria-hidden': 'true' }, p.e), h('span', { class: 'sm-pt' }, p.text)));
    });
    return ol;
  }
  function smCoverEl(rec) {
    return h('section', { class: 'sm-cover', 'aria-label': rec.title + '. ' + smAuthor(rec.author) + '.' },
      h('div', { class: 'sm-cover-art', 'aria-hidden': 'true' }, rec.cover),
      h('h1', { class: 'sm-title' }, rec.title),
      h('p', { class: 'sm-by' }, smAuthor(rec.author)));
  }
  /* done: guided-session callback (null when opened from the picture menu) */
  function storyMaker(done) {
    var guided = !!(done && G.active), r = guided ? curRec() : null;
    var steps = ['who', 'where', 'what', 'end'], si = 0, picks = {}, clip = null;
    if (!guided) { mode = 'kid'; enterKidGuards(); if (isOverLimit()) return showBreak(); }
    function setRepeat(fn) { G.repeat = fn; repeatFn = fn; }
    function ask() {
      var step = steps[si], list = smChoices(step), locked = false, btns = [];
      var grid = h('div', { class: 'choices sm-choices c' + list.length, role: 'group', 'aria-label': SM_PROMPT[step] });
      list.forEach(function (c) {
        var lab = smFill(c.label);
        var b = h('button', { class: 'choice sm-choice', 'data-pick': c.id, 'aria-label': lab },
          h('span', { class: 'sm-e', 'aria-hidden': 'true' }, c.e), h('span', { class: 'sm-l' }, lab));
        if (TEST) b.setAttribute('data-ok', '1');
        b.addEventListener('click', function () { if (locked || b.disabled) return; locked = true; pickIt(c, b); });
        grid.appendChild(b); btns.push(b);
      });
      var pages = smPages(picks);
      var head = h('div', { class: 'sm-head' },
        h('div', { class: 'sm-steps', role: 'img', 'aria-label': 'Step ' + (si + 1) + ' of 4' }, steps.map(function (s, i) {
          return h('span', { class: 'sm-step' + (i < si ? ' done' : i === si ? ' now' : '') }, SM_STEP_ICON[s]);
        })),
        h('h2', { class: 'sm-q' }, SM_PROMPT[step]));
      smScreen([head, pages.length ? smStrip(pages, -1) : null, grid], 'sm-' + step);
      var prompt = function () { talk(TX('sm_ask_' + step), '👆', idleKick); };
      setRepeat(prompt);
      if (guided) idleArm(idleLadder(r, function () { hintSweep(grid); prompt(); }, done));
      talk((si === 0 ? TX('sm_hello') + ' ' : '') + TX('sm_ask_' + step), '✨', function () {
        idleKick();
        if (si === 0 && !locked && (guided || noVoice())) hintSweep(grid);
      });
      function pickIt(c, b) {
        idleStop(); Hand.hide(); Sound.pop();
        b.classList.add('right'); b.setAttribute('aria-pressed', 'true');
        btns.forEach(function (x) { if (x !== b) { x.classList.add('soft'); x.disabled = true; } });
        picks[step] = c;
        if (r) { r.questions++; r.firstTry++; saveSessions(); }
        var pg = smPages(picks), strip = smStrip(pg, pg.length - 1);
        var old = app.querySelector('.sm-strip'); if (old) old.replaceWith(strip); else grid.parentNode.insertBefore(strip, grid);
        setRepeat(null);
        talk(pg.map(function (x) { return x.text; }).join(' '), '📖', function () { si++; later(si < steps.length ? ask : sayStep, T.beat); });
      }
    }
    function sayStep() {
      if (settings.smSayIt === false || Rec.support() || SM.micBlocked) return finale();
      var state = 'idle', downAt = 0;
      var n = h('b', { class: 'sm-mic-n', 'aria-hidden': 'true' }, '');
      var mic = h('button', { class: 'sm-mic', id: 'smMic', 'aria-label': 'Record your voice: hold the button and talk', 'aria-pressed': 'false' },
        h('span', { class: 'sm-mic-ic', 'aria-hidden': 'true' }, '🎤'), n);
      var skip = h('button', { class: 'skip-btn sm-skip', id: 'smSkip', 'aria-label': 'Skip this step' }, ARROW_R());
      smScreen([h('div', { class: 'sm-head' }, h('h2', { class: 'sm-q' }, '🎤 Say it!')), smStrip(smPages(picks), -1), h('div', { class: 'sm-say' }, mic, skip)], 'sm-say');
      var prompt = function () { talk(TX('sm_sayit'), '🎤', idleKick); };
      setRepeat(prompt);
      if (guided) idleArm(function (k) { if (k <= 2) { if (r) r.idleReprompts++; Hand.at(skip, { glow: false }); prompt(); } else { idleStop(); Hand.hide(); finale(); } });
      prompt();
      function start() {
        if (state !== 'idle') return;
        state = 'starting'; idleStop(); Hand.hide(); fvStop(); Speech.stop(); Sound.resume(); smUnlockAudio();
        mic.classList.add('starting');
        Rec.record({
          onStart: function () {
            if (!mic.isConnected) { Rec.stop(); return; }
            state = 'rec'; mic.classList.remove('starting'); mic.classList.add('rec');
            mic.setAttribute('aria-pressed', 'true'); mic.setAttribute('aria-label', 'Recording: let go, or tap again, to stop');
          },
          onTick: function (ms) { n.textContent = String(Math.ceil(ms / 1000)); mic.style.setProperty('--p', (ms / FV_MAX_MS * 100).toFixed(1) + '%'); }
        }).then(function (res) {
          Rec.release();
          if (!mic.isConnected) return;
          mic.classList.remove('rec'); mic.setAttribute('aria-pressed', 'false'); n.textContent = '';
          if (res.dur < 500 || !res.blob.size) { state = 'idle'; talk(TX('sm_nohear'), '🎤', idleKick); return; }
          state = 'done'; clip = res;
          talk(TX('sm_listen'), '👂', function () { smPlayClip({ clip: res.blob, dur: res.dur, author: smKid() }, function () { later(finale, T.beat); }); });
        }).catch(function () {
          Rec.release(); SM.micBlocked = true;   // no more mic requests this visit
          if (!mic.isConnected) return;
          state = 'done'; mic.classList.remove('starting', 'rec');
          talk(TX('sm_skip'), '💖', function () { later(finale, T.beat); });
        });
      }
      function stop() { if (state === 'rec') { state = 'stopping'; Rec.stop(); } }
      mic.addEventListener('pointerdown', function (e) { e.preventDefault(); if (state === 'idle') { downAt = Date.now(); start(); } });
      mic.addEventListener('pointerup', function () { if (state === 'rec' && Date.now() - downAt > 700) stop(); });
      mic.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      mic.addEventListener('click', function (e) {
        if (e.detail === 0) { if (state === 'idle') { downAt = 0; start(); } else stop(); return; }   // keyboard / switch: press to start, press again to stop
        if (state === 'rec' && Date.now() - downAt > 700) stop();
      });
      skip.addEventListener('click', function () { if (state !== 'idle') return; Sound.pop(); idleStop(); Hand.hide(); finale(); });
    }
    function finale() {
      idleStop(); Hand.hide();
      var rec = { id: fvNewId('s'), t: Date.now(), author: smKid(), title: smTitle(picks), cover: picks.who.e + picks.where.e,
        picks: { who: picks.who.id, where: picks.where.id, what: picks.what.id, end: picks.end.id },
        pages: smPages(picks).map(function (p) { return { e: p.e, text: p.text }; }),
        clip: clip ? clip.blob : null, mime: clip ? clip.mime : '', dur: clip ? clip.dur : 0 };
      smSave(rec).then(function () { SM.lastSaved = rec.id; }).catch(function (e) { SM.err = 'This story could not be saved (' + ((e && (e.name || e.message)) || 'storage') + ').'; });
      if (r) { r.title = 'Make a Story: ' + rec.title; saveSessions(); }
      smCoverScreen(rec, { guided: guided, done: done, first: true });
    }
    ask();
  }

  /* the cover screen at the end of Make a Story (also where "Sing it!" comes back to) */
  function smCoverScreen(rec, env) {
    var guided = !!(env.guided && G.active), done = env.done, first = env.first;
    env.first = false;
    var strip = smStrip(smBook(rec), -1);
    var again = h('button', { class: 'bigbtn green sm-again', id: 'smAgain', 'aria-label': 'Read it again' }, '📖');
    var sing = h('button', { class: 'bigbtn sg-btn', id: 'sgSing', 'aria-label': 'Sing it!' }, '🎵');
    var row = h('div', { class: 'row sm-row' }, again, sing), nextBtn = null;
    if (guided) row.appendChild(nextBtn = h('button', { class: 'bigbtn blue sm-next', id: 'smNext', 'aria-label': 'Keep playing' }, ARROW_R()));
    else {
      row.appendChild(h('button', { class: 'bigbtn blue', 'aria-label': 'Make another story', onclick: function () { Sound.pop(); storyMaker(null); } }, '🔁'));
      row.appendChild(h('button', { class: 'bigbtn blue', 'aria-label': 'Home', onclick: function () { Sound.pop(); kidHome(); } }, '🏠'));
    }
    smScreen([smCoverEl(rec), row, strip], 'sm-cover');
    if (first) {
      if (!calmish()) confetti();
      Sound.yay(); addStar('stories');
      if (!guided) activityDone('storymaker');
    }
    function setRepeat(fn) { G.repeat = fn; repeatFn = fn; }
    function hl(i) { Array.prototype.forEach.call(strip.children, function (li, j) { li.classList.toggle('reading', j === i); }); }
    function afterRead() {
      if (!guided || !nextBtn) return;
      Hand.at(nextBtn, { glow: false });
      idleArm(function (k) { if (k <= 1) talk(TX('sm_cover'), '👆', idleKick); else { idleStop(); Hand.hide(); done(); } });
    }
    function readAll() { idleStop(); Hand.hide(); smRead(rec, hl, afterRead); }
    again.addEventListener('click', function () { Sound.pop(); readAll(); });
    sing.addEventListener('click', function () { Sound.pop(); idleStop(); Hand.hide(); songPicker(rec, { parent: false, back: function () { smCoverScreen(rec, env); } }); });
    if (nextBtn) nextBtn.addEventListener('click', function () { Sound.pop(); idleStop(); Hand.hide(); done(); });
    setRepeat(readAll);
    if (first) talk(TX('sm_wow') + ' ' + (rec.author ? TX('sm_by', { name: rec.author }) : TX('sm_by0')), '🎉', readAll);
    else talk(TX('sm_again'), '📖', afterRead);
  }

  /* ---------- parent corner: My Stories shelf ---------- */
  function smCard() {
    var S = settings, c = card('📚 My Stories', 'wide sm-card');
    c.id = 'smCard';
    var g = h('input', { type: 'checkbox', id: 'smGuided' }); g.checked = S.smGuided !== false;
    g.addEventListener('change', function () { S.smGuided = g.checked; saveSettings(); toast('Saved ✓'); });
    var sy = h('input', { type: 'checkbox', id: 'smSayIt' }); sy.checked = S.smSayIt !== false;
    sy.addEventListener('change', function () { S.smSayIt = sy.checked; saveSettings(); toast('Saved ✓'); });
    c.appendChild(h('p', { class: 'hint' }, 'In ✨ Make a Story your child picks who, where, what happens and how it ends, and Booyo tells the story back. Finished stories are saved here, on this device only.'));
    c.appendChild(h('div', { class: 'fv-opts' },
      h('label', { class: 'toggle' }, g, h('span', { class: 'toggle-ui' }), h('span', {}, 'Include Make a Story in guided sessions')),
      h('label', { class: 'toggle' }, sy, h('span', { class: 'toggle-ui' }), h('span', {}, '"Say it!" step: my child can record their own line (the mic turns on only while they press it)'))));
    var sa = h('input', { type: 'checkbox', id: 'sgSingAlong' }); sa.checked = S.sgSingAlong !== false;
    sa.addEventListener('change', function () { S.sgSingAlong = sa.checked; saveSettings(); toast('Saved ✓'); });
    var sl = h('input', { type: 'checkbox', id: 'sgLyricsOn' }); sl.checked = S.sgLyrics !== false;
    sl.addEventListener('change', function () { S.sgLyrics = sl.checked; saveSettings(); toast('Saved ✓'); });
    var sv = h('select', { id: 'sgVol' });
    [['soft', 'Soft (default)'], ['medium', 'Medium'], ['loud', 'Louder']].forEach(function (o) { var op = h('option', { value: o[0] }, o[1]); if ((S.sgVol || 'soft') === o[0]) op.selected = true; sv.appendChild(op); });
    sv.addEventListener('change', function () { S.sgVol = sv.value; saveSettings(); toast('Saved ✓'); });
    c.appendChild(h('div', { class: 'sg-help', id: 'sgHelp' },
      h('h3', {}, '🎵 Sing My Story'),
      h('p', { class: 'hint' }, 'On the story\'s last page (or here on the shelf) the 🎵 button turns a story into a short song: rhyming lines made from your child\'s picks, in one of three styles (Lullaby, March, Silly Bounce). The music is made on this device. '),
      h('p', { class: 'hint' }, 'Honest note: Booyo\'s built-in voice can\'t really sing. It chants each line in time with the music. For real singing, record the song lines in 🎙️ Family Voices → "Sing My Story" (or one recording of the whole song). Those recordings play instead, lined up with the music.'),
      h('div', { class: 'fv-opts' },
        h('label', { class: 'toggle' }, sa, h('span', { class: 'toggle-ui' }), h('span', {}, '"Sing along" mic: my child can hold 🎤 and sing with the song (up to 30 s; the mic is on only while pressed)')),
        h('label', { class: 'toggle' }, sl, h('span', { class: 'toggle-ui' }), h('span', {}, 'Show the song words on screen, highlighted as they are sung'))),
      h('label', { class: 'field' }, h('span', {}, 'Song volume'), sv)));
    var n = SM.stories.length;
    if (SM.err) c.appendChild(h('p', { class: 'warn' }, SM.err));
    c.appendChild(h('p', { class: 'hint', id: 'smCount' }, SM.ready ? n + ' of ' + SM_MAX + ' stories saved on this device.' : 'Loading stories…'));
    if (n >= SM_MAX) c.appendChild(h('p', { class: 'warn', id: 'smFull' }, 'The shelf is full (' + SM_MAX + ' stories). Each new story replaces the oldest one. Export the stories you want to keep.'));
    else if (n >= SM_MAX - 3) c.appendChild(h('p', { class: 'warn', id: 'smFull' }, 'The shelf is almost full (' + n + ' of ' + SM_MAX + '). After that, new stories replace the oldest ones. Export the stories you want to keep.'));
    if (SM.trimmed) c.appendChild(h('p', { class: 'warn', id: 'smTrimmed' }, SM.trimmed + (SM.trimmed === 1 ? ' older story was' : ' older stories were') + ' removed to make room. ',
      h('button', { class: 'link-btn', onclick: function () { SM.trimmed = 0; store.set('tl_sm_trimmed', 0); smRefresh(); } }, 'OK')));
    if (SM.ready && !n) c.appendChild(h('p', { class: 'hint' }, 'No stories yet. Your child makes one with the ✨ Make a Story picture, or during a guided session.'));
    var shelf = h('div', { class: 'sm-shelf', role: 'list', 'aria-label': 'Saved stories' });
    SM.stories.slice().reverse().forEach(function (s) {
      shelf.appendChild(h('div', { class: 'sm-shelf-item', role: 'listitem', 'data-story': s.id },
        h('div', { class: 'sm-shelf-cover', 'aria-hidden': 'true' }, s.cover, s.song ? h('span', { class: 'sg-badge' }, '🎵') : null),
        h('div', { class: 'sm-shelf-meta' }, h('b', {}, s.title, s.song ? h('span', { class: 'sg-badge-t', title: 'Has a song' }, ' 🎵') : null),
          h('small', {}, smAuthor(s.author) + ' · ' + fmtTime(new Date(s.t).toISOString()) + (s.clip ? ' · 🎤 with voice' : '') +
            (s.song ? ' · 🎵 ' + sgStyle(s.song.style).label + ' song' + (s.song.clip ? ' with singing' : '') : ''))),
        h('div', { class: 'btn-row' },
          h('button', { class: 'pbtn small sm-open', 'aria-label': 'Open ' + s.title, onclick: function () { smBookView(s.id); } }, '📖 Open'),
          h('button', { class: 'pbtn small ghost sm-play', 'aria-label': 'Play ' + s.title, onclick: function () { Sound.resume(); smUnlockAudio(); smRead(s, function () {}, null); } }, '▶ Play'),
          h('button', { class: 'pbtn small sm-sing', 'aria-label': 'Sing ' + s.title, onclick: function () { songPicker(s, { parent: true, back: smBackToShelf }); } }, '🎵 Sing it!'),
          s.song ? h('button', { class: 'pbtn small ghost sm-song', 'aria-label': 'Play the song of ' + s.title, onclick: function () { sgPlay(s, s.song.style, { parent: true, back: smBackToShelf }); } }, '▶ Play song') : null,
          h('button', { class: 'pbtn small ghost sm-export', 'aria-label': 'Export ' + s.title, onclick: function () { smExport(s); } }, '📤 Export'),
          h('button', { class: 'pbtn small ghost danger sm-del', 'aria-label': 'Delete ' + s.title, onclick: function () {
            if (!window.confirm('Delete "' + s.title + '"?')) return;
            smDelete(s.id).then(function () { toast('Deleted'); smRefresh(); });
          } }, '🗑'))));
    });
    c.appendChild(shelf);
    return c;
  }
  function smBackToShelf() { renderParent('stories'); }
  function smBookView(id) {
    var s = smGet(id); if (!s) return renderParent();
    var book = [{ kind: 'cover' }].concat(smBook(s)), i = 0;
    var pageEl = h('div', { class: 'sm-bookpage', id: 'smBookPage', 'aria-live': 'polite' });
    var num = h('span', { class: 'sm-booknum', id: 'smBookNum' });
    var prev = h('button', { class: 'bigbtn blue', id: 'smPrev', 'aria-label': 'Previous page', onclick: function () { Speech.stop(); go(i - 1); } }, ARROW_L());
    var next = h('button', { class: 'bigbtn green', id: 'smNextPage', 'aria-label': 'Next page', onclick: function () { Speech.stop(); go(i + 1); } }, ARROW_R());
    function go(k) {
      i = Math.max(0, Math.min(book.length - 1, k));
      var p = book[i];
      pageEl.replaceChildren(p.kind === 'cover' ? smCoverEl(s) : h('div', { class: 'sm-bp ' + p.kind },
        h('div', { class: 'sm-bp-art', 'aria-hidden': 'true' }, p.e), h('p', { class: 'sm-bp-text' }, p.text),
        p.kind === 'clip' ? h('button', { class: 'pbtn', id: 'smPlayKid', onclick: function () { Sound.resume(); smPlayClip(s, function () {}); } }, '▶ Play ' + (s.author || 'the author') + '\'s voice') : null));
      num.textContent = 'Page ' + (i + 1) + ' of ' + book.length;
      prev.disabled = i === 0; next.disabled = i === book.length - 1;
    }
    var printable = h('div', { class: 'sm-print' }, book.map(function (p) {
      return h('section', { class: 'sm-print-page' }, p.kind === 'cover' ? smCoverEl(s) : [h('div', { class: 'sm-bp-art' }, p.e), h('p', { class: 'sm-bp-text' }, p.text)]);
    }));
    show(h('main', { class: 'screen parent sm-bookscreen' },
      h('header', { class: 'phead' }, h('div', {}, h('h1', {}, '📖 ' + s.title), h('p', {}, smAuthor(s.author) + ' · ' + fmtTime(new Date(s.t).toISOString()))),
        h('button', { class: 'pbtn ghost', id: 'smBack', onclick: function () { renderParent('stories'); } }, '⬅ My Stories')),
      h('div', { class: 'sm-book pcard' }, pageEl, h('div', { class: 'sm-booknav' }, prev, num, next)),
      h('div', { class: 'btn-row center noprint' },
        h('button', { class: 'pbtn', id: 'smReadAloud', onclick: function () { Sound.resume(); smUnlockAudio(); smRead(s, function (k) { if (k >= 0) go(k + 1); }, null); } }, '🔊 Read aloud'),
        h('button', { class: 'pbtn ghost', id: 'smPrint', onclick: function () { printCard('book'); } }, '🖨️ Print'),
        h('button', { class: 'pbtn ghost', id: 'smExportBook', onclick: function () { smExport(s); } }, '📤 Export'),
        h('button', { class: 'pbtn ghost danger', onclick: function () { if (!window.confirm('Delete "' + s.title + '"?')) return; smDelete(s.id).then(function () { renderParent(); toast('Deleted'); }); } }, '🗑 Delete')),
      printable), 'smbook');
    go(0);
  }

  /* ---------- export: a self-contained offline HTML storybook, or a .booyostory file ---------- */
  function smEsc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function smSafe(s) { return String(s).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'story'; }
  function smHtml(s, b64, song) {
    var book = smBook(s), when = new Date(s.t).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    var mime = String(s.mime || 'audio/webm').split(';')[0].replace(/[^\w\/.+-]/g, '');
    var pages = ['<section class="page cover" data-say="' + smEsc(s.title + '. ' + smAuthor(s.author) + '.') + '"><div class="art">' + smEsc(s.cover) + '</div><h1>' + smEsc(s.title) + '</h1><p class="by">' + smEsc(smAuthor(s.author)) + '</p></section>'];
    book.forEach(function (p) {
      var extra = p.kind === 'clip' && b64 ? '<audio controls preload="auto" src="data:' + mime + ';base64,' + b64 + '"></audio>' : '';
      if (p.kind === 'clip' && !b64) return;
      pages.push('<section class="page ' + p.kind + '" data-say="' + smEsc(p.say || p.text) + '"><div class="art">' + smEsc(p.e) + '</div><p>' + smEsc(p.text) + '</p>' + extra +
        (p.kind === 'end' ? '<p class="made">Made with Booyo · ' + smEsc(when) + '</p>' : '') + '</section>');
    });
    if (song) {
      var sty = sgStyle(song.style), lis = song.comp.lines.map(function (L, i) {
        return '<li data-t="' + (song.lead + song.comp.lineAt(i)).toFixed(2) + '"' + (song.voiced[i] ? ' data-v="1"' : '') + '>' + smEsc(L.text) + '</li>'; }).join('');
      pages.splice(pages.length - 1, 0, '<section class="page song" data-say="' + smEsc('And now, the song! ' + s.title + ', as a ' + sty.label + '.') + '" data-rate="' + SG_STYLES[song.style].rate + '" data-pitch="' + SG_STYLES[song.style].pitch + '">' +
        '<div class="art">🎵' + smEsc(sty.e) + '</div><p>' + smEsc(sty.label) + ' song</p>' +
        '<audio id="songAudio" class="songa" controls preload="auto" src="data:audio/wav;base64,' + song.b64 + '"></audio>' +
        '<label class="chant"><input type="checkbox" id="chant" checked> Booyo chants the words with the music</label><ol class="lyrics">' + lis + '</ol></section>');
    }
    var css = 'body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#fff8e1;color:#263238}' +
      'main{max-width:820px;margin:0 auto;padding:16px}.page{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;min-height:70vh;background:#fff;border-radius:24px;box-shadow:0 4px 18px rgba(0,0,0,.08);margin:16px 0;padding:24px}' +
      '.art{font-size:120px;line-height:1.1}h1{font-size:40px;margin:12px 0}.by{font-size:22px;color:#6a1b9a;font-weight:700}p{font-size:28px;line-height:1.4;margin:12px 0}.made{font-size:15px;color:#78909c}audio{width:100%;max-width:420px;margin-top:10px}' +
      'html.js .page{display:none}html.js .page.on{display:flex}nav{display:none;gap:10px;justify-content:center;align-items:center;flex-wrap:wrap;padding:10px}html.js nav{display:flex}' +
      'nav button{font-size:22px;padding:12px 20px;border-radius:14px;border:0;background:#5e35b1;color:#fff}nav button:focus-visible{outline:4px solid #ffab00;outline-offset:3px}#num{font-size:18px;min-width:80px}' +
      '.lyrics{text-align:left;font-size:22px;line-height:1.5;padding-left:1.2em}.lyrics li{border-radius:10px;padding:2px 8px}.lyrics li.now{background:#fff3e0;box-shadow:inset 0 0 0 3px #ffab40}.chant{font-size:16px}' +
      '@media print{html.js .page,.page{display:flex!important;min-height:0;box-shadow:none;page-break-after:always;break-after:page}nav{display:none!important}body{background:#fff}audio{display:none}}';
    var js = '(function(){var d=document,P=[].slice.call(d.querySelectorAll(".page")),i=0,reading=false;d.documentElement.className="js";' +
      'function go(n){i=Math.max(0,Math.min(P.length-1,n));P.forEach(function(p,k){p.classList.toggle("on",k===i)});d.getElementById("num").textContent=(i+1)+" / "+P.length}' +
      'function stop(){reading=false;try{speechSynthesis.cancel()}catch(e){}[].forEach.call(d.querySelectorAll("audio"),function(a){a.pause()})}' +
      'function say(t,cb){try{var u=new SpeechSynthesisUtterance(t);u.rate=.8;u.pitch=.95;u.volume=.8;u.onend=cb;u.onerror=cb;speechSynthesis.speak(u)}catch(e){setTimeout(cb,1200)}}' +
      'function read(k){if(!reading)return;if(k>=P.length){reading=false;return}go(k);var p=P[k],a=p.querySelector("audio");' +
      'say(p.getAttribute("data-say"),function(){if(!reading)return;if(a){a.onended=function(){read(k+1)};var pr=a.play();if(pr&&pr.catch)pr.catch(function(){read(k+1)})}else read(k+1)})}' +
      'd.getElementById("prev").onclick=function(){stop();go(i-1)};d.getElementById("next").onclick=function(){stop();go(i+1)};' +
      'd.getElementById("read").onclick=function(){stop();reading=true;read(i)};d.getElementById("print").onclick=function(){stop();print()};' +
      'd.addEventListener("keydown",function(e){if(e.key==="ArrowRight")go(i+1);if(e.key==="ArrowLeft")go(i-1)});go(0);' +
      'var sa=d.getElementById("songAudio");if(sa){var sec=sa.closest(".page"),L=[].slice.call(sec.querySelectorAll(".lyrics li")),cur=-1,ch=d.getElementById("chant"),R=+sec.getAttribute("data-rate")||1,PI=+sec.getAttribute("data-pitch")||1;' +
      'function lk(){if(sa.paused)return;var t=sa.currentTime,k=-1;L.forEach(function(l,j){if(t>=+l.getAttribute("data-t"))k=j});if(k!==cur){cur=k;L.forEach(function(l,j){l.classList.toggle("now",j===k)});' +
      'if(k>=0&&ch.checked&&!L[k].hasAttribute("data-v")){try{speechSynthesis.cancel();var u=new SpeechSynthesisUtterance(L[k].textContent);u.rate=R;u.pitch=PI;speechSynthesis.speak(u)}catch(e){}}}requestAnimationFrame(lk)}' +
      'sa.addEventListener("play",function(){cur=-1;lk()});sa.addEventListener("pause",function(){try{speechSynthesis.cancel()}catch(e){}})}})();';
    return '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; media-src data:; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'">' +
      '<title>' + smEsc(s.title) + ' · a Booyo story</title><style>' + css + '</style></head><body><main>' + pages.join('\n') + '</main>' +
      '<nav aria-label="Pages"><button id="prev" aria-label="Previous page">◀</button><span id="num"></span><button id="next" aria-label="Next page">▶</button>' +
      '<button id="read">🔊 Read to me</button><button id="print">🖨️ Print</button></nav><script>' + js + '</script></body></html>';
  }
  function smJson(s, b64, song) {
    return JSON.stringify({ format: 'booyo-story', version: 1, app: 'Booyo', exported: new Date().toISOString(),
      story: { title: s.title, author: s.author || '', t: s.t, cover: s.cover, picks: s.picks, pages: s.pages },
      song: song ? { style: song.style, lyrics: song.comp.lines.map(function (L) { return L.text; }), sung: song.kidB64 ? { mime: s.song.mime, at: s.song.clipAt, dur: s.song.dur, data: song.kidB64 } : null } : null,
      clip: b64 ? { mime: s.mime, dur: s.dur, data: b64 } : null });
  }
  function smDeliver(f) {
    var file = null, can = false;
    try { file = new File([f.blob], f.name, { type: f.type }); } catch (e) { file = null; }
    try { can = !!(file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) { can = false; }
    if (can) { navigator.share({ files: [file], title: f.title }).catch(function () {}); return; }
    fvDownload(f); toast('Saved ' + f.name);
  }
  function sgExportSong(s) {
    if (!s.song) return Promise.resolve(null);
    var kid = s.song.clip ? { blob: s.song.clip, at: s.song.clipAt || 0 } : null, out = null;
    return sgRender(s, s.song.style, { kid: kid, vol: SG_VOL.medium }).then(function (r) {
      out = r; out.style = s.song.style; return fvB64(r.blob);
    }).then(function (b64) { out.b64 = b64; return kid ? fvB64(kid.blob) : ''; }).then(function (kb) { out.kidB64 = kb; return out; })
      .catch(function (e) { sgLog({ kind: 'render-failed', err: String(e && e.message || e) }); return null; });
  }
  function smExport(s) {
    var song = null;
    toast(s.song ? 'Making the files (rendering the song)…' : 'Making the files…');
    sgExportSong(s).then(function (sg) { song = sg; return s.clip ? fvB64(s.clip) : ''; }).then(function (b64) {
      var base = 'Booyo-story-' + smSafe(s.title) + '-' + todayKey(new Date(s.t));
      var html = { name: base + '.html', type: 'text/html', title: s.title, blob: new Blob([smHtml(s, b64, song)], { type: 'text/html' }) };
      var json = { name: base + '.booyostory', type: 'application/json', title: s.title, blob: new Blob([smJson(s, b64, song)], { type: 'application/json' }) };
      var wav = song ? { name: base + '-song.wav', type: 'audio/wav', title: s.title + ' (song)', blob: song.blob } : null;
      var dlg = fvDialog('📤 Share "' + s.title + '"', [
        h('p', {}, 'Choose a format. Nothing is uploaded: the file is made on this device and you choose where it goes.'),
        h('ul', { class: 'plain' },
          h('li', {}, h('b', {}, 'Storybook (.html): '), 'opens in any web browser, offline, with pictures' + (s.clip ? ', the child\'s voice' : '') + ', "Read to me" and print. ' + fmtBytes(html.blob.size) + '.'),
          h('li', {}, h('b', {}, 'Story file (.booyostory): '), 'the story data as a small file, for keeping a backup. ' + fmtBytes(json.blob.size) + '.'),
          wav ? h('li', {}, h('b', {}, 'Song (.wav): '), 'the ' + sgStyle(song.style).label + ' music' + (s.song.clip ? ' with your child\'s singing' : '') + ' as an audio file. Booyo\'s chanted words are not in the audio file (the built-in voice can\'t be recorded); the storybook shows and chants them. ' + fmtBytes(wav.blob.size) + '.') : null)],
        [{ t: '📖 Storybook (.html)', fn: function (close) { smDeliver(html); close(); } },
         { t: '🗂 Story file', ghost: true, fn: function (close) { smDeliver(json); close(); } },
         { t: '🖨️ Printable view', ghost: true, fn: function (close) { close(); smBookView(s.id); printCard('book'); } }].concat(wav ? [{ t: '🎵 Song (.wav)', ghost: true, fn: function (close) { smDeliver(wav); close(); } }] : []));
      if (dlg) { var bs = dlg.querySelectorAll('.btn-row .pbtn'); if (bs[0]) bs[0].id = 'smExpHtml'; if (bs[1]) bs[1].id = 'smExpJson'; if (bs[2]) bs[2].id = 'smExpPrint'; if (wav && bs[3]) bs[3].id = 'smExpSong'; }
    }).catch(function (e) { toast('Export failed: ' + ((e && e.message) || e)); });
  }

  /* =====================================================================
     v3.2 SING MY STORY: Booyo turns a finished story into a short song.
     All music is generated on the device with the Web Audio API (no samples, no network). Built-in voices
     can't really sing, so Booyo chants each line on the beat. Family recordings (Family Voices → Sing My Story)
     replace the chanting, lined up with the bars.
     ===================================================================== */
  var SG_STYLES = {
    lullaby: { bpm: 66, lineBeats: 4, root: 65, rate: 0.8, pitch: 1.0, mel: 'sine', level: 1,
      rhythms: [[1, 1], [1.5, 0.5], [2], [0.5, 0.5, 1]], legato: 0.95 },
    march: { bpm: 116, lineBeats: 8, root: 60, rate: 0.95, pitch: 1.1, mel: 'triangle', level: 1,
      rhythms: [[1, 1, 1, 1], [1, 0.5, 0.5, 1, 1], [2, 1, 1], [1, 1, 2]], legato: 0.75 },
    silly: { bpm: 138, lineBeats: 8, root: 67, rate: 1.1, pitch: 1.45, mel: 'square', level: 0.85,
      rhythms: [[0.5, 0.5, 0.5, 0.5, 1, 1], [0.5, 0.5, 1, 0.5, 0.5, 1], [1, 0.5, 0.5, 1, 1], [0.5, 0.5, 0.5, 0.5, 2]], legato: 0.5 }
  };
  var SG_VOL = { soft: 0.3, medium: 0.45, loud: 0.65 };
  var SG_SCALE = [0, 2, 4, 5, 7, 9, 11];
  var SG = { cur: null, log: [], micBlocked: false };
  function sgStyle(id) { return D.song.styles.filter(function (s) { return s.id === id; })[0] || D.song.styles[0]; }
  function sgLog(e) { e.t = Date.now(); SG.log.push(e); if (SG.log.length > 200) SG.log.shift(); }

  /* ---------- lyrics: one rhyming couplet per pick + a repeated chorus ---------- */
  function sgName(rec) { return ((rec && rec.author) || smKid() || '').trim(); }
  function sgFill(t, rec) { var k = sgName(rec); return String(t).replace(/\{Kid\}/g, k || 'Our friend').replace(/\{kid\}/g, k || 'our friend'); }
  function sgParts(rec) {
    var S = D.song, p = (rec && rec.picks) || {};
    var w = S.who[p.who] ? p.who : 'cat', pl = S.where[p.where] ? p.where : 'park', a = S.what[p.what] ? p.what : 'treasure', e = S.end[p.end] ? p.end : 'dance';
    var chorus = { id: 'sg_c_' + pl, kind: 'chorus', lines: S.where[pl].slice() };
    return [
      { id: 'sg_w_' + w, kind: 'verse', lines: S.who[w].map(function (l) { return sgFill(l, rec); }), nameDep: w === 'me' && !!sgName(rec) },
      chorus,
      { id: 'sg_a_' + a, kind: 'verse', lines: S.what[a].slice() },
      { id: 'sg_e_' + e, kind: 'verse', lines: S.end[e].slice() },
      chorus,
      { id: 'sg_hooray', kind: 'outro', lines: [S.outro] }
    ];
  }
  function sgLines(rec) {
    var out = [];
    sgParts(rec).forEach(function (pt, pi) { pt.lines.forEach(function (l, li) { out.push({ text: l, part: pi, partId: pt.id, li: li, kind: pt.kind, nameDep: !!pt.nameDep }); }); });
    return out;
  }

  /* ---------- composition: an original nursery-style tune, seeded by the story so it is the same every time ---------- */
  function sgHash(s) { var x = 2166136261; for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
  function sgCompose(rec, styleId) {
    var st = SG_STYLES[styleId] || SG_STYLES.lullaby, lines = sgLines(rec), rnd = seededRand(sgHash(String(rec.id || 'song') + styleId) || 7);
    var beat = 60 / (st.bpm * (TEST && QS.tlsong ? Number(QS.tlsong) : 1)), LB = st.lineBeats, seg = LB / 2, notes = [], bass = [], pads = [], drums = [], deg = 7;
    function nearest(cur, tones) {
      var best = null, bd = 99;
      tones.forEach(function (t) { [t - 7, t, t + 7, t + 14].forEach(function (c) { if (c < 2 || c > 11) return; var d = Math.abs(c - cur) + (c === cur ? 0.6 : 0) + rnd() * 0.5; if (d < bd) { bd = d; best = c; } }); });
      return best === null ? 7 : best;
    }
    function step(cur) {
      var r = rnd();
      if (r < 0.15) return cur;
      var dir = r < 0.57 ? -1 : 1, size = styleId === 'silly' && rnd() < 0.25 ? 2 : 1;
      if (cur >= 10) dir = -1; if (cur <= 3) dir = 1;
      return Math.max(2, Math.min(11, cur + dir * size));
    }
    for (var i = -1; i < lines.length; i++) {
      var L = i < 0 ? null : lines[i], start = (i + 1) * LB;
      var ch = !L ? [0, 4] : L.kind === 'outro' ? [0, 0] : L.li === 0 ? [0, 3] : [4, 0];
      for (var s = 0; s < 2; s++) {
        var c = ch[s], t0 = start + s * seg, tones = [c, c + 2, c + 4];
        // accompaniment
        if (styleId === 'lullaby') {
          bass.push({ t: t0, d: seg, deg: c - 7 });
          tones.forEach(function (tn) { pads.push({ t: t0, d: seg, deg: tn }); });
          if (s === 0) drums.push({ t: t0, k: 'tick' });
        } else if (styleId === 'march') {
          for (var b = 0; b < seg; b++) { bass.push({ t: t0 + b, d: 0.8, deg: (b % 2 ? c + 4 : c) - 7 }); drums.push({ t: t0 + b, k: b % 2 ? 'clap' : 'kick' }); }
        } else {
          for (var q = 0; q < seg * 2; q++) { bass.push({ t: t0 + q / 2, d: 0.35, deg: (q % 2 ? c + 7 : c) - 7 }); drums.push({ t: t0 + q / 2, k: 'hat' }); if (q % 2 === 0) drums.push({ t: t0 + q / 2, k: (q / 2) % 2 ? 'clap' : 'kick' }); }
        }
        if (!L) continue;   // intro bar(s): music only, the words start on the next line
        var pat = L.kind === 'outro' ? (s === 0 ? [seg / 2, seg / 2] : [seg]) : st.rhythms[Math.floor(rnd() * st.rhythms.length)];
        var lastSeg = s === 1 && (L.li === 1 || L.kind === 'outro'), pos = 0;
        for (var k = 0; k < pat.length; k++) {
          deg = k === 0 ? nearest(deg, tones) : step(deg);
          if (lastSeg && k === pat.length - 1) deg = L.kind === 'outro' ? 7 : nearest(deg, [0]);
          notes.push({ t: t0 + pos, d: pat[k], deg: deg });
          pos += pat[k];
        }
      }
    }
    var lineDur = LB * beat;
    return { style: styleId, st: st, beat: beat, lineDur: lineDur, lines: lines, notes: notes, bass: bass, pads: pads, drums: drums,
      lineAt: function (i) { return (i + 1) * lineDur; }, end: (lines.length + 1) * lineDur + beat * 1.5 };
  }

  /* ---------- Web Audio rendering (shared by live playback and the offline export) ---------- */
  function sgHz(root, d) { var o = Math.floor(d / 7), r = ((d % 7) + 7) % 7; return 440 * Math.pow(2, (root + 12 * o + SG_SCALE[r] - 69) / 12); }
  function sgNoise(ctx) {
    if (ctx.__sgNoise) return ctx.__sgNoise;
    var b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate), d = b.getChannelData(0), x = 12345;
    for (var i = 0; i < d.length; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; d[i] = x / 0x3fffffff - 1; }
    ctx.__sgNoise = b; return b;
  }
  function sgChain(ctx, vol) {
    var bus = ctx.createGain(), cmp = ctx.createDynamicsCompressor(), master = ctx.createGain();
    try { cmp.threshold.value = -12; cmp.knee.value = 8; cmp.ratio.value = 8; cmp.attack.value = 0.004; cmp.release.value = 0.2; } catch (e) { /* old browser */ }
    master.gain.value = vol; bus.connect(cmp); cmp.connect(master); master.connect(ctx.destination);
    return { bus: bus, cmp: cmp, master: master };
  }
  function sgTone(ctx, dest, list, type, f, t, dur, vol, att, rel) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + att);
    g.gain.linearRampToValueAtTime(vol * 0.7, t + Math.max(att + 0.01, dur * 0.6));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + rel + 0.05);
    list.push(o);
  }
  function sgDrum(ctx, dest, list, k, t, lvl) {
    if (k === 'kick') {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.55 * lvl, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.25); list.push(o); return;
    }
    if (k === 'tick') { sgTone(ctx, dest, list, 'sine', 1760, t, 0.02, 0.035 * lvl, 0.003, 0.05); return; }
    var n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gg = ctx.createGain(), dur = k === 'hat' ? 0.04 : 0.12;
    n.buffer = sgNoise(ctx);
    f.type = k === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = k === 'hat' ? 7000 : 1500; f.Q.value = 0.8;
    gg.gain.setValueAtTime((k === 'hat' ? 0.07 : 0.28) * lvl, t); gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(gg); gg.connect(dest); n.start(t); n.stop(t + dur + 0.02); list.push(n);
  }
  function sgSchedule(ctx, dest, comp, t0, list) {
    var st = comp.st, B = comp.beat, lvl = st.level;
    var mel = dest;
    if (st.mel === 'square') { mel = ctx.createBiquadFilter(); mel.type = 'lowpass'; mel.frequency.value = 2200; mel.connect(dest); }
    comp.notes.forEach(function (n) {
      sgTone(ctx, mel, list, st.mel, sgHz(st.root, n.deg), t0 + n.t * B, n.d * B * st.legato, (st.mel === 'square' ? 0.09 : 0.2) * lvl, 0.02, st.mel === 'sine' ? 0.35 : 0.12);
    });
    comp.bass.forEach(function (n) { sgTone(ctx, dest, list, st.mel === 'sine' ? 'sine' : 'triangle', sgHz(st.root - 12, n.deg), t0 + n.t * B, n.d * B, 0.2 * lvl, 0.02, 0.1); });
    comp.pads.forEach(function (n) { sgTone(ctx, dest, list, 'triangle', sgHz(st.root - 12, n.deg), t0 + n.t * B, n.d * B, 0.035 * lvl, 0.3, 0.4); });
    comp.drums.forEach(function (d) { sgDrum(ctx, dest, list, d.k, t0 + d.t * B, lvl); });
    // a happy final chord
    var tEnd = t0 + comp.lineAt(comp.lines.length) - B * 0.1;
    [0, 2, 4].forEach(function (x) { sgTone(ctx, dest, list, 'triangle', sgHz(st.root, x), tEnd, B * 1.2, 0.07 * lvl, 0.02, 0.4); });
  }
  /* family recordings for song lines (only when Family Voices is switched on) */
  function sgVocalPlan(rec, comp) {
    var plan = { whole: null, parts: {} };
    if (!settings.fvOn || !FV.ready) return plan;
    var voices = fvActiveVoices(); if (!voices.length) return plan;
    var ctx = { pref: null, voices: voices };
    plan.whole = fvFind('sg_whole', ctx);
    if (plan.whole) return plan;
    sgParts(rec).forEach(function (pt, pi) {
      var f = fvFind(pt.id, ctx);
      if (f && pt.nameDep && f.rec.nm !== normName(sgName(rec))) f = null;   // recorded with another name
      if (f) plan.parts[pi] = f;
    });
    return plan;
  }
  function sgVoiced(plan, L) { return !!(plan.whole || plan.parts[L.part]); }

  /* ---------- offline render to WAV (for export, samples and tests) ---------- */
  function sgWav(buf) {
    var d = buf.getChannelData(0), n = d.length, sr = buf.sampleRate, ab = new ArrayBuffer(44 + n * 2), v = new DataView(ab);
    function w(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (var i = 0; i < n; i++) { var x = Math.max(-1, Math.min(1, d[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
    return new Blob([ab], { type: 'audio/wav' });
  }
  function sgRender(rec, styleId, opts) {
    opts = opts || {};
    var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return Promise.reject(new Error('This browser cannot render audio offline.'));
    var comp = sgCompose(rec, styleId), sr = 22050, lead = 0.05, oc = new OAC(1, Math.ceil((comp.end + 1) * sr), sr);
    var ch = sgChain(oc, opts.vol || SG_VOL.medium), list = [];
    sgSchedule(oc, ch.bus, comp, lead, list);
    function place(blob, at, gain) {
      if (!blob) return Promise.resolve();
      return new Promise(function (ok) { var fr = new FileReader(); fr.onload = function () { ok(fr.result); }; fr.onerror = function () { ok(null); }; fr.readAsArrayBuffer(blob); })
        .then(function (ab) { if (!ab) return; return new Promise(function (ok) { oc.decodeAudioData(ab, ok, function () { ok(null); }); }); })
        .then(function (b) { if (!b) return; var s = oc.createBufferSource(), g = oc.createGain(); g.gain.value = gain; s.buffer = b; s.connect(g); g.connect(ch.bus); s.start(lead + at); });
    }
    var plan = opts.family === false ? { whole: null, parts: {} } : sgVocalPlan(rec, comp), adds = [], voiced = [];
    if (plan.whole) adds.push(place(plan.whole.rec.blob, comp.lineAt(0), 1.6));
    Object.keys(plan.parts).forEach(function (pi) {
      var first = 0; for (var i = 0; i < comp.lines.length; i++) if (comp.lines[i].part === Number(pi)) { first = i; break; }
      adds.push(place(plan.parts[pi].rec.blob, comp.lineAt(first), 1.6));
    });
    comp.lines.forEach(function (L, i) { voiced[i] = sgVoiced(plan, L); });
    var kid = opts.kid || null;
    if (kid && kid.blob) adds.push(place(kid.blob, kid.at || 0, 1.4));
    return Promise.all(adds).then(function () { return oc.startRendering(); }).then(function (buf) {
      var d = buf.getChannelData(0), peak = 0, sum = 0, clip = 0;
      for (var i = 0; i < d.length; i++) { var a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; if (a >= 0.999) clip++; }
      return { blob: sgWav(buf), comp: comp, lead: lead, voiced: voiced, peak: peak, rms: Math.sqrt(sum / d.length), clipped: clip, dur: buf.duration, nodes: list.length };
    });
  }

  /* ---------- live player ---------- */
  function sgSay(text) {
    if (!Speech.ok) return;
    try {
      window.speechSynthesis.cancel();
      var st = SG_STYLES[SG.cur ? SG.cur.style : 'lullaby'], u = new SpeechSynthesisUtterance(String(text).replace(/\bBooyo\b/g, 'Boo-yoh')), v = Speech.voice();
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
      var vp = voiceProf(); u.rate = Math.max(0.6, st.rate + vp.rate - (settings.calm ? 0.12 : 0)); u.pitch = Math.max(0.6, st.pitch + (vp.pitch - 1.05)); u.volume = vp.vol;
      window.speechSynthesis.speak(u);
    } catch (e) { /* no voice */ }
  }
  function sgHalt(save) { var P = SG.cur; if (!P) return; P.stop(save); }
  function sgPlay(rec, styleId, env) {
    sgHalt(false);
    var ctx = Sound.get();
    Sound.resume(); smUnlockAudio();
    var comp = sgCompose(rec, styleId), sty = sgStyle(styleId), parentMode0 = !!env.parent;
    var P = { rec: rec, style: styleId, comp: comp, ctx: ctx, sources: [], paused: false, done: false, line: -1, beatN: -1, claps: 0, onBeat: 0, kid: null,
      plan: sgVocalPlan(rec, comp), recState: 'idle', pausedAt: 0, wall0: 0, started: false };
    SG.cur = P;
    var vol = (SG_VOL[settings.sgVol] || SG_VOL.soft) * (calmish() ? 0.6 : 1);
    P.vol = vol;
    // screen
    var lyr = h('ol', { class: 'sg-lyrics' + (settings.sgLyrics === false ? ' hidden' : ''), id: 'sgLyrics', 'aria-label': 'Song words' });
    comp.lines.forEach(function (L, i) {
      lyr.appendChild(h('li', { class: 'sg-line ' + L.kind, 'data-i': i }, L.text.split(/\s+/).map(function (w) { return h('span', { class: 'sg-w' }, w + ' '); })));
    });
    var beats = h('div', { class: 'sg-beats', 'aria-hidden': 'true' }, [0, 1, 2, 3].map(function () { return h('span', {}); }));
    var clap = h('button', { class: 'sg-ctrl sg-clap', id: 'sgClap', 'aria-label': 'Clap along' }, '👏');
    var pause = h('button', { class: 'sg-ctrl sg-pause', id: 'sgPause', 'aria-label': 'Pause', 'aria-pressed': 'false' }, '⏸');
    var stop = h('button', { class: 'sg-ctrl sg-stop', id: 'sgStop', 'aria-label': 'Stop the song' }, '⏹');
    var micOk = settings.sgSingAlong !== false && !Rec.support() && !SG.micBlocked && !SM.micBlocked;
    var mic = micOk ? h('button', { class: 'sg-ctrl sg-mic', id: 'sgMic', 'aria-label': 'Sing along: hold the button and sing', 'aria-pressed': 'false' }, h('span', { 'aria-hidden': 'true' }, '🎤'), h('b', { class: 'sg-mic-n', 'aria-hidden': 'true' }, '')) : null;
    var head = h('div', { class: 'sg-head' }, h('h2', { class: 'sm-q sg-title' }, '🎵 ' + rec.title), h('p', { class: 'sg-style-l' }, sty.e + ' ' + sty.label));
    var controls = h('div', { class: 'sg-controls', role: 'group', 'aria-label': 'Song controls' }, clap, mic, pause, stop);
    var content = [head, beats, lyr, controls];
    var main = parentMode0 ? sgParentScreen(content, 'sg-play', env.back) : smScreen(content, 'sg-play');
    main.classList.add('sg-screen', 'sg-' + styleId);
    main.style.setProperty('--beat', comp.beat + 's');
    setBubble('🎵');
    G.repeat = null; repeatFn = null; idleStop();
    // audio graph
    if (ctx) {
      P.chain = sgChain(ctx, vol);
      P.t0 = ctx.currentTime + 0.3;
      sgSchedule(ctx, P.chain.bus, comp, P.t0, P.sources);
    }
    P.wall0 = performance.now() + 300;
    var kidOld = rec.song && rec.song.style === styleId && rec.song.clip ? { blob: rec.song.clip, at: rec.song.clipAt || 0 } : null, kidAudio = null, kidStarted = false;
    function now() {
      if (P.paused) return P.pausedAt;
      if (ctx && ctx.state === 'running') return ctx.currentTime - P.t0;
      return (performance.now() - P.wall0) / 1000;   // no audio clock (muted device): keep the words moving
    }
    P.now = now;
    function hlLine(i) {
      Array.prototype.forEach.call(lyr.children, function (li, j) {
        li.classList.toggle('now', j === i); li.classList.toggle('past', j < i);
        if (j === i) li.setAttribute('aria-current', 'true'); else li.removeAttribute('aria-current');
      });
      var cur = lyr.children[i]; if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
    }
    function startLine(i) {
      P.line = i; hlLine(i);
      var L = comp.lines[i]; caption(L.text);
      if (P.plan.whole) { if (i === 0) { fvPlayClip(P.plan.whole.rec, P.plan.whole.voice, function () {}); sgLog({ kind: 'clip', line: 'sg_whole', i: i }); } return; }
      var f = P.plan.parts[L.part];
      if (f) { if (L.li === 0) { fvPlayClip(f.rec, f.voice, function () {}); sgLog({ kind: 'clip', line: L.partId, i: i }); } return; }
      sgSay(L.text); sgLog({ kind: 'tts', i: i, text: L.text });
    }
    function tick() {
      if (SG.cur !== P || P.done) return;
      if (!P.paused && (document.querySelector('.gate-overlay') || document.visibilityState === 'hidden')) doPause();
      var t = now();
      if (!P.paused) {
        var bn = Math.floor(t / comp.beat);
        if (t >= 0 && bn !== P.beatN) {
          P.beatN = bn;
          Array.prototype.forEach.call(beats.children, function (d, j) { d.classList.toggle('on', j === bn % 4); });
          if (!calmish()) { var o = owl(); if (o) { SG.bopSeen = (SG.bopSeen || 0) + 1; o.classList.add('sg-bop'); setTimeout(function () { o.classList.remove('sg-bop'); }, Math.min(180, comp.beat * 400)); } }
        }
        var li = Math.floor(t / comp.lineDur) - 1;
        if (li >= 0 && li < comp.lines.length && li !== P.line) startLine(li);
        if (P.line >= 0) {
          var words = lyr.children[P.line] ? lyr.children[P.line].children : [], into = t - comp.lineAt(P.line), span = comp.lineDur * 0.8;
          for (var k = 0; k < words.length; k++) words[k].classList.toggle('sung', into >= (k / words.length) * span);
        }
        if (kidOld && !kidStarted && P.recState === 'idle' && t >= kidOld.at) {
          kidStarted = true;
          try { kidAudio = new Audio(URL.createObjectURL(kidOld.blob)); kidAudio.volume = 0.9; var pr = kidAudio.play(); if (pr && pr.catch) pr.catch(function () {}); sgLog({ kind: 'kidclip' }); } catch (e) { /* ignore */ }
        }
        if (t >= comp.end) return finish(false);
      }
      P.raf = setTimeout(tick, 40);
    }
    function doPause() {
      if (P.paused || P.done) return;
      P.pausedAt = now(); P.paused = true;
      if (ctx) try { ctx.suspend(); } catch (e) { /* ignore */ }
      try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
      try { fvAudio().pause(); } catch (e) { /* ignore */ }
      if (kidAudio) kidAudio.pause();
      if (P.recState === 'rec') Rec.stop();
      pause.textContent = '▶'; pause.setAttribute('aria-label', 'Keep singing'); pause.setAttribute('aria-pressed', 'true');
      main.classList.add('sg-paused');
    }
    function doResume() {
      if (!P.paused || P.done) return;
      Sound.resume();
      P.wall0 = performance.now() - P.pausedAt * 1000;
      var go = function () { P.paused = false; };
      if (ctx) { var r = ctx.resume(); if (r && r.then) r.then(go, go); else go(); } else go();
      try { var a = fvAudio(); if (a.src && !a.ended && a.currentTime > 0) a.play().catch(function () {}); } catch (e) { /* ignore */ }
      if (kidAudio && !kidAudio.ended) kidAudio.play().catch(function () {});
      pause.textContent = '⏸'; pause.setAttribute('aria-label', 'Pause'); pause.setAttribute('aria-pressed', 'false');
      main.classList.remove('sg-paused');
    }
    P.pause = doPause; P.resume = doResume;
    function teardown() {
      P.done = true; clearTimeout(P.raf);
      if (ctx) {
        if (P.paused) try { ctx.resume(); } catch (e) { /* ignore */ }
        var tt = ctx.currentTime;
        P.sources.forEach(function (s) { try { s.stop(tt); } catch (e) { /* not started */ } });
        if (P.chain) { try { P.chain.master.gain.setTargetAtTime(0, tt, 0.03); } catch (e) { /* ignore */ } var ch = P.chain; setTimeout(function () { try { ch.master.disconnect(); } catch (e) { /* ignore */ } }, 300); }
      }
      try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
      fvStop();
      if (kidAudio) { kidAudio.pause(); try { URL.revokeObjectURL(kidAudio.src); } catch (e) { /* ignore */ } }
      if (P.recState === 'rec' || P.recState === 'starting') Rec.stop();
      Rec.release();
      if (Cap.el) Cap.el.classList.remove('show');
      if (SG.cur === P) SG.cur = null;
    }
    function finish(stopped) {
      if (P.done) return;
      var played = now() > comp.lineAt(1);
      teardown();
      sgLog({ kind: stopped ? 'stopped' : 'finished', style: styleId });
      if (played || P.kid) sgSaveSong(rec, P);
      sgDone(rec, styleId, env, stopped);
    }
    P.stop = function (save) { if (P.done) return; if (save) return finish(true); teardown(); sgLog({ kind: 'halted' }); };
    // controls
    clap.addEventListener('click', function () {
      P.claps++;
      var t = now(), off = Math.abs(t / comp.beat - Math.round(t / comp.beat)) * comp.beat;
      if (off < 0.12) P.onBeat++;
      if (ctx) { var l = []; sgDrum(ctx, P.chain ? P.chain.bus : ctx.destination, l, 'clap', ctx.currentTime, 1.4); }
      sgLog({ kind: 'clap', onBeat: off < 0.12 });
      if (!calmish()) burst(clap);
      clap.classList.remove('clapped'); void clap.offsetWidth; clap.classList.add('clapped');
    });
    pause.addEventListener('click', function () { if (P.paused) doResume(); else doPause(); });
    stop.addEventListener('click', function () { finish(true); });
    if (mic) {
      var downAt = 0, n = mic.querySelector('.sg-mic-n');
      var startRec = function () {
        if (P.recState !== 'idle' || P.paused || P.done) return;
        P.recState = 'starting'; mic.classList.add('starting');
        if (kidAudio) kidAudio.pause();
        Rec.record({
          maxMs: 30000,
          onStart: function () {
            if (P.done) { Rec.stop(); return; }
            P.recState = 'rec'; P.recAt = now(); mic.classList.remove('starting'); mic.classList.add('rec');
            mic.setAttribute('aria-pressed', 'true'); mic.setAttribute('aria-label', 'Recording: let go, or press again, to stop');
            sgLog({ kind: 'rec-start' });
          },
          onTick: function (ms) { n.textContent = String(Math.ceil(ms / 1000)); mic.style.setProperty('--p', (ms / 30000 * 100).toFixed(1) + '%'); }
        }).then(function (res) {
          if (res.dur >= 500 && res.blob.size) { P.kid = { blob: res.blob, mime: res.mime, dur: res.dur, at: Math.max(0, P.recAt || 0) }; sgLog({ kind: 'rec-done', dur: res.dur }); }
          P.recState = 'idle';
          if (!mic.isConnected) return;
          mic.classList.remove('rec', 'starting'); mic.setAttribute('aria-pressed', 'false'); n.textContent = '';
          mic.setAttribute('aria-label', 'Sing along: hold the button and sing');
          if (P.kid) mic.classList.add('has');
        }).catch(function () {
          P.recState = 'idle'; SG.micBlocked = true; SM.micBlocked = true; Rec.release();
          sgLog({ kind: 'mic-denied' });
          if (mic.isConnected) mic.remove();
          setBubble('💖');
        });
      };
      var stopRec = function () { if (P.recState === 'rec') { P.recState = 'stopping'; Rec.stop(); } };
      mic.addEventListener('pointerdown', function (e) { e.preventDefault(); if (P.recState === 'idle') { downAt = Date.now(); startRec(); } });
      mic.addEventListener('pointerup', function () { if (P.recState === 'rec' && Date.now() - downAt > 700) stopRec(); });
      mic.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      mic.addEventListener('click', function (e) {
        if (e.detail === 0) { if (P.recState === 'idle') { downAt = 0; startRec(); } else stopRec(); return; }   // keyboard / switch: press to start, press again to stop
        if (P.recState === 'rec' && Date.now() - downAt > 700) stopRec();
      });
    }
    sgLog({ kind: 'start', style: styleId, nodes: P.sources.length, state: ctx ? ctx.state : 'none' });
    P.raf = setTimeout(tick, 40);
    return P;
  }
  function sgSaveSong(rec, P) {
    var old = rec.song || {}, kid = P.kid || (old.clip && old.style === P.style ? { blob: old.clip, mime: old.mime, dur: old.dur, at: old.clipAt } : null);
    rec.song = { style: P.style, t: Date.now(), claps: P.claps, clip: kid ? kid.blob : null, mime: kid ? kid.mime || '' : '', dur: kid ? kid.dur || 0 : 0, clipAt: kid ? kid.at || 0 : 0 };
    if (!smGet(rec.id)) return;
    smPut(rec).then(function () { sgLog({ kind: 'saved', style: P.style, clip: !!kid }); smRefresh(); })
      .catch(function (e) { SM.err = 'The song could not be saved (' + ((e && (e.name || e.message)) || 'storage') + ').'; });
  }
  function sgParentScreen(content, scr, back) {
    mode = 'parent';
    var main = h('main', { class: 'screen parent sg-parent' },
      h('header', { class: 'phead' }, h('div', {}, h('h1', {}, '🎵 Sing My Story')),
        h('button', { class: 'pbtn ghost', id: 'sgBackShelf', onclick: function () { sgHalt(false); (back || renderParent)(); } }, '⬅ My Stories')),
      h('div', { class: 'gstage' }, h('div', { class: 'gside' }, owlEl('')), h('div', { class: 'gmain' }, content)));
    show(main, scr);
    return main;
  }
  /* style picker: three big picture buttons */
  function songPicker(rec, env) {
    var grid = h('div', { class: 'choices sg-styles c3', role: 'group', 'aria-label': 'How should we sing it?' });
    var hints = { lullaby: 'slow and soft', march: 'steady and clappy', silly: 'fast and silly' };
    D.song.styles.forEach(function (s) {
      var b = h('button', { class: 'choice sg-style', 'data-style': s.id, 'aria-label': s.label + ': ' + hints[s.id] },
        h('span', { class: 'sm-e', 'aria-hidden': 'true' }, s.e), h('span', { class: 'sm-l' }, s.label));
      if (TEST) b.setAttribute('data-ok', '1');
      b.addEventListener('click', function () { Sound.resume(); smUnlockAudio(); sgPlay(rec, s.id, env); });
      grid.appendChild(b);
    });
    var back = h('button', { class: 'bigbtn blue sg-back', id: 'sgBack', 'aria-label': 'Back to my story', onclick: function () { Sound.pop(); env.back(); } }, '📖');
    var head = h('div', { class: 'sm-head' }, h('h2', { class: 'sm-q' }, '🎵 How should we sing it?'));
    var content = [head, h('p', { class: 'sg-for' }, rec.cover + ' ' + rec.title), grid, h('div', { class: 'row sm-row' }, back)];
    if (env.parent) sgParentScreen(content, 'sg-pick', env.back); else smScreen(content, 'sg-pick');
    var prompt = function () { talk(TX('sg_pick'), '🎵'); };
    G.repeat = prompt; repeatFn = prompt;
    prompt();
  }
  function sgDone(rec, styleId, env, stopped) {
    var sty = sgStyle(styleId);
    var again = h('button', { class: 'bigbtn green sg-again', id: 'sgAgain', 'aria-label': 'Sing it again' }, '🔁');
    var other = h('button', { class: 'bigbtn blue sg-other', id: 'sgOther', 'aria-label': 'Pick another song style' }, '🎵');
    var back = h('button', { class: 'bigbtn blue sg-back', id: 'sgBack', 'aria-label': 'Back to my story' }, '📖');
    var content = [h('div', { class: 'announce-pic sg-yay', 'aria-hidden': 'true' }, stopped ? '🎵' : '🎉'), h('h2', { class: 'sm-q' }, stopped ? 'Song stopped' : 'What a song!'),
      h('p', { class: 'sg-for' }, sty.e + ' ' + rec.title), h('div', { class: 'row sm-row' }, again, other, back)];
    if (env.parent) sgParentScreen(content, 'sg-done', env.back); else smScreen(content, 'sg-done');
    again.addEventListener('click', function () { sgPlay(rec, styleId, env); });
    other.addEventListener('click', function () { Sound.pop(); songPicker(rec, env); });
    back.addEventListener('click', function () { Sound.pop(); env.back(); });
    if (!stopped) { if (!calmish()) confetti(); Sound.yay(); if (!env.parent) addStar('stories'); }
    var r = function () { talk(stopped ? TX('sg_again') : TX('sg_done'), stopped ? '🎵' : '🎉'); };
    G.repeat = r; repeatFn = r; r();
  }

  /* =====================================================================
     v3.1 CALM & ACCESSIBLE (all off by default; parent corner panel)
     ===================================================================== */
  function prefersReduced() { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
  function calmish() { return !!settings.calm || prefersReduced(); }
  function speechRate() { var r = Number(settings.speechRate) || 0.85; return settings.calm ? Math.max(0.6, r - 0.15) : r; }
  function idleMs() { return settings.extraTime === 'longer' ? Math.max(T.idle * 2.5, T.idle + 12000 * K) : T.idle; }
  function longIdleMs() { return settings.extraTime === 'longer' ? T.longIdle * 3 : settings.extraTime === 'off' ? Infinity : T.longIdle; }
  function applyA11y() {
    var b = document.body.classList;
    b.toggle('calm', !!settings.calm); b.toggle('reduced', calmish());
    b.toggle('a11y-big', !!settings.bigTargets); b.toggle('a11y-contrast', !!settings.contrast);
    b.toggle('a11y-captions', !!settings.captions); b.toggle('a11y-kbd', !!settings.kbd || !!settings.scan); b.toggle('a11y-scan', !!settings.scan);
    b.toggle('a11y-hold', settings.tapMode === 'hold');
    if (!settings.captions && Cap.el) Cap.el.classList.remove('show');
    scanSync();
  }
  try { window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applyA11y); } catch (e) { /* old browser */ }

  /* captions: everything Booyo says, as text */
  var Cap = { el: null, t: 0 };
  function caption(text) {
    if (!settings.captions || !text) return;
    if (!Cap.el) { Cap.el = h('div', { id: 'captions', role: 'status', 'aria-live': 'polite', 'aria-label': 'Captions' }); document.body.appendChild(Cap.el); }
    Cap.el.textContent = String(text); Cap.el.classList.add('show');
    clearTimeout(Cap.t);
    Cap.t = setTimeout(function () { if (Cap.el) Cap.el.classList.remove('show'); }, (600 + String(text).length * 62) / speechRate() + 2500);
  }

  /* picture schedule: First / Next / Then */
  function scheduleEl(list, idx) {
    if (!settings.schedule || !list || !list.length) return null;
    var labels = ['First', 'Next', 'Then'], wrap = h('ol', { class: 'gschedule', 'aria-label': 'Picture schedule' });
    for (var k = 0; k < 3; k++) {
      var j = idx + k, it = list[j], icon, nm;
      if (it) { icon = GTYPES[it.type].icon; nm = GTYPES[it.type].short; }
      else if (j === list.length) { icon = '🏆'; nm = 'All done'; }
      else break;
      wrap.appendChild(h('li', { class: 'gsched' + (k === 0 ? ' now' : ''), 'aria-current': k === 0 ? 'step' : null, 'aria-label': labels[k] + ': ' + nm },
        h('small', { 'aria-hidden': 'true' }, labels[k]), h('span', { class: 'gsched-ic', 'aria-hidden': 'true' }, icon), h('b', { 'aria-hidden': 'true' }, nm)));
    }
    return wrap;
  }

  /* easier tapping: "forgiving" accepts on touch-down; "hold" needs a ~0.5 s press. Keyboard/switch clicks (detail 0) always pass. */
  var TAP_SEL = '.sg-ctrl:not(.sg-mic), .choice, .count-item, .mem-card, .lc-emoji, .story-art, .play-booyo, .tile, .menu-btn, .letter-tile, .story-cover, .bigbtn, .play-btn, .wake-btn, .skip-btn';
  var Tap = { el: null, t: 0 };
  function tapOn() { return mode === 'kid' && (settings.tapMode === 'touchdown' || settings.tapMode === 'hold'); }
  function tapTarget(e) { var el = e.target && e.target.closest ? e.target.closest(TAP_SEL) : null; return el && app.contains(el) && !el.disabled ? el : null; }
  document.addEventListener('pointerdown', function (e) {
    if (!tapOn() || (e.button && e.button !== 0)) return;
    var el = tapTarget(e); if (!el) return;
    if (settings.tapMode === 'touchdown') { el.click(); return; }
    clearTimeout(Tap.t); if (Tap.el) Tap.el.classList.remove('holding');
    Tap.el = el; el.classList.add('holding');
    Tap.t = setTimeout(function () { if (Tap.el === el) { el.classList.remove('holding'); Tap.el = null; el.click(); } }, TEST && QS.tlhold ? Number(QS.tlhold) : 550);
  }, true);
  ['pointerup', 'pointercancel'].forEach(function (ev) {
    document.addEventListener(ev, function () { if (Tap.el) { Tap.el.classList.remove('holding'); Tap.el = null; clearTimeout(Tap.t); } }, true);
  });
  document.addEventListener('click', function (e) {
    if (!tapOn() || e.detail === 0) return;
    if (tapTarget(e)) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  /* keyboard: arrows move between controls; the keyboard helper focuses the main control on each new screen */
  var KBD_FIRST = ['.play-btn', '.wake-btn', '.sg-style', '.sg-clap', '.sg-again', '.sm-choice:not([disabled])', '.choice:not([disabled])', '.count-item:not(.counted)', '.mem-card:not(.done)', '.lc-emoji', '.sm-mic', '.sm-again', '.play-booyo', '.tile', '.menu-btn', '.letter-tile', '.story-cover', '.story-art', '.bigbtn:not([disabled])'];
  function kbdFocusFirst() {
    if (!settings.kbd || settings.scan || mode !== 'kid' || document.querySelector('.gate-overlay')) return;
    for (var i = 0; i < KBD_FIRST.length; i++) { var el = app.querySelector(KBD_FIRST[i]); if (el && el.offsetParent !== null) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } return; } }
  }
  function kbdAfterShow(el) { if (el && el.classList && el.classList.contains('kid') && settings.kbd && !settings.scan) setTimeout(kbdFocusFirst, 60); }
  function focusables() {
    return Array.prototype.filter.call(app.querySelectorAll('button, [tabindex="0"]'), function (x) { return !x.disabled && x.offsetParent !== null && !x.closest('[aria-hidden="true"]'); });
  }
  document.addEventListener('keydown', function (e) {
    if (mode !== 'kid' || document.querySelector('.gate-overlay, .fv-overlay, .fv-dialog')) return;
    if (settings.scan && (e.key === ' ' || e.key === 'Enter' || e.key === 'Spacebar')) {
      e.preventDefault(); e.stopPropagation();
      if (e.repeat) return;
      var cur = Scan.cur && Scan.cur.isConnected ? Scan.cur : null;
      if (cur) { cur.click(); Scan.cur = null; cur.classList.remove('scan-on'); scanSync(); }
      return;
    }
    if (/^Arrow(Right|Down|Left|Up)$/.test(e.key)) {
      var list = focusables(); if (!list.length) return;
      var i = list.indexOf(document.activeElement), fwd = e.key === 'ArrowRight' || e.key === 'ArrowDown';
      var nx = i < 0 ? (fwd ? 0 : list.length - 1) : (i + (fwd ? 1 : -1) + list.length) % list.length;
      e.preventDefault(); list[nx].focus();
    }
  }, true);
  document.addEventListener('keyup', function (e) { if (settings.scan && mode === 'kid' && (e.key === ' ' || e.key === 'Spacebar')) e.preventDefault(); }, true);

  /* single-switch scanning: highlight each choice in turn */
  var SCAN_SEL = '.sg-ctrl, .sg-btn, .sg-back, .sg-other, .play-btn, .wake-btn, .choice:not([disabled]), .count-item:not(.counted), .mem-card:not(.done):not(.open), .lc-emoji, .story-art, .sm-mic, .skip-btn, .sm-again, .sm-next, .play-booyo, .tile, .menu-btn, .letter-tile, .story-cover, .bigbtn:not([disabled])';
  var Scan = { t: 0, cur: null };
  function scanMs() { return TEST && QS.tlscan ? Number(QS.tlscan) : Math.round((Number(settings.scanSpeed) || 1.5) * 1000); }
  function scanItems() { return Array.prototype.filter.call(app.querySelectorAll(SCAN_SEL), function (el) { return !el.disabled && el.offsetParent !== null; }); }
  function scanMark(el) {
    if (Scan.cur && Scan.cur !== el) Scan.cur.classList.remove('scan-on');
    Scan.cur = el;
    if (el) { el.classList.add('scan-on'); try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ } if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); }
  }
  function scanTick() {
    if (!settings.scan || mode !== 'kid' || document.querySelector('.gate-overlay')) { scanMark(null); return; }
    var items = scanItems(); if (!items.length) { scanMark(null); return; }
    var i = Scan.cur ? items.indexOf(Scan.cur) : -1;
    scanMark(items[(i + 1) % items.length]);
  }
  function scanSync() { clearInterval(Scan.t); if (settings.scan) Scan.t = setInterval(scanTick, scanMs()); else scanMark(null); }

  function a11yCard() {
    var S = settings, c = card('🌙 Calm & Accessible', 'wide a11y-card');
    c.id = 'a11yCard';
    function tog(id, key, label, hint) {
      var cb = h('input', { type: 'checkbox', id: id }); cb.checked = !!S[key];
      cb.addEventListener('change', function () { S[key] = cb.checked; saveSettings(); applyA11y(); toast('Saved ✓'); });
      return h('div', { class: 'a11y-opt' }, h('label', { class: 'toggle' }, cb, h('span', { class: 'toggle-ui' }), h('span', {}, label)), hint ? h('p', { class: 'hint' }, hint) : null);
    }
    function sel(id, key, label, opts, hint) {
      var s = h('select', { id: id });
      opts.forEach(function (o) { var op = h('option', { value: o[0] }, o[1]); if (String(S[key]) === String(o[0])) op.selected = true; s.appendChild(op); });
      s.addEventListener('change', function () { S[key] = typeof opts[0][0] === 'number' ? Number(s.value) : s.value; saveSettings(); applyA11y(); toast('Saved ✓'); });
      return h('div', { class: 'a11y-opt' }, h('label', { class: 'field' }, h('span', {}, label), s), hint ? h('p', { class: 'hint' }, hint) : null);
    }
    c.appendChild(h('p', { class: 'hint' }, 'Everything here is off unless you turn it on. These settings change how Booyo looks, sounds and waits, so more children can play comfortably.'));
    c.appendChild(h('div', { class: 'a11y-grid' },
      tog('a11yCalm', 'calm', '🌙 Calm mode', 'Softer sounds, no confetti or sudden animations, and slower speech. Helpful for kids who like calm, predictable play, including many autistic kids.' +
        (prefersReduced() ? ' This device asks for reduced motion, so animations are already toned down.' : ' If the device is set to reduce motion, Booyo follows that automatically.')),
      tog('a11ySchedule', 'schedule', '🗓️ Picture schedule', 'Shows "First / Next / Then" pictures at the top of guided sessions, so your child can see what is coming next.'),
      sel('a11yExtra', 'extraTime', '⏳ Extra time', [['normal', 'Normal'], ['longer', 'Longer waits'], ['off', 'No reminders']],
        'Normal: Booyo repeats the question after about 8 seconds. Longer waits: about 20 seconds, and the sleepy pause comes much later. No reminders: Booyo waits quietly and never moves on or falls asleep by himself. The daily time limit still ends the session as usual.'),
      tog('a11yBig', 'bigTargets', '👆 Bigger buttons', 'Larger pictures with more space between them.'),
      sel('a11yTap', 'tapMode', '👉 How a tap counts', [['tap', 'Normal tap'], ['touchdown', 'Forgiving touch'], ['hold', 'Press and hold']],
        'Forgiving touch: counts as soon as a finger touches, even if it slides. Press and hold: about half a second (a ring shows), which avoids accidental taps.'),
      tog('a11yContrast', 'contrast', '🔲 High contrast', 'Plain white background, black outlines and bold text.'),
      tog('a11yCaptions', 'captions', '💬 Captions', 'Shows everything Booyo says as large text at the bottom of the screen. Useful for kids who are deaf or hard of hearing, and for grown-ups nearby.'),
      tog('a11yKbd', 'kbd', '⌨️ Keyboard helper', 'Tab or the arrow keys move between pictures, and Enter or Space chooses. Each new screen puts a clear focus ring on the main picture.'),
      tog('a11yScan', 'scan', '🔘 Switch scanning', 'Booyo highlights each choice in turn. Press a switch, Space or Enter to choose the highlighted one.'),
      sel('a11yScanSpeed', 'scanSpeed', 'Scan speed', [[1, 'Fast (1 second each)'], [1.5, 'Medium (1.5 seconds each)'], [2, 'Slow (2 seconds each)'], [3, 'Very slow (3 seconds each)']])));
    c.appendChild(h('p', { class: 'hint' }, 'These options are about comfort and access. Booyo is a learning game, not a therapy or medical tool.'));
    return c;
  }

  /* ---------- boot ---------- */
  ensureUsageToday();
  applyA11y();
  fvLoad();
  smLoad();
  if (!settings.setupDone) parentMode(); else if (settings.guided !== false) guidedStart(); else splash();

  // tiny hook for automated tests (read-only)
  window.__TL = { go: function (s) { stopGuided('switched'); ({ parent: parentMode, home: kidHome, more: kidMore, letters: lettersMenu, explore: lettersExplore, find: findLetterGame, numbers: numberGame, shapes: shapesGame, stories: storyList, memory: memoryGame, brk: showBreak, storymaker: function () { storyMaker(null); } })[s](); },
                  sm: function () { return { ready: SM.ready, err: SM.err, n: SM.stories.length, trimmed: SM.trimmed, micBlocked: SM.micBlocked, last: SM.lastSaved || '',
                    stories: SM.stories.map(function (x) { return { id: x.id, t: x.t, title: x.title, author: x.author, cover: x.cover, picks: x.picks, pages: x.pages.map(function (p) { return p.text; }), clip: !!x.clip, dur: x.dur,
                      song: x.song ? { style: x.song.style, clip: !!x.song.clip, clipAt: x.song.clipAt, claps: x.song.claps } : null }; }) }; },
                  smCover: function (id) { var r = smGet(id) || SM.stories[SM.stories.length - 1]; if (r) { stopGuided('switched'); mode = 'kid'; smCoverScreen(r, { guided: false, done: null, first: false }); } },
                  smFill: function (n) { if (!TEST) return Promise.resolve(0); var c = D.storyMaker, k = 0, ps = [];
                    for (var i = 0; i < n; i++) { var p = { who: c.who[i % c.who.length], where: c.where[i % c.where.length], what: c.what[i % c.what.length], end: c.end[i % c.end.length] };
                      ps.push({ id: 'sfill' + i + '_' + Date.now().toString(36), t: Date.now() - (n - i) * 60000, author: smKid(), title: smTitle(p), cover: p.who.e + p.where.e,
                        picks: { who: p.who.id, where: p.where.id, what: p.what.id, end: p.end.id }, pages: smPages(p).map(function (x) { return { e: x.e, text: x.text }; }), clip: null, mime: '', dur: 0 }); }
                    return ps.reduce(function (pr, r) { return pr.then(function () { k++; return smSave(r); }); }, Promise.resolve()).then(function () { smRefresh(); return k; }); },
                  sg: function () { var P = SG.cur, o = owl(); return { active: !!P, style: P ? P.style : '', state: P && P.ctx ? P.ctx.state : '', sources: P ? P.sources.length : 0,
                      now: P ? P.now() : 0, line: P ? P.line : -1, paused: P ? P.paused : false, claps: P ? P.claps : 0, recState: P ? P.recState : '', kid: !!(P && P.kid),
                      micBlocked: SG.micBlocked, vol: P ? P.vol : 0, lines: P ? P.comp.lines.map(function (L) { return L.text; }) : [], lineDur: P ? P.comp.lineDur : 0, beat: P ? P.comp.beat : 0, end: P ? P.comp.end : 0,
                      owl: o ? o.className : '', bopSeen: SG.bopSeen || 0, log: SG.log.slice(-80) }; },
                  sgLyrics: function (id) { var r = smGet(id) || SM.stories[SM.stories.length - 1]; return r ? sgLines(r).map(function (L) { return L.text; }) : []; },
                  sgRender: function (style, id, withB64) { var r = (id && smGet(id)) || { id: 'sample', title: 'Biscuit on the Moon', author: '', picks: { who: 'biscuit', where: 'moon', what: 'treasure', end: 'dance' } };
                    return sgRender(r, style, { vol: SG_VOL.medium, family: false }).then(function (x) { var o = { peak: x.peak, rms: x.rms, clipped: x.clipped, dur: x.dur, nodes: x.nodes, size: x.blob.size };
                      return withB64 ? fvB64(x.blob).then(function (b) { o.b64 = b; return o; }) : o; }); },
                  a11y: function () { return { calm: !!settings.calm, reduced: calmish(), body: document.body.className, caption: Cap.el && Cap.el.classList.contains('show') ? Cap.el.textContent : '', scan: Scan.cur ? (Scan.cur.getAttribute('aria-label') || Scan.cur.textContent) : '', idleMs: idleMs(), longIdleMs: longIdleMs(), rate: speechRate() }; },
                  story: function (i, p) { readStory(D.stories[i], p || 0); }, letter: function (i) { letterCard(i); },
                  fv: function () { var n = 0; fvVoices.forEach(function (v) { n += fvVoiceClips(v).length; });
                    return { on: !!settings.fvOn, active: settings.fvActive, lessons: settings.fvLessons !== false, ready: FV.ready, err: FV.err, clips: n, mime: Rec.mime(),
                      voices: fvVoices.map(function (v) { return { id: v.id, label: v.label, lang: v.lang, icon: v.icon, n: fvVoiceClips(v).length, lines: Object.keys(FV.clips[v.id] || {}).sort() }; }),
                      badge: (function () { var b = document.querySelector('.fv-badge'); return b ? b.textContent : ''; })(), log: FV.log.slice(-80) }; },
                  lines: function () { return fvMaster().lines.map(function (l) { return { id: l.id, sec: l.sec, text: l.text, piece: !!l.piece, cat: l.cat || '', name: l.id === 'name', disabled: !!l.disabled, nameDep: !!l.nameDep }; }); },
                  groups: function () { var v = fvVoices[0] || { id: '_', label: '', lang: 'en', custom: [] }; return fvGroups(v).map(function (g) { return { id: g.id, title: g.title, n: g.lines.length, ids: g.lines.map(function (l) { return l.id; }) }; }); },
                  lineSample: function (id) { return lnSample(fvMaster().byId[id]); },
                  tx: function (k, vars) { return TX(k, vars); },
                  plan: function (text) { var p = fvPlan(text); return p ? p.map(function (x) { return { line: x.clip ? x.clip.line : '', voice: x.voice ? x.voice.label : '', text: x.text }; }) : null; },
                  fvFake: function (ids) { if (!TEST) return 0; fvTestFake(ids); return Object.keys(FV.clips.vtest || {}).length; },
                  cover: function (texts) { if (!TEST) return null; var keep = FV.clips.vtest, had = fvVoice('vtest'); fvTestFake('*');
                    var out = [].concat(texts).map(function (t) { var p = fvPlan(t); if (!p) return { text: t, missing: [t] };
                      return { text: t, missing: p.filter(function (x) { return !x.clip && /[\p{L}\p{N}]/u.test(x.text); }).map(function (x) { return x.text; }) }; });
                    if (keep) FV.clips.vtest = keep; else fvTestFake(null); if (!had && keep === undefined) fvTestFake(null); return out; },
                  ppage: function (pg) { if (mode !== 'parent') parentMode(); renderParent(pg); return PPAGE; },
                  sayAll: function () { if (!TEST) return null; var DOM = lnDomains(), out = [];   /* every D.say template rendered with 2 sample values per variable */
                    Object.keys(D.say).forEach(function (k) { lnVariants(k).forEach(function (src, vi) { [0, 1].forEach(function (pick) {
                      var vars = { v: vi, n: 3 + pick, a: 2, b: 3, ans: 5 };
                      src.split('|').forEach(function (seg) { lnParse(seg).doms.forEach(function (d) { var L = DOM[d] || []; Object.assign(vars, L[Math.min(pick * 3, L.length - 1)] || {}); }); });
                      out.push([k, TX(k, vars)]); }); }); });
                    return out; },
                  allSaid: function (clear) { if (!TEST) return null; var a = (FV.allSaid || []).slice(); if (clear) FV.allSaid = []; return a; },
                  allTts: function (clear) { if (!TEST) return null; var a = (FV.allTts || []).slice(); if (clear) FV.allTts = []; return a; },
                  ttsLog: function () { return FV.log.filter(function (e) { return e.kind === 'tts'; }).map(function (e) { return e.text; }); },
                  voiceProf: function () { var v = Speech.voice(); return { style: settings.voiceStyle, prof: voiceProf(), voice: v ? v.name : '', uri: settings.voiceURI }; },
                  guided: function () { return { active: G.active, idx: G.idx, len: G.list.length, list: G.list.map(function (t) { return t.type; }),
                    screen: app.getAttribute('data-screen'), sleeping: G.sleeping, idleN: Idle.n, expect: Idle.expect, hand: !!Hand.el, accum: Idle.accum,
                    demoing: !!document.querySelector('main.demoing'), test: TEST, T: T, rec: G.rec, usageSec: usage.seconds }; } };
})();
