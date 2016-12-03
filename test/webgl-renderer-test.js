var fs = require('fs'),
    loader = require('vega-loader').loader,
    vega = require('../../'),
    Bounds = vega.Bounds,
    Renderer = vega.WebGLRenderer,
    res = './test/resources/',
    assert = require('assert');

var GENERATE = require('../resources/generate-tests');

var marks = JSON.parse(load('marks.json'));

function generate(path, image) {
  if (GENERATE) fs.writeFileSync(res + path, image);
}

function load(file) {
  return fs.readFileSync(res + file, 'utf8');
}

function loadScene(file) {
  return load(file);
}

function dataURLToBuffer(string) {
  var regex = /^data:.+\/(.+);base64,(.*)$/;
  var matches = string.match(regex);
  console.log(matches);
  var ext = matches[1];
  var data = matches[2];
  return new Buffer(data, 'base64');
}

function renderBrowser(scene, w, h) {
  return new vega.WebGLRenderer()
    .initialize(null, w, h)
    .toDataURL(vega.fromJSON(scene));
}

function render(scene, w, h) {
  return dataURLToBuffer(browser.execute(renderBrowser, scene, w, h).value);
}

// function renderAsyncBrowser(scene, w, h, callback) {
//   new Renderer(loader({mode: 'http', baseURL: './test/resources/'}))
//     .initialize(null, w, h)
//     .renderAsync(scene)
//     .then(function(r) { callback(r.canvas().toBuffer()); });
// }
//
// function renderAsync(scene, w, h) {
//   return dataURLToBuffer(browser.execute(renderBrowser, scene, w, h).value);
// }

function clearPathCache(mark) {
  mark.items.forEach(function(item) {
    item.pathCache = null;
  });
  return mark;
}

