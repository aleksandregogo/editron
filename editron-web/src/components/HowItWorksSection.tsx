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
]

export function HowItWorksSection() {
  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            How It Works
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Experience the future of document editing with our intuitive three-step process.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="text-center">
                  <div className="mx-auto mb-6 w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                    {step.number}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {step.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>
                
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-16 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600 transform -translate-y-1/2">
                    <ArrowRight className="absolute right-0 top-1/2 transform -translate-y-1/2 w-4 h-4 text-purple-600" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Visual demo mockup */}
          <div className="mt-16 bg-white rounded-2xl shadow-xl p-8 max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <div className="text-sm text-gray-500">Agent Review Mode</div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="h-4 bg-green-200 rounded w-3/4"></div>
                  <div className="h-3 bg-green-100 rounded w-1/2 mt-1"></div>
                </div>
              </div>
              
              <div className="flex items-center space-x-4 p-4 bg-red-50 rounded-lg">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                </div>
                <div className="flex-1">
                  <div className="h-4 bg-red-200 rounded w-1/2"></div>
                  <div className="h-3 bg-red-100 rounded w-1/4 mt-1"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
} 