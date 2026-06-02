// ============================================================
//  RAID FRONTIER — Game Logic & UI
// ============================================================

// ── STATE ──────────────────────────────────────────────────
let S = {
  screen: 'home',
  characters: [],      // 最大5キャラ
  activeCharIndex: 0,  // 現在操作中のキャラ
  inventory: { weapons:[], items:{}, money:0, materials:{} },
  battle: null,
  lobby: null,
  // 作成中フォームの一時データ
  createForm: { name:'', weaponId:'', armorId:'', passives:[], actives:[] },
};

// ── PERSIST ────────────────────────────────────────────────
function save() {
  try { localStorage.setItem('rf_save', JSON.stringify(S)); } catch(e) {}
}
function load() {
  try {
    const d = localStorage.getItem('rf_save');
    if (d) { const p = JSON.parse(d); Object.assign(S, p); }
  } catch(e) {}
}

// ── APP ROOT ───────────────────────────────────────────────
const app = () => document.getElementById('app');
function render(html) { app().innerHTML = html; }

// ── ROUTER ─────────────────────────────────────────────────
function showScreen(name, params) {
  S.screen = name;
  switch(name) {
    case 'home':        renderHome();        break;
    case 'create_char': renderCreateChar();  break;
    case 'char_detail': renderCharDetail(params); break;
    case 'lobby':       renderLobby(params); break;
    case 'battle':      renderBattle();      break;
    case 'result':      renderResult(params); break;
  }
}

// ── UTILS ──────────────────────────────────────────────────
function weightedRandom(options) {
  const total = options.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  for (const o of options) { r -= o.weight; if (r <= 0) return o; }
  return options[0];
}
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function pct(cur, max) { return clamp(Math.round(cur / max * 100), 0, 100); }

function hpClass(cur, max) {
  const p = pct(cur, max);
  if (p > 60) return 'hp-high';
  if (p > 30) return 'hp-mid';
  return 'hp-low';
}

// キャラのフル計算済みステータスを返す
function calcStats(char) {
  const w = WEAPONS[char.weaponId] || WEAPONS.handgun;
  const a = ARMORS[char.armorId]   || ARMORS.light_jacket;

  let hp    = 200 + a.hpBonus;
  let atk   = w.baseAtk;
  let speed = 10 + w.speedMod + a.speedMod;
  let dodge = 5 + a.dodgeMod;   // 基本回避率 5%
  let crit  = 5;                 // 基本クリ率 5%
  let reduction = a.reduction;
  let atkMod = 1.0;

  // パッシブスキル適用
  const passives = (char.passiveSkills || []).map(id => SKILLS[id]).filter(Boolean);
  for (const sk of passives) {
    const e = sk.effect;
    if (e.dodgeRate)    dodge     += e.dodgeRate;
    if (e.critRate)     crit      += e.critRate;
    if (e.atkMod)       atkMod    += e.atkMod;
    if (e.speedBonus)   speed     += e.speedBonus;
    if (e.hpBonus)      hp        += e.hpBonus;
    if (e.damageReduction) reduction += e.damageReduction; // 被ダメ軽減を加算
  }

  return { hp, maxHp:hp, atk: Math.round(atk * atkMod), speed, dodge, crit, reduction,
           weapon:w, armor:a };
}

// ── HOME ───────────────────────────────────────────────────
function renderHome() {
  const slots = [];
  for (let i = 0; i < 5; i++) {
    const c = S.characters[i];
    if (c) {
      const st = calcStats(c);
      slots.push(`
        <div class="char-slot" onclick="showScreen('char_detail',${i})">
          <div class="char-avatar">${c.icon || '🧑'}</div>
          <div class="char-info">
            <div class="char-name">${c.name}</div>
            <div class="char-sub">${WEAPONS[c.weaponId]?.name || '?'} / ${ARMORS[c.armorId]?.name || '?'}</div>
            <div class="char-sub">HP ${st.hp} | 素早さ ${st.speed}</div>
          </div>
          <div class="char-lv">Lv.${c.level}</div>
        </div>`);
    } else {
      slots.push(`<div class="char-slot empty" onclick="showScreen('create_char')">＋ キャラクター作成</div>`);
    }
  }

  const hasChars = S.characters.length > 0;
  render(`
    <div class="header">
      <div class="header-title">RAID FRONTIER</div>
    </div>
    <div class="scroll-area">
      <div class="section">
        <div class="label">キャラクター</div>
        ${slots.join('')}
      </div>
      <div class="section">
        <div class="label">アクション</div>
        <div class="card">
          <button class="btn btn-danger" ${!hasChars?'disabled':''} onclick="openLobby()" style="margin-bottom:8px">
            ⚔️ レイドに挑む
          </button>
          <button class="btn btn-secondary" disabled>
            🗺️ クエスト（近日実装）
          </button>
        </div>
      </div>
      <div class="section">
        <div class="label">所持金</div>
        <div class="card">
          <span style="font-size:18px;font-weight:700;color:var(--warn)">💰 ${S.inventory.money}</span>
        </div>
      </div>
    </div>
  `);
}

