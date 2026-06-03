// ============================================================
//  RAID FRONTIER — Game Data
// ============================================================

// ── EXP設計 ────────────────────────────────────────────────
const MAX_LEVEL = 40;

function expToNextLevel(level) {
  if (level >= MAX_LEVEL) return Infinity;
  return Math.floor(500 * Math.pow(level, 1.8));
}

// ── 武器 ────────────────────────────────────────────────────
// tier: 1〜5（製造年・性能基準）
// type: 'handgun' | 'smg' | 'assault_rifle' | 'lmg' | 'sniper' | 'shotgun'
const WEAPONS = {

  // ─── STARTER ───────────────────────────────────────────
  m1_garand: {
    id: 'm1_garand', name: 'M1 Garand', img: 'm1_garand',
    tier: 2, type: 'assault_rifle',
    baseAtk: 28, speedMod: 0,
    attackSlots: ['front', 'mid', 'back'], canAttackAfterMove: false,
    isDefault: true, weaponSkills: ['burst_shot'],
    desc: '初期支給の半自動ライフル。単発だが取り扱いやすい。',
  },

  // ─── TIER 1 ────────────────────────────────────────────
  c96: {
    id: 'c96', name: 'モーゼルC96', img: 'c96',
    tier: 1, type: 'handgun',
    baseAtk: 22, speedMod: 4, critBonus: 10,
    attackSlots: ['front', 'mid'], canAttackAfterMove: true,
    posAccuracyPenalty: { mid: 20 },
    weaponSkills: ['burst_shot'],
    desc: '旧式の自動拳銃。全武器中最高の素早さ・高クリティカル。中衛で命中率-20%。',
  },
  m1911: {
    id: 'm1911', name: 'M1911', img: 'm1911',
    tier: 1, type: 'handgun',
    baseAtk: 26, speedMod: 4, critBonus: 10,
    attackSlots: ['front', 'mid'], canAttackAfterMove: true,
    posAccuracyPenalty: { mid: 20 },
    weaponSkills: ['burst_shot'],
    desc: '信頼性の高い45口径ピストル。高速・高クリティカル。中衛で命中率-20%。',
  },
  hi_power: {
    id: 'hi_power', name: 'ブローニングHPM35', img: 'hi_power',
    tier: 1, type: 'handgun',
    baseAtk: 28, speedMod: 4, critBonus: 10,
    attackSlots: ['front', 'mid'], canAttackAfterMove: true,
    posAccuracyPenalty: { mid: 20 },
    weaponSkills: ['burst_shot'],
    desc: '大容量マガジンの9mm拳銃。高速・高クリティカル。中衛で命中率-20%。',
  },
  mp18: {
    id: 'mp18', name: 'MP18', img: 'mp18',
    tier: 1, type: 'smg',
    baseAtk: 20, speedMod: 4,
    multiHit: 2, hitDamageMod: 0.55, posAccuracyPenalty: { mid: 15 },
    attackSlots: ['front', 'mid'], canAttackAfterMove: true,
    weaponSkills: ['burst_shot'],
    desc: '世界初の実用的なSMG。1攻撃2ヒット（各55%）。中衛で命中率-15%。',
  },
  thompson: {
    id: 'thompson', name: 'トンプソンM1928', img: 'thompson',
    tier: 1, type: 'smg',
    baseAtk: 25, speedMod: 2,
    multiHit: 2, hitDamageMod: 0.55, posAccuracyPenalty: { mid: 15 },
    attackSlots: ['front', 'mid'], canAttackAfterMove: true,
    weaponSkills: ['burst_shot'],
    desc: '大口径弾SMG。1攻撃2ヒット（各55%）。中衛で命中率-15%。',
  },
  mosin: {
    id: 'mosin', name: 'モシン・ナガン', img: 'mosin',
    tier: 1, type: 'sniper',
    baseAtk: 78, speedMod: -2, attackApCost: 2,
    attackSlots: ['back'], canAttackAfterMove: false,
    weaponSkills: ['burst_shot'],
    desc: '旧式のボルトアクションライフル。低速だが高火力。攻撃にAP2消費。',
  },
  m1903: {
    id: 'm1903', name: 'M1903スプリングフィールド', img: 'm1903',
    tier: 1, type: 'sniper',
    baseAtk: 74, speedMod: -2, attackApCost: 2,
    attackSlots: ['back'], canAttackAfterMove: false,
    weaponSkills: ['burst_shot'],
    desc: '米軍制式ボルトアクション。高精度・高火力。攻撃にAP2消費。',
  },
  lewis: {
    id: 'lewis', name: 'ルイス軽機関銃', img: 'lewis',
    tier: 1, type: 'lmg',
    baseAtk: 30, speedMod: -3,
    attackSlots: ['front', 'mid'], canAttackAfterMove: false,
    aoe: true, weaponSkills: ['burst_shot'],
    desc: '旧式の軽機関銃。扇状に攻撃する。',
  },

  // ─── TIER 2 ────────────────────────────────────────────
  kar98k: {
    id: 'kar98k', name: 'Kar98k', img: 'kar98k',
    tier: 2, type: 'sniper',
    baseAtk: 94, speedMod: -1, attackApCost: 2,
    attackSlots: ['back'], canAttackAfterMove: false,
    weaponSkills: ['burst_shot'],
    desc: 'WW2ドイツ軍制式ライフル。高信頼性・高火力。攻撃にAP2消費。',
  },
  walther_p38: {
    id: 'walther_p38', name: 'ワルサーP38', img: 'walther_p38',
    tier: 2, type: 'handgun',
    baseAtk: 34, speedMod: 4, critBonus: 10,
    attackSlots: ['front', 'mid'], canAttackAfterMove: true,
    posAccuracyPenalty: { mid: 20 },
    weaponSkills: ['burst_shot'],
    desc: 'WW2ドイツ将校用拳銃。高速・高クリティカル。中衛で命中率-20%。',
  },
  mp40: {
    id: 'mp40', name: 'MP40', img: 'mp40',
    tier: 2, type: 'smg',
    baseAtk: 32, speedMod: 3,
    multiHit: 2, hitDamageMod: 0.55, posAccuracyPenalty: { mid: 15 },
    attackSlots: ['front', 'mid'], canAttackAfterMove: true,
    weaponSkills: ['burst_shot'],
    desc: 'WW2ドイツ軍SMG。1攻撃2ヒット（各55%）。中衛で命中率-15%。',
  },
  mg42: {
    id: 'mg42', name: 'MG42', img: 'mg42',
    tier: 2, type: 'lmg',
    baseAtk: 52, speedMod: -2,
    attackSlots: ['front', 'mid'], canAttackAfterMove: false,
    aoe: true, weaponSkills: ['burst_shot'],
    desc: '秒間1200発。WW2最強の機関銃。',
  },
  bar: {
    id: 'bar', name: 'BAR M1918', img: 'bar',
    tier: 2, type: 'lmg',
    baseAtk: 45, speedMod: -1,
    attackSlots: ['front', 'mid'], canAttackAfterMove: false,
    aoe: true, weaponSkills: ['burst_shot'],
    desc: '米軍の軽機関銃。比較的機動性がある。',
  },
  rpd: {
    id: 'rpd', name: 'RPD', img: 'rpd',
    tier: 2, type: 'lmg',
    baseAtk: 48, speedMod: -2,
    attackSlots: ['front', 'mid'], canAttackAfterMove: false,
    aoe: true, weaponSkills: ['burst_shot'],
    desc: 'ソ連製軽機関銃。信頼性が高い。',
  },

  // ─── TIER 3 ────────────────────────────────────────────
  ak47: {
    id: 'ak47', name: 'AK-47', img: 'ak47',
    tier: 3, type: 'assault_rifle',
    baseAtk: 55, speedMod: 0,
    attackSlots: ['front', 'mid', 'back'], canAttackAfterMove: false,
    weaponSkills: ['burst_shot'],
    desc: '世界で最も有名なAR。タフで信頼性抜群。',
  },
  akm: {
    id: 'akm', name: 'AKM', img: 'akm',
    tier: 3, type: 'assault_rifle',
    baseAtk: 58, speedMod: 0,
    attackSlots: ['front', 'mid', 'back'], canAttackAfterMove: false,
    weaponSkills: ['burst_shot'],
    desc: 'AK-47の改良版。より軽量で精度向上。',
  },
  m14: {
    id: 'm14', name: 'M14', img: 'm14',
    tier: 3, type: 'assault_rifle',
    baseAtk: 65, speedMod: -1,
    attackSlots: ['front', 'mid', 'back'], canAttackAfterMove: false,
    weaponSkills: ['burst_shot'],
    desc: '強力な7.62mm弾のバトルライフル。',
  },
  m60: {
    id: 'm60', name: 'M60', img: 'm60',
    tier: 3, type: 'lmg',
    baseAtk: 62, speedMod: -2,
    attackSlots: ['front', 'mid'], canAttackAfterMove: false,
    aoe: true, weaponSkills: ['burst_shot'],
    desc: 'ベトナム戦争で活躍した汎用機関銃。',
  },
  pkm: {
    id: 'pkm', name: 'PKM', img: 'pkm',
    tier: 3, type: 'lmg',
    baseAtk: 65, speedMod: -2,
    attackSlots: ['front', 'mid'], canAttackAfterMove: false,
    aoe: true, weaponSkills: ['burst_shot'],
    desc: 'ソ連製汎用機関銃。高い連射性能。',
  },
  svd: {
    id: 'svd', name: 'SVD（ドラグノフ）', img: 'svd',
    tier: 3, type: 'sniper',
    baseAtk: 118, speedMod: -1, attackApCost: 2,
    attackSlots: ['back'], canAttackAfterMove: false,
    weaponSkills: ['burst_shot'],
    desc: 'ソ連製狙撃ライフル。高火力。攻撃にAP2消費。',
  },
  mp5: {
    id: 'mp5', name: 'MP5', img: 'mp5',
    tier: 3, type: 'smg',
    baseAtk: 45, speedMod: 3,
    multiHit: 2, hitDamageMod: 0.55, posAccuracyPenalty: { mid: 15 },
    attackSlots: ['front', 'mid'], canAttackAfterMove: true,
    weaponSkills: ['burst_shot'],
    desc: '特殊部隊御用達の高精度SMG。1攻撃2ヒット（各55%）。中衛で命中率-15%。',
  },
  m16a1: {
    id: 'm16a1', name: 'M16A1', img: 'm16a1',
    tier: 3, type: 'assault_rifle',
    baseAtk: 58, speedMod: 1,
    attackSlots: ['front', 'mid', 'back'], canAttackAfterMove: false,
    weaponSkills: ['burst_shot'],
    desc: 'ベトナム戦争から活躍する米軍AR。',
  },
  psg1: {
    id: 'psg1', name: 'PSG-1', img: 'psg1',
    tier: 3, type: 'sniper',
    baseAtk: 126, speedMod: -1, attackApCost: 2,
    attackSlots: ['back'], canAttackAfterMove: false,
    weaponSkills: ['magnum_break'],
    desc: 'ドイツ製精密狙撃ライフル。極めて高精度・高火力。攻撃にAP2消費。',
  },
  ak74: {
    id: 'ak74', name: 'AK-74', img: 'ak74',
    tier: 3, type: 'assault_rifle',
    baseAtk: 60, speedMod: 1,
    attackSlots: ['front', 'mid', 'back'], canAttackAfterMove: false,
    weaponSkills: ['burst_shot'],
    desc: '5.45mm弾を採用した改良型AK。リコイル低下。',
  },
  beretta_92f: {
    id: 'beretta_92f', name: 'ベレッタ92F', img: 'beretta_92f',
    tier: 3, type: 'handgun',
    baseAtk: 48, speedMod: 5, critBonus: 10,
    attackSlots: ['front', 'mid'], canAttackAfterMove: true,
    posAccuracyPenalty: { mid: 20 },
    weaponSkills: ['burst_shot'],
    desc: '米軍制式9mm拳銃。高速・高クリティカル。中衛で命中率-20%。',
  },
  uzi: {
    id: 'uzi', name: 'Uzi', img: 'uzi',
    tier: 3, type: 'smg',
    baseAtk: 38, speedMod: 4,
    multiHit: 2, hitDamageMod: 0.55, posAccuracyPenalty: { mid: 15 },
    attackSlots: ['front', 'mid'], canAttackAfterMove: true,
    weaponSkills: ['burst_shot'],
    desc: 'イスラエル製コンパクトSMG。1攻撃2ヒット（各55%）。中衛で命中率-15%。',
  },

  // ─── TIER 4 ────────────────────────────────────────────
  desert_eagle: {
    id: 'desert_eagle', name: 'デザートイーグル', img: 'desert_eagle',
    tier: 4, type: 'handgun',
    baseAtk: 75, speedMod: -1, critBonus: 10,
    attackSlots: ['front', 'mid'], canAttackAfterMove: false,
    recoilDodgePenalty: 15, posAccuracyPenalty: { mid: 20 },
    weaponSkills: ['magnum_break'],
    desc: '高威力だが撃った後は回避率低下・硬直あり。中衛で命中率-20%。',
  },
  glock17: {
    id: 'glock17', name: 'グロック17', img: 'glock17',
    tier: 4, type: 'handgun',
    baseAtk: 52, speedMod: 5, critBonus: 10,
    attackSlots: ['front', 'mid'], canAttackAfterMove: true,
    posAccuracyPenalty: { mid: 20 },
    weaponSkills: ['burst_shot'],
    desc: '世界で最も普及した拳銃。高速・高クリティカル。中衛で命中率-20%。',
  },
  barrett_m82: {
    id: 'barrett_m82', name: 'バレットM82', img: 'barrett_m82',
    tier: 4, type: 'sniper',
    baseAtk: 174, speedMod: -2, attackApCost: 2,
    attackSlots: ['back'], canAttackAfterMove: false,
    weaponSkills: ['magnum_break'],
    desc: '対物ライフル。装甲すら貫通する圧倒的破壊力。攻撃にAP2消費。',
  },
  m249: {
    id: 'm249', name: 'M249 SAW', img: 'm249',
    tier: 4, type: 'lmg',
    baseAtk: 72, speedMod: -2,
    attackSlots: ['front', 'mid'], canAttackAfterMove: false,
    aoe: true, weaponSkills: ['burst_shot'],
    desc: '分隊支援火器。高い持続火力。',
  },
  m24: {
    id: 'm24', name: 'M24 SWS', img: 'm24',
    tier: 4, type: 'sniper',
    baseAtk: 142, speedMod: -1, attackApCost: 2,
    attackSlots: ['back'], canAttackAfterMove: false,
    weaponSkills: ['magnum_break'],
    desc: '米軍制式狙撃銃。高精度・高火力。攻撃にAP2消費。',
  },
  p90: {
    id: 'p90', name: 'P90', img: 'p90',
    tier: 4, type: 'smg',
    baseAtk: 52, speedMod: 3,
    multiHit: 2, hitDamageMod: 0.55, posAccuracyPenalty: { mid: 15 },
    attackSlots: ['front', 'mid'], canAttackAfterMove: true,
    weaponSkills: ['burst_shot'],
    desc: '50発PDW。1攻撃2ヒット（各55%）。中衛で命中率-15%。',
  },
  m4a1: {
    id: 'm4a1', name: 'M4A1', img: 'm4a1',
    tier: 4, type: 'assault_rifle',
    baseAtk: 68, speedMod: 1,
    attackSlots: ['front', 'mid', 'back'], canAttackAfterMove: false,
    weaponSkills: ['burst_shot'],
    desc: '現代米軍の主力カービン。高い汎用性。',
  },
  ump45: {
    id: 'ump45', name: 'UMP45', img: 'ump45',
    tier: 4, type: 'smg',
    baseAtk: 58, speedMod: 2,
    multiHit: 2, hitDamageMod: 0.55, posAccuracyPenalty: { mid: 15 },
    attackSlots: ['front', 'mid'], canAttackAfterMove: true,
    weaponSkills: ['burst_shot'],
    desc: '45口径の高威力SMG。1攻撃2ヒット（各55%）。中衛で命中率-15%。',
  },
  mg4: {
    id: 'mg4', name: 'MG4', img: 'mg4',
    tier: 4, type: 'lmg',
    baseAtk: 78, speedMod: -2,
    attackSlots: ['front', 'mid'], canAttackAfterMove: false,
    aoe: true, weaponSkills: ['burst_shot'],
    desc: 'ドイツ製現代LMG。高い精度と火力。',
  },
  mp7: {
    id: 'mp7', name: 'MP7', img: 'mp7',
    tier: 4, type: 'smg',
    baseAtk: 50, speedMod: 4,
    multiHit: 2, hitDamageMod: 0.55, posAccuracyPenalty: { mid: 15 },
    attackSlots: ['front', 'mid'], canAttackAfterMove: true,
    weaponSkills: ['burst_shot'],
    desc: '小型PDW。1攻撃2ヒット（各55%）。中衛で命中率-15%。',
  },
  cheytac_m200: {
    id: 'cheytac_m200', name: 'CheyTac M200', img: 'cheytac_m200',
    tier: 4, type: 'sniper',
    baseAtk: 192, speedMod: -2, attackApCost: 2,
    attackSlots: ['back'], canAttackAfterMove: false,
    weaponSkills: ['magnum_break'],
    desc: '超長距離狙撃に特化。全武器最高ATK。攻撃にAP2消費。',
  },
  hk416: {
    id: 'hk416', name: 'HK416', img: 'hk416',
    tier: 4, type: 'assault_rifle',
    baseAtk: 72, speedMod: 1,
    attackSlots: ['front', 'mid', 'back'], canAttackAfterMove: false,
    weaponSkills: ['burst_shot'],
    desc: '特殊部隊が採用する最高水準のAR。',
  },

  // ─── TIER 5 ────────────────────────────────────────────
  ak12: {
    id: 'ak12', name: 'AK-12', img: 'ak12',
    tier: 5, type: 'assault_rifle',
    baseAtk: 82, speedMod: 1,
    attackSlots: ['front', 'mid', 'back'], canAttackAfterMove: false,
    weaponSkills: ['burst_shot'],
    desc: 'ロシア最新鋭のAR。AKシリーズの集大成。',
  },
  sig_p320: {
    id: 'sig_p320', name: 'SIG P320', img: 'sig_p320',
    tier: 5, type: 'handgun',
    baseAtk: 68, speedMod: 5, critBonus: 10,
    attackSlots: ['front', 'mid'], canAttackAfterMove: true,
    posAccuracyPenalty: { mid: 20 },
    weaponSkills: ['magnum_break'],
    desc: '米軍新型制式拳銃。最高速・高クリティカル。中衛で命中率-20%。',
  },

  // ─── SHOTGUN（画像準備中）────────────────────────────
  shotgun: {
    id: 'shotgun', name: 'ショットガン', icon: '🔫',
    tier: 3, type: 'shotgun',
    baseAtk: 70, speedMod: 0,
    attackSlots: ['front'], canAttackAfterMove: true,
    isPlaceholder: true, weaponSkills: ['burst_shot'],
    desc: '前衛専用。近距離の敵に高火力。（画像準備中）',
  },
};

