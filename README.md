WebGL renderer for [Vega](https://vega.github.io/vega)
======================================================

[Demo](https://jeffbaumes.github.io/vega-webgl-renderer)

Major features
--------------

* Implements nearly all Vega scene graph components as WebGL primitives. Falls
  back to 2D Canvas rendering for text and gradient fills, which are drawn to
  a WebGL texture and overlaid on the view.
* Custom shaders for Rect and Symbol marks, enabling greater scalability
  (to the hundreds of thousands) beyond Canvas and SVG renderers.

Required changes to Vega
------------------------

The following changes add support for custom renderers in Vega:

* [vega changes](https://github.com/vega/vega/compare/master...jeffbaumes:modular-renderer)
* [vega-scenegraph changes](https://github.com/vega/vega-scenegraph/compare/master...jeffbaumes:modular-renderer)
* [vega-view changes](https://github.com/vega/vega-view/compare/master...jeffbaumes:modular-renderer)

There is also one minor change to [extrude-polyline](https://github.com/mattdesl/extrude-polyline/compare/master...jeffbaumes:closed-path)
which hacks in a way to close mitered strokes.