// ── CREATE CHARACTER ────────────────────────────────────────
function renderCreateChar() {
  const f = S.createForm;

  // 武器選択肢
  const weaponOpts = Object.values(WEAPONS).map(w => `
    <div class="select-item ${f.weaponId===w.id?'selected':''}" onclick="selectWeapon('${w.id}')">
      <h4>${w.icon} ${w.name}</h4>
      <p>${w.desc}</p>
      <div class="stat">攻撃力 ${w.baseAtk} | 速度 ${w.speedMod>=0?'+':''}${w.speedMod}</div>
    </div>`).join('');

  // 防具選択肢
  const armorOpts = Object.values(ARMORS).map(a => `
    <div class="select-item ${f.armorId===a.id?'selected':''}" onclick="selectArmor('${a.id}')">
      <h4>${a.icon} ${a.name}</h4>
      <p>${a.desc}</p>
      <div class="stat">軽減 ${Math.round(a.reduction*100)}% | 回避 ${a.dodgeMod>=0?'+':''}${a.dodgeMod}%</div>
    </div>`).join('');

  // パッシブスキル（全ツリーから）
  const passiveSkills = Object.values(SKILLS).filter(s => s.type === 'passive');
  const passiveOpts = passiveSkills.map(s => {
    const sel = f.passives.includes(s.id);
    const dis = !sel && f.passives.length >= 3;
    return `
      <div class="select-item ${sel?'selected':''} ${dis?'':''}` +
      `" onclick="${dis?'':'togglePassive(\''+s.id+'\')'}" style="${dis?'opacity:0.4':''}">
        <h4>${TREE_NAMES[s.tree]} ${s.name}</h4>
        <p>${s.desc}</p>
      </div>`;
  }).join('');

  // アクティブスキル（全ツリーから）
  const activeSkills = Object.values(SKILLS).filter(s => s.type === 'active');
  const activeOpts = activeSkills.map(s => {
    const sel = f.actives.includes(s.id);
    const dis = !sel && f.actives.length >= 2;
    return `
      <div class="select-item ${sel?'selected':''}" onclick="${dis?'':'toggleActive(\''+s.id+'\')'}" style="${dis?'opacity:0.4':''}">
        <h4>${TREE_NAMES[s.tree]} ${s.name}</h4>
        <p>${s.desc}</p>
        <div class="stat">CT:${s.ct}T | AP:${s.apCost}</div>
      </div>`;
  }).join('');

  const canCreate = f.name.trim() && f.weaponId && f.armorId && f.passives.length>0 && f.actives.length>0;

  render(`
    <div class="header">
      <button class="back-btn" onclick="showScreen('home')">‹</button>
      <div class="header-title">キャラ作成</div>
    </div>
    <div class="scroll-area">
      <div class="section">

        <div class="label">キャラクター名</div>
        <input class="input" type="text" placeholder="名前を入力" value="${f.name}"
          oninput="S.createForm.name=this.value" maxlength="16">

        <div class="label">武器を選択</div>
        <div class="select-grid">${weaponOpts}</div>

        <div class="label">防具を選択</div>
        <div class="select-grid">${armorOpts}</div>

        <div class="label">パッシブスキル（最大3つ）— ${f.passives.length}/3 選択中</div>
        <div class="select-grid">${passiveOpts}</div>

        <div class="label">アクティブスキル（最大2つ）— ${f.actives.length}/2 選択中</div>
        <div class="select-grid">${activeOpts}</div>

        <div style="margin-top:20px">
          <button class="btn btn-primary" ${canCreate?'':'disabled'} onclick="createChar()">
            キャラクターを作成
          </button>
        </div>
      </div>
    </div>
  `);
}

function selectWeapon(id) { S.createForm.weaponId = id; renderCreateChar(); }
function selectArmor(id)  { S.createForm.armorId = id;  renderCreateChar(); }
function togglePassive(id) {
  const f = S.createForm;
  if (f.passives.includes(id)) f.passives = f.passives.filter(x=>x!==id);
  else if (f.passives.length < 3) f.passives.push(id);
  renderCreateChar();
}
function toggleActive(id) {
  const f = S.createForm;
  if (f.actives.includes(id)) f.actives = f.actives.filter(x=>x!==id);
  else if (f.actives.length < 2) f.actives.push(id);
  renderCreateChar();
}

const CHAR_ICONS = ['🧑','👦','👩','🧔','👱','🧕','👮','🕵️','💂','🧛'];
function createChar() {
  const f = S.createForm;
  if (!f.name.trim() || !f.weaponId || !f.armorId) return;
  const newChar = {
    id: 'char_' + Date.now(),
    name: f.name.trim(),
    icon: CHAR_ICONS[Math.floor(Math.random() * CHAR_ICONS.length)],
    weaponId: f.weaponId,
    armorId: f.armorId,
    passiveSkills: [...f.passives],
    activeSkills: [...f.actives],
    level: 1,
    exp: 0,
    isNPC: false,
  };
  if (S.characters.length >= 5) { alert('キャラクタースロットが満杯です'); return; }
  S.characters.push(newChar);
  S.createForm = { name:'', weaponId:'', armorId:'', passives:[], actives:[] };
  save();
  showScreen('home');
}

// ── CHAR DETAIL ─────────────────────────────────────────────
function renderCharDetail(index) {
  const c = S.characters[index];
  if (!c) { showScreen('home'); return; }
  const st = calcStats(c);
  const w = WEAPONS[c.weaponId];
  const a = ARMORS[c.armorId];

  const passiveChips = (c.passiveSkills||[]).map(id => {
    const sk = SKILLS[id]; if(!sk) return '';
    return `<span class="skill-chip skill-passive">${sk.name}</span>`;
  }).join('');
  const activeChips = (c.activeSkills||[]).map(id => {
    const sk = SKILLS[id]; if(!sk) return '';
    return `<span class="skill-chip skill-active">${sk.name} CT:${sk.ct}T</span>`;
  }).join('');

  render(`
    <div class="header">
      <button class="back-btn" onclick="showScreen('home')">‹</button>
      <div class="header-title">${c.icon} ${c.name}</div>
    </div>
    <div class="scroll-area">
      <div class="section">
        <div class="card">
          <div style="text-align:center;font-size:48px;margin-bottom:8px">${c.icon}</div>
          <div class="label" style="text-align:center;margin-top:0">Lv.${c.level}</div>
        </div>

        <div class="label">ステータス</div>
        <div class="card">
          <div class="stat-row"><span class="stat-name">HP</span><span class="stat-value">${st.hp}</span></div>
          <div class="stat-row"><span class="stat-name">攻撃力</span><span class="stat-value">${st.atk}</span></div>
          <div class="stat-row"><span class="stat-name">素早さ</span><span class="stat-value">${st.speed}</span></div>
          <div class="stat-row"><span class="stat-name">回避率</span><span class="stat-value">${st.dodge}%</span></div>
          <div class="stat-row"><span class="stat-name">クリティカル率</span><span class="stat-value">${st.crit}%</span></div>
          <div class="stat-row"><span class="stat-name">ダメージ軽減</span><span class="stat-value">${Math.round(st.reduction*100)}%</span></div>
        </div>

        <div class="label">装備</div>
        <div class="card">
          <div class="stat-row"><span class="stat-name">武器</span><span class="stat-value">${w?.icon} ${w?.name}</span></div>
          <div class="stat-row"><span class="stat-name">防具</span><span class="stat-value">${a?.icon} ${a?.name}</span></div>
        </div>

        <div class="label">パッシブスキル</div>
        <div class="card"><div class="skill-chips">${passiveChips || '<span style="color:var(--text2)">なし</span>'}</div></div>

        <div class="label">アクティブスキル</div>
        <div class="card"><div class="skill-chips">${activeChips || '<span style="color:var(--text2)">なし</span>'}</div></div>

        <div style="margin-top:16px">
          <button class="btn btn-danger" style="margin-bottom:8px"
            onclick="deleteChar(${index})">キャラクターを削除</button>
        </div>
      </div>
    </div>
  `);
}

function deleteChar(index) {
  if (!confirm('このキャラクターを削除しますか？')) return;
  S.characters.splice(index, 1);
  save();
  showScreen('home');
}

