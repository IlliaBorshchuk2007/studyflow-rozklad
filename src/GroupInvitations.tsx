import {useEffect,useState} from 'react';
import {Copy,Link2,RefreshCw,XCircle} from 'lucide-react';
import {supabase} from './lib/supabase.ts';
import './learning.css';
type Invite={id:string;group_id:string;expires_at:string;max_uses:number;uses:number;revoked_at:string|null};
export default function GroupInvitations({groupId}:{groupId:string}){
 const [items,setItems]=useState<Invite[]>([]),[minutes,setMinutes]=useState(10080),[maxUses,setMaxUses]=useState(20);
 const [link,setLink]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const refresh=async()=>{if(!supabase||!groupId)return;const {data,error:e}=await supabase.from('group_invitations').select('id,group_id,expires_at,max_uses,uses,revoked_at').eq('group_id',groupId).order('expires_at',{ascending:false});if(e)setError(e.message);else setItems((data||[]) as Invite[]);};
 useEffect(()=>{setLink('');void refresh();},[groupId]);
 const create=async()=>{if(!supabase||!groupId)return;setLoading(true);setError('');const {data,error:e}=await supabase.rpc('create_group_invitation',{p_group:groupId,p_expire_minutes:minutes,p_uses:maxUses});setLoading(false);if(e){setError(e.message);return;}setLink(location.origin+'/?invite='+data);await refresh();};
 const revoke=async(id:string)=>{if(!supabase||!window.confirm('Відкликати це запрошення?'))return;setError('');const {error:e}=await supabase.from('group_invitations').update({revoked_at:new Date().toISOString()}).eq('id',id);if(e)setError(e.message);else await refresh();};
 return <div className="invite-manager"><h3><Link2 size={17}/> Запрошення до групи</h3><p>Створюй посилання з терміном дії та лімітом використань. Студент має ввійти у свій акаунт.</p><div className="learning-row"><label>Термін<select value={minutes} onChange={e=>setMinutes(Number(e.target.value))}><option value={60}>1 година</option><option value={1440}>1 день</option><option value={10080}>7 днів</option><option value={43200}>30 днів</option></select></label><label>Максимум використань<input type="number" min={1} max={1000} value={maxUses} onChange={e=>setMaxUses(Number(e.target.value))}/></label><button className="btn primary" disabled={loading||!groupId} onClick={()=>void create()}>{loading?'Створення…':'Створити посилання'}</button></div>
 {link&&<div className="invite-created"><strong>Скопіюй зараз — токен не зберігається у відкритому вигляді.</strong><input readOnly value={link} aria-label="Посилання запрошення"/><button className="btn light compact" onClick={()=>void navigator.clipboard.writeText(link)}><Copy size={14}/> Копіювати</button></div>}
 {error&&<p className="learning-danger" role="alert">{error}</p>}
 <h4>Активні та попередні запрошення</h4>{items.length?items.map(i=><div key={i.id} className="invite-entry"><span>{new Date(i.expires_at).toLocaleString('uk-UA')} · {i.uses}/{i.max_uses} використань {i.revoked_at?'· відкликано':new Date(i.expires_at)<new Date()?'· прострочено':''}</span>{!i.revoked_at&&new Date(i.expires_at)>new Date()&&<button className="btn light compact" onClick={()=>void revoke(i.id)}><XCircle size={14}/> Відкликати</button>}</div>):<p className="muted">Запрошень поки немає.</p>}<button className="btn light compact" onClick={()=>void refresh()}><RefreshCw size={14}/> Оновити</button></div>;
}
