(function() {
'use strict';

angular.module('multiUpload')
.directive('rule', [function(){
	return {
		restrict: 'E',
		scope: true,
		require: '^^rules',
		replace: true,
		template: '',
		link: function(scope, element, attrs, parentCtrl) {

			var rules = [];
			var onerror;

			angular.forEach(attrs.$attr, function (value, key) {
				if (key === 'onError') {
					onerror = attrs[key];
				} else {
					rules.push({key: key, value: scope.$eval(attrs[key])});
				}
			});

			if (rules.length === 0) {
				throw 'Bad rule declaration : no rule defined in\n';
			// } else if (onerror === undefined) {
			// 	throw 'Bad rule declaration : no on-error defined\n';
			} else {
				angular.forEach(rules, function(rule) {
					parentCtrl.addRule(rule.key, rule.value, onerror);
				});
			}
		}
	};
}]);

})();
