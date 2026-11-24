---
name: interaction-review
description: Review accessible trading application controls, feedback, touch and keyboard behavior.
---
# Interaction review
For each action specify owner, trigger, pending, success, failure, cancellation and keyboard/touch equivalent. Prefer Radix primitives; ensure icon-only controls have accessible names, visible focus, and tooltips where useful. Maintain drawing sessions and cancellation semantics. Never silently enable execution. Do not claim data is live merely because polling succeeds. Test keyboard navigation, focus restoration, touch confirmation, overflow, and error recovery.
