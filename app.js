// ================================
// Qahwaty - Frontend App
// ================================

const API_BASE = "https://qahwaty-backend-bu24.onrender.com";

const $ = (s) => document.querySelector(s);

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


// ================================
// Toast
// ================================

function toast(msg) {
  const t = $("#toast");

  if (!t) {
    alert(msg);
    return;
  }

  t.textContent = msg;
  t.classList.add("show");

  setTimeout(() => {
    t.classList.remove("show");
  }, 2200);
}


// ================================
// API
// ================================

async function api(url, opt = {}) {

  const options = {
    ...opt,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(opt.headers || {})
    }
  };

  const r = await fetch(API_BASE + url, options);

  const d = await r.json().catch(() => ({}));

  if (!r.ok) {
    throw new Error(d.error || "حدث خطأ في الاتصال بالخادم");
  }

  return d;
}


// ================================
// Roles
// ================================

function roleName(r) {
  return {
    admin: "Admin",
    runner: "Runner",
    employee: "Employee"
  }[r] || r;
}


// ================================
// Login
// ================================

const loginForm = $("#loginForm");

if (loginForm) {

  loginForm.onsubmit = async (e) => {

    e.preventDefault();

    try {

      const d = await api("/api/login", {
        method: "POST",

        body: JSON.stringify({
          username: $("#username").value.trim(),
          password: $("#password").value
        })
      });

      me = d.user;

      start();

    } catch (e) {

      toast(e.message);

    }
  };
}


// ================================
// Logout
// ================================

const logoutBtn = $("#logout");

if (logoutBtn) {

  logoutBtn.onclick = async () => {

    try {
      await api("/api/logout", {
        method: "POST"
      });
    } catch (e) {
      console.log(e);
    }

    location.reload();
  };
}


// ================================
// Start App
// ================================

function start() {

  $("#loginView")?.classList.add("hidden");
  $("#app")?.classList.remove("hidden");

  if ($("#hello")) {
    $("#hello").textContent = `مرحباً، ${me.name}`;
  }

  if ($("#profileName")) {
    $("#profileName").textContent = me.name;
  }

  if ($("#profileRole")) {
    $("#profileRole").textContent = roleName(me.role);
  }

  if ($("#avatar")) {
    $("#avatar").textContent = me.name?.[0] || "☕";
  }

  if (me.role !== "admin" && $("#usersNav")) {
    $("#usersNav").style.display = "none";
  }

  renderDrinks();

  loadOrders();

  loadStats();

  loadUsers();
}


// ================================
// Drinks
// ================================

function renderDrinks() {

  const g = $("#drinkGrid");

  if (!g) return;

  g.innerHTML = drinks
    .map(d => `
      <button
        type="button"
        class="drink-option ${d === selectedDrink ? "selected" : ""}"
        data-drink="${d}">
        <span>${icons[d]}</span>
        ${d}
      </button>
    `)
    .join("");

  g.querySelectorAll(".drink-option").forEach(b => {

    b.onclick = () => {

      selectedDrink = b.dataset.drink;

      renderDrinks();

    };

  });
}


// ================================
// Add Order
// ================================

const orderForm = $("#orderForm");

if (orderForm) {

  orderForm.onsubmit = async (e) => {

    e.preventDefault();

    try {

      const nameInput = $("#name");

      const name = nameInput
        ? nameInput.value.trim()
        : "";

      const size = $("#size")?.value || "";

      const extra = $("#extra")?.value || "";

      // إذا كان عندك خانة الاسم في الواجهة
      // نرسل الاسم للـBackend باستخدام user الحالي.
      const result = await api("/api/orders", {

        method: "POST",

        body: JSON.stringify({
          drink: selectedDrink,
          size,
          extra
        })

      });

      console.log("Order created:", result);

      toast("تم تسجيل طلبك ☕🤎");

      if ($("#extra")) {
        $("#extra").value = "";
      }

      if (nameInput) {
        nameInput.value = "";
      }

      await loadOrders();

      await loadStats();

    } catch (e) {

      console.error(e);

      toast(e.message);

    }
  };
}


// ================================
// Load Orders
// ================================

async function loadOrders() {

  try {

    const orders = await api("/api/orders");

    console.log("Orders:", orders);

    if ($("#todayTotal")) {
      $("#todayTotal").textContent = orders.length;
    }

    // Mini list
    if ($("#miniList")) {

      $("#miniList").innerHTML = orders.length

        ? orders
            .slice(0, 4)
            .map(o => `
              <div class="mini-item">
                <span>${o.name}</span>
                <b>${o.drink}</b>
              </div>
            `)
            .join("")

        : "<small>لا توجد طلبات بعد.</small>";
    }


    // Orders table

    if (!$("#ordersTable")) return;

    const canRun = ["runner", "admin"].includes(me?.role);

    if (!orders.length) {

      $("#ordersTable").innerHTML =
        "<p>ما في طلبات اليوم 🤎</p>";

      return;
    }


    $("#ordersTable").innerHTML = `
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
    `;

  } catch (e) {

    console.error("Load orders error:", e);

    if ($("#ordersTable")) {
      $("#ordersTable").innerHTML =
        `<p>تعذر تحميل الطلبات: ${e.message}</p>`;
    }

  }
}


// ================================
// Complete Order
// ================================

window.toggleOrder = async (id, checked) => {

  try {

    await api(`/api/orders/${id}`, {

      method: "PATCH",

      body: JSON.stringify({
        completed: checked
      })

    });

    await loadOrders();

  } catch (e) {

    toast(e.message);

  }
};


