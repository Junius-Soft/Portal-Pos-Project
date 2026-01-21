"use client";

import React from "react";
import { useRegistration } from "@/contexts/RegistrationContext";
import { Check } from "lucide-react";

const steps = [
  { number: 1, label: "SERVICES" },
  { number: 2, label: "REGISTRATION DOCUMENTS" },
  { number: 3, label: "PAYMENT INFORMATION" },
  { number: 4, label: "COMPANY INFORMATION" },
];

export default function ProgressBar() {
  const { formData } = useRegistration();
  const currentStep = formData.currentStep;

  return (
    <div className="w-full mb-8">
      <div className="flex items-end relative">
        {steps.map((step, index) => {
          const isActive = currentStep === step.number;
          const isCompleted = currentStep > step.number;

          return (
            <React.Fragment key={step.number}>
              {/* Step Container - Label and Circle together */}
              <div className="flex flex-col items-center flex-1 relative">
                {/* Label above circle */}
                <div className="text-[10px] sm:text-xs font-bold text-gray-900 uppercase text-center mb-4 px-1 break-words leading-tight">
                  {step.label}
                </div>
                
                {/* Circle or Checkmark */}
                <div
                  className="rounded-full flex items-center justify-center transition-all relative z-10"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '20px',
                    backgroundColor: isCompleted ? '#39A845' : '#F4A023',
                    opacity: isCompleted || isActive ? 1 : 0.3,
                  }}
                >
                  {isCompleted ? (
                    <Check className="w-6 h-6 text-white" strokeWidth={3} />
                  ) : (
                    <span className="text-white font-bold text-sm">{step.number}</span>
                  )}
                </div>
              </div>

              {/* Connecting Line between circles - from right edge to left edge */}
              {index !== steps.length - 1 && (
                <div 
                  className="flex-auto border-t-2 transition-colors"
                  style={{
                    marginLeft: '-20px', // Start from previous circle's right edge
                    marginRight: '-20px', // End at next circle's left edge
                    marginBottom: '20px', // Align with circle center
                    borderColor: isCompleted ? '#39A845' : '#F4A023',
                    opacity: isCompleted ? 1 : (isActive ? 1 : 0.3),
                  }}
                >
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
