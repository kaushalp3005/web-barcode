'use client'

import { useEffect, useRef, useState } from 'react'
import BarcodeScanner from '@/components/barcode-scanner'
import ScanResults from '@/components/scan-results'

export default function Page() {
  const [scannedCodes, setScannedCodes] = useState<string[]>([])

  const handleBarcodeDetected = (code: string) => {
    setScannedCodes(prev => [code, ...prev.slice(0, 9)])
  }

  const clearResults = () => {
    setScannedCodes([])
  }

  return (
    <main className="w-full min-h-screen flex flex-col items-center justify-center bg-background gap-4 sm:gap-6 p-4 sm:p-6">
      <div className="w-full max-w-4xl flex flex-col gap-4 sm:gap-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">
            Barcode Scanner
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Point your camera at a barcode to scan it. The ROI box in the center helps with positioning.
          </p>
        </div>

        {/* Scanner */}
        <div className="w-full">
          <BarcodeScanner onBarcodeDetected={handleBarcodeDetected} />
        </div>

        {/* Results */}
        {scannedCodes.length > 0 && (
          <ScanResults codes={scannedCodes} onClear={clearResults} />
        )}
      </div>
    </main>
  )
}
