import * as THREE from 'three';
import { EnemyType } from '../core/Types';
import { AudioManager } from '../core/AudioManager';
import { VillageEnvironment } from '../world/VillageEnvironment';
import { AssetManager, ZombieInstance } from '../core/AssetManager';

export enum ZombieAIState {
  IDLE_WANDER = 'IDLE_WANDER',
  ALERTED_WALK = 'ALERTED_WALK',
  ENRAGED_RUN = 'ENRAGED_RUN'
}

export class Enemy {
  public type: EnemyType;
  public group: THREE.Group;
  public audio: AudioManager;
  public environment: VillageEnvironment;

  // AI Perception & Stealth State
  public aiState: ZombieAIState = ZombieAIState.IDLE_WANDER;
  private wanderTimer: number = 0;
  private wanderDir: THREE.Vector3 = new THREE.Vector3(1, 0, 0);
  private enrageTimer: number = 0;

  // Movie Zombie Individual Personalities & Varied Shambling
  public personalityType: number = Math.floor(Math.random() * 5); // 0 to 4
  public speedVariance: number = 0.82 + Math.random() * 0.38;     // Distinct movement speed per zombie
  public flankAngleOffset: number = (Math.random() - 0.5) * 0.95; // Flanking angle to prevent line marching
  private swayFreq: number = 1.4 + Math.random() * 1.5;
  private swayAmp: number = 0.22 + Math.random() * 0.22;
  private swayPhase: number = Math.random() * Math.PI * 2;

  // Stats
  public health: number = 100;
  public maxHealth: number = 100;
  public speed: number = 2.4;
  public damage: number = 10;
  public attackRange: number = 1.8;
  public attackCooldown: number = 1.2;
  public readonly radius: number = 0.55;

  // State
  public isDead: boolean = false;
  private attackTimer: number = 0;
  private walkCycleTimer: number = 0;
  private hurtTimer: number = 0;
  private headshotFlinchTimer: number = 0;
  private deathTimer: number = 0;
  private deathBaseY: number = 0;
  public shouldRemove: boolean = false;

  // 3D Model & AnimationMixer
  public isGlbModel: boolean = false;
  private mixer?: THREE.AnimationMixer;
  private actions: Map<string, THREE.AnimationAction> = new Map();
  private currentActionName: string = '';

  // Visual meshes for realistic character animation
  public headMesh!: THREE.Mesh;
  private torsoMesh!: THREE.Mesh;
  private leftArmGroup!: THREE.Group;
  private rightArmGroup!: THREE.Group;
  private leftLegGroup!: THREE.Group;
  private rightLegGroup!: THREE.Group;
  private materials: THREE.MeshStandardMaterial[] = [];
  private originalColors: number[] = [];

  // Growl timer
  private growlTimer: number = 0;
  private knockback = new THREE.Vector3();

  // Callbacks
  public onAttackPlayer?: (damage: number, attackerPos: THREE.Vector3) => void;
  public onDeath?: (enemy: Enemy) => void;

  constructor(
    type: EnemyType,
    spawnPos: THREE.Vector3,
    audio: AudioManager,
    environment: VillageEnvironment
  ) {
    this.type = type;
    this.audio = audio;
    this.environment = environment;
    this.group = new THREE.Group();
    this.group.position.copy(spawnPos);

    // Desynchronize stride phase so zombies never walk in unison
    this.walkCycleTimer = Math.random() * Math.PI * 2;

    // Slight physical size variation
    const sizeVariation = this.type === EnemyType.BOSS ? 1.0 : (0.93 + Math.random() * 0.14);
    this.group.scale.set(sizeVariation, sizeVariation, sizeVariation);

    this.configureStats();
    this.buildRealisticCharacter();

    this.growlTimer = 2.0 + Math.random() * 5.0;
  }

  private configureStats(): void {
    if (this.type === EnemyType.NORMAL) {
      this.health = 100;
      this.maxHealth = 100;
      this.speed = 2.4;
      this.damage = 10;
      this.attackRange = 1.8;
      this.attackCooldown = 1.2;
    } else if (this.type === EnemyType.FAST) {
      this.health = 60;
      this.maxHealth = 60;
      this.speed = 4.9;
      this.damage = 15;
      this.attackRange = 1.6;
      this.attackCooldown = 0.85;
    } else { // BOSS
      this.health = 400;
      this.maxHealth = 400;
      this.speed = 3.0;
      this.damage = 25;
      this.attackRange = 2.5;
      this.attackCooldown = 1.6;
    }
  }

