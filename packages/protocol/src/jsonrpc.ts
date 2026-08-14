/**
 * Minimal JSON-RPC 2.0 layer, per
 * https://www.jsonrpc.org/specification
 *
 * Implements the request / response / notification / error-object rules
 * (§4, §5, §5.1) of the spec. Deliberately out of scope: batch requests
 * (§6 — a top-level Array is rejected as Invalid Request), the spec's own
 * `rpc.*` request cancellation, and textual JSON parsing (payloads always
 * arrive as already-parsed objects, so `-32700` Parse error can only ever
 * occur on a future textual transport).
 *
 * App-level cancellation (stopping an in-flight workflow run) is NOT part
 * of the JSON-RPC layer itself — the golden-graph protocol implements it
 * with a dedicated `goldenGraph/cancel` Notification plus a `-32001`
 * Cancelled error code (see {@link CancelledError}).
 *
 * The layer is transport-agnostic: `JsonRpcClient` and `JsonRpcServer`
 * take a `send(message)` callback and receive messages through
 * `handleMessage()`, so they work identically over a worker's
 * postMessage channel, an in-process loopback, or a WebSocket.
 *
 * Typing: the message interfaces are generic over their `params` /
 * `result` / error `data`. A client/server pair can additionally be
 * parameterized with `JsonRpcMethods` (method name → `{ params, result }`
 * contract) and `JsonRpcNotifications` (notification name → params) maps
 * so `call()`/`onRequest()`/`notify()` infer full types — see
 * `ExecutorRpc.ts` for the golden-graph contract.
 */

/** Request id. The spec (§4) allows String, Number or NULL; NULL is
 * discouraged and we never generate it. */
export type JsonRpcId = string | number

/** A rpc call (§4). `params` MAY be omitted; when present it must be an
 * Array (by-position) or Object (by-name). */
export interface JsonRpcRequest<Params = unknown> {
  jsonrpc: '2.0'
  id: JsonRpcId
  method: string
  params?: Params
}

/** A Request without an `id` member (§4.1). The server MUST NOT reply. */
export interface JsonRpcNotification<Params = unknown> {
  jsonrpc: '2.0'
  method: string
  params?: Params
}

/** Error object (§5.1): integer `code`, single-sentence String `message`,
 * optional `data`. */
export interface JsonRpcError<Data = unknown> {
  code: number
  message: string
  data?: Data
}

/** Success response (§5): `result` present, `error` MUST NOT exist. */
export interface JsonRpcSuccessResponse<Result = unknown> {
  jsonrpc: '2.0'
  id: JsonRpcId
  result: Result
}

/** Error response (§5): `error` present, `result` MUST NOT exist. `id`
 * MUST be Null when the id of the request could not be detected. */
export interface JsonRpcErrorResponse<Data = unknown> {
  jsonrpc: '2.0'
  id: JsonRpcId | null
  error: JsonRpcError<Data>
}

export type JsonRpcResponse<Result = unknown, Data = unknown> =
  | JsonRpcSuccessResponse<Result>
  | JsonRpcErrorResponse<Data>

/** Anything that can travel over the channel. */
export type JsonRpcMessage<Result = unknown, Data = unknown> =
  | JsonRpcRequest
  | JsonRpcNotification
  | JsonRpcResponse<Result, Data>

/** Contract of a JSON-RPC method: its `params` and `result`. `params`
 * is `undefined` for param-less methods and is omitted on the wire. */
export interface JsonRpcMethodContract<Params = unknown, Result = unknown> {
  params: Params
  result: Result
}

/** Method name → contract map. Drives typing of a client/server pair. */
export type JsonRpcMethods = Record<string, JsonRpcMethodContract>

/** Notification name → params map. */
export type JsonRpcNotifications = Record<string, unknown>

/** Params of a method contract. */
export type JsonRpcMethodParams<Contract extends JsonRpcMethodContract> =
  Contract['params']

/** Result of a method contract. */
export type JsonRpcMethodResult<Contract extends JsonRpcMethodContract> =
  Contract['result']

