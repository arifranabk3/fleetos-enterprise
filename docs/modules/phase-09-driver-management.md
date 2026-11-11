# Phase 09: Driver Performance, Safety & Workforce Management Architecture

## 1. Overview
Phase 09 introduces an enterprise-grade Driver and Workforce Management subsystem into FLEETOS. It provides comprehensive CDL profile enhancements, qualification document compliance tracking, mutual-exclusion assignment history, shift and attendance scheduling, a 4-pillar transparent performance scorecard engine, and structured safety incident review workflows.

## 2. Core Modules
- **Driver Profile Enhancement:** Extended `Driver` model with reference numbers, CDL classifications, endorsements, emergency contacts, depot assignments, and strict status state machines.
- **DriverDocument Model:** Tracks CDL, medical fitness certificates (DOT/FMCSA), and training certifications with automated 30-day expiry notifications and deduplication.
- **Mutual-Exclusion Assignment History:** Prevents simultaneous active vehicle assignments and tracks starting/ending odometer readings.
- **Shift & Duty Lifecycle:** Enforces planned UTC windows, prevents overlapping scheduled shifts, detects late duty starts (>15 min), and calculates duration and overtime.
- **DriverPerformanceEngine:** Computes transparent composite scores ($0-100$) across 4 weighted pillars (Delivery Reliability, Safety, Attendance, and Document Compliance) while strictly excluding cancelled orders and flagging insufficient data.
- **DriverIncident Model & Safety Workflow:** Documents objective safety reports across accidents, violations, and cargo damages with an investigative review and resolution workflow.
