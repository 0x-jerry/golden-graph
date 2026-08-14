import { describe, expect, it } from 'vitest'
import {
  CancelledError,
  JsonRpcClient,
  JsonRpcErrorCode,
  JsonRpcServer,
  createJsonRpcIdGenerator,
  isCancelledError,
  isJsonRpcNotification,
  isJsonRpcRequest,
  isJsonRpcResponse,
  type JsonRpcMessage,
} from '../src'

/**
 * In-process loopback wiring a `JsonRpcClient` and `JsonRpcServer`
 * together, standing in for a real message channel. Messages are
 * delivered asynchronously (queueMicrotask) like postMessage, and
 * structured-cloned to mimic transport semantics.
 */
function createLoopback() {
  const clientToServer: JsonRpcMessage[] = []
  const serverToClient: JsonRpcMessage[] = []
  let clientCursor = 0
  let serverCursor = 0

  // Push without consuming: the queues are kept for assertions, each
  // message is processed exactly once via the cursors. Delivery is
  // deferred one microtask like postMessage, and structured-cloned to
  // mimic transport semantics.
  const deliver = (queue: JsonRpcMessage[], message: JsonRpcMessage) => {
    queue.push(structuredClone(message))
    queueMicrotask(drain)
  }

  function drain() {
    while (serverToClient.length > serverCursor) {
      client.handleMessage(serverToClient[serverCursor]!)
      serverCursor++
    }
    while (clientToServer.length > clientCursor) {
      server.handleMessage(clientToServer[clientCursor]!)
      clientCursor++
    }
  }

  const server = new JsonRpcServer((message) => deliver(serverToClient, message))
  const client = new JsonRpcClient((message) => deliver(clientToServer, message))

  return { server, client, clientToServer, serverToClient }
}

describe('createJsonRpcIdGenerator', () => {
  it('generates integers starting at 1', () => {
    const next = createJsonRpcIdGenerator()
    expect(next()).toBe(1)
    expect(next()).toBe(2)
    expect(next()).toBe(3)
  })
})

describe('isJsonRpcRequest / isJsonRpcNotification / isJsonRpcResponse', () => {
  it('discriminates a request by the id member', () => {
    const request = { jsonrpc: '2.0', id: 1, method: 'foo' }
    expect(isJsonRpcRequest(request)).toBe(true)
    expect(isJsonRpcNotification(request)).toBe(false)
    expect(isJsonRpcResponse(request)).toBe(false)
  })

  it('treats a message without an id as a notification', () => {
    const notification = { jsonrpc: '2.0', method: 'foo', params: { x: 1 } }
    expect(isJsonRpcNotification(notification)).toBe(true)
    expect(isJsonRpcRequest(notification)).toBe(false)
    expect(isJsonRpcResponse(notification)).toBe(false)
  })

  it('recognizes success and error responses but not both result and error', () => {
    expect(isJsonRpcResponse({ jsonrpc: '2.0', id: 1, result: 42 })).toBe(true)
    expect(
      isJsonRpcResponse({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32000, message: 'boom' },
      }),
    ).toBe(true)
    expect(
      isJsonRpcResponse({ jsonrpc: '2.0', id: 1, result: 1, error: { code: 1, message: '' } }),
    ).toBe(false)
    expect(isJsonRpcResponse({ jsonrpc: '2.0', id: 1 })).toBe(false)
  })

  it('rejects messages without the 2.0 version marker', () => {
    expect(isJsonRpcRequest({ jsonrpc: '1.0', id: 1, method: 'foo' })).toBe(false)
    expect(isJsonRpcResponse({ id: 1, result: 1 })).toBe(false)
  })
})

