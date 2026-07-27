import { ExecutorWorkerHost } from '../../src/backend'
import { nodeDefinitions } from './nodes'

new ExecutorWorkerHost(nodeDefinitions)
