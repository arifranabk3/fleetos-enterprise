# FleetOS — Fuel Efficiency Methodology

## 1. Liquid Fuel (Full-to-Full Cycle)
Fuel consumption calculations in commercial fleet haulage require complete boundary cycles to ensure statistical validity.

### Boundary Principles:
1. **Starting Full-Tank Boundary ($T_0$):** Tank filled to 100% capacity at odometer $O_0$.
2. **Intervening Partial Refuels ($P_1, P_2, \dots$):** Drivers top-off intermediate liters ($L_{p1}, L_{p2}, \dots$) to continue driving without full tanks. These are tagged `ESTIMATED` with `calculationMethod: 'INTERMEDIATE_PARTIAL'`.
3. **Ending Full-Tank Boundary ($T_1$):** Tank filled to 100% capacity at odometer $O_1$ with liters $L_{full}$.

$$\text{Total Distance} = O_1 - O_0$$
$$\text{Total Fuel Consumed} = \sum L_p + L_{full}$$
$$\text{True Verified Efficiency (km/L)} = \frac{O_1 - O_0}{\sum L_p + L_{full}}$$

Status: **`VERIFIED`** (Method: `FULL_TO_FULL`).

## 2. Electric Vehicles (EV)
Electric trucks report energy delivered during charging sessions:
$$\text{EV Efficiency (km/kWh)} = \frac{\Delta \text{Odometer}}{\text{Energy Charged (kWh)}}$$
Status: **`VERIFIED`** for full charges, **`ESTIMATED`** for partial charging sessions.
Method: `EV_CHARGING_SESSION`.

## 3. Reliability Categorization
- `VERIFIED`: Tank-to-tank full cycles and verified full EV charges.
- `ESTIMATED`: Interim partial refuels and zero-distance top-offs.
- `UNAVAILABLE`: Missing baselines, negative distances, or odometer rollbacks.