/** Pre-defined error codes (§5.1). The `-32000..-32099` range is
 * reserved for implementation-defined server errors. */
export const JsonRpcErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  ServerError: -32000,
  /** A run stopped by an app-level cancel request (golden-graph protocol). */
  Cancelled: -32001,
} as const

/**
 * Thrown by an executor backend when the in-flight run was cancelled via
 * the golden-graph cancel protocol. Over the wire the run's `execute`
 * Response settles with `error: { code: -32001, message: 'cancelled' }`;
 * {@link JsonRpcClient} re-attaches the code to the rejected `Error` so
 * callers can recognize a user-initiated stop with {@link isCancelledError}.
 */
export class CancelledError extends Error {
  code = JsonRpcErrorCode.Cancelled

  constructor(message = 'cancelled') {
    super(message)
    this.name = 'CancelledError'
  }
}

/** Whether an error is a user-initiated cancellation (`-32001`). */
export function isCancelledError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error as Error & { code?: unknown }).code === JsonRpcErrorCode.Cancelled
  )
}

export const JSON_RPC_VERSION = '2.0' as const

/** Standard single-sentence message for a pre-defined code (§5.1). */
export function jsonRpcErrorMessage(code: number): string {
  switch (code) {
    case JsonRpcErrorCode.ParseError:
      return 'Parse error'
    case JsonRpcErrorCode.InvalidRequest:
      return 'Invalid Request'
    case JsonRpcErrorCode.MethodNotFound:
      return 'Method not found'
    case JsonRpcErrorCode.InvalidParams:
      return 'Invalid params'
    case JsonRpcErrorCode.InternalError:
      return 'Internal error'
    default:
      return `Server error (${code})`
  }
}

export function createJsonRpcIdGenerator() {
  let id = 0
  // Integer ids only — the spec discourages Null and fractional Numbers.
  return () => ++id
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isRequestId(value: unknown): value is JsonRpcId | null {
  return typeof value === 'string' || typeof value === 'number' || value === null
}

/** A Response: `jsonrpc: '2.0'` + an `id` member + exactly one of
 * `result`/`error`. Discriminate responses from requests by the `id`
 * member (§5), not by `result`/`error` presence. */
export function isJsonRpcResponse(value: unknown): value is JsonRpcResponse {
  if (!isObject(value) || value.jsonrpc !== JSON_RPC_VERSION) return false
  if (!hasOwn(value, 'id') || !isRequestId(value.id)) return false
  const hasResult = hasOwn(value, 'result')
  const hasError = hasOwn(value, 'error') && isObject(value.error)
  return hasResult !== hasError
}

/** A Request (§4): `jsonrpc: '2.0'` + String `method` + an `id` member. */
export function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  if (!isObject(value) || value.jsonrpc !== JSON_RPC_VERSION) return false
  if (typeof value.method !== 'string') return false
  return hasOwn(value, 'id') && isRequestId(value.id) && value.id !== null
}

/** A Notification (§4.1): a Request without an `id` member. */
export function isJsonRpcNotification(value: unknown): value is JsonRpcNotification {
  if (!isObject(value) || value.jsonrpc !== JSON_RPC_VERSION) return false
  if (typeof value.method !== 'string') return false
  return !hasOwn(value, 'id')
}

/** What a transport endpoint can send out. */
export type JsonRpcOutbound<Result = unknown, Data = unknown> =
  | JsonRpcRequest
  | JsonRpcNotification
  | JsonRpcResponse<Result, Data>

export type JsonRpcSend = (message: JsonRpcOutbound) => void

type Pending = {
  resolve: (result: unknown) => void
  reject: (error: Error) => void
}

type RequestHandler = (params: unknown) => unknown | Promise<unknown>
type NotificationHandler = (params: unknown) => void

/**
 * Client side of JSON-RPC 2.0: originates Requests, settles them against
 * Responses correlated by `id`, and routes Notifications to registered
 * handlers.
 */
export class JsonRpcClient<
  Methods extends JsonRpcMethods = JsonRpcMethods,
  Notifications extends JsonRpcNotifications = JsonRpcNotifications,
