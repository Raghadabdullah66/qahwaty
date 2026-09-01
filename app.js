const API_BASE = "https://qahwaty-backend-bu24.onrender.com";

const $ = (selector) => document.querySelector(selector);

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


/* =========================
   API
========================= */

async function api(url, options = {}) {

  const response = await fetch(API_BASE + url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.message ||
      `حدث خطأ (${response.status})`
    );
  }

  return data;
}


/* =========================
   Toast
========================= */

function toast(message) {

  const t = $("#toast");

  if (!t) {
    alert(message);
    return;
  }

  t.textContent = message;
  t.classList.add("show");

  setTimeout(() => {
    t.classList.remove("show");
  }, 2200);
}


/* =========================
   Roles
========================= */

function roleName(role) {

  return {
    admin: "Admin",
    runner: "Runner",
    employee: "Employee"
  }[role] || role;
}


/* =========================
   LOGIN
========================= */

const loginForm = $("#loginForm");

if (loginForm) {

  loginForm.onsubmit = async (e) => {

    e.preventDefault();

    try {

      const username = $("#username").value.trim();
      const password = $("#password").value;

      if (!username || !password) {
        toast("اكتب اسم المستخدم وكلمة المرور");
        return;
      }

      const data = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({
          username,
          password
        })
      });

      me = data.user;

      start();

    } catch (error) {

      console.error(error);
      toast(error.message);

    }
  };
}


/* =========================
   LOGOUT
========================= */

const logoutButton = $("#logout");

if (logoutButton) {

  logoutButton.onclick = async () => {

    try {
      await api("/api/logout", {
        method: "POST"
      });
    } catch (error) {
      console.error(error);
    }

    location.reload();
  };
}


/* =========================
   START APP
========================= */

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


/* =========================
   DRINKS
========================= */

function renderDrinks() {

  const grid = $("#drinkGrid");

  if (!grid) return;

  grid.innerHTML = drinks
    .map(drink => `
      <button
        type="button"
        class="drink-option ${drink === selectedDrink ? "selected" : ""}"
        data-drink="${drink}"
      >
        <span>${icons[drink]}</span>
        ${drink}
      </button>
    `)
    .join("");

  grid.querySelectorAll(".drink-option").forEach(button => {

    button.onclick = () => {

      selectedDrink = button.dataset.drink;

      renderDrinks();
    };
  });
}


/* =========================
   ADD ORDER
========================= */

const orderForm = $("#orderForm");

if (orderForm) {

  orderForm.onsubmit = async (e) => {

    e.preventDefault();

    try {

      const name = $("#name")?.value?.trim();

      const size = $("#size")?.value;

      const extra = $("#extra")?.value?.trim() || "";

      if (!name) {
        toast("اكتب اسمك أولاً");
        return;
      }

      if (!selectedDrink) {
        toast("اختر المشروب");
        return;
      }

      if (!size) {
        toast("اختر الحجم");
        return;
      }

      await api("/api/orders", {

        method: "POST",

        body: JSON.stringify({
          name,
          drink: selectedDrink,
          size,
          extra
        })

      });

      toast("تم تسجيل طلبك ☕");

      if ($("#extra")) {
        $("#extra").value = "";
      }

      await loadOrders();
      await loadStats();

    } catch (error) {

      console.error("ADD ORDER ERROR:", error);

      toast(error.message);
    }
  };
}


/* =========================
   LOAD ORDERS
========================= */

