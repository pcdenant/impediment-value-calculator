// Tests du calculateur : formules, formats, devises, unités, messages, copie.
// Lancer : node --test tests/
// Zéro dépendance : on exécute le <script> de index.html dans un vm avec un faux DOM minimal.
// ponytail: faux DOM maison (~60 lignes) ; passer à jsdom si le HTML devient dynamique au-delà de ça.
'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var vm = require('node:vm');

var HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
var SCRIPT = HTML.match(/<script>([\s\S]*?)<\/script>/)[1];
var BODY = HTML.slice(HTML.indexOf('<body'));

var NB = ' ';  // espace insécable (avant « : » et dans « »)
var NNB = ' '; // espace fine insécable (séparateur de milliers fr-FR)

function el(tag, attrs) {
  var e = {
    tagName: tag.toUpperCase(), attrs: attrs || {}, children: [], listeners: {},
    style: {}, textContent: '', offsetWidth: 0,
    classes: ((attrs && attrs['class']) || '').split(/\s+/).filter(Boolean),
    setAttribute: function(k, v) { this.attrs[k] = String(v); },
    getAttribute: function(k) { return k in this.attrs ? this.attrs[k] : null; },
    addEventListener: function(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
    click: function() { (this.listeners.click || []).forEach(function(fn) { fn(); }); },
    appendChild: function(c) { this.children.push(c); return c; },
    removeChild: function(c) { this.children.splice(this.children.indexOf(c), 1); },
    select: function() {}
  };
  e.classList = {
    add: function(c) { if (e.classes.indexOf(c) < 0) e.classes.push(c); },
    remove: function(c) { e.classes = e.classes.filter(function(x) { return x !== c; }); },
    contains: function(c) { return e.classes.indexOf(c) >= 0; }
  };
  Object.defineProperty(e, 'className', {
    get: function() { return e.classes.join(' '); },
    set: function(v) { e.classes = String(v).split(/\s+/).filter(Boolean); }
  });
  Object.defineProperty(e, 'innerHTML', { set: function() { e.children = []; } });
  ['min', 'max', 'step', 'value'].forEach(function(k) { if (k in e.attrs) e[k] = e.attrs[k]; });
  return e;
}

// opts.clipboard === false → pas de navigator.clipboard (chemin fallback execCommand)
function load(opts) {
  opts = opts || {};
  var nodes = [], byId = {}, timers = [], copied = [], execs = [];
  BODY.replace(/<(\w+)((?:\s+[\w-]+(?:="[^"]*")?)*)\s*\/?>/g, function(_, tag, raw) {
    var attrs = {};
    raw.replace(/([\w-]+)(?:="([^"]*)")?/g, function(__, k, v) { attrs[k] = v === undefined ? '' : v; });
    var n = el(tag, attrs);
    nodes.push(n);
    if (attrs.id) byId[attrs.id] = n;
  });
  var body = el('body');
  var document = {
    body: body,
    getElementById: function(id) { return byId[id] || null; },
    querySelectorAll: function(sel) {
      var c = sel.replace(/^\./, '');
      return nodes.filter(function(n) { return n.classList.contains(c); });
    },
    createElement: function(tag) { return el(tag); },
    execCommand: function(cmd) { execs.push(cmd); return true; }
  };
  var navigator = opts.clipboard === false ? {} : {
    clipboard: { writeText: function(t) { copied.push(t); return Promise.resolve(); } }
  };
  var ctx = {
    document: document, navigator: navigator,
    setTimeout: function(fn) { timers.push(fn); }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SCRIPT, ctx);
  return {
    ctx: ctx, copied: copied, execs: execs,
    $: function(id) { return byId[id]; },
    text: function(id) { return byId[id].textContent; },
    set: function(id, v) { byId[id].value = String(v); ctx.update(); },
    pill: function(barId, label) {
      var b = byId[barId].children.filter(function(c) { return c.textContent === label; })[0];
      assert.ok(b, 'pill ' + label + ' introuvable dans ' + barId);
      b.click();
    },
    runTimers: function() { timers.splice(0).forEach(function(fn) { fn(); }); }
  };
}

// Durée affichée par fmtDuree, lue via le libellé secondaire du résultat « évité »
function dureeEvite(app) { return app.text('secondary-evite').replace(/ de blocage supplémentaire évité$/, ''); }

// --- 1. Formules cœur ---------------------------------------------------------

test('défauts : coût blocage = 3 pers × 4h × 65 = 780 €', function() {
  var app = load();
  assert.equal(app.text('primary-blocage'), '780 €');
  assert.equal(app.text('secondary-blocage'), '12h de capacité immobilisée');
});

test('défauts : coût évité = 3 pers × 2 jours (16h) × 65 = 3 120 €', function() {
  var app = load();
  assert.equal(app.text('primary-evite'), '3' + NNB + '120 €');
});

test('formules sur une grille de valeurs (pers × heures × coût)', function() {
  [[1, 0.5, 20], [7, 3.5, 88], [20, 8, 200], [12, 6.5, 137]].forEach(function(c) {
    var app = load();
    app.set('r-pers', c[0]); app.set('r-duree', c[1]); app.set('r-cout', c[2]);
    var attendu = Math.round(c[0] * c[1] * c[2]).toLocaleString('fr-FR') + ' €';
    assert.equal(app.text('primary-blocage'), attendu, JSON.stringify(c));
    var evite = Math.round(c[0] * 16 * c[2]).toLocaleString('fr-FR') + ' €';
    assert.equal(app.text('primary-evite'), evite, JSON.stringify(c));
  });
});

test('bornes hautes : 20 pers × 8h × 200 = 32 000 €', function() {
  var app = load();
  app.set('r-pers', 20); app.set('r-duree', 8); app.set('r-cout', 200);
  assert.equal(app.text('primary-blocage'), '32' + NNB + '000 €');
  assert.equal(app.text('secondary-blocage'), '160h de capacité immobilisée');
});

test('arrondi à l\'euro : 3 pers × 7 min × 65 = 22,75 → 23 €', function() {
  var app = load();
  app.pill('pills-duree', 'min');
  app.set('r-duree', 7);
  assert.equal(app.text('primary-blocage'), '23 €');
});

// --- 2. Conversions d'unités (toH) ---------------------------------------------

test('unités de durée : min /60, h ×1, j ×8, sem ×40, mois ×160', function() {
  [['min', 30, 0.5], ['heures', 2, 2], ['jours', 2, 16], ['sem.', 2, 80], ['mois', 2, 320]].forEach(function(c) {
    var app = load();
    app.pill('pills-duree', c[0]);
    app.set('r-duree', c[1]);
    var attendu = Math.round(3 * c[2] * 65).toLocaleString('fr-FR') + ' €';
    assert.equal(app.text('primary-blocage'), attendu, c[0]);
  });
});

test('unités évitées : mêmes conversions sur le coût évité', function() {
  [['min', 30, 0.5], ['heures', 2, 2], ['jours', 2, 16], ['sem.', 2, 80], ['mois', 2, 320]].forEach(function(c) {
    var app = load();
    app.pill('pills-evite', c[0]);
    app.set('r-evite', c[1]);
    var attendu = Math.round(3 * c[2] * 65).toLocaleString('fr-FR') + ' €';
    assert.equal(app.text('primary-evite'), attendu, c[0]);
  });
});

test('changer d\'unité reconfigure le slider et le remet à son min', function() {
  var app = load();
  app.pill('pills-duree', 'min');
  var r = app.$('r-duree');
  assert.deepEqual([+r.min, +r.max, +r.step, +r.value], [1, 60, 1, 1]);
  app.pill('pills-duree', 'mois');
  assert.deepEqual([+r.min, +r.max, +r.step, +r.value], [1, 4, 1, 1]);
});

test('la pill cliquée passe à aria-pressed=true, les autres à false', function() {
  var app = load();
  app.pill('pills-evite', 'sem.');
  var etats = app.$('pills-evite').children.map(function(b) { return b.textContent + ':' + b.getAttribute('aria-pressed'); });
  assert.deepEqual(etats, ['min:false', 'heures:false', 'jours:false', 'sem.:true', 'mois:false']);
});

test('état initial : r-evite a les attributs de l\'unité par défaut (jours)', function() {
  var r = load().$('r-evite');
  assert.deepEqual([r.min, r.max, r.step, r.value].map(Number), [0.5, 7, 0.5, 2]);
});

test('état initial : r-duree a les attributs de l\'unité par défaut (heures)', function() {
  var r = load().$('r-duree');
  assert.deepEqual([r.min, r.max, r.step, r.value].map(Number), [0.5, 8, 0.5, 4]);
});

// --- 3. fmtDuree : chaque seuil ------------------------------------------------

test('fmtDuree : seuils min / h / jours / sem. / mois', function() {
  [
    ['heures', 0.5, '30 min'],
    ['min', 45, '45 min'],
    ['heures', 1, '1h'],
    ['heures', 7.5, '7,5h'],
    ['heures', 8, '1 jour'],
    ['jours', 1, '1 jour'],
    ['jours', 1.5, '1j 4h'],
    ['jours', 2, '2 jours'],
    ['jours', 7, '1 sem. 2j'],
    ['sem.', 1, '1 sem.'],
    ['sem.', 3, '3 sem.'],
    ['sem.', 4, '1 mois'],
    ['mois', 2, '2 mois']
  ].forEach(function(c) {
    var app = load();
    app.pill('pills-evite', c[0]);
    app.set('r-evite', c[1]);
    assert.equal(dureeEvite(app), c[2], c[0] + ' ' + c[1]);
  });
});

// --- 4/5. fmtH et fmt ----------------------------------------------------------

test('fmtH : entier sans décimale, décimale avec virgule', function() {
  var app = load();
  assert.equal(app.text('v-duree'), '4 heures');
  app.set('r-duree', 2.5);
  assert.equal(app.text('v-duree'), '2,5 heures');
  assert.equal(app.text('secondary-blocage'), '7,5h de capacité immobilisée');
});

test('fmt : séparateur de milliers fr-FR (espace fine insécable)', function() {
  var app = load();
  app.set('r-cout', 200); app.set('r-pers', 20); app.set('r-duree', 1);
  assert.equal(app.text('primary-blocage'), '4' + NNB + '000 €');
});

// --- 6. Devises ----------------------------------------------------------------

test('EUR → CAD : défaut 65 → 55, symbole $, aide CAD, aria-pressed', function() {
  var app = load();
  app.ctx.setDevise('cad');
  assert.equal(app.$('r-cout').value, 55);
  assert.equal(app.text('v-cout'), '55 $/h');
  assert.equal(app.text('primary-blocage'), '660 $');
  assert.equal(app.text('chain-blocage'), '3 pers. × 4h × 55 $/h');
  assert.equal(app.text('aide-cout'), 'Salaire brut × 1.3 ÷ 1 800. En doute ? 55 $/h.');
  var btns = app.ctx.document.querySelectorAll('.devise-btn').map(function(b) { return b.getAttribute('data-devise') + ':' + b.getAttribute('aria-pressed'); });
  assert.deepEqual(btns, ['eur:false', 'cad:true']);
});

test('CAD → EUR : 55 non modifié revient à 65', function() {
  var app = load();
  app.ctx.setDevise('cad');
  app.ctx.setDevise('eur');
  assert.equal(app.text('v-cout'), '65 €/h');
  assert.equal(app.text('aide-cout'), 'Salaire brut × 1.4 ÷ 1 600. En doute ? 65 €/h.');
});

test('changer de devise conserve un coût horaire modifié par l\'utilisateur', function() {
  var app = load();
  app.set('r-cout', 80);
  app.ctx.setDevise('cad');
  assert.equal(app.text('v-cout'), '80 $/h');
  assert.equal(app.text('primary-blocage'), '960 $');
});

// --- 7. Messages affichés ------------------------------------------------------

test('messages par défaut', function() {
  var app = load();
  assert.equal(app.text('v-pers'), '3 pers.');
  assert.equal(app.text('v-duree'), '4 heures');
  assert.equal(app.text('v-cout'), '65 €/h');
  assert.equal(app.text('v-evite'), '2 jours');
  assert.equal(app.text('chain-blocage'), '3 pers. × 4h × 65 €/h');
  assert.equal(app.text('chain-evite'), '3 pers. × 2 jours en plus × 65 €/h');
  assert.equal(app.text('secondary-evite'), '2 jours de blocage supplémentaire évité');
  assert.equal(app.text('aide-evite'), 'Sans toi, 3 personnes auraient attendu 2 jours de plus.');
});

// --- 8. Pluriels ---------------------------------------------------------------

test('singulier avec 1 personne', function() {
  var app = load();
  app.set('r-pers', 1);
  assert.equal(app.text('aide-evite'), 'Sans toi, 1 personne aurait attendu 2 jours de plus.');
  assert.match(app.text('copy-phrase'), /1 personne bloquée pendant/);
});

test('pluriel avec 2 personnes', function() {
  var app = load();
  app.set('r-pers', 2);
  assert.equal(app.text('aide-evite'), 'Sans toi, 2 personnes auraient attendu 2 jours de plus.');
  assert.match(app.text('copy-phrase'), /2 personnes bloquées pendant/);
});

// --- 9. Phrases de partage -----------------------------------------------------

var LONGUE =
  'Obstacle résolu cette semaine. 3 personnes bloquées pendant 4h. ' +
  'Coût du blocage' + NB + ': 780 € (12h de capacité immobilisée). ' +
  'Sans intervention, le blocage aurait duré 2 jours de plus. ' +
  'Coût évité estimé' + NB + ': 3' + NNB + '120 €.';

test('phrase longue affichée entre guillemets français', function() {
  assert.equal(load().text('copy-phrase'), '«' + NB + LONGUE + NB + '»');
});

test('copier la phrase longue', async function() {
  var app = load();
  app.ctx.copyText('long');
  await Promise.resolve();
  assert.deepEqual(app.copied, [LONGUE]);
  assert.equal(app.text('btn-long'), 'Copié ✓');
  assert.ok(app.$('btn-long').classList.contains('copy-btn--done'));
  app.runTimers();
  assert.equal(app.text('btn-long'), 'Copier la phrase');
  assert.ok(!app.$('btn-long').classList.contains('copy-btn--done'));
});

test('copier la version courte', async function() {
  var app = load();
  app.ctx.copyText('court');
  await Promise.resolve();
  assert.deepEqual(app.copied, ['Déblocage' + NB + ': 780 € (blocage) + 3' + NNB + '120 € (évité).']);
  app.runTimers();
  assert.equal(app.text('btn-court'), 'Version courte');
});

test('sans navigator.clipboard : fallback execCommand', function() {
  var app = load({ clipboard: false });
  app.ctx.copyText('long');
  assert.deepEqual(app.execs, ['copy']);
  assert.equal(app.text('btn-long'), 'Copié ✓');
  assert.equal(app.ctx.document.body.children.length, 0, 'textarea temporaire retiré');
});

test('capacité immobilisée sous l\'heure : 3 pers × 7 min = 0,35h (pas 0,3h)', function() {
  var app = load();
  app.pill('pills-duree', 'min');
  app.set('r-duree', 7);
  assert.equal(app.text('secondary-blocage'), '0,35h de capacité immobilisée');
});
