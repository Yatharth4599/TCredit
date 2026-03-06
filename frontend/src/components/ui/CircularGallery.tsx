import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from 'ogl'
import { useEffect, useRef } from 'react'
import css from './CircularGallery.module.css'

type GL = Renderer['gl']

function lerp(p1: number, p2: number, t: number): number {
  return p1 + (p2 - p1) * t
}

function getFontSize(font: string): number {
  const match = font.match(/(\d+)px/)
  return match ? parseInt(match[1], 10) : 30
}

function createTextTexture(
  gl: GL,
  text: string,
  font = 'bold 30px monospace',
  color = 'white'
): { texture: Texture; width: number; height: number } {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  ctx.font = font
  const metrics = ctx.measureText(text)
  const textWidth = Math.ceil(metrics.width)
  const fontSize = getFontSize(font)
  const textHeight = Math.ceil(fontSize * 1.2)
  canvas.width = textWidth + 20
  canvas.height = textHeight + 20
  ctx.font = font
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)
  const texture = new Texture(gl, { generateMipmaps: false })
  texture.image = canvas
  return { texture, width: canvas.width, height: canvas.height }
}

class Title {
  mesh!: Mesh
  constructor({ gl, plane, renderer, text, textColor = '#ffffff', font = '30px sans-serif' }: {
    gl: GL; plane: Mesh; renderer: Renderer; text: string; textColor?: string; font?: string
  }) {
    void renderer
    const { texture, width, height } = createTextTexture(gl, text, font, textColor)
    const geometry = new Plane(gl)
    const program = new Program(gl, {
      vertex: `attribute vec3 position;attribute vec2 uv;uniform mat4 modelViewMatrix;uniform mat4 projectionMatrix;varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragment: `precision highp float;uniform sampler2D tMap;varying vec2 vUv;void main(){vec4 color=texture2D(tMap,vUv);if(color.a<0.1)discard;gl_FragColor=color;}`,
      uniforms: { tMap: { value: texture } },
      transparent: true,
    })
    this.mesh = new Mesh(gl, { geometry, program })
    const aspect = width / height
    const textH = plane.scale.y * 0.15
    const textW = textH * aspect
    this.mesh.scale.set(textW, textH, 1)
    this.mesh.position.y = -plane.scale.y * 0.5 - textH * 0.5 - 0.05
    this.mesh.setParent(plane)
  }
}

interface Viewport { width: number; height: number }
interface ScreenSize { width: number; height: number }

class Media {
  extra = 0
  speed = 0
  isBefore = false
  isAfter = false
  scale!: number
  padding!: number
  width!: number
  widthTotal!: number
  x!: number
  plane!: Mesh
  program!: Program
  title!: Title

  constructor(private cfg: {
    geometry: Plane; gl: GL; image: string; index: number; length: number
    renderer: Renderer; scene: Transform; screen: ScreenSize; text: string
    viewport: Viewport; bend: number; textColor: string; borderRadius: number; font?: string
  }) {
    this.createShader()
    this.createMesh()
    this.createTitle()
    this.onResize()
  }

  createShader() {
    const texture = new Texture(this.cfg.gl, { generateMipmaps: true })
    this.program = new Program(this.cfg.gl, {
      depthTest: false,
      depthWrite: false,
      vertex: `precision highp float;attribute vec3 position;attribute vec2 uv;uniform mat4 modelViewMatrix;uniform mat4 projectionMatrix;uniform float uTime;uniform float uSpeed;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;p.z=(sin(p.x*4.0+uTime)*1.5+cos(p.y*2.0+uTime)*1.5)*(0.1+uSpeed*0.5);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
      fragment: `precision highp float;uniform vec2 uImageSizes;uniform vec2 uPlaneSizes;uniform sampler2D tMap;uniform float uBorderRadius;varying vec2 vUv;float roundedBoxSDF(vec2 p,vec2 b,float r){vec2 d=abs(p)-b;return length(max(d,vec2(0.0)))+min(max(d.x,d.y),0.0)-r;}void main(){vec2 ratio=vec2(min((uPlaneSizes.x/uPlaneSizes.y)/(uImageSizes.x/uImageSizes.y),1.0),min((uPlaneSizes.y/uPlaneSizes.x)/(uImageSizes.y/uImageSizes.x),1.0));vec2 uv=vec2(vUv.x*ratio.x+(1.0-ratio.x)*0.5,vUv.y*ratio.y+(1.0-ratio.y)*0.5);vec4 color=texture2D(tMap,uv);float d=roundedBoxSDF(vUv-0.5,vec2(0.5-uBorderRadius),uBorderRadius);float edgeSmooth=0.002;float alpha=1.0-smoothstep(-edgeSmooth,edgeSmooth,d);gl_FragColor=vec4(color.rgb,alpha);}`,
      uniforms: {
        tMap: { value: texture },
        uPlaneSizes: { value: [0, 0] },
        uImageSizes: { value: [0, 0] },
        uSpeed: { value: 0 },
        uTime: { value: 100 * Math.random() },
        uBorderRadius: { value: this.cfg.borderRadius },
      },
      transparent: true,
    })
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = this.cfg.image
    img.onload = () => {
      texture.image = img
      this.program.uniforms.uImageSizes.value = [img.naturalWidth, img.naturalHeight]
    }
  }

