# Indicator modules

Each subdirectory owns one indicator's behavior and Lightweight Charts primitive. The
primitive adapts pane views and canvas rendering; the indicator class owns its public
updates and future indicator-specific interaction rules.

`indicator-layer.ts` attaches the indicators and forwards inputs. Stateful creation,
editing, and configuration lifecycles live in `../../_sessions/`; indicator-specific
geometry, hit testing, and setting rules stay beside the owning indicator.
