"use client";

import { registerPlugin } from "react-filepond";
import FileValidateType from "filepond-plugin-file-validate-type";
import FileValidateSize from "filepond-plugin-file-validate-size";
import ImageExifOrientation from "filepond-plugin-image-exif-orientation";
import ImagePreview from "filepond-plugin-image-preview";
import "filepond-plugin-image-preview/dist/filepond-plugin-image-preview.css";

registerPlugin(FileValidateType, FileValidateSize, ImageExifOrientation, ImagePreview);

export { FilePond } from "react-filepond";