// ── 防具 ────────────────────────────────────────────────────
// unlockBoss: nullなら最初から購入可能、ボスIDなら撃破後に解放
const ARMORS = {
  // 初期装備（購入不可・最初から所持）
  basic_jacket: {
    id: 'basic_jacket', name: 'ベーシックジャケット', icon: '🧥',
    reduction: 0, dodgeMod: 0, hpBonus: 30, speedMod: 0, moveCostExtra: 0,
    price: 0, unlockBoss: null, isDefault: true,
    desc: '初期支給の標準装備。可もなく不可もなし。',
  },
  // Lv10ボス撃破で解放
  light_jacket: {
    id: 'light_jacket', name: 'ライトジャケット', icon: '🧥',
    reduction: 0, dodgeMod: 10, hpBonus: 0, speedMod: 3, moveCostExtra: 0,
    price: 800, unlockBoss: 'alpha_01',
    desc: '軽量。回避率と素早さにボーナス。',
  },
  vest: {
    id: 'vest', name: 'ベスト', icon: '🦺',
    reduction: 0.05, dodgeMod: -10, hpBonus: 30, speedMod: 0, moveCostExtra: 0,
    price: 600, unlockBoss: 'alpha_01',
    desc: '薄い防弾ベスト。少し重いが軽減効果あり。',
  },
  ghost_suit: {
    id: 'ghost_suit', name: 'ゴーストスーツ', icon: '👻',
    reduction: 0, dodgeMod: 30, hpBonus: -50, speedMod: 2, moveCostExtra: 0,
    price: 1200, unlockBoss: 'alpha_01',
    desc: '極限まで軽量化。HPは下がるが回避率が大幅UP。',
  },
  // Lv20ボス撃破で解放
  scout_suit: {
    id: 'scout_suit', name: 'スカウトスーツ', icon: '🥷',
    reduction: 0.05, dodgeMod: 15, hpBonus: 0, speedMod: 2, moveCostExtra: 0,
    price: 2000, unlockBoss: 'crawler',
    desc: '軽量と防御を両立。素早さと回避率にボーナス。',
  },
  tactical_vest: {
    id: 'tactical_vest', name: 'タクティカルベスト', icon: '🦺',
    reduction: 0.15, dodgeMod: 0, hpBonus: 50, speedMod: 0, moveCostExtra: 0,
    price: 2500, unlockBoss: 'crawler',
    desc: 'バランス型。HP+50・15%ダメージ軽減。',
  },
  heavy_vest: {
    id: 'heavy_vest', name: 'ヘビィベスト', icon: '🛡️',
    reduction: 0.25, dodgeMod: -10, hpBonus: 100, speedMod: -1, moveCostExtra: 0,
    price: 3000, unlockBoss: 'crawler',
    desc: '重装備。HP+100・25%軽減だが回避率が低下。',
  },
  ballistic_armor: {
    id: 'ballistic_armor', name: 'バリスティックアーマー', icon: '🛡️',
    reduction: 0.40, dodgeMod: -20, hpBonus: 150, speedMod: -3, moveCostExtra: 1,
    price: 4000, unlockBoss: 'crawler',
    desc: '最重装備。HP+150・40%軽減。移動コスト+1。',
  },
};