// ── LOBBY ──────────────────────────────────────────────────
function openLobby() {
  if (S.characters.length === 0) { alert('先にキャラクターを作成してください'); return; }
  S.lobby = {
    bossId: 'factory_guardian',
    myCharIndex: 0,
    npc1: null,
    npc2: null,
    items: [null, null, null],
    selectingNPC: null,   // 1 or 2
    selectingItem: null,  // 0,1,2
  };
  showScreen('lobby');
}

function renderLobby() {
  const lb = S.lobby;
  const boss = BOSSES[lb.bossId];
  const myChar = S.characters[lb.myCharIndex];
  const st = calcStats(myChar);

  // パーティスロット表示
  function slotHtml(char, label, isNPC) {
    if (char) {
      return `<div class="lobby-slot filled">
        <div class="ls-label">${label}</div>
        <div class="ls-name">${char.icon||'🤖'} ${char.name}</div>
        <div class="ls-sub">${WEAPONS[char.weaponId]?.name || '?'}</div>
      </div>`;
    }
    return `<div class="lobby-slot">
      <div class="ls-label">${label}</div>
      <div class="ls-name" style="color:var(--text2)">未選択</div>
    </div>`;
  }

  // NPC選択肢HTML
  const npcChoices = TEMPLATE_NPCS.map(n => `
    <div class="npc-choice" onclick="selectNPC('${n.id}')">
      <div class="npc-icon">${n.icon}</div>
      <div class="npc-info">
        <h4>${n.name}</h4>
        <p>${WEAPONS[n.weaponId]?.name} | Lv.${n.level}</p>
      </div>
    </div>`).join('');

  // アイテムスロット
  const itemSlotsHtml = lb.items.map((it, i) => {
    if (it) {
      const cDef = CONSUMABLES[it];
      return `<div class="item-slot filled" onclick="openItemPicker(${i})">
        <div class="item-slot-icon">${cDef.icon}</div>
        <div class="item-slot-name">${cDef.name}</div>
      </div>`;
    }
    return `<div class="item-slot" onclick="openItemPicker(${i})">
      <div class="item-slot-icon">＋</div>
      <div class="item-slot-name">空き</div>
    </div>`;
  }).join('');

  // アイテムピッカーオーバーレイ
  let overlayHtml = '';
  if (lb.selectingNPC !== null) {
    overlayHtml = `<div class="overlay" onclick="closeOverlay(event)">
      <div class="overlay-panel">
        <div class="overlay-title">NPCを選ぶ</div>
        ${npcChoices}
      </div>
    </div>`;
  } else if (lb.selectingItem !== null) {
    const items = Object.values(CONSUMABLES).map(c => `
      <div class="npc-choice" onclick="selectItem('${c.id}')">
        <div class="npc-icon">${c.icon}</div>
        <div class="npc-info"><h4>${c.name}</h4><p>${c.desc}</p></div>
      </div>`).join('');
    overlayHtml = `<div class="overlay" onclick="closeOverlay(event)">
      <div class="overlay-panel">
        <div class="overlay-title">アイテムを選ぶ</div>
        ${items}
        <div style="margin-top:8px">
          <button class="btn btn-secondary btn-sm" onclick="selectItem(null)">空にする</button>
        </div>
      </div>
    </div>`;
  }

  const canStart = true; // NPC未選択でも開始OK（テンプレ使用）

  render(`
    <div class="header">
      <button class="back-btn" onclick="showScreen('home')">‹</button>
      <div class="header-title">レイドロビー</div>
    </div>
    <div class="scroll-area">
      <div class="section">

        <div class="label">ボス情報</div>
        <div class="card">
          <div style="font-size:32px;text-align:center;margin-bottom:8px">${boss.icon}</div>
          <div style="font-size:17px;font-weight:700;text-align:center;color:var(--pink)">${boss.name}</div>
          <div style="text-align:center;margin:6px 0;color:var(--text2);font-size:13px">${boss.desc}</div>
          <div class="stat-row">
            <span class="stat-name">推奨レベル</span>
            <span class="stat-value">Lv.${boss.recommendedLevel}</span>
          </div>
          <div class="stat-row">
            <span class="stat-name">難易度</span>
            <span class="stat-value">${'★'.repeat(boss.difficulty)}${'☆'.repeat(5-boss.difficulty)}</span>
          </div>
          <div class="stat-row">
            <span class="stat-name">獲得EXP</span>
            <span class="stat-value">${boss.drops.expReward}</span>
          </div>
          <div class="stat-row">
            <span class="stat-name">クリア報酬</span>
            <span class="stat-value r-rare">レア以上の武器確定</span>
          </div>
        </div>

        <div class="label">パーティ編成</div>
        <div class="lobby-party-slots">
          ${slotHtml(myChar, '自分', false)}
          <div class="lobby-slot ${lb.npc1?'filled':''}" onclick="openNPCPicker(1)" style="cursor:pointer">
            <div class="ls-label">NPC ①</div>
            ${lb.npc1
              ? `<div class="ls-name">${lb.npc1.icon||'🤖'} ${lb.npc1.name}</div><div class="ls-sub">${WEAPONS[lb.npc1.weaponId]?.name}</div>`
              : `<div class="ls-name" style="color:var(--accent);font-size:12px">＋ 選択</div>`
            }
          </div>
          <div class="lobby-slot ${lb.npc2?'filled':''}" onclick="openNPCPicker(2)" style="cursor:pointer">
            <div class="ls-label">NPC ②</div>
            ${lb.npc2
              ? `<div class="ls-name">${lb.npc2.icon||'🤖'} ${lb.npc2.name}</div><div class="ls-sub">${WEAPONS[lb.npc2.weaponId]?.name}</div>`
              : `<div class="ls-name" style="color:var(--accent);font-size:12px">＋ 選択</div>`
            }
          </div>
        </div>

        <div class="label">持ち込みアイテム（最大3つ）</div>
        <div class="item-slots">${itemSlotsHtml}</div>

        <div style="margin-top:20px">
          <button class="btn btn-danger" onclick="startRaid()">
            ⚔️ レイド開始
          </button>
        </div>

      </div>
    </div>
    ${overlayHtml}
  `);
}

function openNPCPicker(slot) { S.lobby.selectingNPC = slot; renderLobby(); }
function openItemPicker(i)   { S.lobby.selectingItem = i;   renderLobby(); }
function closeOverlay(e) {
  if (e.target.classList.contains('overlay')) {
    S.lobby.selectingNPC = null;
    S.lobby.selectingItem = null;
    renderLobby();
  }
}
function selectNPC(id) {
  const npc = TEMPLATE_NPCS.find(n => n.id === id);
  if (!npc) return;
  if (S.lobby.selectingNPC === 1) S.lobby.npc1 = npc;
  else S.lobby.npc2 = npc;
  S.lobby.selectingNPC = null;
  renderLobby();
}
function selectItem(id) {
  S.lobby.items[S.lobby.selectingItem] = id || null;
  S.lobby.selectingItem = null;
  renderLobby();
}

