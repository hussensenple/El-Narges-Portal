const { GoogleGenerativeAI } = require("@google/generative-ai");
const Unit = require('../models/Unit'); 

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const askAI = async (req, res) => {
  try {
    const { question } = req.body;

    // 1. جلب البيانات (تطبيق مبدأ الـ RAG)ِ
    const availableUnits = await Unit.find({ 
      status: { $in: ['Available', 'available', 'AVAILABLE'] } 
    });

    const dataString = availableUnits.map(u => {
      const actualPrice = u.totalPrice || u.Total_Price || u.price || 'غير محدد';
      return `ID: ${u.arcgisObjectId}, Type: ${u.unitType}, Floor: ${u.floor}, Price: ${actualPrice}`;
    }).join('\n');

    console.log("=== Data Sent to AI (RAG Context) ===");
    console.log(dataString);
    console.log("=====================================");

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 2. هندسة الـ Prompt (إضافة قدرات الـ Agent)
    const prompt = `
      You are a smart real estate advisor. You MUST reply in the EXACT SAME LANGUAGE as the user's question.
      أنت مستشار عقاري ذكي وخبير في مشروع "النرجس".

      هذه بيانات المباني والوحدات المتاحة في قاعدة البيانات:
      ${dataString}

      User Question / سؤال العميل: "${question}"

      CRITICAL RULES (قواعد هامة جداً):
      1. 🌐 LANGUAGE MATCHING: Detect the language of the user's question. If English, reply in English. If Arabic, reply in Arabic. DO NOT mix languages.
      2. أنواع المباني: (Tower برج, Building مبنى, Villa فيلا).
      3. السعر مسجل بالملايين (رقم 70 يعني 70 مليون جنيه مصري / 70 Million EGP).
      4. حساب الاستثمار (ROI): إذا سأل العميل عن السعر المستقبلي، افترض زيادة سنوية 15%.
      5. الفلترة المكانية: إذا كان سؤال العميل يتطلب البحث والتصفية، اجعل "isFilterQuery" = true، وضع الأرقام في "filteredIds".
      6. الاستفسار العام: إذا كان السؤال مجرد استفسار، اجعل "isFilterQuery" = false.
      
      🚨 AI Agent Actions (أوامر الوكيل الذكي) 🚨:
      7. إذا طلب العميل صراحة (شراء، حجز، تأجير) وحدة معينة، اجعل قيمة "action" = "BOOK_UNIT" وضع رقم الوحدة في "actionUnitId".
      8. إذا لم يطلب الحجز صراحة، اجعل "action" = "NONE" و "actionUnitId" = null.
      9. إذا قررت اتخاذ أمر "BOOK_UNIT"، يجب أن يكون نص الـ "reply" مشجعاً، واطلب منه تأكيد الحجز.

      🏗️ Architectural Description & UX (قواعد الوصف والواجهة):
      10. Tower: برج مكون من [عدد الأدوار] أدوار / A [number]-story tower.
      11. Building: وحدة سكنية في الدور [رقم الدور] ضمن مبنى مكون من [إجمالي الأدوار] / Residential unit on floor [number] in a [total]-story building.
      12. Villa: فيلا مستقلة / Standalone Villa.
      13. العملة دائماً "جنيه مصري" أو "EGP".
      14. ردك النهائي يجب أن يكون كائن JSON فقط ولا تكتب أي حرف خارجه لعدم تعطيل النظام.
      15. 🚫 منع السرد والعد الذاتي (Counting Ban): إياك أن تسرد تفاصيل الوحدات، وإياك أن تحاول عدها بنفسك لأنك تخطئ في العد. بدلاً من الرقم، اكتب دائماً الكلمة المفتاحية {COUNT} وسيقوم النظام باستبدالها بالعدد الحقيقي لاحقاً. 
      مثال للرد الصحيح: "وجدنا {COUNT} برج متاح أقل من 70 مليون. تم تحديدها على الخريطة." / "We found {COUNT} available towers under 70 million EGP. They are highlighted on the map."

      صيغة الرد المطلوبة (Strict JSON format):
      {
        "reply": "[WRITE YOUR REPLY HERE]",
        "targetUnitId": 347,
        "isFilterQuery": false,
        "filteredIds": [],
        "action": "BOOK_UNIT", 
        "actionUnitId": 347
      }
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // تنظيف الـ JSON في حال الـ AI بعت Markdown tags
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const aiData = JSON.parse(cleanJson);

// --- تصحيح هلوسة الذكاء الاصطناعي في العد ---
if (aiData.isFilterQuery && aiData.filteredIds) {
    const actualCount = aiData.filteredIds.length;
    // هيستبدل كلمة {COUNT} اللي في الـ Prompt بالرقم الحقيقي 32
    if (aiData.reply) {
        aiData.reply = aiData.reply.replace("{COUNT}", actualCount);
    }
}
// ---------------------------------------------

res.status(200).json(aiData);
  } catch (error) {
    console.error("AI Agent Error:", error);
    res.status(500).json({ error: "حدث خطأ في محرك الذكاء الاصطناعي الوكيل." });
  }
};

module.exports = { askAI };