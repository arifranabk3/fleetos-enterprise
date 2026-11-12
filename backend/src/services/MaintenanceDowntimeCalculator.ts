export interface RawMaintenanceSpan {
  startedDate?: Date;
  scheduledDate: Date;
  completedDate?: Date;
  status: string;
}

export interface MaintenanceDowntimeResult {
  totalDowntimeSeconds: number;
  totalDowntimeHours: number;
  affectedVehicleCount: number;
  maintenanceEventCount: number;
}

export class MaintenanceDowntimeCalculator {
  /**
   * Calculates total non-overlapping maintenance downtime within [windowStart, windowEnd].
   * Safely merges overlapping intervals to prevent double-counting.
   */
  public static calculateDowntime(
    records: RawMaintenanceSpan[],
    windowStart: Date,
    windowEnd: Date
  ): { downtimeSeconds: number; downtimeHours: number; eventCount: number } {
    const startMs = windowStart.getTime();
    const endMs = windowEnd.getTime();

    if (!records || records.length === 0 || endMs <= startMs) {
      return { downtimeSeconds: 0, downtimeHours: 0, eventCount: 0 };
    }

    // Filter relevant records (exclude CANCELLED)
    const validRecords = records.filter(
      (r) => r.status !== 'CANCELLED' && r.status !== 'SCHEDULED'
    );

    const intervals: Array<{ start: number; end: number }> = [];

    for (const rec of validRecords) {
      // Determine effective start: prefer startedDate, fallback to scheduledDate
      const rawStart = rec.startedDate || rec.scheduledDate;
      const recStartMs = new Date(rawStart).getTime();

      // Determine effective end: prefer completedDate, fallback to now or windowEnd if in progress
      let recEndMs = rec.completedDate ? new Date(rec.completedDate).getTime() : Date.now();

      // Clip to [windowStart, windowEnd]
      const clippedStart = Math.max(startMs, recStartMs);
      const clippedEnd = Math.min(endMs, recEndMs);

      if (clippedEnd > clippedStart) {
        intervals.push({ start: clippedStart, end: clippedEnd });
      }
    }

    if (intervals.length === 0) {
      return { downtimeSeconds: 0, downtimeHours: 0, eventCount: validRecords.length };
    }

    // Sort intervals by start ASC
    intervals.sort((a, b) => a.start - b.start);

    // Merge overlapping intervals
    const merged: Array<{ start: number; end: number }> = [intervals[0]];
    for (let i = 1; i < intervals.length; i++) {
      const current = intervals[i];
      const previous = merged[merged.length - 1];

      if (current.start <= previous.end) {
        // Overlap: extend previous boundary
        previous.end = Math.max(previous.end, current.end);
      } else {
        merged.push(current);
      }
    }

    // Sum merged durations
    let totalMs = 0;
    for (const interval of merged) {
      totalMs += interval.end - interval.start;
    }

    const totalSeconds = Math.floor(totalMs / 1000);
    const totalHours = Math.round((totalSeconds / 3600) * 100) / 100;

    return {
      downtimeSeconds: totalSeconds,
      downtimeHours: totalHours,
      eventCount: validRecords.length,
    };
  }
}
