# Driver Safety & Incident Workflows (Phase 09.1)

## 1. Principles & Fair Investigation Process
- An incident report is an investigative record, not proof of fault.
- To prevent unjustified penalties on drivers, reports start in `responsibilityStatus: 'UNDETERMINED'`.
- Only validated reviews formally establishing `DRIVER_RESPONSIBLE` or `SHARED_RESPONSIBILITY` impact safety scorecards.

## 2. Responsibility Status States
- `UNDETERMINED`: Initial default for new or in-progress incident reports. Zero scoring penalty.
- `DRIVER_NOT_RESPONSIBLE`: Exonerated (e.g. third-party collision, non-fault mechanical failure). Zero scoring penalty.
- `SHARED_RESPONSIBILITY`: Shared liability. Applies a 50% weighted deduction multiplier.
- `DRIVER_RESPONSIBLE`: Confirmed driver culpability. Applies 100% deduction.

## 3. Investigation State Machine
1. `OPEN`: Filed by dispatcher or operator. High or Critical severities trigger instant management alerts.
2. `UNDER_REVIEW`: Safety investigator analyzes evidence, dashcam/telemetry logs, and reports.
3. `RESOLVED`: Requires mandatory `resolutionNotes` ($\ge 5$ characters) and explicit attribution of `responsibilityStatus`. Stamped with `resolvedAt` and `reviewedBy`.
4. `CLOSED`: Final audit sign-off.
