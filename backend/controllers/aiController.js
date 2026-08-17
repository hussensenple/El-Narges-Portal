const { GoogleGenerativeAI } = require("@google/generative-ai");
const KnowledgeBase = require("../models/KnowledgeBase");
const User = require("../models/User");

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

// Auto-retry wrapper for 429 (rate limit) and 503 (overload) errors with exponential backoff
const generateWithRetry = async (model, prompt, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await model.generateContent(prompt);
    } catch (err) {
      const is429 = err.message && err.message.includes('429');
      const is503 = err.message && err.message.includes('503');
      if ((is429 || is503) && attempt < maxRetries) {
        const delay = attempt * 10000; // 10s, 20s, 30s
        console.log(`[AI] ${is503 ? '503 overload' : '429 rate limit'} hit. Retrying in ${delay / 1000}s (attempt ${attempt}/${maxRetries})...`);
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

    // Robust JSON extraction — same pattern as askAI to handle markdown fences or extra text
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? jsonMatch[0] : responseText.replace(/```json/gi, '').replace(/```/g, '').trim();

    let reply = '';
    try {
      const aiData = JSON.parse(cleanJson);
      reply = aiData.reply || cleanJson;
    } catch (_) {
      // If still not parseable, return the raw text as the reply
      reply = cleanJson;
    }

    res.status(200).json({ reply });

  } catch (error) {
    console.error("Engineer AI Error:", error.message);
    let friendlyMsg = 'Sorry, the AI is temporarily unavailable. Please try again in a moment. ⏳';
    if (error.message && error.message.includes('503')) {
      friendlyMsg = 'The AI service is currently experiencing high demand. Please wait a moment and try again. ⏳';
    } else if (error.message && error.message.includes('429')) {
      friendlyMsg = 'Rate limit reached. Please wait 30 seconds and try again. ⏳';
    }
    // Return 200 so the frontend displays it as a chat message, not a crash
    res.status(200).json({ reply: friendlyMsg });
  }
};

const askAdminAI = async (req, res) => {
  try {
    const { question } = req.body;
    
    const users = await User.find().select('username phone email role _id');
    const usersContext = users.map(u => ({ id: u._id, name: u.username, phone: u.phone, email: u.email, role: u.role }));
    
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    
    const prompt = `
      You are an Admin AI Assistant for the El-Narges Compound.
      Your task is to parse the admin's command and return structured actions.
      The admin might want to change the role of one or more users, assign them units, OR bulk update prices of properties based on their Model.
      
      Admin Command: "${question}"
      
      Registered Users Context:
      ${JSON.stringify(usersContext, null, 2)}
      
      Rules:
      1. Identify all users mentioned in the command for role changes. Match them to the Registered Users Context using their name, phone, or email.
      2. For role changes: determine the new role ("owner", "broker", "user", "engineer", "admin"). If the admin ONLY asks to assign extra units to an existing owner or broker, keep "newRole" identical to their currentRole. Extract any specific unit numbers mentioned for that user into the "unitsToAssign" array. If the command says "downgrade to user" or "remove role" or "revoke", the new role is "user".
      3. For bulk price updates: If the admin asks to change the price of properties based on their model (e.g., "Make ModelU apartments 5 million", "تعديل سعر فلل TwinHouse لـ 10 مليون"), you must generate an "UPDATE_PRICE_BY_MODEL" action.
         - "modelType": Extract the model name exactly (e.g., "ModelX", "ModelU", "ModelS", "ModelZ" for apartments, or "StandAlone", "TwinHouse", "TownHouse" for villas).
         - "propertyType": Determine if they mean "apartment" (شقق) or "villa" (فلل).
         - "newPrice": Extract the numeric value of the new price. If they say "5 million" or "5 مليون", output 5000000.
      4. The response MUST be strictly in JSON format without markdown wrapping, containing "reply" and "actions" array.
      5. The "actions" array can contain objects of different types:
      
      For Role Changes:
      {
        "action": "CHANGE_ROLE",
        "userId": "MongoDB ID of the matched user",
        "userName": "Name of the matched user",
        "currentRole": "The user's current role",
        "newRole": "The new role to assign",
        "unitsToAssign": ["unitId1", "unitId2"]
      }
      (If you cannot find a matching user for a role change, set userId to null and explain in the reply)

      For Price Updates:
      {
        "action": "UPDATE_PRICE_BY_MODEL",
        "modelType": "ModelU",
        "propertyType": "apartment",
        "newPrice": 5000000
      }
      
      6. The "reply" must be a conversational confirmation strictly in English.
    `;

    const responseResult = await generateWithRetry(model, prompt);
    const responseText = responseResult.response.text();
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const aiData = JSON.parse(cleanJson);

    res.status(200).json(aiData);

  } catch (error) {
    console.error("Admin AI Error:", error);
    res.status(500).json({ error: "Sorry, an error occurred in the Admin AI." });
  }
};
const generateChatTitle = async (req, res) => {
  try {
    const { firstMessage } = req.body;
    if (!firstMessage) {
      return res.status(400).json({ title: "New Chat" });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const prompt = `
      You are an AI assistant. Summarize the user's intent in 3 to 5 words to be used as a chat title.
      Do not include quotes, periods, or extra text. Reply strictly in English.
      
      User Message: "${firstMessage}"
    `;

    const responseResult = await generateWithRetry(model, prompt);
    let title = responseResult.response.text().trim().replace(/['"]+/g, '');
    
    // Ensure title is short
    if (title.split(' ').length > 8) {
      title = title.split(' ').slice(0, 5).join(' ') + '...';
    }

    res.status(200).json({ title });
  } catch (error) {
    console.error("AI Title Gen Error:", error);
    res.status(500).json({ title: "New Chat" });
  }
};

const UserChat = require('../models/UserChat');

const getUserChats = async (req, res) => {
  try {
    const chats = await UserChat.find({ userId: req.user.id }).sort({ updatedAt: -1 });
    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: "Server error fetching user chats." });
  }
};

const createUserChat = async (req, res) => {
  try {
    const { title, messages, isPinned } = req.body;
    const chat = await UserChat.create({
      userId: req.user.id,
      title: title || 'New Chat',
      messages: messages || [],
      isPinned: isPinned || false
    });
    res.status(201).json(chat);
  } catch (error) {
    res.status(500).json({ error: "Error creating user chat." });
  }
};

const updateUserChat = async (req, res) => {
  try {
    const { title, messages, isPinned } = req.body;
    const chat = await UserChat.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { title, messages, isPinned },
      { new: true }
    );
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: "Error updating user chat." });
  }
};

const deleteUserChat = async (req, res) => {
  try {
    const chat = await UserChat.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    res.json({ message: "Chat deleted" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting user chat." });
  }
};

module.exports = { askAI, askEngineerAI, askAdminAI, generateChatTitle, getUserChats, createUserChat, updateUserChat, deleteUserChat };