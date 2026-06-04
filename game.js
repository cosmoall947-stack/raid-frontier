// ============================================================
//  RAID FRONTIER — Game Logic & UI
// ============================================================

// ── GAME SPEED ─────────────────────────────────────────────
const GAME_SPEED = 0.6; // 1.0=標準速、0.6=ゆっくり
function delay(ms) { return Math.round(ms / GAME_SPEED); }

// ── DEBUG FLAG ─────────────────────────────────────────────
let DEBUG = false;

function toggleDebug() {
  DEBUG = !DEBUG;
  const btn = document.getElementById('debug-btn');
  if (btn) {
    btn.textContent = DEBUG ? '🐛 DEBUG ON' : '🐛';
    btn.style.background = DEBUG ? '#f85149' : '#21262d';
    btn.style.color = DEBUG ? '#fff' : '#8b949e';
  }
  if (DEBUG) {
    // デバッグ時はお金・素材を大量付与
    S.inventory.money = 99999;
    addDebugLog('🐛 デバッグモード ON：全スキル解放・お金MAX');
  } else {
    addDebugLog('🐛 デバッグモード OFF');
  }
  // 現在の画面を再描画
  showScreen(S.screen);
}

function addDebugLog(msg) {
  if (S.battle) addLog(msg, 'sys');
}

