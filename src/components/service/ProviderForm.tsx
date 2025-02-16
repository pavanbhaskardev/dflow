'use client'

import Tabs from '../Tabs'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAction } from 'next-safe-action/hooks'
import { useParams } from 'next/navigation'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { getRepositoriesAction } from '@/actions/gitProviders'
import { updateServiceAction } from '@/actions/service'
import { updateServiceSchema } from '@/actions/service/validator'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GitProvider, Service } from '@/payload-types'

const ProviderForm = ({
  gitProviders,
  service,
}: {
  gitProviders: GitProvider[]
  service: Service
}) => {
  const params = useParams<{ id: string; serviceId: string }>()
  const form = useForm<z.infer<typeof updateServiceSchema>>({
    resolver: zodResolver(updateServiceSchema),
    defaultValues: {
      provider:
        typeof service.provider === 'object'
          ? service.provider?.id
          : service.provider,
      id: params.serviceId,
      providerType: 'github',
      githubSettings: {
        owner: '',
        branch: service?.githubSettings?.branch,
        buildPath: service?.githubSettings?.buildPath,
        repository: service?.githubSettings?.repository,
      },
    },
  })

  const activeProvider = useWatch({ name: 'provider', control: form.control })

  const { execute, isPending } = useAction(updateServiceAction, {
    onSuccess: ({ data }) => {
      if (data) {
        toast.success('Successfully updated Git-provider details')
      }
    },
  })

  const {
    execute: getRepositories,
    result: { data: repositoriesList, serverError },
    isPending: repositoriesLoading,
  } = useAction(getRepositoriesAction)

  console.log({ repositoriesList })

  // Fetching the repositories whenever provider get's changed
  useEffect(() => {
    if (activeProvider) {
      const provider = gitProviders.find(({ id }) => id === activeProvider)

      if (provider && provider.github) {
        getRepositories({
          page: 1,
          limit: 100,
          appId: `${provider.github.appId}`,
          installationId: `${provider.github.installationId}`,
          privateKey: provider.github.privateKey,
        })
      }
    }
  }, [activeProvider])

  function onSubmit(values: z.infer<typeof updateServiceSchema>) {
    execute(values)
  }

  return (
    <div className='space-y-4 rounded border p-4'>
      <div>
        <h3 className='text-lg font-semibold'>Provider</h3>
        <p className='text-muted-foreground'>Select the source of your code</p>
      </div>

      <Tabs
        tabs={[
          {
            label: 'Github',
            content: () => (
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className='w-full space-y-8'>
                  <FormField
                    control={form.control}
                    name='provider'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account</FormLabel>

                        <Select
                          onValueChange={value => {
                            field.onChange(value)
                            form.setValue('githubSettings.repository', '')
                          }}
                          defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder='Select a account' />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {gitProviders.map(({ github, id }) => {
                              if (github) {
                                return (
                                  <SelectItem key={github.appName} value={id}>
                                    {github.appName}
                                  </SelectItem>
                                )
                              }
                            })}
                          </SelectContent>
                        </Select>

                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='githubSettings.repository'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Repository</FormLabel>

                        <Select
                          onValueChange={value => {
                            field.onChange(value)
                            if (repositoriesList) {
                              const { repositories } = repositoriesList
                              const owner = repositories.find(
                                repo => repo.name === value,
                              )?.owner?.login
                              form.setValue('githubSettings.owner', owner ?? '')
                            }
                          }}
                          disabled={repositoriesLoading}
                          defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder='Select a repository' />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {repositoriesList?.repositories?.length
                              ? repositoriesList?.repositories?.map(
                                  repository => {
                                    return (
                                      <SelectItem value={repository.name}>
                                        {repository.name}
                                      </SelectItem>
                                    )
                                  },
                                )
                              : null}
                          </SelectContent>
                        </Select>

                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className='grid grid-cols-2 gap-4'>
                    <FormField
                      control={form.control}
                      name='githubSettings.branch'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Branch</FormLabel>

                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder='Select a branch' />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={'main'}>main</SelectItem>
                            </SelectContent>
                          </Select>

                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name='githubSettings.buildPath'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Build path</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className='flex w-full justify-end'>
                    <Button
                      type='submit'
                      disabled={isPending}
                      variant='outline'>
                      Save
                    </Button>
                  </div>
                </form>
              </Form>
            ),
          },
          {
            label: 'Gitlab',
            disabled: true,
          },
          {
            label: 'Bitbucket',
            disabled: true,
          },
        ]}
      />
    </div>
  )
}

export default ProviderForm
