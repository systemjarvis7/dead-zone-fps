import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export interface PBRTextureMaps {
  albedo: THREE.Texture;
  arm?: THREE.Texture;
  normal?: THREE.Texture;
  ao?: THREE.Texture;
}

export interface ZombieInstance {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  headMesh: THREE.Object3D;
  skinnedMeshes: THREE.SkinnedMesh[];
}

export class AssetManager {
  private static instance: AssetManager;

  public isLoaded: boolean = false;
  public loadProgress: number = 0; // 0 to 1

  // Preloaded Models
  private models: Map<string, THREE.Group> = new Map();
  public zombieClips: THREE.AnimationClip[] = [];
  private zombieBaseGroup: THREE.Group | null = null;

  // Preloaded Materials & Textures
  public textures: Map<string, PBRTextureMaps> = new Map();
  public materials: Map<string, THREE.MeshStandardMaterial> = new Map();

  // Environment HDRI
  public environmentMap: THREE.Texture | null = null;

  // Loaders
  private gltfLoader: GLTFLoader;
  private rgbeLoader: RGBELoader;
  private exrLoader: EXRLoader;
  private textureLoader: THREE.TextureLoader;

  private constructor() {
    const manager = new THREE.LoadingManager();

    // Workaround for covered_car glTF referencing .jpg for normal map when on disk it's .exr
    manager.setURLModifier((url: string) => {
      if (url.includes('covered_car_nor_gl_2k.jpg')) {
        // Return 1x1 flat normal map data URI so GLTFLoader doesn't throw 404
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      }
      return url;
    });

    this.gltfLoader = new GLTFLoader(manager);
    this.rgbeLoader = new RGBELoader(manager);
    this.exrLoader = new EXRLoader(manager);
    this.textureLoader = new THREE.TextureLoader(manager);
  }

  public static getInstance(): AssetManager {
    if (!AssetManager.instance) {
      AssetManager.instance = new AssetManager();
    }
    return AssetManager.instance;
  }

