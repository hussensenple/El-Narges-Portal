const { GoogleGenerativeAI } = require("@google/generative-ai");
const KnowledgeBase = require("../models/KnowledgeBase");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Auto-retry wrapper for 429 quota errors with exponential backoff
const generateWithRetry = async (model, prompt, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await model.generateContent(prompt);
    } catch (err) {
      const is429 = err.message && err.message.includes('429');
      if (is429 && attempt < maxRetries) {
        const delay = attempt * 15000; // 15s, 30s, 45s
        console.log(`[AI] 429 rate limit hit. Retrying in ${delay / 1000}s (attempt ${attempt}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
};

const askAI = async (req, res) => {
  try {
    const { question, contextData, history } = req.body;

    // 1. Clean and normalize contextData prices and extract owner details
    let cleanContextUnits = [];
    if (contextData && Array.isArray(contextData)) {
      cleanContextUnits = contextData.map(u => {
        let cleanPriceStr = String(u.price).replace(/[^0-9.]/g, '');
        let unitPrice = Number(cleanPriceStr);
        // If price is stored in shorthand millions (e.g., 70 instead of 70,000,000)
        if (unitPrice > 0 && unitPrice < 10000) {
          unitPrice = unitPrice * 1000000;
        }
        return {
          id: u.id,
          originalId: u.originalId,
          layer: u.layer,
          type: u.type,
          priceEGP: unitPrice || 0,
          status: u.status,
          ownerName: u.ownerName || null,
          ownerPhone: u.ownerPhone || null,
          ownerEmail: u.ownerEmail || null
        };
      });
    }

    // 2. Fetch RAG Context from Knowledge Base
    let ragContext = "";
    try {
      const result = await embeddingModel.embedContent(question);
      const queryEmbedding = result.embedding.values;

      const chunks = await KnowledgeBase.find({ category: { $ne: "Engineering" } });
      if (chunks && chunks.length > 0) {
        const scoredChunks = chunks.map(chunk => ({
          title: chunk.title,
          content: chunk.content,
          score: cosineSimilarity(queryEmbedding, chunk.embedding)
        }));
        
        scoredChunks.sort((a, b) => b.score - a.score);
        const topChunks = scoredChunks.slice(0, 3).filter(c => c.score > 0.6); // Filter by relevance threshold
        
        if (topChunks.length > 0) {
          ragContext = "Relevant Compound Information:\n" + topChunks.map(c => `[${c.title}]: ${c.content}`).join("\n");
        }
      }
    } catch (err) {
      console.error("Error retrieving RAG context:", err);
    }

    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    // 🚀 النهج الجديد: استخدام الـ AI للرد على السؤال واستخراج المعايير (Parameters) في نفس الوقت
    const prompt = `
      You are a smart real estate assistant for the El-Narges Compound. 
      Analyze the user's question, answer it using the provided knowledge, and extract any search criteria.
      
      User Question: "${question}"
      
      Previous Conversation History:
      ${history && history.length > 0 ? JSON.stringify(history, null, 2) : "None"}

      ${ragContext ? ragContext : ""}

      Live Units, Prices, and Occupancy Status Context (directly from ArcGIS map/database):
      ${JSON.stringify(cleanContextUnits, null, 2)}

      Rules:
      1. Extract the property type (type): "Apartment", "Villa", or "TwinHouse". If not specified, set to "All".
      2. Extract the maximum price (maxPrice): Convert text to numbers (e.g., "32 million" -> 32000000, "3.5 million" -> 3500000). If no price is mentioned, set to null.
      3. Determine if this is a search/filtering request (isFilterQuery): true or false.
      4. If the user explicitly asks to book or reserve a specific unit by its ID, set "action": "BOOK_UNIT" and "actionUnitId": the requested ID. Otherwise, set them to null.
      5. Reply in the same language the user used to ask their question (Arabic or English). If the question is in Arabic, you MUST reply in natural, professional Arabic. Use {COUNT} to represent the number of matched units if they asked to search.
      6. Provide a rich, helpful reply. If they ask about the compound, answer using the 'Relevant Compound Information' or 'Live Units' provided above. If they ask to search, answer something like 'Absolutely! We found {COUNT} matching units. They have been highlighted on the map.'
      7. If the user mentions proximity to an amenity (e.g., "near the gym", "close to school", "5 minutes from hospital"), extract:
         - "nearTo": one of "School", "Hospital", "GYM", "Commercial", or null if no proximity mentioned.
         - "maxWalkingMinutes": the number of walking minutes mentioned (default to 5 if they just say "near" or "close"). Set to null if no proximity mentioned.
      8. If the user asks about the closest/nearest services to a specific unit or property (e.g., "what services are near unit 99?", "closest services to villa 5", "how far is unit 10 from the gym?"), set "action": "CLOSEST_SERVICE" and "actionUnitId": the unit/property ID number. If they don't mention a specific ID, set actionUnitId to null.
      9. Salary Affordability & Installment Suitability Rule:
         If the user mentions their salary (e.g. "my salary is 20,000", "مرتبي 20000", "بقبض 30 ألف"):
         - Calculate the maximum monthly installment they can afford, which is 40% of their net monthly salary.
         - Compare this with the monthly installment of available units (status "available" or "1"). The compound's payment plans are:
           * Standard Plan: 10% down payment, installments over 8 years (96 months). Monthly installment = (Price * 0.90) / 96.
           * Extended Plan: 15% down payment, installments over 10 years (120 months). Monthly installment = (Price * 0.85) / 120.
           * Fast Track: 40% down payment, installments over 2 years (24 months). Monthly installment = (Price * 0.60) / 24.
           * Zero Entry: 0% down payment, installments over 5 years (60 months). Monthly installment = Price / 60.
         - Find the suitable units and plans where the monthly installment is less than or equal to their max affordable monthly installment.
         - Set "isFilterQuery" to true, and set "maxPrice" to the absolute maximum property price they can afford under the most favorable plan (Extended Plan: Max Monthly Installment * 120 / 0.85).
         - In the "reply" field:
           * State their max monthly installment (40% of salary).
           * Recommend the suitable units that fit this budget, showing their price, and the best payment plan (usually Extended or Standard) with its exact down payment and monthly installment amounts.
           * If multiple units fit, summarize them nicely.
           * If NO available units fit their budget, state this clearly, show the cheapest available unit, and calculate what monthly installment and monthly salary would be required to afford it.
      11. INVESTMENT & ROI RULE: If the user explicitly asks for an investment plan, ROI, or mentions they want to invest based on their salary or available budget:
         - First, follow the Salary Rule (Rule 10) to find the maximum affordable units.
         - Calculate the 5-Year Projected ROI for the recommended units:
           * For Apartments: 20% annualized return. 5-Year Profit = Price * 0.20 * 5.
           * For Villas/TwinHouses: 15% annualized return. 5-Year Profit = Price * 0.15 * 5.
         - In the "reply" field, proactively present this as an investment plan: mention the required down payment, the monthly installment, the projected 5-Year Profit, and the total future expected value (Price + Profit).
      12. FAMILY SIZE & AREA RULE: If the user mentions their family size (e.g. "family of 4", "أسرة من 5 أفراد"):
         - 1 to 2 members: Set "type" to "Apartment" and state the recommended area is 90 to 140 sqm.
         - 3 to 4 members: Set "type" to "TwinHouse" (or "Apartment") and state the recommended area is 150 to 220 sqm.
         - 5 or more members: Set "type" to "Villa" (or "TwinHouse") and state the recommended area is 250+ sqm.
         - Set "isFilterQuery" to true so the map filters to show these units.
         - Explain this logic clearly in the "reply" (e.g. "Since you have a family of 4, I recommend an area of 150-220 sqm, like a TwinHouse...").
      13. SPATIAL QUERY / FILTERING RULE: 
         - NEVER guess or hallucinate the number of available units. NEVER say "I found X units" or "We have Y apartments available."
         - If filtering is requested, simply state: "I am highlighting the suitable properties on the 3D map for you right now." The system will automatically calculate the exact number and append it to your reply.
      14. CONVERSATION CONTEXT: If the user is asking a follow-up question, you MUST retain and re-output the exact search criteria (like nearTo, type, maxPrice, isFilterQuery) from the previous conversation history, unless the user explicitly changes them.
      15. FORMATTING: Structure your reply cleanly using bullet points, dashes, and newline characters (\n) to make it easy to read. Do NOT return one long block of text.
      16. The response MUST be strictly in JSON format without markdown wrapping:
      {
        "reply": "Your rich, context-aware reply to the user...",
        "isFilterQuery": true/false,
        "type": "Apartment" | "Villa" | "TwinHouse" | "All",
        "maxPrice": number | null,
        "nearTo": "School" | "Hospital" | "GYM" | "Commercial" | null,
        "maxWalkingMinutes": number | null,
        "action": "BOOK_UNIT" | "CLOSEST_SERVICE" | null,
        "actionUnitId": number | null
      }
    `;

    const responseResult = await generateWithRetry(model, prompt);
    const responseText = responseResult.response.text();
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? jsonMatch[0] : responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const aiData = JSON.parse(cleanJson);

    // Force override to fix Gemini potentially returning "All" incorrectly
    const qLower = String(req.body.question).toLowerCase();
    if (qLower.includes("villa") || qLower.includes("فيلا") || qLower.includes("فلل")) aiData.type = "Villa";
    else if (qLower.includes("apartment") || qLower.includes("flat") || qLower.includes("شقة") || qLower.includes("شقق") || qLower.includes("شقه")) aiData.type = "Apartment";
    else if (qLower.includes("twin") || qLower.includes("توين")) aiData.type = "TwinHouse";

    // Force override for proximity keywords
    if (!aiData.nearTo) {
      if (qLower.includes("gym")) aiData.nearTo = "GYM";
      else if (qLower.includes("school")) aiData.nearTo = "School";
      else if (qLower.includes("hospital")) aiData.nearTo = "Hospital";
      else if (qLower.includes("commercial") || qLower.includes("mall") || qLower.includes("shop")) aiData.nearTo = "Commercial";
    }
    if (aiData.nearTo && !aiData.maxWalkingMinutes) aiData.maxWalkingMinutes = 5;
    if (aiData.nearTo && !aiData.action) aiData.isFilterQuery = true;

    // Force override for closest service keywords
    if (!aiData.action) {
      const closestMatch = qLower.match(/closest|nearest|how far|distance|services?.*(near|close|from)/i);
      const unitIdMatch = qLower.match(/(?:unit|villa|property|flat)\s*#?\s*(\d+)/i);
      if (closestMatch && unitIdMatch) {
        aiData.action = "CLOSEST_SERVICE";
        aiData.actionUnitId = Number(unitIdMatch[1]);
        aiData.isFilterQuery = false;
      }
    }

    let finalFilteredIds = [];

    // 🚀 تطبيق الفلترة برمجياً (100% دقة ومطابقة للـ Catalog)
    if (aiData.isFilterQuery) {
        const filtered = contextData.filter(u => {
            // Only filter available units for map highlight/filtering
            const isAvailable = String(u.status).toLowerCase() === 'available' || String(u.status) === '1';
            if (!isAvailable) return false;

            // Clean price string (remove commas, currency symbols, etc)
            let cleanPriceStr = String(u.price).replace(/[^0-9.]/g, '');
            let unitPrice = Number(cleanPriceStr);
            
            // If price is stored in shorthand millions (e.g., 70 instead of 70,000,000)
            if (unitPrice > 0 && unitPrice < 10000) {
                unitPrice = unitPrice * 1000000;
            }
            
            let matchType = true;
            if (aiData.type && aiData.type !== "All") {
                matchType = (String(u.type).toLowerCase() === String(aiData.type).toLowerCase());
            }

            let matchPrice = true;
            if (aiData.maxPrice !== null && !isNaN(unitPrice)) {
                matchPrice = (unitPrice <= aiData.maxPrice);
            }

            return matchType && matchPrice;
        });

        finalFilteredIds = filtered.map(u => u.id);
    }

    // تحديث العدد في الرد ليكون واقعياً ودقيقاً
    let finalReply = aiData.reply;
    if (aiData.isFilterQuery) {
        finalReply = finalReply.replace("{COUNT}", finalFilteredIds.length);
    }

    res.status(200).json({
        reply: finalReply,
        isFilterQuery: aiData.isFilterQuery,
        filteredIds: finalFilteredIds,
        nearTo: aiData.nearTo || null,
        maxWalkingMinutes: aiData.maxWalkingMinutes || null,
        action: aiData.action || null,
        actionUnitId: aiData.actionUnitId || null
    });

  } catch (error) {
    console.error("AI Agent Error:", error);
    
    let userMsg = "Error: " + error.message + " (Please try again)";
    if (error.message && error.message.includes("429 Too Many Requests")) {
        userMsg = "عذراً، لقد تجاوزت الحد الأقصى للأسئلة في الدقيقة (الحد المجاني من Google). يرجى الانتظار لمدة 30 ثانية ثم إرسال سؤالك مرة أخرى! ⏳\n\nSorry, you've exceeded the free-tier requests per minute limit. Please wait 30 seconds and try again! ⏳";
    }

    return res.status(200).json({
        reply: userMsg,
        isFilterQuery: false,
        filteredIds: [],
        nearTo: null,
        maxWalkingMinutes: null,
        action: null,
        actionUnitId: null
    });
  }
};

const askEngineerAI = async (req, res) => {
  try {
    const { question } = req.body;

    let ragContext = "";
    try {
      const result = await embeddingModel.embedContent(question);
      const queryEmbedding = result.embedding.values;

      // Only search within Engineering RAG data
      const chunks = await KnowledgeBase.find({ category: "Engineering" });
      if (chunks && chunks.length > 0) {
        const scoredChunks = chunks.map(chunk => ({
          title: chunk.title,
          content: chunk.content,
          score: cosineSimilarity(queryEmbedding, chunk.embedding)
        }));
        
        scoredChunks.sort((a, b) => b.score - a.score);
        const topChunks = scoredChunks.slice(0, 3).filter(c => c.score > 0.5); 
        
        if (topChunks.length > 0) {
          ragContext = "Relevant Engineering Manual Snippets:\n" + topChunks.map(c => `[${c.title}]: ${c.content}`).join("\n");
        }
      }
    } catch (err) {
      console.error("Error retrieving RAG context:", err);
    }

    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const prompt = `
      You are a Senior Facility Management AI and Chief Engineer for the El-Narges Compound.
      Your job is to assist the maintenance and engineering team with highly technical queries, specifications, and protocols based on the Master Engineering Manual.
      
      Engineer's Question: "${question}"

      ${ragContext ? ragContext : ""}

      Rules:
      1. You MUST reply in English.
      2. Use a professional, highly technical engineering tone.
      3. Rely strictly on the "Relevant Engineering Manual Snippets" provided above. If the answer is not in the snippets, advise the engineer to consult the full manual or state that the specific parameter is not defined in the current RAG context. Do not invent technical parameters.
      4. Format your response cleanly (bullet points are encouraged for multiple parameters).
      5. The response MUST be strictly in JSON format without markdown wrapping, containing only a "reply" field:
      {
        "reply": "Your detailed engineering response..."
      }
    `;

    const responseResult = await generateWithRetry(model, prompt);
    const responseText = responseResult.response.text();
    
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const aiData = JSON.parse(cleanJson);

    res.status(200).json({
        reply: aiData.reply
    });

  } catch (error) {
    console.error("Engineer AI Error:", error);
    res.status(500).json({ error: "Sorry, an error occurred in the Engineer AI." });
  }
};

module.exports = { askAI, askEngineerAI };