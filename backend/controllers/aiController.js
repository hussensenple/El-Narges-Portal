const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const askAI = async (req, res) => {
  try {
    // 1. استقبال الداتا من الخريطة (الفرونت إند) مباشرة 
    const { question, contextData } = req.body;

    const dataString = contextData.map(u => {
      const actualPrice = u.price || 'غير محدد';
      return `ID: ${u.id}, Type: ${u.type}, Price: ${actualPrice}`;
    }).join('\n');

    console.log("=== Data Sent to AI (RAG Context) ===");
    console.log(dataString);
    console.log("=====================================");

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 2. هندسة الـ Prompt بأنواع العقارات الجديدة
    // 2. هندسة الـ Prompt بأنواع العقارات الجديدة مع الفلترة الصارمة
    const prompt = `
      You are a smart real estate advisor. You MUST reply in the EXACT SAME LANGUAGE as the user's question.

      هذه بيانات الوحدات المتاحة المستخرجة لحظياً من خريطة الـ GIS:
      ${dataString}

      User Question / سؤال العميل: "${question}"

      CRITICAL RULES:
      1. أنواع العقارات المتاحة: (Apartment شقة, Villa فيلا مستقلة, TwinHouse توين هاوس).
      2. 🚨 فلترة صارمة للنوع (Strict Type Separation): إذا ذكر العميل نوعاً محدداً (مثل "شقة" أو "Apartment")، فيجب عليك تجاهل واستبعاد أي أرقام ID تخص (Villa أو TwinHouse) تماماً، والعكس صحيح.
      3. 🚨 فلترة صارمة للسعر (Strict Price Match): لا تضف أي ID لا يطابق ميزانية أو السعر الذي طلبه العميل.
      4. إذا طلب العميل فلترة، يجب أن تضع أرقام الـ ID لـ **كل** الوحدات المطابقة بدقة داخل مصفوفة "filteredIds"، واجعل "isFilterQuery" = true.
      5. 🚫 لا تكتب العدد في النص أبداً، اكتب فقط {COUNT} وسيقوم النظام بالعد الفعلي وتحديث النص.
      مثال للرد: "بالتأكيد! وجدنا {COUNT} وحدة مطابقة لطلبك. تم تحديدها على الخريطة."
      6. صيغة الرد المطلوبة (Strict JSON format ONLY):
      {
        "reply": "[WRITE YOUR REPLY HERE]",
        "isFilterQuery": true/false,
        "filteredIds": [ID1, ID2, ID3, ...]
      }
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const aiData = JSON.parse(cleanJson);

    // تصحيح العد
    if (aiData.isFilterQuery && aiData.filteredIds) {
        const actualCount = aiData.filteredIds.length;
        if (aiData.reply) {
            aiData.reply = aiData.reply.replace("{COUNT}", actualCount);
        }
    }

    res.status(200).json(aiData);
  } catch (error) {
    console.error("AI Agent Error:", error);
    res.status(500).json({ error: "حدث خطأ في محرك الذكاء الاصطناعي الوكيل." });
  }
};

module.exports = { askAI };