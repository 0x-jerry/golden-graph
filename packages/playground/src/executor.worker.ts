import { ExecutorWorkerHost } from '@0x-jerry/golden-graph-backend'
import { nodeProviders } from './nodes'

const host = new ExecutorWorkerHost()
host.addProviders(nodeProviders)
