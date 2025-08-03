"use client"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

interface DemoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DemoDialog({ open, onOpenChange }: DemoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full h-[600px] p-0 bg-black border-0">
        <DialogTitle hidden></DialogTitle>
        <video src="https://pub-075671a95f4140f4ad7316e2da06f730.r2.dev/demo.mkv" className="w-full h-full bg-black" controls />
      </DialogContent>
    </Dialog>
  )
} 