// ── スキル ──────────────────────────────────────────────────
const SKILLS = {
  // 🔴 火力系
  dead_eye:         { id:'dead_eye',         name:'デッドアイ',             type:'passive', tree:'fire',    tier:1, desc:'クリティカル率+15%',                        effect:{ critRate:15 } },
  power_shot:       { id:'power_shot',       name:'パワーショット',         type:'passive', tree:'fire',    tier:1, desc:'通常攻撃の威力+10%',                        effect:{ atkMod:0.10 } },
  hunters_eye:      { id:'hunters_eye',      name:'ハンターズアイ',         type:'passive', tree:'fire',    tier:1, desc:'HP50%以下の敵への攻撃威力+20%',             effect:{ lowHpBonus:0.20 } },
  armor_break:      { id:'armor_break',      name:'アーマーブレイク',       type:'passive', tree:'fire',    tier:2, desc:'攻撃時、敵の軽減率を1ターン無効化',         effect:{ armorBreak:true } },
  killer_instinct:  { id:'killer_instinct',  name:'キラーインスティンクト', type:'passive', tree:'fire',    tier:3, desc:'敵を倒したターン、もう1回攻撃可能',         effect:{ killExtraAttack:true } },
  burst_shot:       { id:'burst_shot',       name:'バーストショット',       type:'active',  tree:'fire',    tier:1, ct:3, apCost:1, category:'weapon', desc:'通常攻撃の1.8倍ダメージ',   effect:{ damageMod:1.8 } },
  magnum_break:     { id:'magnum_break',     name:'マグナムブレイク',       type:'active',  tree:'fire',    tier:3, ct:5, apCost:2, category:'weapon', desc:'2.5倍ダメージ＋敵を後退させる', effect:{ damageMod:2.5, pushBack:true } },
  // 🔵 回避系
  last_stand:       { id:'last_stand',       name:'ラストスタンド',         type:'passive', tree:'dodge',   tier:1, desc:'HP1で耐える（1バトル1回）',                effect:{ lastStand:true } },
  dodge_master:     { id:'dodge_master',     name:'ダッジマスター',         type:'passive', tree:'dodge',   tier:1, desc:'回避率+20%',                               effect:{ dodgeRate:20 } },
  counter:          { id:'counter',          name:'カウンター',             type:'passive', tree:'dodge',   tier:2, desc:'回避成功時、反撃（通常攻撃の50%）',         effect:{ counterAttack:0.5 } },
  shadow_step:      { id:'shadow_step',      name:'シャドウステップ',       type:'passive', tree:'dodge',   tier:2, desc:'移動時に回避率が1ターン+15%',              effect:{ moveEvadeBonus:15 } },
  ghost_move:       { id:'ghost_move',       name:'ゴーストムーブ',         type:'passive', tree:'dodge',   tier:3, desc:'素早さ+3',                                effect:{ speedBonus:3 } },
  back_step:        { id:'back_step',        name:'バックステップ',         type:'active',  tree:'dodge',   tier:1, ct:2, apCost:1, desc:'1スロット後退＋攻撃を確定回避', effect:{ retreat:true, guaranteedDodge:true } },
  smoke_dash:       { id:'smoke_dash',       name:'スモークダッシュ',       type:'active',  tree:'dodge',   tier:3, ct:4, apCost:1, desc:'前衛⇔後衛入れ替え＋回避率1T+30%', effect:{ swapPos:true, tempDodge:30 } },
  // 🟢 回復・支援系
  field_medic:      { id:'field_medic',      name:'フィールドメディック',   type:'passive', tree:'heal',    tier:1, desc:'毎ターン自分のHPを5%回復',                 effect:{ selfHealPerTurn:0.05 } },
  triage:           { id:'triage',           name:'トリアージ',             type:'passive', tree:'heal',    tier:1, desc:'味方HP30%以下で自動回復（HP20%）',          effect:{ autoHeal:true, threshold:0.3, healAmount:0.2 } },
  toughness:        { id:'toughness',        name:'タフネス',               type:'passive', tree:'heal',    tier:2, desc:'HP+50',                                   effect:{ hpBonus:50 } },
  first_aid:        { id:'first_aid',        name:'応急処置',               type:'active',  tree:'heal',    tier:1, ct:2, apCost:1, desc:'味方1人のHPを30%回復',      effect:{ healPct:0.3 } },
  revive:           { id:'revive',           name:'蘇生',                   type:'active',  tree:'heal',    tier:3, ct:8, apCost:2, desc:'戦闘不能の味方をHP20%で復活', effect:{ revive:true, reviveHp:0.2 } },
  // 🟡 妨害・戦術系
  engineer:         { id:'engineer',         name:'エンジニア',             type:'passive', tree:'tactic',  tier:1, desc:'消耗品の効果+20%',                         effect:{ itemBonus:0.2 } },
  sabotage:         { id:'sabotage',         name:'サボタージュ',           type:'passive', tree:'tactic',  tier:1, desc:'攻撃命中時、敵の素早さ-2（1T）',           effect:{ onHitSpeedDebuff:2 } },
  scout:            { id:'scout',            name:'スカウト',               type:'passive', tree:'tactic',  tier:2, desc:'敵の次の行動を予告表示',                   effect:{ showNextAction:true } },
  flashbang:        { id:'flashbang',        name:'フラッシュバン',         type:'active',  tree:'tactic',  tier:2, ct:3, apCost:1, desc:'敵1体を1ターンスタン',      effect:{ stun:1 } },
  turret:           { id:'turret',           name:'タレット設置',           type:'active',  tree:'tactic',  tier:1, ct:5, apCost:2, desc:'自動射撃タレット3ターン設置', effect:{ deployTurret:true, duration:3 } },
  // ⚪ 汎用系
  tactical_armor:   { id:'tactical_armor',   name:'タクティカルアーマー',   type:'passive', tree:'general', tier:1, desc:'被ダメージ-15%',                           effect:{ damageReduction:0.15 } },
  cool_head:        { id:'cool_head',        name:'クールヘッド',           type:'passive', tree:'general', tier:1, desc:'アクティブスキルのCT-1T',                  effect:{ ctReduction:1 } },
  survival:         { id:'survival',         name:'サバイバル',             type:'passive', tree:'general', tier:2, desc:'バトル開始時HP+20%ボーナス',               effect:{ startHpBonus:0.2 } },
  steady_hand:      { id:'steady_hand',      name:'ステディハンド',         type:'passive', tree:'general', tier:2, desc:'硬直中の回避ペナルティ無効',               effect:{ noRecoilPenalty:true } },
  multi_role:       { id:'multi_role',       name:'マルチロール',           type:'passive', tree:'general', tier:3, desc:'スキルスロット+1',                         effect:{ extraSlot:1 } },
  quick_draw:       { id:'quick_draw',       name:'クイックドロー',         type:'passive', tree:'general', tier:2, desc:'移動後も攻撃可能',                            effect:{ attackAfterMove:true } },
  gunslinger:       { id:'gunslinger',       name:'ガンスリンガー',         type:'passive', tree:'dodge',   tier:2, desc:'位置による命中ペナルティを無効化',             effect:{ ignorePositionPenalty:true } },
  suppression:      { id:'suppression',      name:'サプレッション',         type:'passive', tree:'fire',    tier:2, desc:'前のターンも攻撃していた場合ATK+15%',          effect:{ consecutiveAtkBonus:0.15 } },
  adrenaline:       { id:'adrenaline',       name:'アドレナリン',           type:'active',  tree:'general', tier:1, ct:4, apCost:1, desc:'1ターンAP+1',              effect:{ apBonus:1 } },
  second_wind:      { id:'second_wind',      name:'セカンドウィンド',       type:'active',  tree:'general', tier:2, ct:6, apCost:1, desc:'自分HP20%回復＋状態異常解除', effect:{ selfHeal:0.2, cleanse:true } },
};

