# شرح وتوثيق مشروع "بوابة النرجس" (El Narges Portal)

هذا الملف يحتوي على شرح تفصيلي لهيكلة المشروع، التقنيات المستخدمة، وكيفية ارتباط قواعد البيانات (MongoDB و ArcGIS Online).

---

## 1. نظرة عامة على المشروع (Project Overview)
مشروع "بوابة النرجس" هو منصة عقارية تفاعلية تعتمد على الخرائط ثلاثية الأبعاد (3D Web GIS). المنصة تدمج بين العمليات اللحظية مثل الحجوزات والشكاوى وإدارة المستخدمين (من خلال MongoDB) وبين البيانات الجغرافية المكانية والمجسمات (من خلال خوادم ArcGIS). 
يخدم النظام عدة أنواع من المستخدمين: (زائر، مالك، وسيط عقاري، مهندس، ومدير نظام)، ويحتوي على مميزات مثل الذكاء الاصطناعي (AI Advisor)، التوجيه الذكي (Network Analysis)، وتزامن ثنائي الاتجاه بين القواعد.

---

## 2. التقنيات المستخدمة (Tech Stack)
- **واجهة المستخدم (Frontend):** React.js (Vite), TypeScript, ArcGIS Maps SDK for JS
- **الخادم الخلفي (Backend):** Node.js, Express.js, Socket.io
- **قواعد البيانات:** MongoDB (لإدارة المستخدمين والبيانات الحيوية) + ArcGIS Feature Servers (للبيانات المكانية)
- **الذكاء الاصطناعي:** Google Gemini 2.5 Flash API
- **الخدمات الجغرافية:** ArcGIS Network Analysis, OpenWeatherMap

---

## 3. هيكلة البيانات في ArcGIS Online (AGOL Data Structure)

تعتمد الخريطة على عدة طبقات (Layers) وجداول (Tables) مستضافة على خوادم Esri:

1. **جدول الشقق (Units Table):**
   - **النوع:** Table (ليس له Geometry مباشرة بل يرتبط بالمبنى).
   - **المعرف الأساسي (Primary Key):** `OBJECTID` (رقم صحيح).
   - **أهم الحقول:** `Status` (حالة الوحدة: 1 متاح، 2 مهتم، 3 محجوز، 4 مباع), `OwnerName`, `OwnerPhone`.
   - **تحديث البيانات:** يتم عبر `updateFeatures` REST API.

2. **طبقة الفيلات (Villas_Global):**
   - **النوع:** 3D Object Feature Layer (فيلات و Twinhouses).
   - **المعرف الأساسي:** `GlobalID` (نص GUID) و `OBJECTID`.
   - **تحديث البيانات:** يتم عبر `applyEdits` مع تمرير `useGlobalIds: true`.

3. **طبقة المباني (Buildings_Global):**
   - **النوع:** 3D Object Feature Layer (للعمارات السكنية).
   - تُستخدم بشكل أساسي في عملية الـ HitTest وتوجيه الكاميرا (Zooming).

4. **طبقة الخدمات (Services_Global):**
   - **النوع:** Point Feature Layer (مدارس، مستشفيات، إلخ).
   - **أهم الحقول:** `Type` ويأخذ قيماً رقمية (1 = مدرسة، 2 = مستشفى، 3 = جيم، 4 = تجاري).

---

## 4. هيكلة البيانات في MongoDB (Data Structures)

تم بناء الـ Backend باستخدام Mongoose. إليك التفاصيل الكاملة للـ Schemas:

### أ. نموذج المستخدم (User)
```javascript
{
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'owner', 'broker', 'engineer', 'admin'], default: 'user' },
  ownedUnits: [{ type: ObjectId, ref: 'Unit' }] // مصفوفة تحتوي على الوحدات المملوكة
}
```

