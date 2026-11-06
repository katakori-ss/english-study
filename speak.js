// つなげ読み（読み上げ用の綴り）の定義ファイル。
// 画面に表示する英文はそのまま、「つなげ」ボタンで読み上げるときだけ綴りを置き換える。
//
// 優先順位（高い順）:
//   1. アプリ内で手動編集した文（iPhone内に保存）
//   2. OVERRIDES（文ごとの個別指定）
//   3. SPEAK_RULES（語句ごとの規則）
//
// status: 'confirmed' = 耳で確認済み / 'candidate' = 案（未確認）。アプリ内で「確定」にもできる。

const SPEAK_VERSION = '2026-11-06.2';  // app.js・index.html と同じ版でなければ、画面に警告が出る

const SPEAK_RULES = [
  // ---- 耳で確認済み ----
  { id: 'have-to', phrase: 'have to', spelled: 'hafta', status: 'confirmed', kata: 'ハフタ', note: '本人が聞いて「ハフタになる」と確認。' },
  { id: 'pick-up', phrase: 'pick up', spelled: 'pickup', status: 'confirmed', kata: 'ピカップ', note: '本人談「ピカップって言った気がする」。' },
  { id: 'do-you-want-me-to', phrase: 'Do you want me to', spelled: 'Do you wa me da', status: 'confirmed', kata: 'デュワミダ', note: '本人評価は「近い」。' },
  // ---- 案（未確認）----
  { id: 'are-you', phrase: 'Are you', spelled: 'Are ya', status: 'candidate', kata: 'アーユ' },
  { id: 'do-you', phrase: 'Do you', spelled: 'Dya', status: 'candidate', kata: 'ドゥユ（ジュ）', note: 'Do you want me to は確定済みの規則が優先される。' },
  { id: 'call-you', phrase: 'call you', spelled: 'callya', status: 'candidate', kata: 'コーリュ' },
  { id: 'help-you', phrase: 'help you', spelled: 'helpya', status: 'candidate', kata: 'ヘルピュ' },
  { id: 'let-you', phrase: 'let you', spelled: 'letcha', status: 'candidate', kata: 'レッチュ' },
  { id: 'pick-you', phrase: 'pick you', spelled: 'pickya', status: 'candidate', kata: 'ピッキュ' },
  { id: 'send-you', phrase: 'send you', spelled: 'sendja', status: 'candidate', kata: 'センジュ' },
  { id: 'tell-you', phrase: 'tell you', spelled: 'tellya', status: 'candidate', kata: 'テリュ' },
  { id: 'im-gonna', phrase: "I'm gonna", spelled: 'Imma', status: 'candidate', kata: 'アイマナ（アマナ・アイムガナ）', note: "別案: I'mma" },
  { id: 'supposed-to', phrase: 'supposed to', spelled: 'supposta', status: 'candidate', kata: 'サポウスタ（主表記はサポウストゥ）' },
  { id: 'ended-up', phrase: 'ended up', spelled: 'endedup', status: 'candidate', kata: 'エンディダップ', note: 'pickup と同じ1語化の方式。' },
  { id: 'im-about-to', phrase: "I'm about to", spelled: 'Imabout to', status: 'candidate', kata: 'アイマバウトゥ' },
  { id: 'was-about-to', phrase: 'was about to', spelled: 'wuzabout to', status: 'candidate', kata: 'ワザバウトゥ' },
  { id: 'ahead-and', phrase: 'ahead and', spelled: 'aheadan', status: 'candidate', kata: 'アヘッダン' },
  { id: 'what-am-i', phrase: 'What am I', spelled: 'Whaddam I', status: 'candidate', kata: 'ワラマイ' },
  { id: 'how-am-i', phrase: 'How am I', spelled: 'How amI', status: 'candidate', kata: 'ハウ アマイ' },
  { id: 'let-me', phrase: 'let me', spelled: 'lemme', status: 'candidate', kata: 'レッミ' },
  { id: 'want-to', phrase: 'want to', spelled: 'wanna', status: 'candidate', kata: 'ウォナ' },
  { id: 'need-to', phrase: 'need to', spelled: 'needa', status: 'candidate', kata: 'ニーダ' },
  { id: 'kind-of', phrase: 'kind of', spelled: 'kinda', status: 'candidate', kata: 'カインダ' },
  { id: 'sort-of', phrase: 'sort of', spelled: 'sorta', status: 'candidate', kata: 'ソーラ（ソーラヴ）' },
  { id: 'trying-to', phrase: 'trying to', spelled: 'tryna', status: 'candidate', kata: 'チュライナ', note: 'tryna が「トライナ」と読まれる可能性（Excelは「チュ」）。' },
  { id: 'used-to', phrase: 'used to', spelled: 'usta', status: 'candidate', kata: 'ユースタ' },
  { id: 'got-to', phrase: 'got to', spelled: 'gotta', status: 'candidate', kata: 'ガラ', note: 'Excelは弾音の「ガラ」。gotta は「ガッタ」と読まれる可能性。' },
  { id: 'going-to', phrase: 'going to', spelled: 'gonna', status: 'candidate', kata: 'ゴナ', skipIfFollowedBy: '^\\s+(?:the\\s|[A-Z])', note: '場所への移動（going to Kyoto など）は対象外。' },
  { id: 'wanted-to', phrase: 'wanted to', spelled: 'wanna', status: 'candidate', kata: 'ウォニットゥ', note: 'Excelの読み（ウォニットゥ）とは別の音。採用するか要検討。' },
  { id: 'take-a', phrase: 'take a', spelled: 'takea', status: 'candidate', kata: 'テイカ' },
  { id: 'might-as-well', phrase: 'might as well', spelled: 'mightaswell', status: 'candidate', kata: 'マイタズウェル' },
  { id: 'turns-out', phrase: 'turns out', spelled: 'turnzout', status: 'candidate', kata: 'ターンザウ' },
  { id: 'theres-a', phrase: "There's a", spelled: 'Therza', status: 'candidate', kata: 'ゼアザ' },
  { id: 'think-of-it', phrase: 'think of it', spelled: 'think ovit', status: 'candidate', kata: 'オヴィッ' },
  { id: 'on-top-of', phrase: 'on top of', spelled: 'on toppa', status: 'candidate', kata: 'タッパヴ' },
  { id: 'end-of-the', phrase: 'end of the', spelled: 'endova the', status: 'candidate', kata: 'エンダヴ ダ' },
  { id: 'as-far-as', phrase: 'as far as', spelled: 'as far az', status: 'candidate', kata: 'ファラザイ' },
  { id: 'is-it-okay-if-i', phrase: 'Is it okay if I', spelled: 'Izit okay ifI', status: 'candidate', kata: 'イズィッ オウケイ イファイ' },
  { id: 'would-you', phrase: 'Would you', spelled: 'Wouldja', status: 'candidate', kata: 'ウジュ' },
  { id: 'better-off', phrase: 'better off', spelled: 'bedder off', status: 'candidate', kata: 'ベダー オフ' },
  { id: 'think-about-it', phrase: 'think about it', spelled: 'think abouddit', status: 'candidate', kata: 'アバウディッ' },
  { id: 'head-out', phrase: 'head out', spelled: 'headout', status: 'candidate', kata: 'ヘダウ' },
  { id: 'out-of', phrase: 'out of', spelled: 'outta', status: 'candidate', kata: 'アウダ（アウダヴ）' },
  { id: 'a-lot-of', phrase: 'a lot of', spelled: 'a lotta', status: 'candidate', kata: 'ラダ' },
  { id: 'wake-up', phrase: 'wake up', spelled: 'wakeup', status: 'candidate', kata: 'ウェイカップ' },
  { id: 'bring-a', phrase: 'bring a', spelled: 'bringa', status: 'candidate', kata: 'ブリンガ' },
  { id: 'get-better', phrase: 'get better', spelled: 'get bedder', status: 'candidate', kata: 'ゲッ ベラー', note: '他案: get berrer / ged better。弾音化は綴りでの再現が難しい見込み。' },
];

