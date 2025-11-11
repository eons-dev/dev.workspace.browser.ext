/**
 * Injects an "Open in Eons Workspace" button into supported Git providers (GitHub, GitLab, etc.).
 * The button links the current repository URL to a workspace URL rendered using Liquid.js templating.
 *
 * This script runs automatically when pages load and when the DOM changes (for single-page apps).
 * It prevents duplicate injections, waits for stored configuration, and avoids race conditions.
 */

import browser from "webextension-polyfill";
import { Liquid } from "liquidjs";
import { buttonContributions, isSiteSuitable } from "./button-contributions";

// ============================================================================
// Constants
// ============================================================================

/** Default workspace URL template used when no custom template is configured. */
const DEFAULT_URL_TEMPLATE =
	"https://workspace.infrastructure.tech/#/cast/dev?kasm_url={{ repoUrl }}";

/** Configuration values for timing and element detection. */
const CONFIG = {
	/** Maximum time to wait for GitLab branch detection (milliseconds). */
	GITLAB_BRANCH_DETECT_MAX_WAIT_MS: 2000,
	/** Polling interval for GitLab branch detection (milliseconds). */
	GITLAB_BRANCH_DETECT_INTERVAL_MS: 200,
	/** Debounce delay for mutation observer (milliseconds). */
	MUTATION_DEBOUNCE_MS: 300,
	/** ID prefix for injected buttons. */
	BUTTON_ID_PREFIX: "eons-open-btn-",
} as const;

/** CSS selectors for GitLab elements. */
const GITLAB_SELECTORS = {
	REF_NAME: ".ref-name",
	REF_CONTAINER: ".ref-container[href*='/-/tree/']",
	MR_DATA_NODE: "#js-vue-mr-discussions",
} as const;

// ============================================================================
// Configuration & Template Management
// ============================================================================

/** Liquid.js engine used for rendering workspace URLs from templates. */
const liquid = new Liquid();

/**
 * Retrieves the workspace URL template from browser storage.
 * Falls back to a default template if no custom value exists or storage access fails.
 *
 * @returns The workspace URL template string.
 */
async function getBaseUrlTemplate(): Promise<string> {
	try {
		const res = await browser.storage.sync.get("urlTemplate");
		return res.urlTemplate || DEFAULT_URL_TEMPLATE;
	} catch {
		return DEFAULT_URL_TEMPLATE;
	}
}

/**
 * Renders the workspace URL using Liquid.js templating.
 *
 * @param template - The Liquid template string (e.g. "{{ repoUrl }}").
 * @param repoUrl - The normalized repository URL to inject into the template.
 * @param branchName - The branch name extracted from the URL (optional).
 * @returns The fully rendered workspace URL.
 */
async function renderWorkspaceUrl(
	template: string,
	repoUrl: string,
	branchName: string | null = null
): Promise<string> {
	try {
		const templateData: { repoUrl: string; branchName?: string } = { repoUrl };
		if (branchName) {
			templateData.branchName = branchName;
		}
		return await liquid.parseAndRender(template, templateData);
	} catch {
		return `https://workspace.infrastructure.tech/#/cast/dev?kasm_url=${encodeURIComponent(
			repoUrl
		)}`;
	}
}

// ============================================================================
// DOM Query Utilities
// ============================================================================

/**
 * Queries for an element using either a CSS selector or XPath expression.
 * XPath selectors must be prefixed with "xpath:".
 *
 * @param selector - CSS selector or XPath expression (prefixed with "xpath:").
 * @returns The matching element, or null if not found.
 */
function queryElement(selector: string): HTMLElement | null {
	if (selector.startsWith("xpath:")) {
		const xpath = selector.replace("xpath:", "");
		const result = document.evaluate(
			xpath,
			document,
			null,
			XPathResult.FIRST_ORDERED_NODE_TYPE,
			null
		);
		return result.singleNodeValue as HTMLElement | null;
	}
	return document.querySelector<HTMLElement>(selector);
}

/**
 * Polls for a condition to become true within a specified time window.
 *
 * @param condition - Function that returns a truthy value when the condition is met.
 * @param maxWaitMs - Maximum time to wait (milliseconds).
 * @param intervalMs - Polling interval (milliseconds).
 * @returns The result of the condition function, or null if timeout occurs.
 */
