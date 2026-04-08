"use client";

interface Step {
  label: string;
}

interface Props {
  steps: Step[];
  currentStep: number; // 0-indexed
  status?: "active" | "failed";
}

export function StepProgress({ steps, currentStep, status = "active" }: Props) {
  return (
    <div className="mb-8">
      {/* Horizontal layout (sm and up) */}
      <div className="hidden sm:grid" style={{ gridTemplateColumns: `repeat(${steps.length * 2 - 1}, auto)` }}>
        {/* Row 1: circles and connectors */}
        {steps.map((step, i) => {
          const isCompleted = i < currentStep;
          const isCurrent = i === currentStep;
          const isFailed = isCurrent && status === "failed";

          return (
            <div key={`circle-${step.label}`} className="contents">
              {/* Circle */}
              <div className="flex justify-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all duration-300 ${
                    isCompleted
                      ? "bg-success border-success text-white"
                      : isFailed
                      ? "bg-danger/20 border-danger text-danger"
                      : isCurrent
                      ? "bg-accent/20 border-accent text-accent animate-step-glow"
                      : "bg-glass border-glass-border text-text-muted"
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isFailed ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
              </div>

              {/* Connector */}
              {i < steps.length - 1 && (
                <div className="flex items-center px-2">
                  <div
                    className={`h-1 w-full min-w-[2rem] rounded-full transition-all duration-500 ${
                      i < currentStep ? "bg-success" : "bg-glass-border"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Row 2: labels */}
        {steps.map((step, i) => {
          const isCompleted = i < currentStep;
          const isCurrent = i === currentStep;
          const isFailed = isCurrent && status === "failed";

          return (
            <div key={`label-${step.label}`} className="contents">
              <div className="flex justify-center mt-2">
                <span
                  className={`text-xs font-medium whitespace-nowrap ${
                    isCompleted
                      ? "text-success"
                      : isFailed
                      ? "text-danger"
                      : isCurrent
                      ? "text-accent"
                      : "text-text-muted"
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Empty cell for connector column */}
              {i < steps.length - 1 && <div />}
            </div>
          );
        })}
      </div>

      {/* Vertical layout (below sm) */}
      <div className="flex flex-col sm:hidden">
        {steps.map((step, i) => {
          const isCompleted = i < currentStep;
          const isCurrent = i === currentStep;
          const isFailed = isCurrent && status === "failed";

          return (
            <div key={step.label}>
              <div className="flex items-center gap-3">
                {/* Circle */}
                <div
                  className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all duration-300 ${
                    isCompleted
                      ? "bg-success border-success text-white"
                      : isFailed
                      ? "bg-danger/20 border-danger text-danger"
                      : isCurrent
                      ? "bg-accent/20 border-accent text-accent animate-step-glow"
                      : "bg-glass border-glass-border text-text-muted"
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isFailed ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>

                {/* Label */}
                <span
                  className={`text-sm font-medium ${
                    isCompleted
                      ? "text-success"
                      : isFailed
                      ? "text-danger"
                      : isCurrent
                      ? "text-accent"
                      : "text-text-muted"
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Vertical connector */}
              {i < steps.length - 1 && (
                <div className="ml-[1.0625rem] my-1">
                  <div
                    className={`w-1 h-6 rounded-full transition-all duration-500 ${
                      i < currentStep ? "bg-success" : "bg-glass-border"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