// デバッグボタンをどの画面にも表示するため、renderの後に差し込む
function injectDebugButton() {
  if (document.getElementById('debug-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'debug-btn';
  btn.textContent = DEBUG ? '🐛 DEBUG ON' : '🐛';
  btn.onclick = toggleDebug;
  btn.style.cssText = `
    position: fixed; top: 10px; right: 10px; z-index: 999;
    background: ${DEBUG ? '#f85149' : '#21262d'};
    color: ${DEBUG ? '#fff' : '#8b949e'};
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  `;
  document.body.appendChild(btn);
}

// ── STATE ──────────────────────────────────────────────────
let S = {
  screen: 'home',
  characters: [],      // 最大5キャラ
  activeCharIndex: 0,  // 現在操作中のキャラ
  inventory: { weapons:[], items:{}, money:0, materials:{} },
  clearedBosses: [],   // 撃破済みボスID一覧
  battle: null,
  lobby: null,
  partyTemplates: [null, null, null],  // { npc1Id, npc2Id, npc3Id, positions }
  itemTemplates:  [null, null, null],  // { items: [id,id,id] }
  onlineRoom: null,   // { roomId, playerId, isHost, partySlotIdx }
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
    case 'result':        renderResult(params);       break;
    case 'quest_list':    renderQuestList();           break;
    case 'quest_battle':  renderQuestBattle();         break;
    case 'quest_result':  renderQuestResult(params);   break;
    case 'shop':          renderShop();                break;
    case 'skill_tree':      renderSkillTree(params);          break;
    case 'weapon_inventory': renderWeaponInventoryScreen(params); break;
    case 'armor_inventory':  renderArmorInventoryScreen(params);  break;
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
  const w = WEAPONS[char.weaponId] || WEAPONS.m1_garand;
  const a = ARMORS[char.armorId]   || ARMORS.basic_jacket;
  let hp    = 200 + a.hpBonus;
  let atk   = w.baseAtk;
  let speed = 10 + w.speedMod + a.speedMod;
  let dodge = 5 + a.dodgeMod;           // 基本回避率 5%
  let crit  = 5 + (w.critBonus || 0);  // 基本クリ率 5%（HG+10%）
  let reduction = a.reduction;
  let atkMod = 1.0;

  // キャラパッシブスキル適用
  const passives = (char.passiveSkills || []).map(id => SKILLS[id]).filter(Boolean);
  for (const sk of passives) {
    const e = sk.effect;
    if (e.dodgeRate)       dodge     += e.dodgeRate;
    if (e.critRate)        crit      += e.critRate;
    if (e.atkMod)          atkMod    += e.atkMod;
    if (e.speedBonus)      speed     += e.speedBonus;
    if (e.hpBonus)         hp        += e.hpBonus;
    if (e.damageReduction) reduction += e.damageReduction;
  }

  // 武器パッシブスキル適用（装備中インベントリ武器）＋ボーナス追跡
  const invWeapon = (S.inventory?.weapons||[]).find(iw => iw.id === char._equippedWeaponInventoryId);
  const wpPassiveIds = (invWeapon?.skills||[]).filter(id => SKILLS[id]?.type === 'passive');
  // 武器固有ボーナス（critBonus等）も追跡
  const wpBonus = { hp:0, atk:0, speed:0, dodge: 0, crit: w.critBonus || 0, reduction:0 };

  // 武器パッシブはキャラスキルの2倍効果
  const WP_MULT = 2.0;
  for (const id of wpPassiveIds) {
    const sk = SKILLS[id];
    if (!sk) continue;
    const e = sk.effect;
    if (e.dodgeRate)       { const v = e.dodgeRate * WP_MULT;                dodge     += v; wpBonus.dodge     += v; }
    if (e.critRate)        { const v = e.critRate  * WP_MULT;                crit      += v; wpBonus.crit      += v; }
    if (e.atkMod)          { const v = e.atkMod    * WP_MULT; atkMod += v;                   wpBonus.atk       += Math.round(w.baseAtk * v); }
    if (e.speedBonus)      { const v = e.speedBonus* WP_MULT;                speed     += v; wpBonus.speed     += v; }
    if (e.hpBonus)         { const v = e.hpBonus   * WP_MULT;                hp        += v; wpBonus.hp        += v; }
    if (e.damageReduction) { const v = e.damageReduction * WP_MULT;          reduction += v; wpBonus.reduction += Math.round(v * 100); }
  }

  // 速さ → 回避率に加算（speed確定後）
  dodge += Math.floor(speed / 3);

  return { hp, maxHp:hp, atk: Math.round(atk * atkMod), speed, dodge, crit, reduction,
           weapon:w, armor:a, wpBonus };
}

// ── CHAR AVATAR HELPER ─────────────────────────────────────
function charAvatarHtml(char, size = 40) {
  if (char?.customImage) {
    return `<img src="${char.customImage}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0">`;
  }
  return `<span style="font-size:${Math.round(size*0.75)}px;line-height:1">${char?.icon || '🧑'}</span>`;
}

// ── RADAR CHART ────────────────────────────────────────────
function renderRadarChart(st) {
  const cx = 110, cy = 110, r = 74, lOff = r + 26;

  const maxVals = [500, 250, 22, 100, 100, 100];
  const rawVals = [
    st.hp,
    st.atk,
    st.speed,
    st.dodge,
    st.crit,
    Math.round(st.reduction * 100),
  ];
  const units  = ['', '', '', '%', '%', '%'];
  const labels = ['HP', 'ATK', '速さ', '回避', 'CRT', '軽減'];

  const n = 6;
  const angles = Array.from({length: n}, (_, i) => -Math.PI / 2 + (2 * Math.PI / n) * i);
  const ratios  = rawVals.map((v, i) => Math.min(Math.max(v / maxVals[i], 0.04), 1.0));

  // グリッド（3段）
  const grids = [1/3, 2/3, 1].map(lv => {
    const pts = angles.map(a =>
      `${(cx + r*lv*Math.cos(a)).toFixed(1)},${(cy + r*lv*Math.sin(a)).toFixed(1)}`
    ).join(' ');
    return `<polygon points="${pts}" fill="${lv===1?'rgba(88,166,255,0.04)':'none'}" stroke="#30363d" stroke-width="${lv===1?'1':'0.8'}"/>`;
  }).join('');

  // 軸線
  const axes = angles.map(a =>
    `<line x1="${cx}" y1="${cy}" x2="${(cx+r*Math.cos(a)).toFixed(1)}" y2="${(cy+r*Math.sin(a)).toFixed(1)}" stroke="#30363d" stroke-width="0.8"/>`
  ).join('');

  // データ多角形
  const dataPts = ratios.map((v, i) =>
    `${(cx + r*v*Math.cos(angles[i])).toFixed(1)},${(cy + r*v*Math.sin(angles[i])).toFixed(1)}`
  ).join(' ');

  // ラベル＋値
  const labelEls = labels.map((lbl, i) => {
    const lx = cx + lOff * Math.cos(angles[i]);
    const ly = cy + lOff * Math.sin(angles[i]);
    const anchor = Math.abs(lx - cx) < 10 ? 'middle' : (lx > cx ? 'start' : 'end');
    return `
      <text x="${lx.toFixed(1)}" y="${(ly - 5).toFixed(1)}" text-anchor="${anchor}" font-size="11" fill="#8b949e" font-family="sans-serif">${lbl}</text>
      <text x="${lx.toFixed(1)}" y="${(ly + 8).toFixed(1)}" text-anchor="${anchor}" font-size="11" fill="#c9d1d9" font-weight="bold" font-family="sans-serif">${rawVals[i]}${units[i]}</text>`;
  }).join('');

  return `<svg width="210" height="210" viewBox="-15 -15 250 250" xmlns="http://www.w3.org/2000/svg">
    ${grids}${axes}
    <polygon points="${dataPts}" fill="rgba(88,166,255,0.20)" stroke="#58a6ff" stroke-width="2" stroke-linejoin="round"/>
    ${labelEls}
  </svg>`;
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
          <div class="char-avatar">${charAvatarHtml(c, 40)}</div>
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
          <button class="btn btn-secondary" ${!hasChars?'disabled':''} onclick="showScreen('quest_list')" style="margin-bottom:8px">
            🗺️ クエスト
          </button>
          <button class="btn btn-secondary" onclick="showScreen('shop')">
            🛒 ショップ
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

  const canCreate = f.name.trim();
  const defWeapon = WEAPONS['m1_garand'];
  const defArmor  = ARMORS['basic_jacket'];

  render(`
    <div class="header">
      <button class="back-btn" onclick="showScreen('home')">‹</button>
      <div class="header-title">キャラ作成</div>
    </div>
    <div class="scroll-area">
      <div class="section">

        <div class="label">キャラクター名</div>
        <input class="input" type="text" placeholder="名前を入力" value="${f.name}"
          oninput="S.createForm.name=this.value; document.getElementById('create-btn').disabled=!this.value.trim()" maxlength="16">

        <div class="label">初期装備（固定）</div>
        <div class="card">
          <div class="stat-row">
            <span class="stat-name">武器</span>
            <span class="stat-value">${defWeapon.icon} ${defWeapon.name}</span>
          </div>
          <div style="font-size:11px;color:var(--text2);margin-top:2px;margin-bottom:8px">${defWeapon.desc}</div>
          <div class="stat-row">
            <span class="stat-name">防具</span>
            <span class="stat-value">${defArmor.icon} ${defArmor.name}</span>
          </div>
          <div style="font-size:11px;color:var(--text2);margin-top:2px">${defArmor.desc}</div>
        </div>

        <div class="card" style="margin-top:8px;color:var(--text2);font-size:13px;text-align:center">
          💡 武器はクエストドロップ・防具はショップで強化できます
          ${DEBUG ? '<br><span style="color:#f85149;font-weight:700">🐛 デバッグ：作成後にキャラ詳細でスキルを即習得できます</span>' : ''}
        </div>

        <div style="margin-top:16px">
          <button id="create-btn" class="btn btn-primary" disabled onclick="createChar()">
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
  if (!f.name.trim()) return;
  const newChar = {
    id: 'char_' + Date.now(),
    name: f.name.trim(),
    icon: CHAR_ICONS[Math.floor(Math.random() * CHAR_ICONS.length)],
    weaponId: 'm1_garand',
    armorId: 'basic_jacket',
    passiveSkills: [],
    activeSkills: [],
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

  const passiveChips = (c.passiveSkills||[]).map((id, i, arr) => {
    const sk = SKILLS[id]; if(!sk) return '';
    const isLast = i === arr.length - 1;
    return `<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;${isLast?'':'border-bottom:1px solid var(--border)'}">
      <span style="font-size:9px;padding:2px 5px;border-radius:3px;background:var(--accent);color:#0d1117;font-weight:700;flex-shrink:0;margin-top:2px">P</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--accent)">${sk.name}</div>
        <div style="font-size:11px;color:var(--text2);margin-top:2px">${sk.desc}</div>
      </div>
    </div>`;
  }).join('');
  const activeChips = (c.activeSkills||[]).map((id, i, arr) => {
    const sk = SKILLS[id]; if(!sk) return '';
    const isLast = i === arr.length - 1;
    return `<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;${isLast?'':'border-bottom:1px solid var(--border)'}">
      <span style="font-size:9px;padding:2px 5px;border-radius:3px;background:var(--purple);color:#fff;font-weight:700;flex-shrink:0;margin-top:2px">A</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--purple)">${sk.name}</div>
        <div style="font-size:11px;color:var(--text2);margin-top:2px">${sk.desc}</div>
        <div style="font-size:11px;color:var(--text2);margin-top:1px">CT:${sk.ct}T / AP:${sk.apCost}</div>
      </div>
    </div>`;
  }).join('');

  render(`
    <div class="header">
      <button class="back-btn" onclick="showScreen('home')">‹</button>
      <div class="header-title">${c.icon} ${c.name}</div>
    </div>
    <div class="scroll-area">
      <div class="section">
        <div class="card" style="text-align:center">
          <div style="position:relative;display:inline-block;cursor:pointer" onclick="uploadCharImage(${index})">
            ${c.customImage
              ? `<img src="${c.customImage}" style="width:88px;height:88px;border-radius:50%;object-fit:cover;border:2px solid var(--border)">`
              : `<div style="font-size:64px;line-height:1">${c.icon}</div>`
            }
            <div style="position:absolute;bottom:0;right:0;background:var(--accent);color:#0d1117;font-size:10px;font-weight:700;padding:2px 6px;border-radius:8px">編集</div>
          </div>
          <div style="font-size:11px;color:var(--text2);margin-top:6px">タップして画像を変更</div>
          ${c.customImage ? `<button onclick="resetCharImage(${index})" style="font-size:11px;padding:3px 10px;border-radius:6px;border:none;cursor:pointer;background:var(--bg3);color:var(--text2);margin-top:4px">絵文字に戻す</button>` : ''}
          <div class="label" style="margin-top:8px;text-align:center">Lv.${c.level}</div>
        </div>

        <div class="label">ステータス</div>
        <div class="card" style="display:flex;align-items:center;gap:10px">
          <div style="flex:1;min-width:0">
            ${[
              ['HP',         st.hp,                         '',  st.wpBonus?.hp        || 0, '' ],
              ['攻撃力',      st.atk,                        '',  st.wpBonus?.atk       || 0, '' ],
              ['素早さ',      st.speed,                      '',  st.wpBonus?.speed     || 0, '' ],
              ['回避率',      st.dodge,                      '%', st.wpBonus?.dodge     || 0, '%'],
              ['クリティカル', st.crit,                       '%', st.wpBonus?.crit      || 0, '%'],
              ['ダメージ軽減', Math.round(st.reduction*100), '%', st.wpBonus?.reduction || 0, '%'],
            ].map(([name, val, unit, bonus, bunit]) => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border)">
                <span style="font-size:12px;color:var(--text2)">${name}</span>
                <span style="font-size:13px;font-weight:700">
                  ${val}${unit}${bonus > 0 ? `<span style="font-size:11px;color:var(--success);margin-left:3px">(+${bonus}${bunit})</span>` : ''}
                </span>
              </div>`).join('')}
          </div>
          <div style="flex-shrink:0">
            ${renderRadarChart(st)}
          </div>
        </div>

        <div class="label">装備</div>
        ${(() => {
          const equippedInv = (S.inventory.weapons||[]).find(iw => iw.id === c._equippedWeaponInventoryId);
          const rc = { common:'r-common', uncommon:'r-uncommon', rare:'r-rare', epic:'r-epic', legend:'r-legend' };
          const ri = { legend:'👑', epic:'💜', rare:'💙', uncommon:'🟢', common:'⬜' };
          const rl = { legend:'LEGEND', epic:'EPIC', rare:'RARE', uncommon:'UNCOMMON', common:'COMMON' };
          const skillBadge = isAct => isAct
            ? `<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:var(--purple);color:#fff;font-weight:700;flex-shrink:0">A</span>`
            : `<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:var(--accent);color:#0d1117;font-weight:700;flex-shrink:0">P</span>`;
          const skillsHtml = equippedInv?.skills?.length
            ? equippedInv.skills.map(id => {
                const sk = SKILLS[id];
                if (!sk) return '';
                return `<div style="display:flex;align-items:baseline;gap:4px;margin-top:3px">
                  <span style="font-size:11px;color:var(--text2)">・</span>
                  ${skillBadge(sk.type === 'active')}
                  <span style="font-size:11px;color:var(--text2)">${sk.name}（${sk.desc}）</span>
                </div>`;
              }).join('')
            : `<div style="font-size:11px;color:var(--text2);margin-top:3px">スキルなし</div>`;

          return `<div class="card" style="cursor:pointer;border:1px solid var(--border);transition:border-color .15s"
            onclick="showScreen('weapon_inventory',${index})"
            onmouseenter="this.style.borderColor='var(--accent)'"
            onmouseleave="this.style.borderColor='var(--border)'">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <span style="font-size:11px;color:var(--text2);font-weight:700">武器</span>
              <span style="font-size:16px;color:var(--accent)">›</span>
            </div>
            <div style="display:flex;align-items:center;gap:12px">
              <div style="flex-shrink:0">${weaponImg(c.weaponId, 80, 52)}</div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:3px">
                  <span style="font-size:13px;font-weight:700">${equippedInv ? equippedInv.name : w?.name}</span>
                  ${weaponTierBadge(c.weaponId)}
                  ${w?.isPlaceholder ? '<span style="font-size:10px;color:var(--text2)">(準備中)</span>' : ''}
                </div>
                ${equippedInv ? `
                  <div style="font-size:11px;margin-bottom:2px">
                    <span class="${rc[equippedInv.rarity]||''}">${ri[equippedInv.rarity]||''} ${rl[equippedInv.rarity]||''}</span>
                  </div>
                  <div style="font-size:11px;color:var(--text2);margin-bottom:1px">ATK ${WEAPONS[equippedInv.weaponId]?.baseAtk||'?'}</div>
                  ${skillsHtml}
                ` : `<div style="font-size:11px;color:var(--text2)">ATK ${w?.baseAtk||'?'}</div>`}
              </div>
            </div>
            <div style="font-size:11px;color:var(--text2);margin-top:8px">タップして武器を変更</div>
          </div>`;
        })()}

        ${(() => {
          const armorStats = [];
          if (a.reduction > 0)     armorStats.push({ label:'ダメージ軽減', val:`${Math.round(a.reduction*100)}%`, positive:true });
          if (a.dodgeMod !== 0)    armorStats.push({ label:'回避率',       val:`${a.dodgeMod>0?'+':''}${a.dodgeMod}%`, positive:a.dodgeMod>0 });
          if (a.hpBonus !== 0)     armorStats.push({ label:'HP',           val:`${a.hpBonus>0?'+':''}${a.hpBonus}`,    positive:a.hpBonus>0 });
          if (a.speedMod !== 0)    armorStats.push({ label:'素早さ',        val:`${a.speedMod>0?'+':''}${a.speedMod}`,  positive:a.speedMod>0 });
          if (a.moveCostExtra > 0) armorStats.push({ label:'移動コスト',    val:`+${a.moveCostExtra}`,                  positive:false });
          const statsHtml = armorStats.length
            ? armorStats.map(s => `
                <div style="display:flex;align-items:center;gap:6px;margin-top:3px">
                  <span style="font-size:11px;color:var(--text2)">・${s.label}</span>
                  <span style="font-size:11px;font-weight:700;color:${s.positive?'var(--success)':'var(--danger)'}">${s.val}</span>
                </div>`).join('')
            : `<div style="font-size:11px;color:var(--text2);margin-top:3px">効果なし（スタンダード）</div>`;
          return `<div class="card" style="cursor:pointer;border:1px solid var(--border);transition:border-color .15s"
            onclick="showScreen('armor_inventory',${index})"
            onmouseenter="this.style.borderColor='var(--accent)'"
            onmouseleave="this.style.borderColor='var(--border)'">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <span style="font-size:11px;color:var(--text2);font-weight:700">防具</span>
              <span style="font-size:16px;color:var(--accent)">›</span>
            </div>
            <div style="display:flex;align-items:center;gap:12px">
              <div style="font-size:48px;flex-shrink:0;line-height:1">${a?.icon}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:700;margin-bottom:4px">${a?.name}</div>
                <div style="font-size:11px;color:var(--text2);margin-bottom:4px">${a?.desc}</div>
                ${statsHtml}
              </div>
            </div>
            <div style="font-size:11px;color:var(--text2);margin-top:8px">タップして防具を変更</div>
          </div>`;
        })()}

        <div class="label" style="display:flex;justify-content:space-between;align-items:center">
          <span>パッシブスキル</span>
          <span style="font-size:12px;color:var(--text2);font-weight:700">${(c.passiveSkills||[]).length}/${3 + ((c.passiveSkills||[]).some(id=>SKILLS[id]?.effect?.extraSlot)?1:0)}</span>
        </div>
        <div class="card">${passiveChips || '<span style="color:var(--text2);font-size:13px">なし</span>'}</div>

        <div class="label" style="display:flex;justify-content:space-between;align-items:center">
          <span>アクティブスキル</span>
          <span style="font-size:12px;color:var(--text2);font-weight:700">${(c.activeSkills||[]).length}/2</span>
        </div>
        <div class="card">${activeChips || '<span style="color:var(--text2);font-size:13px">なし</span>'}</div>

        ${DEBUG ? renderDebugSkillPanel(c, index) : ''}

        <div style="margin-top:16px">
          <button class="btn btn-secondary" style="margin-bottom:8px"
            onclick="showScreen('skill_tree',${index})">
            ✨ スキル習得（SP: ${getCharSP(c)}）
          </button>
          <button class="btn btn-secondary" style="margin-bottom:8px"
            onclick="exportChar(${index})">
            📤 フレンドに共有
          </button>
          <button class="btn btn-danger" style="margin-bottom:8px"
            onclick="deleteChar(${index})">キャラクターを削除</button>
        </div>
      </div>
    </div>
  `);
}

function renderDebugSkillPanel(c, index) {
  const passives = Object.values(SKILLS).filter(s => s.type === 'passive');
  const actives  = Object.values(SKILLS).filter(s => s.type === 'active');

  const passiveList = passives.map(s => {
    const has = (c.passiveSkills||[]).includes(s.id);
    const full = !has && (c.passiveSkills||[]).length >= 3;
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:12px">${s.name}</span>
      <button onclick="${has ? `debugRemoveSkill(${index},'${s.id}','passive')` : full ? '' : `debugAddSkill(${index},'${s.id}','passive')`}"
        style="font-size:11px;padding:3px 8px;border-radius:4px;border:none;cursor:${full?'not-allowed':'pointer'};
        background:${has?'#f85149':full?'#21262d':'#3fb950'};color:#fff;opacity:${full?0.4:1}">
        ${has ? '削除' : full ? '満杯' : '追加'}
      </button>
    </div>`;
  }).join('');

  const activeList = actives.map(s => {
    const has = (c.activeSkills||[]).includes(s.id);
    const full = !has && (c.activeSkills||[]).length >= 2;
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:12px">${s.name} <span style="color:var(--text2)">CT:${s.ct}T</span></span>
      <button onclick="${has ? `debugRemoveSkill(${index},'${s.id}','active')` : full ? '' : `debugAddSkill(${index},'${s.id}','active')`}"
        style="font-size:11px;padding:3px 8px;border-radius:4px;border:none;cursor:${full?'not-allowed':'pointer'};
        background:${has?'#f85149':full?'#21262d':'#3fb950'};color:#fff;opacity:${full?0.4:1}">
        ${has ? '削除' : full ? '満杯' : '追加'}
      </button>
    </div>`;
  }).join('');

  return `
    <div class="label" style="color:#f85149">🐛 デバッグ：スキル編集</div>
    <div class="card">
      <div style="font-size:12px;color:var(--text2);margin-bottom:8px">パッシブ（${(c.passiveSkills||[]).length}/3）</div>
      ${passiveList}
      <div style="font-size:12px;color:var(--text2);margin:12px 0 8px">アクティブ（${(c.activeSkills||[]).length}/2）</div>
      ${activeList}
    </div>`;
}

function debugAddSkill(charIndex, skillId, type) {
  const c = S.characters[charIndex];
  if (type === 'passive' && (c.passiveSkills||[]).length < 3) {
    c.passiveSkills = [...(c.passiveSkills||[]), skillId];
  } else if (type === 'active' && (c.activeSkills||[]).length < 2) {
    c.activeSkills = [...(c.activeSkills||[]), skillId];
  }
  save();
  showScreen('char_detail', charIndex);
}

function debugRemoveSkill(charIndex, skillId, type) {
  const c = S.characters[charIndex];
  if (type === 'passive') c.passiveSkills = (c.passiveSkills||[]).filter(id => id !== skillId);
  if (type === 'active')  c.activeSkills  = (c.activeSkills||[]).filter(id => id !== skillId);
  save();
  showScreen('char_detail', charIndex);
}

function exportChar(index) {
  const c = S.characters[index];
  const code = btoa(JSON.stringify(c));
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code).then(() => {
      alert('キャラクターコードをコピーしました！\nフレンドに送ってください。');
    }).catch(() => {
      prompt('このコードをコピーしてフレンドに送ってください:', code);
    });
  } else {
    prompt('このコードをコピーしてフレンドに送ってください:', code);
  }
}

// ── CHAR IMAGE UPLOAD ─────────────────────────────────────
function uploadCharImage(index) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    processCharImage(index, file);
  };
  input.click();
}

function processCharImage(index, file) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      // 最大256×256にリサイズ
      const MAX = 256;
      let w = img.width, h = img.height;
      if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
      else        { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }

      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);

      // JPEG圧縮（quality:0.75）でサイズ削減
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      S.characters[index].customImage = dataUrl;
      save();
      showScreen('char_detail', index);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function resetCharImage(index) {
  delete S.characters[index].customImage;
  save();
  showScreen('char_detail', index);
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
    bossId: 'alpha_01',
    myCharIndex: 0,
    npc1: null,
    npc2: null,
    npc3: null,
    items: [null, null, null],
    selectingNPC: null,
    selectingItem: null,
    positions: { 0: 'front', 1: 'mid', 2: 'back', 3: 'mid' }, // 0=自分・1=NPC1・2=NPC2・3=NPC3
  };
  showScreen('lobby');
}

function renderLobby() {
  const lb = S.lobby;
  const boss = BOSSES[lb.bossId];
  const myChar = S.characters[lb.myCharIndex];
  const st = calcStats(myChar);

  // ポジション選択ボタン
  const POS_ORDER = ['front','mid','back'];
  function posSelector(slotIdx) {
    const cur = lb.positions[slotIdx];
    return `<div style="display:flex;gap:3px;margin-top:5px;justify-content:center">
      ${POS_ORDER.map(pos => `
        <button onclick="setLobbyPosition(${slotIdx},'${pos}')" style="
          font-size:10px;padding:2px 7px;border-radius:4px;border:none;cursor:pointer;
          background:${cur===pos?'var(--accent)':'var(--bg2)'};
          color:${cur===pos?'#0d1117':'var(--text2)'};
          font-weight:${cur===pos?'700':'400'}">
          ${POS_NAMES[pos]}
        </button>`).join('')}
    </div>`;
  }

  // パーティスロット表示
  function slotHtml(char, label, slotIdx) {
    if (char) {
      return `<div class="lobby-slot filled" style="padding-bottom:6px">
        <div class="ls-label">${label}</div>
        <div class="ls-name" style="display:flex;align-items:center;gap:5px">${charAvatarHtml(char,20)} ${char.name}</div>
        <div class="ls-sub">${WEAPONS[char.weaponId]?.name || '?'}</div>
        ${posSelector(slotIdx)}
      </div>`;
    }
    return `<div class="lobby-slot" style="padding-bottom:6px">
      <div class="ls-label">${label}</div>
      <div class="ls-name" style="color:var(--text2)">未選択</div>
      ${posSelector(slotIdx)}
    </div>`;
  }

  // NPC選択肢HTML（自分の他キャラ + インポート済み + テンプレートNPC）
  const myOtherChars = S.characters.filter((c, i) => i !== lb.myCharIndex);
  const importedChars = S.importedChars || [];

  const myCharChoices = myOtherChars.map(c => `
    <div class="npc-choice" onclick="selectNPC('${c.id}')">
      <div class="npc-icon">${charAvatarHtml(c, 36)}</div>
      <div class="npc-info">
        <h4>${c.name} <span style="font-size:10px;color:var(--success)">自キャラ</span></h4>
        <p>${WEAPONS[c.weaponId]?.name || '?'} | Lv.${c.level}</p>
      </div>
    </div>`).join('');

  const importedChoices = importedChars.map(c => `
    <div class="npc-choice" onclick="selectNPC('${c.id}')">
      <div class="npc-icon">${c.icon||'🤖'}</div>
      <div class="npc-info">
        <h4>${c.name} <span style="font-size:10px;color:var(--purple)">フレンド</span></h4>
        <p>${WEAPONS[c.weaponId]?.name || '?'} | Lv.${c.level}</p>
      </div>
    </div>`).join('');

  const npcChoices = TEMPLATE_NPCS.map(n => `
    <div class="npc-choice" onclick="selectNPC('${n.id}')">
      <div class="npc-icon">${n.icon}</div>
      <div class="npc-info">
        <h4>${n.name}</h4>
        <p>${WEAPONS[n.weaponId]?.name} | Lv.${n.level}</p>
      </div>
    </div>`).join('');

  // テンプレートスロットUI生成
  function templateSlotsHtml(type) {
    const templates = type === 'party' ? (S.partyTemplates||[null,null,null]) : (S.itemTemplates||[null,null,null]);
    const saveLabel = type === 'party' ? 'パーティテンプレ' : 'アイテムテンプレ';
    const saveFn  = type === 'party' ? 'savePartyTemplate'  : 'saveItemTemplate';
    const loadFn  = type === 'party' ? 'loadPartyTemplate'  : 'loadItemTemplate';
    const delFn   = type === 'party' ? 'deletePartyTemplate': 'deleteItemTemplate';
    const slots = [0,1,2].map(i => {
      const t = templates[i];
      return `<div style="flex:1;border:1px solid var(--border);border-radius:6px;padding:5px 4px;text-align:center">
        <div style="font-size:10px;color:var(--text2);margin-bottom:4px">スロット${i+1}</div>
        ${t
          ? `<button onclick="${loadFn}(${i})" style="font-size:10px;padding:2px 6px;border-radius:4px;border:none;cursor:pointer;background:var(--accent);color:#0d1117;font-weight:700;width:100%;margin-bottom:3px">読込</button>
             <div style="display:flex;gap:3px">
               <button onclick="${saveFn}(${i})" style="font-size:10px;padding:2px 4px;border-radius:4px;border:none;cursor:pointer;background:var(--bg3);color:var(--text);flex:1">上書</button>
               <button onclick="${delFn}(${i})" style="font-size:10px;padding:2px 4px;border-radius:4px;border:none;cursor:pointer;background:var(--bg3);color:var(--danger);flex:1">削除</button>
             </div>`
          : `<button onclick="${saveFn}(${i})" style="font-size:10px;padding:2px 6px;border-radius:4px;border:none;cursor:pointer;background:var(--bg3);color:var(--text2);width:100%">保存</button>`
        }
      </div>`;
    }).join('');
    return `<div style="margin-top:8px">
      <div style="font-size:11px;color:var(--text2);margin-bottom:5px">${saveLabel}</div>
      <div style="display:flex;gap:6px">${slots}</div>
    </div>`;
  }

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
        <div class="overlay-title">仲間を選ぶ</div>
        ${myCharChoices ? `<div style="font-size:11px;color:var(--success);font-weight:700;margin-bottom:4px">👤 自分のキャラ</div>${myCharChoices}` : ''}
        ${importedChoices ? `<div style="font-size:11px;color:var(--purple);font-weight:700;margin:8px 0 4px">🤝 フレンドキャラ</div>${importedChoices}` : ''}
        <div style="font-size:11px;color:var(--text2);font-weight:700;margin:${myCharChoices||importedChoices?'8px':'0'} 0 4px">🤖 テンプレートNPC</div>
        ${npcChoices}
        <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px">
          <button class="btn btn-secondary btn-sm" onclick="openFriendImport()">📥 フレンドコードを入力</button>
        </div>
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

        <div class="label">ボスを選択</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:4px">
          ${BOSS_ORDER.map(bid => {
            const b = BOSSES[bid];
            const sel = lb.bossId === bid;
            const cleared = (S.clearedBosses||[]).includes(bid);
            return `<div onclick="selectBoss('${bid}')" style="
              background:var(--bg3);border:2px solid ${sel?'var(--pink)':'var(--border)'};
              border-radius:10px;padding:10px 12px;cursor:pointer;
              display:flex;align-items:center;gap:10px;
              background:${sel?'#f778ba11':'var(--bg3)'}">
              <div style="font-size:24px">${b.icon}</div>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:700;color:${sel?'var(--pink)':'var(--text)'}">${b.name}</div>
                <div style="font-size:11px;color:var(--text2)">推奨Lv.${b.recommendedLevel} ${'★'.repeat(b.difficulty)}${'☆'.repeat(5-b.difficulty)}</div>
              </div>
              ${cleared?'<span style="font-size:11px;color:var(--success);font-weight:700">✓ 撃破済</span>':''}
            </div>`;
          }).join('')}
        </div>

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
            <span class="stat-value">${boss.drops.expReward.toLocaleString()}</span>
          </div>
          <div class="stat-row" style="align-items:flex-start">
            <span class="stat-name" style="padding-top:2px">ドロップ武器</span>
            <div style="display:flex;flex-direction:column;gap:3px;text-align:right">
              ${(() => {
                const rc = { common:'r-common', uncommon:'r-uncommon', rare:'r-rare', epic:'r-epic', legend:'r-legend' };
                const rl = { common:'COMMON', uncommon:'UNCOMMON', rare:'RARE', epic:'EPIC', legend:'LEGEND' };
                const hw = boss.drops.weapons.find(w => w.highlight) || boss.drops.weapons[0];
                return `<span style="font-size:11px"><span class="${rc[hw.rarity]||'r-rare'}" style="font-weight:700">[${rl[hw.rarity]||hw.rarity.toUpperCase()}]</span> ${hw.name} <span style="color:var(--text2)">など</span></span>`;
              })()}
            </div>
          </div>
        </div>

        <div class="label">パーティ編成</div>
        <div class="lobby-party-slots">
          ${slotHtml(myChar, '自分', 0)}
          <div class="lobby-slot ${lb.npc1?'filled':''}" style="padding-bottom:6px">
            <div class="ls-label" onclick="openNPCPicker(1)" style="cursor:pointer">NPC ① ＋</div>
            ${lb.npc1
              ? `<div class="ls-name" style="display:flex;align-items:center;gap:5px">${charAvatarHtml(lb.npc1,20)} ${lb.npc1.name}</div><div class="ls-sub">${WEAPONS[lb.npc1.weaponId]?.name}</div>`
              : `<div class="ls-name" style="color:var(--accent);font-size:12px;cursor:pointer" onclick="openNPCPicker(1)">＋ 選択</div>`
            }
            ${posSelector(1)}
          </div>
          <div class="lobby-slot ${lb.npc2?'filled':''}" style="padding-bottom:6px">
            <div class="ls-label" onclick="openNPCPicker(2)" style="cursor:pointer">NPC ② ＋</div>
            ${lb.npc2
              ? `<div class="ls-name" style="display:flex;align-items:center;gap:5px">${charAvatarHtml(lb.npc2,20)} ${lb.npc2.name}</div><div class="ls-sub">${WEAPONS[lb.npc2.weaponId]?.name}</div>`
              : `<div class="ls-name" style="color:var(--accent);font-size:12px;cursor:pointer" onclick="openNPCPicker(2)">＋ 選択</div>`
            }
            ${posSelector(2)}
          </div>
          <div class="lobby-slot ${lb.npc3?'filled':''}" style="padding-bottom:6px">
            <div class="ls-label" onclick="openNPCPicker(3)" style="cursor:pointer">NPC ③ ＋</div>
            ${lb.npc3
              ? `<div class="ls-name" style="display:flex;align-items:center;gap:5px">${charAvatarHtml(lb.npc3,20)} ${lb.npc3.name}</div><div class="ls-sub">${WEAPONS[lb.npc3.weaponId]?.name}</div>`
              : `<div class="ls-name" style="color:var(--accent);font-size:12px;cursor:pointer" onclick="openNPCPicker(3)">＋ 選択</div>`
            }
            ${posSelector(3)}
          </div>
        </div>

        ${templateSlotsHtml('party')}

        <div class="label">持ち込みアイテム（最大3つ）</div>
        <div class="item-slots">${itemSlotsHtml}</div>
        ${templateSlotsHtml('item')}

        ${renderOnlineLobbySection()}

        <div style="margin-top:20px">
          ${S.onlineRoom
            ? S.onlineRoom.isHost
              ? `<button class="btn btn-danger" onclick="onlineStartRaid()">⚔️ オンラインレイド開始</button>`
              : `<div style="text-align:center;color:var(--text2);padding:12px">ホストの開始を待っています...</div>`
            : `<button class="btn btn-danger" onclick="startRaid()">⚔️ レイド開始</button>`
          }
        </div>

      </div>
    </div>
    ${overlayHtml}
  `);
}

