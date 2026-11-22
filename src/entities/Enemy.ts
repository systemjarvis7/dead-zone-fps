import * as THREE from 'three';
import { EnemyType } from '../core/Types';
import { AudioManager } from '../core/AudioManager';
import { VillageEnvironment } from '../world/VillageEnvironment';

export class Enemy {
  public type: EnemyType;
  public group: THREE.Group;
  public audio: AudioManager;
  public environment: VillageEnvironment;

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
  public shouldRemove: boolean = false;

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
    const scale = this.type === EnemyType.BOSS ? 1.75 : 1.0;

    // Random visual clothing variations
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

    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.82 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.88 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.92 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor });

    this.materials.push(skinMat, shirtMat, pantsMat, bootMat);
    this.originalColors.push(skinColor, shirtColor, pantsColor, 0x1a1a1a);

    // 1. Torso with angled chest
    const torsoGeo = new THREE.BoxGeometry(0.56 * scale, 0.78 * scale, 0.32 * scale);
    this.torsoMesh = new THREE.Mesh(torsoGeo, shirtMat);
    this.torsoMesh.position.y = 1.15 * scale;
    this.torsoMesh.castShadow = true;
    this.group.add(this.torsoMesh);

    // 2. Head & Jaw (named 'Head' for hit detection)
    const headGeo = new THREE.BoxGeometry(0.36 * scale, 0.4 * scale, 0.36 * scale);
    this.headMesh = new THREE.Mesh(headGeo, skinMat);
    this.headMesh.name = 'Head';
    this.headMesh.position.set(0, 1.74 * scale, 0);
    this.headMesh.castShadow = true;
    this.group.add(this.headMesh);

    // Sunken Glowing Eyes
    const eyeGeo = new THREE.BoxGeometry(0.065 * scale, 0.05 * scale, 0.04 * scale);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.09 * scale, 1.77 * scale, 0.175 * scale);
    this.group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.09 * scale, 1.77 * scale, 0.175 * scale);
    this.group.add(rightEye);

    // Jaw / Teeth
    const jaw = new THREE.Mesh(
      new THREE.BoxGeometry(0.24 * scale, 0.12 * scale, 0.15 * scale),
      skinMat
    );
    jaw.position.set(0, 1.58 * scale, 0.12 * scale);
    this.group.add(jaw);

    // 3. Left Arm with Elbow & Claw Hand
    this.leftArmGroup = new THREE.Group();
    this.leftArmGroup.position.set(-0.36 * scale, 1.48 * scale, 0);

    const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.18 * scale, 0.42 * scale, 0.18 * scale), shirtMat);
    upperArm.position.y = -0.2 * scale;
    upperArm.castShadow = true;
    this.leftArmGroup.add(upperArm);

    const lowerArm = new THREE.Mesh(new THREE.BoxGeometry(0.16 * scale, 0.42 * scale, 0.16 * scale), skinMat);
    lowerArm.position.y = -0.56 * scale;
    lowerArm.position.z = 0.08 * scale;
    lowerArm.rotation.x = -0.3;
    lowerArm.castShadow = true;
    this.leftArmGroup.add(lowerArm);
    this.group.add(this.leftArmGroup);

    // 4. Right Arm with Elbow & Claw Hand
    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.position.set(0.36 * scale, 1.48 * scale, 0);

    const rightUpper = new THREE.Mesh(new THREE.BoxGeometry(0.18 * scale, 0.42 * scale, 0.18 * scale), shirtMat);
    rightUpper.position.y = -0.2 * scale;
    rightUpper.castShadow = true;
    this.rightArmGroup.add(rightUpper);

    const rightLower = new THREE.Mesh(new THREE.BoxGeometry(0.16 * scale, 0.42 * scale, 0.16 * scale), skinMat);
    rightLower.position.y = -0.56 * scale;
    rightLower.position.z = 0.08 * scale;
    rightLower.rotation.x = -0.3;
    rightLower.castShadow = true;
    this.rightArmGroup.add(rightLower);
    this.group.add(this.rightArmGroup);

    // 5. Left Leg with Boot
    this.leftLegGroup = new THREE.Group();
    this.leftLegGroup.position.set(-0.16 * scale, 0.76 * scale, 0);

    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2 * scale, 0.76 * scale, 0.22 * scale), pantsMat);
    leftLeg.position.y = -0.38 * scale;
    leftLeg.castShadow = true;
    this.leftLegGroup.add(leftLeg);

    const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.22 * scale, 0.16 * scale, 0.3 * scale), bootMat);
    leftBoot.position.set(0, -0.72 * scale, 0.04 * scale);
    this.leftLegGroup.add(leftBoot);
    this.group.add(this.leftLegGroup);

    // 6. Right Leg with Boot
    this.rightLegGroup = new THREE.Group();
    this.rightLegGroup.position.set(0.16 * scale, 0.76 * scale, 0);

    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2 * scale, 0.76 * scale, 0.22 * scale), pantsMat);
    rightLeg.position.y = -0.38 * scale;
    rightLeg.castShadow = true;
    this.rightLegGroup.add(rightLeg);

    const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.22 * scale, 0.16 * scale, 0.3 * scale), bootMat);
    rightBoot.position.set(0, -0.72 * scale, 0.04 * scale);
    this.rightLegGroup.add(rightBoot);
    this.group.add(this.rightLegGroup);
  }

  public takeDamage(amount: number, isHeadshot: boolean = false): void {
    if (this.isDead) return;

    this.health -= amount;
    this.hurtTimer = 0.14;

    for (const mat of this.materials) {
      mat.color.setHex(0xff1111);
    }

    if (isHeadshot) {
      this.headshotFlinchTimer = 0.22;
      this.headMesh.rotation.x = -0.45; // Head snaps back
    }

    if (this.health <= 0) {
      this.health = 0;
      this.isDead = true;
      this.audio.playZombieDeath();
      if (this.onDeath) {
        this.onDeath(this);
      }
    } else {
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
    // 1. Death Animation & Sink
    if (this.isDead) {
      this.deathTimer += delta;
      if (this.deathTimer < 0.65) {
        this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, -Math.PI / 2, 8 * delta);
        this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, 0.2, 8 * delta);
      } else if (this.deathTimer > 2.5) {
        this.group.position.y -= delta * 0.45;
        if (this.deathTimer > 4.5) {
          this.shouldRemove = true;
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

    if (this.headshotFlinchTimer > 0) {
      this.headshotFlinchTimer -= delta;
      this.headMesh.rotation.x = THREE.MathUtils.lerp(this.headMesh.rotation.x, 0, 10 * delta);
    }

    // 3. Ambient Vocalizations (Spatial scaling)
    this.growlTimer -= delta;
    const toPlayer = new THREE.Vector3().subVectors(playerPos, this.group.position);
    toPlayer.y = 0;
    const distanceToPlayer = toPlayer.length();

    if (this.growlTimer <= 0) {
      if (distanceToPlayer < 35) {
        const pitch = this.type === EnemyType.FAST ? 1.3 : this.type === EnemyType.BOSS ? 0.65 : 1.0;
        this.audio.playZombieGrowl(pitch, distanceToPlayer);
      }
      this.growlTimer = 3.5 + Math.random() * 5.5;
    }

    // 4. Attack Logic
    if (this.attackTimer > 0) {
      this.attackTimer -= delta;
    }

    const inAttackRange = distanceToPlayer <= this.attackRange;

    if (inAttackRange && this.attackTimer <= 0) {
      this.attackTimer = this.attackCooldown;
      const pitch = this.type === EnemyType.FAST ? 1.35 : this.type === EnemyType.BOSS ? 0.7 : 1.0;
      this.audio.playZombieAttack(pitch);

      if (this.onAttackPlayer) {
        this.onAttackPlayer(this.damage, this.group.position);
      }
    }

    // 5. Navigation & Movement
    if (!inAttackRange) {
      const moveDir = toPlayer.clone().normalize();

      // Whisker wall avoidance
      const probeLeft = new THREE.Vector3(
        this.group.position.x - moveDir.z * 1.0 + moveDir.x * 1.5,
        1.0,
        this.group.position.z + moveDir.x * 1.0 + moveDir.z * 1.5
      );
      const probeRight = new THREE.Vector3(
        this.group.position.x + moveDir.z * 1.0 + moveDir.x * 1.5,
        1.0,
        this.group.position.z - moveDir.x * 1.0 + moveDir.z * 1.5
      );

      const colL = this.environment.checkSphereCollision(probeLeft, 0.4);
      const colR = this.environment.checkSphereCollision(probeRight, 0.4);

      if (colL.hit && !colR.hit) {
        moveDir.add(new THREE.Vector3(moveDir.z, 0, -moveDir.x).multiplyScalar(0.75)).normalize();
      } else if (colR.hit && !colL.hit) {
        moveDir.add(new THREE.Vector3(-moveDir.z, 0, moveDir.x).multiplyScalar(0.75)).normalize();
      }

      // Separation from other zombies
      const separation = new THREE.Vector3();
      for (const other of otherEnemies) {
        if (other === this || other.isDead) continue;
        const diff = this.group.position.clone().sub(other.group.position);
        diff.y = 0;
        const dist = diff.length();
        const minDistance = this.radius + other.radius;
        if (dist < minDistance && dist > 0.01) {
          separation.add(diff.normalize().multiplyScalar((minDistance - dist) / minDistance));
        }
      }
      moveDir.add(separation.multiplyScalar(0.85)).normalize();

      // Detection modifier if player is crouching
      const effectiveSpeed = isPlayerCrouched && distanceToPlayer > 18 ? this.speed * 0.7 : this.speed;

      this.group.position.x += moveDir.x * effectiveSpeed * delta;
      this.group.position.z += moveDir.z * effectiveSpeed * delta;

      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      this.group.rotation.y = targetAngle;

      // Limb swing animation
      this.walkCycleTimer += delta * (this.speed * 2.3);
      const swing = Math.sin(this.walkCycleTimer) * 0.65;
      this.leftLegGroup.rotation.x = swing;
      this.rightLegGroup.rotation.x = -swing;

      // Arm reaching / running posture
      if (this.type === EnemyType.FAST) {
        // Runner: hunched aggressive sprint
        this.torsoMesh.rotation.x = 0.28;
        this.leftArmGroup.rotation.x = -1.1 + swing * 0.5;
        this.rightArmGroup.rotation.x = -1.1 - swing * 0.5;
      } else {
        this.torsoMesh.rotation.x = 0.1;
        this.leftArmGroup.rotation.x = -0.65 + swing * 0.4;
        this.rightArmGroup.rotation.x = -0.65 - swing * 0.4;
      }
    } else {
      // In range: Face player directly
      this.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

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

    // Apply Knockback
    if (this.knockback.lengthSq() > 0.01) {
      this.group.position.addScaledVector(this.knockback, delta);
      this.knockback.lerp(new THREE.Vector3(0, 0, 0), 10 * delta);
    }

    // Wall Collision Check
    const col = this.environment.checkSphereCollision(
      new THREE.Vector3(this.group.position.x, 1.0, this.group.position.z),
      this.radius
    );
    if (col.hit) {
      this.group.position.x += col.pushVector.x;
      this.group.position.z += col.pushVector.z;
    }

    this.group.position.x = Math.max(-57, Math.min(57, this.group.position.x));
    this.group.position.z = Math.max(-57, Math.min(57, this.group.position.z));
    this.group.position.y = 0;
  }
}
