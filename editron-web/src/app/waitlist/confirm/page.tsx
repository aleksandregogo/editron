"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle } from "lucide-react"
import Link from "next/link"

export default function WaitlistConfirmPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const token = urlParams.get("token")

    if (!token) {
      setStatus("error")
      setMessage("Invalid confirmation link")
      return
    }

    const confirmWaitlist = async () => {
      try {
        const response = await fetch(`/api/waitlist/confirm?token=${token}`)
        const data = await response.json()

        if (response.ok) {
          setStatus("success")
          setMessage(data.message)
        } else {
          setStatus("error")
          setMessage(data.message || "Confirmation failed")
        }
      } catch (error) {
        setStatus("error")
        setMessage("Network error. Please try again.")
      }
    }

    confirmWaitlist()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full mx-4 text-center">
        {status === "loading" && (
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <h1 className="text-2xl font-bold text-gray-900">Confirming...</h1>
            <p className="text-gray-600">Please wait while we confirm your email.</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            <h1 className="text-2xl font-bold text-gray-900">Email Confirmed!</h1>
            <p className="text-gray-600">{message}</p>
            <Link href="/">
              <Button variant="gradient" className="w-full">
                Return to Home
              </Button>
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <XCircle className="w-16 h-16 text-red-500 mx-auto" />
            <h1 className="text-2xl font-bold text-gray-900">Confirmation Failed</h1>
            <p className="text-gray-600">{message}</p>
            <Link href="/">
              <Button variant="gradient" className="w-full">
                Return to Home
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
} 