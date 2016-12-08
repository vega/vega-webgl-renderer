import {CanvasHandler, renderModule} from 'vega-scenegraph';
import {default as WebGLRenderer} from './src/WebGLRenderer';

// Patch CanvasHandler
CanvasHandler.prototype.context = function() {
  return this._canvas.getContext('2d') || this._canvas._textCanvas.getContext('2d');
};

renderModule('webgl', {handler: CanvasHandler, renderer: WebGLRenderer});

export {WebGLRenderer};
