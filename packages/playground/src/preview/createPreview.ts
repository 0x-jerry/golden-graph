import * as THREE from 'three/webgpu'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { applyOutput } from './apply'
import type { AppliedOutput } from './apply'
import { DEFAULT_SCENE_ID, DEFAULT_SHAPE, readSceneId } from './scene-meta'
import type { PreviewShape, SceneId } from './scene-meta'
import {
  createMaterialScene,
  createPipelineScene,
  disposeSceneInstance,
} from './scenes'
import type { SceneInstance } from './scenes'

export interface Preview {
  /**
   * Swap scenes: the previous instance and its orbit controls are disposed and
   * the applied source is dropped. The graph rebuilds right after and the new
   * source arrives through `apply`.
   */
  setScene(sceneId: SceneId): void
  setShape(shape: PreviewShape): string[]
  /** Assign the graph's source to the active scene's destination. */
  apply(source: string | null): string[]
  resize(width: number, height: number): void
  dispose(): void
}

interface Viewport {
  width: number
  height: number
}

/**
 * WebGPU-only preview: one WebGPU renderer and orbit-controlled camera driving
 * whichever built-in scene is active. The scene decides whether the graph's
 * source lands on its model material or on the render pipeline.
 *
 * There is no WebGL fallback — `WebGPURenderer` throws when WebGPU is missing.
 */
export async function createPreview(
  canvas: HTMLCanvasElement,
): Promise<Preview> {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true })
  await renderer.init()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const pipeline = new THREE.RenderPipeline(renderer)
  const viewport: Viewport = { width: 0, height: 0 }

  const state = {
    sceneId: DEFAULT_SCENE_ID,
    shape: DEFAULT_SHAPE,
    source: null as string | null,
    applied: [] as AppliedOutput[],
    usesPipeline: false,
  }

  let instance = createMaterialScene(state.shape)
  let controls = createControls(instance)
  let lastTime = 0

  renderer.setAnimationLoop((time) => {
    const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : 0
    lastTime = time

    // Damping only advances inside `update`, so it has to run every frame.
    controls.update(delta)
    instance.update?.(time / 1000, delta)

    if (state.usesPipeline) {
      pipeline.render()
    } else {
      renderer.render(instance.scene, instance.camera)
    }
  })

  function createControls(target: SceneInstance) {
    const orbit = new OrbitControls(target.camera, renderer.domElement)
    orbit.enableDamping = true
    orbit.dampingFactor = 0.08
    orbit.target.copy(target.cameraTarget ?? new THREE.Vector3())
    orbit.update()

    return orbit
  }

  /** Undo the assignment so the next apply starts from the scene's own state. */
  function releaseOutput() {
    for (const item of state.applied) {
      item.restore()
    }

    state.applied = []
    state.usesPipeline = false
  }

  function applyCurrent(): string[] {
    releaseOutput()

    const result = applyOutput(
      {
        scene: instance.scene,
        camera: instance.camera,
        pipeline,
        output: instance.output,
      },
      state.source,
    )

    state.applied = result.applied
    state.usesPipeline = result.usesPipeline

    return result.messages
  }

  function syncSize() {
    if (!viewport.width || !viewport.height) {
      return
    }

    renderer.setSize(viewport.width, viewport.height, false)
    instance.camera.aspect = viewport.width / viewport.height
    instance.camera.updateProjectionMatrix()
  }

  return {
    setScene(sceneId) {
      const next = readSceneId(sceneId)

      if (next === state.sceneId) {
        return
      }

      releaseOutput()
      controls.dispose()
      disposeSceneInstance(instance)

      state.sceneId = next
      instance =
        next === 'pipeline'
          ? createPipelineScene()
          : createMaterialScene(state.shape)
      controls = createControls(instance)
      syncSize()
    },

    setShape(shape) {
      state.shape = shape

      // Only the material scene offers shapes; the pipeline scene ignores it
      // and picks the latest shape up if the user switches back.
      if (state.sceneId !== 'material') {
        return []
      }

      instance.setShape?.(shape)
      return applyCurrent()
    },

    apply(source) {
      state.source = source
      return applyCurrent()
    },

    resize(width, height) {
      if (!width || !height) {
        return
      }

      viewport.width = width
      viewport.height = height
      syncSize()
    },

    dispose() {
      renderer.setAnimationLoop(null)
      releaseOutput()
      controls.dispose()
      disposeSceneInstance(instance)
      pipeline.dispose()
      void renderer.dispose()
    },
  }
}
