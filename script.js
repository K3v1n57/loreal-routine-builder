/* ---------- DOM References ---------- */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateBtn = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
// debug UI removed
const productSearch = document.getElementById("productSearch");
const toggleRtlBtn = document.getElementById("toggleRtlBtn");

// track RTL state if present; default false (LTR)
let isRtl = localStorage.getItem("locale_dir") === "rtl";

/* ---------- State ---------- */
let allProducts = [];
let selectedProducts =
  JSON.parse(localStorage.getItem("selectedProducts")) || [];
let messages = [];
let lastWorkerResponse = null;

/* ---------- Constants ---------- */
// Use your deployed Worker URL (update if you renamed it)
const WORKER_URL = "https://ai-chatbot.gyeninkk.workers.dev";

/* ---------- Load Product Data ---------- */
async function loadProducts() {
  try {
    const res = await fetch("products.json");
    const data = await res.json();
    allProducts = data.products;
  } catch (error) {
    console.error("Error loading products:", error);
    appendMessage("bot", "❌ Failed to load product list.");
  }
}

/* ---------- Display Products ---------- */
function displayProducts(products) {
  if (!products.length) {
    productsContainer.innerHTML = `<div class="placeholder-message">No products in this category.</div>`;
    return;
  }

  productsContainer.innerHTML = products
    .map((p) => {
      const isSelected = selectedProducts.find((sp) => sp.id === p.id);
      return `
        <div class="product-card ${isSelected ? "selected" : ""}" data-id="${
        p.id
      }" role="button" tabindex="0" aria-pressed="${
        isSelected ? "true" : "false"
      }">
          <img src="${p.image}" alt="${p.name}" />
          <div class="product-info">
            <h3>${p.name}</h3>
            <p>${p.brand}</p>
            <button class="desc-btn" aria-label="Toggle description">Details</button>
            <div class="product-desc hidden">${p.description}</div>
          </div>
        </div>`;
    })
    .join("");

  addProductListeners();
}

/* ---------- Add Card Listeners ---------- */
function addProductListeners() {
  document.querySelectorAll(".product-card").forEach((card) => {
    const id = parseInt(card.dataset.id);

    // Select/unselect product
    card.addEventListener("click", (e) => {
      if (e.target.classList.contains("desc-btn")) return;
      toggleProduct(id);
    });

    // Support keyboard selection (Enter / Space)
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleProduct(id);
      }
    });

    // Show/hide description
    const descBtn = card.querySelector(".desc-btn");
    descBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const desc = card.querySelector(".product-desc");
      desc.classList.toggle("hidden");
    });
  });
}

/* ---------- Toggle Product Selection ---------- */
function toggleProduct(id) {
  const product = allProducts.find((p) => p.id === id);
  const exists = selectedProducts.find((sp) => sp.id === id);

  if (exists) {
    selectedProducts = selectedProducts.filter((sp) => sp.id !== id);
  } else {
    selectedProducts.push(product);
  }

  localStorage.setItem("selectedProducts", JSON.stringify(selectedProducts));
  updateSelectedList();
  // Re-apply current filters/search so the grid stays in sync
  filterAndDisplayProducts();
}

/* ---------- Update Selected Products List ---------- */
function updateSelectedList() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `<p>No products selected yet.</p>`;
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (p) => `
        <div class="chip">
          ${p.name}
          <button class="remove-chip" data-id="${p.id}">&times;</button>
        </div>`
    )
    .join("");

  document.querySelectorAll(".remove-chip").forEach((btn) => {
    btn.addEventListener("click", () =>
      toggleProduct(parseInt(btn.dataset.id))
    );
  });
}

/* ---------- Category Filter ---------- */
categoryFilter.addEventListener("change", async (e) => {
  filterAndDisplayProducts();
});

// Real-time product search
if (productSearch) {
  productSearch.addEventListener("input", () => {
    filterAndDisplayProducts();
  });
}

function filterAndDisplayProducts() {
  const cat = categoryFilter?.value || "";
  const q = productSearch?.value?.trim().toLowerCase() || "";

  // If no category is selected and there's no search query, keep the grid hidden
  // and show a helpful prompt instead of listing everything on first load.
  if (!cat && !q) {
    productsContainer.innerHTML = `<div class="placeholder-message">Choose a category to view products.</div>`;
    return;
  }

  let filtered = Array.isArray(allProducts) ? allProducts.slice() : [];
  if (cat) filtered = filtered.filter((p) => p.category === cat);
  if (q) {
    filtered = filtered.filter((p) => {
      const hay = `${p.name} ${p.brand} ${p.description}`.toLowerCase();
      return hay.includes(q);
    });
  }

  displayProducts(filtered);
}

