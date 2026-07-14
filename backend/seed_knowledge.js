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
    "content": "The El Narges Compound spans 45 acres in the prestigious New Narges district of New Cairo, situated strategically near South 90th Street and the German University in Cairo (GUC). The development strictly adheres to an 18% low-density footprint, dedicating 82% of the total area to landscaped green parks, crystal water features, and pedestrian greenways. The residential zoning is divided into two distinct neighborhoods: The Villa Cluster (standalone villas and twin houses) and The Residences (G+3 luxury apartment buildings)."
  },
  {
    "title": "El Narges Geographic Boundaries & Coordinates",
    "category": "Project",
    "subcategory": "Master plans",
    "content": "El Narges is located in the Fifth Settlement, New Cairo. The compound is geographically bounded by South 90th Street to the north, Mohammed Nagib Axis to the east, and the German University in Cairo (GUC) to the south. The true geographic center of Al Narges in the WGS 84 / UTM Zone 36N coordinate system is approximately 351,476.00 m Easting and 3,320,892.00 m Northing (Lat: 30.0100° N, Lon: 31.4600° E)."
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
    "content": "If your spatial data or CAD files for El Narges are plotting near Al Rehab City or the Cairo-Suez Road (e.g., around coordinates 354,298E, 3,326,563N), this is a known GIS discrepancy. It is typically caused by a digitizing offset or an incorrect local engineering grid. To correct this, apply a spatial shift of approximately -5,670 meters Northing and -2,820 meters Easting to align the geometry with the true absolute national grid coordinates for El Narges in WGS 84 / UTM Zone 36N."
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
