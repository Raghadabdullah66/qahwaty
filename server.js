const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const path = require("path");
const cors = require("cors");
const fs = require("fs");

const app = express();

const PORT = process.env.PORT || 3000;


/* =========================================================
   BASIC SETTINGS
========================================================= */

app.set("trust proxy", 1);


/* =========================================================
   DATABASE
========================================================= */

const dataDir =
  process.env.RENDER_DISK_PATH ||
  path.join(__dirname, "data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, {
    recursive: true
  });
}

const dbPath =
  path.join(dataDir, "ghawati.db");

const db =
  new Database(dbPath);


/* =========================================================
   CORS
========================================================= */

app.use(
  cors({
    origin: function (origin, callback) {

      // Requests without an Origin
      // such as health checks
      if (!origin) {
        return callback(null, true);
      }

      const allowed =
        origin.endsWith(".github.io") ||
        origin.includes("localhost") ||
        origin.includes("127.0.0.1");

      if (allowed) {
        return callback(null, true);
      }

      return callback(
        new Error("Not allowed by CORS")
      );
    },

    credentials: true
  })
);


/* =========================================================
   BODY PARSER
========================================================= */

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true
  })
);


/* =========================================================
   SESSION
========================================================= */

app.use(
  session({

    secret:
      process.env.SESSION_SECRET ||
      "qahwaty-secret-change-this",

    resave: false,

    saveUninitialized: false,

    cookie: {

      httpOnly: true,

      // Required because
      // GitHub Pages and Render are different sites
      sameSite: "none",

      // Render uses HTTPS
      secure: true,

      maxAge:
        1000 *
        60 *
        60 *
        8
    }

  })
);


/* =========================================================
   STATIC FILES
========================================================= */

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);


/* =========================================================
   DATABASE TABLES
========================================================= */

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL
      CHECK(role IN ('admin','runner','employee')),
    created_at TEXT NOT NULL
      DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    drink TEXT NOT NULL,
    size TEXT NOT NULL,
    extra TEXT DEFAULT '',
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
      DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(user_id)
      REFERENCES users(id)
  );
