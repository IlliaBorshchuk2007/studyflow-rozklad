export type Role = 'student' | 'teacher' | 'admin';
export type LessonStatus = 'scheduled' | 'rescheduled' | 'cancelled';
export interface Profile { id:string; full_name:string; role:Role; avatar_url:string|null; created_at?:string; }
export interface Group { id:string; name:string; description:string; }
export interface Membership { id:string; group_id:string; user_id:string; member_role:'student'|'teacher'; }
export interface Lesson { id:string; title:string; lesson_date:string; day_of_week:number; starts_at:string; ends_at:string; duration_minutes:number; teacher_id:string|null; group_id:string|null; room:string; note:string; link:string; materials_url:string; homework:string; status:LessonStatus; created_by:string; created_by_name:string; created_at:string; }
export type LessonPayload=Pick<Lesson,'title'|'lesson_date'|'day_of_week'|'starts_at'|'ends_at'|'duration_minutes'|'teacher_id'|'group_id'|'room'|'note'|'link'|'materials_url'|'homework'|'status'>;
export interface AuditEntry {id:string;lesson_id:string|null;lesson_title:string;action:'created'|'updated'|'rescheduled'|'deleted';actor_id:string|null;actor_name:string;actor_role:string;old_data:Record<string,unknown>|null;new_data:Record<string,unknown>|null;occurred_at:string;}
export interface Notice { id:string;user_id:string;lesson_id:string|null;message:string;created_at:string;read_at:string|null;}
export interface UserRow {id:string;email:string;full_name:string;role:Role;}
export const ROLE_LABEL:Record<Role,string>={student:'Студент',teacher:'Викладач',admin:'Адміністратор'};
export const STATUS_LABEL:Record<LessonStatus,string>={scheduled:'Заплановано',rescheduled:'Перенесено',cancelled:'Скасовано'};
