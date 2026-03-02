const form = document.getElementById("cvForm");
const operationSelect = document.getElementById("operation");
const statusEl = document.getElementById("status");
const imagesEl = document.getElementById("images");
const jsonOutEl = document.getElementById("jsonOut");

function showByOperation() {
	const op = operationSelect.value;

	document.querySelectorAll(".group").forEach((group) => {
		const ops = (group.dataset.op || "").split(" ").filter(Boolean);
		group.style.display = ops.includes(op) ? "block" : "none";
	});

	document.querySelectorAll(".row[data-op]").forEach((row) => {
		const ops = (row.dataset.op || "").split(" ").filter(Boolean);
		row.style.display = ops.includes(op) ? "grid" : "none";
	});
}

function appendImage(title, src) {
	const box = document.createElement("div");
	box.className = "img-card";

	const heading = document.createElement("h3");
	heading.textContent = title;

	const img = document.createElement("img");
	img.src = `${src}?t=${Date.now()}`;
	img.alt = title;

	box.appendChild(heading);
	box.appendChild(img);
	imagesEl.appendChild(box);
}

function appendSectionHeading(text) {
	const h = document.createElement("h3");
	h.textContent = text;
	h.style.cssText = "grid-column:1/-1; margin:12px 0 4px; font-size:15px; color:#374151;";
	imagesEl.appendChild(h);
}

function renderResult(response) {
	imagesEl.innerHTML = "";
	jsonOutEl.textContent = JSON.stringify(response, null, 2);

	if (response.input_image_url) {
		appendImage("Input", response.input_image_url);
	}

	const result = response.result || {};
	const op = response.operation || "";

	// ── Standard single-output operations ────────────────────
	["output", "edge", "x", "y", "histogram", "cdf", "second_input"].forEach((key) => {
		if (result[key]) {
			appendImage(key.toUpperCase(), result[key]);
		}
	});

	// ── PROBLEM 1 FIX: equalize outputs ──────────────────────
	// Outputs: equalized gray image, equalized color image,
	// then before/after graphs for Gray, B, G, R channels.
	if (op === "equalize") {
		if (result["output_gray"])
			appendImage("Equalized – Grayscale", result["output_gray"]);
		if (result["output_color_eq"])
			appendImage("Equalized – Color (each channel equalized)", result["output_color_eq"]);

		appendSectionHeading("── BEFORE Equalization ──");
		if (result["before_gray"])
			appendImage("Before – Gray  (Histogram | CDF)", result["before_gray"]);
		if (result["before_b"])
			appendImage("Before – Blue  (Histogram | CDF)", result["before_b"]);
		if (result["before_g"])
			appendImage("Before – Green (Histogram | CDF)", result["before_g"]);
		if (result["before_r"])
			appendImage("Before – Red   (Histogram | CDF)", result["before_r"]);

		appendSectionHeading("── AFTER Equalization ──");
		if (result["after_gray"])
			appendImage("After – Gray  (Histogram | CDF)", result["after_gray"]);
		if (result["after_b"])
			appendImage("After – Blue  (Histogram | CDF)", result["after_b"]);
		if (result["after_g"])
			appendImage("After – Green (Histogram | CDF)", result["after_g"]);
		if (result["after_r"])
			appendImage("After – Red   (Histogram | CDF)", result["after_r"]);
	}

	// ── PROBLEM 3 FIX: transformation outputs ────────────────
	// Outputs: grayscale image + hist+CDF for gray, B, G, R.
	if (op === "transformation") {
		if (result["output_gray"])
			appendImage("Grayscale Output", result["output_gray"]);

		appendSectionHeading("── Channel Histograms + CDFs ──");
		if (result["hist_gray"])
			appendImage("Gray  (Histogram | CDF)", result["hist_gray"]);
		if (result["hist_r"])
			appendImage("Red   (Histogram | CDF)", result["hist_r"]);
		if (result["hist_g"])
			appendImage("Green (Histogram | CDF)", result["hist_g"]);
		if (result["hist_b"])
			appendImage("Blue  (Histogram | CDF)", result["hist_b"]);
	}
}

operationSelect.addEventListener("change", showByOperation);

form.addEventListener("submit", async (event) => {
	event.preventDefault();
	statusEl.textContent = "Running...";

	try {
		const body = new FormData(form);
		const response = await fetch("/api/process/", {
			method: "POST",
			body,
		});

		const data = await response.json();
		if (!response.ok || !data.success) {
			throw new Error(data.error || "Request failed");
		}

		renderResult(data);
		statusEl.textContent = "Done";
	} catch (error) {
		statusEl.textContent = `Error: ${error.message}`;
	}
});

showByOperation();