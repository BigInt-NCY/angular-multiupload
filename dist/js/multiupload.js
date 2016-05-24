(function() {
    "use strict";
    var allowed_rules = {
        crop: function(file, files, rule, update_file) {
            if (file && update_file) file.$cropable = true;
            return true;
        },
        count: function(file, files, rule, update_file) {
            var failed = false;
            var ret = true;
            var file_length = file && update_file ? files.length + 1 : files.length;
            var limit = rule.limit;
            var min_limit;
            var max_limit;
            var int_limit = parseInt(limit, 10);
            var split_limit = limit.split(",");
            if (limit === "" || limit === "0") {
                min_limit = max_limit = 0;
            } else if (limit === "*" || limit === "," || limit === ".") {
                min_limit = max_limit = -1;
            } else if (split_limit.length === 2) {
                min_limit = split_limit[0] === "" ? -1 : parseInt(split_limit[0]);
                max_limit = split_limit[1] === "" ? -1 : parseInt(split_limit[1]);
                if (min_limit === "NaN" || max_limit === "NaN") {
                    failed = true;
                    console.error("Bad limit value for count : " + limit);
                }
            } else if (int_limit !== "NaN") {
                min_limit = max_limit = int_limit;
            } else {
                failed = true;
                console.error("Unhandled limit value for count : " + limit);
            }
            if (min_limit !== undefined && max_limit !== undefined) {
                if (min_limit > max_limit && max_limit !== -1) {
                    failed = true;
                    console.error("Count minimum limit must be inferior to maximum limit : " + min_limit + ">" + max_limit);
                }
                if (file_length > max_limit && max_limit !== -1) {
                    failed = true;
                } else if (file_length < min_limit && min_limit !== -1) {
                    ret = false;
                }
            } else {
                failed = true;
            }
            if (failed) {
                if (file && update_file) file.error = rule.onError;
                // TODO
                ret = false;
            }
            return ret;
        },
        thumbnail: function(file, files, rule, update_file) {
            if (file && update_file) file.$thumbnailable = true;
            return true;
        },
        validator: function(file, files, rule, update_file) {
            if (!file) return true;
            var errors = rule.limit(file);
            if (errors.length > 0) {
                if (file && update_file) file.error = rule.onError;
                // TODO
                return false;
            }
            return true;
        }
    };
    angular.module("multiUpload", [ "ngFileUpload" ]);
    angular.module("multiUpload").directive("upload", [ function($templateCache) {
        return {
            restrict: "E",
            scope: {
                url: "=",
                multipartName: "=",
                method: "@",
                files: "=filesList",
                validRules: "=",
                fileGetFullPathCB: "=fileGetfullpath",
                fileOnCancelCB: "=fileOncancel",
                fileRenderSizeCB: "=fileRenderSize",
                fileOnProgressCB: "=fileOnprogress",
                fileUploadError: "@",
                fileExtensionError: "@",
                simultaneousMax: "@simultaneous"
            },
            transclude: true,
            replace: true,
            templateUrl: "directives/templates/upload.directive.html",
            link: function(scope, element, attrs) {
                if (angular.isUndefined(scope.files)) throw "files-list parameter is missing and is required.";
                if (angular.isUndefined(scope.url)) throw "url parameter is missing and is required.";
                scope.dropable = "dropable" in attrs;
                scope.orderable = "orderable" in attrs;
                scope.selectable = "selectable" in attrs;
                scope.allowMultiple = "multiple" in attrs;
                scope.simultaneousMax = scope.simultaneousMax ? scope.simultaneousMax : 999;
                scope.fileGetFullPathCB = angular.isFunction(scope.fileGetFullPathCB) ? scope.fileGetFullPathCB : function(path) {
                    return path;
                };
                scope.fileRenderSizeCB = angular.isFunction(scope.fileRenderSizeCB) ? scope.fileRenderSizeCB : function(size) {
                    return size + "o";
                };
                scope.fileOnProgressCB = angular.isFunction(scope.fileOnProgressCB) ? scope.fileOnProgressCB : function(source, status, percentil) {
                    return status + ": " + percentil + "%";
                };
            },
            controller: [ "$scope", "Upload", function($scope, Upload) {
                $scope.UPLOAD_PENDING = 1;
                $scope.UPLOAD_TRANSFERING = 2;
                $scope.UPLOAD_COMPLETE = 3;
                $scope.UPLOAD_ERROR = 4;
                $scope.UPLOAD_OLD = 5;
                $scope.simultaneousCur = 0;
                $scope.allowedExtensions = "";
                // function fileToDataURL(source, callback) {
                // 	var fileReader = new FileReader();
                // 	fileReader.onload = function(e) {
                // 		callback(e.target.result);
                // 	};
                // 	fileReader.readAsDataURL(source);
                // }
                var rules = null;
                this.addRule = function(name, configs) {
                    if (!rules) {
                        rules = {};
                    }
                    if (Object.keys(configs).length === 0) {
                        throw "Bad rules declaration : in " + name + " : zero rule defined\n";
                    } else {
                        angular.forEach(configs, function(value, config) {
                            if (config in allowed_rules) {
                                rules[name] = configs;
                            } else {
                                throw "Bad rule declaration : in " + name + " : unknown rule " + config + "\n";
                            }
                        });
                    }
                    $scope.allowedExtensions += ($scope.allowedExtensions === "" ? "" : ",") + name;
                };
                function getRulesForFileExtension(file_extension) {
                    var ret;
                    if (!rules || Object.keys(rules).length === 0) {
                        return ret;
                    }
                    ret = null;
                    for (var extensions in rules) if (rules.hasOwnProperty(extensions)) {
                        var exts = extensions.split(",");
                        if (exts.indexOf(file_extension) !== -1) ret = rules[extensions];
                        if (ret !== null) break;
                    }
                    return ret;
                }
                function getRuleExtensionsForFileExtension(file_extension) {
                    var ret;
                    if (!rules || Object.keys(rules).length === 0) {
                        return ret;
                    }
                    ret = null;
                    for (var extensions in rules) if (rules.hasOwnProperty(extensions)) {
                        var exts = extensions.split(",");
                        if (exts.indexOf(file_extension) !== -1) ret = extensions;
                        if (ret !== null) break;
                    }
                    return ret;
                }
                function getFilesMatchingRuleExtensions(rules_extensions, without_errors, files_list) {
                    without_errors = without_errors ? without_errors : false;
                    files_list = files_list ? files_list : $scope.files;
                    if (!rules_extensions) return [];
                    var exts = rules_extensions.split(",");
                    var files_to_return = [];
                    angular.forEach(files_list, function(file) {
                        if (exts.indexOf(file.$extension) !== -1 && (without_errors && !file.error || !without_errors)) files_to_return.push(file);
                    });
                    return files_to_return;
                }
                function isFileObservingRules(file, files_list, strict) {
                    files_list = files_list ? files_list : $scope.files;
                    strict = strict ? strict : false;
                    var file_rules_ext = getRuleExtensionsForFileExtension(file.$extension);
                    file.error = true;
                    var files_same_ext = getFilesMatchingRuleExtensions(file_rules_ext, true, files_list);
                    delete file.error;
                    var rules = getRulesForFileExtension(file.$extension);
                    var ret = 0;
                    for (var rule in rules) {
                        if (rules.hasOwnProperty(rule)) {
                            if (allowed_rules[rule](file, files_same_ext, rules[rule], true) !== true) {
                                if (!strict && !file.error) ret = 1; else if (!strict && file.error) ret = -1; else ret = -1;
                                break;
                            }
                        }
                    }
                    return ret;
                }
                // // TODO function isFilesObservingRules(files_list) {
                // 	if (!rules)
                // 		return true;
                //
                // 	var i;
                //
                // 	for (var ruleExts in rules) {
                // 		if (rules.hasOwnProperty(ruleExts)) {
                // 			var files = $scope.getFilesMatchingRuleExtensions(ruleExts, files_list, false);
                // 			for (var rule in rules[ruleExts])
                // 				if (rules[ruleExts].hasOwnProperty(rule)) {
                // 					if (files.length === 0) {
                // 						if (allowed_rules[rule](null, [], rules[ruleExts][rule], false) !== true)
                // 							return false;
                // 					} else
                // 						for (i = 0; i < files.length; i++)
                // 							if (allowed_rules[rule](files[i], files, rules[ruleExts][rule], false) !== true)
                // 								return false;
                // 				}
                // 		}
                // 	}
                //
                // 	var list = $scope.files;
                // 	if (files_list) {
                // 		list = files_list;
                // 	}
                // 	var nb_respect = 0;
                // 	for (i = 0; i < list.length; i++) {
                // 		for (var extensions in rules) {
                // 			if (rules.hasOwnProperty(extensions)) {
                // 				var exts = extensions.split(',');
                // 				if (exts.indexOf(list[i].extension) !== -1){
                // 					nb_respect++;
                // 				}
                // 			}
                // 		}
                // 	}
                // 	if (nb_respect !== list.length)
                // 		return false;
                //
                // 	return true;
                // }
                //
                // // TODO factory ou je ne sais quoi, how ?
                // if ($scope.validRules)
                // 	$scope.validRules.run = isFilesFollowingRules;
                $scope.reorder = function(pos_old, pos_new, event) {
                    if (event) event.stopPropagation();
                    if (pos_new < 0 || pos_new >= $scope.files.length) return;
                    var tmp = $scope.files[pos_new];
                    $scope.files[pos_new] = $scope.files[pos_old];
                    $scope.files[pos_old] = tmp;
                };
                this.reorder = $scope.reorder;
                // TODO
                $scope.crop = function(event, file) {};
                // TODO
                $scope.thumbnail = function(file, source, is_drawable) {};
                function updateProgress(file, status, value) {
                    file.progress = {
                        value: value,
                        status: status
                    };
                }
                function updateError(file, failure_reason) {
                    file.error = failure_reason;
                }
                function refreshFiles() {
                    if (!$scope.files.length) return;
                    angular.forEach($scope.files, function(file) {
                        if (file.error && file.progress.status !== $scope.UPLOAD_ERROR) if (isFileObservingRules(file) === 0) delete file.error;
                        if (file.$thumbnailable && !file.$thumbnail) // TODO
                        $scope.thumbnail(file, file.source);
                        // if we dont reach limit for simultaneous upload and file is waiting to be uploaded (have a source, have good status, no errors, ...)
                        if ($scope.simultaneousCur < $scope.simultaneousMax && file.progress.status === $scope.UPLOAD_PENDING && !file.error && file.$source_file) {
                            updateProgress(file, $scope.UPLOAD_TRANSFERING, 0);
                            $scope.simultaneousCur++;
                            var data = {};
                            data[$scope.multipart ? angular.isFunction(scope.multipartName) ? scope.multipartName(file.name) : scope.multipartName : "key"] = file.$source_file;
                            // store the promise for cancel upload if we want
                            file.$upload = Upload.upload({
                                url: angular.isFunction($scope.multipartName) ? $scope.url(file.name) : $scope.url,
                                data: data,
                                method: $scope.method
                            }).then(function(resp) {
                                // ON UPLOAD COMPLETE
                                updateProgress(file, $scope.UPLOAD_COMPLETE, 100);
                                $scope.simultaneousCur--;
                            }, function(resp) {
                                // ON UPLOAD ERROR
                                updateProgress(file, $scope.UPLOAD_ERROR, 0);
                                updateError(file, $scope.fileUploadError || "upload error");
                                $scope.simultaneousCur--;
                            }, function(evt) {
                                updateProgress(file, $scope.UPLOAD_TRANSFERING, parseInt(100 * evt.loaded / evt.total));
                            });
                        }
                    });
                }
                function addToFilesList(files, already_uploaded) {
                    if (!files || !files.length) {
                        return;
                    }
                    angular.forEach(files, function(file) {
                        if (!file.name) {
                            console.warn('add file to files failed because file object does not have "name" key.');
                            return;
                        }
                        var extension = file.name.substr((~-file.name.lastIndexOf(".") >>> 0) + 1).toLowerCase();
                        var file_obj = {
                            name: file.name,
                            error: true,
                            $extension: extension
                        };
                        if (already_uploaded) {
                            updateProgress(file_obj, $scope.UPLOAD_OLD, 100);
                            file_obj.$source_url = $scope.fileGetFullPathCB(file_obj.name);
                        } else {
                            updateProgress(file_obj, $scope.UPLOAD_PENDING, 0);
                            file_obj.$source_file = file;
                        }
                        // var file_obj = {
                        // 	source: file,name: file.name, extension: extension,
                        // 	size: file.size, type: file.type, lastModified: file.lastModified,
                        // 	progress: { value: 0, status: $scope.PENDING, message: '' },
                        // 	error: { failed: true, reason: [] },
                        // 	thumbnail: null,
                        // 	thumbnailable: false,
                        // 	crop: {
                        // 		bounds: { left: 0, right: 0, top: 0, bottom: 0 },
                        // 		drawable: null,
                        // 	},
                        // 	cropable: false,
                        // 	_upload: null,
                        // 	upload: { code: 0, data: null },
                        // };
                        $scope.files.push(file_obj);
                    });
                    refreshFiles();
                }
                $scope.onChanges = function($files, $file, $newFiles, $duplicateFiles, $invalidFiles, $event) {
                    if (!$newFiles || !$newFiles.length) {
                        return;
                    }
                    addToFilesList($newFiles);
                };
                $scope.cancel = function(index, event) {
                    if (event) event.stopPropagation();
                    var file = $scope.files[index];
                    // remove file from list and kill upload if possible
                    $scope.files.splice(index, 1);
                    if (file.progress.status === $scope.UPLOAD_TRANSFERING) {
                        if (file.$upload) file.$upload.abort();
                    } else {
                        refreshFiles();
                    }
                    $scope.fileOnCancelCB(file);
                };
                $scope.$watch("simultaneousCur", function() {
                    if ($scope.simultaneousCur < $scope.simultaneousMax) {
                        refreshFiles();
                    }
                });
                // remove from files list all files receive from caller and re-add them with wanted attributes
                var tmp_files = $scope.files.splice(0, $scope.files.length);
                addToFilesList(tmp_files, true);
            } ]
        };
    } ]);
})();

