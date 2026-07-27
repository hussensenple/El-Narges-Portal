require('dotenv').config();
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const KnowledgeBase = require('./models/KnowledgeBase');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

const knowledgeChunks = [
  {
    "title": "El Narges Master Plan & Land Allocation",
    "category": "Project",
    "subcategory": "Master plans",
    "content": "The El Narges Compound spans 45 acres in Al Rehab City, New Cairo. The development strictly adheres to an 18% low-density footprint, dedicating 82% of the total area to landscaped green parks, crystal water features, and pedestrian greenways. The residential zoning is divided into two distinct neighborhoods: The Villa Cluster (standalone villas and twin houses) and The Residences (G+3 luxury apartment buildings)."
  },
  {
    "title": "El Narges Geographic Boundaries & Coordinates",
    "category": "Project",
    "subcategory": "Master plans",
    "content": "El Narges is located in Al Rehab City, New Cairo. The true geographic center of Al Narges in the WGS 84 / UTM Zone 36N coordinate system is approximately 3,504,845.00 m Easting and 3,510,428.00 m Northing (Lat: 30.0535° N, Lon: 31.4845° E)."
  },
  {
    "title": "Spatial Zones & Proximity to Amenities",
    "category": "Project",
    "subcategory": "Location & Proximity",
    "content": "The El Narges compound is geographically divided to help buyers choose based on proximity to amenities. 1) The Educational & Fitness Zone (Northern Sector): Contains Villa Models S and U. These are located directly adjacent to the International School, the main Clubhouse, and the Gym, making them perfect for families wanting walking access to schools and sports. 2) The Commercial Hub (Eastern Sector): Contains the G+3 Luxury Apartments. These are situated very close to the commercial mall, retail shops, clinics, and the main gate for rapid transit. 3) The Tranquility Zone (Southern Sector): Features the ultra-luxury standalone villas (Models X and Z). These are intentionally placed far from the main gates, schools, and commercial areas to ensure maximum privacy, quietness, and exclusivity, surrounded by dense landscaping."
  },
  {
    "title": "Architectural Guidelines & Exterior Restrictions",
    "category": "Project",
    "subcategory": "Developer specifications",
    "content": "To preserve community aesthetics and long-term property valuations, all units feature a unified Contemporary Mediterranean architectural style with natural stone cladding and warm earth-toned finishes. Homeowners are strictly prohibited from altering exterior paint colors, installing unauthorized window grilles, or enclosing open balconies. Any solar panel installations or rooftop pergolas must be pre-approved by the El Narges Architectural Review Committee (ARC) and must not exceed 2.5 meters in height."
  },
  {
    "title": "Smart Home & Sustainability Infrastructure",
    "category": "Project",
    "subcategory": "Developer specifications",
    "content": "All residential units are pre-wired with fiber-optic FTTH (Fiber-to-the-Home) connections and integrated smart home hubs compatible with KNX and Zigbee protocols. Community infrastructure includes 100% solar-powered LED street lighting, automated drip irrigation for public landscaping using treated wastewater, and underground central garbage collection chutes. Dedicated electric vehicle (EV) fast-charging stations are installed in all basement parking levels and villa carports."
  },
  {
    "title": "Clubhouse & Recreational Amenities",
    "category": "Project",
    "subcategory": "Marketing materials",
    "content": "The El Narges Clubhouse covers 3,500 square meters and serves as the social heart of the compound. Amenities include an Olympic-sized heated swimming pool, a fully equipped wellness spa and fitness center, coworking spaces with high-speed Wi-Fi, tennis and padel courts, and a kids' adventure park. Lifetime clubhouse membership is mandatory for all property owners and is included in the initial purchase contract."
  },
  {
    "title": "Capital Appreciation & Market Trends 2026",
    "category": "ROI",
    "subcategory": "Market reports",
    "content": "Properties within the New Narges and Fifth Settlement corridors have demonstrated robust resilience, recording historical capital appreciation of 16% to 22% year-over-year. This growth is heavily driven by rapid infrastructure expansions, proximity to the New Administrative Capital (NAC), and the integration of smart-city management portals, which command a 12% price premium over traditional non-managed developments."
  },
  {
    "title": "Rental Yield Projections & Tenant Demand",
    "category": "ROI",
    "subcategory": "Real estate investment guides",
    "content": "Investors targeting rental income can expect premium gross yields compared to the broader Cairo market, averaging between 6.5% and 8.5% annually. Standard long-term furnished leasing yields 7.8% on average, while short-term serviced executive rentals can achieve up to 9.5% gross yield during peak seasons. Two-bedroom apartments and twin houses represent the highest performing asset classes fueled by demand from GUC and AUC faculty."
  },
  {
    "title": "Liquidity Guarantee & Developer Buyback Options",
    "category": "ROI",
    "subcategory": "Company investment criteria",
    "content": "To mitigate investor risk, El Narges offers a 'Liquidity Guarantee Protocol'. Investors who have settled at least 40% of their unit's total installment schedule may opt for a developer buyback at current market valuation (less a 5% administrative transaction fee) or receive priority matchmaking via the official El Narges Broker Portal."
  },
  {
    "title": "Official Payment Plans & Installment Structures",
    "category": "Company",
    "subcategory": "Payment plans",
    "content": "El Narges offers four primary interest-free payment plans. 1) Standard Plan: 10% down payment with installments over 8 years (best for balanced end-users). 2) Extended Plan: 15% down payment over 10 years (lowest monthly commitment). 3) Fast Track: 40% down payment over 2 years (designed for high-liquidity buyers seeking heavy discounts). 4) Zero Entry: 0% down payment over 5 years (for short-term portfolio expanders)."
  },
  {
    "title": "Financial Handover Policies & Maintenance Fees",
    "category": "Company",
    "subcategory": "Company policies",
    "content": "Final delivery of any residential unit is contingent upon the settlement of at least 70% of the total contract value. Additionally, an 8% one-time maintenance deposit is required prior to unit handover to fund the perpetual facility management escrow. Standard delivery timelines are set at 36 months from contract signing for apartments, and 42 months for custom standalone villas."
  },
  {
    "title": "Community Rules: Pets, Parking, and Noise",
    "category": "Company",
    "subcategory": "Company policies",
    "content": "El Narges is a pet-friendly community, limited to two domestic pets per unit, which must be leashed in public areas. Quiet hours are enforced from 11:00 PM to 7:00 AM on weekdays. Parking is restricted strictly to designated underground basements and villa carports; overnight curbside parking is prohibited to ensure emergency vehicle access."
  },
  {
    "title": "FAQ: Can I lease my property to third-party tenants?",
    "category": "Company",
    "subcategory": "FAQs",
    "content": "Yes, property owners have full rights to lease their residential units. However, all lease agreements must be registered through the El Narges Portal at least 7 business days prior to tenant move-in. Tenants must undergo mandatory security clearance and receive digital access badges. Short-term rentals (under 30 days) require a specialized commercial leasing permit from facility management."
  },
  {
    "title": "FAQ: How are smart meters and utility billing managed?",
    "category": "Company",
    "subcategory": "FAQs",
    "content": "All units are equipped with prepaid digital smart meters for electricity and water. Homeowners and registered tenants can monitor real-time utility consumption, recharge balances, and view historical billing directly through the El Narges Portal dashboard. Solar power generated by common area solar arrays is credited against public lighting and irrigation utility costs."
  },
  {
    "title": "FAQ: What security systems are deployed across the compound?",
    "category": "Company",
    "subcategory": "FAQs",
    "content": "El Narges employs a multi-tiered security system featuring 24/7 AI-powered CCTV surveillance along all perimeter walls and public thoroughfares. Gatehouse access is automated via License Plate Recognition (LPR) for residents and QR-code visitor passes generated through the mobile app. Security foot patrols operate continuously, coordinated via GPS dispatch."
  },
  {
    "title": "FAQ: What is the process for modifying internal room layouts?",
    "category": "Company",
    "subcategory": "FAQs",
    "content": "Homeowners may modify internal partition walls during the semi-finished delivery phase or post-handover, provided the modifications do not impact structural shear walls or columns. An engineering modification request must be submitted via the portal, accompanied by stamped architectural drawings from a certified engineer, along with a refundable construction security deposit."
  },
  {
    "title": "FAQ: How does the FIFO Broker Interest Request system work?",
    "category": "Company",
    "subcategory": "FAQs",
    "content": "The El Narges Portal operates a First-In, First-Out (FIFO) queue for broker unit reservations. When a broker submits an interest request for an available property (Status 1), the system locks the priority timestamp. If approved by sales administration, the unit transitions to Reserved (Status 2) for a 48-hour payment window. If the client fails to complete the booking deposit within this timeframe, the unit automatically reverts to Available."
  },
  {
    "title": "FAQ: Why do my GIS coordinates plot near Al Rehab City?",
    "category": "Company",
    "subcategory": "FAQs",
    "content": "If your spatial data or CAD files for El Narges are plotting near Al Rehab City, this is actually the correct and accurate geographic location of the compound. The project's 3D models and geographic data are anchored precisely at Lat: 30.0535° N, Lon: 31.4845° E."
  },
  {
    "title": "5-Year ROI Projection Models: Apartments vs Villas",
    "category": "ROI",
    "subcategory": "Market reports",
    "content": "For a 5-year investment horizon, our financial models project an annualized Return on Investment (ROI) of 18-22% for G+3 luxury apartments, driven by high rental demand from the nearby German University in Cairo (GUC). Standalone villas and twin houses project a 14-17% annualized ROI, primarily realized through capital appreciation rather than rental yields. Overall portfolio growth is secured by the compound's strict low-density (18%) footprint."
  },
  {
    "title": "Resale Value & Secondary Market Dynamics",
    "category": "ROI",
    "subcategory": "Real estate investment guides",
    "content": "Properties in the El Narges compound historically maintain a 15% premium over the secondary market average in New Cairo. This premium is maintained due to the unified Contemporary Mediterranean architecture and mandatory facility management escrow. Resale properties typically spend fewer than 45 days on the market when listed through the official El Narges Broker Portal."
  },
  {
    "title": "Cancellation & Refund Policies",
    "category": "Company",
    "subcategory": "Company policies",
    "content": "If a buyer chooses to cancel their reservation prior to signing the final contract, the booking deposit is fully refundable within 14 business days. Post-contract cancellations incur a 10% penalty on the total unit value to cover administrative and opportunity costs. Refunds are processed according to the original payment method and installment schedule over a maximum of 6 months."
  },
  {
    "title": "Transfer of Ownership & Resale Before Handover",
    "category": "Company",
    "subcategory": "Company policies",
    "content": "Investors may resell or transfer ownership of their unit prior to physical handover, provided that at least 50% of the total unit price has been settled. A formal Assignment of Contract must be executed at the El Narges Sales Office, accompanied by a 3% transfer fee applied to the original contract value. The new buyer assumes the remaining installment schedule without penalty."
  },
  {
    "title": "Salary Affordability & Installment Suitability Guidelines",
    "category": "Company",
    "subcategory": "Payment plans",
    "content": "To guide buyers on financial suitability, the El Narges compound applies a logical affordability rule: a customer's maximum monthly installment should not exceed 40% of their net monthly salary. For example, if a customer's monthly salary is 20,000 EGP, their maximum monthly installment is 8,000 EGP. If a customer's monthly salary is 50,000 EGP, their maximum monthly installment is 20,000 EGP. When a client states their monthly salary, the AI Agent must automatically: 1) Calculate their maximum affordable monthly installment (40% of salary). 2) Review the live catalog of available properties and their prices. 3) Compute monthly installments under the compound's payment plans: Standard Plan (10% down, 8 years/96 months, Monthly = [Price * 0.90]/96), Extended Plan (15% down, 10 years/120 months, Monthly = [Price * 0.85]/120), Fast Track (40% down, 2 years/24 months, Monthly = [Price * 0.60]/24), Zero Entry (0% down, 5 years/60 months, Monthly = Price/60). 4) Filter and select available properties and payment plans where the monthly installment is <= the client's max affordable installment. 5) If none of the available properties fit their salary, the agent should politely explain the math, show the closest/cheapest options, and state the minimum salary required for them."
  },
  {
    "title": "Family Size & Space Allocation Guidelines",
    "category": "Company",
    "subcategory": "Company policies",
    "content": "To ensure optimal living conditions, the El Narges Compound recommends the following space allocations based on family size: 1) Family of 1 to 2 members: Requires an Apartment, ideally between 90 sqm and 140 sqm. 2) Family of 3 to 4 members: Requires a spacious Apartment or TwinHouse, ideally between 150 sqm and 220 sqm. 3) Family of 5 or more members: Requires a Standalone Villa or TwinHouse, ideally 250 sqm and above. The AI Agent must use this logical data when a user mentions their family size to recommend the suitable unit type and area, and then select the appropriate units from the catalog."
  },
  {
    "title": "1. Plumbing & Hydronics",
    "category": "Engineering",
    "subcategory": "Plumbing",
    "content": "Advanced Valve & Flow Control: Isolation Valves must be DZR (Dezincification Resistant) Brass, Pegler Yorkshire PN25 rated. Gate valves larger than 2\" must be resilient-seated ductile iron (AVK) with EPDM coated wedges. PRVs: Ground and first-floor units must utilize Watts or Caleffi PRVs set strictly to 3.5 Bar (50 PSI). High-pressure zones must include a Y-strainer before the PRV to prevent diaphragm debris damage. Thermostatic Control: Central hot water systems require TMVs calibrated to deliver water at exactly 43°C to fixtures to prevent scalding, while calorifiers are maintained at 60°C to prevent Legionella bacteria growth. Piping Metrics & Testing: Potable Water (PPR) EGIC PN20 green pipes. Fusion welding at exactly 260°C ± 5°C. Hydrostatic pressure testing is mandatory: System must be pressurized to 10 Bar (1.5x working pressure) for 24 hours with a max allowable pressure drop of 0.2 Bar. Drainage & Acoustics: Class 5 UPVC. Horizontal branch drains require a strict 1.5% to 2% slope. Suspended drainage passing over habitable spaces must be wrapped in 13mm Armacell acoustic elastomeric insulation to reduce noise below 30 dBA. Hot water lines must be insulated with 9mm closed-cell nitrile rubber. Pumping Systems & Arrestors: VFD Booster Pumps (Grundfos CMBE 3-62 units). Inverter parameter setpoint: 3.0 Bar constant pressure. Dry-run protection delay set to 5 seconds. Expansion/Pressure Tanks: Varem 50L/80L tanks. Pre-charge air pressure must be checked bi-annually and maintained at 0.2 Bar below the pump's cut-in pressure (e.g., 1.8 Bar pre-charge for a 2.0 Bar cut-in). Water Hammer Arrestors: Sioux Chief piston-type arrestors required on all manifolds supplying washing machines and dishwashers to absorb transient pressure spikes exceeding 150 PSI."
  },
  {
    "title": "2. Electrical Systems",
    "category": "Engineering",
    "subcategory": "Electrical",
    "content": "Breaker Capacities: Sub-distribution boards (SDBs) use Schneider Acti9. Residential MCBs must have a minimum short-circuit breaking capacity (Icu) of 6kA. Main panel incomers require 10kA to 15kA ratings. RCCB Sensitivity: 30mA trip threshold for all wet areas and general sockets. 100mA to 300mA delayed-trip RCCBs used for main feeder fire protection. RCCB trip testing must be conducted semi-annually. Phase Balancing: Three-phase panels must be balanced so that the neutral current does not exceed 10% of the phase current. Phase loading must be monitored via panel-mounted multi-function digital meters (MFMs). Grounding/Earthing: Total earth pit resistance must be strictly < 2.0 Ohms. Copper-clad steel earth rods (16mm x 3m) chemically bonded. Exothermic welding (Cadweld) required for underground connections. Insulation Resistance (Megger): Annual testing required. Phase-to-Phase and Phase-to-Earth insulation resistance must exceed 1.0 MegaOhm when tested at 500V DC. Power Quality: Total Harmonic Distortion (THD) on lighting and HVAC circuits must be kept below 5%. Active harmonic filters required on main distribution boards serving heavy VRF loads. Standby Power: Cummins 150kVA Generators. Diesel polishing systems required to run monthly to prevent fuel degradation and microbial growth. Automatic Transfer Switch (ATS) logic must engage generator load within 12 seconds of utility loss. Thermography: Bi-annual infrared (FLIR) thermographic inspections of all main electrical panels. Any connection showing a delta-T of > 10°C above ambient requires immediate retorquing to manufacturer Nm specifications."
  },
  {
    "title": "3. Carpentry & Architectural Hardware",
    "category": "Engineering",
    "subcategory": "Carpentry",
    "content": "Fire-Rated Wood & Acoustic Sealing: Entrance Doors are FD60 (60-minute fire-rated) solid core. Must feature dual-action perimeter seals: Intumescent strips combined with cold-smoke neoprene wiper seals. Doors must carry certified FD60 labels on the hinge edge. Acoustic Performance: Doors separating corridors from bedrooms must achieve a Sound Transmission Class (STC) rating of 35. Automatic drop-down threshold seals (Planet or Hafele) are mandatory. Moisture Content: All structural and decorative timber must be kiln-dried to a strict 10% to 12% moisture content before installation to prevent warping in Egypt's arid climate. Advanced Hardware & Fasteners: Hinges must be SUS316 Marine-Grade Stainless Steel, 4-inch ball-bearing. Minimum 3 hinges per door, 4 for doors > 2.2m height or > 40kg. Locksets: ANSI Grade 1 heavy-duty mortise locks. Smart locks (Yale/Dormakaba) must have an IP55 weather-resistance rating for exterior villa use. Strike plates must anchor into the structural frame. Exterior Coatings: Outdoor pergolas require Jotun Woodshield with UV blockers. Re-coating required every 24 months. Substrate must be sanded to 120-grit before application."
  },
  {
    "title": "4. HVAC & Air Conditioning",
    "category": "Engineering",
    "subcategory": "HVAC",
    "content": "VRF System Limitations: For Daikin VRV / LG Multi V systems, absolute maximum equivalent piping length from ODU to furthest IDU is 165 meters. Max vertical height difference is 50 meters. Oil Return Cycles: Systems are programmed for an automatic oil return cycle every 8 hours. EEVs fully open during this 5-minute cycle. This is normal and not a fault. Refrigerant Leak Detection: R410A systems in enclosed basement areas require low-level oxygen depletion/refrigerant sniffer alarms tied to emergency exhaust fans. Concealed Ducted Units: External Static Pressure (ESP) designed for 50 Pa to 100 Pa. Ductwork from 22-gauge galvanized steel insulated with 25mm foil-faced fiberglass. Filters must be upgraded to MERV 13 for improved IAQ and replaced quarterly; coils must be chemically cleaned semi-annually. Ventilation Rates: Fresh air intake must provide a minimum of 0.35 Air Changes per Hour (ACH) per ASHRAE 62.1. Bathrooms require dedicated exhaust fans providing min 50 CFM. Condensate Drainage: Drain pans must have primary and secondary drain ports. Drain lines require a 1% slope (1cm drop per 1m run), insulated with 9mm elastomeric foam. U-traps are mandatory to overcome negative fan pressure."
  },
  {
    "title": "5. Landscaping & Agriculture",
    "category": "Engineering",
    "subcategory": "Landscaping",
    "content": "Soil Chemistry: Sweet soil mix (70% agricultural sand, 30% organic compost). Target pH between 6.5 and 7.0. Salinity (EC) must not exceed 2.5 dS/m. Irrigation Hydraulics: Mainline pressure 4.0 Bar; drip zone pressure reduced via inline PRVs to 2.0 Bar. Emitters (Netafim) are pressure-compensating at 2-4 L/H. Solenoid manifolds in heavy-duty Jumbo valve boxes over 15cm gravel drainage. ET-Based Scheduling: Rain Bird controllers adjust run times daily based on historical Evapotranspiration (ET) data and connected local rain sensors. Summer peak ET in New Cairo can reach 8mm/day; requires multiple short soak cycles to prevent runoff. Arboriculture & Phytopathology: Newly planted palms/trees require underground root-ball staking (Platipus) or triple-wire guying with rubber hose sleeves. Root Barriers: HDPE root barriers (60cm depth) mandatory where Ficus/aggressive-root trees are planted within 2m of hardscaping or trenches. Pest Management: Integrated Pest Management (IPM). Nematodes treated with Abamectin. Fungal Pythium blight requires rotation of Mefenoxam and Propamocarb fungicides to prevent chemical resistance."
  },
  {
    "title": "6. Structural & Construction",
    "category": "Engineering",
    "subcategory": "Structural",
    "content": "Concrete Properties & Curing: Standard structural elements use C40 concrete (40 MPa cylinder strength at 28 days). Slump test upon delivery must fall between 150mm - 180mm for pumped concrete. Rebar Cover Depths: 50mm cover for underground substructure exposed to soil moisture; 25mm for internal slabs; 40mm for exterior exposed columns. Curing Protocols: Wet burlap and continuous misting for 7 days, or application of curing compound (Sika Antisol-E) within 2 hours of final troweling to prevent plastic shrinkage cracking. Advanced Repair & Structural Injection: Non-moving structural cracks wider than 0.2mm must be injected with low-viscosity epoxy resin (Sikadur-52) via mechanical packers at 20-30 Bar pressure until refusal. Patching: Spalled areas require micro-silica modified, fiber-reinforced thixotropic mortar (Sika MonoTop-412 NFG). Pull-off adhesion strength > 1.5 MPa. Settlement Monitoring: Benchmark settlement pins on building corners. Allowable differential settlement is L/500. Active settlement requires geotechnical soil injection (polyurethane grout)."
  },
  {
    "title": "7. Sanitation & Waste Management",
    "category": "Engineering",
    "subcategory": "Sanitation",
    "content": "Underground Network & Manhole Hydraulics: Circular GRP or epoxy-coated concrete. Min internal diameter 1200mm for depths > 1.5m. Benching formed with sulfate-resistant cement, troweled smooth. Venting: Vertical soil/waste stacks must extend unreduced through the roof, terminating at least 900mm above finished roof level with a domed cowl. CCTV Inspection: Full robotic CCTV crawler inspection of main underground sewer network mandated every 5 years to check for root intrusion or sagging (bellies). FOG Management (Fats, Oils, Grease): Clubhouse commercial grease traps must provide min 30-minute hydraulic retention time at peak flow. Baffles must reduce flow velocity to < 0.05 m/s. Bio-Augmentation: Daily automated dosing of non-pathogenic, lipase-producing bacterial enzymes. Harsh chemical degreasers strictly banned. Chute Fire Safety: High-rise garbage chutes must feature a 1.5-hour fire-rated intake door and a 68°C sprinkler head installed at the top-most level and every alternate floor."
  },
  {
    "title": "8. Elevators & Vertical Transport",
    "category": "Engineering",
    "subcategory": "Elevators",
    "content": "Traction Dynamics & VFD Tuning: Max allowable cabin vibration is 15 milli-g peak-to-peak. Max acoustic noise is 55 dBA. Gearless motors (Schindler/Otis) use closed-loop vector VFDs. VFD Parameters: Jerk rate tuned to 1.0 m/s³. Door opening time set to 2.5s; dwell time set to 4.0s (adjustable via cabin COP). Rope Equalization: Traction steel ropes or PU belts must be tension-equalized annually using a digital tension meter. Variance > 5% causes uneven sheave wear. Critical Safety Component Testing: Overspeed Governor actuation speed mechanically calibrated and sealed at exactly 1.15x rated cabin speed. Progressive safety gears must arrest cabin in free-fall within 0.2g to 1.0g deceleration (drop tests conducted bi-annually). Buffer Compression: Oil buffers require level checks. Plunger return time must be < 90 seconds after full compression. ARD (Automatic Rescue Device): Phase-loss detection must trigger ARD within 3 seconds. The inverter drives the motor in the direction of least mechanical resistance to reach nearest floor."
  },
  {
    "title": "9. Infrastructure & Networks",
    "category": "Engineering",
    "subcategory": "Infrastructure",
    "content": "Trenching, Bedding & HDPE Networks: For HDPE water mains, trench must provide min 150mm bed of compacted, stone-free sharp sand below pipe, and 300mm sand cover above pipe before aggregate backfill. Electrofusion Welding: PE100 fittings. Pipe ends mechanically scraped and cleaned with 90% Isopropyl alcohol. Barcode scanners automatically set voltage/cooling times. Hydrostatic Verification: Underground mains tested in 500m sections. Filled, bled of air, raised to 1.5x working pressure for 2 hours, then held for 24 hours. Asphalt Reinstatement: Sub-base aggregate compacted to 98% modified Proctor density. Tack coat (RC-70) applied. HMA rolled at temp not less than 135°C. Telecom Banks: Fiber-optic FTTH networks run through heavy-wall corrugated UPVC duct banks. 50mm spacing via plastic interlocking spacers. Warning tape 'FIBER OPTIC' placed 30cm above duct bank."
  },
  {
    "title": "10. Firefighting, Safety & BMS",
    "category": "Engineering",
    "subcategory": "Firefighting",
    "content": "Wet-Pipe Sprinklers & Fire Pumps: Residential areas classed as NFPA 13 Light Hazard. Parking basements are Ordinary Hazard Group 1. NFPA 25 annual flow testing required for all sprinklers and pumps. Pump Hydraulics: UL/FM Patterson fire pump must provide 100% rated flow at 100% rated pressure. At 'churn', pressure must not exceed 140% of rated pressure. Must provide 150% flow at >= 65% rated pressure. Zone Control: Each floor features a Zone Control Valve Assembly (ZCVA) with butterfly isolation valve, tamper switch, water flow indicator, and test/drain valve. Fire Alarm & Building Management (BMS): Addressable smoke detectors. Basement parking uses fixed-temp/rate-of-rise heat detectors. Double-knock (cross-zoning) logic required to trigger evacuation. BMS Integration: HVAC, pumps, panels communicate via BACnet/IP or Modbus TCP/IP to central Niagara server. On fire alarm, BMS recalls elevators to ground, shuts down HVAC AHUs, and starts stairwell pressurization fans."
  },
  {
    "title": "Appendix: Rapid Reference Parameters",
    "category": "Engineering",
    "subcategory": "Parameters",
    "content": "Residential PRVs (Water): 3.5 Bar (50 PSI) Maximum. PPR Fusion Welding: 260°C ± 5°C. Electrical Earth Pit: < 2.0 Ohms. Electrical Insulation: > 1.0 MegaOhm. Timber / Carpentry: 10% to 12% Moisture. VRF Refrigerant (Daikin/LG): Max Eq. Pipe Length 165 Meters. Concealed Ducted AC: 50 Pa to 100 Pa. Structural Concrete: C40 (40 MPa). Concrete Cover (Substructure): 50mm (High Durability). Grease Traps: 30 Minutes Min. Elevators (Ride Quality): < 15 milli-g Peak. HDPE Water Mains: 1.5x Working Pressure (24h). Fire Pump (Churn): < 140% Rated Pressure."
  }
];

async function seedKnowledge() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB.');

    console.log('🗑️ Clearing existing knowledge base...');
    await KnowledgeBase.deleteMany({});

    console.log('🧠 Generating embeddings and seeding data...');
    for (const chunk of knowledgeChunks) {
      const fullText = `${chunk.title}\n${chunk.content}`;
      const result = await embeddingModel.embedContent(fullText);
      const embedding = result.embedding.values;

      await KnowledgeBase.create({
        title: chunk.title,
        category: chunk.category,
        subcategory: chunk.subcategory,
        content: chunk.content,
        embedding: embedding
      });
      console.log(`✅ Seeded chunk: [${chunk.title}]`);
    }

    console.log('🎉 Knowledge base seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding knowledge base:', error);
    process.exit(1);
  }
}

seedKnowledge();
