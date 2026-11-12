import { Types } from 'mongoose';

export type MotionStatus = 'MOVING' | 'IDLE' | 'STOPPED' | 'OFFLINE';
export type CoverageClassification = 'HIGH_COVERAGE' | 'PARTIAL_COVERAGE' | 'LOW_COVERAGE' | 'NO_DATA';

export interface RawTelemetryPoint {
  recordedAt: Date;
  motionStatus: MotionStatus;
  speedKmh?: number;
  odometerKm?: number;
}

export interface MotionIntervalResult {
  movingSeconds: number;
  idleSeconds: number;
  stoppedSeconds: number;
  unknownSeconds: number;
  totalObservedSeconds: number;
  movingHours: number;
  idleHours: number;
  stoppedHours: number;
  unknownHours: number;
  observedHours: number;
  eventCount: number;
}

export class TelemetryIntervalService {
  public static readonly DEFAULT_MAX_FRESHNESS_SECONDS = 300; // 5 minutes

  /**
   * Processes a sequence of raw telemetry points for a single vehicle within [windowStart, windowEnd]
   * and deterministically accumulates moving, idle, stopped, and unknown durations.
   */
  public static calculateMotionIntervals(
    events: RawTelemetryPoint[],
    windowStart: Date,
    windowEnd: Date,
    maxFreshnessSeconds: number = TelemetryIntervalService.DEFAULT_MAX_FRESHNESS_SECONDS
  ): MotionIntervalResult {
    const startMs = windowStart.getTime();
    const endMs = windowEnd.getTime();
    const totalWindowSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));

    if (totalWindowSeconds === 0 || !events || events.length === 0) {
      return {
        movingSeconds: 0,
        idleSeconds: 0,
        stoppedSeconds: 0,
        unknownSeconds: totalWindowSeconds,
        totalObservedSeconds: 0,
        movingHours: 0,
        idleHours: 0,
        stoppedHours: 0,
        unknownHours: roundHours(totalWindowSeconds / 3600),
        observedHours: 0,
        eventCount: 0,
      };
    }

    // 1. Filter events inside [windowStart, windowEnd] and sort chronologically
    const validEvents = events
      .filter((e) => {
        const t = new Date(e.recordedAt).getTime();
        return !isNaN(t) && t >= startMs && t <= endMs;
      })
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

    // 2. Deduplicate events with identical timestamps (keep latest non-stopped status if conflicting)
    const deduped: RawTelemetryPoint[] = [];
    for (const ev of validEvents) {
      const curTime = new Date(ev.recordedAt).getTime();
      if (deduped.length > 0) {
        const lastTime = new Date(deduped[deduped.length - 1].recordedAt).getTime();
        if (lastTime === curTime) {
          // If duplicate timestamp, prefer MOVING > IDLE > STOPPED
          if (ev.motionStatus === 'MOVING') {
            deduped[deduped.length - 1] = ev;
          }
          continue;
        }
      }
      deduped.push(ev);
    }

    if (deduped.length === 0) {
      return {
        movingSeconds: 0,
        idleSeconds: 0,
        stoppedSeconds: 0,
        unknownSeconds: totalWindowSeconds,
        totalObservedSeconds: 0,
        movingHours: 0,
        idleHours: 0,
        stoppedHours: 0,
        unknownHours: roundHours(totalWindowSeconds / 3600),
        observedHours: 0,
        eventCount: 0,
      };
    }

    let movingSec = 0;
    let idleSec = 0;
    let stoppedSec = 0;

    // 3. Iterate pairwise across adjacent points
    for (let i = 0; i < deduped.length - 1; i++) {
      const current = deduped[i];
      const next = deduped[i + 1];
      const t1 = new Date(current.recordedAt).getTime();
      const t2 = new Date(next.recordedAt).getTime();
      const deltaSec = Math.floor((t2 - t1) / 1000);

      const activeSpan = Math.min(deltaSec, maxFreshnessSeconds);

      if (current.motionStatus === 'MOVING') {
        movingSec += activeSpan;
      } else if (current.motionStatus === 'IDLE') {
        idleSec += activeSpan;
      } else {
        // STOPPED or OFFLINE
        stoppedSec += activeSpan;
      }
    }

    // 4. Handle final point: grant up to maxFreshnessSeconds until windowEnd
    const lastEvent = deduped[deduped.length - 1];
    const lastTimeMs = new Date(lastEvent.recordedAt).getTime();
    const remainingToWindowEnd = Math.floor((endMs - lastTimeMs) / 1000);
    const finalSpan = Math.min(Math.max(0, remainingToWindowEnd), maxFreshnessSeconds);

    if (lastEvent.motionStatus === 'MOVING') {
      movingSec += finalSpan;
    } else if (lastEvent.motionStatus === 'IDLE') {
      idleSec += finalSpan;
    } else {
      stoppedSec += finalSpan;
    }

    const totalObservedSec = Math.min(totalWindowSeconds, movingSec + idleSec + stoppedSec);
    const unknownSec = Math.max(0, totalWindowSeconds - totalObservedSec);

    return {
      movingSeconds: movingSec,
      idleSeconds: idleSec,
      stoppedSeconds: stoppedSec,
      unknownSeconds: unknownSec,
      totalObservedSeconds: totalObservedSec,
      movingHours: roundHours(movingSec / 3600),
      idleHours: roundHours(idleSec / 3600),
      stoppedHours: roundHours(stoppedSec / 3600),
      unknownHours: roundHours(unknownSec / 3600),
      observedHours: roundHours(totalObservedSec / 3600),
      eventCount: deduped.length,
    };
  }

  /**
   * Classifies telemetry coverage into standard enterprise quality tiers.
   */
  public static classifyCoverage(coveragePercent: number): CoverageClassification {
    if (coveragePercent >= 90) return 'HIGH_COVERAGE';
    if (coveragePercent >= 70) return 'PARTIAL_COVERAGE';
    if (coveragePercent > 0) return 'LOW_COVERAGE';
    return 'NO_DATA';
  }
}

function roundHours(val: number): number {
  return Math.round(val * 100) / 100;
}
