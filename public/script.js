const API = "https://cautious-couscous-production.up.railway.app/api";

// Registro
if (document.getElementById("registerForm")) {
  document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;

    const res = await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (res.ok) {
      alert(`Cuenta creada: ${data.email}`);
      window.location.href = "login.html";
    } else {
      alert(data.error);
    }
  });
}

// Login
if (document.getElementById("loginForm")) {
  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;

    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (res.ok) {
      localStorage.setItem("username", username);
      localStorage.setItem("email", data.email);
      window.location.href = "inbox.html";
    } else {
      alert(data.error);
    }
  });
}

// Inbox
if (document.getElementById("inboxList")) {
  const username = localStorage.getItem("username");
  const email = localStorage.getItem("email");

  if (!username) {
    window.location.href = "login.html";
  }

  document.getElementById("userEmail").textContent = email;

  const loadInbox = async () => {
    const res = await fetch(`${API}/inbox/${username}`);
    const mails = await res.json();

    const list = document.getElementById("inboxList");
    list.innerHTML = "";
    mails.forEach((m) => {
      const li = document.createElement("li");
      li.textContent = `De: ${m.from} | Asunto: ${m.subject} | ${m.date}`;
      list.appendChild(li);
    });
  };

  loadInbox();

  document.getElementById("sendForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const to = e.target.to.value;
    const subject = e.target.subject.value;
    const body = e.target.body.value;

    const res = await fetch(`${API}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: email,
        to,
        subject,
        body
      })
    });

    const data = await res.json();
    if (res.ok) {
      alert("Correo enviado!");
      loadInbox();
    } else {
      alert(data.error);
    }
  });

  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "login.html";
  });
}
