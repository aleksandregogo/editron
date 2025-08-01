import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FolderOpen, Bot, Eye, Mail } from "lucide-react"

const features = [
  {
    icon: FolderOpen,
    title: "Project Workspaces",
    description: "Your Work, Perfectly Organized. Organize your work into projects with custom instructions to give the AI true context.",
  },
  {
    icon: Bot,
    title: "AI Agent Mode",
    description: "An AI Co-Editor at Your Command. Our AI reads the whole document, not just snippets, for smarter, more consistent edits.",
  },
  {
    icon: Eye,
    title: "Agent Review Mode",
    description: "Full Control, Perfect Results. Never lose formatting again. Editron is built to respect the integrity of your DOCX files.",
  },
  {
    icon: Mail,
    title: "Gmail Integration",
    description: "Connect Your Workflow. Your documents are processed securely, combining desktop privacy with cloud-powered intelligence.",
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