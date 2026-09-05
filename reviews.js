(() => {
  const api = "https://needapartnow-checkout.needapartnow.workers.dev/reviews";
  const section = document.querySelector("[data-review-product]");
  if (!section) return;
  const product = section.dataset.reviewProduct;
  const list = section.querySelector("[data-review-list]");
  const form = section.querySelector("[data-review-form]");
  const status = section.querySelector("[data-review-status]");

  function renderReviews(reviews) {
    list.replaceChildren();
    if (!reviews.length) {
      const empty = document.createElement("p");
      empty.className = "review-empty";
      empty.textContent = "No approved reviews yet.";
      list.append(empty);
      return;
    }
    reviews.forEach((review) => {
      const card = document.createElement("article");
      card.className = "review-card";
      card.dataset.pinned = review.pinned ? "true" : "false";
      const stars = document.createElement("div");
      stars.className = "review-stars";
      stars.setAttribute("aria-label", `${review.rating} out of 5 stars`);
      stars.textContent = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
      const title = document.createElement("h3");
      title.textContent = review.title;
      const body = document.createElement("p");
      body.textContent = review.body;
      const byline = document.createElement("div");
      byline.className = "review-byline";
      byline.textContent = `— ${review.name}`;
      card.append(stars, title, body, byline);
      list.append(card);
    });
  }

  fetch(`${api}?product=${encodeURIComponent(product)}`)
    .then((response) => response.ok ? response.json() : Promise.reject())
    .then((data) => renderReviews(Array.isArray(data.reviews) ? data.reviews : []))
    .catch(() => {
      list.innerHTML = '<p class="review-empty">Reviews are temporarily unavailable.</p>';
    });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button");
    button.disabled = true;
    status.textContent = "Submitting…";
    const values = Object.fromEntries(new FormData(form));
    values.product = product;
    values.rating = Number(values.rating);
    try {
      const response = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Review could not be submitted.");
      form.reset();
      status.textContent = data.message;
    } catch (error) {
      status.textContent = error.message || "Review could not be submitted.";
    } finally {
      button.disabled = false;
    }
  });
})();