`);


/* =========================================================
   DEFAULT USERS
========================================================= */

const userCount =
  db
    .prepare(
      "SELECT COUNT(*) c FROM users"
    )
    .get().c;


if (!userCount) {

  const adminHash =
    bcrypt.hashSync(
      "admin123",
      10
    );


  db
    .prepare(
      `
      INSERT INTO users
      (username,password_hash,name,role)
      VALUES (?,?,?,?)
      `
    )
    .run(
      "admin",
      adminHash,
      "مدير النظام",
      "admin"
    );


  const users = [

    [
      "khalid",
      "خالد",
      "runner"
    ],

    [
      "sara",
      "سارة",
      "employee"
    ],

    [
      "ahmed",
      "أحمد",
      "employee"
    ]

  ];


  const statement =
    db.prepare(
      `
      INSERT INTO users
      (username,password_hash,name,role)
      VALUES (?,?,?,?)
      `
    );


  const tempPassword =
    bcrypt.hashSync(
      "123456",
      10
    );


  users.forEach(user => {

    statement.run(
      user[0],
      tempPassword,
      user[1],
      user[2]
    );

  });

} else {

  db
    .prepare(
      `
      UPDATE users
      SET role='runner'
      WHERE username='khalid'
      `
    )
    .run();

}


/* =========================================================
   AUTH MIDDLEWARE
========================================================= */

function auth(req, res, next) {

  if (!req.session.user) {

    return res
      .status(401)
      .json({
        error: "غير مسجل الدخول"
      });

  }

  next();
}


/* =========================================================
   ROLE MIDDLEWARE
========================================================= */

function role(...roles) {

  return (req, res, next) => {

    if (
      !req.session.user ||
      !roles.includes(
        req.session.user.role
      )
    ) {

      return res
        .status(403)
        .json({
          error:
            "ليس لديك صلاحية لهذه العملية"
        });

    }

    next();

  };

}


/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
  "/api/health",
  (req, res) => {

    res.status(200).json({

      status: "ok",

      timestamp:
        new Date().toISOString()

    });

  }
);


/* =========================================================
   LOGIN
========================================================= */

app.post(
  "/api/login",
  (req, res) => {

    const {
      username,
      password
    } = req.body;


    const user =
      db
        .prepare(
          `
          SELECT *
          FROM users
          WHERE username=?
          `
        )
        .get(username);


    if (
      !user ||
      !bcrypt.compareSync(
        password || "",
        user.password_hash
      )
    ) {

      return res
        .status(401)
        .json({
          error:
            "اسم المستخدم أو كلمة المرور غير صحيحة"
        });

    }


    req.session.user = {

      id: user.id,

      username:
        user.username,

      name:
        user.name,

      role:
        user.role

    };


    // Make sure the session is saved
    // before sending the response
    req.session.save(error => {

      if (error) {

        console.error(
          "SESSION SAVE ERROR:",
          error
        );

        return res
          .status(500)
          .json({
            error:
              "تعذر حفظ جلسة الدخول"
          });

      }


      res.json({

        user:
          req.session.user

      });

    });

  }
);


/* =========================================================
   LOGOUT
========================================================= */

app.post(
  "/api/logout",
  (req, res) => {

    req.session.destroy(error => {

      if (error) {

        return res
          .status(500)
          .json({
            error:
              "تعذر تسجيل الخروج"
          });

      }


      res.json({
        ok: true
      });

    });

  }
);


/* =========================================================
   CURRENT USER
========================================================= */

app.get(
  "/api/me",
  (req, res) => {

    res.json({

      user:
        req.session.user ||
        null

    });

  }
);


/* =========================================================
   GET ORDERS
========================================================= */

app.get(
  "/api/orders",
  auth,
  (req, res) => {

    const orders =
      db
        .prepare(
          `
          SELECT
            o.id,
            o.drink,
            o.size,
            o.extra,
            o.completed,
            o.created_at,
            u.name,
            u.username

          FROM orders o

          JOIN users u
            ON u.id = o.user_id

          WHERE
            date(
              o.created_at,
              'localtime'
            )
            =
            date(
              'now',
              'localtime'
            )

          ORDER BY
            o.id DESC
          `
        )
        .all();


    res.json(orders);

  }
);


/* =========================================================
   CREATE ORDER
========================================================= */

app.post(
  "/api/orders",
  auth,
  role("employee", "admin"),
  (req, res) => {

    const {
      drink,
      size,
      extra
    } = req.body;


    if (!drink || !size) {

      return res
        .status(400)
        .json({
          error:
            "اختاري المشروب والحجم"
        });

    }


    const info =
      db
        .prepare(
          `
          INSERT INTO orders
          (
            user_id,
            drink,
            size,
            extra
          )
          VALUES (?,?,?,?)
          `
        )
        .run(

          req.session.user.id,

          drink,

          size,

          extra || ""

        );


    res.json({

      ok: true,

      id:
        info.lastInsertRowid

    });

  }
);


/* =========================================================
   COMPLETE ORDER
========================================================= */

app.patch(
  "/api/orders/:id",
  auth,
  role("runner", "admin"),
  (req, res) => {

    const completed =
      req.body.completed
        ? 1
        : 0;


    db
      .prepare(
        `
        UPDATE orders
        SET completed=?
        WHERE id=?
        `
      )
      .run(
        completed,
        req.params.id
      );


    res.json({
      ok: true
    });

  }
);


/* =========================================================
   DELETE TODAY ORDERS
========================================================= */

app.delete(
  "/api/orders/today",
  auth,
  role("admin", "runner"),
  (req, res) => {

    db
      .prepare(
        `
        DELETE FROM orders

        WHERE
          date(
            created_at,
            'localtime'
          )
          =
          date(
            'now',
            'localtime'
          )
        `
      )
      .run();


    res.json({
      ok: true
    });

  }
);


/* =========================================================
   STATISTICS
========================================================= */

app.get(
  "/api/stats",
  auth,
  (req, res) => {

    const drinkCounts =
      db
        .prepare(
          `
          SELECT
            drink,
            COUNT(*) count

          FROM orders

          GROUP BY drink

          ORDER BY count DESC
          `
        )
        .all();


    const topPeople =
      db
        .prepare(
          `
          SELECT
            u.name,
            COUNT(*) count

          FROM orders o

          JOIN users u
            ON u.id=o.user_id

          GROUP BY u.id

          ORDER BY count DESC

          LIMIT 5
          `
        )
        .all();


    const totalToday =
      db
        .prepare(
          `
          SELECT
            COUNT(*) c

          FROM orders

          WHERE
            date(
              created_at,
              'localtime'
            )
            =
            date(
              'now',
              'localtime'
            )
          `
        )
        .get().c;


    res.json({

      drinkCounts,

      topPeople,

      totalToday

    });

  }
);


/* =========================================================
   GET USERS
========================================================= */

app.get(
  "/api/users",
  auth,
  role("admin"),
  (req, res) => {

    const users =
      db
        .prepare(
          `
          SELECT
            id,
            username,
            name,
            role,
            created_at

          FROM users

          ORDER BY id DESC
          `
        )
        .all();


    res.json(users);

  }
);


/* =========================================================
   CREATE USER
========================================================= */

app.post(
  "/api/users",
  auth,
  role("admin"),
  (req, res) => {

    const {
      username,
      name,
      password,
      role: userRole
    } = req.body;


    if (
      !username ||
      !name ||
      !password ||
      ![
        "admin",
        "runner",
        "employee"
      ].includes(userRole)
    ) {

      return res
        .status(400)
        .json({
          error:
            "بيانات المستخدم غير مكتملة"
        });

    }


    try {

      const hash =
        bcrypt.hashSync(
          password,
          10
        );


      db
        .prepare(
          `
          INSERT INTO users
          (
            username,
            password_hash,
            name,
            role
          )
          VALUES (?,?,?,?)
          `
        )
        .run(
          username,
          hash,
          name,
          userRole
        );


      res.json({
        ok: true
      });

    } catch {

      res
        .status(400)
        .json({
          error:
            "اسم المستخدم موجود مسبقاً"
        });

    }

  }
);


/* =========================================================
   DELETE USER
========================================================= */

app.delete(
  "/api/users/:id",
  auth,
  role("admin"),
  (req, res) => {

    if (
      Number(req.params.id) ===
      req.session.user.id
    ) {

      return res
        .status(400)
        .json({
          error:
            "لا يمكن حذف حسابك الحالي"
        });

    }


    db
      .prepare(
        `
        DELETE FROM users
        WHERE id=?
        `
      )
      .run(req.params.id);


    res.json({
      ok: true
    });

  }
);


/* =========================================================
   AI REPORT
========================================================= */

app.post(
  "/api/ai-report",
  auth,
  async (req, res) => {

    const stats =
      db
        .prepare(
          `
          SELECT
            drink,
            COUNT(*) count

          FROM orders

          WHERE
            created_at >=
            datetime(
              'now',
              '-7 days'
            )

          GROUP BY drink

          ORDER BY count DESC
          `
        )
        .all();


    const people =
      db
        .prepare(
          `
          SELECT
            u.name,
            COUNT(*) count

          FROM orders o

          JOIN users u
            ON u.id=o.user_id

          WHERE
            o.created_at >=
            datetime(
              'now',
              '-7 days'
            )

          GROUP BY u.id

          ORDER BY count DESC

          LIMIT 5
          `
        )
        .all();


    const favorite =
      stats[0]?.drink ||
      "لم يتم تسجيل طلبات كافية";


    const total =
      stats.reduce(
        (sum, item) =>
          sum + item.count,
        0
      );


    const report = total

      ? `خلال آخر 7 أيام تم تسجيل ${total} طلباً. المشروب الأكثر طلباً هو ${favorite}. ${
          people[0]
            ? `أكثر شخص طلب القهوة هو ${people[0].name} بإجمالي ${people[0].count} طلبات.`
            : ""
        } ننصح بمراجعة استهلاك الكافيين إذا تكررت الطلبات بكثرة، مع الحفاظ على الترطيب والتوازن.`

      : "لا توجد بيانات كافية لإعداد تقرير ذكي حالياً. ابدؤوا بتسجيل الطلبات ثم جرّبوا التقرير مرة أخرى.";


    res.json({

      report,

      data: {
        stats,
        people
      }

    });

  }
);


/* =========================================================
   START SERVER
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `Ghawati Pro running on port ${PORT}`
    );

  }
);