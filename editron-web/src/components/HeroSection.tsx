"use client"

import { Button } from "@/components/ui/button"
import { DemoDialog } from "@/components/DemoDialog"
import { Play } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function HeroSection() {
  const router = useRouter()
  const [demoOpen, setDemoOpen] = useState(false)

  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <div className="animate-fade-in-up">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            The Document Workspace That{" "}
            <span className="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
              Works With You
            </span>
          </h1>

          <p className="text-xl sm:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
            Built for professionals who demand both power and precision.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-up delay-300">
            {/* <WaitlistDialog>
              <Button size="lg" variant="gradient" className="text-lg px-8 py-3 cursor-pointer">
                Join the Waitlist
              </Button>
            </WaitlistDialog> */}

            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 py-3 border-white text-white hover:bg-white/10 hover:text-white bg-transparent cursor-pointer"
              onClick={() => setDemoOpen(true)}
            >
              <Play className="mr-2 h-5 w-5" />
              Watch Demo
            </Button>

            <Button size="lg" variant="gradient" className="text-lg px-8 py-3 cursor-pointer" onClick={() => router.push("/download")}>
              Try it now
            </Button>
          </div>
        </div>
      </div>

      <DemoDialog open={demoOpen} onOpenChange={setDemoOpen} />
    </section>
  )
} 