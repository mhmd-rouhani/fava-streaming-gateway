export interface StoredFile {
  key: string;
  size?: number;
  lastModified?: string | Date;
  etag?: string;
}

export interface FilesListResponse {
  files: StoredFile[];
}

export interface UploadFileInfo {
  key: string;
  originalName: string;
  contentType: string;
  etag?: string;
}

export interface UploadSuccessResponse {
  message: string;
  file: UploadFileInfo;
}

export interface ApiErrorBody {
  error?: string;
}
