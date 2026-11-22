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

export class ParticleSystem {
  private particles: Particle[] = [];
  private maxParticles = 600;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private points: THREE.Points;
  private positions: Float32Array;
  private colors: Float32Array;

  constructor(scene: THREE.Scene) {
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
      size: 0.18,
      vertexColors: true,
      map: texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
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
  }
}