### ب. نموذج الوحدة (Unit)
وهو حلقة الوصل الأساسية بين MongoDB و ArcGIS.
```javascript
{
  globalId: { type: String }, 
  arcgisId: { type: String }, // هو الـ OBJECTID في الشقق، أو الـ GlobalID في الفيلات
  unitName: { type: String },
  status: { type: String, default: "1" }, 
  ownerId: { type: ObjectId, ref: 'User', default: null },
  brokerId: { type: ObjectId, ref: 'User', default: null },
  // يتم استخدام { strict: false } للسماح بحفظ حقول إضافية مثل:
  // sourceLayer: 'Units' أو 'Villas_Global' (مهم جداً لتحديد الطبقة المستهدفة)
  // objectId: الرقم التعريفي الظاهر للمستخدم
}
```

### ج. طلبات الحجز (BookingRequest)
```javascript
{
  userId: { type: ObjectId, ref: 'User', required: true },
  unitId: { type: String, required: true }, // arcgisId
  objectId: { type: Number },
  sourceLayer: { type: String, required: true },
  customerName: { type: String },
  customerPhone: { type: String },
  status: { type: String, enum: ['Pending', 'Reserved', 'Approved', 'Rejected', 'Declined'], default: 'Pending' },
  rejectionReason: { type: String }, // 'Served By Another Client', 'Management Decision', 'Client Unresponsive', etc.
  rejectionNotes: { type: String }
}
```

### د. الشكاوى (Complaint)
```javascript
{
  title: { type: String, required: true },
  arcgisId: { type: String, default: 'N/A' },
  type: { type: String, enum: ['internal', 'external'], default: 'internal' },
  images: [{ type: String }],
  description: { type: String, required: true },
  coordinates: { lat: { type: Number }, lon: { type: Number } },
  status: { type: String, default: 'Pending' },
  ownerId: { type: ObjectId, ref: 'User' } // المالك الذي قام بتقديم الشكوى
}
```

### هـ. ملفات الأدوار (Profiles)
- **AdminProfile, BrokerProfile, EngineerProfile**: 
  - جميعها تحتوي على `userId` (مرجع للمستخدم) و `manualId` (الرقم التعريفي اليدوي).
  - الـ EngineerProfile يحتوي إضافياً على `age`, `graduationYear` (ويسمح بمهندس واحد فقط في النظام).

### و. تحليل الرفضات (Rejection Analysis)
- **RejectionAnalysisTab**: واجهة في لوحة الإدارة لتحليل أسباب رفض الطلبات.
  - تجلب البيانات من الـ Endpoint `/api/admin/rejection-analysis`.
  - تعرض الطلبات المرفوضة من الإدارة (`Rejected`) أو من الوسيط (`Declined`) مرتبة من الأحدث للأقدم.
  - تحتوي على فلاتر ديناميكية لعرض الطلبات حسب المصدر وحسب السبب.
  - تعرض رسم بياني (`BarChart`) لتوزيع أسباب الرفض بشكل عام.

---

## 5. العمليات المحورية في النظام (Key Workflows)

### 1. تزامن حالة الوحدات (Syncing)
عندما يتم بيع وحدة أو إلغاء بيعها من لوحة تحكم الإدارة (`/api/roles/assign-property`):
- يقوم الـ Backend بتحديث `ownerId` و `status` في مجموعة الـ `Units` بـ MongoDB.
- يقوم بإرسال HTTP Request (عبر Axios) إلى خادم Esri (`updateFeatures` أو `applyEdits`) لتحديث الـ Status والألوان على الخريطة ثلاثية الأبعاد فوراً.

### 2. التوجيه وأقرب الخدمات (Closest Facilities)
تم إعداد ميزة الـ `ClosestServices` باستخدام ArcGIS REST `closestFacility.solve`. 
لضمان سحب الرصيد (Credits) من حساب المؤسسة بدلاً من الـ API Key المفتوح، تم التخلي عن تمرير الـ API Key في هذه الخدمة، مما يُجبر النظام على استدعاء نافذة تسجيل الدخول `IdentityManager` الخاصة بـ Esri ليقوم المستخدم بصلاحيات عالية (أو الإدارة) بتسجيل الدخول وحساب المسارات بدقة.

