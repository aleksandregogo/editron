"use client"

import { Button } from "@/components/ui/button"
import { Apple, Monitor, AlertCircle, Download } from "lucide-react"
import { useState } from "react"

interface DownloadInfo {
  platform: string
  version: string
  size: string
  url: string
  available: boolean
  architecture?: string
}

const downloads: DownloadInfo[] = [
  {
    platform: "macOS",
    version: "0.1.0",
    size: "5.8MB",
    url: "https://pub-075671a95f4140f4ad7316e2da06f730.r2.dev/editron_0.1.0_x64.dmg",
    available: true,
    architecture: "Apple Silicon (M1/M2/M3)"
  },
  {
    platform: "macOS",
    version: "0.1.0",
    size: "6.1MB",
    url: "https://pub-075671a95f4140f4ad7316e2da06f730.r2.dev/editron_0.1.0_x64.dmg",
    available: true,
    architecture: "Intel"
  },
  {
    platform: "Windows",
    version: "0.1.0",
    size: "5.3MB",
    url: "https://pub-075671a95f4140f4ad7316e2da06f730.r2.dev/editron_0.1.0_x64_en-US.msi",
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

    setDownloading(download.platform + (download.architecture ? `-${download.architecture}` : ''))
    setDownloadError(null)

    try {
      // Create a temporary link element to trigger download
      const link = document.createElement('a')
      link.href = download.url
      const fileName = download.architecture
        ? `editron-${download.version}-${download.platform.toLowerCase()}-${download.architecture.toLowerCase().replace(/[^a-z0-9]/g, '-')}.dmg`
        : `editron-${download.version}-${download.platform.toLowerCase()}.${download.platform === 'macOS' ? 'dmg' : 'exe'}`
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Simulate download completion
      setTimeout(() => {
        setDownloading(null)
      }, 2000)
    } catch {
      setDownloadError("Download failed. Please try again or contact support.")
      setDownloading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="text-center px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
          <div className="animate-fade-in-up">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Download{" "}
              <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                Editron
              </span>
            </h1>

            <p className="text-xl sm:text-2xl text-gray-300 mb-16 max-w-3xl mx-auto leading-relaxed">
              Get the desktop application that transforms how you work with documents.
              Available for macOS and Windows.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto animate-fade-in-up delay-300">
              {downloads.map((download) => (
                <div key={download.platform + (download.architecture ? `-${download.architecture}` : '')} className="relative group">
                  <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:bg-white/10 hover:border-white/20 transition-all duration-300 hover:scale-105 w-full h-80 flex flex-col justify-between">
                    {/* Platform Icon */}
                    <div className="flex items-center justify-center mb-6">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-2xl flex items-center justify-center border border-white/10">
                        {downloading === (download.platform + (download.architecture ? `-${download.architecture}` : '')) ? (
                          <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/30 border-t-white"></div>
                        ) : download.platform === "macOS" ? (
                          <Apple className="w-8 h-8 text-white" />
                        ) : (
                          <Monitor className="w-8 h-8 text-white" />
                        )}
                      </div>
                    </div>

                    {/* Platform Info */}
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-bold text-white mb-2">
                        {download.platform}
                      </h3>
                      {download.architecture && (
                        <p className="text-sm text-blue-300 font-medium mb-2">
                          {download.architecture}
                        </p>
                      )}
                      <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
                        <span>v{download.version}</span>
                        <span>•</span>
                        <span>{download.size}</span>
                      </div>
                    </div>

                    {/* Download Button */}
                    <Button
                      size="lg"
                      className={`w-full h-14 text-lg font-semibold rounded-xl transition-all duration-300 ${download.available
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg hover:shadow-xl hover:scale-105'
                          : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                        }`}
                      onClick={() => handleDownload(download)}
                      disabled={!download.available || downloading === (download.platform + (download.architecture ? `-${download.architecture}` : ''))}
                    >
                      {downloading === (download.platform + (download.architecture ? `-${download.architecture}` : '')) ? (
                        <div className="flex items-center gap-3">
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                          <span>Downloading...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 cursor-pointer">
                          <Download className="w-5 h-5" />
                          <span>Download Now</span>
                        </div>
                      )}
                    </Button>

                    {/* Coming Soon Badge */}
                    {!download.available && (
                      <div className="absolute -top-3 -right-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs px-3 py-1 rounded-full font-semibold shadow-lg">
                        Coming Soon
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {downloadError && (
              <div className="mt-8 p-6 bg-red-500/10 border border-red-500/20 rounded-2xl max-w-2xl mx-auto animate-fade-in-up">
                <div className="flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                  <div className="text-left">
                    <h3 className="font-semibold text-red-400 mb-2 text-lg">Download Error</h3>
                    <p className="text-red-200 text-base leading-relaxed">
                      {downloadError}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 p-6 bg-orange-500/10 border border-orange-500/20 rounded-2xl max-w-3xl mx-auto animate-fade-in-up delay-600">
              <div className="flex items-start gap-4">
                <div className="w-6 h-6 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex-shrink-0 mt-1"></div>
                <div className="text-left">
                  <h3 className="font-semibold text-orange-400 mb-2 text-lg">Installation Warning</h3>
                  <p className="text-orange-200 text-base leading-relaxed mb-4">
                    The application is not code-signed yet. During installation, your system may show security warnings.
                    You&apos;ll need to bypass these warnings to continue with the installation. This is normal for development builds.
                  </p>
                  
                  <div className="space-y-4">
                    <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-4">
                      <h4 className="font-semibold text-orange-300 mb-2 flex items-center gap-2">
                        <Apple className="w-4 h-4" />
                        macOS Instructions
                      </h4>
                      <div className="text-orange-200 text-sm space-y-2">
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>Open System Settings → Privacy & Security</li>
                          <li>Scroll down to the &quot;Security&quot; section</li>
                          <li>You&apos;ll see a message: &quot;Editron was blocked from use because it is not from an identified developer.&quot;</li>
                          <li>Click &quot;Allow Anyway&quot;</li>
                          <li>Try opening the app again. You&apos;ll now get the option to Open</li>
                        </ol>
                      </div>
                    </div>
                    
                    <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-4">
                      <h4 className="font-semibold text-orange-300 mb-2 flex items-center gap-2">
                        <Monitor className="w-4 h-4" />
                        Windows Instructions
                      </h4>
                      <div className="text-orange-200 text-sm">
                        <p>When Windows shows a security warning, click <strong>&quot;More info&quot;</strong> and then <strong>&quot;Run anyway&quot;</strong> to continue with the installation.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-6 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl max-w-3xl mx-auto animate-fade-in-up delay-500">
              <div className="flex items-start gap-4">
                <div className="w-6 h-6 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex-shrink-0 mt-1"></div>
                <div className="text-left">
                  <h3 className="font-semibold text-yellow-400 mb-2 text-lg">Important Notice</h3>
                  <p className="text-yellow-200 text-base leading-relaxed">
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