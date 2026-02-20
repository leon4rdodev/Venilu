export interface IPCResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  // Some handlers return data directly under a specific key, 
  // but we should move towards this standard.
  [key: string]: any; 
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
