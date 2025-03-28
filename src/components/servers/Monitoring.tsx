'use client'

import { Button } from '../ui/button'
import { Loader2, MoreHorizontal, RefreshCcw, Trash2 } from 'lucide-react'
import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { uninstallNetdataAction } from '@/actions/netdata'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { netdata } from '@/lib/netdata'
import { ServerType } from '@/payload-types-overrides'

import CurrentResourceUsage from './CurrentResourceUsage'
import MonitoringTabs from './MonitoringTabs'
import StatusOverView from './StatusOverView'

const Monitoring = ({ server }: { server: ServerType }) => {
  const router = useRouter()

  // State for server status
  const [serverStatus, setServerStatus] = useState({
    status: 'loading',
    uptime: '--',
    lastIncident: '--',
    activeAlerts: 0,
  })

  const [isDataRefreshing, setIsDataRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null) // Last updated time

  // Add a ref to track the interval
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const [dashboardMetrics, setDashboardMetrics] = useState({
    cpuData: [],
    cpuUsageDistributionData: [],
    memoryData: [],
    networkData: [],
    diskSpaceData: [],
    diskIOData: [],
    diskVolumesData: [],
    inodeUsageData: [],
    serverLoadData: [],
    requestData: [],
    responseTimeData: [],
  })

  // Disk Space Data
  const dummyDiskSpaceData = [
    { name: 'Used', value: 68 },
    { name: 'Free', value: 32 },
  ]

  // Disk Volumes Data
  const dummyDiskVolumesData = [
    { name: '/', used: 75, total: 100 },
    { name: '/home', used: 45, total: 100 },
    { name: '/var', used: 25, total: 50 },
    { name: '/tmp', used: 5, total: 20 },
  ]

  // Inode Usage Data
  const dummyInodeUsageData = [
    { name: '/', used: 45 },
    { name: '/home', used: 35 },
    { name: '/var', used: 65 },
    { name: '/tmp', used: 15 },
  ]

  const dummyCpuUsageDistributionData = [
    { name: 'Core 1', usage: 65 },
    { name: 'Core 2', usage: 85 },
    { name: 'Core 3', usage: 72 },
    { name: 'Core 4', usage: 78 },
    { name: 'Core 5', usage: 62 },
    { name: 'Core 6', usage: 90 },
    { name: 'Core 7', usage: 45 },
    { name: 'Core 8', usage: 68 },
  ]

  // Function to fetch server status
  const fetchServerStatus = useCallback(async () => {
    try {
      const response = await netdata.system.getServerDashboardStatus({
        host: server.ip,
      })

      if (response) {
        setServerStatus({
          status: response?.data?.serverStatus?.status || 'unknown',
          uptime: response?.data?.serverStatus?.uptime || '--',
          lastIncident:
            response?.data?.serverStatus?.lastIncident || 'No incidents',
          activeAlerts: response?.data?.serverStatus?.activeAlerts || 0,
        })
      }
    } catch (error) {
      console.log('Error fetching server status:', error)
      setServerStatus(prev => ({
        ...prev,
        status: 'error',
      }))
    }
  }, [server.ip])

  // Function to fetch dashboard metrics
  const fetchDashboardMetrics = useCallback(async () => {
    try {
      const response = await netdata.system.getDashboardMetrics({
        host: server.ip,
      })

      if (response) {
        setDashboardMetrics({
          cpuData: response?.data?.cpuData || [],
          cpuUsageDistributionData:
            response?.data?.cpuUsageDistribution ||
            dummyCpuUsageDistributionData,
          memoryData: response?.data?.memoryData || [],
          networkData: response?.data?.networkData || [],
          diskSpaceData: response?.data?.diskSpaceData || dummyDiskSpaceData,
          diskIOData: response?.data?.diskIOData || [],
          diskVolumesData:
            response?.data?.diskVolumesData || dummyDiskVolumesData,
          inodeUsageData: response?.data?.inodeUsageData || dummyInodeUsageData,
          serverLoadData: response?.data?.serverLoadData || [],
          requestData: response?.data?.requestData || [],
          responseTimeData: response?.data?.responseTimeData || [],
        })

        // Update last updated time
        setLastUpdated(new Date().toLocaleTimeString())
      }
    } catch (error) {
      console.log('Error fetching dashboard metrics:', error)
    }
  }, [server.ip])

  // Function to clear and reset the interval
  const resetInterval = useCallback(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    // Set up a new interval
    intervalRef.current = setInterval(() => refreshData(false), 15000)
  }, [])

  // Wrap refreshData in useCallback
  const refreshData = useCallback(
    async (isManual = false) => {
      setIsDataRefreshing(true)
      try {
        await Promise.allSettled([fetchServerStatus(), fetchDashboardMetrics()])

        if (isManual) {
          // Reset interval when manually refreshed
          resetInterval()
          toast.success('Data refreshed successfully')
        }
      } catch (error) {
        if (isManual) {
          toast.error('Failed to refresh data')
        }
        console.error('Error refreshing data:', error)
      } finally {
        setIsDataRefreshing(false)
      }
    },
    [fetchServerStatus, fetchDashboardMetrics, resetInterval],
  )

  // Updated useEffect for initial setup and cleanup
  useEffect(() => {
    // Fetch initial data
    refreshData()

    // Set up initial polling interval
    resetInterval()

    // Cleanup interval on component unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [refreshData, resetInterval])

  // Action handlers
  const { execute: queueUninstallNetdata, isPending: isUninstallingNetdata } =
    useAction(uninstallNetdataAction, {
      onSuccess: () => {
        toast.success('Uninstall Netdata job added to queue')
        router.refresh()
      },
      onError: (error: any) => {
        toast.error(
          `Failed to queue Netdata uninstall: ${error.message || 'Unknown error'}`,
        )
      },
    })

  const handleUninstall = () => {
    queueUninstallNetdata({ serverId: server.id })
  }

  return (
    <div className='container mx-auto p-4'>
      <div className='mb-6 flex items-start justify-between'>
        <div>
          <h1 className='mb-2 text-3xl font-bold'>
            Server Monitoring Dashboard
          </h1>
          <p className='text-muted-foreground'>
            Real-time performance metrics and server status
          </p>
        </div>

        {/* Desktop Action Icons */}
        <div className='hidden items-center space-x-2 md:flex'>
          <Button
            disabled={isDataRefreshing}
            variant='secondary'
            onClick={() => refreshData(true)}>
            {isDataRefreshing ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <RefreshCcw className='h-4 w-4' />
            )}
            {isDataRefreshing ? 'Refreshing...' : 'Refresh Data'}
          </Button>

          <Button
            disabled={isUninstallingNetdata}
            onClick={handleUninstall}
            variant='destructive'>
            {isUninstallingNetdata ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <Trash2 className='h-4 w-4' />
            )}
            {isUninstallingNetdata ? 'Queuing Uninstall...' : 'Uninstall'}
          </Button>
        </div>

        {/* Mobile Dropdown Menu */}
        <div className='md:hidden'>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='outline' size='icon'>
                <MoreHorizontal className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem
                onClick={() => refreshData(true)}
                disabled={isDataRefreshing}>
                {isDataRefreshing ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <RefreshCcw className='h-4 w-4' />
                )}
                <span>
                  {isDataRefreshing ? 'Refreshing...' : 'Refresh Data'}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleUninstall}
                disabled={isUninstallingNetdata}
                className='text-destructive'>
                {isUninstallingNetdata ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <Trash2 className='h-4 w-4' />
                )}
                <span>
                  {isUninstallingNetdata ? 'Queuing Uninstall...' : 'Uninstall'}
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Last Updated Info with Loading Icon */}
      <div className='mb-4 flex items-center text-sm text-muted-foreground'>
        {isDataRefreshing && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
        <p>Last updated at: {lastUpdated || 'Fetching...'}</p>
      </div>

      {/* Status Overview */}
      <StatusOverView serverStatus={serverStatus} />

      {/* Current Resource Usage */}
      <CurrentResourceUsage
        cpuData={dashboardMetrics.cpuData}
        memoryData={dashboardMetrics.memoryData}
        networkData={dashboardMetrics.networkData}
      />

      {/* Tabs for detailed charts */}
      <MonitoringTabs dashboardMetrics={dashboardMetrics} />
    </div>
  )
}

export default Monitoring
