/**
 * UI and component-related types
 * @file src/types/ui.ts
 */

/**
 * Button component props
 */
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  isLoading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

/**
 * Input component props
 */
export interface InputProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'date';
  name: string;
  label?: string;
  placeholder?: string;
  value?: string | number;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  maxLength?: number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  className?: string;
}

/**
 * Card component props
 */
export interface CardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'outlined';
}

/**
 * Modal component props
 */
export interface ModalProps {
  isOpen: boolean;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeButton?: boolean;
  backdrop?: 'static' | 'clickable';
}

/**
 * Toast/Notification types
 */
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

/**
 * Table column definition
 */
export interface TableColumn<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  width?: string;
  render?: (value: any, row: T) => React.ReactNode;
}

/**
 * Table props
 */
export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  pagination?: PaginationState;
  onPageChange?: (page: number) => void;
  onSort?: (column: string, order: 'ASC' | 'DESC') => void;
}

/**
 * Pagination state
 */
export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Form field state
 */
export interface FormFieldState {
  value: any;
  touched: boolean;
  error?: string;
  isDirty: boolean;
}

/**
 * Navigation item
 */
export interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  badge?: number | string;
  children?: NavItem[];
}

/**
 * Breadcrumb item
 */
export interface BreadcrumbItem {
  label: string;
  href?: string;
  isActive?: boolean;
}
