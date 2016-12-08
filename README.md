WebGL renderer for [Vega](https://vega.github.io/vega)
======================================================

[Demo](https://jeffbaumes.github.io/vega-webgl-renderer)

Major features
--------------

* Implements nearly all Vega scene graph components as WebGL primitives. Falls
  back to 2D Canvas rendering for text and gradient fills, which are drawn to
  a WebGL texture and overlaid on the view.
* Custom shaders for Rect and Symbol marks, enabling greater scalability
  (to the hundreds of thousands) beyond Canvas and SVG renderers. See the
  "scale" example in the demo (Note: Do not attempt that example with the
  SVG renderer, it will lock your browser for a while).


Build
-----

```
npm run build
```

Note: there is one minor change to [extrude-polyline](https://github.com/mattdesl/extrude-polyline/compare/master...jeffbaumes:closed-path)
which hacks in a way to close mitered strokes.

Known issues
------------

* Line dashes are not supported (see "barley", "nested", "map-bind" examples).
* Triangulation of trails is known to be buggy and leave holes at internal nodes.
* Custom symbol shapes are not supported.
* Triangulation of geometry sometimes results in spurious offshoots.