  /**
   * Load all models, PBR textures, and HDRI in parallel with progress updates
   */
  public async loadAll(
    renderer: THREE.WebGLRenderer,
    onProgress?: (progress: number, label: string) => void
  ): Promise<void> {
    // 0. Top Priority: Immediately preload animated 3D Zombie Walker character so enemies never render as poly shapes
    try {
      const gltf = await this.gltfLoader.loadAsync('dead_zone_assets/models/zombie-walker.glb');
      this.zombieBaseGroup = gltf.scene;
      this.zombieClips = gltf.animations;
      this.zombieBaseGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => (m.envMapIntensity = 0.75));
            } else {
              child.material.envMapIntensity = 0.75;
            }
          }
        }
      });
      if (onProgress) onProgress(0.1, 'Zombie Walker 3D Mesh');
    } catch (e) {
      console.warn('Failed to preload primary zombie model:', e);
    }

    const assetTasks: { name: string; task: () => Promise<void> }[] = [];

    // 1. HDRI Environment Map
    assetTasks.push({
      name: 'Atmospheric HDRI',
      task: async () => {
        try {
          const texture = await this.rgbeLoader.loadAsync('dead_zone_assets/HDRI/neurathen_rock_castle_2k.hdr');
          texture.mapping = THREE.EquirectangularReflectionMapping;
          const pmremGenerator = new THREE.PMREMGenerator(renderer);
          pmremGenerator.compileEquirectangularShader();
          const envMap = pmremGenerator.fromEquirectangular(texture).texture;
          texture.dispose();
          pmremGenerator.dispose();
          this.environmentMap = envMap;
        } catch (e) {
          console.warn('Failed to load HDRI environment map:', e);
        }
      }
    });

    // 2. PBR Textures
    const textureDefs: { id: string; folder: string; prefix: string; hasExrNormal?: boolean }[] = [
      { id: 'asphalt', folder: 'asphalt', prefix: 'asphalt_02', hasExrNormal: true },
      { id: 'concrete', folder: 'concrete', prefix: 'white_stucco_02', hasExrNormal: true },
      { id: 'dirt_grass', folder: 'dirt grass', prefix: 'rocky_terrain_03', hasExrNormal: true },
      { id: 'plaster', folder: 'plaster', prefix: 'random_bricks_thick', hasExrNormal: true },
      { id: 'rust', folder: 'rust', prefix: 'rusty_metal_04', hasExrNormal: true },
      { id: 'wood', folder: 'wood', prefix: 'weathered_peeling_timber', hasExrNormal: true }
    ];

    for (const tDef of textureDefs) {
      assetTasks.push({
        name: `Texture: ${tDef.id}`,
        task: async () => {
          try {
            const basePath = `dead_zone_assets/textures/${tDef.folder}/textures/${tDef.prefix}`;
            
            // Diffuse / BaseColor (sRGB)
            const albedo = await this.textureLoader.loadAsync(`${basePath}_diff_2k.jpg`);
            albedo.colorSpace = THREE.SRGBColorSpace;
            albedo.wrapS = THREE.RepeatWrapping;
            albedo.wrapT = THREE.RepeatWrapping;

            // ARM (Ambient Occlusion = R, Roughness = G, Metalness = B)
            let arm: THREE.Texture | undefined;
            try {
              arm = await this.textureLoader.loadAsync(`${basePath}_arm_2k.jpg`);
              arm.wrapS = THREE.RepeatWrapping;
              arm.wrapT = THREE.RepeatWrapping;
            } catch {}

            // Fast hardware JPG AO map if available
            let ao: THREE.Texture | undefined;
            try {
              ao = await this.textureLoader.loadAsync(`${basePath}_ao_2k.jpg`);
              ao.wrapS = THREE.RepeatWrapping;
              ao.wrapT = THREE.RepeatWrapping;
            } catch {}

            this.textures.set(tDef.id, { albedo, arm, ao });

            // Create shared PBR standard material (lightning-fast, zero CPU EXR stall)
            const mat = new THREE.MeshStandardMaterial({
              map: albedo,
              roughnessMap: arm || null,
              metalnessMap: arm || null,
              aoMap: arm || ao || null,
              roughness: 0.85,
              metalness: 0.1
            });
            this.materials.set(tDef.id, mat);
          } catch (e) {
            console.warn(`Failed to load texture ${tDef.id}:`, e);
          }
        }
      });
    }

    // 3. 3D Models (World Props & Foliage)
    const modelDefs = [
      { id: 'car', path: 'dead_zone_assets/models/covered_car_2k/covered_car_2k.gltf' },
      { id: 'barrier', path: 'dead_zone_assets/models/concrete_road_barrier_2k.gltf/concrete_road_barrier_2k.gltf' },
      { id: 'stove', path: 'dead_zone_assets/models/barrel_stove_2k.gltf/barrel_stove_2k.gltf' },
      { id: 'gate', path: 'dead_zone_assets/models/large_iron_gate_2k.gltf/large_iron_gate_2k.gltf' },
      { id: 'pole', path: 'dead_zone_assets/models/modular_electricity_poles_2k.gltf/modular_electricity_poles_2k.gltf' },
      { id: 'shrub', path: 'dead_zone_assets/models/shrub_02_2k.gltf/shrub_02_2k.gltf' },
      { id: 'street_lamp', path: 'dead_zone_assets/models/street_lamp_01_2k.gltf/street_lamp_01_2k.gltf' },
      { id: 'utility_box', path: 'dead_zone_assets/models/utility_box_02_2k.gltf/utility_box_02_2k.gltf' }
    ];

    for (const mDef of modelDefs) {
      assetTasks.push({
        name: `Model: ${mDef.id}`,
        task: async () => {
          try {
            const gltf = await this.gltfLoader.loadAsync(mDef.path);
            const scene = gltf.scene;

            // Configure shadows & texture filtering per model
            const shouldCastShadow = mDef.id !== 'shrub';

            scene.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.castShadow = shouldCastShadow;
                child.receiveShadow = true;
                if (child.material) {
                  if (Array.isArray(child.material)) {
                    child.material.forEach(m => (m.envMapIntensity = 0.75));
                  } else {
                    child.material.envMapIntensity = 0.75;
                  }
                }
              }
            });

            if (mDef.id === 'pole') {
              // The electricity pole file has 103 modular loose parts and 3 presets stacked together.
              // Filter out duplicate loose clutter and keep only preset_02 pole parts.
              scene.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                  const isPreset2 = child.name.startsWith('preset_02') || child.name === 'pole';
                  child.visible = isPreset2;
                }
              });
            }

            this.models.set(mDef.id, scene);
          } catch (e) {
            console.warn(`Failed to load model ${mDef.id}:`, e);
          }
        }
      });
    }

    // Execute tasks in parallel batches for speed & progress reporting
    let completed = 0;
    const total = assetTasks.length;

    await Promise.all(
      assetTasks.map(async (t) => {
        await t.task();
        completed++;
        this.loadProgress = completed / total;
        if (onProgress) {
          onProgress(this.loadProgress, t.name);
        }
      })
    );

    this.isLoaded = true;
  }

  /**
   * Clone a static environment model
   */
  public getModelClone(id: string): THREE.Group | null {
    const base = this.models.get(id);
    if (!base) return null;
    const cloned = base.clone(true);
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return cloned;
  }

  /**
   * Instantiate an animated Zombie character using SkeletonUtils.clone
   */
  public createZombieInstance(): ZombieInstance | null {
    if (!this.zombieBaseGroup || this.zombieClips.length === 0) {
      return null;
    }

    // SkeletonUtils.clone ensures skinned meshes and skeleton bones are deeply cloned
    const root = SkeletonUtils.clone(this.zombieBaseGroup) as THREE.Group;
    const mixer = new THREE.AnimationMixer(root);
    const actions = new Map<string, THREE.AnimationAction>();

    for (const clip of this.zombieClips) {
      const action = mixer.clipAction(clip);
      actions.set(clip.name, action);
    }

    const skinnedMeshes: THREE.SkinnedMesh[] = [];
    let headBone: THREE.Object3D | null = null;

    root.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        skinnedMeshes.push(child);
      }
      if (/head/i.test(child.name) && !headBone) {
        headBone = child;
      }
    });

    // Invisible head hit detector mesh attached to head bone or top of character
    const headHitGeo = new THREE.SphereGeometry(0.24, 8, 8);
    const headHitMat = new THREE.MeshBasicMaterial({ visible: false });
    const headMesh = new THREE.Mesh(headHitGeo, headHitMat);
    headMesh.name = 'Head';

    if (headBone) {
      (headBone as THREE.Object3D).add(headMesh);
      headMesh.position.set(0, 0.08, 0);
    } else {
      headMesh.position.set(0, 1.68, 0);
      root.add(headMesh);
    }

    return {
      root,
      mixer,
      actions,
      headMesh,
      skinnedMeshes
    };
  }

  /**
   * Get a cloned PBR material with specific UV repeats
   */
  public getMaterial(id: string, repeatU: number = 1, repeatV: number = 1): THREE.MeshStandardMaterial | null {
    const maps = this.textures.get(id);
    if (!maps) return null;

    const albedoClone = maps.albedo.clone();
    albedoClone.repeat.set(repeatU, repeatV);
    albedoClone.needsUpdate = true;

    let armClone: THREE.Texture | undefined;
    if (maps.arm) {
      armClone = maps.arm.clone();
      armClone.repeat.set(repeatU, repeatV);
      armClone.needsUpdate = true;
    }

    let normalClone: THREE.Texture | undefined;
    if (maps.normal) {
      normalClone = maps.normal.clone();
      normalClone.repeat.set(repeatU, repeatV);
      normalClone.needsUpdate = true;
    }

    let aoClone: THREE.Texture | undefined;
    if (maps.ao) {
      aoClone = maps.ao.clone();
      aoClone.repeat.set(repeatU, repeatV);
      aoClone.needsUpdate = true;
    }

    return new THREE.MeshStandardMaterial({
      map: albedoClone,
      roughnessMap: armClone || null,
      metalnessMap: armClone || null,
      aoMap: armClone || aoClone || null,
      normalMap: normalClone || null,
      roughness: id === 'asphalt' ? 0.75 : id === 'rust' ? 0.6 : 0.88,
      metalness: id === 'rust' ? 0.65 : 0.1,
      envMapIntensity: 0.85
    });
  }
}
