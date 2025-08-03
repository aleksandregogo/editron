import { CheckCircle, ArrowRight } from "lucide-react"

const steps = [
  {
    number: "1",
    title: "Type Your Prompt",
    description: "Describe what you want to change or add to your document in natural language.",
  },
  {
    number: "2",
    title: "AI Generates Changes",
    description: "Our AI analyzes your entire document and suggests precise edits with full context.",
  },
  {
    number: "3",
    title: "Review & Accept",
    description: "See exactly what will change with a clear diff view. Accept, modify, or reject changes.",
  },
  {
    number: "4",
    title: "Send with Gmail",
    description: "Once ready, send your document directly via Gmail—without leaving Editron.",
  },
]

export function HowItWorksSection() {
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
            How It{" "}
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Works
            </span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Experience the future of document editing with our intuitive three-step process.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="text-center group">
                  <div className="mx-auto mb-6 w-16 h-16 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-2xl flex items-center justify-center border border-white/10 text-white text-xl font-bold group-hover:scale-110 transition-transform duration-200">
                    {step.number}
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">
                    {step.title}
                  </h3>
                  <p className="text-gray-300 leading-relaxed">
                    {step.description}
                  </p>
                </div>
                
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-16 h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 transform -translate-y-1/2">
                    <ArrowRight className="absolute right-0 top-1/2 transform -translate-y-1/2 w-4 h-4 text-indigo-600" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Visual demo mockup */}
          <div className="mt-16 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <div className="text-sm text-gray-300">Agent Review Mode</div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center border border-green-500/30">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                </div>
                <div className="flex-1">
                  <div className="h-4 bg-green-200/30 rounded w-3/4"></div>
                  <div className="h-3 bg-green-100/30 rounded w-1/2 mt-1"></div>
                </div>
              </div>
              
              <div className="flex items-center space-x-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/30">
                  <div className="w-4 h-4 bg-red-400 rounded"></div>
                </div>
                <div className="flex-1">
                  <div className="h-4 bg-red-200/30 rounded w-1/2"></div>
                  <div className="h-3 bg-red-100/30 rounded w-1/4 mt-1"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
} 