// ── BATTLE INIT ─────────────────────────────────────────────
function startRaid() {
  const lb = S.lobby;
  const boss = BOSSES[lb.bossId];
  const myChar = S.characters[lb.myCharIndex];

  // NPC未選択の場合はデフォルトテンプレを使う
  const npc1 = lb.npc1 || TEMPLATE_NPCS[0];
  const npc2 = lb.npc2 || TEMPLATE_NPCS[2];

  function makeCombatant(charDef, isNPC) {
    const st = calcStats(charDef);
    let maxHp = st.hp;
    // サバイバル（バトル開始時HP+20%）
    if ((charDef.passiveSkills||[]).some(id => SKILLS[id]?.effect?.startHpBonus)) {
      maxHp = Math.round(maxHp * 1.2);
    }
    return {
      ...charDef,
      maxHp,
      currentHp: maxHp,
      position: isNPC ? 'back' : 'front',
      ap: 2,
      maxAp: 2,
      isNPC,
      statusEffects: [],     // { type, value, turns }
      skillCTs: {},          // skillId → remaining CT
      hasMoved: false,
      hasFiredThisTurn: false,
      usedLastStand: false,
      tempDodgeBonus: 0,
      stats: st,
    };
  }

  const party = [
    makeCombatant(myChar, false),
    makeCombatant(npc1, true),
    makeCombatant(npc2, true),
  ];

  // NPC は後ろから並べる
  party[1].position = 'mid';
  party[2].position = 'back';

  S.battle = {
    bossId: lb.bossId,
    boss: {
      ...boss,
      currentHp: boss.hp,
      maxHp: boss.hp,
      buffs: [],       // { stat, value, turns }
      lastActionId: null,
      statusEffects: [],
    },
    party,
    log: [],
    round: 1,
    turnOrder: [],
    currentTurnIdx: 0,
    phase: 'init',   // init | player_action | npc_action | boss_action | end
    selectedCharIdx: null,
    actionPhase: null,  // null | choosing_action | choosing_move | choosing_skill | choosing_item | choosing_target
    pendingSkillId: null,
    items: lb.items.filter(Boolean),
    itemsUsed: {},
  };

  buildTurnOrder();
  S.battle.phase = 'resolving';
  showScreen('battle');
  addLog('⚔️ レイド開始！', 'sys');
  addLog(`敵：${boss.name} HP:${boss.hp}`, 'boss');
  processNextTurn();
}

function buildTurnOrder() {
  const bt = S.battle;
  const entities = [];
  bt.party.forEach((c, i) => {
    if (c.currentHp > 0) {
      entities.push({ type:'player', idx:i, speed: c.stats.speed });
    }
  });
  entities.push({ type:'boss', speed: bt.boss.speed });
  entities.sort((a,b) => b.speed - a.speed);
  // 同値はプレイヤー優先
  bt.turnOrder = entities;
  bt.currentTurnIdx = 0;
}

// ── BATTLE FLOW ─────────────────────────────────────────────
function processNextTurn() {
  const bt = S.battle;

  // 全員ターン消化したら新ラウンドへ
  if (bt.currentTurnIdx >= bt.turnOrder.length) {
    startNewRound();
    return;
  }

  const entity = bt.turnOrder[bt.currentTurnIdx];

  // 死亡チェック
  if (entity.type === 'player') {
    const c = bt.party[entity.idx];
    if (c.currentHp <= 0) {
      bt.currentTurnIdx++;
      processNextTurn();
      return;
    }
    // NPCは自動処理
    if (c.isNPC) {
      setTimeout(() => { npcTurn(entity.idx); }, 600);
    } else {
      // プレイヤーターン
      bt.selectedCharIdx = entity.idx;
      bt.actionPhase = 'choosing_action';
      bt.phase = 'player_action';
      resetTurnState(entity.idx);
      renderBattle();
    }
  } else {
    // ボスターン
    setTimeout(() => { bossTurn(); }, 600);
  }
}

function resetTurnState(idx) {
  const c = S.battle.party[idx];
  c.ap = c.maxAp;
  c.hasMoved = false;
  c.hasFiredThisTurn = false;
  c.tempDodgeBonus = 0;
}

function startNewRound() {
  const bt = S.battle;
  bt.round++;
  addLog(`── ラウンド ${bt.round} ──`, 'sys');

  // CT を減らす
  bt.party.forEach(c => {
    if (c.currentHp <= 0) return;
    // フィールドメディック（毎ターン自己回復）
    if ((c.passiveSkills||[]).some(id => SKILLS[id]?.effect?.selfHealPerTurn)) {
      const heal = Math.round(c.maxHp * 0.05);
      c.currentHp = Math.min(c.maxHp, c.currentHp + heal);
      addLog(`${c.name} がHP ${heal} 回復（フィールドメディック）`, 'heal');
    }
    Object.keys(c.skillCTs).forEach(sid => {
      c.skillCTs[sid] = Math.max(0, (c.skillCTs[sid]||0) - 1);
    });
    c.statusEffects = c.statusEffects.filter(e => { e.turns--; return e.turns > 0; });
    c.tempDodgeBonus = 0;
  });

  // ボスバフ更新
  bt.boss.buffs = bt.boss.buffs.filter(b => { b.turns--; return b.turns > 0; });
  bt.boss.statusEffects = bt.boss.statusEffects.filter(e => { e.turns--; return e.turns > 0; });

  buildTurnOrder();
  processNextTurn();
}