> {
  _id = createJsonRpcIdGenerator()
  _pending = new Map<JsonRpcId, Pending>()
  _notificationHandlers = new Map<string, NotificationHandler>()

  constructor(readonly send: JsonRpcSend) {}

  /** Send a Request and resolve with the `result` of its Response
   * (`id`-correlated). Rejects with `new Error(error.message)` when the
   * server replies with an error object. */
  call<Method extends keyof Methods & string>(
    method: Method,
    params?: JsonRpcMethodParams<Methods[Method]>,
  ): Promise<JsonRpcMethodResult<Methods[Method]>> {
    const id = this._id()

    return new Promise<JsonRpcMethodResult<Methods[Method]>>((resolve, reject) => {
      this._pending.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
      })

      const request: JsonRpcRequest<JsonRpcMethodParams<Methods[Method]>> = {
        jsonrpc: JSON_RPC_VERSION,
        id,
        method,
      }
      if (params !== undefined) {
        request.params = params
      }

      this.send(request)
    })
  }

  /** Send a Notification — the server MUST NOT reply (§4.1). */
  notify<Method extends keyof Notifications & string>(
    method: Method,
    params?: Notifications[Method],
  ) {
    const notification: JsonRpcNotification<Notifications[Method]> = {
      jsonrpc: JSON_RPC_VERSION,
      method,
    }
    if (params !== undefined) {
      notification.params = params
    }

    this.send(notification)
  }

  /** Register the handler for an inbound Notification. */
  onNotification<Method extends keyof Notifications & string>(
    method: Method,
    handler: (params: Notifications[Method]) => void,
  ) {
    this._notificationHandlers.set(method, handler as NotificationHandler)
  }

  /** Drop the handler for an inbound Notification method. */
  offNotification<Method extends keyof Notifications & string>(method: Method) {
    this._notificationHandlers.delete(method)
  }

  /** Feed one inbound message (Response or Notification) into the
   * client. Responses with an unknown `id` are ignored with a warning. */
  handleMessage(message: unknown) {
    if (isJsonRpcResponse(message)) {
      const pending = this._pending.get(message.id as JsonRpcId)

      if (!pending) {
        console.warn(`[jsonrpc] response for unknown request id ${message.id}`)
        return
      }

      this._pending.delete(message.id as JsonRpcId)

      if ('error' in message) {
        const error = new Error(message.error.message)

        // Surface the error code so callers can distinguish cancellation
        // (`-32001`) and other implementation-defined codes, instead of
        // only carrying the message across the channel.
        if (typeof message.error.code === 'number') {
          ;(error as Error & { code?: unknown }).code = message.error.code
        }

        pending.reject(error)
      } else {
        pending.resolve(message.result)
      }
      return
    }

    if (isJsonRpcNotification(message)) {
      this._notificationHandlers.get(message.method)?.(message.params)
      return
    }

    console.warn('[jsonrpc] unexpected message', message)
  }

  /** Reject every in-flight call and drop notification handlers
   * (transport teardown). */
  dispose(error = new Error('JSON-RPC client disposed')) {
    for (const pending of this._pending.values()) {
      pending.reject(error)
    }
    this._pending.clear()
    this._notificationHandlers.clear()
  }
}

/**
 * Server side of JSON-RPC 2.0: dispatches Requests to registered method
 * handlers and replies with `result`/`error` Responses (echoing the
 * request `id`), and dispatches Notifications without replying (§4.1).
 *
 * Handlers may be async. A thrown error replies `-32000` (Server error,
 * §5.1) with the error's message. Unknown methods reply `-32601`.
 * Structurally invalid messages and top-level Arrays (batch, §6 — not
 * supported) reply `-32600` with `id: null` per §5.
 */
export class JsonRpcServer<
  Methods extends JsonRpcMethods = JsonRpcMethods,
  Notifications extends JsonRpcNotifications = JsonRpcNotifications,
