import { HealifyLogoAnimated } from '@/components/HealifyLogo'

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center gap-6">
      <HealifyLogoAnimated />
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:0ms]" />
        <div className="w-2 h-2 rounded-full bg-[#D0D0D0] animate-bounce [animation-delay:150ms]" />
        <div className="w-2 h-2 rounded-full bg-[#9A9A9A] animate-bounce [animation-delay:300ms]" />
      </div>
      <p className="text-xs text-[#EDEDED]/40 font-mono">Healing in progress...</p>
    </div>
  )
}