function selectBoss(bossId) { S.lobby.bossId = bossId; renderLobby(); }
function setLobbyPosition(slotIdx, pos) { S.lobby.positions[slotIdx] = pos; renderLobby(); }
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
  let npc = TEMPLATE_NPCS.find(n => n.id === id);
  if (!npc) npc = S.characters.find(c => c.id === id);
  if (!npc) npc = (S.importedChars||[]).find(c => c.id === id);
  if (!npc) return;
  // 自キャラをNPCとして使う場合はNPCフラグを付ける（コピー）
  const npcEntry = { ...npc, isNPC: true };
  if (S.lobby.selectingNPC === 1) S.lobby.npc1 = npcEntry;
  else if (S.lobby.selectingNPC === 2) S.lobby.npc2 = npcEntry;
  else S.lobby.npc3 = npcEntry;
  S.lobby.selectingNPC = null;
  renderLobby();
}

// ── LOBBY TEMPLATES ────────────────────────────────────────
function savePartyTemplate(i) {
  const lb = S.lobby;
  if (!S.partyTemplates) S.partyTemplates = [null, null, null];
  S.partyTemplates[i] = {
    npc1Id: lb.npc1?.id || null,
    npc2Id: lb.npc2?.id || null,
    npc3Id: lb.npc3?.id || null,
    positions: { ...lb.positions },
  };
  save(); renderLobby();
}
function loadPartyTemplate(i) {
  const t = (S.partyTemplates||[])[i];
  if (!t) return;
  function findNpc(id) {
    if (!id) return null;
    return TEMPLATE_NPCS.find(n => n.id === id)
        || S.characters.find(c => c.id === id)
        || (S.importedChars||[]).find(c => c.id === id) || null;
  }
  const lb = S.lobby;
  lb.npc1 = findNpc(t.npc1Id) ? { ...findNpc(t.npc1Id), isNPC: true } : null;
  lb.npc2 = findNpc(t.npc2Id) ? { ...findNpc(t.npc2Id), isNPC: true } : null;
  lb.npc3 = findNpc(t.npc3Id) ? { ...findNpc(t.npc3Id), isNPC: true } : null;
  lb.positions = { ...t.positions };
  renderLobby();
}
function deletePartyTemplate(i) {
  if (!S.partyTemplates) return;
  S.partyTemplates[i] = null;
  save(); renderLobby();
}
function saveItemTemplate(i) {
  const lb = S.lobby;
  if (!S.itemTemplates) S.itemTemplates = [null, null, null];
  S.itemTemplates[i] = { items: [...lb.items] };
  save(); renderLobby();
}
function loadItemTemplate(i) {
  const t = (S.itemTemplates||[])[i];
  if (!t) return;
  S.lobby.items = [...t.items];
  renderLobby();
}
function deleteItemTemplate(i) {
  if (!S.itemTemplates) return;
  S.itemTemplates[i] = null;
  save(); renderLobby();
}

function openFriendImport() {
  const code = prompt('フレンドのキャラクターコードを貼り付けてください:');
  if (!code) return;
  try {
    const char = JSON.parse(atob(code.trim()));
    if (!char.name || !char.weaponId) throw new Error('invalid');
    if (!S.importedChars) S.importedChars = [];
    char.id = 'imported_' + Date.now();
    char.isNPC = true;
    S.importedChars.push(char);
    save();
    renderLobby();
  } catch(e) {
    alert('コードが無効です。正しいコードを入力してください。');
  }
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
  const npc3 = lb.npc3 || TEMPLATE_NPCS[1];

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
    makeCombatant(npc3, true),
  ];

  // ロビーで選択したポジションを適用
  const positions = lb.positions || { 0:'front', 1:'mid', 2:'back', 3:'mid' };
  party[0].position = positions[0] || 'front';
  party[1].position = positions[1] || 'mid';
  party[2].position = positions[2] || 'back';
  party[3].position = positions[3] || 'mid';

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
  if (!bt || bt.phase === 'end') return;

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
      setTimeout(() => { npcTurn(entity.idx); }, delay(600));
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
    setTimeout(() => { bossTurn(); }, delay(600));
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
    c.attackedLastRound = c.hasFiredThisTurn || false; // サプレッション用
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
  if (!bt || bt.phase === 'end') return;
  const c = bt.party[idx];
  addLog(`${c.name} が行動中...`, 'act');

  // ポジションチェック（スナイパーは後衛に移動）
  if (WEAPONS[c.weaponId]?.type === 'sniper' && c.position !== 'back') {
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
      if (!bt._anims) bt._anims = [];
      bt._anims.push({ type: 'char_heal', dmg: heal, idx: bt.party.indexOf(needsHeal) });
      nextTurn();
      renderBattle();
      return;
    }
  }

  // first_aid アクティブを持っていたらHP低い味方を回復（AP1消費）
  let remainingAp = c.ap;
  if ((c.activeSkills||[]).includes('first_aid') && !(c.skillCTs['first_aid']>0)) {
    const target = bt.party.find(p => p.currentHp > 0 && p.currentHp / p.maxHp < 0.5 && p !== c);
    if (target) {
      const heal = Math.round(target.maxHp * 0.3);
      target.currentHp = Math.min(target.maxHp, target.currentHp + heal);
      c.skillCTs['first_aid'] = 2;
      addLog(`${c.name} が 応急処置 → ${target.name} HP+${heal}`, 'heal');
      if (!bt._anims) bt._anims = [];
      bt._anims.push({ type: 'char_heal', dmg: heal, idx: bt.party.indexOf(target) });
      remainingAp -= 1;
    }
  }

  // 通常攻撃（残APの範囲で繰り返す・SRはAP2消費なので1回のみ）
  const apCost = w.attackApCost || 1;
  const maxAttacks = Math.floor(remainingAp / apCost);
  for (let i = 0; i < maxAttacks; i++) {
    if (bt.boss.currentHp <= 0) break;
    const { dmg: npcDmg, isCrit: npcCrit } = calcDamage(c, bt.boss, {});
    applyDamageToBoss(npcDmg, c.name + ' の攻撃', npcCrit);
  }

  renderBattle();
  if (bt.boss.currentHp <= 0) { endBattle(true); return; }
  nextTurn();
}

// ── BOSS TURN ──────────────────────────────────────────────
function bossTurn() {
  const bt = S.battle;
  if (!bt || bt.phase === 'end') return;
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

  renderBattle();

  // 全滅チェック（nextTurnより先に行い、全滅なら止める）
  if (bt.party.every(c => c.currentHp <= 0)) {
    setTimeout(() => endBattle(false), delay(500));
    return;
  }

  nextTurn();
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
  // 重み付きランダム：前衛3・中衛2・後衛1
  const posWeight = { front:3, mid:2, back:1 };
  const pool = alive.flatMap(c => Array(posWeight[c.position]||1).fill(c));
  return pool[Math.floor(Math.random() * pool.length)];
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
  const bt = S.battle;
  const charIdx = bt.party.indexOf(c);
  if (!bt._anims) bt._anims = [];

  const posDodgeMod = { front: -5, mid: 0, back: 15 };
  let dodge = c.stats.dodge + (c.tempDodgeBonus||0) + (posDodgeMod[c.position]||0);
  const roll = Math.random() * 100;
  if (roll < dodge) {
    addLog(`${c.name} は攻撃を回避した！`, 'act');
    bt._anims.push({ type: 'char_miss', idx: charIdx });
    if ((c.passiveSkills||[]).some(id => SKILLS[id]?.effect?.counterAttack)) {
      const cDmg = Math.round(c.stats.atk * 0.5);
      bt.boss.currentHp = Math.max(0, bt.boss.currentHp - cDmg);
      addLog(`${c.name} のカウンター！ ボスに ${cDmg} ダメージ`, 'dmg');
      bt._anims.push({ type: 'boss_dmg', dmg: cDmg });
    }
    return;
  }

  if ((c.passiveSkills||[]).some(id => SKILLS[id]?.effect?.lastStand) && !c.usedLastStand) {
    if (c.currentHp - dmg <= 0) {
      c.usedLastStand = true;
      c.currentHp = 1;
      addLog(`${c.name} の「ラストスタンド」発動！ HP1で耐えた！`, 'sys');
      bt._anims.push({ type: 'char_dmg', dmg: 1, idx: charIdx });
      return;
    }
  }

  c.currentHp = Math.max(0, c.currentHp - dmg);
  addLog(`${c.name} が ${dmg} ダメージ受けた（残HP:${c.currentHp}）`, 'dmg');
  bt._anims.push({ type: 'char_dmg', dmg, idx: charIdx });

  if (c.currentHp <= 0) addLog(`${c.name} は戦闘不能！`, 'sys');
}

// ── PLAYER ACTIONS ──────────────────────────────────────────
function playerAttack() {
  const bt = S.battle;
  const c = bt.party[bt.selectedCharIdx];
  const w = WEAPONS[c.weaponId];

  const hasQuickDraw  = (c.passiveSkills||[]).some(id => SKILLS[id]?.effect?.attackAfterMove);
  const hasGunslinger = (c.passiveSkills||[]).some(id => SKILLS[id]?.effect?.ignorePositionPenalty);

  // 位置チェック
  if (!w.attackSlots.includes(c.position)) {
    addLog(`この位置（${POS_NAMES[c.position]}）からは攻撃できない`, 'sys');
    return;
  }
  if (w.canAttackAfterMove === false && c.hasMoved && !hasQuickDraw) {
    addLog(`移動後は${w.name}で攻撃できない`, 'sys');
    return;
  }

  // 命中判定（ガンスリンガーで無効化可能）
  const missPenalty = hasGunslinger ? 0 : ((w.posAccuracyPenalty || {})[c.position] || 0);
  if (missPenalty > 0 && Math.random() * 100 < missPenalty) {
    addLog(`${c.name} の攻撃は外れた！（${POS_NAMES[c.position]}・命中-${missPenalty}%）`, 'sys');
    const apCost = w.attackApCost || 1;
    consumeAP(apCost);
    return;
  }

  // サプレッション：前ターンも攻撃していたらATK+15%
  let suppressionMod = 1.0;
  if ((c.passiveSkills||[]).some(id => SKILLS[id]?.effect?.consecutiveAtkBonus) && c.attackedLastRound) {
    suppressionMod = 1.15;
    addLog(`サプレッション発動！ ATK+15%`, 'act');
  }

  // マルチヒット対応
  const hitCount = w.multiHit || 1;
  const hitMod   = w.hitDamageMod || 1.0;
  for (let h = 0; h < hitCount; h++) {
    if (bt.boss.currentHp <= 0) break;
    const { dmg, isCrit } = calcDamage(c, bt.boss, { damageMod: hitMod, atkMod: suppressionMod });
    const label = hitCount > 1 ? `${c.name} の攻撃（${h+1}ヒット目）` : `${c.name} の攻撃`;
    applyDamageToBoss(dmg, label, isCrit);
  }
  c.hasFiredThisTurn = true;

  // デザートイーグルの硬直
  if (w.id === 'desert_eagle' && !c.passiveSkills.some(id=>SKILLS[id]?.effect?.noRecoilPenalty)) {
    c.tempDodgeBonus = -(w.recoilDodgePenalty||0);
  }

  const apCost = w.attackApCost || 1;
  if (apCost > 1) addLog(`${w.name}：AP${apCost}消費`, 'sys');
  consumeAP(apCost);
  checkWinCondition();
}

function calcDamage(attacker, target, opts) {
  const st = attacker.stats;
  let atk = st.atk * (opts.atkMod || 1.0);  // サプレッション等のATKボーナス
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
  let isCrit = false;

  const critRoll = Math.random() * 100;
  if (critRoll < st.crit) {
    dmg = Math.round(dmg * 1.5);
    isCrit = true;
    addLog(`クリティカル！`, 'act');
  }

  return { dmg: Math.max(1, dmg), isCrit };
}

function applyDamageToBoss(dmg, source, isCrit = false) {
  const bt = S.battle;
  bt.boss.currentHp = Math.max(0, bt.boss.currentHp - dmg);
  addLog(`${source} → ボスに ${dmg} ダメージ（残HP:${bt.boss.currentHp}）`, 'dmg');
  if (!bt._anims) bt._anims = [];
  bt._anims.push({ type: isCrit ? 'boss_crit' : 'boss_dmg', dmg });
}

function playerMove(pos) {
  const bt = S.battle;
  const c = bt.party[bt.selectedCharIdx];
  if (c.position === pos) { bt.actionPhase = 'choosing_action'; renderBattle(); return; }

  const w = WEAPONS[c.weaponId];
  if (w.noMoveAfterAttack && c.hasFiredThisTurn) {
    addLog(`${w.name}は攻撃後に移動できない`, 'sys');
    bt.actionPhase = 'choosing_action'; renderBattle(); return;
  }
  const armor = ARMORS[c.armorId];
  const moveCost = 1 + (armor.moveCostExtra||0);
  if (c.ap < moveCost) { addLog('APが足りない', 'sys'); return; }

  c.position = pos;
  c.hasMoved = true;
  // シャドウステップ：移動AP消費なし
  const hasFreeMove = (c.passiveSkills||[]).some(id => SKILLS[id]?.effect?.freeMoveAp);
  if (!hasFreeMove) c.ap -= moveCost;

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
    const { dmg: skDmg, isCrit: skCrit } = calcDamage(c, bt.boss, { damageMod: e.damageMod });
    applyDamageToBoss(skDmg, c.name + ' の ' + sk.name, skCrit);
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
  // オンライン：ホストがFirebaseに同期してから次のターンへ
  if (S.onlineRoom?.isHost) {
    onlineSyncBattle().then(() => processNextTurn());
  } else {
    processNextTurn();
  }
}

