var Stream = require('readable-stream');
var StreamQueue = require('streamqueue');
var SourceMapGenerator = require('source-map').SourceMapGenerator;
var SourceMapConsumer = require('source-map').SourceMapConsumer;

// Helper
function getStreamFromBuffer(string) {
  var stream = new Stream.Readable();
  stream._read = function() {
    stream.push(new Buffer(string));
    stream._read = stream.push.bind(stream, null);
  };
  return stream;
}

exports.prepend = function(string) {
  var stream = new Stream.Transform({objectMode: true});
  var prependedBuffer = new Buffer(string);

  stream._transform = function(file, unused, cb) {
    if(file.isNull()) {
      return cb(null, file);
    }
    if(file.isStream()) {
      file.contents = new StreamQueue(
        getStreamFromBuffer(prependedBuffer),
        file.contents
      );
      return cb(null, file);
    }
    file.contents = Buffer.concat([prependedBuffer, file.contents],
      prependedBuffer.length + file.contents.length);

    if (file.sourceMap && file.sourceMap.mappings.length > 0) {
        var lines = string.split("\n");
        var offsetLines = lines.length - 1;
        var offetFirstLine = lines[lines.length - 1].length;
        var sourceMapConsumer = new SourceMapConsumer(file.sourceMap);
        var sourceMap = new SourceMapGenerator({ file: sourceMapConsumer.file });

        var fileName = 'prependedContent'+Math.random();
        sourceMap.addMapping({
            generated: { line: 1, column: 0 },
            original: { line: 1, column: 0 },
            source: fileName
        })
        sourceMapConsumer.eachMapping(function(mapping) {
            sourceMap.addMapping({
                generated: {
                    line: offsetLines + mapping.generatedLine,
                    column: (mapping.generatedLine === 1 ? offetFirstLine : 0 )
                                     + mapping.generatedColumn
                },
                original: {
                    line: mapping.originalLine,
                    column: mapping.originalColumn
                },
                source: mapping.source,
                name: mapping.name
            });
        });
        if (sourceMapConsumer.sourcesContent) {
            sourceMap.setSourceContent(fileName, string);
            sourceMapConsumer.sourcesContent.forEach(function(sourceContent, index) {
              sourceMap.setSourceContent(sourceMapConsumer.sources[index], sourceContent);
            });
        }
        file.sourceMap = JSON.parse(SourceMapGenerator.fromSourceMap(sourceMapConsumer).toString());
    }
    cb(null, file);
  };

  return stream;
};

exports.append = function(string) {
  var stream = new Stream.Transform({objectMode: true});
  var appendedBuffer = new Buffer(string);

  stream._transform = function(file, unused, cb) {
    if(file.isNull()) {
      return cb(null, file);
    }
    if(file.isStream()) {
      file.contents = new StreamQueue(
        file.contents,
        getStreamFromBuffer(appendedBuffer)
      );
      return cb(null, file);
    }
    file.contents = Buffer.concat([file.contents, appendedBuffer],
      appendedBuffer.length + file.contents.length);
    cb(null, file);
  };

  return stream;
};

exports.wrap = function(begin, end) {
  var stream = new Stream.Transform({objectMode: true});
  var prependedBuffer = new Buffer(begin);
  var appendedBuffer = new Buffer(end);

  stream._transform = function(file, unused, cb) {
    if(file.isNull()) {
      return cb(null, file);
    }
    if(file.isStream()) {
      file.contents = new StreamQueue(
        getStreamFromBuffer(prependedBuffer),
        file.contents,
        getStreamFromBuffer(appendedBuffer)
      );
      return cb(null, file);
    }
    file.contents = Buffer.concat([prependedBuffer, file.contents, appendedBuffer],
      appendedBuffer.length + file.contents.length + prependedBuffer.length);
    cb(null, file);
  };

  return stream;
};

exports.transform = function(fn) {
  var stream = new Stream.Transform({objectMode: true});

  stream._transform = function(file, unused, cb) {
    if(file.isNull()) {
      return cb(null, file);
    }
    if(file.isStream()) {
      file.contents = file.contents.pipe(new Stream.Transform());
      file.contents._transform = function(chunk, encoding, cb) {
        cb(null, new Buffer(fn(chunk.toString())))
      };
      return cb(null, file);
    }
    file.contents = new Buffer(fn(file.contents.toString()));
    cb(null, file);
  };

  return stream;
};

