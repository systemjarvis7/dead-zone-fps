import * as THREE from 'three';
import { AudioManager } from '../core/AudioManager';
import { ParticleSystem } from './Particles';
import { VillageEnvironment } from '../world/VillageEnvironment';

export interface WeaponState {
  currentAmmo: number;
  reserveAmmo: number;
  maxMagazine: number;
  isReloading: boolean;
  reloadProgress: number;
  isAiming: boolean;
  activeWeaponIndex: number; // 1: Pistol, 2: Machine Gun / AR, 3: Sniper Rifle
  activeWeaponName: string;
  grenades: number;
  isSniperAiming: boolean;
}

export interface GrenadeProjectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  exploded: boolean;
}

export interface ShellCasing {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotVelocity: THREE.Vector3;
  life: number;
}

export interface FireballEffect {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  startScale: number;
  targetScale: number;
}

export class Weapon {
  public camera: THREE.PerspectiveCamera;
  public scene: THREE.Scene;
  public audio: AudioManager;
  public particles: ParticleSystem;

  // Active weapon selection: 1 = Pistol, 2 = Assault Rifle / Machine Gun, 3 = Sniper Rifle
  public activeWeaponIndex: number = 1;

  // Weapon 1: Tactical 9mm Pistol
  public pistolCurrentAmmo: number = 12;
  public pistolReserveAmmo: number = 48;
  public readonly pistolMaxMag: number = 12;
  public readonly pistolMaxReserve: number = 72;
  public readonly pistolDamage: number = 28;
  public readonly pistolHeadshotMultiplier: number = 2.5;
  public readonly pistolReloadTime: number = 1.8;
  public readonly pistolFireInterval: number = 0.22;

  // Weapon 2: M4A1 Assault Rifle / Machine Gun (Continuous automatic fire while holding LMB)
  public rifleCurrentAmmo: number = 30;
  public rifleReserveAmmo: number = 120;
  public readonly rifleMaxMag: number = 30;
  public readonly rifleMaxReserve: number = 180;
  public readonly rifleDamage: number = 25;
  public readonly rifleHeadshotMultiplier: number = 2.2;
  public readonly rifleReloadTime: number = 2.3;
  public readonly rifleFireInterval: number = 0.10; // ~600 RPM full auto

  // Weapon 3: AWM High-Caliber Bolt-Action Sniper Rifle
  public sniperCurrentAmmo: number = 5;
  public sniperReserveAmmo: number = 20;
  public readonly sniperMaxMag: number = 5;
  public readonly sniperMaxReserve: number = 30;
  public readonly sniperDamage: number = 160;
  public readonly sniperHeadshotMultiplier: number = 3.5;
  public readonly sniperReloadTime: number = 2.8;
  public readonly sniperFireInterval: number = 1.25; // Bolt cycle delay

  // Grenades & Melee
  public grenades: number = 3;
  public readonly maxGrenades: number = 4;
  private meleeCooldown: number = 0;
  private isMeleeAttacking: boolean = false;
  private meleeTimer: number = 0;

  // Weapon State
  public isReloading: boolean = false;
  private reloadTimer: number = 0;
  private fireCooldown: number = 0;

  // Viewmodel Groups
  public viewmodelGroup: THREE.Group;
  private pistolGroup: THREE.Group;
  private slideMesh!: THREE.Mesh;
  private rifleGroup: THREE.Group;
  private rifleBoltMesh!: THREE.Mesh;
  private sniperGroup: THREE.Group;
  private sniperBoltMesh!: THREE.Mesh;
  private knifeGroup: THREE.Group;

  // Muzzle Flash & Dynamic Light
  private muzzleFlashMesh: THREE.Mesh;
  private muzzleLight: THREE.PointLight;
  private muzzleFlashTimer: number = 0;

  // Positions & Kinetics
  private pistolHipPos = new THREE.Vector3(0.24, -0.22, -0.44);
  private pistolAdsPos = new THREE.Vector3(0.0, -0.145, -0.32);

  private rifleHipPos = new THREE.Vector3(0.26, -0.26, -0.48);
  private rifleAdsPos = new THREE.Vector3(0.0, -0.178, -0.36);

  private sniperHipPos = new THREE.Vector3(0.28, -0.28, -0.52);
  private sniperAdsPos = new THREE.Vector3(0.0, -0.19, -0.38);

  private currentAimPos = new THREE.Vector3();
  private recoilOffset = new THREE.Vector3();
  private recoilRotation = new THREE.Euler();
  private slideOffset: number = 0;
  private swayOffset = new THREE.Vector2();

  // Active Projectiles & Physics
  public activeGrenades: GrenadeProjectile[] = [];
  public activeShells: ShellCasing[] = [];
  public activeFireballs: FireballEffect[] = [];

  // Grenade Pre-throw Trajectory Arc & Ground Blast Ring
  private trajectoryLine: THREE.Line;
  private blastIndicatorRing: THREE.Mesh;
  public isHoldingGrenade: boolean = false;

  // Raycaster
  private raycaster = new THREE.Raycaster();

