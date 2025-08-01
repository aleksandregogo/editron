"use client"

import { useState, useEffect } from "react"
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
      render: (container: string, options: any) => string
      reset: (widgetId: string) => void
    }
  }
}

export function WaitlistDialog({ children }: WaitlistDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string>("")
  const [widgetId, setWidgetId] = useState<string>("")
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  })

  useEffect(() => {
    // Load Cloudflare Turnstile script
    const script = document.createElement("script")
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js"
    script.async = true
    script.defer = true
    document.head.appendChild(script)

    return () => {
      document.head.removeChild(script)
    }
  }, [])

  useEffect(() => {
    if (isOpen && window.turnstile) {
      const container = document.getElementById("turnstile-widget")
      if (container) {
        const id = window.turnstile.render(container, {
          sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA",
          callback: (token: string) => {
            setTurnstileToken(token)
          },
        })
        setWidgetId(id)
      }
    }
  }, [isOpen])

  const onSubmit = async (data: FormData) => {
    if (!turnstileToken) {
      setMessage({ type: "error", text: "Please complete the security check" })
      return
    }

    setIsSubmitting(true)
    setMessage(null)

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
        setMessage({ type: "success", text: result.message })
        reset()
        if (widgetId) {
          window.turnstile.reset(widgetId)
        }
        setTurnstileToken("")
        // Close dialog after 2 seconds on success
        setTimeout(() => setIsOpen(false), 2000)
      } else {
        setMessage({ type: "error", text: result.message || "Something went wrong" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "Network error. Please try again." })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      reset()
      setMessage(null)
      setTurnstileToken("")
      if (widgetId) {
        window.turnstile.reset(widgetId)
      }
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
            <div id="turnstile-widget" className="flex justify-center"></div>
          </div>

          {message && (
            <div
              className={`p-3 rounded-md text-sm ${
                message.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {message.text}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
            variant="gradient"
          >
            {isSubmitting ? "Joining..." : "Join Waitlist"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
} 