export function shouldTriggerHighSeverityAlert(input: { alertingEnabled: boolean; threshold: number; matchedEventCount: number }) {
  return input.alertingEnabled && input.threshold > 0 && input.matchedEventCount === input.threshold;
}