// ── NPC TURN ───────────────────────────────────────────────
function npcTurn(idx) {
  const bt = S.battle;
  const c = bt.party[idx];
  addLog(`${c.name} が行動中...`, 'act');

  // ポジションチェック（スナイパーは後衛に移動）
  if (c.weaponId === 'sniper' && c.position !== 'back') {
    c.position = 'back';
    addLog(`${c.name} は後衛に移動した`, 'act');
  }

  // 攻撃可能チェック
  const w = WEAPONS[c.weaponId];
  if (!w.attackSlots.includes(c.position)) {
    addLog(`${c.name} はこの位置から攻撃できない`, 'sys');
    nextTurn();
    return;
  }

  // トリアージ（HP30%以下で自動回復）
  if ((c.passiveSkills||[]).some(id => SKILLS[id]?.effect?.autoHeal)) {
    const threshold = 0.3;
    const needsHeal = bt.party.find(p => p.currentHp > 0 && p.currentHp / p.maxHp < threshold && p !== c);
    if (needsHeal) {
      const heal = Math.round(needsHeal.maxHp * 0.2);
      needsHeal.currentHp = Math.min(needsHeal.maxHp, needsHeal.currentHp + heal);
      addLog(`${c.name} の「トリアージ」発動！ ${needsHeal.name} HP+${heal}`, 'heal');
      nextTurn();
      renderBattle();
      return;
    }
  }

  // first_aid アクティブを持っていたらHP低い味方を回復
  if ((c.activeSkills||[]).includes('first_aid') && !(c.skillCTs['first_aid']>0)) {
    const target = bt.party.find(p => p.currentHp > 0 && p.currentHp / p.maxHp < 0.5 && p !== c);
    if (target) {
      const heal = Math.round(target.maxHp * 0.3);
      target.currentHp = Math.min(target.maxHp, target.currentHp + heal);
      c.skillCTs['first_aid'] = 2;
      addLog(`${c.name} が 応急処置 → ${target.name} HP+${heal}`, 'heal');
      nextTurn();
      renderBattle();
      return;
    }
  }

  // 通常攻撃
  const dmg = calcDamage(c, bt.boss, {});
  applyDamageToBoss(dmg, c.name + ' の攻撃');

  nextTurn();
  renderBattle();
}

// ── BOSS TURN ──────────────────────────────────────────────
function bossTurn() {
  const bt = S.battle;
  const boss = bt.boss;

  // スタン中は行動しない
  if (boss.statusEffects.some(e => e.type === 'stun')) {
    addLog(`${boss.name} はスタン中で動けない！`, 'boss');
    boss.statusEffects = boss.statusEffects.filter(e => e.type !== 'stun');
    nextTurn();
    renderBattle();
    return;
  }

  // 前回と同じ行動は避ける（ランダム）
  const available = boss.lastActionId
    ? boss.actions.filter(a => a.id !== boss.lastActionId)
    : boss.actions;
  const action = weightedRandom(available);
  boss.lastActionId = action.id;

  addLog(`${boss.name} の ${action.name}！`, 'boss');

  // バフ効果のボスATK
  let bossAtk = boss.atk;
  boss.buffs.filter(b => b.stat === 'atk').forEach(b => { bossAtk = Math.round(bossAtk * b.value); });

  if (action.type === 'buff') {
    boss.buffs.push({ stat:action.buffStat, value:action.buffValue, turns:action.buffTurns });
    addLog(`${boss.name} の攻撃力が上昇！（${action.buffTurns}T）`, 'boss');
  } else if (action.type === 'aoe') {
    bt.party.forEach(c => {
      if (c.currentHp <= 0) return;
      const dmg = calcBossDamage(bossAtk, action.damageMod, c);
      applyDamageToChar(c, dmg);
    });
  } else {
    // single
    const target = pickBossTarget(action.target, bt.party);
    if (target) {
      const dmg = calcBossDamage(bossAtk, action.damageMod, target);
      applyDamageToChar(target, dmg);
    }
  }

  nextTurn();
  renderBattle();

  // 全滅チェック
  if (bt.party.every(c => c.currentHp <= 0)) {
    setTimeout(() => endBattle(false), 500);
  }
}

function pickBossTarget(targetType, party) {
  const alive = party.filter(c => c.currentHp > 0);
  if (alive.length === 0) return null;
  const posOrder = { front:0, mid:1, back:2 };
  if (targetType === 'front') {
    alive.sort((a,b) => posOrder[a.position] - posOrder[b.position]);
    return alive[0];
  }
  if (targetType === 'back') {
    alive.sort((a,b) => posOrder[b.position] - posOrder[a.position]);
    return alive[0];
  }
  // random
  return alive[Math.floor(Math.random() * alive.length)];
}

function calcBossDamage(baseAtk, mod, target) {
  let dmg = Math.round(baseAtk * mod);
  // ダメージ軽減
  let reduction = target.stats.reduction;
  // タクティカルアーマー
  if ((target.passiveSkills||[]).some(id => SKILLS[id]?.effect?.damageReduction)) {
    const sk = (target.passiveSkills||[]).map(id=>SKILLS[id]).find(s=>s?.effect?.damageReduction);
    if (sk) reduction += sk.effect.damageReduction;
  }
  reduction = clamp(reduction, 0, 0.8);
  return Math.max(1, Math.round(dmg * (1 - reduction)));
}

function applyDamageToChar(c, dmg) {
  // 回避判定
  let dodge = c.stats.dodge + (c.tempDodgeBonus||0);

  // ダッジマスターパッシブ
  if ((c.passiveSkills||[]).some(id => SKILLS[id]?.effect?.dodgeRate)) {
    // すでにcalcStatsに含まれているのでOK
  }

  const roll = Math.random() * 100;
  if (roll < dodge) {
    addLog(`${c.name} は攻撃を回避した！`, 'act');
    // カウンター
    if ((c.passiveSkills||[]).some(id => SKILLS[id]?.effect?.counterAttack)) {
      const cDmg = Math.round(c.stats.atk * 0.5);
      S.battle.boss.currentHp = Math.max(0, S.battle.boss.currentHp - cDmg);
      addLog(`${c.name} のカウンター！ ボスに ${cDmg} ダメージ`, 'dmg');
    }
    return;
  }

  // ラストスタンド
  if ((c.passiveSkills||[]).some(id => SKILLS[id]?.effect?.lastStand) && !c.usedLastStand) {
    if (c.currentHp - dmg <= 0) {
      c.usedLastStand = true;
      c.currentHp = 1;
      addLog(`${c.name} の「ラストスタンド」発動！ HP1で耐えた！`, 'sys');
      return;
    }
  }

  c.currentHp = Math.max(0, c.currentHp - dmg);
  addLog(`${c.name} が ${dmg} ダメージ受けた（残HP:${c.currentHp}）`, 'dmg');

  if (c.currentHp <= 0) {
    addLog(`${c.name} は戦闘不能！`, 'sys');
  }
}

// ── PLAYER ACTIONS ──────────────────────────────────────────
function playerAttack() {
  const bt = S.battle;
  const c = bt.party[bt.selectedCharIdx];
  const w = WEAPONS[c.weaponId];

  // 位置チェック
  if (!w.attackSlots.includes(c.position)) {
    addLog(`この位置（${POS_NAMES[c.position]}）からは攻撃できない`, 'sys');
    return;
  }
  if (!w.canAttackAfterMove && c.hasMoved) {
    addLog(`移動後は${w.name}で攻撃できない`, 'sys');
    return;
  }

  const dmg = calcDamage(c, bt.boss, {});
  applyDamageToBoss(dmg, c.name + ' の攻撃');
  c.hasFiredThisTurn = true;

  // デザートイーグルの硬直
  if (w.id === 'desert_eagle' && !c.passiveSkills.some(id=>SKILLS[id]?.effect?.noRecoilPenalty)) {
    c.tempDodgeBonus = -(w.recoilDodgePenalty||0);
  }

  consumeAP(1);
  checkWinCondition();
}

