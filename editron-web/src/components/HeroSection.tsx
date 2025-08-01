"use client"

import { Button } from "@/components/ui/button"
import { WaitlistDialog } from "@/components/WaitlistDialog"
import { Play } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <div className="animate-fade-in-up">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            The Document Workspace That{" "}
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Thinks With You
            </span>
          </h1>
          
          <p className="text-xl sm:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
            Editron is a secure, project-based desktop application that uses AI to help you draft, 
            edit, and manage complex documents faster than ever before. Stop wrestling with formatting 
            and repetitive tasks, and start focusing on what matters.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-up delay-300">
            <WaitlistDialog>
              <Button size="lg" variant="gradient" className="text-lg px-8 py-3">
                Join the Waitlist
              </Button>
            </WaitlistDialog>
            
            <Button 
              size="lg" 
              variant="outline" 
              className="text-lg px-8 py-3 border-white/20 text-white hover:bg-white/10"
              onClick={() => alert("Demo video coming soon!")}
            >
              <Play className="mr-2 h-5 w-5" />
              Watch Demo
            </Button>
          </div>
        </div>

        {/* Floating product mockup */}
        <div className="absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2 hidden lg:block animate-float">
          <div className="w-80 h-96 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-2xl">
            <div className="p-4">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-white/20 rounded animate-pulse"></div>
                <div className="h-4 bg-white/20 rounded w-3/4 animate-pulse delay-100"></div>
                <div className="h-4 bg-white/20 rounded w-1/2 animate-pulse delay-200"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
} 