/**
 * constants.js - Centralised constants for the Plot extension
 *
 * Import from here instead of redeclaring MODULE_NAME in every file.
 * Previously declared 6+ times across the codebase.
 */

/** SillyTavern extension_settings key for this extension */
export const MODULE_NAME = 'plot';

/** Increment when the data schema changes and a migration is needed */
export const CURRENT_VERSION = 2;
