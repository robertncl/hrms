export type Permissions =
  | 'ViewEmployees'
  | 'EditEmployeeGeneralDetails'
  | 'EditEmployeePrivateDetails'
  | 'DeleteEmployee'
  | 'CreateEmployee'
  | 'ManageCourses'
  | 'ApproveTimeOff'
  | 'ManageHiring'
  | 'AssignTraining';

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
];
