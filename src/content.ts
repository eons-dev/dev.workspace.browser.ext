/**
 * Injects an "Open in Eons Workspace" button into supported Git providers (GitHub, GitLab, etc.).
 * The button links the current repo/page URL to a workspace URL using Liquid.js templating.
 *
 * This script runs automatically when the page loads and whenever the DOM changes (e.g., SPA navigation).
 * It prevents duplicate injections, waits for browser storage to load user configuration,
 * and handles async race conditions gracefully.
 */
import browser from "webextension-polyfill";
import { Liquid } from "liquidjs";
import { buttonContributions, isSiteSuitable } from "./button-contributions";

/* =========================================================================================
 *  1. Initialize Liquid.js engine
 * =======================================================================================*/

const liquid = new Liquid();

/* =========================================================================================
 *  2. Retrieve the workspace URL template (possibly customized by the user)
 * =======================================================================================*/

/**
 * Asynchronously gets the workspace URL template from storage.
 * Falls back to the default template if not set or if storage access fails.
 *
 * Using an async Promise-based pattern avoids race conditions where
 * the DOM might render before the stored URL has been retrieved.
 */
async function getBaseUrlTemplate(): Promise<string> {
	const DEFAULT_TEMPLATE =
		"https://workspace.infrastructure.tech/#/cast/dev?kasm_url={{ repoUrl }}";

	try {
		const res = await browser.storage.sync.get("urlTemplate");
		return res.urlTemplate;
	} catch (err) {
		// NOTE: this will fire if storage was never set.
		// console.error("Error loading URL template from storage:", err)

		// Always resolve with default even on error to avoid blocking injection
		return DEFAULT_TEMPLATE;
	}
}

/**
 * Extracts the branch name from the current URL if present.
 * Works for GitHub and GitLab URL patterns.
 * 
 * Examples:
 * - https://github.com/user/repo/tree/main -> "main"
 * - https://gitlab.com/user/repo/-/tree/develop -> "develop"
 * 
 * @returns The branch name or empty string if not found
 */
