// ============================================================
//  RAID FRONTIER — Game Data
// ============================================================

const WEAPONS = {
  handgun: {
    id: 'handgun', name: 'ハンドガン', icon: '🔫',
    baseAtk: 40, speedMod: 2,
    attackSlots: ['front', 'mid'],
    canAttackAfterMove: true,
    desc: '軽量で扱いやすい。移動後も射撃可能。',
  },
  desert_eagle: {
    id: 'desert_eagle', name: 'デザートイーグル', icon: '🔫',
    baseAtk: 75, speedMod: -1,
    attackSlots: ['front', 'mid'],
    canAttackAfterMove: false,
    recoilDodgePenalty: 15,
    desc: '高威力だが硬直あり。撃った後は回避率が下がる。',
  },
  assault_rifle: {
    id: 'assault_rifle', name: 'アサルトライフル', icon: '🔫',
    baseAtk: 55, speedMod: 0,
    attackSlots: ['front', 'mid', 'back'],
    canAttackAfterMove: true,
    desc: 'バランス型。どの位置からでも攻撃可能。',
  },
  lmg: {
    id: 'lmg', name: 'LMG', icon: '🔫',
    baseAtk: 45, speedMod: -2,
    attackSlots: ['front', 'mid'],
    canAttackAfterMove: false,
    aoe: true,
    desc: '扇状に複数体を攻撃。重いため移動後は撃てない。',
  },
  sniper: {
    id: 'sniper', name: 'スナイパーライフル', icon: '🎯',
    baseAtk: 100, speedMod: -1,
    attackSlots: ['back'],
    canAttackAfterMove: false,
    desc: '後衛専用。全スロットの敵を高火力で狙撃。',
  },
  shotgun: {
    id: 'shotgun', name: 'ショットガン', icon: '🔫',
    baseAtk: 70, speedMod: 0,
    attackSlots: ['front'],
    canAttackAfterMove: true,
    desc: '前衛専用。近距離の敵に高火力。',
  },
};

const ARMORS = {
  light_jacket: {
    id: 'light_jacket', name: 'ライトジャケット', icon: '🧥',
    reduction: 0, dodgeMod: 10, hpBonus: 0, speedMod: 3, moveCostExtra: 0,
    desc: '軽量。回避率と素早さにボーナス。',
  },
  tactical_vest: {
    id: 'tactical_vest', name: 'タクティカルベスト', icon: '🦺',
    reduction: 0.15, dodgeMod: 0, hpBonus: 0, speedMod: 0, moveCostExtra: 0,
    desc: 'バランス型。15%ダメージ軽減。',
  },
  heavy_armor: {
    id: 'heavy_armor', name: 'ヘビィアーマー', icon: '🛡️',
    reduction: 0.35, dodgeMod: -20, hpBonus: 200, speedMod: -3, moveCostExtra: 1,
    desc: '高耐久。HP+200・35%軽減だが回避率と素早さが大きく低下。',
  },
};

