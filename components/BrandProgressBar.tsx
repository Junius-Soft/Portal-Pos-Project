"use client";

import { Check } from "lucide-react";

interface Step {
  number: number;
  title: string;
}

interface BrandProgressBarProps {
  currentStep: number;
  steps?: Step[];
}

const defaultSteps: Step[] = [
  { number: 1, title: "BRAND SELECTION" },
  { number: 2, title: "DELIVERY METHOD" },
  { number: 3, title: "AGREEMENTS" },
];

export default function BrandProgressBar({ currentStep, steps = defaultSteps }: BrandProgressBarProps) {
  return (
    <div className="w-full py-6 px-4 bg-white">
      <div className="flex items-center justify-center max-w-2xl mx-auto">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.number;
          const isCurrent = currentStep === step.number;
          
          return (
            <div key={step.number} className="flex items-center">
              {/* Step */}
              <div className="flex flex-col items-center">
                <span
                  className={`text-xs font-semibold mb-2 ${
                    isCompleted || isCurrent ? "text-gray-800" : "text-gray-400"
                  }`}
                >
                  {step.title}
                </span>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    isCompleted
                      ? "bg-green-500 text-white"
                      : isCurrent
                      ? "bg-orange-400 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    step.number
                  )}
                </div>
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div
                  className={`w-24 h-0.5 mx-2 mt-6 ${
                    isCompleted ? "bg-green-500" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
