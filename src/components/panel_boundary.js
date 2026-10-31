import React from "react";
import PropTypes from "prop-types";

export class PanelBoundary extends React.Component {
  state = { failed: false, dismissed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.dismissed) return null;
    if (!this.state.failed) return this.props.children;
    return <aside className="people-sheet person-window" role="alert">
      <p>This panel could not be opened.</p>
      <button onClick={() => { if (this.props.onClose) this.props.onClose(); else this.setState({ dismissed: true }); }}>Close panel</button>
    </aside>;
  }
}
PanelBoundary.propTypes = { children: PropTypes.node, onClose: PropTypes.func };
