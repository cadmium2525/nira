import * as THREE from 'three';
import type { Chive, Flight, Wind } from './simulation';

type Mode = 'select' | 'throw' | 'result';
type LeafView = {
  root: THREE.Group;
  leaf: THREE.Group;
  pick: THREE.Mesh;
  halo: THREE.Mesh;
  outline: THREE.Mesh;
  badge: THREE.Sprite;
  chive: Chive;
  restingY: number;
};

const IVORY = '#f6f3e9';
const ORANGE = '#ee843d';
const SKY = '#e5eddf';

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function roundedShape(width: number, depth: number, radius: number): THREE.Shape {
  const x = -width / 2, y = -depth / 2;
  const s = new THREE.Shape();
  s.moveTo(x + radius, y);
  s.lineTo(x + width - radius, y);
  s.quadraticCurveTo(x + width, y, x + width, y + radius);
  s.lineTo(x + width, y + depth - radius);
  s.quadraticCurveTo(x + width, y + depth, x + width - radius, y + depth);
  s.lineTo(x + radius, y + depth);
  s.quadraticCurveTo(x, y + depth, x, y + depth - radius);
  s.lineTo(x, y + radius);
  s.quadraticCurveTo(x, y, x + radius, y);
  return s;
}

/** The Three.js view is deliberately independent of the throwing rules. */
export class GameScene {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 450);
  private readonly selection = new THREE.Group();
  private readonly leaves = new THREE.Group();
  private readonly course = new THREE.Group();
  private readonly held = new THREE.Group();
  private readonly windSock = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly views = new Map<number, LeafView>();
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();
  private readonly textures = new Set<THREE.Texture>();
  private readonly cameraPosition = new THREE.Vector3();
  private readonly cameraTarget = new THREE.Vector3();
  private readonly currentTarget = new THREE.Vector3();
  private readonly trailPoints: THREE.Vector3[] = [];
  private readonly trailGeometry: THREE.BufferGeometry;
  private readonly trail: THREE.Line;
  private readonly aimGeometry: THREE.BufferGeometry;
  private readonly aimLine: THREE.Line;
  private readonly projectileShadow: THREE.Mesh;
  private readonly landingRing: THREE.Mesh;
  private readonly particles: THREE.Points;
  private readonly shadowTexture: THREE.CanvasTexture;
  private readonly haloTexture: THREE.CanvasTexture;
  private readonly woodTexture: THREE.CanvasTexture;
  private readonly rankTextures: THREE.CanvasTexture[];
  private readonly resizeObserver: ResizeObserver;
  private readonly onPick: (id: number) => void;
  private readonly container: HTMLElement;
  private board = new THREE.Group();
  private mode: Mode = 'select';
  private wind: Wind = { x: 0, forward: 0, speed: 0 };
  private flight: Flight | null = null;
  private selected: number[] = [];
  private chives: Chive[] = [];
  private heldChive: Chive | null = null;
  private aim = { side: 0, lift: 0.45, power: 0 };
  private portrait = false;
  private aspect = 1;
  private width = 1;
  private height = 1;
  private lastFlightTime = -1;
  private cameraSnap = true;
  private lost = false;
  private disposed = false;
  private downAt: { x: number; y: number } | null = null;

  constructor(container: HTMLElement, onPick: (id: number) => void) {
    this.container = container;
    this.onPick = onPick;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.renderer.domElement.className = 'game-canvas';
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(IVORY);
    this.scene.fog = new THREE.Fog(IVORY, 65, 170);
    this.scene.add(this.selection, this.course);
    this.selection.add(this.leaves);
    this.course.add(this.held);

    const hemisphere = new THREE.HemisphereLight('#fffbee', '#8b9973', 2.1);
    this.scene.add(hemisphere);
    const sun = new THREE.DirectionalLight('#fff4d8', 3.0);
    sun.position.set(-15, 27, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -22;
    sun.shadow.camera.right = 22;
    sun.shadow.camera.top = 25;
    sun.shadow.camera.bottom = -25;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 85;
    sun.shadow.normalBias = 0.03;
    sun.shadow.bias = -0.0002;
    sun.shadow.radius = 4;
    sun.target.position.set(0, 0, -6);
    this.scene.add(sun, sun.target);

    this.shadowTexture = this.radialTexture('rgba(45,55,26,.40)');
    this.haloTexture = this.radialTexture('rgba(243,143,61,.33)');
    this.woodTexture = this.makeWoodTexture();
    this.rankTextures = [this.makeRankTexture('1'), this.makeRankTexture('2')];

    this.makeCourse();
    this.projectileShadow = this.makePlane(2.6, 4.4, this.material(new THREE.MeshBasicMaterial({ map: this.shadowTexture, transparent: true, opacity: 0.32, depthWrite: false })));
    this.projectileShadow.position.y = 0.13;
    this.course.add(this.projectileShadow);

    this.landingRing = new THREE.Mesh(this.geometry(new THREE.RingGeometry(0.7, 0.77, 64)), this.material(new THREE.MeshBasicMaterial({ color: ORANGE, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false })));
    this.landingRing.rotation.x = -Math.PI / 2;
    this.landingRing.position.y = 0.15;
    this.landingRing.visible = false;
    this.course.add(this.landingRing);

    this.trailGeometry = this.geometry(new THREE.BufferGeometry());
    this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(48 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.trailGeometry.setDrawRange(0, 0);
    this.trail = new THREE.Line(this.trailGeometry, this.material(new THREE.LineBasicMaterial({ color: '#f5bc7d', transparent: true, opacity: 0.75, depthWrite: false })));
    this.trail.frustumCulled = false;
    this.course.add(this.trail);

    this.aimGeometry = this.geometry(new THREE.BufferGeometry());
    this.aimGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(25 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.aimLine = new THREE.Line(this.aimGeometry, this.material(new THREE.LineDashedMaterial({ color: ORANGE, dashSize: 0.19, gapSize: 0.19, transparent: true, opacity: 0.7, depthWrite: false })));
    this.aimLine.frustumCulled = false;
    this.course.add(this.aimLine);

    const particlePositions = new Float32Array(45 * 3);
    const rnd = seeded(8131);
    for (let i = 0; i < 45; i++) {
      particlePositions[i * 3] = (rnd() - 0.5) * 48;
      particlePositions[i * 3 + 1] = rnd() * 12 + 1;
      particlePositions[i * 3 + 2] = -rnd() * 110;
    }
    const particleGeometry = this.geometry(new THREE.BufferGeometry());
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    this.particles = new THREE.Points(particleGeometry, this.material(new THREE.PointsMaterial({ color: '#fffae6', size: 0.085, transparent: true, opacity: 0.8, depthWrite: false })));
    this.course.add(this.particles);

    container.addEventListener('pointerdown', this.pointerDown, { passive: true });
    container.addEventListener('pointerup', this.pointerUp, { passive: true });
    container.addEventListener('pointermove', this.pointerMove, { passive: true });
    container.addEventListener('pointerleave', this.pointerLeave, { passive: true });
    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.contextRestored);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.setMode('select');
  }

  setChives(chives: Chive[]): void {
    this.chives = chives;
    this.views.clear();
    this.releaseObject(this.leaves);
    this.leaves.clear();
    chives.forEach((chive) => {
      const root = new THREE.Group();
      const leaf = this.makeChive(chive);
      root.add(leaf);
      const pick = this.makePlane(1.18, 4.5 * chive.length, this.material(new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })));
      pick.position.y = 0.45;
      pick.userData.chiveId = chive.id;
      root.add(pick);
      const halo = this.makePlane(1.65, 5.0 * chive.length, this.material(new THREE.MeshBasicMaterial({ map: this.haloTexture, transparent: true, opacity: 0.8, depthWrite: false })));
      halo.position.y = 0.055;
      const outline = new THREE.Mesh(this.geometry(new THREE.RingGeometry(0.62, 0.64, 64)), this.material(new THREE.MeshBasicMaterial({ color: ORANGE, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })));
      outline.rotation.x = -Math.PI / 2;
      outline.scale.set(0.92, chive.length * 3.55, 1);
      outline.position.y = 0.06;
      const badge = new THREE.Sprite(this.material(new THREE.SpriteMaterial({ map: this.rankTextures[0], depthTest: false, depthWrite: false, transparent: true })));
      badge.scale.setScalar(0.63);
      badge.position.set(0.53, 0.5, 1.45 * chive.length);
      root.add(halo, outline, badge);
      halo.visible = outline.visible = badge.visible = false;
      this.views.set(chive.id, { root, leaf, pick, halo, outline, badge, chive, restingY: 0.01 });
      this.leaves.add(root);
    });
    this.layoutSelection();
    this.setSelected(this.selected);
  }

  setSelected(ids: number[]): void {
    this.selected = [...ids];
    for (const [id, view] of this.views) {
      const rank = ids.indexOf(id);
      const active = rank >= 0;
      view.halo.visible = view.outline.visible = view.badge.visible = active;
      if (active) {
        const material = view.badge.material as THREE.SpriteMaterial;
        material.map = this.rankTextures[Math.min(rank, 1)];
        material.needsUpdate = true;
      }
    }
  }

  setMode(mode: Mode): void {
    if (mode !== this.mode) this.cameraSnap = true;
    this.mode = mode;
    this.selection.visible = mode === 'select';
    this.course.visible = mode !== 'select';
    this.scene.background = new THREE.Color(mode === 'select' ? IVORY : SKY);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.set(mode === 'select' ? IVORY : SKY);
    this.container.style.cursor = mode === 'select' ? 'default' : '';
  }

  setWind(wind: Wind): void {
    this.wind = wind;
    this.windSock.rotation.y = Math.atan2(wind.forward, wind.x || 0.001);
  }

  setHeldChive(chive: Chive): void {
    if (this.heldChive?.id === chive.id && this.heldChive.seed === chive.seed) return;
    this.heldChive = chive;
    this.releaseObject(this.held);
    this.held.clear();
    const leaf = this.makeChive(chive);
    leaf.scale.setScalar(0.88);
    this.held.add(leaf);
  }

  setFlight(flight: Flight | null): void {
    const previous = this.flight;
    this.flight = flight;
    if (!flight || !previous || flight.time < this.lastFlightTime || (previous.landed && !flight.landed)) {
      this.trailPoints.length = 0;
      this.trailGeometry.setDrawRange(0, 0);
      this.lastFlightTime = -1;
      this.landingRing.visible = false;
    }
  }

  setAim(side: number, lift: number, power: number): void {
    this.aim.side = side;
    this.aim.lift = lift;
    this.aim.power = power;
  }

  update(dt: number, elapsed: number): void {
    if (this.disposed || this.lost) return;
    if (this.mode === 'select') {
      for (const [id, view] of this.views) {
        const active = this.selected.includes(id);
        const target = view.restingY + (active ? 0.18 : 0);
        view.leaf.position.y = THREE.MathUtils.damp(view.leaf.position.y, target, 10, dt);
        (view.outline.material as THREE.MeshBasicMaterial).opacity = 0.65 + Math.sin(elapsed * 2.2 + id) * 0.13;
        view.badge.position.y = 0.72 + (active ? Math.sin(elapsed * 2 + id) * 0.025 : 0);
      }
      this.selectionCamera();
    } else {
      this.updateCourse(dt, elapsed);
    }
    const blend = this.cameraSnap ? 1 : 1 - Math.exp(-dt * 4.8);
    this.camera.position.lerp(this.cameraPosition, blend);
    this.currentTarget.lerp(this.cameraTarget, blend);
    this.camera.lookAt(this.currentTarget);
    this.cameraSnap = false;
    this.renderer.render(this.scene, this.camera);
  }

  resize(): void {
    if (this.disposed) return;
    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.aspect = this.width / this.height;
    const nextPortrait = this.aspect < 0.85;
    const changed = nextPortrait !== this.portrait;
    this.portrait = nextPortrait;
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height, false);
    if (changed || this.board.children.length === 0) this.layoutSelection();
    this.cameraSnap = true;
  }

  getScreenshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resizeObserver.disconnect();
    this.container.removeEventListener('pointerdown', this.pointerDown);
    this.container.removeEventListener('pointerup', this.pointerUp);
    this.container.removeEventListener('pointermove', this.pointerMove);
    this.container.removeEventListener('pointerleave', this.pointerLeave);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.contextRestored);
    this.geometries.forEach(g => g.dispose());
    this.materials.forEach(m => m.dispose());
    this.textures.forEach(t => t.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private selectionCamera(): void {
    this.camera.fov = 35;
    this.camera.updateProjectionMatrix();
    const boardWidth = this.portrait ? 8.9 : 15.1;
    const boardDepth = this.portrait ? 12.4 : 7.9;
    const visibleHeight = Math.max((boardDepth * 0.79) / (this.portrait ? 0.44 : 0.39), boardWidth / (this.portrait ? 0.88 : 0.65) / this.aspect) * (this.portrait ? 1.08 : 1.075);
    const distance = visibleHeight / (2 * Math.tan(THREE.MathUtils.degToRad(35 / 2)));
    const targetZ = this.portrait ? -0.8 : -1.2;
    this.cameraTarget.set(0, 0, targetZ);
    this.cameraPosition.set(0, distance * 0.79, distance * 0.613 + targetZ);
  }

  private layoutSelection(): void {
    this.selection.remove(this.board);
    this.releaseObject(this.board);
    this.board = this.makeBoard(this.portrait ? 8.9 : 15.1, this.portrait ? 12.4 : 7.9);
    this.selection.add(this.board);
    const jitterX = [-0.25, 0.15, -0.1, 0.25, 0.15, -0.18, 0.25, -0.2];
    const jitterZ = [-0.32, 0.28, -0.16, 0.1, 0.2, -0.25, 0.1, -0.2];
    const angle = [-0.48, 0.25, -0.32, 0.5, 0.38, -0.44, 0.23, -0.34];
    this.chives.forEach((chive, index) => {
      const view = this.views.get(chive.id);
      if (!view) return;
      const columns = this.portrait ? 2 : 4;
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = (col - (columns - 1) / 2) * (this.portrait ? 3.45 : 3.3) + jitterX[index];
      const z = this.portrait ? (row - 1.5) * 2.65 : (row - 0.5) * 3.2;
      view.root.position.set(x, 0.18, z + jitterZ[index]);
      // A loose bunch, with room around every blade for a fingertip.
      const reverse = index === 1 || index === 4 || index === 7 ? Math.PI : 0;
      view.root.rotation.y = (this.portrait ? (index % 2 ? 0.4 : -0.42) + angle[index] * 0.25 : angle[index]) + reverse;
      view.root.scale.setScalar(this.portrait ? 0.78 : 0.78);
      view.leaf.position.y = view.restingY;
    });
  }

  private updateCourse(dt: number, elapsed: number): void {
    const flight = this.flight;
    const mobile = this.aspect < 0.85;
    const rear = mobile ? 24 : 18;
    this.camera.fov = mobile ? 58 : 45;
    this.camera.updateProjectionMatrix();
    this.windSock.rotation.z = Math.sin(elapsed * 3.4) * 0.045;
    this.windSock.rotation.x = Math.sin(elapsed * 2.6) * 0.035;
    this.particles.position.x = Math.sin(elapsed * 0.11) * this.wind.x * 0.8;
    this.particles.position.z = (elapsed * -0.18 * this.wind.forward) % 14;
    if (flight) {
      const z = -flight.distance;
      const follow = Math.min(1, flight.distance / 14);
      this.held.position.set(flight.x, Math.max(0.18, flight.y), z);
      const pitch = flight.landed ? 0.025 : Math.atan2(flight.vy, Math.hypot(flight.vx, flight.vz));
      const yaw = -Math.atan2(flight.vx, Math.max(0.1, flight.vz));
      this.held.rotation.set(pitch, yaw, flight.landed ? 0 : Math.sin(elapsed * 8) * 0.12);
      this.held.scale.setScalar(flight.landed ? 1 : 1 + Math.min(flight.y / 60, 0.12));
      this.aimLine.visible = false;
      this.projectileShadow.position.set(flight.x, 0.13, z);
      this.projectileShadow.rotation.y = yaw;
      this.projectileShadow.scale.setScalar(1 + Math.min(flight.y * 0.025, 0.8));
      (this.projectileShadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.07, 0.32 - flight.y * 0.008);
      if (!flight.landed && flight.time !== this.lastFlightTime) {
        const point = new THREE.Vector3(flight.x, flight.y, z);
        if (!this.trailPoints.length || this.trailPoints[this.trailPoints.length - 1].distanceToSquared(point) > 0.04) {
          this.trailPoints.push(point);
          if (this.trailPoints.length > 48) this.trailPoints.shift();
          const attr = this.trailGeometry.getAttribute('position') as THREE.BufferAttribute;
          this.trailPoints.forEach((p, i) => attr.setXYZ(i, p.x, p.y, p.z));
          attr.needsUpdate = true;
          this.trailGeometry.setDrawRange(0, this.trailPoints.length);
        }
      }
      this.lastFlightTime = flight.time;
      this.landingRing.visible = flight.landed;
      if (flight.landed) {
        this.landingRing.position.set(flight.x, 0.15, z);
        this.landingRing.scale.setScalar(1.2 + Math.sin(elapsed * 3) * 0.09);
        (this.landingRing.material as THREE.MeshBasicMaterial).color.set(flight.out ? '#d36b54' : ORANGE);
      }
      this.cameraPosition.set(flight.x * 0.24, (mobile ? 11 : 9) + Math.min(12, flight.y * 0.48), rear - Math.max(0, flight.distance - 10));
      this.cameraTarget.set(flight.x * 0.65, THREE.MathUtils.lerp(0.7, flight.y * 0.62, follow), THREE.MathUtils.lerp(-23, z - 9, follow));
    } else {
      this.held.position.set(0, 1.05 + Math.sin(elapsed * 2) * 0.035, 0);
      this.held.rotation.set(0.13 + this.aim.lift * 0.32, -this.aim.side * 0.5, -this.aim.side * 0.13);
      this.held.scale.setScalar(1);
      this.projectileShadow.position.set(0, 0.69, 0.8);
      this.projectileShadow.scale.setScalar(0.8);
      (this.projectileShadow.material as THREE.MeshBasicMaterial).opacity = 0.25;
      this.landingRing.visible = false;
      this.aimLine.visible = this.mode === 'throw';
      const attr = this.aimGeometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < 25; i++) {
        const t = i / 24;
        attr.setXYZ(i, this.aim.side * t * 5, 0.95 + Math.sin(t * Math.PI * 0.85) * (1.2 + this.aim.lift * 3), -t * (6 + this.aim.power * 3));
      }
      attr.needsUpdate = true;
      this.aimLine.computeLineDistances();
      (this.aimLine.material as THREE.LineDashedMaterial).opacity = 0.28 + this.aim.power * 0.55;
      this.cameraPosition.set(0, mobile ? 11 : 9, rear);
      this.cameraTarget.set(0, 0.7, -23);
    }
    void dt;
  }

  private makeChive(chive: Chive): THREE.Group {
    const root = new THREE.Group();
    const length = 4.1 * chive.length;
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const green = new THREE.Color(chive.color);
    const pale = new THREE.Color('#e5e8bd');
    const white = new THREE.Color('#fff6d7');
    const rnd = seeded(chive.seed);
    const lean = chive.bend * 2.4 + (rnd() - 0.5) * 0.15;
    const curl = 0.06 + rnd() * 0.16;
    const count = 36;
    // A very thin, flattened ribbon: white cut base, broad blade, pointed tip.
    for (let layer = 0; layer < 2; layer++) {
      for (let i = 0; i <= count; i++) {
        const t = i / count;
        const width = (0.092 + Math.sin(Math.PI * Math.min(1, t * 1.06)) * 0.095) * Math.pow(1 - t, 0.25) + 0.002;
        const centerX = lean * Math.pow(t, 2.2) + Math.sin(t * Math.PI * 1.8) * 0.035;
        const centerY = 0.05 + Math.sin(t * Math.PI) * 0.09 + Math.pow(t, 6) * curl;
        for (let j = 0; j < 3; j++) {
          const side = j - 1;
          positions.push(centerX + side * width, centerY + (layer === 0 ? 0.017 + (j === 1 ? 0.022 : 0) : -0.016), length * (0.5 - t));
          const color = t < 0.07 ? white.clone().lerp(pale, t / 0.07) : t < 0.21 ? pale.clone().lerp(green, (t - 0.07) / 0.14) : green.clone();
          const highlight = j === 1 ? 1.12 : j === 0 ? 0.88 : 1.02;
          color.multiplyScalar(highlight * (1 - t * 0.10));
          colors.push(color.r, color.g, color.b);
        }
      }
    }
    const stride = (count + 1) * 3;
    for (let layer = 0; layer < 2; layer++) {
      for (let i = 0; i < count; i++) {
        for (let j = 0; j < 2; j++) {
          const a = layer * stride + i * 3 + j;
          if (layer === 0) indices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
          else indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
        }
      }
    }
    for (let i = 0; i < count; i++) {
      const a = i * 3, b = a + 3;
      indices.push(a, b, a + stride, b, b + stride, a + stride);
      indices.push(a + 2, a + stride + 2, b + 2, b + 2, a + stride + 2, b + stride + 2);
    }
    indices.push(0, stride, 1, 1, stride, stride + 1, 1, stride + 1, 2, 2, stride + 1, stride + 2);
    const geometry = this.geometry(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const blade = new THREE.Mesh(geometry, this.material(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.52, metalness: 0, side: THREE.DoubleSide })));
    blade.castShadow = true;
    blade.receiveShadow = true;
    root.add(blade);
    const veinPositions: number[] = [];
    for (let i = 4; i <= count; i++) {
      const t = i / count;
      veinPositions.push(lean * Math.pow(t, 2.2) + Math.sin(t * Math.PI * 1.8) * 0.035, 0.091 + Math.sin(t * Math.PI) * 0.09 + Math.pow(t, 6) * curl, length * (0.5 - t));
    }
    const veinGeometry = this.geometry(new THREE.BufferGeometry());
    veinGeometry.setAttribute('position', new THREE.Float32BufferAttribute(veinPositions, 3));
    root.add(new THREE.Line(veinGeometry, this.material(new THREE.LineBasicMaterial({ color: '#b2cf74', transparent: true, opacity: 0.25 }))));
    return root;
  }

  private makeBoard(width: number, depth: number): THREE.Group {
    const board = new THREE.Group();
    const shadow = this.makePlane(width + 1.4, depth + 1.5, this.material(new THREE.MeshBasicMaterial({ map: this.shadowTexture, transparent: true, opacity: 0.28, depthWrite: false })));
    shadow.position.set(0.25, -0.25, 0.27);
    board.add(shadow);
    const geometry = this.geometry(new THREE.ExtrudeGeometry(roundedShape(width, depth, 0.58), { depth: 0.29, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.08, bevelThickness: 0.07, curveSegments: 12 }));
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, -0.18, 0);
    const base = new THREE.Mesh(geometry, this.material(new THREE.MeshStandardMaterial({ color: '#cda570', roughness: 0.84 })));
    base.castShadow = true;
    base.receiveShadow = true;
    board.add(base);
    const topGeometry = this.geometry(new THREE.ShapeGeometry(roundedShape(width - 0.28, depth - 0.28, 0.45), 16));
    const uv = topGeometry.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / width + 0.5, uv.getY(i) / depth + 0.5);
    topGeometry.rotateX(-Math.PI / 2);
    const top = new THREE.Mesh(topGeometry, this.material(new THREE.MeshStandardMaterial({ map: this.woodTexture, roughness: 0.76, color: '#fff1da' })));
    top.position.y = 0.185;
    top.receiveShadow = true;
    board.add(top);
    // An inset lip keeps the tray readable without a heavy frame.
    const edge = roundedShape(width - 0.15, depth - 0.15, 0.5);
    const linePoints = edge.getPoints(40).map(p => new THREE.Vector3(p.x, 0.196, -p.y));
    const edgeGeometry = this.geometry(new THREE.BufferGeometry().setFromPoints(linePoints));
    board.add(new THREE.LineLoop(edgeGeometry, this.material(new THREE.LineBasicMaterial({ color: '#d2ae79', transparent: true, opacity: 0.5 }))));
    return board;
  }

  private makeCourse(): void {
    const grass = this.material(new THREE.MeshStandardMaterial({ color: '#b8c58e', roughness: 1 }));
    const ground = this.makePlane(550, 550, grass);
    ground.position.set(0, -0.065, -95);
    ground.receiveShadow = true;
    this.course.add(ground);
    const laneMaterial = this.material(new THREE.MeshStandardMaterial({ color: '#96b46b', roughness: 1 }));
    const lane = this.makePlane(12, 220, laneMaterial);
    lane.position.set(0, 0.015, -106);
    lane.receiveShadow = true;
    this.course.add(lane);
    const stripeMaterial = this.material(new THREE.MeshStandardMaterial({ color: '#9fb970', roughness: 1 }));
    for (let i = 0; i < 11; i++) {
      const stripe = this.makePlane(11.85, 10, stripeMaterial);
      stripe.position.set(0, 0.025, -i * 20 - 8);
      stripe.receiveShadow = true;
      this.course.add(stripe);
    }
    const chalk = this.material(new THREE.MeshBasicMaterial({ color: '#fff9df' }));
    for (const x of [-6, 6]) {
      const boundary = this.makePlane(0.14, 220, chalk);
      boundary.position.set(x, 0.045, -106);
      this.course.add(boundary);
    }
    const tickMaterial = this.material(new THREE.MeshBasicMaterial({ color: '#f0efd3', transparent: true, opacity: 0.48 }));
    for (let distance = 10; distance <= 160; distance += 10) {
      const tick = this.makePlane(12, 0.055, tickMaterial);
      tick.position.set(0, 0.05, -distance);
      this.course.add(tick);
      if (distance <= 120) {
        const marker = this.makeGroundLabel(`${distance}`, '#f7f3dc');
        marker.position.set(-7.3, 0.065, -distance);
        this.course.add(marker);
      }
    }
    const stageGeometry = this.geometry(new THREE.ExtrudeGeometry(roundedShape(15.2, 6.5, 0.28), { depth: 0.58, bevelEnabled: true, bevelSegments: 1, bevelSize: 0.06, bevelThickness: 0.05, steps: 1 }));
    stageGeometry.rotateX(-Math.PI / 2);
    const stage = new THREE.Mesh(stageGeometry, this.material(new THREE.MeshStandardMaterial({ color: '#bd9260', roughness: 0.85 })));
    stage.position.set(0, -0.05, 4.15);
    stage.receiveShadow = stage.castShadow = true;
    this.course.add(stage);
    const plankMat = this.material(new THREE.MeshStandardMaterial({ color: '#dbb788', roughness: 0.8 }));
    const plankGeometry = this.geometry(new THREE.BoxGeometry(15.12, 0.07, 0.86));
    for (let i = 0; i < 7; i++) {
      const plank = new THREE.Mesh(plankGeometry, plankMat);
      plank.position.set(0, 0.59, 1.38 + i * 0.92);
      plank.receiveShadow = true;
      this.course.add(plank);
    }
    const launchLine = this.makePlane(11.9, 0.13, chalk);
    launchLine.position.set(0, 0.64, 1.01);
    this.course.add(launchLine);
    this.makeTrees();
    this.makeMountains();
    this.makeClouds();
    this.makeWindsock();
  }

  private makeTrees(): void {
    const rnd = seeded(61623);
    const count = 42;
    const trunkGeometry = this.geometry(new THREE.CylinderGeometry(0.17, 0.25, 1, 6));
    const crownGeometry = this.geometry(new THREE.IcosahedronGeometry(1, 1));
    const trunks = new THREE.InstancedMesh(trunkGeometry, this.material(new THREE.MeshStandardMaterial({ color: '#9e8c61', roughness: 1 })), count);
    const crowns = new THREE.InstancedMesh(crownGeometry, this.material(new THREE.MeshStandardMaterial({ color: '#729865', roughness: 1, flatShading: true })), count * 2);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (12 + rnd() * 28);
      const z = -4 - rnd() * 165;
      const size = 1.3 + rnd() * 1.9;
      dummy.position.set(x, size * 0.9, z);
      dummy.scale.set(1, size * 1.8, 1);
      dummy.rotation.set(0, rnd() * Math.PI, 0);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      for (let j = 0; j < 2; j++) {
        dummy.position.set(x + (j ? size * 0.43 : -size * 0.25), size * (j ? 2 : 2.7), z + j * size * 0.3);
        dummy.scale.set(size * (j ? 0.85 : 1), size * (j ? 0.9 : 1.13), size * 0.92);
        dummy.updateMatrix();
        crowns.setMatrixAt(i * 2 + j, dummy.matrix);
        color.setHSL(0.24 + rnd() * 0.06, 0.18 + rnd() * 0.1, 0.36 + rnd() * 0.09);
        crowns.setColorAt(i * 2 + j, color);
      }
    }
    trunks.castShadow = crowns.castShadow = true;
    trunks.receiveShadow = crowns.receiveShadow = true;
    this.course.add(trunks, crowns);
    const grassGeometry = this.geometry(new THREE.ConeGeometry(0.22, 0.95, 3));
    const tufts = new THREE.InstancedMesh(grassGeometry, this.material(new THREE.MeshStandardMaterial({ color: '#91a46c', roughness: 1 })), 65);
    for (let i = 0; i < 65; i++) {
      const s = 0.3 + rnd() * 0.6;
      dummy.position.set((i % 2 ? 1 : -1) * (7.8 + rnd() * 23), 0.35 * s, -rnd() * 130);
      dummy.rotation.set(0, rnd() * Math.PI, (rnd() - 0.5) * 0.3);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      tufts.setMatrixAt(i, dummy.matrix);
    }
    this.course.add(tufts);
  }

  private makeMountains(): void {
    const rnd = seeded(36712);
    const geometry = this.geometry(new THREE.ConeGeometry(1, 1, 5, 1));
    const material = this.material(new THREE.MeshStandardMaterial({ color: '#a4b79a', roughness: 1, flatShading: true }));
    const mountains = new THREE.InstancedMesh(geometry, material, 14);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 14; i++) {
      const h = 15 + rnd() * 19;
      dummy.position.set(-150 + i * 24, h * 0.32 - 4, -185 - rnd() * 20);
      dummy.scale.set(25 + rnd() * 20, h, 26);
      dummy.rotation.y = rnd() * Math.PI;
      dummy.updateMatrix();
      mountains.setMatrixAt(i, dummy.matrix);
    }
    this.course.add(mountains);
  }

  private makeClouds(): void {
    const rnd = seeded(270);
    const geometry = this.geometry(new THREE.SphereGeometry(1, 12, 8));
    const material = this.material(new THREE.MeshBasicMaterial({ color: '#f8f6e9', fog: false, transparent: true, opacity: 0.72 }));
    const clouds = new THREE.InstancedMesh(geometry, material, 20);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 20; i++) {
      const cluster = Math.floor(i / 4);
      dummy.position.set(-78 + cluster * 36 + (i % 4) * 7, 29 + (cluster % 2) * 13 + rnd() * 2, -120 - cluster * 10);
      dummy.scale.set(7 + rnd() * 5, 2.0 + rnd() * 1.3, 3 + rnd() * 3);
      dummy.updateMatrix();
      clouds.setMatrixAt(i, dummy.matrix);
    }
    this.course.add(clouds);
  }

  private makeWindsock(): void {
    const pole = new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(0.055, 0.075, 5.5, 8)), this.material(new THREE.MeshStandardMaterial({ color: '#f7f1d8', roughness: 0.6 })));
    pole.position.set(8.4, 2.75, -3.5);
    pole.castShadow = true;
    this.course.add(pole);
    this.windSock.position.set(8.4, 5.35, -3.5);
    const geometry = this.geometry(new THREE.CylinderGeometry(0.14, 0.38, 2.3, 12, 10, true));
    geometry.rotateZ(-Math.PI / 2);
    geometry.translate(1.15, 0, 0);
    const attr = geometry.getAttribute('position');
    const colors: number[] = [];
    const orange = new THREE.Color('#ed894d');
    const cream = new THREE.Color('#fff5dc');
    for (let i = 0; i < attr.count; i++) {
      const color = Math.floor((attr.getX(i) + 0.001) / 0.46) % 2 ? cream : orange;
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const sock = new THREE.Mesh(geometry, this.material(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 })));
    sock.rotation.z = -0.1;
    const collar = new THREE.Mesh(this.geometry(new THREE.TorusGeometry(0.38, 0.025, 6, 24)), this.material(new THREE.MeshStandardMaterial({ color: '#eee8d0' })));
    collar.rotation.y = Math.PI / 2;
    this.windSock.add(sock, collar);
    this.course.add(this.windSock);
  }

  private makeGroundLabel(label: string, color: string): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.font = '600 67px Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 64, 51);
    const texture = this.texture(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    return this.makePlane(1.9, 1.42, this.material(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })));
  }

  private makeRankTexture(label: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = ORANGE;
    ctx.beginPath(); ctx.arc(64, 64, 52, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff8e9'; ctx.lineWidth = 5; ctx.stroke();
    ctx.fillStyle = '#fffaf0';
    ctx.font = '700 57px Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 64, 68);
    const texture = this.texture(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private radialTexture(color: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 63);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.4, color);
    gradient.addColorStop(1, color.replace(/,[^,]*\)$/, ',0)'));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const texture = this.texture(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private makeWoodTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#e8cca0'; ctx.fillRect(0, 0, 1024, 512);
    const rnd = seeded(383116);
    for (let i = 0; i < 480; i++) {
      const y = rnd() * 512;
      const depth = rnd();
      ctx.strokeStyle = depth > 0.5 ? `rgba(150,110,57,${0.025 + rnd() * 0.045})` : `rgba(255,246,218,${0.08 + rnd() * 0.12})`;
      ctx.lineWidth = 0.6 + rnd() * 1.8;
      ctx.beginPath(); ctx.moveTo(-10, y);
      for (let x = 0; x <= 1050; x += 70) ctx.lineTo(x, y + Math.sin(x / 150 + i * 0.5) * (0.6 + rnd() * 3));
      ctx.stroke();
    }
    for (let i = 1; i < 6; i++) {
      ctx.fillStyle = 'rgba(134,98,49,.055)';
      ctx.fillRect(0, i * 85, 1024, 1);
    }
    const texture = this.texture(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  private makePlane(width: number, depth: number, material: THREE.Material): THREE.Mesh {
    const geometry = this.geometry(new THREE.PlaneGeometry(width, depth));
    geometry.rotateX(-Math.PI / 2);
    return new THREE.Mesh(geometry, material);
  }

  private geometry<T extends THREE.BufferGeometry>(geometry: T): T {
    this.geometries.add(geometry); return geometry;
  }

  private material<T extends THREE.Material>(material: T): T {
    this.materials.add(material); return material;
  }

  private texture<T extends THREE.Texture>(texture: T): T {
    this.textures.add(texture); return texture;
  }

  private releaseObject(root: THREE.Object3D): void {
    root.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry && this.geometries.has(mesh.geometry)) { mesh.geometry.dispose(); this.geometries.delete(mesh.geometry); }
      if (mesh.material) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach(material => {
          if (this.materials.has(material)) { material.dispose(); this.materials.delete(material); }
        });
      }
    });
  }

  private hitAt(clientX: number, clientY: number): number | null {
    if (this.mode !== 'select') return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(Array.from(this.views.values()).map(v => v.pick), false);
    return hits.length ? hits[0].object.userData.chiveId as number : null;
  }

  private pointerDown = (event: PointerEvent): void => {
    this.downAt = { x: event.clientX, y: event.clientY };
  };

  private pointerUp = (event: PointerEvent): void => {
    if (!this.downAt || Math.hypot(event.clientX - this.downAt.x, event.clientY - this.downAt.y) > 16) return;
    this.downAt = null;
    const hit = this.hitAt(event.clientX, event.clientY);
    if (hit !== null) this.onPick(hit);
  };

  private pointerMove = (event: PointerEvent): void => {
    if (this.mode === 'select' && event.pointerType !== 'touch') this.container.style.cursor = this.hitAt(event.clientX, event.clientY) !== null ? 'pointer' : 'default';
  };

  private pointerLeave = (): void => { this.downAt = null; };
  private contextLost = (event: Event): void => {
    event.preventDefault(); this.lost = true;
    this.container.dispatchEvent(new CustomEvent('gamecontextlost', { bubbles: true }));
  };
  private contextRestored = (): void => {
    this.lost = false; this.cameraSnap = true;
    this.container.dispatchEvent(new CustomEvent('gamecontextrestored', { bubbles: true }));
  };
}
