(function() {
'use strict';

angular.module('multiUpload')
.directive('topinfo', [function(){
	return {
		restrict: 'E',
		scope: {
		},
		require: '^upload',
		replace: true,
	};
}]);

})();
