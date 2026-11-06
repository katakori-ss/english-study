(() => {
  'use strict';

  const P = window.PACKAGES;
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CIRC = ['①', '②', '③'];

  const ICON_SPEAKER =
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">' +
    '<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/>' +
    '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const ICON_CHEV =
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
    '<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ---------- items (400 sentences) ---------- */
  const ITEMS = [];
  const ITEM_BY_KEY = {};
  P.forEach((p) => {
    const add = (kind, i) => {
      const it = {
        key: itemKey(p, kind, i), p, kind, i,
        plain: plainTextFor(p, kind, i),
        label: kind === 'pkg' ? String(p.n) : p.n + CIRC[i],
      };
      ITEMS.push(it);
      ITEM_BY_KEY[it.key] = it;
    };
    add('pkg', 0);
    p.ex.forEach((_, i) => add('ex', i));
  });

  /* ---------- saved edits (localStorage) ---------- */
  const LS_KEY = 'pkgapp-v1';
  // rules[id] = { spelled?, done?, off? } / items[key] = { text?, done? }
  let state = { rules: {}, items: {} };
  let saveWarned = false;
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY));
    if (s && typeof s === 'object') {
      state = { rules: s.rules || {}, items: s.items || {} };
      if (s.voice && s.voice.uri) state.voice = s.voice;   // { uri, name }
    }
  } catch (e) {
    /* storage unavailable or broken: start empty */
  }

  function saveState() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (e) {
      if (!saveWarned) {
        saveWarned = true;
        toast('この端末では保存できません（プライベートブラウズなど）');
      }
    }
  }
  function prune(bucket, key) {
    const e = state[bucket][key];
    if (e && Object.keys(e).length === 0) delete state[bucket][key];
  }

  /* ---------- rules / spoken text ---------- */
  let rulesCache = null;
  function getRules() {
    if (!rulesCache) {
      rulesCache = SPEAK_RULES.map((r) => {
        const e = state.rules[r.id] || {};
        return {
          id: r.id, phrase: r.phrase,
          spelled: e.spelled !== undefined ? e.spelled : r.spelled,
          baseConfirmed: r.status === 'confirmed',
          confirmed: r.status === 'confirmed' || !!e.done,
          off: !!e.off,
          skipIfFollowedBy: r.skipIfFollowedBy,
          def: r,
        };
      });
    }
    return rulesCache;
  }
  const invalidateRules = () => (rulesCache = null);

  // Spoken text without the manual edit (OVERRIDES, then rules).
  function autoInfo(it) {
    if (Object.prototype.hasOwnProperty.call(OVERRIDES, it.key)) {
      return { text: OVERRIDES[it.key], source: 'override', hits: [] };
    }
    const r = applyRules(it.plain, getRules());
    return { text: r.text, source: r.hits.length ? 'rules' : 'none', hits: r.hits.map((h) => h.id) };
  }
  function spokenInfo(it) {
    const e = state.items[it.key];
    if (e && typeof e.text === 'string') return { text: e.text, source: 'manual', hits: [] };
    return autoInfo(it);
  }
  const hasManual = (it) => !!(state.items[it.key] && typeof state.items[it.key].text === 'string');
  const isDone = (it) => !!(state.items[it.key] && state.items[it.key].done);

  function setItemText(it, value) {
    const e = state.items[it.key] || (state.items[it.key] = {});
    if (value === autoInfo(it).text) delete e.text;
    else e.text = value;
    prune('items', it.key);
    saveState();
  }
  function toggleItemDone(it) {
    const e = state.items[it.key] || (state.items[it.key] = {});
    if (e.done) delete e.done;
    else e.done = true;
    prune('items', it.key);
    saveState();
  }

  function srcLabel(info) {
    if (info.source === 'manual') return '手動で編集済み';
    if (info.source === 'override') return 'speak.js の個別指定';
    if (info.source === 'none') return '規則なし（元の英文のまま）';
    const byId = {};
    getRules().forEach((r) => (byId[r.id] = r));
    return '規則: ' + info.hits.map((id) => byId[id].phrase + (byId[id].confirmed ? '' : '（案）')).join('、');
  }

  /* ---------- speech ---------- */
  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  let voice = null;
  let playingBtn = null;

  // Preferred voice name for the automatic choice (first match wins). null = only Premium > Enhanced > others.
  const PREFERRED_VOICE = /^Samantha/i;
  const tier = (v) => (/premium/i.test(v.name) ? 0 : /enhanced/i.test(v.name) ? 1 : 2);
  const autoRank = (v) => (PREFERRED_VOICE && PREFERRED_VOICE.test(v.name) ? 0 : 3) + tier(v);
  const langOf = (v) => String(v.lang || '').replace('_', '-');
  const isUS = (v) => /^en-US$/i.test(langOf(v));
  const voiceKey = (v) => v.voiceURI || v.name;
  let voiceMode = 'auto'; // 'manual' | 'auto' | 'missing' (saved voice no longer offered)

  const englishVoices = () => (synth ? synth.getVoices().filter((v) => /^en/i.test(langOf(v))) : []);

  function autoVoice() {
    const list = englishVoices().filter(isUS);
    list.sort((a, b) => autoRank(a) - autoRank(b));
    return list[0] || null;
  }

  function pickVoice() {
    if (state.voice) {
      const all = englishVoices();
      const v = all.find((x) => voiceKey(x) === state.voice.uri) || all.find((x) => x.name === state.voice.name);
      return v ? { voice: v, mode: 'manual' } : { voice: autoVoice(), mode: 'missing' };
    }
    return { voice: autoVoice(), mode: 'auto' };
  }

  function renderVoiceSettings() {
    const sel = $('voiceSelect');
    const note = $('voiceNote');
    if (!sel) return;
    if (!synth) {
      sel.innerHTML = '';
      sel.disabled = true;
      note.textContent = 'このブラウザは読み上げに対応していません。';
      return;
    }
    const list = englishVoices().sort(
      (a, b) => Number(isUS(b)) - Number(isUS(a)) || tier(a) - tier(b) || a.name.localeCompare(b.name)
    );
    const auto = autoVoice();
    sel.innerHTML =
      `<option value="">自動（${auto ? esc(auto.name) : '端末の標準'}）</option>` +
      list.map((v) => `<option value="${esc(voiceKey(v))}">${esc(v.name)} · ${esc(langOf(v))}</option>`).join('');
    sel.disabled = list.length === 0;
    sel.value = voiceMode === 'manual' && voice ? voiceKey(voice) : '';
    note.textContent =
      list.length === 0
        ? '声の一覧を取得できていません。ページを再読み込みしてください。'
        : `Safariが使える英語の声: ${list.length}件` +
          (voiceMode === 'missing' ? `。選んでいた声（${state.voice.name}）が見つからないため、自動で選んでいます。` : '');
  }

  function refreshVoice() {
    const info = $('voiceInfo');
    if (!synth) {
      info.textContent = 'このブラウザは読み上げに対応していません。';
      renderVoiceSettings();
      return;
    }
    const r = pickVoice();
    voice = r.voice;
    voiceMode = r.mode;
    const change = ' <a class="inline-link" href="#/rules">変更</a>';
    info.innerHTML = voice
      ? '読み上げの声: ' + esc(voice.name) + '（' + (r.mode === 'manual' ? '手動で選択' : '自動') + '）' + change
      : '読み上げの声: 端末の標準（英語（米国）の声が見つかりません）' + change;
    renderVoiceSettings();
  }

  function clearPlaying() {
    if (playingBtn) playingBtn.classList.remove('playing');
    playingBtn = null;
  }

  // Must be called directly from a tap handler (iOS Safari requirement).
  function speak(text, btn) {
    if (!synth) {
      toast('このブラウザは読み上げに対応していません');
      return;
    }
    if (btn && btn === playingBtn && (synth.speaking || synth.pending)) {
      synth.cancel();
      clearPlaying();
      return;
    }
    if (synth.speaking || synth.pending) synth.cancel();
    clearPlaying();

    const u = new SpeechSynthesisUtterance(text);
    u.lang = voice ? langOf(voice) : 'en-US';
    if (voice) u.voice = voice;
    u.onstart = () => {
      if (btn) {
        btn.classList.add('playing');
        playingBtn = btn;
      }
    };
    const done = () => {
      if (btn) btn.classList.remove('playing');
      if (playingBtn === btn) playingBtn = null;
    };
    u.onend = done;
    u.onerror = done;
    synth.speak(u);
  }

  let toastTimer = null;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 3500);
  }

  /* ---------- list ---------- */
  function renderList() {
    $('list').innerHTML = P.map(
      (p) =>
        `<li><a class="row" href="#/p/${p.n}">` +
        `<span class="no">${String(p.n).padStart(3, '0')}</span>` +
        `<span><span class="pkg">${esc(p.pkg)}</span><span class="mean">${esc(p.mean)}</span></span>` +
        `<span class="chev">${ICON_CHEV}</span></a></li>`
    ).join('');
  }
  function updateProgress() {
    const n = ITEMS.filter(isDone).length;
    $('progress').textContent = `つなげ読みの確定: ${n} / ${ITEMS.length} 文`;
  }

  /* ---------- detail ---------- */
  function editorHtml(it, extra = '') {
    const info = spokenInfo(it);
    const done = isDone(it);
    return (
      `<div class="edit" data-key="${it.key}">` +
      `<label class="edit-label" for="in-${it.key}">つなげ読みの綴り</label>` +
      `<textarea id="in-${it.key}" class="edit-input" rows="1" ` +
      `autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done">${esc(info.text)}</textarea>` +
      `<div class="edit-meta"><span class="edit-src">${esc(srcLabel(info))}</span>` +
      `<span class="edit-actions">` +
      `<button type="button" class="chip" data-act="item-reset"${hasManual(it) ? '' : ' hidden'}>戻す</button>` +
      `<button type="button" class="chip${done ? ' on' : ''}" data-act="item-done" aria-pressed="${done}">${done ? '確定済み' : '確定'}</button>` +
      `</span></div>${extra}</div>`
    );
  }

  function playButtons(it, labelPlain, labelLinked, cls) {
    return (
      `<button class="${cls.plain}" type="button" data-key="${it.key}" data-mode="plain">${ICON_SPEAKER}${labelPlain}</button>` +
      `<button class="${cls.linked}" type="button" data-key="${it.key}" data-mode="linked">${ICON_SPEAKER}${labelLinked}</button>`
    );
  }

  function renderDetail(p) {
    const pkgItem = ITEM_BY_KEY[itemKey(p, 'pkg', 0)];
    const examples = p.ex
      .map((x, i) => {
        const it = ITEM_BY_KEY[itemKey(p, 'ex', i)];
        return (
          `<li><div class="ex-head"><div class="ex-body">` +
          `<p class="ex-en">${esc(x.en)}</p>` +
          `<p class="ex-ja">${esc(x.ja)}</p>` +
          `<p class="kata">${esc(x.kata)}</p>` +
          editorHtml(it) +
          `</div>` +
          `<div class="play-pair">` +
          playButtons(it, '通常', 'つなげ', { plain: 'pill', linked: 'pill linked' }) +
          `</div></div></li>`
        );
      })
      .join('');

    $('detailView').innerHTML =
      `<section class="hero">` +
      `<span class="no meta"><span>${String(p.n).padStart(3, '0')}</span><span>レベル${p.level}</span></span>` +
      `<h2 class="hero-pkg">${esc(p.pkg)}</h2>` +
      `<p class="hero-mean">${esc(p.mean)}</p>` +
      `<p class="kata">${esc(p.kata)}</p>` +
      editorHtml(
        pkgItem,
        `<button type="button" class="btn apply" data-act="apply-examples">例文1〜3に適用</button>` +
          `<p class="apply-hint">上の綴りを、3つの例文の同じ語句に反映します（例文側は手動編集の扱いになります）。</p>`
      ) +
      `<div class="actions">` +
      playButtons(pkgItem, '通常で聞く', 'つなげ読みで聞く', { plain: 'btn', linked: 'btn primary' }) +
      `<a class="btn" href="${esc(p.yg)}" target="_blank" rel="noopener noreferrer">YouGlishで発音を確認</a>` +
      `</div></section>` +
      (p.note ? `<div class="note"><b>解説</b>${esc(p.note)}</div>` : '') +
      `<h3 class="sec-title">例文</h3>` +
      `<ol class="ex">${examples}</ol>`;
  }

  // Grow the textarea to fit its text (so long sentences are fully visible).
  function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + (el.offsetHeight - el.clientHeight) + 'px';
  }

  function refreshEdit(editEl, it) {
    editEl.querySelector('.edit-src').textContent = srcLabel(spokenInfo(it));
    editEl.querySelector('[data-act="item-reset"]').hidden = !hasManual(it);
  }

  /* ---------- apply the package spelling to examples 1-3 ---------- */
  const trimPunct = (s) => s.replace(/^[\s,?!.]+|[\s,?!.]+$/g, '');
  const stripTail = (t) => t.replace(/[,?!.]+$/, '');

  // When the whole package phrase is not found in an example (e.g. "I was going to ~, but ~"),
  // use only the part that was actually changed (widened to at least 2 words for safety).
  function diffSpan(plain, edited) {
    const A = trimPunct(plain).split(/\s+/);
    const B = trimPunct(edited).split(/\s+/);
    const same = (x, y) => stripTail(x).toLowerCase() === stripTail(y).toLowerCase();
    let i = 0;
    while (i < A.length && i < B.length && same(A[i], B[i])) i++;
    let ja = A.length;
    let jb = B.length;
    while (ja > i && jb > i && same(A[ja - 1], B[jb - 1])) {
      ja--;
      jb--;
    }
    if (ja - i < 2) {
      if (i > 0) i--;
      else if (ja < A.length) {
        ja++;
        jb++;
      }
    }
    const oldT = A.slice(i, ja).map(stripTail).join(' ');
    const newT = B.slice(i, jb).map(stripTail).join(' ');
    return oldT && newT ? { old: oldT, new: newT } : null;
  }

  function applyToExamples(p) {
    const pkgIt = ITEM_BY_KEY[itemKey(p, 'pkg', 0)];
    const oldPhrase = trimPunct(pkgIt.plain);
    const newPhrase = trimPunct(spokenInfo(pkgIt).text);
    if (!newPhrase || oldPhrase.toLowerCase() === newPhrase.toLowerCase()) {
      toast('パッケージの綴りが元の英文と同じです。綴りを直してから押してください');
      return;
    }
    const span = diffSpan(oldPhrase, newPhrase);
    const rules = getRules();
    const plan = p.ex.map((_, i) => {
      const it = ITEM_BY_KEY[itemKey(p, 'ex', i)];
      let r = applyPhraseEdit(it.plain, oldPhrase, newPhrase, rules);
      if (!r.count && span) r = applyPhraseEdit(it.plain, span.old, span.new, rules);
      return { it, i, r };
    });
    const targets = plan.filter((x) => x.r.count);
    const skipped = plan.filter((x) => !x.r.count).map((x) => '例文' + (x.i + 1));
    if (!targets.length) {
      toast('例文の中に、対応する語句が見つかりませんでした');
      return;
    }
    if (targets.some((x) => hasManual(x.it)) && !confirm('手動で編集した例文があります。上書きして適用しますか？')) return;

    targets.forEach(({ it, r }) => {
      setItemText(it, r.text);
      const editEl = detailView.querySelector(`.edit[data-key="${it.key}"]`);
      if (editEl) {
        const field = editEl.querySelector('.edit-input');
        field.value = spokenInfo(it).text;
        autoGrow(field);
        refreshEdit(editEl, it);
      }
    });
    toast(
      '例文' + targets.map((x) => x.i + 1).join('・') + 'に適用しました' +
        (skipped.length ? `（${skipped.join('・')}は語句が見つからず未適用）` : '')
    );
  }

  const detailView = $('detailView');

  detailView.addEventListener('input', (e) => {
    const input = e.target.closest('.edit-input');
    if (!input) return;
    const editEl = input.closest('.edit');
    const it = ITEM_BY_KEY[editEl.dataset.key];
    if (input.value.trim() === '') {
      // Cleared: fall back to the automatic text until the field is left.
      const e2 = state.items[it.key];
      if (e2) delete e2.text;
      prune('items', it.key);
      saveState();
    } else {
      setItemText(it, input.value);
    }
    refreshEdit(editEl, it);
    autoGrow(input);
  });

  detailView.addEventListener('focusout', (e) => {
    const input = e.target.closest('.edit-input');
    if (!input) return;
    const it = ITEM_BY_KEY[input.closest('.edit').dataset.key];
    if (input.value.trim() === '') {
      input.value = spokenInfo(it).text;
      autoGrow(input);
    }
  });

  // Enter closes the keyboard instead of inserting a line break.
  detailView.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.closest('.edit-input')) {
      e.preventDefault();
      e.target.blur();
    }
  });

  detailView.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    // play buttons
    if (btn.dataset.mode) {
      const it = ITEM_BY_KEY[btn.dataset.key];
      speak(btn.dataset.mode === 'plain' ? it.plain : spokenInfo(it).text, btn);
      return;
    }
    // editor chips
    const editEl = btn.closest('.edit');
    if (!editEl) return;
    const it = ITEM_BY_KEY[editEl.dataset.key];
    if (btn.dataset.act === 'apply-examples') {
      applyToExamples(it.p);
    } else if (btn.dataset.act === 'item-done') {
      toggleItemDone(it);
      const done = isDone(it);
      btn.classList.toggle('on', done);
      btn.textContent = done ? '確定済み' : '確定';
      btn.setAttribute('aria-pressed', String(done));
    } else if (btn.dataset.act === 'item-reset') {
      const e2 = state.items[it.key];
      if (e2) delete e2.text;
      prune('items', it.key);
      saveState();
      const field = editEl.querySelector('.edit-input');
      field.value = spokenInfo(it).text;
      autoGrow(field);
      refreshEdit(editEl, it);
    }
  });

  /* ---------- rules screen ---------- */
  function renderRules() {
    renderVoiceSettings();
    const openIds = new Set(
      Array.from(document.querySelectorAll('#rulesList details[open]')).map((d) => d.dataset.id)
    );
    const rules = getRules();
    const hitsByRule = {};
    rules.forEach((r) => (hitsByRule[r.id] = []));
    ITEMS.forEach((it) => applyRules(it.plain, rules).hits.forEach((h) => hitsByRule[h.id].push(it)));
    rules.forEach((r) => {
      if (r.off) hitsByRule[r.id] = ITEMS.filter((it) => findMatches(it.plain, r).length > 0);
    });

    $('rulesList').innerHTML = rules
      .map((r) => {
        const e = state.rules[r.id] || {};
        const items = hitsByRule[r.id];
        const edited = e.spelled !== undefined;
        const tag = r.confirmed
          ? `<span class="tag confirmed">確定</span>`
          : `<span class="tag cand">案</span>`;
        const rows = items
          .map((it) => {
            const info = spokenInfo(it);
            return (
              `<div class="hit"><a class="hit-key" href="#/p/${it.p.n}">${it.label}</a>` +
              `<div class="hit-body"><div class="hit-plain">${esc(it.plain)}</div>` +
              `<div class="hit-text" data-key="${it.key}">${esc(info.text)}</div></div>` +
              `<button type="button" class="mini" data-act="play" data-key="${it.key}" aria-label="${it.label}を聞く">${ICON_SPEAKER}</button></div>`
            );
          })
          .join('');
        return (
          `<li class="rule${r.off ? ' is-off' : ''}" data-id="${r.id}">` +
          `<div class="rule-head"><span class="rule-phrase">${esc(r.phrase)}</span><span class="rule-arrow">→</span>` +
          `<input class="rule-input" type="text" value="${esc(r.spelled)}" aria-label="「${esc(r.phrase)}」の綴り" ` +
          `autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"></div>` +
          `<div class="rule-meta">${tag}` +
          (r.off ? `<span class="tag off">使わない</span>` : '') +
          `<span>${items.length}文${r.off ? '（無効中の該当）' : 'に適用'}</span>` +
          `<span class="rule-kata">Excelの読み: ${esc(r.def.kata || '')}</span></div>` +
          (r.def.note ? `<p class="rule-note">${esc(r.def.note)}</p>` : '') +
          `<div class="rule-actions">` +
          `<button type="button" class="chip" data-act="rule-reset"${edited ? '' : ' hidden'}>綴りを戻す</button>` +
          `<button type="button" class="chip" data-act="rule-off">${r.off ? '使う' : '使わない'}</button>` +
          (r.baseConfirmed
            ? ''
            : `<button type="button" class="chip${e.done ? ' on' : ''}" data-act="rule-done" aria-pressed="${!!e.done}">${e.done ? '確定済み' : '確定にする'}</button>`) +
          `</div>` +
          `<details data-id="${r.id}"${openIds.has(r.id) ? ' open' : ''}><summary>該当する文を表示（${items.length}）</summary>${rows}</details>` +
          `</li>`
        );
      })
      .join('');
  }

  function refreshHitTexts() {
    document.querySelectorAll('#rulesList .hit-text').forEach((el) => {
      el.textContent = spokenInfo(ITEM_BY_KEY[el.dataset.key]).text;
    });
  }

  const rulesView = $('rulesView');

  rulesView.addEventListener('input', (e) => {
    const input = e.target.closest('.rule-input');
    if (!input) return;
    const card = input.closest('.rule');
    const id = card.dataset.id;
    const def = SPEAK_RULES.find((r) => r.id === id);
    const v = input.value.trim();
    const entry = state.rules[id] || (state.rules[id] = {});
    if (v === '' || v === def.spelled) delete entry.spelled;
    else entry.spelled = v;
    prune('rules', id);
    saveState();
    invalidateRules();
    card.querySelector('[data-act="rule-reset"]').hidden = entry.spelled === undefined;
    refreshHitTexts();
  });

  rulesView.addEventListener('focusout', (e) => {
    const input = e.target.closest('.rule-input');
    if (!input || input.value.trim() !== '') return;
    const id = input.closest('.rule').dataset.id;
    input.value = getRules().find((r) => r.id === id).spelled;
  });

  rulesView.addEventListener('change', (e) => {
    if (e.target.id !== 'voiceSelect') return;
    const key = e.target.value;
    if (!key) delete state.voice;
    else {
      const v = englishVoices().find((x) => voiceKey(x) === key);
      if (v) state.voice = { uri: voiceKey(v), name: v.name };
    }
    saveState();
    refreshVoice();
  });

  rulesView.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === 'voice-preview') {
      const it = ITEM_BY_KEY.p2e2;
      speak(btn.dataset.mode === 'plain' ? it.plain : spokenInfo(it).text, btn);
      return;
    }

    if (act === 'play') {
      speak(spokenInfo(ITEM_BY_KEY[btn.dataset.key]).text, btn);
      return;
    }
    if (act === 'export') return exportState();
    if (act === 'reset-all') {
      if (!confirm('規則の編集・文ごとの編集・確定の印を、すべて初期状態に戻します。よろしいですか？')) return;
      const keepVoice = state.voice;
      state = { rules: {}, items: {} };
      if (keepVoice) state.voice = keepVoice;
      saveState();
      invalidateRules();
      renderRules();
      toast('初期状態に戻しました');
      return;
    }

    const card = btn.closest('.rule');
    if (!card) return;
    const id = card.dataset.id;
    const entry = state.rules[id] || (state.rules[id] = {});
    if (act === 'rule-reset') delete entry.spelled;
    else if (act === 'rule-off') entry.off ? delete entry.off : (entry.off = true);
    else if (act === 'rule-done') entry.done ? delete entry.done : (entry.done = true);
    prune('rules', id);
    saveState();
    invalidateRules();
    const y = window.scrollY;
    renderRules();
    window.scrollTo(0, y);
  });

  /* ---------- export ---------- */
  function buildExport() {
    const rules = SPEAK_RULES.map((r) => {
      const e = state.rules[r.id] || {};
      return {
        id: r.id,
        phrase: r.phrase,
        spelled: e.spelled !== undefined ? e.spelled : r.spelled,
        status: r.status === 'confirmed' || e.done ? '確定' : '案',
        off: !!e.off,
        editedFromDefault: e.spelled !== undefined,
      };
    });
    const manual = {};
    const doneItems = [];
    Object.keys(state.items).forEach((k) => {
      if (typeof state.items[k].text === 'string') manual[k] = state.items[k].text;
      if (state.items[k].done) doneItems.push(k);
    });
    return JSON.stringify(
      { exportedAt: new Date().toISOString(), voice: state.voice ? state.voice.name : null, rules, manual, doneItems },
      null,
      1
    );
  }

  async function exportState() {
    const text = buildExport();
    const ta = $('exportText');
    ta.value = text;
    $('exportBox').open = true;
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch (e) {
      try {
        ta.focus();
        ta.select();
        ok = document.execCommand('copy');
      } catch (e2) {
        ok = false;
      }
    }
    toast(ok ? 'コピーしました' : 'コピーできませんでした。下の欄を長押ししてコピーしてください');
  }

  /* ---------- routing ---------- */
  let listScroll = 0;
  const VIEWS = ['list', 'detail', 'rules'];

  $('list').addEventListener('click', () => (listScroll = window.scrollY));
  $('toRules').addEventListener('click', () => (listScroll = window.scrollY));
  $('voiceInfo').addEventListener('click', () => (listScroll = window.scrollY));

  function show(name) {
    VIEWS.forEach((v) => {
      $(v + 'View').hidden = v !== name;
      $('bar' + v[0].toUpperCase() + v.slice(1)).hidden = v !== name;
    });
  }

  function setNav(id, n) {
    const a = $(id);
    if (n >= 1 && n <= P.length) {
      a.href = '#/p/' + n;
      a.removeAttribute('aria-disabled');
    } else {
      a.href = '#/';
      a.setAttribute('aria-disabled', 'true');
    }
  }

  function route() {
    if (synth) synth.cancel();
    clearPlaying();

    const m = location.hash.match(/^#\/p\/(\d+)$/);
    const p = m ? P[Number(m[1]) - 1] : null;

    if (p) {
      renderDetail(p);
      setNav('prev', p.n - 1);
      setNav('next', p.n + 1);
      show('detail');
      detailView.querySelectorAll('.edit-input').forEach(autoGrow);
      document.title = `${String(p.n).padStart(3, '0')} ${p.pkg} | 音のパッケージ100`;
      window.scrollTo(0, 0);
    } else if (location.hash === '#/rules') {
      renderRules();
      show('rules');
      document.title = 'つなげ読みの規則 | 音のパッケージ100';
      window.scrollTo(0, 0);
    } else {
      updateProgress();
      show('list');
      document.title = '音のパッケージ100';
      window.scrollTo(0, listScroll);
    }
  }

  /* ---------- init ---------- */
  renderList();
  refreshVoice();
  if (synth) synth.onvoiceschanged = refreshVoice;
  window.addEventListener('hashchange', route);
  route();

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
