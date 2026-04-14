export type TelemetryEventProperties = Record<string, string | number | boolean | null | undefined>;

type TrackEventInput = {
  eventName: string;
  properties?: TelemetryEventProperties;
  path?: string;
  referrer?: string;
};

export function trackEvent(input: TrackEventInput) {
  if (typeof window === 'undefined') return;

  const payload = JSON.stringify({
    eventName: input.eventName,
    properties: input.properties ?? {},
    path: input.path ?? window.location.pathname,
    referrer: input.referrer ?? document.referrer ?? null,
    createdAt: new Date().toISOString(),
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/telemetry', new Blob([payload], { type: 'application/json' }));
    return;
  }

  void fetch('/api/telemetry', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}