'use client'

import { useEffect, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BarcodeScannerProps {
  onBarcodeDetected: (code: string) => void
}

declare global {
  interface Window {
    BarcodeDetector?: any
  }
}

export default function BarcodeScanner({ onBarcodeDetected }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [supportsBarcodeDetection, setSupportsBarcodeDetection] = useState(false)
  const [roiDimensions, setRoiDimensions] = useState({ width: 0, height: 0, top: 0, left: 0 })
  const [videoROI, setVideoROI] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const detectorRef = useRef<any>(null)
  const detectionLoopRef = useRef<number | null>(null)
  const lastDetectionTimeRef = useRef<number>(0)
  const lastSuccessfulScanRef = useRef<string>('')
  const audioContextRef = useRef<AudioContext | null>(null)
  const DETECTION_INTERVAL_MS = 700 // 0.7 second between detection attempts

  // Play beep sound on successful scan
  const playBeep = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.frequency.value = 1200 // Frequency in Hz
      oscillator.type = 'sine'
      gainNode.gain.value = 0.3 // Volume (0-1)

      oscillator.start()
      oscillator.stop(ctx.currentTime + 0.15) // Beep duration: 150ms
    } catch {
      // Audio not supported, silently ignore
    }
  }

  // Calculate ROI dimensions based on viewport and video coordinates
  const calculateROI = () => {
    if (!videoRef.current) return

    const videoWidth = videoRef.current.videoWidth
    const videoHeight = videoRef.current.videoHeight
    const containerWidth = videoRef.current.offsetWidth
    const containerHeight = videoRef.current.offsetHeight

    if (!videoWidth || !videoHeight) return

    // ROI is 90% of container width for closer scanning
    const roiWidth = containerWidth * 0.9
    const roiHeight = Math.min(containerHeight * 0.35, roiWidth * 0.5) // Taller ROI for easier positioning

    const displayROI = {
      width: roiWidth,
      height: roiHeight,
      top: (containerHeight - roiHeight) / 2,
      left: (containerWidth - roiWidth) / 2,
    }

    setRoiDimensions(displayROI)

    // Calculate ROI in video coordinates (for cropping before detection)
    // Account for object-cover scaling
    const videoAspect = videoWidth / videoHeight
    const containerAspect = containerWidth / containerHeight

    let scaleX: number, scaleY: number, offsetX = 0, offsetY = 0

    if (videoAspect > containerAspect) {
      // Video is wider - height fits, width is cropped
      scaleY = videoHeight / containerHeight
      scaleX = scaleY
      offsetX = (videoWidth - containerWidth * scaleX) / 2
    } else {
      // Video is taller - width fits, height is cropped
      scaleX = videoWidth / containerWidth
      scaleY = scaleX
      offsetY = (videoHeight - containerHeight * scaleY) / 2
    }

    // Convert display ROI to video coordinates
    setVideoROI({
      x: Math.max(0, displayROI.left * scaleX + offsetX),
      y: Math.max(0, displayROI.top * scaleY + offsetY),
      width: Math.min(displayROI.width * scaleX, videoWidth),
      height: Math.min(displayROI.height * scaleY, videoHeight),
    })
  }

  // Initialize camera
  useEffect(() => {
    const initCamera = async () => {
      try {
        // Check for Barcode Detection API support
        if ('BarcodeDetector' in window) {
          setSupportsBarcodeDetection(true)
          detectorRef.current = new window.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39', 'code_128', 'qr_code'],
          })
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        })

        // Apply slight zoom if supported for better scanning
        const track = stream.getVideoTracks()[0]
        const capabilities = track.getCapabilities?.() as any
        if (capabilities?.zoom) {
          const minZoom = capabilities.zoom.min
          const maxZoom = capabilities.zoom.max
          // Apply light zoom (15% of max range)
          const targetZoom = minZoom + (maxZoom - minZoom) * 0.15
          await track.applyConstraints({ advanced: [{ zoom: targetZoom } as any] })
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setIsActive(true)

          // Wait for video to load, then calculate ROI
          videoRef.current.onloadedmetadata = () => {
            calculateROI()
          }
        }

        setError(null)
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to access camera'
        setError(errorMessage)
        setIsActive(false)
      }
    }

    initCamera()

    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach(track => track.stop())
      }
    }
  }, [])

  // Handle barcode detection loop - crops to ROI before detection
  useEffect(() => {
    if (!isActive || !supportsBarcodeDetection || !videoRef.current) return

    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const detectBarcodes = async () => {
      try {
        if (!videoRef.current || !detectorRef.current || !canvasRef.current) {
          timeoutId = setTimeout(detectBarcodes, DETECTION_INTERVAL_MS)
          return
        }
        if (videoROI.width <= 0 || videoROI.height <= 0) {
          timeoutId = setTimeout(detectBarcodes, DETECTION_INTERVAL_MS)
          return
        }

        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          timeoutId = setTimeout(detectBarcodes, DETECTION_INTERVAL_MS)
          return
        }

        // Set canvas size to match ROI dimensions
        canvas.width = videoROI.width
        canvas.height = videoROI.height

        // Crop video frame to ROI area only - this ensures we only scan within ROI
        ctx.drawImage(
          videoRef.current,
          videoROI.x,        // Source X (in video coordinates)
          videoROI.y,        // Source Y (in video coordinates)
          videoROI.width,    // Source width
          videoROI.height,   // Source height
          0,                 // Destination X
          0,                 // Destination Y
          videoROI.width,    // Destination width
          videoROI.height    // Destination height
        )

        // Detect barcodes only in the cropped ROI region
        const barcodes = await detectorRef.current.detect(canvas)

        // Process first detected barcode (avoid duplicate consecutive scans)
        if (barcodes.length > 0) {
          const scannedValue = barcodes[0].rawValue
          // Only report if it's a different barcode than the last one
          if (scannedValue !== lastSuccessfulScanRef.current) {
            lastSuccessfulScanRef.current = scannedValue
            playBeep()
            onBarcodeDetected(scannedValue)
          }
        } else {
          // Reset last scan when no barcode detected (allows re-scanning same barcode)
          lastSuccessfulScanRef.current = ''
        }
      } catch (err) {
        // Silently continue on detection errors
      }

      // Always wait DETECTION_INTERVAL_MS before next detection attempt
      timeoutId = setTimeout(detectBarcodes, DETECTION_INTERVAL_MS)
    }

    // Start detection loop
    timeoutId = setTimeout(detectBarcodes, DETECTION_INTERVAL_MS)

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [isActive, supportsBarcodeDetection, onBarcodeDetected, videoROI])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      calculateROI()
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const toggleCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach(track => {
        track.enabled = !track.enabled
      })
      setIsActive(!isActive)
    }
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Hidden canvas for ROI cropping before detection */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="relative w-full bg-muted rounded-xl overflow-hidden aspect-video md:aspect-4/3 lg:aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />

        {/* ROI Overlay */}
        {isActive && (
          <div className="absolute inset-0">
            {/* Dim outside areas */}
            <div className="absolute inset-0 bg-black/40 pointer-events-none" />

            {/* Clear ROI area */}
            <div
              className="absolute border-2 border-primary/60 rounded-lg pointer-events-none transition-all"
              style={{
                width: `${roiDimensions.width}px`,
                height: `${roiDimensions.height}px`,
                top: `${roiDimensions.top}px`,
                left: `${roiDimensions.left}px`,
              }}
            >
              {/* Corner indicators */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-primary rounded-br-lg" />
            </div>

            {/* Center crosshair */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <div className="w-1 h-8 bg-primary/40" />
              <div className="w-8 h-1 bg-primary/40 absolute top-1/2 -translate-y-1/2" />
            </div>

            {/* Instruction text */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-center text-xs sm:text-sm font-medium pointer-events-none">
              <p className="text-white/80">Position barcode in ROI</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex justify-center">
        <Button
          onClick={toggleCamera}
          variant="outline"
          size="sm"
          className="gap-2 text-xs sm:text-sm bg-transparent"
        >
          <RotateCcw className="w-4 h-4" />
          {isActive ? 'Pause' : 'Resume'}
        </Button>
      </div>

      {!supportsBarcodeDetection && (
        <div className="p-3 bg-muted border border-border rounded-lg text-xs sm:text-sm text-muted-foreground text-center">
          <p>Your browser doesn&apos;t support barcode detection API. Please use a modern browser like Chrome or Edge.</p>
        </div>
      )}
    </div>
  )
}