  createMesh() {
    this.plane = new Mesh(this.cfg.gl, { geometry: this.cfg.geometry, program: this.program })
    this.plane.setParent(this.cfg.scene)
  }

  createTitle() {
    this.title = new Title({
      gl: this.cfg.gl, plane: this.plane, renderer: this.cfg.renderer,
      text: this.cfg.text, textColor: this.cfg.textColor, font: this.cfg.font,
    })
  }

  update(scroll: { current: number; last: number }, direction: 'right' | 'left') {
    this.plane.position.x = this.x - scroll.current - this.extra
    const x = this.plane.position.x
    const H = this.cfg.viewport.width / 2

    if (this.cfg.bend === 0) {
      this.plane.position.y = 0
      this.plane.rotation.z = 0
    } else {
      const B_abs = Math.abs(this.cfg.bend)
      const R = (H * H + B_abs * B_abs) / (2 * B_abs)
      const effectiveX = Math.min(Math.abs(x), H)
      const arc = R - Math.sqrt(R * R - effectiveX * effectiveX)
      if (this.cfg.bend > 0) {
        this.plane.position.y = -arc
        this.plane.rotation.z = -Math.sign(x) * Math.asin(effectiveX / R)
      } else {
        this.plane.position.y = arc
        this.plane.rotation.z = Math.sign(x) * Math.asin(effectiveX / R)
      }
    }

    this.speed = scroll.current - scroll.last
    this.program.uniforms.uTime.value += 0.04
    this.program.uniforms.uSpeed.value = this.speed

    const planeOffset = this.plane.scale.x / 2
    const vpOffset = this.cfg.viewport.width / 2
    this.isBefore = this.plane.position.x + planeOffset < -vpOffset
    this.isAfter = this.plane.position.x - planeOffset > vpOffset
    if (direction === 'right' && this.isBefore) { this.extra -= this.widthTotal; this.isBefore = this.isAfter = false }
    if (direction === 'left' && this.isAfter) { this.extra += this.widthTotal; this.isBefore = this.isAfter = false }
  }

  onResize({ screen, viewport }: { screen?: ScreenSize; viewport?: Viewport } = {}) {
    if (screen) Object.assign(this.cfg, { screen })
    if (viewport) {
      Object.assign(this.cfg, { viewport })
      if (this.plane.program.uniforms.uViewportSizes) {
        this.plane.program.uniforms.uViewportSizes.value = [this.cfg.viewport.width, this.cfg.viewport.height]
      }
    }
    this.scale = this.cfg.screen.height / 1500
    this.plane.scale.y = (this.cfg.viewport.height * (900 * this.scale)) / this.cfg.screen.height
    this.plane.scale.x = (this.cfg.viewport.width * (700 * this.scale)) / this.cfg.screen.width
    this.program.uniforms.uPlaneSizes.value = [this.plane.scale.x, this.plane.scale.y]
    this.padding = 2
    this.width = this.plane.scale.x + this.padding
    this.widthTotal = this.width * this.cfg.length
    this.x = this.width * this.cfg.index
  }
}

