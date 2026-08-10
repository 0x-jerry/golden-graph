import type { Arrayable } from '@0x-jerry/utils'
import type { HandlePosition } from './HandlePosition'

/**
 * Options passed to the handle's render component.
 */
export interface INodeHandleConfigOptions {
  [key: string]: any
}

/**
 * Configuration used when adding a handle to a node via `Node.addHandle()`.
 */
export interface INodeHandleConfig {
  /**
   * Unique key within the node — used to identify the handle.
   */
  key?: string

  /**
   * Accepted data type(s) for connection matching. Use `'*'` to accept any type.
   */
  accepts?: Arrayable<string>

  /**
   * Handle render component type (e.g. 'text', 'number', 'image', 'select', 'display').
   */
  type?: string

  /**
   * Display name shown on the handle.
   */
  name?: string

  /**
   * Description shown in a tooltip when hovering the handle for a moment.
   */
  description?: string

  /**
   * Visual position on the node (Left = input, Right = output, None = layout-only).
   */
  position?: HandlePosition

  /**
   * Initial value for the handle.
   */
  value?: any

  /**
   * Options forwarded to the handle's render component.
   */
  options?: INodeHandleConfigOptions
}
