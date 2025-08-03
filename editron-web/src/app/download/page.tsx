"use client"

import { Button } from "@/components/ui/button"
import { Apple, Monitor, AlertCircle, CheckCircle } from "lucide-react"
import { useState } from "react"

interface DownloadInfo {
  platform: string
  version: string
  size: string
  url: string
  available: boolean
}

const downloads: DownloadInfo[] = [
  {
    platform: "macOS",
    version: "0.1.0",
    size: "5.9MB",
    url: "https://drive.google.com/file/d/1rlfXo2oaQ2ogsO-ahPuLP6TZZFs-olOO/view?usp=sharing",
    available: true
  },
  {
    platform: "Windows",
    version: "0.1.0", 
    size: "5.3MB",
    url: "https://drive.google.com/file/d/1oiu2EwC7MEsYgZQ2WAALv75P0jaxlpzK/view?usp=sharinge",
    available: true
  }
]

export default function DownloadPage() {
  const [downloading, setDownloading] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const handleDownload = async (download: DownloadInfo) => {
    if (!download.available) {
      setDownloadError("This version is not yet available. Please check back soon!")
      return
    }

    setDownloading(download.platform)
    setDownloadError(null)

    try {
      // Create a temporary link element to trigger download
      const link = document.createElement('a')
      link.href = download.url
      link.download = `editron-${download.version}-${download.platform.toLowerCase()}.${download.platform === 'macOS' ? 'dmg' : 'exe'}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Simulate download completion
      setTimeout(() => {
        setDownloading(null)
      }, 2000)
    } catch (error) {
      setDownloadError("Download failed. Please try again or contact support.")
      setDownloading(null)
    }
  }

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
              {downloads.map((download) => (
                <div key={download.platform} className="relative">
                  <Button 
                    size="lg" 
                    variant={download.available ? "gradient" : "outline"}
                    className={`text-lg px-8 py-6 h-auto flex flex-col items-center gap-3 cursor-pointer w-full ${
                      !download.available ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                    onClick={() => handleDownload(download)}
                    disabled={!download.available || downloading === download.platform}
                  >
                    {downloading === download.platform ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    ) : download.platform === "macOS" ? (
                      <Apple className="w-8 h-8" />
                    ) : (
                      <Monitor className="w-8 h-8" />
                    )}
                    <div>
                      <div className="font-semibold">
                        {downloading === download.platform ? "Downloading..." : `Download for ${download.platform}`}
                      </div>
                      <div className="text-sm opacity-90">
                        v{download.version} • {download.size}
                      </div>
                    </div>
                  </Button>
                  
                  {!download.available && (
                    <div className="absolute -top-2 -right-2 bg-yellow-500 text-yellow-900 text-xs px-2 py-1 rounded-full font-medium">
                      Coming Soon
                    </div>
                  )}
                </div>
              ))}
            </div>

            {downloadError && (
              <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg max-w-2xl mx-auto animate-fade-in-up">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-left">
                    <h3 className="font-semibold text-red-400 mb-1">Download Error</h3>
                    <p className="text-red-200 text-sm leading-relaxed">
                      {downloadError}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg max-w-2xl mx-auto animate-fade-in-up delay-500">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 bg-yellow-500 rounded-full flex-shrink-0 mt-0.5"></div>
                <div className="text-left">
                  <h3 className="font-semibold text-yellow-400 mb-1">Important Notice</h3>
                  <p className="text-yellow-200 text-sm leading-relaxed">
                    Gmail API integration may not work due to Google&apos;s limitations on non-production applications. 
                    This is a known limitation during development and testing phases.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 