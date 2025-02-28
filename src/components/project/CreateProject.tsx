'use client'

import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { useAction } from 'next-safe-action/hooks'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { createProjectAction, updateProjectAction } from '@/actions/project'
import { createProjectSchema } from '@/actions/project/validator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Project, Server } from '@/payload-types'

const CreateProject = ({
  servers,
  title = 'Create new project',
  description = 'This will create a new project',
  type = 'create',
  project,
  children,
  manualOpen = false,
  setManualOpen = () => {},
}: {
  servers: Server[]
  type?: 'create' | 'update'
  title?: string
  description?: string
  project?: Project
  children?: React.ReactNode
  manualOpen?: boolean
  setManualOpen?: Dispatch<SetStateAction<boolean>>
}) => {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (manualOpen) {
      setOpen(manualOpen)
    }
  }, [manualOpen])

  const form = useForm<z.infer<typeof createProjectSchema>>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: project
      ? {
          name: project.name,
          description: project.description ?? '',
          serverId:
            typeof project.server === 'object'
              ? project.server.id
              : project.server,
        }
      : {
          name: '',
          description: '',
          serverId: '',
        },
  })

  const { execute: createProject, isPending: isCreatingProject } = useAction(
    createProjectAction,
    {
      onSuccess: ({ data }) => {
        if (data) {
          toast.success(`Successfully created project ${data.name}`)
          setOpen(false)
          setManualOpen(false)
          form.reset()
        }
      },
    },
  )

  const { execute: updateProject, isPending: isUpdatingProject } = useAction(
    updateProjectAction,
    {
      onSuccess: ({ data, input }) => {
        if (data) {
          toast.success(`Successfully updated ${input.name} project`)
          setOpen(false)
          setManualOpen(false)
          form.reset()
        }
      },
      onError: ({ error }) => {
        toast.error(`Failed to update project: ${error.serverError}`)
      },
    },
  )

  function onSubmit(values: z.infer<typeof createProjectSchema>) {
    if (type === 'create') {
      createProject(values)
    } else if (type === 'update' && project) {
      // passing extra id-field during update operation
      updateProject({ ...values, id: project.id })
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={state => {
        setOpen(state)
        setManualOpen(state)
      }}>
      {type === 'create' && (
        <DialogTrigger asChild>
          <Button>
            <Plus size={16} />
            Create Project
          </Button>
        </DialogTrigger>
      )}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className='sr-only'>
            {description}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={e => {
                        e.stopPropagation()
                        e.preventDefault()

                        field.onChange(e)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      onChange={e => {
                        e.stopPropagation()
                        e.preventDefault()

                        field.onChange(e)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='serverId'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Server</FormLabel>

                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select a server' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent
                      onSelect={e => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}>
                      {servers.map(({ name, id }) => {
                        return (
                          <SelectItem key={id} value={id}>
                            <span className='flex items-center gap-1'>
                              {name}
                            </span>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>

                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type='submit'
                disabled={isCreatingProject || isUpdatingProject}>
                {type === 'create' ? 'Create Project' : 'Update Project'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default CreateProject
