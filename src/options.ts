/**
 * options.ts
 * 
 * Handles the logic for the extension’s Options page, where the user can configure
 * their preferred workspace base URL (e.g., to point to a custom dev environment).
 * 
 * This script:
 *   1. Loads the currently stored base URL from Chrome’s sync storage.
 *   2. Populates the settings form field with that URL.
 *   3. Validates user input when “Save” is clicked.
 *   4. Writes the new value back to Chrome storage if valid, and shows a short confirmation.
 * 
 * The stored value is later read by `injectEonsButton()` in content scripts
 * to generate correct workspace URLs for injected “Open” buttons.
 */

import browser from 'webextension-polyfill'

/* =========================================================================================
 *  1. Constants
 * =======================================================================================*/

/**
 * The key under which the base URL is stored in Chrome’s sync storage.
 * This key must be consistent across background, options, and content scripts.
 */
const KEY = "baseUrl"

/**
 * Default base URL used when:
 * - No value has been saved yet, or
 * - Chrome storage fails to load.
 */
const DEFAULT_BASE_URL = "https://workspace.infrastructure.tech/#/cast/dev?kasm_url="

/* =========================================================================================
 *  2. Initialization
 * =======================================================================================*/

/**
 * Wait until the DOM is fully parsed before accessing elements.
 * The async callback allows use of `await browser.storage.sync.get()`.
 */
document.addEventListener("DOMContentLoaded", async () => {
	/* -----------------------------------------------------------------------------
	 *  Load stored configuration value from Chrome storage.
	 *  Uses destructuring to directly extract `baseUrl` (if present).
	 * --------------------------------------------------------------------------- */
	// @ts-ignore // Chrome types may not be available in all build contexts
	const { [KEY]: stored } = await browser.storage.sync.get(KEY)

	/* -----------------------------------------------------------------------------
	 *  Query DOM elements for input field, save button, and status label.
	 *  These are expected to exist in the options.html page.
	 * --------------------------------------------------------------------------- */
	const input = document.getElementById("baseUrl") as HTMLInputElement
	const saveBtn = document.getElementById("save") as HTMLButtonElement
	const status = document.getElementById("status") as HTMLSpanElement

	// If the UI isn’t ready (e.g., malformed options page), do nothing safely.
	if (!input || !saveBtn) return

	/* -----------------------------------------------------------------------------
	 *  Initialize the input field with either stored or default value.
	 * --------------------------------------------------------------------------- */
	input.value = (stored as string) || DEFAULT_BASE_URL

	/* =====================================================================================
	 *  3. Save Button Logic
	 * ===================================================================================*/

	/**
	 * Handles click events on the “Save” button.
	 * - Validates that the entered text is a valid HTTP(S) URL.
	 * - Removes any trailing slashes.
	 * - Persists the cleaned URL into Chrome storage.
	 * - Provides short user feedback (“Saved” or “Invalid URL”).
	 */
	saveBtn.addEventListener("click", async () => {
		// Trim spaces and normalize user input
		const url = input.value.trim()

		try {
			// Try parsing the URL to validate it
			const urlToStore = new URL(url)

			// Enforce http(s) protocol (reject file:, ftp:, etc.)
			if (!urlToStore.protocol.startsWith("http")) {
				throw new Error("Only http(s) URLs allowed")
			}

			// Save cleaned URL (remove trailing slashes)
			// @ts-ignore // Chrome types may not be available in all build contexts
			await browser.storage.sync.set({
				[KEY]: urlToStore.toString().replace(/\/+$/, ""),
			})

			// Show short-lived success message
			if (status) {
				status.textContent = "Saved"
			}
			setTimeout(() => (status.textContent = ""), 1200)
		} catch (error) {
			// Log developer-visible error to console
			console.error(error)

			// Show user-friendly validation error message
			if (status) {
				status.textContent = "Invalid URL"
				setTimeout(() => (status.textContent = ""), 1500)
			}
		}
	})
})
