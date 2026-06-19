
import * as THREE from 'three/webgpu';

export class Engine {
  public renderer: THREE.WebGPURenderer;
  public timer: THREE.Timer;
  public initialized = false;
  public initError: unknown = null;
  private initPromise: Promise<void> | null = null;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGPURenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight, false);

    // Ensure the canvas is sized by CSS so physical resizing is fluid
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';

    // Use default shadow map (PCF) as VSM support in WebGPU/NodeMaterial can be sensitive
    this.renderer.shadowMap.enabled = true;

    container.appendChild(this.renderer.domElement);
    this.timer = new THREE.Timer();
  }

  /** Initialize the GPU backend exactly once. Sets `initialized`; on failure records
   *  `initError` instead of throwing, so callers can fail gracefully (no retry loop). */
  public async init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      try {
        await this.renderer.init();
        this.initialized = true;
      } catch (e) {
        this.initError = e;
        console.error('Renderer initialization failed (WebGPU/WebGL2 unavailable):', e);
      }
    })();
    return this.initPromise;
  }

  public onResize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
  }

  public render(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    // Never render against an uninitialized backend — that re-triggers init every
    // frame and floods the console.
    if (!this.initialized) return;
    this.renderer.render(scene, camera);
  }

  public dispose() {
    this.renderer.dispose();
  }
}
