import { AnimatePresence, motion, type Variants } from 'motion/react'
import React, { Children, type HTMLAttributes, type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import css from './Stepper.module.css'

interface StepperProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  initialStep?: number
  onStepChange?: (step: number) => void
  onFinalStepCompleted?: () => void
  backButtonText?: string
  nextButtonText?: string
  disableStepIndicators?: boolean
  /** Callback that returns true when Next should be disabled for the given step (1-based) */
  isNextDisabled?: (step: number) => boolean
}

export default function Stepper({
  children,
  initialStep = 1,
  onStepChange = () => {},
  onFinalStepCompleted = () => {},
  backButtonText = 'Back',
  nextButtonText = 'Continue',
  disableStepIndicators = false,
  isNextDisabled,
  ...rest
}: StepperProps) {
  const [currentStep, setCurrentStep] = useState(initialStep)
  const [direction, setDirection] = useState(0)
  const stepsArray = Children.toArray(children)
  const totalSteps = stepsArray.length
  const isCompleted = currentStep > totalSteps
  const isLastStep = currentStep === totalSteps

  const updateStep = (n: number) => {
    setCurrentStep(n)
    if (n > totalSteps) onFinalStepCompleted()
    else onStepChange(n)
  }

  const nextBlocked = isNextDisabled ? isNextDisabled(currentStep) : false
  const handleBack = () => { if (currentStep > 1) { setDirection(-1); updateStep(currentStep - 1) } }
  const handleNext = () => { if (!isLastStep && !nextBlocked) { setDirection(1); updateStep(currentStep + 1) } }
  const handleComplete = () => { if (!nextBlocked) { setDirection(1); updateStep(totalSteps + 1) } }

  return (
    <div className={css.outer} {...rest}>
      <div className={css.circleContainer}>
        <div className={css.indicatorRow}>
          {stepsArray.map((_, i) => {
            const step = i + 1
            return (
              <React.Fragment key={step}>
                <StepIndicator
                  step={step}
                  currentStep={currentStep}
                  disabled={disableStepIndicators}
                  onClickStep={(s) => {
                    // Block jumping forward past a step that requires completion
                    if (s > currentStep && isNextDisabled) {
                      for (let check = currentStep; check < s; check++) {
                        if (isNextDisabled(check)) return
                      }
                    }
                    setDirection(s > currentStep ? 1 : -1); updateStep(s)
                  }}
                />
                {i < totalSteps - 1 && <StepConnector isComplete={currentStep > step} />}
              </React.Fragment>
            )
          })}
        </div>

        <StepContentWrapper isCompleted={isCompleted} currentStep={currentStep} direction={direction}>
          {stepsArray[currentStep - 1]}
        </StepContentWrapper>

        {!isCompleted && (
          <div className={css.footer}>
            <div className={`${css.footerNav} ${currentStep !== 1 ? css.spread : css.end}`}>
              {currentStep !== 1 && (
                <button onClick={handleBack} className={css.backBtn}>{backButtonText}</button>
              )}
              <button onClick={isLastStep ? handleComplete : handleNext} className={css.nextBtn}>
                {isLastStep ? 'Complete' : nextButtonText}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function Step({ children }: { children: ReactNode }) {
  return <div className={css.stepContent}>{children}</div>
}

// --- Internal components ---

function StepContentWrapper({ isCompleted, currentStep, direction, children }: {
  isCompleted: boolean; currentStep: number; direction: number; children: ReactNode
}) {
  const [h, setH] = useState(0)
  return (
    <motion.div
      className={css.contentWrapper}
      style={{ position: 'relative', overflow: 'hidden' }}
      animate={{ height: isCompleted ? 0 : h }}
      transition={{ type: 'spring', duration: 0.4 }}
    >
      <AnimatePresence initial={false} mode="sync" custom={direction}>
        {!isCompleted && (
          <SlideTransition key={currentStep} direction={direction} onHeight={setH}>
            {children}
          </SlideTransition>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

const variants: Variants = {
  enter: (dir: number) => ({ x: dir >= 0 ? '-100%' : '100%', opacity: 0 }),
  center: { x: '0%', opacity: 1 },
  exit: (dir: number) => ({ x: dir >= 0 ? '50%' : '-50%', opacity: 0 }),
}

function SlideTransition({ children, direction, onHeight }: {
  children: ReactNode; direction: number; onHeight: (h: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => { if (ref.current) onHeight(ref.current.offsetHeight) }, [children, onHeight])
  return (
    <motion.div ref={ref} custom={direction} variants={variants}
      initial="enter" animate="center" exit="exit" transition={{ duration: 0.4 }}
      style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
    >
      {children}
    </motion.div>
  )
}

function StepIndicator({ step, currentStep, onClickStep, disabled }: {
  step: number; currentStep: number; onClickStep: (s: number) => void; disabled?: boolean
}) {
  const status = currentStep === step ? 'active' : currentStep < step ? 'inactive' : 'complete'
  return (
    <motion.div onClick={() => !disabled && step !== currentStep && onClickStep(step)}
      className={css.indicator} animate={status} initial={false}
    >
      <motion.div
        variants={{
          inactive: { scale: 1, backgroundColor: '#222', color: '#a3a3a3' },
          active: { scale: 1, backgroundColor: '#3B82F6', color: '#3B82F6' },
          complete: { scale: 1, backgroundColor: '#3B82F6', color: '#3B82F6' },
        }}
        transition={{ duration: 0.3 }}
        className={css.indicatorInner}
      >
        {status === 'complete' ? (
          <svg className={css.checkIcon} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
              transition={{ delay: 0.1, type: 'tween', ease: 'easeOut', duration: 0.3 }}
              strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"
            />
          </svg>
        ) : status === 'active' ? (
          <div className={css.activeDot} />
        ) : (
          <span className={css.stepNum}>{step}</span>
        )}
      </motion.div>
    </motion.div>
  )
}

function StepConnector({ isComplete }: { isComplete: boolean }) {
  return (
    <div className={css.connector}>
      <motion.div className={css.connectorInner}
        variants={{ incomplete: { width: 0, backgroundColor: 'transparent' }, complete: { width: '100%', backgroundColor: '#3B82F6' } }}
        initial={false} animate={isComplete ? 'complete' : 'incomplete'} transition={{ duration: 0.4 }}
      />
    </div>
  )
}