**تكامل المساعد الآلي (Chatbot Integration):**
تم ربط المساعد العقاري (AI Advisor) بنفس المحرك التوجيهي الشبكي (Network Routing). عندما يسأل المستخدم أسئلة مثل *"ما هي أقرب الخدمات للوحدة رقم 99؟"* أو *"كم تبعد الفيلا 5 عن المدرسة؟"*، يقوم المساعد بتحديد معرّف الوحدة تلقائياً وتفعيل المحلل الشبكي `closestFacility.solve`. يقوم برسم مسارات الطرق الملونة ثلاثية الأبعاد على الخريطة (أخضر للمدرسة، أحمر للجيم، أزرق للتجاري، وأصفر للمستشفى) وإظهار المسافة الدقيقة والزمن المتوقع للمشي في نافذة المحادثة.

### 3. دليل العقارات (Property Catalog)
يتم جلب البيانات المعروضة في الكروت (Cards) بشكل مباشر من الـ Backend الخاص بـ MongoDB بدلاً من ذاكرة ArcGIS المؤقتة (Cache). هذا يضمن أن تكون البيانات حديثة جداً (مثلاً وحدة تم بيعها للتو تظهر كـ Sold فوراً بناءً على وجود `ownerId`).

### 4. إدارة الوحدات من الخريطة ثلاثية الأبعاد
يمكن للإدارة (`admin`) والمهندس (`engineer`) النقر على أي مبنى أو وحدة سكنية مباشرة من الخريطة ثلاثية الأبعاد `MapViewer`. سيؤدي ذلك إلى فتح شريط جانبي مخصص (`AdminUnitSidebar` / `EngineerUnitSidebar`) يعرض بيانات الوحدة كاملة، وحالة الإشغال، وبيانات المالك، مع إمكانية إدارة وتغيير حالات الشكاوى (الداخلية والخارجية) الخاصة بالمالك مباشرة واستعراض المخطط المعماري للوحدة.

### 5. إدارة الشكاوى والمهام (Engineer Tools)
يحتوي حساب المهندس على مجموعة متكاملة من الأدوات للتحكم في الصيانة:
- **إدارة الفنيين (Technicians Management):** يمكن للمهندس إضافة وحذف الفنيين وتحديد تخصصاتهم ومتابعة عدد المهام النشطة لكل فني.
- **إدارة المهام (Active Tasks):** يتم تحويل الشكاوى الجديدة وتكليف الفنيين بها عبر هذه الواجهة. الشكاوى المحلولة (Solved/Resolved) تُحفظ في قائمة تاريخية ولا تظهر كنقاط نشطة على الخريطة.
- **الشبكة الخدمية (Utility Network):** مجهزة كواجهة (Placeholder) للإضافات المستقبلية لربط وإدارة شبكات المياه والكهرباء بالمشروع.
- **المساعد الآلي (Chatbot Widget):** واجهة دردشة تفاعلية تم ربطها بقاعدة بيانات هندسية متخصصة (RAG) تعتمد على دليل الهندسة والصيانة الشامل (Engineering Master Manual). يقوم المساعد بالرد على استفسارات المهندسين المعقدة بناءً على المعايير المعتمدة وهو مفصول تماماً عن المساعد الآلي الخاص بالعملاء. وتتضمن الواجهة أزراراً لأسئلة مقترحة (Suggested Questions) لتسهيل الوصول السريع للمعلومات دون الحاجة للكتابة.

---

## 6. نظام الإرشاد والتوجيه التفاعلي (Onboarding Tour System)
تم بناء نظام إرشادي تفاعلي ذكي (Walkthrough Tour) باستخدام مكون `WalkthroughTour.tsx` لإرشاد المستخدمين وتوجيههم داخل المنصة بناءً على أدوارهم الحالية:
1. **الزائر (Visitor/Anonymous):** يتم توجيهه للتعرف على الخريطة الثنائية والثلاثية الأبعاد وزر تسجيل الدخول.
2. **المستخدم المسجل (Registered User):** يتم توجيهه للتعرف على أدوات لوحة التحكم الإضافية (الإعدادات، الطلبات، أدوات الطقس والطبقات الجغرافية، أدوات التحليل الشبكي GIS، دليل العقارات، والمساعد العقاري بالذكاء الاصطناعي).
3. **المالك (Owner):** يتم الترحيب به باسمه الشخصي المسجل وتوجيهه خصيصاً للوحة تحكم المالكين الجديدة (My Units) لمتابعة ممتلكاته وتقديم الشكاوى الهندسية.

