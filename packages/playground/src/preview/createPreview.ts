import * as THREE from 'three/webgpu'
import { compileTslExpression } from './compile'

export type PreviewShape = 'plane' | 'sphere' | 'torus'

export interface Preview {
  setShader(source: string): void
  setShape(shape: PreviewShape): void
  resize(width: number, height: number): void
  dispose(): void
}

/**
 * WebGPU-only preview: one mesh whose material color is the graph's source.
 * There is no WebGL fallback — `WebGPURenderer` throws when WebGPU is missing.
 */
export async function createPreview(
  canvas: HTMLCanvasElement,
): Promise<Preview> {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true })
  await renderer.init()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  const material = new THREE.MeshBasicNodeMaterial()

  let shape: PreviewShape = 'plane'
  let geometry = createGeometry(shape)
  const mesh = new THREE.Mesh(geometry, material)

  scene.add(mesh)
  frameCamera(camera, shape)

  renderer.setAnimationLoop(() => renderer.render(scene, camera))

  return {
    setShader(source) {
      material.colorNode = compileTslExpression(source) as NonNullable<
        typeof material.colorNode
      >
      material.needsUpdate = true
    },

    setShape(next) {
      if (next === shape) {
        return
      }

      const previous = geometry
      shape = next
      geometry = createGeometry(next)
      mesh.geometry = geometry
      previous.dispose()
      frameCamera(camera, next)
    },

    resize(width, height) {
      if (!width || !height) {
        return
      }

      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    },

    dispose() {
      renderer.setAnimationLoop(null)
      void renderer.dispose()
      geometry.dispose()
      material.dispose()
    },
  }
}

function createGeometry(shape: PreviewShape): THREE.BufferGeometry {
  if (shape === 'sphere') {
    return new THREE.SphereGeometry(1, 64, 32)
  }

  if (shape === 'torus') {
    return new THREE.TorusKnotGeometry(0.7, 0.28, 160, 32)
  }

  return new THREE.PlaneGeometry(2, 2)
}

function frameCamera(camera: THREE.PerspectiveCamera, shape: PreviewShape) {
  camera.position.set(0, 0, shape === 'plane' ? 2.4 : 3.4)
  camera.lookAt(0, 0, 0)
}