// ── テンプレートNPC ─────────────────────────────────────────
const TEMPLATE_NPCS = [
  {
    id: 'npc_assault', name: 'テンプレ：アサルト', icon: '⚔️',
    weaponId: 'm4a1', armorId: 'tactical_vest',
    passiveSkills: ['power_shot', 'tactical_armor'], activeSkills: [],
    level: 5, isNPC: true, isTemplate: true,
  },
  {
    id: 'npc_sniper', name: 'テンプレ：スナイパー', icon: '🎯',
    weaponId: 'm24', armorId: 'light_jacket',
    passiveSkills: ['dead_eye', 'dodge_master'], activeSkills: [],
    level: 5, isNPC: true, isTemplate: true,
  },
  {
    id: 'npc_medic', name: 'テンプレ：メディック', icon: '💊',
    weaponId: 'beretta_92f', armorId: 'tactical_vest',
    passiveSkills: ['field_medic', 'triage'], activeSkills: ['first_aid'],
    level: 5, isNPC: true, isTemplate: true,
  },
  {
    id: 'npc_tank', name: 'テンプレ：タンク', icon: '🛡️',
    weaponId: 'm60', armorId: 'heavy_vest',
    passiveSkills: ['tactical_armor', 'toughness'], activeSkills: ['adrenaline'],
    level: 5, isNPC: true, isTemplate: true,
  },
];

