/**
 * Injects an “Open in Eons Workspace” button into supported Git providers (GitHub, GitLab, etc.).
 * The button links the current repo/page URL to a Kasm workspace URL such as:
 *     https://workspace.infrastructure.tech/#/cast/dev?kasm_url=<encoded_repo_url>
 *
 * This script runs automatically when the page loads and whenever the DOM changes (e.g., SPA navigation).
 * It prevents duplicate injections, waits for Chrome storage to load user configuration,
 * and handles async race conditions gracefully.
 */

import { buttonContributions, isSiteSuitable } from "./button-contributions"

/* =========================================================================================
 *  1. Retrieve the base workspace URL (possibly customized by the user)
 * =======================================================================================*/

/**
 * Asynchronously gets the base Kasm workspace URL from Chrome storage.
 * Falls back to the default URL if not set or if storage access fails.
 *
 * Using an async Promise-based pattern avoids race conditions where
 * the DOM might render before the stored URL has been retrieved.
 */
async function getBaseUrl(): Promise<string> {
	const DEFAULT_BASE_URL = "https://workspace.infrastructure.tech/#/cast/dev?kasm_url="

	return new Promise((resolve) => {
		try {
			//@ts-ignore // Chrome types may not be available in all build contexts
			chrome.storage.sync.get("baseUrl", (res) => {
				// Resolve with stored value, or default if undefined
				resolve(res.baseUrl || DEFAULT_BASE_URL)
			})
		} catch (err) {
			console.error("Error loading base URL from storage:", err)
			// Always resolve with default even on error to avoid blocking injection
			resolve(DEFAULT_BASE_URL)
		}
	})
}

/* =========================================================================================
 *  2. Main Injection Logic
 * =======================================================================================*/

/**
 * Prevents concurrent or redundant injections.
 * - `injecting`: guards against simultaneous calls (e.g., from MutationObserver + window.load)
 * - `lastInjectedUrl`: ensures we don’t re-inject when the user navigates within a SPA to the same repo
 */
let injecting = false
let lastInjectedUrl: string | null = null

/**
 * Main function that injects the Eons “Open” button into the page if conditions are met.
 */
async function injectEonsButton(): Promise<void> {
	// Prevent overlapping executions
	if (injecting) return

	// Check if this page is one we want to inject into (e.g., GitHub/GitLab)
	if (!isSiteSuitable()) return

	injecting = true
	const repoUrl = window.location.href

	// Skip if we’ve already injected for this same URL and button exists
	if (lastInjectedUrl === repoUrl && document.querySelector('[id^="eons-open-btn-"]')) {
		injecting = false
		return
	}
	lastInjectedUrl = repoUrl

	// Get stored or default workspace base URL
	const baseUrl = await getBaseUrl()
	const workspaceUrl = `${baseUrl}${encodeURIComponent(repoUrl)}`

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
		} = contribution

		// -------------------------------------------------------------------------
		//  Match checks: skip if not applicable to the current URL
		// -------------------------------------------------------------------------
		if (typeof match === "function" && !match()) continue
		if (match instanceof RegExp && !match.test(repoUrl)) continue

		// Avoid duplicate injections if a button with same ID already exists
		if (document.querySelector(`#eons-open-btn-${id}`)) continue

		// -------------------------------------------------------------------------
		//  Locate the parent element where the button will be injected
		//  (supports both CSS selectors and XPath expressions)
		// -------------------------------------------------------------------------
		const parent =
			selector.startsWith("xpath:")
				? (document.evaluate(
						selector.replace("xpath:", ""),
						document,
						null,
						XPathResult.FIRST_ORDERED_NODE_TYPE,
						null
				  ).singleNodeValue as HTMLElement)
				: document.querySelector(selector)
		if (!parent) continue // If parent not found, skip this contribution

		// -------------------------------------------------------------------------
		//  Create the container element for the button
		// -------------------------------------------------------------------------
		const container = document.createElement(containerElement.type)
		for (const [key, val] of Object.entries(containerElement.props)) {
			container.setAttribute(key, val)
		}

		// Add standardized styling for GitLab/GitHub dropdown-style buttons
		container.classList.add(
			"gl-disclosure-dropdown",
			"code-dropdown",
			"gl-text-left",
			"gl-new-dropdown",
			application // platform identifier (e.g., "github" or "gitlab")
		)
		additionalClassNames?.forEach((cls) => container.classList.add(cls))

		// -------------------------------------------------------------------------
		//  Build the button structure itself
		// -------------------------------------------------------------------------
		const button = document.createElement("a")
		button.id = `eons-open-btn-${id}`
		button.href = workspaceUrl
		button.target = "_blank"
		button.className = "btn btn-confirm btn-md gl-button gl-new-dropdown-toggle"

		// GitLab-style nested <span> hierarchy
		const outerSpan = document.createElement("span")
		outerSpan.className = "gl-button-text"
		const innerSpan = document.createElement("span")
		innerSpan.className = "gl-new-dropdown-button-text"
		innerSpan.textContent = "Open"

		outerSpan.appendChild(innerSpan)
		button.appendChild(outerSpan)
		container.appendChild(button)

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
				: null

		if (sibling?.parentElement) sibling.parentElement.insertBefore(container, sibling)
		else parent.appendChild(container)

		// Only inject the first matching button definition
		break
	}

	injecting = false
}

/* =========================================================================================
 *  3. Observe DOM changes (GitHub/GitLab use dynamic SPA routing)
 * =======================================================================================*/

/**
 * GitHub and GitLab both re-render large parts of the DOM without full page reloads.
 * This observer watches for DOM mutations and re-runs injection logic when necessary.
 * 
 * The callback is debounced to prevent rapid-fire re-injection calls.
 */
let mutationTimeout: number | null = null
const observer = new MutationObserver(() => {
	if (mutationTimeout) clearTimeout(mutationTimeout)
	mutationTimeout = window.setTimeout(injectEonsButton, 300)
})

observer.observe(document.body, { childList: true, subtree: true })

/* =========================================================================================
 *  4. Initial Setup
 * =======================================================================================*/

/**
 * Run injection on load events to catch both static and SPA cases.
 * We attach to:
 * - window.load → ensures all assets and dynamic sections are rendered.
 * - DOMContentLoaded → triggers sooner on some pages.
 */
window.addEventListener("load", injectEonsButton)
document.addEventListener("DOMContentLoaded", injectEonsButton)
