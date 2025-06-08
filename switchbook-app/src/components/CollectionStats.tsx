'use client'

import { useState, useEffect } from 'react'
import { Switch } from '@prisma/client'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useTheme } from '@/contexts/ThemeContext'

interface CollectionStatsProps {
  switches: Switch[]
}

export default function CollectionStats({ switches }: CollectionStatsProps) {
  const { theme } = useTheme()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showTypeNumbers, setShowTypeNumbers] = useState(false)
  const [showTechnologyNumbers, setShowTechnologyNumbers] = useState(false)
  const [showManufacturerNumbers, setShowManufacturerNumbers] = useState(false)

  // Load states from localStorage on mount
  useEffect(() => {
    const savedCollapsedState = localStorage.getItem('statsCollapsed')
    if (savedCollapsedState === 'true') {
      setIsCollapsed(true)
    }
    
    const savedTypeView = localStorage.getItem('typeChartView')
    if (savedTypeView === 'numbers') {
      setShowTypeNumbers(true)
    }
    
    const savedTechnologyView = localStorage.getItem('technologyChartView')
    if (savedTechnologyView === 'numbers') {
      setShowTechnologyNumbers(true)
    }
    
    const savedManufacturerView = localStorage.getItem('manufacturerChartView')
    if (savedManufacturerView === 'numbers') {
      setShowManufacturerNumbers(true)
    }
  }, [])

  // Save collapsed state to localStorage
  const toggleCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('statsCollapsed', newState.toString())
  }
  
  // Toggle type chart view
  const toggleTypeView = () => {
    const newState = !showTypeNumbers
    setShowTypeNumbers(newState)
    localStorage.setItem('typeChartView', newState ? 'numbers' : 'chart')
  }
  
  // Toggle technology chart view
  const toggleTechnologyView = () => {
    const newState = !showTechnologyNumbers
    setShowTechnologyNumbers(newState)
    localStorage.setItem('technologyChartView', newState ? 'numbers' : 'chart')
  }
  
  // Toggle manufacturer chart view
  const toggleManufacturerView = () => {
    const newState = !showManufacturerNumbers
    setShowManufacturerNumbers(newState)
    localStorage.setItem('manufacturerChartView', newState ? 'numbers' : 'chart')
  }
  // Calculate statistics by type
  const typeStats = switches.reduce((acc, switchItem) => {
    const type = switchItem.type ? switchItem.type.replace('_', ' ') : 'No Type'
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const typeData = Object.entries(typeStats).map(([name, value]) => ({
    name,
    value,
  }))

  // Calculate statistics by technology
  const technologyStats = switches.reduce((acc, switchItem) => {
    const technology = switchItem.technology ? 
      switchItem.technology.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()) : 
      'No Technology'
    acc[technology] = (acc[technology] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const technologyData = Object.entries(technologyStats).map(([name, value]) => ({
    name,
    value,
  }))

  // Calculate statistics by manufacturer
  const manufacturerStats = switches.reduce((acc, switchItem) => {
    const manufacturer = switchItem.manufacturer || 'Unknown'
    acc[manufacturer] = (acc[manufacturer] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const manufacturerData = Object.entries(manufacturerStats).map(([name, value]) => ({
    name,
    value,
  }))

  const COLORS = [
    '#3B82F6', // blue
    '#EF4444', // red
    '#10B981', // green
    '#F59E0B', // yellow
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#14B8A6', // teal
    '#F97316', // orange
  ]

  const isDark = theme === 'dark'
  
  // Custom tooltip with dark mode support
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={`${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'} p-2 rounded shadow border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <p className="text-sm">{`${payload[0].name}: ${payload[0].value}`}</p>
        </div>
      )
    }
    return null
  }

  // Custom label with dark mode support
  const renderCustomLabel = ({ name, percent }: any) => {
    return `${name} ${(percent * 100).toFixed(0)}%`
  }

  // Calculate timeline data only for switches with dateObtained
  const switchesWithDates = switches.filter(s => s.dateObtained)
  const timelineData = switchesWithDates.length > 0 ? (() => {
    // Group switches by month/year
    const monthlyData = switchesWithDates.reduce((acc, switchItem) => {
      const date = new Date(switchItem.dateObtained!)
      // Add timezone offset to get the correct local date
      const localDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000)
      const monthYear = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}`
      acc[monthYear] = (acc[monthYear] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Sort by date and create cumulative data
    const sortedMonths = Object.keys(monthlyData).sort()
    let cumulative = 0
    
    return sortedMonths.map(month => {
      cumulative += monthlyData[month]
      const [year, monthNum] = month.split('-')
      const monthName = new Date(Number(year), Number(monthNum) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      return {
        month: monthName,
        count: cumulative,
        newSwitches: monthlyData[month]
      }
    })
  })() : []

  // Check if we should show the timeline
  const showTimeline = timelineData.length > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Collection Statistics</h2>
        <button
          onClick={toggleCollapse}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <svg 
            className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-180'}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {isCollapsed ? 'Show Charts' : 'Hide Charts'}
        </button>
      </div>
      
      {!isCollapsed && (
        <div className="grid grid-cols-1 lg:grid-cols-3 md:grid-cols-2 gap-6 transition-all duration-300">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Switches by Type</h3>
          <button
            onClick={toggleTypeView}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title={showTypeNumbers ? "Show chart" : "Show numbers"}
          >
            {showTypeNumbers ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
                Chart
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                </svg>
                Numbers
              </>
            )}
          </button>
        </div>
        <div className="h-64">
          {showTypeNumbers ? (
            <div className="h-full flex items-center justify-center">
              <div className="space-y-3">
                {typeData
                  .sort((a, b) => b.value - a.value)
                  .map((item, index) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded flex-shrink-0" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[120px] text-left">
                        {item.name}:
                      </span>
                      <span className="text-2xl font-bold text-gray-900 dark:text-white min-w-[40px] text-right">
                        {item.value}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        ({((item.value / switches.length) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomLabel}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Switches by Technology</h3>
          <button
            onClick={toggleTechnologyView}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title={showTechnologyNumbers ? "Show chart" : "Show numbers"}
          >
            {showTechnologyNumbers ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
                Chart
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                </svg>
                Numbers
              </>
            )}
          </button>
        </div>
        <div className="h-64">
          {showTechnologyNumbers ? (
            <div className="h-full flex items-center justify-center">
              <div className="space-y-3">
                {technologyData
                  .sort((a, b) => b.value - a.value)
                  .map((item, index) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded flex-shrink-0" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[120px] text-left">
                        {item.name}:
                      </span>
                      <span className="text-2xl font-bold text-gray-900 dark:text-white min-w-[40px] text-right">
                        {item.value}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        ({((item.value / switches.length) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={technologyData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomLabel}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {technologyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Switches by Manufacturer</h3>
          <button
            onClick={toggleManufacturerView}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title={showManufacturerNumbers ? "Show chart" : "Show numbers"}
          >
            {showManufacturerNumbers ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
                Chart
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                </svg>
                Numbers
              </>
            )}
          </button>
        </div>
        <div className="h-64">
          {showManufacturerNumbers ? (
            <div className="h-full flex items-center justify-center overflow-y-auto">
              <div className="space-y-3 max-h-full">
                {manufacturerData
                  .sort((a, b) => b.value - a.value)
                  .map((item, index) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[100px]">
                        {item.name}:
                      </span>
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">
                        {item.value}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        ({((item.value / switches.length) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={manufacturerData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomLabel}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {manufacturerData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {showTimeline && (
        <div className="col-span-full bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Collection Timeline</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke={isDark ? '#374151' : '#E5E7EB'} 
                />
                <XAxis 
                  dataKey="month" 
                  stroke={isDark ? '#9CA3AF' : '#6B7280'}
                  style={{ fontSize: 12 }}
                />
                <YAxis 
                  stroke={isDark ? '#9CA3AF' : '#6B7280'}
                  style={{ fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                    borderRadius: '0.375rem',
                  }}
                  labelStyle={{ color: isDark ? '#F3F4F6' : '#111827' }}
                  formatter={(value: any, name: string) => {
                    if (name === 'Total Switches') return value
                    return `+${value}`
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  name="Total Switches"
                  dot={{ fill: '#3B82F6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  )
}