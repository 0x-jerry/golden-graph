import * as THREE from 'three/webgpu'
import { DEFAULT_SHAPE } from './scene-meta'
import type { PreviewShape } from './scene-meta'

/** Where the active scene sends the graph's Output source. */
export type SceneOutput =
  | { kind: 'material'; material: THREE.NodeMaterial }
  | { kind: 'pipeline' }

/**
 * A preview scene. The scene decides where the graph's Output lands through
 * `output` — the model material for the material scene, the render pipeline
 * for the pipeline scene.
 */
export interface SceneInstance {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  output: SceneOutput
  /** Orbit focus; defaults to the origin. */
  cameraTarget?: THREE.Vector3
  /** Only the material scene has a shape. */
  setShape?(shape: PreviewShape): void
  update?(elapsed: number, delta: number): void
  /** Extra resources living outside the scene graph. */
  dispose?(): void
}

/**
 * Single-object scene for previewing material output: one mesh whose node
 * material receives the graph's TSL source, framed to fill the viewport.
 */
export function createMaterialScene(
  shape: PreviewShape = DEFAULT_SHAPE,
): SceneInstance {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  const material = new THREE.MeshBasicNodeMaterial()

  let current = shape
  let geometry = createShapeGeometry(current)

  const mesh = new THREE.Mesh(geometry, material)
  scene.add(mesh)
  frameShape(camera, current)

  return {
    scene,
    camera,
    output: { kind: 'material', material },

    setShape(next) {
      if (next === current) {
        return
      }

      const previous = geometry
      current = next
      geometry = createShapeGeometry(next)
      mesh.geometry = geometry
      previous.dispose()
      frameShape(camera, next)
    },
  }
}

/**
 * A small lit scene for previewing render pipeline output: several node
 * materials, a light rig, and a slowly rotating hero mesh so a full-frame
 * effect has something to work with.
 */
export function createPipelineScene(): SceneInstance {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  frameCamera(camera, 4.8)

  const knot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.68, 0.22, 180, 32),
    new THREE.MeshStandardNodeMaterial({
      color: '#8b94ff',
      roughness: 0.35,
      metalness: 0.1,
    }),
  )
  knot.position.set(-0.95, 0.5, 0)

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 64, 32),
    new THREE.MeshStandardNodeMaterial({ color: '#ffb066', roughness: 0.45 }),
  )
  sphere.position.set(0.95, 0.42, 0.15)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 7),
    new THREE.MeshStandardNodeMaterial({ color: '#20232e', roughness: 0.95 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.9

  const key = new THREE.DirectionalLight('#ffffff', 2.4)
  key.position.set(2.6, 3.2, 2.4)

  scene.add(
    knot,
    sphere,
    ground,
    new THREE.HemisphereLight('#cbd5ff', '#12141c', 1.1),
    key,
  )

  return {
    scene,
    camera,
    output: { kind: 'pipeline' },
    cameraTarget: new THREE.Vector3(0, 0.1, 0),

    update(elapsed) {
      knot.rotation.y = elapsed * 0.35
      knot.rotation.x = elapsed * 0.12
    },
  }
}

/** Releases everything a scene owns: geometries, materials and their maps. */
export function disposeSceneInstance(instance: SceneInstance) {
  instance.scene.traverse((item) => {
    const mesh = item as Partial<THREE.Mesh>

    mesh.geometry?.dispose()

    const material = mesh.material
    if (Array.isArray(material)) {
      material.forEach(disposeMaterial)
    } else if (material) {
      disposeMaterial(material)
    }
  })

  instance.dispose?.()
}

function frameCamera(camera: THREE.PerspectiveCamera, distance: number) {
  camera.position.set(0, 0, distance)
  camera.lookAt(0, 0, 0)
}

function frameShape(camera: THREE.PerspectiveCamera, shape: PreviewShape) {
  frameCamera(camera, shape === 'plane' ? 2.4 : 3.4)
}

function createShapeGeometry(shape: PreviewShape): THREE.BufferGeometry {
  if (shape === 'sphere') {
    return new THREE.SphereGeometry(1, 64, 32)
  }

  if (shape === 'torus') {
    return new THREE.TorusKnotGeometry(0.7, 0.28, 160, 32)
  }

  return new THREE.PlaneGeometry(2, 2)
}

function disposeMaterial(material: THREE.Material) {
  for (const value of Object.values(material)) {
    const texture = value as Partial<THREE.Texture> | null

    if (texture && typeof texture === 'object' && texture.isTexture) {
      texture.dispose?.()
    }
  }

  material.dispose()
}
