/*
 * HQ BÁ KHÍ frontend.
 * Chỉ gọi backend của bạn; không đặt Telegram Bot Token ở đây.
 */
const CONFIG = {
  // Sau khi triển khai Worker, dán URL HTTPS của Worker vào đây:
  API_BASE_URL: "https://YOUR-WORKER.your-subdomain.workers.dev",
};

const $ = (id) => document.getElementById(id);
const deviceStorageKey = "hq_bakhi_device_id";
const keyStorageKey = "hq_bakhi_activation_key";
let requests = 0;

function makeDeviceId() {
  if (window.crypto && crypto.randomUUID) return "HQ-" + crypto.randomUUID();
  return "HQ-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
}
let deviceId = localStorage.getItem(deviceStorageKey);
if (!deviceId) {
  deviceId = makeDeviceId();
  localStorage.setItem(deviceStorageKey, deviceId);
}
$("deviceId").value = deviceId;
$("activationKey").value = sessionStorage.getItem(keyStorageKey) || "";

function addLog(title, detail) {
  const list = $("logList");
  const empty = list.querySelector(".empty");
  if (empty) empty.remove();
  const item = document.createElement("div");
  item.className = "log-item";
  const time = document.createElement("div");
  time.className = "log-time";
  time.textContent = new Date().toLocaleTimeString("vi-VN", {hour:"2-digit", minute:"2-digit", second:"2-digit"});
  const content = document.createElement("div");
  content.className = "log-content";
  content.textContent = title;
  const small = document.createElement("small");
  small.textContent = detail;
  content.appendChild(small);
  item.append(time, content);
  list.prepend(item);
}

function showResult(text, kind = "") {
  const box = $("result");
  box.className = "result " + kind;
  box.replaceChildren();
  const icon = document.createElement("span");
  icon.className = "result-icon";
  icon.textContent = kind === "ok" ? "✓" : kind === "bad" ? "!" : "⌁";
  const message = document.createElement("span");
  message.textContent = text;
  box.append(icon, message);
}

async function api(path, payload) {
  if (!CONFIG.API_BASE_URL || CONFIG.API_BASE_URL.includes("YOUR-WORKER")) {
    throw new Error("Chưa cấu hình API_BASE_URL. Hãy triển khai Worker và dán URL vào app.js.");
  }
  const response = await fetch(CONFIG.API_BASE_URL.replace(/\/$/, "") + path, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.error || "Backend trả về lỗi.");
  return data;
}

$("copyDevice").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(deviceId);
    $("copyDevice").textContent = "ĐÃ SAO CHÉP";
    setTimeout(() => $("copyDevice").textContent = "SAO CHÉP", 1300);
  } catch {
    $("deviceId").select();
    document.execCommand("copy");
  }
});

$("activateBtn").addEventListener("click", async () => {
  const key = $("activationKey").value.trim();
  const message = $("activationMessage");
  if (!key) {
    message.className = "message bad";
    message.textContent = "Hãy nhập KEY trước.";
    return;
  }
  message.className = "message";
  message.textContent = "Đang xác thực với máy chủ…";
  try {
    await api("/api/activate", {key, deviceId});
    sessionStorage.setItem(keyStorageKey, key);
    message.className = "message ok";
    message.textContent = "KEY hợp lệ trên máy chủ. Thiết bị đã được kích hoạt.";
    addLog("Kích hoạt thiết bị thành công", deviceId);
  } catch (error) {
    message.className = "message bad";
    message.textContent = error.message;
  }
});

$("linkForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const link = $("linkInput").value.trim();
  const note = $("noteInput").value.trim();
  const key = $("activationKey").value.trim();
  let parsed;
  try {
    parsed = new URL(link);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error();
  } catch {
    showResult("Link không hợp lệ. Hãy nhập URL bắt đầu bằng https:// hoặc http://.", "bad");
    return;
  }
  if (!key) {
    showResult("Hãy nhập KEY trước khi gửi yêu cầu.", "bad");
    return;
  }
  const button = event.submitter;
  button.disabled = true;
  button.querySelector("span").textContent = "ĐANG GỬI…";
  showResult("Đang gửi yêu cầu đến backend…");
  try {
    const data = await api("/api/submit", {link: parsed.href, note, key, deviceId});
    requests += 1;
    $("requestCount").textContent = String(requests).padStart(2, "0");
    $("backendStatus").textContent = "ĐÃ KẾT NỐI";
    showResult(data.message || "Đã gửi yêu cầu đến Telegram.", "ok");
    addLog("Đã gửi yêu cầu", parsed.href);
    $("noteInput").value = "";
  } catch (error) {
    showResult(error.message, "bad");
    addLog("Yêu cầu chưa gửi được", error.message);
  } finally {
    button.disabled = false;
    button.querySelector("span").textContent = "GỬI YÊU CẦU";
  }
});

$("clearLog").addEventListener("click", () => {
  $("logList").replaceChildren();
  const empty = document.createElement("div");
  empty.className = "empty";
  empty.textContent = "Chưa có hoạt động nào.";
  $("logList").appendChild(empty);
});
