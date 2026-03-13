import { Loader2 } from 'lucide-react'

export default function ProtectedLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 text-[#52525b] animate-spin" />
        <p className="text-sm text-[#3f3f46]">Loading...</p>
      </div>
    </div>
  )
}