class App {
  container: HTMLElement
  scrollSpeed: number
  scroll: { ease: number; current: number; target: number; last: number; position?: number }
  renderer!: Renderer
  gl!: GL
  camera!: Camera
  scene!: Transform
  planeGeometry!: Plane
  medias: Media[] = []
  screen!: ScreenSize
  viewport!: Viewport
  raf = 0
  autoScrollRaf = 0
  autoScrollSpeed: number
  paused = false

  private onResizeBound!: () => void
  private onWheelBound!: (e: Event) => void
  private onTouchDownBound!: (e: MouseEvent | TouchEvent) => void
  private onTouchMoveBound!: (e: MouseEvent | TouchEvent) => void
  private onTouchUpBound!: () => void
  isDown = false
  start = 0

  constructor(
    container: HTMLElement,
    { items, bend = 1, textColor = '#ffffff', borderRadius = 0, font = 'bold 30px sans-serif', scrollSpeed = 2, scrollEase = 0.05, autoScrollSpeed = 0.5 }:
      { items?: { image: string; text: string }[]; bend?: number; textColor?: string; borderRadius?: number; font?: string; scrollSpeed?: number; scrollEase?: number; autoScrollSpeed?: number }
  ) {
    this.container = container
    this.scrollSpeed = scrollSpeed
    this.autoScrollSpeed = autoScrollSpeed
    this.scroll = { ease: scrollEase, current: 0, target: 0, last: 0 }
    this.createRenderer()
    this.createCamera()
    this.createScene()
    this.onResize()
    this.createGeometry()
    this.createMedias(items ?? [], bend, textColor, borderRadius, font)
    this.update()
    this.autoScroll()
    this.addEventListeners()
  }

  createRenderer() {
    this.renderer = new Renderer({ alpha: true, antialias: true, dpr: Math.min(window.devicePixelRatio || 1, 2) })
    this.gl = this.renderer.gl
    this.gl.clearColor(0, 0, 0, 0)
    this.container.appendChild(this.renderer.gl.canvas as HTMLCanvasElement)
  }

  createCamera() {
    this.camera = new Camera(this.gl)
    this.camera.fov = 45
    this.camera.position.z = 20
  }

  createScene() { this.scene = new Transform() }

  createGeometry() {
    this.planeGeometry = new Plane(this.gl, { heightSegments: 50, widthSegments: 100 })
  }

  createMedias(items: { image: string; text: string }[], bend: number, textColor: string, borderRadius: number, font: string) {
    const doubled = [...items, ...items]
    this.medias = doubled.map((data, index) => new Media({
      geometry: this.planeGeometry, gl: this.gl, image: data.image,
      index, length: doubled.length, renderer: this.renderer,
      scene: this.scene, screen: this.screen, text: data.text,
      viewport: this.viewport, bend, textColor, borderRadius, font,
    }))
  }

  autoScroll() {
    const tick = () => {
      if (!this.paused) this.scroll.target += this.autoScrollSpeed * 0.01
      this.autoScrollRaf = window.requestAnimationFrame(tick)
    }
    this.autoScrollRaf = window.requestAnimationFrame(tick)
  }

  onTouchDown(e: MouseEvent | TouchEvent) {
    this.isDown = true
    this.paused = true
    this.scroll.position = this.scroll.current
    this.start = 'touches' in e ? e.touches[0].clientX : e.clientX
  }

  onTouchMove(e: MouseEvent | TouchEvent) {
    if (!this.isDown) return
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX
    this.scroll.target = (this.scroll.position ?? 0) + (this.start - x) * (this.scrollSpeed * 0.025)
  }

  onTouchUp() {
    this.isDown = false
    setTimeout(() => { this.paused = false }, 1000)
  }

