import { Component } from "react";

export default class CanastaErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Canasta view crashed", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            background: "rgba(8,15,28,.72)",
            color: "#e2e8f0",
            boxShadow: "0 14px 30px rgba(2,6,23,.3)",
          }}
        >
          Canasta-vyn behövde återställas. Öppna spelet igen om problemet fortsätter.
        </div>
      );
    }

    return this.props.children;
  }
}
