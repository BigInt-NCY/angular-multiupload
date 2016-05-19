angularMultiUpload.directive('topinfo', [function(){
	return {
		restrict: 'E',
		scope: {
		},
		require: '^upload',
		replace: true,
	};
}]);