// ── ボス ────────────────────────────────────────────────────
const BOSSES = {
  // Lv10：感染兵士「α-01」
  alpha_01: {
    id: 'alpha_01', name: '感染兵士「α-01」', icon: '🧟',
    recommendedLevel: 10, difficulty: 2,
    hp: 900, atk: 55, reduction: 0.15, speed: 8,
    desc: '軍の実験施設で変異した元兵士。銃を持ったまま凶暴化している。',
    actions: [
      { id:'front_attack',  name:'突進',       weight:40, type:'single', target:'front',  damageMod:1.0 },
      { id:'random_attack', name:'乱射',       weight:25, type:'single', target:'random', damageMod:0.85 },
      { id:'aoe_attack',    name:'爆発弾',     weight:20, type:'aoe',    target:'all',    damageMod:0.5 },
      { id:'buff',          name:'感染覚醒',   weight:15, type:'buff',   target:'self',   buffStat:'atk', buffValue:1.2, buffTurns:2 },
    ],
    drops: {
      materials: ['感染体サンプル', '軍用部品', '火薬'],
      weapons: [
        { weaponId:'thompson',    name:'トンプソン（感染体改造）', rarity:'uncommon', skills:['burst_shot'] },
        { weaponId:'mp40',        name:'MP40（鹵獲品）',           rarity:'rare',     skills:['power_shot', 'burst_shot'] },
        { weaponId:'m1911',       name:'α-01の拳銃',              rarity:'epic',     skills:['dead_eye', 'hunters_eye'] },
        { weaponId:'kar98k',      name:'感染兵士のKar98k',         rarity:'rare',     skills:['burst_shot'] },
      ],
      expReward: 1500, moneyReward: 600,
    },
    unlockArmors: ['light_jacket', 'vest', 'ghost_suit'],
  },

  // Lv20：変異体「クロウラー」
  crawler: {
    id: 'crawler', name: '変異体「クロウラー」', icon: '🦎',
    recommendedLevel: 20, difficulty: 3,
    hp: 2200, atk: 90, reduction: 0.2, speed: 10,
    desc: '四肢が巨大化した大型変異種。素早く後衛を狙い撃つ。',
    actions: [
      { id:'back_attack',   name:'飛びかかり',   weight:35, type:'single', target:'back',   damageMod:1.1 },
      { id:'random_attack', name:'爪撃',         weight:25, type:'single', target:'random', damageMod:0.9 },
      { id:'aoe_attack',    name:'叫喚',         weight:20, type:'aoe',    target:'all',    damageMod:0.6 },
      { id:'buff',          name:'狂乱',         weight:20, type:'buff',   target:'self',   buffStat:'atk', buffValue:1.3, buffTurns:2 },
    ],
    drops: {
      materials: ['変異体組織', '強化骨格', '感染体サンプル'],
      weapons: [
        { weaponId:'ak47',  name:'AK-47（変異体部隊回収品）', rarity:'rare',  skills:['power_shot', 'burst_shot'] },
        { weaponId:'pkm',   name:'クロウラーが持っていたPKM', rarity:'rare',  skills:['armor_break'] },
        { weaponId:'m14',   name:'M14（戦場回収品）',         rarity:'epic',  skills:['armor_break', 'killer_instinct'] },
        { weaponId:'uzi',   name:'Uzi（クロウラー改造）',     rarity:'uncommon', skills:['burst_shot'] },
      ],
      expReward: 5000, moneyReward: 1500,
    },
    unlockArmors: ['scout_suit', 'tactical_vest', 'heavy_vest', 'ballistic_armor'],
  },

  // Lv30：実験体「タイタン」
  titan: {
    id: 'titan', name: '実験体「タイタン」', icon: '👹',
    recommendedLevel: 30, difficulty: 4,
    hp: 4500, atk: 130, reduction: 0.3, speed: 6,
    desc: '研究施設で生み出された巨大変異体。全体攻撃が極めて強力。',
    actions: [
      { id:'aoe_attack',    name:'衝撃波',       weight:35, type:'aoe',    target:'all',    damageMod:0.75 },
      { id:'front_attack',  name:'踏み潰し',     weight:25, type:'single', target:'front',  damageMod:1.3 },
      { id:'random_attack', name:'投擲',         weight:20, type:'single', target:'random', damageMod:1.0 },
      { id:'buff',          name:'装甲強化',     weight:20, type:'buff',   target:'self',   buffStat:'atk', buffValue:1.4, buffTurns:3 },
    ],
    drops: {
      materials: ['タイタン装甲片', '実験体コア', '強化骨格'],
      weapons: [
        { weaponId:'barrett_m82',  name:'対タイタン狙撃銃',    rarity:'epic',   skills:['dead_eye', 'armor_break'] },
        { weaponId:'m249',         name:'実験体部隊のM249',     rarity:'rare',   skills:['burst_shot', 'power_shot'] },
        { weaponId:'hk416',        name:'タイタン護衛のHK416',  rarity:'epic',   skills:['burst_shot', 'armor_break'] },
        { weaponId:'desert_eagle', name:'タイタンキラー',       rarity:'legend', skills:['magnum_break', 'killer_instinct'] },
      ],
      expReward: 15000, moneyReward: 4000,
    },
    unlockArmors: [],
  },

  // Lv40：追跡者「ネメア」
  nemea: {
    id: 'nemea', name: '追跡者「ネメア」', icon: '💀',
    recommendedLevel: 40, difficulty: 5,
    hp: 8000, atk: 180, reduction: 0.35, speed: 14,
    desc: 'プレイヤーを執拗に追跡する最強の特殊個体。倒れた味方を優先的に狙う。',
    actions: [
      { id:'downed_attack', name:'とどめ',       weight:30, type:'single', target:'back',   damageMod:1.4 },
      { id:'front_attack',  name:'猛追',         weight:25, type:'single', target:'front',  damageMod:1.2 },
      { id:'aoe_attack',    name:'絶叫波',       weight:25, type:'aoe',    target:'all',    damageMod:0.8 },
      { id:'buff',          name:'不死の意志',   weight:20, type:'buff',   target:'self',   buffStat:'atk', buffValue:1.5, buffTurns:3 },
    ],
    drops: {
      materials: ['ネメアの核', 'タイタン装甲片', '実験体コア'],
      weapons: [
        { weaponId:'cheytac_m200', name:'ネメアの眼',    rarity:'legend', skills:['dead_eye', 'armor_break', 'hunters_eye'] },
        { weaponId:'ak12',         name:'追跡者の怒り',  rarity:'legend', skills:['killer_instinct', 'power_shot', 'armor_break'] },
        { weaponId:'sig_p320',     name:'ネメアの爪',    rarity:'legend', skills:['magnum_break', 'dead_eye'] },
      ],
      expReward: 45000, moneyReward: 10000,
    },
    unlockArmors: [],
  },
};

