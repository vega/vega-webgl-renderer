import {Marks as marks} from 'vega-scenegraph';
import {visit} from '../util/visit';

function drawGL(context, scene, bounds) {
  visit(scene, function(item) {
    // marks.text.drawText(context._textContext, item, bounds);
  });
}

export default {
  type:   'text',
  drawGL: drawGL
};