describe('JsonRpcClient + JsonRpcServer loopback', () => {
  it('correlates concurrent calls by id', async () => {
    const { server, client } = createLoopback()

    server.onRequest('add', (params) => {
      const [a, b] = params as [number, number]
      return a + b
    })
    server.onRequest('echo', (params) => params)

    const [a, b, c] = await Promise.all([
      client.call('add', [1, 2]) as Promise<number>,
      client.call('add', [10, 20]) as Promise<number>,
      client.call('echo', 'hi'),
    ])

    expect(a).toBe(3)
    expect(b).toBe(30)
    expect(c).toBe('hi')
  })

  it('echoes the request id in the response', async () => {
    const { server, client, clientToServer, serverToClient } = createLoopback()

    server.onRequest('ping', () => 'pong')

    await client.call('ping')

    const request = clientToServer[0] as { id: number }
    const response = serverToClient[0] as { id: number; result: unknown }

    expect(request.id).toBeTypeOf('number')
    expect(response.id).toBe(request.id)
    expect(response.result).toBe('pong')
    expect(response).not.toHaveProperty('error')
  })

  it('omits params when none are given', async () => {
    const { server, client, clientToServer } = createLoopback()

    server.onRequest('noop', () => null)

    await client.call('noop')

    expect(clientToServer[0]).toEqual({ jsonrpc: '2.0', id: 1, method: 'noop' })
  })

  it('rejects with the error message when the handler throws', async () => {
    const { server, client, serverToClient } = createLoopback()

    server.onRequest('boom', () => {
      throw new Error('kaboom')
    })

    await expect(client.call('boom')).rejects.toThrow('kaboom')

    const response = serverToClient[0] as {
      error: { code: number; message: string }
      id: number
    }
    expect(response.id).toBe(1)
    expect(response.error.code).toBe(JsonRpcErrorCode.ServerError)
    expect(response.error.message).toBe('kaboom')
    expect(response).not.toHaveProperty('result')
  })

  it('rejects when an async handler rejects', async () => {
    const { server, client } = createLoopback()

    server.onRequest('boom', async () => {
      throw new Error('async kaboom')
    })

    await expect(client.call('boom')).rejects.toThrow('async kaboom')
  })

  it('attaches the error code to the rejected error', async () => {
    const { server, client } = createLoopback()

    server.onRequest('boom', () => {
      throw new Error('kaboom')
    })
    server.onRequest('cancel', () => {
      throw Object.assign(new Error('cancelled'), {
        code: JsonRpcErrorCode.Cancelled,
      })
    })

    const failure = client.call('boom').catch((error) => error)
    const cancelled = client.call('cancel').catch((error) => error)
    const [failureError, cancelledError] = (await Promise.all([
      failure,
      cancelled,
    ])) as [{ code?: number; message?: string }, { code?: number; message?: string }]

    expect(failureError.code).toBe(JsonRpcErrorCode.ServerError)
    expect(cancelledError.code).toBe(JsonRpcErrorCode.Cancelled)
    expect(cancelledError.message).toBe('cancelled')
  })

  it('honors an implementation-defined code carried on a thrown error', async () => {
    const { server, client, serverToClient } = createLoopback()

    server.onRequest('cancel', () => {
      throw Object.assign(new Error('cancelled'), {
        code: JsonRpcErrorCode.Cancelled,
      })
    })

    await expect(client.call('cancel')).rejects.toThrow('cancelled')

    const response = serverToClient[0]! as { error: { code: number } }
    expect(response.error.code).toBe(JsonRpcErrorCode.Cancelled)
  })

  it('CancelledError and isCancelledError recognize the -32001 code', () => {
    const cancelled = new CancelledError()

    expect(cancelled.code).toBe(JsonRpcErrorCode.Cancelled)
    expect(isCancelledError(cancelled)).toBe(true)
    expect(isCancelledError(new Error('cancelled'))).toBe(false)
    expect(isCancelledError(new Error('boom'))).toBe(false)
    expect(isCancelledError(undefined)).toBe(false)
  })

  it('replies -32601 for unknown methods, echoing the request id', async () => {
    const { client, serverToClient } = createLoopback()

    await expect(client.call('nope')).rejects.toThrow('Method not found')

    const response = serverToClient[0]! as {
      id: number
      error: { code: number }
    }
    expect(response.id).toBe(1)
    expect(response.error.code).toBe(JsonRpcErrorCode.MethodNotFound)
  })

  it('replies -32600 with id null for invalid requests', async () => {
    const { server, serverToClient } = createLoopback()

    server.handleMessage({ jsonrpc: '2.0', id: true, method: 'x' })
    await Promise.resolve()
    // Null ids are discouraged by the spec and rejected as undetectable
    server.handleMessage({ jsonrpc: '2.0', id: null, method: 'x' })
    await Promise.resolve()
    server.handleMessage([{ jsonrpc: '2.0', id: 1, method: 'x' }])
    await Promise.resolve()
    server.handleMessage('garbage')
    await Promise.resolve()

    for (const response of serverToClient) {
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: null,
        error: { code: JsonRpcErrorCode.InvalidRequest },
      })
    }
  })

  it('accepts and echoes string ids', async () => {
    const { server, serverToClient } = createLoopback()

    server.onRequest('ping', () => 'pong')
    server.handleMessage({ jsonrpc: '2.0', id: 'abc', method: 'ping' })
    // the handler runs and the reply is sent — one microtask apart
    await Promise.resolve()
    await Promise.resolve()

    const response = serverToClient[0]! as { id: string; result: unknown }
    expect(response.id).toBe('abc')
    expect(response.result).toBe('pong')
  })

  it('dispatches notifications without replying', async () => {
    const { server, serverToClient } = createLoopback()

    const received: unknown[] = []
    server.onNotification('update', (params) => {
      received.push(params)
    })

    server.handleMessage({ jsonrpc: '2.0', method: 'update', params: { x: 1 } })

    expect(received).toEqual([{ x: 1 }])
    expect(serverToClient).toHaveLength(0)
  })

  it('routes notifications on the client while a request is in flight', async () => {
    const { server, client } = createLoopback()

    let resolveRun!: () => void
    server.onRequest('run', () => new Promise<void>((resolve) => (resolveRun = resolve)))

    const events: string[] = []
    client.onNotification('progress', () => events.push('progress'))

    const pending = client.call('run')
    // the request is delivered, then the handler is invoked — both one
    // microtask apart
    await Promise.resolve()
    await Promise.resolve()

    client.handleMessage({ jsonrpc: '2.0', method: 'progress', params: {} })
    resolveRun()

    await pending
    expect(events).toEqual(['progress'])
  })

  it('ignores responses for unknown ids', async () => {
    const { client } = createLoopback()

    expect(() =>
      client.handleMessage({ jsonrpc: '2.0', id: 999, result: 1 }),
    ).not.toThrow()
  })

  it('dispose rejects in-flight calls', async () => {
    const { server, client } = createLoopback()

    let resolveRun!: () => void
    server.onRequest('run', () => new Promise<void>((resolve) => (resolveRun = resolve)))

    const pending = client.call('run')
    client.dispose()

    await expect(pending).rejects.toThrow(/disposed/)
    await Promise.resolve()
    resolveRun()
  })
})