(function() {
    "use strict";
    angular.module("multiUpload").directive("movable", [ function() {
        return {
            restrict: "A",
            scope: {
                movable: "=",
                index: "="
            },
            require: "^upload",
            replace: true,
            link: function(scope, element, attrs, parentCtrl) {
                if (scope.movable !== true) {
                    return;
                }
                // dropzone
                element.bind("dragenter", function(e) {
                    e.preventDefault();
                });
                element.bind("dragleave", function(e) {});
                element.bind("dragover", function(e) {
                    e.preventDefault();
                });
                element.bind("drop", function(e) {
                    e.preventDefault();
                    if (e.dataTransfer.getData("index") !== "") {
                        scope.$apply(function() {
                            parentCtrl.reorder(e.dataTransfer.getData("index"), scope.index);
                        });
                    }
                });
                // dragzone
                var to_bind_elem = angular.element(element[0].querySelector(".desktop"));
                to_bind_elem.attr("draggable", true);
                to_bind_elem.bind("dragstart", function(e) {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("index", scope.index);
                });
                to_bind_elem.bind("dragend", function(e) {});
            }
        };
    } ]);
})();

(function() {
    "use strict";
    angular.module("multiUpload").directive("rule", [ function() {
        return {
            restrict: "E",
            scope: true,
            require: "^^rules",
            replace: true,
            template: "",
            link: function(scope, element, attrs, parentCtrl) {
                var rules = [];
                var onerror;
                angular.forEach(attrs.$attr, function(value, key) {
                    if (key === "onError") {
                        onerror = attrs[key];
                    } else {
                        rules.push({
                            key: key,
                            value: scope.$eval(attrs[key])
                        });
                    }
                });
                if (rules.length === 0) {
                    throw "Bad rule declaration : no rule defined in\n";
                } else {
                    angular.forEach(rules, function(rule) {
                        parentCtrl.addRule(rule.key, rule.value, onerror);
                    });
                }
            }
        };
    } ]);
})();

