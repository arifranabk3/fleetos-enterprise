# Shipment Lifecycle State Machine

## Deterministic State Transition Matrix

The table below details all permitted state transitions enforced by `ShipmentStateMachine`:

| Current Status | Allowed Next Statuses | Transition Requirements & Safeguards |
| :--- | :--- | :--- |
| `DRAFT` | `PENDING_DISPATCH`, `CONFIRMED`, `CANCELLED` | Initial order intake state. Can be confirmed directly by dispatcher. |
| `PENDING_DISPATCH` | `CONFIRMED`, `READY_FOR_DISPATCH`, `CANCELLED`, `ON_HOLD` | Awaiting commercial confirmation or holding. |
| `CONFIRMED` | `READY_FOR_DISPATCH`, `DISPATCHED`, `CANCELLED`, `ON_HOLD` | Order validated; eligible to be bound to a Dispatch Manifest. |
| `READY_FOR_DISPATCH`| `DISPATCHED`, `CANCELLED`, `ON_HOLD` | Manifest queued. |
| `DISPATCHED` | `IN_TRANSIT`, `DELAYED`, `CANCELLED`, `ON_HOLD` | Bound to vehicle and driver. |
| `IN_TRANSIT` | `ARRIVED_AT_DESTINATION`, `OUT_FOR_DELIVERY`, `DELIVERED`, `DELAYED`, `FAILED_DELIVERY`, `ON_HOLD` | Fleet asset is rolling on route. |
| `ARRIVED_AT_DESTINATION` | `OUT_FOR_DELIVERY`, `DELIVERED`, `DELAYED`, `ON_HOLD`, `RETURNED` | Reached local receiving facility or terminal hub. |
| `OUT_FOR_DELIVERY` | `DELIVERED`, `FAILED_DELIVERY`, `DELAYED`, `ON_HOLD` | Final-mile delivery vehicle dispatch. |
| `DELIVERED` | *None* | **Terminal State.** Proof of delivery recorded. |
| `ON_HOLD` | `PENDING_DISPATCH`, `CONFIRMED`, `READY_FOR_DISPATCH`, `DISPATCHED`, `IN_TRANSIT`, `CANCELLED` | Requires documented operational justification. |
| `DELAYED` | `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `FAILED_DELIVERY`, `ON_HOLD` | Exceptional status; requires delay reason. |
| `FAILED_DELIVERY` | `OUT_FOR_DELIVERY`, `RETURNED`, `CANCELLED`, `ON_HOLD` | Exceptional status. Can retry delivery or return. |
| `CANCELLED` | *None* | **Terminal State.** Requires cancellation reason and authorized role. |
| `RETURNED` | *None* | **Terminal State.** Freight returned to shipper. |

## Terminal States
Once a shipment reaches `DELIVERED`, `CANCELLED`, or `RETURNED`, no subsequent status transitions are permitted.