// スキル定義
const SKILLS = {
  // 🔴 火力系
  dead_eye:         { id:'dead_eye',         name:'デッドアイ',         type:'passive', tree:'fire',    tier:1, desc:'クリティカル率+15%',                    effect:{ critRate:15 } },
  power_shot:       { id:'power_shot',       name:'パワーショット',     type:'passive', tree:'fire',    tier:1, desc:'通常攻撃の威力+10%',                  effect:{ atkMod:0.10 } },
  hunters_eye:      { id:'hunters_eye',      name:'ハンターズアイ',     type:'passive', tree:'fire',    tier:1, desc:'HP50%以下の敵への攻撃威力+20%',       effect:{ lowHpBonus:0.20 } },
  armor_break:      { id:'armor_break',      name:'アーマーブレイク',   type:'passive', tree:'fire',    tier:2, desc:'攻撃時、敵の軽減率を1ターン無効化',   effect:{ armorBreak:true } },
  killer_instinct:  { id:'killer_instinct',  name:'キラーインスティンクト', type:'passive', tree:'fire', tier:3, desc:'敵を倒したターン、もう1回攻撃可能', effect:{ killExtraAttack:true } },
  burst_shot:       { id:'burst_shot',       name:'バーストショット',   type:'active',  tree:'fire',    tier:1, ct:3,  apCost:1, desc:'通常攻撃の1.8倍ダメージ',                  effect:{ damageMod:1.8 } },
  magnum_break:     { id:'magnum_break',     name:'マグナムブレイク',   type:'active',  tree:'fire',    tier:3, ct:5,  apCost:2, desc:'2.5倍ダメージ＋敵を後退させる',           effect:{ damageMod:2.5, pushBack:true } },
  // 🔵 回避系
  last_stand:       { id:'last_stand',       name:'ラストスタンド',     type:'passive', tree:'dodge',   tier:1, desc:'HP1で耐える（1バトル1回）',            effect:{ lastStand:true } },
  dodge_master:     { id:'dodge_master',     name:'ダッジマスター',     type:'passive', tree:'dodge',   tier:1, desc:'回避率+20%',                           effect:{ dodgeRate:20 } },
  counter:          { id:'counter',          name:'カウンター',         type:'passive', tree:'dodge',   tier:2, desc:'回避成功時、反撃（通常攻撃の50%）',   effect:{ counterAttack:0.5 } },
  shadow_step:      { id:'shadow_step',      name:'シャドウステップ',   type:'passive', tree:'dodge',   tier:2, desc:'移動時に回避率が1ターン+15%',          effect:{ moveEvadeBonus:15 } },
  ghost_move:       { id:'ghost_move',       name:'ゴーストムーブ',     type:'passive', tree:'dodge',   tier:3, desc:'素早さ+3',                            effect:{ speedBonus:3 } },
  back_step:        { id:'back_step',        name:'バックステップ',     type:'active',  tree:'dodge',   tier:1, ct:2,  apCost:1, desc:'1スロット後退＋そのターンの攻撃を確定回避', effect:{ retreat:true, guaranteedDodge:true } },
  smoke_dash:       { id:'smoke_dash',       name:'スモークダッシュ',   type:'active',  tree:'dodge',   tier:3, ct:4,  apCost:1, desc:'前衛⇔後衛を即座に入れ替え＋回避率1T+30%',  effect:{ swapPos:true, tempDodge:30 } },
  // 🟢 回復・支援系
  field_medic:      { id:'field_medic',      name:'フィールドメディック', type:'passive', tree:'heal',  tier:1, desc:'毎ターン自分のHPを5%回復',             effect:{ selfHealPerTurn:0.05 } },
  triage:           { id:'triage',           name:'トリアージ',         type:'passive', tree:'heal',    tier:1, desc:'味方HP30%以下で自動回復（HP20%）',    effect:{ autoHeal:true, threshold:0.3, healAmount:0.2 } },
  toughness:        { id:'toughness',        name:'タフネス',           type:'passive', tree:'heal',    tier:2, desc:'HP+50',                               effect:{ hpBonus:50 } },
  first_aid:        { id:'first_aid',        name:'応急処置',           type:'active',  tree:'heal',    tier:1, ct:2,  apCost:1, desc:'自分か味方1人のHPを30%回復',              effect:{ healPct:0.3 } },
  revive:           { id:'revive',           name:'蘇生',               type:'active',  tree:'heal',    tier:3, ct:8,  apCost:2, desc:'戦闘不能の味方をHP20%で復活',             effect:{ revive:true, reviveHp:0.2 } },
  // 🟡 妨害・戦術系
  engineer:         { id:'engineer',         name:'エンジニア',         type:'passive', tree:'tactic',  tier:1, desc:'消耗品の効果+20%',                     effect:{ itemBonus:0.2 } },
  sabotage:         { id:'sabotage',         name:'サボタージュ',       type:'passive', tree:'tactic',  tier:1, desc:'攻撃命中時、敵の素早さ-2（1T）',       effect:{ onHitSpeedDebuff:2 } },
  scout:            { id:'scout',            name:'スカウト',           type:'passive', tree:'tactic',  tier:2, desc:'敵の次の行動を予告表示',               effect:{ showNextAction:true } },
  flashbang:        { id:'flashbang',        name:'フラッシュバン',     type:'active',  tree:'tactic',  tier:2, ct:3,  apCost:1, desc:'敵1体を1ターンスタン',                    effect:{ stun:1 } },
  turret:           { id:'turret',           name:'タレット設置',       type:'active',  tree:'tactic',  tier:1, ct:5,  apCost:2, desc:'自動射撃タレットを3ターン設置',           effect:{ deployTurret:true, duration:3 } },
  // ⚪ 汎用系
  tactical_armor:   { id:'tactical_armor',   name:'タクティカルアーマー', type:'passive', tree:'general', tier:1, desc:'被ダメージ-15%',                    effect:{ damageReduction:0.15 } },
  cool_head:        { id:'cool_head',        name:'クールヘッド',       type:'passive', tree:'general', tier:1, desc:'アクティブスキルのCT-1T',              effect:{ ctReduction:1 } },
  survival:         { id:'survival',         name:'サバイバル',         type:'passive', tree:'general', tier:2, desc:'バトル開始時HP+20%ボーナス',           effect:{ startHpBonus:0.2 } },
  steady_hand:      { id:'steady_hand',      name:'ステディハンド',     type:'passive', tree:'general', tier:2, desc:'硬直中の回避ペナルティ無効',           effect:{ noRecoilPenalty:true } },
  multi_role:       { id:'multi_role',       name:'マルチロール',       type:'passive', tree:'general', tier:3, desc:'スキルスロット+1（パッシブ or アクティブ）', effect:{ extraSlot:1 } },
  adrenaline:       { id:'adrenaline',       name:'アドレナリン',       type:'active',  tree:'general', tier:1, ct:4,  apCost:1, desc:'1ターンAP+1',                             effect:{ apBonus:1 } },
  second_wind:      { id:'second_wind',      name:'セカンドウィンド',   type:'active',  tree:'general', tier:2, ct:6,  apCost:1, desc:'自分のHPを20%回復＋状態異常解除',         effect:{ selfHeal:0.2, cleanse:true } },
};

