import { ExecutorWorkerHost } from '@0x-jerry/golden-graph-backend'
import { tslNodeProviders } from './nodes/tsl'

const host = new ExecutorWorkerHost()
host.addProviders(tslNodeProviders)
