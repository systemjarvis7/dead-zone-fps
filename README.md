# DEAD ZONE V2.0 – Realistic 3D FPS Zombie Survival RPG

**DEAD ZONE V2.0** is an upgraded, high-immersion, lightweight 3D First-Person Zombie Survival Shooter built with **Three.js**, **TypeScript**, **Vite**, and procedural Web Audio API synthesis.

---

## ⚡ What's New in V2.0 (AAA-Style Upgrade)

### 1. 🌆 Realistic 3D Village & PBR Environment
- **Detailed Enterable Houses**: Ruined houses with detailed exterior facades, broken windows, doorway frames, and **walkable interiors** featuring tables, supply shelves, and interactive elements.
- **Destroyed Military APC & Wrecks**: Heavy armored troop carrier with angled armor plating, tires, and turret ring, alongside burned sedans and damaged trucks.
- **World Interactivity (`E`)**:
  - **Interactive Doors**: Press `E` to smoothly swing wooden doors open or shut for tactical cover, accompanied by creaking hinge sound effects.
  - **Supply Crates**: Military crates with yellow latches that open when searched, rewarding ammunition, medical supplies, or fragmentation grenades.
  - **Depot Generator**: Activate the power generator in the depot to trigger high-intensity village floodlights.
- **Dynamic Atmospheric Lighting**:
  - **Atmosphere Modes**: Overcast Day, Eerie Dusk, and Pitch Dark Night (where the tactical flashlight becomes essential).
  - PBR roughness/metalness materials, PCF soft shadows, and dense atmospheric fog (`THREE.FogExp2`).

### 2. 🎮 Advanced First-Person Kinetics
- **Human Viewpoint Camera**:
  - Kinetic camera roll (subtle 1.5° camera tilt into the direction of strafe).
  - Walking figure-8 head bobbing and aggressive sprint sway.
  - Realistic jump air-lift and landing camera compression dip.
- **Crouch System (`Ctrl` or `C`)**:
  - Smooth camera height interpolation from 1.7m to 1.05m.
  - Halves movement speed and cuts zombie detection range by 50% for stealth.
- **Sprint & Stamina (`Shift`)**:
  - Dedicated stamina bar on the HUD (100 Max). Drains while sprinting; regenerates when walking or resting.
- **Tactical Flashlight (`F`)**:
  - High-power real-time spotlight attached to the player camera, illuminating dark interiors and night village lanes.
- **Melee Attack (`V`)**:
  - High-speed knife slash dealing 45 damage in a 2.2m forward arc with blood splatters and meaty impact audio.
- **Fragmentation Grenades (`G`)**:
  - Parabolic physics projectile with bounce, 2.5-second fuse, high-yield detonation shockwave, particle debris, and up to 150 area-of-effect damage.
- **Weapon Switching (`1` & `2`)**:
  - Toggle between 9MM Tactical Pistol and Tactical Combat Knife.

### 3. 🧟 Realistic 3D Zombie Characters & AI
- **Human-Proportioned Models**: Detailed anatomy with jaw, glowing sunken eye sockets, torn clothing (bloody flannel, decayed worker jackets, denim), and claw hands.
- **Enemy Classes**:
  - **Normal Zombie**: Shambling patrol, spots player, pursues with whisker obstacle avoidance, and swipes when close.
  - **Runner Zombie**: Hunched predator posture, aggressive sprint cycle, and rapid double claw frenzy.
  - **The Abomination (Boss Titan)**: 1.75x scale behemoth with armored carapace, ground slam shockwaves, and heavy melee damage.
- **Combat Reactions**:
  - Flinches backward and flashes red on body hits.
  - Violent head snap-back on critical headshots.
  - Ragdoll-style collapse onto back with ground sinking upon death.
  - Spatial 3D sound: growls and shrieks grow louder as enemies close in.

### 4. 🎛️ Modern Tactical HUD & Radar
- **Tactical Radar / Minimap (Top-Right)**:
  - Real-time scanning radar showing player orientation needle, map borders, and glowing red blips for nearby infected within 36m.
- **Vitality & Stamina Panel (Bottom-Left)**:
  - Health bar with low-health pulse and red warning vignette.
  - Stamina bar and Stance badge (`[STAND]`, `[CROUCH]`, `[SPRINT]`).
- **Tactical Weapon Card (Bottom-Right)**:
  - Active weapon name, ammo count (`12 / 48`), grenade inventory (`💣 x3`), flashlight status (`🔦 ON/OFF`), and reload progress bar.
- **Combat Feedback**:
  - Dynamic blooming crosshair, white body hitmarkers, gold headshot hitmarkers, directional damage arc indicator pointing toward attackers, and centered `[E]` interaction prompts.

---

## 🕹️ Controls Reference

| Action | Key / Input |
|---|---|
| **Move / Strafe** | `W`, `A`, `S`, `D` |
| **Look Around** | `Mouse` (Pointer Lock) |
| **Fire Weapon** | `Left Mouse Button` |
| **Aim Down Sights (ADS)** | `Right Mouse Button` (Hold) |
| **Sprint** | `Shift` (Hold while moving forward) |
| **Crouch (Stealth)** | `Ctrl` or `C` |
| **Jump** | `Space` |
| **Reload** | `R` |
| **Interact (Doors / Crates / Switch)** | `E` |
| **Flashlight Toggle** | `F` |
| **Melee Knife Strike** | `V` |
| **Throw Grenade** | `G` |
| **Switch Weapons** | `1` & `2` |
| **Pause / Resume** | `ESC` |

---

## 🚀 Quick Launch

The project runs locally through Vite:

```bash
npm run dev
```

Open **`http://localhost:3000/`** in your browser, click to lock pointer, and survive!