async function pollForCondition<T>(
	condition: () => T | null | undefined,
	maxWaitMs: number,
	intervalMs: number
): Promise<T | null> {
	const startTime = Date.now();

	while (Date.now() - startTime < maxWaitMs) {
		const result = condition();
		if (result) return result;
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}

	return null;
}

// ============================================================================
// Branch Name Extraction
// ============================================================================

/**
 * Extracts the branch name from the current URL path.
 * Works for both GitHub and GitLab branch URLs.
 *
 * @param url - The current URL to extract the branch from.
 * @returns The branch name if found, otherwise null.
 */
function extractBranchFromUrl(url: string): string | null {
	// GitHub: /tree/branch-name
	const githubMatch = url.match(/\/tree\/([^/]+)/);
	if (githubMatch) {
		return decodeURIComponent(githubMatch[1]);
	}

	// GitLab: /-/tree/branch-name
	const gitlabMatch = url.match(/\/-\/tree\/([^/]+)/);
	if (gitlabMatch) {
		return decodeURIComponent(gitlabMatch[1]);
	}

	return null;
}

// ============================================================================
// GitLab Branch Detection
// ============================================================================

/**
 * Attempts to extract the source branch name from the .ref-name element.
 *
 * @returns The branch name if found, otherwise null.
 */
function extractBranchFromRefName(): string | null {
	const refName = document.querySelector(GITLAB_SELECTORS.REF_NAME);
	return refName?.textContent?.trim() || null;
}

/**
 * Attempts to extract the source branch name from older GitLab UI elements.
 *
 * @returns The branch name if found, otherwise null.
 */
function extractBranchFromRefContainer(): string | null {
	const refContainer = document.querySelector(GITLAB_SELECTORS.REF_CONTAINER);
	return refContainer?.textContent?.trim() || null;
}

/**
 * Attempts to extract the source branch name from embedded JSON data.
 *
 * @returns The branch name if found, otherwise null.
 */
function extractBranchFromEmbeddedData(): string | null {
	const node = document.getElementById(
		GITLAB_SELECTORS.MR_DATA_NODE.replace("#", "")
	);
	const data = node?.getAttribute("data-noteable-data");

	if (!data) return null;

	try {
		const json = JSON.parse(data);
		return json?.source_branch?.trim() || null;
	} catch {
		return null;
	}
}

/**
 * Detects the source branch name on a GitLab Merge Request page.
 * Tries multiple selectors and the embedded JSON blob, waiting briefly if needed.
 *
 * @returns The detected source branch name, or null if not found.
 */
async function getGitLabBranchFromDOM(): Promise<string | null> {
	return pollForCondition(
		() =>
			extractBranchFromRefName() ||
			extractBranchFromRefContainer() ||
			extractBranchFromEmbeddedData(),
		CONFIG.GITLAB_BRANCH_DETECT_MAX_WAIT_MS,
		CONFIG.GITLAB_BRANCH_DETECT_INTERVAL_MS
	);
}

// ============================================================================
// URL Normalization
// ============================================================================

/**
 * Normalizes a GitLab URL to point to the repository or branch tree.
 * On MR pages, attempts to rewrite to the source branch tree URL.
 *
 * @param url - The current GitLab URL.
 * @returns The normalized repository URL.
 */
async function normalizeGitLabUrl(url: string): Promise<string> {
	// Handle Merge Request URLs
	const mrMatch = url.match(
		/(https:\/\/gitlab\.com\/[^/]+\/[^/]+)\/-\/merge_requests\/\d+/
	);

	if (mrMatch) {
		const baseRepo = mrMatch[1];
		const branch = await getGitLabBranchFromDOM();
		return branch ? `${baseRepo}/-/tree/${branch}` : baseRepo;
	}

	// Handle blob URLs (single file views)
	if (url.includes("/-/blob/")) {
		return url.split("/-/blob/")[0];
	}

	return url;
}

/**
 * Normalizes a GitHub URL to point to the repository or branch tree.
 * Removes extra segments such as pull requests, issues, or actions.
 *
 * @param url - The current GitHub URL.
 * @returns The normalized repository URL.
 */
