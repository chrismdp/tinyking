import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PanelBoundary } from "../src/components/panel_boundary";

it("offers a dismissible panel error while the surrounding game remains usable", () => {
  const close = jest.fn(), boundary = new PanelBoundary({ onClose: close });
  boundary.state = PanelBoundary.getDerivedStateFromError(new Error("broken panel"));
  const fallback = boundary.render();
  const html = renderToStaticMarkup(<main><canvas/>{fallback}<button>Pause</button></main>);
  expect(html).toContain("Pause");
  expect(html).toContain("Close panel");
  fallback.props.children[1].props.onClick();
  expect(close).toHaveBeenCalledTimes(1);
});
