(() => {
  "use strict";

  const CART_KEY = "needapartnow-cart-v1";
  const CHECKOUT_URL = "https://needapartnow-checkout.needapartnow.workers.dev/create-checkout-session";
  const STOCKED_COLORS = [
    "solid black",
    "solid grey",
    "solid blue",
    "light blue translucent",
    "dark green translucent",
    "light green translucent",
    "bright orange translucent",
    "light purple translucent",
    "light pink translucent",
  ];
  const CATALOG = {
    "susie-shipped": { name: "Susie Knife Sharpener", price: 6599, fulfillment: "shipped", options: "two-component-strop" },
    "susie-pickup": { name: "Susie Knife Sharpener — Local Pickup", price: 5599, fulfillment: "pickup", options: "two-component-strop" },
    "grandma-patsy-shipped": { name: "Grandma Patsy Knife Sharpener", price: 5599, fulfillment: "shipped", options: "two-component" },
    "grandma-patsy-pickup": { name: "Grandma Patsy Knife Sharpener — Local Pickup", price: 4599, fulfillment: "pickup", options: "two-component" },
    "jamesy-shipped": { name: "Jamesy Knife Sharpener", price: 4599, fulfillment: "shipped", options: "single-body" },
    "jamesy-pickup": { name: "Jamesy Knife Sharpener — Local Pickup", price: 3599, fulfillment: "pickup", options: "single-body" },
    "cousin-louie-shipped": { name: "Cousin Louie Knife Sharpener", price: 3599, fulfillment: "shipped", options: "single-body" },
    "cousin-louie-pickup": { name: "Cousin Louie Knife Sharpener — Local Pickup", price: 2599, fulfillment: "pickup", options: "single-body" },
    "go-fer-stick-shipped": { name: "Go-Fer Stick", price: 3999, fulfillment: "shipped", options: "none" },
    "go-fer-stick-pickup": { name: "Go-Fer Stick — Local Pickup", price: 2999, fulfillment: "pickup", options: "none" },
    "chip-screen-spider-shipped": { name: "Chip Screen Spider", price: 5500, fulfillment: "shipped", options: "none" },
  };

  function getCart() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter((line) => CATALOG[line.sku]) : [];
    } catch {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartCounts(cart);
  }

  function updateCartCounts(cart = getCart()) {
    const count = cart.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
    document.querySelectorAll("[data-cart-count]").forEach((node) => {
      node.textContent = String(count);
    });
  }

  function lineKey(line) {
    return `${line.sku}:${JSON.stringify(line.options || {})}`;
  }

  function money(cents) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
    })[char]);
  }

  function optionSurcharge(optionType, options) {
    const choice = options?.colorOption || "standard";
    if (choice === "stocked") return optionType === "single-body" ? 500 : 1000;
    if (choice === "custom-holder" || choice === "custom-base") return 2000;
    if (choice === "custom-both") return 4000;
    if (choice === "custom") return 2000;
    return 0;
  }

  function optionSummary(options = {}) {
    const parts = [];
    const labels = {
      "light-brown": "Light-brown strop",
      "dark-brown": "Dark-brown strop",
      standard: "Standard color",
      stocked: "Stocked color option",
      "custom-holder": "Custom holder",
      "custom-base": "Custom base",
      "custom-both": "Custom holder and base",
      custom: "Custom color",
    };
    if (options.stropColor) parts.push(labels[options.stropColor] || options.stropColor);
    if (options.colorOption) parts.push(labels[options.colorOption] || options.colorOption);
    if (options.holderColor) parts.push(`Holder: ${options.holderColor}`);
    if (options.baseColor) parts.push(`Base: ${options.baseColor}`);
    if (options.bodyColor) parts.push(`Color: ${options.bodyColor}`);
    return parts;
  }

  function setStatus(form, message, isError = false) {
    const status = form.querySelector("[data-cart-status]");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("cart-error", isError);
  }

  function collectOptions(form) {
    const options = {};
    form.querySelectorAll("[data-cart-option]").forEach((field) => {
      if (!field.disabled && field.value) options[field.dataset.cartOption] = field.value.trim();
    });
    return options;
  }

  function addToCart(button) {
    const form = button.closest("[data-cart-product]");
    const sku = button.dataset.cartSku;
    const item = CATALOG[sku];
    if (!form || !item) return;
    const invalidField = Array.from(form.querySelectorAll("input, select"))
      .find((field) => !field.disabled && !field.checkValidity());
    if (invalidField) {
      invalidField.reportValidity();
      return;
    }

    const options = collectOptions(form);
    const cart = getCart();
    const otherFulfillment = cart.find((line) => CATALOG[line.sku]?.fulfillment !== item.fulfillment);
    if (otherFulfillment) {
      setStatus(
        form,
        "Shipped and local-pickup items must use separate orders. Finish or clear the current cart first.",
        true,
      );
      return;
    }

    const newLine = { sku, quantity: 1, options };
    const existing = cart.find((line) => lineKey(line) === lineKey(newLine));
    if (existing) {
      existing.quantity = Math.min(10, Number(existing.quantity || 0) + 1);
    } else {
      cart.push(newLine);
    }
    saveCart(cart);
    setStatus(form, `${item.name} added to your cart.`);
  }

  function populateStockedColors() {
    document.querySelectorAll("select[data-stocked-color]").forEach((select) => {
      if (select.options.length > 1) return;
      STOCKED_COLORS.forEach((color) => {
        const option = document.createElement("option");
        option.value = color;
        option.textContent = color.replace(/\b\w/g, (letter) => letter.toUpperCase());
        select.append(option);
      });
    });
  }

  function updateOptionFields(form) {
    const choice = form.querySelector('[data-cart-option="colorOption"]')?.value || "standard";
    form.querySelectorAll("[data-show-for]").forEach((wrapper) => {
      const show = wrapper.dataset.showFor.split(" ").includes(choice);
      wrapper.hidden = !show;
      wrapper.querySelectorAll("input, select").forEach((field) => {
        field.disabled = !show;
        field.required = show;
      });
    });
  }

  function renderCartPage() {
    const root = document.querySelector("[data-cart-page]");
    if (!root) return;
    const cart = getCart();
    const message = document.querySelector("[data-checkout-message]");
    if (new URLSearchParams(location.search).get("checkout") === "cancelled" && message) {
      message.hidden = false;
      message.textContent = "Checkout was canceled. Your items are still in the cart.";
    }

    if (!cart.length) {
      root.innerHTML = '<div class="cart-empty"><h2>Your cart is empty</h2><p>Browse our products to add an item.</p><a class="button" href="../#products">Continue Shopping</a></div>';
      document.querySelector("[data-cart-checkout]")?.setAttribute("disabled", "");
      return;
    }

    let subtotal = 0;
    root.innerHTML = cart.map((line, index) => {
      const item = CATALOG[line.sku];
      const unit = item.price + optionSurcharge(item.options, line.options);
      const quantity = Math.max(1, Math.min(10, Number(line.quantity) || 1));
      subtotal += unit * quantity;
      const options = optionSummary(line.options).map(escapeHtml).join(" · ");
      return `<article class="cart-line" data-cart-index="${index}">
        <div><p class="eyebrow">${item.fulfillment === "pickup" ? "LOCAL PICKUP" : "SHIPPED"}</p><h2>${escapeHtml(item.name)}</h2>${options ? `<p>${options}</p>` : ""}</div>
        <label>Quantity<input type="number" min="1" max="10" value="${quantity}" data-cart-quantity></label>
        <strong>${money(unit * quantity)}</strong>
        <button type="button" class="cart-remove" data-cart-remove>Remove</button>
      </article>`;
    }).join("");

    const subtotalNode = document.querySelector("[data-cart-subtotal]");
    if (subtotalNode) subtotalNode.textContent = money(subtotal);
    const fulfillment = CATALOG[cart[0].sku].fulfillment;
    document.querySelectorAll("[data-cart-fulfillment]").forEach((node) => {
      node.textContent = fulfillment === "pickup" ? "Local pickup" : "Shipped order";
    });
    document.querySelector("[data-pickup-cart-note]")?.toggleAttribute("hidden", fulfillment !== "pickup");
    document.querySelector("[data-shipping-cart-note]")?.toggleAttribute("hidden", fulfillment !== "shipped");
  }

  async function checkout() {
    const button = document.querySelector("[data-cart-checkout]");
    const error = document.querySelector("[data-cart-error]");
    const cart = getCart();
    if (!cart.length || !button) return;
    button.disabled = true;
    button.textContent = "Opening secure checkout…";
    if (error) error.textContent = "";

    try {
      const response = await fetch(CHECKOUT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cart }),
      });
      const data = await response.json();
      if (!response.ok || typeof data.url !== "string") {
        throw new Error(data.error || "Checkout could not be opened.");
      }
      location.assign(data.url);
    } catch (cause) {
      if (error) error.textContent = cause instanceof Error ? cause.message : "Checkout could not be opened.";
      button.disabled = false;
      button.textContent = "Continue to Secure Checkout";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    populateStockedColors();
    document.querySelectorAll("[data-cart-product]").forEach((form) => {
      updateOptionFields(form);
      form.addEventListener("change", () => updateOptionFields(form));
    });
    document.addEventListener("click", (event) => {
      const addButton = event.target.closest("[data-cart-sku]");
      if (addButton) addToCart(addButton);
      const removeButton = event.target.closest("[data-cart-remove]");
      if (removeButton) {
        const index = Number(removeButton.closest("[data-cart-index]")?.dataset.cartIndex);
        const cart = getCart();
        cart.splice(index, 1);
        saveCart(cart);
        renderCartPage();
      }
      if (event.target.closest("[data-cart-checkout]")) checkout();
    });
    document.addEventListener("change", (event) => {
      if (!event.target.matches("[data-cart-quantity]")) return;
      const index = Number(event.target.closest("[data-cart-index]")?.dataset.cartIndex);
      const cart = getCart();
      cart[index].quantity = Math.max(1, Math.min(10, Number(event.target.value) || 1));
      saveCart(cart);
      renderCartPage();
    });
    updateCartCounts();
    renderCartPage();
  });
})();
