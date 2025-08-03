import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FolderOpen, Bot, Eye, Mail } from "lucide-react"

const features = [
  {
    icon: FolderOpen,
    title: "Project Workspaces",
    description: "Organize your work into focused projects with custom AI instructions. Give the assistant full context—once, not over and over.",
  },
  {
    icon: Bot,
    title: "AI Agent Mode",
    description: "Let AI act as your co-editor. It reads your entire document—not just snippets—for accurate, consistent changes.",
  },
  {
    icon: Eye,
    title: "Agent Review Mode",
    description: "Full visibility before you apply. Preview clean diffs and keep complete control over structure and formatting.",
  },
  {
    icon: Mail,
    title: "Gmail Integration",
    description: "Bring email into your workflow. Draft and edit documents while staying connected—all with local privacy and cloud intelligence.",
  },
]

export function FeaturesSection() {
  return (
    <section className="py-20 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Why Choose{" "}
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Editron?
            </span>
          </h2>
          {/* <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Built for professionals who demand both power and precision in their document workflow.
          </p> */}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="group">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-white/20 transition-all duration-300 hover:scale-105 h-full">
                <div className="text-center">
                  <div className="mx-auto mb-6 w-16 h-16 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-2xl flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform duration-200">
                    <feature.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4">
                    {feature.title}
                  </h3>
                  <p className="text-gray-300 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
} 