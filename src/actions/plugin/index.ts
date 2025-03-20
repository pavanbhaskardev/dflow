'use server'

import configPromise from '@payload-config'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { NodeSSH } from 'node-ssh'
import { getPayload } from 'payload'

import { dokku } from '@/lib/dokku'
import { protectedClient } from '@/lib/safe-action'
import { dynamicSSH } from '@/lib/ssh'
import { addLetsencryptPluginConfigureQueue } from '@/queues/letsencrypt/configure'
import { addCreatePluginQueue } from '@/queues/plugin/create'
import { addDeletePluginQueue } from '@/queues/plugin/delete'
import { addTogglePluginQueue } from '@/queues/plugin/toggle'

import {
  configureLetsencryptPluginSchema,
  installPluginSchema,
  syncPluginSchema,
  togglePluginStatusSchema,
} from './validator'

const payload = await getPayload({ config: configPromise })

export const installPluginAction = protectedClient
  .metadata({
    actionName: 'installPluginAction',
  })
  .schema(installPluginSchema)
  .action(async ({ clientInput }) => {
    const cookieStore = await cookies()
    const payloadToken = cookieStore.get('payload-token')
    const { serverId, pluginName, pluginURL } = clientInput

    // Fetching server details instead of passing from client
    const {
      id,
      ip,
      username,
      port,
      sshKey,
      plugins: previousPlugins,
    } = await payload.findByID({
      collection: 'servers',
      id: serverId,
      depth: 5,
    })

    if (!id) {
      throw new Error('Server not found')
    }

    if (typeof sshKey !== 'object') {
      throw new Error('SSH key not found')
    }

    const sshDetails = {
      host: ip,
      port,
      username,
      privateKey: sshKey.privateKey,
    }

    const queueResponse = await addCreatePluginQueue({
      pluginDetails: {
        name: pluginName,
        url: pluginURL,
      },
      serverDetails: {
        id: serverId,
        previousPlugins,
      },
      sshDetails,
      payloadToken: payloadToken?.value,
    })

    if (queueResponse.id) {
      return { success: true }
    }
  })

export const syncPluginAction = protectedClient
  .metadata({
    actionName: 'syncPluginAction',
  })
  .schema(syncPluginSchema)
  .action(async ({ clientInput }) => {
    const { serverId } = clientInput

    // Fetching server details instead of passing from client
    const {
      id,
      ip,
      username,
      port,
      sshKey,
      plugins: previousPlugins,
    } = await payload.findByID({
      collection: 'servers',
      id: serverId,
      depth: 5,
    })

    if (!id) {
      throw new Error('Server not found')
    }

    if (typeof sshKey !== 'object') {
      throw new Error('SSH key not found')
    }

    const sshDetails = {
      host: ip,
      port,
      username,
      privateKey: sshKey.privateKey,
    }

    let ssh: NodeSSH | null = null

    try {
      ssh = await dynamicSSH(sshDetails)

      const pluginsResponse = await dokku.plugin.list(ssh)

      const filteredPlugins = pluginsResponse.plugins.map(plugin => {
        const previousPluginDetails = (previousPlugins ?? []).find(
          previousPlugin => previousPlugin?.name === plugin?.name,
        )

        return {
          name: plugin.name,
          status: plugin.status ? ('enabled' as const) : ('disabled' as const),
          version: plugin.version,
          configuration:
            previousPluginDetails?.configuration &&
            typeof previousPluginDetails?.configuration === 'object' &&
            !Array.isArray(previousPluginDetails?.configuration)
              ? previousPluginDetails.configuration
              : {},
        }
      })

      // Updating plugin list in database
      const updatedServerResponse = await payload.update({
        collection: 'servers',
        id: serverId,
        data: {
          plugins: filteredPlugins,
        },
      })

      revalidatePath(`/settings/servers/${serverId}/general`)
      revalidatePath(`/onboarding/dokku-install`)
      return { success: true, plugins: updatedServerResponse.plugins ?? [] }
    } catch (error) {
      let message = ''
      if (error instanceof Error) {
        message = error.message
      }

      throw new Error(`Failed to sync plugins: ${message}`)
    } finally {
      if (ssh) {
        ssh.dispose()
      }
    }
  })

export const togglePluginStatusAction = protectedClient
  .metadata({
    actionName: 'togglePluginStatusAction',
  })
  .schema(togglePluginStatusSchema)
  .action(async ({ clientInput }) => {
    const { pluginName, serverId, enabled } = clientInput
    const cookieStore = await cookies()
    const payloadToken = cookieStore.get('payload-token')

    // Fetching server details instead of passing from client
    const {
      id,
      ip,
      username,
      port,
      sshKey,
      plugins: previousPlugins,
    } = await payload.findByID({
      collection: 'servers',
      id: serverId,
      depth: 5,
    })

    if (!id) {
      throw new Error('Server not found')
    }

    if (typeof sshKey !== 'object') {
      throw new Error('SSH key not found')
    }

    const sshDetails = {
      host: ip,
      port,
      username,
      privateKey: sshKey.privateKey,
    }

    const queueResponse = await addTogglePluginQueue({
      sshDetails,
      payloadToken: payloadToken?.value,
      pluginDetails: {
        enabled,
        name: pluginName,
      },
      serverDetails: {
        id: serverId,
        previousPlugins,
      },
    })

    if (queueResponse.id) {
      return { success: true }
    }
  })

export const deletePluginAction = protectedClient
  .metadata({
    actionName: 'uninstallPluginAction',
  })
  .schema(installPluginSchema)
  .action(async ({ clientInput }) => {
    const { serverId, pluginName } = clientInput
    const cookieStore = await cookies()
    const payloadToken = cookieStore.get('payload-token')

    // Fetching server details instead of passing from client
    const {
      id,
      ip,
      username,
      port,
      sshKey,
      plugins: previousPlugins,
    } = await payload.findByID({
      collection: 'servers',
      id: serverId,
      depth: 5,
    })

    if (!id) {
      throw new Error('Server not found')
    }

    if (typeof sshKey !== 'object') {
      throw new Error('SSH key not found')
    }

    const sshDetails = {
      host: ip,
      port,
      username,
      privateKey: sshKey.privateKey,
    }

    const queueResponse = await addDeletePluginQueue({
      pluginDetails: {
        name: pluginName,
      },
      serverDetails: {
        id: serverId,
        previousPlugins,
      },
      sshDetails,
      payloadToken: payloadToken?.value,
    })

    console.log({ queueResponse })

    return { success: true }
  })

export const configureLetsencryptPluginAction = protectedClient
  .metadata({
    actionName: 'configureLetsencryptPluginAction',
  })
  .schema(configureLetsencryptPluginSchema)
  .action(async ({ clientInput }) => {
    const { email, autoGenerateSSL = false, serverId } = clientInput
    const cookieStore = await cookies()
    const payloadToken = cookieStore.get('payload-token')

    // Fetching server details instead of passing from client
    const { id, ip, username, port, sshKey } = await payload.findByID({
      collection: 'servers',
      id: serverId,
      depth: 5,
    })

    if (!id) {
      throw new Error('Server not found')
    }

    if (typeof sshKey !== 'object') {
      throw new Error('SSH key not found')
    }

    const sshDetails = {
      host: ip,
      port,
      username,
      privateKey: sshKey.privateKey,
    }

    const queueResponse = await addLetsencryptPluginConfigureQueue({
      payloadToken: payloadToken?.value,
      serverDetails: {
        id: serverId,
      },
      pluginDetails: {
        autoGenerateSSL,
        email,
      },
      sshDetails,
    })

    if (queueResponse.id) {
      return { success: true }
    }
  })
