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

      const chunks = await KnowledgeBase.find({});
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

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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
      7. The response MUST be strictly in JSON format without markdown wrapping:
      {
        "reply": "Your rich, context-aware reply to the user...",
        "isFilterQuery": true/false,
        "type": "Apartment" | "Villa" | "TwinHouse" | "All",
        "maxPrice": number | null,
        "action": "BOOK_UNIT" | null,
        "actionUnitId": number | null
      }
    `;

    const responseResult = await model.generateContent(prompt);
    const responseText = responseResult.response.text();
    
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const aiData = JSON.parse(cleanJson);

    let finalFilteredIds = [];

    // 🚀 تطبيق الفلترة برمجياً (100% دقة ومطابقة للـ Catalog)
    if (aiData.isFilterQuery) {
        const filtered = contextData.filter(u => {
            const unitPrice = Number(u.price);
            
            let matchType = true;
            if (aiData.type !== "All") {
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
        action: aiData.action || null,
        actionUnitId: aiData.actionUnitId || null
    });

  } catch (error) {
    console.error("AI Agent Error:", error);
    res.status(500).json({ error: "Sorry, an error occurred in the AI Agent." });
  }
};

module.exports = { askAI };