async function loadOrders() {

  try {

    const orders = await api("/api/orders");

    if ($("#todayTotal")) {
      $("#todayTotal").textContent = orders.length;
    }

    if ($("#miniList")) {

      $("#miniList").innerHTML =
        orders
          .slice(0, 4)
          .map(order => `
            <div class="mini-item">
              <span>${order.name}</span>
              <b>${order.drink}</b>
            </div>
          `)
          .join("")
        ||
        "<small>لا توجد طلبات بعد.</small>";
    }


    const canRun =
      me &&
      ["runner", "admin"].includes(me.role);


    if ($("#ordersTable")) {

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

            ${orders.map(order => `

              <tr class="${order.completed ? "done" : ""}">

                <td>${order.name}</td>

                <td>${order.drink}</td>

                <td>
                  <span class="pill">
                    ${order.size}
                  </span>
                </td>

                <td>
                  ${order.extra || "—"}
                </td>

                <td>

                  ${
                    canRun

                      ? `
                        <input
                          type="checkbox"
                          ${order.completed ? "checked" : ""}
                          onchange="toggleOrder(${order.id}, this.checked)"
                        >
                      `

                      : (
                        order.completed
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
    }

  } catch (error) {

    console.error("LOAD ORDERS ERROR:", error);

    toast(error.message);
  }
}


/* =========================
   COMPLETE ORDER
========================= */

window.toggleOrder = async function(id, checked) {

  try {

    await api(`/api/orders/${id}`, {

      method: "PATCH",

      body: JSON.stringify({
        completed: checked
      })

    });

    await loadOrders();

  } catch (error) {

    console.error(error);

    toast(error.message);
  }
};


/* =========================
   CLEAR ORDERS
========================= */

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

      toast("تم مسح طلبات اليوم");

      await loadOrders();
      await loadStats();

    } catch (error) {

      console.error(error);

      toast(error.message);
    }
  };
}


/* =========================
   STATISTICS
========================= */

async function loadStats() {

  try {

    const data = await api("/api/stats");


    if ($("#statTotal")) {
      $("#statTotal").textContent =
        data.totalToday || 0;
    }


    if ($("#statDrink")) {

      $("#statDrink").textContent =
        data.drinkCounts?.[0]?.drink || "—";
    }


    if ($("#statPerson")) {

      $("#statPerson").textContent =
        data.topPeople?.[0]?.name || "—";
    }


    if ($("#bars")) {

      const counts = data.drinkCounts || [];

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
                  style="width:${(x.count / max) * 100}%"
                ></div>

              </div>

              <strong>${x.count}</strong>

            </div>

          `).join("")

        : "لا توجد بيانات بعد.";
    }

  } catch (error) {

    console.error("STATS ERROR:", error);

    toast(error.message);
  }
}


/* =========================
   WHEEL
========================= */

const spinButton = $("#spin");

if (spinButton) {

  spinButton.onclick = async () => {

    try {

      const orders = await api("/api/orders");

      const names = [
        ...new Set(
          orders.map(order => order.name)
        )
      ];


      if (!names.length) {

        toast(
          "سجّلوا طلبات اليوم أولاً"
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
        Math.floor(Math.random() * 360);


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
          names
            .map(name => `
              <span class="name-chip">
                ${name}
              </span>
            `)
            .join("");
      }

    } catch (error) {

      console.error(error);

      toast(error.message);
    }
  };
}


/* =========================
   WHEEL NAMES
========================= */

async function loadWheelNames() {

  try {

    const orders =
      await api("/api/orders");

    const names = [
      ...new Set(
        orders.map(order => order.name)
      )
    ];


    if ($("#wheelNames")) {

      $("#wheelNames").innerHTML =
        names
          .map(name => `
            <span class="name-chip">
              ${name}
            </span>
          `)
          .join("");
    }

  } catch (error) {

    console.error(error);

    toast(error.message);
  }
}


/* =========================
   AI REPORT
========================= */

const aiButton = $("#aiBtn");

if (aiButton) {

  aiButton.onclick = async () => {

    aiButton.disabled = true;
    aiButton.textContent =
      "جاري التحليل…";

    try {

      const data =
        await api("/api/ai-report", {
          method: "POST"
        });


      if ($("#aiReport")) {

        $("#aiReport").textContent =
          data.report || "لا يوجد تقرير";
      }

    } catch (error) {

      console.error(error);

      toast(error.message);

    } finally {

      aiButton.disabled = false;
      aiButton.textContent =
        "إنشاء التقرير";
    }
  };
}


/* =========================
   USERS
========================= */

async function loadUsers() {

  if (!me || me.role !== "admin") {
    return;
  }

  try {

    const users =
      await api("/api/users");


    if (!$("#usersTable")) {
      return;
    }


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

          ${users.map(user => `

            <tr>

              <td>${user.name}</td>

              <td>${user.username}</td>

              <td>
                <span class="pill">
                  ${roleName(user.role)}
                </span>
              </td>

              <td>

                ${
                  user.id === me.id
                    ? ""
                    : `
                      <button
                        class="danger"
                        onclick="deleteUser(${user.id})"
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

  } catch (error) {

    console.error(error);

    toast(error.message);
  }
}


/* =========================
   DELETE USER
========================= */

window.deleteUser = async function(id) {

  if (!confirm("حذف المستخدم؟")) {
    return;
  }

  try {

    await api(`/api/users/${id}`, {
      method: "DELETE"
    });

    toast("تم حذف المستخدم");

    await loadUsers();

  } catch (error) {

    console.error(error);

    toast(error.message);
  }
};


/* =========================
   CREATE USER
========================= */

const userForm = $("#userForm");

if (userForm) {

  userForm.onsubmit = async (e) => {

    e.preventDefault();

    try {

      await api("/api/users", {

        method: "POST",

        body: JSON.stringify({

          name: $("#newName").value.trim(),

          username:
            $("#newUsername").value.trim(),

          password:
            $("#newPassword").value,

          role:
            $("#newRole").value

        })

      });


      userForm.reset();

      toast("تم إنشاء المستخدم");

      await loadUsers();

    } catch (error) {

      console.error(error);

      toast(error.message);
    }
  };
}


/* =========================
   NAVIGATION
========================= */

document
  .querySelectorAll("nav button")
  .forEach(button => {

    button.onclick = () => {

      document
        .querySelectorAll("nav button")
        .forEach(btn =>
          btn.classList.remove("active")
        );

      button.classList.add("active");


      document
        .querySelectorAll(".section")
        .forEach(section =>
          section.classList.remove(
            "active-section"
          )
        );


      const section =
        $("#" + button.dataset.section);


      if (section) {
        section.classList.add(
          "active-section"
        );
      }


      if ($("#pageTitle")) {

        $("#pageTitle").textContent =
          button.innerText.trim();
      }


      if (
        button.dataset.section === "wheel"
      ) {

        loadWheelNames();
      }

    };

  });


/* =========================
   CHECK LOGIN
========================= */

(async function () {

  try {

    const data =
      await api("/api/me");

    if (data.user) {

      me = data.user;

      start();
    }

  } catch (error) {

    console.log(
      "Not logged in yet."
    );

  }

})();