function calcDamage(attacker, target, opts) {
  const st = attacker.stats;
  let atk = st.atk;
  let mod = opts.damageMod || 1.0;

  // ハンターズアイ
  if ((attacker.passiveSkills||[]).some(id => SKILLS[id]?.effect?.lowHpBonus)) {
    if (target.currentHp / target.maxHp < 0.5) {
      mod += 0.2;
    }
  }

  // アーマーブレイク
  let targetReduction = target.reduction || 0;
  if ((attacker.passiveSkills||[]).some(id => SKILLS[id]?.effect?.armorBreak)) {
    targetReduction = 0;
  }

  let dmg = Math.round(atk * mod * (1 - targetReduction));

  // クリティカル
  const critRoll = Math.random() * 100;
  if (critRoll < st.crit) {
    dmg = Math.round(dmg * 1.5);
    addLog(`クリティカル！`, 'act');
  }

  return Math.max(1, dmg);
}

function applyDamageToBoss(dmg, source) {
  const bt = S.battle;
  bt.boss.currentHp = Math.max(0, bt.boss.currentHp - dmg);
  addLog(`${source} → ボスに ${dmg} ダメージ（残HP:${bt.boss.currentHp}）`, 'dmg');
}

function playerMove(pos) {
  const bt = S.battle;
  const c = bt.party[bt.selectedCharIdx];
  if (c.position === pos) { bt.actionPhase = 'choosing_action'; renderBattle(); return; }

  const armor = ARMORS[c.armorId];
  const moveCost = 1 + (armor.moveCostExtra||0);
  if (c.ap < moveCost) { addLog('APが足りない', 'sys'); return; }

  c.position = pos;
  c.hasMoved = true;
  c.ap -= moveCost;

  // シャドウステップ
  if ((c.passiveSkills||[]).some(id => SKILLS[id]?.effect?.moveEvadeBonus)) {
    c.tempDodgeBonus = (c.tempDodgeBonus||0) + 15;
  }

  addLog(`${c.name} が ${POS_NAMES[pos]} に移動`, 'act');
  bt.actionPhase = 'choosing_action';
  renderBattle();
}

function playerUseActiveSkill(skillId) {
  const bt = S.battle;
  const c = bt.party[bt.selectedCharIdx];
  const sk = SKILLS[skillId];
  if (!sk || sk.type !== 'active') return;

  const currentCT = c.skillCTs[skillId] || 0;
  if (currentCT > 0) { addLog(`${sk.name} はCT中（あと${currentCT}T）`, 'sys'); return; }
  if (c.ap < sk.apCost) { addLog('APが足りない', 'sys'); return; }

  c.ap -= sk.apCost;

  // CT設定（クールヘッド適用）
  let ct = sk.ct;
  if ((c.passiveSkills||[]).some(id => SKILLS[id]?.effect?.ctReduction)) ct = Math.max(1, ct - 1);
  c.skillCTs[skillId] = ct;

  const e = sk.effect;

  if (e.damageMod) {
    // ダメージ系
    if (!WEAPONS[c.weaponId].attackSlots.includes(c.position)) {
      addLog(`この位置からは使用できない`, 'sys');
      c.ap += sk.apCost; return;
    }
    const dmg = calcDamage(c, bt.boss, { damageMod: e.damageMod });
    applyDamageToBoss(dmg, c.name + ' の ' + sk.name);
    checkWinCondition();
  } else if (e.healPct) {
    // 回復
    const heal = Math.round(c.maxHp * e.healPct);
    c.currentHp = Math.min(c.maxHp, c.currentHp + heal);
    addLog(`${c.name} が ${sk.name} → HP+${heal}（${c.currentHp}/${c.maxHp}）`, 'heal');
  } else if (e.selfHeal) {
    const heal = Math.round(c.maxHp * e.selfHeal);
    c.currentHp = Math.min(c.maxHp, c.currentHp + heal);
    if (e.cleanse) c.statusEffects = [];
    addLog(`${c.name} が ${sk.name} → HP+${heal}`, 'heal');
  } else if (e.apBonus) {
    c.ap += e.apBonus;
    addLog(`${c.name} の ${sk.name}！ AP+${e.apBonus}`, 'act');
  } else if (e.stun) {
    bt.boss.statusEffects.push({ type:'stun', turns:e.stun });
    addLog(`${c.name} の ${sk.name}！ ボスがスタン！`, 'act');
  } else if (e.retreat) {
    const posOrder = ['front','mid','back'];
    const idx = posOrder.indexOf(c.position);
    if (idx < posOrder.length - 1) c.position = posOrder[idx + 1];
    if (e.guaranteedDodge) c.tempDodgeBonus = 100;
    addLog(`${c.name} の ${sk.name}！ 後退＋このターン回避確定`, 'act');
  } else if (e.swapPos) {
    c.position = c.position === 'front' ? 'back' : 'front';
    c.tempDodgeBonus = (c.tempDodgeBonus||0) + 30;
    addLog(`${c.name} の ${sk.name}！ 位置交換＋回避率+30%`, 'act');
  }

  addLog(`${sk.name} 使用（CT:${ct}T）`, 'sys');
  bt.actionPhase = 'choosing_action';
  renderBattle();
}

function playerUseItem(itemId) {
  const bt = S.battle;
  const c = bt.party[bt.selectedCharIdx];
  const def = CONSUMABLES[itemId];
  if (!def) return;

  // アイテムを消費
  const idx = bt.items.indexOf(itemId);
  if (idx === -1) return;
  bt.items.splice(idx, 1);

  const e = def.effect;
  if (e.healFlat) {
    c.currentHp = Math.min(c.maxHp, c.currentHp + e.healFlat);
    addLog(`${c.name} が ${def.icon}${def.name} 使用 → HP+${e.healFlat}`, 'heal');
  } else if (e.dmgFlat) {
    applyDamageToBoss(e.dmgFlat, def.icon + def.name);
    checkWinCondition();
  } else if (e.atkBuff) {
    c.stats.atk = Math.round(c.stats.atk * (1 + e.atkBuff));
    addLog(`${c.name} が ${def.icon}${def.name} 使用 → 攻撃力UP`, 'act');
  }

  consumeAP(1);
}

