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

const askAI = async (req, res) => {
  try {
    const { question, contextData } = req.body;

    // 1. Fetch RAG Context from Knowledge Base
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

    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    // 🚀 النهج الجديد: استخدام الـ AI للرد على السؤال واستخراج المعايير (Parameters) في نفس الوقت
    const prompt = `
      You are a smart real estate assistant for the El-Narges Compound. 
      Analyze the user's question, answer it using the provided knowledge, and extract any search criteria.
      
      User Question: "${question}"

      ${ragContext ? ragContext : ""}

      Rules:
      1. Extract the property type (type): "Apartment", "Villa", or "TwinHouse". If not specified, set to "All".
      2. Extract the maximum price (maxPrice): Convert text to numbers (e.g., "32 million" -> 32000000, "3.5 million" -> 3500000). If no price is mentioned, set to null.
      3. Determine if this is a search/filtering request (isFilterQuery): true or false.
      4. If the user explicitly asks to book or reserve a specific unit by its ID, set "action": "BOOK_UNIT" and "actionUnitId": the requested ID. Otherwise, set them to null.
      5. You MUST reply in English. Use {COUNT} to represent the number of matched units if they asked to search.
      6. Provide a rich, helpful reply. If they ask about the compound, answer using the 'Relevant Compound Information' provided above. If they ask to search, answer something like 'Absolutely! We found {COUNT} matching units. They have been highlighted on the map.'
      7. If the user mentions proximity to an amenity (e.g., "near the gym", "close to school", "5 minutes from hospital"), extract:
         - "nearTo": one of "School", "Hospital", "GYM", "Commercial", or null if no proximity mentioned.
         - "maxWalkingMinutes": the number of walking minutes mentioned (default to 5 if they just say "near" or "close"). Set to null if no proximity mentioned.
      8. If the user asks about the closest/nearest services to a specific unit or property (e.g., "what services are near unit 99?", "closest services to villa 5", "how far is unit 10 from the gym?"), set "action": "CLOSEST_SERVICE" and "actionUnitId": the unit/property ID number. If they don't mention a specific ID, set actionUnitId to null.
      9. The response MUST be strictly in JSON format without markdown wrapping:
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

    const responseResult = await model.generateContent(prompt);
    const responseText = responseResult.response.text();
    
    const jsonMatch = responseText.match(/\\{[\\s\\S]*\\}/);
    const cleanJson = jsonMatch ? jsonMatch[0] : responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const aiData = JSON.parse(cleanJson);

    // Force override to fix Gemini potentially returning "All" incorrectly
    const qLower = String(req.body.question).toLowerCase();
    if (qLower.includes("villa")) aiData.type = "Villa";
    else if (qLower.includes("apartment") || qLower.includes("flat")) aiData.type = "Apartment";
    else if (qLower.includes("twin")) aiData.type = "TwinHouse";

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
    
    return res.status(200).json({
        reply: "You've hit the AI usage limit. Please try again tomorrow!",
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

    const responseResult = await model.generateContent(prompt);
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