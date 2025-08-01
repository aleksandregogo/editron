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
    description: "Full visibility before you commit. Preview clean diffs and keep complete control over structure and formatting.",
  },
  {
    icon: Mail,
    title: "Gmail Integration",
    description: "Bring email into your workflow. Draft and edit documents while staying connected—all with local privacy and cloud intelligence.",
  },
]

export function FeaturesSection() {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Why Choose Editron?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Built for professionals who demand both power and precision in their document workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="group hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
} 