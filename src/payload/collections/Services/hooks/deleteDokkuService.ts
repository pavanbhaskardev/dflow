import { CollectionAfterDeleteHook } from 'payload'

import { Service } from '@/payload-types'
import { addDestroyDatabaseQueue } from '@/queues/database/destroy'

export const deleteDokkuService: CollectionAfterDeleteHook<Service> = async ({
  doc,
  req: { payload, headers },
}) => {
  console.dir({ doc }, { depth: Infinity })

  const {
    project,
    type,
    providerType,
    githubSettings,
    provider,
    ...serviceDetails
  } = doc

  // A if check for getting all ssh keys & server details
  if (typeof project === 'object') {
    const serverId =
      typeof project.server === 'object' ? project.server.id : project.server

    // Again fetching the server details because, it's coming as objectID
    const serverDetails = await payload.findByID({
      collection: 'servers',
      id: serverId,
    })

    if (serverDetails.id && typeof serverDetails.sshKey === 'object') {
      const sshDetails = {
        privateKey: serverDetails.sshKey?.privateKey,
        host: serverDetails?.ip,
        username: serverDetails?.username,
        port: serverDetails?.port,
      }

      if (type === 'database' && serviceDetails.databaseDetails?.type) {
        const databaseQueueResponse = await addDestroyDatabaseQueue({
          databaseName: serviceDetails.name,
          databaseType: serviceDetails.databaseDetails?.type,
          sshDetails,
        })

        console.log({ databaseQueueResponse })
      }
    } else {
      console.log('Server details not found!', serverId)
    }
  }
}
