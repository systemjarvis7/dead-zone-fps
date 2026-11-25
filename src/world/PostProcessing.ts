import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GraphicsQuality } from '../core/Types';

// Custom AAA Cinematic Color Grading & Lens Shader
const CinematicShader = {
  uniforms: {
    tDiffuse: { value: null },
    vignetteStrength: { value: 0.35 },
    vignetteRadius: { value: 0.8 },
    filmGrainIntensity: { value: 0.025 },
    time: { value: 0.0 },
    saturation: { value: 0.95 },
    contrast: { value: 1.08 },
    exposure: { value: 1.02 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float vignetteStrength;
    uniform float vignetteRadius;
    uniform float filmGrainIntensity;
    uniform float time;
    uniform float saturation;
    uniform float contrast;
    uniform float exposure;
    varying vec2 vUv;

    // Pseudo-random noise for film grain
    float rand(vec2 co) {
      return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }

    void main() {
      // Subtle chromatic aberration toward screen edges
      vec2 center = vec2(0.5);
      vec2 dir = vUv - center;
      float dist = length(dir);
      float chromDist = dist * dist * 0.003;

      vec4 color;
      color.r = texture2D(tDiffuse, vUv + dir * chromDist).r;
      color.g = texture2D(tDiffuse, vUv).g;
      color.b = texture2D(tDiffuse, vUv - dir * chromDist).b;
      color.a = 1.0;

      // Exposure & Contrast
      color.rgb *= exposure;
      color.rgb = (color.rgb - 0.5) * contrast + 0.5;

      // Saturation (cinematic cool desaturation in shadows)
      float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
      color.rgb = mix(vec3(luma), color.rgb, saturation);

      // Subtle warm highlight tint (GTA 6 dusk styling)
      color.r = mix(color.r, color.r * 1.03, luma);
      color.b = mix(color.b * 1.02, color.b * 0.98, luma);

      // Vignette
      float vig = smoothstep(vignetteRadius, vignetteRadius - 0.45, dist);
      color.rgb *= mix(1.0 - vignetteStrength, 1.0, vig);

      // Dynamic film grain
      float grain = (rand(vUv * 100.0 + fract(time)) - 0.5) * filmGrainIntensity;
      color.rgb += grain;

      gl_FragColor = color;
    }
  `
};

export class PostProcessingManager {
  public composer: EffectComposer;
  private renderPass: RenderPass;
  private bloomPass: UnrealBloomPass;
  private cinematicPass: ShaderPass;
  public enabled: boolean = true;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    const size = new THREE.Vector2();
    renderer.getSize(size);

    this.composer = new EffectComposer(renderer);

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    // Subtle cinematic bloom at half resolution for smooth 60 FPS performance
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(Math.floor(size.x * 0.5), Math.floor(size.y * 0.5)),
      0.25,
      0.4,
      0.88
    );
    this.composer.addPass(this.bloomPass);

    // Cinematic Color Grading & Lens Shader Pass
    this.cinematicPass = new ShaderPass(CinematicShader);
    this.composer.addPass(this.cinematicPass);
  }

  public setQuality(quality: GraphicsQuality): void {
    if (quality === GraphicsQuality.LOW) {
      this.enabled = false;
    } else if (quality === GraphicsQuality.MEDIUM) {
      this.enabled = true;
      this.bloomPass.enabled = false; // Disable bloom on medium for performance
      this.cinematicPass.enabled = true;
    } else { // HIGH
      this.enabled = true;
      this.bloomPass.enabled = true;
      this.cinematicPass.enabled = true;
    }
  }

  public setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
    this.bloomPass.setSize(Math.floor(width * 0.5), Math.floor(height * 0.5));
  }

  public render(delta: number, time: number): void {
    if (this.enabled) {
      this.cinematicPass.uniforms.time.value = time;
      this.composer.render(delta);
    }
  }
}
