(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.vega = global.vega || {})));
}(this, (function (exports) { 'use strict';

function Bounds(b) {
  this.clear();
  if (b) this.union(b);
}

var prototype = Bounds.prototype;

prototype.clone = function() {
  return new Bounds(this);
};

prototype.clear = function() {
  this.x1 = +Number.MAX_VALUE;
  this.y1 = +Number.MAX_VALUE;
  this.x2 = -Number.MAX_VALUE;
  this.y2 = -Number.MAX_VALUE;
  return this;
};

prototype.set = function(x1, y1, x2, y2) {
  if (x2 < x1) {
    this.x2 = x1;
    this.x1 = x2;
  } else {
    this.x1 = x1;
    this.x2 = x2;
  }
  if (y2 < y1) {
    this.y2 = y1;
    this.y1 = y2;
  } else {
    this.y1 = y1;
    this.y2 = y2;
  }
  return this;
};

prototype.add = function(x, y) {
  if (x < this.x1) this.x1 = x;
  if (y < this.y1) this.y1 = y;
  if (x > this.x2) this.x2 = x;
  if (y > this.y2) this.y2 = y;
  return this;
};

prototype.expand = function(d) {
  this.x1 -= d;
  this.y1 -= d;
  this.x2 += d;
  this.y2 += d;
  return this;
};

prototype.round = function() {
  this.x1 = Math.floor(this.x1);
  this.y1 = Math.floor(this.y1);
  this.x2 = Math.ceil(this.x2);
  this.y2 = Math.ceil(this.y2);
  return this;
};

prototype.translate = function(dx, dy) {
  this.x1 += dx;
  this.x2 += dx;
  this.y1 += dy;
  this.y2 += dy;
  return this;
};

prototype.rotate = function(angle, x, y) {
  var cos = Math.cos(angle),
      sin = Math.sin(angle),
      cx = x - x*cos + y*sin,
      cy = y - x*sin - y*cos,
      x1 = this.x1, x2 = this.x2,
      y1 = this.y1, y2 = this.y2;

  return this.clear()
    .add(cos*x1 - sin*y1 + cx,  sin*x1 + cos*y1 + cy)
    .add(cos*x1 - sin*y2 + cx,  sin*x1 + cos*y2 + cy)
    .add(cos*x2 - sin*y1 + cx,  sin*x2 + cos*y1 + cy)
    .add(cos*x2 - sin*y2 + cx,  sin*x2 + cos*y2 + cy);
};

prototype.union = function(b) {
  if (b.x1 < this.x1) this.x1 = b.x1;
  if (b.y1 < this.y1) this.y1 = b.y1;
  if (b.x2 > this.x2) this.x2 = b.x2;
  if (b.y2 > this.y2) this.y2 = b.y2;
  return this;
};

prototype.encloses = function(b) {
  return b && (
    this.x1 <= b.x1 &&
    this.x2 >= b.x2 &&
    this.y1 <= b.y1 &&
    this.y2 >= b.y2
  );
};

prototype.alignsWith = function(b) {
  return b && (
    this.x1 == b.x1 ||
    this.x2 == b.x2 ||
    this.y1 == b.y1 ||
    this.y2 == b.y2
  );
};

prototype.intersects = function(b) {
  return b && !(
    this.x2 < b.x1 ||
    this.x1 > b.x2 ||
    this.y2 < b.y1 ||
    this.y1 > b.y2
  );
};

prototype.contains = function(x, y) {
  return !(
    x < this.x1 ||
    x > this.x2 ||
    y < this.y1 ||
    y > this.y2
  );
};

prototype.width = function() {
  return this.x2 - this.x1;
};

prototype.height = function() {
  return this.y2 - this.y1;
};

var gradient_id = 0;

var Gradient = function(p0, p1) {
  var stops = [], gradient;
  return gradient = {
    id: 'gradient_' + (gradient_id++),
    x1: p0 ? p0[0] : 0,
    y1: p0 ? p0[1] : 0,
    x2: p1 ? p1[0] : 1,
    y2: p1 ? p1[1] : 0,
    stops: stops,
    stop: function(offset, color) {
      stops.push({offset: offset, color: color});
      return gradient;
    }
  };
};

function Item(mark) {
  this.mark = mark;
  this.bounds = (this.bounds || new Bounds());
  this.bounds_prev = (this.bounds_prev || new Bounds());
}

var inherits = function(child, parent) {
  var proto = (child.prototype = Object.create(parent.prototype));
  proto.constructor = child;
  return proto;
};

function GroupItem(mark) {
  Item.call(this, mark);
  this.items = (this.items || []);
}

inherits(GroupItem, Item);

var Canvas;

try { Canvas = require('canvas'); } catch (e) { Canvas = null; }

var Canvas$1 = function(w, h) {
  var canvas = null;
  if (typeof document !== 'undefined' && document.createElement) {
    canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
  } else if (Canvas) {
    canvas = new Canvas(w, h);
  }
  return canvas;
};

var Image$1 = typeof Image !== 'undefined' ? Image
  : (Canvas && Canvas.Image || null);

var accessor = function(fn, fields, name) {
  return (
    fn.fields = fields || [],
    fn.fname = name,
    fn
  );
};

var splitAccessPath = function(p) {
  return String(p)
    .match(/\[(.*?)\]|[^.\[]+/g)
    .map(path_trim);
};

function path_trim(d) {
  return d[0] !== '[' ? d
    : d[1] !== "'" && d[1] !== '"' ? d.slice(1, -1)
    : d.slice(2, -2).replace(/\\(["'])/g, '$1');
}

var isArray = Array.isArray;

var isObject = function(_) {
  return _ === Object(_);
};

var isString = function(_) {
  return typeof _ === 'string';
};

function $(x) {
  return isArray(x) ? '[' + x.map($) + ']'
    : isObject(x) || isString(x) ?
      // Output valid JSON and JS source strings.
      // See http://timelessrepo.com/json-isnt-a-javascript-subset
      JSON.stringify(x).replace('\u2028','\\u2028').replace('\u2029', '\\u2029')
    : x;
}

var field = function(field, name) {
  var path = splitAccessPath(field).map($),
      fn = Function('_', 'return _[' + path.join('][') + '];');
  return accessor(fn, [field], name || field);
};

var empty = [];

var id = field('id');

var identity = accessor(function(_) { return _; }, empty, 'identity');

var zero = accessor(function() { return 0; }, empty, 'zero');

var one = accessor(function() { return 1; }, empty, 'one');

var truthy = accessor(function() { return true; }, empty, 'true');

var falsy = accessor(function() { return false; }, empty, 'false');

var None  = 0;

var array = function(_) {
  return _ != null ? (isArray(_) ? _ : [_]) : [];
};

var isFunction = function(_) {
  return typeof _ === 'function';
};

var error = function(message) {
  throw Error(message);
};

var extend = function(_) {
  for (var x, k, i=1, len=arguments.length; i<len; ++i) {
    x = arguments[i];
    for (k in x) { _[k] = x[k]; }
  }
  return _;
};

var prefix = "$";

function Map() {}

Map.prototype = map.prototype = {
  constructor: Map,
  has: function(key) {
    return (prefix + key) in this;
  },
  get: function(key) {
    return this[prefix + key];
  },
  set: function(key, value) {
    this[prefix + key] = value;
    return this;
  },
  remove: function(key) {
    var property = prefix + key;
    return property in this && delete this[property];
  },
  clear: function() {
    for (var property in this) if (property[0] === prefix) delete this[property];
  },
  keys: function() {
    var keys = [];
    for (var property in this) if (property[0] === prefix) keys.push(property.slice(1));
    return keys;
  },
  values: function() {
    var values = [];
    for (var property in this) if (property[0] === prefix) values.push(this[property]);
    return values;
  },
  entries: function() {
    var entries = [];
    for (var property in this) if (property[0] === prefix) entries.push({key: property.slice(1), value: this[property]});
    return entries;
  },
  size: function() {
    var size = 0;
    for (var property in this) if (property[0] === prefix) ++size;
    return size;
  },
  empty: function() {
    for (var property in this) if (property[0] === prefix) return false;
    return true;
  },
  each: function(f) {
    for (var property in this) if (property[0] === prefix) f(this[property], property.slice(1), this);
  }
};

function map(object, f) {
  var map = new Map;

  // Copy constructor.
  if (object instanceof Map) object.each(function(value, key) { map.set(key, value); });

  // Index array by numeric index or specified key function.
  else if (Array.isArray(object)) {
    var i = -1,
        n = object.length,
        o;

    if (f == null) while (++i < n) map.set(i, object[i]);
    else while (++i < n) map.set(f(o = object[i], i, object), o);
  }

  // Convert object to map.
  else if (object) for (var key in object) map.set(key, object[key]);

  return map;
}

function createObject() {
  return {};
}

function setObject(object, key, value) {
  object[key] = value;
}

function createMap() {
  return map();
}

function setMap(map$$1, key, value) {
  map$$1.set(key, value);
}

function Set() {}

var proto = map.prototype;

Set.prototype = set.prototype = {
  constructor: Set,
  has: proto.has,
  add: function(value) {
    value += "";
    this[prefix + value] = value;
    return this;
  },
  remove: proto.remove,
  clear: proto.clear,
  values: proto.keys,
  size: proto.size,
  empty: proto.empty,
  each: proto.each
};

function set(object, f) {
  var set = new Set;

  // Copy constructor.
  if (object instanceof Set) object.each(function(value) { set.add(value); });

  // Otherwise, assume it’s an array.
  else if (object) {
    var i = -1, n = object.length;
    if (f == null) while (++i < n) set.add(object[i]);
    else while (++i < n) set.add(f(object[i], i, object));
  }

  return set;
}

var noop = {value: function() {}};

function dispatch() {
  for (var i = 0, n = arguments.length, _ = {}, t; i < n; ++i) {
    if (!(t = arguments[i] + "") || (t in _)) throw new Error("illegal type: " + t);
    _[t] = [];
  }
  return new Dispatch(_);
}

function Dispatch(_) {
  this._ = _;
}

function parseTypenames(typenames, types) {
  return typenames.trim().split(/^|\s+/).map(function(t) {
    var name = "", i = t.indexOf(".");
    if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
    if (t && !types.hasOwnProperty(t)) throw new Error("unknown type: " + t);
    return {type: t, name: name};
  });
}

Dispatch.prototype = dispatch.prototype = {
  constructor: Dispatch,
  on: function(typename, callback) {
    var _ = this._,
        T = parseTypenames(typename + "", _),
        t,
        i = -1,
        n = T.length;

    // If no callback was specified, return the callback of the given type and name.
    if (arguments.length < 2) {
      while (++i < n) if ((t = (typename = T[i]).type) && (t = get(_[t], typename.name))) return t;
      return;
    }

    // If a type was specified, set the callback for the given type and name.
    // Otherwise, if a null callback was specified, remove callbacks of the given name.
    if (callback != null && typeof callback !== "function") throw new Error("invalid callback: " + callback);
    while (++i < n) {
      if (t = (typename = T[i]).type) _[t] = set$2(_[t], typename.name, callback);
      else if (callback == null) for (t in _) _[t] = set$2(_[t], typename.name, null);
    }

    return this;
  },
  copy: function() {
    var copy = {}, _ = this._;
    for (var t in _) copy[t] = _[t].slice();
    return new Dispatch(copy);
  },
  call: function(type, that) {
    if ((n = arguments.length - 2) > 0) for (var args = new Array(n), i = 0, n, t; i < n; ++i) args[i] = arguments[i + 2];
    if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
    for (t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
  },
  apply: function(type, that, args) {
    if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
    for (var t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
  }
};

function get(type, name) {
  for (var i = 0, n = type.length, c; i < n; ++i) {
    if ((c = type[i]).name === name) {
      return c.value;
    }
  }
}

function set$2(type, name, callback) {
  for (var i = 0, n = type.length; i < n; ++i) {
    if (type[i].name === name) {
      type[i] = noop, type = type.slice(0, i).concat(type.slice(i + 1));
      break;
    }
  }
  if (callback != null) type.push({name: name, value: callback});
  return type;
}

var request = function(url, callback) {
  var request,
      event = dispatch("beforesend", "progress", "load", "error"),
      mimeType,
      headers = map(),
      xhr = new XMLHttpRequest,
      user = null,
      password = null,
      response,
      responseType,
      timeout = 0;

  // If IE does not support CORS, use XDomainRequest.
  if (typeof XDomainRequest !== "undefined"
      && !("withCredentials" in xhr)
      && /^(http(s)?:)?\/\//.test(url)) xhr = new XDomainRequest;

  "onload" in xhr
      ? xhr.onload = xhr.onerror = xhr.ontimeout = respond
      : xhr.onreadystatechange = function(o) { xhr.readyState > 3 && respond(o); };

  function respond(o) {
    var status = xhr.status, result;
    if (!status && hasResponse(xhr)
        || status >= 200 && status < 300
        || status === 304) {
      if (response) {
        try {
          result = response.call(request, xhr);
        } catch (e) {
          event.call("error", request, e);
          return;
        }
      } else {
        result = xhr;
      }
      event.call("load", request, result);
    } else {
      event.call("error", request, o);
    }
  }

  xhr.onprogress = function(e) {
    event.call("progress", request, e);
  };

  request = {
    header: function(name, value) {
      name = (name + "").toLowerCase();
      if (arguments.length < 2) return headers.get(name);
      if (value == null) headers.remove(name);
      else headers.set(name, value + "");
      return request;
    },

    // If mimeType is non-null and no Accept header is set, a default is used.
    mimeType: function(value) {
      if (!arguments.length) return mimeType;
      mimeType = value == null ? null : value + "";
      return request;
    },

    // Specifies what type the response value should take;
    // for instance, arraybuffer, blob, document, or text.
    responseType: function(value) {
      if (!arguments.length) return responseType;
      responseType = value;
      return request;
    },

    timeout: function(value) {
      if (!arguments.length) return timeout;
      timeout = +value;
      return request;
    },

    user: function(value) {
      return arguments.length < 1 ? user : (user = value == null ? null : value + "", request);
    },

    password: function(value) {
      return arguments.length < 1 ? password : (password = value == null ? null : value + "", request);
    },

    // Specify how to convert the response content to a specific type;
    // changes the callback value on "load" events.
    response: function(value) {
      response = value;
      return request;
    },

    // Alias for send("GET", …).
    get: function(data, callback) {
      return request.send("GET", data, callback);
    },

    // Alias for send("POST", …).
    post: function(data, callback) {
      return request.send("POST", data, callback);
    },

    // If callback is non-null, it will be used for error and load events.
    send: function(method, data, callback) {
      xhr.open(method, url, true, user, password);
      if (mimeType != null && !headers.has("accept")) headers.set("accept", mimeType + ",*/*");
      if (xhr.setRequestHeader) headers.each(function(value, name) { xhr.setRequestHeader(name, value); });
      if (mimeType != null && xhr.overrideMimeType) xhr.overrideMimeType(mimeType);
      if (responseType != null) xhr.responseType = responseType;
      if (timeout > 0) xhr.timeout = timeout;
      if (callback == null && typeof data === "function") callback = data, data = null;
      if (callback != null && callback.length === 1) callback = fixCallback(callback);
      if (callback != null) request.on("error", callback).on("load", function(xhr) { callback(null, xhr); });
      event.call("beforesend", request, xhr);
      xhr.send(data == null ? null : data);
      return request;
    },

    abort: function() {
      xhr.abort();
      return request;
    },

    on: function() {
      var value = event.on.apply(event, arguments);
      return value === event ? request : value;
    }
  };

  if (callback != null) {
    if (typeof callback !== "function") throw new Error("invalid callback: " + callback);
    return request.get(callback);
  }

  return request;
};

function fixCallback(callback) {
  return function(error, xhr) {
    callback(error == null ? xhr : null);
  };
}

function hasResponse(xhr) {
  var type = xhr.responseType;
  return type && type !== "text"
      ? xhr.response // null on error
      : xhr.responseText; // "" on error
}

var type = function(defaultMimeType, response) {
  return function(url, callback) {
    var r = request(url).mimeType(defaultMimeType).response(response);
    if (callback != null) {
      if (typeof callback !== "function") throw new Error("invalid callback: " + callback);
      return r.get(callback);
    }
    return r;
  };
};

type("text/html", function(xhr) {
  return document.createRange().createContextualFragment(xhr.responseText);
});

type("application/json", function(xhr) {
  return JSON.parse(xhr.responseText);
});

type("text/plain", function(xhr) {
  return xhr.responseText;
});

type("application/xml", function(xhr) {
  var xml = xhr.responseXML;
  if (!xml) throw new Error("parse error");
  return xml;
});

function objectConverter(columns) {
  return new Function("d", "return {" + columns.map(function(name, i) {
    return JSON.stringify(name) + ": d[" + i + "]";
  }).join(",") + "}");
}

function customConverter(columns, f) {
  var object = objectConverter(columns);
  return function(row, i) {
    return f(object(row), i, columns);
  };
}

// Compute unique columns in order of discovery.
function inferColumns(rows) {
  var columnSet = Object.create(null),
      columns = [];

  rows.forEach(function(row) {
    for (var column in row) {
      if (!(column in columnSet)) {
        columns.push(columnSet[column] = column);
      }
    }
  });

  return columns;
}

var dsvFormat = function(delimiter) {
  var reFormat = new RegExp("[\"" + delimiter + "\n]"),
      delimiterCode = delimiter.charCodeAt(0);

  function parse(text, f) {
    var convert, columns, rows = parseRows(text, function(row, i) {
      if (convert) return convert(row, i - 1);
      columns = row, convert = f ? customConverter(row, f) : objectConverter(row);
    });
    rows.columns = columns;
    return rows;
  }

  function parseRows(text, f) {
    var EOL = {}, // sentinel value for end-of-line
        EOF = {}, // sentinel value for end-of-file
        rows = [], // output rows
        N = text.length,
        I = 0, // current character index
        n = 0, // the current line number
        t, // the current token
        eol; // is the current token followed by EOL?

    function token() {
      if (I >= N) return EOF; // special case: end of file
      if (eol) return eol = false, EOL; // special case: end of line

      // special case: quotes
      var j = I, c;
      if (text.charCodeAt(j) === 34) {
        var i = j;
        while (i++ < N) {
          if (text.charCodeAt(i) === 34) {
            if (text.charCodeAt(i + 1) !== 34) break;
            ++i;
          }
        }
        I = i + 2;
        c = text.charCodeAt(i + 1);
        if (c === 13) {
          eol = true;
          if (text.charCodeAt(i + 2) === 10) ++I;
        } else if (c === 10) {
          eol = true;
        }
        return text.slice(j + 1, i).replace(/""/g, "\"");
      }

      // common case: find next delimiter or newline
      while (I < N) {
        var k = 1;
        c = text.charCodeAt(I++);
        if (c === 10) eol = true; // \n
        else if (c === 13) { eol = true; if (text.charCodeAt(I) === 10) ++I, ++k; } // \r|\r\n
        else if (c !== delimiterCode) continue;
        return text.slice(j, I - k);
      }

      // special case: last token before EOF
      return text.slice(j);
    }

    while ((t = token()) !== EOF) {
      var a = [];
      while (t !== EOL && t !== EOF) {
        a.push(t);
        t = token();
      }
      if (f && (a = f(a, n++)) == null) continue;
      rows.push(a);
    }

    return rows;
  }

  function format(rows, columns) {
    if (columns == null) columns = inferColumns(rows);
    return [columns.map(formatValue).join(delimiter)].concat(rows.map(function(row) {
      return columns.map(function(column) {
        return formatValue(row[column]);
      }).join(delimiter);
    })).join("\n");
  }

  function formatRows(rows) {
    return rows.map(formatRow).join("\n");
  }

  function formatRow(row) {
    return row.map(formatValue).join(delimiter);
  }

  function formatValue(text) {
    return text == null ? ""
        : reFormat.test(text += "") ? "\"" + text.replace(/\"/g, "\"\"") + "\""
        : text;
  }

  return {
    parse: parse,
    parseRows: parseRows,
    format: format,
    formatRows: formatRows
  };
};

var csv$1 = dsvFormat(",");

var csvParse = csv$1.parse;

var tsv = dsvFormat("\t");

var tsvParse = tsv.parse;

var dsv = function(defaultMimeType, parse) {
  return function(url, row, callback) {
    if (arguments.length < 3) callback = row, row = null;
    var r = request(url).mimeType(defaultMimeType);
    r.row = function(_) { return arguments.length ? r.response(responseOf(parse, row = _)) : row; };
    r.row(row);
    return callback ? r.get(callback) : r;
  };
};

function responseOf(parse, row) {
  return function(request$$1) {
    return parse(request$$1.responseText, row);
  };
}

dsv("text/csv", csvParse);

dsv("text/tab-separated-values", tsvParse);

// Matches absolute URLs with optional protocol
//   https://...    file://...    //...
var protocol_re = /^([A-Za-z]+:)?\/\//;

// Special treatment in node.js for the file: protocol
var fileProtocol = 'file://';

// Request options to check for d3-request
var requestOptions = [
  'mimeType',
  'responseType',
  'user',
  'password'
];

/**
 * Creates a new loader instance that provides methods for requesting files
 * from either the network or disk, and for sanitizing request URIs.
 * @param {object} [options] - Optional default loading options to use.
 * @return {object} - A new loader instance.
 */
var loader = function(options) {
  return {
    options: options || {},
    sanitize: sanitize,
    load: load,
    file: file,
    http: http
  };
};

function marshall(loader, options) {
  return extend({}, loader.options, options);
}

/**
 * Load an external resource, typically either from the web or from the local
 * filesystem. This function uses {@link sanitize} to first sanitize the uri,
 * then calls either {@link http} (for web requests) or {@link file} (for
 * filesystem loading).
 * @param {string} uri - The resource indicator (e.g., URL or filename).
 * @param {object} [options] - Optional loading options. These options will
 *   override any existing default options.
 * @return {Promise} - A promise that resolves to the loaded content.
 */
function load(uri, options) {
  var loader = this;
  return loader.sanitize(uri, options)
    .then(function(url) {
      return (startsWith(url, fileProtocol))
        ? loader.file(url.slice(fileProtocol.length))
        : loader.http(url, options);
    });
}

/**
 * URI sanitizer function.
 * @param {string} uri - The uri (url or filename) to sanity check.
 * @param {object} options - An options hash.
 * @return {Promise} - A promise that resolves to the final URL to
 *   load, or rejects if the input uri is invalid.
 */
function sanitize(uri, options) {
  options = marshall(this, options);
  return new Promise(function(accept, reject) {
    var isFile, hasProtocol, loadFile, base;

    if (uri == null || typeof uri !== 'string') {
      reject('Sanitize failure, invalid URI: ' + $(uri));
      return;
    }

    // if relative url (no protocol/host), prepend baseURL
    if ((base = options.baseURL) && !hasProtocol) {
      // Ensure that there is a slash between the baseURL (e.g. hostname) and url
      if (!startsWith(uri, '/') && base[base.length-1] !== '/') {
        uri = '/' + uri;
      }
      uri = base + uri;
    }

    isFile = startsWith(uri, fileProtocol);
    hasProtocol = protocol_re.test(uri);

    // should we load from file system?
    loadFile = isFile
      || options.mode === 'file'
      || options.mode !== 'http' && !hasProtocol && fs();

    if (loadFile) {
      // prepend file protocol, if not already present
      uri = (isFile ? '' : fileProtocol) + uri;
    } else if (startsWith(uri, '//')) {
      // if relative protocol (starts with '//'), prepend default protocol
      uri = (options.defaultProtocol || 'http') + ':' + uri;
    }

    accept(uri);
  });
}

/**
 * HTTP request loader.
 * @param {string} url - The url to request.
 * @param {object} options - An options hash.
 * @return {Promise} - A promise that resolves to the file contents.
 */
function http(url, options) {
  options = marshall(this, options);
  return new Promise(function(accept, reject) {
    var req = request(url),
        name;

    for (name in options.headers) {
      req.header(name, options.headers[name]);
    }

    requestOptions.forEach(function(name) {
      if (options[name]) req[name](options[name]);
    });

    req.on('error', function(error$$1) {
        reject(error$$1 || 'Error loading URL: ' + url);
      })
      .on('load', function(result) {
        var text$$1 = result && result.responseText;
        (!result || result.status === 0)
          ? reject(text$$1 || 'Error')
          : accept(text$$1);
      })
      .get();
  });
}

/**
 * File system loader.
 * @param {string} filename - The file system path to load.
 * @return {Promise} - A promise that resolves to the file contents.
 */
function file(filename) {
  return new Promise(function(accept, reject) {
    var f = fs();
    f ? f.readFile(filename, function(error$$1, data) {
          if (error$$1) reject(error$$1);
          else accept(data);
        })
      : reject('No file system access for ' + filename);
  });
}

function fs() {
  return typeof require === 'function' && require('fs');
}

function startsWith(string, query) {
  return string == null ? false : string.lastIndexOf(query, 0) === 0;
}

var typeParsers = {
  boolean: toBoolean,
  integer: toNumber,
  number:  toNumber,
  date:    toDate,
  string:  toString
};

var typeTests = [
  isBoolean,
  isInteger,
  isNumber$1,
  isDate
];

var typeList = [
  'boolean',
  'integer',
  'number',
  'date'
];

function inferType(values, field) {
  var tests = typeTests.slice(),
      value, i, n, j;

  for (i=0, n=values.length; i<n; ++i) {
    value = field ? values[i][field] : values[i];
    for (j=0; j<tests.length; ++j) {
      if (isValid(value) && !tests[j](value)) {
        tests.splice(j, 1); --j;
      }
    }
    if (tests.length === 0) return 'string';
  }
  return typeList[typeTests.indexOf(tests[0])];
}

function inferTypes(data, fields) {
  return fields.reduce(function(types, field) {
    return types[field] = inferType(data, field), types;
  }, {});
}

// -- Type Coercion ----

function toNumber(_) {
  return _ == null || _ === '' ? null : +_;
}

function toBoolean(_) {
  return _ == null || _ === '' ? null : !_ || _ === 'false' ? false : !!_;
}

function toDate(_, parser) {
  return _ == null || _ === '' ? null
    : (parser ? parser(_) : Date.parse(_));
}

function toString(_) {
  return _ == null || _ === '' ? null : _ + '';
}

// -- Type Checks ----

function isValid(_) {
  return _ != null && _ === _;
}

function isBoolean(_) {
  return _ === 'true' || _ === 'false' || _ === true || _ === false;
}

function isDate(_) {
  return !isNaN(Date.parse(_));
}

function isNumber$1(_) {
  return !isNaN(+_) && !(_ instanceof Date);
}

function isInteger(_) {
  return isNumber$1(_) && (_=+_) === ~~_;
}

function delimitedFormat(delimiter) {
  return function(data, format) {
    var delim = {delimiter: delimiter};
    return dsv$1(data, format ? extend(format, delim) : delim);
  };
}

function dsv$1(data, format) {
  if (format.header) {
    data = format.header
      .map($)
      .join(format.delimiter) + '\n' + data;
  }
  return dsvFormat(format.delimiter).parse(data);
}

function isBuffer(_) {
  return (typeof Buffer === 'function' && isFunction(Buffer.isBuffer))
    ? Buffer.isBuffer(_) : false;
}

var json$1 = function(data, format) {
  data = isObject(data) && !isBuffer(data) ? data : JSON.parse(data);
  return (format && format.property)
    ? field(format.property)(data)
    : data;
};

var noop$1 = function() {};

function absolute(transform) {
  if (!transform) return noop$1;
  var x0,
      y0,
      kx = transform.scale[0],
      ky = transform.scale[1],
      dx = transform.translate[0],
      dy = transform.translate[1];
  return function(point, i) {
    if (!i) x0 = y0 = 0;
    point[0] = (x0 += point[0]) * kx + dx;
    point[1] = (y0 += point[1]) * ky + dy;
  };
}

function relative(transform) {
  if (!transform) return noop$1;
  var x0,
      y0,
      kx = transform.scale[0],
      ky = transform.scale[1],
      dx = transform.translate[0],
      dy = transform.translate[1];
  return function(point, i) {
    if (!i) x0 = y0 = 0;
    var x1 = Math.round((point[0] - dx) / kx),
        y1 = Math.round((point[1] - dy) / ky);
    point[0] = x1 - x0;
    point[1] = y1 - y0;
    x0 = x1;
    y0 = y1;
  };
}

function reverse(array, n) {
  var t, j = array.length, i = j - n;
  while (i < --j) t = array[i], array[i++] = array[j], array[j] = t;
}

function bisect(a, x) {
  var lo = 0, hi = a.length;
  while (lo < hi) {
    var mid = lo + hi >>> 1;
    if (a[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

var feature = function(topology, o) {
  return o.type === "GeometryCollection" ? {
    type: "FeatureCollection",
    features: o.geometries.map(function(o) { return feature$1(topology, o); })
  } : feature$1(topology, o);
};

function feature$1(topology, o) {
  var f = {
    type: "Feature",
    id: o.id,
    properties: o.properties || {},
    geometry: object(topology, o)
  };
  if (o.id == null) delete f.id;
  return f;
}

function object(topology, o) {
  var absolute$$1 = absolute(topology.transform),
      arcs = topology.arcs;

  function arc(i, points) {
    if (points.length) points.pop();
    for (var a = arcs[i < 0 ? ~i : i], k = 0, n = a.length, p; k < n; ++k) {
      points.push(p = a[k].slice());
      absolute$$1(p, k);
    }
    if (i < 0) reverse(points, n);
  }

  function point(p) {
    p = p.slice();
    absolute$$1(p, 0);
    return p;
  }

  function line(arcs) {
    var points = [];
    for (var i = 0, n = arcs.length; i < n; ++i) arc(arcs[i], points);
    if (points.length < 2) points.push(points[0].slice());
    return points;
  }

  function ring(arcs) {
    var points = line(arcs);
    while (points.length < 4) points.push(points[0].slice());
    return points;
  }

  function polygon(arcs) {
    return arcs.map(ring);
  }

  function geometry(o) {
    var t = o.type;
    return t === "GeometryCollection" ? {type: t, geometries: o.geometries.map(geometry)}
        : t in geometryType ? {type: t, coordinates: geometryType[t](o)}
        : null;
  }

  var geometryType = {
    Point: function(o) { return point(o.coordinates); },
    MultiPoint: function(o) { return o.coordinates.map(point); },
    LineString: function(o) { return line(o.arcs); },
    MultiLineString: function(o) { return o.arcs.map(line); },
    Polygon: function(o) { return polygon(o.arcs); },
    MultiPolygon: function(o) { return o.arcs.map(polygon); }
  };

  return geometry(o);
}

var stitchArcs = function(topology, arcs) {
  var stitchedArcs = {},
      fragmentByStart = {},
      fragmentByEnd = {},
      fragments = [],
      emptyIndex = -1;

  // Stitch empty arcs first, since they may be subsumed by other arcs.
  arcs.forEach(function(i, j) {
    var arc = topology.arcs[i < 0 ? ~i : i], t;
    if (arc.length < 3 && !arc[1][0] && !arc[1][1]) {
      t = arcs[++emptyIndex], arcs[emptyIndex] = i, arcs[j] = t;
    }
  });

  arcs.forEach(function(i) {
    var e = ends(i),
        start = e[0],
        end = e[1],
        f, g;

    if (f = fragmentByEnd[start]) {
      delete fragmentByEnd[f.end];
      f.push(i);
      f.end = end;
      if (g = fragmentByStart[end]) {
        delete fragmentByStart[g.start];
        var fg = g === f ? f : f.concat(g);
        fragmentByStart[fg.start = f.start] = fragmentByEnd[fg.end = g.end] = fg;
      } else {
        fragmentByStart[f.start] = fragmentByEnd[f.end] = f;
      }
    } else if (f = fragmentByStart[end]) {
      delete fragmentByStart[f.start];
      f.unshift(i);
      f.start = start;
      if (g = fragmentByEnd[start]) {
        delete fragmentByEnd[g.end];
        var gf = g === f ? f : g.concat(f);
        fragmentByStart[gf.start = g.start] = fragmentByEnd[gf.end = f.end] = gf;
      } else {
        fragmentByStart[f.start] = fragmentByEnd[f.end] = f;
      }
    } else {
      f = [i];
      fragmentByStart[f.start = start] = fragmentByEnd[f.end = end] = f;
    }
  });

  function ends(i) {
    var arc = topology.arcs[i < 0 ? ~i : i], p0 = arc[0], p1;
    if (topology.transform) p1 = [0, 0], arc.forEach(function(dp) { p1[0] += dp[0], p1[1] += dp[1]; });
    else p1 = arc[arc.length - 1];
    return i < 0 ? [p1, p0] : [p0, p1];
  }

  function flush(fragmentByEnd, fragmentByStart) {
    for (var k in fragmentByEnd) {
      var f = fragmentByEnd[k];
      delete fragmentByStart[f.start];
      delete f.start;
      delete f.end;
      f.forEach(function(i) { stitchedArcs[i < 0 ? ~i : i] = 1; });
      fragments.push(f);
    }
  }

  flush(fragmentByEnd, fragmentByStart);
  flush(fragmentByStart, fragmentByEnd);
  arcs.forEach(function(i) { if (!stitchedArcs[i < 0 ? ~i : i]) fragments.push([i]); });

  return fragments;
};

var mesh = function(topology) {
  return object(topology, meshArcs.apply(this, arguments));
};

function meshArcs(topology, o, filter) {
  var arcs = [];

  function arc(i) {
    var j = i < 0 ? ~i : i;
    (geomsByArc[j] || (geomsByArc[j] = [])).push({i: i, g: geom});
  }

  function line(arcs) {
    arcs.forEach(arc);
  }

  function polygon(arcs) {
    arcs.forEach(line);
  }

  function geometry(o) {
    if (o.type === "GeometryCollection") o.geometries.forEach(geometry);
    else if (o.type in geometryType) geom = o, geometryType[o.type](o.arcs);
  }

  if (arguments.length > 1) {
    var geomsByArc = [],
        geom;

    var geometryType = {
      LineString: line,
      MultiLineString: polygon,
      Polygon: polygon,
      MultiPolygon: function(arcs) { arcs.forEach(polygon); }
    };

    geometry(o);

    geomsByArc.forEach(arguments.length < 3
        ? function(geoms) { arcs.push(geoms[0].i); }
        : function(geoms) { if (filter(geoms[0].g, geoms[geoms.length - 1].g)) arcs.push(geoms[0].i); });
  } else {
    for (var i = 0, n = topology.arcs.length; i < n; ++i) arcs.push(i);
  }

  return {type: "MultiLineString", arcs: stitchArcs(topology, arcs)};
}

function triangle(triangle) {
  var a = triangle[0], b = triangle[1], c = triangle[2];
  return Math.abs((a[0] - c[0]) * (b[1] - a[1]) - (a[0] - b[0]) * (c[1] - a[1]));
}

function ring(ring) {
  var i = -1,
      n = ring.length,
      a,
      b = ring[n - 1],
      area = 0;

  while (++i < n) {
    a = b;
    b = ring[i];
    area += a[0] * b[1] - a[1] * b[0];
  }

  return area / 2;
}

function compareArea(a, b) {
  return a[1][2] - b[1][2];
}

var minAreaHeap = function() {
  var heap = {},
      array = [],
      size = 0;

  heap.push = function(object) {
    up(array[object._ = size] = object, size++);
    return size;
  };

  heap.pop = function() {
    if (size <= 0) return;
    var removed = array[0], object;
    if (--size > 0) object = array[size], down(array[object._ = 0] = object, 0);
    return removed;
  };

  heap.remove = function(removed) {
    var i = removed._, object;
    if (array[i] !== removed) return; // invalid request
    if (i !== --size) object = array[size], (compareArea(object, removed) < 0 ? up : down)(array[object._ = i] = object, i);
    return i;
  };

  function up(object, i) {
    while (i > 0) {
      var j = ((i + 1) >> 1) - 1,
          parent = array[j];
      if (compareArea(object, parent) >= 0) break;
      array[parent._ = i] = parent;
      array[object._ = i = j] = object;
    }
  }

  function down(object, i) {
    while (true) {
      var r = (i + 1) << 1,
          l = r - 1,
          j = i,
          child = array[j];
      if (l < size && compareArea(array[l], child) < 0) child = array[j = l];
      if (r < size && compareArea(array[r], child) < 0) child = array[j = r];
      if (j === i) break;
      array[child._ = i] = child;
      array[object._ = i = j] = object;
    }
  }

  return heap;
};

var topojson = function(data, format) {
  var object, property;
  data = json$1(data, format);

  if (format && (property = format.feature)) {
    return (object = data.objects[property])
      ? feature(data, object).features
      : error('Invalid TopoJSON object: ' + property);
  }

  else if (format && (property = format.mesh)) {
    return (object = data.objects[property])
      ? [mesh(data, object)]
      : error('Invalid TopoJSON object: ' + property);
  }

  error('Missing TopoJSON feature or mesh parameter.');
};

var formats = {
  dsv: dsv$1,
  csv: delimitedFormat(','),
  tsv: delimitedFormat('\t'),
  json: json$1,
  topojson: topojson
};

var formats$1 = function(name, format) {
  return arguments.length > 1 ? (formats[name] = format, this)
    : formats.hasOwnProperty(name) ? formats[name] : null;
};

var t0 = new Date;
var t1 = new Date;

function newInterval(floori, offseti, count, field) {

  function interval(date) {
    return floori(date = new Date(+date)), date;
  }

  interval.floor = interval;

  interval.ceil = function(date) {
    return floori(date = new Date(date - 1)), offseti(date, 1), floori(date), date;
  };

  interval.round = function(date) {
    var d0 = interval(date),
        d1 = interval.ceil(date);
    return date - d0 < d1 - date ? d0 : d1;
  };

  interval.offset = function(date, step) {
    return offseti(date = new Date(+date), step == null ? 1 : Math.floor(step)), date;
  };

  interval.range = function(start, stop, step) {
    var range = [];
    start = interval.ceil(start);
    step = step == null ? 1 : Math.floor(step);
    if (!(start < stop) || !(step > 0)) return range; // also handles Invalid Date
    do range.push(new Date(+start)); while (offseti(start, step), floori(start), start < stop)
    return range;
  };

  interval.filter = function(test) {
    return newInterval(function(date) {
      if (date >= date) while (floori(date), !test(date)) date.setTime(date - 1);
    }, function(date, step) {
      if (date >= date) while (--step >= 0) while (offseti(date, 1), !test(date)) {} // eslint-disable-line no-empty
    });
  };

  if (count) {
    interval.count = function(start, end) {
      t0.setTime(+start), t1.setTime(+end);
      floori(t0), floori(t1);
      return Math.floor(count(t0, t1));
    };

    interval.every = function(step) {
      step = Math.floor(step);
      return !isFinite(step) || !(step > 0) ? null
          : !(step > 1) ? interval
          : interval.filter(field
              ? function(d) { return field(d) % step === 0; }
              : function(d) { return interval.count(0, d) % step === 0; });
    };
  }

  return interval;
}

var millisecond = newInterval(function() {
  // noop
}, function(date, step) {
  date.setTime(+date + step);
}, function(start, end) {
  return end - start;
});

// An optimized implementation for this simple case.
millisecond.every = function(k) {
  k = Math.floor(k);
  if (!isFinite(k) || !(k > 0)) return null;
  if (!(k > 1)) return millisecond;
  return newInterval(function(date) {
    date.setTime(Math.floor(date / k) * k);
  }, function(date, step) {
    date.setTime(+date + step * k);
  }, function(start, end) {
    return (end - start) / k;
  });
};

var durationSecond = 1e3;
var durationMinute = 6e4;
var durationHour = 36e5;
var durationDay = 864e5;
var durationWeek = 6048e5;

var second = newInterval(function(date) {
  date.setTime(Math.floor(date / durationSecond) * durationSecond);
}, function(date, step) {
  date.setTime(+date + step * durationSecond);
}, function(start, end) {
  return (end - start) / durationSecond;
}, function(date) {
  return date.getUTCSeconds();
});

var minute = newInterval(function(date) {
  date.setTime(Math.floor(date / durationMinute) * durationMinute);
}, function(date, step) {
  date.setTime(+date + step * durationMinute);
}, function(start, end) {
  return (end - start) / durationMinute;
}, function(date) {
  return date.getMinutes();
});

var hour = newInterval(function(date) {
  var offset = date.getTimezoneOffset() * durationMinute % durationHour;
  if (offset < 0) offset += durationHour;
  date.setTime(Math.floor((+date - offset) / durationHour) * durationHour + offset);
}, function(date, step) {
  date.setTime(+date + step * durationHour);
}, function(start, end) {
  return (end - start) / durationHour;
}, function(date) {
  return date.getHours();
});

var day = newInterval(function(date) {
  date.setHours(0, 0, 0, 0);
}, function(date, step) {
  date.setDate(date.getDate() + step);
}, function(start, end) {
  return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * durationMinute) / durationDay;
}, function(date) {
  return date.getDate() - 1;
});

function weekday(i) {
  return newInterval(function(date) {
    date.setDate(date.getDate() - (date.getDay() + 7 - i) % 7);
    date.setHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setDate(date.getDate() + step * 7);
  }, function(start, end) {
    return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * durationMinute) / durationWeek;
  });
}

var sunday = weekday(0);
var monday = weekday(1);
var tuesday = weekday(2);
var wednesday = weekday(3);
var thursday = weekday(4);
var friday = weekday(5);
var saturday = weekday(6);

var month = newInterval(function(date) {
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
}, function(date, step) {
  date.setMonth(date.getMonth() + step);
}, function(start, end) {
  return end.getMonth() - start.getMonth() + (end.getFullYear() - start.getFullYear()) * 12;
}, function(date) {
  return date.getMonth();
});

var year = newInterval(function(date) {
  date.setMonth(0, 1);
  date.setHours(0, 0, 0, 0);
}, function(date, step) {
  date.setFullYear(date.getFullYear() + step);
}, function(start, end) {
  return end.getFullYear() - start.getFullYear();
}, function(date) {
  return date.getFullYear();
});

// An optimized implementation for this simple case.
year.every = function(k) {
  return !isFinite(k = Math.floor(k)) || !(k > 0) ? null : newInterval(function(date) {
    date.setFullYear(Math.floor(date.getFullYear() / k) * k);
    date.setMonth(0, 1);
    date.setHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setFullYear(date.getFullYear() + step * k);
  });
};

var utcMinute = newInterval(function(date) {
  date.setUTCSeconds(0, 0);
}, function(date, step) {
  date.setTime(+date + step * durationMinute);
}, function(start, end) {
  return (end - start) / durationMinute;
}, function(date) {
  return date.getUTCMinutes();
});

var utcHour = newInterval(function(date) {
  date.setUTCMinutes(0, 0, 0);
}, function(date, step) {
  date.setTime(+date + step * durationHour);
}, function(start, end) {
  return (end - start) / durationHour;
}, function(date) {
  return date.getUTCHours();
});

var utcDay = newInterval(function(date) {
  date.setUTCHours(0, 0, 0, 0);
}, function(date, step) {
  date.setUTCDate(date.getUTCDate() + step);
}, function(start, end) {
  return (end - start) / durationDay;
}, function(date) {
  return date.getUTCDate() - 1;
});

function utcWeekday(i) {
  return newInterval(function(date) {
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 7 - i) % 7);
    date.setUTCHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setUTCDate(date.getUTCDate() + step * 7);
  }, function(start, end) {
    return (end - start) / durationWeek;
  });
}

var utcSunday = utcWeekday(0);
var utcMonday = utcWeekday(1);
var utcTuesday = utcWeekday(2);
var utcWednesday = utcWeekday(3);
var utcThursday = utcWeekday(4);
var utcFriday = utcWeekday(5);
var utcSaturday = utcWeekday(6);

var utcMonth = newInterval(function(date) {
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
}, function(date, step) {
  date.setUTCMonth(date.getUTCMonth() + step);
}, function(start, end) {
  return end.getUTCMonth() - start.getUTCMonth() + (end.getUTCFullYear() - start.getUTCFullYear()) * 12;
}, function(date) {
  return date.getUTCMonth();
});

var utcYear = newInterval(function(date) {
  date.setUTCMonth(0, 1);
  date.setUTCHours(0, 0, 0, 0);
}, function(date, step) {
  date.setUTCFullYear(date.getUTCFullYear() + step);
}, function(start, end) {
  return end.getUTCFullYear() - start.getUTCFullYear();
}, function(date) {
  return date.getUTCFullYear();
});

// An optimized implementation for this simple case.
utcYear.every = function(k) {
  return !isFinite(k = Math.floor(k)) || !(k > 0) ? null : newInterval(function(date) {
    date.setUTCFullYear(Math.floor(date.getUTCFullYear() / k) * k);
    date.setUTCMonth(0, 1);
    date.setUTCHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setUTCFullYear(date.getUTCFullYear() + step * k);
  });
};

function localDate(d) {
  if (0 <= d.y && d.y < 100) {
    var date = new Date(-1, d.m, d.d, d.H, d.M, d.S, d.L);
    date.setFullYear(d.y);
    return date;
  }
  return new Date(d.y, d.m, d.d, d.H, d.M, d.S, d.L);
}

function utcDate(d) {
  if (0 <= d.y && d.y < 100) {
    var date = new Date(Date.UTC(-1, d.m, d.d, d.H, d.M, d.S, d.L));
    date.setUTCFullYear(d.y);
    return date;
  }
  return new Date(Date.UTC(d.y, d.m, d.d, d.H, d.M, d.S, d.L));
}

function newYear(y) {
  return {y: y, m: 0, d: 1, H: 0, M: 0, S: 0, L: 0};
}

function formatLocale(locale) {
  var locale_dateTime = locale.dateTime,
      locale_date = locale.date,
      locale_time = locale.time,
      locale_periods = locale.periods,
      locale_weekdays = locale.days,
      locale_shortWeekdays = locale.shortDays,
      locale_months = locale.months,
      locale_shortMonths = locale.shortMonths;

  var periodRe = formatRe(locale_periods),
      periodLookup = formatLookup(locale_periods),
      weekdayRe = formatRe(locale_weekdays),
      weekdayLookup = formatLookup(locale_weekdays),
      shortWeekdayRe = formatRe(locale_shortWeekdays),
      shortWeekdayLookup = formatLookup(locale_shortWeekdays),
      monthRe = formatRe(locale_months),
      monthLookup = formatLookup(locale_months),
      shortMonthRe = formatRe(locale_shortMonths),
      shortMonthLookup = formatLookup(locale_shortMonths);

  var formats = {
    "a": formatShortWeekday,
    "A": formatWeekday,
    "b": formatShortMonth,
    "B": formatMonth,
    "c": null,
    "d": formatDayOfMonth,
    "e": formatDayOfMonth,
    "H": formatHour24,
    "I": formatHour12,
    "j": formatDayOfYear,
    "L": formatMilliseconds,
    "m": formatMonthNumber,
    "M": formatMinutes,
    "p": formatPeriod,
    "S": formatSeconds,
    "U": formatWeekNumberSunday,
    "w": formatWeekdayNumber,
    "W": formatWeekNumberMonday,
    "x": null,
    "X": null,
    "y": formatYear,
    "Y": formatFullYear,
    "Z": formatZone,
    "%": formatLiteralPercent
  };

  var utcFormats = {
    "a": formatUTCShortWeekday,
    "A": formatUTCWeekday,
    "b": formatUTCShortMonth,
    "B": formatUTCMonth,
    "c": null,
    "d": formatUTCDayOfMonth,
    "e": formatUTCDayOfMonth,
    "H": formatUTCHour24,
    "I": formatUTCHour12,
    "j": formatUTCDayOfYear,
    "L": formatUTCMilliseconds,
    "m": formatUTCMonthNumber,
    "M": formatUTCMinutes,
    "p": formatUTCPeriod,
    "S": formatUTCSeconds,
    "U": formatUTCWeekNumberSunday,
    "w": formatUTCWeekdayNumber,
    "W": formatUTCWeekNumberMonday,
    "x": null,
    "X": null,
    "y": formatUTCYear,
    "Y": formatUTCFullYear,
    "Z": formatUTCZone,
    "%": formatLiteralPercent
  };

  var parses = {
    "a": parseShortWeekday,
    "A": parseWeekday,
    "b": parseShortMonth,
    "B": parseMonth,
    "c": parseLocaleDateTime,
    "d": parseDayOfMonth,
    "e": parseDayOfMonth,
    "H": parseHour24,
    "I": parseHour24,
    "j": parseDayOfYear,
    "L": parseMilliseconds,
    "m": parseMonthNumber,
    "M": parseMinutes,
    "p": parsePeriod,
    "S": parseSeconds,
    "U": parseWeekNumberSunday,
    "w": parseWeekdayNumber,
    "W": parseWeekNumberMonday,
    "x": parseLocaleDate,
    "X": parseLocaleTime,
    "y": parseYear,
    "Y": parseFullYear,
    "Z": parseZone,
    "%": parseLiteralPercent
  };

  // These recursive directive definitions must be deferred.
  formats.x = newFormat(locale_date, formats);
  formats.X = newFormat(locale_time, formats);
  formats.c = newFormat(locale_dateTime, formats);
  utcFormats.x = newFormat(locale_date, utcFormats);
  utcFormats.X = newFormat(locale_time, utcFormats);
  utcFormats.c = newFormat(locale_dateTime, utcFormats);

  function newFormat(specifier, formats) {
    return function(date) {
      var string = [],
          i = -1,
          j = 0,
          n = specifier.length,
          c,
          pad,
          format;

      if (!(date instanceof Date)) date = new Date(+date);

      while (++i < n) {
        if (specifier.charCodeAt(i) === 37) {
          string.push(specifier.slice(j, i));
          if ((pad = pads[c = specifier.charAt(++i)]) != null) c = specifier.charAt(++i);
          else pad = c === "e" ? " " : "0";
          if (format = formats[c]) c = format(date, pad);
          string.push(c);
          j = i + 1;
        }
      }

      string.push(specifier.slice(j, i));
      return string.join("");
    };
  }

  function newParse(specifier, newDate) {
    return function(string) {
      var d = newYear(1900),
          i = parseSpecifier(d, specifier, string += "", 0);
      if (i != string.length) return null;

      // The am-pm flag is 0 for AM, and 1 for PM.
      if ("p" in d) d.H = d.H % 12 + d.p * 12;

      // Convert day-of-week and week-of-year to day-of-year.
      if ("W" in d || "U" in d) {
        if (!("w" in d)) d.w = "W" in d ? 1 : 0;
        var day$$1 = "Z" in d ? utcDate(newYear(d.y)).getUTCDay() : newDate(newYear(d.y)).getDay();
        d.m = 0;
        d.d = "W" in d ? (d.w + 6) % 7 + d.W * 7 - (day$$1 + 5) % 7 : d.w + d.U * 7 - (day$$1 + 6) % 7;
      }

      // If a time zone is specified, all fields are interpreted as UTC and then
      // offset according to the specified time zone.
      if ("Z" in d) {
        d.H += d.Z / 100 | 0;
        d.M += d.Z % 100;
        return utcDate(d);
      }

      // Otherwise, all fields are in local time.
      return newDate(d);
    };
  }

  function parseSpecifier(d, specifier, string, j) {
    var i = 0,
        n = specifier.length,
        m = string.length,
        c,
        parse;

    while (i < n) {
      if (j >= m) return -1;
      c = specifier.charCodeAt(i++);
      if (c === 37) {
        c = specifier.charAt(i++);
        parse = parses[c in pads ? specifier.charAt(i++) : c];
        if (!parse || ((j = parse(d, string, j)) < 0)) return -1;
      } else if (c != string.charCodeAt(j++)) {
        return -1;
      }
    }

    return j;
  }

  function parsePeriod(d, string, i) {
    var n = periodRe.exec(string.slice(i));
    return n ? (d.p = periodLookup[n[0].toLowerCase()], i + n[0].length) : -1;
  }

  function parseShortWeekday(d, string, i) {
    var n = shortWeekdayRe.exec(string.slice(i));
    return n ? (d.w = shortWeekdayLookup[n[0].toLowerCase()], i + n[0].length) : -1;
  }

  function parseWeekday(d, string, i) {
    var n = weekdayRe.exec(string.slice(i));
    return n ? (d.w = weekdayLookup[n[0].toLowerCase()], i + n[0].length) : -1;
  }

  function parseShortMonth(d, string, i) {
    var n = shortMonthRe.exec(string.slice(i));
    return n ? (d.m = shortMonthLookup[n[0].toLowerCase()], i + n[0].length) : -1;
  }

  function parseMonth(d, string, i) {
    var n = monthRe.exec(string.slice(i));
    return n ? (d.m = monthLookup[n[0].toLowerCase()], i + n[0].length) : -1;
  }

  function parseLocaleDateTime(d, string, i) {
    return parseSpecifier(d, locale_dateTime, string, i);
  }

  function parseLocaleDate(d, string, i) {
    return parseSpecifier(d, locale_date, string, i);
  }

  function parseLocaleTime(d, string, i) {
    return parseSpecifier(d, locale_time, string, i);
  }

  function formatShortWeekday(d) {
    return locale_shortWeekdays[d.getDay()];
  }

  function formatWeekday(d) {
    return locale_weekdays[d.getDay()];
  }

  function formatShortMonth(d) {
    return locale_shortMonths[d.getMonth()];
  }

  function formatMonth(d) {
    return locale_months[d.getMonth()];
  }

  function formatPeriod(d) {
    return locale_periods[+(d.getHours() >= 12)];
  }

  function formatUTCShortWeekday(d) {
    return locale_shortWeekdays[d.getUTCDay()];
  }

  function formatUTCWeekday(d) {
    return locale_weekdays[d.getUTCDay()];
  }

  function formatUTCShortMonth(d) {
    return locale_shortMonths[d.getUTCMonth()];
  }

  function formatUTCMonth(d) {
    return locale_months[d.getUTCMonth()];
  }

  function formatUTCPeriod(d) {
    return locale_periods[+(d.getUTCHours() >= 12)];
  }

  return {
    format: function(specifier) {
      var f = newFormat(specifier += "", formats);
      f.toString = function() { return specifier; };
      return f;
    },
    parse: function(specifier) {
      var p = newParse(specifier += "", localDate);
      p.toString = function() { return specifier; };
      return p;
    },
    utcFormat: function(specifier) {
      var f = newFormat(specifier += "", utcFormats);
      f.toString = function() { return specifier; };
      return f;
    },
    utcParse: function(specifier) {
      var p = newParse(specifier, utcDate);
      p.toString = function() { return specifier; };
      return p;
    }
  };
}

var pads = {"-": "", "_": " ", "0": "0"};
var numberRe = /^\s*\d+/;
var percentRe = /^%/;
var requoteRe = /[\\\^\$\*\+\?\|\[\]\(\)\.\{\}]/g;

function pad$1(value, fill, width) {
  var sign = value < 0 ? "-" : "",
      string = (sign ? -value : value) + "",
      length = string.length;
  return sign + (length < width ? new Array(width - length + 1).join(fill) + string : string);
}

function requote(s) {
  return s.replace(requoteRe, "\\$&");
}

function formatRe(names) {
  return new RegExp("^(?:" + names.map(requote).join("|") + ")", "i");
}

function formatLookup(names) {
  var map = {}, i = -1, n = names.length;
  while (++i < n) map[names[i].toLowerCase()] = i;
  return map;
}

function parseWeekdayNumber(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 1));
  return n ? (d.w = +n[0], i + n[0].length) : -1;
}

function parseWeekNumberSunday(d, string, i) {
  var n = numberRe.exec(string.slice(i));
  return n ? (d.U = +n[0], i + n[0].length) : -1;
}

function parseWeekNumberMonday(d, string, i) {
  var n = numberRe.exec(string.slice(i));
  return n ? (d.W = +n[0], i + n[0].length) : -1;
}

function parseFullYear(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 4));
  return n ? (d.y = +n[0], i + n[0].length) : -1;
}

function parseYear(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.y = +n[0] + (+n[0] > 68 ? 1900 : 2000), i + n[0].length) : -1;
}

function parseZone(d, string, i) {
  var n = /^(Z)|([+-]\d\d)(?:\:?(\d\d))?/.exec(string.slice(i, i + 6));
  return n ? (d.Z = n[1] ? 0 : -(n[2] + (n[3] || "00")), i + n[0].length) : -1;
}

function parseMonthNumber(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.m = n[0] - 1, i + n[0].length) : -1;
}

function parseDayOfMonth(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.d = +n[0], i + n[0].length) : -1;
}

function parseDayOfYear(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 3));
  return n ? (d.m = 0, d.d = +n[0], i + n[0].length) : -1;
}

function parseHour24(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.H = +n[0], i + n[0].length) : -1;
}

function parseMinutes(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.M = +n[0], i + n[0].length) : -1;
}

function parseSeconds(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.S = +n[0], i + n[0].length) : -1;
}

function parseMilliseconds(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 3));
  return n ? (d.L = +n[0], i + n[0].length) : -1;
}

function parseLiteralPercent(d, string, i) {
  var n = percentRe.exec(string.slice(i, i + 1));
  return n ? i + n[0].length : -1;
}

function formatDayOfMonth(d, p) {
  return pad$1(d.getDate(), p, 2);
}

function formatHour24(d, p) {
  return pad$1(d.getHours(), p, 2);
}

function formatHour12(d, p) {
  return pad$1(d.getHours() % 12 || 12, p, 2);
}

function formatDayOfYear(d, p) {
  return pad$1(1 + day.count(year(d), d), p, 3);
}

function formatMilliseconds(d, p) {
  return pad$1(d.getMilliseconds(), p, 3);
}

function formatMonthNumber(d, p) {
  return pad$1(d.getMonth() + 1, p, 2);
}

function formatMinutes(d, p) {
  return pad$1(d.getMinutes(), p, 2);
}

function formatSeconds(d, p) {
  return pad$1(d.getSeconds(), p, 2);
}

function formatWeekNumberSunday(d, p) {
  return pad$1(sunday.count(year(d), d), p, 2);
}

function formatWeekdayNumber(d) {
  return d.getDay();
}

function formatWeekNumberMonday(d, p) {
  return pad$1(monday.count(year(d), d), p, 2);
}

function formatYear(d, p) {
  return pad$1(d.getFullYear() % 100, p, 2);
}

function formatFullYear(d, p) {
  return pad$1(d.getFullYear() % 10000, p, 4);
}

function formatZone(d) {
  var z = d.getTimezoneOffset();
  return (z > 0 ? "-" : (z *= -1, "+"))
      + pad$1(z / 60 | 0, "0", 2)
      + pad$1(z % 60, "0", 2);
}

function formatUTCDayOfMonth(d, p) {
  return pad$1(d.getUTCDate(), p, 2);
}

function formatUTCHour24(d, p) {
  return pad$1(d.getUTCHours(), p, 2);
}

function formatUTCHour12(d, p) {
  return pad$1(d.getUTCHours() % 12 || 12, p, 2);
}

function formatUTCDayOfYear(d, p) {
  return pad$1(1 + utcDay.count(utcYear(d), d), p, 3);
}

function formatUTCMilliseconds(d, p) {
  return pad$1(d.getUTCMilliseconds(), p, 3);
}

function formatUTCMonthNumber(d, p) {
  return pad$1(d.getUTCMonth() + 1, p, 2);
}

function formatUTCMinutes(d, p) {
  return pad$1(d.getUTCMinutes(), p, 2);
}

function formatUTCSeconds(d, p) {
  return pad$1(d.getUTCSeconds(), p, 2);
}

function formatUTCWeekNumberSunday(d, p) {
  return pad$1(utcSunday.count(utcYear(d), d), p, 2);
}

function formatUTCWeekdayNumber(d) {
  return d.getUTCDay();
}

function formatUTCWeekNumberMonday(d, p) {
  return pad$1(utcMonday.count(utcYear(d), d), p, 2);
}

function formatUTCYear(d, p) {
  return pad$1(d.getUTCFullYear() % 100, p, 2);
}

function formatUTCFullYear(d, p) {
  return pad$1(d.getUTCFullYear() % 10000, p, 4);
}

function formatUTCZone() {
  return "+0000";
}

function formatLiteralPercent() {
  return "%";
}

var locale$1;
var timeFormat;
var timeParse;
var utcFormat;
var utcParse;

defaultLocale({
  dateTime: "%x, %X",
  date: "%-m/%-d/%Y",
  time: "%-I:%M:%S %p",
  periods: ["AM", "PM"],
  days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  shortDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  shortMonths: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
});

function defaultLocale(definition) {
  locale$1 = formatLocale(definition);
  timeFormat = locale$1.format;
  timeParse = locale$1.parse;
  utcFormat = locale$1.utcFormat;
  utcParse = locale$1.utcParse;
  return locale$1;
}

var isoSpecifier = "%Y-%m-%dT%H:%M:%S.%LZ";

function formatIsoNative(date) {
  return date.toISOString();
}

var formatIso = Date.prototype.toISOString
    ? formatIsoNative
    : utcFormat(isoSpecifier);

function parseIsoNative(string) {
  var date = new Date(string);
  return isNaN(date) ? null : date;
}

var parseIso = +new Date("2000-01-01T00:00:00.000Z")
    ? parseIsoNative
    : utcParse(isoSpecifier);

function parse(data, types, dateParse) {
  dateParse = dateParse || timeParse;

  var fields = data.columns || Object.keys(data[0]),
      parsers, datum, field$$1, i, j, n, m;

  if (types === 'auto') types = inferTypes(data, fields);

  fields = Object.keys(types);
  parsers = fields.map(function(field$$1) {
    var type = types[field$$1],
        parts, pattern;

    if (type && type.indexOf('date:') === 0) {
      parts = type.split(/:(.+)?/, 2);  // split on first :
      pattern = parts[1];

      if ((pattern[0] === '\'' && pattern[pattern.length-1] === '\'') ||
          (pattern[0] === '"'  && pattern[pattern.length-1] === '"')) {
        pattern = pattern.slice(1, -1);
      }

      return dateParse(pattern);
    }

    if (!typeParsers[type]) {
      throw Error('Illegal format pattern: ' + field$$1 + ':' + type);
    }

    return typeParsers[type];
  });

  for (i=0, n=data.length, m=fields.length; i<n; ++i) {
    datum = data[i];
    for (j=0; j<m; ++j) {
      field$$1 = fields[j];
      datum[field$$1] = parsers[j](datum[field$$1]);
    }
  }
}

function ImageLoader(imageLoader) {
  this._pending = 0;
  this._loader = imageLoader || loader();
}

var prototype$1 = ImageLoader.prototype;

prototype$1.pending = function() {
  return this._pending;
};

prototype$1.loadImage = function(uri) {
  var loader$$1 = this;
  loader$$1._pending += 1;

  return loader$$1._loader.sanitize(uri, {context:'image'})
    .then(function(url) {
      if (!url || !Image$1) throw 'Image unsupported.';

      var image = new Image$1();

      image.onload = function() {
        loader$$1._pending -= 1;
        image.loaded = true;
      };

      image.onerror = function() {
        loader$$1._pending -= 1;
        image.loaded = false;
      };

      image.src = url;
      return image;
    })
    .catch(function() {
      loader$$1._pending -= 1;
      return {loaded: false, width: 0, height: 0};
    });
};

prototype$1.ready = function() {
  var loader$$1 = this;
  return new Promise(function(accept) {
    function poll(value) {
      if (!loader$$1._pending) accept(value);
      else setTimeout(function() { poll(true); }, 10);
    }
    poll(false);
  });
};

function Scenegraph() {
  this.root = createMark({
    marktype: 'group',
    name: 'root',
    role: 'frame'
  });
  this.root.items = [new GroupItem(this.root)];
}

var prototype$2 = Scenegraph.prototype;

prototype$2.mark = function(scenepath, markdef) {
  var markpath = scenepath.marks,
      itempath = scenepath.items,
      item = this.root.items[0],
      mark, index, i, n;

  try {
    for (i=0, n=markpath.length; i<n; ++i) {
      mark = item.items[markpath[i]];
      if (!mark) break;
      index = itempath[i] || 0;
      item = mark.items[index] || mark.items[mark.items.length-1];
    }

    if (!mark) {
      mark = createMark(markdef, item);
      item.items[markpath[i]] = mark;
      if (mark.zindex) mark.group.zdirty = true;
      return mark;
    }

    throw n;
  } catch (err) {
    error$1('Invalid scenegraph path: ' + JSON.stringify(scenepath));
  }
};

function error$1(msg) {
  throw Error(msg);
}

function createMark(def, group) {
  return {
    bounds:      new Bounds(),
    bounds_prev: new Bounds(),
    clip:        !!def.clip,
    group:       group,
    interactive: def.interactive === false ? false : true,
    items:       [],
    marktype:    def.marktype,
    name:        def.name || undefined,
    role:        def.role || undefined,
    zindex:      def.zindex || 0
  };
}

function Handler() {
  this._active = null;
  this._handlers = {};
}

var prototype$3 = Handler.prototype;

prototype$3.initialize = function(el, origin, obj) {
  this._el = el;
  this._obj = obj || null;
  return this.origin(origin);
};

prototype$3.element = function() {
  return this._el;
};

prototype$3.origin = function(origin) {
  this._origin = origin || [0, 0];
  return this;
};

prototype$3.scene = function(scene) {
  if (!arguments.length) return this._scene;
  this._scene = scene;
  return this;
};

// add an event handler
// subclasses should override
prototype$3.on = function(/*type, handler*/) {};

// remove an event handler
// subclasses should override
prototype$3.off = function(/*type, handler*/) {};

// return an array with all registered event handlers
prototype$3.handlers = function() {
  var h = this._handlers, a = [], k;
  for (k in h) { a.push.apply(a, h[k]); }
  return a;
};

prototype$3.eventName = function(name) {
  var i = name.indexOf('.');
  return i < 0 ? name : name.slice(0,i);
};

/**
 * Create a new Renderer instance.
 * @param {object} [imageLoader] - Optional loader instance for
 *   image URL sanitization. If not specified, a standard loader
 *   instance will be generated.
 * @constructor
 */
function Renderer(imageLoader) {
  this._el = null;
  this._bgcolor = null;
  this._loader = new ImageLoader(imageLoader);
}

var prototype$4 = Renderer.prototype;

/**
 * Initialize a new Renderer instance.
 * @param {DOMElement} el - The containing DOM element for the display.
 * @param {number} width - The width of the display, in pixels.
 * @param {number} height - The height of the display, in pixels.
 * @param {Array<number>} origin - The origin of the display, in pixels.
 *   The coordinate system will be translated to this point.
 * @return {Renderer} - This renderer instance;
 */
prototype$4.initialize = function(el, width, height, origin) {
  this._el = el;
  return this.resize(width, height, origin);
};

/**
 * Returns the parent container element for a visualization.
 * @return {DOMElement} - The containing DOM element.
 */
prototype$4.element = function() {
  return this._el;
};

/**
 * Returns the scene element (e.g., canvas or SVG) of the visualization
 * Subclasses must override if the first child is not the scene element.
 * @return {DOMElement} - The scene (e.g., canvas or SVG) element.
 */
prototype$4.scene = function() {
  return this._el && this._el.firstChild;
};

/**
 * Get / set the background color.
 */
prototype$4.background = function(bgcolor) {
  if (arguments.length === 0) return this._bgcolor;
  this._bgcolor = bgcolor;
  return this;
};

/**
 * Resize the display.
 * @param {number} width - The new width of the display, in pixels.
 * @param {number} height - The new height of the display, in pixels.
 * @param {Array<number>} origin - The new origin of the display, in pixels.
 *   The coordinate system will be translated to this point.
 * @return {Renderer} - This renderer instance;
 */
prototype$4.resize = function(width, height, origin) {
  this._width = width;
  this._height = height;
  this._origin = origin || [0, 0];
  return this;
};

/**
 * Render an input scenegraph, potentially with a set of dirty items.
 * This method will perform an immediate rendering with available resources.
 * The renderer may also need to perform image loading to perform a complete
 * render. This process can lead to asynchronous re-rendering of the scene
 * after this method returns. To receive notification when rendering is
 * complete, use the renderAsync method instead.
 * @param {object} scene - The root mark of a scenegraph to render.
 * @param {Array<object>} [items] - An optional array of dirty items.
 *   If provided, the renderer may optimize the redraw of these items.
 * @return {Renderer} - This renderer instance.
 */
prototype$4.render = function(scene, items) {
  var r = this;

  // bind arguments into a render call, and cache it
  // this function may be subsequently called for async redraw
  r._call = function() { r._render(scene, items); };

  // invoke the renderer
  r._call();

  // clear the cached call for garbage collection
  // async redraws will stash their own copy
  r._call = null;

  return r;
};

/**
 * Internal rendering method. Renderer subclasses should override this
 * method to actually perform rendering.
 * @param {object} scene - The root mark of a scenegraph to render.
 * @param {Array<object>} [items] - An optional array of dirty items.
 *   If provided, the renderer may optimize the redraw of these items.
 */
prototype$4._render = function(/*scene, items*/) {
  // subclasses to override
};

/**
 * Asynchronous rendering method. Similar to render, but returns a Promise
 * that resolves when all rendering is completed. Sometimes a renderer must
 * perform image loading to get a complete rendering. The returned
 * Promise will not resolve until this process completes.
 * @param {object} scene - The root mark of a scenegraph to render.
 * @param {Array<object>} [items] - An optional array of dirty items.
 *   If provided, the renderer may optimize the redraw of these items.
 * @return {Promise} - A Promise that resolves when rendering is complete.
 */
prototype$4.renderAsync = function(scene, items) {
  var r = this.render(scene, items);
  return this._ready
    ? this._ready.then(function() { return r; })
    : Promise.resolve(r);
};

/**
 * Requests an image to include in the rendered scene.
 * This method proxies a call to ImageLoader.loadImage, but also tracks
 * image loading progress and invokes a re-render once complete.
 * @return {Image} - The requested image instance.
 *   The image content may not be loaded yet.
 */
prototype$4.loadImage = function(uri) {
  var r = this,
      p = r._loader.loadImage(uri);

  if (!r._ready) {
    // re-render the scene when image loading completes
    var call = r._call;
    r._ready = r._loader.ready()
      .then(function(redraw) {
        if (redraw) call();
        r._ready = null;
      });
  }

  return p;
};

var pi = Math.PI;
var tau = 2 * pi;
var epsilon = 1e-6;
var tauEpsilon = tau - epsilon;

function Path() {
  this._x0 = this._y0 = // start of current subpath
  this._x1 = this._y1 = null; // end of current subpath
  this._ = [];
}

function path() {
  return new Path;
}

Path.prototype = path.prototype = {
  constructor: Path,
  moveTo: function(x, y) {
    this._.push("M", this._x0 = this._x1 = +x, ",", this._y0 = this._y1 = +y);
  },
  closePath: function() {
    if (this._x1 !== null) {
      this._x1 = this._x0, this._y1 = this._y0;
      this._.push("Z");
    }
  },
  lineTo: function(x, y) {
    this._.push("L", this._x1 = +x, ",", this._y1 = +y);
  },
  quadraticCurveTo: function(x1, y1, x, y) {
    this._.push("Q", +x1, ",", +y1, ",", this._x1 = +x, ",", this._y1 = +y);
  },
  bezierCurveTo: function(x1, y1, x2, y2, x, y) {
    this._.push("C", +x1, ",", +y1, ",", +x2, ",", +y2, ",", this._x1 = +x, ",", this._y1 = +y);
  },
  arcTo: function(x1, y1, x2, y2, r) {
    x1 = +x1, y1 = +y1, x2 = +x2, y2 = +y2, r = +r;
    var x0 = this._x1,
        y0 = this._y1,
        x21 = x2 - x1,
        y21 = y2 - y1,
        x01 = x0 - x1,
        y01 = y0 - y1,
        l01_2 = x01 * x01 + y01 * y01;

    // Is the radius negative? Error.
    if (r < 0) throw new Error("negative radius: " + r);

    // Is this path empty? Move to (x1,y1).
    if (this._x1 === null) {
      this._.push(
        "M", this._x1 = x1, ",", this._y1 = y1
      );
    }

    // Or, is (x1,y1) coincident with (x0,y0)? Do nothing.
    else if (!(l01_2 > epsilon)) {}

    // Or, are (x0,y0), (x1,y1) and (x2,y2) collinear?
    // Equivalently, is (x1,y1) coincident with (x2,y2)?
    // Or, is the radius zero? Line to (x1,y1).
    else if (!(Math.abs(y01 * x21 - y21 * x01) > epsilon) || !r) {
      this._.push(
        "L", this._x1 = x1, ",", this._y1 = y1
      );
    }

    // Otherwise, draw an arc!
    else {
      var x20 = x2 - x0,
          y20 = y2 - y0,
          l21_2 = x21 * x21 + y21 * y21,
          l20_2 = x20 * x20 + y20 * y20,
          l21 = Math.sqrt(l21_2),
          l01 = Math.sqrt(l01_2),
          l = r * Math.tan((pi - Math.acos((l21_2 + l01_2 - l20_2) / (2 * l21 * l01))) / 2),
          t01 = l / l01,
          t21 = l / l21;

      // If the start tangent is not coincident with (x0,y0), line to.
      if (Math.abs(t01 - 1) > epsilon) {
        this._.push(
          "L", x1 + t01 * x01, ",", y1 + t01 * y01
        );
      }

      this._.push(
        "A", r, ",", r, ",0,0,", +(y01 * x20 > x01 * y20), ",", this._x1 = x1 + t21 * x21, ",", this._y1 = y1 + t21 * y21
      );
    }
  },
  arc: function(x, y, r, a0, a1, ccw) {
    x = +x, y = +y, r = +r;
    var dx = r * Math.cos(a0),
        dy = r * Math.sin(a0),
        x0 = x + dx,
        y0 = y + dy,
        cw = 1 ^ ccw,
        da = ccw ? a0 - a1 : a1 - a0;

    // Is the radius negative? Error.
    if (r < 0) throw new Error("negative radius: " + r);

    // Is this path empty? Move to (x0,y0).
    if (this._x1 === null) {
      this._.push(
        "M", x0, ",", y0
      );
    }

    // Or, is (x0,y0) not coincident with the previous point? Line to (x0,y0).
    else if (Math.abs(this._x1 - x0) > epsilon || Math.abs(this._y1 - y0) > epsilon) {
      this._.push(
        "L", x0, ",", y0
      );
    }

    // Is this arc empty? We’re done.
    if (!r) return;

    // Is this a complete circle? Draw two arcs to complete the circle.
    if (da > tauEpsilon) {
      this._.push(
        "A", r, ",", r, ",0,1,", cw, ",", x - dx, ",", y - dy,
        "A", r, ",", r, ",0,1,", cw, ",", this._x1 = x0, ",", this._y1 = y0
      );
    }

    // Otherwise, draw an arc!
    else {
      if (da < 0) da = da % tau + tau;
      this._.push(
        "A", r, ",", r, ",0,", +(da >= pi), ",", cw, ",", this._x1 = x + r * Math.cos(a1), ",", this._y1 = y + r * Math.sin(a1)
      );
    }
  },
  rect: function(x, y, w, h) {
    this._.push("M", this._x0 = this._x1 = +x, ",", this._y0 = this._y1 = +y, "h", +w, "v", +h, "h", -w, "Z");
  },
  toString: function() {
    return this._.join("");
  }
};

var constant$2 = function(x) {
  return function constant() {
    return x;
  };
};

var epsilon$1 = 1e-12;
var pi$1 = Math.PI;
var halfPi = pi$1 / 2;
var tau$1 = 2 * pi$1;

function arcInnerRadius(d) {
  return d.innerRadius;
}

function arcOuterRadius(d) {
  return d.outerRadius;
}

function arcStartAngle(d) {
  return d.startAngle;
}

function arcEndAngle(d) {
  return d.endAngle;
}

function arcPadAngle(d) {
  return d && d.padAngle; // Note: optional!
}

function asin(x) {
  return x >= 1 ? halfPi : x <= -1 ? -halfPi : Math.asin(x);
}

function intersect(x0, y0, x1, y1, x2, y2, x3, y3) {
  var x10 = x1 - x0, y10 = y1 - y0,
      x32 = x3 - x2, y32 = y3 - y2,
      t = (x32 * (y0 - y2) - y32 * (x0 - x2)) / (y32 * x10 - x32 * y10);
  return [x0 + t * x10, y0 + t * y10];
}

// Compute perpendicular offset line of length rc.
// http://mathworld.wolfram.com/Circle-LineIntersection.html
function cornerTangents(x0, y0, x1, y1, r1, rc, cw) {
  var x01 = x0 - x1,
      y01 = y0 - y1,
      lo = (cw ? rc : -rc) / Math.sqrt(x01 * x01 + y01 * y01),
      ox = lo * y01,
      oy = -lo * x01,
      x11 = x0 + ox,
      y11 = y0 + oy,
      x10 = x1 + ox,
      y10 = y1 + oy,
      x00 = (x11 + x10) / 2,
      y00 = (y11 + y10) / 2,
      dx = x10 - x11,
      dy = y10 - y11,
      d2 = dx * dx + dy * dy,
      r = r1 - rc,
      D = x11 * y10 - x10 * y11,
      d = (dy < 0 ? -1 : 1) * Math.sqrt(Math.max(0, r * r * d2 - D * D)),
      cx0 = (D * dy - dx * d) / d2,
      cy0 = (-D * dx - dy * d) / d2,
      cx1 = (D * dy + dx * d) / d2,
      cy1 = (-D * dx + dy * d) / d2,
      dx0 = cx0 - x00,
      dy0 = cy0 - y00,
      dx1 = cx1 - x00,
      dy1 = cy1 - y00;

  // Pick the closer of the two intersection points.
  // TODO Is there a faster way to determine which intersection to use?
  if (dx0 * dx0 + dy0 * dy0 > dx1 * dx1 + dy1 * dy1) cx0 = cx1, cy0 = cy1;

  return {
    cx: cx0,
    cy: cy0,
    x01: -ox,
    y01: -oy,
    x11: cx0 * (r1 / r - 1),
    y11: cy0 * (r1 / r - 1)
  };
}

var d3_arc = function() {
  var innerRadius = arcInnerRadius,
      outerRadius = arcOuterRadius,
      cornerRadius = constant$2(0),
      padRadius = null,
      startAngle = arcStartAngle,
      endAngle = arcEndAngle,
      padAngle = arcPadAngle,
      context = null;

  function arc() {
    var buffer,
        r,
        r0 = +innerRadius.apply(this, arguments),
        r1 = +outerRadius.apply(this, arguments),
        a0 = startAngle.apply(this, arguments) - halfPi,
        a1 = endAngle.apply(this, arguments) - halfPi,
        da = Math.abs(a1 - a0),
        cw = a1 > a0;

    if (!context) context = buffer = path();

    // Ensure that the outer radius is always larger than the inner radius.
    if (r1 < r0) r = r1, r1 = r0, r0 = r;

    // Is it a point?
    if (!(r1 > epsilon$1)) context.moveTo(0, 0);

    // Or is it a circle or annulus?
    else if (da > tau$1 - epsilon$1) {
      context.moveTo(r1 * Math.cos(a0), r1 * Math.sin(a0));
      context.arc(0, 0, r1, a0, a1, !cw);
      if (r0 > epsilon$1) {
        context.moveTo(r0 * Math.cos(a1), r0 * Math.sin(a1));
        context.arc(0, 0, r0, a1, a0, cw);
      }
    }

    // Or is it a circular or annular sector?
    else {
      var a01 = a0,
          a11 = a1,
          a00 = a0,
          a10 = a1,
          da0 = da,
          da1 = da,
          ap = padAngle.apply(this, arguments) / 2,
          rp = (ap > epsilon$1) && (padRadius ? +padRadius.apply(this, arguments) : Math.sqrt(r0 * r0 + r1 * r1)),
          rc = Math.min(Math.abs(r1 - r0) / 2, +cornerRadius.apply(this, arguments)),
          rc0 = rc,
          rc1 = rc,
          t0,
          t1;

      // Apply padding? Note that since r1 ≥ r0, da1 ≥ da0.
      if (rp > epsilon$1) {
        var p0 = asin(rp / r0 * Math.sin(ap)),
            p1 = asin(rp / r1 * Math.sin(ap));
        if ((da0 -= p0 * 2) > epsilon$1) p0 *= (cw ? 1 : -1), a00 += p0, a10 -= p0;
        else da0 = 0, a00 = a10 = (a0 + a1) / 2;
        if ((da1 -= p1 * 2) > epsilon$1) p1 *= (cw ? 1 : -1), a01 += p1, a11 -= p1;
        else da1 = 0, a01 = a11 = (a0 + a1) / 2;
      }

      var x01 = r1 * Math.cos(a01),
          y01 = r1 * Math.sin(a01),
          x10 = r0 * Math.cos(a10),
          y10 = r0 * Math.sin(a10);

      // Apply rounded corners?
      if (rc > epsilon$1) {
        var x11 = r1 * Math.cos(a11),
            y11 = r1 * Math.sin(a11),
            x00 = r0 * Math.cos(a00),
            y00 = r0 * Math.sin(a00);

        // Restrict the corner radius according to the sector angle.
        if (da < pi$1) {
          var oc = da0 > epsilon$1 ? intersect(x01, y01, x00, y00, x11, y11, x10, y10) : [x10, y10],
              ax = x01 - oc[0],
              ay = y01 - oc[1],
              bx = x11 - oc[0],
              by = y11 - oc[1],
              kc = 1 / Math.sin(Math.acos((ax * bx + ay * by) / (Math.sqrt(ax * ax + ay * ay) * Math.sqrt(bx * bx + by * by))) / 2),
              lc = Math.sqrt(oc[0] * oc[0] + oc[1] * oc[1]);
          rc0 = Math.min(rc, (r0 - lc) / (kc - 1));
          rc1 = Math.min(rc, (r1 - lc) / (kc + 1));
        }
      }

      // Is the sector collapsed to a line?
      if (!(da1 > epsilon$1)) context.moveTo(x01, y01);

      // Does the sector’s outer ring have rounded corners?
      else if (rc1 > epsilon$1) {
        t0 = cornerTangents(x00, y00, x01, y01, r1, rc1, cw);
        t1 = cornerTangents(x11, y11, x10, y10, r1, rc1, cw);

        context.moveTo(t0.cx + t0.x01, t0.cy + t0.y01);

        // Have the corners merged?
        if (rc1 < rc) context.arc(t0.cx, t0.cy, rc1, Math.atan2(t0.y01, t0.x01), Math.atan2(t1.y01, t1.x01), !cw);

        // Otherwise, draw the two corners and the ring.
        else {
          context.arc(t0.cx, t0.cy, rc1, Math.atan2(t0.y01, t0.x01), Math.atan2(t0.y11, t0.x11), !cw);
          context.arc(0, 0, r1, Math.atan2(t0.cy + t0.y11, t0.cx + t0.x11), Math.atan2(t1.cy + t1.y11, t1.cx + t1.x11), !cw);
          context.arc(t1.cx, t1.cy, rc1, Math.atan2(t1.y11, t1.x11), Math.atan2(t1.y01, t1.x01), !cw);
        }
      }

      // Or is the outer ring just a circular arc?
      else context.moveTo(x01, y01), context.arc(0, 0, r1, a01, a11, !cw);

      // Is there no inner ring, and it’s a circular sector?
      // Or perhaps it’s an annular sector collapsed due to padding?
      if (!(r0 > epsilon$1) || !(da0 > epsilon$1)) context.lineTo(x10, y10);

      // Does the sector’s inner ring (or point) have rounded corners?
      else if (rc0 > epsilon$1) {
        t0 = cornerTangents(x10, y10, x11, y11, r0, -rc0, cw);
        t1 = cornerTangents(x01, y01, x00, y00, r0, -rc0, cw);

        context.lineTo(t0.cx + t0.x01, t0.cy + t0.y01);

        // Have the corners merged?
        if (rc0 < rc) context.arc(t0.cx, t0.cy, rc0, Math.atan2(t0.y01, t0.x01), Math.atan2(t1.y01, t1.x01), !cw);

        // Otherwise, draw the two corners and the ring.
        else {
          context.arc(t0.cx, t0.cy, rc0, Math.atan2(t0.y01, t0.x01), Math.atan2(t0.y11, t0.x11), !cw);
          context.arc(0, 0, r0, Math.atan2(t0.cy + t0.y11, t0.cx + t0.x11), Math.atan2(t1.cy + t1.y11, t1.cx + t1.x11), cw);
          context.arc(t1.cx, t1.cy, rc0, Math.atan2(t1.y11, t1.x11), Math.atan2(t1.y01, t1.x01), !cw);
        }
      }

      // Or is the inner ring just a circular arc?
      else context.arc(0, 0, r0, a10, a00, cw);
    }

    context.closePath();

    if (buffer) return context = null, buffer + "" || null;
  }

  arc.centroid = function() {
    var r = (+innerRadius.apply(this, arguments) + +outerRadius.apply(this, arguments)) / 2,
        a = (+startAngle.apply(this, arguments) + +endAngle.apply(this, arguments)) / 2 - pi$1 / 2;
    return [Math.cos(a) * r, Math.sin(a) * r];
  };

  arc.innerRadius = function(_) {
    return arguments.length ? (innerRadius = typeof _ === "function" ? _ : constant$2(+_), arc) : innerRadius;
  };

  arc.outerRadius = function(_) {
    return arguments.length ? (outerRadius = typeof _ === "function" ? _ : constant$2(+_), arc) : outerRadius;
  };

  arc.cornerRadius = function(_) {
    return arguments.length ? (cornerRadius = typeof _ === "function" ? _ : constant$2(+_), arc) : cornerRadius;
  };

  arc.padRadius = function(_) {
    return arguments.length ? (padRadius = _ == null ? null : typeof _ === "function" ? _ : constant$2(+_), arc) : padRadius;
  };

  arc.startAngle = function(_) {
    return arguments.length ? (startAngle = typeof _ === "function" ? _ : constant$2(+_), arc) : startAngle;
  };

  arc.endAngle = function(_) {
    return arguments.length ? (endAngle = typeof _ === "function" ? _ : constant$2(+_), arc) : endAngle;
  };

  arc.padAngle = function(_) {
    return arguments.length ? (padAngle = typeof _ === "function" ? _ : constant$2(+_), arc) : padAngle;
  };

  arc.context = function(_) {
    return arguments.length ? ((context = _ == null ? null : _), arc) : context;
  };

  return arc;
};

function Linear(context) {
  this._context = context;
}

Linear.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._point = 0;
  },
  lineEnd: function() {
    if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x, y) {
    x = +x, y = +y;
    switch (this._point) {
      case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
      case 1: this._point = 2; // proceed
      default: this._context.lineTo(x, y); break;
    }
  }
};

var curveLinear = function(context) {
  return new Linear(context);
};

function x$1(p) {
  return p[0];
}

function y$1(p) {
  return p[1];
}

var d3_line = function() {
  var x$$1 = x$1,
      y$$1 = y$1,
      defined = constant$2(true),
      context = null,
      curve = curveLinear,
      output = null;

  function line(data) {
    var i,
        n = data.length,
        d,
        defined0 = false,
        buffer;

    if (context == null) output = curve(buffer = path());

    for (i = 0; i <= n; ++i) {
      if (!(i < n && defined(d = data[i], i, data)) === defined0) {
        if (defined0 = !defined0) output.lineStart();
        else output.lineEnd();
      }
      if (defined0) output.point(+x$$1(d, i, data), +y$$1(d, i, data));
    }

    if (buffer) return output = null, buffer + "" || null;
  }

  line.x = function(_) {
    return arguments.length ? (x$$1 = typeof _ === "function" ? _ : constant$2(+_), line) : x$$1;
  };

  line.y = function(_) {
    return arguments.length ? (y$$1 = typeof _ === "function" ? _ : constant$2(+_), line) : y$$1;
  };

  line.defined = function(_) {
    return arguments.length ? (defined = typeof _ === "function" ? _ : constant$2(!!_), line) : defined;
  };

  line.curve = function(_) {
    return arguments.length ? (curve = _, context != null && (output = curve(context)), line) : curve;
  };

  line.context = function(_) {
    return arguments.length ? (_ == null ? context = output = null : output = curve(context = _), line) : context;
  };

  return line;
};

var d3_area = function() {
  var x0 = x$1,
      x1 = null,
      y0 = constant$2(0),
      y1 = y$1,
      defined = constant$2(true),
      context = null,
      curve = curveLinear,
      output = null;

  function area(data) {
    var i,
        j,
        k,
        n = data.length,
        d,
        defined0 = false,
        buffer,
        x0z = new Array(n),
        y0z = new Array(n);

    if (context == null) output = curve(buffer = path());

    for (i = 0; i <= n; ++i) {
      if (!(i < n && defined(d = data[i], i, data)) === defined0) {
        if (defined0 = !defined0) {
          j = i;
          output.areaStart();
          output.lineStart();
        } else {
          output.lineEnd();
          output.lineStart();
          for (k = i - 1; k >= j; --k) {
            output.point(x0z[k], y0z[k]);
          }
          output.lineEnd();
          output.areaEnd();
        }
      }
      if (defined0) {
        x0z[i] = +x0(d, i, data), y0z[i] = +y0(d, i, data);
        output.point(x1 ? +x1(d, i, data) : x0z[i], y1 ? +y1(d, i, data) : y0z[i]);
      }
    }

    if (buffer) return output = null, buffer + "" || null;
  }

  function arealine() {
    return d3_line().defined(defined).curve(curve).context(context);
  }

  area.x = function(_) {
    return arguments.length ? (x0 = typeof _ === "function" ? _ : constant$2(+_), x1 = null, area) : x0;
  };

  area.x0 = function(_) {
    return arguments.length ? (x0 = typeof _ === "function" ? _ : constant$2(+_), area) : x0;
  };

  area.x1 = function(_) {
    return arguments.length ? (x1 = _ == null ? null : typeof _ === "function" ? _ : constant$2(+_), area) : x1;
  };

  area.y = function(_) {
    return arguments.length ? (y0 = typeof _ === "function" ? _ : constant$2(+_), y1 = null, area) : y0;
  };

  area.y0 = function(_) {
    return arguments.length ? (y0 = typeof _ === "function" ? _ : constant$2(+_), area) : y0;
  };

  area.y1 = function(_) {
    return arguments.length ? (y1 = _ == null ? null : typeof _ === "function" ? _ : constant$2(+_), area) : y1;
  };

  area.lineX0 =
  area.lineY0 = function() {
    return arealine().x(x0).y(y0);
  };

  area.lineY1 = function() {
    return arealine().x(x0).y(y1);
  };

  area.lineX1 = function() {
    return arealine().x(x1).y(y0);
  };

  area.defined = function(_) {
    return arguments.length ? (defined = typeof _ === "function" ? _ : constant$2(!!_), area) : defined;
  };

  area.curve = function(_) {
    return arguments.length ? (curve = _, context != null && (output = curve(context)), area) : curve;
  };

  area.context = function(_) {
    return arguments.length ? (_ == null ? context = output = null : output = curve(context = _), area) : context;
  };

  return area;
};

var descending = function(a, b) {
  return b < a ? -1 : b > a ? 1 : b >= a ? 0 : NaN;
};

var identity$1 = function(d) {
  return d;
};

var curveRadialLinear = curveRadial(curveLinear);

function Radial(curve) {
  this._curve = curve;
}

Radial.prototype = {
  areaStart: function() {
    this._curve.areaStart();
  },
  areaEnd: function() {
    this._curve.areaEnd();
  },
  lineStart: function() {
    this._curve.lineStart();
  },
  lineEnd: function() {
    this._curve.lineEnd();
  },
  point: function(a, r) {
    this._curve.point(r * Math.sin(a), r * -Math.cos(a));
  }
};

function curveRadial(curve) {

  function radial(context) {
    return new Radial(curve(context));
  }

  radial._curve = curve;

  return radial;
}

function radialLine(l) {
  var c = l.curve;

  l.angle = l.x, delete l.x;
  l.radius = l.y, delete l.y;

  l.curve = function(_) {
    return arguments.length ? c(curveRadial(_)) : c()._curve;
  };

  return l;
}

var circle = {
  draw: function(context, size) {
    var r = Math.sqrt(size / pi$1);
    context.moveTo(r, 0);
    context.arc(0, 0, r, 0, tau$1);
  }
};

var d3_symbol = function() {
  var type = constant$2(circle),
      size = constant$2(64),
      context = null;

  function symbol() {
    var buffer;
    if (!context) context = buffer = path();
    type.apply(this, arguments).draw(context, +size.apply(this, arguments));
    if (buffer) return context = null, buffer + "" || null;
  }

  symbol.type = function(_) {
    return arguments.length ? (type = typeof _ === "function" ? _ : constant$2(_), symbol) : type;
  };

  symbol.size = function(_) {
    return arguments.length ? (size = typeof _ === "function" ? _ : constant$2(+_), symbol) : size;
  };

  symbol.context = function(_) {
    return arguments.length ? (context = _ == null ? null : _, symbol) : context;
  };

  return symbol;
};

var noop$2 = function() {};

function point(that, x, y) {
  that._context.bezierCurveTo(
    (2 * that._x0 + that._x1) / 3,
    (2 * that._y0 + that._y1) / 3,
    (that._x0 + 2 * that._x1) / 3,
    (that._y0 + 2 * that._y1) / 3,
    (that._x0 + 4 * that._x1 + x) / 6,
    (that._y0 + 4 * that._y1 + y) / 6
  );
}

function Basis(context) {
  this._context = context;
}

Basis.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x0 = this._x1 =
    this._y0 = this._y1 = NaN;
    this._point = 0;
  },
  lineEnd: function() {
    switch (this._point) {
      case 3: point(this, this._x1, this._y1); // proceed
      case 2: this._context.lineTo(this._x1, this._y1); break;
    }
    if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x, y) {
    x = +x, y = +y;
    switch (this._point) {
      case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
      case 1: this._point = 2; break;
      case 2: this._point = 3; this._context.lineTo((5 * this._x0 + this._x1) / 6, (5 * this._y0 + this._y1) / 6); // proceed
      default: point(this, x, y); break;
    }
    this._x0 = this._x1, this._x1 = x;
    this._y0 = this._y1, this._y1 = y;
  }
};

var curveBasis = function(context) {
  return new Basis(context);
};

function Bundle(context, beta) {
  this._basis = new Basis(context);
  this._beta = beta;
}

Bundle.prototype = {
  lineStart: function() {
    this._x = [];
    this._y = [];
    this._basis.lineStart();
  },
  lineEnd: function() {
    var x = this._x,
        y = this._y,
        j = x.length - 1;

    if (j > 0) {
      var x0 = x[0],
          y0 = y[0],
          dx = x[j] - x0,
          dy = y[j] - y0,
          i = -1,
          t;

      while (++i <= j) {
        t = i / j;
        this._basis.point(
          this._beta * x[i] + (1 - this._beta) * (x0 + t * dx),
          this._beta * y[i] + (1 - this._beta) * (y0 + t * dy)
        );
      }
    }

    this._x = this._y = null;
    this._basis.lineEnd();
  },
  point: function(x, y) {
    this._x.push(+x);
    this._y.push(+y);
  }
};

var curveBundle = (function custom(beta) {

  function bundle(context) {
    return beta === 1 ? new Basis(context) : new Bundle(context, beta);
  }

  bundle.beta = function(beta) {
    return custom(+beta);
  };

  return bundle;
})(0.85);

function point$1(that, x, y) {
  that._context.bezierCurveTo(
    that._x1 + that._k * (that._x2 - that._x0),
    that._y1 + that._k * (that._y2 - that._y0),
    that._x2 + that._k * (that._x1 - x),
    that._y2 + that._k * (that._y1 - y),
    that._x2,
    that._y2
  );
}

function Cardinal(context, tension) {
  this._context = context;
  this._k = (1 - tension) / 6;
}

Cardinal.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x0 = this._x1 = this._x2 =
    this._y0 = this._y1 = this._y2 = NaN;
    this._point = 0;
  },
  lineEnd: function() {
    switch (this._point) {
      case 2: this._context.lineTo(this._x2, this._y2); break;
      case 3: point$1(this, this._x1, this._y1); break;
    }
    if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x, y) {
    x = +x, y = +y;
    switch (this._point) {
      case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
      case 1: this._point = 2; this._x1 = x, this._y1 = y; break;
      case 2: this._point = 3; // proceed
      default: point$1(this, x, y); break;
    }
    this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
    this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
  }
};

var curveCardinal = (function custom(tension) {

  function cardinal(context) {
    return new Cardinal(context, tension);
  }

  cardinal.tension = function(tension) {
    return custom(+tension);
  };

  return cardinal;
})(0);

function CardinalClosed(context, tension) {
  this._context = context;
  this._k = (1 - tension) / 6;
}

CardinalClosed.prototype = {
  areaStart: noop$2,
  areaEnd: noop$2,
  lineStart: function() {
    this._x0 = this._x1 = this._x2 = this._x3 = this._x4 = this._x5 =
    this._y0 = this._y1 = this._y2 = this._y3 = this._y4 = this._y5 = NaN;
    this._point = 0;
  },
  lineEnd: function() {
    switch (this._point) {
      case 1: {
        this._context.moveTo(this._x3, this._y3);
        this._context.closePath();
        break;
      }
      case 2: {
        this._context.lineTo(this._x3, this._y3);
        this._context.closePath();
        break;
      }
      case 3: {
        this.point(this._x3, this._y3);
        this.point(this._x4, this._y4);
        this.point(this._x5, this._y5);
        break;
      }
    }
  },
  point: function(x, y) {
    x = +x, y = +y;
    switch (this._point) {
      case 0: this._point = 1; this._x3 = x, this._y3 = y; break;
      case 1: this._point = 2; this._context.moveTo(this._x4 = x, this._y4 = y); break;
      case 2: this._point = 3; this._x5 = x, this._y5 = y; break;
      default: point$1(this, x, y); break;
    }
    this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
    this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
  }
};

(function custom(tension) {

  function cardinal(context) {
    return new CardinalClosed(context, tension);
  }

  cardinal.tension = function(tension) {
    return custom(+tension);
  };

  return cardinal;
})(0);

function CardinalOpen(context, tension) {
  this._context = context;
  this._k = (1 - tension) / 6;
}

CardinalOpen.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x0 = this._x1 = this._x2 =
    this._y0 = this._y1 = this._y2 = NaN;
    this._point = 0;
  },
  lineEnd: function() {
    if (this._line || (this._line !== 0 && this._point === 3)) this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x, y) {
    x = +x, y = +y;
    switch (this._point) {
      case 0: this._point = 1; break;
      case 1: this._point = 2; break;
      case 2: this._point = 3; this._line ? this._context.lineTo(this._x2, this._y2) : this._context.moveTo(this._x2, this._y2); break;
      case 3: this._point = 4; // proceed
      default: point$1(this, x, y); break;
    }
    this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
    this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
  }
};

(function custom(tension) {

  function cardinal(context) {
    return new CardinalOpen(context, tension);
  }

  cardinal.tension = function(tension) {
    return custom(+tension);
  };

  return cardinal;
})(0);

function point$2(that, x, y) {
  var x1 = that._x1,
      y1 = that._y1,
      x2 = that._x2,
      y2 = that._y2;

  if (that._l01_a > epsilon$1) {
    var a = 2 * that._l01_2a + 3 * that._l01_a * that._l12_a + that._l12_2a,
        n = 3 * that._l01_a * (that._l01_a + that._l12_a);
    x1 = (x1 * a - that._x0 * that._l12_2a + that._x2 * that._l01_2a) / n;
    y1 = (y1 * a - that._y0 * that._l12_2a + that._y2 * that._l01_2a) / n;
  }

  if (that._l23_a > epsilon$1) {
    var b = 2 * that._l23_2a + 3 * that._l23_a * that._l12_a + that._l12_2a,
        m = 3 * that._l23_a * (that._l23_a + that._l12_a);
    x2 = (x2 * b + that._x1 * that._l23_2a - x * that._l12_2a) / m;
    y2 = (y2 * b + that._y1 * that._l23_2a - y * that._l12_2a) / m;
  }

  that._context.bezierCurveTo(x1, y1, x2, y2, that._x2, that._y2);
}

function CatmullRom(context, alpha) {
  this._context = context;
  this._alpha = alpha;
}

CatmullRom.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x0 = this._x1 = this._x2 =
    this._y0 = this._y1 = this._y2 = NaN;
    this._l01_a = this._l12_a = this._l23_a =
    this._l01_2a = this._l12_2a = this._l23_2a =
    this._point = 0;
  },
  lineEnd: function() {
    switch (this._point) {
      case 2: this._context.lineTo(this._x2, this._y2); break;
      case 3: this.point(this._x2, this._y2); break;
    }
    if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x, y) {
    x = +x, y = +y;

    if (this._point) {
      var x23 = this._x2 - x,
          y23 = this._y2 - y;
      this._l23_a = Math.sqrt(this._l23_2a = Math.pow(x23 * x23 + y23 * y23, this._alpha));
    }

    switch (this._point) {
      case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
      case 1: this._point = 2; break;
      case 2: this._point = 3; // proceed
      default: point$2(this, x, y); break;
    }

    this._l01_a = this._l12_a, this._l12_a = this._l23_a;
    this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a;
    this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
    this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
  }
};

var curveCatmullRom = (function custom(alpha) {

  function catmullRom(context) {
    return alpha ? new CatmullRom(context, alpha) : new Cardinal(context, 0);
  }

  catmullRom.alpha = function(alpha) {
    return custom(+alpha);
  };

  return catmullRom;
})(0.5);

function CatmullRomClosed(context, alpha) {
  this._context = context;
  this._alpha = alpha;
}

CatmullRomClosed.prototype = {
  areaStart: noop$2,
  areaEnd: noop$2,
  lineStart: function() {
    this._x0 = this._x1 = this._x2 = this._x3 = this._x4 = this._x5 =
    this._y0 = this._y1 = this._y2 = this._y3 = this._y4 = this._y5 = NaN;
    this._l01_a = this._l12_a = this._l23_a =
    this._l01_2a = this._l12_2a = this._l23_2a =
    this._point = 0;
  },
  lineEnd: function() {
    switch (this._point) {
      case 1: {
        this._context.moveTo(this._x3, this._y3);
        this._context.closePath();
        break;
      }
      case 2: {
        this._context.lineTo(this._x3, this._y3);
        this._context.closePath();
        break;
      }
      case 3: {
        this.point(this._x3, this._y3);
        this.point(this._x4, this._y4);
        this.point(this._x5, this._y5);
        break;
      }
    }
  },
  point: function(x, y) {
    x = +x, y = +y;

    if (this._point) {
      var x23 = this._x2 - x,
          y23 = this._y2 - y;
      this._l23_a = Math.sqrt(this._l23_2a = Math.pow(x23 * x23 + y23 * y23, this._alpha));
    }

    switch (this._point) {
      case 0: this._point = 1; this._x3 = x, this._y3 = y; break;
      case 1: this._point = 2; this._context.moveTo(this._x4 = x, this._y4 = y); break;
      case 2: this._point = 3; this._x5 = x, this._y5 = y; break;
      default: point$2(this, x, y); break;
    }

    this._l01_a = this._l12_a, this._l12_a = this._l23_a;
    this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a;
    this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
    this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
  }
};

(function custom(alpha) {

  function catmullRom(context) {
    return alpha ? new CatmullRomClosed(context, alpha) : new CardinalClosed(context, 0);
  }

  catmullRom.alpha = function(alpha) {
    return custom(+alpha);
  };

  return catmullRom;
})(0.5);

function CatmullRomOpen(context, alpha) {
  this._context = context;
  this._alpha = alpha;
}

CatmullRomOpen.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x0 = this._x1 = this._x2 =
    this._y0 = this._y1 = this._y2 = NaN;
    this._l01_a = this._l12_a = this._l23_a =
    this._l01_2a = this._l12_2a = this._l23_2a =
    this._point = 0;
  },
  lineEnd: function() {
    if (this._line || (this._line !== 0 && this._point === 3)) this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x, y) {
    x = +x, y = +y;

    if (this._point) {
      var x23 = this._x2 - x,
          y23 = this._y2 - y;
      this._l23_a = Math.sqrt(this._l23_2a = Math.pow(x23 * x23 + y23 * y23, this._alpha));
    }

    switch (this._point) {
      case 0: this._point = 1; break;
      case 1: this._point = 2; break;
      case 2: this._point = 3; this._line ? this._context.lineTo(this._x2, this._y2) : this._context.moveTo(this._x2, this._y2); break;
      case 3: this._point = 4; // proceed
      default: point$2(this, x, y); break;
    }

    this._l01_a = this._l12_a, this._l12_a = this._l23_a;
    this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a;
    this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
    this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
  }
};

(function custom(alpha) {

  function catmullRom(context) {
    return alpha ? new CatmullRomOpen(context, alpha) : new CardinalOpen(context, 0);
  }

  catmullRom.alpha = function(alpha) {
    return custom(+alpha);
  };

  return catmullRom;
})(0.5);

function sign(x) {
  return x < 0 ? -1 : 1;
}

// Calculate the slopes of the tangents (Hermite-type interpolation) based on
// the following paper: Steffen, M. 1990. A Simple Method for Monotonic
// Interpolation in One Dimension. Astronomy and Astrophysics, Vol. 239, NO.
// NOV(II), P. 443, 1990.
function slope3(that, x2, y2) {
  var h0 = that._x1 - that._x0,
      h1 = x2 - that._x1,
      s0 = (that._y1 - that._y0) / (h0 || h1 < 0 && -0),
      s1 = (y2 - that._y1) / (h1 || h0 < 0 && -0),
      p = (s0 * h1 + s1 * h0) / (h0 + h1);
  return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
}

// Calculate a one-sided slope.
function slope2(that, t) {
  var h = that._x1 - that._x0;
  return h ? (3 * (that._y1 - that._y0) / h - t) / 2 : t;
}

// According to https://en.wikipedia.org/wiki/Cubic_Hermite_spline#Representations
// "you can express cubic Hermite interpolation in terms of cubic Bézier curves
// with respect to the four values p0, p0 + m0 / 3, p1 - m1 / 3, p1".
function point$3(that, t0, t1) {
  var x0 = that._x0,
      y0 = that._y0,
      x1 = that._x1,
      y1 = that._y1,
      dx = (x1 - x0) / 3;
  that._context.bezierCurveTo(x0 + dx, y0 + dx * t0, x1 - dx, y1 - dx * t1, x1, y1);
}

function MonotoneX(context) {
  this._context = context;
}

MonotoneX.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x0 = this._x1 =
    this._y0 = this._y1 =
    this._t0 = NaN;
    this._point = 0;
  },
  lineEnd: function() {
    switch (this._point) {
      case 2: this._context.lineTo(this._x1, this._y1); break;
      case 3: point$3(this, this._t0, slope2(this, this._t0)); break;
    }
    if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x, y) {
    var t1 = NaN;

    x = +x, y = +y;
    if (x === this._x1 && y === this._y1) return; // Ignore coincident points.
    switch (this._point) {
      case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
      case 1: this._point = 2; break;
      case 2: this._point = 3; point$3(this, slope2(this, t1 = slope3(this, x, y)), t1); break;
      default: point$3(this, this._t0, t1 = slope3(this, x, y)); break;
    }

    this._x0 = this._x1, this._x1 = x;
    this._y0 = this._y1, this._y1 = y;
    this._t0 = t1;
  }
};

function MonotoneY(context) {
  this._context = new ReflectContext(context);
}

(MonotoneY.prototype = Object.create(MonotoneX.prototype)).point = function(x, y) {
  MonotoneX.prototype.point.call(this, y, x);
};

function ReflectContext(context) {
  this._context = context;
}

ReflectContext.prototype = {
  moveTo: function(x, y) { this._context.moveTo(y, x); },
  closePath: function() { this._context.closePath(); },
  lineTo: function(x, y) { this._context.lineTo(y, x); },
  bezierCurveTo: function(x1, y1, x2, y2, x, y) { this._context.bezierCurveTo(y1, x1, y2, x2, y, x); }
};

function monotoneX(context) {
  return new MonotoneX(context);
}

function monotoneY(context) {
  return new MonotoneY(context);
}

function Natural(context) {
  this._context = context;
}

Natural.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x = [];
    this._y = [];
  },
  lineEnd: function() {
    var x = this._x,
        y = this._y,
        n = x.length;

    if (n) {
      this._line ? this._context.lineTo(x[0], y[0]) : this._context.moveTo(x[0], y[0]);
      if (n === 2) {
        this._context.lineTo(x[1], y[1]);
      } else {
        var px = controlPoints(x),
            py = controlPoints(y);
        for (var i0 = 0, i1 = 1; i1 < n; ++i0, ++i1) {
          this._context.bezierCurveTo(px[0][i0], py[0][i0], px[1][i0], py[1][i0], x[i1], y[i1]);
        }
      }
    }

    if (this._line || (this._line !== 0 && n === 1)) this._context.closePath();
    this._line = 1 - this._line;
    this._x = this._y = null;
  },
  point: function(x, y) {
    this._x.push(+x);
    this._y.push(+y);
  }
};

// See https://www.particleincell.com/2012/bezier-splines/ for derivation.
function controlPoints(x) {
  var i,
      n = x.length - 1,
      m,
      a = new Array(n),
      b = new Array(n),
      r = new Array(n);
  a[0] = 0, b[0] = 2, r[0] = x[0] + 2 * x[1];
  for (i = 1; i < n - 1; ++i) a[i] = 1, b[i] = 4, r[i] = 4 * x[i] + 2 * x[i + 1];
  a[n - 1] = 2, b[n - 1] = 7, r[n - 1] = 8 * x[n - 1] + x[n];
  for (i = 1; i < n; ++i) m = a[i] / b[i - 1], b[i] -= m, r[i] -= m * r[i - 1];
  a[n - 1] = r[n - 1] / b[n - 1];
  for (i = n - 2; i >= 0; --i) a[i] = (r[i] - a[i + 1]) / b[i];
  b[n - 1] = (x[n] + a[n - 1]) / 2;
  for (i = 0; i < n - 1; ++i) b[i] = 2 * x[i + 1] - a[i + 1];
  return [a, b];
}

var curveNatural = function(context) {
  return new Natural(context);
};

function Step(context, t) {
  this._context = context;
  this._t = t;
}

Step.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x = this._y = NaN;
    this._point = 0;
  },
  lineEnd: function() {
    if (0 < this._t && this._t < 1 && this._point === 2) this._context.lineTo(this._x, this._y);
    if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
    if (this._line >= 0) this._t = 1 - this._t, this._line = 1 - this._line;
  },
  point: function(x, y) {
    x = +x, y = +y;
    switch (this._point) {
      case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
      case 1: this._point = 2; // proceed
      default: {
        if (this._t <= 0) {
          this._context.lineTo(this._x, y);
          this._context.lineTo(x, y);
        } else {
          var x1 = this._x * (1 - this._t) + x * this._t;
          this._context.lineTo(x1, this._y);
          this._context.lineTo(x1, y);
        }
        break;
      }
    }
    this._x = x, this._y = y;
  }
};

var curveStep = function(context) {
  return new Step(context, 0.5);
};

function stepBefore(context) {
  return new Step(context, 0);
}

function stepAfter(context) {
  return new Step(context, 1);
}

var slice = Array.prototype.slice;

var none = function(series, order) {
  if (!((n = series.length) > 1)) return;
  for (var i = 1, s0, s1 = series[order[0]], n, m = s1.length; i < n; ++i) {
    s0 = s1, s1 = series[order[i]];
    for (var j = 0; j < m; ++j) {
      s1[j][1] += s1[j][0] = isNaN(s0[j][1]) ? s0[j][0] : s0[j][1];
    }
  }
};

var none$1 = function(series) {
  var n = series.length, o = new Array(n);
  while (--n >= 0) o[n] = n;
  return o;
};

function stackValue(d, key) {
  return d[key];
}

function sum(series) {
  var s = 0, i = -1, n = series.length, v;
  while (++i < n) if (v = +series[i][1]) s += v;
  return s;
}

var lookup = {
  basis: { curve: curveBasis },
  bundle: {
    curve: curveBundle,
    tension: 'beta',
    value: 0.85
  },
  cardinal: {
    curve: curveCardinal,
    tension: 'tension',
    value: 0
  },
  catmullRom: {
    curve: curveCatmullRom,
    tension: 'alpha',
    value: 0.5
  },
  linear: { curve: curveLinear },
  monotone: {
    horizontal: monotoneY,
    vertical:   monotoneX
  },
  natural: { curve: curveNatural },
  step: { curve: curveStep },
  stepAfter: { curve: stepAfter },
  stepBefore: { curve: stepBefore }
};

function curves(type, orientation, tension) {
  var entry = lookup.hasOwnProperty(type) && lookup[type],
      curve = null;

  if (entry) {
    curve = entry.curve || entry[orientation || 'vertical'];
    if (entry.tension && tension != null) {
      curve = curve[entry.tension](tension);
    }
  }

  return curve;
}

// Path parsing and rendering code adapted from fabric.js -- Thanks!
var cmdlen = { m:2, l:2, h:1, v:1, c:6, s:4, q:4, t:2, a:7 };
var regexp = [/([MLHVCSQTAZmlhvcsqtaz])/g, /###/, /(\d)([-+])/g, /\s|,|###/];

var pathParse = function(pathstr) {
  var result = [],
      path,
      curr,
      chunks,
      parsed, param,
      cmd, len, i, j, n, m;

  // First, break path into command sequence
  path = pathstr
    .slice()
    .replace(regexp[0], '###$1')
    .split(regexp[1])
    .slice(1);

  // Next, parse each command in turn
  for (i=0, n=path.length; i<n; ++i) {
    curr = path[i];
    chunks = curr
      .slice(1)
      .trim()
      .replace(regexp[2],'$1###$2')
      .split(regexp[3]);
    cmd = curr.charAt(0);

    parsed = [cmd];
    for (j=0, m=chunks.length; j<m; ++j) {
      if ((param = +chunks[j]) === param) { // not NaN
        parsed.push(param);
      }
    }

    len = cmdlen[cmd.toLowerCase()];
    if (parsed.length-1 > len) {
      for (j=1, m=parsed.length; j<m; j+=len) {
        result.push([cmd].concat(parsed.slice(j, j+len)));
      }
    }
    else {
      result.push(parsed);
    }
  }

  return result;
};

var segmentCache = {};
var bezierCache = {};

var join = [].join;

// Copied from Inkscape svgtopdf, thanks!
function segments(x, y, rx, ry, large, sweep, rotateX, ox, oy) {
  var key = join.call(arguments);
  if (segmentCache[key]) {
    return segmentCache[key];
  }

  var th = rotateX * (Math.PI/180);
  var sin_th = Math.sin(th);
  var cos_th = Math.cos(th);
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  var px = cos_th * (ox - x) * 0.5 + sin_th * (oy - y) * 0.5;
  var py = cos_th * (oy - y) * 0.5 - sin_th * (ox - x) * 0.5;
  var pl = (px*px) / (rx*rx) + (py*py) / (ry*ry);
  if (pl > 1) {
    pl = Math.sqrt(pl);
    rx *= pl;
    ry *= pl;
  }

  var a00 = cos_th / rx;
  var a01 = sin_th / rx;
  var a10 = (-sin_th) / ry;
  var a11 = (cos_th) / ry;
  var x0 = a00 * ox + a01 * oy;
  var y0 = a10 * ox + a11 * oy;
  var x1 = a00 * x + a01 * y;
  var y1 = a10 * x + a11 * y;

  var d = (x1-x0) * (x1-x0) + (y1-y0) * (y1-y0);
  var sfactor_sq = 1 / d - 0.25;
  if (sfactor_sq < 0) sfactor_sq = 0;
  var sfactor = Math.sqrt(sfactor_sq);
  if (sweep == large) sfactor = -sfactor;
  var xc = 0.5 * (x0 + x1) - sfactor * (y1-y0);
  var yc = 0.5 * (y0 + y1) + sfactor * (x1-x0);

  var th0 = Math.atan2(y0-yc, x0-xc);
  var th1 = Math.atan2(y1-yc, x1-xc);

  var th_arc = th1-th0;
  if (th_arc < 0 && sweep === 1){
    th_arc += 2 * Math.PI;
  } else if (th_arc > 0 && sweep === 0) {
    th_arc -= 2 * Math.PI;
  }

  var segs = Math.ceil(Math.abs(th_arc / (Math.PI * 0.5 + 0.001)));
  var result = [];
  for (var i=0; i<segs; ++i) {
    var th2 = th0 + i * th_arc / segs;
    var th3 = th0 + (i+1) * th_arc / segs;
    result[i] = [xc, yc, th2, th3, rx, ry, sin_th, cos_th];
  }

  return (segmentCache[key] = result);
}

function bezier(params) {
  var key = join.call(params);
  if (bezierCache[key]) {
    return bezierCache[key];
  }

  var cx = params[0],
      cy = params[1],
      th0 = params[2],
      th1 = params[3],
      rx = params[4],
      ry = params[5],
      sin_th = params[6],
      cos_th = params[7];

  var a00 = cos_th * rx;
  var a01 = -sin_th * ry;
  var a10 = sin_th * rx;
  var a11 = cos_th * ry;

  var cos_th0 = Math.cos(th0);
  var sin_th0 = Math.sin(th0);
  var cos_th1 = Math.cos(th1);
  var sin_th1 = Math.sin(th1);

  var th_half = 0.5 * (th1 - th0);
  var sin_th_h2 = Math.sin(th_half * 0.5);
  var t = (8/3) * sin_th_h2 * sin_th_h2 / Math.sin(th_half);
  var x1 = cx + cos_th0 - t * sin_th0;
  var y1 = cy + sin_th0 + t * cos_th0;
  var x3 = cx + cos_th1;
  var y3 = cy + sin_th1;
  var x2 = x3 + t * sin_th1;
  var y2 = y3 - t * cos_th1;

  return (bezierCache[key] = [
    a00 * x1 + a01 * y1,  a10 * x1 + a11 * y1,
    a00 * x2 + a01 * y2,  a10 * x2 + a11 * y2,
    a00 * x3 + a01 * y3,  a10 * x3 + a11 * y3
  ]);
}

var temp = ['l', 0, 0, 0, 0, 0, 0, 0];

function scale(current, s) {
  var c = (temp[0] = current[0]);
  if (c === 'a' || c === 'A') {
    temp[1] = s * current[1];
    temp[2] = s * current[2];
    temp[6] = s * current[6];
    temp[7] = s * current[7];
  } else {
    for (var i=1, n=current.length; i<n; ++i) {
      temp[i] = s * current[i];
    }
  }
  return temp;
}

var pathRender = function(context, path, l, t, s) {
  var current, // current instruction
      previous = null,
      x = 0, // current x
      y = 0, // current y
      controlX = 0, // current control point x
      controlY = 0, // current control point y
      tempX,
      tempY,
      tempControlX,
      tempControlY;

  if (l == null) l = 0;
  if (t == null) t = 0;
  if (s == null) s = 1;

  if (context.beginPath) context.beginPath();

  for (var i=0, len=path.length; i<len; ++i) {
    current = path[i];
    if (s !== 1) current = scale(current, s);

    switch (current[0]) { // first letter

      case 'l': // lineto, relative
        x += current[1];
        y += current[2];
        context.lineTo(x + l, y + t);
        break;

      case 'L': // lineto, absolute
        x = current[1];
        y = current[2];
        context.lineTo(x + l, y + t);
        break;

      case 'h': // horizontal lineto, relative
        x += current[1];
        context.lineTo(x + l, y + t);
        break;

      case 'H': // horizontal lineto, absolute
        x = current[1];
        context.lineTo(x + l, y + t);
        break;

      case 'v': // vertical lineto, relative
        y += current[1];
        context.lineTo(x + l, y + t);
        break;

      case 'V': // verical lineto, absolute
        y = current[1];
        context.lineTo(x + l, y + t);
        break;

      case 'm': // moveTo, relative
        x += current[1];
        y += current[2];
        context.moveTo(x + l, y + t);
        break;

      case 'M': // moveTo, absolute
        x = current[1];
        y = current[2];
        context.moveTo(x + l, y + t);
        break;

      case 'c': // bezierCurveTo, relative
        tempX = x + current[5];
        tempY = y + current[6];
        controlX = x + current[3];
        controlY = y + current[4];
        context.bezierCurveTo(
          x + current[1] + l, // x1
          y + current[2] + t, // y1
          controlX + l, // x2
          controlY + t, // y2
          tempX + l,
          tempY + t
        );
        x = tempX;
        y = tempY;
        break;

      case 'C': // bezierCurveTo, absolute
        x = current[5];
        y = current[6];
        controlX = current[3];
        controlY = current[4];
        context.bezierCurveTo(
          current[1] + l,
          current[2] + t,
          controlX + l,
          controlY + t,
          x + l,
          y + t
        );
        break;

      case 's': // shorthand cubic bezierCurveTo, relative
        // transform to absolute x,y
        tempX = x + current[3];
        tempY = y + current[4];
        // calculate reflection of previous control points
        controlX = 2 * x - controlX;
        controlY = 2 * y - controlY;
        context.bezierCurveTo(
          controlX + l,
          controlY + t,
          x + current[1] + l,
          y + current[2] + t,
          tempX + l,
          tempY + t
        );

        // set control point to 2nd one of this command
        // the first control point is assumed to be the reflection of
        // the second control point on the previous command relative
        // to the current point.
        controlX = x + current[1];
        controlY = y + current[2];

        x = tempX;
        y = tempY;
        break;

      case 'S': // shorthand cubic bezierCurveTo, absolute
        tempX = current[3];
        tempY = current[4];
        // calculate reflection of previous control points
        controlX = 2*x - controlX;
        controlY = 2*y - controlY;
        context.bezierCurveTo(
          controlX + l,
          controlY + t,
          current[1] + l,
          current[2] + t,
          tempX + l,
          tempY + t
        );
        x = tempX;
        y = tempY;
        // set control point to 2nd one of this command
        // the first control point is assumed to be the reflection of
        // the second control point on the previous command relative
        // to the current point.
        controlX = current[1];
        controlY = current[2];

        break;

      case 'q': // quadraticCurveTo, relative
        // transform to absolute x,y
        tempX = x + current[3];
        tempY = y + current[4];

        controlX = x + current[1];
        controlY = y + current[2];

        context.quadraticCurveTo(
          controlX + l,
          controlY + t,
          tempX + l,
          tempY + t
        );
        x = tempX;
        y = tempY;
        break;

      case 'Q': // quadraticCurveTo, absolute
        tempX = current[3];
        tempY = current[4];

        context.quadraticCurveTo(
          current[1] + l,
          current[2] + t,
          tempX + l,
          tempY + t
        );
        x = tempX;
        y = tempY;
        controlX = current[1];
        controlY = current[2];
        break;

      case 't': // shorthand quadraticCurveTo, relative

        // transform to absolute x,y
        tempX = x + current[1];
        tempY = y + current[2];

        if (previous[0].match(/[QqTt]/) === null) {
          // If there is no previous command or if the previous command was not a Q, q, T or t,
          // assume the control point is coincident with the current point
          controlX = x;
          controlY = y;
        }
        else if (previous[0] === 't') {
          // calculate reflection of previous control points for t
          controlX = 2 * x - tempControlX;
          controlY = 2 * y - tempControlY;
        }
        else if (previous[0] === 'q') {
          // calculate reflection of previous control points for q
          controlX = 2 * x - controlX;
          controlY = 2 * y - controlY;
        }

        tempControlX = controlX;
        tempControlY = controlY;

        context.quadraticCurveTo(
          controlX + l,
          controlY + t,
          tempX + l,
          tempY + t
        );
        x = tempX;
        y = tempY;
        controlX = x + current[1];
        controlY = y + current[2];
        break;

      case 'T':
        tempX = current[1];
        tempY = current[2];

        // calculate reflection of previous control points
        controlX = 2 * x - controlX;
        controlY = 2 * y - controlY;
        context.quadraticCurveTo(
          controlX + l,
          controlY + t,
          tempX + l,
          tempY + t
        );
        x = tempX;
        y = tempY;
        break;

      case 'a':
        drawArc(context, x + l, y + t, [
          current[1],
          current[2],
          current[3],
          current[4],
          current[5],
          current[6] + x + l,
          current[7] + y + t
        ]);
        x += current[6];
        y += current[7];
        break;

      case 'A':
        drawArc(context, x + l, y + t, [
          current[1],
          current[2],
          current[3],
          current[4],
          current[5],
          current[6] + l,
          current[7] + t
        ]);
        x = current[6];
        y = current[7];
        break;

      case 'z':
      case 'Z':
        context.closePath();
        break;
    }
    previous = current;
  }
};

function drawArc(context, x, y, coords) {
  var seg = segments(
    coords[5], // end x
    coords[6], // end y
    coords[0], // radius x
    coords[1], // radius y
    coords[3], // large flag
    coords[4], // sweep flag
    coords[2], // rotation
    x, y
  );
  for (var i=0; i<seg.length; ++i) {
    var bez = bezier(seg[i]);
    context.bezierCurveTo(bez[0], bez[1], bez[2], bez[3], bez[4], bez[5]);
  }
}

var tau$2 = 2 * Math.PI;
var halfSqrt3 = Math.sqrt(3) / 2;

var builtins = {
  'circle': {
    draw: function(context, size) {
      var r = Math.sqrt(size) / 2;
      context.moveTo(r, 0);
      context.arc(0, 0, r, 0, tau$2);
    }
  },
  'cross': {
    draw: function(context, size) {
      var r = Math.sqrt(size) / 2,
          s = r / 2.5;
      context.moveTo(-r, -s);
      context.lineTo(-r, s);
      context.lineTo(-s, s);
      context.lineTo(-s, r);
      context.lineTo(s, r);
      context.lineTo(s, s);
      context.lineTo(r, s);
      context.lineTo(r, -s);
      context.lineTo(s, -s);
      context.lineTo(s, -r);
      context.lineTo(-s, -r);
      context.lineTo(-s, -s);
      context.closePath();
    }
  },
  'diamond': {
    draw: function(context, size) {
      var r = Math.sqrt(size) / 2;
      context.moveTo(-r, 0);
      context.lineTo(0, -r);
      context.lineTo(r, 0);
      context.lineTo(0, r);
      context.closePath();
    }
  },
  'square': {
    draw: function(context, size) {
      var w = Math.sqrt(size),
          x = -w / 2;
      context.rect(x, x, w, w);
    }
  },
  'triangle-up': {
    draw: function(context, size) {
      var r = Math.sqrt(size) / 2,
          h = halfSqrt3 * r;
      context.moveTo(0, -h);
      context.lineTo(-r, h);
      context.lineTo(r, h);
      context.closePath();
    }
  },
  'triangle-down': {
    draw: function(context, size) {
      var r = Math.sqrt(size) / 2,
          h = halfSqrt3 * r;
      context.moveTo(0, h);
      context.lineTo(-r, -h);
      context.lineTo(r, -h);
      context.closePath();
    }
  },
  'triangle-right': {
    draw: function(context, size) {
      var r = Math.sqrt(size) / 2,
          h = halfSqrt3 * r;
      context.moveTo(h, 0);
      context.lineTo(-h, -r);
      context.lineTo(-h, r);
      context.closePath();
    }
  },
  'triangle-left': {
    draw: function(context, size) {
      var r = Math.sqrt(size) / 2,
          h = halfSqrt3 * r;
      context.moveTo(-h, 0);
      context.lineTo(h, -r);
      context.lineTo(h, r);
      context.closePath();
    }
  }
};

function symbols$1(_) {
  return builtins.hasOwnProperty(_) ? builtins[_] : customSymbol(_);
}

var custom$1 = {};

function customSymbol(path) {
  if (!custom$1.hasOwnProperty(path)) {
    var parsed = pathParse(path);
    custom$1[path] = {
      draw: function(context, size) {
        pathRender(context, parsed, 0, 0, Math.sqrt(size));
      }
    };
  }
  return custom$1[path];
}

function rectangleX(d) {
  return d.x;
}

function rectangleY(d) {
  return d.y;
}

function rectangleWidth(d) {
  return d.width;
}

function rectangleHeight(d) {
  return d.height;
}

function constant$3(_) {
  return function() { return _; };
}

var pathRectangle = function() {
  var x = rectangleX,
      y = rectangleY,
      width = rectangleWidth,
      height = rectangleHeight,
      cornerRadius = constant$3(0),
      context = null;

  function rectangle(_, x0, y0) {
    var buffer,
        x1 = x0 != null ? x0 : +x.call(this, _),
        y1 = y0 != null ? y0 : +y.call(this, _),
        w  = +width.call(this, _),
        h  = +height.call(this, _),
        cr = +cornerRadius.call(this, _);

    if (!context) context = buffer = path();

    if (cr <= 0) {
      context.rect(x1, y1, w, h);
    } else {
      var x2 = x1 + w,
          y2 = y1 + h;
      context.moveTo(x1 + cr, y1);
      context.lineTo(x2 - cr, y1);
      context.quadraticCurveTo(x2, y1, x2, y1 + cr);
      context.lineTo(x2, y2 - cr);
      context.quadraticCurveTo(x2, y2, x2 - cr, y2);
      context.lineTo(x1 + cr, y2);
      context.quadraticCurveTo(x1, y2, x1, y2 - cr);
      context.lineTo(x1, y1 + cr);
      context.quadraticCurveTo(x1, y1, x1 + cr, y1);
      context.closePath();
    }

    if (buffer) return context = null, buffer + '' || null;
  }

  rectangle.x = function(_) {
    return arguments.length ? (x = typeof _ === 'function' ? _ : constant$3(+_), rectangle) : x;
  };

  rectangle.y = function(_) {
    return arguments.length ? (y = typeof _ === 'function' ? _ : constant$3(+_), rectangle) : y;
  };

  rectangle.width = function(_) {
    return arguments.length ? (width = typeof _ === 'function' ? _ : constant$3(+_), rectangle) : width;
  };

  rectangle.height = function(_) {
    return arguments.length ? (height = typeof _ === 'function' ? _ : constant$3(+_), rectangle) : height;
  };

  rectangle.cornerRadius = function(_) {
    return arguments.length ? (cornerRadius = typeof _ === 'function' ? _ : constant$3(+_), rectangle) : cornerRadius;
  };

  rectangle.context = function(_) {
    return arguments.length ? (context = _ == null ? null : _, rectangle) : context;
  };

  return rectangle;
};

var pi$2 = Math.PI;

var pathTrail = function() {
  var x,
      y,
      size,
      defined,
      context = null,
      ready, x1, y1, r1;

  function point(x2, y2, w2) {
    var r2 = w2 / 2;

    if (ready) {
      // get normal vector
      var ux = y1 - y2,
          uy = x2 - x1,
          ud = Math.sqrt(ux * ux + uy * uy),
          rx = (ux /= ud) * r1,
          ry = (uy /= ud) * r1,
          t = Math.atan2(uy, ux);

      // draw segment
      context.moveTo(x1 - rx, y1 - ry);
      context.lineTo(x2 - ux * r2, y2 - uy * r2);
      context.arc(x2, y2, r2, t - pi$2, t);
      context.lineTo(x1 + rx, y1 + ry);
      context.arc(x1, y1, r1, t, t + pi$2);
      context.closePath();
    } else {
      ready = 1;
    }
    x1 = x2, y1 = y2, r1 = r2;
  }

  function trail(data) {
    var i,
        n = data.length,
        d,
        defined0 = false,
        buffer;

    if (context == null) context = buffer = path();

    for (i = 0; i <= n; ++i) {
      if (!(i < n && defined(d = data[i], i, data)) === defined0) {
        if (defined0 = !defined0) ready = 0;
      }
      if (defined0) point(+x(d, i, data), +y(d, i, data), +size(d, i, data));
    }

    if (buffer) return context = null, buffer + '' || null;
  }

  trail.x = function(_) {
    return arguments.length ? (x = _, trail) : x;
  };

  trail.y = function(_) {
    return arguments.length ? (y = _, trail) : y;
  };

  trail.size = function(_) {
    return arguments.length ? (size = _, trail) : size;
  };

  trail.defined = function(_) {
    return arguments.length ? (defined = _, trail) : defined;
  };

  trail.context = function(_) {
    return arguments.length ? (_ == null ? context = null : context = _, trail) : context;
  };

  return trail;
};

function x(item)     { return item.x || 0; }
function y(item)     { return item.y || 0; }
function w(item)     { return item.width || 0; }
function wh(item)    { return item.width || item.height || 1; }
function h(item)     { return item.height || 0; }
function xw(item)    { return (item.x || 0) + (item.width || 0); }
function yh(item)    { return (item.y || 0) + (item.height || 0); }
function cr(item)    { return item.cornerRadius || 0; }
function pa(item)    { return item.padAngle || 0; }
function def(item)   { return !(item.defined === false); }
function size(item)  { return item.size == null ? 64 : item.size; }
function type$1(item) { return symbols$1(item.shape || 'circle'); }

var arcShape    = d3_arc().cornerRadius(cr).padAngle(pa);
var areavShape  = d3_area().x(x).y1(y).y0(yh).defined(def);
var areahShape  = d3_area().y(y).x1(x).x0(xw).defined(def);
var lineShape   = d3_line().x(x).y(y).defined(def);
var trailShape  = pathTrail().x(x).y(y).defined(def).size(wh);
var rectShape   = pathRectangle().x(x).y(y).width(w).height(h).cornerRadius(cr);
var symbolShape = d3_symbol().type(type$1).size(size);

function arc$1(context, item) {
  return arcShape.context(context)(item);
}

function area$$1(context, items) {
  var item = items[0],
      interp = item.interpolate || 'linear';
  return (interp === 'trail' ? trailShape
    : (item.orient === 'horizontal' ? areahShape : areavShape)
        .curve(curves(interp, item.orient, item.tension))
  ).context(context)(items);
}

function shape(context, item) {
  return (item.mark.shape || item.shape)
    .context(context)(item);
}

function line$$1(context, items) {
  var item = items[0],
      interp = item.interpolate || 'linear';
  return lineShape.curve(curves(interp, item.orient, item.tension))
    .context(context)(items);
}

function rectangle(context, item, x, y) {
  return rectShape.context(context)(item, x, y);
}

function symbol$$1(context, item) {
  return symbolShape.context(context)(item);
}

var boundStroke = function(bounds, item) {
  if (item.stroke && item.opacity !== 0 && item.stokeOpacity !== 0) {
    bounds.expand(item.strokeWidth != null ? +item.strokeWidth : 1);
  }
  return bounds;
};

var bounds;
var tau$3 = Math.PI * 2;
var halfPi$1 = Math.PI / 2;

function context(_) {
  return bounds = _, context;
}

function noop$3() {}

function add(x, y) { bounds.add(x, y); }

context.beginPath = noop$3;

context.closePath = noop$3;

context.moveTo = add;

context.lineTo = add;

context.rect = function(x, y, w, h) {
  add(x, y);
  add(x + w, y + h);
};

context.quadraticCurveTo = function(x1, y1, x2, y2) {
  add(x1, y1);
  add(x2, y2);
};

context.bezierCurveTo = function(x1, y1, x2, y2, x3, y3) {
  add(x1, y1);
  add(x2, y2);
  add(x3, y3);
};

context.arc = function(cx, cy, r, sa, ea, ccw) {
  if (r === tau$3) {
    add(cx - r, cy - r);
    add(cx + r, cy + r);
    return;
  }

  var xmin = Infinity, xmax = -Infinity,
      ymin = Infinity, ymax = -Infinity,
      s, i, x, y;

  function update(a) {
    x = r * Math.cos(a);
    y = r * Math.sin(a);
    if (x < xmin) xmin = x;
    if (x > xmax) xmax = x;
    if (y < ymin) ymin = y;
    if (y > ymax) ymax = y;
  }

  update(sa);
  update(ea);
  if (ccw) {
    s = ea - (ea % halfPi$1);
    for (i=0; i<4 && s>sa; ++i, s-=halfPi$1) update(s);
  } else {
    s = sa - (sa % halfPi$1);
    for (i=0; i<4 && s<ea; ++i, s+=halfPi$1) update(s);
  }

  add(cx + xmin, cy + ymin);
  add(cx + xmax, cy + ymax);
};

var gradient = function(context, gradient, bounds) {
  var w = bounds.width(),
      h = bounds.height(),
      x1 = bounds.x1 + gradient.x1 * w,
      y1 = bounds.y1 + gradient.y1 * h,
      x2 = bounds.x1 + gradient.x2 * w,
      y2 = bounds.y1 + gradient.y2 * h,
      stop = gradient.stops,
      i = 0,
      n = stop.length,
      linearGradient = context.createLinearGradient(x1, y1, x2, y2);

  for (; i<n; ++i) {
    linearGradient.addColorStop(stop[i].offset, stop[i].color);
  }

  return linearGradient;
};

var color = function(context, item, value) {
  return (value.id) ?
    gradient(context, value, item.bounds) :
    value;
};

var fill = function(context, item, opacity) {
  opacity *= (item.fillOpacity==null ? 1 : item.fillOpacity);
  if (opacity > 0) {
    context.globalAlpha = opacity;
    context.fillStyle = color(context, item, item.fill);
    return true;
  } else {
    return false;
  }
};

var Empty = [];

var stroke = function(context, item, opacity) {
  var lw = (lw = item.strokeWidth) != null ? lw : 1, lc;
  if (lw <= 0) return false;

  opacity *= (item.strokeOpacity==null ? 1 : item.strokeOpacity);
  if (opacity > 0) {
    context.globalAlpha = opacity;
    context.strokeStyle = color(context, item, item.stroke);
    context.lineWidth = lw;
    context.lineCap = (lc = item.strokeCap) != null ? lc : 'butt';
    if (context.setLineDash) {
      context.setLineDash(item.strokeDash || Empty);
      context.lineDashOffset = item.strokeDashOffset || 0;
    }
    return true;
  } else {
    return false;
  }
};

function compare$1(a, b) {
  return a.zindex - b.zindex || a.index - b.index;
}

function zorder(scene) {
  if (!scene.zdirty) return scene.zitems;

  var items = scene.items,
      output = [], item, i, n;

  for (i=0, n=items.length; i<n; ++i) {
    item = items[i];
    item.index = i;
    if (item.zindex) output.push(item);
  }

  scene.zdirty = false;
  return scene.zitems = output.sort(compare$1);
}

function visit(scene, visitor) {
  var items = scene.items, i, n;
  if (!items || !items.length) return;

  var zitems = zorder(scene);

  if (zitems && zitems.length) {
    for (i=0, n=items.length; i<n; ++i) {
      if (!items[i].zindex) visitor(items[i]);
    }
    items = zitems;
  }

  for (i=0, n=items.length; i<n; ++i) {
    visitor(items[i]);
  }
}

function pickVisit(scene, visitor) {
  var items = scene.items, hit, i;
  if (!items || !items.length) return null;

  var zitems = zorder(scene);
  if (zitems && zitems.length) items = zitems;

  for (i=items.length; --i >= 0;) {
    if (hit = visitor(items[i])) return hit;
  }

  if (items === zitems) {
    for (items=scene.items, i=items.length; --i >= 0;) {
      if (!items[i].zindex) {
        if (hit = visitor(items[i])) return hit;
      }
    }
  }

  return null;
}

function drawAll(path) {
  return function(context, scene, bounds) {
    visit(scene, function(item) {
      if (!bounds || bounds.intersects(item.bounds)) {
        drawPath(path, context, item, item);
      }
    });
  };
}

function drawOne(path) {
  return function(context, scene, bounds) {
    if (scene.items.length && (!bounds || bounds.intersects(scene.bounds))) {
      drawPath(path, context, scene.items[0], scene.items);
    }
  };
}

function drawPath(path, context, item, items) {
  var opacity = item.opacity == null ? 1 : item.opacity;
  if (opacity === 0) return;

  if (path(context, items)) return;

  if (item.fill && fill(context, item, opacity)) {
    context.fill();
  }

  if (item.stroke && stroke(context, item, opacity)) {
    context.stroke();
  }
}

var trueFunc = function() { return true; };

function pick(test) {
  if (!test) test = trueFunc;

  return function(context, scene, x, y, gx, gy) {
    if (context.pixelRatio > 1) {
      x *= context.pixelRatio;
      y *= context.pixelRatio;
    }

    return pickVisit(scene, function(item) {
      var b = item.bounds;
      // first hit test against bounding box
      if ((b && !b.contains(gx, gy)) || !b) return;
      // if in bounding box, perform more careful test
      if (test(context, item, x, y, gx, gy)) return item;
    });
  };
}

function hitPath(path, filled) {
  return function(context, o, x, y) {
    var item = Array.isArray(o) ? o[0] : o,
        fill = (filled == null) ? item.fill : filled,
        stroke = item.stroke && context.isPointInStroke, lw, lc;

    if (stroke) {
      lw = item.strokeWidth;
      lc = item.strokeCap;
      context.lineWidth = lw != null ? lw : 1;
      context.lineCap   = lc != null ? lc : 'butt';
    }

    return path(context, o) ? false :
      (fill && context.isPointInPath(x, y)) ||
      (stroke && context.isPointInStroke(x, y));
  };
}

function pickPath(path) {
  return pick(hitPath(path));
}

var translate = function(x, y) {
  return 'translate(' + x + ',' + y + ')';
};

var translateItem = function(item) {
  return translate(item.x || 0, item.y || 0);
};

var markItemPath = function(type, shape) {

  function attr(emit, item) {
    emit('transform', translateItem(item));
    emit('d', shape(null, item));
  }

  function bound(bounds, item) {
    shape(context(bounds), item);
    return boundStroke(bounds, item)
      .translate(item.x || 0, item.y || 0);
  }

  function draw(context$$1, item) {
    var x = item.x || 0,
        y = item.y || 0;
    context$$1.translate(x, y);
    context$$1.beginPath();
    shape(context$$1, item);
    context$$1.translate(-x, -y);
  }

  return {
    type:   type,
    tag:    'path',
    nested: false,
    attr:   attr,
    bound:  bound,
    draw:   drawAll(draw),
    pick:   pickPath(draw)
  };

};

var arc$$1 = markItemPath('arc', arc$1);

var markMultiItemPath = function(type, shape) {

  function attr(emit, item) {
    var items = item.mark.items;
    if (items.length) emit('d', shape(null, items));
  }

  function bound(bounds, mark) {
    var items = mark.items;
    return items.length === 0 ? bounds
      : (shape(context(bounds), items), boundStroke(bounds, items[0]));
  }

  function draw(context$$1, items) {
    context$$1.beginPath();
    shape(context$$1, items);
  }

  var hit = hitPath(draw);

  function pick$$1(context$$1, scene, x, y, gx, gy) {
    var items = scene.items,
        b = scene.bounds;

    if (!items || !items.length || b && !b.contains(gx, gy)) {
      return null;
    }

    if (context$$1.pixelRatio > 1) {
      x *= context$$1.pixelRatio;
      y *= context$$1.pixelRatio;
    }
    return hit(context$$1, items, x, y) ? items[0] : null;
  }

  return {
    type:   type,
    tag:    'path',
    nested: true,
    attr:   attr,
    bound:  bound,
    draw:   drawOne(draw),
    pick:   pick$$1
  };

};

var area$1 = markMultiItemPath('area', area$$1);

function attr(emit, item, renderer) {
  var id = null, defs, c;

  emit('transform', translateItem(item));

  if (item.clip) {
    defs = renderer._defs;
    id = item.clip_id || (item.clip_id = 'clip' + defs.clip_id++);
    c = defs.clipping[id] || (defs.clipping[id] = {id: id});
    c.width = item.width || 0;
    c.height = item.height || 0;
  }

  emit('clip-path', id ? ('url(#' + id + ')') : null);
}

function background(emit, item) {
  var offset = item.stroke ? 0.5 : 0;
  emit('class', 'background');
  emit('d', rectangle(null, item, offset, offset));
}

function bound(bounds, group) {
  if (!group.clip && group.items) {
    var items = group.items;
    for (var j=0, m=items.length; j<m; ++j) {
      bounds.union(items[j].bounds);
    }
  }

  if (group.clip || group.width || group.height) {
    boundStroke(
      bounds.add(0, 0).add(group.width || 0, group.height || 0),
      group
    );
  }

  return bounds.translate(group.x || 0, group.y || 0);
}

function draw(context, scene, bounds) {
  var renderer = this;

  visit(scene, function(group) {
    var gx = group.x || 0,
        gy = group.y || 0,
        w = group.width || 0,
        h = group.height || 0,
        offset, opacity;

    // setup graphics context
    context.save();
    context.translate(gx, gy);

    // draw group background
    if (group.stroke || group.fill) {
      opacity = group.opacity == null ? 1 : group.opacity;
      if (opacity > 0) {
        context.beginPath();
        offset = group.stroke ? 0.5 : 0;
        rectangle(context, group, offset, offset);
        if (group.fill && fill(context, group, opacity)) {
          context.fill();
        }
        if (group.stroke && stroke(context, group, opacity)) {
          context.stroke();
        }
      }
    }

    // set clip and bounds
    if (group.clip) {
      context.beginPath();
      context.rect(0, 0, w, h);
      context.clip();
    }
    if (bounds) bounds.translate(-gx, -gy);

    // draw group contents
    visit(group, function(item) {
      renderer.draw(context, item, bounds);
    });

    // restore graphics context
    if (bounds) bounds.translate(gx, gy);
    context.restore();
  });
}

function pick$1(context, scene, x, y, gx, gy) {
  if (scene.bounds && !scene.bounds.contains(gx, gy) || !scene.items) {
    return null;
  }

  var handler = this;

  return pickVisit(scene, function(group) {
    var hit, dx, dy, b;

    // first hit test against bounding box
    // if a group is clipped, that should be handled by the bounds check.
    b = group.bounds;
    if (b && !b.contains(gx, gy)) return;

    // passed bounds check, so test sub-groups
    dx = (group.x || 0);
    dy = (group.y || 0);

    context.save();
    context.translate(dx, dy);

    dx = gx - dx;
    dy = gy - dy;

    hit = pickVisit(group, function(mark) {
      return (mark.interactive !== false || mark.marktype === 'group')
        ? handler.pick(mark, x, y, dx, dy)
        : null;
    });

    context.restore();
    if (hit) return hit;

    hit = scene.interactive !== false
      && (group.fill || group.stroke)
      && dx >= 0
      && dx <= group.width
      && dy >= 0
      && dy <= group.height;

    return hit ? group : null;
  });
}

var group = {
  type:       'group',
  tag:        'g',
  nested:     false,
  attr:       attr,
  bound:      bound,
  draw:       draw,
  pick:       pick$1,
  background: background
};

function getImage(item, renderer) {
  var image = item.image;
  if (!image || image.url !== item.url) {
    image = {loaded: false, width: 0, height: 0};
    renderer.loadImage(item.url).then(function(image) {
      item.image = image;
      item.image.url = item.url;
    });
  }
  return image;
}

function imageXOffset(align, w) {
  return align === 'center' ? w / 2 : align === 'right' ? w : 0;
}

function imageYOffset(baseline, h) {
  return baseline === 'middle' ? h / 2 : baseline === 'bottom' ? h : 0;
}

function attr$1(emit, item, renderer) {
  var image = getImage(item, renderer),
      x = item.x || 0,
      y = item.y || 0,
      w = item.width || image.width || 0,
      h = item.height || image.height || 0;

  x -= imageXOffset(item.align, w);
  y -= imageYOffset(item.baseline, h);

  emit('href', image.src || '', 'http://www.w3.org/1999/xlink', 'xlink:href');
  emit('transform', translate(x, y));
  emit('width', w);
  emit('height', h);
}

function bound$1(bounds, item) {
  var image = item.image,
      x = item.x || 0,
      y = item.y || 0,
      w = item.width || (image && image.width) || 0,
      h = item.height || (image && image.height) || 0;

  x -= imageXOffset(item.align, w);
  y -= imageYOffset(item.baseline, h);

  return bounds.set(x, y, x + w, y + h);
}

function draw$1(context, scene, bounds) {
  var renderer = this;

  visit(scene, function(item) {
    if (bounds && !bounds.intersects(item.bounds)) return; // bounds check

    var image = getImage(item, renderer),
        x = item.x || 0,
        y = item.y || 0,
        w = item.width || image.width || 0,
        h = item.height || image.height || 0,
        opacity;

    x -= imageXOffset(item.align, w);
    y -= imageYOffset(item.baseline, h);

    if (image.loaded) {
      context.globalAlpha = (opacity = item.opacity) != null ? opacity : 1;
      context.drawImage(image, x, y, w, h);
    }
  });
}

var image = {
  type:   'image',
  tag:    'image',
  nested: false,
  attr:   attr$1,
  bound:  bound$1,
  draw:   draw$1,
  pick:   pick()
};

var line$1 = markMultiItemPath('line', line$$1);

function attr$2(emit, item) {
  emit('transform', translateItem(item));
  emit('d', item.path);
}

function path$2(context$$1, item) {
  var path = item.path;
  if (path == null) return true;

  var cache = item.pathCache;
  if (!cache || cache.path !== path) {
    (item.pathCache = cache = pathParse(path)).path = path;
  }
  pathRender(context$$1, cache, item.x, item.y);
}

function bound$2(bounds, item) {
  return path$2(context(bounds), item)
    ? bounds.set(0, 0, 0, 0)
    : boundStroke(bounds, item);
}

var path$3 = {
  type:   'path',
  tag:    'path',
  nested: false,
  attr:   attr$2,
  bound:  bound$2,
  draw:   drawAll(path$2),
  pick:   pickPath(path$2)
};

function attr$3(emit, item) {
  emit('d', rectangle(null, item));
}

function bound$3(bounds, item) {
  var x, y;
  return boundStroke(bounds.set(
    x = item.x || 0,
    y = item.y || 0,
    (x + item.width) || 0,
    (y + item.height) || 0
  ), item);
}

function draw$2(context, item) {
  context.beginPath();
  rectangle(context, item);
}

var rect = {
  type:   'rect',
  tag:    'path',
  nested: false,
  attr:   attr$3,
  bound:  bound$3,
  draw:   drawAll(draw$2),
  pick:   pickPath(draw$2)
};

function attr$4(emit, item) {
  emit('transform', translateItem(item));
  emit('x2', item.x2 != null ? item.x2 - (item.x||0) : 0);
  emit('y2', item.y2 != null ? item.y2 - (item.y||0) : 0);
}

function bound$4(bounds, item) {
  var x1, y1;
  return boundStroke(bounds.set(
    x1 = item.x || 0,
    y1 = item.y || 0,
    item.x2 != null ? item.x2 : x1,
    item.y2 != null ? item.y2 : y1
  ), item);
}

function path$4(context, item, opacity) {
  var x1, y1, x2, y2;

  if (item.stroke && stroke(context, item, opacity)) {
    x1 = item.x || 0;
    y1 = item.y || 0;
    x2 = item.x2 != null ? item.x2 : x1;
    y2 = item.y2 != null ? item.y2 : y1;
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    return true;
  }
  return false;
}

function draw$3(context, scene, bounds) {
  visit(scene, function(item) {
    if (bounds && !bounds.intersects(item.bounds)) return; // bounds check
    var opacity = item.opacity == null ? 1 : item.opacity;
    if (opacity && path$4(context, item, opacity)) {
      context.stroke();
    }
  });
}

function hit(context, item, x, y) {
  if (!context.isPointInStroke) return false;
  return path$4(context, item, 1) && context.isPointInStroke(x, y);
}

var rule = {
  type:   'rule',
  tag:    'line',
  nested: false,
  attr:   attr$4,
  bound:  bound$4,
  draw:   draw$3,
  pick:   pick(hit)
};

var shape$1 = markItemPath('shape', shape);

var symbol$1 = markItemPath('symbol', symbol$$1);

var context$1;

function estimateWidth(item) {
  // make dumb, simple estimate if no canvas is available
  return ~~(0.8 * textValue(item).length * height(item));
}

function measureWidth(item) {
  // measure text width if canvas is available
  context$1.font = font(item);
  return context$1.measureText(textValue(item.text)).width;
}

var width = (context$1 = Canvas$1(1, 1))
  ? (context$1 = context$1.getContext('2d'), measureWidth)
  : estimateWidth;

function height(item) {
  return item.fontSize != null ? item.fontSize : 11;
}

function textValue(s) {
  return s != null ? String(s) : '';
}

function font(item, quote) {
  var font = item.font;
  if (quote && font) {
    font = String(font).replace(/\"/g, '\'');
  }
  return '' +
    (item.fontStyle ? item.fontStyle + ' ' : '') +
    (item.fontVariant ? item.fontVariant + ' ' : '') +
    (item.fontWeight ? item.fontWeight + ' ' : '') +
    height(item) + 'px ' +
    (font || 'sans-serif');
}

function offset(item) {
  // perform our own font baseline calculation
  // why? not all browsers support SVG 1.1 'alignment-baseline' :(
  var baseline = item.baseline,
      h = height(item);
  return Math.round(
    baseline === 'top'    ?  0.93*h :
    baseline === 'middle' ?  0.30*h :
    baseline === 'bottom' ? -0.21*h : 0
  );
}

var textAlign = {
  'left':   'start',
  'center': 'middle',
  'right':  'end'
};

var tempBounds = new Bounds();

function attr$5(emit, item) {
  var dx = item.dx || 0,
      dy = (item.dy || 0) + offset(item),
      x = item.x || 0,
      y = item.y || 0,
      a = item.angle || 0,
      r = item.radius || 0, t;

  if (r) {
    t = (item.theta || 0) - Math.PI/2;
    x += r * Math.cos(t);
    y += r * Math.sin(t);
  }

  emit('text-anchor', textAlign[item.align] || 'start');

  if (a) {
    t = translate(x, y) + ' rotate('+a+')';
    if (dx || dy) t += ' ' + translate(dx, dy);
  } else {
    t = translate(x + dx, y + dy);
  }
  emit('transform', t);
}

function bound$5(bounds, item, noRotate) {
  var h = height(item),
      a = item.align,
      r = item.radius || 0,
      x = item.x || 0,
      y = item.y || 0,
      dx = item.dx || 0,
      dy = (item.dy || 0) + offset(item) - Math.round(0.8*h), // use 4/5 offset
      w, t;

  if (r) {
    t = (item.theta || 0) - Math.PI/2;
    x += r * Math.cos(t);
    y += r * Math.sin(t);
  }

  // horizontal alignment
  w = width(item);
  if (a === 'center') {
    dx -= (w / 2);
  } else if (a === 'right') {
    dx -= w;
  } else {
    // left by default, do nothing
  }

  bounds.set(dx+=x, dy+=y, dx+w, dy+h);
  if (item.angle && !noRotate) {
    bounds.rotate(item.angle*Math.PI/180, x, y);
  }
  return bounds.expand(noRotate ? 0 : 1);
}

function draw$4(context, scene, bounds) {
  visit(scene, function(item) {
    var opacity, x, y, r, t, str;
    if (bounds && !bounds.intersects(item.bounds)) return; // bounds check
    if (!(str = textValue(item.text))) return; // get text string

    opacity = item.opacity == null ? 1 : item.opacity;
    if (opacity === 0) return;

    context.font = font(item);
    context.textAlign = item.align || 'left';

    x = item.x || 0;
    y = item.y || 0;
    if ((r = item.radius)) {
      t = (item.theta || 0) - Math.PI/2;
      x += r * Math.cos(t);
      y += r * Math.sin(t);
    }

    if (item.angle) {
      context.save();
      context.translate(x, y);
      context.rotate(item.angle * Math.PI/180);
      x = y = 0; // reset x, y
    }
    x += (item.dx || 0);
    y += (item.dy || 0) + offset(item);

    if (item.fill && fill(context, item, opacity)) {
      context.fillText(str, x, y);
    }
    if (item.stroke && stroke(context, item, opacity)) {
      context.strokeText(str, x, y);
    }
    if (item.angle) context.restore();
  });
}

function hit$1(context, item, x, y, gx, gy) {
  if (item.fontSize <= 0) return false;
  if (!item.angle) return true; // bounds sufficient if no rotation

  // project point into space of unrotated bounds
  var b = bound$5(tempBounds, item, true),
      a = -item.angle * Math.PI / 180,
      cos = Math.cos(a),
      sin = Math.sin(a),
      ix = item.x,
      iy = item.y,
      px = cos*gx - sin*gy + (ix - ix*cos + iy*sin),
      py = sin*gx + cos*gy + (iy - ix*sin - iy*cos);

  return b.contains(px, py);
}

var text$1 = {
  type:   'text',
  tag:    'text',
  nested: false,
  attr:   attr$5,
  bound:  bound$5,
  draw:   draw$4,
  pick:   pick(hit$1)
};

var marks = {
  arc:     arc$$1,
  area:    area$1,
  group:   group,
  image:   image,
  line:    line$1,
  path:    path$3,
  rect:    rect,
  rule:    rule,
  shape:   shape$1,
  symbol:  symbol$1,
  text:    text$1
};

var point$4 = function(event, el) {
  var rect = el.getBoundingClientRect();
  return [
    event.clientX - rect.left - (el.clientLeft || 0),
    event.clientY - rect.top - (el.clientTop || 0)
  ];
};

// create a new DOM element
function create(doc, tag, ns) {
  return ns ? doc.createElementNS(ns, tag) : doc.createElement(tag);
}

// find first child element with matching tag
function find(el, tag) {
  tag = tag.toLowerCase();
  var nodes = el.childNodes, i = 0, n = nodes.length;
  for (; i<n; ++i) if (nodes[i].tagName.toLowerCase() === tag) {
    return nodes[i];
  }
}

// retrieve child element at given index
// create & insert if doesn't exist or if tags do not match
function child(el, index, tag, ns) {
  var a = el.childNodes[index], b;
  if (!a || a.tagName.toLowerCase() !== tag.toLowerCase()) {
    b = a || null;
    a = create(el.ownerDocument, tag, ns);
    el.insertBefore(a, b);
  }
  return a;
}

// remove all child elements at or above the given index
function clear(el, index) {
  var nodes = el.childNodes,
      curr = nodes.length;
  while (curr > index) el.removeChild(nodes[--curr]);
  return el;
}

// generate css class name for mark
function cssClass(mark) {
  return 'mark-' + mark.marktype + (mark.name ? ' '+mark.name : '');
}

function CanvasHandler() {
  Handler.call(this);
  this._down = null;
  this._touch = null;
  this._first = true;
}

var prototype$5 = inherits(CanvasHandler, Handler);

prototype$5.initialize = function(el, origin, obj) {
  // add event listeners
  var canvas = this._canvas = el && find(el, 'canvas');
  if (canvas) {
    var that = this;
    this.events.forEach(function(type) {
      canvas.addEventListener(type, function(evt) {
        if (prototype$5[type]) {
          prototype$5[type].call(that, evt);
        } else {
          that.fire(type, evt);
        }
      });
    });
  }

  return Handler.prototype.initialize.call(this, el, origin, obj);
};

prototype$5.canvas = function() {
  return this._canvas;
};

// retrieve the current canvas context
prototype$5.context = function() {
  return this._canvas.getContext('2d');
};

// supported events
prototype$5.events = [
  'keydown',
  'keypress',
  'keyup',
  'dragenter',
  'dragleave',
  'dragover',
  'mousedown',
  'mouseup',
  'mousemove',
  'mouseout',
  'mouseover',
  'click',
  'dblclick',
  'wheel',
  'mousewheel',
  'touchstart',
  'touchmove',
  'touchend'
];

// to keep firefox happy
prototype$5.DOMMouseScroll = function(evt) {
  this.fire('mousewheel', evt);
};

function move(moveEvent, overEvent, outEvent) {
  return function(evt) {
    var a = this._active,
        p = this.pickEvent(evt);

    if (p === a) {
      // active item and picked item are the same
      this.fire(moveEvent, evt); // fire move
    } else {
      // active item and picked item are different
      if (!a || !a.exit) {
        // fire out for prior active item
        // suppress if active item was removed from scene
        this.fire(outEvent, evt);
      }
      this._active = p;          // set new active item
      this.fire(overEvent, evt); // fire over for new active item
      this.fire(moveEvent, evt); // fire move for new active item
    }
  };
}

function inactive(type) {
  return function(evt) {
    this.fire(type, evt);
    this._active = null;
  };
}

prototype$5.mousemove = move('mousemove', 'mouseover', 'mouseout');
prototype$5.dragover  = move('dragover', 'dragenter', 'dragleave');

prototype$5.mouseout  = inactive('mouseout');
prototype$5.dragleave = inactive('dragleave');

prototype$5.mousedown = function(evt) {
  this._down = this._active;
  this.fire('mousedown', evt);
};

prototype$5.click = function(evt) {
  if (this._down === this._active) {
    this.fire('click', evt);
    this._down = null;
  }
};

prototype$5.touchstart = function(evt) {
  this._touch = this.pickEvent(evt.changedTouches[0]);

  if (this._first) {
    this._active = this._touch;
    this._first = false;
  }

  this.fire('touchstart', evt, true);
};

prototype$5.touchmove = function(evt) {
  this.fire('touchmove', evt, true);
};

prototype$5.touchend = function(evt) {
  this.fire('touchend', evt, true);
  this._touch = null;
};

// fire an event
prototype$5.fire = function(type, evt, touch) {
  var a = touch ? this._touch : this._active,
      h = this._handlers[type], i, len;
  if (h) {
    evt.vegaType = type;
    for (i=0, len=h.length; i<len; ++i) {
      h[i].handler.call(this._obj, evt, a);
    }
  }
};

// add an event handler
prototype$5.on = function(type, handler) {
  var name = this.eventName(type),
      h = this._handlers;
  (h[name] || (h[name] = [])).push({
    type: type,
    handler: handler
  });
  return this;
};

// remove an event handler
prototype$5.off = function(type, handler) {
  var name = this.eventName(type),
      h = this._handlers[name], i;
  if (!h) return;
  for (i=h.length; --i>=0;) {
    if (h[i].type !== type) continue;
    if (!handler || h[i].handler === handler) h.splice(i, 1);
  }
  return this;
};

prototype$5.pickEvent = function(evt) {
  var p = point$4(evt, this._canvas),
      o = this._origin;
  return this.pick(this._scene, p[0], p[1], p[0] - o[0], p[1] - o[1]);
};

// find the scenegraph item at the current mouse position
// x, y -- the absolute x, y mouse coordinates on the canvas element
// gx, gy -- the relative coordinates within the current group
prototype$5.pick = function(scene, x, y, gx, gy) {
  var g = this.context(),
      mark = marks[scene.marktype];
  return mark.pick.call(this, g, scene, x, y, gx, gy);
};

var devicePixelRatio = typeof window !== 'undefined'
  ? window.devicePixelRatio || 1 : 1;

var resize = function(canvas, width, height, origin) {
  var scale = typeof HTMLElement !== 'undefined'
    && canvas instanceof HTMLElement
    && canvas.parentNode != null;

  var context = canvas.getContext('2d'),
      ratio = scale ? devicePixelRatio : 1;

  canvas.width = width * ratio;
  canvas.height = height * ratio;

  if (ratio !== 1) {
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
  }

  context.pixelRatio = ratio;
  context.setTransform(
    ratio, 0, 0, ratio,
    ratio * origin[0],
    ratio * origin[1]
  );

  return canvas;
};

function CanvasRenderer(imageLoader) {
  Renderer.call(this, imageLoader);
  this._redraw = false;
}

var prototype$6 = inherits(CanvasRenderer, Renderer);
var base = Renderer.prototype;
var tempBounds$1 = new Bounds();

prototype$6.initialize = function(el, width, height, origin) {
  this._canvas = Canvas$1(1, 1); // instantiate a small canvas
  if (el) {
    clear(el, 0).appendChild(this._canvas);
    this._canvas.setAttribute('class', 'marks');
  }
  // this method will invoke resize to size the canvas appropriately
  return base.initialize.call(this, el, width, height, origin);
};

prototype$6.resize = function(width, height, origin) {
  base.resize.call(this, width, height, origin);
  resize(this._canvas, this._width, this._height, this._origin);
  return this._redraw = true, this;
};

prototype$6.canvas = function() {
  return this._canvas;
};

prototype$6.context = function() {
  return this._canvas ? this._canvas.getContext('2d') : null;
};

function clipToBounds(g, items) {
  var b = new Bounds(), i, n, item, mark, group;
  for (i=0, n=items.length; i<n; ++i) {
    item = items[i];
    mark = item.mark;
    group = mark.group;
    item = marks[mark.marktype].nested ? mark : item;
    b.union(translate$1(item.bounds, group));
    if (item.bounds_prev) {
      b.union(translate$1(item.bounds_prev, group));
    }
  }
  b.round();

  g.beginPath();
  g.rect(b.x1, b.y1, b.width(), b.height());
  g.clip();

  return b;
}

function translate$1(bounds, group) {
  if (group == null) return bounds;
  var b = tempBounds$1.clear().union(bounds);
  for (; group != null; group = group.mark.group) {
    b.translate(group.x || 0, group.y || 0);
  }
  return b;
}

prototype$6._render = function(scene, items) {
  var g = this.context(),
      o = this._origin,
      w = this._width,
      h = this._height,
      b;

  // setup
  g.save();
  b = (!items || this._redraw)
    ? (this._redraw = false, null)
    : clipToBounds(g, items);
  this.clear(-o[0], -o[1], w, h);

  // render
  this.draw(g, scene, b);

  // takedown
  g.restore();

  return this;
};

prototype$6.draw = function(ctx, scene, bounds) {
  var mark = marks[scene.marktype];
  mark.draw.call(this, ctx, scene, bounds);
};

prototype$6.clear = function(x, y, w, h) {
  var g = this.context();
  g.clearRect(x, y, w, h);
  if (this._bgcolor != null) {
    g.fillStyle = this._bgcolor;
    g.fillRect(x, y, w, h);
  }
};

function SVGHandler() {
  Handler.call(this);
}

var prototype$7 = inherits(SVGHandler, Handler);

prototype$7.initialize = function(el, origin, obj) {
  this._svg = el && find(el, 'svg');
  return Handler.prototype.initialize.call(this, el, origin, obj);
};

prototype$7.svg = function() {
  return this._svg;
};

// wrap an event listener for the SVG DOM
prototype$7.listener = function(handler) {
  var that = this;
  return function(evt) {
    var target = evt.target,
        item = target.__data__;
    evt.vegaType = evt.type;
    item = Array.isArray(item) ? item[0] : item;
    handler.call(that._obj, evt, item);
  };
};

// add an event handler
prototype$7.on = function(type, handler) {
  var name = this.eventName(type),
      h = this._handlers,
      x = {
        type:     type,
        handler:  handler,
        listener: this.listener(handler)
      };

  (h[name] || (h[name] = [])).push(x);

  if (this._svg) {
    this._svg.addEventListener(name, x.listener);
  }

  return this;
};

// remove an event handler
prototype$7.off = function(type, handler) {
  var name = this.eventName(type),
      svg = this._svg,
      h = this._handlers[name], i;

  if (!h) return;

  for (i=h.length; --i>=0;) {
    if (h[i].type === type && !handler || h[i].handler === handler) {
      if (this._svg) {
        svg.removeEventListener(name, h[i].listener);
      }
      h.splice(i, 1);
    }
  }

  return this;
};

// generate string for an opening xml tag
// tag: the name of the xml tag
// attr: hash of attribute name-value pairs to include
// raw: additional raw string to include in tag markup
function openTag(tag, attr, raw) {
  var s = '<' + tag, key, val;
  if (attr) {
    for (key in attr) {
      val = attr[key];
      if (val != null) {
        s += ' ' + key + '="' + val + '"';
      }
    }
  }
  if (raw) s += ' ' + raw;
  return s + '>';
}

// generate string for closing xml tag
// tag: the name of the xml tag
function closeTag(tag) {
  return '</' + tag + '>';
}

var metadata = {
  'version': '1.1',
  'xmlns': 'http://www.w3.org/2000/svg',
  'xmlns:xlink': 'http://www.w3.org/1999/xlink'
};

var styles = {
  'fill':             'fill',
  'fillOpacity':      'fill-opacity',
  'stroke':           'stroke',
  'strokeWidth':      'stroke-width',
  'strokeOpacity':    'stroke-opacity',
  'strokeCap':        'stroke-linecap',
  'strokeDash':       'stroke-dasharray',
  'strokeDashOffset': 'stroke-dashoffset',
  'opacity':          'opacity'
};

var styleProperties = Object.keys(styles);

var ns = metadata.xmlns;

function SVGRenderer(imageLoader) {
  Renderer.call(this, imageLoader);
  this._dirtyID = 0;
  this._svg = null;
  this._root = null;
  this._defs = null;
}

var prototype$8 = inherits(SVGRenderer, Renderer);
var base$1 = Renderer.prototype;

prototype$8.initialize = function(el, width$$1, height$$1, padding) {
  if (el) {
    this._svg = child(el, 0, 'svg', ns);
    this._svg.setAttribute('class', 'marks');
    clear(el, 1);
    // set the svg root group
    this._root = child(this._svg, 0, 'g', ns);
    clear(this._svg, 1);
  }

  // create the svg definitions cache
  this._defs = {
    clip_id:  1,
    gradient: {},
    clipping: {}
  };

  // set background color if defined
  this.background(this._bgcolor);

  return base$1.initialize.call(this, el, width$$1, height$$1, padding);
};

prototype$8.background = function(bgcolor) {
  if (arguments.length && this._svg) {
    this._svg.style.setProperty('background-color', bgcolor);
  }
  return base$1.background.apply(this, arguments);
};

prototype$8.resize = function(width$$1, height$$1, origin) {
  base$1.resize.call(this, width$$1, height$$1, origin);

  if (this._svg) {
    this._svg.setAttribute('width', this._width);
    this._svg.setAttribute('height', this._height);
    this._root.setAttribute('transform', 'translate(' + this._origin + ')');
  }

  return this;
};

prototype$8.svg = function() {
  if (!this._svg) return null;

  var attr = {
    'class':  'marks',
    'width':  this._width,
    'height': this._height
  };
  for (var key in metadata) {
    attr[key] = metadata[key];
  }

  return openTag('svg', attr) + this._svg.innerHTML + closeTag('svg');
};


// -- Render entry point --

prototype$8._render = function(scene, items) {
  // perform spot updates and re-render markup
  if (this._dirtyCheck(items)) {
    if (this._dirtyAll) this._resetDefs();
    this.draw(this._root, scene);
    clear(this._root, 1);
  }

  this.updateDefs();
  return this;
};

// -- Manage SVG definitions ('defs') block --

prototype$8.updateDefs = function() {
  var svg = this._svg,
      defs = this._defs,
      el = defs.el,
      index = 0, id;

  for (id in defs.gradient) {
    if (!el) defs.el = (el = child(svg, 0, 'defs', ns));
    updateGradient(el, defs.gradient[id], index++);
  }

  for (id in defs.clipping) {
    if (!el) defs.el = (el = child(svg, 0, 'defs', ns));
    updateClipping(el, defs.clipping[id], index++);
  }

  // clean-up
  if (el) {
    if (index === 0) {
      svg.removeChild(el);
      defs.el = null;
    } else {
      clear(el, index);
    }
  }
};

function updateGradient(el, grad, index) {
  var i, n, stop;

  el = child(el, index, 'linearGradient', ns);
  el.setAttribute('id', grad.id);
  el.setAttribute('x1', grad.x1);
  el.setAttribute('x2', grad.x2);
  el.setAttribute('y1', grad.y1);
  el.setAttribute('y2', grad.y2);

  for (i=0, n=grad.stops.length; i<n; ++i) {
    stop = child(el, i, 'stop', ns);
    stop.setAttribute('offset', grad.stops[i].offset);
    stop.setAttribute('stop-color', grad.stops[i].color);
  }
  clear(el, i);
}

function updateClipping(el, clip, index) {
  var rect;

  el = child(el, index, 'clipPath', ns);
  el.setAttribute('id', clip.id);
  rect = child(el, 0, 'rect', ns);
  rect.setAttribute('x', 0);
  rect.setAttribute('y', 0);
  rect.setAttribute('width', clip.width);
  rect.setAttribute('height', clip.height);
}

prototype$8._resetDefs = function() {
  var def = this._defs;
  def.clip_id = 1;
  def.gradient = {};
  def.clipping = {};
};


// -- Manage rendering of items marked as dirty --

prototype$8.isDirty = function(item) {
  return this._dirtyAll
    || !item._svg
    || item.dirty === this._dirtyID;
};

prototype$8._dirtyCheck = function(items) {
  this._dirtyAll = true;
  if (!items) return true;

  var id = ++this._dirtyID,
      item, mark, type, mdef, i, n, o;

  for (i=0, n=items.length; i<n; ++i) {
    item = items[i];
    mark = item.mark;

    if (mark.marktype !== type) {
      // memoize mark instance lookup
      type = mark.marktype;
      mdef = marks[type];
    }

    if (mark.zdirty && mark.dirty !== id) {
      this._dirtyAll = false;
      mark.dirty = id;
      dirtyParents(mark.group, id);
    }

    if (item.exit) { // EXIT
      if (mdef.nested && mark.items.length) {
        // if nested mark with remaining points, update instead
        o = mark.items[0];
        if (o._svg) this._update(mdef, o._svg, o);
      } else if (item._svg) {
        // otherwise remove from DOM
        item._svg.remove();
      }
      item._svg = null;
      continue;
    }

    item = (mdef.nested ? mark.items[0] : item);
    if (item._update === id) continue; // already visited

    if (!item._svg || !item._svg.ownerSVGElement) {
      // ENTER
      this._dirtyAll = false;
      dirtyParents(item, id);
    } else {
      // IN-PLACE UPDATE
      this._update(mdef, item._svg, item);
    }
    item._update = id;
  }
  return !this._dirtyAll;
};

function dirtyParents(item, id) {
  for (; item && item.dirty !== id; item=item.mark.group) {
    item.dirty = id;
    if (item.mark && item.mark.dirty !== id) {
      item.mark.dirty = id;
    } else return;
  }
}


// -- Construct & maintain scenegraph to SVG mapping ---

// Draw a mark container.
prototype$8.draw = function(el, scene, prev) {
  if (!this.isDirty(scene)) return scene._svg;

  var renderer = this,
      mdef = marks[scene.marktype],
      events = scene.interactive === false ? 'none' : null,
      isGroup = mdef.tag === 'g',
      sibling = null,
      i = 0,
      parent;

  parent = bind(scene, el, prev, 'g');
  parent.setAttribute('class', cssClass(scene));
  if (!isGroup && events) {
    parent.style.setProperty('pointer-events', events);
  }

  function process(item) {
    var dirty = renderer.isDirty(item),
        node = bind(item, parent, sibling, mdef.tag);

    if (dirty) {
      renderer._update(mdef, node, item);
      if (isGroup) recurse(renderer, node, item);
    }

    sibling = node;
    ++i;
  }

  if (mdef.nested) {
    if (scene.items.length) process(scene.items[0]);
  } else {
    visit(scene, process);
  }

  clear(parent, i);
  return parent;
};

// Recursively process group contents.
function recurse(renderer, el, group) {
  var prev = el.firstChild, // group background
      idx = 0;

  visit(group, function(item) {
    prev = renderer.draw(el, item, prev);
    ++idx;
  });

  // remove any extraneous DOM elements
  clear(el, 1 + idx);
}

// Bind a scenegraph item to an SVG DOM element.
// Create new SVG elements as needed.
function bind(item, el, sibling, tag) {
  var node = item._svg, doc;

  // create a new dom node if needed
  if (!node) {
    doc = el.ownerDocument;
    node = create(doc, tag, ns);
    item._svg = node;

    if (item.mark) {
      node.__data__ = item;
      node.__values__ = {fill: 'default'};

      // create background element
      if (tag === 'g') {
        var bg = create(doc, 'path', ns);
        bg.setAttribute('class', 'background');
        node.appendChild(bg);
        bg.__data__ = item;
      }
    }
  }

  if (doc || node.previousSibling !== sibling) {
    el.insertBefore(node, sibling ? sibling.nextSibling : el.firstChild);
  }

  return node;
}


// -- Set attributes & styles on SVG elements ---

var element = null;
var values$1 = null;  // temp var for current values hash

// Extra configuration for certain mark types
var mark_extras = {
  group: function(mdef, el, item) {
    element = el.childNodes[0];
    values$1 = el.__values__; // use parent's values hash
    mdef.background(emit, item, this);

    var value = item.mark.interactive === false ? 'none' : null;
    if (value !== values$1.events) {
      element.style.setProperty('pointer-events', value);
      values$1.events = value;
    }
  },
  text: function(mdef, el, item) {
    var str = textValue(item.text);
    if (str !== values$1.text) {
      el.textContent = str;
      values$1.text = str;
    }
    str = font(item);
    if (str !== values$1.font) {
      el.style.setProperty('font', str);
      values$1.font = str;
    }
  }
};

prototype$8._update = function(mdef, el, item) {
  // set dom element and values cache
  // provides access to emit method
  element = el;
  values$1 = el.__values__;

  // apply svg attributes
  mdef.attr(emit, item, this);

  // some marks need special treatment
  var extra = mark_extras[mdef.type];
  if (extra) extra(mdef, el, item);

  // apply svg css styles
  // note: element may be modified by 'extra' method
  this.style(element, item);
};

function emit(name, value, ns) {
  // early exit if value is unchanged
  if (value === values$1[name]) return;

  if (value != null) {
    // if value is provided, update DOM attribute
    if (ns) {
      element.setAttributeNS(ns, name, value);
    } else {
      element.setAttribute(name, value);
    }
  } else {
    // else remove DOM attribute
    if (ns) {
      element.removeAttributeNS(ns, name);
    } else {
      element.removeAttribute(name);
    }
  }

  // note current value for future comparison
  values$1[name] = value;
}

prototype$8.style = function(el, o) {
  if (o == null) return;
  var i, n, prop, name, value;

  for (i=0, n=styleProperties.length; i<n; ++i) {
    prop = styleProperties[i];
    value = o[prop];
    if (value === values$1[prop]) continue;

    name = styles[prop];
    if (value == null) {
      if (name === 'fill') {
        el.style.setProperty(name, 'none');
      } else {
        el.style.removeProperty(name);
      }
    } else {
      if (value.id) {
        // ensure definition is included
        this._defs.gradient[value.id] = value;
        value = 'url(' + href() + '#' + value.id + ')';
      }
      el.style.setProperty(name, value+'');
    }

    values$1[prop] = value;
  }
};

function href() {
  return typeof window !== 'undefined' ? window.location.href : '';
}

function SVGStringRenderer(imageLoader) {
  Renderer.call(this, imageLoader);

  this._text = {
    head: '',
    root: '',
    foot: '',
    defs: '',
    body: ''
  };

  this._defs = {
    clip_id:  1,
    gradient: {},
    clipping: {}
  };
}

var prototype$9 = inherits(SVGStringRenderer, Renderer);
var base$2 = Renderer.prototype;

prototype$9.resize = function(width$$1, height$$1, origin) {
  base$2.resize.call(this, width$$1, height$$1, origin);
  var o = this._origin,
      t = this._text;

  var attr = {
    'class':  'marks',
    'width':  this._width,
    'height': this._height
  };
  for (var key in metadata) {
    attr[key] = metadata[key];
  }

  t.head = openTag('svg', attr);
  t.root = openTag('g', {
    transform: 'translate(' + o + ')'
  });
  t.foot = closeTag('g') + closeTag('svg');

  return this;
};

prototype$9.svg = function() {
  var t = this._text;
  return t.head + t.defs + t.root + t.body + t.foot;
};

prototype$9._render = function(scene) {
  this._text.body = this.mark(scene);
  this._text.defs = this.buildDefs();
  return this;
};

prototype$9.reset = function() {
  this._defs.clip_id = 0;
  return this;
};

prototype$9.buildDefs = function() {
  var all = this._defs,
      defs = '',
      i, id, def, stops;

  for (id in all.gradient) {
    def = all.gradient[id];
    stops = def.stops;

    defs += openTag('linearGradient', {
      id: id,
      x1: def.x1,
      x2: def.x2,
      y1: def.y1,
      y2: def.y2
    });

    for (i=0; i<stops.length; ++i) {
      defs += openTag('stop', {
        offset: stops[i].offset,
        'stop-color': stops[i].color
      }) + closeTag('stop');
    }

    defs += closeTag('linearGradient');
  }

  for (id in all.clipping) {
    def = all.clipping[id];

    defs += openTag('clipPath', {id: id});

    defs += openTag('rect', {
      x: 0,
      y: 0,
      width: def.width,
      height: def.height
    }) + closeTag('rect');

    defs += closeTag('clipPath');
  }

  return (defs.length > 0) ? openTag('defs') + defs + closeTag('defs') : '';
};

var object$1;

function emit$1(name, value, ns, prefixed) {
  object$1[prefixed || name] = value;
}

prototype$9.attributes = function(attr, item) {
  object$1 = {};
  attr(emit$1, item, this);
  return object$1;
};

prototype$9.mark = function(scene) {
  var renderer = this,
      mdef = marks[scene.marktype],
      tag  = mdef.tag,
      defs = this._defs,
      str = '',
      style;

  if (tag !== 'g' && scene.interactive === false) {
    style = 'style="pointer-events: none;"';
  }

  // render opening group tag
  str += openTag('g', {
    'class': cssClass(scene)
  }, style);

  // render contained elements
  function process(item) {
    style = (tag !== 'g') ? applyStyles(item, scene, tag, defs) : null;
    str += openTag(tag, renderer.attributes(mdef.attr, item), style);

    if (tag === 'text') {
      str += escape_text(textValue(item.text));
    } else if (tag === 'g') {
      str += openTag('path',
        renderer.attributes(mdef.background, item),
        applyStyles(item, scene, 'bgrect', defs)) + closeTag('path');
      str += renderer.markGroup(item);
    }

    str += closeTag(tag);
  }

  if (mdef.nested) {
    if (scene.items && scene.items.length) process(scene.items[0]);
  } else {
    visit(scene, process);
  }

  // render closing group tag
  return str + closeTag('g');
};

prototype$9.markGroup = function(scene) {
  var renderer = this,
      str = '';

  visit(scene, function(item) {
    str += renderer.mark(item);
  });

  return str;
};

function applyStyles(o, mark, tag, defs) {
  if (o == null) return '';
  var i, n, prop, name, value, s = '';

  if (tag === 'bgrect' && mark.interactive === false) {
    s += 'pointer-events: none;';
  }

  if (tag === 'text') {
    s += 'font: ' + font(o) + ';';
  }

  for (i=0, n=styleProperties.length; i<n; ++i) {
    prop = styleProperties[i];
    name = styles[prop];
    value = o[prop];

    if (value == null) {
      if (name === 'fill') {
        s += (s.length ? ' ' : '') + 'fill: none;';
      }
    } else {
      if (value.id) {
        // ensure definition is included
        defs.gradient[value.id] = value;
        value = 'url(#' + value.id + ')';
      }
      s += (s.length ? ' ' : '') + name + ': ' + value + ';';
    }
  }

  return s ? 'style="' + s + '"' : null;
}

function escape_text(s) {
  return s.replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
}

var boundItem = function(item, func, opt) {
  var type = marks[item.mark.marktype],
      bound = func || type.bound;
  if (type.nested) item = item.mark;

  var curr = item.bounds,
      prev = item.bounds_prev || (item.bounds_prev = new Bounds());

  if (curr) {
    prev.clear().union(curr);
    curr.clear();
  } else {
    item.bounds = new Bounds();
  }

  bound(item.bounds, item, opt);
  if (!curr) prev.clear().union(item.bounds);

  return item.bounds;
};

var DUMMY = {mark: null};

var boundMark = function(mark, bounds, opt) {
  var type  = marks[mark.marktype],
      bound = type.bound,
      items = mark.items,
      hasItems = items && items.length,
      i, n, item, b;

  if (type.nested) {
    item = hasItems ? items[0] : (DUMMY.mark = mark, DUMMY); // no items, fake it
    b = boundItem(item, bound, opt);
    bounds = bounds && bounds.union(b) || b;
    return bounds;
  }

  bounds = bounds
    || mark.bounds && mark.bounds.clear()
    || new Bounds();

  if (hasItems) {
    for (i=0, n=items.length; i<n; ++i) {
      bounds.union(boundItem(items[i], bound, opt));
    }
  }

  return mark.bounds = bounds;
};

function initialize(scene) {
  var type = scene.marktype,
      items = scene.items,
      parent, i, n;

  if (items) {
    for (i=0, n=items.length; i<n; ++i) {
      parent = type ? 'mark' : 'group';
      items[i][parent] = scene;
      if (items[i].zindex) items[i][parent].zdirty = true;
      if ('group' === (type || parent)) initialize(items[i]);
    }
  }

  if (type) boundMark(scene);
  return scene;
}

var index = parse$1;

/**
 * expected argument lengths
 * @type {Object}
 */

var length = {a: 7, c: 6, h: 1, l: 2, m: 2, q: 4, s: 4, t: 2, v: 1, z: 0};

/**
 * segment pattern
 * @type {RegExp}
 */

var segment = /([astvzqmhlc])([^astvzqmhlc]*)/ig;

/**
 * parse an svg path data string. Generates an Array
 * of commands where each command is an Array of the
 * form `[command, arg1, arg2, ...]`
 *
 * @param {String} path
 * @return {Array}
 */

function parse$1(path) {
	var data = [];
	path.replace(segment, function(_, command, args){
		var type = command.toLowerCase();
		args = parseValues(args);

		// overloaded moveTo
		if (type == 'm' && args.length > 2) {
			data.push([command].concat(args.splice(0, 2)));
			type = 'l';
			command = command == 'm' ? 'l' : 'L';
		}

		while (true) {
			if (args.length == length[type]) {
				args.unshift(command);
				return data.push(args)
			}
			if (args.length < length[type]) throw new Error('malformed path data')
			data.push([command].concat(args.splice(0, length[type])));
		}
	});
	return data
}

var number = /-?[0-9]*\.?[0-9]+(?:e[-+]?\d+)?/ig;

function parseValues(args) {
	var numbers = args.match(number);
	return numbers ? numbers.map(Number) : []
}

function getSqDist(p1, p2) {
    var dx = p1[0] - p2[0],
        dy = p1[1] - p2[1];

    return dx * dx + dy * dy;
}

// basic distance-based simplification
var radialDistance$1 = function simplifyRadialDist(points, tolerance) {
    if (points.length<=1)
        return points;
    tolerance = typeof tolerance === 'number' ? tolerance : 1;
    var sqTolerance = tolerance * tolerance;
    
    var prevPoint = points[0],
        newPoints = [prevPoint],
        point;

    for (var i = 1, len = points.length; i < len; i++) {
        point = points[i];

        if (getSqDist(point, prevPoint) > sqTolerance) {
            newPoints.push(point);
            prevPoint = point;
        }
    }

    if (prevPoint !== point) newPoints.push(point);

    return newPoints;
};

// square distance from a point to a segment
function getSqSegDist(p, p1, p2) {
    var x = p1[0],
        y = p1[1],
        dx = p2[0] - x,
        dy = p2[1] - y;

    if (dx !== 0 || dy !== 0) {

        var t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);

        if (t > 1) {
            x = p2[0];
            y = p2[1];

        } else if (t > 0) {
            x += dx * t;
            y += dy * t;
        }
    }

    dx = p[0] - x;
    dy = p[1] - y;

    return dx * dx + dy * dy;
}

function simplifyDPStep(points, first, last, sqTolerance, simplified) {
    var maxSqDist = sqTolerance,
        index;

    for (var i = first + 1; i < last; i++) {
        var sqDist = getSqSegDist(points[i], points[first], points[last]);

        if (sqDist > maxSqDist) {
            index = i;
            maxSqDist = sqDist;
        }
    }

    if (maxSqDist > sqTolerance) {
        if (index - first > 1) simplifyDPStep(points, first, index, sqTolerance, simplified);
        simplified.push(points[index]);
        if (last - index > 1) simplifyDPStep(points, index, last, sqTolerance, simplified);
    }
}

// simplification using Ramer-Douglas-Peucker algorithm
var douglasPeucker$1 = function simplifyDouglasPeucker(points, tolerance) {
    if (points.length<=1)
        return points;
    tolerance = typeof tolerance === 'number' ? tolerance : 1;
    var sqTolerance = tolerance * tolerance;
    
    var last = points.length - 1;

    var simplified = [points[0]];
    simplifyDPStep(points, 0, last, sqTolerance, simplified);
    simplified.push(points[last]);

    return simplified;
};

var simplifyRadialDist$1 = radialDistance$1;
var simplifyDouglasPeucker$1 = douglasPeucker$1;

//simplifies using both algorithms
var index$1 = function simplify(points, tolerance) {
    points = simplifyRadialDist$1(points, tolerance);
    points = simplifyDouglasPeucker$1(points, tolerance);
    return points;
};

var radialDistance = simplifyRadialDist$1;
var douglasPeucker = simplifyDouglasPeucker$1;

index$1.radialDistance = radialDistance;
index$1.douglasPeucker = douglasPeucker;

function clone(point) { //TODO: use gl-vec2 for this
    return [point[0], point[1]]
}

function vec2(x, y) {
    return [x, y]
}

var _function = function createBezierBuilder(opt) {
    opt = opt||{};

    var RECURSION_LIMIT = typeof opt.recursion === 'number' ? opt.recursion : 8;
    var FLT_EPSILON = typeof opt.epsilon === 'number' ? opt.epsilon : 1.19209290e-7;
    var PATH_DISTANCE_EPSILON = typeof opt.pathEpsilon === 'number' ? opt.pathEpsilon : 1.0;

    var curve_angle_tolerance_epsilon = typeof opt.angleEpsilon === 'number' ? opt.angleEpsilon : 0.01;
    var m_angle_tolerance = opt.angleTolerance || 0;
    var m_cusp_limit = opt.cuspLimit || 0;

    return function bezierCurve(start, c1, c2, end, scale, points) {
        if (!points)
            points = [];

        scale = typeof scale === 'number' ? scale : 1.0;
        var distanceTolerance = PATH_DISTANCE_EPSILON / scale;
        distanceTolerance *= distanceTolerance;
        begin(start, c1, c2, end, points, distanceTolerance);
        return points
    }


    ////// Based on:
    ////// https://github.com/pelson/antigrain/blob/master/agg-2.4/src/agg_curves.cpp

    function begin(start, c1, c2, end, points, distanceTolerance) {
        points.push(clone(start));
        var x1 = start[0],
            y1 = start[1],
            x2 = c1[0],
            y2 = c1[1],
            x3 = c2[0],
            y3 = c2[1],
            x4 = end[0],
            y4 = end[1];
        recursive(x1, y1, x2, y2, x3, y3, x4, y4, points, distanceTolerance, 0);
        points.push(clone(end));
    }

    function recursive(x1, y1, x2, y2, x3, y3, x4, y4, points, distanceTolerance, level) {
        if(level > RECURSION_LIMIT) 
            return

        var pi = Math.PI;

        // Calculate all the mid-points of the line segments
        //----------------------
        var x12   = (x1 + x2) / 2;
        var y12   = (y1 + y2) / 2;
        var x23   = (x2 + x3) / 2;
        var y23   = (y2 + y3) / 2;
        var x34   = (x3 + x4) / 2;
        var y34   = (y3 + y4) / 2;
        var x123  = (x12 + x23) / 2;
        var y123  = (y12 + y23) / 2;
        var x234  = (x23 + x34) / 2;
        var y234  = (y23 + y34) / 2;
        var x1234 = (x123 + x234) / 2;
        var y1234 = (y123 + y234) / 2;

        if(level > 0) { // Enforce subdivision first time
            // Try to approximate the full cubic curve by a single straight line
            //------------------
            var dx = x4-x1;
            var dy = y4-y1;

            var d2 = Math.abs((x2 - x4) * dy - (y2 - y4) * dx);
            var d3 = Math.abs((x3 - x4) * dy - (y3 - y4) * dx);

            var da1, da2;

            if(d2 > FLT_EPSILON && d3 > FLT_EPSILON) {
                // Regular care
                //-----------------
                if((d2 + d3)*(d2 + d3) <= distanceTolerance * (dx*dx + dy*dy)) {
                    // If the curvature doesn't exceed the distanceTolerance value
                    // we tend to finish subdivisions.
                    //----------------------
                    if(m_angle_tolerance < curve_angle_tolerance_epsilon) {
                        points.push(vec2(x1234, y1234));
                        return
                    }

                    // Angle & Cusp Condition
                    //----------------------
                    var a23 = Math.atan2(y3 - y2, x3 - x2);
                    da1 = Math.abs(a23 - Math.atan2(y2 - y1, x2 - x1));
                    da2 = Math.abs(Math.atan2(y4 - y3, x4 - x3) - a23);
                    if(da1 >= pi) da1 = 2*pi - da1;
                    if(da2 >= pi) da2 = 2*pi - da2;

                    if(da1 + da2 < m_angle_tolerance) {
                        // Finally we can stop the recursion
                        //----------------------
                        points.push(vec2(x1234, y1234));
                        return
                    }

                    if(m_cusp_limit !== 0.0) {
                        if(da1 > m_cusp_limit) {
                            points.push(vec2(x2, y2));
                            return
                        }

                        if(da2 > m_cusp_limit) {
                            points.push(vec2(x3, y3));
                            return
                        }
                    }
                }
            }
            else {
                if(d2 > FLT_EPSILON) {
                    // p1,p3,p4 are collinear, p2 is considerable
                    //----------------------
                    if(d2 * d2 <= distanceTolerance * (dx*dx + dy*dy)) {
                        if(m_angle_tolerance < curve_angle_tolerance_epsilon) {
                            points.push(vec2(x1234, y1234));
                            return
                        }

                        // Angle Condition
                        //----------------------
                        da1 = Math.abs(Math.atan2(y3 - y2, x3 - x2) - Math.atan2(y2 - y1, x2 - x1));
                        if(da1 >= pi) da1 = 2*pi - da1;

                        if(da1 < m_angle_tolerance) {
                            points.push(vec2(x2, y2));
                            points.push(vec2(x3, y3));
                            return
                        }

                        if(m_cusp_limit !== 0.0) {
                            if(da1 > m_cusp_limit) {
                                points.push(vec2(x2, y2));
                                return
                            }
                        }
                    }
                }
                else if(d3 > FLT_EPSILON) {
                    // p1,p2,p4 are collinear, p3 is considerable
                    //----------------------
                    if(d3 * d3 <= distanceTolerance * (dx*dx + dy*dy)) {
                        if(m_angle_tolerance < curve_angle_tolerance_epsilon) {
                            points.push(vec2(x1234, y1234));
                            return
                        }

                        // Angle Condition
                        //----------------------
                        da1 = Math.abs(Math.atan2(y4 - y3, x4 - x3) - Math.atan2(y3 - y2, x3 - x2));
                        if(da1 >= pi) da1 = 2*pi - da1;

                        if(da1 < m_angle_tolerance) {
                            points.push(vec2(x2, y2));
                            points.push(vec2(x3, y3));
                            return
                        }

                        if(m_cusp_limit !== 0.0) {
                            if(da1 > m_cusp_limit)
                            {
                                points.push(vec2(x3, y3));
                                return
                            }
                        }
                    }
                }
                else {
                    // Collinear case
                    //-----------------
                    dx = x1234 - (x1 + x4) / 2;
                    dy = y1234 - (y1 + y4) / 2;
                    if(dx*dx + dy*dy <= distanceTolerance) {
                        points.push(vec2(x1234, y1234));
                        return
                    }
                }
            }
        }

        // Continue subdivision
        //----------------------
        recursive(x1, y1, x12, y12, x123, y123, x1234, y1234, points, distanceTolerance, level + 1); 
        recursive(x1234, y1234, x234, y234, x34, y34, x4, y4, points, distanceTolerance, level + 1); 
    }
};

var index$3 = _function();

var index$5 = absolutize;

/**
 * redefine `path` with absolute coordinates
 *
 * @param {Array} path
 * @return {Array}
 */

function absolutize(path){
	var startX = 0;
	var startY = 0;
	var x = 0;
	var y = 0;

	return path.map(function(seg){
		seg = seg.slice();
		var type = seg[0];
		var command = type.toUpperCase();

		// is relative
		if (type != command) {
			seg[0] = command;
			switch (type) {
				case 'a':
					seg[6] += x;
					seg[7] += y;
					break
				case 'v':
					seg[1] += y;
					break
				case 'h':
					seg[1] += x;
					break
				default:
					for (var i = 1; i < seg.length;) {
						seg[i++] += x;
						seg[i++] += y;
					}
			}
		}

		// update cursor state
		switch (command) {
			case 'Z':
				x = startX;
				y = startY;
				break
			case 'H':
				x = seg[1];
				break
			case 'V':
				y = seg[1];
				break
			case 'M':
				x = startX = seg[1];
				y = startY = seg[2];
				break
			default:
				x = seg[seg.length - 2];
				y = seg[seg.length - 1];
		}

		return seg
	})
}

var π = Math.PI;
var _120 = radians(120);

var index$7 = normalize;

/**
 * describe `path` in terms of cubic bézier 
 * curves and move commands
 *
 * @param {Array} path
 * @return {Array}
 */

function normalize(path){
	// init state
	var prev;
	var result = [];
	var bezierX = 0;
	var bezierY = 0;
	var startX = 0;
	var startY = 0;
	var quadX = null;
	var quadY = null;
	var x = 0;
	var y = 0;

	for (var i = 0, len = path.length; i < len; i++) {
		var seg = path[i];
		var command = seg[0];
		switch (command) {
			case 'M':
				startX = seg[1];
				startY = seg[2];
				break
			case 'A':
				seg = arc$4(x, y,seg[1],seg[2],radians(seg[3]),seg[4],seg[5],seg[6],seg[7]);
				// split multi part
				seg.unshift('C');
				if (seg.length > 7) {
					result.push(seg.splice(0, 7));
					seg.unshift('C');
				}
				break
			case 'S':
				// default control point
				var cx = x;
				var cy = y;
				if (prev == 'C' || prev == 'S') {
					cx += cx - bezierX; // reflect the previous command's control
					cy += cy - bezierY; // point relative to the current point
				}
				seg = ['C', cx, cy, seg[1], seg[2], seg[3], seg[4]];
				break
			case 'T':
				if (prev == 'Q' || prev == 'T') {
					quadX = x * 2 - quadX; // as with 'S' reflect previous control point
					quadY = y * 2 - quadY;
				} else {
					quadX = x;
					quadY = y;
				}
				seg = quadratic(x, y, quadX, quadY, seg[1], seg[2]);
				break
			case 'Q':
				quadX = seg[1];
				quadY = seg[2];
				seg = quadratic(x, y, seg[1], seg[2], seg[3], seg[4]);
				break
			case 'L':
				seg = line$3(x, y, seg[1], seg[2]);
				break
			case 'H':
				seg = line$3(x, y, seg[1], y);
				break
			case 'V':
				seg = line$3(x, y, x, seg[1]);
				break
			case 'Z':
				seg = line$3(x, y, startX, startY);
				break
		}

		// update state
		prev = command;
		x = seg[seg.length - 2];
		y = seg[seg.length - 1];
		if (seg.length > 4) {
			bezierX = seg[seg.length - 4];
			bezierY = seg[seg.length - 3];
		} else {
			bezierX = x;
			bezierY = y;
		}
		result.push(seg);
	}

	return result
}

function line$3(x1, y1, x2, y2){
	return ['C', x1, y1, x2, y2, x2, y2]
}

function quadratic(x1, y1, cx, cy, x2, y2){
	return [
		'C',
		x1/3 + (2/3) * cx,
		y1/3 + (2/3) * cy,
		x2/3 + (2/3) * cx,
		y2/3 + (2/3) * cy,
		x2,
		y2
	]
}

// This function is ripped from 
// github.com/DmitryBaranovskiy/raphael/blob/4d97d4/raphael.js#L2216-L2304 
// which references w3.org/TR/SVG11/implnote.html#ArcImplementationNotes
// TODO: make it human readable

function arc$4(x1, y1, rx, ry, angle, large_arc_flag, sweep_flag, x2, y2, recursive) {
	if (!recursive) {
		var xy = rotate(x1, y1, -angle);
		x1 = xy.x;
		y1 = xy.y;
		xy = rotate(x2, y2, -angle);
		x2 = xy.x;
		y2 = xy.y;
		var x = (x1 - x2) / 2;
		var y = (y1 - y2) / 2;
		var h = (x * x) / (rx * rx) + (y * y) / (ry * ry);
		if (h > 1) {
			h = Math.sqrt(h);
			rx = h * rx;
			ry = h * ry;
		}
		var rx2 = rx * rx;
		var ry2 = ry * ry;
		var k = (large_arc_flag == sweep_flag ? -1 : 1)
			* Math.sqrt(Math.abs((rx2 * ry2 - rx2 * y * y - ry2 * x * x) / (rx2 * y * y + ry2 * x * x)));
		if (k == Infinity) k = 1; // neutralize
		var cx = k * rx * y / ry + (x1 + x2) / 2;
		var cy = k * -ry * x / rx + (y1 + y2) / 2;
		var f1 = Math.asin(((y1 - cy) / ry).toFixed(9));
		var f2 = Math.asin(((y2 - cy) / ry).toFixed(9));

		f1 = x1 < cx ? π - f1 : f1;
		f2 = x2 < cx ? π - f2 : f2;
		if (f1 < 0) f1 = π * 2 + f1;
		if (f2 < 0) f2 = π * 2 + f2;
		if (sweep_flag && f1 > f2) f1 = f1 - π * 2;
		if (!sweep_flag && f2 > f1) f2 = f2 - π * 2;
	} else {
		f1 = recursive[0];
		f2 = recursive[1];
		cx = recursive[2];
		cy = recursive[3];
	}
	// greater than 120 degrees requires multiple segments
	if (Math.abs(f2 - f1) > _120) {
		var f2old = f2;
		var x2old = x2;
		var y2old = y2;
		f2 = f1 + _120 * (sweep_flag && f2 > f1 ? 1 : -1);
		x2 = cx + rx * Math.cos(f2);
		y2 = cy + ry * Math.sin(f2);
		var res = arc$4(x2, y2, rx, ry, angle, 0, sweep_flag, x2old, y2old, [f2, f2old, cx, cy]);
	}
	var t = Math.tan((f2 - f1) / 4);
	var hx = 4 / 3 * rx * t;
	var hy = 4 / 3 * ry * t;
	var curve = [
		2 * x1 - (x1 + hx * Math.sin(f1)),
		2 * y1 - (y1 - hy * Math.cos(f1)),
		x2 + hx * Math.sin(f2),
		y2 - hy * Math.cos(f2),
		x2,
		y2
	];
	if (recursive) return curve
	if (res) curve = curve.concat(res);
	for (var i = 0; i < curve.length;) {
		var rot = rotate(curve[i], curve[i+1], angle);
		curve[i++] = rot.x;
		curve[i++] = rot.y;
	}
	return curve
}

function rotate(x, y, rad){
	return {
		x: x * Math.cos(rad) - y * Math.sin(rad),
		y: x * Math.sin(rad) + y * Math.cos(rad)
	}
}

function radians(degress){
	return degress * (π / 180)
}

var index$9 = function vec2Copy(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    return out
};

var bezier$1 = index$3;
var abs = index$5;
var norm = index$7;
var copy = index$9;

function set$3(out, x, y) {
    out[0] = x;
    out[1] = y;
    return out
}

var tmp1 = [0,0];
var tmp2 = [0,0];
var tmp3 = [0,0];

function bezierTo(points, scale, start, seg) {
    bezier$1(start, 
        set$3(tmp1, seg[1], seg[2]), 
        set$3(tmp2, seg[3], seg[4]),
        set$3(tmp3, seg[5], seg[6]), scale, points);
}

var index$2 = function contours(svg, scale) {
    var paths = [];

    var points = [];
    var pen = [0, 0];
    norm(abs(svg)).forEach(function(segment, i, self) {
        if (segment[0] === 'M') {
            copy(pen, segment.slice(1));
            if (points.length>0) {
                paths.push(points);
                points = [];
            }
        } else if (segment[0] === 'C') {
            bezierTo(points, scale, pen, segment);
            set$3(pen, segment[5], segment[6]);
        } else {
            throw new Error('illegal type in SVG: '+segment[0])
        }
    });
    if (points.length>0)
        paths.push(points);
    return paths
};

/*
** SGI FREE SOFTWARE LICENSE B (Version 2.0, Sept. 18, 2008) 
** Copyright (C) [dates of first publication] Silicon Graphics, Inc.
** All Rights Reserved.
**
** Permission is hereby granted, free of charge, to any person obtaining a copy
** of this software and associated documentation files (the "Software"), to deal
** in the Software without restriction, including without limitation the rights
** to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
** of the Software, and to permit persons to whom the Software is furnished to do so,
** subject to the following conditions:
** 
** The above copyright notice including the dates of first publication and either this
** permission notice or a reference to http://oss.sgi.com/projects/FreeB/ shall be
** included in all copies or substantial portions of the Software. 
**
** THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
** INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
** PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL SILICON GRAPHICS, INC.
** BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
** TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE
** OR OTHER DEALINGS IN THE SOFTWARE.
** 
** Except as contained in this notice, the name of Silicon Graphics, Inc. shall not
** be used in advertising or otherwise to promote the sale, use or other dealings in
** this Software without prior written authorization from Silicon Graphics, Inc.
*/
/*
** Author: Mikko Mononen, Aug 2013.
** The code is based on GLU libtess by Eric Veach, July 1994
*/

	/* Public API */

	var Tess2$1 = {};

	var tess2 = Tess2$1;
	
	Tess2$1.WINDING_ODD = 0;
	Tess2$1.WINDING_NONZERO = 1;
	Tess2$1.WINDING_POSITIVE = 2;
	Tess2$1.WINDING_NEGATIVE = 3;
	Tess2$1.WINDING_ABS_GEQ_TWO = 4;

	Tess2$1.POLYGONS = 0;
	Tess2$1.CONNECTED_POLYGONS = 1;
	Tess2$1.BOUNDARY_CONTOURS = 2;

	Tess2$1.tesselate = function(opts) {
		var debug =  opts.debug || false;
		var tess = new Tesselator();
		for (var i = 0; i < opts.contours.length; i++) {
			tess.addContour(opts.vertexSize || 2, opts.contours[i]);
		}
		tess.tesselate(opts.windingRule || Tess2$1.WINDING_ODD,
					   opts.elementType || Tess2$1.POLYGONS,
					   opts.polySize || 3,
					   opts.vertexSize || 2,
					   opts.normal || [0,0,1]);
		return {
			vertices: tess.vertices,
			vertexIndices: tess.vertexIndices,
			vertexCount: tess.vertexCount,
			elements: tess.elements,
			elementCount: tess.elementCount,
			mesh: debug ? tess.mesh : undefined
		};
	};

	/* Internal */

	var assert = function(cond) {
		if (!cond) {
			throw "Assertion Failed!";
		}
	};

	/* The mesh structure is similar in spirit, notation, and operations
	* to the "quad-edge" structure (see L. Guibas and J. Stolfi, Primitives
	* for the manipulation of general subdivisions and the computation of
	* Voronoi diagrams, ACM Transactions on Graphics, 4(2):74-123, April 1985).
	* For a simplified description, see the course notes for CS348a,
	* "Mathematical Foundations of Computer Graphics", available at the
	* Stanford bookstore (and taught during the fall quarter).
	* The implementation also borrows a tiny subset of the graph-based approach
	* use in Mantyla's Geometric Work Bench (see M. Mantyla, An Introduction
	* to Sold Modeling, Computer Science Press, Rockville, Maryland, 1988).
	*
	* The fundamental data structure is the "half-edge".  Two half-edges
	* go together to make an edge, but they point in opposite directions.
	* Each half-edge has a pointer to its mate (the "symmetric" half-edge Sym),
	* its origin vertex (Org), the face on its left side (Lface), and the
	* adjacent half-edges in the CCW direction around the origin vertex
	* (Onext) and around the left face (Lnext).  There is also a "next"
	* pointer for the global edge list (see below).
	*
	* The notation used for mesh navigation:
	*  Sym   = the mate of a half-edge (same edge, but opposite direction)
	*  Onext = edge CCW around origin vertex (keep same origin)
	*  Dnext = edge CCW around destination vertex (keep same dest)
	*  Lnext = edge CCW around left face (dest becomes new origin)
	*  Rnext = edge CCW around right face (origin becomes new dest)
	*
	* "prev" means to substitute CW for CCW in the definitions above.
	*
	* The mesh keeps global lists of all vertices, faces, and edges,
	* stored as doubly-linked circular lists with a dummy header node.
	* The mesh stores pointers to these dummy headers (vHead, fHead, eHead).
	*
	* The circular edge list is special; since half-edges always occur
	* in pairs (e and e->Sym), each half-edge stores a pointer in only
	* one direction.  Starting at eHead and following the e->next pointers
	* will visit each *edge* once (ie. e or e->Sym, but not both).
	* e->Sym stores a pointer in the opposite direction, thus it is
	* always true that e->Sym->next->Sym->next == e.
	*
	* Each vertex has a pointer to next and previous vertices in the
	* circular list, and a pointer to a half-edge with this vertex as
	* the origin (NULL if this is the dummy header).  There is also a
	* field "data" for client data.
	*
	* Each face has a pointer to the next and previous faces in the
	* circular list, and a pointer to a half-edge with this face as
	* the left face (NULL if this is the dummy header).  There is also
	* a field "data" for client data.
	*
	* Note that what we call a "face" is really a loop; faces may consist
	* of more than one loop (ie. not simply connected), but there is no
	* record of this in the data structure.  The mesh may consist of
	* several disconnected regions, so it may not be possible to visit
	* the entire mesh by starting at a half-edge and traversing the edge
	* structure.
	*
	* The mesh does NOT support isolated vertices; a vertex is deleted along
	* with its last edge.  Similarly when two faces are merged, one of the
	* faces is deleted (see tessMeshDelete below).  For mesh operations,
	* all face (loop) and vertex pointers must not be NULL.  However, once
	* mesh manipulation is finished, TESSmeshZapFace can be used to delete
	* faces of the mesh, one at a time.  All external faces can be "zapped"
	* before the mesh is returned to the client; then a NULL face indicates
	* a region which is not part of the output polygon.
	*/

	function TESSvertex() {
		this.next = null;	/* next vertex (never NULL) */
		this.prev = null;	/* previous vertex (never NULL) */
		this.anEdge = null;	/* a half-edge with this origin */

		/* Internal data (keep hidden) */
		this.coords = [0,0,0];	/* vertex location in 3D */
		this.s = 0.0;
		this.t = 0.0;			/* projection onto the sweep plane */
		this.pqHandle = 0;		/* to allow deletion from priority queue */
		this.n = 0;				/* to allow identify unique vertices */
		this.idx = 0;			/* to allow map result to original verts */
	} 

	function TESSface() {
		this.next = null;		/* next face (never NULL) */
		this.prev = null;		/* previous face (never NULL) */
		this.anEdge = null;		/* a half edge with this left face */

		/* Internal data (keep hidden) */
		this.trail = null;		/* "stack" for conversion to strips */
		this.n = 0;				/* to allow identiy unique faces */
		this.marked = false;	/* flag for conversion to strips */
		this.inside = false;	/* this face is in the polygon interior */
	}

	function TESShalfEdge(side) {
		this.next = null;		/* doubly-linked list (prev==Sym->next) */
		this.Sym = null;		/* same edge, opposite direction */
		this.Onext = null;		/* next edge CCW around origin */
		this.Lnext = null;		/* next edge CCW around left face */
		this.Org = null;		/* origin vertex (Overtex too long) */
		this.Lface = null;		/* left face */

		/* Internal data (keep hidden) */
		this.activeRegion = null;	/* a region with this upper edge (sweep.c) */
		this.winding = 0;			/* change in winding number when crossing
									   from the right face to the left face */
		this.side = side;
	}

	TESShalfEdge.prototype = {
		get Rface() { return this.Sym.Lface; },
		set Rface(v) { this.Sym.Lface = v; },
		get Dst() { return this.Sym.Org; },
		set Dst(v) { this.Sym.Org = v; },
		get Oprev() { return this.Sym.Lnext; },
		set Oprev(v) { this.Sym.Lnext = v; },
		get Lprev() { return this.Onext.Sym; },
		set Lprev(v) { this.Onext.Sym = v; },
		get Dprev() { return this.Lnext.Sym; },
		set Dprev(v) { this.Lnext.Sym = v; },
		get Rprev() { return this.Sym.Onext; },
		set Rprev(v) { this.Sym.Onext = v; },
		get Dnext() { return /*this.Rprev*/this.Sym.Onext.Sym; },  /* 3 pointers */
		set Dnext(v) { /*this.Rprev*/this.Sym.Onext.Sym = v; },  /* 3 pointers */
		get Rnext() { return /*this.Oprev*/this.Sym.Lnext.Sym; },  /* 3 pointers */
		set Rnext(v) { /*this.Oprev*/this.Sym.Lnext.Sym = v; },  /* 3 pointers */
	};



	function TESSmesh() {
		var v = new TESSvertex();
		var f = new TESSface();
		var e = new TESShalfEdge(0);
		var eSym = new TESShalfEdge(1);

		v.next = v.prev = v;
		v.anEdge = null;

		f.next = f.prev = f;
		f.anEdge = null;
		f.trail = null;
		f.marked = false;
		f.inside = false;

		e.next = e;
		e.Sym = eSym;
		e.Onext = null;
		e.Lnext = null;
		e.Org = null;
		e.Lface = null;
		e.winding = 0;
		e.activeRegion = null;

		eSym.next = eSym;
		eSym.Sym = e;
		eSym.Onext = null;
		eSym.Lnext = null;
		eSym.Org = null;
		eSym.Lface = null;
		eSym.winding = 0;
		eSym.activeRegion = null;

		this.vHead = v;		/* dummy header for vertex list */
		this.fHead = f;		/* dummy header for face list */
		this.eHead = e;		/* dummy header for edge list */
		this.eHeadSym = eSym;	/* and its symmetric counterpart */
	}

	/* The mesh operations below have three motivations: completeness,
	* convenience, and efficiency.  The basic mesh operations are MakeEdge,
	* Splice, and Delete.  All the other edge operations can be implemented
	* in terms of these.  The other operations are provided for convenience
	* and/or efficiency.
	*
	* When a face is split or a vertex is added, they are inserted into the
	* global list *before* the existing vertex or face (ie. e->Org or e->Lface).
	* This makes it easier to process all vertices or faces in the global lists
	* without worrying about processing the same data twice.  As a convenience,
	* when a face is split, the "inside" flag is copied from the old face.
	* Other internal data (v->data, v->activeRegion, f->data, f->marked,
	* f->trail, e->winding) is set to zero.
	*
	* ********************** Basic Edge Operations **************************
	*
	* tessMeshMakeEdge( mesh ) creates one edge, two vertices, and a loop.
	* The loop (face) consists of the two new half-edges.
	*
	* tessMeshSplice( eOrg, eDst ) is the basic operation for changing the
	* mesh connectivity and topology.  It changes the mesh so that
	*  eOrg->Onext <- OLD( eDst->Onext )
	*  eDst->Onext <- OLD( eOrg->Onext )
	* where OLD(...) means the value before the meshSplice operation.
	*
	* This can have two effects on the vertex structure:
	*  - if eOrg->Org != eDst->Org, the two vertices are merged together
	*  - if eOrg->Org == eDst->Org, the origin is split into two vertices
	* In both cases, eDst->Org is changed and eOrg->Org is untouched.
	*
	* Similarly (and independently) for the face structure,
	*  - if eOrg->Lface == eDst->Lface, one loop is split into two
	*  - if eOrg->Lface != eDst->Lface, two distinct loops are joined into one
	* In both cases, eDst->Lface is changed and eOrg->Lface is unaffected.
	*
	* tessMeshDelete( eDel ) removes the edge eDel.  There are several cases:
	* if (eDel->Lface != eDel->Rface), we join two loops into one; the loop
	* eDel->Lface is deleted.  Otherwise, we are splitting one loop into two;
	* the newly created loop will contain eDel->Dst.  If the deletion of eDel
	* would create isolated vertices, those are deleted as well.
	*
	* ********************** Other Edge Operations **************************
	*
	* tessMeshAddEdgeVertex( eOrg ) creates a new edge eNew such that
	* eNew == eOrg->Lnext, and eNew->Dst is a newly created vertex.
	* eOrg and eNew will have the same left face.
	*
	* tessMeshSplitEdge( eOrg ) splits eOrg into two edges eOrg and eNew,
	* such that eNew == eOrg->Lnext.  The new vertex is eOrg->Dst == eNew->Org.
	* eOrg and eNew will have the same left face.
	*
	* tessMeshConnect( eOrg, eDst ) creates a new edge from eOrg->Dst
	* to eDst->Org, and returns the corresponding half-edge eNew.
	* If eOrg->Lface == eDst->Lface, this splits one loop into two,
	* and the newly created loop is eNew->Lface.  Otherwise, two disjoint
	* loops are merged into one, and the loop eDst->Lface is destroyed.
	*
	* ************************ Other Operations *****************************
	*
	* tessMeshNewMesh() creates a new mesh with no edges, no vertices,
	* and no loops (what we usually call a "face").
	*
	* tessMeshUnion( mesh1, mesh2 ) forms the union of all structures in
	* both meshes, and returns the new mesh (the old meshes are destroyed).
	*
	* tessMeshDeleteMesh( mesh ) will free all storage for any valid mesh.
	*
	* tessMeshZapFace( fZap ) destroys a face and removes it from the
	* global face list.  All edges of fZap will have a NULL pointer as their
	* left face.  Any edges which also have a NULL pointer as their right face
	* are deleted entirely (along with any isolated vertices this produces).
	* An entire mesh can be deleted by zapping its faces, one at a time,
	* in any order.  Zapped faces cannot be used in further mesh operations!
	*
	* tessMeshCheckMesh( mesh ) checks a mesh for self-consistency.
	*/

	TESSmesh.prototype = {

		/* MakeEdge creates a new pair of half-edges which form their own loop.
		* No vertex or face structures are allocated, but these must be assigned
		* before the current edge operation is completed.
		*/
		//static TESShalfEdge *MakeEdge( TESSmesh* mesh, TESShalfEdge *eNext )
		makeEdge_: function(eNext) {
			var e = new TESShalfEdge(0);
			var eSym = new TESShalfEdge(1);

			/* Make sure eNext points to the first edge of the edge pair */
			if( eNext.Sym.side < eNext.side ) { eNext = eNext.Sym; }

			/* Insert in circular doubly-linked list before eNext.
			* Note that the prev pointer is stored in Sym->next.
			*/
			var ePrev = eNext.Sym.next;
			eSym.next = ePrev;
			ePrev.Sym.next = e;
			e.next = eNext;
			eNext.Sym.next = eSym;

			e.Sym = eSym;
			e.Onext = e;
			e.Lnext = eSym;
			e.Org = null;
			e.Lface = null;
			e.winding = 0;
			e.activeRegion = null;

			eSym.Sym = e;
			eSym.Onext = eSym;
			eSym.Lnext = e;
			eSym.Org = null;
			eSym.Lface = null;
			eSym.winding = 0;
			eSym.activeRegion = null;

			return e;
		},

		/* Splice( a, b ) is best described by the Guibas/Stolfi paper or the
		* CS348a notes (see mesh.h).  Basically it modifies the mesh so that
		* a->Onext and b->Onext are exchanged.  This can have various effects
		* depending on whether a and b belong to different face or vertex rings.
		* For more explanation see tessMeshSplice() below.
		*/
		// static void Splice( TESShalfEdge *a, TESShalfEdge *b )
		splice_: function(a, b) {
			var aOnext = a.Onext;
			var bOnext = b.Onext;
			aOnext.Sym.Lnext = b;
			bOnext.Sym.Lnext = a;
			a.Onext = bOnext;
			b.Onext = aOnext;
		},

		/* MakeVertex( newVertex, eOrig, vNext ) attaches a new vertex and makes it the
		* origin of all edges in the vertex loop to which eOrig belongs. "vNext" gives
		* a place to insert the new vertex in the global vertex list.  We insert
		* the new vertex *before* vNext so that algorithms which walk the vertex
		* list will not see the newly created vertices.
		*/
		//static void MakeVertex( TESSvertex *newVertex, TESShalfEdge *eOrig, TESSvertex *vNext )
		makeVertex_: function(newVertex, eOrig, vNext) {
			var vNew = newVertex;
			assert(vNew !== null);

			/* insert in circular doubly-linked list before vNext */
			var vPrev = vNext.prev;
			vNew.prev = vPrev;
			vPrev.next = vNew;
			vNew.next = vNext;
			vNext.prev = vNew;

			vNew.anEdge = eOrig;
			/* leave coords, s, t undefined */

			/* fix other edges on this vertex loop */
			var e = eOrig;
			do {
				e.Org = vNew;
				e = e.Onext;
			} while(e !== eOrig);
		},

		/* MakeFace( newFace, eOrig, fNext ) attaches a new face and makes it the left
		* face of all edges in the face loop to which eOrig belongs.  "fNext" gives
		* a place to insert the new face in the global face list.  We insert
		* the new face *before* fNext so that algorithms which walk the face
		* list will not see the newly created faces.
		*/
		// static void MakeFace( TESSface *newFace, TESShalfEdge *eOrig, TESSface *fNext )
		makeFace_: function(newFace, eOrig, fNext) {
			var fNew = newFace;
			assert(fNew !== null); 

			/* insert in circular doubly-linked list before fNext */
			var fPrev = fNext.prev;
			fNew.prev = fPrev;
			fPrev.next = fNew;
			fNew.next = fNext;
			fNext.prev = fNew;

			fNew.anEdge = eOrig;
			fNew.trail = null;
			fNew.marked = false;

			/* The new face is marked "inside" if the old one was.  This is a
			* convenience for the common case where a face has been split in two.
			*/
			fNew.inside = fNext.inside;

			/* fix other edges on this face loop */
			var e = eOrig;
			do {
				e.Lface = fNew;
				e = e.Lnext;
			} while(e !== eOrig);
		},

		/* KillEdge( eDel ) destroys an edge (the half-edges eDel and eDel->Sym),
		* and removes from the global edge list.
		*/
		//static void KillEdge( TESSmesh *mesh, TESShalfEdge *eDel )
		killEdge_: function(eDel) {
			/* Half-edges are allocated in pairs, see EdgePair above */
			if( eDel.Sym.side < eDel.side ) { eDel = eDel.Sym; }

			/* delete from circular doubly-linked list */
			var eNext = eDel.next;
			var ePrev = eDel.Sym.next;
			eNext.Sym.next = ePrev;
			ePrev.Sym.next = eNext;
		},


		/* KillVertex( vDel ) destroys a vertex and removes it from the global
		* vertex list.  It updates the vertex loop to point to a given new vertex.
		*/
		//static void KillVertex( TESSmesh *mesh, TESSvertex *vDel, TESSvertex *newOrg )
		killVertex_: function(vDel, newOrg) {
			var eStart = vDel.anEdge;
			/* change the origin of all affected edges */
			var e = eStart;
			do {
				e.Org = newOrg;
				e = e.Onext;
			} while(e !== eStart);

			/* delete from circular doubly-linked list */
			var vPrev = vDel.prev;
			var vNext = vDel.next;
			vNext.prev = vPrev;
			vPrev.next = vNext;
		},

		/* KillFace( fDel ) destroys a face and removes it from the global face
		* list.  It updates the face loop to point to a given new face.
		*/
		//static void KillFace( TESSmesh *mesh, TESSface *fDel, TESSface *newLface )
		killFace_: function(fDel, newLface) {
			var eStart = fDel.anEdge;

			/* change the left face of all affected edges */
			var e = eStart;
			do {
				e.Lface = newLface;
				e = e.Lnext;
			} while(e !== eStart);

			/* delete from circular doubly-linked list */
			var fPrev = fDel.prev;
			var fNext = fDel.next;
			fNext.prev = fPrev;
			fPrev.next = fNext;
		},

		/****************** Basic Edge Operations **********************/

		/* tessMeshMakeEdge creates one edge, two vertices, and a loop (face).
		* The loop consists of the two new half-edges.
		*/
		//TESShalfEdge *tessMeshMakeEdge( TESSmesh *mesh )
		makeEdge: function() {
			var newVertex1 = new TESSvertex();
			var newVertex2 = new TESSvertex();
			var newFace = new TESSface();
			var e = this.makeEdge_( this.eHead);
			this.makeVertex_( newVertex1, e, this.vHead );
			this.makeVertex_( newVertex2, e.Sym, this.vHead );
			this.makeFace_( newFace, e, this.fHead );
			return e;
		},

		/* tessMeshSplice( eOrg, eDst ) is the basic operation for changing the
		* mesh connectivity and topology.  It changes the mesh so that
		*	eOrg->Onext <- OLD( eDst->Onext )
		*	eDst->Onext <- OLD( eOrg->Onext )
		* where OLD(...) means the value before the meshSplice operation.
		*
		* This can have two effects on the vertex structure:
		*  - if eOrg->Org != eDst->Org, the two vertices are merged together
		*  - if eOrg->Org == eDst->Org, the origin is split into two vertices
		* In both cases, eDst->Org is changed and eOrg->Org is untouched.
		*
		* Similarly (and independently) for the face structure,
		*  - if eOrg->Lface == eDst->Lface, one loop is split into two
		*  - if eOrg->Lface != eDst->Lface, two distinct loops are joined into one
		* In both cases, eDst->Lface is changed and eOrg->Lface is unaffected.
		*
		* Some special cases:
		* If eDst == eOrg, the operation has no effect.
		* If eDst == eOrg->Lnext, the new face will have a single edge.
		* If eDst == eOrg->Lprev, the old face will have a single edge.
		* If eDst == eOrg->Onext, the new vertex will have a single edge.
		* If eDst == eOrg->Oprev, the old vertex will have a single edge.
		*/
		//int tessMeshSplice( TESSmesh* mesh, TESShalfEdge *eOrg, TESShalfEdge *eDst )
		splice: function(eOrg, eDst) {
			var joiningLoops = false;
			var joiningVertices = false;

			if( eOrg === eDst ) return;

			if( eDst.Org !== eOrg.Org ) {
				/* We are merging two disjoint vertices -- destroy eDst->Org */
				joiningVertices = true;
				this.killVertex_( eDst.Org, eOrg.Org );
			}
			if( eDst.Lface !== eOrg.Lface ) {
				/* We are connecting two disjoint loops -- destroy eDst->Lface */
				joiningLoops = true;
				this.killFace_( eDst.Lface, eOrg.Lface );
			}

			/* Change the edge structure */
			this.splice_( eDst, eOrg );

			if( ! joiningVertices ) {
				var newVertex = new TESSvertex();

				/* We split one vertex into two -- the new vertex is eDst->Org.
				* Make sure the old vertex points to a valid half-edge.
				*/
				this.makeVertex_( newVertex, eDst, eOrg.Org );
				eOrg.Org.anEdge = eOrg;
			}
			if( ! joiningLoops ) {
				var newFace = new TESSface();  

				/* We split one loop into two -- the new loop is eDst->Lface.
				* Make sure the old face points to a valid half-edge.
				*/
				this.makeFace_( newFace, eDst, eOrg.Lface );
				eOrg.Lface.anEdge = eOrg;
			}
		},

		/* tessMeshDelete( eDel ) removes the edge eDel.  There are several cases:
		* if (eDel->Lface != eDel->Rface), we join two loops into one; the loop
		* eDel->Lface is deleted.  Otherwise, we are splitting one loop into two;
		* the newly created loop will contain eDel->Dst.  If the deletion of eDel
		* would create isolated vertices, those are deleted as well.
		*
		* This function could be implemented as two calls to tessMeshSplice
		* plus a few calls to memFree, but this would allocate and delete
		* unnecessary vertices and faces.
		*/
		//int tessMeshDelete( TESSmesh *mesh, TESShalfEdge *eDel )
		delete: function(eDel) {
			var eDelSym = eDel.Sym;
			var joiningLoops = false;

			/* First step: disconnect the origin vertex eDel->Org.  We make all
			* changes to get a consistent mesh in this "intermediate" state.
			*/
			if( eDel.Lface !== eDel.Rface ) {
				/* We are joining two loops into one -- remove the left face */
				joiningLoops = true;
				this.killFace_( eDel.Lface, eDel.Rface );
			}

			if( eDel.Onext === eDel ) {
				this.killVertex_( eDel.Org, null );
			} else {
				/* Make sure that eDel->Org and eDel->Rface point to valid half-edges */
				eDel.Rface.anEdge = eDel.Oprev;
				eDel.Org.anEdge = eDel.Onext;

				this.splice_( eDel, eDel.Oprev );
				if( ! joiningLoops ) {
					var newFace = new TESSface();

					/* We are splitting one loop into two -- create a new loop for eDel. */
					this.makeFace_( newFace, eDel, eDel.Lface );
				}
			}

			/* Claim: the mesh is now in a consistent state, except that eDel->Org
			* may have been deleted.  Now we disconnect eDel->Dst.
			*/
			if( eDelSym.Onext === eDelSym ) {
				this.killVertex_( eDelSym.Org, null );
				this.killFace_( eDelSym.Lface, null );
			} else {
				/* Make sure that eDel->Dst and eDel->Lface point to valid half-edges */
				eDel.Lface.anEdge = eDelSym.Oprev;
				eDelSym.Org.anEdge = eDelSym.Onext;
				this.splice_( eDelSym, eDelSym.Oprev );
			}

			/* Any isolated vertices or faces have already been freed. */
			this.killEdge_( eDel );
		},

		/******************** Other Edge Operations **********************/

		/* All these routines can be implemented with the basic edge
		* operations above.  They are provided for convenience and efficiency.
		*/


		/* tessMeshAddEdgeVertex( eOrg ) creates a new edge eNew such that
		* eNew == eOrg->Lnext, and eNew->Dst is a newly created vertex.
		* eOrg and eNew will have the same left face.
		*/
		// TESShalfEdge *tessMeshAddEdgeVertex( TESSmesh *mesh, TESShalfEdge *eOrg );
		addEdgeVertex: function(eOrg) {
			var eNew = this.makeEdge_( eOrg );
			var eNewSym = eNew.Sym;

			/* Connect the new edge appropriately */
			this.splice_( eNew, eOrg.Lnext );

			/* Set the vertex and face information */
			eNew.Org = eOrg.Dst;

			var newVertex = new TESSvertex();
			this.makeVertex_( newVertex, eNewSym, eNew.Org );

			eNew.Lface = eNewSym.Lface = eOrg.Lface;

			return eNew;
		},


		/* tessMeshSplitEdge( eOrg ) splits eOrg into two edges eOrg and eNew,
		* such that eNew == eOrg->Lnext.  The new vertex is eOrg->Dst == eNew->Org.
		* eOrg and eNew will have the same left face.
		*/
		// TESShalfEdge *tessMeshSplitEdge( TESSmesh *mesh, TESShalfEdge *eOrg );
		splitEdge: function(eOrg, eDst) {
			var tempHalfEdge = this.addEdgeVertex( eOrg );
			var eNew = tempHalfEdge.Sym;

			/* Disconnect eOrg from eOrg->Dst and connect it to eNew->Org */
			this.splice_( eOrg.Sym, eOrg.Sym.Oprev );
			this.splice_( eOrg.Sym, eNew );

			/* Set the vertex and face information */
			eOrg.Dst = eNew.Org;
			eNew.Dst.anEdge = eNew.Sym;	/* may have pointed to eOrg->Sym */
			eNew.Rface = eOrg.Rface;
			eNew.winding = eOrg.winding;	/* copy old winding information */
			eNew.Sym.winding = eOrg.Sym.winding;

			return eNew;
		},


		/* tessMeshConnect( eOrg, eDst ) creates a new edge from eOrg->Dst
		* to eDst->Org, and returns the corresponding half-edge eNew.
		* If eOrg->Lface == eDst->Lface, this splits one loop into two,
		* and the newly created loop is eNew->Lface.  Otherwise, two disjoint
		* loops are merged into one, and the loop eDst->Lface is destroyed.
		*
		* If (eOrg == eDst), the new face will have only two edges.
		* If (eOrg->Lnext == eDst), the old face is reduced to a single edge.
		* If (eOrg->Lnext->Lnext == eDst), the old face is reduced to two edges.
		*/

		// TESShalfEdge *tessMeshConnect( TESSmesh *mesh, TESShalfEdge *eOrg, TESShalfEdge *eDst );
		connect: function(eOrg, eDst) {
			var joiningLoops = false;  
			var eNew = this.makeEdge_( eOrg );
			var eNewSym = eNew.Sym;

			if( eDst.Lface !== eOrg.Lface ) {
				/* We are connecting two disjoint loops -- destroy eDst->Lface */
				joiningLoops = true;
				this.killFace_( eDst.Lface, eOrg.Lface );
			}

			/* Connect the new edge appropriately */
			this.splice_( eNew, eOrg.Lnext );
			this.splice_( eNewSym, eDst );

			/* Set the vertex and face information */
			eNew.Org = eOrg.Dst;
			eNewSym.Org = eDst.Org;
			eNew.Lface = eNewSym.Lface = eOrg.Lface;

			/* Make sure the old face points to a valid half-edge */
			eOrg.Lface.anEdge = eNewSym;

			if( ! joiningLoops ) {
				var newFace = new TESSface();
				/* We split one loop into two -- the new loop is eNew->Lface */
				this.makeFace_( newFace, eNew, eOrg.Lface );
			}
			return eNew;
		},

		/* tessMeshZapFace( fZap ) destroys a face and removes it from the
		* global face list.  All edges of fZap will have a NULL pointer as their
		* left face.  Any edges which also have a NULL pointer as their right face
		* are deleted entirely (along with any isolated vertices this produces).
		* An entire mesh can be deleted by zapping its faces, one at a time,
		* in any order.  Zapped faces cannot be used in further mesh operations!
		*/
		zapFace: function( fZap )
		{
			var eStart = fZap.anEdge;
			var e, eNext, eSym;
			var fPrev, fNext;

			/* walk around face, deleting edges whose right face is also NULL */
			eNext = eStart.Lnext;
			do {
				e = eNext;
				eNext = e.Lnext;

				e.Lface = null;
				if( e.Rface === null ) {
					/* delete the edge -- see TESSmeshDelete above */

					if( e.Onext === e ) {
						this.killVertex_( e.Org, null );
					} else {
						/* Make sure that e->Org points to a valid half-edge */
						e.Org.anEdge = e.Onext;
						this.splice_( e, e.Oprev );
					}
					eSym = e.Sym;
					if( eSym.Onext === eSym ) {
						this.killVertex_( eSym.Org, null );
					} else {
						/* Make sure that eSym->Org points to a valid half-edge */
						eSym.Org.anEdge = eSym.Onext;
						this.splice_( eSym, eSym.Oprev );
					}
					this.killEdge_( e );
				}
			} while( e != eStart );

			/* delete from circular doubly-linked list */
			fPrev = fZap.prev;
			fNext = fZap.next;
			fNext.prev = fPrev;
			fPrev.next = fNext;
		},

		countFaceVerts_: function(f) {
			var eCur = f.anEdge;
			var n = 0;
			do
			{
				n++;
				eCur = eCur.Lnext;
			}
			while (eCur !== f.anEdge);
			return n;
		},

		//int tessMeshMergeConvexFaces( TESSmesh *mesh, int maxVertsPerFace )
		mergeConvexFaces: function(maxVertsPerFace) {
			var f;
			var eCur, eNext, eSym;
			var vStart;
			var curNv, symNv;

			for( f = this.fHead.next; f !== this.fHead; f = f.next )
			{
				// Skip faces which are outside the result.
				if( !f.inside )
					continue;

				eCur = f.anEdge;
				vStart = eCur.Org;
					
				while (true)
				{
					eNext = eCur.Lnext;
					eSym = eCur.Sym;

					// Try to merge if the neighbour face is valid.
					if( eSym && eSym.Lface && eSym.Lface.inside )
					{
						// Try to merge the neighbour faces if the resulting polygons
						// does not exceed maximum number of vertices.
						curNv = this.countFaceVerts_( f );
						symNv = this.countFaceVerts_( eSym.Lface );
						if( (curNv+symNv-2) <= maxVertsPerFace )
						{
							// Merge if the resulting poly is convex.
							if( Geom.vertCCW( eCur.Lprev.Org, eCur.Org, eSym.Lnext.Lnext.Org ) &&
								Geom.vertCCW( eSym.Lprev.Org, eSym.Org, eCur.Lnext.Lnext.Org ) )
							{
								eNext = eSym.Lnext;
								this.delete( eSym );
								eCur = null;
								eSym = null;
							}
						}
					}
					
					if( eCur && eCur.Lnext.Org === vStart )
						break;
						
					// Continue to next edge.
					eCur = eNext;
				}
			}
			
			return true;
		},

		/* tessMeshCheckMesh( mesh ) checks a mesh for self-consistency.
		*/
		check: function() {
			var fHead = this.fHead;
			var vHead = this.vHead;
			var eHead = this.eHead;
			var f, fPrev, v, vPrev, e, ePrev;

			fPrev = fHead;
			for( fPrev = fHead ; (f = fPrev.next) !== fHead; fPrev = f) {
				assert( f.prev === fPrev );
				e = f.anEdge;
				do {
					assert( e.Sym !== e );
					assert( e.Sym.Sym === e );
					assert( e.Lnext.Onext.Sym === e );
					assert( e.Onext.Sym.Lnext === e );
					assert( e.Lface === f );
					e = e.Lnext;
				} while( e !== f.anEdge );
			}
			assert( f.prev === fPrev && f.anEdge === null );

			vPrev = vHead;
			for( vPrev = vHead ; (v = vPrev.next) !== vHead; vPrev = v) {
				assert( v.prev === vPrev );
				e = v.anEdge;
				do {
					assert( e.Sym !== e );
					assert( e.Sym.Sym === e );
					assert( e.Lnext.Onext.Sym === e );
					assert( e.Onext.Sym.Lnext === e );
					assert( e.Org === v );
					e = e.Onext;
				} while( e !== v.anEdge );
			}
			assert( v.prev === vPrev && v.anEdge === null );

			ePrev = eHead;
			for( ePrev = eHead ; (e = ePrev.next) !== eHead; ePrev = e) {
				assert( e.Sym.next === ePrev.Sym );
				assert( e.Sym !== e );
				assert( e.Sym.Sym === e );
				assert( e.Org !== null );
				assert( e.Dst !== null );
				assert( e.Lnext.Onext.Sym === e );
				assert( e.Onext.Sym.Lnext === e );
			}
			assert( e.Sym.next === ePrev.Sym
				&& e.Sym === this.eHeadSym
				&& e.Sym.Sym === e
				&& e.Org === null && e.Dst === null
				&& e.Lface === null && e.Rface === null );
		}

	};

	var Geom = {};

	Geom.vertEq = function(u,v) {
		return (u.s === v.s && u.t === v.t);
	};

	/* Returns TRUE if u is lexicographically <= v. */
	Geom.vertLeq = function(u,v) {
		return ((u.s < v.s) || (u.s === v.s && u.t <= v.t));
	};

	/* Versions of VertLeq, EdgeSign, EdgeEval with s and t transposed. */
	Geom.transLeq = function(u,v) {
		return ((u.t < v.t) || (u.t === v.t && u.s <= v.s));
	};

	Geom.edgeGoesLeft = function(e) {
		return Geom.vertLeq( e.Dst, e.Org );
	};

	Geom.edgeGoesRight = function(e) {
		return Geom.vertLeq( e.Org, e.Dst );
	};

	Geom.vertL1dist = function(u,v) {
		return (Math.abs(u.s - v.s) + Math.abs(u.t - v.t));
	};

	//TESSreal tesedgeEval( TESSvertex *u, TESSvertex *v, TESSvertex *w )
	Geom.edgeEval = function( u, v, w ) {
		/* Given three vertices u,v,w such that VertLeq(u,v) && VertLeq(v,w),
		* evaluates the t-coord of the edge uw at the s-coord of the vertex v.
		* Returns v->t - (uw)(v->s), ie. the signed distance from uw to v.
		* If uw is vertical (and thus passes thru v), the result is zero.
		*
		* The calculation is extremely accurate and stable, even when v
		* is very close to u or w.  In particular if we set v->t = 0 and
		* let r be the negated result (this evaluates (uw)(v->s)), then
		* r is guaranteed to satisfy MIN(u->t,w->t) <= r <= MAX(u->t,w->t).
		*/
		assert( Geom.vertLeq( u, v ) && Geom.vertLeq( v, w ));

		var gapL = v.s - u.s;
		var gapR = w.s - v.s;

		if( gapL + gapR > 0.0 ) {
			if( gapL < gapR ) {
				return (v.t - u.t) + (u.t - w.t) * (gapL / (gapL + gapR));
			} else {
				return (v.t - w.t) + (w.t - u.t) * (gapR / (gapL + gapR));
			}
		}
		/* vertical line */
		return 0.0;
	};

	//TESSreal tesedgeSign( TESSvertex *u, TESSvertex *v, TESSvertex *w )
	Geom.edgeSign = function( u, v, w ) {
		/* Returns a number whose sign matches EdgeEval(u,v,w) but which
		* is cheaper to evaluate.  Returns > 0, == 0 , or < 0
		* as v is above, on, or below the edge uw.
		*/
		assert( Geom.vertLeq( u, v ) && Geom.vertLeq( v, w ));

		var gapL = v.s - u.s;
		var gapR = w.s - v.s;

		if( gapL + gapR > 0.0 ) {
			return (v.t - w.t) * gapL + (v.t - u.t) * gapR;
		}
		/* vertical line */
		return 0.0;
	};


	/***********************************************************************
	* Define versions of EdgeSign, EdgeEval with s and t transposed.
	*/

	//TESSreal testransEval( TESSvertex *u, TESSvertex *v, TESSvertex *w )
	Geom.transEval = function( u, v, w ) {
		/* Given three vertices u,v,w such that TransLeq(u,v) && TransLeq(v,w),
		* evaluates the t-coord of the edge uw at the s-coord of the vertex v.
		* Returns v->s - (uw)(v->t), ie. the signed distance from uw to v.
		* If uw is vertical (and thus passes thru v), the result is zero.
		*
		* The calculation is extremely accurate and stable, even when v
		* is very close to u or w.  In particular if we set v->s = 0 and
		* let r be the negated result (this evaluates (uw)(v->t)), then
		* r is guaranteed to satisfy MIN(u->s,w->s) <= r <= MAX(u->s,w->s).
		*/
		assert( Geom.transLeq( u, v ) && Geom.transLeq( v, w ));

		var gapL = v.t - u.t;
		var gapR = w.t - v.t;

		if( gapL + gapR > 0.0 ) {
			if( gapL < gapR ) {
				return (v.s - u.s) + (u.s - w.s) * (gapL / (gapL + gapR));
			} else {
				return (v.s - w.s) + (w.s - u.s) * (gapR / (gapL + gapR));
			}
		}
		/* vertical line */
		return 0.0;
	};

	//TESSreal testransSign( TESSvertex *u, TESSvertex *v, TESSvertex *w )
	Geom.transSign = function( u, v, w ) {
		/* Returns a number whose sign matches TransEval(u,v,w) but which
		* is cheaper to evaluate.  Returns > 0, == 0 , or < 0
		* as v is above, on, or below the edge uw.
		*/
		assert( Geom.transLeq( u, v ) && Geom.transLeq( v, w ));

		var gapL = v.t - u.t;
		var gapR = w.t - v.t;

		if( gapL + gapR > 0.0 ) {
			return (v.s - w.s) * gapL + (v.s - u.s) * gapR;
		}
		/* vertical line */
		return 0.0;
	};


	//int tesvertCCW( TESSvertex *u, TESSvertex *v, TESSvertex *w )
	Geom.vertCCW = function( u, v, w ) {
		/* For almost-degenerate situations, the results are not reliable.
		* Unless the floating-point arithmetic can be performed without
		* rounding errors, *any* implementation will give incorrect results
		* on some degenerate inputs, so the client must have some way to
		* handle this situation.
		*/
		return (u.s*(v.t - w.t) + v.s*(w.t - u.t) + w.s*(u.t - v.t)) >= 0.0;
	};

	/* Given parameters a,x,b,y returns the value (b*x+a*y)/(a+b),
	* or (x+y)/2 if a==b==0.  It requires that a,b >= 0, and enforces
	* this in the rare case that one argument is slightly negative.
	* The implementation is extremely stable numerically.
	* In particular it guarantees that the result r satisfies
	* MIN(x,y) <= r <= MAX(x,y), and the results are very accurate
	* even when a and b differ greatly in magnitude.
	*/
	Geom.interpolate = function(a,x,b,y) {
		return (a = (a < 0) ? 0 : a, b = (b < 0) ? 0 : b, ((a <= b) ? ((b == 0) ? ((x+y) / 2) : (x + (y-x) * (a/(a+b)))) : (y + (x-y) * (b/(a+b)))));
	};

	/*
	#ifndef FOR_TRITE_TEST_PROGRAM
	#define Interpolate(a,x,b,y)	RealInterpolate(a,x,b,y)
	#else

	// Claim: the ONLY property the sweep algorithm relies on is that
	// MIN(x,y) <= r <= MAX(x,y).  This is a nasty way to test that.
	#include <stdlib.h>
	extern int RandomInterpolate;

	double Interpolate( double a, double x, double b, double y)
	{
		printf("*********************%d\n",RandomInterpolate);
		if( RandomInterpolate ) {
			a = 1.2 * drand48() - 0.1;
			a = (a < 0) ? 0 : ((a > 1) ? 1 : a);
			b = 1.0 - a;
		}
		return RealInterpolate(a,x,b,y);
	}
	#endif*/

	Geom.intersect = function( o1, d1, o2, d2, v ) {
		/* Given edges (o1,d1) and (o2,d2), compute their point of intersection.
		* The computed point is guaranteed to lie in the intersection of the
		* bounding rectangles defined by each edge.
		*/
		var z1, z2;
		var t;

		/* This is certainly not the most efficient way to find the intersection
		* of two line segments, but it is very numerically stable.
		*
		* Strategy: find the two middle vertices in the VertLeq ordering,
		* and interpolate the intersection s-value from these.  Then repeat
		* using the TransLeq ordering to find the intersection t-value.
		*/

		if( ! Geom.vertLeq( o1, d1 )) { t = o1; o1 = d1; d1 = t; } //swap( o1, d1 ); }
		if( ! Geom.vertLeq( o2, d2 )) { t = o2; o2 = d2; d2 = t; } //swap( o2, d2 ); }
		if( ! Geom.vertLeq( o1, o2 )) { t = o1; o1 = o2; o2 = t; t = d1; d1 = d2; d2 = t; }//swap( o1, o2 ); swap( d1, d2 ); }

		if( ! Geom.vertLeq( o2, d1 )) {
			/* Technically, no intersection -- do our best */
			v.s = (o2.s + d1.s) / 2;
		} else if( Geom.vertLeq( d1, d2 )) {
			/* Interpolate between o2 and d1 */
			z1 = Geom.edgeEval( o1, o2, d1 );
			z2 = Geom.edgeEval( o2, d1, d2 );
			if( z1+z2 < 0 ) { z1 = -z1; z2 = -z2; }
			v.s = Geom.interpolate( z1, o2.s, z2, d1.s );
		} else {
			/* Interpolate between o2 and d2 */
			z1 = Geom.edgeSign( o1, o2, d1 );
			z2 = -Geom.edgeSign( o1, d2, d1 );
			if( z1+z2 < 0 ) { z1 = -z1; z2 = -z2; }
			v.s = Geom.interpolate( z1, o2.s, z2, d2.s );
		}

		/* Now repeat the process for t */

		if( ! Geom.transLeq( o1, d1 )) { t = o1; o1 = d1; d1 = t; } //swap( o1, d1 ); }
		if( ! Geom.transLeq( o2, d2 )) { t = o2; o2 = d2; d2 = t; } //swap( o2, d2 ); }
		if( ! Geom.transLeq( o1, o2 )) { t = o1; o1 = o2; o2 = t; t = d1; d1 = d2; d2 = t; } //swap( o1, o2 ); swap( d1, d2 ); }

		if( ! Geom.transLeq( o2, d1 )) {
			/* Technically, no intersection -- do our best */
			v.t = (o2.t + d1.t) / 2;
		} else if( Geom.transLeq( d1, d2 )) {
			/* Interpolate between o2 and d1 */
			z1 = Geom.transEval( o1, o2, d1 );
			z2 = Geom.transEval( o2, d1, d2 );
			if( z1+z2 < 0 ) { z1 = -z1; z2 = -z2; }
			v.t = Geom.interpolate( z1, o2.t, z2, d1.t );
		} else {
			/* Interpolate between o2 and d2 */
			z1 = Geom.transSign( o1, o2, d1 );
			z2 = -Geom.transSign( o1, d2, d1 );
			if( z1+z2 < 0 ) { z1 = -z1; z2 = -z2; }
			v.t = Geom.interpolate( z1, o2.t, z2, d2.t );
		}
	};



	function DictNode() {
		this.key = null;
		this.next = null;
		this.prev = null;
	}

	function Dict(frame, leq) {
		this.head = new DictNode();
		this.head.next = this.head;
		this.head.prev = this.head;
		this.frame = frame;
		this.leq = leq;
	}

	Dict.prototype = {
		min: function() {
			return this.head.next;
		},

		max: function() {
			return this.head.prev;
		},

		insert: function(k) {
			return this.insertBefore(this.head, k);
		},

		search: function(key) {
			/* Search returns the node with the smallest key greater than or equal
			* to the given key.  If there is no such key, returns a node whose
			* key is NULL.  Similarly, Succ(Max(d)) has a NULL key, etc.
			*/
			var node = this.head;
			do {
				node = node.next;
			} while( node.key !== null && ! this.leq(this.frame, key, node.key));

			return node;
		},

		insertBefore: function(node, key) {
			do {
				node = node.prev;
			} while( node.key !== null && ! this.leq(this.frame, node.key, key));

			var newNode = new DictNode();
			newNode.key = key;
			newNode.next = node.next;
			node.next.prev = newNode;
			newNode.prev = node;
			node.next = newNode;

			return newNode;
		},

		delete: function(node) {
			node.next.prev = node.prev;
			node.prev.next = node.next;
		}
	};


	function PQnode() {
		this.handle = null;
	}

	function PQhandleElem() {
		this.key = null;
		this.node = null;
	}

	function PriorityQ(size, leq) {
		this.size = 0;
		this.max = size;

		this.nodes = [];
		this.nodes.length = size+1;
		for (var i = 0; i < this.nodes.length; i++)
			this.nodes[i] = new PQnode();

		this.handles = [];
		this.handles.length = size+1;
		for (var i = 0; i < this.handles.length; i++)
			this.handles[i] = new PQhandleElem();

		this.initialized = false;
		this.freeList = 0;
		this.leq = leq;

		this.nodes[1].handle = 1;	/* so that Minimum() returns NULL */
		this.handles[1].key = null;
	}

	PriorityQ.prototype = {

		floatDown_: function( curr )
		{
			var n = this.nodes;
			var h = this.handles;
			var hCurr, hChild;
			var child;

			hCurr = n[curr].handle;
			for( ;; ) {
				child = curr << 1;
				if( child < this.size && this.leq( h[n[child+1].handle].key, h[n[child].handle].key )) {
					++child;
				}

				assert(child <= this.max);

				hChild = n[child].handle;
				if( child > this.size || this.leq( h[hCurr].key, h[hChild].key )) {
					n[curr].handle = hCurr;
					h[hCurr].node = curr;
					break;
				}
				n[curr].handle = hChild;
				h[hChild].node = curr;
				curr = child;
			}
		},

		floatUp_: function( curr )
		{
			var n = this.nodes;
			var h = this.handles;
			var hCurr, hParent;
			var parent;

			hCurr = n[curr].handle;
			for( ;; ) {
				parent = curr >> 1;
				hParent = n[parent].handle;
				if( parent == 0 || this.leq( h[hParent].key, h[hCurr].key )) {
					n[curr].handle = hCurr;
					h[hCurr].node = curr;
					break;
				}
				n[curr].handle = hParent;
				h[hParent].node = curr;
				curr = parent;
			}
		},

		init: function() {
			/* This method of building a heap is O(n), rather than O(n lg n). */
			for( var i = this.size; i >= 1; --i ) {
				this.floatDown_( i );
			}
			this.initialized = true;
		},

		min: function() {
			return this.handles[this.nodes[1].handle].key;
		},

		isEmpty: function() {
			this.size === 0;
		},

		/* really pqHeapInsert */
		/* returns INV_HANDLE iff out of memory */
		//PQhandle pqHeapInsert( TESSalloc* alloc, PriorityQHeap *pq, PQkey keyNew )
		insert: function(keyNew)
		{
			var curr;
			var free;

			curr = ++this.size;
			if( (curr*2) > this.max ) {
				this.max *= 2;
				var s;
				s = this.nodes.length;
				this.nodes.length = this.max+1;
				for (var i = s; i < this.nodes.length; i++)
					this.nodes[i] = new PQnode();

				s = this.handles.length;
				this.handles.length = this.max+1;
				for (var i = s; i < this.handles.length; i++)
					this.handles[i] = new PQhandleElem();
			}

			if( this.freeList === 0 ) {
				free = curr;
			} else {
				free = this.freeList;
				this.freeList = this.handles[free].node;
			}

			this.nodes[curr].handle = free;
			this.handles[free].node = curr;
			this.handles[free].key = keyNew;

			if( this.initialized ) {
				this.floatUp_( curr );
			}
			return free;
		},

		//PQkey pqHeapExtractMin( PriorityQHeap *pq )
		extractMin: function() {
			var n = this.nodes;
			var h = this.handles;
			var hMin = n[1].handle;
			var min = h[hMin].key;

			if( this.size > 0 ) {
				n[1].handle = n[this.size].handle;
				h[n[1].handle].node = 1;

				h[hMin].key = null;
				h[hMin].node = this.freeList;
				this.freeList = hMin;

				--this.size;
				if( this.size > 0 ) {
					this.floatDown_( 1 );
				}
			}
			return min;
		},

		delete: function( hCurr ) {
			var n = this.nodes;
			var h = this.handles;
			var curr;

			assert( hCurr >= 1 && hCurr <= this.max && h[hCurr].key !== null );

			curr = h[hCurr].node;
			n[curr].handle = n[this.size].handle;
			h[n[curr].handle].node = curr;

			--this.size;
			if( curr <= this.size ) {
				if( curr <= 1 || this.leq( h[n[curr>>1].handle].key, h[n[curr].handle].key )) {
					this.floatDown_( curr );
				} else {
					this.floatUp_( curr );
				}
			}
			h[hCurr].key = null;
			h[hCurr].node = this.freeList;
			this.freeList = hCurr;
		}
	};


	/* For each pair of adjacent edges crossing the sweep line, there is
	* an ActiveRegion to represent the region between them.  The active
	* regions are kept in sorted order in a dynamic dictionary.  As the
	* sweep line crosses each vertex, we update the affected regions.
	*/

	function ActiveRegion() {
		this.eUp = null;		/* upper edge, directed right to left */
		this.nodeUp = null;	/* dictionary node corresponding to eUp */
		this.windingNumber = 0;	/* used to determine which regions are
								* inside the polygon */
		this.inside = false;		/* is this region inside the polygon? */
		this.sentinel = false;	/* marks fake edges at t = +/-infinity */
		this.dirty = false;		/* marks regions where the upper or lower
						* edge has changed, but we haven't checked
						* whether they intersect yet */
		this.fixUpperEdge = false;	/* marks temporary edges introduced when
							* we process a "right vertex" (one without
							* any edges leaving to the right) */
	}

	var Sweep = {};

	Sweep.regionBelow = function(r) {
		return r.nodeUp.prev.key;
	};

	Sweep.regionAbove = function(r) {
		return r.nodeUp.next.key;
	};

	Sweep.debugEvent = function( tess ) {
		// empty
	};


	/*
	* Invariants for the Edge Dictionary.
	* - each pair of adjacent edges e2=Succ(e1) satisfies EdgeLeq(e1,e2)
	*   at any valid location of the sweep event
	* - if EdgeLeq(e2,e1) as well (at any valid sweep event), then e1 and e2
	*   share a common endpoint
	* - for each e, e->Dst has been processed, but not e->Org
	* - each edge e satisfies VertLeq(e->Dst,event) && VertLeq(event,e->Org)
	*   where "event" is the current sweep line event.
	* - no edge e has zero length
	*
	* Invariants for the Mesh (the processed portion).
	* - the portion of the mesh left of the sweep line is a planar graph,
	*   ie. there is *some* way to embed it in the plane
	* - no processed edge has zero length
	* - no two processed vertices have identical coordinates
	* - each "inside" region is monotone, ie. can be broken into two chains
	*   of monotonically increasing vertices according to VertLeq(v1,v2)
	*   - a non-invariant: these chains may intersect (very slightly)
	*
	* Invariants for the Sweep.
	* - if none of the edges incident to the event vertex have an activeRegion
	*   (ie. none of these edges are in the edge dictionary), then the vertex
	*   has only right-going edges.
	* - if an edge is marked "fixUpperEdge" (it is a temporary edge introduced
	*   by ConnectRightVertex), then it is the only right-going edge from
	*   its associated vertex.  (This says that these edges exist only
	*   when it is necessary.)
	*/

	/* When we merge two edges into one, we need to compute the combined
	* winding of the new edge.
	*/
	Sweep.addWinding = function(eDst,eSrc) {
		eDst.winding += eSrc.winding;
		eDst.Sym.winding += eSrc.Sym.winding;
	};


	//static int EdgeLeq( TESStesselator *tess, ActiveRegion *reg1, ActiveRegion *reg2 )
	Sweep.edgeLeq = function( tess, reg1, reg2 ) {
		/*
		* Both edges must be directed from right to left (this is the canonical
		* direction for the upper edge of each region).
		*
		* The strategy is to evaluate a "t" value for each edge at the
		* current sweep line position, given by tess->event.  The calculations
		* are designed to be very stable, but of course they are not perfect.
		*
		* Special case: if both edge destinations are at the sweep event,
		* we sort the edges by slope (they would otherwise compare equally).
		*/
		var ev = tess.event;
		var t1, t2;

		var e1 = reg1.eUp;
		var e2 = reg2.eUp;

		if( e1.Dst === ev ) {
			if( e2.Dst === ev ) {
				/* Two edges right of the sweep line which meet at the sweep event.
				* Sort them by slope.
				*/
				if( Geom.vertLeq( e1.Org, e2.Org )) {
					return Geom.edgeSign( e2.Dst, e1.Org, e2.Org ) <= 0;
				}
				return Geom.edgeSign( e1.Dst, e2.Org, e1.Org ) >= 0;
			}
			return Geom.edgeSign( e2.Dst, ev, e2.Org ) <= 0;
		}
		if( e2.Dst === ev ) {
			return Geom.edgeSign( e1.Dst, ev, e1.Org ) >= 0;
		}

		/* General case - compute signed distance *from* e1, e2 to event */
		var t1 = Geom.edgeEval( e1.Dst, ev, e1.Org );
		var t2 = Geom.edgeEval( e2.Dst, ev, e2.Org );
		return (t1 >= t2);
	};


	//static void DeleteRegion( TESStesselator *tess, ActiveRegion *reg )
	Sweep.deleteRegion = function( tess, reg ) {
		if( reg.fixUpperEdge ) {
			/* It was created with zero winding number, so it better be
			* deleted with zero winding number (ie. it better not get merged
			* with a real edge).
			*/
			assert( reg.eUp.winding === 0 );
		}
		reg.eUp.activeRegion = null;
		tess.dict.delete( reg.nodeUp );
	};

	//static int FixUpperEdge( TESStesselator *tess, ActiveRegion *reg, TESShalfEdge *newEdge )
	Sweep.fixUpperEdge = function( tess, reg, newEdge ) {
		/*
		* Replace an upper edge which needs fixing (see ConnectRightVertex).
		*/
		assert( reg.fixUpperEdge );
		tess.mesh.delete( reg.eUp );
		reg.fixUpperEdge = false;
		reg.eUp = newEdge;
		newEdge.activeRegion = reg;
	};

	//static ActiveRegion *TopLeftRegion( TESStesselator *tess, ActiveRegion *reg )
	Sweep.topLeftRegion = function( tess, reg ) {
		var org = reg.eUp.Org;
		var e;

		/* Find the region above the uppermost edge with the same origin */
		do {
			reg = Sweep.regionAbove( reg );
		} while( reg.eUp.Org === org );

		/* If the edge above was a temporary edge introduced by ConnectRightVertex,
		* now is the time to fix it.
		*/
		if( reg.fixUpperEdge ) {
			e = tess.mesh.connect( Sweep.regionBelow(reg).eUp.Sym, reg.eUp.Lnext );
			if (e === null) return null;
			Sweep.fixUpperEdge( tess, reg, e );
			reg = Sweep.regionAbove( reg );
		}
		return reg;
	};

	//static ActiveRegion *TopRightRegion( ActiveRegion *reg )
	Sweep.topRightRegion = function( reg )
	{
		var dst = reg.eUp.Dst;
		var reg = null;
		/* Find the region above the uppermost edge with the same destination */
		do {
			reg = Sweep.regionAbove( reg );
		} while( reg.eUp.Dst === dst );
		return reg;
	};

	//static ActiveRegion *AddRegionBelow( TESStesselator *tess, ActiveRegion *regAbove, TESShalfEdge *eNewUp )
	Sweep.addRegionBelow = function( tess, regAbove, eNewUp ) {
		/*
		* Add a new active region to the sweep line, *somewhere* below "regAbove"
		* (according to where the new edge belongs in the sweep-line dictionary).
		* The upper edge of the new region will be "eNewUp".
		* Winding number and "inside" flag are not updated.
		*/
		var regNew = new ActiveRegion();
		regNew.eUp = eNewUp;
		regNew.nodeUp = tess.dict.insertBefore( regAbove.nodeUp, regNew );
	//	if (regNew->nodeUp == NULL) longjmp(tess->env,1);
		regNew.fixUpperEdge = false;
		regNew.sentinel = false;
		regNew.dirty = false;

		eNewUp.activeRegion = regNew;
		return regNew;
	};

	//static int IsWindingInside( TESStesselator *tess, int n )
	Sweep.isWindingInside = function( tess, n ) {
		switch( tess.windingRule ) {
			case Tess2$1.WINDING_ODD:
				return (n & 1) != 0;
			case Tess2$1.WINDING_NONZERO:
				return (n != 0);
			case Tess2$1.WINDING_POSITIVE:
				return (n > 0);
			case Tess2$1.WINDING_NEGATIVE:
				return (n < 0);
			case Tess2$1.WINDING_ABS_GEQ_TWO:
				return (n >= 2) || (n <= -2);
		}
		assert( false );
		return false;
	};

	//static void ComputeWinding( TESStesselator *tess, ActiveRegion *reg )
	Sweep.computeWinding = function( tess, reg ) {
		reg.windingNumber = Sweep.regionAbove(reg).windingNumber + reg.eUp.winding;
		reg.inside = Sweep.isWindingInside( tess, reg.windingNumber );
	};


	//static void FinishRegion( TESStesselator *tess, ActiveRegion *reg )
	Sweep.finishRegion = function( tess, reg ) {
		/*
		* Delete a region from the sweep line.  This happens when the upper
		* and lower chains of a region meet (at a vertex on the sweep line).
		* The "inside" flag is copied to the appropriate mesh face (we could
		* not do this before -- since the structure of the mesh is always
		* changing, this face may not have even existed until now).
		*/
		var e = reg.eUp;
		var f = e.Lface;

		f.inside = reg.inside;
		f.anEdge = e;   /* optimization for tessMeshTessellateMonoRegion() */
		Sweep.deleteRegion( tess, reg );
	};


	//static TESShalfEdge *FinishLeftRegions( TESStesselator *tess, ActiveRegion *regFirst, ActiveRegion *regLast )
	Sweep.finishLeftRegions = function( tess, regFirst, regLast ) {
		/*
		* We are given a vertex with one or more left-going edges.  All affected
		* edges should be in the edge dictionary.  Starting at regFirst->eUp,
		* we walk down deleting all regions where both edges have the same
		* origin vOrg.  At the same time we copy the "inside" flag from the
		* active region to the face, since at this point each face will belong
		* to at most one region (this was not necessarily true until this point
		* in the sweep).  The walk stops at the region above regLast; if regLast
		* is NULL we walk as far as possible.  At the same time we relink the
		* mesh if necessary, so that the ordering of edges around vOrg is the
		* same as in the dictionary.
		*/
		var e, ePrev;
		var reg = null;
		var regPrev = regFirst;
		var ePrev = regFirst.eUp;
		while( regPrev !== regLast ) {
			regPrev.fixUpperEdge = false;	/* placement was OK */
			reg = Sweep.regionBelow( regPrev );
			e = reg.eUp;
			if( e.Org != ePrev.Org ) {
				if( ! reg.fixUpperEdge ) {
					/* Remove the last left-going edge.  Even though there are no further
					* edges in the dictionary with this origin, there may be further
					* such edges in the mesh (if we are adding left edges to a vertex
					* that has already been processed).  Thus it is important to call
					* FinishRegion rather than just DeleteRegion.
					*/
					Sweep.finishRegion( tess, regPrev );
					break;
				}
				/* If the edge below was a temporary edge introduced by
				* ConnectRightVertex, now is the time to fix it.
				*/
				e = tess.mesh.connect( ePrev.Lprev, e.Sym );
	//			if (e == NULL) longjmp(tess->env,1);
				Sweep.fixUpperEdge( tess, reg, e );
			}

			/* Relink edges so that ePrev->Onext == e */
			if( ePrev.Onext !== e ) {
				tess.mesh.splice( e.Oprev, e );
				tess.mesh.splice( ePrev, e );
			}
			Sweep.finishRegion( tess, regPrev );	/* may change reg->eUp */
			ePrev = reg.eUp;
			regPrev = reg;
		}
		return ePrev;
	};


	//static void AddRightEdges( TESStesselator *tess, ActiveRegion *regUp, TESShalfEdge *eFirst, TESShalfEdge *eLast, TESShalfEdge *eTopLeft, int cleanUp )
	Sweep.addRightEdges = function( tess, regUp, eFirst, eLast, eTopLeft, cleanUp ) {
		/*
		* Purpose: insert right-going edges into the edge dictionary, and update
		* winding numbers and mesh connectivity appropriately.  All right-going
		* edges share a common origin vOrg.  Edges are inserted CCW starting at
		* eFirst; the last edge inserted is eLast->Oprev.  If vOrg has any
		* left-going edges already processed, then eTopLeft must be the edge
		* such that an imaginary upward vertical segment from vOrg would be
		* contained between eTopLeft->Oprev and eTopLeft; otherwise eTopLeft
		* should be NULL.
		*/
		var reg, regPrev;
		var e, ePrev;
		var firstTime = true;

		/* Insert the new right-going edges in the dictionary */
		e = eFirst;
		do {
			assert( Geom.vertLeq( e.Org, e.Dst ));
			Sweep.addRegionBelow( tess, regUp, e.Sym );
			e = e.Onext;
		} while ( e !== eLast );

		/* Walk *all* right-going edges from e->Org, in the dictionary order,
		* updating the winding numbers of each region, and re-linking the mesh
		* edges to match the dictionary ordering (if necessary).
		*/
		if( eTopLeft === null ) {
			eTopLeft = Sweep.regionBelow( regUp ).eUp.Rprev;
		}
		regPrev = regUp;
		ePrev = eTopLeft;
		for( ;; ) {
			reg = Sweep.regionBelow( regPrev );
			e = reg.eUp.Sym;
			if( e.Org !== ePrev.Org ) break;

			if( e.Onext !== ePrev ) {
				/* Unlink e from its current position, and relink below ePrev */
				tess.mesh.splice( e.Oprev, e );
				tess.mesh.splice( ePrev.Oprev, e );
			}
			/* Compute the winding number and "inside" flag for the new regions */
			reg.windingNumber = regPrev.windingNumber - e.winding;
			reg.inside = Sweep.isWindingInside( tess, reg.windingNumber );

			/* Check for two outgoing edges with same slope -- process these
			* before any intersection tests (see example in tessComputeInterior).
			*/
			regPrev.dirty = true;
			if( ! firstTime && Sweep.checkForRightSplice( tess, regPrev )) {
				Sweep.addWinding( e, ePrev );
				Sweep.deleteRegion( tess, regPrev );
				tess.mesh.delete( ePrev );
			}
			firstTime = false;
			regPrev = reg;
			ePrev = e;
		}
		regPrev.dirty = true;
		assert( regPrev.windingNumber - e.winding === reg.windingNumber );

		if( cleanUp ) {
			/* Check for intersections between newly adjacent edges. */
			Sweep.walkDirtyRegions( tess, regPrev );
		}
	};


	//static void SpliceMergeVertices( TESStesselator *tess, TESShalfEdge *e1, TESShalfEdge *e2 )
	Sweep.spliceMergeVertices = function( tess, e1, e2 ) {
		/*
		* Two vertices with idential coordinates are combined into one.
		* e1->Org is kept, while e2->Org is discarded.
		*/
		tess.mesh.splice( e1, e2 ); 
	};

	//static void VertexWeights( TESSvertex *isect, TESSvertex *org, TESSvertex *dst, TESSreal *weights )
	Sweep.vertexWeights = function( isect, org, dst ) {
		/*
		* Find some weights which describe how the intersection vertex is
		* a linear combination of "org" and "dest".  Each of the two edges
		* which generated "isect" is allocated 50% of the weight; each edge
		* splits the weight between its org and dst according to the
		* relative distance to "isect".
		*/
		var t1 = Geom.vertL1dist( org, isect );
		var t2 = Geom.vertL1dist( dst, isect );
		var w0 = 0.5 * t2 / (t1 + t2);
		var w1 = 0.5 * t1 / (t1 + t2);
		isect.coords[0] += w0*org.coords[0] + w1*dst.coords[0];
		isect.coords[1] += w0*org.coords[1] + w1*dst.coords[1];
		isect.coords[2] += w0*org.coords[2] + w1*dst.coords[2];
	};


	//static void GetIntersectData( TESStesselator *tess, TESSvertex *isect, TESSvertex *orgUp, TESSvertex *dstUp, TESSvertex *orgLo, TESSvertex *dstLo )
	Sweep.getIntersectData = function( tess, isect, orgUp, dstUp, orgLo, dstLo ) {
		 /*
		 * We've computed a new intersection point, now we need a "data" pointer
		 * from the user so that we can refer to this new vertex in the
		 * rendering callbacks.
		 */
		isect.coords[0] = isect.coords[1] = isect.coords[2] = 0;
		isect.idx = -1;
		Sweep.vertexWeights( isect, orgUp, dstUp );
		Sweep.vertexWeights( isect, orgLo, dstLo );
	};

	//static int CheckForRightSplice( TESStesselator *tess, ActiveRegion *regUp )
	Sweep.checkForRightSplice = function( tess, regUp ) {
		/*
		* Check the upper and lower edge of "regUp", to make sure that the
		* eUp->Org is above eLo, or eLo->Org is below eUp (depending on which
		* origin is leftmost).
		*
		* The main purpose is to splice right-going edges with the same
		* dest vertex and nearly identical slopes (ie. we can't distinguish
		* the slopes numerically).  However the splicing can also help us
		* to recover from numerical errors.  For example, suppose at one
		* point we checked eUp and eLo, and decided that eUp->Org is barely
		* above eLo.  Then later, we split eLo into two edges (eg. from
		* a splice operation like this one).  This can change the result of
		* our test so that now eUp->Org is incident to eLo, or barely below it.
		* We must correct this condition to maintain the dictionary invariants.
		*
		* One possibility is to check these edges for intersection again
		* (ie. CheckForIntersect).  This is what we do if possible.  However
		* CheckForIntersect requires that tess->event lies between eUp and eLo,
		* so that it has something to fall back on when the intersection
		* calculation gives us an unusable answer.  So, for those cases where
		* we can't check for intersection, this routine fixes the problem
		* by just splicing the offending vertex into the other edge.
		* This is a guaranteed solution, no matter how degenerate things get.
		* Basically this is a combinatorial solution to a numerical problem.
		*/
		var regLo = Sweep.regionBelow(regUp);
		var eUp = regUp.eUp;
		var eLo = regLo.eUp;

		if( Geom.vertLeq( eUp.Org, eLo.Org )) {
			if( Geom.edgeSign( eLo.Dst, eUp.Org, eLo.Org ) > 0 ) return false;

			/* eUp->Org appears to be below eLo */
			if( ! Geom.vertEq( eUp.Org, eLo.Org )) {
				/* Splice eUp->Org into eLo */
				tess.mesh.splitEdge( eLo.Sym );
				tess.mesh.splice( eUp, eLo.Oprev );
				regUp.dirty = regLo.dirty = true;

			} else if( eUp.Org !== eLo.Org ) {
				/* merge the two vertices, discarding eUp->Org */
				tess.pq.delete( eUp.Org.pqHandle );
				Sweep.spliceMergeVertices( tess, eLo.Oprev, eUp );
			}
		} else {
			if( Geom.edgeSign( eUp.Dst, eLo.Org, eUp.Org ) < 0 ) return false;

			/* eLo->Org appears to be above eUp, so splice eLo->Org into eUp */
			Sweep.regionAbove(regUp).dirty = regUp.dirty = true;
			tess.mesh.splitEdge( eUp.Sym );
			tess.mesh.splice( eLo.Oprev, eUp );
		}
		return true;
	};

	//static int CheckForLeftSplice( TESStesselator *tess, ActiveRegion *regUp )
	Sweep.checkForLeftSplice = function( tess, regUp ) {
		/*
		* Check the upper and lower edge of "regUp", to make sure that the
		* eUp->Dst is above eLo, or eLo->Dst is below eUp (depending on which
		* destination is rightmost).
		*
		* Theoretically, this should always be true.  However, splitting an edge
		* into two pieces can change the results of previous tests.  For example,
		* suppose at one point we checked eUp and eLo, and decided that eUp->Dst
		* is barely above eLo.  Then later, we split eLo into two edges (eg. from
		* a splice operation like this one).  This can change the result of
		* the test so that now eUp->Dst is incident to eLo, or barely below it.
		* We must correct this condition to maintain the dictionary invariants
		* (otherwise new edges might get inserted in the wrong place in the
		* dictionary, and bad stuff will happen).
		*
		* We fix the problem by just splicing the offending vertex into the
		* other edge.
		*/
		var regLo = Sweep.regionBelow(regUp);
		var eUp = regUp.eUp;
		var eLo = regLo.eUp;
		var e;

		assert( ! Geom.vertEq( eUp.Dst, eLo.Dst ));

		if( Geom.vertLeq( eUp.Dst, eLo.Dst )) {
			if( Geom.edgeSign( eUp.Dst, eLo.Dst, eUp.Org ) < 0 ) return false;

			/* eLo->Dst is above eUp, so splice eLo->Dst into eUp */
			Sweep.regionAbove(regUp).dirty = regUp.dirty = true;
			e = tess.mesh.splitEdge( eUp );
			tess.mesh.splice( eLo.Sym, e );
			e.Lface.inside = regUp.inside;
		} else {
			if( Geom.edgeSign( eLo.Dst, eUp.Dst, eLo.Org ) > 0 ) return false;

			/* eUp->Dst is below eLo, so splice eUp->Dst into eLo */
			regUp.dirty = regLo.dirty = true;
			e = tess.mesh.splitEdge( eLo );
			tess.mesh.splice( eUp.Lnext, eLo.Sym );
			e.Rface.inside = regUp.inside;
		}
		return true;
	};


	//static int CheckForIntersect( TESStesselator *tess, ActiveRegion *regUp )
	Sweep.checkForIntersect = function( tess, regUp ) {
		/*
		* Check the upper and lower edges of the given region to see if
		* they intersect.  If so, create the intersection and add it
		* to the data structures.
		*
		* Returns TRUE if adding the new intersection resulted in a recursive
		* call to AddRightEdges(); in this case all "dirty" regions have been
		* checked for intersections, and possibly regUp has been deleted.
		*/
		var regLo = Sweep.regionBelow(regUp);
		var eUp = regUp.eUp;
		var eLo = regLo.eUp;
		var orgUp = eUp.Org;
		var orgLo = eLo.Org;
		var dstUp = eUp.Dst;
		var dstLo = eLo.Dst;
		var tMinUp, tMaxLo;
		var isect = new TESSvertex, orgMin;
		var e;

		assert( ! Geom.vertEq( dstLo, dstUp ));
		assert( Geom.edgeSign( dstUp, tess.event, orgUp ) <= 0 );
		assert( Geom.edgeSign( dstLo, tess.event, orgLo ) >= 0 );
		assert( orgUp !== tess.event && orgLo !== tess.event );
		assert( ! regUp.fixUpperEdge && ! regLo.fixUpperEdge );

		if( orgUp === orgLo ) return false;	/* right endpoints are the same */

		tMinUp = Math.min( orgUp.t, dstUp.t );
		tMaxLo = Math.max( orgLo.t, dstLo.t );
		if( tMinUp > tMaxLo ) return false;	/* t ranges do not overlap */

		if( Geom.vertLeq( orgUp, orgLo )) {
			if( Geom.edgeSign( dstLo, orgUp, orgLo ) > 0 ) return false;
		} else {
			if( Geom.edgeSign( dstUp, orgLo, orgUp ) < 0 ) return false;
		}

		/* At this point the edges intersect, at least marginally */
		Sweep.debugEvent( tess );

		Geom.intersect( dstUp, orgUp, dstLo, orgLo, isect );
		/* The following properties are guaranteed: */
		assert( Math.min( orgUp.t, dstUp.t ) <= isect.t );
		assert( isect.t <= Math.max( orgLo.t, dstLo.t ));
		assert( Math.min( dstLo.s, dstUp.s ) <= isect.s );
		assert( isect.s <= Math.max( orgLo.s, orgUp.s ));

		if( Geom.vertLeq( isect, tess.event )) {
			/* The intersection point lies slightly to the left of the sweep line,
			* so move it until it''s slightly to the right of the sweep line.
			* (If we had perfect numerical precision, this would never happen
			* in the first place).  The easiest and safest thing to do is
			* replace the intersection by tess->event.
			*/
			isect.s = tess.event.s;
			isect.t = tess.event.t;
		}
		/* Similarly, if the computed intersection lies to the right of the
		* rightmost origin (which should rarely happen), it can cause
		* unbelievable inefficiency on sufficiently degenerate inputs.
		* (If you have the test program, try running test54.d with the
		* "X zoom" option turned on).
		*/
		orgMin = Geom.vertLeq( orgUp, orgLo ) ? orgUp : orgLo;
		if( Geom.vertLeq( orgMin, isect )) {
			isect.s = orgMin.s;
			isect.t = orgMin.t;
		}

		if( Geom.vertEq( isect, orgUp ) || Geom.vertEq( isect, orgLo )) {
			/* Easy case -- intersection at one of the right endpoints */
			Sweep.checkForRightSplice( tess, regUp );
			return false;
		}

		if(    (! Geom.vertEq( dstUp, tess.event )
			&& Geom.edgeSign( dstUp, tess.event, isect ) >= 0)
			|| (! Geom.vertEq( dstLo, tess.event )
			&& Geom.edgeSign( dstLo, tess.event, isect ) <= 0 ))
		{
			/* Very unusual -- the new upper or lower edge would pass on the
			* wrong side of the sweep event, or through it.  This can happen
			* due to very small numerical errors in the intersection calculation.
			*/
			if( dstLo === tess.event ) {
				/* Splice dstLo into eUp, and process the new region(s) */
				tess.mesh.splitEdge( eUp.Sym );
				tess.mesh.splice( eLo.Sym, eUp );
				regUp = Sweep.topLeftRegion( tess, regUp );
	//			if (regUp == NULL) longjmp(tess->env,1);
				eUp = Sweep.regionBelow(regUp).eUp;
				Sweep.finishLeftRegions( tess, Sweep.regionBelow(regUp), regLo );
				Sweep.addRightEdges( tess, regUp, eUp.Oprev, eUp, eUp, true );
				return TRUE;
			}
			if( dstUp === tess.event ) {
				/* Splice dstUp into eLo, and process the new region(s) */
				tess.mesh.splitEdge( eLo.Sym );
				tess.mesh.splice( eUp.Lnext, eLo.Oprev ); 
				regLo = regUp;
				regUp = Sweep.topRightRegion( regUp );
				e = Sweep.regionBelow(regUp).eUp.Rprev;
				regLo.eUp = eLo.Oprev;
				eLo = Sweep.finishLeftRegions( tess, regLo, null );
				Sweep.addRightEdges( tess, regUp, eLo.Onext, eUp.Rprev, e, true );
				return true;
			}
			/* Special case: called from ConnectRightVertex.  If either
			* edge passes on the wrong side of tess->event, split it
			* (and wait for ConnectRightVertex to splice it appropriately).
			*/
			if( Geom.edgeSign( dstUp, tess.event, isect ) >= 0 ) {
				Sweep.regionAbove(regUp).dirty = regUp.dirty = true;
				tess.mesh.splitEdge( eUp.Sym );
				eUp.Org.s = tess.event.s;
				eUp.Org.t = tess.event.t;
			}
			if( Geom.edgeSign( dstLo, tess.event, isect ) <= 0 ) {
				regUp.dirty = regLo.dirty = true;
				tess.mesh.splitEdge( eLo.Sym );
				eLo.Org.s = tess.event.s;
				eLo.Org.t = tess.event.t;
			}
			/* leave the rest for ConnectRightVertex */
			return false;
		}

		/* General case -- split both edges, splice into new vertex.
		* When we do the splice operation, the order of the arguments is
		* arbitrary as far as correctness goes.  However, when the operation
		* creates a new face, the work done is proportional to the size of
		* the new face.  We expect the faces in the processed part of
		* the mesh (ie. eUp->Lface) to be smaller than the faces in the
		* unprocessed original contours (which will be eLo->Oprev->Lface).
		*/
		tess.mesh.splitEdge( eUp.Sym );
		tess.mesh.splitEdge( eLo.Sym );
		tess.mesh.splice( eLo.Oprev, eUp );
		eUp.Org.s = isect.s;
		eUp.Org.t = isect.t;
		eUp.Org.pqHandle = tess.pq.insert( eUp.Org );
		Sweep.getIntersectData( tess, eUp.Org, orgUp, dstUp, orgLo, dstLo );
		Sweep.regionAbove(regUp).dirty = regUp.dirty = regLo.dirty = true;
		return false;
	};

	//static void WalkDirtyRegions( TESStesselator *tess, ActiveRegion *regUp )
	Sweep.walkDirtyRegions = function( tess, regUp ) {
		/*
		* When the upper or lower edge of any region changes, the region is
		* marked "dirty".  This routine walks through all the dirty regions
		* and makes sure that the dictionary invariants are satisfied
		* (see the comments at the beginning of this file).  Of course
		* new dirty regions can be created as we make changes to restore
		* the invariants.
		*/
		var regLo = Sweep.regionBelow(regUp);
		var eUp, eLo;

		for( ;; ) {
			/* Find the lowest dirty region (we walk from the bottom up). */
			while( regLo.dirty ) {
				regUp = regLo;
				regLo = Sweep.regionBelow(regLo);
			}
			if( ! regUp.dirty ) {
				regLo = regUp;
				regUp = Sweep.regionAbove( regUp );
				if( regUp == null || ! regUp.dirty ) {
					/* We've walked all the dirty regions */
					return;
				}
			}
			regUp.dirty = false;
			eUp = regUp.eUp;
			eLo = regLo.eUp;

			if( eUp.Dst !== eLo.Dst ) {
				/* Check that the edge ordering is obeyed at the Dst vertices. */
				if( Sweep.checkForLeftSplice( tess, regUp )) {

					/* If the upper or lower edge was marked fixUpperEdge, then
					* we no longer need it (since these edges are needed only for
					* vertices which otherwise have no right-going edges).
					*/
					if( regLo.fixUpperEdge ) {
						Sweep.deleteRegion( tess, regLo );
						tess.mesh.delete( eLo );
						regLo = Sweep.regionBelow( regUp );
						eLo = regLo.eUp;
					} else if( regUp.fixUpperEdge ) {
						Sweep.deleteRegion( tess, regUp );
						tess.mesh.delete( eUp );
						regUp = Sweep.regionAbove( regLo );
						eUp = regUp.eUp;
					}
				}
			}
			if( eUp.Org !== eLo.Org ) {
				if(    eUp.Dst !== eLo.Dst
					&& ! regUp.fixUpperEdge && ! regLo.fixUpperEdge
					&& (eUp.Dst === tess.event || eLo.Dst === tess.event) )
				{
					/* When all else fails in CheckForIntersect(), it uses tess->event
					* as the intersection location.  To make this possible, it requires
					* that tess->event lie between the upper and lower edges, and also
					* that neither of these is marked fixUpperEdge (since in the worst
					* case it might splice one of these edges into tess->event, and
					* violate the invariant that fixable edges are the only right-going
					* edge from their associated vertex).
					*/
					if( Sweep.checkForIntersect( tess, regUp )) {
						/* WalkDirtyRegions() was called recursively; we're done */
						return;
					}
				} else {
					/* Even though we can't use CheckForIntersect(), the Org vertices
					* may violate the dictionary edge ordering.  Check and correct this.
					*/
					Sweep.checkForRightSplice( tess, regUp );
				}
			}
			if( eUp.Org === eLo.Org && eUp.Dst === eLo.Dst ) {
				/* A degenerate loop consisting of only two edges -- delete it. */
				Sweep.addWinding( eLo, eUp );
				Sweep.deleteRegion( tess, regUp );
				tess.mesh.delete( eUp );
				regUp = Sweep.regionAbove( regLo );
			}
		}
	};


	//static void ConnectRightVertex( TESStesselator *tess, ActiveRegion *regUp, TESShalfEdge *eBottomLeft )
	Sweep.connectRightVertex = function( tess, regUp, eBottomLeft ) {
		/*
		* Purpose: connect a "right" vertex vEvent (one where all edges go left)
		* to the unprocessed portion of the mesh.  Since there are no right-going
		* edges, two regions (one above vEvent and one below) are being merged
		* into one.  "regUp" is the upper of these two regions.
		*
		* There are two reasons for doing this (adding a right-going edge):
		*  - if the two regions being merged are "inside", we must add an edge
		*    to keep them separated (the combined region would not be monotone).
		*  - in any case, we must leave some record of vEvent in the dictionary,
		*    so that we can merge vEvent with features that we have not seen yet.
		*    For example, maybe there is a vertical edge which passes just to
		*    the right of vEvent; we would like to splice vEvent into this edge.
		*
		* However, we don't want to connect vEvent to just any vertex.  We don''t
		* want the new edge to cross any other edges; otherwise we will create
		* intersection vertices even when the input data had no self-intersections.
		* (This is a bad thing; if the user's input data has no intersections,
		* we don't want to generate any false intersections ourselves.)
		*
		* Our eventual goal is to connect vEvent to the leftmost unprocessed
		* vertex of the combined region (the union of regUp and regLo).
		* But because of unseen vertices with all right-going edges, and also
		* new vertices which may be created by edge intersections, we don''t
		* know where that leftmost unprocessed vertex is.  In the meantime, we
		* connect vEvent to the closest vertex of either chain, and mark the region
		* as "fixUpperEdge".  This flag says to delete and reconnect this edge
		* to the next processed vertex on the boundary of the combined region.
		* Quite possibly the vertex we connected to will turn out to be the
		* closest one, in which case we won''t need to make any changes.
		*/
		var eNew;
		var eTopLeft = eBottomLeft.Onext;
		var regLo = Sweep.regionBelow(regUp);
		var eUp = regUp.eUp;
		var eLo = regLo.eUp;
		var degenerate = false;

		if( eUp.Dst !== eLo.Dst ) {
			Sweep.checkForIntersect( tess, regUp );
		}

		/* Possible new degeneracies: upper or lower edge of regUp may pass
		* through vEvent, or may coincide with new intersection vertex
		*/
		if( Geom.vertEq( eUp.Org, tess.event )) {
			tess.mesh.splice( eTopLeft.Oprev, eUp );
			regUp = Sweep.topLeftRegion( tess, regUp );
			eTopLeft = Sweep.regionBelow( regUp ).eUp;
			Sweep.finishLeftRegions( tess, Sweep.regionBelow(regUp), regLo );
			degenerate = true;
		}
		if( Geom.vertEq( eLo.Org, tess.event )) {
			tess.mesh.splice( eBottomLeft, eLo.Oprev );
			eBottomLeft = Sweep.finishLeftRegions( tess, regLo, null );
			degenerate = true;
		}
		if( degenerate ) {
			Sweep.addRightEdges( tess, regUp, eBottomLeft.Onext, eTopLeft, eTopLeft, true );
			return;
		}

		/* Non-degenerate situation -- need to add a temporary, fixable edge.
		* Connect to the closer of eLo->Org, eUp->Org.
		*/
		if( Geom.vertLeq( eLo.Org, eUp.Org )) {
			eNew = eLo.Oprev;
		} else {
			eNew = eUp;
		}
		eNew = tess.mesh.connect( eBottomLeft.Lprev, eNew );

		/* Prevent cleanup, otherwise eNew might disappear before we've even
		* had a chance to mark it as a temporary edge.
		*/
		Sweep.addRightEdges( tess, regUp, eNew, eNew.Onext, eNew.Onext, false );
		eNew.Sym.activeRegion.fixUpperEdge = true;
		Sweep.walkDirtyRegions( tess, regUp );
	};

	/* Because vertices at exactly the same location are merged together
	* before we process the sweep event, some degenerate cases can't occur.
	* However if someone eventually makes the modifications required to
	* merge features which are close together, the cases below marked
	* TOLERANCE_NONZERO will be useful.  They were debugged before the
	* code to merge identical vertices in the main loop was added.
	*/
	//#define TOLERANCE_NONZERO	FALSE

	//static void ConnectLeftDegenerate( TESStesselator *tess, ActiveRegion *regUp, TESSvertex *vEvent )
	Sweep.connectLeftDegenerate = function( tess, regUp, vEvent ) {
		/*
		* The event vertex lies exacty on an already-processed edge or vertex.
		* Adding the new vertex involves splicing it into the already-processed
		* part of the mesh.
		*/
		var e, eTopLeft, eTopRight, eLast;
		var reg;

		e = regUp.eUp;
		if( Geom.vertEq( e.Org, vEvent )) {
			/* e->Org is an unprocessed vertex - just combine them, and wait
			* for e->Org to be pulled from the queue
			*/
			assert( false /*TOLERANCE_NONZERO*/ );
			Sweep.spliceMergeVertices( tess, e, vEvent.anEdge );
			return;
		}

		if( ! Geom.vertEq( e.Dst, vEvent )) {
			/* General case -- splice vEvent into edge e which passes through it */
			tess.mesh.splitEdge( e.Sym );
			if( regUp.fixUpperEdge ) {
				/* This edge was fixable -- delete unused portion of original edge */
				tess.mesh.delete( e.Onext );
				regUp.fixUpperEdge = false;
			}
			tess.mesh.splice( vEvent.anEdge, e );
			Sweep.sweepEvent( tess, vEvent );	/* recurse */
			return;
		}

		/* vEvent coincides with e->Dst, which has already been processed.
		* Splice in the additional right-going edges.
		*/
		assert( false /*TOLERANCE_NONZERO*/ );
		regUp = Sweep.topRightRegion( regUp );
		reg = Sweep.regionBelow( regUp );
		eTopRight = reg.eUp.Sym;
		eTopLeft = eLast = eTopRight.Onext;
		if( reg.fixUpperEdge ) {
			/* Here e->Dst has only a single fixable edge going right.
			* We can delete it since now we have some real right-going edges.
			*/
			assert( eTopLeft !== eTopRight );   /* there are some left edges too */
			Sweep.deleteRegion( tess, reg );
			tess.mesh.delete( eTopRight );
			eTopRight = eTopLeft.Oprev;
		}
		tess.mesh.splice( vEvent.anEdge, eTopRight );
		if( ! Geom.edgeGoesLeft( eTopLeft )) {
			/* e->Dst had no left-going edges -- indicate this to AddRightEdges() */
			eTopLeft = null;
		}
		Sweep.addRightEdges( tess, regUp, eTopRight.Onext, eLast, eTopLeft, true );
	};


	//static void ConnectLeftVertex( TESStesselator *tess, TESSvertex *vEvent )
	Sweep.connectLeftVertex = function( tess, vEvent ) {
		/*
		* Purpose: connect a "left" vertex (one where both edges go right)
		* to the processed portion of the mesh.  Let R be the active region
		* containing vEvent, and let U and L be the upper and lower edge
		* chains of R.  There are two possibilities:
		*
		* - the normal case: split R into two regions, by connecting vEvent to
		*   the rightmost vertex of U or L lying to the left of the sweep line
		*
		* - the degenerate case: if vEvent is close enough to U or L, we
		*   merge vEvent into that edge chain.  The subcases are:
		*	- merging with the rightmost vertex of U or L
		*	- merging with the active edge of U or L
		*	- merging with an already-processed portion of U or L
		*/
		var regUp, regLo, reg;
		var eUp, eLo, eNew;
		var tmp = new ActiveRegion();

		/* assert( vEvent->anEdge->Onext->Onext == vEvent->anEdge ); */

		/* Get a pointer to the active region containing vEvent */
		tmp.eUp = vEvent.anEdge.Sym;
		/* __GL_DICTLISTKEY */ /* tessDictListSearch */
		regUp = tess.dict.search( tmp ).key;
		regLo = Sweep.regionBelow( regUp );
		if( !regLo ) {
			// This may happen if the input polygon is coplanar.
			return;
		}
		eUp = regUp.eUp;
		eLo = regLo.eUp;

		/* Try merging with U or L first */
		if( Geom.edgeSign( eUp.Dst, vEvent, eUp.Org ) === 0.0 ) {
			Sweep.connectLeftDegenerate( tess, regUp, vEvent );
			return;
		}

		/* Connect vEvent to rightmost processed vertex of either chain.
		* e->Dst is the vertex that we will connect to vEvent.
		*/
		reg = Geom.vertLeq( eLo.Dst, eUp.Dst ) ? regUp : regLo;

		if( regUp.inside || reg.fixUpperEdge) {
			if( reg === regUp ) {
				eNew = tess.mesh.connect( vEvent.anEdge.Sym, eUp.Lnext );
			} else {
				var tempHalfEdge = tess.mesh.connect( eLo.Dnext, vEvent.anEdge);
				eNew = tempHalfEdge.Sym;
			}
			if( reg.fixUpperEdge ) {
				Sweep.fixUpperEdge( tess, reg, eNew );
			} else {
				Sweep.computeWinding( tess, Sweep.addRegionBelow( tess, regUp, eNew ));
			}
			Sweep.sweepEvent( tess, vEvent );
		} else {
			/* The new vertex is in a region which does not belong to the polygon.
			* We don''t need to connect this vertex to the rest of the mesh.
			*/
			Sweep.addRightEdges( tess, regUp, vEvent.anEdge, vEvent.anEdge, null, true );
		}
	};


	//static void SweepEvent( TESStesselator *tess, TESSvertex *vEvent )
	Sweep.sweepEvent = function( tess, vEvent ) {
		/*
		* Does everything necessary when the sweep line crosses a vertex.
		* Updates the mesh and the edge dictionary.
		*/

		tess.event = vEvent;		/* for access in EdgeLeq() */
		Sweep.debugEvent( tess );

		/* Check if this vertex is the right endpoint of an edge that is
		* already in the dictionary.  In this case we don't need to waste
		* time searching for the location to insert new edges.
		*/
		var e = vEvent.anEdge;
		while( e.activeRegion === null ) {
			e = e.Onext;
			if( e == vEvent.anEdge ) {
				/* All edges go right -- not incident to any processed edges */
				Sweep.connectLeftVertex( tess, vEvent );
				return;
			}
		}

		/* Processing consists of two phases: first we "finish" all the
		* active regions where both the upper and lower edges terminate
		* at vEvent (ie. vEvent is closing off these regions).
		* We mark these faces "inside" or "outside" the polygon according
		* to their winding number, and delete the edges from the dictionary.
		* This takes care of all the left-going edges from vEvent.
		*/
		var regUp = Sweep.topLeftRegion( tess, e.activeRegion );
		assert( regUp !== null );
	//	if (regUp == NULL) longjmp(tess->env,1);
		var reg = Sweep.regionBelow( regUp );
		var eTopLeft = reg.eUp;
		var eBottomLeft = Sweep.finishLeftRegions( tess, reg, null );

		/* Next we process all the right-going edges from vEvent.  This
		* involves adding the edges to the dictionary, and creating the
		* associated "active regions" which record information about the
		* regions between adjacent dictionary edges.
		*/
		if( eBottomLeft.Onext === eTopLeft ) {
			/* No right-going edges -- add a temporary "fixable" edge */
			Sweep.connectRightVertex( tess, regUp, eBottomLeft );
		} else {
			Sweep.addRightEdges( tess, regUp, eBottomLeft.Onext, eTopLeft, eTopLeft, true );
		}
	};


	/* Make the sentinel coordinates big enough that they will never be
	* merged with real input features.
	*/

	//static void AddSentinel( TESStesselator *tess, TESSreal smin, TESSreal smax, TESSreal t )
	Sweep.addSentinel = function( tess, smin, smax, t ) {
		/*
		* We add two sentinel edges above and below all other edges,
		* to avoid special cases at the top and bottom.
		*/
		var reg = new ActiveRegion();
		var e = tess.mesh.makeEdge();
	//	if (e == NULL) longjmp(tess->env,1);

		e.Org.s = smax;
		e.Org.t = t;
		e.Dst.s = smin;
		e.Dst.t = t;
		tess.event = e.Dst;		/* initialize it */

		reg.eUp = e;
		reg.windingNumber = 0;
		reg.inside = false;
		reg.fixUpperEdge = false;
		reg.sentinel = true;
		reg.dirty = false;
		reg.nodeUp = tess.dict.insert( reg );
	//	if (reg->nodeUp == NULL) longjmp(tess->env,1);
	};


	//static void InitEdgeDict( TESStesselator *tess )
	Sweep.initEdgeDict = function( tess ) {
		/*
		* We maintain an ordering of edge intersections with the sweep line.
		* This order is maintained in a dynamic dictionary.
		*/
		tess.dict = new Dict( tess, Sweep.edgeLeq );
	//	if (tess->dict == NULL) longjmp(tess->env,1);

		var w = (tess.bmax[0] - tess.bmin[0]);
		var h = (tess.bmax[1] - tess.bmin[1]);

		var smin = tess.bmin[0] - w;
		var smax = tess.bmax[0] + w;
		var tmin = tess.bmin[1] - h;
		var tmax = tess.bmax[1] + h;

		Sweep.addSentinel( tess, smin, smax, tmin );
		Sweep.addSentinel( tess, smin, smax, tmax );
	};


	Sweep.doneEdgeDict = function( tess )
	{
		var reg;
		var fixedEdges = 0;

		while( (reg = tess.dict.min().key) !== null ) {
			/*
			* At the end of all processing, the dictionary should contain
			* only the two sentinel edges, plus at most one "fixable" edge
			* created by ConnectRightVertex().
			*/
			if( ! reg.sentinel ) {
				assert( reg.fixUpperEdge );
				assert( ++fixedEdges == 1 );
			}
			assert( reg.windingNumber == 0 );
			Sweep.deleteRegion( tess, reg );
			/*    tessMeshDelete( reg->eUp );*/
		}
	//	dictDeleteDict( &tess->alloc, tess->dict );
	};


	Sweep.removeDegenerateEdges = function( tess ) {
		/*
		* Remove zero-length edges, and contours with fewer than 3 vertices.
		*/
		var e, eNext, eLnext;
		var eHead = tess.mesh.eHead;

		/*LINTED*/
		for( e = eHead.next; e !== eHead; e = eNext ) {
			eNext = e.next;
			eLnext = e.Lnext;

			if( Geom.vertEq( e.Org, e.Dst ) && e.Lnext.Lnext !== e ) {
				/* Zero-length edge, contour has at least 3 edges */
				Sweep.spliceMergeVertices( tess, eLnext, e );	/* deletes e->Org */
				tess.mesh.delete( e ); /* e is a self-loop */
				e = eLnext;
				eLnext = e.Lnext;
			}
			if( eLnext.Lnext === e ) {
				/* Degenerate contour (one or two edges) */
				if( eLnext !== e ) {
					if( eLnext === eNext || eLnext === eNext.Sym ) { eNext = eNext.next; }
					tess.mesh.delete( eLnext );
				}
				if( e === eNext || e === eNext.Sym ) { eNext = eNext.next; }
				tess.mesh.delete( e );
			}
		}
	};

	Sweep.initPriorityQ = function( tess ) {
		/*
		* Insert all vertices into the priority queue which determines the
		* order in which vertices cross the sweep line.
		*/
		var pq;
		var v, vHead;
		var vertexCount = 0;
		
		vHead = tess.mesh.vHead;
		for( v = vHead.next; v !== vHead; v = v.next ) {
			vertexCount++;
		}
		/* Make sure there is enough space for sentinels. */
		vertexCount += 8; //MAX( 8, tess->alloc.extraVertices );
		
		pq = tess.pq = new PriorityQ( vertexCount, Geom.vertLeq );
	//	if (pq == NULL) return 0;

		vHead = tess.mesh.vHead;
		for( v = vHead.next; v !== vHead; v = v.next ) {
			v.pqHandle = pq.insert( v );
	//		if (v.pqHandle == INV_HANDLE)
	//			break;
		}

		if (v !== vHead) {
			return false;
		}

		pq.init();

		return true;
	};


	Sweep.donePriorityQ = function( tess ) {
		tess.pq = null;
	};


	Sweep.removeDegenerateFaces = function( tess, mesh ) {
		/*
		* Delete any degenerate faces with only two edges.  WalkDirtyRegions()
		* will catch almost all of these, but it won't catch degenerate faces
		* produced by splice operations on already-processed edges.
		* The two places this can happen are in FinishLeftRegions(), when
		* we splice in a "temporary" edge produced by ConnectRightVertex(),
		* and in CheckForLeftSplice(), where we splice already-processed
		* edges to ensure that our dictionary invariants are not violated
		* by numerical errors.
		*
		* In both these cases it is *very* dangerous to delete the offending
		* edge at the time, since one of the routines further up the stack
		* will sometimes be keeping a pointer to that edge.
		*/
		var f, fNext;
		var e;

		/*LINTED*/
		for( f = mesh.fHead.next; f !== mesh.fHead; f = fNext ) {
			fNext = f.next;
			e = f.anEdge;
			assert( e.Lnext !== e );

			if( e.Lnext.Lnext === e ) {
				/* A face with only two edges */
				Sweep.addWinding( e.Onext, e );
				tess.mesh.delete( e );
			}
		}
		return true;
	};

	Sweep.computeInterior = function( tess ) {
		/*
		* tessComputeInterior( tess ) computes the planar arrangement specified
		* by the given contours, and further subdivides this arrangement
		* into regions.  Each region is marked "inside" if it belongs
		* to the polygon, according to the rule given by tess->windingRule.
		* Each interior region is guaranteed be monotone.
		*/
		var v, vNext;

		/* Each vertex defines an event for our sweep line.  Start by inserting
		* all the vertices in a priority queue.  Events are processed in
		* lexicographic order, ie.
		*
		*	e1 < e2  iff  e1.x < e2.x || (e1.x == e2.x && e1.y < e2.y)
		*/
		Sweep.removeDegenerateEdges( tess );
		if ( !Sweep.initPriorityQ( tess ) ) return false; /* if error */
		Sweep.initEdgeDict( tess );

		while( (v = tess.pq.extractMin()) !== null ) {
			for( ;; ) {
				vNext = tess.pq.min();
				if( vNext === null || ! Geom.vertEq( vNext, v )) break;

				/* Merge together all vertices at exactly the same location.
				* This is more efficient than processing them one at a time,
				* simplifies the code (see ConnectLeftDegenerate), and is also
				* important for correct handling of certain degenerate cases.
				* For example, suppose there are two identical edges A and B
				* that belong to different contours (so without this code they would
				* be processed by separate sweep events).  Suppose another edge C
				* crosses A and B from above.  When A is processed, we split it
				* at its intersection point with C.  However this also splits C,
				* so when we insert B we may compute a slightly different
				* intersection point.  This might leave two edges with a small
				* gap between them.  This kind of error is especially obvious
				* when using boundary extraction (TESS_BOUNDARY_ONLY).
				*/
				vNext = tess.pq.extractMin();
				Sweep.spliceMergeVertices( tess, v.anEdge, vNext.anEdge );
			}
			Sweep.sweepEvent( tess, v );
		}

		/* Set tess->event for debugging purposes */
		tess.event = tess.dict.min().key.eUp.Org;
		Sweep.debugEvent( tess );
		Sweep.doneEdgeDict( tess );
		Sweep.donePriorityQ( tess );

		if ( !Sweep.removeDegenerateFaces( tess, tess.mesh ) ) return false;
		tess.mesh.check();

		return true;
	};


	function Tesselator() {

		/*** state needed for collecting the input data ***/
		this.mesh = null;		/* stores the input contours, and eventually
							the tessellation itself */

		/*** state needed for projecting onto the sweep plane ***/

		this.normal = [0.0, 0.0, 0.0];	/* user-specified normal (if provided) */
		this.sUnit = [0.0, 0.0, 0.0];	/* unit vector in s-direction (debugging) */
		this.tUnit = [0.0, 0.0, 0.0];	/* unit vector in t-direction (debugging) */

		this.bmin = [0.0, 0.0];
		this.bmax = [0.0, 0.0];

		/*** state needed for the line sweep ***/
		this.windingRule = Tess2$1.WINDING_ODD;	/* rule for determining polygon interior */

		this.dict = null;		/* edge dictionary for sweep line */
		this.pq = null;		/* priority queue of vertex events */
		this.event = null;		/* current sweep event being processed */

		this.vertexIndexCounter = 0;
		
		this.vertices = [];
		this.vertexIndices = [];
		this.vertexCount = 0;
		this.elements = [];
		this.elementCount = 0;
	}

	Tesselator.prototype = {

		dot_: function(u, v) {
			return (u[0]*v[0] + u[1]*v[1] + u[2]*v[2]);
		},

		normalize_: function( v ) {
			var len = v[0]*v[0] + v[1]*v[1] + v[2]*v[2];
			assert( len > 0.0 );
			len = Math.sqrt( len );
			v[0] /= len;
			v[1] /= len;
			v[2] /= len;
		},

		longAxis_: function( v ) {
			var i = 0;
			if( Math.abs(v[1]) > Math.abs(v[0]) ) { i = 1; }
			if( Math.abs(v[2]) > Math.abs(v[i]) ) { i = 2; }
			return i;
		},

		computeNormal_: function( norm )
		{
			var v, v1, v2;
			var c, tLen2, maxLen2;
			var maxVal = [0,0,0], minVal = [0,0,0], d1 = [0,0,0], d2 = [0,0,0], tNorm = [0,0,0];
			var maxVert = [null,null,null], minVert = [null,null,null];
			var vHead = this.mesh.vHead;
			var i;

			v = vHead.next;
			for( i = 0; i < 3; ++i ) {
				c = v.coords[i];
				minVal[i] = c;
				minVert[i] = v;
				maxVal[i] = c;
				maxVert[i] = v;
			}

			for( v = vHead.next; v !== vHead; v = v.next ) {
				for( i = 0; i < 3; ++i ) {
					c = v.coords[i];
					if( c < minVal[i] ) { minVal[i] = c; minVert[i] = v; }
					if( c > maxVal[i] ) { maxVal[i] = c; maxVert[i] = v; }
				}
			}

			/* Find two vertices separated by at least 1/sqrt(3) of the maximum
			* distance between any two vertices
			*/
			i = 0;
			if( maxVal[1] - minVal[1] > maxVal[0] - minVal[0] ) { i = 1; }
			if( maxVal[2] - minVal[2] > maxVal[i] - minVal[i] ) { i = 2; }
			if( minVal[i] >= maxVal[i] ) {
				/* All vertices are the same -- normal doesn't matter */
				norm[0] = 0; norm[1] = 0; norm[2] = 1;
				return;
			}

			/* Look for a third vertex which forms the triangle with maximum area
			* (Length of normal == twice the triangle area)
			*/
			maxLen2 = 0;
			v1 = minVert[i];
			v2 = maxVert[i];
			d1[0] = v1.coords[0] - v2.coords[0];
			d1[1] = v1.coords[1] - v2.coords[1];
			d1[2] = v1.coords[2] - v2.coords[2];
			for( v = vHead.next; v !== vHead; v = v.next ) {
				d2[0] = v.coords[0] - v2.coords[0];
				d2[1] = v.coords[1] - v2.coords[1];
				d2[2] = v.coords[2] - v2.coords[2];
				tNorm[0] = d1[1]*d2[2] - d1[2]*d2[1];
				tNorm[1] = d1[2]*d2[0] - d1[0]*d2[2];
				tNorm[2] = d1[0]*d2[1] - d1[1]*d2[0];
				tLen2 = tNorm[0]*tNorm[0] + tNorm[1]*tNorm[1] + tNorm[2]*tNorm[2];
				if( tLen2 > maxLen2 ) {
					maxLen2 = tLen2;
					norm[0] = tNorm[0];
					norm[1] = tNorm[1];
					norm[2] = tNorm[2];
				}
			}

			if( maxLen2 <= 0 ) {
				/* All points lie on a single line -- any decent normal will do */
				norm[0] = norm[1] = norm[2] = 0;
				norm[this.longAxis_(d1)] = 1;
			}
		},

		checkOrientation_: function() {
			var area;
			var f, fHead = this.mesh.fHead;
			var v, vHead = this.mesh.vHead;
			var e;

			/* When we compute the normal automatically, we choose the orientation
			* so that the the sum of the signed areas of all contours is non-negative.
			*/
			area = 0;
			for( f = fHead.next; f !== fHead; f = f.next ) {
				e = f.anEdge;
				if( e.winding <= 0 ) continue;
				do {
					area += (e.Org.s - e.Dst.s) * (e.Org.t + e.Dst.t);
					e = e.Lnext;
				} while( e !== f.anEdge );
			}
			if( area < 0 ) {
				/* Reverse the orientation by flipping all the t-coordinates */
				for( v = vHead.next; v !== vHead; v = v.next ) {
					v.t = - v.t;
				}
				this.tUnit[0] = - this.tUnit[0];
				this.tUnit[1] = - this.tUnit[1];
				this.tUnit[2] = - this.tUnit[2];
			}
		},

	/*	#ifdef FOR_TRITE_TEST_PROGRAM
		#include <stdlib.h>
		extern int RandomSweep;
		#define S_UNIT_X	(RandomSweep ? (2*drand48()-1) : 1.0)
		#define S_UNIT_Y	(RandomSweep ? (2*drand48()-1) : 0.0)
		#else
		#if defined(SLANTED_SWEEP) */
		/* The "feature merging" is not intended to be complete.  There are
		* special cases where edges are nearly parallel to the sweep line
		* which are not implemented.  The algorithm should still behave
		* robustly (ie. produce a reasonable tesselation) in the presence
		* of such edges, however it may miss features which could have been
		* merged.  We could minimize this effect by choosing the sweep line
		* direction to be something unusual (ie. not parallel to one of the
		* coordinate axes).
		*/
	/*	#define S_UNIT_X	(TESSreal)0.50941539564955385	// Pre-normalized
		#define S_UNIT_Y	(TESSreal)0.86052074622010633
		#else
		#define S_UNIT_X	(TESSreal)1.0
		#define S_UNIT_Y	(TESSreal)0.0
		#endif
		#endif*/

		/* Determine the polygon normal and project vertices onto the plane
		* of the polygon.
		*/
		projectPolygon_: function() {
			var v, vHead = this.mesh.vHead;
			var norm = [0,0,0];
			var sUnit, tUnit;
			var i, first, computedNormal = false;

			norm[0] = this.normal[0];
			norm[1] = this.normal[1];
			norm[2] = this.normal[2];
			if( norm[0] === 0.0 && norm[1] === 0.0 && norm[2] === 0.0 ) {
				this.computeNormal_( norm );
				computedNormal = true;
			}
			sUnit = this.sUnit;
			tUnit = this.tUnit;
			i = this.longAxis_( norm );

	/*	#if defined(FOR_TRITE_TEST_PROGRAM) || defined(TRUE_PROJECT)
			// Choose the initial sUnit vector to be approximately perpendicular
			// to the normal.
			
			Normalize( norm );

			sUnit[i] = 0;
			sUnit[(i+1)%3] = S_UNIT_X;
			sUnit[(i+2)%3] = S_UNIT_Y;

			// Now make it exactly perpendicular 
			w = Dot( sUnit, norm );
			sUnit[0] -= w * norm[0];
			sUnit[1] -= w * norm[1];
			sUnit[2] -= w * norm[2];
			Normalize( sUnit );

			// Choose tUnit so that (sUnit,tUnit,norm) form a right-handed frame 
			tUnit[0] = norm[1]*sUnit[2] - norm[2]*sUnit[1];
			tUnit[1] = norm[2]*sUnit[0] - norm[0]*sUnit[2];
			tUnit[2] = norm[0]*sUnit[1] - norm[1]*sUnit[0];
			Normalize( tUnit );
		#else*/
			/* Project perpendicular to a coordinate axis -- better numerically */
			sUnit[i] = 0;
			sUnit[(i+1)%3] = 1.0;
			sUnit[(i+2)%3] = 0.0;

			tUnit[i] = 0;
			tUnit[(i+1)%3] = 0.0;
			tUnit[(i+2)%3] = (norm[i] > 0) ? 1.0 : -1.0;
	//	#endif

			/* Project the vertices onto the sweep plane */
			for( v = vHead.next; v !== vHead; v = v.next ) {
				v.s = this.dot_( v.coords, sUnit );
				v.t = this.dot_( v.coords, tUnit );
			}
			if( computedNormal ) {
				this.checkOrientation_();
			}

			/* Compute ST bounds. */
			first = true;
			for( v = vHead.next; v !== vHead; v = v.next ) {
				if (first) {
					this.bmin[0] = this.bmax[0] = v.s;
					this.bmin[1] = this.bmax[1] = v.t;
					first = false;
				} else {
					if (v.s < this.bmin[0]) this.bmin[0] = v.s;
					if (v.s > this.bmax[0]) this.bmax[0] = v.s;
					if (v.t < this.bmin[1]) this.bmin[1] = v.t;
					if (v.t > this.bmax[1]) this.bmax[1] = v.t;
				}
			}
		},

		addWinding_: function(eDst,eSrc) {
			eDst.winding += eSrc.winding;
			eDst.Sym.winding += eSrc.Sym.winding;
		},
		
		/* tessMeshTessellateMonoRegion( face ) tessellates a monotone region
		* (what else would it do??)  The region must consist of a single
		* loop of half-edges (see mesh.h) oriented CCW.  "Monotone" in this
		* case means that any vertical line intersects the interior of the
		* region in a single interval.  
		*
		* Tessellation consists of adding interior edges (actually pairs of
		* half-edges), to split the region into non-overlapping triangles.
		*
		* The basic idea is explained in Preparata and Shamos (which I don''t
		* have handy right now), although their implementation is more
		* complicated than this one.  The are two edge chains, an upper chain
		* and a lower chain.  We process all vertices from both chains in order,
		* from right to left.
		*
		* The algorithm ensures that the following invariant holds after each
		* vertex is processed: the untessellated region consists of two
		* chains, where one chain (say the upper) is a single edge, and
		* the other chain is concave.  The left vertex of the single edge
		* is always to the left of all vertices in the concave chain.
		*
		* Each step consists of adding the rightmost unprocessed vertex to one
		* of the two chains, and forming a fan of triangles from the rightmost
		* of two chain endpoints.  Determining whether we can add each triangle
		* to the fan is a simple orientation test.  By making the fan as large
		* as possible, we restore the invariant (check it yourself).
		*/
	//	int tessMeshTessellateMonoRegion( TESSmesh *mesh, TESSface *face )
		tessellateMonoRegion_: function( mesh, face ) {
			var up, lo;

			/* All edges are oriented CCW around the boundary of the region.
			* First, find the half-edge whose origin vertex is rightmost.
			* Since the sweep goes from left to right, face->anEdge should
			* be close to the edge we want.
			*/
			up = face.anEdge;
			assert( up.Lnext !== up && up.Lnext.Lnext !== up );

			for( ; Geom.vertLeq( up.Dst, up.Org ); up = up.Lprev )
				;
			for( ; Geom.vertLeq( up.Org, up.Dst ); up = up.Lnext )
				;
			lo = up.Lprev;

			while( up.Lnext !== lo ) {
				if( Geom.vertLeq( up.Dst, lo.Org )) {
					/* up->Dst is on the left.  It is safe to form triangles from lo->Org.
					* The EdgeGoesLeft test guarantees progress even when some triangles
					* are CW, given that the upper and lower chains are truly monotone.
					*/
					while( lo.Lnext !== up && (Geom.edgeGoesLeft( lo.Lnext )
						|| Geom.edgeSign( lo.Org, lo.Dst, lo.Lnext.Dst ) <= 0.0 )) {
							var tempHalfEdge = mesh.connect( lo.Lnext, lo );
							//if (tempHalfEdge == NULL) return 0;
							lo = tempHalfEdge.Sym;
					}
					lo = lo.Lprev;
				} else {
					/* lo->Org is on the left.  We can make CCW triangles from up->Dst. */
					while( lo.Lnext != up && (Geom.edgeGoesRight( up.Lprev )
						|| Geom.edgeSign( up.Dst, up.Org, up.Lprev.Org ) >= 0.0 )) {
							var tempHalfEdge = mesh.connect( up, up.Lprev );
							//if (tempHalfEdge == NULL) return 0;
							up = tempHalfEdge.Sym;
					}
					up = up.Lnext;
				}
			}

			/* Now lo->Org == up->Dst == the leftmost vertex.  The remaining region
			* can be tessellated in a fan from this leftmost vertex.
			*/
			assert( lo.Lnext !== up );
			while( lo.Lnext.Lnext !== up ) {
				var tempHalfEdge = mesh.connect( lo.Lnext, lo );
				//if (tempHalfEdge == NULL) return 0;
				lo = tempHalfEdge.Sym;
			}

			return true;
		},


		/* tessMeshTessellateInterior( mesh ) tessellates each region of
		* the mesh which is marked "inside" the polygon.  Each such region
		* must be monotone.
		*/
		//int tessMeshTessellateInterior( TESSmesh *mesh )
		tessellateInterior_: function( mesh ) {
			var f, next;

			/*LINTED*/
			for( f = mesh.fHead.next; f !== mesh.fHead; f = next ) {
				/* Make sure we don''t try to tessellate the new triangles. */
				next = f.next;
				if( f.inside ) {
					if ( !this.tessellateMonoRegion_( mesh, f ) ) return false;
				}
			}

			return true;
		},


		/* tessMeshDiscardExterior( mesh ) zaps (ie. sets to NULL) all faces
		* which are not marked "inside" the polygon.  Since further mesh operations
		* on NULL faces are not allowed, the main purpose is to clean up the
		* mesh so that exterior loops are not represented in the data structure.
		*/
		//void tessMeshDiscardExterior( TESSmesh *mesh )
		discardExterior_: function( mesh ) {
			var f, next;

			/*LINTED*/
			for( f = mesh.fHead.next; f !== mesh.fHead; f = next ) {
				/* Since f will be destroyed, save its next pointer. */
				next = f.next;
				if( ! f.inside ) {
					mesh.zapFace( f );
				}
			}
		},

		/* tessMeshSetWindingNumber( mesh, value, keepOnlyBoundary ) resets the
		* winding numbers on all edges so that regions marked "inside" the
		* polygon have a winding number of "value", and regions outside
		* have a winding number of 0.
		*
		* If keepOnlyBoundary is TRUE, it also deletes all edges which do not
		* separate an interior region from an exterior one.
		*/
	//	int tessMeshSetWindingNumber( TESSmesh *mesh, int value, int keepOnlyBoundary )
		setWindingNumber_: function( mesh, value, keepOnlyBoundary ) {
			var e, eNext;

			for( e = mesh.eHead.next; e !== mesh.eHead; e = eNext ) {
				eNext = e.next;
				if( e.Rface.inside !== e.Lface.inside ) {

					/* This is a boundary edge (one side is interior, one is exterior). */
					e.winding = (e.Lface.inside) ? value : -value;
				} else {

					/* Both regions are interior, or both are exterior. */
					if( ! keepOnlyBoundary ) {
						e.winding = 0;
					} else {
						mesh.delete( e );
					}
				}
			}
		},

		getNeighbourFace_: function(edge)
		{
			if (!edge.Rface)
				return -1;
			if (!edge.Rface.inside)
				return -1;
			return edge.Rface.n;
		},

		outputPolymesh_: function( mesh, elementType, polySize, vertexSize ) {
			var v;
			var f;
			var edge;
			var maxFaceCount = 0;
			var maxVertexCount = 0;
			var faceVerts, i;
			var elements = 0;
			var vert;

			// Assume that the input data is triangles now.
			// Try to merge as many polygons as possible
			if (polySize > 3)
			{
				mesh.mergeConvexFaces( polySize );
			}

			// Mark unused
			for ( v = mesh.vHead.next; v !== mesh.vHead; v = v.next )
				v.n = -1;

			// Create unique IDs for all vertices and faces.
			for ( f = mesh.fHead.next; f != mesh.fHead; f = f.next )
			{
				f.n = -1;
				if( !f.inside ) continue;

				edge = f.anEdge;
				faceVerts = 0;
				do
				{
					v = edge.Org;
					if ( v.n === -1 )
					{
						v.n = maxVertexCount;
						maxVertexCount++;
					}
					faceVerts++;
					edge = edge.Lnext;
				}
				while (edge !== f.anEdge);
				
				assert( faceVerts <= polySize );

				f.n = maxFaceCount;
				++maxFaceCount;
			}

			this.elementCount = maxFaceCount;
			if (elementType == Tess2$1.CONNECTED_POLYGONS)
				maxFaceCount *= 2;
	/*		tess.elements = (TESSindex*)tess->alloc.memalloc( tess->alloc.userData,
															  sizeof(TESSindex) * maxFaceCount * polySize );
			if (!tess->elements)
			{
				tess->outOfMemory = 1;
				return;
			}*/
			this.elements = [];
			this.elements.length = maxFaceCount * polySize;
			
			this.vertexCount = maxVertexCount;
	/*		tess->vertices = (TESSreal*)tess->alloc.memalloc( tess->alloc.userData,
															 sizeof(TESSreal) * tess->vertexCount * vertexSize );
			if (!tess->vertices)
			{
				tess->outOfMemory = 1;
				return;
			}*/
			this.vertices = [];
			this.vertices.length = maxVertexCount * vertexSize;

	/*		tess->vertexIndices = (TESSindex*)tess->alloc.memalloc( tess->alloc.userData,
																    sizeof(TESSindex) * tess->vertexCount );
			if (!tess->vertexIndices)
			{
				tess->outOfMemory = 1;
				return;
			}*/
			this.vertexIndices = [];
			this.vertexIndices.length = maxVertexCount;

			
			// Output vertices.
			for ( v = mesh.vHead.next; v !== mesh.vHead; v = v.next )
			{
				if ( v.n != -1 )
				{
					// Store coordinate
					var idx = v.n * vertexSize;
					this.vertices[idx+0] = v.coords[0];
					this.vertices[idx+1] = v.coords[1];
					if ( vertexSize > 2 )
						this.vertices[idx+2] = v.coords[2];
					// Store vertex index.
					this.vertexIndices[v.n] = v.idx;
				}
			}

			// Output indices.
			var nel = 0;
			for ( f = mesh.fHead.next; f !== mesh.fHead; f = f.next )
			{
				if ( !f.inside ) continue;
				
				// Store polygon
				edge = f.anEdge;
				faceVerts = 0;
				do
				{
					v = edge.Org;
					this.elements[nel++] = v.n;
					faceVerts++;
					edge = edge.Lnext;
				}
				while (edge !== f.anEdge);
				// Fill unused.
				for (i = faceVerts; i < polySize; ++i)
					this.elements[nel++] = -1;

				// Store polygon connectivity
				if ( elementType == Tess2$1.CONNECTED_POLYGONS )
				{
					edge = f.anEdge;
					do
					{
						this.elements[nel++] = this.getNeighbourFace_( edge );
						edge = edge.Lnext;
					}
					while (edge !== f.anEdge);
					// Fill unused.
					for (i = faceVerts; i < polySize; ++i)
						this.elements[nel++] = -1;
				}
			}
		},

	//	void OutputContours( TESStesselator *tess, TESSmesh *mesh, int vertexSize )
		outputContours_: function( mesh, vertexSize ) {
			var f;
			var edge;
			var start;
			var verts;
			var elements;
			var vertInds;
			var startVert = 0;
			var vertCount = 0;

			this.vertexCount = 0;
			this.elementCount = 0;

			for ( f = mesh.fHead.next; f !== mesh.fHead; f = f.next )
			{
				if ( !f.inside ) continue;

				start = edge = f.anEdge;
				do
				{
					this.vertexCount++;
					edge = edge.Lnext;
				}
				while ( edge !== start );

				this.elementCount++;
			}

	/*		tess->elements = (TESSindex*)tess->alloc.memalloc( tess->alloc.userData,
															  sizeof(TESSindex) * tess->elementCount * 2 );
			if (!tess->elements)
			{
				tess->outOfMemory = 1;
				return;
			}*/
			this.elements = [];
			this.elements.length = this.elementCount * 2;
			
	/*		tess->vertices = (TESSreal*)tess->alloc.memalloc( tess->alloc.userData,
															  sizeof(TESSreal) * tess->vertexCount * vertexSize );
			if (!tess->vertices)
			{
				tess->outOfMemory = 1;
				return;
			}*/
			this.vertices = [];
			this.vertices.length = this.vertexCount * vertexSize;

	/*		tess->vertexIndices = (TESSindex*)tess->alloc.memalloc( tess->alloc.userData,
																    sizeof(TESSindex) * tess->vertexCount );
			if (!tess->vertexIndices)
			{
				tess->outOfMemory = 1;
				return;
			}*/
			this.vertexIndices = [];
			this.vertexIndices.length = this.vertexCount;

			var nv = 0;
			var nvi = 0;
			var nel = 0;
			startVert = 0;

			for ( f = mesh.fHead.next; f !== mesh.fHead; f = f.next )
			{
				if ( !f.inside ) continue;

				vertCount = 0;
				start = edge = f.anEdge;
				do
				{
					this.vertices[nv++] = edge.Org.coords[0];
					this.vertices[nv++] = edge.Org.coords[1];
					if ( vertexSize > 2 )
						this.vertices[nv++] = edge.Org.coords[2];
					this.vertexIndices[nvi++] = edge.Org.idx;
					vertCount++;
					edge = edge.Lnext;
				}
				while ( edge !== start );

				this.elements[nel++] = startVert;
				this.elements[nel++] = vertCount;

				startVert += vertCount;
			}
		},

		addContour: function( size, vertices )
		{
			var e;
			var i;

			if ( this.mesh === null )
			  	this.mesh = new TESSmesh();
	/*	 	if ( tess->mesh == NULL ) {
				tess->outOfMemory = 1;
				return;
			}*/

			if ( size < 2 )
				size = 2;
			if ( size > 3 )
				size = 3;

			e = null;

			for( i = 0; i < vertices.length; i += size )
			{
				if( e == null ) {
					/* Make a self-loop (one vertex, one edge). */
					e = this.mesh.makeEdge();
	/*				if ( e == NULL ) {
						tess->outOfMemory = 1;
						return;
					}*/
					this.mesh.splice( e, e.Sym );
				} else {
					/* Create a new vertex and edge which immediately follow e
					* in the ordering around the left face.
					*/
					this.mesh.splitEdge( e );
					e = e.Lnext;
				}

				/* The new vertex is now e->Org. */
				e.Org.coords[0] = vertices[i+0];
				e.Org.coords[1] = vertices[i+1];
				if ( size > 2 )
					e.Org.coords[2] = vertices[i+2];
				else
					e.Org.coords[2] = 0.0;
				/* Store the insertion number so that the vertex can be later recognized. */
				e.Org.idx = this.vertexIndexCounter++;

				/* The winding of an edge says how the winding number changes as we
				* cross from the edge''s right face to its left face.  We add the
				* vertices in such an order that a CCW contour will add +1 to
				* the winding number of the region inside the contour.
				*/
				e.winding = 1;
				e.Sym.winding = -1;
			}
		},

	//	int tessTesselate( TESStesselator *tess, int windingRule, int elementType, int polySize, int vertexSize, const TESSreal* normal )
		tesselate: function( windingRule, elementType, polySize, vertexSize, normal ) {
			this.vertices = [];
			this.elements = [];
			this.vertexIndices = [];

			this.vertexIndexCounter = 0;
			
			if (normal)
			{
				this.normal[0] = normal[0];
				this.normal[1] = normal[1];
				this.normal[2] = normal[2];
			}

			this.windingRule = windingRule;

			if (vertexSize < 2)
				vertexSize = 2;
			if (vertexSize > 3)
				vertexSize = 3;

	/*		if (setjmp(tess->env) != 0) { 
				// come back here if out of memory
				return 0;
			}*/

			if (!this.mesh)
			{
				return false;
			}

			/* Determine the polygon normal and project vertices onto the plane
			* of the polygon.
			*/
			this.projectPolygon_();

			/* tessComputeInterior( tess ) computes the planar arrangement specified
			* by the given contours, and further subdivides this arrangement
			* into regions.  Each region is marked "inside" if it belongs
			* to the polygon, according to the rule given by tess->windingRule.
			* Each interior region is guaranteed be monotone.
			*/
			Sweep.computeInterior( this );

			var mesh = this.mesh;

			/* If the user wants only the boundary contours, we throw away all edges
			* except those which separate the interior from the exterior.
			* Otherwise we tessellate all the regions marked "inside".
			*/
			if (elementType == Tess2$1.BOUNDARY_CONTOURS) {
				this.setWindingNumber_( mesh, 1, true );
			} else {
				this.tessellateInterior_( mesh ); 
			}
	//		if (rc == 0) longjmp(tess->env,1);  /* could've used a label */

			mesh.check();

			if (elementType == Tess2$1.BOUNDARY_CONTOURS) {
				this.outputContours_( mesh, vertexSize );     /* output contours */
			}
			else
			{
				this.outputPolymesh_( mesh, elementType, polySize, vertexSize );     /* output polygons */
			}

//			tess.mesh = null;

			return true;
		}
	};

var index$12 = tess2;

var immutable = extend$1;

var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend$1() {
    var target = {};

    for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i];

        for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
                target[key] = source[key];
            }
        }
    }

    return target
}

var Tess2 = index$12;
var xtend = immutable;

var index$11 = function(contours, opt) {
    opt = opt||{};
    contours = contours.filter(function(c) {
        return c.length>0
    });
    
    if (contours.length === 0) {
        return { 
            positions: [],
            cells: []
        }
    }

    if (typeof opt.vertexSize !== 'number')
        opt.vertexSize = contours[0][0].length;

    //flatten for tess2.js
    contours = contours.map(function(c) {
        return c.reduce(function(a, b) {
            return a.concat(b)
        })
    });

    // Tesselate
    var res = Tess2.tesselate(xtend({
        contours: contours,
        windingRule: Tess2.WINDING_ODD,
        elementType: Tess2.POLYGONS,
        polySize: 3,
        vertexSize: 2
    }, opt));

    var positions = [];
    for (var i=0; i<res.vertices.length; i+=opt.vertexSize) {
        var pos = res.vertices.slice(i, i+opt.vertexSize);
        positions.push(pos);
    }
    
    var cells = [];
    for (i=0; i<res.elements.length; i+=3) {
        var a = res.elements[i],
            b = res.elements[i+1],
            c = res.elements[i+2];
        cells.push([a, b, c]);
    }

    //return a simplicial complex
    return {
        positions: positions,
        cells: cells
    }
};

var geometryForPath = function(context, path, threshold) {
  var key = path;
  if (context._pathCache[key]) {
    context._pathCacheHit++;
    return context._pathCache[key];
  }
  context._pathCacheMiss++;

  threshold = threshold || 1.0;
  if (!path) {
    return {lines: [], triangles: [], closed: false, z: 0};
  }

  // get a list of polylines/contours from svg contents
  var lines = index$2(index(path)), tri;

  // simplify the contours before triangulation
  lines = lines.map(function(path) {
    return index$1(path, threshold);
  });

  // triangluate can fail in some corner cases
  try {
    tri = index$11(lines);
  }
  catch(e) {
    console.log('Could not triangulate the following path:');
    console.log(path);
    console.log(e);
    tri = {positions: [], cells: []};
  }

  var z = context._randomZ ? 0.25*(Math.random() - 0.5) : 0;

  var triangles = [];
  var tcl = tri.cells.length,
      tc = tri.cells,
      tp = tri.positions;
  for (var ci = 0; ci < tcl; ci++) {
    var cell = tc[ci];
    var p1 = tp[cell[0]];
    var p2 = tp[cell[1]];
    var p3 = tp[cell[2]];
    triangles.push(p1[0], p1[1], z, p2[0], p2[1], z, p3[0], p3[1], z);
  }

  var geom = {
    lines: lines,
    triangles: triangles,
    closed: path.endsWith('Z'),
    z: z,
    key: key
  };

  context._pathCache[key] = geom;
  context._pathCacheSize++;
  if (context._pathCacheSize > 10000) {
    context._pathCache = {};
    context._pathCacheSize = 0;
    console.log('Geometry cache cleared.');
  }
  return geom;
};

function x$2(item)     { return item.x || 0; }
function y$2(item)     { return item.y || 0; }
function w$1(item)     { return item.width || 0; }
function wh$1(item)    { return item.width || item.height || 1; }
function h$1(item)     { return item.height || 0; }
function xw$1(item)    { return (item.x || 0) + (item.width || 0); }
function yh$1(item)    { return (item.y || 0) + (item.height || 0); }
function cr$1(item)    { return item.cornerRadius || 0; }
function pa$1(item)    { return item.padAngle || 0; }
function def$1(item)   { return !(item.defined === false); }
function size$1(item)  { return item.size == null ? 64 : item.size; }
function type$2(item) { return symbols$1(item.shape || 'circle'); }

var arcShape$1    = d3_arc().cornerRadius(cr$1).padAngle(pa$1);
var areavShape$1  = d3_area().x(x$2).y1(y$2).y0(yh$1).defined(def$1);
var areahShape$1  = d3_area().y(y$2).x1(x$2).x0(xw$1).defined(def$1);
var lineShape$1   = d3_line().x(x$2).y(y$2).defined(def$1);
var trailShape$1  = pathTrail().x(x$2).y(y$2).defined(def$1).size(wh$1);
var rectShape$1   = pathRectangle().x(x$2).y(y$2).width(w$1).height(h$1).cornerRadius(cr$1);
var rectShapeGL = pathRectangle().x(0).y(0).width(w$1).height(h$1).cornerRadius(cr$1);
var symbolShape$1 = d3_symbol().type(type$2).size(size$1);

function arc$3(context, item) {
  if (!context || context.arc) {
    return arcShape$1.context(context)(item);
  }
  return geometryForPath(context, arcShape$1.context(null)(item), 0.1);
}

function area$2(context, items) {
  var item = items[0],
      interp = item.interpolate || 'linear',
      s = (interp === 'trail' ? trailShape$1
        : (item.orient === 'horizontal' ? areahShape$1 : areavShape$1)
            .curve(curves(interp, item.orient, item.tension))
      );
  if (!context || context.arc) {
    return s.context(context)(items);
  }
  return geometryForPath(context, s.context(null)(items), 0.1);
}

function shape$2(context, item) {
  var s = item.mark.shape || item.shape;
  if (!context || context.arc) {
    return s.context(context)(item);
  }
  return geometryForPath(context, s.context(null)(item), 0.1);
}

function line$2(context, items) {
  var item = items[0],
      interp = item.interpolate || 'linear',
      s = lineShape$1.curve(curves(interp, item.orient, item.tension));
  if (!context || context.arc) {
    return s.context(context)(items);
  }
  return geometryForPath(context, s.context(null)(items));
}



function rectangleGL(context, item, x, y) {
  return geometryForPath(context, rectShapeGL.context(null)(item, x, y), 0.1);
}

function compare$2(a, b) {
  return a.zindex - b.zindex || a.index - b.index;
}

function zorder$1(scene) {
  if (!scene.zdirty) return scene.zitems;

  var items = scene.items,
      output = [], item, i, n;

  for (i=0, n=items.length; i<n; ++i) {
    item = items[i];
    item.index = i;
    if (item.zindex) output.push(item);
  }

  scene.zdirty = false;
  return scene.zitems = output.sort(compare$2);
}

function visit$1(scene, visitor) {
  var items = scene.items, i, n;
  if (!items || !items.length) return;

  var zitems = zorder$1(scene);

  if (zitems && zitems.length) {
    for (i=0, n=items.length; i<n; ++i) {
      if (!items[i].zindex) visitor(items[i]);
    }
    items = zitems;
  }

  for (i=0, n=items.length; i<n; ++i) {
    visitor(items[i]);
  }
}

// export function pickVisit(scene, visitor) {
//   var items = scene.items, hit, i;
//   if (!items || !items.length) return null;
//
//   var zitems = zorder(scene);
//   if (zitems && zitems.length) items = zitems;
//
//   for (i=items.length; --i >= 0;) {
//     if (hit = visitor(items[i])) return hit;
//   }
//
//   if (items === zitems) {
//     for (items=scene.items, i=items.length; --i >= 0;) {
//       if (!items[i].zindex) {
//         if (hit = visitor(items[i])) return hit;
//       }
//     }
//   }
//
//   return null;
// }

var drawGeometry = function(geom, gl, item) {
  var opacity = item.opacity == null ? 1 : item.opacity,
      tx = gl._tx + gl._origin[0],
      ty = gl._ty + gl._origin[1];

  if (opacity <= 0) return;
  if (geom.numTriangles === 0) return;

  gl.useProgram(gl._shaderProgram);

  gl.bindBuffer(gl.ARRAY_BUFFER, geom.triangleBuffer);
  gl.vertexAttribPointer(gl._coordLocation, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(gl._coordLocation);
  gl._lastTriangleBuffer = geom.triangleBuffer;

  gl.bindBuffer(gl.ARRAY_BUFFER, geom.colorBuffer);
  gl.vertexAttribPointer(gl._colorLocation, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(gl._colorLocation);
  gl._lastColorBuffer = geom.colorBuffer;

  gl.uniform2fv(gl._offsetLocation, [tx, ty]);
  gl.uniform4fv(gl._clipLocation, gl._clip);

  gl.drawArrays(gl.TRIANGLES, 0, geom.numTriangles * 3);
};

var define = function(constructor, factory, prototype) {
  constructor.prototype = factory.prototype = prototype;
  prototype.constructor = constructor;
};

function extend$2(parent, definition) {
  var prototype = Object.create(parent.prototype);
  for (var key in definition) prototype[key] = definition[key];
  return prototype;
}

function Color() {}

var darker = 0.7;
var brighter = 1 / darker;

var reI = "\\s*([+-]?\\d+)\\s*";
var reN = "\\s*([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)\\s*";
var reP = "\\s*([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)%\\s*";
var reHex3 = /^#([0-9a-f]{3})$/;
var reHex6 = /^#([0-9a-f]{6})$/;
var reRgbInteger = new RegExp("^rgb\\(" + [reI, reI, reI] + "\\)$");
var reRgbPercent = new RegExp("^rgb\\(" + [reP, reP, reP] + "\\)$");
var reRgbaInteger = new RegExp("^rgba\\(" + [reI, reI, reI, reN] + "\\)$");
var reRgbaPercent = new RegExp("^rgba\\(" + [reP, reP, reP, reN] + "\\)$");
var reHslPercent = new RegExp("^hsl\\(" + [reN, reP, reP] + "\\)$");
var reHslaPercent = new RegExp("^hsla\\(" + [reN, reP, reP, reN] + "\\)$");

var named = {
  aliceblue: 0xf0f8ff,
  antiquewhite: 0xfaebd7,
  aqua: 0x00ffff,
  aquamarine: 0x7fffd4,
  azure: 0xf0ffff,
  beige: 0xf5f5dc,
  bisque: 0xffe4c4,
  black: 0x000000,
  blanchedalmond: 0xffebcd,
  blue: 0x0000ff,
  blueviolet: 0x8a2be2,
  brown: 0xa52a2a,
  burlywood: 0xdeb887,
  cadetblue: 0x5f9ea0,
  chartreuse: 0x7fff00,
  chocolate: 0xd2691e,
  coral: 0xff7f50,
  cornflowerblue: 0x6495ed,
  cornsilk: 0xfff8dc,
  crimson: 0xdc143c,
  cyan: 0x00ffff,
  darkblue: 0x00008b,
  darkcyan: 0x008b8b,
  darkgoldenrod: 0xb8860b,
  darkgray: 0xa9a9a9,
  darkgreen: 0x006400,
  darkgrey: 0xa9a9a9,
  darkkhaki: 0xbdb76b,
  darkmagenta: 0x8b008b,
  darkolivegreen: 0x556b2f,
  darkorange: 0xff8c00,
  darkorchid: 0x9932cc,
  darkred: 0x8b0000,
  darksalmon: 0xe9967a,
  darkseagreen: 0x8fbc8f,
  darkslateblue: 0x483d8b,
  darkslategray: 0x2f4f4f,
  darkslategrey: 0x2f4f4f,
  darkturquoise: 0x00ced1,
  darkviolet: 0x9400d3,
  deeppink: 0xff1493,
  deepskyblue: 0x00bfff,
  dimgray: 0x696969,
  dimgrey: 0x696969,
  dodgerblue: 0x1e90ff,
  firebrick: 0xb22222,
  floralwhite: 0xfffaf0,
  forestgreen: 0x228b22,
  fuchsia: 0xff00ff,
  gainsboro: 0xdcdcdc,
  ghostwhite: 0xf8f8ff,
  gold: 0xffd700,
  goldenrod: 0xdaa520,
  gray: 0x808080,
  green: 0x008000,
  greenyellow: 0xadff2f,
  grey: 0x808080,
  honeydew: 0xf0fff0,
  hotpink: 0xff69b4,
  indianred: 0xcd5c5c,
  indigo: 0x4b0082,
  ivory: 0xfffff0,
  khaki: 0xf0e68c,
  lavender: 0xe6e6fa,
  lavenderblush: 0xfff0f5,
  lawngreen: 0x7cfc00,
  lemonchiffon: 0xfffacd,
  lightblue: 0xadd8e6,
  lightcoral: 0xf08080,
  lightcyan: 0xe0ffff,
  lightgoldenrodyellow: 0xfafad2,
  lightgray: 0xd3d3d3,
  lightgreen: 0x90ee90,
  lightgrey: 0xd3d3d3,
  lightpink: 0xffb6c1,
  lightsalmon: 0xffa07a,
  lightseagreen: 0x20b2aa,
  lightskyblue: 0x87cefa,
  lightslategray: 0x778899,
  lightslategrey: 0x778899,
  lightsteelblue: 0xb0c4de,
  lightyellow: 0xffffe0,
  lime: 0x00ff00,
  limegreen: 0x32cd32,
  linen: 0xfaf0e6,
  magenta: 0xff00ff,
  maroon: 0x800000,
  mediumaquamarine: 0x66cdaa,
  mediumblue: 0x0000cd,
  mediumorchid: 0xba55d3,
  mediumpurple: 0x9370db,
  mediumseagreen: 0x3cb371,
  mediumslateblue: 0x7b68ee,
  mediumspringgreen: 0x00fa9a,
  mediumturquoise: 0x48d1cc,
  mediumvioletred: 0xc71585,
  midnightblue: 0x191970,
  mintcream: 0xf5fffa,
  mistyrose: 0xffe4e1,
  moccasin: 0xffe4b5,
  navajowhite: 0xffdead,
  navy: 0x000080,
  oldlace: 0xfdf5e6,
  olive: 0x808000,
  olivedrab: 0x6b8e23,
  orange: 0xffa500,
  orangered: 0xff4500,
  orchid: 0xda70d6,
  palegoldenrod: 0xeee8aa,
  palegreen: 0x98fb98,
  paleturquoise: 0xafeeee,
  palevioletred: 0xdb7093,
  papayawhip: 0xffefd5,
  peachpuff: 0xffdab9,
  peru: 0xcd853f,
  pink: 0xffc0cb,
  plum: 0xdda0dd,
  powderblue: 0xb0e0e6,
  purple: 0x800080,
  rebeccapurple: 0x663399,
  red: 0xff0000,
  rosybrown: 0xbc8f8f,
  royalblue: 0x4169e1,
  saddlebrown: 0x8b4513,
  salmon: 0xfa8072,
  sandybrown: 0xf4a460,
  seagreen: 0x2e8b57,
  seashell: 0xfff5ee,
  sienna: 0xa0522d,
  silver: 0xc0c0c0,
  skyblue: 0x87ceeb,
  slateblue: 0x6a5acd,
  slategray: 0x708090,
  slategrey: 0x708090,
  snow: 0xfffafa,
  springgreen: 0x00ff7f,
  steelblue: 0x4682b4,
  tan: 0xd2b48c,
  teal: 0x008080,
  thistle: 0xd8bfd8,
  tomato: 0xff6347,
  turquoise: 0x40e0d0,
  violet: 0xee82ee,
  wheat: 0xf5deb3,
  white: 0xffffff,
  whitesmoke: 0xf5f5f5,
  yellow: 0xffff00,
  yellowgreen: 0x9acd32
};

define(Color, color$2, {
  displayable: function() {
    return this.rgb().displayable();
  },
  toString: function() {
    return this.rgb() + "";
  }
});

function color$2(format) {
  var m;
  format = (format + "").trim().toLowerCase();
  return (m = reHex3.exec(format)) ? (m = parseInt(m[1], 16), new Rgb((m >> 8 & 0xf) | (m >> 4 & 0x0f0), (m >> 4 & 0xf) | (m & 0xf0), ((m & 0xf) << 4) | (m & 0xf), 1)) // #f00
      : (m = reHex6.exec(format)) ? rgbn(parseInt(m[1], 16)) // #ff0000
      : (m = reRgbInteger.exec(format)) ? new Rgb(m[1], m[2], m[3], 1) // rgb(255, 0, 0)
      : (m = reRgbPercent.exec(format)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) // rgb(100%, 0%, 0%)
      : (m = reRgbaInteger.exec(format)) ? rgba(m[1], m[2], m[3], m[4]) // rgba(255, 0, 0, 1)
      : (m = reRgbaPercent.exec(format)) ? rgba(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) // rgb(100%, 0%, 0%, 1)
      : (m = reHslPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) // hsl(120, 50%, 50%)
      : (m = reHslaPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) // hsla(120, 50%, 50%, 1)
      : named.hasOwnProperty(format) ? rgbn(named[format])
      : format === "transparent" ? new Rgb(NaN, NaN, NaN, 0)
      : null;
}

function rgbn(n) {
  return new Rgb(n >> 16 & 0xff, n >> 8 & 0xff, n & 0xff, 1);
}

function rgba(r, g, b, a) {
  if (a <= 0) r = g = b = NaN;
  return new Rgb(r, g, b, a);
}

function rgbConvert(o) {
  if (!(o instanceof Color)) o = color$2(o);
  if (!o) return new Rgb;
  o = o.rgb();
  return new Rgb(o.r, o.g, o.b, o.opacity);
}

function rgb(r, g, b, opacity) {
  return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
}

function Rgb(r, g, b, opacity) {
  this.r = +r;
  this.g = +g;
  this.b = +b;
  this.opacity = +opacity;
}

define(Rgb, rgb, extend$2(Color, {
  brighter: function(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
  },
  darker: function(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
  },
  rgb: function() {
    return this;
  },
  displayable: function() {
    return (0 <= this.r && this.r <= 255)
        && (0 <= this.g && this.g <= 255)
        && (0 <= this.b && this.b <= 255)
        && (0 <= this.opacity && this.opacity <= 1);
  },
  toString: function() {
    var a = this.opacity; a = isNaN(a) ? 1 : Math.max(0, Math.min(1, a));
    return (a === 1 ? "rgb(" : "rgba(")
        + Math.max(0, Math.min(255, Math.round(this.r) || 0)) + ", "
        + Math.max(0, Math.min(255, Math.round(this.g) || 0)) + ", "
        + Math.max(0, Math.min(255, Math.round(this.b) || 0))
        + (a === 1 ? ")" : ", " + a + ")");
  }
}));

function hsla(h, s, l, a) {
  if (a <= 0) h = s = l = NaN;
  else if (l <= 0 || l >= 1) h = s = NaN;
  else if (s <= 0) h = NaN;
  return new Hsl(h, s, l, a);
}

function hslConvert(o) {
  if (o instanceof Hsl) return new Hsl(o.h, o.s, o.l, o.opacity);
  if (!(o instanceof Color)) o = color$2(o);
  if (!o) return new Hsl;
  if (o instanceof Hsl) return o;
  o = o.rgb();
  var r = o.r / 255,
      g = o.g / 255,
      b = o.b / 255,
      min = Math.min(r, g, b),
      max = Math.max(r, g, b),
      h = NaN,
      s = max - min,
      l = (max + min) / 2;
  if (s) {
    if (r === max) h = (g - b) / s + (g < b) * 6;
    else if (g === max) h = (b - r) / s + 2;
    else h = (r - g) / s + 4;
    s /= l < 0.5 ? max + min : 2 - max - min;
    h *= 60;
  } else {
    s = l > 0 && l < 1 ? 0 : h;
  }
  return new Hsl(h, s, l, o.opacity);
}

function hsl(h, s, l, opacity) {
  return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s, l, opacity == null ? 1 : opacity);
}

function Hsl(h, s, l, opacity) {
  this.h = +h;
  this.s = +s;
  this.l = +l;
  this.opacity = +opacity;
}

define(Hsl, hsl, extend$2(Color, {
  brighter: function(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Hsl(this.h, this.s, this.l * k, this.opacity);
  },
  darker: function(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Hsl(this.h, this.s, this.l * k, this.opacity);
  },
  rgb: function() {
    var h = this.h % 360 + (this.h < 0) * 360,
        s = isNaN(h) || isNaN(this.s) ? 0 : this.s,
        l = this.l,
        m2 = l + (l < 0.5 ? l : 1 - l) * s,
        m1 = 2 * l - m2;
    return new Rgb(
      hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2),
      hsl2rgb(h, m1, m2),
      hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2),
      this.opacity
    );
  },
  displayable: function() {
    return (0 <= this.s && this.s <= 1 || isNaN(this.s))
        && (0 <= this.l && this.l <= 1)
        && (0 <= this.opacity && this.opacity <= 1);
  }
}));

/* From FvD 13.37, CSS Color Module Level 3 */
function hsl2rgb(h, m1, m2) {
  return (h < 60 ? m1 + (m2 - m1) * h / 60
      : h < 180 ? m2
      : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60
      : m1) * 255;
}

var deg2rad = Math.PI / 180;
var rad2deg = 180 / Math.PI;

var Kn = 18;
var Xn = 0.950470;
var Yn = 1;
var Zn = 1.088830;
var t0$1 = 4 / 29;
var t1$1 = 6 / 29;
var t2 = 3 * t1$1 * t1$1;
var t3 = t1$1 * t1$1 * t1$1;

function labConvert(o) {
  if (o instanceof Lab) return new Lab(o.l, o.a, o.b, o.opacity);
  if (o instanceof Hcl) {
    var h = o.h * deg2rad;
    return new Lab(o.l, Math.cos(h) * o.c, Math.sin(h) * o.c, o.opacity);
  }
  if (!(o instanceof Rgb)) o = rgbConvert(o);
  var b = rgb2xyz(o.r),
      a = rgb2xyz(o.g),
      l = rgb2xyz(o.b),
      x = xyz2lab((0.4124564 * b + 0.3575761 * a + 0.1804375 * l) / Xn),
      y = xyz2lab((0.2126729 * b + 0.7151522 * a + 0.0721750 * l) / Yn),
      z = xyz2lab((0.0193339 * b + 0.1191920 * a + 0.9503041 * l) / Zn);
  return new Lab(116 * y - 16, 500 * (x - y), 200 * (y - z), o.opacity);
}

function lab(l, a, b, opacity) {
  return arguments.length === 1 ? labConvert(l) : new Lab(l, a, b, opacity == null ? 1 : opacity);
}

function Lab(l, a, b, opacity) {
  this.l = +l;
  this.a = +a;
  this.b = +b;
  this.opacity = +opacity;
}

define(Lab, lab, extend$2(Color, {
  brighter: function(k) {
    return new Lab(this.l + Kn * (k == null ? 1 : k), this.a, this.b, this.opacity);
  },
  darker: function(k) {
    return new Lab(this.l - Kn * (k == null ? 1 : k), this.a, this.b, this.opacity);
  },
  rgb: function() {
    var y = (this.l + 16) / 116,
        x = isNaN(this.a) ? y : y + this.a / 500,
        z = isNaN(this.b) ? y : y - this.b / 200;
    y = Yn * lab2xyz(y);
    x = Xn * lab2xyz(x);
    z = Zn * lab2xyz(z);
    return new Rgb(
      xyz2rgb( 3.2404542 * x - 1.5371385 * y - 0.4985314 * z), // D65 -> sRGB
      xyz2rgb(-0.9692660 * x + 1.8760108 * y + 0.0415560 * z),
      xyz2rgb( 0.0556434 * x - 0.2040259 * y + 1.0572252 * z),
      this.opacity
    );
  }
}));

function xyz2lab(t) {
  return t > t3 ? Math.pow(t, 1 / 3) : t / t2 + t0$1;
}

function lab2xyz(t) {
  return t > t1$1 ? t * t * t : t2 * (t - t0$1);
}

function xyz2rgb(x) {
  return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
}

function rgb2xyz(x) {
  return (x /= 255) <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function hclConvert(o) {
  if (o instanceof Hcl) return new Hcl(o.h, o.c, o.l, o.opacity);
  if (!(o instanceof Lab)) o = labConvert(o);
  var h = Math.atan2(o.b, o.a) * rad2deg;
  return new Hcl(h < 0 ? h + 360 : h, Math.sqrt(o.a * o.a + o.b * o.b), o.l, o.opacity);
}

function hcl(h, c, l, opacity) {
  return arguments.length === 1 ? hclConvert(h) : new Hcl(h, c, l, opacity == null ? 1 : opacity);
}

function Hcl(h, c, l, opacity) {
  this.h = +h;
  this.c = +c;
  this.l = +l;
  this.opacity = +opacity;
}

define(Hcl, hcl, extend$2(Color, {
  brighter: function(k) {
    return new Hcl(this.h, this.c, this.l + Kn * (k == null ? 1 : k), this.opacity);
  },
  darker: function(k) {
    return new Hcl(this.h, this.c, this.l - Kn * (k == null ? 1 : k), this.opacity);
  },
  rgb: function() {
    return labConvert(this).rgb();
  }
}));

var A = -0.14861;
var B = +1.78277;
var C = -0.29227;
var D = -0.90649;
var E = +1.97294;
var ED = E * D;
var EB = E * B;
var BC_DA = B * C - D * A;

function cubehelixConvert(o) {
  if (o instanceof Cubehelix) return new Cubehelix(o.h, o.s, o.l, o.opacity);
  if (!(o instanceof Rgb)) o = rgbConvert(o);
  var r = o.r / 255,
      g = o.g / 255,
      b = o.b / 255,
      l = (BC_DA * b + ED * r - EB * g) / (BC_DA + ED - EB),
      bl = b - l,
      k = (E * (g - l) - C * bl) / D,
      s = Math.sqrt(k * k + bl * bl) / (E * l * (1 - l)), // NaN if l=0 or l=1
      h = s ? Math.atan2(k, bl) * rad2deg - 120 : NaN;
  return new Cubehelix(h < 0 ? h + 360 : h, s, l, o.opacity);
}

function cubehelix(h, s, l, opacity) {
  return arguments.length === 1 ? cubehelixConvert(h) : new Cubehelix(h, s, l, opacity == null ? 1 : opacity);
}

function Cubehelix(h, s, l, opacity) {
  this.h = +h;
  this.s = +s;
  this.l = +l;
  this.opacity = +opacity;
}

define(Cubehelix, cubehelix, extend$2(Color, {
  brighter: function(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Cubehelix(this.h, this.s, this.l * k, this.opacity);
  },
  darker: function(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Cubehelix(this.h, this.s, this.l * k, this.opacity);
  },
  rgb: function() {
    var h = isNaN(this.h) ? 0 : (this.h + 120) * deg2rad,
        l = +this.l,
        a = isNaN(this.s) ? 0 : this.s * l * (1 - l),
        cosh = Math.cos(h),
        sinh = Math.sin(h);
    return new Rgb(
      255 * (l + a * (A * cosh + B * sinh)),
      255 * (l + a * (C * cosh + D * sinh)),
      255 * (l + a * (E * cosh)),
      this.opacity
    );
  }
}));

var cache = {};

var color$1 = function(context, item, value) {
  if (!value) {
    return [1.0, 1.0, 1.0];
  }
  if (value.id) {
    // TODO: support gradients
    return [1.0, 1.0, 1.0];
  }
  if (cache[value]) {
    return cache[value];
  }
  var rgb$$1 = color$2(value).rgb();
  cache[value] = [rgb$$1.r / 255, rgb$$1.g / 255, rgb$$1.b / 255];
  return cache[value];
};

var index$15 = function numtype(num, def) {
	return typeof num === 'number'
		? num 
		: (typeof def === 'number' ? def : 0)
};

var copy_1 = copy$1;

/**
 * Copy the values from one vec2 to another
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the source vector
 * @returns {vec2} out
 */
function copy$1(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    return out
}

var scaleAndAdd_1 = scaleAndAdd;

/**
 * Adds two vec2's after scaling the second operand by a scalar value
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @param {Number} scale the amount to scale b by before adding
 * @returns {vec2} out
 */
function scaleAndAdd(out, a, b, scale) {
    out[0] = a[0] + (b[0] * scale);
    out[1] = a[1] + (b[1] * scale);
    return out
}

var dot_1 = dot;

/**
 * Calculates the dot product of two vec2's
 *
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {Number} dot product of a and b
 */
function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1]
}

function clone$1(arr) {
    return [arr[0], arr[1]]
}

function create$1() {
    return [0, 0]
}

var vecutil = {
    create: create$1,
    clone: clone$1,
    copy: copy_1,
    scaleAndAdd: scaleAndAdd_1,
    dot: dot_1
};

var add_1 = add$2;

/**
 * Adds two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec2} out
 */
function add$2(out, a, b) {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    return out
}

var set_1 = set$5;

/**
 * Set the components of a vec2 to the given values
 *
 * @param {vec2} out the receiving vector
 * @param {Number} x X component
 * @param {Number} y Y component
 * @returns {vec2} out
 */
function set$5(out, x, y) {
    out[0] = x;
    out[1] = y;
    return out
}

var normalize_1 = normalize$2;

/**
 * Normalize a vec2
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a vector to normalize
 * @returns {vec2} out
 */
function normalize$2(out, a) {
    var x = a[0],
        y = a[1];
    var len = x*x + y*y;
    if (len > 0) {
        //TODO: evaluate use of glm_invsqrt here?
        len = 1 / Math.sqrt(len);
        out[0] = a[0] * len;
        out[1] = a[1] * len;
    }
    return out
}

var subtract_1 = subtract$1;

/**
 * Subtracts vector b from vector a
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec2} out
 */
function subtract$1(out, a, b) {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    return out
}

var add$1 = add_1;
var set$4 = set_1;
var normalize$1 = normalize_1;
var subtract = subtract_1;
var dot$1 = dot_1;

var tmp$1 = [0, 0];

var computeMiter$1 = function computeMiter$1(tangent, miter, lineA, lineB, halfThick) {
    //get tangent line
    add$1(tangent, lineA, lineB);
    normalize$1(tangent, tangent);

    //get miter as a unit vector
    set$4(miter, -tangent[1], tangent[0]);
    set$4(tmp$1, -lineA[1], lineA[0]);

    //get the necessary length of our miter
    return halfThick / dot$1(miter, tmp$1)
};

var normal$1 = function normal$1(out, dir) {
    //get perpendicular
    set$4(out, -dir[1], dir[0]);
    return out
};

var direction$1 = function direction$1(out, a, b) {
    //get unit dir of two lines
    subtract(out, a, b);
    normalize$1(out, out);
    return out
};

var index$17 = {
	computeMiter: computeMiter$1,
	normal: normal$1,
	direction: direction$1
};

var number$1 = index$15;
var vec = vecutil;

var tmp = vec.create();
var capEnd = vec.create();
var lineA = vec.create();
var lineB = vec.create();
var tangent = vec.create();
var miter = vec.create();

var util = index$17;
var computeMiter = util.computeMiter;
var normal = util.normal;
var direction = util.direction;

function Stroke(opt) {
    if (!(this instanceof Stroke))
        return new Stroke(opt)
    opt = opt||{};
    this.miterLimit = number$1(opt.miterLimit, 10);
    this.thickness = number$1(opt.thickness, 1);
    this.join = opt.join || 'miter';
    this.cap = opt.cap || 'butt';
    this._normal = null;
    this._lastFlip = -1;
    this._started = false;
}

Stroke.prototype.mapThickness = function(point, i, points) {
    return this.thickness
};

Stroke.prototype.build = function(points) {
    var complex = {
        positions: [],
        cells: []
    };

    if (points.length <= 1)
        return complex

    var total = points.length;

    //clear flags
    this._lastFlip = -1;
    this._started = false;
    this._normal = null;

    //join each segment
    for (var i=1, count=0; i<total; i++) {
        var last = points[i-1];
        var cur = points[i];
        var next = i<points.length-1 ? points[i+1] : null;
        var thickness = this.mapThickness(cur, i, points);
        var amt = this._seg(complex, count, last, cur, next, thickness/2);
        count += amt;
    }
    return complex
};

Stroke.prototype._seg = function(complex, index, last, cur, next, halfThick) {
    var count = 0;
    var cells = complex.cells;
    var positions = complex.positions;
    var capSquare = this.cap === 'square';
    var joinBevel = this.join === 'bevel';

    //get unit direction of line
    direction(lineA, cur, last);

    //if we don't yet have a normal from previous join,
    //compute based on line start - end
    if (!this._normal) {
        this._normal = vec.create();
        normal(this._normal, lineA);
    }

    //if we haven't started yet, add the first two points
    if (!this._started) {
        this._started = true;

        //if the end cap is type square, we can just push the verts out a bit
        if (capSquare) {
            vec.scaleAndAdd(capEnd, last, lineA, -halfThick);
            last = capEnd;
        }

        extrusions(positions, last, this._normal, halfThick);
    }

    cells.push([index+0, index+1, index+2]);

    /*
    // now determine the type of join with next segment

    - round (TODO)
    - bevel 
    - miter
    - none (i.e. no next segment, use normal)
     */
    
    if (!next) { //no next segment, simple extrusion
        //now reset normal to finish cap
        normal(this._normal, lineA);

        //push square end cap out a bit
        if (capSquare) {
            vec.scaleAndAdd(capEnd, cur, lineA, halfThick);
            cur = capEnd;
        }

        extrusions(positions, cur, this._normal, halfThick);
        cells.push(this._lastFlip===1 ? [index, index+2, index+3] : [index+2, index+1, index+3]);

        count += 2;
     } else { //we have a next segment, start with miter
        //get unit dir of next line
        direction(lineB, next, cur);

        //stores tangent & miter
        var miterLen = computeMiter(tangent, miter, lineA, lineB, halfThick);

        // normal(tmp, lineA)
        
        //get orientation
        var flip = (vec.dot(tangent, this._normal) < 0) ? -1 : 1;

        var bevel = joinBevel;
        if (!bevel && this.join === 'miter') {
            var limit = miterLen / (halfThick);
            if (limit > this.miterLimit)
                bevel = true;
        }

        if (bevel) {    
            //next two points in our first segment
            vec.scaleAndAdd(tmp, cur, this._normal, -halfThick * flip);
            positions.push(vec.clone(tmp));
            vec.scaleAndAdd(tmp, cur, miter, miterLen * flip);
            positions.push(vec.clone(tmp));


            cells.push(this._lastFlip!==-flip
                    ? [index, index+2, index+3] 
                    : [index+2, index+1, index+3]);

            //now add the bevel triangle
            cells.push([index+2, index+3, index+4]);

            normal(tmp, lineB);
            vec.copy(this._normal, tmp); //store normal for next round

            vec.scaleAndAdd(tmp, cur, tmp, -halfThick*flip);
            positions.push(vec.clone(tmp));

            // //the miter is now the normal for our next join
            count += 3;
        } else { //miter
            //next two points for our miter join
            extrusions(positions, cur, miter, miterLen);
            cells.push(this._lastFlip===1
                    ? [index, index+2, index+3] 
                    : [index+2, index+1, index+3]);

            flip = -1;

            //the miter is now the normal for our next join
            vec.copy(this._normal, miter);
            count += 2;
        }
        this._lastFlip = flip;
     }
     return count
};

function extrusions(positions, point, normal, scale) {
    //next two points to end our segment
    vec.scaleAndAdd(tmp, point, normal, -scale);
    positions.push(vec.clone(tmp));

    vec.scaleAndAdd(tmp, point, normal, scale);
    positions.push(vec.clone(tmp));
}

var index$14 = Stroke;

var geometryForItem = function(context, item, shapeGeom, opacity) {
  var lw = (lw = item.strokeWidth) != null ? lw : 1,
      lc = (lc = item.strokeCap) != null ? lc : 'butt';
  var strokeMeshes = [];
  var i, len, c, li, ci, mesh, triangles, colors, cell, p1, p2, p3, mp, mc, mcl,
      triangleBuffer, colorBuffer, n = 0, fill = false, stroke = false, v;
  var opacity = item.opacity == null ? 1 : item.opacity;
  var fillOpacity = opacity * (item.fillOpacity==null ? 1 : item.fillOpacity);
  var triangles = [];
  var colors = [];
  var strokeOpacity = opacity * (item.strokeOpacity==null ? 1 : item.strokeOpacity),
      strokeExtrude,
      z = shapeGeom.z || 0,
      st = shapeGeom.triangles,
      val,
      key = shapeGeom.key + ';' + lw + ';' + lc + ';' + closed + ';' + item.fill + ';' + item.fillOpacity + ';' + item.stroke + ';' + item.strokeOpacity;

  if (item.fill === 'transparent') {
    fillOpacity = 0;
  }
  if (item.fill && fillOpacity > 0) {
    fill = true;
    n = st ? st.length / 9 : 0;
  }

  if (item.stroke === 'transparent') {
    strokeOpacity = 0;
  }
  if (lw > 0 && item.stroke && strokeOpacity > 0) {
    stroke = true;
    strokeExtrude = index$14({
        thickness: lw,
        cap: lc,
        join: 'miter',
        miterLimit: 1,
        closed: !!shapeGeom.closed
    });
    for (li = 0; li < shapeGeom.lines.length; li++) {
      mesh = strokeExtrude.build(shapeGeom.lines[li]);
      strokeMeshes.push(mesh);
      n += mesh.cells.length;
    }
  }

  triangles = new Float32Array(n * 3 * 3);
  colors = new Float32Array(n * 3 * 4);

  if (fill) {
    c = color$1(context, item, item.fill);
    for (i = 0, len = st.length; i < len; i += 3) {
      triangles[i    ] = st[i    ];
      triangles[i + 1] = st[i + 1];
      triangles[i + 2] = st[i + 2];
    }
    for (i = 0, len = st.length / 3; i < len; i++) {
      colors[i*4    ] = c[0];
      colors[i*4 + 1] = c[1];
      colors[i*4 + 2] = c[2];
      colors[i*4 + 3] = fillOpacity;
    }
  }

  if (stroke) {
    c = color$1(context, item, item.stroke);
    i = fill ? st.length / 3 : 0;
    for (li = 0; li < strokeMeshes.length; li++) {
      mesh = strokeMeshes[li],
      mp = mesh.positions,
      mc = mesh.cells,
      mcl = mesh.cells.length;
      for (ci = 0; ci < mcl; ci++) {
        cell = mc[ci];
        p1 = mp[cell[0]];
        p2 = mp[cell[1]];
        p3 = mp[cell[2]];
        triangles[i*3    ] = p1[0];
        triangles[i*3 + 1] = p1[1];
        triangles[i*3 + 2] = z;
        colors[i*4    ] = c[0];
        colors[i*4 + 1] = c[1];
        colors[i*4 + 2] = c[2];
        colors[i*4 + 3] = strokeOpacity;
        i++;

        triangles[i*3    ] = p2[0];
        triangles[i*3 + 1] = p2[1];
        triangles[i*3 + 2] = z;
        colors[i*4    ] = c[0];
        colors[i*4 + 1] = c[1];
        colors[i*4 + 2] = c[2];
        colors[i*4 + 3] = strokeOpacity;
        i++;

        triangles[i*3    ] = p3[0];
        triangles[i*3 + 1] = p3[1];
        triangles[i*3 + 2] = z;
        colors[i*4    ] = c[0];
        colors[i*4 + 1] = c[1];
        colors[i*4 + 2] = c[2];
        colors[i*4 + 3] = strokeOpacity;
        i++;
      }
    }
  }

  triangleBuffer = context.createBuffer();
  context.bindBuffer(context.ARRAY_BUFFER, triangleBuffer);
  context.bufferData(context.ARRAY_BUFFER, triangles, context.STATIC_DRAW);

  colorBuffer = context.createBuffer();
  context.bindBuffer(context.ARRAY_BUFFER, colorBuffer);
  context.bufferData(context.ARRAY_BUFFER, colors, context.STATIC_DRAW);

  val = {
    triangleBuffer: triangleBuffer,
    colorBuffer: colorBuffer,
    numTriangles: n
  };

  if (item._geom) {
    if (item._geom.triangleBuffer) {
      context.deleteBuffer(item._geom.triangleBuffer);
    }
    if (item._geom.colorBuffer) {
      context.deleteBuffer(item._geom.colorBuffer);
    }
  }

  return val;
};

var markItemPath$1 = function(type, shape) {

  function drawGL(context, scene, bounds) {
    visit$1(scene, function(item) {
      if (bounds && !bounds.intersects(item.bounds)) return; // bounds check

      var x = item.x || 0,
          y = item.y || 0,
          i, shapeGeom;

      context._tx += x;
      context._ty += y;

      if (context._fullRedraw || item._dirty || !item._geom || item._geom.deleted) {
        shapeGeom = shape(context, item);
        item._geom = geometryForItem(context, item, shapeGeom);
      }
      drawGeometry(item._geom, context, item);

      context._tx -= x;
      context._ty -= y;
    });
  }

  return {
    type:   type,
    drawGL: drawGL
  };

};

var arc$2 = markItemPath$1('arc', arc$3);

var markMultiItemPath$1 = function(type, shape) {

  function drawGL(context, scene, bounds) {
    if (scene.items.length && (!bounds || bounds.intersects(scene.bounds))) {
      var item = scene.items[0];
      var geom = shape(context, scene.items);
      var dirty = false;
      for (var i = 0; i < scene.items.length; i++) {
        if (scene.items[i]._dirty) {
          dirty = true;
          break;
        }
      }
      if (context._fullRedraw || dirty || !item._geom || item._geom.deleted) {
        var shapeGeom = shape(context, scene.items);
        item._geom = geometryForItem(context, item, shapeGeom);
      }
      drawGeometry(item._geom, context, item);
    }
  }

  return {
    type:   type,
    drawGL: drawGL
  };

};

var area$3 = markMultiItemPath$1('area', area$2);

function drawGL(context, scene, bounds) {
  var renderer = this;

  visit$1(scene, function(group) {
    var gx = group.x || 0,
        gy = group.y || 0,
        w = group.width || 0,
        h = group.height || 0,
        offset, opacity, oldClip;

    // setup graphics context
    context._tx += gx;
    context._ty += gy;
    context._textContext.save();
    context._textContext.translate(gx, gy);

    // draw group background
    if (context._fullRedraw || group._dirty || !group._geom || group._geom.deleted) {
      offset = group.stroke ? 0.5 : 0;
      var shapeGeom = rectangleGL(context, group, offset, offset);
      group._geom = geometryForItem(context, group, shapeGeom);
    }
    drawGeometry(group._geom, context, group);

    // set clip and bounds
    if (group.clip) {
      oldClip = context._clip;
      context._clip = [
        context._origin[0] + context._tx,
        context._origin[1] + context._ty,
        context._origin[0] + context._tx + w,
        context._origin[1] + context._ty + h
      ];
    }
    if (bounds) bounds.translate(-gx, -gy);

    // draw group contents
    visit$1(group, function(item) {
      renderer.draw(context, item, bounds);
    });

    // restore graphics context
    if (bounds) bounds.translate(gx, gy);
    if (group.clip) {
      context._clip = oldClip;
    }

    context._tx -= gx;
    context._ty -= gy;
    context._textContext.restore();
  });
}

var group$1 = {
  type:       'group',
  drawGL:     drawGL
};

function multiply(a, b) {
  var ind = [
    0,0,4,1,8,2,12,3,
    1,0,5,1,9,2,13,3,
    2,0,6,1,10,2,14,3,
    3,0,7,1,11,2,15,3,
    0,4,4,5,8,6,12,7,
    1,4,5,5,9,6,13,7,
    2,4,6,5,10,6,14,7,
    3,4,7,5,11,6,15,7,
    0,8,4,9,8,10,12,11,
    1,8,5,9,9,10,13,11,
    2,8,6,9,10,10,14,11,
    3,8,7,9,11,10,15,11,
    0,12,4,13,8,14,12,15,
    1,12,5,13,9,14,13,15,
    2,12,6,13,10,14,14,15,
    3,12,7,13,11,14,15,15
  ];
  var c = [
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0
  ];
  for (var i = 0; i < ind.length/2; i++) {
    c[Math.floor(i/4)] += a[ind[2*i]] * b[ind[2*i+1]];
  }
  return c;
}

function perspective(fieldOfViewInRadians, aspect, near, far) {
  var f = Math.tan(Math.PI * 0.5 - 0.5 * fieldOfViewInRadians);
  var rangeInv = 1.0 / (near - far);

  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near + far) * rangeInv, -1,
    0, 0, near * far * rangeInv * 2, 0
  ];
}

function rotateX(a) {
  return [
    1, 0, 0, 0,
    0, Math.cos(a), Math.sin(a), 0,
    0, -Math.sin(a), Math.cos(a), 0,
    0, 0, 0, 1
  ];
}

function rotateY(a) {
  return [
    Math.cos(a), 0, -Math.sin(a), 0,
    0, 1, 0, 0,
    Math.sin(a), 0, Math.cos(a), 0,
    0, 0, 0, 1
  ];
}

function rotateZ(a) {
  return [
    Math.cos(a), Math.sin(a), 0, 0,
    -Math.sin(a), Math.cos(a), 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];
}

function translate$3(x, y, z) {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1
  ];
}

// Adapted from https://github.com/greggman/webgl-fundamentals
//
// BSD license follows:
//
// Copyright 2012, Gregg Tavares.
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
//     * Redistributions of source code must retain the above copyright
// notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above
// copyright notice, this list of conditions and the following disclaimer
// in the documentation and/or other materials provided with the
// distribution.
//     * Neither the name of Gregg Tavares. nor the names of his
// contributors may be used to endorse or promote products derived from
// this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

// creates a texture info { width: w, height: h, texture: tex }
function loadImageAndCreateTextureInfo(gl, img) {
  var tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  // Fill the texture with a 1x1 blue pixel.
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                new Uint8Array([0, 0, 255, 255]));
  // let's assume all images are not a power of 2
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  var textureInfo = {texture: tex};
  textureInfo.width = img.width;
  textureInfo.height = img.height;
  gl.bindTexture(gl.TEXTURE_2D, textureInfo.texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  return textureInfo;
}

function drawImage(gl, texInfo, matrix) {
  gl.bindTexture(gl.TEXTURE_2D, texInfo.texture);
  gl.useProgram(gl._imageShaderProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl._imagePositionBuffer);
  gl.enableVertexAttribArray(gl._imagePositionLocation);
  gl.vertexAttribPointer(gl._imagePositionLocation, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl._imageTexcoordBuffer);
  gl.enableVertexAttribArray(gl._imageTexcoordLocation);
  gl.vertexAttribPointer(gl._imageTexcoordLocation, 2, gl.FLOAT, false, 0, 0);
  var w = gl.canvas.width / gl._ratio,
      h = gl.canvas.height / gl._ratio;
  var preMatrix = [
    texInfo.w, 0, 0, 0,
    0, texInfo.h, 0, 0,
    0, 0, 1, 0,
    texInfo.x, texInfo.y, 0, 1
  ];
  matrix = multiply(matrix, preMatrix);
  gl.uniformMatrix4fv(gl._imageMatrixLocation, false, matrix);
  gl.uniform1i(gl._imageTextureLocation, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function getImage$1(item, renderer) {
  var image = item.image;
  if (!image || image.url !== item.url) {
    image = {loaded: false, width: 0, height: 0};
    renderer.loadImage(item.url).then(function(image) {
      item.image = image;
      item.image.url = item.url;
    });
  }
  return image;
}

function imageXOffset$1(align, w) {
  return align === 'center' ? w / 2 : align === 'right' ? w : 0;
}

function imageYOffset$1(baseline, h) {
  return baseline === 'middle' ? h / 2 : baseline === 'bottom' ? h : 0;
}

function drawGL$1(context, scene, bounds) {
  var renderer = this;

  visit$1(scene, function(item) {
    if (bounds && !bounds.intersects(item.bounds)) return; // bounds check

    var image = getImage$1(item, renderer),
        x = item.x || 0,
        y = item.y || 0,
        w = item.width || image.width || 0,
        h = item.height || image.height || 0,
        opacity;

    x -= imageXOffset$1(item.align, w);
    y -= imageYOffset$1(item.baseline, h);

    if (image.loaded) {
      var imgInfo = loadImageAndCreateTextureInfo(context, image);
      imgInfo.x = x + context._tx + context._origin[0];
      imgInfo.y = y + context._ty + context._origin[1];
      imgInfo.w = w;
      imgInfo.h = h;
      context._images.push(imgInfo);
    }
  });
}

var image$1 = {
  type:   'image',
  drawGL: drawGL$1
};

var line$4 = markMultiItemPath$1('line', line$2);

function drawGL$2(context, scene, bounds) {
  visit$1(scene, function(item) {
    var path = item.path;
    if (path == null) return true;

    var x = item.x || 0,
        y = item.y || 0;

    context._tx += x;
    context._ty += y;

    if (context._fullRedraw || item._dirty || !item._geom || item._geom.deleted) {
      var shapeGeom = geometryForPath(context, path);
      item._geom = geometryForItem(context, item, shapeGeom);
    }
    drawGeometry(item._geom, context, item);

    context._tx -= x;
    context._ty -= y;
  });
}

var path$5 = {
  type:   'path',
  drawGL: drawGL$2
};

function drawGL$3(gl, scene, bounds) {
  var unit, pos, size,
      strokeWidth, strokeOpacity, strokeColor,
      fillOpacity, fillColor, cornerRadius,
      unitBuffer, posBuffer, sizeBuffer,
      strokeWidthBuffer, strokeOpacityBuffer, strokeColorBuffer,
      fillOpacityBuffer, fillColorBuffer, cornerRadiusBuffer,
      ivpf = 0, ivpf2 = 0, ivpf3 = 0,
      numPts = scene.items.length,
      unitItem, j, anyGradients = false, ci,
      sg = scene._rectGeom;

  for (j = 0; j < scene.items.length; ++j) {
    ci = scene.items[j];
    if ((ci.stroke && ci.stroke.id) || (ci.fill && ci.fill.id)) {
      anyGradients = true;
      break;
    }
  }
  if (anyGradients) {
    marks.rect.draw(gl._textContext, scene, bounds);
    return;
  }

  if (sg && sg.numPts === numPts) {
    unit = sg.unit;
    unitBuffer = sg.unitBuffer;
    pos = sg.pos;
    size = sg.size;
    strokeWidth = sg.strokeWidth;
    strokeOpacity = sg.strokeOpacity;
    strokeColor = sg.strokeColor;
    fillOpacity = sg.fillOpacity;
    fillColor = sg.fillColor;
    cornerRadius = sg.cornerRadius;
  } else {
    if (sg) {
      gl.deleteBuffer(sg.unitBuffer);
    }
    unit = new Float32Array(6 * numPts * 2);
    pos = new Float32Array(6 * numPts * 3);
    size = new Float32Array(6 * numPts * 2);
    strokeWidth = new Float32Array(6 * numPts);
    strokeOpacity = new Float32Array(6 * numPts);
    strokeColor = new Float32Array(6 * numPts * 3);
    fillOpacity = new Float32Array(6 * numPts);
    fillColor = new Float32Array(6 * numPts * 3);
    cornerRadius = new Float32Array(6 * numPts);

    unitItem = [
      0, 1,
      1, 1,
      1, 0,
      1, 0,
      0, 0,
      0, 1
    ];
    for (j = 0; j < numPts * unitItem.length; j += 1) {
      unit[j] = unitItem[j % unitItem.length];
    }
  }

  if (sg) {
    gl.deleteBuffer(sg.posBuffer);
    gl.deleteBuffer(sg.sizeBuffer);
    gl.deleteBuffer(sg.strokeWidthBuffer);
    gl.deleteBuffer(sg.strokeOpacityBuffer);
    gl.deleteBuffer(sg.strokeColorBuffer);
    gl.deleteBuffer(sg.fillOpacityBuffer);
    gl.deleteBuffer(sg.fillColorBuffer);
    gl.deleteBuffer(sg.cornerRadiusBuffer);
  }

  visit$1(scene, function(item) {
    var x = (item.x || 0) + gl._tx + gl._origin[0],
        y = (item.y || 0) + gl._ty + gl._origin[1],
        fc = color$1(gl, item, item.fill),
        sc = color$1(gl, item, item.stroke),
        op = item.opacity == null ? 1 : item.opacity,
        fo = op * ((item.fill == null || item.fill == 'transparent') ? 0 : 1) * (item.fillOpacity == null ? 1 : item.fillOpacity),
        so = op * ((item.stroke == null || item.stroke == 'transparent') ? 0 : 1) * (item.strokeOpacity == null ? 1 : item.strokeOpacity),
        sw = ((item.stroke == null || item.stroke == 'transparent') ? 0 : 1) * (item.strokeWidth == null ? 1 : item.strokeWidth),
        sx = (item.width == null ? 0 : item.width),
        sy = (item.height == null ? 0 : item.height),
        cr = (item.cornerRadius == null ? 0 : item.cornerRadius);

    for (j = 0; j < 6; j += 1, ivpf += 1, ivpf2 += 2, ivpf3 += 3) {
      pos[ivpf3] = x;
      pos[ivpf3 + 1] = y;
      pos[ivpf3 + 2] = 0;
      size[ivpf2] = sx;
      size[ivpf2 + 1] = sy;
      strokeWidth[ivpf] = sw;
      strokeOpacity[ivpf] = so;
      strokeColor[ivpf3] = sc[0];
      strokeColor[ivpf3 + 1] = sc[1];
      strokeColor[ivpf3 + 2] = sc[2];
      fillOpacity[ivpf] = fo;
      fillColor[ivpf3] = fc[0];
      fillColor[ivpf3 + 1] = fc[1];
      fillColor[ivpf3 + 2] = fc[2];
      cornerRadius[ivpf] = cr;
    }
  });

  gl.useProgram(gl._rectShaderProgram);

  if (!unitBuffer) {
    unitBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, unitBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, unit, gl.STATIC_DRAW);
    gl.vertexAttribPointer(gl._rectUnitLocation, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(gl._rectUnitLocation);
  } else {
    gl.bindBuffer(gl.ARRAY_BUFFER, unitBuffer);
    gl.vertexAttribPointer(gl._rectUnitLocation, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(gl._rectUnitLocation);
  }

  posBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
  gl.vertexAttribPointer(gl._rectPosLocation, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(gl._rectPosLocation);

  sizeBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, size, gl.STATIC_DRAW);
  gl.vertexAttribPointer(gl._rectSizeLocation, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(gl._rectSizeLocation);

  strokeWidthBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, strokeWidthBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, strokeWidth, gl.STATIC_DRAW);
  gl.vertexAttribPointer(gl._rectStrokeWidthLocation, 1, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(gl._rectStrokeWidthLocation);

  strokeOpacityBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, strokeOpacityBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, strokeOpacity, gl.STATIC_DRAW);
  gl.vertexAttribPointer(gl._rectStrokeOpacityLocation, 1, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(gl._rectStrokeOpacityLocation);

  strokeColorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, strokeColorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, strokeColor, gl.STATIC_DRAW);
  gl.vertexAttribPointer(gl._rectStrokeColorLocation, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(gl._rectStrokeColorLocation);

  fillOpacityBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, fillOpacityBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, fillOpacity, gl.STATIC_DRAW);
  gl.vertexAttribPointer(gl._rectFillOpacityLocation, 1, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(gl._rectFillOpacityLocation);

  fillColorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, fillColorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, fillColor, gl.STATIC_DRAW);
  gl.vertexAttribPointer(gl._rectFillColorLocation, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(gl._rectFillColorLocation);

  cornerRadiusBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cornerRadiusBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, cornerRadius, gl.STATIC_DRAW);
  gl.vertexAttribPointer(gl._rectCornerRadiusLocation, 1, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(gl._rectCornerRadiusLocation);

  gl.uniformMatrix4fv(gl._rectMatrixLocation, false, gl._matrix);
  gl.uniform4fv(gl._rectClipLocation, gl._clip);

  gl.drawArrays(gl.TRIANGLES, 0, numPts * 6);

  scene._rectGeom = {
    numPts: numPts,
    unit: unit,
    pos: pos,
    size: size,
    strokeWidth: strokeWidth,
    strokeOpacity: strokeOpacity,
    strokeColor: strokeColor,
    fillOpacity: fillOpacity,
    fillColor: fillColor,
    cornerRadius: cornerRadius,
    unitBuffer: unitBuffer,
    posBuffer: posBuffer,
    sizeBuffer: sizeBuffer,
    strokeWidthBuffer: strokeWidthBuffer,
    strokeOpacityBuffer: strokeOpacityBuffer,
    strokeColorBuffer: strokeColorBuffer,
    fillOpacityBuffer: fillOpacityBuffer,
    fillColorBuffer: fillColorBuffer,
    cornerRadiusBuffer: cornerRadiusBuffer
  };
}

var rect$1 = {
  type:   'rect',
  drawGL: drawGL$3
};

function drawGL$4(context, scene, bounds) {
  visit$1(scene, function(item) {
    var x1, y1, x2, y2, line, shapeGeom;
    if (bounds && !bounds.intersects(item.bounds)) return; // bounds check
    if (context._fullRedraw || item._dirty || !item._geom || item._geom.deleted) {
      x1 = item.x || 0;
      y1 = item.y || 0;
      x2 = item.x2 != null ? item.x2 : x1;
      y2 = item.y2 != null ? item.y2 : y1;
      shapeGeom = {
        lines: [[[x1, y1], [x2, y2]]],
        closed: false
      };
      shapeGeom.key = JSON.stringify(shapeGeom.lines);
      item._geom = geometryForItem(context, item, shapeGeom);
    }
    drawGeometry(item._geom, context, item);
  });
}

var rule$1 = {
  type:   'rule',
  drawGL: drawGL$4
};

var shape$3 = markItemPath$1('shape', shape$2);

function drawGL$5(gl, scene, bounds) {
  var unit, pos, size, shape,
      strokeWidth, strokeOpacity, strokeColor,
      fillOpacity, fillColor,
      unitBuffer, posBuffer, sizeBuffer, shapeBuffer,
      strokeWidthBuffer, strokeOpacityBuffer, strokeColorBuffer,
      fillOpacityBuffer, fillColorBuffer,
      ivpf = 0, ivpf3 = 0,
      numPts = scene.items.length,
      xu = 0, yu = 0, w = 1, h = 1, j, unitItem,
      sg = scene._symbolGeom, shapeIndex;

  if (numPts === 0) {
    return;
  }

  shapeIndex = {
    circle: 0,
    cross: 1,
    diamond: 2,
    square: 3,
    star: 4,
    triangle: 5,
    'triangle-up': 5,
    'triangle-right': 6,
    'triangle-down': 7,
    'triangle-left': 8,
    wye: 9
  };

  if (sg && sg.numPts === numPts) {
    unit = sg.unit;
    unitBuffer = sg.unitBuffer;
    pos = sg.pos;
    size = sg.size;
    shape = sg.shape;
    strokeWidth = sg.strokeWidth;
    strokeOpacity = sg.strokeOpacity;
    strokeColor = sg.strokeColor;
    fillOpacity = sg.fillOpacity;
    fillColor = sg.fillColor;
  } else {
    if (sg) {
      gl.deleteBuffer(sg.unitBuffer);
    }
    unit = new Float32Array(3 * numPts * 2);
    pos = new Float32Array(3 * numPts * 3);
    size = new Float32Array(3 * numPts);
    shape = new Float32Array(3 * numPts);
    strokeWidth = new Float32Array(3 * numPts);
    strokeOpacity = new Float32Array(3 * numPts);
    strokeColor = new Float32Array(3 * numPts * 3);
    fillOpacity = new Float32Array(3 * numPts);
    fillColor = new Float32Array(3 * numPts * 3);

    unitItem = [
      xu, yu - h * 2,
      xu - w * Math.sqrt(3.0), yu + h,
      xu + w * Math.sqrt(3.0), yu + h
    ];
    for (j = 0; j < numPts * unitItem.length; j += 1) {
      unit[j] = unitItem[j % unitItem.length];
    }
  }

  if (sg) {
    gl.deleteBuffer(sg.posBuffer);
    gl.deleteBuffer(sg.sizeBuffer);
    gl.deleteBuffer(sg.shapeBuffer);
    gl.deleteBuffer(sg.strokeWidthBuffer);
    gl.deleteBuffer(sg.strokeOpacityBuffer);
    gl.deleteBuffer(sg.strokeColorBuffer);
    gl.deleteBuffer(sg.fillOpacityBuffer);
    gl.deleteBuffer(sg.fillColorBuffer);
  }

  visit$1(scene, function(item) {
    var x = (item.x || 0) + gl._tx + gl._origin[0],
        y = (item.y || 0) + gl._ty + gl._origin[1],
        fc = color$1(gl, item, item.fill),
        sc = color$1(gl, item, item.stroke),
        op = item.opacity == null ? 1 : item.opacity,
        fo = op * ((item.fill == null || item.fill == 'transparent') ? 0 : 1) * (item.fillOpacity == null ? 1 : item.fillOpacity),
        so = op * ((item.stroke == null || item.stroke == 'transparent') ? 0 : 1) * (item.strokeOpacity == null ? 1 : item.strokeOpacity),
        sw = ((item.stroke == null || item.stroke == 'transparent') ? 0 : 1) * (item.strokeWidth == null ? 1 : item.strokeWidth),
        sz = (item.size == null ? 64 : item.size),
        sh = shapeIndex[item.shape] == undefined ? 0 : shapeIndex[item.shape];

    for (j = 0; j < 3; j += 1, ivpf += 1, ivpf3 += 3) {
      pos[ivpf3] = x;
      pos[ivpf3 + 1] = y;
      pos[ivpf3 + 2] = 0;
      size[ivpf] = sz;
      strokeWidth[ivpf] = sw;
      shape[ivpf] = sh;
      strokeOpacity[ivpf] = so;
      strokeColor[ivpf3] = sc[0];
      strokeColor[ivpf3 + 1] = sc[1];
      strokeColor[ivpf3 + 2] = sc[2];
      fillOpacity[ivpf] = fo;
      fillColor[ivpf3] = fc[0];
      fillColor[ivpf3 + 1] = fc[1];
      fillColor[ivpf3 + 2] = fc[2];
    }
  });

  gl.useProgram(gl._symbolShaderProgram);

  if (!unitBuffer) {
    unitBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, unitBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, unit, gl.STATIC_DRAW);
    gl.vertexAttribPointer(gl._symbolUnitLocation, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(gl._symbolUnitLocation);
  } else {
    gl.bindBuffer(gl.ARRAY_BUFFER, unitBuffer);
    gl.vertexAttribPointer(gl._symbolUnitLocation, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(gl._symbolUnitLocation);
  }

  posBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
  gl.vertexAttribPointer(gl._symbolPosLocation, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(gl._symbolPosLocation);

  sizeBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, size, gl.STATIC_DRAW);
  gl.vertexAttribPointer(gl._symbolSizeLocation, 1, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(gl._symbolSizeLocation);

  shapeBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, shapeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, shape, gl.STATIC_DRAW);
  gl.vertexAttribPointer(gl._symbolShapeLocation, 1, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(gl._symbolShapeLocation);

  strokeWidthBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, strokeWidthBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, strokeWidth, gl.STATIC_DRAW);
  gl.vertexAttribPointer(gl._symbolStrokeWidthLocation, 1, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(gl._symbolStrokeWidthLocation);

  strokeOpacityBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, strokeOpacityBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, strokeOpacity, gl.STATIC_DRAW);
  gl.vertexAttribPointer(gl._symbolStrokeOpacityLocation, 1, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(gl._symbolStrokeOpacityLocation);

  strokeColorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, strokeColorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, strokeColor, gl.STATIC_DRAW);
  gl.vertexAttribPointer(gl._symbolStrokeColorLocation, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(gl._symbolStrokeColorLocation);

  fillOpacityBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, fillOpacityBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, fillOpacity, gl.STATIC_DRAW);
  gl.vertexAttribPointer(gl._symbolFillOpacityLocation, 1, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(gl._symbolFillOpacityLocation);

  fillColorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, fillColorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, fillColor, gl.STATIC_DRAW);
  gl.vertexAttribPointer(gl._symbolFillColorLocation, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(gl._symbolFillColorLocation);

  gl.uniformMatrix4fv(gl._symbolMatrixLocation, false, gl._matrix);
  gl.uniform4fv(gl._symbolClipLocation, gl._clip);

  gl.drawArrays(gl.TRIANGLES, 0, numPts * 3);

  scene._symbolGeom = {
    numPts: numPts,
    unit: unit,
    pos: pos,
    size: size,
    shape: shape,
    strokeWidth: strokeWidth,
    strokeOpacity: strokeOpacity,
    strokeColor: strokeColor,
    fillOpacity: fillOpacity,
    fillColor: fillColor,
    unitBuffer: unitBuffer,
    posBuffer: posBuffer,
    sizeBuffer: sizeBuffer,
    shapeBuffer: shapeBuffer,
    strokeWidthBuffer: strokeWidthBuffer,
    strokeOpacityBuffer: strokeOpacityBuffer,
    strokeColorBuffer: strokeColorBuffer,
    fillOpacityBuffer: fillOpacityBuffer,
    fillColorBuffer: fillColorBuffer
  };
}

var symbol$3 = {
  type:   'symbol',
  drawGL: drawGL$5
};

function drawGL$6(context, scene, bounds) {
  marks.text.draw(context._textContext, scene, bounds);
}

var text$2 = {
  type:   'text',
  drawGL: drawGL$6
};

var marks$1 = {
  arc:     arc$2,
  area:    area$3,
  group:   group$1,
  image:   image$1,
  line:    line$4,
  path:    path$5,
  rect:    rect$1,
  rule:    rule$1,
  shape:   shape$3,
  symbol:  symbol$3,
  text:    text$2
};

var inherits$2 = function(child, parent) {
  var proto = (child.prototype = Object.create(parent.prototype));
  proto.constructor = child;
  return proto;
};

// remove all child elements at or above the given index
function clear$1(el, index) {
  var nodes = el.childNodes,
      curr = nodes.length;
  while (curr > index) el.removeChild(nodes[--curr]);
  return el;
}

var WebGL$1 = function(w, h) {
  var canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;

  var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

  gl._pathCache = {};
  gl._pathCacheSize = 0;
  gl._itemCache = {};
  gl._itemCacheSize = 0;
  gl._shapeCache = {};
  gl._shapeCacheSize = 0;

  gl._textCanvas = document.createElement('canvas');
  gl._textCanvas.width = w;
  gl._textCanvas.height = h;
  gl._textContext = gl._textCanvas.getContext('2d');
  canvas._textCanvas = gl._textCanvas;

  gl.clearColor(1.0, 1.0, 1.0, 1.0);
  gl.disable(gl.CULL_FACE);

  // Thanks to https://limnu.com/webgl-blending-youre-probably-wrong/
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  var vertCode =
    'attribute vec3 coordinates;' +
    'attribute vec4 color;' +
    'uniform mat4 matrix;' +
    'uniform float zFactor;' +
    'uniform vec2 offset;' +
    'varying vec4 vColor;' +
    'varying vec4 vPosition;' +
    'void main(void) {' +
    '  vPosition = vec4(coordinates.x + offset.x, coordinates.y + offset.y, coordinates.z*zFactor - 1.0, 1.0);' +
    '  gl_Position = matrix * vPosition;' +
    '  vColor = color;' +
    '}';
  var vertShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertShader, vertCode);
  gl.compileShader(vertShader);
  if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
    console.log(gl.getShaderInfoLog(vertShader));
  }

  var fragCode =
    'precision mediump float;' +
    'varying vec4 vColor;' +
    'varying vec4 vPosition;' +
    'uniform vec4 clip;' +
    'void main(void) {' +
    '  if (vPosition.x < clip[0] || vPosition.x > clip[2] || vPosition.y < clip[1] || vPosition.y > clip[3]) {' +
    '    discard;' +
    '  }' +
    '  gl_FragColor = vColor;' +
    '}';
  var fragShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragShader, fragCode);
  gl.compileShader(fragShader);
  if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
    console.log(gl.getShaderInfoLog(fragShader));
  }

  var shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertShader);
  gl.attachShader(shaderProgram, fragShader);
  gl.linkProgram(shaderProgram);
  gl.useProgram(shaderProgram);
  gl._shaderProgram = shaderProgram;
  gl._coordLocation = gl.getAttribLocation(gl._shaderProgram, 'coordinates');
  gl._colorLocation = gl.getAttribLocation(gl._shaderProgram, 'color');
  gl._matrixLocation = gl.getUniformLocation(gl._shaderProgram, 'matrix');
  gl._zFactorLocation = gl.getUniformLocation(gl._shaderProgram, 'zFactor');
  gl._offsetLocation = gl.getUniformLocation(gl._shaderProgram, 'offset');
  gl._clipLocation = gl.getUniformLocation(gl._shaderProgram, 'clip');

// -------------------------------------------------------------------------
// BEGIN: Adapted from https://github.com/greggman/webgl-fundamentals
//
// BSD license follows:
//
// Copyright 2012, Gregg Tavares.
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
//     * Redistributions of source code must retain the above copyright
// notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above
// copyright notice, this list of conditions and the following disclaimer
// in the documentation and/or other materials provided with the
// distribution.
//     * Neither the name of Gregg Tavares. nor the names of his
// contributors may be used to endorse or promote products derived from
// this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

  var vertCode =
    'attribute vec2 a_position;' +
    'attribute vec2 a_texcoord;' +
    'uniform mat4 u_matrix;' +
    'varying vec2 v_texcoord;' +
    'void main() {' +
    '  gl_Position = u_matrix * vec4(a_position, -1.0, 1.0);' +
    '  v_texcoord = a_texcoord;' +
    '}';
  var vertShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertShader, vertCode);
  gl.compileShader(vertShader);
  if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
    console.log(gl.getShaderInfoLog(vertShader));
  }

  var fragCode =
    'precision mediump float;' +
    'varying vec2 v_texcoord;' +
    'uniform sampler2D u_texture;' +
    'void main() {' +
    '  gl_FragColor = texture2D(u_texture, v_texcoord);' +
    '}';
  var fragShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragShader, fragCode);
  gl.compileShader(fragShader);
  if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
    console.log(gl.getShaderInfoLog(fragShader));
  }

  var shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertShader);
  gl.attachShader(shaderProgram, fragShader);
  gl.linkProgram(shaderProgram);

  var positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  var positions = [
    0, 0,
    0, 1,
    1, 0,
    1, 0,
    0, 1,
    1, 1,
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  var texcoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
  var texcoords = [
    0, 0,
    0, 1,
    1, 0,
    1, 0,
    0, 1,
    1, 1,
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texcoords), gl.STATIC_DRAW);

  gl._imageShaderProgram = shaderProgram;
  gl._imagePositionLocation = gl.getAttribLocation(gl._imageShaderProgram, 'a_position');
  gl._imageTexcoordLocation = gl.getAttribLocation(gl._imageShaderProgram, 'a_texcoord');
  gl._imageMatrixLocation = gl.getUniformLocation(gl._imageShaderProgram, 'u_matrix');
  gl._imageTextureLocation = gl.getUniformLocation(gl._imageShaderProgram, 'u_texture');
  gl._imagePositionBuffer = positionBuffer;
  gl._imageTexcoordBuffer = texcoordBuffer;

// END: Adapted from https://github.com/greggman/webgl-fundamentals
// -------------------------------------------------------------------------

  vertCode = [
    'attribute vec3 pos;',
    'attribute vec3 fillColor;',
    'attribute vec3 strokeColor;',
    'attribute float fillOpacity;',
    'attribute float strokeWidth;',
    'attribute float size;',
    'attribute float shape;',
    'attribute float strokeOpacity;',
    'attribute vec2 unit;',
    'uniform mat4 matrix;',
    'varying vec4 positionVar;',
    'varying vec4 fillColorVar;',
    'varying vec4 strokeColorVar;',
    'varying float sizeVar;',
    'varying float shapeVar;',
    'varying float strokeWidthVar;',
    'varying vec2 unitVar;',
    'void main(void)',
    '{',
    '  strokeWidthVar = strokeWidth;',
    '  fillColorVar = vec4(fillColor, fillOpacity);',
    '  strokeColorVar = vec4(strokeColor, strokeOpacity);',

    // circle
    '  if (shape == 0.0) {',
    '    sizeVar = sqrt(size) / 2.0;',
    '  }',

    // cross
    '  if (shape == 1.0) {',
    '    sizeVar = sqrt(size) / 2.0;',
    '  }',

    // diamond
    '  if (shape == 2.0) {',
    '    sizeVar = sqrt(size) / 2.0;',
    '  }',

    // square
    '  if (shape == 3.0) {',
    '    sizeVar = sqrt(2.0) * sqrt(size) / 2.0;',
    '  }',

    // star
    '  if (shape == 4.0) {',
    '    sizeVar = sqrt(size) / 2.0;',
    '  }',

    // triangle-up
    '  if (shape == 5.0) {',
    '    sizeVar = (sqrt(6.0)/2.0) * sqrt(size) / 2.0;',
    '  }',

    // triangle-right
    '  if (shape == 6.0) {',
    '    sizeVar = (sqrt(6.0)/2.0) * sqrt(size) / 2.0;',
    '  }',

    // triangle-down
    '  if (shape == 7.0) {',
    '    sizeVar = (sqrt(6.0)/2.0) * sqrt(size) / 2.0;',
    '  }',

    // triangle-left
    '  if (shape == 8.0) {',
    '    sizeVar = (sqrt(6.0)/2.0) * sqrt(size) / 2.0;',
    '  }',

    // wye
    '  if (shape == 9.0) {',
    '    sizeVar = sqrt(size) / 2.0;',
    '  }',

    // '  sizeVar = size;',
    '  shapeVar = shape;',
    // '  float m = size + strokeWidth;',
    '  float factor = (sizeVar + strokeWidth / 2.0 + 1.0) / sizeVar;',
    '  unitVar = factor * unit;',
    '  positionVar = vec4(pos.xy + factor * sizeVar * unit, -1.0, 1.0);',
    '  gl_Position = matrix * positionVar;',
    '}'
  ].join('\n');
  vertShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertShader, vertCode);
  gl.compileShader(vertShader);
  if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
    console.log(gl.getShaderInfoLog(vertShader));
  }

  fragCode = [
    'precision mediump float;',
    'const float PI = 3.1415926535897932384626433832795;',
    'varying vec4 positionVar;',
    'varying vec4 fillColorVar;',
    'varying vec4 strokeColorVar;',
    'varying vec2 unitVar;',
    'varying float sizeVar;',
    'varying float shapeVar;',
    'varying float strokeWidthVar;',
    'uniform vec4 clip;',

    'float distToLine(vec2 pt1, vec2 pt2, vec2 testPt)',
    '{',
    '  vec2 lineDir = pt2 - pt1;',
    '  vec2 perpDir = vec2(lineDir.y, -lineDir.x);',
    '  vec2 dirToPt1 = pt1 - testPt;',
    '  return dot(normalize(perpDir), dirToPt1);',
    '}',

    'float distToAngle(vec2 apex, vec2 left, vec2 right, vec2 testPt)',
    '{',
    '  float dist = distToLine(apex, left, testPt);',
    '  dist = min(dist, distToLine(right, apex, testPt));',
    '  float cut = distToLine(left, right, testPt);',
    '  if (cut < 0.0) return -1.0;',
    '  return dist;',
    '}',

    'float distToHull(vec2 p1, vec2 p2, vec2 p3, vec2 p4, vec2 testPt)',
    '{',
    '  float dist = distToLine(p1, p2, testPt);',
    '  dist = min(dist, distToLine(p2, p3, testPt));',
    '  dist = min(dist, distToLine(p4, p1, testPt));',
    '  float cut = distToLine(p3, p4, testPt);',
    '  if (cut < 0.0) return -1.0;',
    '  return dist;',
    '}',

    'vec2 rotate(vec2 pt, float a)',
    '{',
    '  return vec2(cos(a)*pt.x - sin(a)*pt.y, sin(a)*pt.x + cos(a)*pt.y);',
    '}',

    'void main () {',
    '  if (positionVar.x < clip[0] || positionVar.x > clip[2] || positionVar.y < clip[1] || positionVar.y > clip[3]) {',
    '    discard;',
    '  }',

    '  float dist;',
    '  float d1;',
    '  float d2;',

    // circle
    '  if (shapeVar == 0.0) {',
    '    dist = length(unitVar);',
    '  }',

    // cross
    '  if (shapeVar == 1.0) {',
    '    float inset = 1.0 / 2.5;',
    '    d1 = distToLine(vec2(-inset, -1.0), vec2(inset, -1.0), unitVar);',
    '    d1 = min(d1, distToLine(vec2(inset, -1.0), vec2(inset, 1.0), unitVar));',
    '    d1 = min(d1, distToLine(vec2(inset, 1.0), vec2(-inset, 1.0), unitVar));',
    '    d1 = min(d1, distToLine(vec2(-inset, 1.0), vec2(-inset, -1.0), unitVar));',
    '    d1 = 1.0 - d1;',
    '    d2 = distToLine(vec2(1.0, -inset), vec2(1.0, inset), unitVar);',
    '    d2 = min(d2, distToLine(vec2(1.0, inset), vec2(-1.0, inset), unitVar));',
    '    d2 = min(d2, distToLine(vec2(-1.0, inset), vec2(-1.0, -inset), unitVar));',
    '    d2 = min(d2, distToLine(vec2(-1.0, -inset), vec2(1.0, -inset), unitVar));',
    '    d2 = 1.0 - d2;',
    '    dist = min(d1, d2);',
    '  }',

    // diamond
    '  if (shapeVar == 2.0) {',
    '    dist = distToLine(vec2(0.0, -1.0), vec2(1.0, 0.0), unitVar);',
    '    dist = min(dist, distToLine(vec2(1.0, 0.0), vec2(0.0, 1.0), unitVar));',
    '    dist = min(dist, distToLine(vec2(0.0, 1.0), vec2(-1.0, 0.0), unitVar));',
    '    dist = min(dist, distToLine(vec2(-1.0, 0.0), vec2(0.0, -1.0), unitVar));',
    '    dist = 1.0 - dist;',
    '  }',

    // square
    '  if (shapeVar == 3.0) {',
    '    float side = sqrt(2.0)/2.0;',
    '    dist = distToLine(vec2(-side, -side), vec2(side, -side), unitVar);',
    '    dist = min(dist, distToLine(vec2(side, -side), vec2(side, side), unitVar));',
    '    dist = min(dist, distToLine(vec2(side, side), vec2(-side, side), unitVar));',
    '    dist = min(dist, distToLine(vec2(-side, side), vec2(-side, -side), unitVar));',
    '    dist = 1.0 - dist;',
    '  }',

    // star
    '  if (shapeVar == 4.0) {',
    '    float h = 1.0;',
    '    float x = h * tan(PI/10.0);',
    '    vec2 p1 = vec2(0.0, -h);',
    '    vec2 p2 = vec2(x, 0);',
    '    vec2 p3 = vec2(-x, 0);',
    '    float angle = 0.0;',
    '    dist = 1.0 - distToAngle(rotate(p1, angle), rotate(p2, angle), rotate(p3, angle), unitVar);',
    '    angle = angle + 2.0*PI/5.0;',
    '    dist = min(dist, 1.0 - distToAngle(rotate(p1, angle), rotate(p2, angle), rotate(p3, angle), unitVar));',
    '    angle = angle + 2.0*PI/5.0;',
    '    dist = min(dist, 1.0 - distToAngle(rotate(p1, angle), rotate(p2, angle), rotate(p3, angle), unitVar));',
    '    angle = angle + 2.0*PI/5.0;',
    '    dist = min(dist, 1.0 - distToAngle(rotate(p1, angle), rotate(p2, angle), rotate(p3, angle), unitVar));',
    '    angle = angle + 2.0*PI/5.0;',
    '    dist = min(dist, 1.0 - distToAngle(rotate(p1, angle), rotate(p2, angle), rotate(p3, angle), unitVar));',
    '  }',

    // triangle-up
    '  if (shapeVar == 5.0) {',
    '    vec2 p1 = vec2(0.0, -sqrt(2.0)/2.0);',
    '    vec2 p2 = vec2(sqrt(6.0)/3.0, sqrt(2.0)/2.0);',
    '    vec2 p3 = vec2(-sqrt(6.0)/3.0, sqrt(2.0)/2.0);',
    '    dist = distToLine(p1, p2, unitVar);',
    '    dist = min(dist, distToLine(p2, p3, unitVar));',
    '    dist = min(dist, distToLine(p3, p1, unitVar));',
    '    dist = 1.0 - dist;',
    '  }',

    // triangle-right
    '  if (shapeVar == 6.0) {',
    '    vec2 p1 = vec2(sqrt(2.0)/2.0, 0.0);',
    '    vec2 p2 = vec2(-sqrt(2.0)/2.0, sqrt(6.0)/3.0);',
    '    vec2 p3 = vec2(-sqrt(2.0)/2.0, -sqrt(6.0)/3.0);',
    '    dist = distToLine(p1, p2, unitVar);',
    '    dist = min(dist, distToLine(p2, p3, unitVar));',
    '    dist = min(dist, distToLine(p3, p1, unitVar));',
    '    dist = 1.0 - dist;',
    '  }',

    // triangle-down
    '  if (shapeVar == 7.0) {',
    '    vec2 p1 = vec2(0.0, sqrt(2.0)/2.0);',
    '    vec2 p2 = vec2(-sqrt(6.0)/3.0, -sqrt(2.0)/2.0);',
    '    vec2 p3 = vec2(sqrt(6.0)/3.0, -sqrt(2.0)/2.0);',
    '    dist = distToLine(p1, p2, unitVar);',
    '    dist = min(dist, distToLine(p2, p3, unitVar));',
    '    dist = min(dist, distToLine(p3, p1, unitVar));',
    '    dist = 1.0 - dist;',
    '  }',

    // triangle-left
    '  if (shapeVar == 8.0) {',
    '    vec2 p1 = vec2(-sqrt(2.0)/2.0, 0.0);',
    '    vec2 p2 = vec2(sqrt(2.0)/2.0, -sqrt(6.0)/3.0);',
    '    vec2 p3 = vec2(sqrt(2.0)/2.0, sqrt(6.0)/3.0);',
    '    dist = distToLine(p1, p2, unitVar);',
    '    dist = min(dist, distToLine(p2, p3, unitVar));',
    '    dist = min(dist, distToLine(p3, p1, unitVar));',
    '    dist = 1.0 - dist;',
    '  }',

    // wye
    '  if (shapeVar == 9.0) {',
    '    float h = 12.0 / (12.0 + sqrt(12.0));',
    '    float y = h / sqrt(12.0) + h;',
    '    vec2 p1 = vec2(h / 2.0, y);',
    '    vec2 p2 = vec2(-h / 2.0, y);',
    '    vec2 p3 = vec2(-h / 2.0, 0.0);',
    '    vec2 p4 = vec2(h / 2.0, 0.0);',
    '    float angle = 0.0;',
    '    dist = 1.0 - distToHull(p1, p2, p3, p4, unitVar);',
    '    angle = angle + 2.0*PI/3.0;',
    '    dist = min(dist, 1.0 - distToHull(rotate(p1, angle), rotate(p2, angle), rotate(p3, angle), rotate(p4, angle), unitVar));',
    '    angle = angle + 2.0*PI/3.0;',
    '    dist = min(dist, 1.0 - distToHull(rotate(p1, angle), rotate(p2, angle), rotate(p3, angle), rotate(p4, angle), unitVar));',
    '  }',

    '  float endStep = 1.0;',
    '  float antialiasDist = 1.0 / sizeVar / 2.0;',
    '  float widthDist = strokeWidthVar / sizeVar / 2.0;',
    '  vec4 c1;',
    '  vec4 c2;',
    '  float step;',
    '  if (dist < endStep) {',
    '    step = smoothstep(endStep - widthDist - antialiasDist, endStep - widthDist + antialiasDist, dist);',
    '    if (fillColorVar.a > 0.0) {',
    '      c1 = fillColorVar;',
    '    } else {',
    '      c1 = vec4(strokeColorVar.rgb, 0.0);',
    '    }',
    '    if (strokeColorVar.a > 0.0) {',
    '      c2 = strokeColorVar;',
    '    } else {',
    '      c2 = vec4(fillColorVar.rgb, 0.0);',
    '    }',
    '  } else {',
    '    step = smoothstep(endStep + widthDist - antialiasDist, endStep + widthDist + antialiasDist, dist);',
    '    if (strokeColorVar.a > 0.0) {',
    '      c1 = strokeColorVar;',
    '      c2 = vec4(strokeColorVar.rgb, 0.0);',
    '    } else {',
    '      c1 = vec4(fillColorVar.rgb, 0.0);',
    '      c2 = vec4(fillColorVar.rgb, 0.0);',
    '    }',
    '  }',
    '  gl_FragColor = mix(c1, c2, step);',
    '}'
  ].join('\n');
  fragShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragShader, fragCode);
  gl.compileShader(fragShader);
  if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
    console.log(gl.getShaderInfoLog(fragShader));
  }

  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertShader);
  gl.attachShader(shaderProgram, fragShader);
  gl.linkProgram(shaderProgram);

  gl._symbolShaderProgram = shaderProgram;
  gl._symbolPosLocation = gl.getAttribLocation(shaderProgram, 'pos');
  gl._symbolFillColorLocation = gl.getAttribLocation(shaderProgram, 'fillColor');
  gl._symbolStrokeColorLocation = gl.getAttribLocation(shaderProgram, 'strokeColor');
  gl._symbolFillOpacityLocation = gl.getAttribLocation(shaderProgram, 'fillOpacity');
  gl._symbolStrokeWidthLocation = gl.getAttribLocation(shaderProgram, 'strokeWidth');
  gl._symbolSizeLocation = gl.getAttribLocation(shaderProgram, 'size');
  gl._symbolShapeLocation = gl.getAttribLocation(shaderProgram, 'shape');
  gl._symbolStrokeOpacityLocation = gl.getAttribLocation(shaderProgram, 'strokeOpacity');
  gl._symbolUnitLocation = gl.getAttribLocation(shaderProgram, 'unit');
  gl._symbolMatrixLocation = gl.getUniformLocation(shaderProgram, 'matrix');
  gl._symbolClipLocation = gl.getUniformLocation(shaderProgram, 'clip');

  // rect shader

  vertCode = [
    'attribute vec3 pos;',
    'attribute vec3 fillColor;',
    'attribute vec3 strokeColor;',
    'attribute float fillOpacity;',
    'attribute float strokeWidth;',
    'attribute float strokeOpacity;',
    'attribute float cornerRadius;',
    'attribute vec2 size;',
    'attribute vec2 unit;',
    'uniform mat4 matrix;',
    'varying vec4 fillColorVar;',
    'varying vec4 strokeColorVar;',
    'varying float strokeWidthVar;',
    'varying float cornerRadiusVar;',
    'varying float factorVar;',
    'varying vec2 sizeVar;',
    'varying vec2 unitVar;',
    'varying vec4 positionVar;',
    'void main(void)',
    '{',
    '  strokeWidthVar = strokeWidth;',
    '  fillColorVar = vec4(fillColor, fillOpacity);',
    '  strokeColorVar = vec4(strokeColor, strokeOpacity);',
    '  cornerRadiusVar = cornerRadius;',
    '  sizeVar = size;',
    '  unitVar = unit;',
    '  factorVar = max(size.x, size.y) + strokeWidth + 1.0;',
    '  positionVar = vec4(pos.xy + factorVar*unitVar - 0.5*strokeWidth - 0.5, -1.0, 1.0);',
    '  gl_Position = matrix * positionVar;',
    '}'
  ].join('\n');
  vertShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertShader, vertCode);
  gl.compileShader(vertShader);
  if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
    console.log(gl.getShaderInfoLog(vertShader));
  }

  fragCode = [
    'precision mediump float;',
    'const float PI = 3.1415926535897932384626433832795;',
    'varying vec4 fillColorVar;',
    'varying vec4 strokeColorVar;',
    'varying float strokeWidthVar;',
    'varying float cornerRadiusVar;',
    'varying float factorVar;',
    'varying vec2 unitVar;',
    'varying vec2 sizeVar;',
    'varying vec4 positionVar;',
    'uniform vec4 clip;',

    'float distToLine(vec2 pt1, vec2 pt2, vec2 testPt)',
    '{',
    '  vec2 lineDir = pt2 - pt1;',
    '  vec2 perpDir = vec2(lineDir.y, -lineDir.x);',
    '  vec2 dirToPt1 = pt1 - testPt;',
    '  return dot(normalize(perpDir), dirToPt1);',
    '}',

    'float cornerDist(vec2 pt, float radius, float xdir, float ydir, vec2 testPt)',
    '{',
    '  if (xdir * (pt.x - testPt.x) > 0.0) return 1.0;',
    '  if (ydir * (pt.y - testPt.y) > 0.0) return 1.0;',
    '  return radius - length(pt - testPt);',
    '}',

    'void main () {',
    '  if (positionVar.x < clip[0] || positionVar.x > clip[2] || positionVar.y < clip[1] || positionVar.y > clip[3]) {',
    '    discard;',
    '  }',
    '  float delta = (0.5 + 0.5*strokeWidthVar)/factorVar;',
    '  float xmax = (0.5 + 0.5*strokeWidthVar + sizeVar.x)/factorVar;',
    '  float ymax = (0.5 + 0.5*strokeWidthVar + sizeVar.y)/factorVar;',
    '  vec2 p1 = vec2(delta, delta);',
    '  vec2 p2 = vec2(xmax, delta);',
    '  vec2 p3 = vec2(xmax, ymax);',
    '  vec2 p4 = vec2(delta, ymax);',
    '  float dist = distToLine(p1, p2, unitVar);',
    '  dist = min(dist, distToLine(p2, p3, unitVar));',
    '  dist = min(dist, distToLine(p3, p4, unitVar));',
    '  dist = min(dist, distToLine(p4, p1, unitVar));',

    '  if (cornerRadiusVar > 0.0) {',
    '    delta = (0.5 + 0.5*strokeWidthVar + cornerRadiusVar)/factorVar;',
    '    xmax = (0.5 + 0.5*strokeWidthVar + sizeVar.x - cornerRadiusVar)/factorVar;',
    '    ymax = (0.5 + 0.5*strokeWidthVar + sizeVar.y - cornerRadiusVar)/factorVar;',
    '    p1 = vec2(delta, delta);',
    '    p2 = vec2(xmax, delta);',
    '    p3 = vec2(xmax, ymax);',
    '    p4 = vec2(delta, ymax);',
    '    dist = min(dist, cornerDist(p1, cornerRadiusVar/factorVar, -1.0, -1.0, unitVar));',
    '    dist = min(dist, cornerDist(p2, cornerRadiusVar/factorVar, 1.0, -1.0, unitVar));',
    '    dist = min(dist, cornerDist(p3, cornerRadiusVar/factorVar, 1.0, 1.0, unitVar));',
    '    dist = min(dist, cornerDist(p4, cornerRadiusVar/factorVar, -1.0, 1.0, unitVar));',
    '  }',

    '  dist = 1.0 - dist;',

    '  float endStep = 1.0;',
    '  float antialiasDist = 0.5 / factorVar;',
    '  float widthDist = 0.5*strokeWidthVar / factorVar;',
    '  vec4 c1;',
    '  vec4 c2;',
    '  float step;',
    '  if (dist < endStep) {',
    '    step = smoothstep(endStep - widthDist - antialiasDist, endStep - widthDist + antialiasDist, dist);',
    '    if (fillColorVar.a > 0.0) {',
    '      c1 = fillColorVar;',
    '    } else {',
    '      c1 = vec4(strokeColorVar.rgb, 0.0);',
    '    }',
    '    if (strokeWidthVar > 0.0) {',
    '      c2 = strokeColorVar;',
    '    } else {',
    '      c2 = vec4(fillColorVar.rgb, 0.0);',
    '    }',
    '  } else {',
    '    step = smoothstep(endStep + widthDist - antialiasDist, endStep + widthDist + antialiasDist, dist);',
    '    if (strokeWidthVar > 0.0) {',
    '      c1 = strokeColorVar;',
    '      c2 = vec4(strokeColorVar.rgb, 0.0);',
    '    } else {',
    '      c1 = vec4(fillColorVar.rgb, 0.0);',
    '      c2 = vec4(fillColorVar.rgb, 0.0);',
    '    }',
    '  }',
    '  gl_FragColor = mix(c1, c2, step);',
    '}'
  ].join('\n');
  fragShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragShader, fragCode);
  gl.compileShader(fragShader);
  if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
    console.log(gl.getShaderInfoLog(fragShader));
  }

  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertShader);
  gl.attachShader(shaderProgram, fragShader);
  gl.linkProgram(shaderProgram);

  gl._rectShaderProgram = shaderProgram;
  gl._rectPosLocation = gl.getAttribLocation(shaderProgram, 'pos');
  gl._rectFillColorLocation = gl.getAttribLocation(shaderProgram, 'fillColor');
  gl._rectStrokeColorLocation = gl.getAttribLocation(shaderProgram, 'strokeColor');
  gl._rectFillOpacityLocation = gl.getAttribLocation(shaderProgram, 'fillOpacity');
  gl._rectStrokeWidthLocation = gl.getAttribLocation(shaderProgram, 'strokeWidth');
  gl._rectSizeLocation = gl.getAttribLocation(shaderProgram, 'size');
  gl._rectStrokeOpacityLocation = gl.getAttribLocation(shaderProgram, 'strokeOpacity');
  gl._rectCornerRadiusLocation = gl.getAttribLocation(shaderProgram, 'cornerRadius');
  gl._rectUnitLocation = gl.getAttribLocation(shaderProgram, 'unit');
  gl._rectMatrixLocation = gl.getUniformLocation(shaderProgram, 'matrix');
  gl._rectClipLocation = gl.getUniformLocation(shaderProgram, 'clip');

  return canvas;
};

var devicePixelRatio$1 = typeof window !== 'undefined'
  ? window.devicePixelRatio || 1 : 1;

var resize$1 = function(canvas, width, height, origin) {
  var scale = typeof HTMLElement !== 'undefined'
    && canvas instanceof HTMLElement
    && canvas.parentNode != null;

  var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl'),
      ratio = scale ? devicePixelRatio$1 : 1;

  canvas.width = width * ratio;
  canvas.height = height * ratio;

  gl._textCanvas.width = width * ratio;
  gl._textCanvas.height = height * ratio;
  gl._textContext.pixelRatio = ratio;
  gl._textContext.setTransform(
    ratio, 0, 0, ratio,
    ratio * origin[0],
    ratio * origin[1]
  );

  if (ratio !== 1) {
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
  }

  gl.lineWidth(ratio);

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  gl._origin = origin;
  gl._ratio = ratio;
  gl._clip = [0, 0, canvas.width / gl._ratio, canvas.height / gl._ratio];

  return canvas;
};

function WebGLRenderer(imageLoader) {
  Renderer.call(this, imageLoader);
  this._redraw = false;
  this._angleX = 0;
  this._angleY = 0;
  this._angleZ = 0;
  this._translateX = 0;
  this._translateY = 0;
  this._translateZ = 0;
  this._zFactor = 0;
  this._depthTest = false;
  this._randomZ = false;
}

var prototype$10 = inherits$2(WebGLRenderer, Renderer);
var base$3 = Renderer.prototype;
var tempBounds$2 = new Bounds();

prototype$10.initialize = function(el, width, height, origin) {
  this._canvas = WebGL$1(1, 1); // instantiate a small canvas
  if (el) {
    clear$1(el, 0).appendChild(this._canvas);
    this._canvas.setAttribute('class', 'marks');
  }
  // this method will invoke resize to size the canvas appropriately
  return base$3.initialize.call(this, el, width, height, origin);
};

prototype$10.resize = function(width, height, origin) {
  base$3.resize.call(this, width, height, origin);
  resize$1(this._canvas, this._width, this._height, this._origin);
  return this._redraw = true, this;
};

prototype$10.canvas = function() {
  return this._canvas;
};

prototype$10.context = function() {
  return this._canvas ? (
    this._canvas.getContext('webgl') ||
    this._canvas.getContext('experimental-webgl'))
    : null;
};

prototype$10.rotate = function(x, y, z) {
  this._angleX = x;
  this._angleY = y;
  this._angleZ = z;
  return this;
};

prototype$10.translate = function(x, y, z) {
  this._translateX = x;
  this._translateY = y;
  this._translateZ = z;
  return this;
};

prototype$10.zFactor = function(z) {
  this._zFactor = z;
  return this;
};

prototype$10.depthTest = function(val) {
  this._depthTest = val;
  return this;
};

prototype$10.randomZ = function(val) {
  this._randomZ = val;
  return this;
};

function clipToBounds$1(g, items) {
  // TODO: do something here?
}

prototype$10._updateUniforms = function() {
  var gl = this.context();
  gl.useProgram(gl._shaderProgram);

  var width = gl.canvas.width / gl._ratio;
  var height = gl.canvas.height / gl._ratio;

  var smooshMatrix = [
    2/width, 0, 0, 0,
    0, -2/width, 0, 0,
    0, 0, 1, 0,
    -1, height/width, 0, 1
  ];

  this.matrix = [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];

  this.matrix = multiply(this.matrix, perspective(Math.PI/2, width/height, 0.01, 3000));
  this.matrix = multiply(this.matrix, translate$3(this._translateX, this._translateY, (this._translateZ - 1)*height/width));
  this.matrix = multiply(this.matrix, rotateZ(this._angleZ));
  this.matrix = multiply(this.matrix, rotateY(this._angleY));
  this.matrix = multiply(this.matrix, rotateX(this._angleX));
  this.matrix = multiply(this.matrix, translate$3(0, 0, 1));
  this.matrix = multiply(this.matrix, smooshMatrix);

  gl._matrix = this.matrix;

  gl.uniform1f(gl._zFactorLocation, this._zFactor);
  gl.uniformMatrix4fv(gl._matrixLocation, false, this.matrix);
};

prototype$10._render = function(scene, items) {
  var gl = this.context(),
      o = this._origin,
      w = this._width,
      h = this._height,
      b, i;

  gl._tx = 0;
  gl._ty = 0;
  gl._triangleGeometry = [];
  gl._triangleColor = [];
  if (gl._images) {
    for (i = 0; i < gl._images.length; i++) {
      gl.deleteTexture(gl._images[i].texture);
    }
  }
  gl._images = [];
  gl._randomZ = this._randomZ;
  gl._pathCacheHit = 0;
  gl._pathCacheMiss = 0;
  gl._itemCacheHit = 0;
  gl._itemCacheMiss = 0;
  gl._shapeCacheHit = 0;
  gl._shapeCacheMiss = 0;

  b = (!items || this._redraw)
    ? (this._redraw = false, null)
    : clipToBounds$1(gl, items);

  if (items) {
    for (i = 0; i < items.length; i++) {
      items[i]._dirty = true;
      if (items[i].exit && marks$1[items[i].mark.marktype].nested && items[i].mark.items.length) {
        // Mark an item as dirty to force redraw of the nested mark
        items[i].mark.items[0]._dirty = true;
      }
    }
  } else {
    gl._fullRedraw = true;
  }

  if (this._depthTest) {
    gl.enable(gl.DEPTH_TEST);
  } else {
    gl.disable(gl.DEPTH_TEST);
  }

  this._updateUniforms();

  this.clear();

  this.draw(gl, scene, b);

  var imgInfo = loadImageAndCreateTextureInfo(gl, gl._textCanvas);
  imgInfo.x = 0;
  imgInfo.y = 0;
  imgInfo.w = gl.canvas.width / gl._ratio;
  imgInfo.h = gl.canvas.height / gl._ratio;
  gl._images.push(imgInfo);

  for (i = 0; i < gl._images.length; i++) {
    drawImage(gl, gl._images[i], this.matrix);
  }

  if (items) {
    for (i = 0; i < items.length; i++) {
      items[i]._dirty = false;
    }
  }
  gl._fullRedraw = false;
  this._lastScene = scene;

  // console.log('Path cache hit: ' + gl._pathCacheHit);
  // console.log('Path cache miss: ' + gl._pathCacheMiss);
  // console.log('Item cache hit: ' + gl._itemCacheHit);
  // console.log('Item cache miss: ' + gl._itemCacheMiss);
  // console.log('Shape cache hit: ' + gl._shapeCacheHit);
  // console.log('Shape cache miss: ' + gl._shapeCacheMiss);

  return this;
};

prototype$10.frame = function() {
  if (this._lastScene) {
    this._render(this._lastScene, []);
  }
  return this;
};

prototype$10.draw = function(ctx, scene, bounds) {
  var mark = marks$1[scene.marktype];
  if (mark.drawGL) {
    mark.drawGL.call(this, ctx, scene, bounds);
  }
};

prototype$10.toDataURL = function(scene) {
  this.render(scene, null);
  return this.canvas().toDataURL("image/png", 1);
};

prototype$10.clear = function(x, y, w, h) {
  var gl = this.context(), c;
  if (this._bgcolor != null) {
    c = color$1(gl, null, this._bgcolor);
    gl.clearColor(c[0], c[1], c[2], 1.0);
  } else {
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
  }
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl._textContext.save();
  gl._textContext.setTransform(1, 0, 0, 1, 0, 0);
  gl._textContext.clearRect(0, 0, gl._textCanvas.width, gl._textCanvas.height);
  gl._textContext.restore();
};

// Patch CanvasHandler
CanvasHandler.prototype.context = function() {
  return this._canvas.getContext('2d') || this._canvas._textCanvas.getContext('2d');
};

if (window && window.vega) {
  window.vega.addCustomRenderer('webgl', CanvasHandler, WebGLRenderer);
}

exports.WebGLRenderer = WebGLRenderer;

Object.defineProperty(exports, '__esModule', { value: true });

})));