// ── WIN/LOSE ─────────────────────────────────────────────
function checkWinCondition() {
  if (S.battle.boss.currentHp <= 0) {
    setTimeout(() => endBattle(true), delay(300));
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
    function genBossDrop(entry) {
      const numSk = RARITY_SKILL_COUNT[entry.rarity] || 1;
      const skills = [];
      let activeCount = 0;
      for (let i = 0; i < numSk; i++) {
        const s = pickWeightedSkill(entry.rarity, skills, activeCount);
        if (s) { skills.push(s); if (SKILLS[s]?.type === 'active') activeCount++; }
      }
      return { weaponId: entry.weaponId, name: entry.name, rarity: entry.rarity, skills };
    }
    const weaponDrop = genBossDrop(boss.drops.weapons[Math.floor(Math.random() * boss.drops.weapons.length)]);
    drops.push({ type:'weapon', ...weaponDrop });
    if (!S.inventory.weapons) S.inventory.weapons = [];
    S.inventory.weapons.push({ id:'w_'+Date.now(), ...weaponDrop });

    // 10%で2個
    if (Math.random() < 0.1) {
      const w2 = genBossDrop(boss.drops.weapons[Math.floor(Math.random() * boss.drops.weapons.length)]);
      drops.push({ type:'weapon', ...w2 });
      S.inventory.weapons.push({ id:'w_'+Date.now()+'b', ...w2 });
    }

    // 素材ドロップ
    const matCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < matCount; i++) {
      const mat = boss.drops.materials[Math.floor(Math.random() * boss.drops.materials.length)];
      drops.push({ type:'material', name:mat });
    }

    // EXP付与・レベルアップ処理
    const myChar = S.characters[S.lobby.myCharIndex];
    myChar.exp = (myChar.exp || 0) + exp;
    let leveled = false;
    while (myChar.level < MAX_LEVEL) {
      const needed = expToNextLevel(myChar.level);
      if (myChar.exp >= needed) {
        myChar.exp -= needed;
        myChar.level++;
        leveled = true;
        if (myChar.skillPoints === undefined) myChar.skillPoints = 0;
        myChar.skillPoints++;
        addLog(`🎉 Lv.UP! → Lv.${myChar.level}（SP+1）`, 'sys');
      } else break;
    }

    // ボス撃破フラグを保存
    if (!S.clearedBosses) S.clearedBosses = [];
    const bossId = S.battle.bossId;
    if (!S.clearedBosses.includes(bossId)) {
      S.clearedBosses.push(bossId);
      const clearedBoss = BOSSES[bossId];
      if (clearedBoss.unlockArmors && clearedBoss.unlockArmors.length > 0) {
        addLog(`🛡️ 新しい防具がショップに追加されました！`, 'sys');
      }
    }

    // お金追加
    S.inventory.money += money;
    save();
  } else {
    addLog('💀 全滅...', 'sys');
  }

  S._lastResultParams = { win, drops, exp, money };
  S.resultRevealed = false;
  setTimeout(() => showScreen('result', { win, drops, exp, money }), delay(800));
}

// ── RESULT ────────────────────────────────────────────────
function revealDrop() {
  S.resultRevealed = true;
  renderResult(S._lastResultParams);
  // 開封SE代わりに軽いバイブ（対応デバイスのみ）
  if (navigator.vibrate) navigator.vibrate([30, 20, 60]);
}

function renderResult(params) {
  const { win, drops, exp, money } = params;
  const revealed = S.resultRevealed;

  const weaponDrops   = drops.filter(d => d.type === 'weapon');
  const materialDrops = drops.filter(d => d.type === 'material');

  // レアリティ対応グロークラス
  const rarityGlow  = { legend:'rarity-glow-legend', epic:'rarity-glow-epic', rare:'rarity-glow-rare' };
  const rarityClass = { common:'r-common', uncommon:'r-uncommon', rare:'r-rare', epic:'r-epic', legend:'r-legend' };
  const rarityLabel = { common:'COMMON', uncommon:'UNCOMMON', rare:'RARE', epic:'EPIC', legend:'LEGEND' };
  const rarityIcon  = { legend:'👑', epic:'💜', rare:'💙', uncommon:'🟢', common:'⬜' };

  // 武器ドロップ表示
  let weaponSection = '';
  if (weaponDrops.length > 0) {
    if (!revealed) {
      // 未開封：謎の箱
      weaponSection = `
        <div class="label">ドロップ武器</div>
        <div class="drop-box-wrap">
          <div class="drop-box" onclick="revealDrop()">
            <div class="drop-box-icon">📦</div>
            <div class="drop-box-label">タップして開封！</div>
            <div class="drop-box-sub">レア以上確定</div>
          </div>
        </div>`;
    } else {
      // 開封済：演出付き表示
      const cardsHtml = weaponDrops.map(d => {
        const rc   = rarityClass[d.rarity] || 'r-rare';
        const glow = rarityGlow[d.rarity]  || '';
        const rl   = rarityLabel[d.rarity] || d.rarity.toUpperCase();
        const ri   = rarityIcon[d.rarity]  || '🔫';
        const wDef = WEAPONS[d.weaponId];
        return `
          <div class="drop-item drop-revealed ${glow}" style="border:1px solid;flex-direction:column;align-items:flex-start;gap:6px;padding:14px 16px">
            <div style="display:flex;align-items:center;gap:8px;width:100%">
              <div style="flex-shrink:0">${weaponImg(d.weaponId, 56, 36)}</div>
              <div style="flex:1">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
                  <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;
                    background:${d.rarity==='legend'?'#f778ba33':d.rarity==='epic'?'#a371f733':'#58a6ff22'};
                    color:${d.rarity==='legend'?'var(--pink)':d.rarity==='epic'?'var(--purple)':'var(--accent)'}"
                  >${ri} ${rl}</span>
                  ${weaponTierBadge(d.weaponId)}
                </div>
                <div class="${rc}" style="font-size:15px;font-weight:700">${d.name}</div>
              </div>
            </div>
            <div style="font-size:11px;color:var(--text2)">
              ATK ${wDef?.baseAtk || '?'} | スキル: ${(d.skills||[]).map(id=>SKILLS[id]?.name||id).join('、')||'なし'}
            </div>
          </div>`;
      }).join('');
      weaponSection = `<div class="label">ドロップ武器</div>${cardsHtml}`;
    }
  }

  // 素材ドロップ（常時表示）
  const matHtml = materialDrops.map(d =>
    `<div class="drop-item">
      <div class="drop-icon">📦</div>
      <div class="drop-info"><h4>${d.name}</h4><p>素材</p></div>
    </div>`
  ).join('');

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
          ${weaponSection}
          ${matHtml ? `<div class="label" style="margin-top:12px">獲得素材</div>${matHtml}` : ''}
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

// ── WEAPON IMAGE HELPER ───────────────────────────────────
const TIER_COLORS = { 1:'#8b949e', 2:'#4ade80', 3:'#60a5fa', 4:'#a371f7', 5:'#f778ba' };
const TIER_LABELS = { 1:'T1', 2:'T2', 3:'T3', 4:'T4', 5:'T5' };

function weaponImg(weaponId, w = 40, h = 28) {
  const wDef = WEAPONS[weaponId];
  if (!wDef) return '<span>🔫</span>';
  if (wDef.isPlaceholder) {
    return `<span style="font-size:${Math.round(h*0.9)}px">🔫</span>`;
  }
  if (wDef.img) {
    return `<img src="images/weapons/${wDef.img}.png"
      style="width:${w}px;height:${h}px;object-fit:contain;image-rendering:auto"
      onerror="this.style.display='none';this.nextElementSibling.style.display='inline'">
      <span style="display:none;font-size:14px">🔫</span>`;
  }
  return `<span style="font-size:14px">${wDef.icon||'🔫'}</span>`;
}

const WEAPON_TYPE_LABELS = {
  handgun: 'HG', smg: 'SMG', assault_rifle: 'AR',
  lmg: 'LMG', sniper: 'SR', shotgun: 'SG',
};
const WEAPON_TYPE_COLORS = {
  handgun: '#f778ba', smg: '#58a6ff', assault_rifle: '#3fb950',
  lmg: '#d29922',    sniper: '#a371f7', shotgun: '#f85149',
};
function weaponTypeLabel(weaponId) {
  const wDef = WEAPONS[weaponId];
  if (!wDef?.type) return '';
  const label = WEAPON_TYPE_LABELS[wDef.type] || wDef.type;
  const color = WEAPON_TYPE_COLORS[wDef.type] || '#8b949e';
  return `<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:${color}22;color:${color};border:1px solid ${color};font-weight:700">${label}</span>`;
}

function weaponTierBadge(weaponId) {
  const wDef = WEAPONS[weaponId];
  if (!wDef?.tier) return '';
  const c = TIER_COLORS[wDef.tier] || '#8b949e';
  return `<span style="font-size:9px;padding:1px 4px;border-radius:3px;background:${c}22;color:${c};border:1px solid ${c};font-weight:700">${TIER_LABELS[wDef.tier]}</span>`;
}

// ── ANIMATION HELPERS ─────────────────────────────────────

function showDamageNumber(value, el, type = 'dmg') {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const div = document.createElement('div');
  div.className = 'dmg-number' +
    (type === 'heal' ? ' is-heal' : type === 'crit' ? ' is-crit' : type === 'miss' ? ' is-miss' : '');
  div.textContent = type === 'heal' ? `+${value}` : type === 'miss' ? 'MISS' : `-${value}`;
  // 少しランダムにずらしてまとめて当たっても読みやすく
  div.style.left = Math.round(rect.left + rect.width / 2 - 14 + (Math.random() - 0.5) * 24) + 'px';
  div.style.top  = Math.round(rect.top  + rect.height / 3) + 'px';
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 900);
}

function processBattleAnimations(anims) {
  requestAnimationFrame(() => {
    anims.forEach(a => {
      if (a.type === 'boss_dmg' || a.type === 'boss_crit') {
        const el = document.querySelector('.battle-boss-area');
        if (!el) return;
        showDamageNumber(a.dmg, el, a.type === 'boss_crit' ? 'crit' : 'dmg');
        el.classList.add('anim-shake');
        setTimeout(() => el.classList.remove('anim-shake'), 400);
      } else if (a.type === 'char_dmg') {
        const el = document.querySelectorAll('.char-battle-card')[a.idx];
        if (!el) return;
        showDamageNumber(a.dmg, el, 'dmg');
        el.classList.add('anim-hit');
        setTimeout(() => el.classList.remove('anim-hit'), 450);
      } else if (a.type === 'char_heal') {
        const el = document.querySelectorAll('.char-battle-card')[a.idx];
        if (!el) return;
        showDamageNumber(a.dmg, el, 'heal');
        el.classList.add('anim-heal');
        setTimeout(() => el.classList.remove('anim-heal'), 450);
      } else if (a.type === 'char_miss') {
        const el = document.querySelectorAll('.char-battle-card')[a.idx];
        if (el) showDamageNumber(0, el, 'miss');
      }
    });
  });
}

function processQuestAnimations(anims) {
  requestAnimationFrame(() => {
    anims.forEach(a => {
      if (a.type === 'enemy_dmg' || a.type === 'enemy_crit') {
        const el = document.querySelectorAll('.quest-enemy-card')[a.idx];
        if (!el) return;
        showDamageNumber(a.dmg, el, a.type === 'enemy_crit' ? 'crit' : 'dmg');
        el.classList.add('anim-hit');
        setTimeout(() => el.classList.remove('anim-hit'), 450);
      } else if (a.type === 'player_dmg') {
        const el = document.querySelector('.quest-player-card');
        if (!el) return;
        showDamageNumber(a.dmg, el, 'dmg');
        el.classList.add('anim-hit');
        setTimeout(() => el.classList.remove('anim-hit'), 450);
      } else if (a.type === 'player_heal') {
        const el = document.querySelector('.quest-player-card');
        if (!el) return;
        showDamageNumber(a.dmg, el, 'heal');
        el.classList.add('anim-heal');
        setTimeout(() => el.classList.remove('anim-heal'), 450);
      } else if (a.type === 'player_miss') {
        const el = document.querySelector('.quest-player-card');
        if (el) showDamageNumber(0, el, 'miss');
      }
    });
  });
}

function toggleBattleLog() {
  if (S.battle) {
    // undefined(初期値=collapsed) or true → false(展開)、false → true(折りたたみ)
    S.battle.logCollapsed = !(S.battle.logCollapsed !== false);
    renderBattle();
  }
}
function toggleQuestLog() {
  if (S.quest) {
    S.quest.logCollapsed = !(S.quest.logCollapsed !== false);
    renderQuestBattle();
  }
}

// ── WEAPON SKILL RESOLVER ─────────────────────────────────
// 装備中インベントリ武器のスキル、なければ武器種デフォルト
function getWeaponActiveSkills(char) {
  const invWeapon = (S.inventory.weapons||[]).find(w => w.id === char._equippedWeaponInventoryId);
  if (invWeapon?.skills?.length) {
    // アクティブスキルは最大2個まで表示
    return invWeapon.skills.filter(id => SKILLS[id]?.type === 'active').slice(0, 2);
  }
  return WEAPONS[char.weaponId]?.weaponSkills || [];
}

