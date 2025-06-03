'use client'

import { Switch } from '@prisma/client'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useTheme } from '@/contexts/ThemeContext'

interface CollectionStatsProps {
  switches: Switch[]
}

export default function CollectionStats({ switches }: CollectionStatsProps) {
  const { theme } = useTheme()
  // Calculate statistics by type
  const typeStats = switches.reduce((acc, switchItem) => {
    const type = switchItem.type.replace('_', ' ')
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const typeData = Object.entries(typeStats).map(([name, value]) => ({
    name,
    value,
  }))

  // Calculate statistics by manufacturer
  const manufacturerStats = switches.reduce((acc, switchItem) => {
    acc[switchItem.manufacturer] = (acc[switchItem.manufacturer] || 0) + 1
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
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Switches by Type</h3>
        <div className="h-64">
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
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Switches by Manufacturer</h3>
        <div className="h-64">
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
  )
}