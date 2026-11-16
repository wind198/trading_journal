# Chart interaction sessions

`create/` owns placement anchors, tap phases, coarse pointer gestures, and cleanup when a drawing tool changes.

`edit/` owns the active edit pointer, pending press, selection tap/double-tap state, click suppression, hit priority registry, and end callbacks. Each drawing object's edit behavior remains in `_components/objects/<object>/`.

`configure/` owns unsaved configuration drafts, including drawing labels and indicator settings. React renders session snapshots; the dashboard owns persistence effects.

The mediator owns chart and DOM subscriptions. Indicator-specific drawing and interaction rules live in `_components/indicators/<indicator>/`; sessions coordinate their active interaction state.