describe('WebGLRenderer', function() {
  it('should have the right title', function () {
    browser.url('/test/webgl/index.html');
    var title = browser.getTitle();
    assert.equal(title, 'WebGLRenderer test suite');
  });

  it('should render scenegraph to canvas', function () {
    var scene = loadScene('scenegraph-rect.json');
    var image = render(scene, 400, 200);
    generate('glpng/scenegraph-rect.png', image);
    var file = load('glpng/scenegraph-rect.png');
    assert.equal(image+'', file);
  });

  it('should support clipping and gradients', function(test) {
    var scene = loadScene('scenegraph-defs.json');
    var image = render(scene, 102, 102);
    generate('glpng/scenegraph-defs.png', image);
    var file = load('glpng/scenegraph-defs.png');
    assert.equal(image+'', file);

    var scene2 = loadScene('scenegraph-defs2.json');
    image = render(scene2, 102, 102);
    generate('glpng/scenegraph-defs2.png', image);
    file = load('glpng/scenegraph-defs2.png');
    assert.equal(image+'', file);
  });

  it('should support axes, legends and sub-groups', function(test) {
    var scene = loadScene('scenegraph-barley.json');
    var image = render(scene, 360, 740);
    generate('glpng/scenegraph-barley.png', image);
    var file = load('glpng/scenegraph-barley.png');
    assert.equal(image+'', file);
  });

  // it('CanvasRenderer should support full redraw', function(test) {
  //   var scene = loadScene('scenegraph-rect.json');
  //   var r = new Renderer()
  //     .initialize(null, 400, 200)
  //     .background('white')
  //     .render(scene);
  //
  //   var mark = scene.items[0].items[0].items;
  //   var rect = mark[1]; rect.fill = 'red'; rect.width *= 2;
  //   mark.push({
  //     mark:mark, x:0, y:0, width:10, height:10, fill:'purple'
  //   });
  //   r.render(scene);
  //
  //   var image = r.canvas().toBuffer();
  //   generate('glpng/scenegraph-full-redraw.png', image);
  //   var file = load('glpng/scenegraph-full-redraw.png');
  //   assert.equal(image+'', file);
  //
  //   mark.pop();
  //   r.render(scene);
  //
  //   image = r.canvas().toBuffer();
  //   generate('glpng/scenegraph-single-redraw.png', image);
  //   file = load('glpng/scenegraph-single-redraw.png');
  //   assert.equal(image+'', file);
  //   test.end();
  // });
  //
  // it('CanvasRenderer should support enter-item redraw', function(test) {
  //   var scene = loadScene('scenegraph-rect.json');
  //   var r = new Renderer()
  //     .initialize(null, 400, 200)
  //     .background('white')
  //     .render(scene);
  //
  //   var rects = scene.items[0].items[0];
  //
  //   var rect1 = {x:10, y:10, width:50, height:50, fill:'red'};
  //   rect1.mark = rects;
  //   rect1.bounds = new Bounds().set(10, 10, 60, 60);
  //   rects.items.push(rect1);
  //
  //   var rect2 = {x:70, y:10, width:50, height:50, fill:'blue'};
  //   rect2.mark = rects;
  //   rect2.bounds = new Bounds().set(70, 10, 120, 60);
  //   rects.items.push(rect2);
  //
  //   r.render(scene, [rect1, rect2]);
  //   var image = r.canvas().toBuffer();
  //   generate('glpng/scenegraph-enter-redraw.png', image);
  //   var file = load('glpng/scenegraph-enter-redraw.png');
  //   assert.equal(image+'', file);
  //   test.end();
  // });
  //
  // it('should support exit-item redraw', function(test) {
  //   var scene = loadScene('scenegraph-rect.json');
  //   var r = new Renderer()
  //     .initialize(null, 400, 200)
  //     .background('white')
  //     .render(scene);
  //
  //   var rect = scene.items[0].items[0].items.pop();
  //   rect.status = 'exit';
  //   r.render(scene, [rect]);
  //
  //   var image = r.canvas().toBuffer();
  //   generate('glpng/scenegraph-exit-redraw.png', image);
  //   var file = load('glpng/scenegraph-exit-redraw.png');
  //   assert.equal(image+'', file);
  //   test.end();
  // });
  //
  // it('CanvasRenderer should support single-item redraw', function(test) {
  //   var scene = loadScene('scenegraph-rect.json');
  //   var r = new Renderer()
  //     .initialize(null, 400, 200)
  //     .background('white')
  //     .render(scene);
  //
  //   var rect = scene.items[0].items[0].items[1];
  //   rect.fill = 'red';
  //   rect.width *= 2;
  //   rect.bounds.x2 = 2*rect.bounds.x2 - rect.bounds.x1;
  //   r.render(scene, [rect]);
  //
  //   var image = r.canvas().toBuffer();
  //   generate('glpng/scenegraph-single-redraw.png', image);
  //   var file = load('glpng/scenegraph-single-redraw.png');
  //   assert.equal(image+'', file);
  //   test.end();
  // });
  //
  // it('CanvasRenderer should support multi-item redraw', function(test) {
  //   var scene = vega.fromJSON(vega.toJSON(marks['line-1']));
  //   var r = new Renderer()
  //     .initialize(null, 400, 400)
  //     .background('white')
  //     .render(scene);
  //
  //   var line1 = scene.items[1]; line1.y = 5;                        // update
  //   var line2 = scene.items.splice(2, 1)[0]; line2.status = 'exit'; // exit
  //   var line3 = {x:400, y:200}; line3.mark = scene;                 // enter
  //   scene.bounds.set(-1, -1, 401, 201);
  //   scene.items[0].pathCache = null;
  //   scene.items.push(line3);
  //
  //   r.render(scene, [line1, line2, line3]);
  //   var image = r.canvas().toBuffer();
  //   generate('glpng/scenegraph-line-redraw.png', image);
  //   var file = load('glpng/scenegraph-line-redraw.png');
  //   assert.equal(image+'', file);
  //   test.end();
  // });
  //
  // it('CanvasRenderer should support enter-group redraw', function(test) {
  //   var scene = loadScene('scenegraph-barley.json');
  //   var r = new Renderer()
  //     .initialize(null, 500, 600)
  //     .background('white')
  //     .render(scene);
  //
  //   var group = JSON.parse(vega.toJSON(scene.items[0]));
  //   group.x = 200;
  //   scene = JSON.parse(vega.toJSON(scene));
  //   scene.items.push(group);
  //   scene = vega.fromJSON(scene);
  //
  //   var image = r.render(scene, [group]).canvas().toBuffer();
  //   generate('glpng/scenegraph-enter-group-redraw.png', image);
  //   var file = load('glpng/scenegraph-enter-group-redraw.png');
  //   assert.equal(image+'', file);
  //   test.end();
  // });
  //
  // it('CanvasRenderer should skip empty item sets', function(test) {
  //   var scene = {marktype:'', items:[]};
  //   var types = [
  //     'arc',
  //     'area',
  //     'group',
  //     'image',
  //     'line',
  //     'path',
  //     'rect',
  //     'rule',
  //     'symbol',
  //     'text'
  //   ];
  //   var file = load('glpng/marks-empty.png'), image;
  //
  //   for (var i=0; i<types.length; ++i) {
  //     scene.marktype = types[i];
  //     image = render(scene, 500, 500);
  //     assert.equal(image+'', file);
  //   }
  //   test.end();
  // });

  it('should render arc mark', function(test) {
    var image = render(marks.arc, 500, 500);
    generate('glpng/marks-arc.png', image);
    var file = load('glpng/marks-arc.png');
    assert.equal(image+'', file);
  });

  it('should render horizontal area mark', function(test) {
    var image = render(marks['area-h'], 500, 500);
    generate('glpng/marks-area-h.png', image);
    var file = load('glpng/marks-area-h.png');
    assert.equal(image+'', file);

    // // clear path cache and re-render
    // image = render(clearPathCache(marks['area-h']), 500, 500);
    // assert.equal(image+'', file);
  });

  it('should render vertical area mark', function(test) {
    var image = render(marks['area-v'], 500, 500);
    generate('glpng/marks-area-v.png', image);
    var file = load('glpng/marks-area-v.png');
    assert.equal(image+'', file);

    // // clear path cache and re-render
    // image = render(clearPathCache(marks['area-v']), 500, 500);
    // assert.equal(image+'', file);
  });

  it('should render area mark with breaks', function(test) {
    var image = render(marks['area-breaks'], 500, 500);
    generate('glpng/marks-area-breaks.png', image);
    var file = load('glpng/marks-area-breaks.png');
    assert.equal(image+'', file);
  });

  it('should render trail area mark', function(test) {
    var image = render(marks['area-trail'], 500, 500);
    generate('glpng/marks-area-trail.png', image);
    var file = load('glpng/marks-area-trail.png');
    assert.equal(image+'', file);
  });

  it('should render group mark', function(test) {
    var image = render(marks.group, 500, 500);
    generate('glpng/marks-group.png', image);
    var file = load('glpng/marks-group.png');
    assert.equal(image+'', file);
  });

  it('should render image mark', function(test) {
    // renderAsync(marks.image, 500, 500, function(image) {
    //   generate('glpng/marks-image.png', image);
    //   var file = load('glpng/marks-image.png');
    //   assert.equal(image+'', file);
    //   test.end();
    // });
    var image = render(marks.image, 500, 500);
    generate('glpng/marks-image.png', image);
    var file = load('glpng/marks-image.png');
    assert.equal(image+'', file);
  });

  // it('CanvasRenderer should skip invalid image', function(test) {
  //   var scene = vega.fromJSON({
  //     marktype: 'image',
  //     items: [{url: 'does_not_exist.png'}]
  //   });
  //   renderAsync(scene, 500, 500, function(image) {
  //     generate('glpng/marks-empty.png', image);
  //     var file = load('glpng/marks-empty.png');
  //     assert.equal(image+'', file);
  //     test.end();
  //   });
  // });

  it('should render line mark', function(test) {
    var image = render(marks['line-1'], 500, 500);
    generate('glpng/marks-line-1.png', image);
    var file = load('glpng/marks-line-1.png');
    assert.equal(image+'', file);

    image = render(marks['line-2'], 500, 500);
    generate('glpng/marks-line-2.png', image);
    file = load('glpng/marks-line-2.png');
    assert.equal(image+'', file);

    // // clear path cache and re-render
    // image = render(clearPathCache(marks['line-2']), 500, 500);
    // assert.equal(image+'', file);
  });

  it('CanvasRenderer should render line mark with breaks', function(test) {
    var image = render(marks['line-breaks'], 500, 500);
    generate('glpng/marks-line-breaks.png', image);
    var file = load('glpng/marks-line-breaks.png');
    assert.equal(image+'', file);
  });

  it('CanvasRenderer should render path mark', function(test) {
    var image = render(marks.path, 500, 500);
    generate('glpng/marks-path.png', image);
    var file = load('glpng/marks-path.png');
    assert.equal(image+'', file);

    // clear path cache and re-render
    image = render(clearPathCache(marks.path), 500, 500);
    assert.equal(image+'', file);
  });

  it('CanvasRenderer should render rect mark', function(test) {
    var image = render(marks.rect, 500, 500);
    generate('glpng/marks-rect.png', image);
    var file = load('glpng/marks-rect.png');
    assert.equal(image+'', file);
  });

  it('CanvasRenderer should render rule mark', function(test) {
    var image = render(marks.rule, 500, 500);
    generate('glpng/marks-rule.png', image);
    var file = load('glpng/marks-rule.png');
    assert.equal(image+'', file);
  });

  it('CanvasRenderer should render symbol mark', function(test) {
    var image = render(marks.symbol, 500, 500);
    generate('glpng/marks-symbol.png', image);
    var file = load('glpng/marks-symbol.png');
    assert.equal(image+'', file);
  });

  it('CanvasRenderer should render text mark', function(test) {
    var image = render(marks.text, 500, 500);
    generate('glpng/marks-text.png', image);
    var file = load('glpng/marks-text.png');
    assert.equal(image+'', file);
  });
});
