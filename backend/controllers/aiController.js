const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const askAI = async (req, res) => {
  try {
    const { question, contextData } = req.body;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 🚀 النهج الجديد: استخدام الـ AI لاستخراج المعايير (Parameters) بدلاً من معالجة البيانات الخام
    const prompt = `
      You are a smart real estate assistant. Analyze the user's question and extract the search criteria.
      User Question: "${question}"

      Rules:
      1. Extract the property type (type): "Apartment", "Villa", or "TwinHouse". If not specified, set to "All".
      2. Extract the maximum price (maxPrice): Convert text to numbers (e.g., "32 million" -> 32000000, "3.5 million" -> 3500000). If no price is mentioned, set to null.
      3. Determine if this is a search/filtering request (isFilterQuery): true or false.
      4. If the user explicitly asks to book or reserve a specific unit by its ID, set "action": "BOOK_UNIT" and "actionUnitId": the requested ID. Otherwise, set them to null.
      5. You MUST reply in English. Use {COUNT} to represent the number of matched units.
      6. The response MUST be strictly in JSON format without markdown wrapping:
      {
        "reply": "Draft a professional reply in English. e.g., 'Absolutely! We found {COUNT} matching units. They have been highlighted on the map.'",
        "isFilterQuery": true/false,
        "type": "Apartment" | "Villa" | "TwinHouse" | "All",
        "maxPrice": number | null,
        "action": "BOOK_UNIT" | null,
        "actionUnitId": number | null
      }
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
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