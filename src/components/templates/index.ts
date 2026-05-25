/**
 * v3.0 — page templates barrel.
 *
 * Every route under src/app/(app) should use exactly one of these. They
 * own the consistent chrome (page header, breadcrumbs, spacing, max-width)
 * so the working surface area of each portal feels unified.
 */

export { DashboardPage, DashboardSection } from "./DashboardPage";
export { ListPage, ListPagination } from "./ListPage";
export { DetailPage, DetailSplit } from "./DetailPage";
export { FormPage, FormSection, FormField, FormActions } from "./FormPage";