// ボスの順番（ロビーで選択する順）
const BOSS_ORDER = ['alpha_01', 'crawler', 'titan', 'nemea'];

// ── 消耗品 ──────────────────────────────────────────────────
const CONSUMABLES = {
  med_kit:    { id:'med_kit',    name:'応急キット',   icon:'💊', desc:'自分のHPを40回復',          effect:{ healFlat:40 },             target:'self'  },
  med_pack:   { id:'med_pack',   name:'メディパック', icon:'🩺', desc:'味方1人のHPを60回復',       effect:{ healFlat:60 },             target:'ally'  },
  grenade:    { id:'grenade',    name:'手榴弾',       icon:'💣', desc:'敵に80の範囲ダメージ',       effect:{ dmgFlat:80, aoe:true },    target:'enemy' },
  smoke:      { id:'smoke',      name:'スモーク',     icon:'💨', desc:'1ターン敵の命中率-30%',      effect:{ enemyAccDebuff:30, turns:1 }, target:'enemy' },
  ammo_boost: { id:'ammo_boost', name:'高品質弾薬',   icon:'🔶', desc:'1バトル攻撃力+15%',         effect:{ atkBuff:0.15 },            target:'self'  },
};

// ── 定数 ────────────────────────────────────────────────────
const TREE_NAMES = {
  fire:'🔴 火力系', dodge:'🔵 回避系', heal:'🟢 回復・支援系',
  tactic:'🟡 妨害・戦術系', general:'⚪ 汎用系',
};
const POS_NAMES = { front:'前衛', mid:'中衛', back:'後衛' };

