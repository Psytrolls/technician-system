# 🔧 מערכת ניהול ומעקב טכנאים

## מה זה?
מערכת web לניהול ומעקב אחרי עבודת טכנאים בשטח.
- טכנאים מפעילים טיימרים, מעדכנים משימות, ומוסיפים לוגים ידניים
- מנהלים רואים דאשבורד עם סטטיסטיקות, גרפים, ומייצאים CSV/Excel

---

## דרישות מערכת
- **Node.js** v18+ — [nodejs.org](https://nodejs.org)
- **npm** (מגיע עם Node.js)

---

## התקנה והפעלה

### שלב 1 — הורד את הפרויקט
```bash
cd technician-system
```

### שלב 2 — בקנד (שרת API)
```bash
cd backend
npm install
npm start
```
> השרת יפעל על http://localhost:4000

### שלב 3 — פרונטאנד (ממשק משתמש)
פתח טרמינל **חדש** ואז:
```bash
cd frontend
npm install
npm run dev
```
> האפליקציה תפתח על http://localhost:3000

---

## משתמשי ברירת מחדל

| שם משתמש | סיסמה    | תפקיד   |
|----------|----------|---------|
| admin    | admin123 | מנהל    |
| david    | tech123  | טכנאי   |
| yossi    | tech123  | טכנאי   |

---

## מבנה הפרויקט

```
technician-system/
├── backend/
│   ├── server.js          # שרת Express
│   ├── database.js        # SQLite + יצירת טבלאות
│   ├── middleware/
│   │   └── auth.js        # JWT authentication
│   └── routes/
│       ├── auth.js        # כניסה / החלפת סיסמה
│       ├── tasks.js       # CRUD משימות
│       ├── users.js       # CRUD משתמשים
│       ├── timelogs.js    # לוגי זמן + טיימר
│       └── reports.js     # סטטיסטיקות + יצוא
└── frontend/
    ├── app/
    │   ├── login/         # דף כניסה
    │   ├── tech/          # דשבורד טכנאי
    │   └── admin/         # דשבורד מנהל
    │       ├── tasks/     # ניהול משימות
    │       ├── users/     # ניהול משתמשים
    │       └── reports/   # דוחות
    ├── components/
    │   ├── Sidebar.tsx    # ניווט צד
    │   ├── Timer.tsx      # טיימר פעיל
    │   └── ManualLogModal.tsx  # הוספת לוג ידנית
    └── lib/
        └── api.ts         # קריאות API
```

---

## פיצ'רים עיקריים

### טכנאי
- ✅ הפעלת טיימר לפי סוג פעילות (נסיעה, טיפול, התקנה, תחזוקה...)
- ✅ הצמדת פעילות למשימה ספציפית
- ✅ הוספת לוג ידני (למקרה ששכח להפעיל)
- ✅ צפייה במשימות שהוקצו לו
- ✅ עדכון סטטוס משימה

### מנהל
- ✅ דאשבורד עם גרפים וסטטיסטיקות
- ✅ ניהול משימות (יצירה, עריכה, מחיקה, הקצאה)
- ✅ ניהול משתמשים
- ✅ דוחות עם פילטר לפי תאריכים וטכנאי
- ✅ יצוא נתונים לקובץ CSV

---

## API Endpoints

### Auth
- `POST /api/auth/login` — כניסה
- `GET /api/auth/me` — נתוני המשתמש הנוכחי

### Tasks
- `GET /api/tasks` — רשימת משימות
- `POST /api/tasks` — יצירת משימה (מנהל)
- `PUT /api/tasks/:id` — עדכון משימה
- `DELETE /api/tasks/:id` — מחיקת משימה (מנהל)

### Time Logs
- `GET /api/timelogs` — כל הלוגים
- `GET /api/timelogs/active` — טיימר פעיל
- `POST /api/timelogs` — פתיחת טיימר
- `PUT /api/timelogs/:id/stop` — עצירת טיימר

### Reports
- `GET /api/reports/summary` — סיכום סטטיסטי
- `GET /api/reports/export` — יצוא נתונים

---

## פיתוח עתידי (מהאפיון)
- 🗺️ GPS אוטומטי
- 🤖 AI לניתוח תקלות חוזרות
- 📊 אינטגרציה עם Power BI
- 📱 אפליקציית Android
# technician-system
