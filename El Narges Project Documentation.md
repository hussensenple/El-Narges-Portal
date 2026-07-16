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
  status: { type: String, enum: ['Pending', 'Reserved', 'Approved', 'Rejected', 'Declined'], default: 'Pending' }
}
```

### د. الشكاوى (Complaint)
```javascript
{
  title: { type: String, required: true },
  arcgisId: { type: String, default: 'N/A' },
  type: { type: String, enum: ['internal', 'external'], default: 'internal' },
  description: { type: String, required: true },
  coordinates: { lat: { type: Number }, lon: { type: Number } },
  status: { type: String, default: 'Pending' },
  ownerId: { type: ObjectId, ref: 'User' } // المالك الذي قام بتقديم الشكوى
}
```

### هـ. ملفات الأدوار (Profiles)
- **AdminProfile, BrokerProfile, EngineerProfile**: 
  - جميعها تحتوي على `userId` (مرجع للمستخدم) و `manualId` (الرقم التعريفي اليدوي).
  - الـ EngineerProfile يحتوي إضافياً على `age`, `speciality`, `graduationYear`.

---

## 5. العمليات المحورية في النظام (Key Workflows)

### 1. تزامن حالة الوحدات (Syncing)
عندما يتم بيع وحدة أو إلغاء بيعها من لوحة تحكم الإدارة (`/api/roles/assign-property`):
- يقوم الـ Backend بتحديث `ownerId` و `status` في مجموعة الـ `Units` بـ MongoDB.
- يقوم بإرسال HTTP Request (عبر Axios) إلى خادم Esri (`updateFeatures` أو `applyEdits`) لتحديث الـ Status والألوان على الخريطة ثلاثية الأبعاد فوراً.

### 2. التوجيه وأقرب الخدمات (Closest Facilities)
تم إعداد ميزة الـ `ClosestServices` باستخدام ArcGIS REST `closestFacility.solve`. 
لضمان سحب الرصيد (Credits) من حساب المؤسسة بدلاً من الـ API Key المفتوح، تم التخلي عن تمرير الـ API Key في هذه الخدمة، مما يُجبر النظام على استدعاء نافذة تسجيل الدخول `IdentityManager` الخاصة بـ Esri ليقوم المستخدم بصلاحيات عالية (أو الإدارة) بتسجيل الدخول وحساب المسارات بدقة.

### 3. دليل العقارات (Property Catalog)
يتم جلب البيانات المعروضة في الكروت (Cards) بشكل مباشر من الـ Backend الخاص بـ MongoDB بدلاً من ذاكرة ArcGIS المؤقتة (Cache). هذا يضمن أن تكون البيانات حديثة جداً (مثلاً وحدة تم بيعها للتو تظهر كـ Sold فوراً بناءً على وجود `ownerId`).
