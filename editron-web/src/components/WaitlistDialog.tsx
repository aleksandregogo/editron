"use client"

import { useState, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
})

type FormData = z.infer<typeof formSchema>

interface WaitlistDialogProps {
  children: React.ReactNode
}

declare global {
  interface Window {
    turnstile: {
      render: (container: HTMLElement, options: any) => string
      reset: (widgetId: string) => void
    }
  }
}

export function WaitlistDialog({ children }: WaitlistDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [turnstileLoaded, setTurnstileLoaded] = useState(false)
  const turnstileWidgetId = useRef<string | null>(null)
  const turnstileContainerRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  })

  useEffect(() => {
    console.log('Dialog opened, isOpen:', isOpen)
    
    // Load Turnstile script if not already loaded
    if (!document.querySelector('script[src*="turnstile"]')) {
      console.log('Loading Turnstile script...')
      const script = document.createElement("script")
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js"
      script.async = true
      script.defer = true
      script.onload = () => {
        console.log('Turnstile script loaded successfully')
        setTurnstileLoaded(true)
        // Script loaded, render widget if dialog is open
        if (isOpen && turnstileContainerRef.current) {
          setTimeout(() => renderTurnstile(), 100) // Small delay to ensure script is ready
        }
      }
      script.onerror = () => {
        console.error('Failed to load Turnstile script')
        setError('Failed to load security check')
      }
      document.head.appendChild(script)
    } else {
      console.log('Turnstile script already exists')
      setTurnstileLoaded(true)
      console.log('Checking conditions:', { isOpen, containerExists: !!turnstileContainerRef.current })
      if (isOpen && turnstileContainerRef.current) {
        console.log('Script exists and dialog is open, calling renderTurnstile')
        setTimeout(() => renderTurnstile(), 100)
      } else if (isOpen) {
        console.log('Dialog is open but container not ready, retrying in 200ms')
        setTimeout(() => {
          if (turnstileContainerRef.current) {
            console.log('Container now ready, calling renderTurnstile')
            renderTurnstile()
          }
        }, 200)
      } else {
        console.log('Conditions not met - isOpen:', isOpen, 'container:', !!turnstileContainerRef.current)
      }
    }
  }, [isOpen])

  const renderTurnstile = () => {
    console.log('renderTurnstile called', { 
      turnstileExists: typeof window.turnstile !== 'undefined',
      containerExists: !!turnstileContainerRef.current,
      siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA",
      windowTurnstile: window.turnstile
    })
    
    if (typeof window.turnstile !== 'undefined' && turnstileContainerRef.current) {
      if (turnstileWidgetId.current) {
        window.turnstile.reset(turnstileWidgetId.current)
      }
      
      // Clear container first
      turnstileContainerRef.current.innerHTML = ''
      
      const widgetId = window.turnstile.render(turnstileContainerRef.current, {
        sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA",
        callback: (token: string) => {
          console.log('Turnstile callback triggered', token)
          setTurnstileToken(token)
          setError("")
        },
        'expired-callback': () => {
          console.log('Turnstile expired')
          setTurnstileToken(null)
          if (turnstileWidgetId.current) window.turnstile.reset(turnstileWidgetId.current)
        },
        'error-callback': () => {
          console.log('Turnstile error')
          setTurnstileToken(null)
          setError('CAPTCHA failed to load. Please try again.')
          if (turnstileWidgetId.current) window.turnstile.reset(turnstileWidgetId.current)
        },
        theme: 'auto',
      })
      turnstileWidgetId.current = widgetId || null
      console.log('Turnstile widget ID:', widgetId)
    }
  }

  const resetForm = () => {
    reset()
    setTurnstileToken(null)
    setError("")
    setSuccess("")
    if (turnstileWidgetId.current && typeof window.turnstile !== 'undefined') {
      window.turnstile.reset(turnstileWidgetId.current)
    }
  }

  const onSubmit = async (data: FormData) => {
    if (!turnstileToken) {
      setError("Please complete the CAPTCHA verification.")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      const response = await fetch("/api/waitlist/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: data.email,
          turnstileToken,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setError("")
        setSuccess(result.message || "Successfully joined waitlist!")
        resetForm()
        setTimeout(() => setIsOpen(false), 3000)
      } else {
        setError(result.message || "Something went wrong")
        if (turnstileWidgetId.current && typeof window.turnstile !== 'undefined') {
          window.turnstile.reset(turnstileWidgetId.current)
        }
        setTurnstileToken(null)
      }
    } catch (error) {
      setError("Network error. Please try again.")
      if (turnstileWidgetId.current && typeof window.turnstile !== 'undefined') {
        window.turnstile.reset(turnstileWidgetId.current)
      }
      setTurnstileToken(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      resetForm()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Join the Waitlist</DialogTitle>
          <DialogDescription>
            Be among the first to experience Editron. We'll notify you when we launch.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              {...register("email")}
              className={errors.email ? "border-red-500" : ""}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Security check</Label>
            <div ref={turnstileContainerRef} className="flex h-full w-full">
              {!turnstileLoaded && (
                <div className="text-sm text-gray-500">Loading security check...</div>
              )}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-md text-sm bg-red-50 text-red-700 border border-red-200">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-md text-sm bg-green-50 text-green-700 border border-green-200">
              {success}
            </div>
          )}

          <Button
            type="submit"
            className="w-full cursor-pointer"
            disabled={isSubmitting || !turnstileToken || !!success}
            variant="gradient"
          >
            {isSubmitting ? "Joining..." : success ? "Success!" : "Join Waitlist"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
} 