// 文ごとの個別指定（必要なものだけ追加する）。キー: パッケージ 'p12' / 例文 'p12e2'（番号は1-3）
const OVERRIDES = {
  // 'p2e2': 'I hafta pickup my kid.',
};

// パッケージ名の「~」「~ing」は読み上げない
function stripSlots(text) {
  return text
    .replace(/~ing/g, '')
    .replace(/~/g, '')
    .replace(/\s+([,?!.])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// 画面に出す元の英文。パッケージは「~」を除いた形。kind: 'pkg' | 'ex'
function plainTextFor(pkg, kind, exIndex) {
  return kind === 'pkg' ? stripSlots(pkg.pkg) : pkg.ex[exIndex].en;
}

function itemKey(pkg, kind, exIndex) {
  return kind === 'pkg' ? 'p' + pkg.n : 'p' + pkg.n + 'e' + (exIndex + 1);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const _reCache = new Map();
function _regexFor(phrase) {
  let re = _reCache.get(phrase);
  if (!re) {
    re = new RegExp('\\b' + escapeRe(phrase) + '\\b', 'gi');
    _reCache.set(phrase, re);
  }
  re.lastIndex = 0;
  return re;
}

// text の中で rule の語句に一致する箇所を返す。
function findMatches(text, rule) {
  const re = _regexFor(rule.phrase);
  const skip = rule.skipIfFollowedBy ? new RegExp(rule.skipIfFollowedBy) : null;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const end = m.index + m[0].length;
    if (skip && skip.test(text.slice(end))) continue;
    out.push({ start: m.index, end, match: m[0] });
  }
  return out;
}

// 元の語句が大文字始まりなら、綴りの先頭も大文字にする。
function caseLike(match, spelled) {
  const head = /[A-Z]/.test(match[0]) ? spelled[0].toUpperCase() : spelled[0].toLowerCase();
  return head + spelled.slice(1);
}

// rules: { id, phrase, spelled, confirmed, off, skipIfFollowedBy } の配列。
// 一致が重なる場合は、長い一致を優先（同じ長さなら確定済み、次に定義順）。二重適用しない。
function applyRules(text, rules) {
  const cands = [];
  rules.forEach((r, order) => {
    if (r.off || !r.spelled) return;
    findMatches(text, r).forEach((m) => cands.push({ r, order, start: m.start, end: m.end, match: m.match }));
  });
  cands.sort(
    (a, b) =>
      b.end - b.start - (a.end - a.start) ||
      Number(b.r.confirmed) - Number(a.r.confirmed) ||
      a.order - b.order
  );
  const chosen = [];
  for (const c of cands) {
    if (!chosen.some((x) => c.start < x.end && x.start < c.end)) chosen.push(c);
  }
  chosen.sort((a, b) => a.start - b.start);
  let out = '';
  let pos = 0;
  for (const c of chosen) {
    out += text.slice(pos, c.start) + caseLike(c.match, c.r.spelled);
    pos = c.end;
  }
  out += text.slice(pos);
  return { text: out, hits: chosen.map((c) => ({ id: c.r.id, start: c.start, end: c.end })) };
}

// text の中の oldPhrase を newPhrase に置き換え、置き換えた箇所以外には rules を適用する。
// 置き換えた箇所は規則の対象外（二重に変換しない）。count は置き換えた回数。
function applyPhraseEdit(text, oldPhrase, newPhrase, rules) {
  const re = new RegExp('\\b' + escapeRe(oldPhrase) + '\\b', 'gi');
  let out = '';
  let pos = 0;
  let count = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    out += applyRules(text.slice(pos, m.index), rules).text + caseLike(m[0], newPhrase);
    pos = m.index + m[0].length;
    count++;
  }
  out += applyRules(text.slice(pos), rules).text;
  return { text: out, count };
}