function consumeAP(cost) {
  const bt = S.battle;
  const c = bt.party[bt.selectedCharIdx];
  c.ap -= cost;
  if (c.ap <= 0) {
    c.ap = 0;
    endPlayerTurn();
  } else {
    bt.actionPhase = 'choosing_action';
    renderBattle();
  }
}

function endPlayerTurn() {
  const bt = S.battle;
  bt.actionPhase = null;
  bt.selectedCharIdx = null;
  bt.phase = 'resolving';
  nextTurn();
  renderBattle();
}

function nextTurn() {
  S.battle.currentTurnIdx++;
  processNextTurn();
}

// ── WIN/LOSE ─────────────────────────────────────────────
function checkWinCondition() {
  if (S.battle.boss.currentHp <= 0) {
    setTimeout(() => endBattle(true), 300);
  }
}

function endBattle(win) {
  const bt = S.battle;
  bt.phase = 'end';

  let drops = [];
  let exp = 0;
  let money = 0;

  if (win) {
    addLog('🎉 勝利！', 'sys');
    const boss = BOSSES[bt.bossId];
    exp = boss.drops.expReward;
    money = boss.drops.moneyReward;

    // 武器ドロップ（レア確定）
    const weaponDrop = boss.drops.weapons[Math.floor(Math.random() * boss.drops.weapons.length)];
    drops.push({ type:'weapon', ...weaponDrop });

    // 10%で2個
    if (Math.random() < 0.1) {
      const w2 = boss.drops.weapons[Math.floor(Math.random() * boss.drops.weapons.length)];
      drops.push({ type:'weapon', ...w2 });
    }

    // 素材ドロップ
    const matCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < matCount; i++) {
      const mat = boss.drops.materials[Math.floor(Math.random() * boss.drops.materials.length)];
      drops.push({ type:'material', name:mat });
    }

    // EXP付与
    const myChar = S.characters[S.lobby.myCharIndex];
    myChar.exp = (myChar.exp || 0) + exp;
    const newLevel = Math.floor(myChar.exp / 500) + 1;
    if (newLevel > myChar.level) {
      myChar.level = newLevel;
      addLog(`Lv.UP! → Lv.${newLevel}`, 'sys');
    }

    // お金追加
    S.inventory.money += money;
    save();
  } else {
    addLog('💀 全滅...', 'sys');
  }

  setTimeout(() => showScreen('result', { win, drops, exp, money }), 800);
}

// ── RESULT ────────────────────────────────────────────────
function renderResult(params) {
  const { win, drops, exp, money } = params;

  const dropHtml = drops.map(d => {
    if (d.type === 'weapon') {
      const rarityClass = { common:'r-common', uncommon:'r-uncommon', rare:'r-rare', epic:'r-epic', legend:'r-legend' }[d.rarity] || 'r-rare';
      return `<div class="drop-item">
        <div class="drop-icon">🔫</div>
        <div class="drop-info">
          <h4 class="${rarityClass}">${d.name}</h4>
          <p>スキル: ${(d.skills||[]).map(id=>SKILLS[id]?.name||id).join('、')}</p>
        </div>
      </div>`;
    }
    return `<div class="drop-item">
      <div class="drop-icon">📦</div>
      <div class="drop-info"><h4>${d.name}</h4><p>素材</p></div>
    </div>`;
  }).join('') || '<p style="color:var(--text2);text-align:center">ドロップなし</p>';

  render(`
    <div class="header">
      <div class="header-title">RAID FRONTIER</div>
    </div>
    <div class="scroll-area">
      <div class="result-banner ${win?'win':'lose'}">
        <h1>${win?'VICTORY':'DEFEAT'}</h1>
        <p>${win?'レイドをクリアした！':'全員が倒れてしまった…'}</p>
      </div>
      ${win ? `
        <div class="section">
          <div class="label">獲得EXP / マネー</div>
          <div class="card">
            <div class="stat-row"><span class="stat-name">EXP</span><span class="stat-value">+${exp}</span></div>
            <div class="stat-row"><span class="stat-name">マネー</span><span class="stat-value">+${money}</span></div>
          </div>
          <div class="label">ドロップアイテム</div>
          ${dropHtml}
        </div>
      ` : ''}
      <div class="section">
        <button class="btn btn-primary" onclick="showScreen('home')" style="margin-bottom:8px">
          🏠 ホームに戻る
        </button>
        ${win ? `<button class="btn btn-danger" onclick="openLobby()">⚔️ もう一度挑む</button>` : ''}
      </div>
    </div>
  `);
}

