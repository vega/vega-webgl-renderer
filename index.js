import {CanvasHandler} from 'vega-scenegraph';
import {default as WebGLRenderer} from './src/WebGLRenderer';

// Patch CanvasHandler
CanvasHandler.prototype.context = function() {
  return this._canvas.getContext('2d') || this._canvas._textCanvas.getContext('2d');
};

if (window && window.vega) {
  window.vega.addCustomRenderer('webgl', CanvasHandler, WebGLRenderer);
}

// export {default as WebGLRenderer} from './src/WebGLRenderer';
export {WebGLRenderer};