/* ---------- Generate Routine ---------- */
generateBtn.addEventListener("click", async () => {
  if (!selectedProducts.length) {
    appendMessage(
      "bot",
      "Please select at least one product before generating your routine!"
    );
    return;
  }

  appendMessage("user", "Generate my skincare routine");
  appendMessage("bot", "✨ Working on your personalized routine...");

  const routinePrompt = `
You are a professional skincare advisor for L'Oréal.
Using these selected products, create a personalized skincare routine.
Products: ${selectedProducts.map((p) => p.name).join(", ")}.
Describe the order of use, time of day (AM/PM), and quick skincare tips.
`;

  messages.push({ role: "user", content: routinePrompt });
  await sendToAI();
});

/* ---------- Chat Form Submit ---------- */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  appendMessage("user", text);
  userInput.value = "";
  messages.push({ role: "user", content: text });
  await sendToAI();
});

/* ---------- Send Message to AI Worker ---------- */
async function sendToAI() {
  try {
    // Prepare a copy of messages so we don't permanently mutate `messages`.
    const messagesToSend = Array.isArray(messages) ? [...messages] : [];
    // Note: web-search toggle removed; send messages as-is.

    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: messagesToSend,
        model: "gpt-4o",
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    // Read raw text first so we can show it in the debug panel even if it's not valid JSON
    const raw = await res.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (e) {
      data = { raw };
    }

    // Save the last worker response (kept for possible future inspection)
    lastWorkerResponse = data;

    if (!res.ok) {
      console.error("Worker error:", data);
      appendMessage("bot", `⚠️ Worker error: ${res.status}`);
      return;
    }
    // If the worker returned OpenAI JSON, ensure choices exist.
    // Support both chat-style responses (.choices[0].message.content)
    // and older/text-style (.choices[0].text) as a fallback.
    // Accept several response shapes: chat completions, text completions, or a simple { reply: '...' } from some workers
    let content =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      data?.reply ??
      data?.answer ??
      null;
    if (!content) {
      // helpful debug message including available keys so you can inspect issues
      const preview = JSON.stringify(data || {}).slice(0, 1000);
      appendMessage(
        "bot",
        `⚠️ No AI reply. Worker returned an unexpected response. Debug (truncated): ${preview}`
      );
      console.error("Unexpected AI response:", data);
      return;
    }
    appendMessage("bot", content);
    messages.push({ role: "assistant", content });
  } catch (err) {
    console.error("Network error:", err);
    appendMessage(
      "bot",
      "❌ Unable to reach AI service. Check your Worker URL or API key."
    );
  }
}

