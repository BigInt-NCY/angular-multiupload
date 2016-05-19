module.exports = function(grunt) {

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),

		dirs: {
			src:   './src',
			dist:  './dist'
		},

		clean: {
			dist: {
				src: ['<%= dirs.dist %>/']
			},
			templates: {
				src: '<%= dirs.dist %>/js/templates.js'
			}
		},

		copy: {
			scss: {
				src: '<%= dirs.src %>/css/upload.scss',
				dest: '<%= dirs.dist %>/css/',
				flatten: true,
				expand: true,
				filter: 'isFile'
			}
		},

		scsslint: {
			allFiles: ['<%= dirs.src %>/css/**/*.scss'],
			options: {
				config: '.scss_lint.yml',
				colorizeOutput: true
			}
		},

		sass: {
			dev: {
				options: {
					style: 'expanded',
					'default-encoding': 'UTF-8',
					sourcemap: 'none'
				},
				files: [{
					expand: true,
					cwd: '<%= dirs.src %>/css/',
					src: ['**/*.scss'],
					dest: '<%= dirs.dist %>/css/',
					ext: '.css',
					nonull: true
				}]
			},
			prod: {
				options: {
					style: 'compressed',
					'default-encoding': 'UTF-8',
					sourcemap: 'none'
				},
				files: [{
					expand: true,
					cwd: '<%= dirs.src %>/css/',
					src: ['**/*.scss'],
					dest: '<%= dirs.dist %>/css/',
					ext: '.css',
					nonull: true
				}]
			}
		},

		postcss: {
			options: {
				map: false,
				processors: [
					require('autoprefixer')({
						browsers: ['> 1%']
					})
				]
			},
			dist: {
				src: '<%= dirs.dist %>/css/**/*.css'
			}
		},

		cssmin: {
			dist: {
				files: [{
					expand: true,
					cwd: '<%= dirs.dist %>/css/',
					src: ['**/*.css'],
					dest: '<%= dirs.dist %>/css/',
					ext: '.min.css'
				}]
			}
		},

		jshint: {
			files: {
				src: ['<%= dirs.src %>/js/**/*.js']
			},
			options: {
				jshintrc: '.jshintrc'
			}
		},

		ngtemplates:  {
			app:        {
				cwd: '<%= dirs.src %>/js/',
				src: '**/templates/*.html',
				dest: '<%= dirs.dist %>/js/templates.js',
				options: {
					module: 'multiUpload'
				}
			}
		},

		uglify: {
			dev: {
				options: {
					expand: true,
					sourceMap: true,
					mangle: false,
					preserveComments: true,
					compress: false,
					beautify: true
				},
				src: ['<%= dirs.src %>/js/multiupload.js', '<%= dirs.src %>/js/**/*.js', '<%= dirs.dist %>/js/templates.js'],
				dest: '<%= dirs.dist %>/js/multiupload.js',
			},
			prod: {
				options: {
					expand: true
				},
				src: ['<%= dirs.src %>/js/multiupload.js', '<%= dirs.src %>/js/**/*.js', '<%= dirs.dist %>/js/templates.js'],
				dest: '<%= dirs.dist %>/js/multiupload.min.js',
			}
		},
	});

	require('load-grunt-tasks')(grunt, { scope: 'dependencies' });
	require('load-grunt-tasks')(grunt, { scope: 'devDependencies' });

	grunt.registerTask('init', [
		'clean:dist'
	]);
	
	grunt.registerTask('css_dev', [
		'scsslint',
		'sass:dev',
		'postcss:dist'
	]);

	grunt.registerTask('css_prod', [
		'scsslint',
		'sass:prod',
		'postcss:dist',
		'cssmin:dist',
		'copy:scss'
	]);

	grunt.registerTask('js_dev', [
		'jshint',
		'ngtemplates',
		'uglify:dev',
		'clean:templates'
	]);

	grunt.registerTask('js_prod', [
		'jshint',
		'ngtemplates',
		'uglify:dev',
		'uglify:prod',
		'clean:templates'
	]);

	grunt.registerTask('dev', [
		'init',
		'css_dev',
		'js_dev'
	]);

	grunt.registerTask('prod', [
		'init',
		'css_prod',
		'js_prod'
	]);

};