// ── WEAPON INVENTORY ──────────────────────────────────────
function renderWeaponInventory(charIndex) {
  const c = S.characters[charIndex];
  const weapons = S.inventory.weapons || [];
  if (weapons.length === 0) {
    return '<div style="color:var(--text2);font-size:13px;text-align:center">所持武器なし（クエスト・レイドでドロップ）</div>';
  }
  const rarityClass = { common:'r-common', uncommon:'r-uncommon', rare:'r-rare', epic:'r-epic', legend:'r-legend' };
  return weapons.map((w, i) => {
    const def = WEAPONS[w.weaponId];
    const isEquipped = c._equippedWeaponInventoryId === w.id;
    const rc = rarityClass[w.rarity] || 'r-common';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);gap:8px">
      <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
        <div style="flex-shrink:0">${weaponImg(w.weaponId, 44, 30)}</div>
        <div style="min-width:0">
          <div style="display:flex;align-items:center;gap:4px">
            <span class="${rc}" style="font-size:13px;font-weight:700">${w.name}</span>
            ${weaponTierBadge(w.weaponId)}
          </div>
          <div style="font-size:11px;color:var(--text2)">ATK:${def?.baseAtk} | ${(w.skills||[]).map(id=>SKILLS[id]?.name||id).join('・')||'スキルなし'}</div>
        </div>
      </div>
      <button onclick="equipWeapon(${charIndex},'${w.id}')"
        style="font-size:11px;padding:4px 10px;border-radius:4px;border:none;cursor:pointer;flex-shrink:0;
        background:${isEquipped?'#3fb950':'#58a6ff'};color:#0d1117;font-weight:700">
        ${isEquipped?'装備中':'装備'}
      </button>
    </div>`;
  }).join('');
}

// ── WEAPON SKILL COUNT BY RARITY ─────────────────────────
const RARITY_SKILL_COUNT = { common:1, uncommon:2, rare:2, epic:3, legend:4 };

// レアリティ別ティア重み（Tier1/2/3の抽選確率）
const RARITY_TIER_WEIGHTS = {
  common:   { 1:1.0, 2:0.0, 3:0.0 },
  uncommon: { 1:0.7, 2:0.3, 3:0.0 },
  rare:     { 1:0.5, 2:0.5, 3:0.0 },
  epic:     { 1:0.3, 2:0.4, 3:0.3 },
  legend:   { 1:0.2, 2:0.4, 3:0.4 },
};

// レアリティ・アクティブ上限を考慮してスキルを1個抽選
function pickWeightedSkill(rarity, exclude, activeCount) {
  const weights = RARITY_TIER_WEIGHTS[rarity] || RARITY_TIER_WEIGHTS.common;
  const MAX_ACTIVE = 2;
  const pool = Object.values(SKILLS).filter(sk =>
    sk.category !== 'weapon' &&
    !exclude.includes(sk.id) &&
    (activeCount < MAX_ACTIVE || sk.type !== 'active') // アクティブ上限超えたらパッシブのみ
  );
  if (!pool.length) return null;

  // ティア重みで抽選
  const total = pool.reduce((s, sk) => s + (weights[sk.tier] || 0), 0);
  if (total === 0) return pool[Math.floor(Math.random() * pool.length)]?.id;
  let r = Math.random() * total;
  for (const sk of pool) {
    r -= weights[sk.tier] || 0;
    if (r <= 0) return sk.id;
  }
  return pool[0]?.id;
}

// ── WEAPON INVENTORY SCREEN ───────────────────────────────
function renderWeaponInventoryScreen(charIndex) {
  const c = S.characters[charIndex];
  if (!c) { showScreen('home'); return; }
  const weapons = S.inventory.weapons || [];

  const rarityOrder = { legend:0, epic:1, rare:2, uncommon:3, common:4 };
  const rarityClass = { common:'r-common', uncommon:'r-uncommon', rare:'r-rare', epic:'r-epic', legend:'r-legend' };
  const rarityLabel = { legend:'👑 LEGEND', epic:'💜 EPIC', rare:'💙 RARE', uncommon:'🟢 UNCOMMON', common:'⬜ COMMON' };

  // ティア降順 → レアリティ昇順（強い順）でソート
  const sorted = [...weapons].sort((a, b) => {
    const tA = WEAPONS[a.weaponId]?.tier || 0;
    const tB = WEAPONS[b.weaponId]?.tier || 0;
    if (tB !== tA) return tB - tA;
    return (rarityOrder[a.rarity]||4) - (rarityOrder[b.rarity]||4);
  });

  const listHtml = sorted.length === 0
    ? `<div style="text-align:center;color:var(--text2);padding:32px 0;font-size:13px">
        所持武器なし<br><span style="font-size:11px">クエスト・レイドでドロップ</span>
       </div>`
    : sorted.map(w => {
        const def = WEAPONS[w.weaponId];
        const isEquipped = c._equippedWeaponInventoryId === w.id;
        const rc = rarityClass[w.rarity] || 'r-common';
        const rl = rarityLabel[w.rarity] || w.rarity;
        return `
          <div style="
            background:${isEquipped?'#1a2a1a':'var(--bg3)'};
            border:1px solid ${isEquipped?'var(--success)':'var(--border)'};
            border-radius:10px;padding:10px 12px;margin-bottom:8px;
            display:flex;align-items:center;gap:10px">
            <div style="flex-shrink:0;text-align:center">
              ${weaponImg(w.weaponId, 52, 34)}
              <div style="margin-top:3px">${weaponTypeLabel(w.weaponId)}</div>
            </div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:2px">
                <span class="${rc}" style="font-size:14px;font-weight:700">${w.name}</span>
                ${weaponTierBadge(w.weaponId)}
              </div>
              <div style="font-size:10px;color:var(--text2);margin-bottom:3px">${rl}</div>
              <div style="font-size:11px;color:var(--text2)">
                ATK ${def?.baseAtk || '?'} | ${(w.skills||[]).map(id=>SKILLS[id]?.name||id).join('・')||'スキルなし'}
              </div>
            </div>
            <button onclick="equipWeaponFromInventory(${charIndex},'${w.id}')"
              style="flex-shrink:0;font-size:12px;padding:6px 12px;border-radius:6px;border:none;cursor:${isEquipped?'default':'pointer'};
              background:${isEquipped?'var(--success)':'var(--accent)'};color:#0d1117;font-weight:700">
              ${isEquipped?'装備中':'装備'}
            </button>
          </div>`;
      }).join('');

  render(`
    <div class="header">
      <button class="back-btn" onclick="showScreen('char_detail',${charIndex})">‹</button>
      <div class="header-title">武器一覧</div>
    </div>
    <div class="scroll-area">
      <div class="section">
        ${(() => {
          const equippedInv = (S.inventory.weapons||[]).find(w => w.id === c._equippedWeaponInventoryId);
          const rc = { common:'r-common', uncommon:'r-uncommon', rare:'r-rare', epic:'r-epic', legend:'r-legend' };
          const ri = { legend:'👑', epic:'💜', rare:'💙', uncommon:'🟢', common:'⬜' };
          const rl = { legend:'LEGEND', epic:'EPIC', rare:'RARE', uncommon:'UNCOMMON', common:'COMMON' };
          return `<div class="card" style="margin-bottom:4px">
            <div style="font-size:11px;color:var(--text2);margin-bottom:6px">現在の装備</div>
            <div style="display:flex;align-items:center;gap:10px">
              <div style="flex-shrink:0;text-align:center">
                ${weaponImg(c.weaponId, 52, 34)}
                <div style="margin-top:3px">${weaponTypeLabel(c.weaponId)}</div>
              </div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:2px">
                  <span style="font-size:14px;font-weight:700;${equippedInv?`color:${rc[equippedInv.rarity]?.replace('r-','') || ''}`:''}">
                    ${equippedInv ? equippedInv.name : WEAPONS[c.weaponId]?.name}
                  </span>
                  ${weaponTierBadge(c.weaponId)}
                </div>
                ${equippedInv ? `
                  <div style="font-size:11px;margin-bottom:2px">
                    <span class="${rc[equippedInv.rarity]||''}">${ri[equippedInv.rarity]||''} ${rl[equippedInv.rarity]||''}</span>
                  </div>
                  <div style="font-size:11px;color:var(--text2)">
                    ATK ${WEAPONS[equippedInv.weaponId]?.baseAtk || '?'}</div>
                  ${(equippedInv.skills||[]).length ? equippedInv.skills.map(id => {
                    const sk = SKILLS[id];
                    return `<div style="font-size:11px;color:var(--text2);margin-top:2px">・${sk ? sk.name+'（'+sk.desc+'）' : id}</div>`;
                  }).join('') : '<div style="font-size:11px;color:var(--text2);margin-top:2px">スキルなし</div>'}
                ` : `
                  <div style="font-size:11px;color:var(--text2)">ATK ${WEAPONS[c.weaponId]?.baseAtk || '?'}</div>`}
              </div>
            </div>
          </div>`;
        })()}
        <div class="label">所持武器（${weapons.length}個）</div>
        ${listHtml}
      </div>
    </div>
  `);
}

function equipWeaponFromInventory(charIndex, weaponInventoryId) {
  equipWeapon(charIndex, weaponInventoryId);
  // 装備後に武器一覧に留まる（装備中表示を更新）
  showScreen('weapon_inventory', charIndex);
}

// ── ARMOR INVENTORY SCREEN ────────────────────────────────
function renderArmorInventoryScreen(charIndex) {
  const c = S.characters[charIndex];
  if (!c) { showScreen('home'); return; }
  const owned = getOwnedArmors();

  const listHtml = owned.map(id => {
    const a = ARMORS[id];
    const isEquipped = c.armorId === id;
    const stats = [];
    if (a.reduction > 0)    stats.push(`軽減 ${Math.round(a.reduction*100)}%`);
    if (a.dodgeMod !== 0)   stats.push(`回避 ${a.dodgeMod>0?'+':''}${a.dodgeMod}%`);
    if (a.hpBonus !== 0)    stats.push(`HP ${a.hpBonus>0?'+':''}${a.hpBonus}`);
    if (a.speedMod !== 0)   stats.push(`速さ ${a.speedMod>0?'+':''}${a.speedMod}`);
    if (a.moveCostExtra > 0) stats.push(`移動コスト+${a.moveCostExtra}`);

    return `
      <div style="
        background:${isEquipped?'#1a2a1a':'var(--bg3)'};
        border:1px solid ${isEquipped?'var(--success)':'var(--border)'};
        border-radius:10px;padding:10px 12px;margin-bottom:8px;
        display:flex;align-items:center;gap:10px">
        <div style="font-size:28px;flex-shrink:0">${a.icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700;margin-bottom:2px">${a.name}</div>
          <div style="font-size:11px;color:var(--text2);margin-bottom:3px">${stats.join(' | ') || 'スタンダード'}</div>
          <div style="font-size:11px;color:var(--text2)">${a.desc}</div>
        </div>
        <button onclick="equipArmorFromInventory(${charIndex},'${id}')"
          style="flex-shrink:0;font-size:12px;padding:6px 12px;border-radius:6px;border:none;cursor:${isEquipped?'default':'pointer'};
          background:${isEquipped?'var(--success)':'var(--accent)'};color:#0d1117;font-weight:700">
          ${isEquipped?'装備中':'装備'}
        </button>
      </div>`;
  }).join('');

  render(`
    <div class="header">
      <button class="back-btn" onclick="showScreen('char_detail',${charIndex})">‹</button>
      <div class="header-title">防具一覧</div>
    </div>
    <div class="scroll-area">
      <div class="section">
        <div class="card" style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
          <div style="flex:1">
            <div style="font-size:11px;color:var(--text2)">現在の装備</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
              <span style="font-size:24px">${ARMORS[c.armorId]?.icon}</span>
              <span style="font-size:14px;font-weight:700">${ARMORS[c.armorId]?.name}</span>
            </div>
          </div>
        </div>
        <div class="label">所持防具（${owned.length}個）</div>
        ${listHtml}
        <div style="font-size:11px;color:var(--text2);text-align:center;margin-top:8px">
          💡 新しい防具はショップで購入できます
        </div>
      </div>
    </div>
  `);
}

function equipArmorFromInventory(charIndex, armorId) {
  equipArmor(charIndex, armorId);
  showScreen('armor_inventory', charIndex);
}

function renderArmorInventory(charIndex) {
  const c = S.characters[charIndex];
  const owned = getOwnedArmors();
  if (owned.length === 0) {
    return '<div style="color:var(--text2);font-size:13px;text-align:center">所持防具なし（ショップで購入）</div>';
  }
  return owned.map(id => {
    const a = ARMORS[id];
    const isEquipped = c.armorId === id;
    const stats = [];
    if (a.reduction > 0)    stats.push(`軽減${Math.round(a.reduction*100)}%`);
    if (a.dodgeMod !== 0)   stats.push(`回避${a.dodgeMod>0?'+':''}${a.dodgeMod}%`);
    if (a.hpBonus !== 0)    stats.push(`HP${a.hpBonus>0?'+':''}${a.hpBonus}`);
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
      <div>
        <div style="font-size:13px;font-weight:700">${a.icon} ${a.name}</div>
        <div style="font-size:11px;color:var(--text2)">${stats.join(' | ') || 'スタンダード'}</div>
      </div>
      <button onclick="equipArmor(${charIndex},'${id}')"
        style="font-size:11px;padding:4px 10px;border-radius:4px;border:none;cursor:${isEquipped?'default':'pointer'};
        background:${isEquipped?'#3fb950':'#58a6ff'};color:#0d1117;font-weight:700">
        ${isEquipped?'装備中':'装備'}
      </button>
    </div>`;
  }).join('');
}

function equipArmor(charIndex, armorId) {
  const c = S.characters[charIndex];
  c.armorId = armorId;
  save();
  showScreen('char_detail', charIndex);
}

function getOwnedArmors() {
  if (!S.inventory.armors) S.inventory.armors = ['basic_jacket'];
  if (!S.inventory.armors.includes('basic_jacket')) S.inventory.armors.unshift('basic_jacket');
  return S.inventory.armors;
}

// ── SKILL TREE ────────────────────────────────────────────

function migrateLearnedSkills(char) {
  if (!char.learnedSkills) {
    char.learnedSkills = [...new Set([...(char.passiveSkills||[]), ...(char.activeSkills||[])])];
  }
}

function getCharSP(char) {
  migrateLearnedSkills(char);
  if (char.skillPoints === undefined) {
    char.skillPoints = Math.max(0, (char.level - 1) - char.learnedSkills.length);
  }
  return char.skillPoints;
}

function checkTierReq(char, skill) {
  if (skill.tier === 1) return true;
  migrateLearnedSkills(char);
  const learned = char.learnedSkills;
  const sameTree = Object.values(SKILLS).filter(s => s.tree === skill.tree);
  if (skill.tier === 2) return sameTree.some(s => s.tier === 1 && learned.includes(s.id));
  if (skill.tier === 3) return sameTree.some(s => s.tier === 2 && learned.includes(s.id));
  return false;
}

function learnSkill(charIndex, skillId) {
  const c = S.characters[charIndex];
  const sk = SKILLS[skillId];
  migrateLearnedSkills(c);
  const sp = getCharSP(c);

  if (c.learnedSkills.includes(skillId)) return;
  if (sp <= 0) { alert('スキルポイントが足りません'); return; }
  if (!checkTierReq(c, sk)) { alert('前提スキルが必要です'); return; }

  // 習得のみ（装備はしない）
  c.learnedSkills.push(skillId);
  c.skillPoints = sp - 1;
  save();
  showScreen('skill_tree', charIndex);
}

function equipSkill(charIndex, skillId) {
  const c = S.characters[charIndex];
  const sk = SKILLS[skillId];
  migrateLearnedSkills(c);
  if (!c.learnedSkills.includes(skillId)) return;

  const passiveMax = 3 + ((c.passiveSkills||[]).some(id => SKILLS[id]?.effect?.extraSlot) ? 1 : 0);
  if (sk.type === 'passive') {
    if ((c.passiveSkills||[]).includes(skillId)) return;
    if ((c.passiveSkills||[]).length >= passiveMax) { alert(`パッシブスロット満杯（最大${passiveMax}）`); return; }
    c.passiveSkills = [...(c.passiveSkills||[]), skillId];
  } else {
    if ((c.activeSkills||[]).includes(skillId)) return;
    if ((c.activeSkills||[]).length >= 2) { alert('アクティブスロット満杯（最大2）'); return; }
    c.activeSkills = [...(c.activeSkills||[]), skillId];
  }
  save();
  showScreen('skill_tree', charIndex);
}

function unequipSkill(charIndex, skillId) {
  const c = S.characters[charIndex];
  const sk = SKILLS[skillId];
  // 外すだけ（learnedSkillsには残る・SP返還なし）
  if (sk.type === 'passive') c.passiveSkills = (c.passiveSkills||[]).filter(id => id !== skillId);
  else c.activeSkills = (c.activeSkills||[]).filter(id => id !== skillId);
  save();
  showScreen('skill_tree', charIndex);
}

function unlearnSkill(charIndex, skillId) {
  const c = S.characters[charIndex];
  const sk = SKILLS[skillId];
  migrateLearnedSkills(c);
  // 装備からも外す
  c.passiveSkills  = (c.passiveSkills||[]).filter(id => id !== skillId);
  c.activeSkills   = (c.activeSkills||[]).filter(id => id !== skillId);
  c.learnedSkills  = c.learnedSkills.filter(id => id !== skillId);
  c.skillPoints = (c.skillPoints||0) + 1;
  save();
  showScreen('skill_tree', charIndex);
}

function renderSkillTree(charIndex) {
  const c = S.characters[charIndex];
  if (!c) { showScreen('home'); return; }
  migrateLearnedSkills(c);
  const sp = getCharSP(c);
  const learned  = c.learnedSkills || [];
  const equipped = [...(c.passiveSkills||[]), ...(c.activeSkills||[])];
  const allLearned = learned; // tier判定用
  const passiveMax = 3 + (equipped.some(id => SKILLS[id]?.effect?.extraSlot) ? 1 : 0);

  const treeOrder = ['fire', 'dodge', 'heal', 'tactic', 'general'];

  const treeSections = treeOrder.map(tree => {
    const treeName = TREE_NAMES[tree];
    const skills = Object.values(SKILLS).filter(s => s.tree === tree && s.category !== 'weapon');
    const tiers = [1, 2, 3];

    const tierRows = tiers.map(tier => {
      const tierSkills = skills.filter(s => s.tier === tier);
      if (!tierSkills.length) return '';

      const cards = tierSkills.map(sk => {
        const isLearned   = learned.includes(sk.id);
        const isEquipped  = equipped.includes(sk.id);
        const tierOk      = checkTierReq(c, sk);
        const locked      = !isLearned && !tierOk;

        const typeColor = sk.type === 'passive' ? 'var(--accent)' : 'var(--purple)';
        const typeName  = sk.type === 'passive' ? 'P' : 'A';

        // 状態別の背景・ボーダー
        let bgColor, borderColor;
        if (isEquipped)       { bgColor = '#1a2a1a'; borderColor = 'var(--success)'; }
        else if (isLearned)   { bgColor = '#1a1e2a'; borderColor = 'var(--accent)'; }
        else if (locked)      { bgColor = '#1a1a1a'; borderColor = 'var(--border)'; }
        else                  { bgColor = 'var(--bg3)'; borderColor = 'var(--border)'; }

        // ボタン群
        let actionBtn = '';
        if (!isLearned) {
          // 未習得
          const canLearn = sp > 0 && tierOk;
          if (locked) {
            actionBtn = `<div style="font-size:10px;color:var(--text2);margin-top:4px">🔒 前提必要</div>`;
          } else if (canLearn) {
            actionBtn = `<button onclick="learnSkill(${charIndex},'${sk.id}')"
              style="font-size:10px;padding:3px 7px;border-radius:4px;border:none;cursor:pointer;background:var(--success);color:#0d1117;font-weight:700;margin-top:4px">
              習得 SP-1
            </button>`;
          } else {
            actionBtn = `<div style="font-size:10px;color:var(--text2);margin-top:4px">SPなし</div>`;
          }
        } else if (!isEquipped) {
          // 習得済み・未装備
          const slotOk = sk.type === 'passive'
            ? (c.passiveSkills||[]).length < passiveMax
            : (c.activeSkills||[]).length < 2;
          actionBtn = `<div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap">
            <button onclick="equipSkill(${charIndex},'${sk.id}')"
              style="font-size:10px;padding:3px 7px;border-radius:4px;border:none;cursor:${slotOk?'pointer':'not-allowed'};
              background:${slotOk?'var(--accent)':'#333'};color:${slotOk?'#0d1117':'#666'};font-weight:700"
              ${!slotOk?'disabled':''}>
              装備
            </button>
            <button onclick="unlearnSkill(${charIndex},'${sk.id}')"
              style="font-size:10px;padding:3px 7px;border-radius:4px;border:none;cursor:pointer;background:#f85149;color:#fff">
              解除 SP+1
            </button>
          </div>`;
        } else {
          // 装備中
          actionBtn = `<div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap">
            <button onclick="unequipSkill(${charIndex},'${sk.id}')"
              style="font-size:10px;padding:3px 7px;border-radius:4px;border:none;cursor:pointer;background:#d29922;color:#0d1117;font-weight:700">
              外す
            </button>
            <button onclick="unlearnSkill(${charIndex},'${sk.id}')"
              style="font-size:10px;padding:3px 7px;border-radius:4px;border:none;cursor:pointer;background:#f85149;color:#fff">
              解除 SP+1
            </button>
          </div>`;
        }

        return `<div style="
          background:${bgColor};border:1px solid ${borderColor};
          border-radius:8px;padding:8px;flex:1;min-width:120px;max-width:160px;
          opacity:${locked?0.6:1}">
          <div style="display:flex;align-items:center;gap:4px;margin-bottom:3px">
            <span style="font-size:10px;padding:1px 5px;border-radius:3px;background:${typeColor};color:#0d1117;font-weight:700">${typeName}</span>
            <span style="font-size:12px;font-weight:700;color:${isEquipped?'var(--success)':isLearned?'var(--accent)':'var(--text)'}">${sk.name}</span>
          </div>
          <div style="font-size:10px;color:var(--text2);line-height:1.3">${sk.desc}</div>
          ${sk.type==='active'?`<div style="font-size:10px;color:var(--text2);margin-top:2px">CT:${sk.ct}T / AP:${sk.apCost}</div>`:''}
          ${actionBtn}
        </div>`;
      }).join('');

      return `
        <div style="margin-bottom:6px">
          <div style="font-size:10px;color:var(--text2);margin-bottom:4px;letter-spacing:1px">TIER ${tier}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${cards}</div>
        </div>`;
    }).join('');

    return `
      <details open style="margin-bottom:10px">
        <summary style="font-size:13px;font-weight:700;padding:8px 0;cursor:pointer;list-style:none;display:flex;align-items:center;gap:6px;border-bottom:1px solid var(--border)">
          <span>${treeName}</span>
          <span style="font-size:11px;color:var(--text2);margin-left:auto">
            ${skills.filter(s=>allLearned.includes(s.id)).length}/${skills.length}
          </span>
        </summary>
        <div style="padding-top:10px">${tierRows}</div>
      </details>`;
  }).join('');

  render(`
    <div class="header">
      <button class="back-btn" onclick="showScreen('char_detail',${charIndex})">‹</button>
      <div class="header-title">スキル習得</div>
    </div>
    <div class="scroll-area">
      <div class="section">
        <div class="card" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <div>
            <div style="font-size:13px;font-weight:700">${c.icon} ${c.name}　Lv.${c.level}</div>
            <div style="font-size:11px;color:var(--text2)">
              習得 ${learned.length}個　装備 P:${(c.passiveSkills||[]).length}/${passiveMax} A:${(c.activeSkills||[]).length}/2
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:22px;font-weight:700;color:var(--purple)">SP ${sp}</div>
            <div style="font-size:10px;color:var(--text2)">スキルポイント</div>
          </div>
        </div>
        <div style="font-size:11px;color:var(--text2);margin-bottom:12px;padding:6px 8px;background:var(--bg2);border-radius:6px">
          💡 Tier 2はTier 1を1個、Tier 3はTier 2を1個習得後に解放。解除するとSP還元。
        </div>
        ${treeSections}
      </div>
    </div>
  `);
}

