import type { Params } from 'react-router';
import type { Permission } from '@/features/auth';

/** Metadata attached to routes via `handle`. */
export interface RouteHandle {
  /** Breadcrumb label shown in the top bar; a function builds it from the URL params. */
  crumb?: string | ((params: Params) => string);
  /** Permission needed to open the page; AuthenticatedLayout shows "no access" without it. */
  permission?: Permission;
}
