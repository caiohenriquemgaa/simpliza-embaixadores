import { createPublicSupabaseClient } from "./supabase";
export async function requireAdmin(request:Request){const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");if(!token)return null;const client=createPublicSupabaseClient();if(!client)return null;const{data,error}=await client.auth.getUser(token);if(error||!data.user||data.user.app_metadata?.role!=="admin")return null;return data.user}
export function unauthorized(){return Response.json({error:"Acesso administrativo não autorizado."},{status:401})}
