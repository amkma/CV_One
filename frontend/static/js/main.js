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

function renderResult(response) {
	imagesEl.innerHTML = "";
	jsonOutEl.textContent = JSON.stringify(response, null, 2);

	if (response.input_image_url) {
		appendImage("Input", response.input_image_url);
	}

	const result = response.result || {};

	["output", "edge", "x", "y", "histogram", "cdf", "second_input"].forEach((key) => {
		if (result[key]) {
			appendImage(key.toUpperCase(), result[key]);
		}
	});
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