// ── SHOP ──────────────────────────────────────────────────

function renderShop() {
  if (!S.inventory.armors) S.inventory.armors = ['basic_jacket'];

  const sections = [];

  // 解放済みグループ・ロックグループに分ける
  const unlocked = [], locked = [];
  Object.values(ARMORS).forEach(a => {
    if (a.isDefault) return; // 初期装備は表示しない
    const bossCleared = !a.unlockBoss || (S.clearedBosses||[]).includes(a.unlockBoss);
    if (bossCleared) unlocked.push(a);
    else locked.push(a);
  });

  const money = S.inventory.money;

  function armorCard(a, available) {
    const owned = (S.inventory.armors||[]).includes(a.id);
    const canBuy = available && !owned && money >= a.price;
    const stats = [];
    if (a.reduction > 0)    stats.push(`軽減${Math.round(a.reduction*100)}%`);
    if (a.dodgeMod !== 0)   stats.push(`回避${a.dodgeMod>0?'+':''}${a.dodgeMod}%`);
    if (a.hpBonus !== 0)    stats.push(`HP${a.hpBonus>0?'+':''}${a.hpBonus}`);
    if (a.speedMod !== 0)   stats.push(`速${a.speedMod>0?'+':''}${a.speedMod}`);

    let badge, badgeStyle;
    if (!available) {
      const boss = a.unlockBoss ? BOSSES[a.unlockBoss] : null;
      badge = `🔒 ${boss ? boss.name+'撃破で解放' : '未解放'}`;
      badgeStyle = 'background:#21262d;color:var(--text2)';
    } else if (owned) {
      badge = '✅ 購入済';
      badgeStyle = 'background:#1a3a1a;color:var(--success)';
    } else {
      badge = `💰 ${a.price.toLocaleString()}`;
      badgeStyle = money >= a.price ? 'background:#3fb950;color:#0d1117' : 'background:#21262d;color:var(--text2)';
    }

    return `
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:8px;${!available?'opacity:0.6':''}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="flex:1">
            <div style="font-size:14px;font-weight:700">${a.icon} ${a.name}</div>
            <div style="font-size:11px;color:var(--text2);margin-top:2px">${stats.join(' | ') || 'スタンダード'}</div>
            <div style="font-size:11px;color:var(--text2);margin-top:2px">${a.desc}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;min-width:80px">
            <span style="font-size:11px;padding:3px 8px;border-radius:10px;font-weight:700;${badgeStyle};white-space:nowrap">${badge}</span>
            ${canBuy ? `<button onclick="buyArmor('${a.id}')"
              style="font-size:12px;padding:5px 12px;border-radius:6px;border:none;cursor:pointer;background:var(--accent);color:#0d1117;font-weight:700">
              購入
            </button>` : ''}
          </div>
        </div>
      </div>`;
  }

  const unlockedHtml = unlocked.map(a => armorCard(a, true)).join('');
  const lockedHtml   = locked.map(a => armorCard(a, false)).join('');

  render(`
    <div class="header">
      <button class="back-btn" onclick="showScreen('home')">‹</button>
      <div class="header-title">ショップ</div>
    </div>
    <div class="scroll-area">
      <div class="section">
        <div class="card" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="color:var(--text2);font-size:13px">所持金</span>
          <span style="font-size:20px;font-weight:700;color:var(--warn)">💰 ${money.toLocaleString()}</span>
        </div>

        <div class="label">購入可能な防具</div>
        ${unlockedHtml || '<div class="card" style="color:var(--text2);text-align:center;font-size:13px">ボスを倒して防具を解放しよう</div>'}

        ${lockedHtml ? `<div class="label">未解放の防具</div>${lockedHtml}` : ''}
      </div>
    </div>
  `);
}

function buyArmor(armorId) {
  const a = ARMORS[armorId];
  if (!a) return;
  if (!S.inventory.armors) S.inventory.armors = ['basic_jacket'];
  if (S.inventory.armors.includes(armorId)) return;
  if (S.inventory.money < a.price) { alert('所持金が足りません'); return; }
  S.inventory.money -= a.price;
  S.inventory.armors.push(armorId);
  save();
  renderShop();
}

function equipWeapon(charIndex, weaponInventoryId) {
  const c = S.characters[charIndex];
  const w = (S.inventory.weapons || []).find(x => x.id === weaponInventoryId);
  if (!w) return;
  c.weaponId = w.weaponId;
  c._equippedWeaponInventoryId = w.id;
  save();
  showScreen('char_detail', charIndex);
}

// ── QUEST ─────────────────────────────────────────────────

