/**
 * Cssltd Gateway TUI Integration
 *
 * This module provides TUI-specific functionality for cssltd-gateway.
 * It requires CssltdCode TUI dependencies to be injected at runtime.
 *
 * Import from "@cssltdcode/cssltd-gateway/tui" for TUI features.
 */

// ============================================================================
// TUI Dependency Injection
// ============================================================================
export { initializeTUIDependencies, getTUIDependencies, areTUIDependenciesInitialized } from "./tui/context.js"
export type { TUIDependencies } from "./tui/types.js"

// ============================================================================
// TUI Helpers
// ============================================================================
export { formatProfileInfo, getOrganizationOptions, getDefaultOrganizationSelection } from "./tui/helpers.js"

// ============================================================================
// NOTE: TUI Components Moved to CssltdCode
// ============================================================================
// All TUI components with JSX have been moved to packages/cssltdcode/src/cssltdcode/
// to ensure correct JSX transpilation with @opentui/solid.
//
// Components moved:
// - registerCssltdCommands -> @/cssltdcode/cssltd-commands
// - DialogCssltdTeamSelect -> @/cssltdcode/components/dialog-cssltd-team-select
// - DialogCssltdOrganization -> @/cssltdcode/components/dialog-cssltd-organization
// - DialogCssltdProfile -> @/cssltdcode/components/dialog-cssltd-profile
// - CssltdAutoMethod -> @/cssltdcode/components/dialog-cssltd-auto-method
// - CssltdNews -> @/cssltdcode/components/cssltd-news
// - NotificationBanner -> @/cssltdcode/components/notification-banner
// - DialogCssltdNotifications -> @/cssltdcode/components/dialog-cssltd-notifications
