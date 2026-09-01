const API_BASE = "https://qahwaty-backend-bu24.onrender.com";

const $ = s => document.querySelector(s);

let me = null;
let selectedDrink = "Latte";
let wheelRotation = 0;

const drinks = [
  "Espresso",
  "Latte",
  "Cappuccino",
  "White Flat",
  "V60",
  "Turkish"
];

const icons = {
  Espresso: "☕",
  Latte: "🥛",
  Cappuccino: "☕",
  "White Flat": "🥛",
  V60: "◉",
  Turkish: "🫖"
};

function toast(msg) {
  const t = $("#toast");
  if (!t) return;

  t.textContent = msg;
  t.classList.add("show");

  setTimeout(() => {
    t.classList.remove("show");
  }, 2200);
}

async function api(url, opt = {}) {
  const r = await fetch(API_BASE + url, {
    headers: {
      "Content-Type": "application/json"
    },
    ...opt
  });

  const d = await r.json().catch(() => ({}));

  if (!r.ok) {
    throw Error(d.error || "حدث خطأ");
  }

  return d;
}

function roleName(r) {
  return {
    admin: "Admin",
    runner: "Runner",
    employee: "Employee"
  }[r] || r;
}


/* ================= LOGIN ================= */

$("#loginForm").onsubmit = async e => {
  e.preventDefault();

  try {
    const d = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: $("#username").value,
        password: $("#password").value
      })
    });

    me = d.user;

    start();

  } catch (e) {
    toast(e.message);
  }
};


/* ================= LOGOUT ================= */

$("#logout").onclick = async () => {

  try {
    await api("/api/logout", {
      method: "POST"
    });
  } catch {}

  location.reload();
};


/* ================= START APP ================= */

function start() {

  $("#loginView").classList.add("hidden");
  $("#app").classList.remove("hidden");

  $("#hello").textContent = `مرحباً، ${me.name}`;

  $("#profileName").textContent = me.name;

  $("#profileRole").textContent = roleName(me.role);

  $("#avatar").textContent = me.name[0];

  if (me.role !== "admin") {
    $("#usersNav").style.display = "none";
  }

  renderDrinks();

  loadOrders();

  loadStats();

  loadUsers();
}


/* ================= DRINKS ================= */

function renderDrinks() {

  const g = $("#drinkGrid");

  g.innerHTML = drinks.map(d => `
    <button
      type="button"
      class="drink-option ${d === selectedDrink ? "selected" : ""}"
      data-drink="${d}"
    >
      <span>${icons[d]}</span>
      ${d}
    </button>
  `).join("");

  g.querySelectorAll(".drink-option").forEach(b => {

    b.onclick = () => {

      selectedDrink = b.dataset.drink;

      renderDrinks();
    };

  });
}


/* ================= ADD ORDER ================= */

$("#orderForm").onsubmit = async e => {

  e.preventDefault();

  try {

    await api("/api/orders", {
      method: "POST",

      body: JSON.stringify({
        drink: selectedDrink,
        size: $("#size").value,
        extra: $("#extra").value
      })
    });

    toast("تم تسجيل طلبك ☕");

    $("#extra").value = "";

    loadOrders();

    loadStats();

  } catch (e) {

    toast(e.message);

  }
};


/* ================= ORDERS ================= */

async function loadOrders() {

  try {

    const orders = await api("/api/orders");

    $("#todayTotal").textContent = orders.length;

    $("#miniList").innerHTML =
      orders.slice(0, 4).map(o => `
        <div class="mini-item">
          <span>${o.name}</span>
          <b>${o.drink}</b>
        </div>
      `).join("")
      || "<small>لا توجد طلبات بعد.</small>";


    const canRun = ["runner", "admin"].includes(me.role);


    $("#ordersTable").innerHTML = orders.length

      ? `
        <table class="table">

          <thead>
            <tr>
              <th>الاسم</th>
              <th>المشروب</th>
              <th>الحجم</th>
              <th>الإضافة</th>
              <th>الحالة</th>
            </tr>
          </thead>

          <tbody>

            ${orders.map(o => `

              <tr class="${o.completed ? "done" : ""}">

                <td>${o.name}</td>

                <td>${o.drink}</td>

                <td>
                  <span class="pill">
                    ${o.size}
                  </span>
                </td>

                <td>
                  ${o.extra || "—"}
                </td>

                <td>

                  ${
                    canRun

                    ? `
                      <input
                        type="checkbox"
                        ${o.completed ? "checked" : ""}
                        onchange="toggleOrder(${o.id}, this.checked)"
                      >
                    `

                    : (
                      o.completed
                      ? "✓ جاهز"
                      : "قيد التجهيز"
                    )
                  }

                </td>

              </tr>

            `).join("")}

          </tbody>

        </table>
      `

      : "<p>ما في طلبات اليوم 🤎</p>";

  } catch (e) {

    toast(e.message);

  }
}


/* ================= COMPLETE ORDER ================= */

window.toggleOrder = async (id, checked) => {

  try {

    await api(`/api/orders/${id}`, {
      method: "PATCH",

      body: JSON.stringify({
        completed: checked
      })
    });

    loadOrders();

  } catch (e) {

    toast(e.message);

  }
};


/* ================= CLEAR ORDERS ================= */

$("#clearOrders").onclick = async () => {

  if (!confirm("مسح طلبات اليوم؟")) {
    return;
  }

  try {

    await api("/api/orders/today", {
      method: "DELETE"
    });

    toast("تم مسح طلبات اليوم");

    loadOrders();

    loadStats();

  } catch (e) {

    toast(e.message);

  }
};