function renderQuestList() {
  const chars = S.characters;
  const selIdx = S.questCharIndex || 0;

  const charChips = chars.map((c, i) => `
    <div onclick="S.questCharIndex=${i};renderQuestList()" style="
      display:inline-flex;align-items:center;gap:6px;
      background:${i===selIdx?'#58a6ff22':'var(--bg3)'};
      border:2px solid ${i===selIdx?'var(--accent)':'var(--border)'};
      border-radius:20px;padding:4px 12px;cursor:pointer;margin:3px">
      <span>${c.icon||'🧑'}</span>
      <span style="font-size:12px;font-weight:700;color:${i===selIdx?'var(--accent)':'var(--text)'}">${c.name} Lv.${c.level}</span>
    </div>`).join('');

  const questCards = QUESTS.map(q => {
    const diffStr = '★'.repeat(q.difficulty) + '☆'.repeat(5 - q.difficulty);
    return `
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px;cursor:pointer"
        onclick="startQuest('${q.id}')">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-size:28px">${q.icon}</div>
          <div style="flex:1">
            <div style="font-weight:700;font-size:14px">${q.name}</div>
            <div style="font-size:11px;color:var(--text2)">${q.area} | 推奨Lv.${q.recommendedLevel} ${diffStr}</div>
            <div style="font-size:12px;color:var(--text2);margin-top:3px">${q.desc}</div>
          </div>
          <div style="text-align:right;font-size:11px;color:var(--warn);white-space:nowrap">
            EXP<br>${q.drops.expReward}<br>
            <span style="color:var(--success)">💰${q.drops.moneyReward}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  render(`
    <div class="header">
      <button class="back-btn" onclick="showScreen('home')">‹</button>
      <div class="header-title">クエスト</div>
    </div>
    <div class="scroll-area">
      <div class="section">
        <div class="label">参加キャラ</div>
        <div class="card" style="display:flex;flex-wrap:wrap;gap:2px">
          ${charChips}
        </div>
        <div class="label">クエスト一覧</div>
        <div class="card" style="font-size:12px;color:var(--text2);margin-bottom:8px;text-align:center">
          💡 半オート戦闘。毎ラウンド行動を選択して敵を倒せ！
        </div>
        ${questCards}
      </div>
    </div>
  `);
}

function startQuest(questId) {
  const q = QUESTS.find(x => x.id === questId);
  if (!q) return;
  const charIdx = S.questCharIndex || 0;
  const myChar = S.characters[charIdx];
  if (!myChar) { alert('キャラクターを選択してください'); return; }

  const st = calcStats(myChar);
  let maxHp = st.hp;
  if ((myChar.passiveSkills||[]).some(id => SKILLS[id]?.effect?.startHpBonus)) maxHp = Math.round(maxHp * 1.2);

  S.quest = {
    questId,
    quest: q,
    charIdx,
    waveIndex: 0,
    enemies: makeQuestWave(q.waves[0]),
    char: { ...myChar, currentHp: maxHp, maxHp, stats: st, skillCTs: {}, tempDodgeBonus: 0, usedLastStand: false },
    round: 1,
    phase: 'choosing_action',
    log: [],
    items: ['med_kit', 'grenade'],
    skipEnemyTurns: 0,
  };

  addQuestLog('⚔️ クエスト開始！', 'sys');
  addQuestLog(`── Wave 1 ──`, 'sys');
  showScreen('quest_battle');
}

function makeQuestWave(waveIds) {
  return waveIds.map((eid, i) => {
    const def = QUEST_ENEMIES[eid];
    return { ...def, currentHp: def.hp, maxHp: def.hp, uid: eid + '_' + i };
  });
}

function addQuestLog(msg, cls='') {
  S.quest.log.push({ msg, cls: 'log-entry log-' + cls });
}

function renderQuestBattle() {
  const qs = S.quest;
  if (!qs) return;
  const q = qs.quest;
  const char = qs.char;

  const enemyHtml = qs.enemies.map((e, ei) => {
    const hp = pct(e.currentHp, e.maxHp);
    const hpCls = hpClass(e.currentHp, e.maxHp);
    return `
      <div class="quest-enemy-card" style="background:var(--bg3);border-radius:8px;padding:8px 10px;margin-bottom:6px;${e.currentHp<=0?'opacity:0.4':''}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:18px">${e.icon}</div>
          <div style="flex:1;margin:0 8px">
            <div style="font-size:13px;font-weight:700">${e.name} ${e.currentHp<=0?'💀':''}</div>
            <div class="hp-bar" style="height:6px;margin-top:4px">
              <div class="hp-fill ${hpCls}" style="width:${hp}%"></div>
            </div>
          </div>
          <div style="font-size:11px;color:var(--text2)">${Math.max(0,e.currentHp)}/${e.maxHp}</div>
        </div>
      </div>`;
  }).join('');

  const myHpPct = pct(char.currentHp, char.maxHp);
  const myHpCls = hpClass(char.currentHp, char.maxHp);

  const qLogCollapsed = qs.logCollapsed !== false;
  const logEntries = qLogCollapsed ? qs.log.slice(-4) : qs.log.slice(-50);
  const logHtml = logEntries.map(e => `<div class="${e.cls}">${e.msg}</div>`).join('');

  let actionHtml = '';
  if (qs.phase === 'choosing_action') {
    const weaponSkillIds = getWeaponActiveSkills(char);
    const charSkillIds   = (char.activeSkills||[]).filter(id => SKILLS[id]?.category !== 'weapon');
    function questSkillBtn(id) {
      const sk = SKILLS[id]; if (!sk) return '';
      const ct = char.skillCTs[id] || 0;
      return `<button class="btn btn-secondary btn-sm" style="margin:3px 0;width:100%;text-align:left" ${ct>0?'disabled':''} onclick="questUseSkill('${id}')">
        ${sk.name}${ct>0?` (CT:${ct}T)`:` (AP:${sk.apCost})`} — ${sk.desc}
      </button>`;
    }
    const skillBtns = [
      weaponSkillIds.length ? `<div style="font-size:10px;color:var(--warn);font-weight:700;margin-top:6px">🔫 武器スキル</div>${weaponSkillIds.map(questSkillBtn).join('')}` : '',
      charSkillIds.length   ? `<div style="font-size:10px;color:var(--accent);font-weight:700;margin-top:6px">🧑 キャラスキル</div>${charSkillIds.map(questSkillBtn).join('')}` : '',
    ].filter(Boolean).join('');

    const itemBtns = qs.items.map((id, i) => {
      const def = CONSUMABLES[id]; if (!def) return '';
      return `<button class="btn btn-secondary btn-sm" style="margin:3px 0;width:100%;text-align:left" onclick="questUseItem('${id}',${i})">
        ${def.icon} ${def.name} — ${def.desc}
      </button>`;
    }).join('');

    actionHtml = `
      <div class="turn-label">⚡ ラウンド ${qs.round}（Wave ${qs.waveIndex+1}/${q.waves.length}）</div>
      <div class="action-grid">
        <button class="action-btn atk" onclick="questAction('attack')">
          🔫 攻撃
          <div class="action-desc">${WEAPONS[char.weaponId]?.name}</div>
        </button>
        <button class="action-btn" style="background:var(--bg3);border:1px solid var(--border)" onclick="questAction('defend')">
          🛡️ 防御
          <div class="action-desc">回避率+30%↑</div>
        </button>
      </div>
      ${skillBtns ? `<div style="margin-top:6px">${skillBtns}</div>` : ''}
      ${itemBtns ? `<div style="margin-top:4px">${itemBtns}</div>` : ''}`;
  } else if (qs.phase === 'wave_clear') {
    actionHtml = `
      <div class="turn-label" style="color:var(--success)">✅ Wave ${qs.waveIndex+1} クリア！</div>
      <button class="btn btn-primary" onclick="nextQuestWave()">次のWaveへ ›</button>`;
  } else if (qs.phase === 'end') {
    actionHtml = `<div class="turn-label">処理中...</div>`;
  }

  render(`
    <div class="header">
      <button class="back-btn" onclick="if(confirm('クエストを中断しますか？')){S.quest=null;showScreen('quest_list')}">‹</button>
      <div class="header-title">${q.name}</div>
    </div>
    <div class="scroll-area">
      <div class="section">
        <div class="label">敵（Wave ${qs.waveIndex+1}/${q.waves.length}）</div>
        ${enemyHtml}

        <div class="label">自分</div>
        <div class="quest-player-card" style="background:var(--bg3);border-radius:8px;padding:8px 10px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="display:flex;align-items:center;gap:6px">${charAvatarHtml(char,28)} <strong>${char.name}</strong></div>
            <div style="font-size:12px;color:var(--text2)">${char.currentHp}/${char.maxHp}</div>
          </div>
          <div class="hp-bar" style="height:8px;margin-top:4px">
            <div class="hp-fill ${myHpCls}" style="width:${myHpPct}%"></div>
          </div>
        </div>

        <div class="battle-log-wrap">
          <div class="battle-log-header" onclick="toggleQuestLog()">
            <span>バトルログ</span>
            <span>${(qs.logCollapsed!==false) ? '▸ 展開' : '▾ 閉じる'}</span>
          </div>
          <div class="battle-log ${qs.logCollapsed!==false?'collapsed':'expanded'}" id="quest-log">${logHtml}</div>
        </div>

        <div class="battle-actions-area" style="margin-top:8px">
          ${actionHtml}
        </div>
      </div>
    </div>
  `);

  const logEl = document.getElementById('quest-log');
  if (logEl) logEl.scrollTop = logEl.scrollHeight;

  if (qs._anims?.length) {
    const anims = qs._anims.splice(0);
    processQuestAnimations(anims);
  }
}

function questAction(type) {
  const qs = S.quest;
  const char = qs.char;
  qs.phase = 'resolving';

  if (!qs._anims) qs._anims = [];
  if (type === 'attack') {
    const w = WEAPONS[char.weaponId] || {};
    const hasGunslinger = (char.passiveSkills||[]).some(id => SKILLS[id]?.effect?.ignorePositionPenalty);
    // 命中判定
    const missPenalty = hasGunslinger ? 0 : ((w.posAccuracyPenalty || {})[char.position || 'front'] || 0);
    if (missPenalty > 0 && Math.random() * 100 < missPenalty) {
      addQuestLog(`${char.name} の攻撃は外れた！（命中-${missPenalty}%）`, 'sys');
      qs._anims.push({ type: 'player_miss' });
      char.tempDodgeBonus = 0;
      questAfterPlayerAction();
      return;
    }
    // サプレッション
    let suppressionMod = 1.0;
    if ((char.passiveSkills||[]).some(id => SKILLS[id]?.effect?.consecutiveAtkBonus) && char.attackedLastRound) {
      suppressionMod = 1.15;
      addQuestLog(`サプレッション発動！ ATK+15%`, 'act');
    }
    char.attackedLastRound = true;
    const hitCount = w.multiHit || 1;
    const hitMod   = w.hitDamageMod || 1.0;
    const target = qs.enemies.find(e => e.currentHp > 0);
    const targetIdx = qs.enemies.indexOf(target);
    if (target) {
      const st = char.stats;
      for (let h = 0; h < hitCount; h++) {
        if (target.currentHp <= 0) break;
        let mod = hitMod * suppressionMod;
        if ((char.passiveSkills||[]).some(id => SKILLS[id]?.effect?.lowHpBonus) && target.currentHp / target.maxHp < 0.5) mod += 0.2;
        let reduction = target.reduction;
        if ((char.passiveSkills||[]).some(id => SKILLS[id]?.effect?.armorBreak)) reduction = 0;
        let dmg = Math.round(st.atk * mod * (1 - reduction));
        let isCrit = false;
        if (Math.random() * 100 < st.crit) { dmg = Math.round(dmg * 1.5); isCrit = true; addQuestLog('クリティカル！', 'act'); }
        dmg = Math.max(1, dmg);
        target.currentHp = Math.max(0, target.currentHp - dmg);
        const hitLabel = hitCount > 1 ? `${char.name}（${h+1}ヒット）→ ${target.name} に ${dmg} ダメージ${target.currentHp<=0?'（撃破！）':''}` : `${char.name} → ${target.name} に ${dmg} ダメージ${target.currentHp<=0?'（撃破！）':''}`;
        addQuestLog(hitLabel, 'dmg');
        qs._anims.push({ type: isCrit ? 'enemy_crit' : 'enemy_dmg', dmg, idx: targetIdx });
      }

      // キラーインスティンクト
      if ((char.passiveSkills||[]).some(id => SKILLS[id]?.effect?.killExtraAttack) && target.currentHp <= 0) {
        const next = qs.enemies.find(e => e.currentHp > 0);
        if (next) {
          let d2 = Math.max(1, Math.round(st.atk * (1 - next.reduction)));
          next.currentHp = Math.max(0, next.currentHp - d2);
          addQuestLog(`キラーインスティンクト！ ${next.name} に追加 ${d2} ダメージ`, 'act');
          qs._anims.push({ type: 'enemy_dmg', dmg: d2, idx: qs.enemies.indexOf(next) });
        }
      }
    }
    char.tempDodgeBonus = 0;
  } else {
    char.tempDodgeBonus = 30;
    char.attackedLastRound = false; // 防御選択でサプレッションリセット
    addQuestLog(`${char.name} は防御態勢（回避率+30%）`, 'act');
  }

  questAfterPlayerAction();
}

function questUseSkill(skillId) {
  const qs = S.quest;
  const char = qs.char;
  const sk = SKILLS[skillId];
  if (!sk || (char.skillCTs[skillId]||0) > 0) return;
  qs.phase = 'resolving';

  let ctVal = sk.ct;
  if ((char.passiveSkills||[]).some(id => SKILLS[id]?.effect?.ctReduction)) ctVal = Math.max(1, ctVal - 1);
  char.skillCTs[skillId] = ctVal;

  const e = sk.effect;
  if (e.damageMod) {
    const target = qs.enemies.find(en => en.currentHp > 0);
    if (target) {
      let reduction = target.reduction;
      if ((char.passiveSkills||[]).some(id => SKILLS[id]?.effect?.armorBreak)) reduction = 0;
      let dmg = Math.round(char.stats.atk * e.damageMod * (1 - reduction));
      if (Math.random() * 100 < char.stats.crit) { dmg = Math.round(dmg * 1.5); addQuestLog('クリティカル！', 'act'); }
      dmg = Math.max(1, dmg);
      target.currentHp = Math.max(0, target.currentHp - dmg);
      addQuestLog(`${char.name} の ${sk.name} → ${target.name} に ${dmg} ダメージ${target.currentHp<=0?'（撃破！）':''}`, 'dmg');
    }
  } else if (e.healPct || e.selfHeal) {
    const ratio = e.healPct || e.selfHeal;
    const heal = Math.round(char.maxHp * ratio);
    char.currentHp = Math.min(char.maxHp, char.currentHp + heal);
    if (e.cleanse) char.statusEffects = [];
    addQuestLog(`${char.name} の ${sk.name} → HP+${heal}`, 'heal');
  } else if (e.stun) {
    qs.skipEnemyTurns = (qs.skipEnemyTurns||0) + qs.enemies.filter(en => en.currentHp > 0).length;
    addQuestLog(`${char.name} の ${sk.name}！ 敵がスタン！`, 'act');
  } else if (e.apBonus) {
    addQuestLog(`${char.name} の ${sk.name}！`, 'act');
  }

  char.tempDodgeBonus = 0;
  questAfterPlayerAction();
}

function questUseItem(itemId, itemIndex) {
  const qs = S.quest;
  const char = qs.char;
  const def = CONSUMABLES[itemId];
  if (!def) return;
  qs.items.splice(itemIndex, 1);
  qs.phase = 'resolving';

  const e = def.effect;
  if (e.healFlat) {
    char.currentHp = Math.min(char.maxHp, char.currentHp + e.healFlat);
    addQuestLog(`${def.icon}${def.name} 使用 → HP+${e.healFlat}`, 'heal');
  } else if (e.dmgFlat) {
    if (e.aoe) {
      qs.enemies.forEach(en => {
        if (en.currentHp <= 0) return;
        en.currentHp = Math.max(0, en.currentHp - e.dmgFlat);
        addQuestLog(`${def.icon}${def.name} → ${en.name} に ${e.dmgFlat} ダメージ`, 'dmg');
      });
    } else {
      const target = qs.enemies.find(en => en.currentHp > 0);
      if (target) {
        target.currentHp = Math.max(0, target.currentHp - e.dmgFlat);
        addQuestLog(`${def.icon}${def.name} → ${target.name} に ${e.dmgFlat} ダメージ${target.currentHp<=0?'（撃破！）':''}`, 'dmg');
      }
    }
  } else if (e.atkBuff) {
    char.stats.atk = Math.round(char.stats.atk * (1 + e.atkBuff));
    addQuestLog(`${def.icon}${def.name} 使用 → 攻撃力UP`, 'act');
  }

  char.tempDodgeBonus = 0;
  questAfterPlayerAction();
}

function questAfterPlayerAction() {
  const qs = S.quest;
  if (qs.enemies.every(e => e.currentHp <= 0)) {
    questWaveEnd();
    return;
  }
  questEnemyPhase();
}

function questEnemyPhase() {
  const qs = S.quest;
  const char = qs.char;

  qs.enemies.forEach(enemy => {
    if (enemy.currentHp <= 0) return;
    if (qs.skipEnemyTurns > 0) {
      qs.skipEnemyTurns--;
      addQuestLog(`${enemy.name} はスタン中！`, 'sys');
      return;
    }
    const action = weightedRandom(enemy.actions);
    let dmg = Math.round(enemy.atk * action.damageMod);
    let reduction = char.stats.reduction;
    if ((char.passiveSkills||[]).some(id => SKILLS[id]?.effect?.damageReduction)) {
      const sk = (char.passiveSkills||[]).map(id=>SKILLS[id]).find(s=>s?.effect?.damageReduction);
      if (sk) reduction += sk.effect.damageReduction;
    }
    reduction = clamp(reduction, 0, 0.8);
    dmg = Math.max(1, Math.round(dmg * (1 - reduction)));

    const dodge = char.stats.dodge + (char.tempDodgeBonus||0);
    if (!qs._anims) qs._anims = [];
    if (Math.random() * 100 < dodge) {
      addQuestLog(`${char.name} は ${enemy.name} の ${action.name} を回避！`, 'act');
      qs._anims.push({ type: 'player_miss' });
      if ((char.passiveSkills||[]).some(id => SKILLS[id]?.effect?.counterAttack)) {
        const cDmg = Math.round(char.stats.atk * 0.5);
        enemy.currentHp = Math.max(0, enemy.currentHp - cDmg);
        addQuestLog(`カウンター！ ${enemy.name} に ${cDmg} ダメージ`, 'dmg');
        qs._anims.push({ type: 'enemy_dmg', dmg: cDmg, idx: qs.enemies.indexOf(enemy) });
      }
      return;
    }
    if ((char.passiveSkills||[]).some(id => SKILLS[id]?.effect?.lastStand) && !char.usedLastStand && char.currentHp - dmg <= 0) {
      char.usedLastStand = true;
      char.currentHp = 1;
      addQuestLog(`ラストスタンド発動！ HP1で耐えた！`, 'sys');
      qs._anims.push({ type: 'player_dmg', dmg: 1 });
      return;
    }
    char.currentHp = Math.max(0, char.currentHp - dmg);
    addQuestLog(`${enemy.name} の ${action.name} → ${char.name} に ${dmg} ダメージ（残:${char.currentHp}）`, 'dmg');
    qs._anims.push({ type: 'player_dmg', dmg });
  });

  // ラウンド終了処理
  // サプレッション：攻撃しなかったターンはリセット
  if (!char.attackedLastRound) char.attackedLastRound = false;
  Object.keys(char.skillCTs).forEach(sid => { char.skillCTs[sid] = Math.max(0, (char.skillCTs[sid]||0) - 1); });
  if ((char.passiveSkills||[]).some(id => SKILLS[id]?.effect?.selfHealPerTurn)) {
    const heal = Math.round(char.maxHp * 0.05);
    char.currentHp = Math.min(char.maxHp, char.currentHp + heal);
    addQuestLog(`フィールドメディック: HP+${heal}`, 'heal');
  }
  char.tempDodgeBonus = 0;
  qs.round++;

  if (char.currentHp <= 0) { endQuestBattle(false); return; }
  if (qs.enemies.every(e => e.currentHp <= 0)) { questWaveEnd(); return; }

  qs.phase = 'choosing_action';
  renderQuestBattle();
}

function questWaveEnd() {
  const qs = S.quest;
  addQuestLog(`Wave ${qs.waveIndex+1} クリア！`, 'sys');
  qs.char.tempDodgeBonus = 0;
  if (qs.waveIndex + 1 < qs.quest.waves.length) {
    qs.phase = 'wave_clear';
  } else {
    endQuestBattle(true);
    return;
  }
  renderQuestBattle();
}

function nextQuestWave() {
  const qs = S.quest;
  qs.waveIndex++;
  qs.enemies = makeQuestWave(qs.quest.waves[qs.waveIndex]);
  qs.skipEnemyTurns = 0;
  qs.phase = 'choosing_action';
  // Wave間HP回復（最大HPの30%）
  const waveHeal = Math.round(qs.char.maxHp * 0.30);
  qs.char.currentHp = Math.min(qs.char.maxHp, qs.char.currentHp + waveHeal);
  addQuestLog(`── Wave ${qs.waveIndex+1} 開始！ 体勢を整えてHP+${waveHeal} ──`, 'heal');
  renderQuestBattle();
}

function endQuestBattle(win) {
  const qs = S.quest;
  qs.phase = 'end';
  let drops = [], exp = 0, money = 0;

  if (win) {
    addQuestLog('🎉 クエスト完了！', 'sys');
    renderQuestBattle(); // 止めを刺した後の画面を更新してから遷移
    const q = qs.quest;
    exp = q.drops.expReward;
    money = q.drops.moneyReward;

    // 武器ドロップ
    if (Math.random() < q.drops.dropRate) {
      const wid = q.drops.weapons[Math.floor(Math.random() * q.drops.weapons.length)];
      const wDef = WEAPONS[wid];
      const rarities = ['common', 'uncommon', 'rare'];
      const rarity = rarities[Math.floor(Math.random() * rarities.length)];
      const numSk = RARITY_SKILL_COUNT[rarity] || 1;
      const wSkills = [];
      let activeCount = 0;
      for (let i = 0; i < numSk; i++) {
        const s = pickWeightedSkill(rarity, wSkills, activeCount);
        if (s) {
          wSkills.push(s);
          if (SKILLS[s]?.type === 'active') activeCount++;
        }
      }
      const drop = { type:'weapon', weaponId:wid, name:wDef.name, rarity, skills:wSkills };
      drops.push(drop);
      if (!S.inventory.weapons) S.inventory.weapons = [];
      S.inventory.weapons.push({ id:'w_'+Date.now(), weaponId:wid, name:wDef.name, rarity, skills:wSkills });
    }

    // 素材
    const matCount = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < matCount; i++) {
      const mat = q.drops.materials[Math.floor(Math.random() * q.drops.materials.length)];
      drops.push({ type:'material', name:mat });
      if (!S.inventory.materials) S.inventory.materials = {};
      S.inventory.materials[mat] = (S.inventory.materials[mat]||0) + 1;
    }

    // EXP/マネー
    const myChar = S.characters[qs.charIdx || 0];
    myChar.exp = (myChar.exp||0) + exp;
    while (myChar.level < MAX_LEVEL) {
      const needed = expToNextLevel(myChar.level);
      if (myChar.exp >= needed) {
        myChar.exp -= needed;
        myChar.level++;
        if (myChar.skillPoints === undefined) myChar.skillPoints = 0;
        myChar.skillPoints++;
        addQuestLog(`🎉 Lv.UP! → Lv.${myChar.level}（SP+1）`, 'sys');
      } else break;
    }
    S.inventory.money += money;
    save();
  } else {
    addQuestLog('💀 クエスト失敗...', 'sys');
    renderQuestBattle();
  }

  setTimeout(() => showScreen('quest_result', { win, drops, exp, money }), delay(800));
}

function renderQuestResult(params) {
  const { win, drops, exp, money } = params;
  const dropHtml = drops.map(d => {
    if (d.type === 'weapon') {
      const rc = { common:'r-common', uncommon:'r-uncommon', rare:'r-rare' }[d.rarity] || 'r-common';
      return `<div class="drop-item">
        <div class="drop-icon">🔫</div>
        <div class="drop-info">
          <h4 class="${rc}">${d.name}</h4>
          <p>スキル: ${(d.skills||[]).map(id=>SKILLS[id]?.name||id).join('、')||'なし'}</p>
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
        <h1>${win?'COMPLETE':'FAILED'}</h1>
        <p>${win?'クエストをクリアした！':'クエスト失敗...'}</p>
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
        <button class="btn btn-primary" onclick="showScreen('home')" style="margin-bottom:8px">🏠 ホームに戻る</button>
        <button class="btn btn-secondary" onclick="showScreen('quest_list')">📋 クエスト一覧へ</button>
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

  // バトルログ（折りたたみ対応）
  const logCollapsed = bt.logCollapsed !== false;
  const logEntries = logCollapsed ? bt.log.slice(-4) : bt.log.slice(-50);
  const logHtml = logEntries.map(e => `<div class="log-entry ${e.cls}">${e.msg}</div>`).join('');

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
      <div class="cbc-inner">
        <div class="cbc-left">
          <div class="cbc-name">${c.name}</div>
          <div class="cbc-pos"><span class="pos-badge pos-${c.position}">${POS_NAMES[c.position]}</span></div>
          <div class="ap-dots">${apDots}</div>
          <div class="cbc-hp-text">${c.currentHp}/${c.maxHp}</div>
        </div>
        <div class="cbc-right">${charAvatarHtml(c, 36)}</div>
      </div>
      <div class="cbc-hp-bar"><div class="cbc-hp-fill ${hpCls}" style="width:${hpPct}%"></div></div>
    </div>`;
  }).join('');

  // アクション UI
  let actionsHtml = '';

  // オンライン：自分のターン待ちオーバーレイ
  if (S.onlineRoom && bt.phase === 'player_action' && !onlineIsMyTurn()) {
    const cur = bt.party[bt.turnOrder[bt.currentTurnIdx]];
    actionsHtml = `<div style="padding:20px;text-align:center;color:var(--text2)">
      ⏳ <strong style="color:var(--text)">${cur?.name || '?'}</strong> のターンを待っています...
    </div>`;
  }
  if (bt.phase === 'player_action' && bt.selectedCharIdx !== null) {
    const c = bt.party[bt.selectedCharIdx];
    const w = WEAPONS[c.weaponId];
    const atkApCost = w.attackApCost || 1;
    const hasQuickDrawR = (c.passiveSkills||[]).some(id => SKILLS[id]?.effect?.attackAfterMove);
    const canAtk = w.attackSlots.includes(c.position) && (w.canAttackAfterMove !== false || !c.hasMoved || hasQuickDrawR) && c.ap >= atkApCost;
    const hasFreeMove = (c.passiveSkills||[]).some(id => SKILLS[id]?.effect?.freeMoveAp);
    const moveCostR = 1 + (ARMORS[c.armorId]?.moveCostExtra||0);
    const canMove = (hasFreeMove || c.ap >= moveCostR) && !(w.noMoveAfterAttack && c.hasFiredThisTurn);
    const hasItems = bt.items.length > 0 && c.ap >= 1;

    if (bt.actionPhase === 'choosing_action') {
      // スキルスロット収集（武器スキル＋キャラスキル、最大4個）
      const wpSkIds  = getWeaponActiveSkills(c);
      const chrSkIds = (c.activeSkills||[]).filter(id => SKILLS[id]?.category !== 'weapon');
      const allSkIds = [...wpSkIds, ...chrSkIds];
      const slots    = [0,1,2,3].map(i => allSkIds[i] || null);

      const skillSlotHtml = (skillId, slotNo) => {
        if (!skillId) return `
          <button class="action-btn" disabled style="opacity:0.25;font-size:18px">
            ー
            <div class="action-desc">スキルなし</div>
          </button>`;
        const sk = SKILLS[skillId];
        const ct = c.skillCTs[skillId] || 0;
        const canUse = ct === 0 && c.ap >= sk.apCost;
        const isWp = wpSkIds.includes(skillId);
        return `<button class="action-btn ${isWp?'atk':'skl'}" ${!canUse?'disabled':''} onclick="playerUseActiveSkill('${skillId}')">
          ${isWp?'🔫':'✨'} ${sk.name}
          <div class="action-desc" style="font-size:10px;margin:2px 0;opacity:0.85">${sk.desc}</div>
          <div class="action-desc">${ct>0?`<span style="color:var(--danger)">CT:${ct}T</span>`:`AP:${sk.apCost}`}</div>
        </button>`;
      };

      actionsHtml = `
        <div class="turn-label">⚡ ${c.name} のターン（AP:${c.ap}）</div>
        <div class="action-grid">
          <button class="action-btn atk" ${!canAtk?'disabled':''} onclick="playerAttack()">
            🔫 通常攻撃
            <div class="action-desc">AP:${atkApCost}${atkApCost>1?' ⚠️':''} / ${w.name}</div>
          </button>
          <button class="action-btn itm" ${!hasItems?'disabled':''} onclick="showItemPanel()">
            💊 アイテム
            <div class="action-desc">${bt.items.length}個所持</div>
          </button>
          ${slots.map((id,i) => skillSlotHtml(id,i)).join('')}
          <button class="action-btn mov" onclick="showMovePanel()" ${!canMove?'disabled style="opacity:0.35"':''}>
            🚶 移動
            <div class="action-desc">${hasFreeMove?'AP消費なし':'AP:1'} / ポジション変更</div>
          </button>
          <button class="action-btn" onclick="endPlayerTurn()" style="background:var(--bg3);border:1px solid var(--border)">
            ✅ ターン終了
            <div class="action-desc">AP消費なし</div>
          </button>
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
      function skillItem(id) {
        const sk = SKILLS[id]; if(!sk) return '';
        const ct = c.skillCTs[id] || 0;
        const onCt = ct > 0;
        const clickable = !onCt && c.ap >= sk.apCost;
        return `<div class="skill-list-item ${onCt?'on-ct':''}" onclick="${clickable?`playerUseActiveSkill('${id}')`:''}" style="cursor:${clickable?'pointer':'default'}">
          <div>
            <div class="sli-name">${sk.name}</div>
            <div class="sli-desc">${sk.desc}</div>
          </div>
          <div class="sli-ct">${onCt?`CT:${ct}T`:`AP:${sk.apCost}`}</div>
        </div>`;
      }
      const weaponSkillIds = getWeaponActiveSkills(c);
      const charSkillIds   = (c.activeSkills||[]).filter(id => SKILLS[id]?.category !== 'weapon');
      const weaponSkillsHtml = weaponSkillIds.length
        ? weaponSkillIds.map(skillItem).join('')
        : '<p style="color:var(--text2);font-size:12px">なし</p>';
      const charSkillsHtml = charSkillIds.length
        ? charSkillIds.map(skillItem).join('')
        : '<p style="color:var(--text2);font-size:12px">なし</p>';
      actionsHtml = `
        <div class="turn-label">スキルを選択</div>
        <div class="sub-panel">
          <div style="font-size:11px;color:var(--warn);font-weight:700;margin-bottom:4px">🔫 武器スキル</div>
          ${weaponSkillsHtml}
          <div style="font-size:11px;color:var(--accent);font-weight:700;margin:8px 0 4px">🧑 キャラスキル</div>
          ${charSkillsHtml}
        </div>
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

      <div class="battle-log-wrap">
        <div class="battle-log-header" onclick="toggleBattleLog()">
          <span>バトルログ</span>
          <span>${logCollapsed ? '▸ 展開' : '▾ 閉じる'}</span>
        </div>
        <div class="battle-log ${logCollapsed ? 'collapsed' : 'expanded'}" id="battle-log">${logHtml}</div>
      </div>

      <div class="battle-party-area">${partyHtml}</div>

      <div class="battle-weapon-area">
        ${bt.party.map(c => {
          const w = WEAPONS[c.weaponId] || {};
          return `<div class="weapon-slot">
            <div class="weapon-slot-icon">${weaponImg(c.weaponId, 36, 24)}</div>
            <div class="weapon-slot-name">${w.name||'?'} ${w.isPlaceholder?'<span style="font-size:8px;color:var(--text2)">準備中</span>':''}</div>
          </div>`;
        }).join('')}
      </div>

      <div class="battle-actions-area">${actionsHtml}</div>
    </div>
  `);

  // ログを最下部にスクロール
  const logEl = document.getElementById('battle-log');
  if (logEl) logEl.scrollTop = logEl.scrollHeight;

  // アニメーション処理
  if (bt._anims?.length) {
    const anims = bt._anims.splice(0);
    processBattleAnimations(anims);
  }
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

// ── ONLINE MULTIPLAYER ─────────────────────────────────────

let _fbUnsubscribe = null;
let _heartbeatTimer = null;
let _disconnectTimer = null;

function onlineGetPlayerId() {
  let pid = localStorage.getItem('rf_player_id');
  if (!pid) {
    pid = 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2,6);
    localStorage.setItem('rf_player_id', pid);
  }
  return pid;
}

function onlineGenRoomId() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:6}, () => c[Math.floor(Math.random()*c.length)]).join('');
}