// ── BATTLE RENDER ─────────────────────────────────────────
function renderBattle() {
  const bt = S.battle;
  if (!bt) return;
  const boss = bt.boss;

  // ボスHP
  const bossHpPct = pct(boss.currentHp, boss.maxHp);
  const bossHpClass = hpClass(boss.currentHp, boss.maxHp);
  const bossBuffs = boss.buffs.map(b => `<span class="status-tag status-buff">ATK↑(${b.turns}T)</span>`).join('');
  const bossStuns = boss.statusEffects.filter(e=>e.type==='stun').map(e=>`<span class="status-tag status-debuff">スタン(${e.turns}T)</span>`).join('');

  // バトルログ
  const logHtml = bt.log.slice(-30).map(e =>
    `<div class="log-entry ${e.cls}">${e.msg}</div>`
  ).join('');

  // パーティカード
  const partyHtml = bt.party.map((c, i) => {
    const hpPct = pct(c.currentHp, c.maxHp);
    const hpCls = hpClass(c.currentHp, c.maxHp);
    const isActive = i === bt.selectedCharIdx && bt.phase === 'player_action';
    const apDots = Array.from({length:c.maxAp}, (_,j) =>
      `<div class="ap-dot ${j < c.ap ? 'ap-on' : 'ap-off'}"></div>`).join('');

    return `<div class="char-battle-card ${isActive?'active':''} ${c.currentHp<=0?'dead':''} ${c.isNPC?'npc-card':''}"
      onclick="${!c.isNPC && c.currentHp>0 ? 'selectPlayerChar('+i+')' : ''}">
      ${c.isNPC ? '<div class="npc-label">NPC</div>' : ''}
      <div class="cbc-name">${c.icon||'🧑'} ${c.name}</div>
      <div class="cbc-hp">${c.currentHp}/${c.maxHp}</div>
      <div class="hp-bar"><div class="hp-fill ${hpCls}" style="width:${hpPct}%"></div></div>
      <div class="cbc-pos"><span class="pos-badge pos-${c.position}">${POS_NAMES[c.position]}</span></div>
      <div class="ap-dots">${apDots}</div>
    </div>`;
  }).join('');

  // アクション UI
  let actionsHtml = '';
  if (bt.phase === 'player_action' && bt.selectedCharIdx !== null) {
    const c = bt.party[bt.selectedCharIdx];
    const w = WEAPONS[c.weaponId];
    const canAtk = w.attackSlots.includes(c.position) && (w.canAttackAfterMove || !c.hasMoved) && c.ap >= 1;
    const hasItems = bt.items.length > 0 && c.ap >= 1;

    if (bt.actionPhase === 'choosing_action') {
      actionsHtml = `
        <div class="turn-label">⚡ ${c.name} のターン（AP:${c.ap}）</div>
        <div class="action-grid">
          <button class="action-btn atk" ${!canAtk?'disabled':''} onclick="playerAttack()">
            🔫 攻撃
            <div class="action-desc">AP:1 / ${w.name}</div>
          </button>
          <button class="action-btn skl" onclick="showSkillPanel()">
            ✨ スキル
            <div class="action-desc">アクティブスキル使用</div>
          </button>
          <button class="action-btn mov" onclick="showMovePanel()">
            🚶 移動
            <div class="action-desc">AP:1 / ポジション変更</div>
          </button>
          <button class="action-btn itm" ${!hasItems?'disabled':''} onclick="showItemPanel()">
            💊 アイテム
            <div class="action-desc">${bt.items.length}個所持</div>
          </button>
        </div>
        <div style="margin-top:8px">
          <button class="btn btn-secondary btn-sm" onclick="endPlayerTurn()">ターン終了</button>
        </div>`;
    } else if (bt.actionPhase === 'choosing_move') {
      const posOrder = ['front','mid','back'];
      const posBtn = posOrder.map(pos => {
        const isCurrent = c.position === pos;
        return `<button class="pos-btn ${isCurrent?'current':'available'}" onclick="playerMove('${pos}')">
          ${POS_NAMES[pos]}${isCurrent?' ★':''}
        </button>`;
      }).join('');
      actionsHtml = `
        <div class="turn-label">移動先を選択</div>
        <div class="sub-panel">
          <div class="pos-select-grid">${posBtn}</div>
        </div>
        <div style="margin-top:8px">
          <button class="btn btn-secondary btn-sm" onclick="backToChoose()">戻る</button>
        </div>`;
    } else if (bt.actionPhase === 'choosing_skill') {
      const skills = (c.activeSkills||[]).map(id => {
        const sk = SKILLS[id]; if(!sk) return '';
        const ct = c.skillCTs[id] || 0;
        const onCt = ct > 0;
        return `<div class="skill-list-item ${onCt?'on-ct':''}" onclick="${!onCt && c.ap>=sk.apCost?`playerUseActiveSkill('${id}')`:''}">>
          <div>
            <div class="sli-name">${sk.name}</div>
            <div class="sli-desc">${sk.desc}</div>
          </div>
          <div class="sli-ct">${onCt?`CT:${ct}T`:`AP:${sk.apCost}`}</div>
        </div>`;
      }).join('') || '<p style="color:var(--text2);font-size:13px">スキルなし</p>';
      actionsHtml = `
        <div class="turn-label">スキルを選択</div>
        <div class="sub-panel">${skills}</div>
        <div style="margin-top:8px">
          <button class="btn btn-secondary btn-sm" onclick="backToChoose()">戻る</button>
        </div>`;
    } else if (bt.actionPhase === 'choosing_item') {
      const itemList = bt.items.map(id => {
        const def = CONSUMABLES[id]; if(!def) return '';
        return `<div class="skill-list-item" onclick="playerUseItem('${id}')">
          <div>
            <div class="sli-name">${def.icon} ${def.name}</div>
            <div class="sli-desc">${def.desc}</div>
          </div>
          <div class="sli-ct" style="color:var(--warn)">AP:1</div>
        </div>`;
      }).join('') || '<p style="color:var(--text2);font-size:13px">アイテムなし</p>';
      actionsHtml = `
        <div class="turn-label">アイテムを選択</div>
        <div class="sub-panel">${itemList}</div>
        <div style="margin-top:8px">
          <button class="btn btn-secondary btn-sm" onclick="backToChoose()">戻る</button>
        </div>`;
    }
  } else if (bt.phase === 'resolving') {
    actionsHtml = `<div class="turn-label" style="padding:8px 0">処理中...</div>`;
  } else if (bt.phase === 'end') {
    actionsHtml = `<div class="turn-label" style="padding:8px 0">バトル終了</div>`;
  } else {
    actionsHtml = `<div class="turn-label" style="padding:8px 0">待機中...</div>`;
  }

  render(`
    <div class="battle-wrap">
      <div class="battle-boss-area">
        <div class="boss-name-row">
          <div class="boss-name">${boss.icon} ${boss.name}</div>
          <div class="boss-turn">R.${bt.round}</div>
        </div>
        <div class="hp-bar" style="height:10px">
          <div class="hp-fill ${bossHpClass}" style="width:${bossHpPct}%"></div>
        </div>
        <div class="boss-hp-text">HP: ${boss.currentHp} / ${boss.maxHp}（${bossHpPct}%）</div>
        <div class="boss-status">${bossBuffs}${bossStuns}</div>
      </div>

      <div class="battle-log" id="battle-log">${logHtml}</div>

      <div class="battle-party-area">${partyHtml}</div>

      <div class="battle-actions-area">${actionsHtml}</div>
    </div>
  `);

  // ログを最下部にスクロール
  const logEl = document.getElementById('battle-log');
  if (logEl) logEl.scrollTop = logEl.scrollHeight;
}

function selectPlayerChar(idx) {
  const bt = S.battle;
  const c = bt.party[idx];
  if (c.isNPC || c.currentHp <= 0) return;
  if (bt.phase !== 'player_action') return;
  // 自分のターンのキャラのみ操作可
  const entity = bt.turnOrder[bt.currentTurnIdx];
  if (!entity || entity.type !== 'player' || entity.idx !== idx) {
    addLog('今はこのキャラのターンではない', 'sys');
    renderBattle();
    return;
  }
  bt.selectedCharIdx = idx;
  bt.actionPhase = 'choosing_action';
  renderBattle();
}

function showMovePanel()  { S.battle.actionPhase = 'choosing_move';  renderBattle(); }
function showSkillPanel() { S.battle.actionPhase = 'choosing_skill'; renderBattle(); }
function showItemPanel()  { S.battle.actionPhase = 'choosing_item';  renderBattle(); }
function backToChoose()   { S.battle.actionPhase = 'choosing_action'; renderBattle(); }

// ── LOG ─────────────────────────────────────────────────────
function addLog(msg, cls='') {
  S.battle.log.push({ msg, cls: 'log-entry log-'+cls });
}

// ── INIT ────────────────────────────────────────────────────
load();
showScreen('home');
