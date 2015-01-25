"use strict";

var md5 = require('MD5');

/**
 * Removing all the html comments
 * @param html
 * @returns {*}
 */
function removeHtmlComments(html) {
    var commentBegin = '<!--';
    var commentEnd = '-->';
    var beg = html.indexOf(commentBegin);
    var end = 0;

    while (beg !== -1) {
        end = html.indexOf(commentEnd, beg + 4);

        if (end === -1)
            break;

        var comment = html.substring(beg, end + 3);

        if (comment.indexOf('[if') !== -1 || comment.indexOf('[endif') !== -1) {
            beg = html.indexOf(commentBegin, end + 3);
            continue;
        }

        html = html.replace(comment, '');
        beg = html.indexOf(commentBegin, end + 3);
    }

    return html;
}

/**
 * Compressing html
 * @param html
 * @param minify
 * @returns {*}
 */
function compressHTML(html, minify) {

    if (html === null || html === '' || !minify)
        return html;

    //html = removeHtmlComments(html);

    var tags = ['script', 'textarea', 'pre', 'code'];
    var id = '#[twee-safe-block]';
    var cache = {};
    var indexer = 1;
    var length = tags.length;
    var REG_1 = /[\n\r\t]+/g;
    var REG_2 = /\s{3,}/g;

    for (var i = 0; i < length; i++) {
        var o = tags[i];

        var tagBeg = '<' + o;
        var tagEnd = '</' + o + '>';

        var beg = html.indexOf(tagBeg);
        var end = 0;
        var len = tagEnd.length;

        while (beg !== -1) {

            end = html.indexOf(tagEnd, beg + 3);
            if (end === -1)
                break;

            var value = html.substring(beg, end + len);

            if (i === 0) {
                end = value.indexOf('>');
                len = value.indexOf('type="text/template"');
                if (len < end && len !== -1)
                    break;
                len = value.indexOf('type="text/html"');
                if (len < end && len !== -1)
                    break;
                len = value.indexOf('type="text/ng-template"');
                if (len < end && len !== -1)
                    break;
            }

            var key = md5(indexer++) + String(id);
            cache[key] = value;
            html = html.replace(value, key);
            beg = html.indexOf(tagBeg, beg + tagBeg.length);
        }
    }

    html = html.replace(REG_1, ' ');
    html = html.replace(REG_2, ' ');

    var keys = Object.keys(cache);
    length = keys.length;

    for (i = 0; i < length; i++) {
        key = keys[i];
        html = html.replace(key, cache[key]);
    }

    return html;
}

/**
 * Compressing returned html and all the responses with gzip
 */
module.exports.extension = function() {
    var middlewareStack = [];

    // GZIP should always be first! because it is problem to handle response for html cleaning
    if (twee.getConfig('extension:twee-compressor:gzip')) {
        var compression = require('compression');
        middlewareStack.push(compression({threshold: 512}));
    }

    // Cleaning HTML
    if (twee.getConfig('extension:twee-compressor:html') && twee.getApplication().get('env') != 'development') {
        middlewareStack.push(function(req, res, next){
            var end = res.end;
            res.end = function(chunk, encoding){
                if (req.accepts('html') && chunk) {
                    var responseHtml = compressHTML(chunk.toString(encoding), true);
                    chunk = new Buffer(responseHtml, encoding);
                    res.setHeader('Content-Length', chunk.length);
                }
                return end.call(res, chunk, encoding);
            };

            next();
        });
    }

    // Start dispatch process for compressing process
    twee.getApplication().use(middlewareStack);
};

module.exports.dependencies = {
    // Session also should be first
    "Session": {
        "module": "twee-session-extension"
    },
    // Let static files to work first
    "Static Files": {
        "module": "twee-static-extension"
    }
};

module.exports.configNamespace = 'twee-compressor';

module.exports.config = {
    "html": true,
    "gzip": true
};
