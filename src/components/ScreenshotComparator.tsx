'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Columns2, SlidersHorizontal, Diff, ZoomIn, ZoomOut, RotateCcw, ImageOff } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════
// Screenshot Comparator — Healify Jr. Prodigio Feature #4
//
// Compara screenshots "before" y "after" de un healing event
// con 3 modos de vista: Slider, Side-by-Side, y Diferencia.
// ═══════════════════════════════════════════════════════════════════════════

type CompareMode = 'slider' | 'side-by-side' | 'difference'

interface ScreenshotComparatorProps {
  beforeUrl: string
  afterUrl: string
  beforeLabel?: string
  afterLabel?: string
  testName?: string
  className?: string
}

export function ScreenshotComparator({
  beforeUrl,
  afterUrl,
  beforeLabel = 'Antes',
  afterLabel = 'Después',
  testName,
  className,
}: ScreenshotComparatorProps) {
  const [mode, setMode] = useState<CompareMode>('slider')
  const [sliderPosition, setSliderPosition] = useState(50)
  const [zoom, setZoom] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [beforeError, setBeforeError] = useState(false)
  const [afterError, setAfterError] = useState(false)
  const [showDiffCanvas, setShowDiffCanvas] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // ─── Slider drag handling ────────────────────────────────────────
  const handleSliderMove = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = clientX - rect.left
      const percent = Math.max(0, Math.min(100, (x / rect.width) * 100))
      setSliderPosition(percent)
    },
    []
  )

  const handleMouseDown = useCallback(() => {
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      handleSliderMove(e.clientX)
    }
    const handleMouseUp = () => setIsDragging(false)

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, handleSliderMove])

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length > 0) {
        handleSliderMove(e.touches[0].clientX)
      }
    },
    [handleSliderMove]
  )

  // ─── Pixel diff computation ──────────────────────────────────────
  useEffect(() => {
    if (mode !== 'difference' || !canvasRef.current) return
    setShowDiffCanvas(false)

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const imgBefore = new Image()
    const imgAfter = new Image()
    imgBefore.crossOrigin = 'anonymous'
    imgAfter.crossOrigin = 'anonymous'

    let loaded = 0
    const onLoad = () => {
      loaded++
      if (loaded < 2) return

      const w = Math.max(imgBefore.naturalWidth, imgAfter.naturalWidth)
      const h = Math.max(imgBefore.naturalHeight, imgAfter.naturalHeight)
      canvas.width = w
      canvas.height = h

      // Draw before
      ctx.drawImage(imgBefore, 0, 0, w, h)
      const dataBefore = ctx.getImageData(0, 0, w, h)

      // Draw after
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(imgAfter, 0, 0, w, h)
      const dataAfter = ctx.getImageData(0, 0, w, h)

      // Compute pixel diff — highlight differences in magenta, dim unchanged pixels
      const output = ctx.createImageData(w, h)
      for (let i = 0; i < dataBefore.data.length; i += 4) {
        const rDiff = Math.abs(dataBefore.data[i] - dataAfter.data[i])
        const gDiff = Math.abs(dataBefore.data[i + 1] - dataAfter.data[i + 1])
        const bDiff = Math.abs(dataBefore.data[i + 2] - dataAfter.data[i + 2])
        const totalDiff = rDiff + gDiff + bDiff

        if (totalDiff > 30) {
          // Changed pixel → bright magenta with intensity proportional to diff
          const intensity = Math.min(255, totalDiff * 3)
          output.data[i] = intensity       // R
          output.data[i + 1] = 20          // G
          output.data[i + 2] = intensity   // B
          output.data[i + 3] = 255         // A
        } else {
          // Unchanged pixel → dim version of original
          output.data[i] = dataAfter.data[i] * 0.15
          output.data[i + 1] = dataAfter.data[i + 1] * 0.15
          output.data[i + 2] = dataAfter.data[i + 2] * 0.15
          output.data[i + 3] = 255
        }
      }

      ctx.putImageData(output, 0, 0)
      setShowDiffCanvas(true)
    }

    imgBefore.onload = onLoad
    imgAfter.onload = onLoad
    imgBefore.src = beforeUrl
    imgAfter.src = afterUrl
  }, [mode, beforeUrl, afterUrl])

  // ─── Zoom controls ───────────────────────────────────────────────
  const zoomIn = () => setZoom((z) => Math.min(z + 0.25, 3))
  const zoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5))
  const resetZoom = () => setZoom(1)

  // ─── Mode tabs config ────────────────────────────────────────────
  const modes: { id: CompareMode; label: string; icon: typeof Columns2 }[] = [
    { id: 'slider', label: 'Deslizar', icon: SlidersHorizontal },
    { id: 'side-by-side', label: 'Lado a lado', icon: Columns2 },
    { id: 'difference', label: 'Diferencia', icon: Diff },
  ]

  // ─── Error state for both images ────────────────────────────────
  if (beforeError && afterError) {
    return (
      <div className={cn('rounded-xl bg-[#0A0D12] border border-white/[0.06] p-8 text-center', className)}>
        <ImageOff className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-[13px] text-gray-500">Las capturas no están disponibles</p>
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl overflow-hidden bg-[#08090A] border border-white/[0.06]', className)}>
      {/* ─── Header: Test name + mode tabs ─── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-[#0A0D12]">
        <div className="flex items-center gap-3">
          {testName && (
            <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium truncate max-w-[200px]">
              {testName}
            </span>
          )}
        </div>

        {/* Mode tabs */}
        <div className="flex items-center rounded-lg bg-[#111316] border border-white/[0.06] p-0.5">
          {modes.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all duration-200',
                mode === id
                  ? 'bg-white text-black shadow-sm'
                  : 'text-gray-500 hover:text-gray-300'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Viewport ─── */}
      <div className="relative overflow-auto" style={{ maxHeight: '520px' }}>
        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', transition: isDragging ? 'none' : 'transform 0.2s ease' }}>

          {/* SLIDER MODE */}
          {mode === 'slider' && (
            <div
              ref={containerRef}
              className="relative select-none cursor-col-resize"
              onMouseDown={handleMouseDown}
              onTouchStart={handleMouseDown}
              onTouchMove={handleTouchMove}
              role="slider"
              aria-valuenow={Math.round(sliderPosition)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Comparar capturas"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') setSliderPosition((p) => Math.max(0, p - 2))
                if (e.key === 'ArrowRight') setSliderPosition((p) => Math.min(100, p + 2))
              }}
            >
              {/* After image (full) */}
              <img
                src={afterUrl}
                alt={afterLabel}
                className="block w-full h-auto"
                onError={() => setAfterError(true)}
                draggable={false}
              />

              {/* Before image (clipped) */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${sliderPosition}%` }}
              >
                <img
                  src={beforeUrl}
                  alt={beforeLabel}
                  className="block w-full h-auto"
                  style={{ width: containerRef.current ? `${containerRef.current.offsetWidth}px` : '100%' }}
                  onError={() => setBeforeError(true)}
                  draggable={false}
                />
              </div>

              {/* Divider line */}
              <div
                className="absolute top-0 bottom-0 w-[2px] bg-white/80 shadow-[0_0_12px_rgba(255,255,255,0.4)]"
                style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
              >
                {/* Handle */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm shadow-lg border-2 border-white flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4 text-black" />
                </div>
              </div>

              {/* Labels */}
              <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm border border-white/10">
                <span className="text-[11px] font-medium text-red-400 tracking-wider uppercase">{beforeLabel}</span>
              </div>
              <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm border border-white/10">
                <span className="text-[11px] font-medium text-emerald-400 tracking-wider uppercase">{afterLabel}</span>
              </div>
            </div>
          )}

          {/* SIDE-BY-SIDE MODE */}
          {mode === 'side-by-side' && (
            <div className="grid grid-cols-2 gap-[1px] bg-white/[0.06]">
              <div className="relative bg-[#08090A]">
                <div className="absolute top-3 left-3 z-10 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm border border-white/10">
                  <span className="text-[11px] font-medium text-red-400 tracking-wider uppercase">{beforeLabel}</span>
                </div>
                {beforeError ? (
                  <div className="aspect-video flex items-center justify-center bg-[#0A0D12]">
                    <ImageOff className="w-8 h-8 text-gray-600" />
                  </div>
                ) : (
                  <img src={beforeUrl} alt={beforeLabel} className="block w-full h-auto" onError={() => setBeforeError(true)} />
                )}
              </div>
              <div className="relative bg-[#08090A]">
                <div className="absolute top-3 right-3 z-10 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm border border-white/10">
                  <span className="text-[11px] font-medium text-emerald-400 tracking-wider uppercase">{afterLabel}</span>
                </div>
                {afterError ? (
                  <div className="aspect-video flex items-center justify-center bg-[#0A0D12]">
                    <ImageOff className="w-8 h-8 text-gray-600" />
                  </div>
                ) : (
                  <img src={afterUrl} alt={afterLabel} className="block w-full h-auto" onError={() => setAfterError(true)} />
                )}
              </div>
            </div>
          )}

          {/* DIFFERENCE MODE */}
          {mode === 'difference' && (
            <div className="relative">
              {!showDiffCanvas && (
                <div className="aspect-video flex flex-col items-center justify-center bg-[#08090A]">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mb-3" />
                  <span className="text-[12px] text-gray-500">Calculando diferencias…</span>
                </div>
              )}
              <canvas
                ref={canvasRef}
                className={cn(
                  'block w-full h-auto transition-opacity duration-300',
                  showDiffCanvas ? 'opacity-100' : 'opacity-0 absolute inset-0'
                )}
              />
              {showDiffCanvas && (
                <div className="absolute bottom-3 left-3 flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm border border-white/10">
                    <div className="w-2.5 h-2.5 rounded-full bg-fuchsia-500" />
                    <span className="text-[11px] text-gray-300">Cambios</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm border border-white/10">
                    <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                    <span className="text-[11px] text-gray-300">Sin cambios</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Footer: Zoom controls ─── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.06] bg-[#0A0D12]">
        <span className="text-[11px] text-gray-500 font-mono">
          {Math.round(zoom * 100)}%
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            disabled={zoom <= 0.5}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Alejar"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={resetZoom}
            className="px-2 py-1 rounded-md text-[11px] text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors font-mono"
            aria-label="Restablecer zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={zoomIn}
            disabled={zoom >= 3}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Acercar"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