/* ---------- Chat Display Helper ---------- */
function appendMessage(sender, text) {
  const div = document.createElement("div");
  div.classList.add("chat-message", sender);
  // Remove simple markdown asterisks (bold/italic) for cleaner display from worker replies
  function stripAsterisks(s) {
    if (typeof s !== "string") return s;
    // Remove **bold** then *italic* patterns
    return s.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1");
  }

  const rawText = sender === "bot" ? stripAsterisks(text) : text;

  // Basic HTML-escape to avoid accidental markup injection.
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function linkify(escaped) {
    // Match http/https URLs (avoid matching trailing punctuation like ).)
    return escaped.replace(/(https?:\/\/[^\s)]+)/g, (m) => {
      const url = m.replace(/\)+$/, "");
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
  }

  // Format plain-text into HTML with paragraphs and lists so numbered or bulleted
  // sequences don't appear clumped together. Supports numbered lists (1.) and
  // bullet lists (- or *). Also splits a header like "Morning Routine: 1. ..."
  // into a header paragraph followed by a list.
  function formatMessageText(s) {
    if (typeof s !== "string") return escapeHtml(String(s));
    // Escape first
    let escaped = escapeHtml(s);
    // If a header is followed immediately by a numbered item on the same line,
    // insert a newline so the parser treats the numbers as a list start.
    escaped = escaped.replace(/:\s*(\d+\.)/g, ":\n$1");

    const lines = escaped.split(/\r?\n/);
    // We'll build lists with nesting support so numbered items remain in the
    // same <ol> and bullets that follow a numbered item become a nested <ul>
    // inside that <li>.
    let html = "";
    let inOl = false; // are we inside a top-level ordered list?
    let inUl = false; // are we inside a top-level unordered list (not nested)?
    let nestedUlOpen = false; // nested <ul> inside the current <li>

    // Helper to close nested/unordered lists when a block ends
    function closeNestedUl() {
      if (nestedUlOpen) {
        html += "</ul>";
        nestedUlOpen = false;
      }
    }

    function closeAllLists() {
      closeNestedUl();
      if (inOl) {
        html += "</ol>";
        inOl = false;
      }
      if (inUl) {
        html += "</ul>";
        inUl = false;
      }
    }

    // Recognize bullets including the common '•' bullet used by some models
    const bulletRegex = /^[\u2022•\-\*]\s+/;

    lines.forEach((rawLine) => {
      const line = rawLine.trim();

      // Header like '### Header' or 'Morning Routine (AM):' -> render bold
      const headerMatch = line.match(/^#{1,6}\s*(.*)/);
      if (headerMatch) {
        closeAllLists();
        const headerText = headerMatch[1].trim();
        html += `<p><strong>${linkify(headerText)}</strong></p>`;
        return;
      }

      // Also treat single-line labels that end with ':' as a bold header
      if (line.endsWith(":") && !line.match(/^\d+\.|^[-*\u2022•]/)) {
        closeAllLists();
        html += `<p><strong>${linkify(line.slice(0, -1).trim())}</strong></p>`;
        return;
      }

      // Numbered list item
      if (line.match(/^\d+[\.)]\s+/)) {
        // If a top-level ul (not nested) is open, close it first
        if (inUl) {
          html += "</ul>";
          inUl = false;
        }

        if (!inOl) {
          html += "<ol>";
          inOl = true;
        } else {
          // Close any nested ul that belonged to the previous <li>
          closeNestedUl();
        }

        // strip leading numeric tokens (handles '1. 1. Title' cases)
        let item = line
          .replace(/^\d+[\.)]\s+/, "")
          .replace(/^(?:\d+[\.)]\s*)+/, "");
        html += `<li>${linkify(item)}</li>`;
        return;
      }

      // Bullet lines (can be nested under the previous numbered <li>)
      if (bulletRegex.test(line)) {
        const item = line.replace(bulletRegex, "");
        // If we're inside an ordered list, open a nested ul for this li
        if (inOl) {
          if (!nestedUlOpen) {
            // open nested ul directly after the last added <li>
            html = html.replace(
              /<li>([^<]*)<\/li>$/s,
              (m, p1) => `<li>${p1}<ul>`
            );
            nestedUlOpen = true;
          }
          html += `<li>${linkify(item)}</li>`;
          return;
        }

        // top-level unordered list
        if (!inUl) {
          if (inOl) {
            // if an ordered list was open but we didn't treat the bullets as nested,
            // close the ordered list and start a ul (fallback)
            html += "</ol>";
            inOl = false;
          }
          html += "<ul>";
          inUl = true;
        }
        html += `<li>${linkify(item)}</li>`;
        return;
      }

      // Blank line: close nested ul but leave top-level ol open (so numbered items
      // separated by blank lines are still part of the same ordered list). If we
      // want blank lines to break the list entirely, change behavior here.
      if (line === "") {
        closeNestedUl();
        // add a paragraph break for spacing
        html += "<p></p>";
        return;
      }

      // Regular paragraph text: close lists and render paragraph
      closeAllLists();
      html += `<p>${linkify(line)}</p>`;
    });

    // Final cleanup: if we opened a nested ul by altering the previous <li>, ensure it's closed
    if (nestedUlOpen) html += "</ul>";
    if (inOl) html += "</ol>";
    if (inUl) html += "</ul>";
    return html;
  }

  const formatted = formatMessageText(rawText);
  div.innerHTML = `<strong>${
    sender === "user" ? "You" : "Bot"
  }:</strong> ${formatted}`;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Debug UI removed */

/* ---------- Initialization ---------- */
(async function init() {
  await loadProducts();
  // Render products grid after loading
  if (Array.isArray(allProducts) && allProducts.length) {
    filterAndDisplayProducts();
  }
  updateSelectedList();

  // Debug panel and UI ready

  if (selectedProducts.length) {
    appendMessage(
      "bot",
      "👋 Welcome back! Your saved products are still selected."
    );
  } else {
    appendMessage(
      "bot",
      "💄 Hello! Select a category to start exploring L’Oréal products."
    );
  }
})();

/* ---------- RTL helpers ---------- */
function applyDirection(dir) {
  try {
    document.documentElement.dir = dir;
    localStorage.setItem("locale_dir", dir);
    isRtl = dir === "rtl";
    if (toggleRtlBtn) toggleRtlBtn.textContent = isRtl ? "RTL (on)" : "RTL";
  } catch (e) {
    console.error("Failed to set direction:", e);
  }
}

if (toggleRtlBtn) {
  toggleRtlBtn.addEventListener("click", () => {
    applyDirection(isRtl ? "ltr" : "rtl");
  });
}
