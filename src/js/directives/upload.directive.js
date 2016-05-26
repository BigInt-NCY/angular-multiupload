(function() {
'use strict';

function fileToDataURL(source, callback) {
	var fileReader = new FileReader();
	fileReader.onload = function(e) {
		callback(e.target.result);
	};
	fileReader.readAsDataURL(source);
}

var allowed_rules = {
	crop: function(file, files, rule) {
		if (!file)
			return false;

		file.$cropable = true;
		return true;
	},
	count: function(file, files, rule) {
		var failed = false;
		var ret = true;
		var file_length = file ? files.length + 1 : files.length;
		var limit = rule.limit;
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
			if (file)
				file.error = rule.onError;
			ret = false;
		}
		return ret;
	},
	thumbnail: function(file, files, rule) {
		if (!file)
			return false;

		file.$thumbnailable = true;
		if (file.$crop && file.$crop.source_after_crop)
			file.$thumbnail = file.$crop.source_after_crop;
		else if (file.$source_url)
			file.$thumbnail = file.$source_url;
		else if (file.$source_file) {
			if (rule && rule.limit !== true)
				file.$thumbnail = rule.limit(file.$source_file, thumb.config);
			else
				fileToDataURL(file.$source_file, function(drawable) { file.$thumbnail = drawable; });
		}
		return true;
	},
	validator: function(file, files, rule) {
		if (!file)
			return false;

		var errors = rule.limit(file);
		if (errors.length > 0) {
			if (file)
				file.error = rule.onError;
			return false;
		}
		return true;
	}
};

angular.module('multiUpload', ['ngFileUpload']);

angular.module('multiUpload')
.directive('upload', [function($templateCache){
	return {
		restrict: 'E',
		scope: {
			url:                '=',
			multipartName:      '=',
			method:             '@',
			files:              '=filesList',
			validRules:         '=',

			fileDownloadLink:    '=?fileDownloadLink',
			_fileOnUploadEndCB:  '=fileOnUploadEnd',
			_fileGetFullpathCB:  '=fileGetfullpath',
			_fileOnCancelCB:     '=fileOncancel',
			_fileRenderSizeCB:   '=fileRenderSize',
			_fileOnProgressCB:   '=fileOnprogress',
			fileUploadError:    '@',
			fileExtensionError: '@',

			simultaneousMax:    '@simultaneous',
		},
		transclude: true,
		replace: true,
		templateUrl: 'directives/templates/upload.directive.html',
		link: function(scope, element, attrs) {

			if (angular.isUndefined(scope.files))
				throw 'files-list parameter is missing and is required.';
			if (angular.isUndefined(scope.url))
				throw 'url parameter is missing and is required.';

			scope.dropable          = 'dropable'      in attrs;
			scope.orderable         = 'orderable'     in attrs;
			scope.selectable        = 'selectable'    in attrs;
			scope.allowMultiple     = 'multiple'      in attrs;
		},
		controller: ['$scope', 'Upload', function($scope, Upload) {

			$scope.UPLOAD_PENDING         = 1;
			$scope.UPLOAD_TRANSFERING     = 2;
			$scope.UPLOAD_COMPLETE        = 3;
			$scope.UPLOAD_ERROR           = 4;
			$scope.UPLOAD_OLD             = 5;

			$scope.simultaneousCur = 0;
			$scope.allowedExtensions = '';
			$scope.simultaneousMax   = $scope.simultaneousMax ? $scope.simultaneousMax : 999;

			$scope.fileOnUploadEndCB = angular.isFunction($scope._fileOnUploadEndCB) ? $scope._fileOnUploadEndCB : function(file, http_code, response) {};
			$scope.fileGetFullpathCB = angular.isFunction($scope._fileGetFullpathCB) ? $scope._fileGetFullpathCB : function(path) { return path; };
			$scope.fileOnCancelCB    = angular.isFunction($scope._fileOnCancelCB)    ? $scope._fileOnCancelCB    : function(file, http_code, response) {};
			$scope.fileRenderSizeCB  = angular.isFunction($scope._fileRenderSizeCB)  ? $scope._fileRenderSizeCB  : function(size) { return size + 'o'; };
			$scope.fileOnProgressCB  = angular.isFunction($scope._fileOnProgressCB)  ? $scope._fileOnProgressCB  : function(source, status, percentil) { return status + ': ' + percentil + '%'; };

			var rules = null;

			function getRulesForFileExtension(file_extension) {
				var ret;
			
				if (!rules || Object.keys(rules).length === 0) {
					return ret;
				}
			
				ret = null;
				for (var extensions in rules)
					if (rules.hasOwnProperty(extensions)) {
						var exts = extensions.split(',');
						if (exts.indexOf(file_extension) !== -1)
							ret = rules[extensions];
						if (ret !== null)
							break;
					}
			
				return ret;
			}

			function getRuleExtensionsForFileExtension(file_extension) {
				var ret;
			
				if (!rules ||Object.keys(rules).length === 0) {
					return ret;
				}
			
				ret = null;
				for (var extensions in rules)
					if (rules.hasOwnProperty(extensions)) {
						var exts = extensions.split(',');
						if (exts.indexOf(file_extension) !== -1)
							ret = extensions;
						if (ret !== null)
							break;
					}
			
				return ret;
			}

			function getFilesMatchingRuleExtensions(rules_extensions, without_errors, files_list) {
				without_errors = without_errors ? without_errors : false;
				files_list = files_list ? files_list : $scope.files;

				if (!rules_extensions)
					return [];

				var exts = rules_extensions.split(',');
				var files_to_return = [];

				angular.forEach(files_list, function(file) {
					if (exts.indexOf(file.$extension) !== -1 && ((without_errors && !file.error) || !without_errors))
						files_to_return.push(file);
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
				var file_rules = getRulesForFileExtension(file.$extension);

				if (!file_rules) {
					file.error = $scope.fileExtensionError;
					return -1;
				}
				for (var rule in file_rules)
					if (file_rules.hasOwnProperty(rule))
						if (allowed_rules[rule](file, files_same_ext, file_rules[rule]) !== true) {
							if (!strict && !file.error)
								return 1;
							else if (!strict && file.error)
								return -1;
							else
								return -1;
						}

				return 0;
			}

			function isFilesObservingRules(files_list, strict) {
				files_list = files_list ? files_list : $scope.files;
				strict = strict ? strict : false;

				for (var i = 0; i < files_list.length; i++) {
					var ret = isFileObservingRules(files_list[i], files_list, strict);
					if (strict && ret !== 0)
						return false;
					else if (ret === -1)
						return false;
				}
				return true;
			}

			this.addRule = function(name, configs) {
				if (!rules) {
					rules = {};
				}
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
				isFilesObservingRules();
			};

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

			function onCropFinish(file, result, drawable, bounds, reset) {
				if (result === true)
					if (reset)
						delete file.$crop;
					else {
						file.$crop.source_after_crop = drawable;
						file.$crop.bounds = bounds;
					}

				if (file.$thumbnailable)
					allowed_rules.thumbnail(file, null, null);
			}

			$scope.crop = function(event, file) {
				if (event)
					event.stopPropagation();

				file.$crop = file.$crop ? file.$crop : { bounds: { top: 0, bottom: 0, left: 0, right: 0 } };
		
				var file_rules = getRulesForFileExtension(file.$extension);
				if (!file_rules.crop)
					return ;

				if (file.$source_file)
					fileToDataURL(file.$source_file, function(drawable) {
						file_rules.crop.limit(drawable, file, file.$crop.bounds, onCropFinish);
					});
				else if (file.$source_url)
					file_rules.crop.limit(file.$source_url, file, file.$crop.bounds, onCropFinish);
				else
					console.error('unable to find source for crop');
			};

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
				if (!$scope.files.length)
					return;

				angular.forEach($scope.files, function (file) {

					if (file.error && file.progress.status !== $scope.UPLOAD_ERROR)
						if (isFileObservingRules(file) === 0)
							delete file.error;

					// if we dont reach limit for simultaneous upload and file is waiting to be uploaded (have a source, have good status, no errors, ...)
					if ($scope.simultaneousCur < $scope.simultaneousMax && file.progress.status === $scope.UPLOAD_PENDING && !file.error && file.$source_file) {
						updateProgress(file, $scope.UPLOAD_TRANSFERING, 0);
						$scope.simultaneousCur++;

						var data = {};
						data[$scope.multipartName ? (angular.isFunction($scope.multipartName) ? $scope.multipartName(file.name) : $scope.multipartName) : 'key'] = file.$source_file;

						// store the promise for cancel upload if we want
						file.$upload = Upload.upload({
							url: angular.isFunction($scope.url) ? $scope.url(file.name) : $scope.url,
							data: data,
							method: $scope.method
						}).then(function (resp) { // ON UPLOAD COMPLETE
							updateProgress(file, $scope.UPLOAD_COMPLETE, 100);
							$scope.simultaneousCur--;
							$scope.fileOnUploadEndCB(file, resp.status, resp.data);
						}, function (resp) { // ON UPLOAD ERROR
							updateProgress(file, $scope.UPLOAD_ERROR, 0);
							updateError(file, $scope.fileUploadError || 'upload error');
							$scope.simultaneousCur--;
						}, function (evt) { // ON UPLOAD TRANSFER PROGRESS
							updateProgress(file, $scope.UPLOAD_TRANSFERING, parseInt(100 * evt.loaded / evt.total));
						});
					}
				});
			}

			function addToFilesList(files, already_uploaded) {
				if (!files || !files.length)
					return ;

				angular.forEach(files, function(file) {
					if (!file.name) {
						console.warn('add file to files failed because file object does not have "name" key.');
						return;
					}
					var extension = file.name.substr((~-file.name.lastIndexOf('.') >>> 0) + 1).toLowerCase();

					var file_obj = {
						name: file.name,
						error: true,
						$extension: extension,
					};

					if (already_uploaded) {
						updateProgress(file_obj, $scope.UPLOAD_OLD, 100);
						file_obj.$source_url = $scope.fileGetFullpathCB(file_obj.name);
					} else {
						updateProgress(file_obj, $scope.UPLOAD_PENDING, 0);
						file_obj.$source_file = file;
					}

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
				if (event)
					event.stopPropagation();

				var file = $scope.files[index];

				// remove file from list and kill upload if possible
				$scope.files.splice(index, 1);

				if (file.progress.status === $scope.UPLOAD_TRANSFERING) {
					if (file.$upload)
						file.$upload.abort(); // TODO
				} else {
					refreshFiles();
				}
				$scope.fileOnCancelCB(file);
			};

			$scope.$watch('simultaneousCur', function() {
				if ($scope.simultaneousCur < $scope.simultaneousMax) {
					refreshFiles();
				}
			});

			// remove from files list all files receive from caller and re-add them with wanted attributes
			var tmp_files = $scope.files.splice(0, $scope.files.length);
			addToFilesList(tmp_files, true);
		}]
	};
}]);

})();
