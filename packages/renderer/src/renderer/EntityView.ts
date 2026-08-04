import type Konva from 'konva'

/**
 * Base class for all rendered entities. Owns the Konva group representing a
 * core model entity and is responsible for keeping it in sync via `update()`.
 *
 * Subclasses own their child views and state (e.g. a `NodeView` owns its
 * `HandleView`s), so an entity's full render footprint is torn down together.
 */
export abstract class EntityView<T> {
  readonly entity: T
  readonly group: Konva.Group

  constructor(entity: T, group: Konva.Group) {
    this.entity = entity
    this.group = group
  }

  /** Sync the group (and child views) from the current entity state. */
  abstract update(): void

  destroy(): void {
    this.group.destroy()
  }
}
