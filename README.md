# DEAD ZONE – 3D FPS Survival RPG

**DEAD ZONE** is a lightweight, fully playable 3D First-Person Shooter Survival RPG built with **Three.js**, **TypeScript**, **Vite**, and procedural Web Audio API synthesis.

---

## ⚡ Quick Launch Instructions

### Prerequisites
- Node.js (v18+ recommended)
- Modern web browser (Chrome, Edge, Firefox, Brave)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Locally in Development Mode
```bash
npm run dev
```
Open **[http://localhost:3000/](http://localhost:3000/)** in your browser. Click anywhere on the screen to lock the mouse pointer and begin!

### 3. Build for Production (Optional)
```bash
npm run build
npm run preview
```

---

## 🎮 Controls

| Action | Key / Input |
|---|---|
| **Move** | `W`, `A`, `S`, `D` |
| **Look Around** | `Mouse` (Pointer Lock) |
| **Fire Weapon** | `Left Mouse Button` |
| **Aim Down Sights (ADS)** | `Right Mouse Button` (Hold) |
| **Sprint** | `Shift` (Hold while moving forward) |
| **Jump** | `Space` |
| **Reload** | `R` |
| **Pause / Resume** | `ESC` |

---

## 🔫 Weapons & Combat Mechanics

### 9MM Tactical Pistol
- **Damage**: 25 per hit
- **Critical Headshot**: 2.0x Multiplier (50 Damage) with distinct crunch audio & golden hitmarker
- **Magazine**: 12 rounds
- **Reserve Ammo**: 48 rounds
- **Reload Duration**: 2.0 seconds with multi-phase mechanical audio (mag drop, insertion, slide rack)
- **Firing Mechanics**: Semi-automatic with raycast hit detection, procedural recoil kick, iron sights alignment, muzzle flash, and dynamic crosshair spread.

---

## 🧟 Enemy Types

1. **Normal Zombie**:
   - **Health**: 100 HP
   - **Speed**: Slow (~2.4 m/s)
   - **Damage**: 10
   - **Behavior**: Shambling patrol, spots player, pursues with obstacle avoidance, melee attacks when in range (< 1.8m).
   - **Reward**: +20 XP, +5 Coins

2. **Fast Mutant**:
   - **Health**: 60 HP
   - **Speed**: Fast (~4.8 m/s)
   - **Damage**: 15
   - **Behavior**: Aggressive predator sprint, leaps and swipes with mutated claws.
   - **Reward**: +35 XP, +8 Coins

3. **The Abomination (Boss Titan)**:
   - **Health**: 400 HP
   - **Speed**: Medium (~3.0 m/s)
   - **Damage**: 25
   - **Behavior**: Heavily armored mutate, resists knockback, slams the ground for heavy melee damage.
   - **Spawns**: Level 5 campaign climax and every 5th wave of Endless Survival (Waves 5, 10, 15...).
   - **Reward**: +120 XP, +45 Coins

---

## 🎯 Game Modes

### Mode A: Level Campaign Mode
- **Level 1**: *Village Outskirts* – Eliminate 5 zombies.
- **Level 2**: *The Silent Crossroad* – Clear 10 zombies from roads and houses.
- **Level 3**: *Mutant Infestation* – Survive 15 hostiles; introduces Fast Mutants.
- **Level 4**: *Dead Center* – Eliminate 20 ferocious infected in the heart of the village.
- **Level 5**: *The Abomination* – Defeat 15 infected and destroy the mutated Boss titan.

*Rewards mission XP and coins, unlocks subsequent levels in LocalStorage.*

### Mode B: Endless Survival
- Wave 1 starts with 3 zombies.
- Hostile counts and spawn rates scale dynamically with each wave.
- Fast mutants spawn starting at Wave 3.
- Mutated Boss titans appear every 5th wave.
- Live stats tracked: Wave, Remaining Enemies, Kills, Survival Time.
- High score saved automatically to LocalStorage.

---

## 💎 Simple RPG System & Progression

- **Player XP & Leveling**:
  - Level 1: 0 – 99 XP
  - Level 2: 100 – 249 XP
  - Level 3: 250 – 449 XP
  - Level 4: 450 – 699 XP
  - Level 5+: Scales with +350 XP per tier
- **Level Up Bonuses**:
  - **+10 Max HP** per level (Level 2 = 110 HP, Level 3 = 120 HP, etc.).
  - Instantly restores vitality to full upon leveling up!
- **Currency & LocalStorage Saving**:
  - Coins earned from enemy drops and mission completion.
  - Automatic persistent save of Player Level, XP, Coins, Unlocked Levels, Highest Wave, Total Kills, and Settings.

---

## 📦 Pickups

- 🩺 **Health Kit**: Restores **30 HP**.
- 📦 **Ammo Box**: Restores **24 Pistol Bullets**.
- 🪙 **Coin**: Grants **+10 Coins**.
- *Pickups spawn across village hotspots and have a 38% drop rate upon eliminating infected enemies.*

---

## 🔊 Audio Engine (Web Audio API)
- 100% procedural Web Audio synthesis with zero external audio assets to fail or buffer.
- Features: Gunshot punch with mechanical slide, empty dry-fire click, multi-stage reload, flesh impact, wall ricochet, zombie growls, attack swipes, player heartbeat/damage thuds, pickup chimes, wave horns, and level completion fanfares.

---

## 🛠️ Architecture Overview

```
src/
├── core/
│   ├── AudioManager.ts       # Synthesized procedural Web Audio API engine
│   ├── InputManager.ts      # Pointer lock, WASD, mouse look, sensitivity
│   ├── SaveManager.ts       # LocalStorage persistence for RPG stats & settings
│   └── Types.ts             # Enums, level configs, and interfaces
├── world/
│   └── VillageEnvironment.ts # Low-poly village, houses, cars, barricades, colliders
├── entities/
│   ├── Player.ts            # First-person controller, physics, jumping, ADS
│   ├── Weapon.ts            # 3D pistol viewmodel, raycast hit detection, recoil
│   ├── Enemy.ts             # Zombie, Fast Mutant, Boss procedural models & AI
│   ├── Pickup.ts            # Health, ammo, and coin bobbing 3D items
│   └── Particles.ts         # Spark, blood, and hit effect particle system
├── managers/
│   ├── EnemyManager.ts      # Spawning, pooling, drops, and collision updates
│   └── GameManager.ts       # Level & Survival state machines and RPG logic
├── ui/
│   └── UIManager.ts         # HUD, Main Menu, Level Select, Pause, Game Over
├── style.css                # Dark post-apocalyptic styling, HUD & modals
└── main.ts                  # Three.js scene bootstrap and game loop
```
