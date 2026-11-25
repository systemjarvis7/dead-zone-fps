import * as THREE from 'three';

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  gravity: number;
}

interface BloodDecal {
  mesh: THREE.Mesh;
  currentScale: number;
  targetScale: number;
  growthSpeed: number;
  life: number;
}

export class ParticleSystem {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private maxParticles = 800;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private points: THREE.Points;
  private positions: Float32Array;
  private colors: Float32Array;

  // Ground Blood Pools & Decals
  private bloodDecals: BloodDecal[] = [];
  private maxBloodDecals = 40;
  private bloodDecalTexture: THREE.CanvasTexture;
  private bloodPlaneGeo: THREE.PlaneGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    // Create a circular particle texture using canvas
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);

    this.material = new THREE.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      map: texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);

    // Pre-generate splattered blood decal texture
    this.bloodDecalTexture = this.createBloodDecalTexture();
    this.bloodPlaneGeo = new THREE.PlaneGeometry(1, 1);
  }

  private createBloodDecalTexture(): THREE.CanvasTexture {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const center = size / 2;
    // Central dark blood pool
    const poolGrad = ctx.createRadialGradient(center, center, 4, center, center, center * 0.75);
    poolGrad.addColorStop(0, '#5a0000');
    poolGrad.addColorStop(0.6, '#3d0000');
    poolGrad.addColorStop(0.9, 'rgba(40, 0, 0, 0.85)');
    poolGrad.addColorStop(1, 'rgba(30, 0, 0, 0)');

    ctx.fillStyle = poolGrad;
    ctx.beginPath();
    ctx.arc(center, center, center * 0.75, 0, Math.PI * 2);
    ctx.fill();

    // Spattered blood droplet satellite splotches
    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = (Math.random() * 0.35 + 0.35) * center;
      const x = center + Math.cos(angle) * dist;
      const y = center + Math.sin(angle) * dist;
      const r = Math.random() * 4.5 + 1.5;

      ctx.fillStyle = Math.random() > 0.4 ? 'rgba(80, 0, 0, 0.85)' : 'rgba(45, 0, 0, 0.9)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  /**
   * Spawns an expanding blood pool decal directly on the grass ground when a zombie dies
   */
  public spawnBloodPool(pos: THREE.Vector3): void {
    if (this.bloodDecals.length >= this.maxBloodDecals) {
      const oldest = this.bloodDecals.shift();
      if (oldest) {
        this.scene.remove(oldest.mesh);
        if (oldest.mesh.material instanceof THREE.Material) oldest.mesh.material.dispose();
      }
    }

    const mat = new THREE.MeshBasicMaterial({
      map: this.bloodDecalTexture,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });

    const mesh = new THREE.Mesh(this.bloodPlaneGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.random() * Math.PI * 2;
    mesh.position.set(pos.x, 0.025 + Math.random() * 0.005, pos.z);
    mesh.scale.set(0.2, 0.2, 0.2);

    this.scene.add(mesh);

    this.bloodDecals.push({
      mesh,
      currentScale: 0.2,
      targetScale: Math.random() * 0.6 + 1.3,
      growthSpeed: 2.2,
      life: 0
    });
  }

  /**
   * High-intensity 360-degree blood burst when a zombie is eliminated
   */
  public spawnBloodExplosion(pos: THREE.Vector3, count: number = 38): void {
    const bloodColor = new THREE.Color(0xa80000);
    const darkBlood = new THREE.Color(0x4a0000);
    const splatterColor = new THREE.Color(0x6b0505);

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const angle = Math.random() * Math.PI * 2;
      const elevation = (Math.random() - 0.1) * Math.PI * 0.45;
      const speed = Math.random() * 4.8 + 2.2;

      const spread = new THREE.Vector3(
        Math.cos(angle) * Math.cos(elevation) * speed,
        (Math.sin(elevation) + 0.45) * speed * 1.2,
        Math.sin(angle) * Math.cos(elevation) * speed
      );

      const dice = Math.random();
      const col = dice < 0.4 ? bloodColor : dice < 0.75 ? darkBlood : splatterColor;

      this.particles.push({
        position: pos.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.25,
          (Math.random() - 0.5) * 0.25,
          (Math.random() - 0.5) * 0.25
        )),
        velocity: spread,
        color: col.clone(),
        size: Math.random() * 0.18 + 0.24,
        alpha: 1.0,
        life: 0,
        maxLife: 0.6 + Math.random() * 0.45,
        gravity: 12.0
      });
    }
  }

  public spawnBlood(pos: THREE.Vector3, normal: THREE.Vector3, count: number = 14): void {
    const bloodColor = new THREE.Color(0x990000);
    const darkBlood = new THREE.Color(0x550000);

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const spread = new THREE.Vector3(
        (Math.random() - 0.5) * 1.5 + normal.x * 2.0,
        (Math.random() - 0.2) * 1.8 + normal.y * 2.0,
        (Math.random() - 0.5) * 1.5 + normal.z * 2.0
      ).normalize().multiplyScalar(Math.random() * 3.5 + 1.2);

      const col = Math.random() > 0.5 ? bloodColor : darkBlood;

      this.particles.push({
        position: pos.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1
        )),
        velocity: spread,
        color: col.clone(),
        size: 0.22,
        alpha: 1.0,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.25,
        gravity: 9.8
      });
    }
  }

  public spawnSparks(pos: THREE.Vector3, normal: THREE.Vector3, count: number = 12): void {
    const sparkColor = new THREE.Color(0xffbb33);
    const smokeColor = new THREE.Color(0x888888);

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const spread = new THREE.Vector3(
        (Math.random() - 0.5) * 1.0 + normal.x * 3.0,
        (Math.random() - 0.5) * 1.0 + normal.y * 3.0,
        (Math.random() - 0.5) * 1.0 + normal.z * 3.0
      ).normalize().multiplyScalar(Math.random() * 4.5 + 1.5);

      const isSpark = Math.random() > 0.3;

      this.particles.push({
        position: pos.clone(),
        velocity: spread,
        color: isSpark ? sparkColor : smokeColor,
        size: isSpark ? 0.15 : 0.25,
        alpha: 1.0,
        life: 0,
        maxLife: 0.2 + Math.random() * 0.25,
        gravity: 6.0
      });
    }
  }

  public update(delta: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += delta;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      // Physics
      p.velocity.y -= p.gravity * delta;
      p.position.addScaledVector(p.velocity, delta);

      // Floor bounce/collision
      if (p.position.y < 0.05) {
        p.position.y = 0.05;
        p.velocity.y *= -0.2;
        p.velocity.x *= 0.5;
        p.velocity.z *= 0.5;
      }
    }

    // Update geometry buffer
    let ptr = 0;
    for (let i = 0; i < this.maxParticles; i++) {
      if (i < this.particles.length) {
        const p = this.particles[i];
        this.positions[ptr] = p.position.x;
        this.positions[ptr + 1] = p.position.y;
        this.positions[ptr + 2] = p.position.z;

        const lifeRatio = 1 - (p.life / p.maxLife);
        this.colors[ptr] = p.color.r * lifeRatio;
        this.colors[ptr + 1] = p.color.g * lifeRatio;
        this.colors[ptr + 2] = p.color.b * lifeRatio;
      } else {
        this.positions[ptr] = 0;
        this.positions[ptr + 1] = -1000;
        this.positions[ptr + 2] = 0;

        this.colors[ptr] = 0;
        this.colors[ptr + 1] = 0;
        this.colors[ptr + 2] = 0;
      }
      ptr += 3;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;

    // Smoothly expand ground blood decals as blood pools out
    for (const decal of this.bloodDecals) {
      if (decal.currentScale < decal.targetScale) {
        decal.currentScale = Math.min(decal.targetScale, decal.currentScale + delta * decal.growthSpeed);
        decal.mesh.scale.set(decal.currentScale, decal.currentScale, decal.currentScale);
      }
    }
  }
}