// ── クエスト敵 ──────────────────────────────────────────────
const QUEST_ENEMIES = {
  infected_foot: {
    id: 'infected_foot', name: '感染歩兵', icon: '🧟',
    hp: 60, atk: 12, reduction: 0, speed: 8,
    actions: [
      { name: '噛みつき', weight: 60, damageMod: 1.0 },
      { name: '突進',     weight: 40, damageMod: 1.3 },
    ],
  },
  mutant_hound: {
    id: 'mutant_hound', name: '変異犬', icon: '🐺',
    hp: 50, atk: 16, reduction: 0, speed: 14,
    actions: [
      { name: '噛みつき',   weight: 50, damageMod: 1.0 },
      { name: '飛びかかり', weight: 50, damageMod: 1.2 },
    ],
  },
  armored_infected: {
    id: 'armored_infected', name: '装甲感染体', icon: '🦾',
    hp: 100, atk: 16, reduction: 0.15, speed: 5,
    actions: [
      { name: '強打',   weight: 70, damageMod: 1.0 },
      { name: '体当たり', weight: 30, damageMod: 1.5 },
    ],
  },
  infected_sniper: {
    id: 'infected_sniper', name: '感染狙撃手', icon: '🎯',
    hp: 70, atk: 20, reduction: 0, speed: 6,
    actions: [
      { name: '狙撃', weight: 100, damageMod: 1.0 },
    ],
  },
  mutant_brute: {
    id: 'mutant_brute', name: '凶暴変異体', icon: '👾',
    hp: 150, atk: 22, reduction: 0.1, speed: 9,
    actions: [
      { name: '乱打',   weight: 50, damageMod: 0.9 },
      { name: '踏み込み', weight: 30, damageMod: 1.3 },
      { name: '猛攻',   weight: 20, damageMod: 1.6 },
    ],
  },
  lab_guardian: {
    id: 'lab_guardian', name: '研究施設守護者', icon: '🤖',
    hp: 130, atk: 24, reduction: 0.15, speed: 7,
    actions: [
      { name: 'レーザー', weight: 60, damageMod: 1.0 },
      { name: 'ミサイル', weight: 40, damageMod: 1.4 },
    ],
  },
};

