angularMultiUpload.directive('rules', [function(){
	return {
		restrict: 'E',
		scope: {
			accept: '@',
		},
		require: '^^upload',
		replace: true,
		template: '',
		link: function(scope, element, attrs, parentCtrl) {
			parentCtrl.addRule(scope.accept, scope.rules);
		},
		controller: ['$scope', function($scope) {
			$scope.rules = {};
			this.addRule = function(name, value, onError) {
				if (name in $scope.rules) {
					throw 'Same rules declared multiple times : previous declaration of ' + name + '="' + $scope.rules[name].limit + '" /> redeclared here :\n';
				} else {
					$scope.rules[name] = {limit: value, onError: onError};
				}
			};
		}],
	};
}]);
