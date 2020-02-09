var ejs = require('ejs');
var fs = require('fs');
var path = require('path');
var async = require('async');
var _ = require('lodash');
var puppeteer = require('puppeteer');

module.exports = function PDF(sails) {
    var self;
    var compileTemplate = function (view, data, cb) {
        if (sails.hooks.views && sails.hooks.views.render) {
            var relPath = path.relative(sails.config.paths.views, view);
            sails.hooks.views.render(relPath, data, cb);
            return;
        }
        fs.readFile(view + '.ejs', function (err, source) {
            if (err) return cb(err);
            try {
                var compileFn = ejs.compile((source || "").toString(), {
                    cache: true,
                    filename: view
                });
                cb(null, compileFn(data));
            } catch (e) {
                return cb(e);
            }
        });
    };
    return {
        defaults: {
            __configKey__: {
                templateDir: path.resolve(sails.config.appPath, 'views/pdfTemplates'),
            }
        },
        configure: function () {
            sails.config[this.configKey].templateDir = path.resolve(sails.config.appPath, sails.config[this.configKey].templateDir);
        },
        initialize: function (cb) {
            self = this;
            return cb();
        },
        make: function (template, data, options, cb) {
            return new Promise(function (resolve, reject) {
                data = data || {};
                if (typeof data.layout === 'undefined') data.layout = false;
                var templateDir = sails.config[self.configKey].templateDir;
                var templatePath = path.join(templateDir, template);
                var defaults = {
                    output: "mypdf.pdf"
                };
                var opt = _.defaults(options, defaults);
                async.waterfall([
                        function (next) {
                            compileTemplate(templatePath + "/pdf", data, function (err, html) {
                                if (err) {
                                    next(err);
                                } else {
                                    next(null, html);
                                }
                            });
                        },
                        async function (html, next) {
                            const browser = await puppeteer.launch({headless: true});
                            const page = await browser.newPage();
                            await page.setContent(html);
                            const pdf = await page.pdf({format: 'A4', printBackground: true, path: path.resolve(sails.config.appPath, opt.output)});

                            await browser.close();

                            next(null, pdf);
                        }
                    ],
                    function (error, result) {
                        if (error) {
                            if (cb) cb(error);
                            reject(error);
                        } else {
                            if (cb) cb(null, result);
                            resolve(result);
                        }
                    });
            });
        }
    };
};