(function() {
'use strict';

angular.module('multiUpload')
.directive('movable', [function(){
	return {
		restrict: 'A',
		scope: {
			movable: '=',
			index: '='
		},
		require: '^upload',
		replace: true,
		link: function(scope, element, attrs, parentCtrl) {

			if (scope.movable !== true) {
				return ;
			}

			// dropzone
			element.bind('dragenter', function(e){
				e.preventDefault();
			});

			element.bind('dragleave', function(e){
			});

			element.bind('dragover', function(e){
				e.preventDefault();
			});

			element.bind('drop', function(e){
				e.preventDefault();
				if (e.dataTransfer.getData('index') !== '') {
					scope.$apply(function() {
						parentCtrl.reorder(e.dataTransfer.getData('index'), scope.index);
					});
				}
			});

			// dragzone
			var to_bind_elem = angular.element(element[0].querySelector('.desktop'));

			to_bind_elem.attr('draggable', true);

			to_bind_elem.bind('dragstart', function(e){
				e.dataTransfer.effectAllowed = 'move';
				e.dataTransfer.setData('index', scope.index);
			});

			to_bind_elem.bind('dragend', function(e){
			});
		},
	};
}]);

})();
