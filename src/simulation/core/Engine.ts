import * as THREE from 'three/webgpu';

const LOW_FPS = 20;

function glRendererName(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return '';
    return String(gl.getParameter((ext as WEBGL_debug_renderer_info).UNMASKED_RENDERER_WEBGL) ?? '');
  } catch {
    return '';
  }
}

function isSoftwareName(name: string): boolean {
  return /swiftshader|llvmpipe|softpipe|software/i.test(name);
}

export class Engine {
  public renderer: THREE.WebGPURenderer;
  public timer: THREE.Timer;
  public initialized = false;
  public initError: unknown = null;
  public flatOnly = false;
  public backendLabel = '…';
  public fps = 0;
  public lowQuality = false;
  private initPromise: Promise<void> | null = null;
  private badge: HTMLDivElement;
  private frames = 0;
  private windowStart = 0;
  private qualityChecked = false;
  private readonly forceWebGL: boolean;

  constructor(container: HTMLElement) {
    const params = new URLSearchParams(window.location.search);
    this.forceWebGL = params.get('renderer') === 'webgl';
    this.lowQuality = isSoftwareName(glRendererName());
    this.renderer = new THREE.WebGPURenderer({
      antialias: !this.lowQuality,
      forceWebGL: this.forceWebGL,
    });
    this.renderer.setPixelRatio(this.lowQuality ? 1 : window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.dataset.testid = 'office-canvas';
    this.renderer.shadowMap.enabled = !this.lowQuality;

    container.appendChild(this.renderer.domElement);
    this.badge = document.createElement('div');
    this.badge.dataset.testid = 'renderer-badge';
    this.badge.style.cssText = [
      'position:absolute', 'top:12px', 'left:12px', 'z-index:6', 'pointer-events:none',
      'padding:4px 10px', 'border-radius:999px', 'background:#fcfaf4', 'color:#17150f',
      'font:600 11px "Spline Sans Mono",ui-monospace,monospace',
      'box-shadow:0 1px 0 rgba(23,21,15,0.08)',
    ].join(';');
    container.appendChild(this.badge);
    this.timer = new THREE.Timer();
    this.publish();
  }

  static async hasWebGPUAdapter(): Promise<boolean> {
    try {
      const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
      if (!gpu) return false;
      return !!(await gpu.requestAdapter());
    } catch {
      return false;
    }
  }

  private hasWebGL2(): boolean {
    try {
      return !!document.createElement('canvas').getContext('webgl2');
    } catch {
      return false;
    }
  }

  public async init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      const webgpu = !this.forceWebGL && await Engine.hasWebGPUAdapter();
      if (!this.hasWebGL2() && !webgpu) {
        this.useFlat();
        return;
      }
      if (webgpu) await this.noteSoftwareAdapter();
      try {
        await this.renderer.init();
        this.initialized = true;
        const backend = this.renderer.backend as { isWebGPUBackend?: boolean };
        this.backendLabel = backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2';
        this.publish();
      } catch (error) {
        this.initError = error;
        this.useFlat();
      }
    })();
    return this.initPromise;
  }

  private async noteSoftwareAdapter() {
    try {
      const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<{ info?: { vendor?: string; architecture?: string; description?: string } } | null> } }).gpu;
      const adapter = await gpu?.requestAdapter();
      const info = adapter?.info;
      const text = `${info?.vendor ?? ''} ${info?.architecture ?? ''} ${info?.description ?? ''}`;
      if (isSoftwareName(text)) this.applyLowQuality();
    } catch {
      // The first two seconds of frames still drop the quality tier if the GPU is slow.
    }
  }

  private useFlat() {
    this.flatOnly = true;
    this.initialized = false;
    this.backendLabel = '2D';
    this.renderer.domElement.style.display = 'none';
    delete this.renderer.domElement.dataset.testid;
    this.publish();
  }

  public applyLowQuality() {
    if (this.lowQuality && this.renderer.getPixelRatio() === 1 && !this.renderer.shadowMap.enabled) return;
    this.lowQuality = true;
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = false;
    this.publish();
  }

  public noteFrame() {
    const now = performance.now();
    if (this.windowStart === 0) this.windowStart = now;
    this.frames += 1;
    const elapsed = now - this.windowStart;
    if (elapsed < 500) return;
    this.fps = (this.frames * 1000) / elapsed;
    if (!this.qualityChecked && elapsed >= 2000) {
      this.qualityChecked = true;
      if (this.fps < LOW_FPS) this.applyLowQuality();
    }
    this.publish();
  }

  private publish() {
    const quiet = this.lowQuality && this.backendLabel !== '2D';
    this.badge.textContent = quiet ? `${this.backendLabel} · low` : this.backendLabel;
    (window as unknown as { __AGORA_OFFICE?: { backend: string; fps: number; lowQuality: boolean } }).__AGORA_OFFICE = {
      backend: this.backendLabel,
      fps: Math.round(this.fps),
      lowQuality: this.lowQuality,
    };
  }

  public onResize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
  }

  public render(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    if (!this.initialized) return;
    this.noteFrame();
    this.renderer.render(scene, camera);
  }

  public dispose() {
    this.badge.remove();
    this.renderer.dispose();
  }
}
