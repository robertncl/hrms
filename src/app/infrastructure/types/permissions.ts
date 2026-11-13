export type Permissions =
  | 'ViewEmployees'
  | 'EditEmployeeGeneralDetails'
  | 'EditEmployeePrivateDetails'
  | 'DeleteEmployee'
  | 'CreateEmployee'
  | 'ManageCourses'
  | 'ApproveTimeOff'
  | 'ManageHiring'
  | 'AssignTraining'
  /**
   * Reach beyond your own reporting line. Without it, approving time off,
   * editing people and assigning training cover only the people who report
   * to you, directly or through their managers.
   */
  | 'OrgWideAccess';

export const ALL_PERMISSION_NAMES: Permissions[] = [
  'ViewEmployees',
  'EditEmployeeGeneralDetails',
  'EditEmployeePrivateDetails',
  'DeleteEmployee',
  'CreateEmployee',
  'ManageCourses',
  'ApproveTimeOff',
  'ManageHiring',
  'AssignTraining',
  'OrgWideAccess',
];
