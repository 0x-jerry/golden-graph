import type * as THREE from 'three/webgpu'
import { vec4 } from 'three/tsl'
import { compileTslExpression } from './compile'
import type { SceneOutput } from './scenes'

export interface ApplyContext {
  scene: THREE.Scene
  camera: THREE.Camera
  pipeline: THREE.RenderPipeline
  /** The active scene's destination for the graph's source. */
  output: SceneOutput
}

/** The applied source, able to put its destination back the way it was. */
export interface AppliedOutput {
  restore(): void
}

export interface ApplyResult {
  applied: AppliedOutput[]
  messages: string[]
  /** Whether a render pipeline output is in play, i.e. how to render a frame. */
  usesPipeline: boolean
}

/**
 * Compile the graph's source and assign it to the active scene's destination.
 * Failures come back as messages instead of thrown: a broken Output must not
 * stop the scene from rendering.
 *
 * Callers must restore `applied` before applying again — the destination is
 * always assigned from scratch so a removed or changed source leaves nothing
 * behind.
 */
export function applyOutput(
  ctx: ApplyContext,
  source: string | null,
): ApplyResult {
  const applied: AppliedOutput[] = []
  const messages: string[] = []

  if (!source) {
    return { applied, messages, usesPipeline: false }
  }

  let node: unknown

  try {
    node = compileTslExpression(source, {
      scene: ctx.scene,
      camera: ctx.camera,
    })
  } catch (error) {
    return { applied, messages: [errorText(error)], usesPipeline: false }
  }

  if (ctx.output.kind === 'pipeline') {
    const previous = ctx.pipeline.outputNode

    // `pass(scene, camera)` and friends need the runtime scene/camera, and the
    // graph may hand back a plain value (e.g. a bare float) — `vec4` is a
    // no-op on a node that already produces a vec4.
    ctx.pipeline.outputNode = asVec4(node)
    ctx.pipeline.needsUpdate = true

    applied.push({
      restore() {
        ctx.pipeline.outputNode = previous
        ctx.pipeline.needsUpdate = true
        disposeNode(node)
      },
    })

    return { applied, messages, usesPipeline: true }
  }

  const { material } = ctx.output
  const previous = material.colorNode

  material.colorNode = node as typeof material.colorNode
  material.needsUpdate = true

  applied.push({
    restore() {
      material.colorNode = previous
      material.needsUpdate = true
      disposeNode(node)
    },
  })

  return { applied, messages, usesPipeline: false }
}

function asVec4(value: unknown): THREE.Node {
  return vec4(value as never) as unknown as THREE.Node
}

function disposeNode(value: unknown) {
  const node = value as { dispose?: () => void } | null
  node?.dispose?.()
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
