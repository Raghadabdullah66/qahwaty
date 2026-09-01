const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database("ghawati.db");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "change-this-secret-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: false, maxAge: 1000 * 60 * 60 * 8 }
}));
app.use(express.static(path.join(__dirname, "public")));

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','runner','employee')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  drink TEXT NOT NULL,
  size TEXT NOT NULL,
  extra TEXT DEFAULT '',
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

const count = db.prepare("SELECT COUNT(*) c FROM users").get().c;
if (!count) {
  const hash = bcrypt.hashSync("admin123", 10);
  db.prepare("INSERT INTO users (username,password_hash,name,role) VALUES (?,?,?,?)")
    .run("admin", hash, "مدير النظام", "admin");
  const users = [
    ["khalid", "خالد", "employee"],
    ["sara", "سارة", "employee"],
    ["ahmed", "أحمد", "runner"]
  ];
  const stmt = db.prepare("INSERT INTO users (username,password_hash,name,role) VALUES (?,?,?,?)");
  const temp = bcrypt.hashSync("123456", 10);
  users.forEach(u => stmt.run(u[0], temp, u[1], u[2]));
}

function auth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "غير مسجل الدخول" });
  next();
}
function role(...roles) {
  return (req,res,next) => {
    if (!req.session.user || !roles.includes(req.session.user.role))
      return res.status(403).json({ error: "ليس لديك صلاحية لهذه العملية" });
    next();
  };
}

app.post("/api/login", (req,res) => {
  const { username, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE username=?").get(username);
  if (!user || !bcrypt.compareSync(password || "", user.password_hash))
    return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
  req.session.user = { id:user.id, username:user.username, name:user.name, role:user.role };
  res.json({ user:req.session.user });
});

app.post("/api/logout", (req,res) => req.session.destroy(() => res.json({ ok:true })));
app.get("/api/me", (req,res) => res.json({ user:req.session.user || null }));

app.get("/api/orders", auth, (req,res) => {
  const orders = db.prepare(`
    SELECT o.id,o.drink,o.size,o.extra,o.completed,o.created_at,u.name,u.username
    FROM orders o JOIN users u ON u.id=o.user_id
    WHERE date(o.created_at,'localtime') = date('now','localtime')
    ORDER BY o.id DESC
  `).all();
  res.json(orders);
});

app.post("/api/orders", auth, role("employee","admin"), (req,res) => {
  const { drink, size, extra } = req.body;
  if (!drink || !size) return res.status(400).json({error:"اختاري المشروب والحجم"});
  const info = db.prepare("INSERT INTO orders(user_id,drink,size,extra) VALUES(?,?,?,?)")
    .run(req.session.user.id, drink, size, extra || "");
  res.json({ id: info.lastInsertRowid });
});

app.patch("/api/orders/:id", auth, role("runner","admin"), (req,res) => {
  const completed = req.body.completed ? 1 : 0;
  db.prepare("UPDATE orders SET completed=? WHERE id=?").run(completed, req.params.id);
  res.json({ok:true});
});

app.delete("/api/orders/today", auth, role("admin","runner"), (req,res) => {
  db.prepare("DELETE FROM orders WHERE date(created_at,'localtime') = date('now','localtime')").run();
  res.json({ok:true});
});

app.get("/api/stats", auth, (req,res) => {
  const drinkCounts = db.prepare(`
    SELECT drink, COUNT(*) count FROM orders GROUP BY drink ORDER BY count DESC
  `).all();
  const topPeople = db.prepare(`
    SELECT u.name, COUNT(*) count FROM orders o JOIN users u ON u.id=o.user_id
    GROUP BY u.id ORDER BY count DESC LIMIT 5
  `).all();
  const totalToday = db.prepare(`
    SELECT COUNT(*) c FROM orders WHERE date(created_at,'localtime')=date('now','localtime')
  `).get().c;
  res.json({drinkCounts,topPeople,totalToday});
});

app.get("/api/users", auth, role("admin"), (req,res) => {
  res.json(db.prepare("SELECT id,username,name,role,created_at FROM users ORDER BY id DESC").all());
});

app.post("/api/users", auth, role("admin"), (req,res) => {
  const {username,name,password,role: userRole} = req.body;
  if (!username || !name || !password || !["admin","runner","employee"].includes(userRole))
    return res.status(400).json({error:"بيانات المستخدم غير مكتملة"});
  try {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare("INSERT INTO users(username,password_hash,name,role) VALUES(?,?,?,?)")
      .run(username,hash,name,userRole);
    res.json({ok:true});
  } catch {
    res.status(400).json({error:"اسم المستخدم موجود مسبقاً"});
  }
});

app.delete("/api/users/:id", auth, role("admin"), (req,res) => {
  if (Number(req.params.id) === req.session.user.id)
    return res.status(400).json({error:"لا يمكن حذف حسابك الحالي"});
  db.prepare("DELETE FROM users WHERE id=?").run(req.params.id);
  res.json({ok:true});
});

app.post("/api/ai-report", auth, async (req,res) => {
  const stats = db.prepare(`
    SELECT drink, COUNT(*) count FROM orders
    WHERE created_at >= datetime('now','-7 days')
    GROUP BY drink ORDER BY count DESC
  `).all();
  const people = db.prepare(`
    SELECT u.name, COUNT(*) count FROM orders o JOIN users u ON u.id=o.user_id
    WHERE o.created_at >= datetime('now','-7 days')
    GROUP BY u.id ORDER BY count DESC LIMIT 5
  `).all();
  const favorite = stats[0]?.drink || "لم يتم تسجيل طلبات كافية";
  const total = stats.reduce((a,b)=>a+b.count,0);
  const report = total
    ? `خلال آخر 7 أيام تم تسجيل ${total} طلباً. المشروب الأكثر طلباً هو ${favorite}. ${people[0] ? `أكثر شخص طلب القهوة هو ${people[0].name} بإجمالي ${people[0].count} طلبات.` : ""} ننصح بمراجعة استهلاك الكافيين إذا تكررت الطلبات بكثرة، مع الحفاظ على الترطيب والتوازن.`
    : "لا توجد بيانات كافية لإعداد تقرير ذكي حالياً. ابدؤوا بتسجيل الطلبات ثم جرّبوا التقرير مرة أخرى.";
  res.json({report, data:{stats,people}});
});

app.listen(PORT, () => console.log(`Ghawati Pro running at http://localhost:${PORT}`));