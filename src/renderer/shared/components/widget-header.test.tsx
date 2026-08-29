import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Package } from "lucide-react";
import { WidgetHeader } from "./widget-header";

describe("WidgetHeader", () => {
  it("renders the title", () => {
    render(<WidgetHeader icon={Package} title="Inventario" />);
    expect(screen.getByRole("heading", { name: "Inventario" })).toBeInTheDocument();
  });

  it("renders the subtitle only when provided", () => {
    const { rerender } = render(<WidgetHeader icon={Package} title="Inventario" />);
    expect(screen.queryByText("Productos con poco stock")).not.toBeInTheDocument();

    rerender(
      <WidgetHeader icon={Package} title="Inventario" subtitle="Productos con poco stock" />
    );
    expect(screen.getByText("Productos con poco stock")).toBeInTheDocument();
  });

  it("renders the action slot", () => {
    render(
      <WidgetHeader
        icon={Package}
        title="Inventario"
        action={<button type="button">Ver todo</button>}
      />
    );
    expect(screen.getByRole("button", { name: "Ver todo" })).toBeInTheDocument();
  });

  it("applies the danger tint to the icon container", () => {
    const { container } = render(<WidgetHeader icon={Package} title="Alertas" danger />);
    expect(container.querySelector(".text-destructive")).not.toBeNull();
  });
});