function normalizeGitHubUrl(url: string): string {
	const baseMatch = url.match(/(https:\/\/github\.com\/[^/]+\/[^/]+)/);
	if (!baseMatch) return url;

	let normalizedUrl = baseMatch[1];

	// Preserve branch information if present in the path
	const branchMatch = window.location.pathname.match(/\/tree\/([^/]+)/);
	if (branchMatch) {
		normalizedUrl = `${normalizedUrl}/tree/${branchMatch[1]}`;
	}

	return normalizedUrl;
}

/**
 * Normalizes a repository URL to always point to a cloneable path.
 * Handles provider-specific URL patterns (GitLab, GitHub).
 *
 * @param currentUrl - The current browser location.
 * @returns The normalized repository URL.
 */
async function normalizeRepoUrl(currentUrl: string): Promise<string> {
	try {
		if (/gitlab\.com/.test(currentUrl)) {
			return await normalizeGitLabUrl(currentUrl);
		}

		if (/github\.com/.test(currentUrl)) {
			return normalizeGitHubUrl(currentUrl);
		}
	} catch {
		// Silent fallback to original URL
	}

	return currentUrl;
}

// ============================================================================
// Button Creation & Injection
// ============================================================================

/**
 * Creates the container element that wraps the "Open" button.
 *
 * @param config - Button contribution configuration.
 * @returns The configured container element.
 */
function createButtonContainer(config: {
	containerElement: { type: string; props: Record<string, string> };
	application: string;
	additionalClassNames?: string[];
}): HTMLElement {
	const container = document.createElement(config.containerElement.type);

	// Set attributes from props
	for (const [key, val] of Object.entries(config.containerElement.props)) {
		container.setAttribute(key, val);
	}

	// Add standard GitLab classes
	container.classList.add(
		"gl-disclosure-dropdown",
		"code-dropdown",
		"gl-text-left",
		"gl-new-dropdown",
		config.application
	);

	// Add any additional custom classes
	config.additionalClassNames?.forEach((cls) => container.classList.add(cls));

	return container;
}

/**
 * Creates the "Open" button element with proper styling and attributes.
 *
 * @param id - Unique identifier for the button.
 * @param workspaceUrl - The target workspace URL.
 * @returns The configured button element.
 */
function createOpenButton(id: string, workspaceUrl: string): HTMLAnchorElement {
	const button = document.createElement("a");
	button.id = `${CONFIG.BUTTON_ID_PREFIX}${id}`;
	button.href = workspaceUrl;
	button.target = "_blank";
	button.className =
		"btn btn-confirm btn-md gl-button gl-new-dropdown-toggle";

	// Create nested span structure for GitLab styling
	const outerSpan = document.createElement("span");
	outerSpan.className = "gl-button-text";

	const innerSpan = document.createElement("span");
	innerSpan.className = "gl-new-dropdown-button-text";
	innerSpan.textContent = "Open";

	outerSpan.appendChild(innerSpan);
	button.appendChild(outerSpan);

	return button;
}

/**
 * Inserts the button container into the DOM at the appropriate location.
 *
 * @param container - The container element to insert.
 * @param parent - The parent element to insert into.
 * @param insertBeforeSelector - Optional selector for the sibling element to insert before.
 */
function insertButtonIntoDOM(
	container: HTMLElement,
	parent: HTMLElement,
	insertBeforeSelector?: string
): void {
	if (!insertBeforeSelector) {
		parent.appendChild(container);
		return;
	}

	const sibling = queryElement(insertBeforeSelector);

	if (sibling?.parentElement) {
		sibling.parentElement.insertBefore(container, sibling);
	} else {
		parent.appendChild(container);
	}
}

/**
 * Checks if a button has already been injected for the given contribution.
 *
 * @param id - The button contribution ID.
 * @returns True if the button already exists in the DOM.
 */
function isButtonAlreadyInjected(id: string): boolean {
	return document.querySelector(`#${CONFIG.BUTTON_ID_PREFIX}${id}`) !== null;
}

/**
 * Checks if the current URL matches the contribution's criteria.
 *
 * @param match - The match criteria (function or regex).
 * @param repoUrl - The normalized repository URL.
 * @returns True if the URL matches the criteria.
 */
