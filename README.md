# angular-multiupload

Modular upload directive based on [ng-file-upload](https://github.com/danialfarid/ng-file-upload)



## Getting started


### Download

```bash
bower install angular-multiupload
```

### Examples

#### Easiest configuration
```html
<upload url="'https://upload.server.com'" method="POST" files-list="files"></upload>
```

#### Complete configuration
```html
<upload url="'https://upload.server.com'" method="POST" multipart-name="'file'"
		selectable dropable orderable
		files-list="files" simultaneous="2" multiple
		file-upload-error="'error message'" file-extension-error="file extension not supported"
		file-on-upload-end="uploadEnd" file-onprogress="fileOnProgress" file-oncancel="fileOnCancel"
		file-render-size="fileSizeRender" file-download-link="fileGetDownloadLink"
		valid-rules="filesValidCB" >
	<topinfo>Click here to add new files or drag & drop them here</topinfo>
	<rules accept=".png,.jpg,.jpeg,.gif">
		<rule crop="fileOnCrop"         on-error="image crop error" />
		<rule count="'1,4'"             on-error="image count error" />
		<rule thumbnail="true"          on-error="image thumbnail error" />
		<rule validator="imageValidator" />
	</rules>
	<rules accept=".wmv,.mp4,.avi">
		<rule count="'0,'"               on-error="video count error" />
		<rule validator="videoValidator" />
</upload>
```



## Documentation


### Documentation for **\<upload\>** directive

#### Complete attributes list
| attribute          | short description                                              | default           | mandatory | bind input | raw input | function prototype                                                                             |
|:------------------ |:-------------------------------------------------------------- |:-----------------:|:---------:|:----------:|:---------:|:---------------------------------------------------------------------------------------------- |
| dropable           | allow files to be dropped on upload form                       | `false`           |           |      *     |           |                                                                                                |
| fileDownloadLink   | generate download link for a file                              | see fct prototype |           |      *     |           | `fct(file) { return file.name; }`                                                              |
| fileExtensionError | written if rules are defined and file does not match any rules | `""`              |           |            |     *     |                                                                                                |
| fileOncancel       | called when a file upload have been cancelled                  | see fct prototype |           |      *     |           | `fct(file, http_code, http_resp) {}`                                                           |
| fileOnprogress     | called each time a file upload progress                        | see fct prototype |           |      *     |           | `fct(file, status, percentil) { return status + ': ' + percentil + '%'; }`                     |
| fileOnUploadEnd    | called when a file upload is completed                         | see fct prototype |           |      *     |           | `fct(file, http_code, http_resp) {}`                                                           |
| fileRenderSize     | called each time a file size must be written                   | see fct prototype |           |      *     |           | `fct(size) { return size + 'o'; }`                                                             |
| filesList          | array containing informations of all files in the upload form  |                   |     *     |      *     |           |                                                                                                |
| fileUploadError    | called when an error occured during upload                     | see fct prototype |           |      *     |           | `fct(file, http_code, http_resp) { return 'upload error'; }`                                   |
| method             | HTTP method to use with url attribute                          |                   |     *     |            |     *     |                                                                                                |
| multipartName      | key used in multipart upload call on url attribute             | `"key"`           |           |            |           |                                                                                                |
| multiple           | allow multiple file selection at once                          | `false`           |           |            |           |                                                                                                |
| orderable          | allow files to be ordered                                      | `false`           |           |            |           |                                                                                                |
| selectable         | allow input to be selected                                     | `false`           |           |            |           |                                                                                                |
| simultaneous       | answer to the "how many file we upload at once" question       | `999`             |           |            |     *     |                                                                                                |
| url                | http endpoint on which upload                                  |                   |     *     |            |           |                                                                                                |
| validRules         | check if current state respect rules                           |                   |           |            |           |                                                                                                |


### Documentation for **\<rules\>** directive

#### Complete attributes list
| attribute | short description                                        | default | mandatory | bind input | raw input |
|:--------- |:-------------------------------------------------------- |:-------:|:---------:|:----------:|:---------:|
| accept    | comma-separated list of allowed extensions for this rule |         |     *     |            |     *     |


### Documentation for **\<rule\>** directive

#### Complete attributes list
| attribute | short description                                           | default | mandatory | bind input | raw input |
|:--------- |:----------------------------------------------------------- |:-------:|:---------:|:----------:|:---------:|
| crop      | called when user click on crop button                       |         |           |      *     |           |
| count     | disable file upload if count is not respected               |         |           |      *     |           |
| thumbnail | called to know how to generate file thumbnail               |         |           |      *     |           |
| validator | called to manually validate the file with your custom rules |         |           |      *     |           |
| on-error  | written if previous attribute function failed               |         |           |            |     *     |



## Contribute

```bash
git clone https://github.com/BigInt-NCY/angular-multiupload.git
npm install
bower install
# work on the project
grunt dev #generate files
# at the end of your work
grunt prod #generate compressed files
```