  onWheel(e: Event) {
    const we = e as WheelEvent
    const delta = we.deltaY || (we as unknown as Record<string, number>).wheelDelta || (we as unknown as Record<string, number>).detail
    this.scroll.target += (delta > 0 ? this.scrollSpeed : -this.scrollSpeed) * 0.2
  }

  onResize() {
    this.screen = { width: this.container.clientWidth, height: this.container.clientHeight }
    this.renderer.setSize(this.screen.width, this.screen.height)
    this.camera.perspective({ aspect: this.screen.width / this.screen.height })
    const fov = (this.camera.fov * Math.PI) / 180
    const height = 2 * Math.tan(fov / 2) * this.camera.position.z
    const width = height * this.camera.aspect
    this.viewport = { width, height }
    this.medias?.forEach(m => m.onResize({ screen: this.screen, viewport: this.viewport }))
  }

  update() {
    this.scroll.current = lerp(this.scroll.current, this.scroll.target, this.scroll.ease)
    const direction = this.scroll.current > this.scroll.last ? 'right' : 'left'
    this.medias?.forEach(m => m.update(this.scroll, direction))
    this.renderer.render({ scene: this.scene, camera: this.camera })
    this.scroll.last = this.scroll.current
    this.raf = window.requestAnimationFrame(this.update.bind(this))
  }

  addEventListeners() {
    this.onResizeBound = this.onResize.bind(this)
    this.onWheelBound = this.onWheel.bind(this)
    this.onTouchDownBound = this.onTouchDown.bind(this)
    this.onTouchMoveBound = this.onTouchMove.bind(this)
    this.onTouchUpBound = this.onTouchUp.bind(this)
    window.addEventListener('resize', this.onResizeBound)
    window.addEventListener('wheel', this.onWheelBound)
    this.container.addEventListener('mousedown', this.onTouchDownBound)
    window.addEventListener('mousemove', this.onTouchMoveBound)
    window.addEventListener('mouseup', this.onTouchUpBound)
    this.container.addEventListener('touchstart', this.onTouchDownBound)
    window.addEventListener('touchmove', this.onTouchMoveBound)
    window.addEventListener('touchend', this.onTouchUpBound)
  }

  destroy() {
    window.cancelAnimationFrame(this.raf)
    window.cancelAnimationFrame(this.autoScrollRaf)
    window.removeEventListener('resize', this.onResizeBound)
    window.removeEventListener('wheel', this.onWheelBound)
    this.container.removeEventListener('mousedown', this.onTouchDownBound)
    window.removeEventListener('mousemove', this.onTouchMoveBound)
    window.removeEventListener('mouseup', this.onTouchUpBound)
    this.container.removeEventListener('touchstart', this.onTouchDownBound)
    window.removeEventListener('touchmove', this.onTouchMoveBound)
    window.removeEventListener('touchend', this.onTouchUpBound)
    if (this.renderer?.gl?.canvas?.parentNode) {
      this.renderer.gl.canvas.parentNode.removeChild(this.renderer.gl.canvas as HTMLCanvasElement)
    }
  }
}

export interface CircularGalleryItem { image: string; text: string }

export interface CircularGalleryProps {
  items?: CircularGalleryItem[]
  bend?: number
  textColor?: string
  borderRadius?: number
  font?: string
  scrollSpeed?: number
  scrollEase?: number
  autoScrollSpeed?: number
}

export default function CircularGallery({
  items,
  bend = 3,
  textColor = '#ffffff',
  borderRadius = 0.05,
  font = 'bold 30px sans-serif',
  scrollSpeed = 2,
  scrollEase = 0.05,
  autoScrollSpeed = 0.5,
}: CircularGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const app = new App(containerRef.current, { items, bend, textColor, borderRadius, font, scrollSpeed, scrollEase, autoScrollSpeed })
    return () => app.destroy()
  }, [items, bend, textColor, borderRadius, font, scrollSpeed, scrollEase, autoScrollSpeed])

  return <div className={css.container} ref={containerRef} />
}