function matchesContributionCriteria(
	match: RegExp | (() => boolean),
	repoUrl: string
): boolean {
	if (typeof match === "function") {
		return match();
	}

	if (match instanceof RegExp) {
		return match.test(repoUrl);
	}

	return false;
}

/**
 * Attempts to inject a button based on a single contribution configuration.
 *
 * @param contribution - The button contribution configuration.
 * @param workspaceUrl - The rendered workspace URL.
 * @param repoUrl - The normalized repository URL.
 * @returns True if the button was successfully injected.
 */
function tryInjectButton(
	contribution: (typeof buttonContributions)[number],
	workspaceUrl: string,
	repoUrl: string
): boolean {
	const {
		id,
		match,
		selector,
		containerElement,
		insertBefore,
		application,
		additionalClassNames,
	} = contribution;

	// Check if URL matches contribution criteria
	if (!matchesContributionCriteria(match, repoUrl)) {
		return false;
	}

	// Check if button already exists
	if (isButtonAlreadyInjected(id)) {
		return false;
	}

	// Find parent element
	const parent = queryElement(selector);
	if (!parent) {
		return false;
	}

	// Create and assemble button
	const container = createButtonContainer({
		containerElement,
		application,
		additionalClassNames,
	});
	const button = createOpenButton(id, workspaceUrl);
	container.appendChild(button);

	// Insert into DOM
	insertButtonIntoDOM(container, parent, insertBefore);

	return true;
}

// ============================================================================
// Main Injection Logic
// ============================================================================

/** Tracks the last URL where a button was successfully injected. */
let lastInjectedUrl: string | null = null;

/** Indicates whether an injection is currently running. */
let injecting = false;

/**
 * Checks if a button injection should be skipped for the current page.
 *
 * @param currentUrl - The current browser URL.
 * @returns True if injection should be skipped.
 */
function shouldSkipInjection(currentUrl: string): boolean {
	// Skip if already injected on this URL and button still exists
	return (
		lastInjectedUrl === currentUrl &&
		document.querySelector(`[id^="${CONFIG.BUTTON_ID_PREFIX}"]`) !== null
	);
}

/**
 * Main function that injects the Eons "Open" button into supported pages.
 * Handles detection, duplication prevention, and proper DOM placement.
 */
async function injectEonsButton(): Promise<void> {
	// Prevent concurrent injections
	if (injecting) return;

	// Check if site is supported
	if (!isSiteSuitable()) return;

	injecting = true;

	try {
		const currentUrl = window.location.href;

		// Skip if already injected
		if (shouldSkipInjection(currentUrl)) {
			return;
		}

		// Prepare workspace URL
		const repoUrl = await normalizeRepoUrl(currentUrl);
		const branchName = extractBranchFromUrl(repoUrl);
		const template = await getBaseUrlTemplate();
		const workspaceUrl = await renderWorkspaceUrl(template, repoUrl, branchName);

		// Try each contribution until one succeeds
		for (const contribution of buttonContributions) {
			if (tryInjectButton(contribution, workspaceUrl, repoUrl)) {
				lastInjectedUrl = currentUrl;
				break;
			}
		}
	} finally {
		injecting = false;
	}
}

// ============================================================================
// Initialization & Observation
// ============================================================================

/**
 * Creates a debounced version of a function.
 *
 * @param fn - The function to debounce.
 * @param delay - The debounce delay in milliseconds.
 * @returns The debounced function.
 */
function debounce<T extends (...args: unknown[]) => unknown>(
	fn: T,
	delay: number
): (...args: Parameters<T>) => void {
	let timeoutId: number | null = null;

	return (...args: Parameters<T>) => {
		if (timeoutId !== null) {
			clearTimeout(timeoutId);
		}
		timeoutId = window.setTimeout(() => fn(...args), delay);
	};
}

/**
 * Observes DOM mutations and re-runs the injector when SPA pages update.
 * Uses debouncing to prevent excessive re-injection attempts.
 */
const debouncedInject = debounce(
	injectEonsButton,
	CONFIG.MUTATION_DEBOUNCE_MS
);

const observer = new MutationObserver(debouncedInject);
observer.observe(document.body, { childList: true, subtree: true });

/**
 * Initializes the injector for both static and dynamic page loads.
 */
window.addEventListener("load", injectEonsButton);
document.addEventListener("DOMContentLoaded", injectEonsButton);