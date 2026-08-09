/** The installed react-grid-layout version's bundled types don't declare
 * the `cancel` prop, even though the library fully supports it at
 * runtime (it's a documented official prop for excluding elements —
 * like our per-widget toolbar buttons — from drag capture; see
 * DashboardGrid.tsx / WidgetCard.tsx for why it's needed). This adds
 * just that one missing prop to the type instead of casting the whole
 * <ResponsiveGridLayout> away from type-checking. */
import "react-grid-layout";

declare module "react-grid-layout" {
  interface ReactGridLayoutProps {
    /** CSS selector for elements that should never start a drag, even
     * when nested inside `draggableHandle`. */
    cancel?: string;
  }
}
