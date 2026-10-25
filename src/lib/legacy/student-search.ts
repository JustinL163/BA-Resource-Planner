import { createStudentSearchIndex, searchStudents, stringSimilarity } from '../domain/planner/student-search';

export const studentSearch = { createStudentSearchIndex, searchStudents, stringSimilarity };
window.BAStudentSearch = studentSearch;