/* ================= STATISTICS ================= */

async function loadStats() {

  try {

    const d = await api("/api/stats");

    $("#statTotal").textContent =
      d.totalToday;

    $("#statDrink").textContent =
      d.drinkCounts[0]?.drink || "—";

    $("#statPerson").textContent =
      d.topPeople[0]?.name || "—";


    const max = Math.max(
      ...d.drinkCounts.map(x => x.count),
      1
    );


    $("#bars").innerHTML = d.drinkCounts.length

      ? d.drinkCounts.map(x => `

          <div class="bar-row">

            <b>${x.drink}</b>

            <div class="bar-bg">

              <div
                class="bar-fill"
                style="width:${x.count / max * 100}%"
              ></div>

            </div>

            <strong>${x.count}</strong>

          </div>

        `).join("")

      : "لا توجد بيانات بعد.";

  } catch (e) {

    toast(e.message);

  }
}


/* ================= WHEEL ================= */

$("#spin").onclick = async () => {

  try {

    const orders = await api("/api/orders");

    const names = [
      ...new Set(
        orders.map(o => o.name)
      )
    ];

    if (!names.length) {

      return toast(
        "سجّلوا طلبات اليوم أولاً"
      );

    }


    const winner =
      names[
        Math.floor(
          Math.random() * names.length
        )
      ];


    wheelRotation +=
      1440 +
      Math.floor(
        Math.random() * 360
      );


    $("#wheelCircle").style.transform =
      `rotate(${wheelRotation}deg)`;


    setTimeout(() => {

      $("#winner").textContent =
        `🎉 ${winner} يدفع اليوم!`;

    }, 3100);


    $("#wheelNames").innerHTML =
      names.map(n => `
        <span class="name-chip">
          ${n}
        </span>
      `).join("");

  } catch (e) {

    toast(e.message);

  }
};


async function loadWheelNames() {

  try {

    const o = await api("/api/orders");

    $("#wheelNames").innerHTML = [

      ...new Set(
        o.map(x => x.name)
      )

    ].map(n => `
      <span class="name-chip">
        ${n}
      </span>
    `).join("");

  } catch (e) {

    toast(e.message);

  }
}


/* ================= AI REPORT ================= */

$("#aiBtn").onclick = async () => {

  const b = $("#aiBtn");

  b.disabled = true;

  b.textContent = "جاري التحليل…";

  try {

    const d = await api(
      "/api/ai-report",
      {
        method: "POST"
      }
    );

    $("#aiReport").textContent =
      d.report;

  } catch (e) {

    toast(e.message);

  } finally {

    b.disabled = false;

    b.textContent = "إنشاء التقرير";
  }
};


/* ================= USERS ================= */

async function loadUsers() {

  if (me?.role !== "admin") {
    return;
  }

  try {

    const users =
      await api("/api/users");


    $("#usersTable").innerHTML = `

      <table class="table">

        <thead>

          <tr>
            <th>الاسم</th>
            <th>Username</th>
            <th>الدور</th>
            <th></th>
          </tr>

        </thead>


        <tbody>

          ${users.map(u => `

            <tr>

              <td>
                ${u.name}
              </td>

              <td>
                ${u.username}
              </td>

              <td>

                <span class="pill">
                  ${roleName(u.role)}
                </span>

              </td>

              <td>

                ${
                  u.id === me.id
                  ? ""
                  : `
                    <button
                      class="danger"
                      onclick="deleteUser(${u.id})"
                    >
                      حذف
                    </button>
                  `
                }

              </td>

            </tr>

          `).join("")}

        </tbody>

      </table>
    `;

  } catch (e) {

    toast(e.message);

  }
}


/* ================= DELETE USER ================= */

window.deleteUser = async id => {

  if (!confirm("حذف المستخدم؟")) {
    return;
  }

  try {

    await api(`/api/users/${id}`, {
      method: "DELETE"
    });

    toast("تم حذف المستخدم");

    loadUsers();

  } catch (e) {

    toast(e.message);

  }
};


/* ================= CREATE USER ================= */

$("#userForm").onsubmit = async e => {

  e.preventDefault();

  try {

    await api("/api/users", {

      method: "POST",

      body: JSON.stringify({

        name: $("#newName").value,

        username:
          $("#newUsername").value,

        password:
          $("#newPassword").value,

        role:
          $("#newRole").value

      })

    });


    e.target.reset();

    toast("تم إنشاء المستخدم");

    loadUsers();

  } catch (e) {

    toast(e.message);

  }
};


/* ================= NAVIGATION ================= */

document
  .querySelectorAll("nav button")
  .forEach(btn => {

    btn.onclick = () => {

      document
        .querySelectorAll("nav button")
        .forEach(x =>
          x.classList.remove("active")
        );


      btn.classList.add("active");


      document
        .querySelectorAll(".section")
        .forEach(s =>
          s.classList.remove(
            "active-section"
          )
        );


      const section =
        $("#" + btn.dataset.section);

      if (section) {

        section.classList.add(
          "active-section"
        );

      }


      $("#pageTitle").textContent =
        btn.innerText.trim();


      if (
        btn.dataset.section === "wheel"
      ) {

        loadWheelNames();

      }

    };

  });


/* ================= AUTO LOGIN ================= */

(async () => {

  try {

    const d =
      await api("/api/me");

    if (d.user) {

      me = d.user;

      start();

    }

  } catch {}

})();