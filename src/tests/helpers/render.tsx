import { render, RenderOptions } from "@testing-library/react";
import { ReactElement } from "react";

// eslint-disable-next-line react-refresh/only-export-components
function AllProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export { customRender as render };
// eslint-disable-next-line react-refresh/only-export-components
export * from "@testing-library/react";