// ── クエスト ────────────────────────────────────────────────
const QUESTS = [
  {
    id: 'q_factory',
    name: '廃工場の掃討',
    area: '廃工場',
    icon: '🏭',
    recommendedLevel: 3,
    difficulty: 1,
    desc: '廃工場に出没した感染体を駆除せよ。初心者向けの依頼。',
    waves: [
      ['infected_foot', 'infected_foot'],
      ['infected_foot', 'mutant_hound'],
    ],
    drops: {
      weapons: ['c96', 'm1911', 'thompson', 'hi_power'],
      materials: ['軍用部品', '火薬'],
      expReward: 300,
      moneyReward: 150,
      dropRate: 0.5,
    },
  },
  {
    id: 'q_infected_zone',
    name: '感染区の偵察',
    area: '感染区域',
    icon: '☢️',
    recommendedLevel: 8,
    difficulty: 2,
    desc: '感染が広がる市街地エリアを偵察し、感染体を排除せよ。',
    waves: [
      ['infected_foot', 'infected_sniper'],
      ['armored_infected'],
      ['mutant_hound', 'infected_sniper'],
    ],
    drops: {
      weapons: ['mp40', 'walther_p38', 'kar98k', 'mosin'],
      materials: ['感染体サンプル', '軍用部品'],
      expReward: 800,
      moneyReward: 350,
      dropRate: 0.55,
    },
  },
  {
    id: 'q_outpost',
    name: '前哨基地の奪還',
    area: '前哨基地',
    icon: '⛺',
    recommendedLevel: 12,
    difficulty: 2,
    desc: '占拠された前哨基地を取り戻せ。重装甲の敵に注意。',
    waves: [
      ['armored_infected', 'infected_foot'],
      ['mutant_brute'],
    ],
    drops: {
      weapons: ['ak47', 'akm', 'm60', 'rpd'],
      materials: ['軍用部品', '火薬', '感染体サンプル'],
      expReward: 1200,
      moneyReward: 500,
      dropRate: 0.55,
    },
  },
  {
    id: 'q_research',
    name: '研究施設の制圧',
    area: '旧研究施設',
    icon: '🔬',
    recommendedLevel: 18,
    difficulty: 3,
    desc: '変異体の研究施設を制圧せよ。機械兵器の守護者に注意。',
    waves: [
      ['infected_sniper', 'armored_infected'],
      ['mutant_brute', 'infected_foot'],
      ['lab_guardian'],
    ],
    drops: {
      weapons: ['m16a1', 'ak74', 'svd', 'pkm'],
      materials: ['変異体組織', '強化骨格', '実験体コア'],
      expReward: 2500,
      moneyReward: 900,
      dropRate: 0.6,
    },
  },
];