  // Callbacks
  public onShoot?: () => void;
  public onReloadStart?: () => void;
  public onReloadFinish?: () => void;
  public onHitEnemy?: (damage: number, isHeadshot: boolean, hitPoint: THREE.Vector3) => void;
  public onGrenadeExplode?: (pos: THREE.Vector3, radius: number, damage: number) => void;
  public onGunshotFired?: (pos: THREE.Vector3, hearingRadius: number) => void;

  constructor(
    camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
    audio: AudioManager,
    particles: ParticleSystem
  ) {
    this.camera = camera;
    this.scene = scene;
    this.audio = audio;
    this.particles = particles;

    this.viewmodelGroup = new THREE.Group();
    this.pistolGroup = new THREE.Group();
    this.rifleGroup = new THREE.Group();
    this.sniperGroup = new THREE.Group();
    this.knifeGroup = new THREE.Group();

    this.viewmodelGroup.add(this.pistolGroup);
    this.viewmodelGroup.add(this.rifleGroup);
    this.viewmodelGroup.add(this.sniperGroup);
    this.viewmodelGroup.add(this.knifeGroup);
    this.camera.add(this.viewmodelGroup);

    this.currentAimPos.copy(this.pistolHipPos);

    this.buildPistolModel();
    this.buildRifleModel();
    this.buildSniperModel();
    this.buildKnifeModel();

    // Muzzle flash mesh & dynamic point light
    const flashGeo = new THREE.ConeGeometry(0.1, 0.32, 6);
    flashGeo.rotateX(-Math.PI / 2);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffea77, transparent: true, opacity: 0.95 });
    this.muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlashMesh.visible = false;
    this.viewmodelGroup.add(this.muzzleFlashMesh);

    this.muzzleLight = new THREE.PointLight(0xffb533, 0, 14);
    this.viewmodelGroup.add(this.muzzleLight);

    // Grenade Pre-throw Trajectory Arc & Ground Landing Indicator Ring
    const lineGeo = new THREE.BufferGeometry();
    const lineMat = new THREE.LineBasicMaterial({ color: 0xff4422, linewidth: 3, transparent: true, opacity: 0.85 });
    this.trajectoryLine = new THREE.Line(lineGeo, lineMat);
    this.trajectoryLine.visible = false;
    this.scene.add(this.trajectoryLine);

    // Glowing ground blast indicator circle
    const ringGeo = new THREE.RingGeometry(0.2, 7.5, 36);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff2200,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending
    });
    this.blastIndicatorRing = new THREE.Mesh(ringGeo, ringMat);
    this.blastIndicatorRing.rotation.x = -Math.PI / 2;
    this.blastIndicatorRing.visible = false;
    this.scene.add(this.blastIndicatorRing);

    this.setWeapon(1);
  }

  // --- Current Weapon Properties ---
  public get currentAmmo(): number {
    if (this.activeWeaponIndex === 1) return this.pistolCurrentAmmo;
    if (this.activeWeaponIndex === 2) return this.rifleCurrentAmmo;
    return this.sniperCurrentAmmo;
  }
  public set currentAmmo(val: number) {
    if (this.activeWeaponIndex === 1) this.pistolCurrentAmmo = val;
    else if (this.activeWeaponIndex === 2) this.rifleCurrentAmmo = val;
    else this.sniperCurrentAmmo = val;
  }

  public get reserveAmmo(): number {
    if (this.activeWeaponIndex === 1) return this.pistolReserveAmmo;
    if (this.activeWeaponIndex === 2) return this.rifleReserveAmmo;
    return this.sniperReserveAmmo;
  }
  public set reserveAmmo(val: number) {
    if (this.activeWeaponIndex === 1) this.pistolReserveAmmo = val;
    else if (this.activeWeaponIndex === 2) this.rifleReserveAmmo = val;
    else this.sniperReserveAmmo = val;
  }

  public get maxMagazine(): number {
    if (this.activeWeaponIndex === 1) return this.pistolMaxMag;
    if (this.activeWeaponIndex === 2) return this.rifleMaxMag;
    return this.sniperMaxMag;
  }

  public get reloadTime(): number {
    if (this.activeWeaponIndex === 1) return this.pistolReloadTime;
    if (this.activeWeaponIndex === 2) return this.rifleReloadTime;
    return this.sniperReloadTime;
  }

  public get damage(): number {
    if (this.activeWeaponIndex === 1) return this.pistolDamage;
    if (this.activeWeaponIndex === 2) return this.rifleDamage;
    return this.sniperDamage;
  }

  public get headshotMultiplier(): number {
    if (this.activeWeaponIndex === 1) return this.pistolHeadshotMultiplier;
    if (this.activeWeaponIndex === 2) return this.rifleHeadshotMultiplier;
    return this.sniperHeadshotMultiplier;
  }

  public get activeWeaponName(): string {
    if (this.activeWeaponIndex === 1) return '9MM TACTICAL PISTOL';
    if (this.activeWeaponIndex === 2) return 'M4A1 ASSAULT RIFLE';
    return 'AWM SNIPER RIFLE';
  }

  // --- 3D Viewmodels ---

  private buildPistolModel(): void {
    const gunmetalMat = new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.35, metalness: 0.85 });
    const polymerMat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.85, metalness: 0.1 });
    const sightGlowMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });

    // Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.13, 0.055), polymerMat);
    grip.position.set(0, -0.065, 0.015);
    grip.rotation.x = 0.2;
    this.pistolGroup.add(grip);

    // Trigger Guard & Trigger
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.045, 0.05), polymerMat);
    guard.position.set(0, -0.03, -0.025);
    this.pistolGroup.add(guard);

    const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.025, 0.012), gunmetalMat);
    trigger.position.set(0, -0.025, -0.022);
    this.pistolGroup.add(trigger);

    // Animated Slide
    this.slideMesh = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.048, 0.24), gunmetalMat);
    this.slideMesh.position.set(0, 0.024, -0.08);
    this.pistolGroup.add(this.slideMesh);

    // Ejection Port
    const ejectPort = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.02, 0.045), new THREE.MeshStandardMaterial({ color: 0x0f0f10, roughness: 0.9 }));
    ejectPort.position.set(0.018, 0.012, 0.015);
    this.slideMesh.add(ejectPort);

    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.06, 8), gunmetalMat);
    barrel.rotateX(Math.PI / 2);
    barrel.position.set(0, 0.025, -0.21);
    this.pistolGroup.add(barrel);

    // Tritium Sights
    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.012), gunmetalMat);
    frontSight.position.set(0, 0.052, -0.19);
    this.slideMesh.add(frontSight);

    const frontDot = new THREE.Mesh(new THREE.SphereGeometry(0.003, 6, 6), sightGlowMat);
    frontDot.position.set(0, 0.053, -0.184);
    this.slideMesh.add(frontDot);

    const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.012, 0.01), gunmetalMat);
    rearSight.position.set(0, 0.052, 0.03);
    this.slideMesh.add(rearSight);

    const rearDotL = new THREE.Mesh(new THREE.SphereGeometry(0.003, 6, 6), sightGlowMat);
    rearDotL.position.set(-0.012, 0.053, 0.026);
    this.slideMesh.add(rearDotL);

    const rearDotR = new THREE.Mesh(new THREE.SphereGeometry(0.003, 6, 6), sightGlowMat);
    rearDotR.position.set(0.012, 0.053, 0.026);
    this.slideMesh.add(rearDotR);
  }

  private buildRifleModel(): void {
    const receiverMat = new THREE.MeshStandardMaterial({ color: 0x222428, roughness: 0.4, metalness: 0.8 });
    const darkPolyMat = new THREE.MeshStandardMaterial({ color: 0x151618, roughness: 0.8, metalness: 0.1 });
    const magazineMat = new THREE.MeshStandardMaterial({ color: 0x2a2b30, roughness: 0.5, metalness: 0.7 });

    // Upper & Lower Receiver
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.075, 0.32), receiverMat);
    receiver.position.set(0, 0.03, -0.06);
    this.rifleGroup.add(receiver);

    // Handguard / Shroud
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.065, 0.34), darkPolyMat);
    handguard.position.set(0, 0.03, -0.38);
    this.rifleGroup.add(handguard);

    // Barrel & Flash Hider
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.22, 8), receiverMat);
    barrel.rotateX(Math.PI / 2);
    barrel.position.set(0, 0.03, -0.62);
    this.rifleGroup.add(barrel);

    const flashHider = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.016, 0.06, 8), receiverMat);
    flashHider.rotateX(Math.PI / 2);
    flashHider.position.set(0, 0.03, -0.74);
    this.rifleGroup.add(flashHider);

    // Curved Magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.22, 0.07), magazineMat);
    mag.position.set(0, -0.11, -0.16);
    mag.rotation.x = -0.22;
    this.rifleGroup.add(mag);

    // Pistol Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.055), darkPolyMat);
    grip.position.set(0, -0.08, 0.05);
    grip.rotation.x = 0.26;
    this.rifleGroup.add(grip);

    // Tactical Stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.11, 0.28), darkPolyMat);
    stock.position.set(0, 0.01, 0.24);
    this.rifleGroup.add(stock);

    // Top Picatinny Rail
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.015, 0.52), receiverMat);
    rail.position.set(0, 0.075, -0.2);
    this.rifleGroup.add(rail);

    // Iron Sights
    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.025, 0.012), receiverMat);
    frontSight.position.set(0, 0.08, -0.52);
    this.rifleGroup.add(frontSight);

    const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.022, 0.012), receiverMat);
    rearSight.position.set(0, 0.08, 0.08);
    this.rifleGroup.add(rearSight);

    // Bolt Carrier
    this.rifleBoltMesh = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.02, 0.06), receiverMat);
    this.rifleBoltMesh.position.set(0.026, 0.035, -0.06);
    this.rifleGroup.add(this.rifleBoltMesh);
  }

  private buildSniperModel(): void {
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0x3d433b, roughness: 0.65, metalness: 0.2 }); // Olive drab chassis
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x1f2124, roughness: 0.35, metalness: 0.9 });
    const scopeMat = new THREE.MeshStandardMaterial({ color: 0x181a1d, roughness: 0.3, metalness: 0.85 });
    const lensMat = new THREE.MeshBasicMaterial({ color: 0x0088cc });

    // Chassis & Body
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.085, 0.64), chassisMat);
    chassis.position.set(0, 0.02, -0.15);
    this.sniperGroup.add(chassis);

    // Long Heavy Fluted Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.68, 10), barrelMat);
    barrel.rotateX(Math.PI / 2);
    barrel.position.set(0, 0.03, -0.74);
    this.sniperGroup.add(barrel);

    // Massive Muzzle Brake
    const brake = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.035, 0.09), barrelMat);
    brake.position.set(0, 0.03, -1.09);
    this.sniperGroup.add(brake);

    // High-Magnification Scope Tube
    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.38, 12), scopeMat);
    scopeTube.rotateX(Math.PI / 2);
    scopeTube.position.set(0, 0.11, -0.14);
    this.sniperGroup.add(scopeTube);

    // Scope Mount Rings
    const mount1 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, 0.03), scopeMat);
    mount1.position.set(0, 0.085, -0.04);
    this.sniperGroup.add(mount1);

    const mount2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, 0.03), scopeMat);
    mount2.position.set(0, 0.085, -0.24);
    this.sniperGroup.add(mount2);

    // Scope Objective Bell & Lens
    const objBell = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.024, 0.08, 12), scopeMat);
    objBell.rotateX(Math.PI / 2);
    objBell.position.set(0, 0.11, -0.36);
    this.sniperGroup.add(objBell);

    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.028, 12), lensMat);
    lens.position.set(0, 0.11, -0.401);
    this.sniperGroup.add(lens);

    // Stock & Cheek Rest
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.12, 0.34), chassisMat);
    stock.position.set(0, 0.0, 0.28);
    this.sniperGroup.add(stock);

    // Bolt Handle
    this.sniperBoltMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 6), barrelMat);
    this.sniperBoltMesh.position.set(0.035, 0.05, 0.02);
    this.sniperBoltMesh.rotation.z = Math.PI / 3;
    this.sniperGroup.add(this.sniperBoltMesh);

    // Straight Box Magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.09), barrelMat);
    mag.position.set(0, -0.07, -0.12);
    this.sniperGroup.add(mag);
  }

  private buildKnifeModel(): void {
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xdde2e6, roughness: 0.2, metalness: 0.95 });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x1f2421, roughness: 0.85 });

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.12, 0.035), handleMat);
    handle.position.set(0, -0.06, 0);
    this.knifeGroup.add(handle);

    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.04), bladeMat);
    guard.position.set(0, 0.005, 0);
    this.knifeGroup.add(guard);

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.18, 0.045), bladeMat);
    blade.position.set(0, 0.1, 0.005);
    this.knifeGroup.add(blade);

    this.knifeGroup.position.set(0.2, -0.22, -0.38);
    this.knifeGroup.rotation.set(0.4, 0.2, -0.2);
    this.knifeGroup.visible = false;
  }

  // --- Weapon Switching ---
  public setWeapon(index: number): void {
    if (this.isReloading || this.isMeleeAttacking) return;
    if (index < 1 || index > 3) return;

    this.activeWeaponIndex = index;

    this.pistolGroup.visible = index === 1;
    this.rifleGroup.visible = index === 2;
    this.sniperGroup.visible = index === 3;
    this.knifeGroup.visible = false;

    // Reposition muzzle flash to active weapon tip
    if (index === 1) {
      this.muzzleFlashMesh.position.set(0.24, -0.17, -0.72);
      this.muzzleLight.position.set(0.24, -0.17, -0.75);
    } else if (index === 2) {
      this.muzzleFlashMesh.position.set(0.26, -0.23, -1.15);
      this.muzzleLight.position.set(0.26, -0.23, -1.2);
    } else {
      this.muzzleFlashMesh.position.set(0.28, -0.25, -1.55);
      this.muzzleLight.position.set(0.28, -0.25, -1.6);
    }

    this.audio.playWeaponSwitch();
  }

  public cycleWeapon(next: boolean): void {
    if (this.isReloading || this.isMeleeAttacking) return;
    let target = this.activeWeaponIndex + (next ? 1 : -1);
    if (target > 3) target = 1;
    if (target < 1) target = 3;
    this.setWeapon(target);
  }

  // --- Shooting Mechanics ---
  public shoot(
    shootables: THREE.Object3D[],
    enemyObjects: { mesh: THREE.Object3D; takeDamage: (dmg: number, isHead: boolean) => void }[]
  ): boolean {
    if (this.isReloading || this.isMeleeAttacking) return false;

    if (this.currentAmmo <= 0) {
      this.audio.playEmptyClick();
      if (this.reserveAmmo > 0) {
        this.reload();
      }
      return false;
    }

    if (this.fireCooldown > 0) return false;

    // Deduct ammo & set rate of fire cooldown
    this.currentAmmo--;
    this.fireCooldown = this.activeWeaponIndex === 1
      ? this.pistolFireInterval
      : this.activeWeaponIndex === 2
      ? this.rifleFireInterval
      : this.sniperFireInterval;

    // Audio by weapon type
    if (this.activeWeaponIndex === 1) {
      this.audio.playGunshot();
    } else if (this.activeWeaponIndex === 2) {
      this.audio.playRifleShot();
    } else {
      this.audio.playSniperShot();
    }

    // Alert zombies through sound propagation within 55m radius
    if (this.onGunshotFired) {
      this.onGunshotFired(this.camera.position, 55);
    }

    // Recoil Kick & Animation
    if (this.activeWeaponIndex === 1) {
      this.slideOffset = 0.04;
      this.recoilOffset.z = 0.07;
      this.recoilOffset.y = 0.02;
      this.recoilRotation.x = 0.18;
      this.recoilRotation.y = (Math.random() - 0.5) * 0.03;
    } else if (this.activeWeaponIndex === 2) {
      this.recoilOffset.z = 0.055;
      this.recoilOffset.y = (Math.random() - 0.2) * 0.025;
      this.recoilRotation.x = 0.14 + Math.random() * 0.05;
      this.recoilRotation.y = (Math.random() - 0.5) * 0.06;
    } else {
      // Sniper massive kick
      this.recoilOffset.z = 0.16;
      this.recoilOffset.y = 0.06;
      this.recoilRotation.x = 0.36;
      this.recoilRotation.y = (Math.random() - 0.5) * 0.04;
      // Schedule bolt cycle audio
      setTimeout(() => {
        this.audio.playSniperBolt();
      }, 350);
    }

    // Muzzle Flash
    this.muzzleFlashTimer = this.activeWeaponIndex === 2 ? 0.04 : 0.07;
    this.muzzleFlashMesh.visible = true;
    this.muzzleFlashMesh.rotation.z = Math.random() * Math.PI * 2;
    this.muzzleLight.intensity = this.activeWeaponIndex === 3 ? 4.5 : 2.8;

    // Shell Ejection
    this.ejectShellCasing();

    if (this.onShoot) {
      this.onShoot();
    }

    // Raycast from Camera Center (Spread is tighter when aiming, sniper is pinpoint accurate)
    const raySpread = new THREE.Vector2(0, 0);
    if (this.activeWeaponIndex === 2) {
      // Slight automatic fire dispersion
      const spreadAmount = 0.015;
      raySpread.set((Math.random() - 0.5) * spreadAmount, (Math.random() - 0.5) * spreadAmount);
    }
    this.raycaster.setFromCamera(raySpread, this.camera);

    const enemyMeshes: THREE.Object3D[] = [];
    const meshMap = new Map<THREE.Object3D, { obj: typeof enemyObjects[0]; isHead: boolean }>();

    for (const enemy of enemyObjects) {
      enemy.mesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          enemyMeshes.push(child);
          const isHead = child.name === 'Head' || child.name === 'head';
          meshMap.set(child, { obj: enemy, isHead });
        }
      });
    }

    const allTargets = [...enemyMeshes, ...shootables];
    const intersects = this.raycaster.intersectObjects(allTargets, false);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const entry = meshMap.get(hit.object);

      if (entry) {
        const isHeadshot = entry.isHead;
        const totalDmg = isHeadshot ? this.damage * this.headshotMultiplier : this.damage;
        entry.obj.takeDamage(totalDmg, isHeadshot);

        this.audio.playFleshImpact();
        this.audio.playHitmarker(isHeadshot);

        const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
        this.particles.spawnBlood(hit.point, normal, isHeadshot ? 28 : 14);

        if (this.onHitEnemy) {
          this.onHitEnemy(totalDmg, isHeadshot, hit.point);
        }
      } else {
        this.audio.playWallHit();
        const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
        this.particles.spawnSparks(hit.point, normal, 10);
      }
    }

    return true;
  }

  private ejectShellCasing(): void {
    const scale = this.activeWeaponIndex === 3 ? 1.6 : this.activeWeaponIndex === 2 ? 1.2 : 1.0;
    const shellGeo = new THREE.CylinderGeometry(0.005 * scale, 0.005 * scale, 0.02 * scale, 6);
    const shellMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 });
    const shell = new THREE.Mesh(shellGeo, shellMat);

    const spawnPos = new THREE.Vector3(0.05, -0.02, -0.2);
    spawnPos.applyMatrix4(this.camera.matrixWorld);
    shell.position.copy(spawnPos);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0);

    const vel = right.multiplyScalar(2.4 + Math.random() * 0.6)
      .add(up.multiplyScalar(1.6 + Math.random() * 0.4))
      .add(forward.multiplyScalar(-0.4));

    this.scene.add(shell);

    this.activeShells.push({
      mesh: shell,
      velocity: vel,
      rotVelocity: new THREE.Vector3(Math.random() * 15, Math.random() * 15, Math.random() * 15),
      life: 0
    });

    this.audio.playShellCasing();
  }

  // --- Melee (V) ---
  public performMelee(enemyObjects: { mesh: THREE.Object3D; takeDamage: (dmg: number, isHead: boolean) => void }[]): boolean {
    if (this.isMeleeAttacking || this.meleeCooldown > 0) return false;

    this.isMeleeAttacking = true;
    this.meleeTimer = 0.35;
    this.meleeCooldown = 0.65;

    this.audio.playMeleeSwing();

    const playerPos = this.camera.position;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);

    for (const enemy of enemyObjects) {
      const toEnemy = enemy.mesh.position.clone().sub(playerPos);
      const dist = toEnemy.length();
      if (dist < 2.3) {
        const dot = forward.dot(toEnemy.normalize());
        if (dot > 0.4) {
          enemy.takeDamage(45, false);
          this.audio.playMeleeImpact();
          this.particles.spawnBlood(enemy.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)), forward.negate(), 15);
          if (this.onHitEnemy) {
            this.onHitEnemy(45, false, enemy.mesh.position);
          }
          break;
        }
      }
    }

    return true;
  }

  // --- Grenade Trajectory Pre-Throw Arc & Blast Ring Indicator ---
  public updateGrenadeTrajectory(isHolding: boolean, environment: VillageEnvironment): void {
    this.isHoldingGrenade = isHolding && this.grenades > 0;

    if (!this.isHoldingGrenade) {
      this.trajectoryLine.visible = false;
      this.blastIndicatorRing.visible = false;
      return;
    }

    const points: THREE.Vector3[] = [];
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0);

    let simPos = this.camera.position.clone().add(forward.clone().multiplyScalar(0.4)).add(new THREE.Vector3(0, -0.1, 0));
    let simVel = forward.clone().multiplyScalar(17.0).add(up.clone().multiplyScalar(4.8));

    points.push(simPos.clone());

    const dt = 0.045;
    let hitGroundPos: THREE.Vector3 | null = null;

    for (let step = 0; step < 28; step++) {
      simVel.y -= 16.0 * dt;
      simPos.addScaledVector(simVel, dt);
      points.push(simPos.clone());

      const groundY = environment.getGroundHeightAt(simPos.x, simPos.z, simPos.y);
      if (simPos.y <= groundY + 0.1) {
        hitGroundPos = new THREE.Vector3(simPos.x, groundY + 0.05, simPos.z);
        break;
      }
    }

    this.trajectoryLine.geometry.setFromPoints(points);
    this.trajectoryLine.visible = true;

    if (hitGroundPos) {
      this.blastIndicatorRing.position.copy(hitGroundPos);
      this.blastIndicatorRing.visible = true;
      // Pulse animation
      const pulse = Math.sin(performance.now() * 0.008) * 0.15 + 0.45;
      (this.blastIndicatorRing.material as THREE.MeshBasicMaterial).opacity = pulse;
    } else {
      this.blastIndicatorRing.visible = false;
    }
  }

  // --- Throw Grenade (G) ---
  public throwGrenade(): boolean {
    if (this.grenades <= 0 || this.isReloading) return false;

    this.grenades--;
    this.audio.playInteract();

    this.trajectoryLine.visible = false;
    this.blastIndicatorRing.visible = false;

    const grenadeGeo = new THREE.SphereGeometry(0.12, 10, 10);
    const grenadeMat = new THREE.MeshStandardMaterial({ color: 0x364828, roughness: 0.6, metalness: 0.5 });
    const grenade = new THREE.Mesh(grenadeGeo, grenadeMat);

    const spawnPos = this.camera.position.clone().add(
      new THREE.Vector3(0, -0.1, -0.4).applyQuaternion(this.camera.quaternion)
    );
    grenade.position.copy(spawnPos);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0);
    const vel = forward.multiplyScalar(17.0).add(up.multiplyScalar(4.8));

    this.scene.add(grenade);

    this.activeGrenades.push({
      mesh: grenade,
      velocity: vel,
      life: 0,
      maxLife: 2.2,
      exploded: false
    });

    return true;
  }

  // --- Reloading ---
  public reload(): boolean {
    if (this.isReloading) return false;
    if (this.currentAmmo === this.maxMagazine || this.reserveAmmo <= 0) return false;

    this.isReloading = true;
    this.reloadTimer = 0;
    this.audio.playReload();

    if (this.onReloadStart) {
      this.onReloadStart();
    }
    return true;
  }

  // --- Resupply All Weapons & Grenades ---
  public resupplyAll(): { pistol: number; rifle: number; sniper: number; grenades: number } {
    this.pistolCurrentAmmo = this.pistolMaxMag;
    this.pistolReserveAmmo = this.pistolMaxReserve;

    this.rifleCurrentAmmo = this.rifleMaxMag;
    this.rifleReserveAmmo = this.rifleMaxReserve;

    this.sniperCurrentAmmo = this.sniperMaxMag;
    this.sniperReserveAmmo = this.sniperMaxReserve;

    this.grenades = this.maxGrenades;

    return {
      pistol: this.pistolReserveAmmo,
      rifle: this.rifleReserveAmmo,
      sniper: this.sniperReserveAmmo,
      grenades: this.grenades
    };
  }

  public addAmmo(amount: number): void {
    if (this.activeWeaponIndex === 1) {
      this.pistolReserveAmmo = Math.min(this.pistolMaxReserve, this.pistolReserveAmmo + amount);
    } else if (this.activeWeaponIndex === 2) {
      this.rifleReserveAmmo = Math.min(this.rifleMaxReserve, this.rifleReserveAmmo + amount * 2);
    } else {
      this.sniperReserveAmmo = Math.min(this.sniperMaxReserve, this.sniperReserveAmmo + Math.round(amount * 0.4));
    }
  }

  public addGrenades(amount: number): void {
    this.grenades = Math.min(this.maxGrenades, this.grenades + amount);
  }

  public reset(): void {
    this.pistolCurrentAmmo = 12;
    this.pistolReserveAmmo = 48;
    this.rifleCurrentAmmo = 30;
    this.rifleReserveAmmo = 120;
    this.sniperCurrentAmmo = 5;
    this.sniperReserveAmmo = 20;
    this.grenades = 3;

    this.isReloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0;
    this.muzzleFlashTimer = 0;
    this.muzzleFlashMesh.visible = false;
    this.muzzleLight.intensity = 0;
    this.setWeapon(1);
  }

  public getState(isAiming: boolean): WeaponState {
    const isSniperAiming = isAiming && this.activeWeaponIndex === 3 && !this.isReloading;
    return {
      currentAmmo: this.currentAmmo,
      reserveAmmo: this.reserveAmmo,
      maxMagazine: this.maxMagazine,
      isReloading: this.isReloading,
      reloadProgress: this.isReloading ? this.reloadTimer / this.reloadTime : 0,
      isAiming,
      activeWeaponIndex: this.activeWeaponIndex,
      activeWeaponName: this.activeWeaponName,
      grenades: this.grenades,
      isSniperAiming
    };
  }

  // --- Main Update Loop ---
  public update(
    delta: number,
    isAiming: boolean,
    mouseDeltaX: number,
    mouseDeltaY: number,
    enemies: { mesh: THREE.Object3D; takeDamage: (dmg: number, isHead: boolean) => void }[],
    shootables: THREE.Object3D[],
    isShootingHeld: boolean = false
  ): void {
    // Cooldown updates
    if (this.fireCooldown > 0) this.fireCooldown -= delta;
    if (this.meleeCooldown > 0) this.meleeCooldown -= delta;

    // Weapon 2: Continuous Automatic Fire Loop (AR)
    if (this.activeWeaponIndex === 2 && isShootingHeld && this.fireCooldown <= 0 && !this.isReloading) {
      this.shoot(shootables, enemies);
    }

    // Melee attack animation
    if (this.isMeleeAttacking) {
      this.meleeTimer -= delta;
      this.knifeGroup.visible = true;
      this.pistolGroup.visible = false;
      this.rifleGroup.visible = false;
      this.sniperGroup.visible = false;

      const progress = 1 - this.meleeTimer / 0.35;
      const swing = Math.sin(progress * Math.PI);
      this.knifeGroup.position.set(0.1 - swing * 0.25, -0.2 + swing * 0.1, -0.4 - swing * 0.15);
      this.knifeGroup.rotation.set(0.4 + swing * 1.2, 0.2 - swing * 0.8, -0.2);

      if (this.meleeTimer <= 0) {
        this.isMeleeAttacking = false;
        this.knifeGroup.visible = false;
        this.setWeapon(this.activeWeaponIndex);
      }
    }

    // Slide Blowback spring recovery
    if (this.slideOffset > 0) {
      this.slideOffset = Math.max(0, this.slideOffset - delta * 0.3);
      this.slideMesh.position.z = -0.08 + this.slideOffset;
    }

    // Muzzle Flash Timer
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= delta;
      if (this.muzzleFlashTimer <= 0) {
        this.muzzleFlashMesh.visible = false;
        this.muzzleLight.intensity = 0;
      }
    }

    // Reload animation
    if (this.isReloading) {
      this.reloadTimer += delta;
      const progress = this.reloadTimer / this.reloadTime;
      this.recoilOffset.y = -Math.sin(progress * Math.PI) * 0.18;
      this.recoilRotation.z = Math.sin(progress * Math.PI) * 0.22;

      if (this.reloadTimer >= this.reloadTime) {
        const needed = this.maxMagazine - this.currentAmmo;
        const available = Math.min(needed, this.reserveAmmo);
        this.currentAmmo += available;
        this.reserveAmmo -= available;
        this.isReloading = false;
        this.reloadTimer = 0;
        if (this.onReloadFinish) this.onReloadFinish();
      }
    }

    // ADS target position lerp
    let targetHip = this.pistolHipPos;
    let targetAds = this.pistolAdsPos;
    let activeGroup = this.pistolGroup;

    if (this.activeWeaponIndex === 2) {
      targetHip = this.rifleHipPos;
      targetAds = this.rifleAdsPos;
      activeGroup = this.rifleGroup;
    } else if (this.activeWeaponIndex === 3) {
      targetHip = this.sniperHipPos;
      targetAds = this.sniperAdsPos;
      activeGroup = this.sniperGroup;
    }

    const targetPos = isAiming && !this.isReloading ? targetAds : targetHip;
    this.currentAimPos.lerp(targetPos, 14 * delta);

    // Mouse Sway
    this.swayOffset.x = THREE.MathUtils.lerp(this.swayOffset.x, -mouseDeltaX * 0.008, 10 * delta);
    this.swayOffset.y = THREE.MathUtils.lerp(this.swayOffset.y, -mouseDeltaY * 0.008, 10 * delta);

    // Spring recovery for recoil
    this.recoilOffset.lerp(new THREE.Vector3(0, 0, 0), 12 * delta);
    this.recoilRotation.x = THREE.MathUtils.lerp(this.recoilRotation.x, 0, 14 * delta);
    this.recoilRotation.y = THREE.MathUtils.lerp(this.recoilRotation.y, 0, 14 * delta);

    // When scoping with sniper, fade/hide the viewmodel so scope overlay is clear
    if (this.activeWeaponIndex === 3 && isAiming && !this.isReloading) {
      this.sniperGroup.visible = false;
    } else {
      this.sniperGroup.visible = this.activeWeaponIndex === 3;
    }

    activeGroup.position.set(
      this.currentAimPos.x + this.swayOffset.x + this.recoilOffset.x,
      this.currentAimPos.y + this.swayOffset.y + this.recoilOffset.y,
      this.currentAimPos.z + this.recoilOffset.z
    );
    activeGroup.rotation.set(
      this.recoilRotation.x,
      this.recoilRotation.y + this.swayOffset.x * 0.8,
      this.recoilRotation.z
    );

    // Update Physics Shells
    for (let i = this.activeShells.length - 1; i >= 0; i--) {
      const s = this.activeShells[i];
      s.life += delta;
      s.velocity.y -= 14.0 * delta;
      s.mesh.position.addScaledVector(s.velocity, delta);
      s.mesh.rotation.x += s.rotVelocity.x * delta;
      s.mesh.rotation.y += s.rotVelocity.y * delta;

      if (s.mesh.position.y < 0.02) {
        s.mesh.position.y = 0.02;
        s.velocity.set(0, 0, 0);
      }
      if (s.life > 3.0) {
        this.scene.remove(s.mesh);
        this.activeShells.splice(i, 1);
      }
    }

    // Update Grenades
    for (let i = this.activeGrenades.length - 1; i >= 0; i--) {
      const g = this.activeGrenades[i];
      g.life += delta;
      g.velocity.y -= 16.0 * delta;
      g.mesh.position.addScaledVector(g.velocity, delta);

      if (g.mesh.position.y < 0.1) {
        g.mesh.position.y = 0.1;
        g.velocity.y *= -0.4;
        g.velocity.x *= 0.6;
        g.velocity.z *= 0.6;
      }

      if (g.life >= g.maxLife && !g.exploded) {
        g.exploded = true;
        this.triggerGrenadeExplosion(g.mesh.position, enemies);
        this.scene.remove(g.mesh);
        this.activeGrenades.splice(i, 1);
      }
    }

    // Update Expanding Fireballs
    for (let i = this.activeFireballs.length - 1; i >= 0; i--) {
      const fb = this.activeFireballs[i];
      fb.life += delta;
      const progress = fb.life / fb.maxLife;
      const sc = THREE.MathUtils.lerp(fb.startScale, fb.targetScale, Math.sqrt(progress));
      fb.mesh.scale.set(sc, sc, sc);
      (fb.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - progress));

      if (progress >= 1.0) {
        this.scene.remove(fb.mesh);
        this.activeFireballs.splice(i, 1);
      }
    }
  }

  private triggerGrenadeExplosion(
    pos: THREE.Vector3,
    enemies: { mesh: THREE.Object3D; takeDamage: (dmg: number, isHead: boolean) => void }[]
  ): void {
    this.audio.playGrenadeExplosion();

    // 1. Spawning Expanding Fireball Sphere Mesh
    const fireballGeo = new THREE.SphereGeometry(1, 16, 16);
    const fireballMat = new THREE.MeshBasicMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    const fireball = new THREE.Mesh(fireballGeo, fireballMat);
    fireball.position.copy(pos).add(new THREE.Vector3(0, 1.2, 0));
    this.scene.add(fireball);

    this.activeFireballs.push({
      mesh: fireball,
      life: 0,
      maxLife: 0.38,
      startScale: 0.8,
      targetScale: 5.6
    });

    // 2. High-Density Shockwave & Spark Particles
    this.particles.spawnSparks(pos, new THREE.Vector3(0, 1, 0), 45);
    this.particles.spawnBlood(pos, new THREE.Vector3(0, 1, 0), 20);

    // 3. Radial Blast AoE Damage (160 damage within 7.5m)
    for (const e of enemies) {
      const dist = e.mesh.position.distanceTo(pos);
      if (dist < 7.5) {
        const falloff = 1 - dist / 7.5;
        const dmg = Math.round(160 * falloff);
        e.takeDamage(dmg, false);
      }
    }

    // 4. Alert all zombies within 55m hearing radius to RUN!
    if (this.onGunshotFired) {
      this.onGunshotFired(pos, 55);
    }

    if (this.onGrenadeExplode) {
      this.onGrenadeExplode(pos, 7.5, 160);
    }
  }
}
