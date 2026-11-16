# Chart component modules

`objects/` contains the interactive drawing objects. Each object folder owns its chart primitive and edit behavior. The polyline folder also owns its placement behavior. The Fibonacci extension primitive builds on the Fibonacci range primitive, so it imports that sibling module.

`indicators/` is reserved for indicator drawing modules. Existing indicator primitives stay where they are until that migration is planned.

Shared interaction contracts, hit priority, pointer capture, selection, and the reusable two- and three-point placement sessions remain outside these folders. Keep new tool-specific hit tests, geometry changes, and placement rules with the corresponding object. The chart mediator should only route events and manage subscriptions.