function extractBranchName(): string {
	const url = window.location.href;

	// GitHub pattern: /tree/{branch}
	const githubMatch = url.match(/\/tree\/([^\/\?#]+)/);
	if (githubMatch) return githubMatch[1];

	// GitLab pattern: /-/tree/{branch}
	const gitlabMatch = url.match(/\/-\/tree\/([^\/\?#]+)/);
	if (gitlabMatch) return gitlabMatch[1];

	const defaultMatch = url.split('/').pop();

	return defaultMatch ?? "";
}

/**
 * Renders the workspace URL using Liquid.js templating.
 * @param template - The Liquid template string (e.g., "{{ repoUrl }}")
 * @param repoUrl - The current repository URL
 * @returns The fully rendered workspace URL with encoded parameters
 */
async function renderWorkspaceUrl(
	template: string,
	repoUrl: string
): Promise<string> {
	try {
		const branchName = extractBranchName();

		// Pass raw values to template - don't encode yet
		const templateData = {
			repoUrl: repoUrl,
			branchName: branchName,
		};

		const rendered = await liquid.parseAndRender(template, templateData);

		// Now encode the final rendered URL if needed
		// (though if it's already a complete URL, you may not need to)
		return rendered;
	} catch (err) {
		console.error("Error rendering Liquid template:", err);
		// Fallback to simple concatenation if template rendering fails
		return `https://workspace.infrastructure.tech/#/cast/dev?kasm_url=${encodeURIComponent(
			repoUrl
		)}`;
	}
}
/* =========================================================================================
 *  3. Main Injection Logic
 * =======================================================================================*/

/**
 * Prevents concurrent or redundant injections.
 * - `injecting`: guards against simultaneous calls (e.g., from MutationObserver + window.load)
 * - `lastInjectedUrl`: ensures we don't re-inject when the user navigates within a SPA to the same repo
 */
let injecting = false;
let lastInjectedUrl: string | null = null;

/**
 * Main function that injects the Eons "Open" button into the page if conditions are met.
 */
async function injectEonsButton(): Promise<void> {
	// Prevent overlapping executions
	if (injecting) return;

	// Check if this page is one we want to inject into (e.g., GitHub/GitLab)
	if (!isSiteSuitable()) return;

	injecting = true;
	const repoUrl = window.location.href;

	// Skip if we've already injected for this same URL and button exists
	if (
		lastInjectedUrl === repoUrl &&
		document.querySelector('[id^="eons-open-btn-"]')
	) {
		injecting = false;
		return;
	}
	lastInjectedUrl = repoUrl;

	// Get stored or default workspace URL template
	const template = await getBaseUrlTemplate();
	const workspaceUrl = await renderWorkspaceUrl(template, repoUrl);

	/* -----------------------------------------------------------------------------
	 * Iterate over all possible button contribution definitions
	 * Each contribution defines how and where the button should be injected
	 * (e.g., GitHub, GitLab, custom site selectors)
	 * --------------------------------------------------------------------------- */
	for (const contribution of buttonContributions) {
		const {
			id,
			match,
			selector,
			containerElement,
			insertBefore,
			application,
			additionalClassNames,
		} = contribution;

		// -------------------------------------------------------------------------
		//  Match checks: skip if not applicable to the current URL
		// -------------------------------------------------------------------------
		if (typeof match === "function" && !match()) continue;
		if (match instanceof RegExp && !match.test(repoUrl)) continue;

		// Avoid duplicate injections if a button with same ID already exists
		if (document.querySelector(`#eons-open-btn-${id}`)) continue;

		// -------------------------------------------------------------------------
		//  Locate the parent element where the button will be injected
		//  (supports both CSS selectors and XPath expressions)
		// -------------------------------------------------------------------------
		const parent = selector.startsWith("xpath:")
			? (document.evaluate(
				selector.replace("xpath:", ""),
				document,
				null,
				XPathResult.FIRST_ORDERED_NODE_TYPE,
				null
			).singleNodeValue as HTMLElement)
			: document.querySelector(selector);
		if (!parent) continue; // If parent not found, skip this contribution

		// -------------------------------------------------------------------------
		//  Create the container element for the button
		// -------------------------------------------------------------------------
		const container = document.createElement(containerElement.type);
		for (const [key, val] of Object.entries(containerElement.props)) {
			container.setAttribute(key, val);
		}

		// Add standardized styling for GitLab/GitHub dropdown-style buttons
		container.classList.add(
			"gl-disclosure-dropdown",
			"code-dropdown",
			"gl-text-left",
			"gl-new-dropdown",
			application // platform identifier (e.g., "github" or "gitlab")
		);
		additionalClassNames?.forEach((cls) => container.classList.add(cls));

		// -------------------------------------------------------------------------
		//  Build the button structure itself
		// -------------------------------------------------------------------------
		const button = document.createElement("a");
		button.id = `eons-open-btn-${id}`;
		button.href = workspaceUrl;
		button.target = "_blank";
		button.className =
			"btn btn-confirm btn-md gl-button gl-new-dropdown-toggle";

		// GitLab-style nested <span> hierarchy
		const outerSpan = document.createElement("span");
		outerSpan.className = "gl-button-text";
		const innerSpan = document.createElement("span");
		innerSpan.className = "gl-new-dropdown-button-text";
		innerSpan.textContent = "Open";

		outerSpan.appendChild(innerSpan);
		button.appendChild(outerSpan);
		container.appendChild(button);

		// -------------------------------------------------------------------------
		//  Determine placement (insertBefore or append)
		// -------------------------------------------------------------------------
		const sibling =
			insertBefore && insertBefore.startsWith("xpath:")
				? (document.evaluate(
					insertBefore.replace("xpath:", ""),
					document,
					null,
					XPathResult.FIRST_ORDERED_NODE_TYPE,
					null
				).singleNodeValue as HTMLElement)
				: insertBefore
					? document.querySelector(insertBefore)
					: null;

		if (sibling?.parentElement)
			sibling.parentElement.insertBefore(container, sibling);
		else parent.appendChild(container);

		// Only inject the first matching button definition
		break;
	}

	injecting = false;
}

/* =========================================================================================
 *  4. Observe DOM changes (GitHub/GitLab use dynamic SPA routing)
 * =======================================================================================*/

/**
 * GitHub and GitLab both re-render large parts of the DOM without full page reloads.
 * This observer watches for DOM mutations and re-runs injection logic when necessary.
 *
 * The callback is debounced to prevent rapid-fire re-injection calls.
 */
let mutationTimeout: number | null = null;
const observer = new MutationObserver(() => {
	if (mutationTimeout) clearTimeout(mutationTimeout);
	mutationTimeout = window.setTimeout(injectEonsButton, 300);
});

observer.observe(document.body, { childList: true, subtree: true });

/* =========================================================================================
 *  5. Initial Setup
 * =======================================================================================*/

/**
 * Run injection on load events to catch both static and SPA cases.
 * We attach to:
 * - window.load → ensures all assets and dynamic sections are rendered.
 * - DOMContentLoaded → triggers sooner on some pages.
 */
window.addEventListener("load", injectEonsButton);
document.addEventListener("DOMContentLoaded", injectEonsButton);