> {
  _requestHandlers = new Map<string, RequestHandler>()
  _notificationHandlers = new Map<string, NotificationHandler>()

  constructor(readonly send: JsonRpcSend) {}

  /** Register the handler backing a Request method. */
  onRequest<Method extends keyof Methods & string>(
    method: Method,
    handler: (
      params: JsonRpcMethodParams<Methods[Method]>,
    ) => JsonRpcMethodResult<Methods[Method]> | Promise<JsonRpcMethodResult<Methods[Method]>>,
  ) {
    this._requestHandlers.set(method, handler as RequestHandler)
  }

  /** Register the handler backing an inbound Notification method. */
  onNotification<Method extends keyof Notifications & string>(
    method: Method,
    handler: (params: Notifications[Method]) => void,
  ) {
    this._notificationHandlers.set(method, handler as NotificationHandler)
  }

  /** Push a Notification to the client — the client MUST NOT reply
   * (§4.1). Typed by the notification map of the pairing client. */
  notify<Method extends keyof Notifications & string>(
    method: Method,
    params: Notifications[Method],
  ) {
    const notification: JsonRpcNotification<Notifications[Method]> = {
      jsonrpc: JSON_RPC_VERSION,
      method,
    }
    if (params !== undefined) {
      notification.params = params
    }

    this.send(notification)
  }

  /** Feed one inbound message (Request or Notification) into the
   * server and send the appropriate Reply (never for Notifications). */
  handleMessage(message: unknown) {
    // Batch (§6) is out of scope: reject as a single Invalid Request.
    if (Array.isArray(message)) {
      this._replyError(null, JsonRpcErrorCode.InvalidRequest)
      return
    }

    if (
      !isObject(message) ||
      message.jsonrpc !== JSON_RPC_VERSION ||
      typeof message.method !== 'string'
    ) {
      this._replyError(null, JsonRpcErrorCode.InvalidRequest)
      return
    }

    const method = message.method
    const params = hasOwn(message, 'params') ? message.params : undefined

    if (hasOwn(message, 'id')) {
      if (!isRequestId(message.id) || message.id === null) {
        // id present but not a String/Number (or NULL, whose use the spec
        // discourages and which we never generate): Invalid Request.
        this._replyError(null, JsonRpcErrorCode.InvalidRequest)
        return
      }

      const id = message.id
      const handler = this._requestHandlers.get(method)

      if (!handler) {
        this._replyError(id, JsonRpcErrorCode.MethodNotFound)
        return
      }

      Promise.resolve()
        .then(() => handler(params))
        .then(
          (result) => {
            const response: JsonRpcSuccessResponse = {
              jsonrpc: JSON_RPC_VERSION,
              id,
              result,
            }
            this.send(response)
          },
          (error) => {
            // Honor an implementation-defined code carried on the error
            // (e.g. a `CancelledError`), falling back to `-32000`. Only
            // codes in the spec's reserved server-error range are honored
            // so unrelated numeric `code` properties (DOMException,
            // library errors, ...) can't leak onto the wire.
            const code = (error as Error & { code?: unknown })?.code
            const isServerErrorCode =
              typeof code === 'number' &&
              code <= JsonRpcErrorCode.ServerError &&
              code >= JsonRpcErrorCode.ServerError - 99
            this._replyError(
              id,
              isServerErrorCode ? code : JsonRpcErrorCode.ServerError,
              error,
            )
          },
        )
      return
    }

    // Notification — MUST NOT reply (§4.1). Errors are unobservable by
    // the client, so they are only logged.
    const handler = this._notificationHandlers.get(method)

    if (!handler) {
      return
    }

    try {
      handler(params)
    } catch (error) {
      console.error('[jsonrpc] notification handler failed', error)
    }
  }

  _replyError(id: JsonRpcId | null, code: number, cause?: unknown) {
    const message =
      cause instanceof Error ? cause.message : jsonRpcErrorMessage(code)

    const response: JsonRpcErrorResponse = {
      jsonrpc: JSON_RPC_VERSION,
      id,
      error: { code, message },
    }
    this.send(response)
  }
}