**خصائص النظام:**
- **تأثير الإضاءة المسلطة (Spotlight Backdrop):** تظليم الشاشة بالكامل عبر CSS مع تسليط الضوء فقط على العنصر النشط المطلوب شرحه.
- **تتبع الجلسة (localStorage):** يبدأ التوجيه تلقائياً لأول مرة فقط عند تحول دور المستخدم، لحمايته من التكرار المزعج.
- **إعادة التشغيل اليدوي:** تم توفير زر المساعدة `📖` في القائمة العلوية اليمنى لإعادة تشغيل دليل الإرشاد في أي وقت يدوياً.

---

## 7. دورة التكامل والمزامنة الحية لإدارة الفنيين (Survey123 & ngrok Live Integration)

تمثل دورة إضافة وإدارة الفنيين (Technicians Management) أحد أقوى نماذج الربط والتكامل المتقدم (Full-stack GIS Integration) في منصة النرجس، حيث تم تحقيق التزامن اللحظي ثنائي الاتجاه بين خوادم سحاب Esri وقاعدة البيانات المحلية:

### 1. الربط عبر الـ Webhook ونفق ngrok
- **الاستبيان الموحد:** تم اعتماد نموذج **ArcGIS Survey123** الرسمي الحقيقي داخل المنصة (عبر إطار `iframe` في نافذة `TechniciansModal`) ليكون الواجهة الموحدة لإدخال الفنيين، سواء من داخل المنصة أو عبر تطبيق الجوال أو رابط Esri المباشر.
- **نفق الاتصال الآمن (ngrok):** لضمان وصول الإشعارات اللحظية (Webhooks) الصادرة من خوادم Esri السحابية إلى خادم Node.js المحلي بدون عوائق أو شاشات حماية (Bypass Screens)، تم اعتماد نفق **ngrok** كجسر ربط مستقر وسريع.
- **معالجة البيانات الذكية (Backend Robustness):** تم تطوير وحدة المعالجة `technicianController.js` لتستخلص أسماء الحقول سواء بالصيغة القياسية أو بصيغة أعمدة Esri (مثل `Full Name` و `Phone Number`)، مع مواءمة التخصصات برمجياً (Smart Enum Mapping) لتتطابق مع قيم Mongoose المعتمدة أو التصنيف التلقائي في `Other (أخرى)` لضمان نجاح الحفظ بنسبة 100%.

### 2. التصميم والمظهر المدمج (Fitted Dark Dashboard)
- **إخفاء الزوائد السحابية:** يتم استدعاء الاستبيان بتمرير البارامتر `?hide=navbar,footer` في الرابط، مما يخفي شريط تنقل Esri ويسمح بظهور التصميم المظلم المخصص (Dark Theme) الذي تم إعداده في تبويب Design ليحاكي مظهر المنصة تماماً.
- **الخدعة البصرية للتكثيف (CSS Scaling Wizardry):** تم تطبيق تقنية تصغير الحجم الافتراضي عبر `transform: scale(0.78)` وحاوية بنسبة `128%`، مما يجعل عناصر الاستبيان (الخطوط وحقول الإدخال والأزرار) مدمجة بشكل احترافي، وتتناسب مع ارتفاع النافذة (`height: 90vh`) بدون ظهور أي أشرطة تمرير مزعجة (Scrollbars).

### 3. التشغيل والإيقاف الموحد (One-Click System Launchers)
لتسهيل تشغيل بيئة العمل المتكاملة دون الحاجة لفتح أطراف متعددة يدوياً، تم توفير نصوص تشغيل آلية في المجلد الرئيسي للمشروع:
- **`Start-Platform.bat`:** يقوم بنقرة مزدوجة بتشغيل خادم Node.js (المنفذ 5000)، وخادم Vite الواجهة الحية (المنفذ 5173)، ونفق ngrok في نوافذ منفصلة، ويفتح متصفح الويب تلقائياً بعد 3 ثوانٍ.
- **`Stop-Platform.bat`:** يقوم بإنهاء جميع عمليات Node.js ونفق ngrok بضغطة واحدة عند الانتهاء من العمل.