  private buildRealisticCharacter(): void {
    const scale = this.type === EnemyType.BOSS ? 1.75 : this.type === EnemyType.FAST ? 0.95 : 1.0;

    // Check if 3D Zombie Walker asset is available
    const assets = AssetManager.getInstance();
    const zombieInst = assets.createZombieInstance();

    if (zombieInst) {
      this.attachGlbCharacter(zombieInst, scale);
      return;
    }

    // High-fidelity procedural organic mutant geometry (NEVER blocky poly boxes)
    const clothPalettes = [
      { shirt: 0x4a2e2b, pants: 0x22262b }, // bloody plaid & dark jeans
      { shirt: 0x3d4336, pants: 0x1f1f20 }, // decayed worker jacket
      { shirt: 0x2e3b44, pants: 0x28231e }, // ragged flannel & khaki
      { shirt: 0x473335, pants: 0x17181c }  // stained tee & torn black
    ];
    const chosenPalette = clothPalettes[Math.floor(Math.random() * clothPalettes.length)];

    let skinColor = 0x546650;
    let shirtColor = chosenPalette.shirt;
    let pantsColor = chosenPalette.pants;
    let eyeColor = 0xffeb3b;

    if (this.type === EnemyType.FAST) {
      skinColor = 0x8a322c; // Mutated bloody red flesh
      shirtColor = 0x241818;
      pantsColor = 0x151212;
      eyeColor = 0xff1744; // Crimson glowing
    } else if (this.type === EnemyType.BOSS) {
      skinColor = 0x37423b; // Thick armored mutant hide
      shirtColor = 0x1b1c1e;
      pantsColor = 0x111214;
      eyeColor = 0xff0055;
    }

    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.78, metalness: 0.1 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.88 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.92 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor });

    this.materials.push(skinMat, shirtMat, pantsMat, bootMat);
    this.originalColors.push(skinColor, shirtColor, pantsColor, 0x1a1a1a);

    // 1. Organic contoured torso (Smooth CapsuleGeometry)
    const torsoGeo = new THREE.CapsuleGeometry(0.24 * scale, 0.52 * scale, 8, 16);
    this.torsoMesh = new THREE.Mesh(torsoGeo, shirtMat);
    this.torsoMesh.position.y = 1.15 * scale;
    this.torsoMesh.castShadow = true;
    this.group.add(this.torsoMesh);

    // 2. Sculpted organic Head (SphereGeometry with Head hit detection)
    const headGeo = new THREE.SphereGeometry(0.22 * scale, 16, 16);
    this.headMesh = new THREE.Mesh(headGeo, skinMat);
    this.headMesh.name = 'Head';
    this.headMesh.position.set(0, 1.72 * scale, 0);
    this.headMesh.castShadow = true;
    this.group.add(this.headMesh);

    // Sunken Glowing Diseased Eyes (Spheres)
    const eyeGeo = new THREE.SphereGeometry(0.042 * scale, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.08 * scale, 1.75 * scale, 0.18 * scale);
    this.group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.08 * scale, 1.75 * scale, 0.18 * scale);
    this.group.add(rightEye);

    // Decomposed Open Jaw (Organic contoured cylinder)
    const jawGeo = new THREE.CylinderGeometry(0.12 * scale, 0.08 * scale, 0.14 * scale, 12);
    const jaw = new THREE.Mesh(jawGeo, skinMat);
    jaw.position.set(0, 1.58 * scale, 0.1 * scale);
    jaw.rotation.x = 0.25;
    this.group.add(jaw);

    // 3. Left Arm with Organic Capsule Limbs
    this.leftArmGroup = new THREE.Group();
    this.leftArmGroup.position.set(-0.35 * scale, 1.45 * scale, 0);

    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08 * scale, 0.28 * scale, 6, 10), shirtMat);
    upperArm.position.y = -0.18 * scale;
    upperArm.castShadow = true;
    this.leftArmGroup.add(upperArm);

    const lowerArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07 * scale, 0.3 * scale, 6, 10), skinMat);
    lowerArm.position.y = -0.52 * scale;
    lowerArm.position.z = 0.08 * scale;
    lowerArm.rotation.x = -0.3;
    lowerArm.castShadow = true;
    this.leftArmGroup.add(lowerArm);
    this.group.add(this.leftArmGroup);

    // 4. Right Arm with Organic Capsule Limbs
    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.position.set(0.35 * scale, 1.45 * scale, 0);

    const rightUpper = new THREE.Mesh(new THREE.CapsuleGeometry(0.08 * scale, 0.28 * scale, 6, 10), shirtMat);
    rightUpper.position.y = -0.18 * scale;
    rightUpper.castShadow = true;
    this.rightArmGroup.add(rightUpper);

    const rightLower = new THREE.Mesh(new THREE.CapsuleGeometry(0.07 * scale, 0.3 * scale, 6, 10), skinMat);
    rightLower.position.y = -0.52 * scale;
    rightLower.position.z = 0.08 * scale;
    rightLower.rotation.x = -0.3;
    rightLower.castShadow = true;
    this.rightArmGroup.add(rightLower);
    this.group.add(this.rightArmGroup);

    // 5. Left Leg (Capsule and rounded boot)
    this.leftLegGroup = new THREE.Group();
    this.leftLegGroup.position.set(-0.15 * scale, 0.76 * scale, 0);

    const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09 * scale, 0.5 * scale, 6, 10), pantsMat);
    leftLeg.position.y = -0.35 * scale;
    leftLeg.castShadow = true;
    this.leftLegGroup.add(leftLeg);

    const leftBoot = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * scale, 0.11 * scale, 0.2 * scale, 10), bootMat);
    leftBoot.position.set(0, -0.68 * scale, 0.04 * scale);
    leftBoot.rotation.x = 0.15;
    this.leftLegGroup.add(leftBoot);
    this.group.add(this.leftLegGroup);

    // 6. Right Leg (Capsule and rounded boot)
    this.rightLegGroup = new THREE.Group();
    this.rightLegGroup.position.set(0.15 * scale, 0.76 * scale, 0);

    const rightLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09 * scale, 0.5 * scale, 6, 10), pantsMat);
    rightLeg.position.y = -0.35 * scale;
    rightLeg.castShadow = true;
    this.rightLegGroup.add(rightLeg);

    const rightBoot = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * scale, 0.11 * scale, 0.2 * scale, 10), bootMat);
    rightBoot.position.set(0, -0.68 * scale, 0.04 * scale);
    rightBoot.rotation.x = 0.15;
    this.rightLegGroup.add(rightBoot);
    this.group.add(this.rightLegGroup);
  }

  public attachGlbCharacter(zombieInst: ZombieInstance, scale: number): void {
    this.isGlbModel = true;
    this.mixer = zombieInst.mixer;
    this.actions = zombieInst.actions;
    this.headMesh = zombieInst.headMesh as THREE.Mesh;

    zombieInst.root.scale.setScalar(scale);
    this.group.add(zombieInst.root);

    // Clone materials for individual damage flash and mutant tinting
    zombieInst.skinnedMeshes.forEach(sm => {
      if (sm.material) {
        const mat = (sm.material as THREE.MeshStandardMaterial).clone();
        if (this.type === EnemyType.FAST) {
          mat.color.setHex(0xb54035); // Crimson mutated flesh
        } else if (this.type === EnemyType.BOSS) {
          mat.color.setHex(0x3a483e); // Calcified armored hide
        }
        sm.material = mat;
        this.materials.push(mat);
        this.originalColors.push(mat.color.getHex());
      }
    });

    // Body raycast collider box
    const torsoBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.65 * scale, 0.95 * scale, 0.45 * scale),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    torsoBox.name = 'Torso';
    torsoBox.position.set(0, 1.15 * scale, 0);
    this.group.add(torsoBox);

    // Configure animation speeds & desynchronize start times
    const walkAction = this.actions.get('Walk');
    if (walkAction) {
      walkAction.timeScale = (this.type === EnemyType.FAST ? 1.4 : this.type === EnemyType.BOSS ? 0.85 : 1.0) * this.speedVariance;
      walkAction.time = Math.random() * 2.0;
    }

    const runAction = this.actions.get('Run');
    if (runAction) {
      runAction.timeScale = (this.type === EnemyType.FAST ? 1.35 : 1.0) * this.speedVariance;
      runAction.time = Math.random() * 2.0;
    }

    const deathAction = this.actions.get('Death');
    if (deathAction) {
      deathAction.setLoop(THREE.LoopOnce, 1);
      deathAction.clampWhenFinished = true;
    }

    const hitAction = this.actions.get('Hit');
    if (hitAction) {
      hitAction.setLoop(THREE.LoopOnce, 1);
    }

    const attackAction = this.actions.get('Attack');
    if (attackAction) {
      attackAction.setLoop(THREE.LoopOnce, 1);
      attackAction.timeScale = this.type === EnemyType.FAST ? 1.4 : 1.0;
    }

    const biteAction = this.actions.get('Bite');
    if (biteAction) {
      biteAction.setLoop(THREE.LoopOnce, 1);
    }

    // Initial movement animation
    this.playAnimation(this.type === EnemyType.FAST ? 'Run' : 'Walk');
  }

  public upgradeToGlbModelIfReady(): boolean {
    if (this.isGlbModel || this.isDead) return false;
    const assets = AssetManager.getInstance();
    const zombieInst = assets.createZombieInstance();
    if (!zombieInst) return false;

    // Remove fallback procedural meshes
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
    this.materials = [];
    this.originalColors = [];

    const scale = this.type === EnemyType.BOSS ? 1.75 : this.type === EnemyType.FAST ? 0.95 : 1.0;
    this.attachGlbCharacter(zombieInst, scale);
    return true;
  }

  public playAnimation(name: string, duration: number = 0.25): void {
    if (!this.mixer || this.currentActionName === name) return;

    const nextAction = this.actions.get(name);
    if (!nextAction) return;

    const prevAction = this.actions.get(this.currentActionName);

    nextAction.reset();
    nextAction.fadeIn(duration).play();

    if (prevAction && prevAction !== nextAction) {
      prevAction.fadeOut(duration);
    }

    this.currentActionName = name;
  }

  public alertToSound(soundPos: THREE.Vector3): void {
    if (this.isDead) return;
    this.aiState = ZombieAIState.ENRAGED_RUN;
    this.enrageTimer = 14.0;
    if (Math.random() < 0.45) {
      const pitch = this.type === EnemyType.FAST ? 1.4 : this.type === EnemyType.BOSS ? 0.65 : 1.1;
      this.audio.playZombieGrowl(pitch, 10);
    }
  }

  public takeDamage(amount: number, isHeadshot: boolean = false): void {
    if (this.isDead) return;

    this.alertToSound(this.group.position);
    this.health -= amount;
    this.hurtTimer = 0.14;

    for (const mat of this.materials) {
      mat.color.setHex(0xff1111);
    }

    if (isHeadshot) {
      this.headshotFlinchTimer = 0.22;
      if (this.headMesh && !this.isGlbModel) {
        this.headMesh.rotation.x = -0.45; // Head snaps back
      }
    }

    if (this.health <= 0) {
      this.health = 0;
      this.isDead = true;
      this.deathBaseY = this.group.position.y;
      if (this.isGlbModel) {
        this.playAnimation('Death', 0.18);
      }
      this.audio.playZombieDeath();
      if (this.onDeath) {
        this.onDeath(this);
      }
    } else {
      if (this.isGlbModel && Math.random() < 0.35 && !this.actions.get('Attack')?.isRunning()) {
        const hitAction = this.actions.get('Hit');
        if (hitAction) hitAction.reset().fadeIn(0.08).play();
      }
      if (Math.random() > 0.35) {
        const pitch = this.type === EnemyType.FAST ? 1.4 : this.type === EnemyType.BOSS ? 0.6 : 1.0;
        this.audio.playZombieGrowl(pitch, 5);
      }
    }
  }

  public applyKnockback(dir: THREE.Vector3, force: number = 3.5): void {
    if (this.type === EnemyType.BOSS) force *= 0.3;
    this.knockback.copy(dir.normalize()).multiplyScalar(force);
  }

  public update(delta: number, playerPos: THREE.Vector3, otherEnemies: Enemy[], isPlayerCrouched: boolean = false): void {
    // Dynamically upgrade to 3D animated GLB model as soon as asset preload completes
    if (!this.isGlbModel && !this.isDead) {
      this.upgradeToGlbModelIfReady();
    }

    if (this.mixer) {
      this.mixer.update(delta);
    }

    // 1. Death Animation & Sink
    if (this.isDead) {
      this.deathTimer += delta;
      if (this.isGlbModel) {
        if (this.deathTimer > 3.0) {
          this.group.position.y -= delta * 0.45;
          if (this.deathTimer > 5.5) {
            this.shouldRemove = true;
          }
        }
      } else {
        if (this.deathTimer < 0.65) {
          this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, -Math.PI / 2, 8 * delta);
          this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, this.deathBaseY + 0.2, 8 * delta);
        } else if (this.deathTimer > 2.5) {
          this.group.position.y -= delta * 0.45;
          if (this.deathTimer > 4.5) {
            this.shouldRemove = true;
          }
        }
      }
      return;
    }

    // 2. Hurt Color & Flinch Recovery
    if (this.hurtTimer > 0) {
      this.hurtTimer -= delta;
      if (this.hurtTimer <= 0) {
        this.materials.forEach((mat, i) => {
          mat.color.setHex(this.originalColors[i]);
        });
      }
    }

    if (this.headshotFlinchTimer > 0 && !this.isGlbModel) {
      this.headshotFlinchTimer -= delta;
      this.headMesh.rotation.x = THREE.MathUtils.lerp(this.headMesh.rotation.x, 0, 10 * delta);
    }

    // 3. Perception & Stealth Vision Cone / Sound Alert Logic
    this.growlTimer -= delta;
    const toPlayer = new THREE.Vector3().subVectors(playerPos, this.group.position);
    toPlayer.y = 0;
    const distanceToPlayer = toPlayer.length();

    // Determine AI State (Stealth line of sight vs Enraged running)
    if (this.enrageTimer > 0) {
      this.enrageTimer -= delta;
      this.aiState = ZombieAIState.ENRAGED_RUN;
    } else if (this.type === EnemyType.FAST) {
      this.aiState = ZombieAIState.ENRAGED_RUN; // Fast mutants are always hyper-aggressive runners
    } else {
      // Facing vector of zombie
      const facing = new THREE.Vector3(Math.sin(this.group.rotation.y), 0, Math.cos(this.group.rotation.y));
      const toPlayerNorm = toPlayer.clone().normalize();
      const dot = facing.dot(toPlayerNorm); // cos(angle)

      const maxVisionDist = isPlayerCrouched ? 16 : 28;
      const proximityDist = isPlayerCrouched ? 4.5 : 7.0;

      const inVisionCone = distanceToPlayer < maxVisionDist && dot > 0.35; // ±68° field of view
      const inProximity = distanceToPlayer < proximityDist;

      if (inVisionCone || inProximity) {
        if (distanceToPlayer < 9) {
          this.aiState = ZombieAIState.ENRAGED_RUN; // Close range charge
        } else {
          this.aiState = ZombieAIState.ALERTED_WALK; // Approaching player
        }
      } else {
        this.aiState = ZombieAIState.IDLE_WANDER;
      }
    }

    if (this.growlTimer <= 0) {
      if (distanceToPlayer < 35 && this.aiState !== ZombieAIState.IDLE_WANDER) {
        const pitch = this.type === EnemyType.FAST ? 1.3 : this.type === EnemyType.BOSS ? 0.65 : 1.0;
        this.audio.playZombieGrowl(pitch, distanceToPlayer);
      }
      this.growlTimer = 3.5 + Math.random() * 5.5;
    }

    // 4. Attack Logic with Vertical Reach Check
    if (this.attackTimer > 0) {
      this.attackTimer -= delta;
    }

    // Vertical height difference between player feet and zombie feet
    const playerFeetY = playerPos.y - (isPlayerCrouched ? 1.05 : 1.75);
    const zombieFeetY = this.group.position.y;
    const verticalDiff = playerFeetY - zombieFeetY;

    // Normal zombie max upward reach above feet is 1.35m; downward reach is 1.5m
    const maxUpReach = this.type === EnemyType.BOSS ? 2.2 : 1.35;
    const maxDownReach = this.type === EnemyType.BOSS ? 2.5 : 1.5;
    const inVerticalReach = verticalDiff >= -maxDownReach && verticalDiff <= maxUpReach;

    const inAttackRange = distanceToPlayer <= this.attackRange && inVerticalReach;

    if (inAttackRange && this.attackTimer <= 0) {
      this.attackTimer = this.attackCooldown;
      const pitch = this.type === EnemyType.FAST ? 1.35 : this.type === EnemyType.BOSS ? 0.7 : 1.0;
      this.audio.playZombieAttack(pitch);

      if (this.isGlbModel) {
        const attackClip = Math.random() < 0.4 ? 'Bite' : 'Attack';
        this.playAnimation(attackClip, 0.15);
      }

      if (this.onAttackPlayer) {
        this.onAttackPlayer(this.damage, this.group.position);
      }
    }

    // 5. Navigation & Movement (Movie-style surrounding, flanking, stairs climbing & shambling)
    if (!inAttackRange) {
      let moveDir: THREE.Vector3;
      let effectiveSpeed: number;

      if (this.aiState === ZombieAIState.IDLE_WANDER) {
        // Idle wandering: slowly patrol area
        this.wanderTimer -= delta;
        if (this.wanderTimer <= 0) {
          const randAngle = Math.random() * Math.PI * 2;
          this.wanderDir.set(Math.cos(randAngle), 0, Math.sin(randAngle));
          this.wanderTimer = 3.0 + Math.random() * 4.0;
        }
        moveDir = this.wanderDir.clone();
        effectiveSpeed = 0.9 * this.speedVariance;
      } else {
        // Check if player is elevated on the watchtower or stairs
        const isPlayerOnTowerOrStairs =
          playerFeetY > 1.2 &&
          playerPos.x >= -11.0 && playerPos.x <= -3.0 &&
          playerPos.z >= -21.0 && playerPos.z <= -7.0;

        let navTarget = toPlayer.clone();

        // If player is on watchtower/stairs and zombie is on the ground,
        // navigate to the stair entrance at (-5.2, z: -7.5) instead of walking directly under the deck
        if (isPlayerOnTowerOrStairs && this.group.position.y < 0.8) {
          const stairBase = new THREE.Vector3(-5.2, 0, -7.5);
          const toStair = stairBase.clone().sub(new THREE.Vector3(this.group.position.x, 0, this.group.position.z));
          if (toStair.length() > 1.2) {
            navTarget.copy(toStair);
          } else {
            // Reached base of stairs: head up the staircase straight towards north (-Z)
            navTarget.set(0, 0, -1);
          }
        }

        // Moving towards target: Apply flanking offset so zombies fan out to surround the player
        const rawDir = navTarget.normalize();
        const flankMult = Math.min(1.0, distanceToPlayer / 14);
        const cosF = Math.cos(this.flankAngleOffset * flankMult);
        const sinF = Math.sin(this.flankAngleOffset * flankMult);
        moveDir = new THREE.Vector3(
          rawDir.x * cosF - rawDir.z * sinF,
          0,
          rawDir.x * sinF + rawDir.z * cosF
        );

        // Add lateral drunken zombie meandering sway
        const lateralVec = new THREE.Vector3(-moveDir.z, 0, moveDir.x);
        const sway = Math.sin(this.walkCycleTimer * this.swayFreq + this.swayPhase) * this.swayAmp;
        moveDir.addScaledVector(lateralVec, sway).normalize();

        if (this.aiState === ZombieAIState.ENRAGED_RUN) {
          effectiveSpeed = (this.type === EnemyType.FAST ? 5.2 : this.type === EnemyType.BOSS ? 3.3 : 4.4) * this.speedVariance;
        } else {
          effectiveSpeed = (this.type === EnemyType.BOSS ? 2.5 : 2.1) * this.speedVariance;
          if (isPlayerCrouched && distanceToPlayer > 18) {
            effectiveSpeed *= 0.75;
          }
        }
      }

      // Whisker wall avoidance (evaluated at zombie's actual elevation)
      const checkY = this.group.position.y + 0.9;
      const probeLeft = new THREE.Vector3(
        this.group.position.x - moveDir.z * 1.0 + moveDir.x * 1.5,
        checkY,
        this.group.position.z + moveDir.x * 1.0 + moveDir.z * 1.5
      );
      const probeRight = new THREE.Vector3(
        this.group.position.x + moveDir.z * 1.0 + moveDir.x * 1.5,
        checkY,
        this.group.position.z - moveDir.x * 1.0 + moveDir.z * 1.5
      );

      const colL = this.environment.checkSphereCollision(probeLeft, 0.4);
      const colR = this.environment.checkSphereCollision(probeRight, 0.4);

      if (colL.hit && !colR.hit) {
        moveDir.add(new THREE.Vector3(moveDir.z, 0, -moveDir.x).multiplyScalar(0.75)).normalize();
      } else if (colR.hit && !colL.hit) {
        moveDir.add(new THREE.Vector3(-moveDir.z, 0, moveDir.x).multiplyScalar(0.75)).normalize();
      }

      // Enhanced Crowd Dispersion & Lateral Flocking (Completely eliminates single file marching)
      const separation = new THREE.Vector3();
      const personalSpace = 2.4; // 2.4m personal perimeter
      const lateralVec = new THREE.Vector3(-moveDir.z, 0, moveDir.x);

      for (const other of otherEnemies) {
        if (other === this || other.isDead) continue;
        const diff = this.group.position.clone().sub(other.group.position);
        diff.y = 0;
        const dist = diff.length();
        if (dist < personalSpace && dist > 0.01) {
          const pushRatio = (personalSpace - dist) / personalSpace;
          // Radial push
          separation.add(diff.normalize().multiplyScalar(pushRatio * 1.4));
          // If the other zombie is directly ahead of us, peel off laterally to flank
          const aheadDot = moveDir.dot(diff);
          if (aheadDot < 0) {
            const sidePush = diff.dot(lateralVec) >= 0 ? 1.0 : -1.0;
            separation.addScaledVector(lateralVec, sidePush * pushRatio * 1.6);
          }
        }
      }
      moveDir.add(separation).normalize();

      this.group.position.x += moveDir.x * effectiveSpeed * delta;
      this.group.position.z += moveDir.z * effectiveSpeed * delta;

      // Natural smooth turning
      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      const turnSpeed = this.aiState === ZombieAIState.ENRAGED_RUN ? 9.0 : 5.0;
      this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, targetAngle, turnSpeed * delta);

      if (this.isGlbModel) {
        const moveClip = this.aiState === ZombieAIState.ENRAGED_RUN ? 'Run' : (this.aiState === ZombieAIState.ALERTED_WALK ? 'Walk' : 'Walk');
        if (
          this.currentActionName !== moveClip &&
          !this.actions.get('Attack')?.isRunning() &&
          !this.actions.get('Bite')?.isRunning()
        ) {
          this.playAnimation(moveClip, 0.25);
        }
      } else {
        // Procedural Movie Zombie Personality Animation
        const gaitSpeed = this.aiState === ZombieAIState.ENRAGED_RUN ? 4.2 : 2.2;
        this.walkCycleTimer += delta * (effectiveSpeed * gaitSpeed);
        const swing = Math.sin(this.walkCycleTimer);
        const scale = this.type === EnemyType.BOSS ? 1.75 : this.type === EnemyType.FAST ? 0.95 : 1.0;

        if (this.personalityType === 0) {
          // 1. The Limper: Asymmetric leg dragging with heavy hip drop
          this.leftLegGroup.rotation.x = swing > 0 ? swing * 0.25 : swing * 0.12; // Dragged leg
          this.rightLegGroup.rotation.x = -swing * 0.85; // Strong forward stride
          this.torsoMesh.rotation.z = Math.sin(this.walkCycleTimer * 0.5) * 0.15; // Hip dip
          this.torsoMesh.position.y = 1.15 * scale - Math.abs(swing) * 0.05;
          this.leftArmGroup.rotation.x = -0.5 + swing * 0.3;
          this.rightArmGroup.rotation.x = -0.8 - swing * 0.4;
        } else if (this.personalityType === 1) {
          // 2. The Head-Twitcher: Creepily tilted head & hunched shoulders
          this.leftLegGroup.rotation.x = swing * 0.7;
          this.rightLegGroup.rotation.x = -swing * 0.7;
          this.headMesh.rotation.z = 0.35 + Math.sin(this.walkCycleTimer * 3.5) * 0.08;
          this.headMesh.rotation.y = Math.sin(this.walkCycleTimer * 1.5) * 0.25;
          this.torsoMesh.rotation.x = 0.22;
          this.leftArmGroup.rotation.x = -0.9 + swing * 0.4;
          this.rightArmGroup.rotation.x = -0.9 - swing * 0.4;
        } else if (this.personalityType === 2) {
          // 3. The Double-Arm Reacher: Both arms locked forward hungrily
          this.leftLegGroup.rotation.x = swing * 0.72;
          this.rightLegGroup.rotation.x = -swing * 0.72;
          this.leftArmGroup.rotation.x = -1.35 + Math.sin(this.walkCycleTimer * 0.8) * 0.15;
          this.rightArmGroup.rotation.x = -1.1 + Math.cos(this.walkCycleTimer * 0.8) * 0.15;
          this.torsoMesh.rotation.x = 0.18;
        } else if (this.personalityType === 3) {
          // 4. The Broken-Arm Shambler: Left arm hangs dead weight, right arm reaches
          this.leftLegGroup.rotation.x = swing * 0.68;
          this.rightLegGroup.rotation.x = -swing * 0.68;
          this.leftArmGroup.rotation.x = 0.1 + swing * 0.2; // Hanging limp
          this.leftArmGroup.rotation.z = -0.22;
          this.rightArmGroup.rotation.x = -1.25 + swing * 0.35;
          this.torsoMesh.rotation.y = 0.16; // Body twisted
        } else {
          // 5. The Drunken Lurcher: Torso rolls side to side, lunging steps
          this.leftLegGroup.rotation.x = swing * 0.75;
          this.rightLegGroup.rotation.x = -swing * 0.75;
          this.torsoMesh.rotation.z = Math.sin(this.walkCycleTimer) * 0.22;
          this.torsoMesh.rotation.x = 0.16 + Math.cos(this.walkCycleTimer) * 0.12;
          this.leftArmGroup.rotation.x = -0.7 + swing * 0.5;
          this.rightArmGroup.rotation.x = -0.7 - swing * 0.5;
        }

        // Fast runner aggressive sprint hunch override
        if (this.aiState === ZombieAIState.ENRAGED_RUN || this.type === EnemyType.FAST) {
          this.torsoMesh.rotation.x = 0.35;
          this.leftArmGroup.rotation.x -= 0.35;
          this.rightArmGroup.rotation.x -= 0.35;
        }
      }
    } else {
      // In range: Face player directly
      const targetAngle = Math.atan2(toPlayer.x, toPlayer.z);
      this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, targetAngle, 8.0 * delta);

      if (this.isGlbModel) {
        if (
          !this.actions.get('Attack')?.isRunning() &&
          !this.actions.get('Bite')?.isRunning() &&
          this.currentActionName !== 'Idle'
        ) {
          this.playAnimation('Idle', 0.25);
        }
      } else {
        // Attack claw swipe pose
        if (this.attackTimer > this.attackCooldown - 0.4) {
          const p = (this.attackCooldown - this.attackTimer) / 0.4;
          const swipe = Math.sin(p * Math.PI) * 1.7;
          this.leftArmGroup.rotation.x = -Math.PI / 3 - swipe;
          this.rightArmGroup.rotation.x = -Math.PI / 3 - swipe;
        } else {
          this.leftArmGroup.rotation.x = -0.7;
          this.rightArmGroup.rotation.x = -0.7;
        }
        this.leftLegGroup.rotation.x = 0;
        this.rightLegGroup.rotation.x = 0;
      }
    }

    // Apply Knockback
    if (this.knockback.lengthSq() > 0.01) {
      this.group.position.addScaledVector(this.knockback, delta);
      this.knockback.lerp(new THREE.Vector3(0, 0, 0), 10 * delta);
    }

    // Wall Collision Check (at current zombie elevation)
    const col = this.environment.checkSphereCollision(
      new THREE.Vector3(this.group.position.x, this.group.position.y + 0.9, this.group.position.z),
      this.radius
    );
    if (col.hit) {
      this.group.position.x += col.pushVector.x;
      this.group.position.z += col.pushVector.z;
    }

    this.group.position.x = Math.max(-57, Math.min(57, this.group.position.x));
    this.group.position.z = Math.max(-57, Math.min(57, this.group.position.z));

    // Keep zombies climbing the stairs centered on the 1.9m wide staircase
    if (
      this.group.position.z >= -13.8 &&
      this.group.position.z <= -7.8 &&
      this.group.position.y > 0.3 &&
      this.group.position.y < 4.0
    ) {
      this.group.position.x = Math.max(-5.9, Math.min(-4.5, this.group.position.x));
    }

    // Ground & Stair Step-Up adaptation (supports climbing watchtower stairs and elevated structures)
    const targetGroundY = this.environment.getGroundHeightAt(
      this.group.position.x,
      this.group.position.z,
      this.group.position.y
    );
    this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, targetGroundY, 14 * delta);
  }
}
