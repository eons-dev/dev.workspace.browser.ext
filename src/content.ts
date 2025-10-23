import { buttonContributions, isSiteSuitable } from "./button-contributions"

function injectEonsButton(): void {
	if (!isSiteSuitable()) return;

	const repoUrl = window.location.href;
	const workspaceUrl = ``;

	for (const contribution of buttonContributions) {
		const {
			id,
			match,
			selector,
			containerElement,
			insertBefore,
			application,
			additionalClassNames
		} = contribution;

		// Check match condition if provided
		if (typeof match === "function" && !match()) continue;
		if (match instanceof RegExp && !match.test(repoUrl)) continue;

		// Avoid duplicates
		if (document.querySelector(`#eons-open-btn-${id}`)) continue;

		const parent = selector.startsWith("xpath:")
			? document.evaluate(
					selector.replace("xpath:", ""),
					document,
					null,
					XPathResult.FIRST_ORDERED_NODE_TYPE,
					null
				).singleNodeValue as HTMLElement
			: document.querySelector(selector);

		if (!parent) continue;

		const container = document.createElement(containerElement.type);

		// Apply container attributes
		for (const [key, val] of Object.entries(containerElement.props)) {
			container.setAttribute(key, val);
		}

		// Add styling classes for platform
		container.classList.add("gl-disclosure-dropdown", "code-dropdown", "gl-text-left", "gl-new-dropdown");
		container.classList.add(application);
		additionalClassNames?.forEach((cls) => container.classList.add(cls));

		// Construct GitLab-style button
		const button = document.createElement("a");
		button.id = `eons-open-btn-${id}`;
		button.href = workspaceUrl;
		button.target = "_blank";
		button.className = "btn btn-confirm btn-md gl-button gl-new-dropdown-toggle";

		const outerSpan = document.createElement("span");
		outerSpan.className = "gl-button-text";

		const innerSpan = document.createElement("span");
		innerSpan.className = "gl-new-dropdown-button-text";
		innerSpan.textContent = "Open";

		outerSpan.appendChild(innerSpan);
		button.appendChild(outerSpan);
		container.appendChild(button);

		// Insert into DOM
		if (insertBefore) {
			const sibling = insertBefore.startsWith("xpath:")
				? document.evaluate(
						insertBefore.replace("xpath:", ""),
						document,
						null,
						XPathResult.FIRST_ORDERED_NODE_TYPE,
						null
					).singleNodeValue as HTMLElement
				: document.querySelector(insertBefore);

			if (sibling && sibling.parentElement) {
				sibling.parentElement.insertBefore(container, sibling);
			} else {
				parent.appendChild(container);
			}
		} else {
			parent.appendChild(container);
		}

		break; // Only one button per page
	}
}

injectEonsButton();

const observer = new MutationObserver(injectEonsButton);
observer.observe(document.body, { childList: true, subtree: true });

window.addEventListener("load", injectEonsButton);
