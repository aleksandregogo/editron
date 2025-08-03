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
        <div className="relative w-full h-full">
          <iframe
            src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1"
            title="Editron Demo"
            className="w-full h-full"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </DialogContent>
    </Dialog>
  )
} 