export enum UserRole {
  ADMIN = 'ADMIN',
  MAKER = 'MAKER',
  CHECKER = 'CHECKER',
  TELLER = 'TELLER',
  CUSTOMER = 'CUSTOMER',
}

export enum Permission {
  // Customer permissions
  CUSTOMER_VIEW = 'customer:view',
  CUSTOMER_CREATE = 'customer:create',
  CUSTOMER_UPDATE = 'customer:update',
  CUSTOMER_DELETE = 'customer:delete',
  
  // Account permissions
  ACCOUNT_VIEW = 'account:view',
  ACCOUNT_CREATE = 'account:create',
  ACCOUNT_UPDATE = 'account:update',
  ACCOUNT_CLOSE = 'account:close',
  
  // Transaction permissions
  TRANSACTION_VIEW = 'transaction:view',
  TRANSACTION_CREATE = 'transaction:create',
  TRANSACTION_APPROVE = 'transaction:approve',
  TRANSACTION_REVERSE = 'transaction:reverse',
  
  // Loan permissions
  LOAN_VIEW = 'loan:view',
  LOAN_CREATE = 'loan:create',
  LOAN_APPROVE = 'loan:approve',
  LOAN_REPAY = 'loan:repay',
  
  // Deposit permissions
  DEPOSIT_VIEW = 'deposit:view',
  DEPOSIT_CREATE = 'deposit:create',
  DEPOSIT_APPROVE = 'deposit:approve',
  DEPOSIT_WITHDRAW = 'deposit:withdraw',
  
  // User management
  USER_VIEW = 'user:view',
  USER_CREATE = 'user:create',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  
  // Role management
  ROLE_VIEW = 'role:view',
  ROLE_CREATE = 'role:create',
  ROLE_UPDATE = 'role:update',
  ROLE_DELETE = 'role:delete',
  
  // Report permissions
  REPORT_VIEW = 'report:view',
  REPORT_EXPORT = 'report:export',
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: Object.values(Permission),
  [UserRole.MAKER]: Object.values(Permission).filter(
    p => !p.includes('delete') && !p.includes('user:')
  ),
  [UserRole.CHECKER]: Object.values(Permission).filter(
    p => p.includes('approve')
  ),
  [UserRole.TELLER]: [
    Permission.CUSTOMER_VIEW,
    Permission.ACCOUNT_VIEW,
    Permission.TRANSACTION_VIEW,
    Permission.TRANSACTION_CREATE,
    Permission.DEPOSIT_VIEW,
    Permission.DEPOSIT_CREATE,
  ],
  [UserRole.CUSTOMER]: [
    Permission.ACCOUNT_VIEW,
    Permission.TRANSACTION_VIEW,
    Permission.LOAN_VIEW,
    Permission.DEPOSIT_VIEW,
  ],
};