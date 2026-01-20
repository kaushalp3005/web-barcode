'use client'

import { Copy, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

interface ScanResultsProps {
  codes: string[]
  onClear: () => void
}

export default function ScanResults({ codes, onClear }: ScanResultsProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const copyToClipboard = (code: string, index: number) => {
    navigator.clipboard.writeText(code)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  return (
    <div className="w-full space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground">
            Scanned Results
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {codes.length} barcode{codes.length !== 1 ? 's' : ''} scanned
          </p>
        </div>
        <Button
          onClick={onClear}
          variant="outline"
          size="sm"
          className="gap-2 text-xs sm:text-sm bg-transparent"
        >
          <Trash2 className="w-4 h-4" />
          Clear
        </Button>
      </div>

      <div className="grid gap-2 max-h-96 overflow-y-auto">
        {codes.map((code, index) => (
          <div
            key={`${code}-${index}`}
            className="flex items-center justify-between p-3 sm:p-4 bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-mono text-foreground break-all">
                {code}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Scan #{codes.length - index}
              </p>
            </div>
            <Button
              onClick={() => copyToClipboard(code, index)}
              variant="ghost"
              size="sm"
              className="ml-2 flex-shrink-0"
              title="Copy to clipboard"
            >
              <Copy className="w-4 h-4" />
              <span className="ml-1 text-xs hidden sm:inline">
                {copiedIndex === index ? 'Copied!' : 'Copy'}
              </span>
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
