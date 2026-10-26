# Compact question dragging

Question cards use tighter spacing and smaller number/image tiles. The drag handle is an unframed 32px grip, with an expanded invisible touch target. Pointer dragging lifts a full inert card clone into a fixed overlay that follows the pointer, while the original leaves a faded placeholder. The overlay ignores hit testing so drop targets and edge scrolling keep working. Completion, cancellation and unmount remove the overlay. Keyboard reordering and immediate optimistic saves remain supported.

Browser checks: desktop and 390×844 layouts, dragging first-to-last and immediate saved confirmation. The mobile document has no horizontal overflow. A local preview with disposable mock data verifies the dashboard shows all three metrics together. Backend tests include a deliberately stalled room read to prove the statistics response returns before reconciliation completes, plus preserved counts on a failed refresh.