// ================================
// Clear Orders
// ================================

const clearOrders = $("#clearOrders");

if (clearOrders) {

  clearOrders.onclick = async () => {

    if (!confirm("مسح طلبات اليوم؟")) {
      return;
    }

    try {

      await api("/api/orders/today", {
        method: "DELETE"
      });

      toast("تم مسح طلبات اليوم 🗑️");

      await loadOrders();

      await loadStats();

    } catch (e) {

      toast(e.message);

    }
  };
}


// ================================
// Statistics
// ================================

async function loadStats() {

  try {

    const d = await api("/api/stats");

    if ($("#statTotal")) {
      $("#statTotal").textContent = d.totalToday || 0;
    }

    if ($("#statDrink")) {
      $("#statDrink").textContent =
        d.drinkCounts?.[0]?.drink || "—";
    }

    if ($("#statPerson")) {
      $("#statPerson").textContent =
        d.topPeople?.[0]?.name || "—";
    }


    if (!$("#bars")) return;

    const counts = d.drinkCounts || [];

    const max = Math.max(
      ...counts.map(x => x.count),
      1
    );

    $("#bars").innerHTML = counts.length

      ? counts.map(x => `

          <div class="bar-row">

            <b>${x.drink}</b>

            <div class="bar-bg">

              <div
                class="bar-fill"
                style="width:${(x.count / max) * 100}%">
              </div>

            </div>

            <strong>${x.count}</strong>

          </div>

        `).join("")

      : "لا توجد بيانات بعد.";

  } catch (e) {

    console.error("Stats error:", e);

  }
}


// ================================
// Wheel
// ================================

const spinBtn = $("#spin");

if (spinBtn) {

  spinBtn.onclick = async () => {

    try {

      const orders = await api("/api/orders");

      const names = [
        ...new Set(
          orders.map(o => o.name)
        )
      ];

      if (!names.length) {

        toast(
          "سجّلوا طلبات اليوم أولاً ☕"
        );

        return;
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

      if ($("#wheelCircle")) {

        $("#wheelCircle").style.transform =
          `rotate(${wheelRotation}deg)`;
      }

      setTimeout(() => {

        if ($("#winner")) {

          $("#winner").textContent =
            `🎉 ${winner} يدفع اليوم!`;
        }

      }, 3100);

      if ($("#wheelNames")) {

        $("#wheelNames").innerHTML =
          names.map(n => `
            <span class="name-chip">
              ${n}
            </span>
          `).join("");
      }

    } catch (e) {

      toast(e.message);

    }

  };
}


// ================================
// Wheel Names
// ================================

async function loadWheelNames() {

  try {

    const orders =
      await api("/api/orders");

    const names = [
      ...new Set(
        orders.map(x => x.name)
      )
    ];

    if ($("#wheelNames")) {

      $("#wheelNames").innerHTML =
        names.map(n => `
          <span class="name-chip">
            ${n}
          </span>
        `).join("");
    }

  } catch (e) {

    console.error(e);

  }
}


// ================================
// AI Report
// ================================

const aiBtn = $("#aiBtn");

if (aiBtn) {

  aiBtn.onclick = async () => {

    aiBtn.disabled = true;

    aiBtn.textContent =
      "جاري التحليل…";

    try {

      const d =
        await api("/api/ai-report", {
          method: "POST"
        });

      if ($("#aiReport")) {
        $("#aiReport").textContent =
          d.report;
      }

    } catch (e) {

      toast(e.message);

    } finally {

      aiBtn.disabled = false;

      aiBtn.textContent =
        "إنشاء التقرير";
    }

  };
}


// ================================
// Users
// ================================

async function loadUsers() {

  if (me?.role !== "admin") {
    return;
  }

  try {

    const users =
      await api("/api/users");

    if (!$("#usersTable")) return;

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

              <td>${u.name}</td>

              <td>${u.username}</td>

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
                        onclick="deleteUser(${u.id})">
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

    console.error("Users error:", e);

  }
}


// ================================
// Delete User
// ================================

window.deleteUser = async (id) => {

  if (!confirm("حذف المستخدم؟")) {
    return;
  }

  try {

    await api(`/api/users/${id}`, {
      method: "DELETE"
    });

    toast("تم حذف المستخدم");

    await loadUsers();

  } catch (e) {

    toast(e.message);

  }
};


// ================================
// Create User
// ================================

const userForm = $("#userForm");

if (userForm) {

  userForm.onsubmit = async (e) => {

    e.preventDefault();

    try {

      await api("/api/users", {

        method: "POST",

        body: JSON.stringify({

          name:
            $("#newName").value.trim(),

          username:
            $("#newUsername").value.trim(),

          password:
            $("#newPassword").value,

          role:
            $("#newRole").value

        })

      });

      e.target.reset();

      toast("تم إنشاء المستخدم ✅");

      await loadUsers();

    } catch (e) {

      toast(e.message);

    }
  };
}


// ================================
// Navigation
// ================================

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
        document.getElementById(
          btn.dataset.section
        );

      if (section) {
        section.classList.add(
          "active-section"
        );
      }


      if ($("#pageTitle")) {

        $("#pageTitle").textContent =
          btn.innerText.trim();
      }


      if (
        btn.dataset.section === "wheel"
      ) {

        loadWheelNames();

      }

    };

  });


// ================================
// Check Existing Login
// ================================

(async () => {

  try {

    const d =
      await api("/api/me");

    if (d.user) {

      me = d.user;

      start();

    }

  } catch (e) {

    console.log(
      "Not logged in yet."
    );

  }

})();