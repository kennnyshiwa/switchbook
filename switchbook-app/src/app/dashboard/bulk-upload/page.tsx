'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Switch } from '@prisma/client'
import Link from 'next/link'

interface ParsedSwitch {
  name: string
  type: string
  manufacturer?: string
  springWeight?: string
  springLength?: string
  actuationForce?: number
  bottomOutForce?: number
  preTravel?: number
  bottomOut?: number
  notes?: string
  imageUrl?: string
  topHousing?: string
  bottomHousing?: string
  stem?: string
  dateObtained?: string
}

interface ColumnMapping {
  [key: string]: keyof ParsedSwitch | null
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete'

export default function BulkUploadPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload')
  const [csvData, setCsvData] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({})
  const [parsedSwitches, setParsedSwitches] = useState<ParsedSwitch[]>([])
  const [importProgress, setImportProgress] = useState(0)
  const [importResults, setImportResults] = useState<{ success: number; errors: string[] }>({ success: 0, errors: [] })

  const switchFields = [
    { key: 'name', label: 'Switch Name', required: true },
    { key: 'type', label: 'Type', required: true },
    { key: 'manufacturer', label: 'Manufacturer', required: false },
    { key: 'springWeight', label: 'Spring Weight', required: false },
    { key: 'springLength', label: 'Spring Length', required: false },
    { key: 'actuationForce', label: 'Actuation Force (g)', required: false },
    { key: 'bottomOutForce', label: 'Bottom Out Force (g)', required: false },
    { key: 'preTravel', label: 'Pre-travel (mm)', required: false },
    { key: 'bottomOut', label: 'Bottom Out (mm)', required: false },
    { key: 'topHousing', label: 'Top Housing', required: false },
    { key: 'bottomHousing', label: 'Bottom Housing', required: false },
    { key: 'stem', label: 'Stem', required: false },
    { key: 'notes', label: 'Notes', required: false },
    { key: 'imageUrl', label: 'Image URL', required: false },
    { key: 'dateObtained', label: 'Date Obtained', required: false },
  ]

