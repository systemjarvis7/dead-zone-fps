import * as THREE from 'three';

/**
 * Procedural PBR Texture Generator
 * Generates photorealistic Albedo, Normal, and Roughness maps via canvas.
 * Zero external downloads, instant load time, high visual fidelity.
 */
export class TextureGenerator {
  private static cache: Map<string, THREE.CanvasTexture> = new Map();

  /**
   * Helper: Convert height/bump canvas into a Tangent-space Normal Map (RGB = XYZ normal)
   */
  public static createNormalMapFromHeight(heightCanvas: HTMLCanvasElement, strength: number = 2.0): THREE.CanvasTexture {
    const width = heightCanvas.width;
    const height = heightCanvas.height;
    const srcCtx = heightCanvas.getContext('2d')!;
    const srcData = srcCtx.getImageData(0, 0, width, height).data;

    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = width;
    normalCanvas.height = height;
    const dstCtx = normalCanvas.getContext('2d')!;
    const dstImage = dstCtx.createImageData(width, height);
    const dstData = dstImage.data;

    const getH = (x: number, y: number): number => {
      const px = (x + width) % width;
      const py = (y + height) % height;
      return srcData[(py * width + px) * 4] / 255.0;
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const left = getH(x - 1, y);
        const right = getH(x + 1, y);
        const down = getH(x, y - 1);
        const up = getH(x, y + 1);

        const dx = (left - right) * strength;
        const dy = (down - up) * strength;
        const dz = 1.0;

        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const nx = dx / len;
        const ny = dy / len;
        const nz = dz / len;

        const idx = (y * width + x) * 4;
        dstData[idx] = Math.floor((nx * 0.5 + 0.5) * 255);
        dstData[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
        dstData[idx + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
        dstData[idx + 3] = 255;
      }
    }

    dstCtx.putImageData(dstImage, 0, 0);
    const tex = new THREE.CanvasTexture(normalCanvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  /**
   * Realistic Asphalt Road with Cracks, Aggregate Gravel, and Wet Puddles
   */
  public static getAsphaltTextures(): { albedo: THREE.CanvasTexture; normal: THREE.CanvasTexture; roughness: THREE.CanvasTexture } {
    const key = 'asphalt';
    if (this.cache.has(key + '_albedo')) {
      return {
        albedo: this.cache.get(key + '_albedo')!,
        normal: this.cache.get(key + '_normal')!,
        roughness: this.cache.get(key + '_roughness')!
      };
    }

    const size = 512;
    // 1. Albedo & Height Canvas
    const albedoCanvas = document.createElement('canvas');
    albedoCanvas.width = size;
    albedoCanvas.height = size;
    const aCtx = albedoCanvas.getContext('2d')!;

    const heightCanvas = document.createElement('canvas');
    heightCanvas.width = size;
    heightCanvas.height = size;
    const hCtx = heightCanvas.getContext('2d')!;

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rCtx = roughCanvas.getContext('2d')!;

    // Base dark tar
    aCtx.fillStyle = '#222326';
    aCtx.fillRect(0, 0, size, size);

    hCtx.fillStyle = '#808080';
    hCtx.fillRect(0, 0, size, size);

    rCtx.fillStyle = '#ccb0a0'; // Rough dry asphalt default
    rCtx.fillRect(0, 0, size, size);

    // Aggregate gravel noise
    for (let i = 0; i < 6000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 2.2 + 0.8;
      const val = Math.floor(Math.random() * 50 + 25);
      const isDark = Math.random() > 0.4;

      aCtx.fillStyle = isDark ? `rgb(${val - 10}, ${val - 10}, ${val - 8})` : `rgb(${val + 20}, ${val + 18}, ${val + 16})`;
      aCtx.beginPath();
      aCtx.arc(x, y, r, 0, Math.PI * 2);
      aCtx.fill();

      hCtx.fillStyle = isDark ? '#404040' : '#b0b0b0';
      hCtx.beginPath();
      hCtx.arc(x, y, r, 0, Math.PI * 2);
      hCtx.fill();
    }

    // Asphalt Cracks
    aCtx.strokeStyle = '#0e0f10';
    aCtx.lineWidth = 1.6;
    hCtx.strokeStyle = '#101010';
    hCtx.lineWidth = 2.0;

    for (let c = 0; c < 5; c++) {
      let cx = Math.random() * size;
      let cy = Math.random() * size;
      aCtx.beginPath();
      aCtx.moveTo(cx, cy);
      hCtx.beginPath();
      hCtx.moveTo(cx, cy);

      const segments = Math.floor(Math.random() * 6 + 4);
      for (let s = 0; s < segments; s++) {
        cx += (Math.random() - 0.5) * 60;
        cy += (Math.random() - 0.5) * 60;
        aCtx.lineTo(cx, cy);
        hCtx.lineTo(cx, cy);
      }
      aCtx.stroke();
      hCtx.stroke();
    }

    // Wet Reflective Puddles (very low roughness = water reflection!)
    for (let p = 0; p < 3; p++) {
      const px = Math.random() * size;
      const py = Math.random() * size;
      const rx = Math.random() * 50 + 35;
      const ry = Math.random() * 35 + 25;

      const grad = rCtx.createRadialGradient(px, py, 5, px, py, rx);
      grad.addColorStop(0, '#0a0a0a'); // Ultra-low roughness (mirror puddle)
      grad.addColorStop(0.7, '#151515');
      grad.addColorStop(1, '#cca088');

      rCtx.fillStyle = grad;
      rCtx.beginPath();
      rCtx.ellipse(px, py, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
      rCtx.fill();

      // Darken puddle area in albedo
      const aGrad = aCtx.createRadialGradient(px, py, 5, px, py, rx);
      aGrad.addColorStop(0, 'rgba(10, 12, 14, 0.7)');
      aGrad.addColorStop(1, 'rgba(10, 12, 14, 0)');
      aCtx.fillStyle = aGrad;
      aCtx.beginPath();
      aCtx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
      aCtx.fill();
    }

    const albedoTex = new THREE.CanvasTexture(albedoCanvas);
    albedoTex.wrapS = THREE.RepeatWrapping;
    albedoTex.wrapT = THREE.RepeatWrapping;

    const normalTex = this.createNormalMapFromHeight(heightCanvas, 3.0);

    const roughTex = new THREE.CanvasTexture(roughCanvas);
    roughTex.wrapS = THREE.RepeatWrapping;
    roughTex.wrapT = THREE.RepeatWrapping;

    this.cache.set(key + '_albedo', albedoTex);
    this.cache.set(key + '_normal', normalTex);
    this.cache.set(key + '_roughness', roughTex);

    return { albedo: albedoTex, normal: normalTex, roughness: roughTex };
  }

  /**
   * Vibrant Photorealistic Open Grass Field Material with Natural Blades & Earth Variations
   */
  public static getGrassTextures(): { albedo: THREE.CanvasTexture; normal: THREE.CanvasTexture; roughness: THREE.CanvasTexture } {
    const key = 'grass_open';
    if (this.cache.has(key + '_albedo')) {
      return {
        albedo: this.cache.get(key + '_albedo')!,
        normal: this.cache.get(key + '_normal')!,
        roughness: this.cache.get(key + '_roughness')!
      };
    }

    const size = 512;
    const albedoCanvas = document.createElement('canvas');
    albedoCanvas.width = size;
    albedoCanvas.height = size;
    const aCtx = albedoCanvas.getContext('2d')!;

    const heightCanvas = document.createElement('canvas');
    heightCanvas.width = size;
    heightCanvas.height = size;
    const hCtx = heightCanvas.getContext('2d')!;

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rCtx = roughCanvas.getContext('2d')!;

    // Vibrant, lush sunlit meadow green
    aCtx.fillStyle = '#4e8c28';
    aCtx.fillRect(0, 0, size, size);

    hCtx.fillStyle = '#7a7a7a';
    hCtx.fillRect(0, 0, size, size);

    rCtx.fillStyle = '#a0a0a0'; // Gentle sheen (roughness ~0.65)
    rCtx.fillRect(0, 0, size, size);

    // Large organic terrain shading patches (sunlit bright lime green, rich emerald meadow)
    for (let p = 0; p < 22; p++) {
      const px = Math.random() * size;
      const py = Math.random() * size;
      const rad = Math.random() * 130 + 70;
      const patchType = Math.random();

      const grad = aCtx.createRadialGradient(px, py, 10, px, py, rad);
      if (patchType < 0.5) {
        grad.addColorStop(0, 'rgba(102, 195, 55, 0.75)'); // Sunlit vibrant lime blade patch
      } else if (patchType < 0.85) {
        grad.addColorStop(0, 'rgba(72, 150, 36, 0.65)');  // Rich meadow green patch
      } else {
        grad.addColorStop(0, 'rgba(118, 210, 68, 0.5)');   // Golden sunny blade highlights
      }
      grad.addColorStop(1, 'rgba(78, 140, 40, 0)');
      aCtx.fillStyle = grad;
      aCtx.beginPath();
      aCtx.arc(px, py, rad, 0, Math.PI * 2);
      aCtx.fill();
    }

    // Dense crisp grass blades and texture micro-variation
    const bladeColors = ['#66bb3c', '#55a82f', '#7cd348', '#448a24', '#8ee258', '#5ea832', '#9ae862'];
    for (let i = 0; i < 11000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const len = Math.random() * 5.5 + 2.5;
      const angle = (Math.random() - 0.5) * 0.9 - Math.PI / 2;
      const x2 = x + Math.cos(angle) * len;
      const y2 = y + Math.sin(angle) * len;

      aCtx.strokeStyle = bladeColors[Math.floor(Math.random() * bladeColors.length)];
      aCtx.lineWidth = Math.random() * 1.5 + 0.6;
      aCtx.beginPath();
      aCtx.moveTo(x, y);
      aCtx.lineTo(x2, y2);
      aCtx.stroke();

      // Blade height ridges for tangent normal map
      hCtx.strokeStyle = Math.random() > 0.4 ? '#c0c0c0' : '#454545';
      hCtx.lineWidth = 1.0;
      hCtx.beginPath();
      hCtx.moveTo(x, y);
      hCtx.lineTo(x2, y2);
      hCtx.stroke();
    }

    const albedoTex = new THREE.CanvasTexture(albedoCanvas);
    albedoTex.wrapS = THREE.RepeatWrapping;
    albedoTex.wrapT = THREE.RepeatWrapping;

    const normalTex = this.createNormalMapFromHeight(heightCanvas, 2.2);
    const roughTex = new THREE.CanvasTexture(roughCanvas);
    roughTex.wrapS = THREE.RepeatWrapping;
    roughTex.wrapT = THREE.RepeatWrapping;

    this.cache.set(key + '_albedo', albedoTex);
    this.cache.set(key + '_normal', normalTex);
    this.cache.set(key + '_roughness', roughTex);

    return { albedo: albedoTex, normal: normalTex, roughness: roughTex };
  }

  /**
   * Weathered Red Brick Material with Mortar Grooves
   */
  public static getBrickTextures(): { albedo: THREE.CanvasTexture; normal: THREE.CanvasTexture; roughness: THREE.CanvasTexture } {
    const key = 'brick';
    if (this.cache.has(key + '_albedo')) {
      return {
        albedo: this.cache.get(key + '_albedo')!,
        normal: this.cache.get(key + '_normal')!,
        roughness: this.cache.get(key + '_roughness')!
      };
    }

    const size = 512;
    const aCanvas = document.createElement('canvas');
    aCanvas.width = size;
    aCanvas.height = size;
    const aCtx = aCanvas.getContext('2d')!;

    const hCanvas = document.createElement('canvas');
    hCanvas.width = size;
    hCanvas.height = size;
    const hCtx = hCanvas.getContext('2d')!;

    // Mortar background
    aCtx.fillStyle = '#6b6660';
    aCtx.fillRect(0, 0, size, size);
    hCtx.fillStyle = '#303030';
    hCtx.fillRect(0, 0, size, size);

    const rows = 16;
    const cols = 8;
    const brickH = size / rows;
    const brickW = size / cols;
    const gap = 3;

    for (let r = 0; r < rows; r++) {
      const offsetX = (r % 2 === 0) ? 0 : brickW * 0.5;
      for (let c = -1; c < cols + 1; c++) {
        const x = c * brickW + offsetX + gap;
        const y = r * brickH + gap;
        const w = brickW - gap * 2;
        const h = brickH - gap * 2;

        // Brick color variation
        const redTone = Math.floor(Math.random() * 35 + 110);
        const greenTone = Math.floor(Math.random() * 20 + 50);
        const blueTone = Math.floor(Math.random() * 15 + 40);

        aCtx.fillStyle = `rgb(${redTone}, ${greenTone}, ${blueTone})`;
        aCtx.fillRect(x, y, w, h);

        // Brick surface noise
        for (let n = 0; n < 30; n++) {
          const nx = x + Math.random() * w;
          const ny = y + Math.random() * h;
          const dark = Math.random() > 0.5;
          aCtx.fillStyle = dark ? 'rgba(30, 20, 15, 0.4)' : 'rgba(180, 120, 90, 0.3)';
          aCtx.fillRect(nx, ny, 2, 2);
        }

        hCtx.fillStyle = '#d0d0d0';
        hCtx.fillRect(x, y, w, h);
      }
    }

    const albedoTex = new THREE.CanvasTexture(aCanvas);
    albedoTex.wrapS = THREE.RepeatWrapping;
    albedoTex.wrapT = THREE.RepeatWrapping;

    const normalTex = this.createNormalMapFromHeight(hCanvas, 3.5);

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rCtx = roughCanvas.getContext('2d')!;
    rCtx.fillStyle = '#d8c4b8'; // Matte rough brick
    rCtx.fillRect(0, 0, size, size);
    const roughTex = new THREE.CanvasTexture(roughCanvas);

    this.cache.set(key + '_albedo', albedoTex);
    this.cache.set(key + '_normal', normalTex);
    this.cache.set(key + '_roughness', roughTex);

    return { albedo: albedoTex, normal: normalTex, roughness: roughTex };
  }

  /**
   * Distressed Weathered Wood Planks
   */
  public static getWoodPlankTextures(): { albedo: THREE.CanvasTexture; normal: THREE.CanvasTexture; roughness: THREE.CanvasTexture } {
    const key = 'wood';
    if (this.cache.has(key + '_albedo')) {
      return {
        albedo: this.cache.get(key + '_albedo')!,
        normal: this.cache.get(key + '_normal')!,
        roughness: this.cache.get(key + '_roughness')!
      };
    }

    const size = 512;
    const aCanvas = document.createElement('canvas');
    aCanvas.width = size;
    aCanvas.height = size;
    const aCtx = aCanvas.getContext('2d')!;

    const hCanvas = document.createElement('canvas');
    hCanvas.width = size;
    hCanvas.height = size;
    const hCtx = hCanvas.getContext('2d')!;

    // Dark grooves between planks
    aCtx.fillStyle = '#1c1510';
    aCtx.fillRect(0, 0, size, size);
    hCtx.fillStyle = '#202020';
    hCtx.fillRect(0, 0, size, size);

    const plankCount = 8;
    const plankH = size / plankCount;
    const gap = 3;

    for (let p = 0; p < plankCount; p++) {
      const y = p * plankH + gap;
      const h = plankH - gap * 2;

      const baseR = Math.floor(Math.random() * 20 + 75);
      const baseG = Math.floor(Math.random() * 15 + 55);
      const baseB = Math.floor(Math.random() * 10 + 40);

      aCtx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`;
      aCtx.fillRect(0, y, size, h);

      hCtx.fillStyle = '#b0b0b0';
      hCtx.fillRect(0, y, size, h);

      // Wood grain lines
      for (let g = 0; g < 40; g++) {
        const gy = y + Math.random() * h;
        aCtx.strokeStyle = Math.random() > 0.5 ? 'rgba(40, 25, 18, 0.4)' : 'rgba(120, 95, 75, 0.3)';
        aCtx.lineWidth = Math.random() * 1.5 + 0.5;
        aCtx.beginPath();
        aCtx.moveTo(0, gy);
        aCtx.bezierCurveTo(size * 0.3, gy + (Math.random() - 0.5) * 6, size * 0.7, gy + (Math.random() - 0.5) * 6, size, gy);
        aCtx.stroke();
      }
    }

    const albedoTex = new THREE.CanvasTexture(aCanvas);
    albedoTex.wrapS = THREE.RepeatWrapping;
    albedoTex.wrapT = THREE.RepeatWrapping;
    const normalTex = this.createNormalMapFromHeight(hCanvas, 2.5);

    const rCanvas = document.createElement('canvas');
    rCanvas.width = size;
    rCanvas.height = size;
    const rCtx = rCanvas.getContext('2d')!;
    rCtx.fillStyle = '#bba08e';
    rCtx.fillRect(0, 0, size, size);
    const roughTex = new THREE.CanvasTexture(rCanvas);

    this.cache.set(key + '_albedo', albedoTex);
    this.cache.set(key + '_normal', normalTex);
    this.cache.set(key + '_roughness', roughTex);

    return { albedo: albedoTex, normal: normalTex, roughness: roughTex };
  }

  /**
   * Rusted Corrugated / Sheet Metal
   */
  public static getRustedMetalTextures(): { albedo: THREE.CanvasTexture; normal: THREE.CanvasTexture; metalness: THREE.CanvasTexture; roughness: THREE.CanvasTexture } {
    const key = 'metal';
    const size = 512;
    const aCanvas = document.createElement('canvas');
    aCanvas.width = size;
    aCanvas.height = size;
    const aCtx = aCanvas.getContext('2d')!;

    const hCanvas = document.createElement('canvas');
    hCanvas.width = size;
    hCanvas.height = size;
    const hCtx = hCanvas.getContext('2d')!;

    const mCanvas = document.createElement('canvas');
    mCanvas.width = size;
    mCanvas.height = size;
    const mCtx = mCanvas.getContext('2d')!;

    // Dark oxidized steel base
    aCtx.fillStyle = '#42464b';
    aCtx.fillRect(0, 0, size, size);

    hCtx.fillStyle = '#808080';
    hCtx.fillRect(0, 0, size, size);

    mCtx.fillStyle = '#d0d0d0'; // High metalness base
    mCtx.fillRect(0, 0, size, size);

    // Rust patches (reduces metalness, adds orange/brown roughness)
    for (let r = 0; r < 25; r++) {
      const rx = Math.random() * size;
      const ry = Math.random() * size;
      const rad = Math.random() * 45 + 15;

      const rustGrad = aCtx.createRadialGradient(rx, ry, 2, rx, ry, rad);
      rustGrad.addColorStop(0, '#78351a');
      rustGrad.addColorStop(0.5, '#994a20');
      rustGrad.addColorStop(1, 'rgba(80, 50, 30, 0)');

      aCtx.fillStyle = rustGrad;
      aCtx.beginPath();
      aCtx.arc(rx, ry, rad, 0, Math.PI * 2);
      aCtx.fill();

      // Lower metalness on rust
      mCtx.fillStyle = '#202020';
      mCtx.beginPath();
      mCtx.arc(rx, ry, rad * 0.8, 0, Math.PI * 2);
      mCtx.fill();

      hCtx.fillStyle = '#a06040';
      hCtx.beginPath();
      hCtx.arc(rx, ry, rad, 0, Math.PI * 2);
      hCtx.fill();
    }

    const albedoTex = new THREE.CanvasTexture(aCanvas);
    albedoTex.wrapS = THREE.RepeatWrapping;
    albedoTex.wrapT = THREE.RepeatWrapping;

    const normalTex = this.createNormalMapFromHeight(hCanvas, 2.0);

    const metalTex = new THREE.CanvasTexture(mCanvas);
    metalTex.wrapS = THREE.RepeatWrapping;
    metalTex.wrapT = THREE.RepeatWrapping;

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rCtx = roughCanvas.getContext('2d')!;
    rCtx.fillStyle = '#6a6a6a'; // semi-reflective metal
    rCtx.fillRect(0, 0, size, size);
    const roughTex = new THREE.CanvasTexture(roughCanvas);

    return { albedo: albedoTex, normal: normalTex, metalness: metalTex, roughness: roughTex };
  }
}