(function() {
    "use strict";
    angular.module("multiUpload").directive("rules", [ function() {
        return {
            restrict: "E",
            scope: {
                accept: "@"
            },
            require: "^^upload",
            replace: true,
            template: "",
            link: function(scope, element, attrs, parentCtrl) {
                parentCtrl.addRule(scope.accept, scope.rules);
            },
            controller: [ "$scope", function($scope) {
                $scope.rules = {};
                this.addRule = function(name, value, onError) {
                    if (name in $scope.rules) {
                        throw "Same rules declared multiple times : previous declaration of " + name + '="' + $scope.rules[name].limit + '" /> redeclared here :\n';
                    } else {
                        $scope.rules[name] = {
                            limit: value,
                            onError: onError
                        };
                    }
                };
            } ]
        };
    } ]);
})();

(function() {
    "use strict";
    angular.module("multiUpload").directive("topinfo", [ function() {
        return {
            restrict: "E",
            scope: {},
            require: "^upload",
            replace: true
        };
    } ]);
})();

angular.module("multiUpload").run([ "$templateCache", function($templateCache) {
    "use strict";
    $templateCache.put("directives/templates/upload.directive.html", '<div class="upload"\r' + "\n" + '	ngf-drop ngf-drop-disabled="!dropable"\r' + "\n" + '	ngf-multiple="allowMultiple"\r' + "\n" + '	ngf-change="onChanges($files, $file, $newFiles, $duplicateFiles, $invalidFiles, $event)"\r' + "\n" + '	ngf-fix-orientation="true" ngf-stop-propagation="true"\r' + "\n" + "	>\r" + "\n" + '	<div class="topinfo" ng-transclude\r' + "\n" + '		ngf-select ngf-select-disabled="!selectable"\r' + "\n" + '		ngf-multiple="allowMultiple" ngf-accept="\'{{ allowedExtensions }}\'"\r' + "\n" + '		ngf-change="onChanges($files, $file, $newFiles, $duplicateFiles, $invalidFiles, $event)"\r' + "\n" + '		ngf-fix-orientation="true" ngf-stop-propagation="true"\r' + "\n" + "		></div>\r" + "\n" + "	<ul>\r" + "\n" + '		<li class="file" movable="orderable" data-index="$index" ng-class="{\'error\': file.error}" ng-repeat="file in files">\r' + "\n" + '			<div ng-show="orderable && files.length > 1" class="grip">\r' + "\n" + '				<div class="desktop"></div>\r' + "\n" + '				<div class="mobile">\r' + "\n" + '					<div class="up" ng-click="reorder($index, $index - 1, $event)"></div>\r' + "\n" + '					<div class="down" ng-click="reorder($index, $index + 1, $event)"></div>\r' + "\n" + "				</div>\r" + "\n" + "			</div>\r" + "\n" + '			<!-- <div ng-show="file.thumbnailable" class="thumbnail">\r' + "\n" + '				<img src="{{ file.thumbnail }}" alt="thumbnail {{ file.name }}" />\r' + "\n" + "			</div> -->\r" + "\n" + '			<!-- <div ng-show="file.cropable" class="resize" ng-click="crop($event, file)"></div> -->\r' + "\n" + '			<div class="name">{{ file.name }}</div>\r' + "\n" + '			<!-- <div class="size">{{ fileRenderSizeCB(file.size) }}</div> -->\r' + "\n" + '			<div class="error" ng-show="file.error" title="{{ file.error }}">{{ file.error }}</div>\r' + "\n" + '			<div class="progression" ng-show="!file.error" >\r' + "\n" + '				<progress min="0" value="{{ file.progress.value }}" max="100"></progress>\r' + "\n" + "				<span>{{ fileOnProgressCB(file.name, file.progress.status, file.progress.value) }}</span>\r" + "\n" + "			</div>\r" + "\n" + '			<div class="delete" ng-click="cancel($index, $event)"></div>\r' + "\n" + "		</li>\r" + "\n" + "	</ul>\r" + "\n" + "</div>\r" + "\n");
} ]);
//# sourceMappingURL=multiupload.js.map