async function onlineCreateRoom() {
  if (!window.RTDB) { alert('Firebase未接続'); return; }
  const { ref, set } = window.RTDB_UTILS;
  const playerId = onlineGetPlayerId();
  const roomId = onlineGenRoomId();
  const lb = S.lobby;
  const myChar = S.characters[lb.myCharIndex];

  await set(ref(window.RTDB, `rooms/${roomId}`), {
    hostId: playerId,
    bossId: lb.bossId,
    phase: 'waiting',
    createdAt: Date.now(),
    items: lb.items.map(i => i||null),
    positions: lb.positions,
    party: {
      0: onlineCharEntry(myChar, playerId, 0),
    },
  });

  S.onlineRoom = { roomId, playerId, isHost: true, partySlotIdx: 0 };
  onlineStartListener(roomId);
  renderLobby();
}

async function onlineJoinRoom(roomId) {
  if (!window.RTDB) { alert('Firebase未接続'); return; }
  const { ref, get, update } = window.RTDB_UTILS;
  const playerId = onlineGetPlayerId();
  roomId = roomId.trim().toUpperCase();

  const snap = await get(ref(window.RTDB, `rooms/${roomId}`));
  if (!snap.exists()) { alert('ルームが見つかりません: ' + roomId); return; }
  const room = snap.val();
  if (room.phase !== 'waiting') { alert('このルームは既に開始しています'); return; }

  const party = room.party || {};
  let slotIdx = -1;
  for (let i = 0; i < 4; i++) { if (!party[i]) { slotIdx = i; break; } }
  if (slotIdx === -1) { alert('ルームが満員です'); return; }

  const myChar = S.characters[S.lobby.myCharIndex];
  const updates = {};
  updates[`rooms/${roomId}/party/${slotIdx}`] = onlineCharEntry(myChar, playerId, slotIdx);
  await update(ref(window.RTDB), updates);

  S.onlineRoom = { roomId, playerId, isHost: false, partySlotIdx: slotIdx };
  S.lobby.bossId = room.bossId;
  onlineStartListener(roomId);
  renderLobby();
}

function onlineCharEntry(char, playerId, slotIdx) {
  return {
    playerId, slotIdx,
    name: char.name, weaponId: char.weaponId, armorId: char.armorId,
    passiveSkills: char.passiveSkills||[], activeSkills: char.activeSkills||[],
    learnedSkills: char.learnedSkills||[], inventory: char.inventory||{},
    lastActiveAt: Date.now(),
  };
}

function onlineLeaveRoom() {
  if (_fbUnsubscribe) { _fbUnsubscribe(); _fbUnsubscribe = null; }
  if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
  if (_disconnectTimer) { clearInterval(_disconnectTimer); _disconnectTimer = null; }
  if (S.onlineRoom) {
    const { ref, remove } = window.RTDB_UTILS;
    remove(ref(window.RTDB, `rooms/${S.onlineRoom.roomId}/party/${S.onlineRoom.partySlotIdx}`));
  }
  S.onlineRoom = null;
  renderLobby();
}

function onlineStartListener(roomId) {
  if (_fbUnsubscribe) _fbUnsubscribe();
  const { ref, onValue } = window.RTDB_UTILS;
  _fbUnsubscribe = onValue(ref(window.RTDB, `rooms/${roomId}`), snap => {
    if (!snap.exists()) return;
    const data = snap.val();
    if (data.phase === 'battle') {
      if (!S.onlineRoom?.isHost && data.battle) onlineApplyState(data.battle);
      else if (S.onlineRoom?.isHost && S.battle) renderBattle();
    } else if (data.phase === 'waiting') {
      if (S.screen === 'lobby') renderLobby();
    }
  });
}

function onlineMakePartyMember(c) {
  const st = calcStats(c);
  return {
    ...c, stats: st,
    maxHp: c.maxHp || st.hp,
    currentHp: c.currentHp !== undefined ? c.currentHp : st.hp,
    ap: c.ap !== undefined ? c.ap : 2, maxAp: 2,
    skillCTs: c.skillCTs||{}, statusEffects: c.statusEffects||[],
    tempDodgeBonus: c.tempDodgeBonus||0,
    hasMoved: !!c.hasMoved, hasFiredThisTurn: !!c.hasFiredThisTurn,
    usedLastStand: !!c.usedLastStand,
  };
}

function onlineApplyState(battleData) {
  // 非ホストがFirebaseの状態を受け取って反映
  const bossDef = BOSSES[battleData.bossId];
  const bossState = {
    ...bossDef,
    currentHp: battleData.boss.currentHp,
    maxHp: battleData.boss.maxHp,
    buffs: [],  // renderBattle()が参照するので必須
    statusEffects: battleData.boss.statusEffects||[],
    lastActionId: battleData.boss.lastActionId||null,
  };

  if (!S.battle) {
    // 初回：バトル画面を開く
    S.battle = {
      bossId: battleData.bossId,
      boss: bossState,
      party: battleData.party.map(onlineMakePartyMember),
      round: battleData.round,
      currentTurnIdx: battleData.currentTurnIdx,
      turnOrder: battleData.turnOrder,
      phase: battleData.phase,
      log: battleData.log||[],
      items: battleData.items||[],
      itemsUsed: {},
      selectedCharIdx: null,
      actionPhase: null,
      pendingSkillId: null,
      logCollapsed: false,
      _anims: [],
    };
    showScreen('battle');
  } else {
    // 差分更新
    S.battle.party = battleData.party.map((c, i) => {
      return onlineMakePartyMember({ ...(S.battle.party[i]||{}), ...c });
    });
    S.battle.boss = bossState;
    S.battle.round = battleData.round;
    S.battle.currentTurnIdx = battleData.currentTurnIdx;
    S.battle.turnOrder = battleData.turnOrder;
    S.battle.log = battleData.log||[];
    S.battle.phase = battleData.phase;
    S.battle._anims = [];
    if (battleData.phase === 'end') {
      endBattle(battleData.win);
      return;
    }
    renderBattle();
  }
}

async function onlineSyncBattle() {
  if (!S.onlineRoom?.isHost || !S.battle) return;
  const { ref, update } = window.RTDB_UTILS;
  const { roomId } = S.onlineRoom;
  const b = S.battle;
  const data = {
    bossId: b.bossId,
    round: b.round,
    currentTurnIdx: b.currentTurnIdx,
    turnOrder: b.turnOrder,
    phase: b.phase,
    items: b.items||[],
    party: b.party.map(c => ({
      name: c.name, weaponId: c.weaponId, armorId: c.armorId,
      passiveSkills: c.passiveSkills||[], activeSkills: c.activeSkills||[],
      learnedSkills: c.learnedSkills||[], inventory: c.inventory||{},
      currentHp: c.currentHp, maxHp: c.maxHp, ap: c.ap, maxAp: c.maxAp,
      position: c.position, isNPC: !!c.isNPC, playerId: c.playerId||null,
      hasMoved: !!c.hasMoved, hasFiredThisTurn: !!c.hasFiredThisTurn,
      tempDodgeBonus: c.tempDodgeBonus||0, skillCTs: c.skillCTs||{},
      statusEffects: c.statusEffects||[], usedLastStand: !!c.usedLastStand,
    })),
    boss: {
      currentHp: b.boss.currentHp, maxHp: b.boss.maxHp,
      statusEffects: b.boss.statusEffects||[], lastActionId: b.boss.lastActionId||null,
    },
    log: (b.log||[]).slice(-60),
  };
  await update(ref(window.RTDB, `rooms/${roomId}`), { battle: data, phase: 'battle' });
}

async function onlineStartRaid() {
  if (!S.onlineRoom?.isHost) return;
  const { ref, get, update } = window.RTDB_UTILS;
  const { roomId, playerId } = S.onlineRoom;

  // Firebaseのパーティ情報を取得
  const snap = await get(ref(window.RTDB, `rooms/${roomId}/party`));
  const fbParty = snap.exists() ? snap.val() : {};

  // 通常のstartRaid()を実行
  startRaid();

  // 各スロットにplayerIdを設定
  for (let i = 0; i < 4; i++) {
    if (fbParty[i]) {
      S.battle.party[i].playerId = fbParty[i].playerId;
      // Firebaseから取得したキャラデータで上書き
      const fc = fbParty[i];
      const st = calcStats(fc);
      S.battle.party[i] = { ...S.battle.party[i], ...fc,
        maxHp: st.hp, currentHp: st.hp, stats: st,
        ap: 2, maxAp: 2, position: S.battle.party[i].position,
        isNPC: fc.playerId !== playerId && !fc.playerId ? true : false,
        skillCTs: {}, statusEffects: [], hasMoved: false,
        hasFiredThisTurn: false, tempDodgeBonus: 0, usedLastStand: false,
      };
    }
  }
  // 自分のplayerIdを自分のスロットに
  S.battle.party[S.onlineRoom.partySlotIdx].playerId = playerId;
  S.battle.party[S.onlineRoom.partySlotIdx].isNPC = false;

  // ハートビート開始
  onlineStartHeartbeat();
  onlineStartDisconnectWatcher();

  await onlineSyncBattle();
  await update(ref(window.RTDB, `rooms/${roomId}`), { phase: 'battle' });
}

function onlineIsMyTurn() {
  if (!S.onlineRoom || !S.battle) return true;
  const cur = S.battle.turnOrder?.[S.battle.currentTurnIdx];
  if (cur === undefined) return false;
  if (cur.type === 'boss') return false;
  const c = S.battle.party[cur.idx];
  return c?.playerId === S.onlineRoom.playerId;
}

function onlineStartHeartbeat() {
  if (_heartbeatTimer) clearInterval(_heartbeatTimer);
  _heartbeatTimer = setInterval(() => {
    if (!S.onlineRoom || !S.battle) return;
    const { ref, update } = window.RTDB_UTILS;
    update(ref(window.RTDB), {
      [`rooms/${S.onlineRoom.roomId}/party/${S.onlineRoom.partySlotIdx}/lastActiveAt`]: Date.now()
    });
  }, 20000);
}

function onlineStartDisconnectWatcher() {
  if (_disconnectTimer) clearInterval(_disconnectTimer);
  _disconnectTimer = setInterval(() => {
    if (!S.onlineRoom?.isHost || !S.battle) return;
    const now = Date.now();
    S.battle.party.forEach((c, i) => {
      if (c.isNPC || !c.playerId || c.playerId === S.onlineRoom.playerId) return;
      if (c.lastActiveAt && now - c.lastActiveAt > 60000) {
        addLog(`⚠️ ${c.name} が切断されました（NPCが引き継ぎ）`, 'sys');
        c.isNPC = true;
        c.playerId = null;
        onlineSyncBattle();
        renderBattle();
      }
    });
  }, 10000);
}

// ── ONLINE LOBBY UI ────────────────────────────────────────

function renderOnlineLobbySection() {
  const or = S.onlineRoom;
  if (!or) {
    // 未接続：作成 or 参加
    return `
      <div class="label" style="margin-top:16px">🌐 オンラインレイド</div>
      <div style="display:flex;gap:8px;margin-top:6px">
        <button class="btn" style="flex:1;font-size:13px" onclick="onlineCreateRoom()">ルームを作成</button>
        <div style="flex:1;display:flex;gap:4px">
          <input id="joinRoomInput" placeholder="ルームID" maxlength="6"
            style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);
            background:var(--bg2);color:var(--text);font-size:13px;text-transform:uppercase">
          <button class="btn" style="font-size:13px;padding:8px 12px"
            onclick="onlineJoinRoom(document.getElementById('joinRoomInput').value)">参加</button>
        </div>
      </div>`;
  }
  // 接続済み
  const copyBtn = `<button onclick="navigator.clipboard.writeText('${or.roomId}');this.textContent='✓ コピー済'"
    style="font-size:11px;padding:2px 8px;border-radius:4px;border:none;cursor:pointer;background:var(--bg3);color:var(--text2)">
    コピー</button>`;
  return `
    <div class="label" style="margin-top:16px">🌐 オンラインレイド</div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:10px;margin-top:6px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:12px;color:var(--text2)">${or.isHost ? '🏠 ホスト' : '👤 参加者'}</span>
        <button onclick="onlineLeaveRoom()" style="font-size:11px;padding:2px 8px;border-radius:4px;border:none;cursor:pointer;background:var(--bg3);color:var(--danger)">退出</button>
      </div>
      <div style="font-size:14px;font-weight:700;letter-spacing:3px;text-align:center;color:var(--pink);margin-bottom:4px">
        ${or.roomId} ${copyBtn}
      </div>
      <div id="onlinePartyStatus" style="font-size:11px;color:var(--text2);text-align:center">参加者を待っています...</div>
    </div>`;
}

// ── LOG ─────────────────────────────────────────────────────
function addLog(msg, cls='') {
  S.battle.log.push({ msg, cls: 'log-entry log-'+cls });
}

// ── INIT ────────────────────────────────────────────────────
load();
showScreen('home');
injectDebugButton();
