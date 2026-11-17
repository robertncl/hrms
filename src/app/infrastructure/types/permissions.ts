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
  | 'OrgWideAccess'
  /**
   * See other people's pay and equity, and propose salary changes for HR to
   * decide. Within your reporting line unless you also have OrgWideAccess.
   * Everyone always sees their own.
   */
  | 'ViewCompensation'
  /** Record and approve salary changes, grant equity, and set pay bands and the share price. */
  | 'ManageCompensation';

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
  'ViewCompensation',
  'ManageCompensation',
];
