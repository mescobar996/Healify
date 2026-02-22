import { HealifyLogoAnimated } from '@/components/HealifyLogo'

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0A0E1A] flex flex-col items-center justify-center gap-6">
      <HealifyLogoAnimated />
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#00F5C8] animate-bounce [animation-delay:0ms]" />
        <div className="w-2 h-2 rounded-full bg-[#7B5EF8] animate-bounce [animation-delay:150ms]" />
        <div className="w-2 h-2 rounded-full bg-[#FF6B9D] animate-bounce [animation-delay:300ms]" />
      </div>
      <p className="text-xs text-[#E8F0FF]/40 font-mono">Healing in progress...</p>
    </div>
  )
}