// テンプレートNPCキャラクター
const TEMPLATE_NPCS = [
  {
    id: 'npc_assault',
    name: 'テンプレ：アサルト',
    icon: '⚔️',
    weaponId: 'assault_rifle',
    armorId: 'tactical_vest',
    passiveSkills: ['power_shot', 'tactical_armor'],
    activeSkills: ['burst_shot'],
    level: 5,
    isNPC: true,
    isTemplate: true,
  },
  {
    id: 'npc_sniper',
    name: 'テンプレ：スナイパー',
    icon: '🎯',
    weaponId: 'sniper',
    armorId: 'light_jacket',
    passiveSkills: ['dead_eye', 'dodge_master'],
    activeSkills: ['burst_shot'],
    level: 5,
    isNPC: true,
    isTemplate: true,
  },
  {
    id: 'npc_medic',
    name: 'テンプレ：メディック',
    icon: '💊',
    weaponId: 'handgun',
    armorId: 'tactical_vest',
    passiveSkills: ['field_medic', 'triage'],
    activeSkills: ['first_aid'],
    level: 5,
    isNPC: true,
    isTemplate: true,
  },
  {
    id: 'npc_tank',
    name: 'テンプレ：タンク',
    icon: '🛡️',
    weaponId: 'shotgun',
    armorId: 'heavy_armor',
    passiveSkills: ['tactical_armor', 'toughness'],
    activeSkills: ['adrenaline'],
    level: 5,
    isNPC: true,
    isTemplate: true,
  },
];

// ボス定義
const BOSSES = {
  factory_guardian: {
    id: 'factory_guardian',
    name: '廃工場の番人',
    icon: '🤖',
    recommendedLevel: 10,
    difficulty: 3,
    hp: 900,
    atk: 60,
    reduction: 0.2,
    speed: 8,
    desc: '廃工場に潜む重装甲の番人。前衛への攻撃を得意とする。',
    actions: [
      { id:'front_attack',  name:'強襲',       weight:35, type:'single', target:'front',  damageMod:1.0 },
      { id:'random_attack', name:'乱射',       weight:25, type:'single', target:'random', damageMod:0.85 },
      { id:'aoe_attack',    name:'爆撃',       weight:25, type:'aoe',    target:'all',    damageMod:0.55 },
      { id:'buff',          name:'戦闘態勢',   weight:15, type:'buff',   target:'self',   buffStat:'atk', buffValue:1.25, buffTurns:2 },
    ],
    drops: {
      materials: ['鋼材', '火薬', '電子部品'],
      weapons: [
        { weaponId:'assault_rifle', name:'改造アサルトライフル', rarity:'rare',  skills:['power_shot','armor_break'] },
        { weaponId:'lmg',           name:'番人の重火器',         rarity:'epic',  skills:['power_shot','killer_instinct'] },
      ],
      expReward: 1200,
      moneyReward: 500,
    },
  },
};

// 消耗品
const CONSUMABLES = {
  med_kit: {
    id:'med_kit',     name:'応急キット',     icon:'💊', desc:'自分のHPを40回復',         effect:{ healFlat:40 },  target:'self',
  },
  med_pack: {
    id:'med_pack',    name:'メディパック',   icon:'🩺', desc:'味方1人のHPを60回復',      effect:{ healFlat:60 },  target:'ally',
  },
  grenade: {
    id:'grenade',     name:'手榴弾',         icon:'💣', desc:'敵に80の範囲ダメージ',      effect:{ dmgFlat:80, aoe:true }, target:'enemy',
  },
  smoke: {
    id:'smoke',       name:'スモーク',       icon:'💨', desc:'1ターン敵の命中率-30%',     effect:{ enemyAccDebuff:30, turns:1 }, target:'enemy',
  },
  ammo_boost: {
    id:'ammo_boost',  name:'高品質弾薬',     icon:'🔶', desc:'1バトル攻撃力+15%・命中+10', effect:{ atkBuff:0.15, accBuff:10 }, target:'self',
  },
};

// ツリー表示名
const TREE_NAMES = {
  fire:    '🔴 火力系',
  dodge:   '🔵 回避系',
  heal:    '🟢 回復・支援系',
  tactic:  '🟡 妨害・戦術系',
  general: '⚪ 汎用系',
};

// 武器アイコンマッピング
const WEAPON_ICONS = { handgun:'🔫', desert_eagle:'🔫', assault_rifle:'🔫', lmg:'🔫', sniper:'🎯', shotgun:'🔫' };

// ポジション表示名
const POS_NAMES = { front:'前衛', mid:'中衛', back:'後衛' };
