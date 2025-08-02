"use client"

import { Button } from "@/components/ui/button"
import { Apple, Monitor } from "lucide-react"

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="text-center px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
          <div className="animate-fade-in-up">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Download{" "}
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Editron
              </span>
            </h1>
            
            <p className="text-xl sm:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
              Get the desktop application that transforms how you work with documents. 
              Available for macOS and Windows.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto animate-fade-in-up delay-300">
              <Button 
                size="lg" 
                variant="gradient" 
                className="text-lg px-8 py-6 h-auto flex flex-col items-center gap-3 cursor-pointer"
                onClick={() => window.open('http://167.99.196.131/downloads/editron_0.1.0_aarch64.dmg', '_blank')}
              >
                <Apple className="w-8 h-8" />
                <div>
                  <div className="font-semibold">Download for macOS</div>
                  {/* <div className="text-sm opacity-90">macOS 10.15+</div> */}
                </div>
              </Button>
              
              <Button 
                size="lg" 
                variant="gradient" 
                className="text-lg px-8 py-6 h-auto flex flex-col items-center gap-3 cursor-pointer"
                onClick={() => window.open('https://example.com/download/windows', '_blank')}
              >
                <Monitor className="w-8 h-8" />
                <div>
                  <div className="font-semibold">Download for Windows</div>
                  {/* <div className="text-sm opacity-90">Windows 10+</div> */}
                </div>
              </Button>
            </div>

            <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg max-w-2xl mx-auto animate-fade-in-up delay-500">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 bg-yellow-500 rounded-full flex-shrink-0 mt-0.5"></div>
                <div className="text-left">
                  <h3 className="font-semibold text-yellow-400 mb-1">Important Notice</h3>
                  <p className="text-yellow-200 text-sm leading-relaxed">
                    Gmail API integration may not work due to Google's limitations on non-production applications. 
                    This is a known limitation during development and testing phases.
                  </p>
                </div>
              </div>
            </div>

            {/* <div className="mt-12 text-gray-400 text-sm">
              <p>System Requirements: 4GB RAM, 2GB free disk space</p>
              <p className="mt-2">Need help? <a href="/support" className="text-blue-400 hover:text-blue-300 underline">Contact Support</a></p>
            </div> */}
          </div>
        </div>
      </div>
    </div>
  )
} 