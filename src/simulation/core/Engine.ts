
import * as THREE from 'three/webgpu';

export class Engine {
  public renderer: THREE.WebGPURenderer;
  public timer: THREE.Timer;
  public initialized = false;
  public initError: unknown = null;
  /** True when the browser exposes no usable WebGPU adapter. AGORA's character sim
   *  runs on GPU compute (storage buffers via TSL) which is WebGPU-only — there is no
   *  WebGL2 fallback for this scene, so we must detect this and message the user
   *  rather than let three.js silently fall back to WebGL2 and render a blank frame. */
  public webgpuUnavailable = false;
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

  /** Returns true only if the browser can hand out a real WebGPU adapter (hardware OR
   *  software SwiftShader — both run the compute pipeline). `navigator.gpu` may exist
   *  while `requestAdapter()` still resolves to null (e.g. Linux Chrome with Vulkan
   *  disabled and no `--enable-unsafe-webgpu`), which is the silent-blank case. */
  static async hasWebGPUAdapter(): Promise<boolean> {
    try {
      const gpu = (navigator as any).gpu;
      if (!gpu) return false;
      const adapter = await gpu.requestAdapter();
      return !!adapter;
    } catch {
      return false;
    }
  }

  /** Initialize the GPU backend exactly once. Sets `initialized`; on failure records
   *  `initError` instead of throwing, so callers can fail gracefully (no retry loop). */
  public async init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      // Gate on a real adapter first — otherwise three.js silently downgrades to WebGL2,
      // init "succeeds", and the compute scene renders nothing (blank canvas, no error).
      if (!(await Engine.hasWebGPUAdapter())) {
        this.webgpuUnavailable = true;
        this.initError = new Error('No WebGPU adapter available');
        console.error(
          '[Engine] WebGPU adapter unavailable — AGORA needs WebGPU (GPU compute). ' +
          'Relaunch Chrome with --enable-unsafe-webgpu (or run ./run-agora.sh).'
        );
        return;
      }
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
