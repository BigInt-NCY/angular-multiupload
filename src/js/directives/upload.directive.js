(function() {
'use strict';

var allowed_rules = {
	crop: function(file, files, config, update_file) {
		if (file && update_file)
			file.cropable = true;
		return true;
	},
	count: function(file, files, config, update_file) {
		var failed = false;
		var ret = true;
		var file_length = file && update_file ? files.length + 1 : files.length;
		var limit = config.limit;
		var min_limit;
		var max_limit;
		var int_limit = parseInt(limit, 10);
		var split_limit = limit.split(',');

		if (limit === '' || limit === '0') {
			min_limit = max_limit = 0;
		} else if (limit === '*' || limit === ',' || limit === '.') {
			min_limit = max_limit = -1;
		} else if (split_limit.length === 2) {
			min_limit = split_limit[0] === '' ? -1 : parseInt(split_limit[0]);
			max_limit = split_limit[1] === '' ? -1 : parseInt(split_limit[1]);
			if (min_limit === 'NaN' || max_limit === 'NaN') {
				failed = true;
				console.error('Bad limit value for count : ' + limit);
			}
		} else if (int_limit !== 'NaN') {
			min_limit = max_limit = int_limit;
		} else {
			failed = true;
			console.error('Unhandled limit value for count : ' + limit);
		}

		if (min_limit !== undefined && max_limit !== undefined) {
			if (min_limit > max_limit && max_limit !== -1) {
				failed = true;
				console.error('Count minimum limit must be inferior to maximum limit : ' + min_limit + '>' + max_limit);
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
			if (file && update_file) {
				file.error.failed = true;
				file.error.reason += ' ' + config.onError;
			}
			ret = false;
		}
		return ret;
	},
	thumbnail: function(file, files, config, update_file) {
		if (file && update_file)
			file.thumbnailable = true;
		return true;
	},
	validator: function(file, files, config, update_file) {
		if (!file)
			return true;
		var errors = config.limit(file);
		if (errors.length > 0) {
			if (file && update_file) {
				file.error.failed = true;
				file.error.reason = [config.onError].concat(errors);
			}
			return false;
		}
		return true;
	}
};

angular.module('multiUpload')
.directive('upload', [function(){
	return {
		restrict: 'E',
		scope: {
			url:                '@',
			method:             '@',
			files:              '=filesList',
			validRules:         '=',

			fileOnCancelCB:     '=fileOncancel',
			fileRenderSizeCB:   '=fileRenderSize',
			fileOnProgressCB:   '=fileOnprogress',
			fileUploadError:    '@',
			fileExtensionError: '@',

			simultaneousMax:    '@simultaneous',
		},
		transclude: true,
		replace: true,
		templateProvider: $templateCache.get('upload/directives/upload.directive.html'),
		link: function(scope, element, attrs) {

			scope.dropable = 'dropable' in attrs;
			scope.orderable = 'orderable' in attrs;
			scope.selectable = 'selectable' in attrs;
			scope.allowMultiple = 'multiple' in attrs;
			scope.allowDuplicate = !('noDuplicate' in attrs);

		},
		controller: ['$scope', 'Upload', function($scope, Upload) {

			$scope.PENDING         = 1;
			$scope.TRANSFERING     = 2;
			$scope.COMPLETE        = 3;
			$scope.ERROR           = 4;

			$scope.simultaneousCur = 0;
			$scope.allowedExtensions = '';

			var rules = {};
			this.addRule = function(name, configs) {
				if (Object.keys(configs).length === 0) {
					throw 'Bad rules declaration : in ' + name + ' : zero rule defined\n';
				} else {
					angular.forEach(configs, function(value, config) {
						if (config in allowed_rules) {
							rules[name] = configs;
						} else {
							throw 'Bad rule declaration : in ' + name + ' : unknown rule ' + config + '\n';
						}
					});
				}
				$scope.allowedExtensions += ($scope.allowedExtensions === '' ? '' : ',') + name;
			};

			function isFilesFollowingRules(files_list) {
				var i;

				for (var ruleExts in rules) {
					if (rules.hasOwnProperty(ruleExts)) {
						var files = $scope.getFilesMatchingRuleExtensions(ruleExts, files_list, false);
						for (var rule in rules[ruleExts])
							if (rules[ruleExts].hasOwnProperty(rule)) {
								if (files.length === 0) {
									if (allowed_rules[rule](null, [], rules[ruleExts][rule], false) !== true)
										return false;
								} else
									for (i = 0; i < files.length; i++)
										if (allowed_rules[rule](files[i], files, rules[ruleExts][rule], false) !== true)
											return false;
							}
					}
				}

				var list = $scope.files;
				if (files_list) {
					list = files_list;
				}
				var nb_respect = 0;
				for (i = 0; i < list.length; i++) {
					for (var extensions in rules) {
						if (rules.hasOwnProperty(extensions)) {
							var exts = extensions.split(',');
							if (exts.indexOf(list[i].extension) !== -1){
								nb_respect++;
							}
						}
					}
				}
				if (nb_respect !== list.length)
					return false;
				
				return true;
			}
			
			$scope.validRules.run = isFilesFollowingRules;

			$scope.reorder = function(pos_old, pos_new, event) {
				if (event)
					event.stopPropagation();
				if (pos_new < 0 || pos_new >= $scope.files.length)
					return;
				var tmp = $scope.files[pos_new];
				$scope.files[pos_new] = $scope.files[pos_old];
				$scope.files[pos_old] = tmp;
			};

			this.reorder = $scope.reorder;

			$scope.getRulesForExtension = function(file_extension) {
				var ret;

				if (Object.keys(rules).length === 0) {
					return ret;
				} else {
					ret = null;
					angular.forEach(rules, function(rule, extensions) {
						var exts = extensions.split(',');
						if (exts.indexOf(file_extension) !== -1) {
							ret = rule;
							return;
						}
						if (ret !== null) {
							return;
						}
					});
				}
				return ret;
			};

			$scope.getRuleExtensionsForFileExtension = function(file_extension) {
				var ret;

				if (Object.keys(rules).length === 0) {
					return ret;
				} else {
					ret = null;
					angular.forEach(rules, function(rule, extensions) {
						var exts = extensions.split(',');
						if (exts.indexOf(file_extension) !== -1) {
							ret = extensions;
							return;
						}
						if (ret !== null) {
							return;
						}
					});
				}
				return ret;
			};

			$scope.getFilesMatchingRuleExtensions = function(rules_extensions, files_list, with_errors) {
				var list = $scope.files;
				if (files_list) {
					list = files_list;
				}

				if (!rules_extensions) {
					return [];
				}

				var files = [];

				var exts = rules_extensions.split(',');
				angular.forEach(list, function(file) {
					if (exts.indexOf(file.extension) !== -1 && ((!with_errors && !file.error.failed) || (with_errors)))
						files.push(file);
				});
				return files;
			};

			function fileToDataURL(file, callback) {
				var fileReader = new FileReader();
				fileReader.onload = function(e) {
					callback(e.target.result);
				};
				fileReader.readAsDataURL(file.source);
			}

			$scope.crop = function(event, file) {
				event.stopPropagation();
				var crop = $scope.getRulesForExtension(file.extension).crop;
				fileToDataURL(file, function(drawable) {
					crop.limit(drawable, file.crop, function(result){
						if (result === true) {
							$scope.thumbnail(file, file.crop.drawable, true);
						} else {
							$scope.thumbnail(file, file.source);
						}
					});
				});
			};

			$scope.thumbnail = function(file, source, drawable) {
				if (!file.thumbnailable) {
					file.thumbnail = null;
					return;
				}
				
				if (drawable) {
					file.thumbnail = source;
					return;
				}
				
				var thumb = $scope.getRulesForExtension(file.extension).thumbnail;
				if (thumb.limit !== true) {
					file.thumbnail = thumb.limit(source);
				} else {
					fileToDataURL(file, function(drawable) {
						file.thumbnail = drawable;
					});
				}
			};

			function updateProgress(file, status, value) {
				if (value < 0) {
					value = 0;
				} else if (value > 100) {
					value = 100;
				}
				file.progress.value = value;
				file.progress.status = status;
				if ($scope.fileOnProgressCB) {
					file.progress.message = $scope.fileOnProgressCB(file.source, status, value);
				} else {
					file.progress.message = value + '%';
				}
			}

			function isUnique(file) {
				for (var i = 0; i < $scope.files.length; i++) {
					var efile = $scope.files[i];
					if (efile.name === file.name && efile.lastModified === file.lastModified && efile.size === file.size) {
						return false;
					}
				}
				return true;
			}

			function addToFilesList(files) {

				if (!files || !files.length) {
					return ;
				}

				angular.forEach(files, function(file) {
					var extension = file.name.substr((~-file.name.lastIndexOf('.') >>> 0) + 1).toLowerCase();

					if (!$scope.allowDuplicate && !isUnique(file)) {
						return;
					}

					var file_obj = {
						source: file, name: file.name, extension: extension,
						size: file.size, type: file.type, lastModified: file.lastModified,
						progress: { value: 0, status: $scope.PENDING, message: '' },
						error: { failed: true, reason: [] },
						thumbnail: null,
						thumbnailable: false,
						crop: {
							bounds: { left: 0, right: 0, top: 0, bottom: 0 },
							drawable: null,
						},
						cropable: false,
						_upload: null,
						upload: { code: 0, data: null },
					};

					$scope.files.push(file_obj);
				});
			}

			function uploadFiles() {
				if (!$scope.files || !$scope.files.length) {
					return;
				}

				angular.forEach($scope.files, function(file) {
					if (file.error.failed) {
						var files_tmp = $scope.getFilesMatchingRuleExtensions($scope.getRuleExtensionsForFileExtension(file.extension));
						file.error.failed = false;
						file.error.reason = [];
						var rules = $scope.getRulesForExtension(file.extension);
						if (!rules) {
							file.error.failed = true;
							file.error.reason = $scope.fileExtensionError;
						} else {
							angular.forEach(rules, function(config, rule) {
								allowed_rules[rule](file, files_tmp, config, true);
							});
						}
						if (file.thumbnailable && !file.thumbnail)
							$scope.thumbnail(file, file.source);
					}
					
					if ($scope.simultaneousCur < $scope.simultaneousMax && file.progress.status === $scope.PENDING && !file.error.failed) {
						updateProgress(file, $scope.TRANSFERING, 0);
						$scope.simultaneousCur++;
						file._upload = Upload.upload({
							url: $scope.url,
							data: {key: file.source},
							method: $scope.method,
						});
						file._upload.then(function (resp) {
							updateProgress(file, $scope.COMPLETE, 100);
							$scope.simultaneousCur--;
							file.upload.data = resp.data;
							file.upload.code = resp.status;
						}, function (resp) {
							updateProgress(file, $scope.ERROR, 0);
							file.error.failed = true;
							file.error.reason = $scope.fileUploadError;
							$scope.simultaneousCur--;
						}, function (evt) {
							updateProgress(file, $scope.TRANSFERING, parseInt(100 * evt.loaded / evt.total));
						});
					}
					if ($scope.simultaneousCur >= $scope.simultaneousMax) {
						return ;
					}
				});
			}

			$scope.onChanges = function($files, $file, $newFiles, $duplicateFiles, $invalidFiles, $event) {
				if (!$newFiles || !$newFiles.length) {
					return;
				}
				addToFilesList($newFiles);
				uploadFiles();
			};

			$scope.cancel = function(index, event) {
				if (event)
					event.stopPropagation();
				var file = $scope.files[index];
				$scope.files.splice(index, 1);
				if (file.progress.status === $scope.TRANSFERING) {
					file._upload.abort();
				} else {
					uploadFiles();
				}
				if ($scope.fileOnCancelCB) {
					$scope.fileOnCancelCB(file);
				}
			};

			$scope.$watch('simultaneousCur', function() {
				if ($scope.simultaneousCur < $scope.simultaneousMax) {
					uploadFiles();
				}
			});

		}]
	};
}]);

})();
