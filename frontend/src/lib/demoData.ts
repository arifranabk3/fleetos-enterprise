export interface DemoVehicle {
  id: string;
  plate: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  type: string;
  capacityKg: number;
  status: 'AVAILABLE' | 'IN_TRANSIT' | 'MAINTENANCE' | 'ASSIGNED';
  driver: string;
  location: string;
  speedKmh?: number;
  batteryFuel: number;
  lat: number;
  lng: number;
}

export interface DemoShipment {
  id: string;
  tracking: string;
  customer: string;
  origin: string;
  destination: string;
  weightKg: number;
  status: 'DRAFT' | 'PENDING' | 'CONFIRMED' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
  driver: string;
  vehiclePlate: string;
  eta: string;
  progressPercent: number;
}

export interface DemoDriver {
  id: string;
  name: string;
  licenseNumber: string;
  status: 'AVAILABLE' | 'DRIVING' | 'OFF_DUTY';
  assignedVehicle: string;
  rating: number;
  phone: string;
  tripsCompleted: number;
}

export const DEMO_VEHICLES: DemoVehicle[] = [
  {
    id: 'veh-01',
    plate: 'FLT-8890',
    vin: '1M8GDM9A4KP048291',
    make: 'Volvo',
    model: 'VNL 860',
    year: 2024,
    type: 'Heavy Semi-Truck',
    capacityKg: 36000,
    status: 'IN_TRANSIT',
    driver: 'Hamza Khan',
    location: 'I-80 Corridor, Des Moines, IA',
    batteryFuel: 78,
    lat: 41.5868,
    lng: -93.625,
  },
  {
    id: 'veh-02',
    plate: 'FLT-4021',
    vin: '1M8GDM9B7LP059284',
    make: 'Freightliner',
    model: 'Cascadia 126',
    year: 2023,
    type: 'Heavy Semi-Truck',
    capacityKg: 34000,
    status: 'AVAILABLE',
    driver: 'Tariq Mehmood',
    location: 'Chicago Distribution Yard 4',
    batteryFuel: 92,
    lat: 41.8781,
    lng: -87.6298,
  },
  {
    id: 'veh-03',
    plate: 'FLT-1156',
    vin: '1M8GDM9C3MP091245',
    make: 'Peterbilt',
    model: 'Model 579',
    year: 2024,
    type: 'Refrigerated Transport',
    capacityKg: 32000,
    status: 'IN_TRANSIT',
    driver: 'Zubair Shah',
    location: 'I-35 Southbound, Wichita, KS',
    batteryFuel: 64,
    lat: 37.6872,
    lng: -97.3301,
  },
  {
    id: 'veh-04',
    plate: 'FLT-9042',
    vin: '1M8GDM9D9NP031829',
    make: 'Kenworth',
    model: 'T680 Next Gen',
    year: 2022,
    type: 'Heavy Semi-Truck',
    capacityKg: 35000,
    status: 'MAINTENANCE',
    driver: 'Unassigned',
    location: 'Omaha Fleet Service Facility',
    batteryFuel: 45,
    lat: 41.2565,
    lng: -95.9345,
  },
];

export const DEMO_SHIPMENTS: DemoShipment[] = [
  {
    id: 'shp-101',
    tracking: 'FLT-SHP-89210',
    customer: 'Nexus Distribution Ltd',
    origin: 'Chicago Central Yard, IL',
    destination: 'Dallas Logistics Hub, TX',
    weightKg: 18400,
    status: 'IN_TRANSIT',
    driver: 'Hamza Khan',
    vehiclePlate: 'FLT-8890',
    eta: 'Today, 18:30 CST',
    progressPercent: 68,
  },
  {
    id: 'shp-102',
    tracking: 'FLT-SHP-99432',
    customer: 'Apex Cold-Chain Foods',
    origin: 'Minneapolis Logistics Dock, MN',
    destination: 'Kansas City Cold Storage, MO',
    weightKg: 21500,
    status: 'IN_TRANSIT',
    driver: 'Zubair Shah',
    vehiclePlate: 'FLT-1156',
    eta: 'Tomorrow, 09:15 CST',
    progressPercent: 42,
  },
  {
    id: 'shp-103',
    tracking: 'FLT-SHP-77124',
    customer: 'Global Tech Components',
    origin: 'Indianapolis Airport Facility, IN',
    destination: 'Chicago Yard 4, IL',
    weightKg: 9400,
    status: 'PENDING',
    driver: 'Tariq Mehmood',
    vehiclePlate: 'FLT-4021',
    eta: 'Pending Dispatch Departure',
    progressPercent: 0,
  },
  {
    id: 'shp-104',
    tracking: 'FLT-SHP-66291',
    customer: 'Vanguard Industrial Supply',
    origin: 'St. Louis Terminal, MO',
    destination: 'Denver Regional Hub, CO',
    weightKg: 27800,
    status: 'DELIVERED',
    driver: 'Rashid Latif',
    vehiclePlate: 'FLT-3382',
    eta: 'Delivered at 07:45 CST (Signed)',
    progressPercent: 100,
  },
];

export const DEMO_DRIVERS: DemoDriver[] = [
  {
    id: 'drv-01',
    name: 'Hamza Khan',
    licenseNumber: 'CDL-IL-984210',
    status: 'DRIVING',
    assignedVehicle: 'FLT-8890 (Volvo VNL 860)',
    rating: 4.95,
    phone: '+1 (555) 234-8901',
    tripsCompleted: 142,
  },
  {
    id: 'drv-02',
    name: 'Tariq Mehmood',
    licenseNumber: 'CDL-IL-874193',
    status: 'AVAILABLE',
    assignedVehicle: 'FLT-4021 (Freightliner Cascadia)',
    rating: 4.88,
    phone: '+1 (555) 345-9012',
    tripsCompleted: 98,
  },
  {
    id: 'drv-03',
    name: 'Zubair Shah',
    licenseNumber: 'CDL-TX-652941',
    status: 'DRIVING',
    assignedVehicle: 'FLT-1156 (Peterbilt 579)',
    rating: 4.92,
    phone: '+1 (555) 456-0123',
    tripsCompleted: 215,
  },
  {
    id: 'drv-04',
    name: 'Rashid Latif',
    licenseNumber: 'CDL-MO-441029',
    status: 'OFF_DUTY',
    assignedVehicle: 'Unassigned',
    rating: 4.79,
    phone: '+1 (555) 567-1234',
    tripsCompleted: 84,
  },
];