  const downloadTemplate = () => {
    const templateHeaders = switchFields.map(field => field.label)
    const sampleData = [
      'Cherry MX Red', 'LINEAR', 'Cherry', '45g', '11.5mm', '45', '60', '2.0', '4.0', 'Nylon', 'Nylon', 'POM', 'Great for gaming', '', '2024-01-15'
    ]
    
    const csvContent = [templateHeaders, sampleData].map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'switch-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split('\n').filter(line => line.trim())
      const data = lines.map(line => {
        const cells = []
        let current = ''
        let inQuotes = false
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i]
          if (char === '"') {
            inQuotes = !inQuotes
          } else if (char === ',' && !inQuotes) {
            cells.push(current.trim())
            current = ''
          } else {
            current += char
          }
        }
        cells.push(current.trim())
        return cells
      })
      
      if (data.length > 0) {
        setHeaders(data[0])
        setCsvData(data.slice(1))
        
        // Auto-map columns based on header names
        const autoMapping: ColumnMapping = {}
        data[0].forEach((header, index) => {
          const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '')
          const matchedField = switchFields.find(field => 
            field.label.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalizedHeader) ||
            normalizedHeader.includes(field.key.toLowerCase())
          )
          if (matchedField) {
            autoMapping[index.toString()] = matchedField.key as keyof ParsedSwitch
          }
        })
        setColumnMapping(autoMapping)
        setCurrentStep('mapping')
      }
    }
    reader.readAsText(file)
  }

  const updateColumnMapping = (columnIndex: string, field: keyof ParsedSwitch | null) => {
    setColumnMapping(prev => ({
      ...prev,
      [columnIndex]: field
    }))
  }

  const parseAndPreview = () => {
    const parsed: ParsedSwitch[] = csvData.map(row => {
      const switchData: Partial<ParsedSwitch> = {}
      
      Object.entries(columnMapping).forEach(([columnIndex, field]) => {
        if (field && row[parseInt(columnIndex)]) {
          const value = row[parseInt(columnIndex)].replace(/^"|"$/g, '') // Remove quotes
          
          if (['actuationForce', 'bottomOutForce', 'preTravel', 'bottomOut'].includes(field)) {
            const numValue = parseFloat(value)
            if (!isNaN(numValue)) {
              (switchData as any)[field] = numValue
            }
          } else if (field === 'type') {
            // Normalize switch type to uppercase and handle variations
            const normalizedType = value.toUpperCase().replace(/[\s_-]/g, '_')
            // Map common variations to valid enum values
            const typeMapping = {
              'LINEAR': 'LINEAR',
              'TACTILE': 'TACTILE',
              'CLICKY': 'CLICKY',
              'SILENT_LINEAR': 'SILENT_LINEAR',
              'SILENT_TACTILE': 'SILENT_TACTILE',
              'SILENTLINEAR': 'SILENT_LINEAR',
              'SILENTTACTILE': 'SILENT_TACTILE',
            } as const
            (switchData as any)[field] = typeMapping[normalizedType as keyof typeof typeMapping] || normalizedType
          } else {
            (switchData as any)[field] = value
          }
        }
      })
      
      return switchData as ParsedSwitch
    }).filter(sw => sw.name && sw.type) // Only include switches with required fields
    
    setParsedSwitches(parsed)
    setCurrentStep('preview')
  }

  const updateParsedSwitch = (index: number, field: keyof ParsedSwitch, value: string | number | undefined) => {
    setParsedSwitches(prev => prev.map((sw, i) => 
      i === index ? { ...sw, [field]: value } : sw
    ))
  }

  const importSwitches = async () => {
    setCurrentStep('importing')
    setImportProgress(0)
    
    const results = { success: 0, errors: [] as string[] }
    
    for (let i = 0; i < parsedSwitches.length; i++) {
      try {
        const response = await fetch('/api/switches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsedSwitches[i])
        })
        
        if (response.ok) {
          results.success++
        } else {
          const error = await response.text()
          results.errors.push(`Row ${i + 1}: ${error}`)
        }
      } catch (error) {
        results.errors.push(`Row ${i + 1}: Network error`)
      }
      
      setImportProgress(Math.round(((i + 1) / parsedSwitches.length) * 100))
    }
    
    setImportResults(results)
    setCurrentStep('complete')
  }

  if (currentStep === 'upload') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center mb-4">
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bulk Upload Switches</h1>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">How to Import Switches</h2>
          <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
            <p>Follow these steps to bulk import your switch collection:</p>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li><strong>Prepare your CSV file</strong> with switch information</li>
              <li><strong>Required fields:</strong> Switch Name and Type</li>
              <li><strong>Optional fields:</strong> Manufacturer, Spring Weight, Forces, Travel distances, Housing materials, Notes, etc.</li>
              <li><strong>Upload your CSV</strong> and verify the column mapping</li>
              <li><strong>Review and edit</strong> your switches before final import</li>
            </ol>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md mt-4">
              <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">CSV Format Requirements:</h3>
              <ul className="text-blue-800 dark:text-blue-200 space-y-1">
                <li>• Use commas to separate columns</li>
                <li>• Include headers in the first row</li>
                <li>• Switch Type must be: LINEAR, TACTILE, CLICKY, SILENT_LINEAR, or SILENT_TACTILE (case-insensitive)</li>
                <li>• Forces should be numeric values in grams</li>
                <li>• Travel distances should be numeric values in millimeters</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upload Your CSV File</h2>
            <button
              onClick={downloadTemplate}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
            >
              Download Template CSV
            </button>
          </div>
          
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
            />
            <label
              htmlFor="csv-upload"
              className="cursor-pointer inline-flex items-center px-6 py-3 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Choose CSV File
            </label>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Select a CSV file to upload your switches</p>
          </div>
        </div>
      </div>
    )
  }

  if (currentStep === 'mapping') {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Map CSV Columns</h1>
          <p className="text-gray-600 dark:text-gray-300">Verify that each column maps to the correct switch field</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {headers.map((header, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Column: &quot;{header}&quot;
                    </label>
                  </div>
                  <div className="flex-1">
                    <select
                      value={columnMapping[index.toString()] || ''}
                      onChange={(e) => updateColumnMapping(index.toString(), e.target.value as keyof ParsedSwitch || null)}
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Skip this column</option>
                      {switchFields.map(field => (
                        <option key={field.key} value={field.key}>
                          {field.label} {field.required ? '(Required)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700 flex justify-between">
            <button
              onClick={() => setCurrentStep('upload')}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              ← Back
            </button>
            <button
              onClick={parseAndPreview}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Continue to Preview
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (currentStep === 'preview') {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Preview & Edit Switches</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Review your {parsedSwitches.length} switches before importing
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Manufacturer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Spring Weight
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {parsedSwitches.map((switchItem, index) => (
                  <tr key={index}>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="text"
                        value={switchItem.name}
                        onChange={(e) => updateParsedSwitch(index, 'name', e.target.value)}
                        className="block w-full text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <select
                        value={switchItem.type}
                        onChange={(e) => updateParsedSwitch(index, 'type', e.target.value)}
                        className="block w-full text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      >
                        <option value="LINEAR">LINEAR</option>
                        <option value="TACTILE">TACTILE</option>
                        <option value="CLICKY">CLICKY</option>
                        <option value="SILENT_LINEAR">SILENT_LINEAR</option>
                        <option value="SILENT_TACTILE">SILENT_TACTILE</option>
                      </select>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="text"
                        value={switchItem.manufacturer || ''}
                        onChange={(e) => updateParsedSwitch(index, 'manufacturer', e.target.value)}
                        className="block w-full text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="text"
                        value={switchItem.springWeight || ''}
                        onChange={(e) => updateParsedSwitch(index, 'springWeight', e.target.value)}
                        className="block w-full text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <button
                        onClick={() => setParsedSwitches(prev => prev.filter((_, i) => i !== index))}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700 flex justify-between">
            <button
              onClick={() => setCurrentStep('mapping')}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              ← Back to Mapping
            </button>
            <button
              onClick={importSwitches}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Import {parsedSwitches.length} Switches
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (currentStep === 'importing') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Importing Switches...</h1>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mb-4">
            <div 
              className="bg-blue-600 h-4 rounded-full transition-all duration-300"
              style={{ width: `${importProgress}%` }}
            ></div>
          </div>
          <p className="text-gray-600 dark:text-gray-300">{importProgress}% complete</p>
        </div>
      </div>
    )
  }

  if (currentStep === 'complete') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Import Complete!</h1>
          
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md">
              <h3 className="font-medium text-green-900 dark:text-green-100">
                Successfully imported {importResults.success} switches
              </h3>
            </div>
            
            {importResults.errors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md">
                <h3 className="font-medium text-red-900 dark:text-red-100 mb-2">
                  {importResults.errors.length} errors occurred:
                </h3>
                <ul className="text-sm text-red-800 dark:text-red-200 space-y-1">
                  {importResults.errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          <div className="mt-6 flex space-x-4">
            <Link
              href="/dashboard"
              className="flex-1 text-center px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              View Your Collection
            </Link>
            <button
              onClick={() => {
                setCurrentStep('upload')
                setCsvData([])
                setHeaders([])
                setColumnMapping({})
                setParsedSwitches([])
                setImportProgress(0)
                setImportResults({ success: 0, errors: [] })
              }}
              className="flex-1 px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Import More
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}